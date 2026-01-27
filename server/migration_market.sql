-- =============================================
-- Миграция для глобальной торговой биржи
-- Фаза 1: Мультиплеерная торговля
-- =============================================

-- Таблица торговых гильдий
CREATE TABLE IF NOT EXISTS guilds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  tag VARCHAR(4) UNIQUE NOT NULL,
  leader_id INTEGER NOT NULL REFERENCES users(id),
  level INTEGER DEFAULT 1,
  experience DECIMAL DEFAULT 0,
  treasury DECIMAL DEFAULT 0,
  max_members INTEGER DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Таблица членов гильдий
CREATE TABLE IF NOT EXISTS guild_members (
  id SERIAL PRIMARY KEY,
  guild_id UUID NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('leader', 'officer', 'member')),
  contribution DECIMAL DEFAULT 0,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(guild_id, player_id)
);

-- Таблица трейдеров (профили игроков на бирже)
CREATE TABLE IF NOT EXISTS traders (
  player_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  player_name VARCHAR(100) NOT NULL,
  rating DECIMAL DEFAULT 5.0 CHECK (rating >= 0 AND rating <= 5),
  total_trades INTEGER DEFAULT 0,
  successful_trades INTEGER DEFAULT 0,
  total_volume DECIMAL DEFAULT 0,
  member_since TIMESTAMPTZ DEFAULT NOW(),
  guild_id UUID REFERENCES guilds(id) ON DELETE SET NULL,
  last_order_time TIMESTAMPTZ  -- Для cooldown между ордерами
);

-- Таблица ордеров
CREATE TABLE IF NOT EXISTS market_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id INTEGER NOT NULL REFERENCES users(id),
  order_type VARCHAR(4) NOT NULL CHECK (order_type IN ('buy', 'sell')),
  resource VARCHAR(50) NOT NULL,
  quantity DECIMAL NOT NULL CHECK (quantity >= 10),  -- Минимум 10 единиц
  quantity_filled DECIMAL DEFAULT 0,
  price_per_unit DECIMAL NOT NULL CHECK (price_per_unit > 0),
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'filled', 'partial', 'cancelled', 'expired')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  guild_id UUID REFERENCES guilds(id) ON DELETE SET NULL
);

-- Таблица сделок
CREATE TABLE IF NOT EXISTS market_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buy_order_id UUID REFERENCES market_orders(id) ON DELETE SET NULL,
  sell_order_id UUID REFERENCES market_orders(id) ON DELETE SET NULL,
  buyer_id INTEGER NOT NULL REFERENCES users(id),
  seller_id INTEGER NOT NULL REFERENCES users(id),
  resource VARCHAR(50) NOT NULL,
  quantity DECIMAL NOT NULL,
  price_per_unit DECIMAL NOT NULL,
  total_amount DECIMAL NOT NULL,
  fee DECIMAL NOT NULL,
  executed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Таблица истории цен (для графиков)
CREATE TABLE IF NOT EXISTS market_price_history (
  id SERIAL PRIMARY KEY,
  resource VARCHAR(50) NOT NULL,
  price DECIMAL NOT NULL,
  volume DECIMAL NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Таблица чата гильдии
CREATE TABLE IF NOT EXISTS guild_chat (
  id SERIAL PRIMARY KEY,
  guild_id UUID NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  player_name VARCHAR(100) NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Таблица заявок на вступление в гильдию
CREATE TABLE IF NOT EXISTS guild_applications (
  id SERIAL PRIMARY KEY,
  guild_id UUID NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  UNIQUE(guild_id, player_id)
);

-- =============================================
-- ИНДЕКСЫ
-- =============================================

-- Индексы для ордеров
CREATE INDEX IF NOT EXISTS idx_orders_status ON market_orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_resource ON market_orders(resource);
CREATE INDEX IF NOT EXISTS idx_orders_player ON market_orders(player_id);
CREATE INDEX IF NOT EXISTS idx_orders_type ON market_orders(order_type);
CREATE INDEX IF NOT EXISTS idx_orders_resource_status ON market_orders(resource, status);
CREATE INDEX IF NOT EXISTS idx_orders_expires ON market_orders(expires_at) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_orders_matching ON market_orders(resource, order_type, status, price_per_unit);

-- Индексы для сделок
CREATE INDEX IF NOT EXISTS idx_trades_time ON market_trades(executed_at);
CREATE INDEX IF NOT EXISTS idx_trades_buyer ON market_trades(buyer_id);
CREATE INDEX IF NOT EXISTS idx_trades_seller ON market_trades(seller_id);
CREATE INDEX IF NOT EXISTS idx_trades_resource ON market_trades(resource);

-- Индексы для истории цен
CREATE INDEX IF NOT EXISTS idx_price_history_resource ON market_price_history(resource);
CREATE INDEX IF NOT EXISTS idx_price_history_time ON market_price_history(recorded_at);
CREATE INDEX IF NOT EXISTS idx_price_history_resource_time ON market_price_history(resource, recorded_at DESC);

-- Индексы для гильдий
CREATE INDEX IF NOT EXISTS idx_guild_members_guild ON guild_members(guild_id);
CREATE INDEX IF NOT EXISTS idx_guild_members_player ON guild_members(player_id);
CREATE INDEX IF NOT EXISTS idx_guild_chat_guild ON guild_chat(guild_id);
CREATE INDEX IF NOT EXISTS idx_guild_chat_time ON guild_chat(created_at);
CREATE INDEX IF NOT EXISTS idx_guild_applications_guild ON guild_applications(guild_id) WHERE status = 'pending';

-- Индексы для трейдеров
CREATE INDEX IF NOT EXISTS idx_traders_guild ON traders(guild_id);
CREATE INDEX IF NOT EXISTS idx_traders_volume ON traders(total_volume DESC);
CREATE INDEX IF NOT EXISTS idx_traders_rating ON traders(rating DESC);

-- =============================================
-- ФУНКЦИИ И ТРИГГЕРЫ
-- =============================================

-- Функция для автоматического истечения ордеров
CREATE OR REPLACE FUNCTION expire_old_orders()
RETURNS void AS $$
BEGIN
  UPDATE market_orders 
  SET status = 'expired' 
  WHERE status = 'open' AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Функция для обновления статистики трейдера после сделки
CREATE OR REPLACE FUNCTION update_trader_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Обновляем статистику покупателя
  INSERT INTO traders (player_id, player_name, total_trades, successful_trades, total_volume, member_since)
  VALUES (NEW.buyer_id, '', 1, 1, NEW.total_amount, NOW())
  ON CONFLICT (player_id) DO UPDATE SET
    total_trades = traders.total_trades + 1,
    successful_trades = traders.successful_trades + 1,
    total_volume = traders.total_volume + EXCLUDED.total_volume;
  
  -- Обновляем статистику продавца
  INSERT INTO traders (player_id, player_name, total_trades, successful_trades, total_volume, member_since)
  VALUES (NEW.seller_id, '', 1, 1, NEW.total_amount, NOW())
  ON CONFLICT (player_id) DO UPDATE SET
    total_trades = traders.total_trades + 1,
    successful_trades = traders.successful_trades + 1,
    total_volume = traders.total_volume + EXCLUDED.total_volume;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_update_trader_stats
AFTER INSERT ON market_trades
FOR EACH ROW
EXECUTE FUNCTION update_trader_stats();

-- Функция для записи истории цен
CREATE OR REPLACE FUNCTION record_price_history()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO market_price_history (resource, price, volume, recorded_at)
  VALUES (NEW.resource, NEW.price_per_unit, NEW.quantity, NOW());
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_record_price_history
AFTER INSERT ON market_trades
FOR EACH ROW
EXECUTE FUNCTION record_price_history();

-- Функция для очистки старой истории цен (хранить последние 30 дней)
CREATE OR REPLACE FUNCTION cleanup_price_history()
RETURNS void AS $$
BEGIN
  DELETE FROM market_price_history 
  WHERE recorded_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Функция для получения рыночных цен
CREATE OR REPLACE FUNCTION get_market_prices(p_resource VARCHAR)
RETURNS TABLE (
  last_price DECIMAL,
  avg_price_24h DECIMAL,
  high_price_24h DECIMAL,
  low_price_24h DECIMAL,
  volume_24h DECIMAL,
  price_change_24h DECIMAL
) AS $$
DECLARE
  v_old_price DECIMAL;
BEGIN
  -- Получаем цену 24 часа назад
  SELECT price INTO v_old_price
  FROM market_price_history
  WHERE resource = p_resource AND recorded_at <= NOW() - INTERVAL '24 hours'
  ORDER BY recorded_at DESC
  LIMIT 1;

  RETURN QUERY
  SELECT 
    (SELECT mph.price FROM market_price_history mph WHERE mph.resource = p_resource ORDER BY mph.recorded_at DESC LIMIT 1) as last_price,
    AVG(mph.price) as avg_price_24h,
    MAX(mph.price) as high_price_24h,
    MIN(mph.price) as low_price_24h,
    SUM(mph.volume) as volume_24h,
    CASE 
      WHEN v_old_price IS NOT NULL AND v_old_price > 0 THEN
        ((SELECT mph2.price FROM market_price_history mph2 WHERE mph2.resource = p_resource ORDER BY mph2.recorded_at DESC LIMIT 1) - v_old_price) / v_old_price * 100
      ELSE 0
    END as price_change_24h
  FROM market_price_history mph
  WHERE mph.resource = p_resource AND mph.recorded_at > NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- ВЬЮХИ
-- =============================================

-- Вьюха для книги ордеров (bids)
CREATE OR REPLACE VIEW order_book_bids AS
SELECT 
  resource,
  price_per_unit as price,
  SUM(quantity - quantity_filled) as total_quantity,
  COUNT(*) as order_count
FROM market_orders
WHERE status = 'open' AND order_type = 'buy'
GROUP BY resource, price_per_unit
ORDER BY resource, price_per_unit DESC;

-- Вьюха для книги ордеров (asks)
CREATE OR REPLACE VIEW order_book_asks AS
SELECT 
  resource,
  price_per_unit as price,
  SUM(quantity - quantity_filled) as total_quantity,
  COUNT(*) as order_count
FROM market_orders
WHERE status = 'open' AND order_type = 'sell'
GROUP BY resource, price_per_unit
ORDER BY resource, price_per_unit ASC;

-- Вьюха для лидерборда трейдеров
CREATE OR REPLACE VIEW trader_leaderboard AS
SELECT 
  t.player_id,
  t.player_name,
  t.rating,
  t.total_trades,
  t.successful_trades,
  t.total_volume,
  t.member_since,
  t.guild_id,
  g.name as guild_name,
  g.tag as guild_tag,
  RANK() OVER (ORDER BY t.total_volume DESC) as volume_rank,
  RANK() OVER (ORDER BY t.total_trades DESC) as trades_rank
FROM traders t
LEFT JOIN guilds g ON t.guild_id = g.id
ORDER BY t.total_volume DESC;

-- Вьюха для статистики гильдий
CREATE OR REPLACE VIEW guild_stats AS
SELECT 
  g.id,
  g.name,
  g.tag,
  g.level,
  g.experience,
  g.treasury,
  g.created_at,
  COUNT(gm.player_id) as member_count,
  g.max_members,
  COALESCE(SUM(t.total_volume), 0) as total_guild_volume,
  COALESCE(AVG(t.rating), 5.0) as avg_rating
FROM guilds g
LEFT JOIN guild_members gm ON g.id = gm.guild_id
LEFT JOIN traders t ON gm.player_id = t.player_id
GROUP BY g.id;
