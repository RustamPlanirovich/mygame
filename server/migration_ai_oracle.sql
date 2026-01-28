-- Миграция для AI Oracle (централизованный кэш AI-данных)
-- Запускать: psql $DATABASE_URL < migration_ai_oracle.sql

-- Таблица для хранения AI-данных (прогнозы, дивиденды, рекомендации)
CREATE TABLE IF NOT EXISTS ai_oracle_data (
  id SERIAL PRIMARY KEY,
  data_type TEXT NOT NULL UNIQUE,
  data JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  request_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Индекс для быстрого поиска по типу
CREATE INDEX IF NOT EXISTS idx_ai_oracle_type ON ai_oracle_data(data_type);

-- Индекс для проверки истечения срока
CREATE INDEX IF NOT EXISTS idx_ai_oracle_expires ON ai_oracle_data(expires_at);

-- Таблица логов AI запросов (для мониторинга)
CREATE TABLE IF NOT EXISTS ai_oracle_logs (
  id SERIAL PRIMARY KEY,
  request_type TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  tokens_used INTEGER,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Индекс для анализа логов
CREATE INDEX IF NOT EXISTS idx_ai_oracle_logs_created ON ai_oracle_logs(created_at DESC);

-- Вставляем начальные данные с fallback значениями
INSERT INTO ai_oracle_data (data_type, data, generated_at, expires_at)
VALUES 
  ('market_prediction', '{
    "overallSentiment": "neutral",
    "stockPredictions": [],
    "creditRatePrediction": {
      "predictedBaseRate": 0.1,
      "rateDirection": "stable",
      "reasoning": "Стабильные экономические условия"
    },
    "marketNarrative": "Рынок находится в фазе консолидации. Ожидается умеренная волатильность.",
    "source": "fallback"
  }', NOW(), NOW() + INTERVAL '1 hour'),
  
  ('dividends', '{
    "dividendUpdates": [],
    "marketConditions": "Стабильные рыночные условия",
    "source": "fallback"
  }', NOW(), NOW() + INTERVAL '1 hour'),
  
  ('recommendations', '{
    "conservative": [],
    "balanced": [],
    "aggressive": [],
    "source": "fallback"
  }', NOW(), NOW() + INTERVAL '1 hour')
ON CONFLICT (data_type) DO NOTHING;

-- Готово!
SELECT 'AI Oracle migration completed successfully' as status;
