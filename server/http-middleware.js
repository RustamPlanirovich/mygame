/**
 * HTTP middleware for running ~100 concurrent players.
 *
 * Zero dependencies — everything here is node:zlib plus plain JS. The three things this adds
 * that the server had none of:
 *
 *   1. RESPONSE COMPRESSION. Save blobs are multi-megabyte JSON and every player pulls one on
 *      load and pushes one every 30s. Uncompressed that is tens of MB/s of egress at 100
 *      players for data that gzips to roughly a tenth of its size.
 *   2. RATE LIMITING. There was none anywhere, including on /api/auth/login (unlimited password
 *      guessing) and on order creation.
 *   3. SECURITY HEADERS + a request timeout, so a stuck upstream cannot pin a socket forever.
 */

import zlib from 'node:zlib';

/* ==========================================================================
   Response compression
   ========================================================================== */

const COMPRESSIBLE = /^(?:application\/(?:json|javascript|manifest\+json)|text\/|image\/svg\+xml)/i;

/**
 * gzip/deflate/br for responses above a threshold.
 *
 * Implemented by wrapping res.write/res.end rather than piping, because the API sends everything
 * through res.json() in one shot — so there is no stream to pipe and buffering is already what
 * happens. Small bodies are left alone: below ~1KB the CPU and the 20-byte gzip header cost more
 * than they save.
 */
export function compression({ threshold = 1024, level = zlib.constants.Z_DEFAULT_COMPRESSION } = {}) {
  return function compressionMiddleware(req, res, next) {
    const accepted = String(req.headers['accept-encoding'] ?? '');

    // Brotli compresses JSON meaningfully better than gzip but costs more CPU; at level 4 it is
    // roughly gzip-speed. Prefer it when the client offers it.
    let encoding = null;
    if (/\bbr\b/.test(accepted)) encoding = 'br';
    else if (/\bgzip\b/.test(accepted)) encoding = 'gzip';
    else if (/\bdeflate\b/.test(accepted)) encoding = 'deflate';

    if (!encoding || req.method === 'HEAD') return next();

    const chunks = [];
    let length = 0;
    let ended = false;

    const originalWrite = res.write.bind(res);
    const originalEnd = res.end.bind(res);
    const originalSetHeader = res.setHeader.bind(res);

    const shouldCompress = () => {
      if (res.getHeader('Content-Encoding')) return false; // already encoded upstream
      if (res.getHeader('Cache-Control')?.toString().includes('no-transform')) return false;
      const type = String(res.getHeader('Content-Type') ?? '');
      return COMPRESSIBLE.test(type) && length >= threshold;
    };

    res.write = function write(chunk, encodingArg, cb) {
      if (ended) return false;
      if (chunk) {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, typeof encodingArg === 'string' ? encodingArg : 'utf8');
        chunks.push(buf);
        length += buf.length;
      }
      if (typeof encodingArg === 'function') encodingArg();
      else if (typeof cb === 'function') cb();
      return true;
    };

    res.end = function end(chunk, encodingArg, cb) {
      if (ended) return res;
      if (chunk && typeof chunk !== 'function') {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, typeof encodingArg === 'string' ? encodingArg : 'utf8');
        chunks.push(buf);
        length += buf.length;
      }
      ended = true;

      const body = chunks.length === 1 ? chunks[0] : Buffer.concat(chunks, length);

      if (!shouldCompress()) {
        res.write = originalWrite;
        res.end = originalEnd;
        if (body.length) originalWrite(body);
        return originalEnd(typeof chunk === 'function' ? chunk : cb);
      }

      const done = (err, out) => {
        res.write = originalWrite;
        res.end = originalEnd;

        if (err) {
          // Compression failure must never lose the response.
          if (body.length) originalWrite(body);
          return originalEnd();
        }

        originalSetHeader('Content-Encoding', encoding);
        originalSetHeader('Content-Length', String(out.length));
        // Caches must key on the encoding or a gzip body can be served to a client that did
        // not ask for one.
        const vary = res.getHeader('Vary');
        const varyStr = vary ? String(vary) : '';
        if (!/accept-encoding/i.test(varyStr)) {
          originalSetHeader('Vary', varyStr ? `${varyStr}, Accept-Encoding` : 'Accept-Encoding');
        }
        originalWrite(out);
        originalEnd();
      };

      if (encoding === 'br') {
        zlib.brotliCompress(
          body,
          { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 4, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: body.length } },
          done,
        );
      } else if (encoding === 'gzip') {
        zlib.gzip(body, { level }, done);
      } else {
        zlib.deflate(body, { level }, done);
      }
      return res;
    };

    next();
  };
}

/* ==========================================================================
   Rate limiting
   ========================================================================== */

/**
 * Fixed-window counter, per key, in process memory.
 *
 * In-process is the right scope here: the deploy is a single pm2 fork (see ecosystem.config.cjs,
 * instances: 1). If that ever becomes a cluster this needs to move to Postgres or Redis, because
 * per-process windows would multiply the effective limit by the worker count.
 */
class RateLimiter {
  constructor() {
    /** @type {Map<string, {count: number, resetAt: number}>} */
    this.buckets = new Map();
    // Sweep expired buckets so a botnet cycling IPs cannot grow this map without bound.
    this.sweeper = setInterval(() => this.sweep(), 60_000);
    this.sweeper.unref();
  }

  sweep() {
    const now = Date.now();
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }

  hit(key, limit, windowMs) {
    const now = Date.now();
    let bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      this.buckets.set(key, bucket);
    }
    bucket.count++;
    return {
      allowed: bucket.count <= limit,
      remaining: Math.max(0, limit - bucket.count),
      resetAt: bucket.resetAt,
      retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }

  reset() {
    this.buckets.clear();
  }

  stop() {
    clearInterval(this.sweeper);
  }
}

export const limiter = new RateLimiter();

/**
 * Client identity for rate-limiting purposes.
 *
 * Authenticated requests key on the user id, so one player behind a shared NAT cannot exhaust
 * everyone else's budget. Unauthenticated ones fall back to the IP. `req.ip` respects Express'
 * trust proxy setting; behind a reverse proxy the app MUST set `app.set('trust proxy', 1)` or
 * every request appears to come from the proxy and shares one bucket.
 */
function clientKey(req) {
  if (req.userId) return `u:${req.userId}`;
  const fwd = req.headers['x-forwarded-for'];
  const ip = req.ip || (typeof fwd === 'string' ? fwd.split(',')[0].trim() : null) || req.socket?.remoteAddress || 'unknown';
  return `ip:${ip}`;
}

/**
 * @param {object} opts
 * @param {number} opts.limit    requests allowed per window
 * @param {number} opts.windowMs window length in ms
 * @param {string} [opts.name]   bucket namespace, so two limiters do not share a counter
 * @param {(req: any) => boolean} [opts.skip]
 */
export function rateLimit({ limit, windowMs, name = 'default', skip }) {
  return function rateLimitMiddleware(req, res, next) {
    if (typeof skip === 'function' && skip(req)) return next();

    const { allowed, remaining, resetAt, retryAfterSec } = limiter.hit(
      `${name}:${clientKey(req)}`,
      limit,
      windowMs,
    );

    res.setHeader('RateLimit-Limit', String(limit));
    res.setHeader('RateLimit-Remaining', String(remaining));
    res.setHeader('RateLimit-Reset', String(Math.ceil((resetAt - Date.now()) / 1000)));

    if (!allowed) {
      res.setHeader('Retry-After', String(retryAfterSec));
      res.status(429).json({
        ok: false,
        error: 'RATE_LIMITED',
        message: `Слишком много запросов. Повторите через ${retryAfterSec} с.`,
        retryAfterSeconds: retryAfterSec,
      });
      return;
    }

    next();
  };
}

/* ==========================================================================
   Security headers
   ========================================================================== */

export function securityHeaders({ isProduction = false } = {}) {
  return function securityHeadersMiddleware(_req, res, next) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    // Express advertises itself by default; there is no reason to tell the world the stack.
    res.removeHeader('X-Powered-By');
    if (isProduction) {
      res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
    }
    next();
  };
}

/* ==========================================================================
   Request timeout
   ========================================================================== */

/**
 * Caps how long a single request may occupy a socket. Paired with the pool's
 * statement_timeout this bounds the worst case for a stuck handler.
 */
export function requestTimeout(ms = 30_000) {
  return function requestTimeoutMiddleware(req, res, next) {
    const timer = setTimeout(() => {
      if (res.headersSent || res.writableEnded) return;
      console.warn(`[http] request timeout after ${ms}ms: ${req.method} ${req.originalUrl}`);
      res.status(503).json({ ok: false, error: 'REQUEST_TIMEOUT' });
    }, ms);
    timer.unref();

    const clear = () => clearTimeout(timer);
    res.on('finish', clear);
    res.on('close', clear);
    next();
  };
}

/* ==========================================================================
   Preset limits
   ========================================================================== */

/**
 * Chosen against the real client behaviour: autosave every 30s, market-transaction poll every
 * 10s, plus normal UI browsing. Generous enough that a legitimate player never sees a 429.
 */
export const LIMITS = {
  // Password guessing / account enumeration.
  auth: { name: 'auth', limit: 12, windowMs: 5 * 60_000 },
  // Save writes: autosave is 1 per 30s, so 40/5min leaves a lot of slack for manual saves.
  saves: { name: 'saves', limit: 40, windowMs: 5 * 60_000 },
  // Order creation already has its own 60s cooldown in market.js; this is the abuse backstop.
  orders: { name: 'orders', limit: 60, windowMs: 5 * 60_000 },
  // The vault deposit endpoint is the economy's trust boundary — keep it tight.
  vaultDeposit: { name: 'vault-deposit', limit: 30, windowMs: 5 * 60_000 },
  // Admin mutations.
  admin: { name: 'admin', limit: 120, windowMs: 60_000 },
  // Everything else.
  general: { name: 'general', limit: 600, windowMs: 60_000 },
};
