/**
 * Админ-панель: серверная часть.
 *
 * - initAdminTables(pool)  — схема (роли, баны, аудит, объявления) + бутстрап ADMIN_EMAILS
 * - createAdminRoutes(app, pool, authMiddleware) — все /api/admin/* и публичный /api/announcements
 *
 * Ключевые правила безопасности (проверяются ТОЛЬКО на сервере):
 *  - роль читается из users.role, клиентские значения не используются никогда;
 *  - себя нельзя забанить, понизить или удалить;
 *  - последнего администратора нельзя понизить или удалить;
 *  - модератор — только чтение + ban/unban/logout-all, и только для не-персонала;
 *  - каждая мутация пишет строку в admin_audit_log (без паролей и токенов).
 */
import Decimal from 'break_eternity.js';
import { encodePasswordForStorage } from './auth-password.js';
import { runOracleUpdate } from './ai-oracle.js';

// ============================================================================
// Константы
// ============================================================================

export const ROLES = Object.freeze(['player', 'moderator', 'admin']);
const ROLE_RANK = Object.freeze({ player: 0, moderator: 1, admin: 2 });

/** Постоянный бан хранится как 'infinity'::timestamptz — единый сентинел на весь код. */
const PERMANENT_BAN = 'infinity';

/** Игрок считается «онлайн», если сессия активна и была активность за это время. */
const ONLINE_WINDOW = "INTERVAL '5 minutes'";

const SEVERITIES = Object.freeze(['info', 'warning', 'critical']);

const MAX_PAGE_SIZE = 200;
const DEFAULT_PAGE_SIZE = 50;

const PLAYER_SORTS = Object.freeze({
  created_at: 'created_at',
  last_seen_at: 'last_seen_at',
  email: 'email',
  play_time: 'play_time_seconds',
  total_volume: 'total_volume',
});

/** Ресурсы в сохранении: ключи вида ore / dark_matter. */
const RESOURCE_KEY_RE = /^[a-z][a-z0-9_]{0,39}$/;
/** Допустимая запись величины для гранта (обычное число или экспоненциальная запись). */
const AMOUNT_RE = /^-?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][-+]?\d+)?$/;

// ============================================================================
// Мелкие утилиты
// ============================================================================

const n = (v) => (v === null || v === undefined ? 0 : Number(v));

function clientIp(req) {
  return req.ip || req.socket?.remoteAddress || null;
}

/** Экранируем спецсимволы LIKE, чтобы поиск по e-mail был буквальным. */
function likeEscape(value) {
  return String(value).replace(/([\\%_])/g, '\\$1');
}

function parseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 && id <= 2147483647 ? id : null;
}

function clampInt(value, min, max, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(num)));
}

function bad(res, status, error, message, extra = {}) {
  res.status(status).json({ ok: false, error, message, ...extra });
}

/** Оборачивает обработчик, чтобы любая ошибка стала JSON-ответом, а не падением процесса. */
function route(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (e) {
      console.error(`[admin] ${req.method} ${req.originalUrl} failed:`, e);
      if (!res.headersSent) {
        res.status(500).json({ ok: false, error: 'INTERNAL_ERROR', message: String(e?.message ?? e) });
      }
    }
  };
}

/** Рекурсивно вычищает всё, что похоже на секрет, перед записью в журнал. */
const SECRET_KEY_RE = /pass|pwd|token|secret|authorization|credential/i;
function redact(value, depth = 0) {
  if (depth > 6) return '[too deep]';
  if (Array.isArray(value)) return value.slice(0, 200).map((v) => redact(v, depth + 1));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SECRET_KEY_RE.test(k) ? '[redacted]' : redact(v, depth + 1);
    }
    return out;
  }
  if (typeof value === 'string' && value.length > 2000) return `${value.slice(0, 2000)}…`;
  return value;
}

/** Разбирает величину для гранта (строка/число) в Decimal. null — если запись некорректна. */
function parseAmount(raw) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return null;
    return new Decimal(raw);
  }
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  // break_eternity молча превращает мусор в 0 — поэтому валидируем сами.
  if (!AMOUNT_RE.test(trimmed)) return null;
  return new Decimal(trimmed);
}

/** Значение из сохранения → Decimal. null, если это не похоже на число. */
function decFromSave(raw) {
  if (raw === null || raw === undefined) return new Decimal(0);
  if (typeof raw === 'number') return Number.isFinite(raw) ? new Decimal(raw) : null;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed === '') return new Decimal(0);
  // Значения из break_eternity: 1e500, 1e1e10, 10^^5, (10^)^7 1.5 и т.п.
  if (!/^[-+0-9.eE^() ]+$/.test(trimmed)) return null;
  try {
    const d = new Decimal(trimmed);
    return d.isNan() ? null : d;
  } catch {
    return null;
  }
}

const isPlainObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

/** Список e-mail из ADMIN_EMAILS (в нижнем регистре). */
function bootstrapAdminEmails() {
  return String(process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Роль, с которой создаётся новый аккаунт. Единственный способ получить
 * первого администратора — перечислить его e-mail в ADMIN_EMAILS.
 */
export function bootstrapRoleForEmail(email) {
  if (typeof email !== 'string') return 'player';
  return bootstrapAdminEmails().includes(email.trim().toLowerCase()) ? 'admin' : 'player';
}

// SQL-фрагмент с информацией о бане: сентинел 'infinity' не сериализуется в JSON,
// поэтому наружу отдаём отдельный флаг ban_permanent.
const BAN_FIELDS_SQL = `
    CASE WHEN u.banned_until = ${sqlLit(PERMANENT_BAN)}::timestamptz THEN NULL ELSE u.banned_until END AS banned_until,
    COALESCE(u.banned_until = ${sqlLit(PERMANENT_BAN)}::timestamptz, false) AS ban_permanent,
    COALESCE(u.banned_until IS NOT NULL AND u.banned_until > NOW(), false) AS is_banned,
    u.ban_reason`;

function sqlLit(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

/**
 * Общий CTE с агрегатами по игроку. Одним запросом, без N+1:
 * сессии, слоты, сохранения, трейдер, гильдия и открытые ордера — подзапросами.
 */
const PLAYER_BASE_CTE = `
  WITH base AS (
    SELECT
      u.id,
      u.email,
      u.role,
      u.created_at,
      u.last_seen_at,
      u.notes,
      ${BAN_FIELDS_SQL},
      COALESCE(s.session_count, 0)::int AS session_count,
      s.last_activity_at,
      COALESCE(s.last_activity_at > NOW() - ${ONLINE_WINDOW}, false) AS online,
      COALESCE(sl.slot_count, 0)::int AS slot_count,
      COALESCE(sl.play_time_seconds, 0)::bigint AS play_time_seconds,
      COALESCE(sv.save_count, 0)::int AS save_count,
      COALESCE(t.total_volume, 0) AS total_volume,
      COALESCE(t.total_trades, 0)::int AS total_trades,
      COALESCE(t.successful_trades, 0)::int AS successful_trades,
      t.rating AS trader_rating,
      gi.guild_id,
      gi.guild_name,
      gi.guild_tag,
      gi.guild_role,
      gi.guild_contribution,
      COALESCE(o.open_order_count, 0)::int AS open_order_count
    FROM users u
    LEFT JOIN (
      SELECT user_id, COUNT(*) AS session_count, MAX(last_activity_at) AS last_activity_at
      FROM sessions WHERE expires_at > NOW() GROUP BY user_id
    ) s ON s.user_id = u.id
    LEFT JOIN (
      SELECT user_id, COUNT(*) AS slot_count, COALESCE(SUM(play_time_seconds), 0) AS play_time_seconds
      FROM game_slots GROUP BY user_id
    ) sl ON sl.user_id = u.id
    LEFT JOIN (
      SELECT user_id, COUNT(*) AS save_count FROM game_save GROUP BY user_id
    ) sv ON sv.user_id = u.id
    LEFT JOIN traders t ON t.player_id = u.id
    LEFT JOIN LATERAL (
      SELECT g.id AS guild_id, g.name AS guild_name, g.tag AS guild_tag,
             gm.role AS guild_role, gm.contribution AS guild_contribution
      FROM guild_members gm
      JOIN guilds g ON g.id = gm.guild_id
      WHERE gm.player_id = u.id
      ORDER BY gm.joined_at ASC
      LIMIT 1
    ) gi ON TRUE
    LEFT JOIN (
      SELECT player_id, COUNT(*) AS open_order_count
      FROM market_orders WHERE status IN ('open', 'partial') GROUP BY player_id
    ) o ON o.player_id = u.id
  )`;

// ============================================================================
// Схема
// ============================================================================

/**
 * Идемпотентная миграция схемы админки. Безопасно вызывать при каждом старте.
 * @param {import('pg').Pool} pool
 */
export async function initAdminTables(pool) {
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'player';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_until TIMESTAMPTZ;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_reason TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS notes TEXT;
  `);

  // CHECK-констрейнты не поддерживают IF NOT EXISTS.
  try {
    await pool.query(`
      DO $$ BEGIN
        ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('player', 'moderator', 'admin'));
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
  } catch (e) {
    console.warn('[admin] не удалось добавить users_role_check (проверьте данные в users.role):', e?.message ?? e);
  }

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role) WHERE role <> 'player';
    CREATE INDEX IF NOT EXISTS idx_users_last_seen ON users(last_seen_at DESC);
    CREATE INDEX IF NOT EXISTS idx_users_banned_until ON users(banned_until) WHERE banned_until IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_sessions_last_activity ON sessions(last_activity_at DESC);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_audit_log (
      id BIGSERIAL PRIMARY KEY,
      admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      admin_email TEXT,
      action TEXT NOT NULL,
      target_user_id INTEGER,
      details JSONB NOT NULL DEFAULT '{}'::jsonb,
      ip_address TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit_log(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_admin_audit_target ON admin_audit_log(target_user_id);
    CREATE INDEX IF NOT EXISTS idx_admin_audit_admin ON admin_audit_log(admin_id);
    CREATE INDEX IF NOT EXISTS idx_admin_audit_action ON admin_audit_log(action);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_announcements (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
      active BOOLEAN NOT NULL DEFAULT true,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_admin_announcements_active
      ON admin_announcements(active, created_at DESC);
  `);

  // Бутстрап администраторов из ADMIN_EMAILS — единственный способ создать первого админа.
  const emails = bootstrapAdminEmails();
  if (emails.length === 0) {
    const existing = await pool.query(`SELECT COUNT(*)::int AS c FROM users WHERE role = 'admin'`);
    if (existing.rows[0].c === 0) {
      console.log('[admin] ADMIN_EMAILS не задан и администраторов в базе нет — админ-панель недоступна.');
    }
    return;
  }

  const promoted = await pool.query(
    `UPDATE users SET role = 'admin'
      WHERE LOWER(email) = ANY($1::text[]) AND role <> 'admin'
      RETURNING id, email`,
    [emails]
  );
  const known = await pool.query(
    `SELECT LOWER(email) AS email FROM users WHERE LOWER(email) = ANY($1::text[])`,
    [emails]
  );
  const knownSet = new Set(known.rows.map((r) => r.email));
  const missing = emails.filter((e) => !knownSet.has(e));

  console.log(`[admin] ADMIN_EMAILS: ${emails.length} адрес(ов) в списке.`);
  if (promoted.rowCount > 0) {
    console.log(`[admin] ADMIN_EMAILS: повышено до admin — ${promoted.rows.map((r) => `${r.email} (#${r.id})`).join(', ')}`);
  } else if (knownSet.size > 0) {
    console.log('[admin] ADMIN_EMAILS: все зарегистрированные адреса из списка уже администраторы.');
  }
  if (missing.length > 0) {
    console.log(`[admin] ADMIN_EMAILS: ещё не зарегистрированы (получат admin при регистрации) — ${missing.join(', ')}`);
  }
}

// ============================================================================
// Ограничитель частоты (token bucket, в памяти процесса, без зависимостей)
// ============================================================================

function createTokenBucketLimiter({ capacity, refillPerSecond, name }) {
  const buckets = new Map();

  const timer = setInterval(() => {
    const cutoff = Date.now() - 10 * 60 * 1000;
    for (const [key, bucket] of buckets) {
      if (bucket.updatedAt < cutoff) buckets.delete(key);
    }
  }, 5 * 60 * 1000);
  if (typeof timer.unref === 'function') timer.unref();

  return function limiter(req, res, next) {
    const key = String(req.userId ?? clientIp(req) ?? 'anonymous');
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { tokens: capacity, updatedAt: now };
      buckets.set(key, bucket);
    }
    const elapsedSec = (now - bucket.updatedAt) / 1000;
    bucket.tokens = Math.min(capacity, bucket.tokens + elapsedSec * refillPerSecond);
    bucket.updatedAt = now;

    if (bucket.tokens < 1) {
      const retryAfter = Math.max(1, Math.ceil((1 - bucket.tokens) / refillPerSecond));
      res.setHeader('Retry-After', String(retryAfter));
      console.warn(`[admin] rate limit (${name}) для ключа ${key}`);
      bad(res, 429, 'RATE_LIMITED', 'Слишком много изменений подряд. Подождите немного.', { retryAfter });
      return;
    }

    bucket.tokens -= 1;
    next();
  };
}

// ============================================================================
// Маршруты
// ============================================================================

/**
 * @param {import('express').Express} app
 * @param {import('pg').Pool} pool
 * @param {import('express').RequestHandler} authMiddleware
 */
export function createAdminRoutes(app, pool, authMiddleware) {
  const mutationLimiter = createTokenBucketLimiter({
    capacity: clampInt(process.env.ADMIN_RATE_LIMIT_BURST, 5, 10_000, 120),
    refillPerSecond: Math.max(0.1, Number(process.env.ADMIN_RATE_LIMIT_PER_SEC ?? 2)),
    name: 'admin-mutations',
  });

  // --------------------------------------------------------------------------
  // Роли и журнал
  // --------------------------------------------------------------------------

  /** Кто выполняет запрос (роль всегда из БД, никогда из тела запроса). */
  async function loadActor(req) {
    if (req.userRole && req.userEmail) {
      return { id: req.userId, email: req.userEmail, role: req.userRole };
    }
    const result = await pool.query('SELECT id, email, role FROM users WHERE id = $1', [req.userId]);
    return result.rows[0] ?? null;
  }

  /**
   * Требует роль не ниже указанной. Ставится ПОСЛЕ authMiddleware.
   * Роль всегда берётся из users.role — значение из запроса не используется.
   */
  function requireRole(minRole) {
    const needed = ROLE_RANK[minRole];
    return async function roleGuard(req, res, next) {
      try {
        const actor = await loadActor(req);
        if (!actor) {
          bad(res, 401, 'NOT_AUTHENTICATED', 'Сессия не найдена.');
          return;
        }
        const rank = ROLE_RANK[actor.role] ?? 0;
        if (rank < needed) {
          if (minRole === 'admin') {
            bad(res, 403, 'ADMIN_REQUIRED', 'Требуются права администратора.');
          } else {
            bad(res, 403, 'MODERATOR_REQUIRED', 'Требуются права модератора.');
          }
          return;
        }
        req.actor = actor;
        req.userRole = actor.role;
        req.userEmail = actor.email;
        next();
      } catch (e) {
        console.error('[admin] requireRole failed:', e);
        if (!res.headersSent) {
          res.status(500).json({ ok: false, error: 'INTERNAL_ERROR', message: String(e?.message ?? e) });
        }
      }
    };
  }

  const guard = requireRole;

  /** Запись в журнал администратора. Никогда не бросает исключение наружу. */
  async function audit(req, action, targetUserId, details) {
    try {
      await pool.query(
        `INSERT INTO admin_audit_log (admin_id, admin_email, action, target_user_id, details, ip_address)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
        [
          req.userId ?? null,
          req.actor?.email ?? req.userEmail ?? null,
          action,
          targetUserId ?? null,
          JSON.stringify(redact(details ?? {})),
          clientIp(req),
        ]
      );
    } catch (e) {
      console.error(`[admin] не удалось записать аудит (${action}):`, e?.message ?? e);
    }
  }

  /** Целевой игрок + проверки «нельзя трогать себя / персонал». */
  async function loadTarget(req, res, { forbidSelf = false, moderatorSafeOnly = false } = {}) {
    const id = parseId(req.params.id);
    if (id === null) {
      bad(res, 400, 'INVALID_ID', 'Некорректный идентификатор игрока.');
      return null;
    }
    const result = await pool.query(
      `SELECT id, email, role, banned_until, ban_reason, notes, current_slot_id FROM users WHERE id = $1`,
      [id]
    );
    if (result.rowCount === 0) {
      bad(res, 404, 'PLAYER_NOT_FOUND', 'Игрок не найден.');
      return null;
    }
    const target = result.rows[0];
    if (forbidSelf && target.id === req.userId) {
      bad(res, 400, 'CANNOT_TARGET_SELF', 'Это действие нельзя применить к собственному аккаунту.');
      return null;
    }
    if (moderatorSafeOnly && req.actor?.role === 'moderator' && target.role !== 'player') {
      bad(res, 403, 'CANNOT_TARGET_STAFF', 'Модератор не может применять это действие к персоналу.');
      return null;
    }
    return target;
  }

  /**
   * Блокирует строки администраторов внутри уже открытой транзакции и возвращает их
   * количество. Без блокировки два одновременных понижения/удаления могли бы каждое
   * увидеть «админов ещё двое» и вместе оставить систему без администратора.
   * ORDER BY id задаёт единый порядок блокировки — иначе возможен deadlock.
   */
  async function lockAdminsAndCount(client) {
    const r = await client.query(`SELECT id FROM users WHERE role = 'admin' ORDER BY id FOR UPDATE`);
    return r.rowCount;
  }

  // --------------------------------------------------------------------------
  // GET /api/admin/overview
  // --------------------------------------------------------------------------

  app.get('/api/admin/overview', authMiddleware, guard('moderator'), route(async (_req, res) => {
    const [players, market, topTraders, p2p, oracle, dbSize, tables] = await Promise.all([
      pool.query(`
        SELECT
          (SELECT COUNT(*)::int FROM users) AS total_players,
          (SELECT COUNT(DISTINCT user_id)::int FROM sessions
             WHERE expires_at > NOW() AND last_activity_at > NOW() - ${ONLINE_WINDOW}) AS online_now,
          (SELECT COUNT(*)::int FROM users WHERE created_at >= date_trunc('day', NOW())) AS registered_today,
          (SELECT COUNT(*)::int FROM users WHERE created_at >= NOW() - INTERVAL '7 days') AS registered_7d,
          (SELECT COUNT(*)::int FROM users WHERE banned_until IS NOT NULL AND banned_until > NOW()) AS banned_count,
          (SELECT COUNT(*)::int FROM users WHERE role = 'admin') AS admin_count,
          (SELECT COUNT(*)::int FROM users WHERE role = 'moderator') AS moderator_count,
          (SELECT COUNT(*)::int FROM sessions WHERE expires_at > NOW()) AS active_sessions,
          (SELECT COUNT(*)::int FROM game_slots) AS slots_count,
          (SELECT COUNT(*)::int FROM game_save) AS saves_count,
          (SELECT COALESCE(SUM(play_time_seconds), 0)::bigint FROM game_slots) AS total_play_time_seconds,
          (SELECT COUNT(*)::int FROM guilds) AS guilds_count,
          (SELECT COUNT(*)::int FROM guild_members) AS guild_members_count,
          (SELECT COUNT(*)::int FROM admin_announcements
             WHERE active AND (expires_at IS NULL OR expires_at > NOW())) AS active_announcements,
          (SELECT COUNT(*)::int FROM admin_audit_log WHERE created_at > NOW() - INTERVAL '24 hours') AS audit_entries_24h
      `),
      pool.query(`
        SELECT
          (SELECT COUNT(*)::int FROM market_orders WHERE status IN ('open', 'partial')) AS open_orders,
          (SELECT COUNT(*)::int FROM market_orders) AS total_orders,
          (SELECT COUNT(*)::int FROM market_trades WHERE executed_at > NOW() - INTERVAL '24 hours') AS trades_24h,
          (SELECT COALESCE(SUM(total_amount), 0)::text FROM market_trades
             WHERE executed_at > NOW() - INTERVAL '24 hours') AS volume_24h,
          (SELECT COALESCE(SUM(fee), 0)::text FROM market_trades
             WHERE executed_at > NOW() - INTERVAL '24 hours') AS fees_24h,
          (SELECT COUNT(*)::int FROM (
             SELECT buyer_id AS pid FROM market_trades WHERE executed_at > NOW() - INTERVAL '24 hours'
             UNION
             SELECT seller_id AS pid FROM market_trades WHERE executed_at > NOW() - INTERVAL '24 hours'
           ) q) AS distinct_traders_24h,
          (SELECT COUNT(*)::int FROM traders) AS registered_traders
      `),
      pool.query(`
        SELECT t.player_id, t.player_name, u.email, t.total_volume::text AS total_volume,
               t.total_trades, t.successful_trades, t.rating::text AS rating
        FROM traders t
        LEFT JOIN users u ON u.id = t.player_id
        ORDER BY t.total_volume DESC NULLS LAST, t.total_trades DESC
        LIMIT 10
      `),
      pool.query(`
        SELECT
          (SELECT COUNT(*)::int FROM p2p_loans WHERE status = 'active') AS active_loans,
          (SELECT COALESCE(SUM(remaining_balance), 0)::text FROM p2p_loans WHERE status = 'active')
            AS outstanding_principal,
          (SELECT COUNT(*)::int FROM p2p_loans WHERE status = 'active' AND due_date < NOW()) AS overdue_loans,
          (SELECT COUNT(*)::int FROM p2p_loans WHERE status = 'defaulted') AS defaulted_loans,
          (SELECT COUNT(*)::int FROM p2p_loans) AS total_loans,
          (SELECT COUNT(*)::int FROM p2p_loan_offers WHERE status = 'open') AS open_offers
      `),
      pool.query(`
        SELECT data_type, generated_at, expires_at, request_count,
               (expires_at > NOW()) AS fresh,
               EXTRACT(EPOCH FROM (NOW() - generated_at))::bigint AS age_seconds
        FROM ai_oracle_data
        ORDER BY data_type
      `),
      pool.query(`SELECT pg_database_size(current_database())::bigint AS bytes,
                         pg_size_pretty(pg_database_size(current_database())) AS pretty`),
      pool.query(`
        SELECT c.relname AS table_name,
               pg_total_relation_size(c.oid)::bigint AS total_bytes,
               pg_size_pretty(pg_total_relation_size(c.oid)) AS total_pretty,
               GREATEST(c.reltuples, 0)::bigint AS approx_rows
        FROM pg_class c
        JOIN pg_namespace ns ON ns.oid = c.relnamespace
        WHERE ns.nspname = 'public' AND c.relkind = 'r'
        ORDER BY pg_total_relation_size(c.oid) DESC
        LIMIT 8
      `),
    ]);

    const p = players.rows[0];
    const m = market.rows[0];

    res.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      players: {
        total: p.total_players,
        onlineNow: p.online_now,
        registeredToday: p.registered_today,
        registered7d: p.registered_7d,
        banned: p.banned_count,
        admins: p.admin_count,
        moderators: p.moderator_count,
        activeSessions: p.active_sessions,
        totalPlayTimeSeconds: n(p.total_play_time_seconds),
      },
      content: {
        slots: p.slots_count,
        saves: p.saves_count,
        guilds: p.guilds_count,
        guildMembers: p.guild_members_count,
        activeAnnouncements: p.active_announcements,
        auditEntries24h: p.audit_entries_24h,
      },
      market: {
        openOrders: m.open_orders,
        totalOrders: m.total_orders,
        trades24h: m.trades_24h,
        volume24h: m.volume_24h,
        fees24h: m.fees_24h,
        distinctTraders24h: m.distinct_traders_24h,
        registeredTraders: m.registered_traders,
        topTraders: topTraders.rows.map((r) => ({
          playerId: r.player_id,
          playerName: r.player_name,
          email: r.email,
          totalVolume: r.total_volume,
          totalTrades: r.total_trades,
          successfulTrades: r.successful_trades,
          rating: r.rating,
        })),
      },
      p2p: {
        activeLoans: p2p.rows[0].active_loans,
        outstandingPrincipal: p2p.rows[0].outstanding_principal,
        overdueLoans: p2p.rows[0].overdue_loans,
        defaultedLoans: p2p.rows[0].defaulted_loans,
        totalLoans: p2p.rows[0].total_loans,
        openOffers: p2p.rows[0].open_offers,
      },
      aiOracle: oracle.rows.map((r) => ({
        dataType: r.data_type,
        generatedAt: r.generated_at,
        expiresAt: r.expires_at,
        requestCount: r.request_count,
        fresh: r.fresh,
        ageSeconds: n(r.age_seconds),
      })),
      database: {
        sizeBytes: n(dbSize.rows[0].bytes),
        sizePretty: dbSize.rows[0].pretty,
        largestTables: tables.rows.map((r) => ({
          table: r.table_name,
          totalBytes: n(r.total_bytes),
          totalPretty: r.total_pretty,
          approxRows: n(r.approx_rows),
        })),
      },
    });
  }));

  // --------------------------------------------------------------------------
  // GET /api/admin/players
  // --------------------------------------------------------------------------

  app.get('/api/admin/players', authMiddleware, guard('moderator'), route(async (req, res) => {
    const { search, status = 'all', sort = 'created_at', order = 'desc' } = req.query;

    const sortColumn = PLAYER_SORTS[String(sort)] ?? PLAYER_SORTS.created_at;
    const direction = String(order).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    const limit = clampInt(req.query.limit, 1, MAX_PAGE_SIZE, DEFAULT_PAGE_SIZE);
    const offset = clampInt(req.query.offset, 0, 10_000_000, 0);

    const where = [];
    const params = [];

    if (search !== undefined && String(search).trim() !== '') {
      params.push(`%${likeEscape(String(search).trim())}%`);
      where.push(`email ILIKE $${params.length}`);
    }

    const statusFilter = String(status);
    if (statusFilter === 'online') where.push('online = true');
    else if (statusFilter === 'banned') where.push('is_banned = true');
    else if (statusFilter === 'staff') where.push(`role <> 'player'`);
    else if (statusFilter !== 'all') {
      bad(res, 400, 'INVALID_STATUS', 'status должен быть одним из: all, online, banned, staff.');
      return;
    }

    params.push(limit, offset);

    // COUNT(*) OVER () считается после WHERE и до LIMIT — это полное число совпадений.
    const sql = `
      ${PLAYER_BASE_CTE}
      SELECT *, COUNT(*) OVER ()::int AS total_count
      FROM base
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY ${sortColumn} ${direction} NULLS LAST, id ${direction}
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;

    const result = await pool.query(sql, params);
    const total = result.rowCount > 0 ? result.rows[0].total_count : 0;

    res.json({
      ok: true,
      total,
      limit,
      offset,
      sort: PLAYER_SORTS[String(sort)] ? String(sort) : 'created_at',
      order: direction.toLowerCase(),
      status: statusFilter,
      search: search ? String(search) : null,
      players: result.rows.map(serializePlayerRow),
    });
  }));

  function serializePlayerRow(r) {
    return {
      id: r.id,
      email: r.email,
      role: r.role,
      createdAt: r.created_at,
      lastSeenAt: r.last_seen_at,
      notes: r.notes,
      bannedUntil: r.banned_until,
      banPermanent: r.ban_permanent,
      isBanned: r.is_banned,
      banReason: r.ban_reason,
      online: r.online,
      lastActivityAt: r.last_activity_at,
      sessionCount: r.session_count,
      slotCount: r.slot_count,
      saveCount: r.save_count,
      playTimeSeconds: n(r.play_time_seconds),
      totalVolume: String(r.total_volume ?? '0'),
      totalTrades: r.total_trades,
      successfulTrades: r.successful_trades,
      traderRating: r.trader_rating === null ? null : String(r.trader_rating),
      guild: r.guild_id
        ? {
            id: r.guild_id,
            name: r.guild_name,
            tag: r.guild_tag,
            role: r.guild_role,
            contribution: r.guild_contribution === null ? null : String(r.guild_contribution),
          }
        : null,
      openOrderCount: r.open_order_count,
    };
  }

  // --------------------------------------------------------------------------
  // GET /api/admin/players/:id
  // --------------------------------------------------------------------------

  app.get('/api/admin/players/:id', authMiddleware, guard('moderator'), route(async (req, res) => {
    const id = parseId(req.params.id);
    if (id === null) {
      bad(res, 400, 'INVALID_ID', 'Некорректный идентификатор игрока.');
      return;
    }

    const baseResult = await pool.query(
      `${PLAYER_BASE_CTE} SELECT * FROM base WHERE id = $1`,
      [id]
    );
    if (baseResult.rowCount === 0) {
      bad(res, 404, 'PLAYER_NOT_FOUND', 'Игрок не найден.');
      return;
    }

    const [slots, saves, sessions, orders, trades, loansAsLender, loansAsBorrower, offline, auditRows, user] =
      await Promise.all([
        pool.query(
          `SELECT id, name, description, created_at, updated_at, last_played_at, play_time_seconds
           FROM game_slots WHERE user_id = $1 ORDER BY last_played_at DESC NULLS LAST, id DESC`,
          [id]
        ),
        // Никогда не тянем сам блоб — только его размер.
        pool.query(
          `SELECT id, slot_id, name, save_type, created_at, updated_at,
                  pg_column_size(data)::bigint AS size_bytes
           FROM game_save WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 200`,
          [id]
        ),
        // Токены не выбираем принципиально.
        pool.query(
          `SELECT id, created_at, last_activity_at, expires_at, user_agent, ip_address
           FROM sessions WHERE user_id = $1 AND expires_at > NOW()
           ORDER BY last_activity_at DESC`,
          [id]
        ),
        pool.query(
          `SELECT id, order_type, resource, quantity::text AS quantity,
                  quantity_filled::text AS quantity_filled, price_per_unit::text AS price_per_unit,
                  status, created_at, expires_at, guild_id
           FROM market_orders WHERE player_id = $1 ORDER BY created_at DESC LIMIT 50`,
          [id]
        ),
        pool.query(
          `SELECT t.id, t.resource, t.quantity::text AS quantity, t.price_per_unit::text AS price_per_unit,
                  t.total_amount::text AS total_amount, t.fee::text AS fee, t.executed_at,
                  CASE WHEN t.buyer_id = $1 THEN 'buy' ELSE 'sell' END AS side,
                  t.buyer_id, t.seller_id,
                  CASE WHEN t.buyer_id = $1 THEN seller.email ELSE buyer.email END AS counterparty_email
           FROM market_trades t
           LEFT JOIN users buyer ON buyer.id = t.buyer_id
           LEFT JOIN users seller ON seller.id = t.seller_id
           WHERE t.buyer_id = $1 OR t.seller_id = $1
           ORDER BY t.executed_at DESC LIMIT 50`,
          [id]
        ),
        pool.query(
          `SELECT l.id, l.borrower_id, u.email AS borrower_email, l.principal::text AS principal,
                  l.interest_rate::text AS interest_rate, l.term_days,
                  l.remaining_balance::text AS remaining_balance, l.status, l.start_date, l.due_date,
                  l.interest_paid::text AS interest_paid, l.days_overdue
           FROM p2p_loans l LEFT JOIN users u ON u.id = l.borrower_id
           WHERE l.lender_id = $1 ORDER BY l.start_date DESC LIMIT 50`,
          [id]
        ),
        pool.query(
          `SELECT l.id, l.lender_id, u.email AS lender_email, l.principal::text AS principal,
                  l.interest_rate::text AS interest_rate, l.term_days,
                  l.remaining_balance::text AS remaining_balance, l.status, l.start_date, l.due_date,
                  l.interest_paid::text AS interest_paid, l.days_overdue
           FROM p2p_loans l LEFT JOIN users u ON u.id = l.lender_id
           WHERE l.borrower_id = $1 ORDER BY l.start_date DESC LIMIT 50`,
          [id]
        ),
        pool.query(
          `SELECT id, slot_id, autotrader_enabled, risk_tolerance, max_investment_percent::text AS max_investment_percent,
                  take_profit_percent::text AS take_profit_percent, stop_loss_percent::text AS stop_loss_percent,
                  portfolio_snapshot, balance_snapshot, last_activity_at, last_offline_calc_at,
                  total_offline_profit, total_offline_trades, updated_at
           FROM offline_trading_state WHERE user_id = $1 ORDER BY updated_at DESC`,
          [id]
        ),
        /*
         * Здесь был запрос к user_devices. Такой таблицы в проекте нет: её не создаёт
         * ни initDb, ни initAdminTables, ни одна миграция, и ни одна строка кода в неё
         * не пишет. Запрос стоял внутри Promise.all, поэтому карточка ЛЮБОГО игрока
         * гарантированно падала с 500 («relation "user_devices" does not exist»).
         * Сведения об устройстве уже отдаёт секция «Сессии»: sessions.user_agent
         * и sessions.ip_address заполняются при каждом входе.
         */
        pool.query(
          `SELECT id, admin_id, admin_email, action, details, ip_address, created_at
           FROM admin_audit_log WHERE target_user_id = $1 ORDER BY created_at DESC, id DESC LIMIT 50`,
          [id]
        ),
        pool.query(
          `SELECT current_slot_id, current_save_id, settings, pinned_resources FROM users WHERE id = $1`,
          [id]
        ),
      ]);

    res.json({
      ok: true,
      player: {
        ...serializePlayerRow(baseResult.rows[0]),
        currentSlotId: user.rows[0]?.current_slot_id ?? null,
        currentSaveId: user.rows[0]?.current_save_id ?? null,
        settings: user.rows[0]?.settings ?? {},
        pinnedResources: user.rows[0]?.pinned_resources ?? null,
      },
      slots: slots.rows,
      saves: saves.rows.map((r) => ({ ...r, size_bytes: n(r.size_bytes) })),
      sessions: sessions.rows,
      marketOrders: orders.rows,
      marketTrades: trades.rows,
      p2pLoansAsLender: loansAsLender.rows,
      p2pLoansAsBorrower: loansAsBorrower.rows,
      offlineTradingState: offline.rows,
      auditLog: auditRows.rows,
    });
  }));

  // --------------------------------------------------------------------------
  // GET /api/admin/players/:id/saves/:saveId
  // --------------------------------------------------------------------------

  app.get('/api/admin/players/:id/saves/:saveId', authMiddleware, guard('moderator'), route(async (req, res) => {
    const id = parseId(req.params.id);
    const saveId = parseId(req.params.saveId);
    if (id === null || saveId === null) {
      bad(res, 400, 'INVALID_ID', 'Некорректный идентификатор.');
      return;
    }
    const result = await pool.query(
      `SELECT id, user_id, slot_id, name, save_type, created_at, updated_at,
              pg_column_size(data)::bigint AS size_bytes, data
       FROM game_save WHERE id = $1 AND user_id = $2`,
      [saveId, id]
    );
    if (result.rowCount === 0) {
      bad(res, 404, 'SAVE_NOT_FOUND', 'Сохранение не найдено.');
      return;
    }
    const row = result.rows[0];
    res.json({ ok: true, save: { ...row, size_bytes: n(row.size_bytes) } });
  }));

  // --------------------------------------------------------------------------
  // PATCH /api/admin/players/:id
  // --------------------------------------------------------------------------

  app.patch('/api/admin/players/:id', authMiddleware, guard('admin'), mutationLimiter, route(async (req, res) => {
    const target = await loadTarget(req, res);
    if (!target) return;

    const { email, role, notes } = req.body ?? {};
    if (email === undefined && role === undefined && notes === undefined) {
      bad(res, 400, 'NO_UPDATES', 'Нечего обновлять: передайте email, role или notes.');
      return;
    }

    const updates = [];
    const params = [];
    const changes = {};

    if (email !== undefined) {
      const value = String(email).trim().toLowerCase();
      if (value.length < 3 || value.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        bad(res, 400, 'INVALID_EMAIL', 'Некорректный e-mail.');
        return;
      }
      if (value !== String(target.email).toLowerCase()) {
        const dup = await pool.query('SELECT id FROM users WHERE LOWER(email) = $1 AND id <> $2', [value, target.id]);
        if (dup.rowCount > 0) {
          bad(res, 409, 'EMAIL_EXISTS', 'Такой e-mail уже занят.');
          return;
        }
      }
      params.push(value);
      updates.push(`email = $${params.length}`);
      changes.email = { from: target.email, to: value };
    }

    if (role !== undefined) {
      const value = String(role);
      if (!ROLES.includes(value)) {
        bad(res, 400, 'INVALID_ROLE', `role должен быть одним из: ${ROLES.join(', ')}.`);
        return;
      }
      if (target.id === req.userId && value !== target.role) {
        bad(res, 400, 'CANNOT_CHANGE_OWN_ROLE', 'Нельзя менять собственную роль.');
        return;
      }
      params.push(value);
      updates.push(`role = $${params.length}`);
      changes.role = { from: target.role, to: value };
    }

    if (notes !== undefined) {
      if (notes !== null && typeof notes !== 'string') {
        bad(res, 400, 'INVALID_NOTES', 'notes должен быть строкой или null.');
        return;
      }
      const value = notes === null ? null : String(notes).slice(0, 10_000);
      params.push(value);
      updates.push(`notes = $${params.length}`);
      changes.notes = { from: target.notes, to: value };
    }

    params.push(target.id);

    const demotesAnAdmin = !!changes.role && target.role === 'admin' && changes.role.to !== 'admin';
    const client = await pool.connect();
    let result;
    try {
      await client.query('BEGIN');
      if (demotesAnAdmin && (await lockAdminsAndCount(client)) <= 1) {
        await client.query('ROLLBACK');
        bad(res, 409, 'LAST_ADMIN', 'Нельзя понизить последнего администратора.');
        return;
      }
      result = await client.query(
        `UPDATE users SET ${updates.join(', ')} WHERE id = $${params.length}
         RETURNING id, email, role, notes`,
        params
      );
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      throw e;
    } finally {
      client.release();
    }

    await audit(req, 'player.update', target.id, changes);
    res.json({ ok: true, player: result.rows[0], changes });
  }));

  // --------------------------------------------------------------------------
  // POST /api/admin/players/:id/ban  |  /unban  |  /logout-all
  // --------------------------------------------------------------------------

  app.post('/api/admin/players/:id/ban', authMiddleware, guard('moderator'), mutationLimiter, route(async (req, res) => {
    const target = await loadTarget(req, res, { forbidSelf: true, moderatorSafeOnly: true });
    if (!target) return;

    const { days, reason } = req.body ?? {};
    if (typeof reason !== 'string' || reason.trim().length === 0) {
      bad(res, 400, 'REASON_REQUIRED', 'Укажите причину блокировки.');
      return;
    }
    const cleanReason = reason.trim().slice(0, 500);

    let permanent = true;
    let bannedUntilParam = PERMANENT_BAN;
    if (days !== undefined && days !== null) {
      const numDays = Number(days);
      if (!Number.isFinite(numDays) || numDays <= 0 || numDays > 36500) {
        bad(res, 400, 'INVALID_DAYS', 'days должен быть числом от 1 до 36500 (или отсутствовать для постоянного бана).');
        return;
      }
      permanent = false;
      bannedUntilParam = new Date(Date.now() + numDays * 24 * 60 * 60 * 1000).toISOString();
    }

    const result = await pool.query(
      `UPDATE users SET banned_until = $1::timestamptz, ban_reason = $2 WHERE id = $3
       RETURNING id, email, role,
                 CASE WHEN banned_until = ${sqlLit(PERMANENT_BAN)}::timestamptz THEN NULL ELSE banned_until END AS banned_until,
                 ban_reason`,
      [bannedUntilParam, cleanReason, target.id]
    );

    // Гасим все сессии игрока. Строки НЕ удаляем: пока они живы, authMiddleware
    // может ответить ACCOUNT_BANNED с причиной и сроком вместо безликого
    // INVALID_TOKEN — иначе клиенту нечего показать забаненному игроку.
    // Погашенные строки подчищает штатная часовая уборка (expires_at < NOW())
    // и /api/admin/maintenance/cleanup-sessions; unban удаляет их сразу.
    const killed = await pool.query(
      'UPDATE sessions SET expires_at = NOW() WHERE user_id = $1 AND expires_at > NOW()',
      [target.id]
    );

    await audit(req, 'player.ban', target.id, {
      email: target.email,
      permanent,
      days: permanent ? null : Number(days),
      until: permanent ? 'infinity' : bannedUntilParam,
      reason: cleanReason,
      sessionsRevoked: killed.rowCount,
    });

    res.json({
      ok: true,
      player: { ...result.rows[0], ban_permanent: permanent, is_banned: true },
      permanent,
      sessionsRevoked: killed.rowCount,
    });
  }));

  app.post('/api/admin/players/:id/unban', authMiddleware, guard('moderator'), mutationLimiter, route(async (req, res) => {
    const target = await loadTarget(req, res, { moderatorSafeOnly: true });
    if (!target) return;

    const result = await pool.query(
      `UPDATE users SET banned_until = NULL, ban_reason = NULL WHERE id = $1
       RETURNING id, email, role, banned_until, ban_reason`,
      [target.id]
    );
    // Погашенные баном сессии больше не нужны — удаляем, чтобы старые токены
    // не оставались в базе после разблокировки.
    const purged = await pool.query('DELETE FROM sessions WHERE user_id = $1', [target.id]);
    await audit(req, 'player.unban', target.id, {
      email: target.email,
      previousBanReason: target.ban_reason,
      sessionsPurged: purged.rowCount,
    });
    res.json({ ok: true, player: result.rows[0], sessionsPurged: purged.rowCount });
  }));

  app.post('/api/admin/players/:id/logout-all', authMiddleware, guard('moderator'), mutationLimiter, route(async (req, res) => {
    const target = await loadTarget(req, res, { moderatorSafeOnly: true });
    if (!target) return;

    const killed = await pool.query('DELETE FROM sessions WHERE user_id = $1', [target.id]);
    await audit(req, 'player.logout_all', target.id, {
      email: target.email,
      sessionsRevoked: killed.rowCount,
    });
    res.json({ ok: true, sessionsRevoked: killed.rowCount });
  }));

  // --------------------------------------------------------------------------
  // POST /api/admin/players/:id/password
  // --------------------------------------------------------------------------

  app.post('/api/admin/players/:id/password', authMiddleware, guard('admin'), mutationLimiter, route(async (req, res) => {
    const target = await loadTarget(req, res);
    if (!target) return;

    // Сброс пароля другого администратора = захват его аккаунта. Запрещаем.
    if (target.role === 'admin' && target.id !== req.userId) {
      bad(res, 403, 'CANNOT_TARGET_ADMIN', 'Нельзя менять пароль другого администратора.');
      return;
    }

    const { newPassword } = req.body ?? {};
    if (typeof newPassword !== 'string' || newPassword.length < 6) {
      bad(res, 400, 'PASSWORD_TOO_SHORT', 'Пароль должен содержать минимум 6 символов.');
      return;
    }
    if (newPassword.length > 512) {
      bad(res, 400, 'PASSWORD_TOO_LONG', 'Пароль слишком длинный (максимум 512 символов).');
      return;
    }

    const stored = await encodePasswordForStorage(newPassword);
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [stored, target.id]);
    const killed = await pool.query('DELETE FROM sessions WHERE user_id = $1', [target.id]);

    // В журнал попадает только факт смены — ни пароля, ни хеша.
    await audit(req, 'player.password_reset', target.id, {
      email: target.email,
      hashed: stored.startsWith('scrypt$'),
      sessionsRevoked: killed.rowCount,
    });

    res.json({ ok: true, sessionsRevoked: killed.rowCount, hashed: stored.startsWith('scrypt$') });
  }));

  // --------------------------------------------------------------------------
  // POST /api/admin/players/:id/grant
  // --------------------------------------------------------------------------

  app.post('/api/admin/players/:id/grant', authMiddleware, guard('admin'), mutationLimiter, route(async (req, res) => {
    const target = await loadTarget(req, res);
    if (!target) return;

    const body = req.body ?? {};
    const { slotId, credits, researchPoints, influence, resources, force } = body;

    // 1. Разбираем и валидируем величины ДО любых записей.
    const deltas = {};
    for (const [field, raw] of Object.entries({ credits, researchPoints, influence })) {
      if (raw === undefined || raw === null) continue;
      const parsed = parseAmount(raw);
      if (!parsed) {
        bad(res, 400, 'INVALID_AMOUNT', `Некорректное значение для ${field}: ожидается десятичная строка.`);
        return;
      }
      deltas[field] = parsed;
    }

    const resourceDeltas = {};
    if (resources !== undefined && resources !== null) {
      if (!isPlainObject(resources)) {
        bad(res, 400, 'INVALID_RESOURCES', 'resources должен быть объектом { ресурс: "количество" }.');
        return;
      }
      const keys = Object.keys(resources);
      if (keys.length > 100) {
        bad(res, 400, 'TOO_MANY_RESOURCES', 'Слишком много ресурсов в одном запросе (максимум 100).');
        return;
      }
      for (const key of keys) {
        if (!RESOURCE_KEY_RE.test(key)) {
          bad(res, 400, 'INVALID_RESOURCE_KEY', `Некорректный ключ ресурса: ${key}.`);
          return;
        }
        const parsed = parseAmount(resources[key]);
        if (!parsed) {
          bad(res, 400, 'INVALID_AMOUNT', `Некорректное значение для ресурса ${key}.`);
          return;
        }
        resourceDeltas[key] = parsed;
      }
    }

    if (Object.keys(deltas).length === 0 && Object.keys(resourceDeltas).length === 0) {
      bad(res, 400, 'NOTHING_TO_GRANT', 'Укажите credits, researchPoints, influence или resources.');
      return;
    }

    // 2. Если клиент игрока запущен, его автосохранение перезапишет выдачу.
    const sessionInfo = await pool.query(
      `SELECT COUNT(*)::int AS active_sessions, MAX(last_activity_at) AS last_activity_at
       FROM sessions WHERE user_id = $1 AND expires_at > NOW()`,
      [target.id]
    );
    const activeSessions = sessionInfo.rows[0].active_sessions;
    const lastActivityAt = sessionInfo.rows[0].last_activity_at;
    const onlineNow = !!lastActivityAt && Date.now() - new Date(lastActivityAt).getTime() < 5 * 60 * 1000;

    if (activeSessions > 0 && force !== true) {
      bad(res, 409, 'PLAYER_HAS_ACTIVE_SESSION',
        'У игрока есть активная сессия — его клиент перезапишет выдачу следующим автосохранением. ' +
        'Передайте force: true, чтобы выдать всё равно (лучше сначала вызвать logout-all).',
        { activeSessions, onlineNow, lastActivityAt });
      return;
    }

    // 3. Выбираем слот и его самое свежее сохранение.
    let effectiveSlotId = null;
    if (slotId !== undefined && slotId !== null) {
      const parsedSlot = parseId(slotId);
      if (parsedSlot === null) {
        bad(res, 400, 'INVALID_SLOT_ID', 'Некорректный slotId.');
        return;
      }
      const slotCheck = await pool.query('SELECT id FROM game_slots WHERE id = $1 AND user_id = $2', [parsedSlot, target.id]);
      if (slotCheck.rowCount === 0) {
        bad(res, 404, 'SLOT_NOT_FOUND', 'Слот не найден у этого игрока.');
        return;
      }
      effectiveSlotId = parsedSlot;
    } else {
      effectiveSlotId = target.current_slot_id ?? null;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const saveResult = effectiveSlotId
        ? await client.query(
            `SELECT id, name, save_type, slot_id, data FROM game_save
             WHERE user_id = $1 AND slot_id = $2
             ORDER BY updated_at DESC LIMIT 1 FOR UPDATE`,
            [target.id, effectiveSlotId]
          )
        : await client.query(
            `SELECT id, name, save_type, slot_id, data FROM game_save
             WHERE user_id = $1
             ORDER BY updated_at DESC LIMIT 1 FOR UPDATE`,
            [target.id]
          );

      if (saveResult.rowCount === 0) {
        await client.query('ROLLBACK');
        bad(res, 404, 'NO_SAVE_TO_PATCH', 'У игрока нет сохранения, которое можно изменить.', {
          slotId: effectiveSlotId,
        });
        return;
      }

      const saveRow = saveResult.rows[0];
      const patch = applyGrantToSaveData(saveRow.data, { deltas, resourceDeltas });

      if (patch.error) {
        await client.query('ROLLBACK');
        bad(res, 422, patch.error, patch.message, { saveId: saveRow.id });
        return;
      }

      if (Object.keys(patch.applied).length === 0) {
        await client.query('ROLLBACK');
        bad(res, 422, 'NOTHING_APPLIED',
          'Ни одно поле не удалось изменить: форма сохранения не совпала с ожидаемой.',
          { saveId: saveRow.id, skipped: patch.skipped });
        return;
      }

      await client.query(
        'UPDATE game_save SET data = $1::jsonb, updated_at = NOW() WHERE id = $2',
        [JSON.stringify(patch.data), saveRow.id]
      );
      await client.query('COMMIT');

      await audit(req, 'player.grant', target.id, {
        email: target.email,
        saveId: saveRow.id,
        saveName: saveRow.name,
        slotId: saveRow.slot_id,
        forced: force === true,
        activeSessions,
        requested: {
          credits: deltas.credits?.toString() ?? null,
          researchPoints: deltas.researchPoints?.toString() ?? null,
          influence: deltas.influence?.toString() ?? null,
          resources: Object.fromEntries(Object.entries(resourceDeltas).map(([k, v]) => [k, v.toString()])),
        },
        applied: patch.applied,
        skipped: patch.skipped,
        clamped: patch.clamped,
      });

      res.json({
        ok: true,
        saveId: saveRow.id,
        slotId: saveRow.slot_id,
        applied: patch.applied,
        skipped: patch.skipped,
        clamped: patch.clamped,
        warning: activeSessions > 0
          ? 'У игрока есть активная сессия: его клиент может перезаписать выдачу автосохранением. Рекомендуется logout-all.'
          : null,
      });
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  }));

  // --------------------------------------------------------------------------
  // POST /api/admin/players/:id/orders/cancel-all
  // --------------------------------------------------------------------------

  app.post('/api/admin/players/:id/orders/cancel-all', authMiddleware, guard('admin'), mutationLimiter, route(async (req, res) => {
    const target = await loadTarget(req, res);
    if (!target) return;

    const result = await pool.query(
      `UPDATE market_orders SET status = 'cancelled'
       WHERE player_id = $1 AND status IN ('open', 'partial')
       RETURNING id, order_type, resource, quantity::text AS quantity, price_per_unit::text AS price_per_unit`,
      [target.id]
    );

    await audit(req, 'player.orders_cancel_all', target.id, {
      email: target.email,
      cancelled: result.rowCount,
      orderIds: result.rows.map((r) => r.id),
    });

    res.json({ ok: true, cancelled: result.rowCount, orders: result.rows });
  }));

  // --------------------------------------------------------------------------
  // DELETE /api/admin/players/:id
  // --------------------------------------------------------------------------

  app.delete('/api/admin/players/:id', authMiddleware, guard('admin'), mutationLimiter, route(async (req, res) => {
    const target = await loadTarget(req, res, { forbidSelf: true });
    if (!target) return;

    const { confirmEmail } = req.body ?? {};
    if (typeof confirmEmail !== 'string' || confirmEmail !== target.email) {
      bad(res, 400, 'CONFIRM_EMAIL_MISMATCH',
        'Для удаления передайте confirmEmail, точно совпадающий с e-mail игрока.');
      return;
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Проверка «последнего админа» под блокировкой строк: иначе два одновременных
      // удаления могли бы вместе снести всех администраторов.
      if (target.role === 'admin' && (await lockAdminsAndCount(client)) <= 1) {
        await client.query('ROLLBACK');
        bad(res, 409, 'LAST_ADMIN', 'Нельзя удалить последнего администратора.');
        return;
      }

      // Часть внешних ключей на users создана как NO ACTION, поэтому зависимые
      // строки убираем явно — иначе DELETE упадёт с 23503.
      const removed = {};

      // Гильдии, которыми игрок руководит: передаём лидерство или удаляем гильдию.
      const ledGuilds = await client.query('SELECT id, name FROM guilds WHERE leader_id = $1', [target.id]);
      const guildActions = [];
      for (const guild of ledGuilds.rows) {
        const heir = await client.query(
          `SELECT player_id FROM guild_members
           WHERE guild_id = $1 AND player_id <> $2
           ORDER BY (role = 'officer') DESC, contribution DESC, joined_at ASC
           LIMIT 1`,
          [guild.id, target.id]
        );
        if (heir.rowCount > 0) {
          const heirId = heir.rows[0].player_id;
          await client.query('UPDATE guilds SET leader_id = $1 WHERE id = $2', [heirId, guild.id]);
          await client.query(
            `UPDATE guild_members SET role = 'leader' WHERE guild_id = $1 AND player_id = $2`,
            [guild.id, heirId]
          );
          guildActions.push({ guildId: guild.id, name: guild.name, action: 'leadership_transferred', to: heirId });
        } else {
          await client.query('DELETE FROM guilds WHERE id = $1', [guild.id]);
          guildActions.push({ guildId: guild.id, name: guild.name, action: 'guild_deleted' });
        }
      }
      removed.guilds = guildActions;

      const payments = await client.query(
        `DELETE FROM p2p_loan_payments WHERE loan_id IN (
           SELECT id FROM p2p_loans WHERE lender_id = $1 OR borrower_id = $1)`,
        [target.id]
      );
      removed.p2pPayments = payments.rowCount;

      const loans = await client.query(
        'DELETE FROM p2p_loans WHERE lender_id = $1 OR borrower_id = $1',
        [target.id]
      );
      removed.p2pLoans = loans.rowCount;

      const trades = await client.query(
        'DELETE FROM market_trades WHERE buyer_id = $1 OR seller_id = $1',
        [target.id]
      );
      removed.marketTrades = trades.rowCount;

      const orders = await client.query('DELETE FROM market_orders WHERE player_id = $1', [target.id]);
      removed.marketOrders = orders.rowCount;

      const deleted = await client.query('DELETE FROM users WHERE id = $1 RETURNING id, email', [target.id]);
      if (deleted.rowCount === 0) {
        await client.query('ROLLBACK');
        bad(res, 404, 'PLAYER_NOT_FOUND', 'Игрок не найден.');
        return;
      }

      await client.query('COMMIT');

      // target_user_id намеренно без внешнего ключа — запись о удалении должна пережить игрока.
      await audit(req, 'player.delete', target.id, {
        email: target.email,
        role: target.role,
        cascade: removed,
      });

      res.json({ ok: true, deleted: deleted.rows[0], cascade: removed });
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  }));

  // --------------------------------------------------------------------------
  // GET /api/admin/audit
  // --------------------------------------------------------------------------

  app.get('/api/admin/audit', authMiddleware, guard('moderator'), route(async (req, res) => {
    const limit = clampInt(req.query.limit, 1, MAX_PAGE_SIZE, DEFAULT_PAGE_SIZE);
    const offset = clampInt(req.query.offset, 0, 10_000_000, 0);

    const where = [];
    const params = [];

    if (req.query.adminId !== undefined && String(req.query.adminId) !== '') {
      const adminId = parseId(req.query.adminId);
      if (adminId === null) {
        bad(res, 400, 'INVALID_ADMIN_ID', 'Некорректный adminId.');
        return;
      }
      params.push(adminId);
      where.push(`a.admin_id = $${params.length}`);
    }
    if (req.query.targetUserId !== undefined && String(req.query.targetUserId) !== '') {
      const targetId = parseId(req.query.targetUserId);
      if (targetId === null) {
        bad(res, 400, 'INVALID_TARGET_USER_ID', 'Некорректный targetUserId.');
        return;
      }
      params.push(targetId);
      where.push(`a.target_user_id = $${params.length}`);
    }
    if (req.query.action !== undefined && String(req.query.action).trim() !== '') {
      params.push(String(req.query.action).trim().slice(0, 100));
      where.push(`a.action = $${params.length}`);
    }

    params.push(limit, offset);
    const result = await pool.query(
      `SELECT a.id, a.admin_id, a.admin_email, a.action, a.target_user_id, a.details, a.ip_address, a.created_at,
              tu.email AS target_email,
              COUNT(*) OVER ()::int AS total_count
       FROM admin_audit_log a
       LEFT JOIN users tu ON tu.id = a.target_user_id
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY a.created_at DESC, a.id DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({
      ok: true,
      total: result.rowCount > 0 ? result.rows[0].total_count : 0,
      limit,
      offset,
      entries: result.rows.map(({ total_count, ...row }) => row),
    });
  }));

  // --------------------------------------------------------------------------
  // Объявления
  // --------------------------------------------------------------------------

  app.get('/api/admin/announcements', authMiddleware, guard('moderator'), route(async (_req, res) => {
    const result = await pool.query(
      `SELECT a.id, a.title, a.body, a.severity, a.active, a.created_by, u.email AS created_by_email,
              a.created_at, a.expires_at,
              (a.active AND (a.expires_at IS NULL OR a.expires_at > NOW())) AS visible
       FROM admin_announcements a
       LEFT JOIN users u ON u.id = a.created_by
       ORDER BY a.created_at DESC
       LIMIT 200`
    );
    res.json({ ok: true, announcements: result.rows });
  }));

  app.post('/api/admin/announcements', authMiddleware, guard('admin'), mutationLimiter, route(async (req, res) => {
    const { title, body, severity = 'info', expiresAt = null, active = true } = req.body ?? {};

    if (typeof title !== 'string' || title.trim().length === 0 || title.trim().length > 200) {
      bad(res, 400, 'INVALID_TITLE', 'Заголовок обязателен (до 200 символов).');
      return;
    }
    if (typeof body !== 'string' || body.trim().length === 0 || body.trim().length > 5000) {
      bad(res, 400, 'INVALID_BODY', 'Текст обязателен (до 5000 символов).');
      return;
    }
    if (!SEVERITIES.includes(String(severity))) {
      bad(res, 400, 'INVALID_SEVERITY', `severity должен быть одним из: ${SEVERITIES.join(', ')}.`);
      return;
    }
    let expires = null;
    if (expiresAt !== null && expiresAt !== undefined && expiresAt !== '') {
      const date = new Date(expiresAt);
      if (Number.isNaN(date.getTime())) {
        bad(res, 400, 'INVALID_EXPIRES_AT', 'expiresAt должен быть корректной датой.');
        return;
      }
      expires = date.toISOString();
    }

    const result = await pool.query(
      `INSERT INTO admin_announcements (title, body, severity, active, created_by, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6::timestamptz)
       RETURNING id, title, body, severity, active, created_by, created_at, expires_at`,
      [title.trim(), body.trim(), String(severity), active !== false, req.userId, expires]
    );

    await audit(req, 'announcement.create', null, {
      announcementId: result.rows[0].id,
      title: result.rows[0].title,
      severity: result.rows[0].severity,
      expiresAt: expires,
    });

    res.json({ ok: true, announcement: result.rows[0] });
  }));

  app.delete('/api/admin/announcements/:id', authMiddleware, guard('admin'), mutationLimiter, route(async (req, res) => {
    const id = parseId(req.params.id);
    if (id === null) {
      bad(res, 400, 'INVALID_ID', 'Некорректный идентификатор объявления.');
      return;
    }
    const result = await pool.query(
      'DELETE FROM admin_announcements WHERE id = $1 RETURNING id, title, severity',
      [id]
    );
    if (result.rowCount === 0) {
      bad(res, 404, 'ANNOUNCEMENT_NOT_FOUND', 'Объявление не найдено.');
      return;
    }
    await audit(req, 'announcement.delete', null, {
      announcementId: result.rows[0].id,
      title: result.rows[0].title,
    });
    res.json({ ok: true, deleted: result.rows[0] });
  }));

  // --------------------------------------------------------------------------
  // Обслуживание
  // --------------------------------------------------------------------------

  app.post('/api/admin/maintenance/expire-orders', authMiddleware, guard('admin'), mutationLimiter, route(async (req, res) => {
    const result = await pool.query(
      `UPDATE market_orders SET status = 'expired'
       WHERE status = 'open' AND expires_at < NOW()
       RETURNING id`
    );
    await audit(req, 'maintenance.expire_orders', null, { expiredCount: result.rowCount });
    res.json({ ok: true, expiredCount: result.rowCount });
  }));

  app.post('/api/admin/maintenance/cleanup-sessions', authMiddleware, guard('admin'), mutationLimiter, route(async (req, res) => {
    const result = await pool.query('DELETE FROM sessions WHERE expires_at < NOW()');
    await audit(req, 'maintenance.cleanup_sessions', null, { removedCount: result.rowCount });
    res.json({ ok: true, removedCount: result.rowCount });
  }));

  app.post('/api/admin/maintenance/oracle-refresh', authMiddleware, guard('admin'), mutationLimiter, route(async (req, res) => {
    const startedAt = Date.now();
    let failure = null;
    try {
      // Без DEEPSEEK_API_KEY функция сама подставляет офлайн-значения.
      await runOracleUpdate(pool);
    } catch (e) {
      failure = String(e?.message ?? e);
      console.error('[admin] oracle-refresh failed:', e);
    }
    const fresh = await pool.query(
      `SELECT data_type, generated_at, expires_at, request_count FROM ai_oracle_data ORDER BY data_type`
    );
    await audit(req, 'maintenance.oracle_refresh', null, {
      durationMs: Date.now() - startedAt,
      error: failure,
      dataTypes: fresh.rows.map((r) => r.data_type),
    });
    if (failure) {
      bad(res, 502, 'ORACLE_REFRESH_FAILED', 'Обновление оракула не удалось.', { detail: failure });
      return;
    }
    res.json({ ok: true, durationMs: Date.now() - startedAt, oracle: fresh.rows });
  }));

  // --------------------------------------------------------------------------
  // Публичные объявления (любая роль, нужна только авторизация)
  // --------------------------------------------------------------------------

  app.get('/api/announcements', authMiddleware, route(async (_req, res) => {
    const result = await pool.query(
      `SELECT id, title, body, severity, created_at, expires_at
       FROM admin_announcements
       WHERE active AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END,
                created_at DESC
       LIMIT 20`
    );
    res.json({ ok: true, announcements: result.rows });
  }));
}

// ============================================================================
// Выдача ресурсов: аккуратный патч сохранения (break_eternity-строки)
// ============================================================================

/**
 * Добавляет величины в data.currency.* и в буферы ресурсов.
 *
 * Форма сохранения (см. gameStore.saveGame):
 *   currency: { credits, researchPoints, influence }  — десятичные строки
 *   resources: { <res>: { amount, max } }             — десятичные строки
 *   grid.buffers.base: { <res>: amount }              — ИСТОЧНИК ИСТИНЫ при загрузке
 *     (loadGame делает syncResourcesFromBase(resources, grid.buffers), то есть
 *      resources[*].amount перезаписывается из буфера — патчить только его бессмысленно)
 *
 * Всё, что не удалось подтвердить, попадает в skipped и не меняется.
 *
 * @returns {{ data?: object, applied: object, skipped: Array, clamped: string[], error?: string, message?: string }}
 */
export function applyGrantToSaveData(rawData, { deltas = {}, resourceDeltas = {} } = {}) {
  const applied = {};
  const skipped = [];
  const clamped = [];

  if (!isPlainObject(rawData)) {
    return {
      applied, skipped, clamped,
      error: 'SAVE_SHAPE_UNRECOGNIZED',
      message: 'Сохранение не является JSON-объектом — изменять нечего.',
    };
  }

  // Работаем с копией, чтобы при ошибке оригинал остался нетронутым.
  const data = structuredClone(rawData);

  // --- Валюта ---
  const currencyKeys = ['credits', 'researchPoints', 'influence'];
  for (const key of currencyKeys) {
    const delta = deltas[key];
    if (!delta) continue;

    if (!isPlainObject(data.currency)) {
      skipped.push({ field: `currency.${key}`, reason: 'В сохранении нет объекта currency' });
      continue;
    }
    const rawValue = data.currency[key];
    if (rawValue !== undefined && typeof rawValue !== 'string' && typeof rawValue !== 'number') {
      skipped.push({ field: `currency.${key}`, reason: 'Неожидаемый тип значения в сохранении' });
      continue;
    }
    const before = decFromSave(rawValue);
    if (!before) {
      skipped.push({ field: `currency.${key}`, reason: 'Значение в сохранении не распознано как число' });
      continue;
    }
    const after = before.add(delta).max(new Decimal(0));
    data.currency[key] = after.toString();
    applied[`currency.${key}`] = { before: before.toString(), after: after.toString(), delta: delta.toString() };
  }

  // --- Ресурсы ---
  const resourceKeys = Object.keys(resourceDeltas);
  if (resourceKeys.length > 0) {
    const buffers = data.grid?.buffers;
    const hasBase = isPlainObject(buffers) && isPlainObject(buffers.base);
    const resMap = isPlainObject(data.resources) ? data.resources : null;

    if (!hasBase) {
      // При загрузке игры буфер grid.buffers.base перетирает resources[*].amount,
      // поэтому без него выдача ресурсов не сохранится — честно сообщаем.
      for (const key of resourceKeys) {
        skipped.push({
          field: `resources.${key}`,
          reason: 'В сохранении нет grid.buffers.base — выдача ресурсов не сохранилась бы после загрузки',
        });
      }
    } else {
      const base = buffers.base;
      for (const key of resourceKeys) {
        const delta = resourceDeltas[key];
        const knownInBase = hasOwn(base, key);
        const entry = resMap && isPlainObject(resMap[key]) ? resMap[key] : null;
        const knownInResources = resMap ? hasOwn(resMap, key) : false;

        if (!knownInBase && !knownInResources) {
          skipped.push({ field: `resources.${key}`, reason: 'Такого ресурса нет в сохранении' });
          continue;
        }

        const before = decFromSave(knownInBase ? base[key] : entry?.amount);
        if (!before) {
          skipped.push({ field: `resources.${key}`, reason: 'Значение в сохранении не распознано как число' });
          continue;
        }

        let after = before.add(delta).max(new Decimal(0));

        // Клиент обрезает буфер по вместимости склада; предупреждаем вместо тихой потери.
        const cap = entry && entry.max !== undefined ? decFromSave(entry.max) : null;
        if (cap && after.gt(cap)) {
          after = cap;
          clamped.push(key);
        }

        base[key] = after.toString();
        if (entry) entry.amount = after.toString();

        applied[`resources.${key}`] = {
          before: before.toString(),
          after: after.toString(),
          delta: delta.toString(),
          cappedAt: clamped.includes(key) && cap ? cap.toString() : null,
        };
      }
    }
  }

  return { data, applied, skipped, clamped };
}

// Экспортируем для тестов/отладки.
export const __internals = { parseAmount, decFromSave, redact, likeEscape, PERMANENT_BAN };
