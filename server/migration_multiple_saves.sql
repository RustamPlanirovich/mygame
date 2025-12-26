-- Миграция для поддержки множественных сохранений
-- ВНИМАНИЕ: Это удалит все существующие сохранения!

DROP TABLE IF EXISTS game_save CASCADE;

-- Пересоздаем таблицу с новыми полями
CREATE TABLE game_save (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  save_type TEXT NOT NULL CHECK (save_type IN ('manual', 'auto')),
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Индексы для быстрого поиска
CREATE INDEX idx_game_save_user_id ON game_save(user_id);
CREATE INDEX idx_game_save_type ON game_save(user_id, save_type);
CREATE INDEX idx_game_save_updated ON game_save(user_id, updated_at DESC);

-- Ограничение уникальности для ручных сохранений с одинаковым именем
CREATE UNIQUE INDEX idx_game_save_manual_name ON game_save(user_id, name) WHERE save_type = 'manual';
