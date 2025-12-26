-- Миграция для добавления user preferences
-- Добавляем поля для хранения текущего сохранения и UI настроек

ALTER TABLE users ADD COLUMN IF NOT EXISTS current_save_id INTEGER REFERENCES game_save(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pinned_resources JSONB DEFAULT '["energy", "ore", "ice", "carbon", "steel", "dark_matter"]';

-- Комментарии для документации
COMMENT ON COLUMN users.current_save_id IS 'ID текущего активного сохранения пользователя';
COMMENT ON COLUMN users.pinned_resources IS 'Закрепленные ресурсы в UI (массив ResourceType)';

-- Индекс для быстрого поиска по current_save_id
CREATE INDEX IF NOT EXISTS idx_users_current_save ON users(current_save_id);
