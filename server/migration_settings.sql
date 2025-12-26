-- Миграция для добавления настроек пользователя
-- Добавляем поле settings в таблицу users

ALTER TABLE users ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}';

-- Комментарий для документации
COMMENT ON COLUMN users.settings IS 'Персональные настройки пользователя (графика, геймплей, UI, hotkeys, audio)';
