-- =============================================
-- Миграция для pending транзакций биржи
-- Фиксит проблему с переносом ресурсов/кредитов
-- =============================================

-- Таблица ожидающих транзакций биржи
-- При совершении сделки создаются записи для покупателя и продавца
CREATE TABLE IF NOT EXISTS market_pending_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id UUID NOT NULL REFERENCES market_trades(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Тип транзакции: buy = получить ресурс, отдать кредиты; sell = отдать ресурс, получить кредиты
  transaction_type VARCHAR(4) NOT NULL CHECK (transaction_type IN ('buy', 'sell')),
  resource VARCHAR(50) NOT NULL,
  -- Количество ресурса для переноса
  resource_amount DECIMAL NOT NULL,
  -- Сумма кредитов для переноса
  credits_amount DECIMAL NOT NULL,
  -- Комиссия (вычитается из кредитов)
  fee_amount DECIMAL NOT NULL DEFAULT 0,
  -- Статус: pending = ожидает применения, applied = применено, failed = ошибка
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'failed')),
  -- Сообщение об ошибке если failed
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  applied_at TIMESTAMPTZ,
  -- Уникальность: один trade - одна транзакция для каждого участника
  UNIQUE(trade_id, player_id)
);

-- Индексы для быстрого поиска pending транзакций
CREATE INDEX IF NOT EXISTS idx_pending_transactions_player_status 
  ON market_pending_transactions(player_id, status) 
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_pending_transactions_created 
  ON market_pending_transactions(created_at);

-- Комментарии
COMMENT ON TABLE market_pending_transactions IS 'Ожидающие транзакции биржи для переноса ресурсов и кредитов между игроками';
COMMENT ON COLUMN market_pending_transactions.transaction_type IS 'buy = игрок покупатель, sell = игрок продавец';
COMMENT ON COLUMN market_pending_transactions.resource_amount IS 'Количество ресурса: + для buy (получить), - для sell (отдать)';
COMMENT ON COLUMN market_pending_transactions.credits_amount IS 'Сумма кредитов: - для buy (отдать), + для sell (получить минус комиссия)';
