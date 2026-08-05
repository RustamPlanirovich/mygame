import express from 'express';
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
dotenv.config();

const { initDb, pool } = await import('./db.js');
import {
  createMarketRoutes,
  initMarketTables,
  startMarketMaintenance,
  stopMarketMaintenance,
} from './market.js';
import { createGuildRoutes } from './guilds.js';
import { createAIRoutes } from './ai.js';
import { startAIOracle, stopAIOracle } from './ai-oracle.js';
import { startMarketSim, stopMarketSim, createMarketSimRoutes } from './market-sim/index.js';
import { createP2PLendingRoutes, initP2PLendingTables } from './p2p-lending.js';
import { createOfflineTradingRoutes, initOfflineTradingTables } from './offline-trading.js';
import { createAdminRoutes, initAdminTables, bootstrapRoleForEmail } from './admin.js';
import { realtimeHub } from './realtime.js';
import { createChatRoutes, initChatTables } from './chat.js';
import {
  compression,
  rateLimit,
  securityHeaders,
  requestTimeout,
  LIMITS,
} from './http-middleware.js';
import {
  encodePasswordForStorage,
  verifyPassword,
  getDummyStoredHash,
  warnIfLegacyPasswordMode,
} from './auth-password.js';

const PORT = Number(process.env.PORT ?? 5174);
const HOST = process.env.HOST ?? '127.0.0.1';
const SAVE_ID = process.env.SAVE_ID ?? 'local';
const isProduction = process.env.NODE_ENV === 'production';
const distDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');

const app = express();

/*
 * Behind a reverse proxy (nginx/Caddy in the DEPLOY_DEBIAN.md setup) req.ip is the proxy's
 * address unless this is set — which would put all 100 players into a single rate-limit bucket
 * and log one IP for every session. Off by default so a direct-to-node deploy is not spoofable
 * via a forged X-Forwarded-For.
 */
if (process.env.TRUST_PROXY) {
  app.set('trust proxy', process.env.TRUST_PROXY === '1' ? 1 : process.env.TRUST_PROXY);
}

// Cheap and unconditional: security headers, a hard request deadline, and response compression.
app.use(securityHeaders({ isProduction }));
app.use(requestTimeout(Number(process.env.REQUEST_TIMEOUT_MS ?? 30_000)));
/*
 * Compression matters here more than usual: a save blob is multi-megabyte JSON that every
 * player downloads on load and uploads every 30s. Registered before express.json so it wraps
 * the response of every route below.
 */
app.use(compression());

// Save blobs are the whole game state (grid, buffers, per-tile settings, price history) and
// routinely exceed 1mb on a developed base. The previous 1mb cap made express reject those
// requests with 413 — and gameStore.saveGame() never checked the response, so autosave failed
// silently and the player lost everything since the last small-enough save.
const JSON_BODY_LIMIT = process.env.JSON_BODY_LIMIT ?? '24mb';
app.use(express.json({ limit: JSON_BODY_LIMIT }));

// Surface a payload that is too large as a JSON error the client can act on, instead of
// express's default HTML error page.
app.use((err, _req, res, next) => {
  if (err?.type === 'entity.too.large') {
    res.status(413).json({ ok: false, error: 'PAYLOAD_TOO_LARGE', limit: JSON_BODY_LIMIT });
    return;
  }
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ ok: false, error: 'INVALID_JSON' });
    return;
  }
  next(err);
});

// CORS is only needed when the frontend is hosted on another origin. In
// production Express serves the frontend and API from the same origin.
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = new Set([
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    ...String(process.env.CORS_ORIGIN ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  ]);

  if (origin && allowedOrigins.has(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  
  next();
});

/*
 * Blanket limiter for every /api route. The per-route limiters above are tighter where abuse is
 * cheap (password guessing, save writes); this one is the backstop against a client stuck in a
 * request loop taking the server down for everyone. Static assets are unaffected.
 */
app.use('/api', rateLimit(LIMITS.general));

// Утилита для генерации токена
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Утилита для создания сессии
async function createSession(userId, userAgent, ipAddress) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 дней
  
  await pool.query(
    'INSERT INTO sessions (user_id, token, expires_at, user_agent, ip_address) VALUES ($1, $2, $3, $4, $5)',
    [userId, token, expiresAt, userAgent, ipAddress]
  );
  
  return { token, expiresAt };
}

// Утилита для очистки истекших сессий
async function cleanExpiredSessions() {
  await pool.query('DELETE FROM sessions WHERE expires_at < NOW()');
}

// Middleware для проверки авторизации через токен
const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ ok: false, error: 'NOT_AUTHENTICATED' });
    return;
  }
  
  const token = authHeader.substring(7);

  try {
    // Одним запросом: поиск сессии, продление её активности, обновление
    // users.last_seen_at (не чаще раза в минуту) и чтение роли/бана.
    // Data-modifying CTE — это по-прежнему ОДИН round-trip, второй записи на запрос нет.
    // Сессия ищется без фильтра по expires_at, чтобы отличать «токена не существует»
    // от «аккаунт заблокирован» (бан гасит сессии, но строку оставляет — иначе
    // клиенту нечем объяснить, почему его выкинуло).
    const result = await pool.query(
      `WITH found_session AS (
         SELECT user_id, expires_at FROM sessions WHERE token = $1
       ),
       touched_session AS (
         UPDATE sessions SET last_activity_at = NOW()
         WHERE token = $1 AND expires_at > NOW()
         RETURNING user_id
       ),
       touched_user AS (
         UPDATE users u SET last_seen_at = NOW()
         FROM touched_session ts
         WHERE u.id = ts.user_id
           AND (u.last_seen_at IS NULL OR u.last_seen_at < NOW() - INTERVAL '1 minute')
         RETURNING u.id
       )
       SELECT u.id AS user_id, u.email, u.role, u.ban_reason,
              (fs.expires_at > NOW()) AS session_alive,
              (u.banned_until IS NOT NULL AND u.banned_until > NOW()) AS is_banned,
              CASE WHEN u.banned_until = 'infinity'::timestamptz THEN NULL ELSE u.banned_until END AS banned_until
       FROM found_session fs
       JOIN users u ON u.id = fs.user_id`,
      [token]
    );

    if (result.rowCount === 0) {
      res.status(401).json({ ok: false, error: 'INVALID_TOKEN' });
      return;
    }

    const account = result.rows[0];

    // Заблокированный игрок не должен пользоваться API даже с валидным токеном.
    // Причина и срок важнее сообщения об истёкшей сессии, поэтому проверяем первым.
    if (account.is_banned) {
      res.status(403).json({
        ok: false,
        error: 'ACCOUNT_BANNED',
        reason: account.ban_reason ?? null,
        until: account.banned_until ?? null,
        permanent: account.banned_until === null,
      });
      return;
    }

    if (!account.session_alive) {
      res.status(401).json({ ok: false, error: 'INVALID_TOKEN' });
      return;
    }

    req.userId = account.user_id;
    req.userEmail = account.email;
    req.userRole = account.role;
    req.token = token;

    next();
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message ?? e) });
  }
};

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, streams: realtimeHub.connectionCount });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message ?? e) });
  }
});

/**
 * GET /api/stream — единый realtime-канал (bigplan.md, пункт 24).
 *
 * Один SSE-поток на вкладку вместо отдельного опроса для чата, чата гильдии и уведомлений
 * о заказах на бирже. Авторизация — обычный `Authorization: Bearer`, тем же authMiddleware:
 * клиент читает поток через fetch + ReadableStream, а не через EventSource, именно чтобы не
 * тащить токен в query-строку (он попал бы в access-логи и в Referer).
 *
 * Гильдия читается один раз при подключении и кладётся в клиента хаба — иначе фильтр
 * «только моей гильдии» стоил бы запроса в БД на каждое сообщение.
 */
app.get('/api/stream', authMiddleware, async (req, res) => {
  let guildId = null;
  try {
    const membership = await pool.query(
      'SELECT guild_id FROM guild_members WHERE player_id = $1 LIMIT 1',
      [req.userId]
    );
    guildId = membership.rows[0]?.guild_id ?? null;
  } catch (e) {
    // Отсутствие гильдии не повод не подключать поток: общий чат и биржа работают без неё.
    console.warn('[stream] guild lookup failed:', e?.message ?? e);
  }

  realtimeHub.attach(req, res, { userId: req.userId, guildId });
});

// Регистрация
app.post('/api/auth/register', rateLimit(LIMITS.auth), async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      res.status(400).json({ ok: false, error: 'EMAIL_AND_PASSWORD_REQUIRED' });
      return;
    }

    // Проверяем, существует ли пользователь
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rowCount > 0) {
      res.status(409).json({ ok: false, error: 'USER_EXISTS' });
      return;
    }

    // Пароль хешируется через scrypt (server/auth-password.js). Аварийный режим
    // LEGACY_PLAINTEXT_PASSWORDS=1 сохраняет прежнее поведение с открытым текстом.
    const storedPassword = await encodePasswordForStorage(password);

    // Роль назначается только по списку ADMIN_EMAILS — клиент её задать не может.
    const initialRole = bootstrapRoleForEmail(email);
    if (initialRole === 'admin') {
      console.log(`[admin] ADMIN_EMAILS: новый аккаунт ${email} создан с ролью admin`);
    }

    const result = await pool.query(
      'INSERT INTO users (email, password, role) VALUES ($1, $2, $3) RETURNING id, email, role, settings, current_save_id, pinned_resources',
      [email, storedPassword, initialRole]
    );

    const user = result.rows[0];
    
    // Создаем слот по умолчанию для нового пользователя
    const slotResult = await pool.query(
      `INSERT INTO game_slots (user_id, name, description, last_played_at)
       VALUES ($1, 'Моя игра', 'Первая игра', NOW())
       RETURNING id`,
      [user.id]
    );
    const defaultSlotId = slotResult.rows[0].id;
    
    // Устанавливаем его как текущий
    await pool.query(
      'UPDATE users SET current_slot_id = $1 WHERE id = $2',
      [defaultSlotId, user.id]
    );
    
    // Создаем сессию
    const userAgent = req.headers['user-agent'];
    const ipAddress = req.ip || req.connection.remoteAddress;
    const { token, expiresAt } = await createSession(user.id, userAgent, ipAddress);

    res.json({ 
      ok: true, 
      user,
      token,
      expiresAt
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message ?? e) });
  }
});

// Вход
app.post('/api/auth/login', rateLimit(LIMITS.auth), async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      res.status(400).json({ ok: false, error: 'EMAIL_AND_PASSWORD_REQUIRED' });
      return;
    }

    // Пароли могут быть как scrypt-хешами, так и старыми открытыми значениями,
    // поэтому выбираем по e-mail и сверяем в Node.
    const result = await pool.query(
      `SELECT id, email, password, role, ban_reason, settings, current_save_id, pinned_resources, current_slot_id,
              (banned_until IS NOT NULL AND banned_until > NOW()) AS is_banned,
              CASE WHEN banned_until = 'infinity'::timestamptz THEN NULL ELSE banned_until END AS banned_until
       FROM users WHERE email = $1`,
      [email]
    );

    const row = result.rows[0] ?? null;
    // Для несуществующего e-mail тратим столько же времени — иначе адреса можно перебрать.
    const stored = row ? row.password : await getDummyStoredHash();
    const check = await verifyPassword(password, stored);

    if (!row || !check.ok) {
      res.status(401).json({ ok: false, error: 'INVALID_CREDENTIALS' });
      return;
    }

    // Прозрачная миграция: старый открытый пароль заменяем хешем при первом входе.
    if (check.needsUpgrade) {
      try {
        const upgraded = await encodePasswordForStorage(password);
        if (upgraded !== stored) {
          await pool.query('UPDATE users SET password = $1 WHERE id = $2', [upgraded, row.id]);
          console.log(`[auth] пароль пользователя #${row.id} переведён на scrypt`);
        }
      } catch (e) {
        console.error('[auth] не удалось обновить хеш пароля:', e?.message ?? e);
      }
    }

    if (row.is_banned) {
      res.status(403).json({
        ok: false,
        error: 'ACCOUNT_BANNED',
        reason: row.ban_reason ?? null,
        until: row.banned_until ?? null,
        permanent: row.banned_until === null,
      });
      return;
    }

    const { password: _password, is_banned: _isBanned, ...user } = row;

    // Если у пользователя нет слота - создаем ему слот по умолчанию
    if (!user.current_slot_id) {
      // Проверяем есть ли у него вообще слоты
      const slotsResult = await pool.query(
        'SELECT id FROM game_slots WHERE user_id = $1 LIMIT 1',
        [user.id]
      );
      
      let slotId;
      if (slotsResult.rowCount === 0) {
        // Создаем слот по умолчанию
        const newSlotResult = await pool.query(
          `INSERT INTO game_slots (user_id, name, description, last_played_at)
           VALUES ($1, 'Моя игра', 'Первая игра', NOW())
           RETURNING id`,
          [user.id]
        );
        slotId = newSlotResult.rows[0].id;
        
        // Переносим существующие сохранения в новый слот
        await pool.query(
          'UPDATE game_save SET slot_id = $1 WHERE user_id = $2 AND slot_id IS NULL',
          [slotId, user.id]
        );
      } else {
        slotId = slotsResult.rows[0].id;
      }
      
      // Устанавливаем слот как текущий
      await pool.query(
        'UPDATE users SET current_slot_id = $1 WHERE id = $2',
        [slotId, user.id]
      );
      user.current_slot_id = slotId;
    }
    
    // Создаем сессию
    const userAgent = req.headers['user-agent'];
    const ipAddress = req.ip || req.connection.remoteAddress;
    const { token, expiresAt } = await createSession(user.id, userAgent, ipAddress);

    res.json({ 
      ok: true, 
      user,
      token,
      expiresAt
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message ?? e) });
  }
});

// Выход (удаление текущей сессии)
app.post('/api/auth/logout', authMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM sessions WHERE token = $1', [req.token]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message ?? e) });
  }
});

// Выход из всех сессий (удаление всех сессий пользователя)
app.post('/api/auth/logout-all', authMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM sessions WHERE user_id = $1', [req.userId]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message ?? e) });
  }
});

// Получить информацию о текущей сессии
app.get('/api/auth/session', authMiddleware, async (req, res) => {
  try {
    // role / banned_until / ban_reason нужны клиенту, чтобы решить, показывать ли
    // вход в админ-панель. 'infinity' (постоянный бан) отдаём как permanent-флаг,
    // потому что Infinity не сериализуется в JSON.
    const result = await pool.query(
      `SELECT u.id, u.email, u.settings, u.current_save_id, u.pinned_resources, u.role, u.ban_reason,
              CASE WHEN u.banned_until = 'infinity'::timestamptz THEN NULL ELSE u.banned_until END AS banned_until,
              COALESCE(u.banned_until = 'infinity'::timestamptz, false) AS ban_permanent,
              u.last_seen_at,
              s.created_at, s.last_activity_at, s.expires_at
       FROM users u JOIN sessions s ON u.id = s.user_id WHERE s.token = $1`,
      [req.token]
    );
    
    if (result.rowCount === 0) {
      res.status(404).json({ ok: false, error: 'SESSION_NOT_FOUND' });
      return;
    }
    
    res.json({ ok: true, user: result.rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message ?? e) });
  }
});

// ========== SETTINGS API ==========

// Получить настройки пользователя
app.get('/api/settings', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT settings FROM users WHERE id = $1',
      [req.userId]
    );
    
    if (result.rowCount === 0) {
      res.status(404).json({ ok: false, error: 'USER_NOT_FOUND' });
      return;
    }
    
    res.json({ ok: true, settings: result.rows[0].settings || {} });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message ?? e) });
  }
});

// Обновить настройки пользователя
app.put('/api/settings', authMiddleware, async (req, res) => {
  try {
    const { settings } = req.body;
    
    if (!settings || typeof settings !== 'object') {
      res.status(400).json({ ok: false, error: 'INVALID_SETTINGS_DATA' });
      return;
    }

    const result = await pool.query(
      'UPDATE users SET settings = $1::jsonb WHERE id = $2 RETURNING settings',
      [JSON.stringify(settings), req.userId]
    );
    
    if (result.rowCount === 0) {
      res.status(404).json({ ok: false, error: 'USER_NOT_FOUND' });
      return;
    }
    
    res.json({ ok: true, settings: result.rows[0].settings });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message ?? e) });
  }
});

// ========== USER PREFERENCES API ==========

// Получить pinned resources
app.get('/api/preferences/pinned-resources', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT pinned_resources FROM users WHERE id = $1',
      [req.userId]
    );
    
    if (result.rowCount === 0) {
      res.status(404).json({ ok: false, error: 'USER_NOT_FOUND' });
      return;
    }
    
    res.json({ 
      ok: true, 
      pinnedResources: result.rows[0].pinned_resources || ['energy', 'ore', 'ice', 'carbon', 'steel', 'dark_matter']
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message ?? e) });
  }
});

// Обновить pinned resources
app.put('/api/preferences/pinned-resources', authMiddleware, async (req, res) => {
  try {
    const { pinnedResources } = req.body;

    if (!Array.isArray(pinnedResources)) {
      res.status(400).json({ ok: false, error: 'INVALID_PINNED_RESOURCES' });
      return;
    }

    /*
     * Раньше в JSONB уходил любой массив любого размера с любым содержимым: сервер не знает
     * список ResourceType (он живёт в TS-типах клиента), но форму и объём проверить обязан,
     * иначе колонка users.pinned_resources — это произвольное хранилище на стороне сервера.
     * Клиент дополнительно фильтрует по RESOURCE_LABEL (см. usePinnedResources).
     */
    const MAX_PINS = 32;
    const cleaned = [];
    for (const item of pinnedResources) {
      if (typeof item !== 'string') continue;
      if (item.length === 0 || item.length > 64) continue;
      if (!/^[a-z0-9_]+$/.test(item)) continue;
      if (cleaned.includes(item)) continue;
      cleaned.push(item);
      if (cleaned.length >= MAX_PINS) break;
    }

    const result = await pool.query(
      'UPDATE users SET pinned_resources = $1::jsonb WHERE id = $2 RETURNING pinned_resources',
      [JSON.stringify(cleaned), req.userId]
    );
    
    if (result.rowCount === 0) {
      res.status(404).json({ ok: false, error: 'USER_NOT_FOUND' });
      return;
    }
    
    res.json({ ok: true, pinnedResources: result.rows[0].pinned_resources });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message ?? e) });
  }
});

// Получить current save ID
app.get('/api/preferences/current-save', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT current_save_id FROM users WHERE id = $1',
      [req.userId]
    );
    
    if (result.rowCount === 0) {
      res.status(404).json({ ok: false, error: 'USER_NOT_FOUND' });
      return;
    }
    
    res.json({ ok: true, currentSaveId: result.rows[0].current_save_id });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message ?? e) });
  }
});

// Обновить current save ID
app.put('/api/preferences/current-save', authMiddleware, async (req, res) => {
  try {
    const { currentSaveId } = req.body;
    
    if (currentSaveId !== null && typeof currentSaveId !== 'number') {
      res.status(400).json({ ok: false, error: 'INVALID_SAVE_ID' });
      return;
    }

    // Проверяем, что сохранение существует и принадлежит пользователю
    if (currentSaveId !== null) {
      const saveCheck = await pool.query(
        'SELECT id FROM game_save WHERE id = $1 AND user_id = $2',
        [currentSaveId, req.userId]
      );
      
      if (saveCheck.rowCount === 0) {
        res.status(404).json({ ok: false, error: 'SAVE_NOT_FOUND' });
        return;
      }
    }

    const result = await pool.query(
      'UPDATE users SET current_save_id = $1 WHERE id = $2 RETURNING current_save_id',
      [currentSaveId, req.userId]
    );
    
    if (result.rowCount === 0) {
      res.status(404).json({ ok: false, error: 'USER_NOT_FOUND' });
      return;
    }
    
    res.json({ ok: true, currentSaveId: result.rows[0].current_save_id });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message ?? e) });
  }
});


// ========== GAME SLOTS API ==========

// Получить список всех игровых слотов пользователя
app.get('/api/slots', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, description, created_at, updated_at, last_played_at, play_time_seconds
       FROM game_slots 
       WHERE user_id = $1 
       ORDER BY last_played_at DESC NULLS LAST, updated_at DESC`,
      [req.userId]
    );
    
    // Получаем текущий слот пользователя
    const userResult = await pool.query(
      'SELECT current_slot_id FROM users WHERE id = $1',
      [req.userId]
    );
    
    res.json({ 
      ok: true, 
      slots: result.rows,
      currentSlotId: userResult.rows[0]?.current_slot_id || null
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message ?? e) });
  }
});

// NOTE: literal paths MUST be registered before the parameterised `/:id` route.
// Express matches in registration order, so while this handler sat below `/api/slots/:id`
// every GET /api/slots/current was answered by that route with id="current", which reached
// Postgres as an integer and returned 500 'invalid input syntax for type integer'.
// Получить текущий слот пользователя
app.get('/api/slots/current', authMiddleware, async (req, res) => {
  try {
    const userResult = await pool.query(
      'SELECT current_slot_id FROM users WHERE id = $1',
      [req.userId]
    );
    
    if (!userResult.rows[0]?.current_slot_id) {
      res.json({ ok: true, slot: null, latestSave: null });
      return;
    }
    
    const slotId = userResult.rows[0].current_slot_id;
    
    const slotResult = await pool.query(
      `SELECT id, name, description, created_at, updated_at, last_played_at, play_time_seconds
       FROM game_slots WHERE id = $1`,
      [slotId]
    );
    
    if (slotResult.rowCount === 0) {
      res.json({ ok: true, slot: null, latestSave: null });
      return;
    }
    
    // Получаем последнее сохранение для этого слота
    const saveResult = await pool.query(
      `SELECT id, name, save_type, data, created_at, updated_at
       FROM game_save 
       WHERE slot_id = $1 
       ORDER BY updated_at DESC 
       LIMIT 1`,
      [slotId]
    );
    
    res.json({ 
      ok: true, 
      slot: slotResult.rows[0],
      latestSave: saveResult.rows[0] || null
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message ?? e) });
  }
});

// Получить конкретный игровой слот
app.get('/api/slots/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, description, created_at, updated_at, last_played_at, play_time_seconds
       FROM game_slots 
       WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.userId]
    );
    
    if (result.rowCount === 0) {
      res.status(404).json({ ok: false, error: 'SLOT_NOT_FOUND' });
      return;
    }
    
    res.json({ ok: true, slot: result.rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message ?? e) });
  }
});

// Создать новый игровой слот
app.post('/api/slots', authMiddleware, async (req, res) => {
  try {
    const { name, description } = req.body;
    
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ ok: false, error: 'NAME_REQUIRED' });
      return;
    }
    
    const result = await pool.query(
      `INSERT INTO game_slots (user_id, name, description, last_played_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING id, name, description, created_at, updated_at, last_played_at, play_time_seconds`,
      [req.userId, name.trim(), description?.trim() || null]
    );
    
    const newSlot = result.rows[0];
    
    // Устанавливаем новый слот как текущий
    await pool.query(
      'UPDATE users SET current_slot_id = $1 WHERE id = $2',
      [newSlot.id, req.userId]
    );
    
    res.json({ ok: true, slot: newSlot });
  } catch (e) {
    if (e.code === '23505') {
      res.status(409).json({ ok: false, error: 'SLOT_NAME_EXISTS' });
    } else {
      res.status(500).json({ ok: false, error: String(e?.message ?? e) });
    }
  }
});

// Обновить игровой слот
app.put('/api/slots/:id', authMiddleware, async (req, res) => {
  try {
    const { name, description } = req.body;
    
    const updates = [];
    const values = [];
    let paramIndex = 1;
    
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        res.status(400).json({ ok: false, error: 'INVALID_NAME' });
        return;
      }
      updates.push(`name = $${paramIndex++}`);
      values.push(name.trim());
    }
    
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(description?.trim() || null);
    }
    
    if (updates.length === 0) {
      res.status(400).json({ ok: false, error: 'NO_UPDATES' });
      return;
    }
    
    updates.push(`updated_at = NOW()`);
    values.push(req.params.id, req.userId);
    
    const result = await pool.query(
      `UPDATE game_slots 
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND user_id = $${paramIndex}
       RETURNING id, name, description, created_at, updated_at, last_played_at, play_time_seconds`,
      values
    );
    
    if (result.rowCount === 0) {
      res.status(404).json({ ok: false, error: 'SLOT_NOT_FOUND' });
      return;
    }
    
    res.json({ ok: true, slot: result.rows[0] });
  } catch (e) {
    if (e.code === '23505') {
      res.status(409).json({ ok: false, error: 'SLOT_NAME_EXISTS' });
    } else {
      res.status(500).json({ ok: false, error: String(e?.message ?? e) });
    }
  }
});

// Удалить игровой слот
app.delete('/api/slots/:id', authMiddleware, async (req, res) => {
  try {
    // Проверяем, что это не текущий активный слот, или сбрасываем его
    const userResult = await pool.query(
      'SELECT current_slot_id FROM users WHERE id = $1',
      [req.userId]
    );
    
    if (userResult.rows[0]?.current_slot_id === parseInt(req.params.id)) {
      // Сбрасываем текущий слот
      await pool.query(
        'UPDATE users SET current_slot_id = NULL WHERE id = $1',
        [req.userId]
      );
    }
    
    const result = await pool.query(
      'DELETE FROM game_slots WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.userId]
    );
    
    if (result.rowCount === 0) {
      res.status(404).json({ ok: false, error: 'SLOT_NOT_FOUND' });
      return;
    }
    
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message ?? e) });
  }
});

// Переключиться на игровой слот
app.post('/api/slots/:id/switch', authMiddleware, async (req, res) => {
  try {
    // Проверяем, что слот существует
    const slotResult = await pool.query(
      'SELECT id, name FROM game_slots WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );
    
    if (slotResult.rowCount === 0) {
      res.status(404).json({ ok: false, error: 'SLOT_NOT_FOUND' });
      return;
    }
    
    /*
     * Переключаем слот И перенаправляем current_save_id на последний сейв НОВОГО слота.
     *
     * Раньше обновлялся только current_slot_id, а current_save_id продолжал указывать на сейв
     * прежнего слота — и следующее автосохранение записывало новую игру поверх старой.
     * Серверная проверка слота в PUT /api/saves теперь это ловит, но оставлять указатель
     * протухшим всё равно нельзя: иначе каждое переключение слота порождало бы лишний сейв.
     */
    await pool.query(
      `UPDATE users
       SET current_slot_id = $1,
           current_save_id = (
             SELECT id FROM game_save WHERE slot_id = $1 ORDER BY updated_at DESC LIMIT 1
           )
       WHERE id = $2`,
      [req.params.id, req.userId]
    );
    
    await pool.query(
      'UPDATE game_slots SET last_played_at = NOW() WHERE id = $1',
      [req.params.id]
    );
    
    // Получаем последнее сохранение для этого слота
    const saveResult = await pool.query(
      `SELECT id, name, save_type, data, created_at, updated_at
       FROM game_save 
       WHERE slot_id = $1 
       ORDER BY updated_at DESC 
       LIMIT 1`,
      [req.params.id]
    );
    
    res.json({ 
      ok: true, 
      slot: slotResult.rows[0],
      latestSave: saveResult.rows[0] || null
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message ?? e) });
  }
});



// ========== SAVES API ==========

// Получить список всех сохранений для текущего слота
app.get('/api/saves', authMiddleware, async (req, res) => {
  try {
    // Получаем текущий слот
    const userResult = await pool.query(
      'SELECT current_slot_id FROM users WHERE id = $1',
      [req.userId]
    );
    
    const slotId = userResult.rows[0]?.current_slot_id;
    
    let result;
    if (slotId) {
      result = await pool.query(
        `SELECT id, name, save_type, slot_id, created_at, updated_at 
         FROM game_save 
         WHERE slot_id = $1 
         ORDER BY updated_at DESC`,
        [slotId]
      );
    } else {
      // Для обратной совместимости - сохранения без слота
      result = await pool.query(
        `SELECT id, name, save_type, slot_id, created_at, updated_at 
         FROM game_save 
         WHERE user_id = $1 AND slot_id IS NULL
         ORDER BY updated_at DESC`,
        [req.userId]
      );
    }
    
    res.json({ ok: true, saves: result.rows, slotId });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message ?? e) });
  }
});

// Получить конкретное сохранение
app.get('/api/saves/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, save_type, slot_id, data, created_at, updated_at FROM game_save WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );
    
    if (result.rowCount === 0) {
      res.status(404).json({ ok: false, error: 'SAVE_NOT_FOUND' });
      return;
    }
    
    res.json({ ok: true, save: result.rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message ?? e) });
  }
});

// Создать или обновить сохранение
app.put('/api/saves', authMiddleware, rateLimit(LIMITS.saves), async (req, res) => {
  try {
    const { name, saveType, data, saveId } = req.body;
    
    if (!data || typeof data !== 'object') {
      res.status(400).json({ ok: false, error: 'INVALID_SAVE_DATA' });
      return;
    }

    const type = saveType || 'manual';
    
    if (!['manual', 'auto'].includes(type)) {
      res.status(400).json({ ok: false, error: 'INVALID_SAVE_TYPE' });
      return;
    }
    
    // Получаем текущий слот пользователя
    const userResult = await pool.query(
      'SELECT current_slot_id FROM users WHERE id = $1',
      [req.userId]
    );
    
    const slotId = userResult.rows[0]?.current_slot_id;

    let saveName = name;
    
    // Для автосохранений генерируем имя с датой
    if (type === 'auto') {
      saveName = `Автосохранение ${new Date().toLocaleString('ru-RU')}`;
    } else if (!saveName) {
      res.status(400).json({ ok: false, error: 'NAME_REQUIRED_FOR_MANUAL_SAVE' });
      return;
    }

    let result;
    
    /*
     * Если передан saveId — обновляем существующее сохранение, НО только если оно принадлежит
     * текущему слоту.
     *
     * Раньше условие было `WHERE id = $2 AND user_id = $3` без проверки слота, а saveId клиент
     * берёт из users.current_save_id — поля, привязанного к ПОЛЬЗОВАТЕЛЮ, а не к слоту, и не
     * сбрасываемого при переключении слота. Последовательность «поиграл в слоте A → переключился
     * на слот B → автосохранение» записывала состояние слота B поверх сейва слота A. Игрок
     * возвращался в слот A и попадал в чужую игру. Проверено сценарным тестом: слот A содержал
     * данные слота B.
     *
     * Если saveId устарел (указывает на сейв другого слота или удалён), это НЕ ошибка: создаём
     * новое сохранение для текущего слота. Возвращать 404 здесь нельзя — автосохранение молча
     * перестало бы работать.
     */
    if (saveId) {
      result = await pool.query(
        `UPDATE game_save 
         SET data = $1::jsonb, updated_at = NOW()
         WHERE id = $2 AND user_id = $3 AND slot_id IS NOT DISTINCT FROM $4
         RETURNING id, name, save_type, slot_id, created_at, updated_at`,
        [JSON.stringify(data), saveId, req.userId, slotId]
      );
    }

    if (!saveId || result.rowCount === 0) {
      if (saveId) {
        console.warn(
          `[saves] saveId=${saveId} не принадлежит слоту ${slotId} (user ${req.userId}) — создаём новое сохранение вместо перезаписи чужого`
        );
      }
      // Создаем новое сохранение с привязкой к слоту
      result = await pool.query(
        `INSERT INTO game_save (user_id, slot_id, name, save_type, data)
         VALUES ($1, $2, $3, $4, $5::jsonb)
         RETURNING id, name, save_type, slot_id, created_at, updated_at`,
        [req.userId, slotId, saveName, type, JSON.stringify(data)]
      );
    }
    
    // Обновляем время последней игры в слоте
    if (slotId) {
      await pool.query(
        'UPDATE game_slots SET last_played_at = NOW(), updated_at = NOW() WHERE id = $1',
        [slotId]
      );
    }

    // Для автосохранений - удаляем старые, оставляем только 3 последних
    if (type === 'auto' && slotId) {
      await pool.query(
        `DELETE FROM game_save
         WHERE slot_id = $1 
         AND save_type = 'auto'
         AND id NOT IN (
           SELECT id FROM game_save
           WHERE slot_id = $1 AND save_type = 'auto'
           ORDER BY created_at DESC
           LIMIT 3
         )`,
        [slotId]
      );
    }

    res.json({ ok: true, save: result.rows[0] });
  } catch (e) {
    // Проверяем на дубликат имени
    if (e.code === '23505') {
      res.status(409).json({ ok: false, error: 'SAVE_NAME_EXISTS' });
    } else {
      res.status(500).json({ ok: false, error: String(e?.message ?? e) });
    }
  }
});

// Удалить сохранение
app.delete('/api/saves/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM game_save WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.userId]
    );
    
    if (result.rowCount === 0) {
      res.status(404).json({ ok: false, error: 'SAVE_NOT_FOUND' });
      return;
    }
    
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message ?? e) });
  }
});

// Получить последнее сохранение для текущего слота (для автозагрузки)
app.get('/api/saves/latest/manual', authMiddleware, async (req, res) => {
  try {
    // Получаем текущий слот пользователя
    const userResult = await pool.query(
      'SELECT current_slot_id FROM users WHERE id = $1',
      [req.userId]
    );
    
    const slotId = userResult.rows[0]?.current_slot_id;
    
    // Если нет текущего слота - нет сохранений
    if (!slotId) {
      res.status(404).json({ ok: false, error: 'NO_CURRENT_SLOT' });
      return;
    }
    
    // Загружаем последнее сохранение для текущего слота
    const result = await pool.query(
      `SELECT id, name, save_type, slot_id, data, created_at, updated_at 
       FROM game_save 
       WHERE slot_id = $1
       ORDER BY updated_at DESC 
       LIMIT 1`,
      [slotId]
    );
    
    if (result.rowCount === 0) {
      res.status(404).json({ ok: false, error: 'NO_SAVES_FOR_SLOT' });
      return;
    }
    
    res.json({ ok: true, save: result.rows[0], slotId });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message ?? e) });
  }
});

await initDb();

// Роли, баны, журнал администратора, объявления + бутстрап ADMIN_EMAILS
await initAdminTables(pool);
warnIfLegacyPasswordMode();

// Инициализация таблиц для торговой биржи и гильдий
await initMarketTables(pool);

// Запуск серверной рыночной симуляции (единый источник правды по ценам).
// Обязательно ПОСЛЕ initMarketTables: симуляция дополняет market_price_history
// столбцом synthetic и опирается на её существование.
await startMarketSim(pool);

// Инициализация таблиц для синхронизации

// Инициализация таблиц для P2P кредитования
await initP2PLendingTables(pool);

// Чат: общий канал (гильдейский живёт в market.js вместе с таблицами гильдий)
await initChatTables(pool);

// Регистрация маршрутов для торговой биржи и гильдий
createMarketRoutes(app, pool, authMiddleware);
createMarketSimRoutes(app, pool);
createGuildRoutes(app, pool, authMiddleware);

// Регистрация маршрутов для синхронизации

// Регистрация маршрутов для AI
createAIRoutes(app, pool, authMiddleware);

// Запуск AI Oracle (периодическое обновление раз в час)
startAIOracle(pool);

// Инициализация офлайн-трейдинга
await initOfflineTradingTables(pool);

// Регистрация маршрутов для офлайн-трейдинга
createOfflineTradingRoutes(app, pool, authMiddleware);

// Регистрация маршрутов для P2P кредитования
createP2PLendingRoutes(app, pool, authMiddleware);

// Чат: общий и гильдейский (bigplan.md, пункты 12, 13)
createChatRoutes(app, pool, authMiddleware);

// Админ-панель (/api/admin/*) и публичные объявления (/api/announcements)
createAdminRoutes(app, pool, authMiddleware);

if (isProduction) {
  /*
   * Карты кода (.map) не раздаём (bigplan.md, пункт 34).
   *
   * Собирать их полезно: без них присланный игроком стектрейс нечитаем, и разобрать его локально
   * больше нечем (серверного сбора ошибок в проекте нет). Но раздавать наружу — значит выкладывать
   * полные исходники проекта: любой запрос вида /assets/index-*.js.map отдавал 2.8 МБ кода.
   *
   * Поэтому: vite собирает карты в режиме 'hidden' (ссылки `sourceMappingURL` в бандлах нет),
   * а этот обработчик закрывает и прямой доступ. Файлы остаются на диске рядом со сборкой —
   * ровно там, где они нужны для разбора стектрейса.
   */
  app.get(/\.map$/, (_req, res) => {
    res.status(404).json({ ok: false, error: 'NOT_FOUND' });
  });

  app.use(express.static(distDir));
  app.get(/^(?!\/api(?:\/|$)).*/, (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

// Несуществующий /api/* — тоже JSON, а не HTML-страница finalhandler'а.
// Регистрируется ПОСЛЕ всех маршрутов и не трогает не-API пути (в production их
// забирает SPA-fallback выше).
app.use('/api', (req, res) => {
  res.status(404).json({ ok: false, error: 'NOT_FOUND', message: `Маршрут не найден: ${req.method} /api${req.path}` });
});

// ============================================================================
// ЗАМЫКАЮЩИЙ ОБРАБОТЧИК ОШИБОК — ВСЕГДА JSON
// ============================================================================
//
// Регистрируется ПОСЛЕ всех маршрутов: до него доходит всё, что не поймал сам
// обработчик (в том числе отказ пула соединений — 'timeout exceeded when trying
// to connect' — который прилетал из await вне try/catch).
//
// Зачем: дефолтный обработчик Express отдаёт HTML-страницу со СТЕКОМ и
// АБСОЛЮТНЫМИ ПУТЯМИ файловой системы. Наблюдалось живьём:
//   <pre>Error: timeout exceeded when trying to connect<br>
//        at /Volumes/.../node_modules/pg-pool/index.js:45:11<br> ...
// Клиент при этом получал не-JSON и не мог ни показать русское сообщение, ни
// прочитать код ошибки (error === undefined).
//
// Никакие детали наружу не идут — только код и сообщение; подробности в лог.
app.use((err, req, res, _next) => {
  const status = Number(err?.status ?? err?.statusCode);
  const message = String(err?.message ?? '');
  const overloaded =
    err?.code === '53300' ||
    err?.code === '55P03' ||
    err?.code === '57014' ||
    /timeout exceeded when trying to connect|Connection terminated due to connection timeout/i.test(message);

  console.error(`[server] необработанная ошибка ${req.method} ${req.originalUrl}:`, err);

  if (res.headersSent) {
    // Часть ответа уже улетела — дописывать JSON нельзя, просто рвём соединение.
    res.destroy();
    return;
  }

  if (overloaded) {
    res.status(503).json({ ok: false, error: 'SERVICE_BUSY', message: 'Сервер перегружен, повторите запрос через секунду.' });
    return;
  }
  res.status(Number.isInteger(status) && status >= 400 && status < 600 ? status : 500).json({
    ok: false,
    error: 'INTERNAL',
    message: 'Внутренняя ошибка сервера.',
  });
});


// Зачистка биржи: истечение ордеров и прямых предложений с ВОЗВРАТОМ ЭСКРОУ.
// До этого POST /api/market/expire-orders не вызывал никто, и ордера не истекали.
startMarketMaintenance(pool);

const server = app.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`[server] listening on http://${HOST}:${PORT} (${isProduction ? 'production' : 'development'})`);
});

async function shutdown(signal) {
  console.log(`[server] ${signal} received, shutting down`);
  stopMarketSim();
  stopMarketMaintenance();
  stopAIOracle();

  server.close(async () => {
    await pool.end();
    process.exit(0);
  });

  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
