-- Cloud Sync Migration - Фаза 8
-- Таблицы для синхронизации сохранений между устройствами

-- Таблица устройств пользователя
CREATE TABLE IF NOT EXISTS user_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id VARCHAR(100) NOT NULL,
  device_name VARCHAR(200) NOT NULL,
  platform VARCHAR(20) NOT NULL, -- 'web', 'ios', 'android', 'desktop'
  browser VARCHAR(50),
  os VARCHAR(50),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, device_id)
);

-- Индексы для устройств
CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON user_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_user_devices_device_id ON user_devices(device_id);
CREATE INDEX IF NOT EXISTS idx_user_devices_last_seen ON user_devices(last_seen);

-- Таблица облачных сохранений (отдельно от локальных game_save)
CREATE TABLE IF NOT EXISTS cloud_saves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slot_id INTEGER NOT NULL REFERENCES game_slots(id) ON DELETE CASCADE,
  device_id VARCHAR(100) NOT NULL,
  device_name VARCHAR(200),
  version VARCHAR(20) NOT NULL,
  checksum VARCHAR(64) NOT NULL, -- SHA-256
  compressed BOOLEAN DEFAULT true,
  size_bytes INTEGER NOT NULL,
  data TEXT NOT NULL, -- Base64 encoded (possibly compressed)
  era INTEGER,
  credits VARCHAR(100),
  buildings_count INTEGER,
  play_time INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, slot_id)
);

-- Индексы для облачных сохранений
CREATE INDEX IF NOT EXISTS idx_cloud_saves_user_id ON cloud_saves(user_id);
CREATE INDEX IF NOT EXISTS idx_cloud_saves_slot_id ON cloud_saves(slot_id);
CREATE INDEX IF NOT EXISTS idx_cloud_saves_updated ON cloud_saves(updated_at DESC);

-- Таблица резервных копий
CREATE TABLE IF NOT EXISTS save_backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slot_id INTEGER NOT NULL REFERENCES game_slots(id) ON DELETE CASCADE,
  save_id UUID REFERENCES cloud_saves(id) ON DELETE SET NULL,
  name VARCHAR(200),
  reason VARCHAR(20) NOT NULL, -- 'auto', 'manual', 'before_update', 'before_merge', 'before_restore'
  checksum VARCHAR(64) NOT NULL,
  compressed BOOLEAN DEFAULT true,
  size_bytes INTEGER NOT NULL,
  data TEXT NOT NULL,
  era INTEGER,
  play_time INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- Индексы для бэкапов
CREATE INDEX IF NOT EXISTS idx_save_backups_user_id ON save_backups(user_id);
CREATE INDEX IF NOT EXISTS idx_save_backups_slot_id ON save_backups(slot_id);
CREATE INDEX IF NOT EXISTS idx_save_backups_created ON save_backups(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_save_backups_expires ON save_backups(expires_at);

-- Таблица конфликтов синхронизации
CREATE TABLE IF NOT EXISTS sync_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slot_id INTEGER NOT NULL REFERENCES game_slots(id) ON DELETE CASCADE,
  local_device_id VARCHAR(100) NOT NULL,
  local_device_name VARCHAR(200),
  local_timestamp TIMESTAMPTZ NOT NULL,
  local_checksum VARCHAR(64) NOT NULL,
  cloud_timestamp TIMESTAMPTZ NOT NULL,
  cloud_checksum VARCHAR(64) NOT NULL,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolution VARCHAR(20), -- 'use_local', 'use_cloud', 'merge', 'keep_both'
  resolved_by VARCHAR(20), -- 'user', 'auto'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Индексы для конфликтов
CREATE INDEX IF NOT EXISTS idx_sync_conflicts_user_id ON sync_conflicts(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_conflicts_slot_id ON sync_conflicts(slot_id);
CREATE INDEX IF NOT EXISTS idx_sync_conflicts_resolved ON sync_conflicts(resolved);

-- Таблица истории синхронизаций (для отладки и статистики)
CREATE TABLE IF NOT EXISTS sync_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slot_id INTEGER REFERENCES game_slots(id) ON DELETE SET NULL,
  device_id VARCHAR(100) NOT NULL,
  operation VARCHAR(20) NOT NULL, -- 'push', 'pull', 'conflict', 'backup', 'restore'
  status VARCHAR(20) NOT NULL, -- 'success', 'failed', 'conflict'
  duration_ms INTEGER,
  size_bytes INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Индексы для истории
CREATE INDEX IF NOT EXISTS idx_sync_history_user_id ON sync_history(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_history_created ON sync_history(created_at DESC);

-- Функция для автоматической очистки истёкших бэкапов
CREATE OR REPLACE FUNCTION cleanup_expired_backups() RETURNS void AS $$
BEGIN
  DELETE FROM save_backups WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Функция для обновления updated_at
CREATE OR REPLACE FUNCTION update_cloud_save_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для автообновления timestamp
DROP TRIGGER IF EXISTS trigger_update_cloud_save_timestamp ON cloud_saves;
CREATE TRIGGER trigger_update_cloud_save_timestamp
  BEFORE UPDATE ON cloud_saves
  FOR EACH ROW
  EXECUTE FUNCTION update_cloud_save_timestamp();

-- Добавляем настройки синхронизации в таблицу пользователей (если не существуют)
ALTER TABLE users ADD COLUMN IF NOT EXISTS sync_settings JSONB DEFAULT '{}';

-- Комментарии к таблицам
COMMENT ON TABLE user_devices IS 'Устройства пользователей для синхронизации';
COMMENT ON TABLE cloud_saves IS 'Облачные сохранения игры';
COMMENT ON TABLE save_backups IS 'Резервные копии сохранений';
COMMENT ON TABLE sync_conflicts IS 'Конфликты синхронизации';
COMMENT ON TABLE sync_history IS 'История операций синхронизации';
