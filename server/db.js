import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is not set. Create a .env file with DATABASE_URL=postgres://user:pass@localhost:5432/dbname'
  );
}

/*
 * Connection pool sizing for ~100 concurrent players.
 *
 * `new Pool({ connectionString })` with no other options takes node-postgres' defaults: max 10
 * connections, no connection timeout and no statement timeout. At 100 players that is three
 * separate problems:
 *   - 10 connections is a hard concurrency ceiling. Requests queue invisibly inside the pool and
 *     surface as latency with no error to point at.
 *   - with no connectionTimeoutMillis a request waiting for a free connection waits forever, so a
 *     single slow query turns into an unbounded backlog rather than a fast failure.
 *   - with no statement_timeout one runaway query pins its connection indefinitely.
 *
 * Postgres' own max_connections is the real budget (default 100), so leave headroom for psql,
 * admin tooling and any second process. Override with PG_POOL_MAX when the server is scaled out.
 */
const poolMax = Number(process.env.PG_POOL_MAX ?? 40);
const statementTimeoutMs = Number(process.env.PG_STATEMENT_TIMEOUT_MS ?? 15_000);

export const pool = new Pool({
  connectionString: databaseUrl,
  max: Number.isFinite(poolMax) && poolMax > 0 ? poolMax : 40,
  // Keep a warm floor so a burst of players does not pay TCP+TLS+auth on every request.
  min: Number(process.env.PG_POOL_MIN ?? 4),
  idleTimeoutMillis: 30_000,
  // Fail fast instead of queueing forever when the pool is saturated.
  connectionTimeoutMillis: 10_000,
  // Recycle connections so a leaked session-level setting or a bloated plan cache cannot persist.
  maxLifetimeSeconds: 1800,
  // Applied per connection: an individual query can never hold a slot longer than this.
  statement_timeout: statementTimeoutMs,
  // A transaction left open by a bug would otherwise hold locks indefinitely.
  idle_in_transaction_session_timeout: 30_000,
  application_name: 'mygame-api',
});

/*
 * Without this handler, an error on an IDLE pooled client is an unhandled 'error' event on the
 * pool, which crashes the whole Node process — so a single Postgres restart or a network blip
 * took every connected player down with it.
 */
pool.on('error', (err) => {
  console.error('[db] idle client error (connection will be discarded):', err.message);
});

if (process.env.PG_POOL_DEBUG === '1') {
  pool.on('connect', () => {
    console.log(`[db] connect — total=${pool.totalCount} idle=${pool.idleCount} waiting=${pool.waitingCount}`);
  });
}

/** Pool telemetry, for the admin dashboard and for diagnosing saturation. */
export function poolStats() {
  return {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
    max: poolMax,
    statementTimeoutMs,
  };
}

export async function initDb() {
  // Таблица пользователей
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Добавляем поля если не существуют
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS current_save_id INTEGER;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS pinned_resources JSONB DEFAULT '["energy", "ore", "ice", "carbon", "steel", "dark_matter"]';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS current_slot_id INTEGER;
  `);

  // Таблица игровых слотов
  await pool.query(`
    CREATE TABLE IF NOT EXISTS game_slots (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_played_at TIMESTAMPTZ,
      play_time_seconds INTEGER DEFAULT 0
    );
  `);

  // Индексы для игровых слотов
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_game_slots_user_id ON game_slots(user_id);
  `);
  
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_game_slots_user_name ON game_slots(user_id, name);
  `);

  // Таблица сохранений игры (множественные сохранения)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS game_save (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      save_type TEXT NOT NULL CHECK (save_type IN ('manual', 'auto')),
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Добавляем slot_id если не существует
  await pool.query(`
    ALTER TABLE game_save ADD COLUMN IF NOT EXISTS slot_id INTEGER REFERENCES game_slots(id) ON DELETE CASCADE;
  `);

  /*
   * revision — счётчик записей сохранения (bigplan.md, пункт 30.3).
   *
   * Растёт на каждую запись: и на автосохранение клиента, и на серверный патч
   * (админская выдача). Клиент присылает ту версию, поверх которой он писал, и
   * запись отклоняется, если в БД она уже другая. Без этого две открытые вкладки
   * (или вкладка + серверный патч) молча затирают друг друга «последним, кто успел»,
   * а игрок видит откат прогресса без единой ошибки.
   *
   * Счётчик, а не updated_at: временная метка зависит от часов и совпадает у двух
   * записей в одну миллисекунду, а целое число монотонно и сравнивается точно.
   */
  await pool.query(`
    ALTER TABLE game_save ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 1;
  `);

  // Индексы для быстрого поиска сохранений
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_game_save_user_id ON game_save(user_id);
  `);
  
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_game_save_slot_id ON game_save(slot_id);
  `);
  
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_game_save_type ON game_save(user_id, save_type);
  `);
  
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_game_save_updated ON game_save(user_id, updated_at DESC);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_users_current_save ON users(current_save_id);
  `);

  // Уникальность имени для ручных сохранений внутри слота
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_game_save_slot_name 
    ON game_save(slot_id, name) WHERE save_type = 'manual' AND slot_id IS NOT NULL;
  `);

  // Таблица сессий
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT UNIQUE NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      user_agent TEXT,
      ip_address TEXT
    );
  `);

  // Индексы для сессий
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
  `);
  
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
  `);
  
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
  `);

  /*
   * Периодическая очистка истекших сессий (раз в час).
   *
   * Таймер именованный, с защитой от повторного запуска (initDb вызывается один раз, но
   * запас не мешает), и с .unref() — иначе он держит event loop и процесс не завершается
   * по SIGTERM, из-за чего pm2 добивает его по таймауту вместо мягкой остановки.
   * Плюс DELETE ограничен LIMIT-подзапросом: за месяц простоя накапливаются десятки тысяч
   * строк, и один безлимитный DELETE берёт долгую блокировку на всю таблицу sessions,
   * через которую проходит КАЖДЫЙ авторизованный запрос.
   */
  startSessionCleanup();
}

let sessionCleanupTimer = null;

export function startSessionCleanup(intervalMs = 60 * 60 * 1000) {
  if (sessionCleanupTimer) return sessionCleanupTimer;

  sessionCleanupTimer = setInterval(async () => {
    try {
      let removed = 0;
      // Пачками, чтобы не держать блокировку долго.
      for (let i = 0; i < 20; i++) {
        const result = await pool.query(
          `DELETE FROM sessions
           WHERE id IN (SELECT id FROM sessions WHERE expires_at < NOW() LIMIT 1000)`
        );
        removed += result.rowCount;
        if (result.rowCount < 1000) break;
      }
      if (removed > 0) {
        console.log(`[cleanup] Removed ${removed} expired sessions`);
      }
    } catch (e) {
      console.error('[cleanup] Failed to clean expired sessions:', e.message);
    }
  }, intervalMs);

  sessionCleanupTimer.unref();
  return sessionCleanupTimer;
}

export function stopSessionCleanup() {
  if (sessionCleanupTimer) {
    clearInterval(sessionCleanupTimer);
    sessionCleanupTimer = null;
  }
}
