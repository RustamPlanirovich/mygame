-- Миграция: Система игровых слотов
-- Каждый слот - это отдельная игра со своими сохранениями

-- 1. Таблица игровых слотов
CREATE TABLE IF NOT EXISTS game_slots (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_played_at TIMESTAMPTZ,
  play_time_seconds INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT false
);

-- Индексы для игровых слотов
CREATE INDEX IF NOT EXISTS idx_game_slots_user_id ON game_slots(user_id);
CREATE INDEX IF NOT EXISTS idx_game_slots_active ON game_slots(user_id, is_active);
CREATE UNIQUE INDEX IF NOT EXISTS idx_game_slots_user_name ON game_slots(user_id, name);

-- 2. Добавляем поле slot_id в таблицу game_save
ALTER TABLE game_save ADD COLUMN IF NOT EXISTS slot_id INTEGER REFERENCES game_slots(id) ON DELETE CASCADE;

-- Индекс для привязки сохранений к слотам
CREATE INDEX IF NOT EXISTS idx_game_save_slot_id ON game_save(slot_id);

-- 3. Добавляем поле current_slot_id в таблицу users
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_slot_id INTEGER REFERENCES game_slots(id) ON DELETE SET NULL;

-- 4. Уникальность имени сохранения внутри слота (вместо user_id)
-- Удаляем старый индекс если есть
DROP INDEX IF EXISTS idx_game_save_manual_name;
-- Создаем новый для слота
CREATE UNIQUE INDEX IF NOT EXISTS idx_game_save_slot_name 
ON game_save(slot_id, name) WHERE save_type = 'manual';

-- 5. Обновляем индексы для сохранений по слотам
CREATE INDEX IF NOT EXISTS idx_game_save_slot_type ON game_save(slot_id, save_type);
CREATE INDEX IF NOT EXISTS idx_game_save_slot_updated ON game_save(slot_id, updated_at DESC);
