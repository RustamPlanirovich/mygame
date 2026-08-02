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
