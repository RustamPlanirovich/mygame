-- Сброс и пересоздание схемы БД
-- ВНИМАНИЕ: Это удалит все данные!

DROP TABLE IF EXISTS game_save CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Создание таблицы пользователей
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
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
