-- Миграция для офлайн-трейдинга
-- Запускать: psql $DATABASE_URL < migration_offline_trading.sql

-- Таблица для хранения состояния офлайн-торговли
CREATE TABLE IF NOT EXISTS offline_trading_state (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slot_id INTEGER REFERENCES game_slots(id) ON DELETE CASCADE,
  
  -- Состояние автотрейдера на момент выхода
  autotrader_enabled BOOLEAN DEFAULT false,
  risk_tolerance TEXT DEFAULT 'balanced',
  max_investment_percent DECIMAL DEFAULT 10,
  take_profit_percent DECIMAL DEFAULT 10,
  stop_loss_percent DECIMAL DEFAULT 5,
  
  -- Портфель на момент выхода (снапшот)
  portfolio_snapshot JSONB DEFAULT '[]',
  balance_snapshot TEXT DEFAULT '0',
  
  -- Время последней активности
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_offline_calc_at TIMESTAMPTZ,
  
  -- Статистика офлайн-торговли
  total_offline_profit TEXT DEFAULT '0',
  total_offline_trades INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(user_id, slot_id)
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_offline_trading_user ON offline_trading_state(user_id);
CREATE INDEX IF NOT EXISTS idx_offline_trading_slot ON offline_trading_state(slot_id);
CREATE INDEX IF NOT EXISTS idx_offline_trading_activity ON offline_trading_state(last_activity_at);

-- Таблица логов офлайн-сделок
CREATE TABLE IF NOT EXISTS offline_trading_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slot_id INTEGER REFERENCES game_slots(id) ON DELETE CASCADE,
  
  -- Период офлайн
  offline_start TIMESTAMPTZ NOT NULL,
  offline_end TIMESTAMPTZ NOT NULL,
  offline_duration_minutes INTEGER NOT NULL,
  
  -- Результаты
  trades_executed INTEGER DEFAULT 0,
  total_profit TEXT DEFAULT '0',
  details JSONB DEFAULT '[]',
  
  -- AI данные использованные для симуляции
  ai_predictions_used JSONB,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Индексы для логов
CREATE INDEX IF NOT EXISTS idx_offline_logs_user ON offline_trading_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_offline_logs_created ON offline_trading_logs(created_at DESC);

-- Готово!
SELECT 'Offline trading migration completed successfully' as status;
