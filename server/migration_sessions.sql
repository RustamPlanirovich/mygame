-- Миграция для системы сессий
-- Создаем таблицу для хранения активных сессий пользователей

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

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- Комментарии для документации
COMMENT ON TABLE sessions IS 'Активные сессии пользователей с токенами';
COMMENT ON COLUMN sessions.token IS 'Уникальный токен сессии (случайная строка)';
COMMENT ON COLUMN sessions.expires_at IS 'Время истечения сессии';
COMMENT ON COLUMN sessions.last_activity_at IS 'Время последней активности';
COMMENT ON COLUMN sessions.user_agent IS 'User-Agent браузера для аналитики';
COMMENT ON COLUMN sessions.ip_address IS 'IP адрес для безопасности';
