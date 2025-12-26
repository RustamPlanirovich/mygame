-- Сброс и пересоздание схемы БД
-- ВНИМАНИЕ: Это удалит все данные!

DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS game_save CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Создание таблицы пользователей
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  settings JSONB DEFAULT '{}',
  current_save_id INTEGER,
  pinned_resources JSONB DEFAULT '["energy", "ore", "ice", "carbon", "steel", "dark_matter"]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Создание таблицы сохранений
CREATE TABLE game_save (
  id TEXT PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Индекс для быстрого поиска сохранений по пользователю
CREATE INDEX idx_game_save_user_id ON game_save(user_id);

-- Добавляем внешний ключ для current_save_id после создания game_save
ALTER TABLE users ADD CONSTRAINT fk_users_current_save 

-- Создание таблицы сессий
CREATE TABLE sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_agent TEXT,
  ip_address TEXT
);

-- Индексы для сессий
CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
  FOREIGN KEY (current_save_id) REFERENCES game_save(id) ON DELETE SET NULL;
