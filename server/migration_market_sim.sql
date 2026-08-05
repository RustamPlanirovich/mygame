-- =============================================
-- Миграция: серверная рыночная симуляция (market-sim)
--
-- ВНИМАНИЕ: применять этот файл НЕ обязательно.
-- Точно такой же DDL выполняется автоматически из
-- server/market-sim/persistence.js -> initMarketSimTables(pool)
-- при каждом старте сервера. Файл существует для ручного аудита схемы
-- и для окружений, где DDL приложению запрещён.
--
-- Применение: psql "$DATABASE_URL" -f server/migration_market_sim.sql
-- =============================================

-- ---------------------------------------------
-- Состояние симуляции: ровно одна строка (id = 1)
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS market_sim_state (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  -- Сид мира: разыгрывается один раз при первом старте и больше не меняется.
  -- Вся случайность = hash(world_seed, tick, stream, id), поэтому состояние ГПСЧ не хранится.
  world_seed BIGINT NOT NULL,
  -- Точка отсчёта тиков в мс. tick = floor((now - epoch_ms) / 300000)
  epoch_ms BIGINT NOT NULL,
  tick BIGINT NOT NULL,
  -- Скрытый режим рынка: bull | bear | sideways | crisis | melt_up
  regime TEXT NOT NULL,
  regime_started_tick BIGINT NOT NULL,
  -- Базовая кредитная ставка (процесс Орнштейна-Уленбека)
  base_rate DOUBLE PRECISION NOT NULL,
  -- Кольцо последних 144 значений ставки (12 часов) для определения направления
  rate_lag JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- { "technology": { "theta": 0.013 }, ... } — секторные наклоны AR(1)
  sector_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- По каждой акции: x, h, uPrev, lnAnchor, price, prevClose, dayChange, volume,
  --                  xSlow, divDelta, divYield, divPublished, lastJump, attr{...}
  stock_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- По каждому из 52 ресурсов: x, xSlow, dx, price, volume
  resource_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Новостные события с расписанием вперёд (announce/start/peak/end)
  events JSONB NOT NULL DEFAULT '[]'::jsonb,
  engine_version INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------
-- История цен акций (хранится 7 суток = 2016 тиков)
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS market_sim_stock_history (
  stock_id TEXT NOT NULL,
  tick BIGINT NOT NULL,
  price DOUBLE PRECISION NOT NULL,
  volume DOUBLE PRECISION NOT NULL DEFAULT 0,
  day_change DOUBLE PRECISION NOT NULL DEFAULT 0,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (stock_id, tick)
);

CREATE INDEX IF NOT EXISTS idx_market_sim_hist_tick ON market_sim_stock_history(tick DESC);

-- ---------------------------------------------
-- Референсные котировки товаров.
-- Держим отдельно от market_price_history: там реальные сделки игроков,
-- и синтетика испортила бы volume24h / avgPrice24h.
-- GET /api/market/prices делает COALESCE(реальная сделка, эта котировка, базовая цена),
-- поэтому на пустой базе цены никогда не нулевые.
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS market_sim_resource_quotes (
  resource TEXT PRIMARY KEY,
  tick BIGINT NOT NULL,
  price DOUBLE PRECISION NOT NULL,
  reference_price DOUBLE PRECISION NOT NULL,
  -- Движение относительно среднего уровня за сутки (EWMA), аналог priceChange24h
  change_pct DOUBLE PRECISION NOT NULL DEFAULT 0,
  -- Индикативный объём симуляции. В volume24h НЕ попадает.
  indicative_volume DOUBLE PRECISION NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------
-- Новостные события: расписание фиксируется при рождении события,
-- поэтому после перезапуска сервера новость продолжает разворачиваться так же.
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS market_sim_events (
  id TEXT PRIMARY KEY,
  template TEXT NOT NULL,
  scope TEXT NOT NULL,           -- 'sector' | 'stock'
  target TEXT NOT NULL,
  sector TEXT NOT NULL,
  sign SMALLINT NOT NULL,        -- +1 позитивное, -1 негативное
  shape TEXT NOT NULL,           -- 'normal' | 'bubble' | 'relief'
  magnitude DOUBLE PRECISION NOT NULL,
  announce_tick BIGINT NOT NULL, -- фаза слухов начинается здесь
  start_tick BIGINT NOT NULL,
  peak_tick BIGINT NOT NULL,
  end_tick BIGINT NOT NULL,
  headline TEXT NOT NULL,
  rumour_headline TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_sim_events_end ON market_sim_events(end_tick DESC);

-- ---------------------------------------------
-- Флаг синтетики на реальной истории цен.
-- Реальные сделки игроков должны агрегироваться отдельно от любых
-- сгенерированных строк, иначе volume24h и avgPrice24h врут.
-- ---------------------------------------------
ALTER TABLE market_price_history
  ADD COLUMN IF NOT EXISTS synthetic BOOLEAN NOT NULL DEFAULT FALSE;
