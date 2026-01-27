/**
 * Модуль глобальной торговой биржи
 * Фаза 1: Мультиплеерная торговля
 */

// Константы
const MARKET_CONSTANTS = {
  BASE_FEE_PERCENT: 2,
  GUILD_FEE_PERCENT: 1.5,
  VIP_FEE_PERCENT: 1,
  VIP_VOLUME_THRESHOLD: 1_000_000,
  MAX_ACTIVE_ORDERS: 100,
  MIN_ORDER_QUANTITY: 10,
  ORDER_COOLDOWN_MS: 60_000,
  DEFAULT_ORDER_DURATION_MS: 24 * 60 * 60 * 1000,
  EXTENDED_ORDER_DURATION_MS: 48 * 60 * 60 * 1000,
  ORDER_BOOK_DEPTH: 20,
};

// Список торгуемых ресурсов
const TRADEABLE_RESOURCES = [
  'ore', 'ice', 'carbon', 'steel',
  'natural_gas', 'oil', 'gasoline', 'plastic', 'glass', 'sand',
  'uranium', 'chrome', 'titanium',
  'copper', 'semiconductors', 'dynamite', 'fiber',
  'integrated_circuit', 'battery', 'engine', 'display', 'computer',
  'liquid_fuel', 'chrome_alloy', 'titanium_alloy', 'enriched_uranium',
  'weapon', 'artillery', 'radar', 'nuclear_bomb',
  'jet_engine', 'satellite', 'rocket', 'spaceship', 'console', 'space_station',
  'robot'
];

/**
 * Инициализация таблиц рынка
 */
export async function initMarketTables(pool) {
  // Таблица гильдий
  await pool.query(`
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
  `);

  // Таблица членов гильдий
  await pool.query(`
    CREATE TABLE IF NOT EXISTS guild_members (
      id SERIAL PRIMARY KEY,
      guild_id UUID NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
      player_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('leader', 'officer', 'member')),
      contribution DECIMAL DEFAULT 0,
      joined_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(guild_id, player_id)
    );
  `);

  // Таблица трейдеров
  await pool.query(`
    CREATE TABLE IF NOT EXISTS traders (
      player_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      player_name VARCHAR(100) NOT NULL,
      rating DECIMAL DEFAULT 5.0 CHECK (rating >= 0 AND rating <= 5),
      total_trades INTEGER DEFAULT 0,
      successful_trades INTEGER DEFAULT 0,
      total_volume DECIMAL DEFAULT 0,
      member_since TIMESTAMPTZ DEFAULT NOW(),
      guild_id UUID REFERENCES guilds(id) ON DELETE SET NULL,
      last_order_time TIMESTAMPTZ
    );
  `);

  // Таблица ордеров
  await pool.query(`
    CREATE TABLE IF NOT EXISTS market_orders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      player_id INTEGER NOT NULL REFERENCES users(id),
      order_type VARCHAR(4) NOT NULL CHECK (order_type IN ('buy', 'sell')),
      resource VARCHAR(50) NOT NULL,
      quantity DECIMAL NOT NULL CHECK (quantity >= 10),
      quantity_filled DECIMAL DEFAULT 0,
      price_per_unit DECIMAL NOT NULL CHECK (price_per_unit > 0),
      status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'filled', 'partial', 'cancelled', 'expired')),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      guild_id UUID REFERENCES guilds(id) ON DELETE SET NULL
    );
  `);

  // Таблица сделок
  await pool.query(`
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
  `);

  // Таблица истории цен
  await pool.query(`
    CREATE TABLE IF NOT EXISTS market_price_history (
      id SERIAL PRIMARY KEY,
      resource VARCHAR(50) NOT NULL,
      price DECIMAL NOT NULL,
      volume DECIMAL NOT NULL,
      recorded_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Создание индексов
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_orders_status ON market_orders(status);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_orders_resource ON market_orders(resource);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_orders_player ON market_orders(player_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_orders_matching ON market_orders(resource, order_type, status, price_per_unit);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_trades_time ON market_trades(executed_at);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_price_history_resource_time ON market_price_history(resource, recorded_at DESC);`);
}

/**
 * Расчёт комиссии
 */
function calculateFeePercent(totalVolume, hasGuild) {
  if (totalVolume >= MARKET_CONSTANTS.VIP_VOLUME_THRESHOLD) {
    return MARKET_CONSTANTS.VIP_FEE_PERCENT;
  }
  if (hasGuild) {
    return MARKET_CONSTANTS.GUILD_FEE_PERCENT;
  }
  return MARKET_CONSTANTS.BASE_FEE_PERCENT;
}

/**
 * Расчёт бейджей трейдера
 */
function calculateTraderBadges(totalTrades, successfulTrades, totalVolume, isGuildLeader) {
  const badges = [];
  
  if (totalTrades < 10) badges.push('newcomer');
  if (totalTrades >= 100) badges.push('active_trader');
  if (totalVolume >= 1_000_000) badges.push('whale');
  if (totalTrades >= 20 && successfulTrades / totalTrades >= 0.95) badges.push('reliable');
  if (isGuildLeader) badges.push('guild_master');
  
  return badges;
}

/**
 * Создание роутов для биржи
 */
export function createMarketRoutes(app, pool, authMiddleware) {
  
  // ==========================================
  // ОРДЕРА
  // ==========================================
  
  /**
   * GET /api/market/orders - Получить активные ордера
   */
  app.get('/api/market/orders', async (req, res) => {
    try {
      const { resource, type, status = 'open', limit = 50, offset = 0 } = req.query;
      
      let query = `
        SELECT 
          o.*,
          u.email as player_name
        FROM market_orders o
        JOIN users u ON o.player_id = u.id
        WHERE 1=1
      `;
      const params = [];
      let paramIndex = 1;
      
      if (resource) {
        query += ` AND o.resource = $${paramIndex++}`;
        params.push(resource);
      }
      if (type) {
        query += ` AND o.order_type = $${paramIndex++}`;
        params.push(type);
      }
      if (status) {
        query += ` AND o.status = $${paramIndex++}`;
        params.push(status);
      }
      
      query += ` ORDER BY o.price_per_unit ${type === 'buy' ? 'DESC' : 'ASC'}, o.created_at ASC`;
      query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
      params.push(parseInt(limit), parseInt(offset));
      
      const result = await pool.query(query, params);
      
      // Получаем общее количество
      let countQuery = 'SELECT COUNT(*) FROM market_orders WHERE 1=1';
      const countParams = [];
      let countParamIndex = 1;
      
      if (resource) {
        countQuery += ` AND resource = $${countParamIndex++}`;
        countParams.push(resource);
      }
      if (type) {
        countQuery += ` AND order_type = $${countParamIndex++}`;
        countParams.push(type);
      }
      if (status) {
        countQuery += ` AND status = $${countParamIndex++}`;
        countParams.push(status);
      }
      
      const countResult = await pool.query(countQuery, countParams);
      
      res.json({
        ok: true,
        orders: result.rows.map(row => ({
          id: row.id,
          playerId: row.player_id.toString(),
          playerName: row.player_name,
          type: row.order_type,
          resource: row.resource,
          quantity: row.quantity.toString(),
          quantityFilled: row.quantity_filled.toString(),
          pricePerUnit: row.price_per_unit.toString(),
          status: row.status,
          createdAt: new Date(row.created_at).getTime(),
          expiresAt: new Date(row.expires_at).getTime(),
          guildId: row.guild_id
        })),
        total: parseInt(countResult.rows[0].count)
      });
    } catch (e) {
      console.error('Error fetching orders:', e);
      res.status(500).json({ ok: false, error: String(e?.message ?? e) });
    }
  });

  /**
   * POST /api/market/orders - Создать новый ордер
   */
  app.post('/api/market/orders', authMiddleware, async (req, res) => {
    const client = await pool.connect();
    
    try {
      const { type, resource, quantity, pricePerUnit } = req.body;
      const playerId = req.userId;
      
      // Валидация
      if (!type || !['buy', 'sell'].includes(type)) {
        res.status(400).json({ ok: false, error: 'INVALID_ORDER_TYPE' });
        return;
      }
      
      if (!resource || !TRADEABLE_RESOURCES.includes(resource)) {
        res.status(400).json({ ok: false, error: 'INVALID_RESOURCE' });
        return;
      }
      
      const qty = parseFloat(quantity);
      if (isNaN(qty) || qty < MARKET_CONSTANTS.MIN_ORDER_QUANTITY) {
        res.status(400).json({ ok: false, error: 'INVALID_QUANTITY' });
        return;
      }
      
      const price = parseFloat(pricePerUnit);
      if (isNaN(price) || price <= 0) {
        res.status(400).json({ ok: false, error: 'INVALID_PRICE' });
        return;
      }
      
      await client.query('BEGIN');
      
      // Проверка лимита активных ордеров
      const activeOrdersResult = await client.query(
        "SELECT COUNT(*) FROM market_orders WHERE player_id = $1 AND status IN ('open', 'partial')",
        [playerId]
      );
      
      if (parseInt(activeOrdersResult.rows[0].count) >= MARKET_CONSTANTS.MAX_ACTIVE_ORDERS) {
        await client.query('ROLLBACK');
        res.status(400).json({ ok: false, error: 'MAX_ORDERS_REACHED' });
        return;
      }
      
      // Проверка cooldown
      const traderResult = await client.query(
        'SELECT last_order_time, guild_id FROM traders WHERE player_id = $1',
        [playerId]
      );
      
      if (traderResult.rows.length > 0 && traderResult.rows[0].last_order_time) {
        const lastOrderTime = new Date(traderResult.rows[0].last_order_time).getTime();
        const now = Date.now();
        
        if (now - lastOrderTime < MARKET_CONSTANTS.ORDER_COOLDOWN_MS) {
          await client.query('ROLLBACK');
          const remainingMs = MARKET_CONSTANTS.ORDER_COOLDOWN_MS - (now - lastOrderTime);
          res.status(400).json({ 
            ok: false, 
            error: 'ORDER_COOLDOWN',
            remainingSeconds: Math.ceil(remainingMs / 1000)
          });
          return;
        }
      }
      
      // Получаем гильдию и проверяем бонусы
      const guildId = traderResult.rows[0]?.guild_id || null;
      let hasExtendedDuration = false;
      
      if (guildId) {
        const guildResult = await client.query(
          'SELECT level FROM guilds WHERE id = $1',
          [guildId]
        );
        if (guildResult.rows.length > 0 && guildResult.rows[0].level >= 7) {
          hasExtendedDuration = true;
        }
      }
      
      const duration = hasExtendedDuration 
        ? MARKET_CONSTANTS.EXTENDED_ORDER_DURATION_MS 
        : MARKET_CONSTANTS.DEFAULT_ORDER_DURATION_MS;
      
      const expiresAt = new Date(Date.now() + duration);
      
      // Создаём ордер
      const orderResult = await client.query(
        `INSERT INTO market_orders 
          (player_id, order_type, resource, quantity, price_per_unit, expires_at, guild_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [playerId, type, resource, qty, price, expiresAt, guildId]
      );
      
      const newOrder = orderResult.rows[0];
      
      // Обновляем время последнего ордера
      await client.query(
        `INSERT INTO traders (player_id, player_name, last_order_time)
         VALUES ($1, (SELECT email FROM users WHERE id = $1), NOW())
         ON CONFLICT (player_id) DO UPDATE SET last_order_time = NOW()`,
        [playerId]
      );
      
      // Пытаемся сопоставить с существующими ордерами
      const executedTrades = await matchOrder(client, newOrder, playerId);
      
      await client.query('COMMIT');
      
      // Получаем обновлённый ордер
      const updatedOrderResult = await pool.query(
        `SELECT o.*, u.email as player_name 
         FROM market_orders o 
         JOIN users u ON o.player_id = u.id 
         WHERE o.id = $1`,
        [newOrder.id]
      );
      
      const updatedOrder = updatedOrderResult.rows[0];
      
      res.json({
        ok: true,
        order: {
          id: updatedOrder.id,
          playerId: updatedOrder.player_id.toString(),
          playerName: updatedOrder.player_name,
          type: updatedOrder.order_type,
          resource: updatedOrder.resource,
          quantity: updatedOrder.quantity.toString(),
          quantityFilled: updatedOrder.quantity_filled.toString(),
          pricePerUnit: updatedOrder.price_per_unit.toString(),
          status: updatedOrder.status,
          createdAt: new Date(updatedOrder.created_at).getTime(),
          expiresAt: new Date(updatedOrder.expires_at).getTime(),
          guildId: updatedOrder.guild_id
        },
        executedTrades
      });
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('Error creating order:', e);
      res.status(500).json({ ok: false, error: String(e?.message ?? e) });
    } finally {
      client.release();
    }
  });

  /**
   * DELETE /api/market/orders/:id - Отменить свой ордер
   */
  app.delete('/api/market/orders/:id', authMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const playerId = req.userId;
      
      const result = await pool.query(
        `UPDATE market_orders 
         SET status = 'cancelled' 
         WHERE id = $1 AND player_id = $2 AND status IN ('open', 'partial')
         RETURNING *`,
        [id, playerId]
      );
      
      if (result.rowCount === 0) {
        res.status(404).json({ ok: false, error: 'ORDER_NOT_FOUND' });
        return;
      }
      
      res.json({ ok: true, order: result.rows[0] });
    } catch (e) {
      console.error('Error cancelling order:', e);
      res.status(500).json({ ok: false, error: String(e?.message ?? e) });
    }
  });

  /**
   * GET /api/market/my-orders - Мои ордера
   */
  app.get('/api/market/my-orders', authMiddleware, async (req, res) => {
    try {
      const playerId = req.userId;
      const { status } = req.query;
      
      let query = `
        SELECT o.*, u.email as player_name
        FROM market_orders o
        JOIN users u ON o.player_id = u.id
        WHERE o.player_id = $1
      `;
      const params = [playerId];
      
      if (status) {
        query += ' AND o.status = $2';
        params.push(status);
      }
      
      query += ' ORDER BY o.created_at DESC';
      
      const result = await pool.query(query, params);
      
      res.json({
        ok: true,
        orders: result.rows.map(row => ({
          id: row.id,
          playerId: row.player_id.toString(),
          playerName: row.player_name,
          type: row.order_type,
          resource: row.resource,
          quantity: row.quantity.toString(),
          quantityFilled: row.quantity_filled.toString(),
          pricePerUnit: row.price_per_unit.toString(),
          status: row.status,
          createdAt: new Date(row.created_at).getTime(),
          expiresAt: new Date(row.expires_at).getTime(),
          guildId: row.guild_id
        }))
      });
    } catch (e) {
      console.error('Error fetching my orders:', e);
      res.status(500).json({ ok: false, error: String(e?.message ?? e) });
    }
  });

  // ==========================================
  // ИСТОРИЯ СДЕЛОК
  // ==========================================

  /**
   * GET /api/market/history - История своих сделок
   */
  app.get('/api/market/history', authMiddleware, async (req, res) => {
    try {
      const playerId = req.userId;
      const { limit = 50, offset = 0 } = req.query;
      
      const result = await pool.query(
        `SELECT * FROM market_trades 
         WHERE buyer_id = $1 OR seller_id = $1
         ORDER BY executed_at DESC
         LIMIT $2 OFFSET $3`,
        [playerId, parseInt(limit), parseInt(offset)]
      );
      
      const countResult = await pool.query(
        'SELECT COUNT(*) FROM market_trades WHERE buyer_id = $1 OR seller_id = $1',
        [playerId]
      );
      
      res.json({
        ok: true,
        trades: result.rows.map(row => ({
          id: row.id,
          buyOrderId: row.buy_order_id,
          sellOrderId: row.sell_order_id,
          buyerId: row.buyer_id.toString(),
          sellerId: row.seller_id.toString(),
          resource: row.resource,
          quantity: row.quantity.toString(),
          pricePerUnit: row.price_per_unit.toString(),
          totalAmount: row.total_amount.toString(),
          fee: row.fee.toString(),
          executedAt: new Date(row.executed_at).getTime()
        })),
        total: parseInt(countResult.rows[0].count)
      });
    } catch (e) {
      console.error('Error fetching trade history:', e);
      res.status(500).json({ ok: false, error: String(e?.message ?? e) });
    }
  });

  // ==========================================
  // РЫНОЧНЫЕ ЦЕНЫ
  // ==========================================

  /**
   * GET /api/market/prices - Текущие рыночные цены
   */
  app.get('/api/market/prices', async (req, res) => {
    try {
      const prices = [];
      
      for (const resource of TRADEABLE_RESOURCES) {
        const priceResult = await pool.query(`
          SELECT 
            (SELECT price FROM market_price_history WHERE resource = $1 ORDER BY recorded_at DESC LIMIT 1) as last_price,
            AVG(price) as avg_price,
            MAX(price) as high_price,
            MIN(price) as low_price,
            COALESCE(SUM(volume), 0) as total_volume
          FROM market_price_history
          WHERE resource = $1 AND recorded_at > NOW() - INTERVAL '24 hours'
        `, [resource]);
        
        const row = priceResult.rows[0];
        
        // Получаем цену 24ч назад для расчёта изменения
        const oldPriceResult = await pool.query(`
          SELECT price FROM market_price_history
          WHERE resource = $1 AND recorded_at <= NOW() - INTERVAL '24 hours'
          ORDER BY recorded_at DESC
          LIMIT 1
        `, [resource]);
        
        const lastPrice = parseFloat(row.last_price) || 0;
        const oldPrice = parseFloat(oldPriceResult.rows[0]?.price) || lastPrice;
        const priceChange = oldPrice > 0 ? ((lastPrice - oldPrice) / oldPrice) * 100 : 0;
        
        prices.push({
          resource,
          lastPrice: (row.last_price || '0').toString(),
          avgPrice24h: (row.avg_price || '0').toString(),
          highPrice24h: (row.high_price || '0').toString(),
          lowPrice24h: (row.low_price || '0').toString(),
          volume24h: (row.total_volume || '0').toString(),
          priceChange24h: priceChange
        });
      }
      
      res.json({ ok: true, prices });
    } catch (e) {
      console.error('Error fetching market prices:', e);
      res.status(500).json({ ok: false, error: String(e?.message ?? e) });
    }
  });

  // ==========================================
  // КНИГА ОРДЕРОВ
  // ==========================================

  /**
   * GET /api/market/orderbook/:resource - Книга ордеров для ресурса
   */
  app.get('/api/market/orderbook/:resource', async (req, res) => {
    try {
      const { resource } = req.params;
      
      if (!TRADEABLE_RESOURCES.includes(resource)) {
        res.status(400).json({ ok: false, error: 'INVALID_RESOURCE' });
        return;
      }
      
      // Получаем bids (покупка)
      const bidsResult = await pool.query(`
        SELECT 
          price_per_unit as price,
          SUM(quantity - quantity_filled) as total_quantity,
          COUNT(*) as order_count
        FROM market_orders
        WHERE resource = $1 AND status = 'open' AND order_type = 'buy'
        GROUP BY price_per_unit
        ORDER BY price_per_unit DESC
        LIMIT $2
      `, [resource, MARKET_CONSTANTS.ORDER_BOOK_DEPTH]);
      
      // Получаем asks (продажа)
      const asksResult = await pool.query(`
        SELECT 
          price_per_unit as price,
          SUM(quantity - quantity_filled) as total_quantity,
          COUNT(*) as order_count
        FROM market_orders
        WHERE resource = $1 AND status = 'open' AND order_type = 'sell'
        GROUP BY price_per_unit
        ORDER BY price_per_unit ASC
        LIMIT $2
      `, [resource, MARKET_CONSTANTS.ORDER_BOOK_DEPTH]);
      
      const bids = bidsResult.rows.map(r => ({
        price: r.price.toString(),
        quantity: r.total_quantity.toString(),
        orderCount: parseInt(r.order_count)
      }));
      
      const asks = asksResult.rows.map(r => ({
        price: r.price.toString(),
        quantity: r.total_quantity.toString(),
        orderCount: parseInt(r.order_count)
      }));
      
      // Расчёт спреда
      const bestBid = bids.length > 0 ? parseFloat(bids[0].price) : 0;
      const bestAsk = asks.length > 0 ? parseFloat(asks[0].price) : 0;
      const spread = bestAsk > 0 && bestBid > 0 ? bestAsk - bestBid : 0;
      
      res.json({
        ok: true,
        orderBook: {
          resource,
          bids,
          asks,
          spread: spread.toString()
        }
      });
    } catch (e) {
      console.error('Error fetching order book:', e);
      res.status(500).json({ ok: false, error: String(e?.message ?? e) });
    }
  });

  // ==========================================
  // ТРЕЙДЕРЫ
  // ==========================================

  /**
   * GET /api/traders/:id - Профиль трейдера
   */
  app.get('/api/traders/:id', async (req, res) => {
    try {
      const { id } = req.params;
      
      const result = await pool.query(`
        SELECT 
          t.*,
          g.leader_id
        FROM traders t
        LEFT JOIN guilds g ON t.guild_id = g.id
        WHERE t.player_id = $1
      `, [id]);
      
      if (result.rowCount === 0) {
        res.status(404).json({ ok: false, error: 'TRADER_NOT_FOUND' });
        return;
      }
      
      const row = result.rows[0];
      const isGuildLeader = row.leader_id && row.leader_id === parseInt(id);
      
      const badges = calculateTraderBadges(
        row.total_trades,
        row.successful_trades,
        parseFloat(row.total_volume),
        isGuildLeader
      );
      
      res.json({
        ok: true,
        trader: {
          playerId: row.player_id.toString(),
          playerName: row.player_name,
          rating: parseFloat(row.rating),
          totalTrades: row.total_trades,
          successfulTrades: row.successful_trades,
          totalVolume: row.total_volume.toString(),
          memberSince: new Date(row.member_since).getTime(),
          guildId: row.guild_id,
          badges
        }
      });
    } catch (e) {
      console.error('Error fetching trader:', e);
      res.status(500).json({ ok: false, error: String(e?.message ?? e) });
    }
  });

  /**
   * GET /api/traders/leaderboard - Топ трейдеров
   */
  app.get('/api/traders/leaderboard', async (req, res) => {
    try {
      const { limit = 50, offset = 0, sortBy = 'volume' } = req.query;
      
      const orderColumn = sortBy === 'trades' ? 'total_trades' : 'total_volume';
      
      const result = await pool.query(`
        SELECT 
          t.*,
          g.leader_id,
          g.name as guild_name,
          g.tag as guild_tag
        FROM traders t
        LEFT JOIN guilds g ON t.guild_id = g.id
        ORDER BY t.${orderColumn} DESC
        LIMIT $1 OFFSET $2
      `, [parseInt(limit), parseInt(offset)]);
      
      const countResult = await pool.query('SELECT COUNT(*) FROM traders');
      
      const traders = result.rows.map(row => {
        const isGuildLeader = row.leader_id && row.leader_id === row.player_id;
        const badges = calculateTraderBadges(
          row.total_trades,
          row.successful_trades,
          parseFloat(row.total_volume),
          isGuildLeader
        );
        
        return {
          playerId: row.player_id.toString(),
          playerName: row.player_name,
          rating: parseFloat(row.rating),
          totalTrades: row.total_trades,
          successfulTrades: row.successful_trades,
          totalVolume: row.total_volume.toString(),
          memberSince: new Date(row.member_since).getTime(),
          guildId: row.guild_id,
          guildName: row.guild_name,
          guildTag: row.guild_tag,
          badges
        };
      });
      
      res.json({
        ok: true,
        traders,
        total: parseInt(countResult.rows[0].count)
      });
    } catch (e) {
      console.error('Error fetching leaderboard:', e);
      res.status(500).json({ ok: false, error: String(e?.message ?? e) });
    }
  });

  // ==========================================
  // СЛУЖЕБНЫЕ
  // ==========================================

  /**
   * POST /api/market/expire-orders - Истечение старых ордеров (для cron)
   */
  app.post('/api/market/expire-orders', async (req, res) => {
    try {
      const result = await pool.query(`
        UPDATE market_orders 
        SET status = 'expired' 
        WHERE status = 'open' AND expires_at < NOW()
        RETURNING id
      `);
      
      res.json({ ok: true, expiredCount: result.rowCount });
    } catch (e) {
      console.error('Error expiring orders:', e);
      res.status(500).json({ ok: false, error: String(e?.message ?? e) });
    }
  });
}

/**
 * Matching Engine - сопоставление ордеров
 */
async function matchOrder(client, newOrder, playerId) {
  const executedTrades = [];
  
  // Определяем противоположный тип ордера и направление сортировки
  const oppositeType = newOrder.order_type === 'buy' ? 'sell' : 'buy';
  const priceComparison = newOrder.order_type === 'buy' ? '<=' : '>=';
  const priceOrder = newOrder.order_type === 'buy' ? 'ASC' : 'DESC';
  
  // Находим подходящие ордера (Price-Time Priority)
  const matchingOrdersResult = await client.query(`
    SELECT * FROM market_orders
    WHERE resource = $1 
      AND order_type = $2 
      AND status IN ('open', 'partial')
      AND price_per_unit ${priceComparison} $3
      AND player_id != $4
    ORDER BY price_per_unit ${priceOrder}, created_at ASC
  `, [newOrder.resource, oppositeType, newOrder.price_per_unit, playerId]);
  
  let remainingQuantity = parseFloat(newOrder.quantity) - parseFloat(newOrder.quantity_filled);
  
  for (const matchingOrder of matchingOrdersResult.rows) {
    if (remainingQuantity <= 0) break;
    
    const availableQuantity = parseFloat(matchingOrder.quantity) - parseFloat(matchingOrder.quantity_filled);
    const tradeQuantity = Math.min(remainingQuantity, availableQuantity);
    const tradePrice = parseFloat(matchingOrder.price_per_unit); // Используем цену существующего ордера
    const totalAmount = tradeQuantity * tradePrice;
    
    // Получаем информацию о трейдерах для расчёта комиссии
    const [buyerInfo, sellerInfo] = await Promise.all([
      client.query('SELECT total_volume, guild_id FROM traders WHERE player_id = $1', 
        [newOrder.order_type === 'buy' ? playerId : matchingOrder.player_id]),
      client.query('SELECT total_volume, guild_id FROM traders WHERE player_id = $1', 
        [newOrder.order_type === 'sell' ? playerId : matchingOrder.player_id])
    ]);
    
    const buyerVolume = parseFloat(buyerInfo.rows[0]?.total_volume || 0);
    const sellerVolume = parseFloat(sellerInfo.rows[0]?.total_volume || 0);
    const buyerHasGuild = !!buyerInfo.rows[0]?.guild_id;
    const sellerHasGuild = !!sellerInfo.rows[0]?.guild_id;
    
    // Комиссия берётся с обеих сторон
    const buyerFeePercent = calculateFeePercent(buyerVolume, buyerHasGuild);
    const sellerFeePercent = calculateFeePercent(sellerVolume, sellerHasGuild);
    const totalFee = totalAmount * (buyerFeePercent + sellerFeePercent) / 100;
    
    const buyerId = newOrder.order_type === 'buy' ? playerId : matchingOrder.player_id;
    const sellerId = newOrder.order_type === 'sell' ? playerId : matchingOrder.player_id;
    const buyOrderId = newOrder.order_type === 'buy' ? newOrder.id : matchingOrder.id;
    const sellOrderId = newOrder.order_type === 'sell' ? newOrder.id : matchingOrder.id;
    
    // Записываем сделку
    const tradeResult = await client.query(`
      INSERT INTO market_trades 
        (buy_order_id, sell_order_id, buyer_id, seller_id, resource, quantity, price_per_unit, total_amount, fee)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [buyOrderId, sellOrderId, buyerId, sellerId, newOrder.resource, tradeQuantity, tradePrice, totalAmount, totalFee]);
    
    executedTrades.push({
      id: tradeResult.rows[0].id,
      buyOrderId,
      sellOrderId,
      buyerId: buyerId.toString(),
      sellerId: sellerId.toString(),
      resource: newOrder.resource,
      quantity: tradeQuantity.toString(),
      pricePerUnit: tradePrice.toString(),
      totalAmount: totalAmount.toString(),
      fee: totalFee.toString(),
      executedAt: new Date(tradeResult.rows[0].executed_at).getTime()
    });
    
    // Обновляем matching order
    const newMatchingFilled = parseFloat(matchingOrder.quantity_filled) + tradeQuantity;
    const matchingStatus = newMatchingFilled >= parseFloat(matchingOrder.quantity) ? 'filled' : 'partial';
    
    await client.query(`
      UPDATE market_orders 
      SET quantity_filled = $1, status = $2 
      WHERE id = $3
    `, [newMatchingFilled, matchingStatus, matchingOrder.id]);
    
    // Обновляем новый ордер
    const newOrderFilled = parseFloat(newOrder.quantity_filled) + tradeQuantity;
    const newOrderStatus = newOrderFilled >= parseFloat(newOrder.quantity) ? 'filled' : 'partial';
    
    await client.query(`
      UPDATE market_orders 
      SET quantity_filled = $1, status = $2 
      WHERE id = $3
    `, [newOrderFilled, newOrderStatus, newOrder.id]);
    
    // Обновляем статистику трейдеров
    await Promise.all([
      client.query(`
        INSERT INTO traders (player_id, player_name, total_trades, successful_trades, total_volume)
        VALUES ($1, (SELECT email FROM users WHERE id = $1), 1, 1, $2)
        ON CONFLICT (player_id) DO UPDATE SET
          total_trades = traders.total_trades + 1,
          successful_trades = traders.successful_trades + 1,
          total_volume = traders.total_volume + $2
      `, [buyerId, totalAmount]),
      client.query(`
        INSERT INTO traders (player_id, player_name, total_trades, successful_trades, total_volume)
        VALUES ($1, (SELECT email FROM users WHERE id = $1), 1, 1, $2)
        ON CONFLICT (player_id) DO UPDATE SET
          total_trades = traders.total_trades + 1,
          successful_trades = traders.successful_trades + 1,
          total_volume = traders.total_volume + $2
      `, [sellerId, totalAmount])
    ]);
    
    // Записываем историю цен
    await client.query(`
      INSERT INTO market_price_history (resource, price, volume)
      VALUES ($1, $2, $3)
    `, [newOrder.resource, tradePrice, tradeQuantity]);
    
    remainingQuantity -= tradeQuantity;
    newOrder.quantity_filled = newOrderFilled;
  }
  
  return executedTrades;
}

export { MARKET_CONSTANTS, TRADEABLE_RESOURCES };
