import pg from 'pg';

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is not set. Create a .env file with DATABASE_URL=postgres://user:pass@localhost:5432/dbname'
  );
}

export const pool = new Pool({ connectionString: databaseUrl });

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

  // Индексы для быстрого поиска сохранений по пользователю
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_game_save_user_id ON game_save(user_id);
  `);
  
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_game_save_type ON game_save(user_id, save_type);
  `);
  
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_game_save_updated ON game_save(user_id, updated_at DESC);
  `);

  // Уникальность имени для ручных сохранений
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_game_save_manual_name 
    ON game_save(user_id, name) WHERE save_type = 'manual';
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

  // Периодическая очистка истекших сессий (каждый час)
  setInterval(async () => {
    try {
      const result = await pool.query('DELETE FROM sessions WHERE expires_at < NOW()');
      if (result.rowCount > 0) {
        console.log(`[cleanup] Removed ${result.rowCount} expired sessions`);
      }
    } catch (e) {
      console.error('[cleanup] Failed to clean expired sessions:', e);
    }
  }, 60 * 60 * 1000); // 1 час
}
