/**
 * Модуль глобальной торговой биржи
 * Фаза 1: Мультиплеерная торговля
 */

import { RESOURCE_UNIVERSE, RESOURCE_REFERENCE_PRICES } from './market-sim/universe.js';
import { describeError } from './error-detail.js';
import { realtimeHub } from './realtime.js';
import {
  VAULT_CREDITS,
  initVaultTables,
  createVaultRoutes,
  expireDirectOffers,
  beginTx,
  acquireMarketLock,
  isBusyError,
  isUnavailableError,
  invariantCode,
  lockVaultRows,
  vaultBalance,
  vaultLock,
  vaultUnlock,
  vaultCredit,
  vaultDebit,
  vaultSpendLocked,
  toUnits,
  fromUnits,
  dbUnits,
  mulUnits,
  feeUnits,
  readPositiveAmount,
  isTradeableResource,
  isUuid,
} from './market-vault.js';

/**
 * МОДЕЛЬ КОМИССИИ (была несогласованной, теперь сходится до последнего знака)
 * =========================================================================
 * Что было: market_trades.fee = buyerFee + sellerFee, но покупателю в pending-строку
 * писали credits_amount = totalAmount (комиссия НЕ бралась вообще), а продавцу
 * totalAmount - sellerFee. То есть в базе лежала комиссия, половину которой никто
 * никогда не платил, а вторая половина уничтожалась молча. Ответить на вопрос
 * «сколько кредитов создала/уничтожила биржа» было невозможно.
 *
 * Что теперь:
 *   - ПЛАТЯТ ОБА. Покупатель списывает gross + buyerFee, продавец получает
 *     gross - sellerFee. gross = quantity * цена стоящего в книге ордера.
 *   - Процент фиксируется В ОРДЕРЕ на момент постановки (market_orders.fee_percent).
 *     Иначе смена лестницы (вступил/вышел из гильдии, перешёл порог VIP) между
 *     постановкой и исполнением делала бы зарезервированную комиссию неверной, и
 *     эскроу мог не покрыть сделку.
 *   - Комиссия СЖИГАЕТСЯ (sink), а не идёт на «счёт дома»: в игре нет
 *     пользователя-биржи, а idle-экономике нужен слив кредитов. Журнал это
 *     доказывает: сумма всех delta по '__credits__' = внесено - выведено - комиссии,
 *     а сумма строк reason='trade_fee' по сделке в точности равна market_trades.fee
 *     (плюс отдельные колонки buyer_fee/seller_fee для разбора).
 *   - Резерв комиссии считается округлением ВВЕРХ до 6 знаков, фактическая — ВНИЗ,
 *     поэтому по цепочке частичных исполнений эскроу никогда не окажется мал.
 *   - Улучшение цены (покупатель встал по 12, исполнился по 10) возвращается
 *     покупателю строкой reason='escrow_price_improvement'.
 */

// Константы
const MARKET_CONSTANTS = {
  BASE_FEE_PERCENT: 2,
  GUILD_FEE_PERCENT: 1.5,
  VIP_FEE_PERCENT: 1,
  VIP_VOLUME_THRESHOLD: 1_000_000,
  MAX_ACTIVE_ORDERS: 100,
  MIN_ORDER_QUANTITY: 10,
  /*
   * Было 60_000 при MAX_ACTIVE_ORDERS=100: чтобы дойти до лимита, игроку нужно было
   * ЖАТЬ КНОПКУ 100 МИНУТ, а сама биржа при этом «однорукая» — один ордер в минуту.
   * Кулдаун здесь нужен только против спама и двойных отправок формы, поэтому он
   * короткий; жёсткий потолок держит MAX_ACTIVE_ORDERS. Значение выносится в env,
   * чтобы нагрузочные и приёмочные прогоны не ждали минуту на каждый ордер.
   */
  ORDER_COOLDOWN_MS: Math.max(0, Number(process.env.MARKET_ORDER_COOLDOWN_MS ?? 2000)),
  DEFAULT_ORDER_DURATION_MS: 24 * 60 * 60 * 1000,
  EXTENDED_ORDER_DURATION_MS: 48 * 60 * 60 * 1000,
  ORDER_BOOK_DEPTH: 20,
  /** Больше исполнений за одну постановку — уже патология: остаток остаётся в книге. */
  MAX_FILLS_PER_ORDER: 100,
  /** Период служебной зачистки (истечение ордеров/предложений, возврат эскроу). */
  MAINTENANCE_INTERVAL_MS: Math.max(5_000, Number(process.env.MARKET_MAINTENANCE_MS ?? 60_000)),
};

/**
 * Список торгуемых ресурсов — ЕДИНЫЙ ИСТОЧНИК ПРАВДЫ на сервере.
 *
 * Раньше здесь лежала своя копия из 37 id, а клиент (OrderForm.tsx) предлагал 52 —
 * 15 ресурсов нельзя было выставить на биржу. Теперь список один:
 * server/market-sim/universe.js -> RESOURCE_UNIVERSE (52 id, все сверены с
 * ResourceType/TradeResourceType в src/core/gameTypes.ts).
 */
const TRADEABLE_RESOURCES = RESOURCE_UNIVERSE;

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

  // Флаг синтетических записей: реальные сделки игроков должны считаться отдельно
  // от любых сгенерированных котировок (иначе volume24h/avgPrice24h врут).
  await pool.query(
    `ALTER TABLE market_price_history ADD COLUMN IF NOT EXISTS synthetic BOOLEAN NOT NULL DEFAULT FALSE;`
  );

  /*
   * Эти три таблицы использовались кодом, но не создавались НИ ОДНОЙ функцией инициализации —
   * они существовали только в server/migration_market.sql и migration_market_transactions.sql,
   * которые применяются руками и на практике не применялись. На чистой БД это означало:
   *   - market_pending_transactions: любая сделка на бирже падала с
   *     'relation "market_pending_transactions" does not exist' уже ПОСЛЕ записи в market_trades,
   *     то есть сделка фиксировалась, а расчёт по ней — нет;
   *   - guild_chat: GET/POST /api/guilds/:id/chat отдавали 500;
   *   - guild_applications: заявки на вступление не работали.
   * Теперь схема живёт в коде, рядом с остальными CREATE TABLE IF NOT EXISTS.
   */

  // Ожидающие расчёты по сделкам (переносят ресурсы/кредиты участникам).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS market_pending_transactions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      trade_id UUID NOT NULL REFERENCES market_trades(id) ON DELETE CASCADE,
      player_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      transaction_type VARCHAR(4) NOT NULL CHECK (transaction_type IN ('buy', 'sell')),
      resource VARCHAR(50) NOT NULL,
      resource_amount DECIMAL NOT NULL,
      credits_amount DECIMAL NOT NULL,
      fee_amount DECIMAL NOT NULL DEFAULT 0,
      status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'failed')),
      error_message TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      applied_at TIMESTAMPTZ,
      UNIQUE(trade_id, player_id)
    );
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_pending_transactions_player_status
      ON market_pending_transactions(player_id, status) WHERE status = 'pending';
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_pending_transactions_created
      ON market_pending_transactions(created_at);
  `);

  // Чат гильдии.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS guild_chat (
      id SERIAL PRIMARY KEY,
      guild_id UUID NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
      player_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      player_name VARCHAR(100) NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_guild_chat_guild ON guild_chat(guild_id);`);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_guild_chat_guild_time ON guild_chat(guild_id, created_at DESC);`
  );

  // Заявки на вступление в гильдию.
  await pool.query(`
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
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_guild_applications_guild
      ON guild_applications(guild_id) WHERE status = 'pending';
  `);

  // ==========================================================================
  // БИРЖЕВОЙ СЕЙФ (эскроу)
  // ==========================================================================

  // Таблицы сейфа/журнала/выводов/прямых предложений. Инициализируются здесь,
  // чтобы порядок был гарантирован: сейф существует раньше, чем появятся роуты
  // и первое сведение ордеров.
  await initVaultTables(pool);

  /*
   * Эскроу-поля ордера.
   *   fee_percent      — процент комиссии, ЗАФИКСИРОВАННЫЙ при постановке;
   *   escrow_resource  — сколько ресурса ещё заблокировано под этот ордер (sell);
   *   escrow_credits   — сколько кредитов ещё заблокировано под этот ордер (buy);
   *   escrow_backed    — ордер создан уже в эпоху сейфа.
   * escrow_* — это не «сколько было», а «сколько ОСТАЛОСЬ»: по каждому исполнению
   * значение уменьшается, а при закрытии ордера остаток возвращается в available.
   * Поэтому возврат идемпотентен, и служебная зачистка может подобрать эскроу
   * ордера, закрытого любым посторонним путём (например админским cancel-all).
   */
  await pool.query(`
    ALTER TABLE market_orders
      ADD COLUMN IF NOT EXISTS fee_percent NUMERIC NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS escrow_resource NUMERIC NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS escrow_credits NUMERIC NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS escrow_backed BOOLEAN NOT NULL DEFAULT FALSE;
  `);
  await pool.query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'market_orders_escrow_nonneg') THEN
        ALTER TABLE market_orders ADD CONSTRAINT market_orders_escrow_nonneg
          CHECK (escrow_resource >= 0 AND escrow_credits >= 0);
      END IF;
    END $$;
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_orders_escrow_leftovers
       ON market_orders(status) WHERE escrow_resource > 0 OR escrow_credits > 0;`
  );

  // Разбор комиссии по сторонам: market_trades.fee = buyer_fee + seller_fee,
  // и каждая половина совпадает со своей строкой journal reason='trade_fee'.
  await pool.query(`
    ALTER TABLE market_trades
      ADD COLUMN IF NOT EXISTS buyer_fee NUMERIC NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS seller_fee NUMERIC NOT NULL DEFAULT 0;
  `);

  /*
   * ОБРАТНАЯ СОВМЕСТИМОСТЬ с клиентским расчётом (src/hooks/useMarketTransactions.ts).
   *
   * settlement='client' — старая модель: расчёт делает клиент, применяя pending-строку
   *   к своему состоянию (именно такие строки лежат в БД до этого изменения).
   * settlement='vault'  — новая модель: сделка УЖЕ рассчитана в сейфе на сервере.
   *   Такие строки создаются сразу status='applied', поэтому
   *   GET /api/market/pending-transactions их не отдаёт, и старый клиент физически
   *   не может начислить сделку второй раз. Товар из сейфа забирают через
   *   POST /api/market/vault/withdraw, а не через apply-transactions.
   */
  await pool.query(`
    ALTER TABLE market_pending_transactions
      ADD COLUMN IF NOT EXISTS settlement VARCHAR(10) NOT NULL DEFAULT 'client';
  `);
  await pool.query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'market_pending_settlement_kind') THEN
        ALTER TABLE market_pending_transactions ADD CONSTRAINT market_pending_settlement_kind
          CHECK (settlement IN ('client', 'vault'));
      END IF;
    END $$;
  `);

  /*
   * История сделок не должна осиротеть: было ON DELETE SET NULL, то есть удаление
   * ордера обнуляло ссылку в market_trades и сделку было не с чем сопоставить.
   * Админский wipe игрока удаляет market_trades ДО market_orders, поэтому RESTRICT
   * его не ломает (все сделки по ордеру игрока всегда принадлежат этому игроку).
   */
  await pool.query(`
    DO $$
    DECLARE c RECORD;
    BEGIN
      FOR c IN
        SELECT con.conname, att.attname
          FROM pg_constraint con
          JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
         WHERE con.conrelid = 'market_trades'::regclass
           AND con.contype = 'f'
           AND con.confdeltype = 'n'
           AND att.attname IN ('buy_order_id', 'sell_order_id')
      LOOP
        EXECUTE format('ALTER TABLE market_trades DROP CONSTRAINT %I', c.conname);
        EXECUTE format(
          'ALTER TABLE market_trades ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES market_orders(id) ON DELETE RESTRICT',
          c.conname, c.attname
        );
      END LOOP;
    END $$;
  `);

  /*
   * ОДНОРАЗОВАЯ МИГРАЦИЯ. Ордера, выставленные до сейфа, ничем не обеспечены:
   * исполнять их — значит выдать покупателю ресурс, которого у продавца в сейфе нет.
   * Возвращать тоже нечего (эскроу никогда не списывался), поэтому они снимаются.
   * На чистой БД это no-op; повторный запуск тоже no-op (новые ордера escrow_backed).
   */
  const legacy = await pool.query(
    `UPDATE market_orders SET status = 'cancelled'
      WHERE status IN ('open', 'partial') AND escrow_backed = FALSE
      RETURNING id`
  );
  if (legacy.rowCount > 0) {
    console.log(
      `[market] снято ${legacy.rowCount} ордеров без эскроу (созданы до биржевого сейфа)`
    );
  }
}

/**
 * Публичное имя игрока: только локальная часть адреса.
 *
 * traders.player_name исторически заполняется значением users.email (в том числе
 * из server/guilds.js, который править нельзя), а GET /api/traders/leaderboard и
 * GET /api/traders/:id НЕ требуют авторизации. Поэтому маскируем НА ЧТЕНИИ —
 * тогда легаси-строки и строки, записанные посторонними модулями, тоже прикрыты.
 * Клиентский displayPlayerName() обрезает по '@' сам, так что уже обрезанное имя
 * проходит через него без изменений.
 */
function publicPlayerName(name) {
  if (typeof name !== 'string' || name.length === 0) return null;
  const at = name.indexOf('@');
  return at > 0 ? name.slice(0, at) : name;
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
          -- PII: наружу уходит только локальная часть адреса, обрезанная в SQL.
          -- Маршрут НЕАВТОРИЗОВАННЫЙ, а раньше отдавал полные email всех, кто
          -- когда-либо выставлял ордер.
          split_part(u.email, '@', 1) as player_name
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
   *
   * ЭСКРОУ ПРИ ПОСТАНОВКЕ. Раньше этот маршрут возвращал 200 на «продам 100 руды»
   * от свежего аккаунта с нулём руды — кредиты печатались из ничего. Теперь ордер
   * существует только вместе со своим обеспечением в сейфе:
   *   sell: quantity            ресурса  available -> locked
   *   buy:  quantity*цена + резерв комиссии в кредитах available -> locked
   * Всё это внутри ОДНОЙ транзакции с созданием ордера и сведением, поэтому
   * «ордер есть, а обеспечения нет» — состояние, недостижимое даже при падении.
   */
  app.post('/api/market/orders', authMiddleware, async (req, res) => {
    const { type, resource, quantity, pricePerUnit } = req.body ?? {};
    const playerId = req.userId;

    // --- Валидация до открытия транзакции -----------------------------------
    if (!type || !['buy', 'sell'].includes(type)) {
      res.status(400).json({ ok: false, error: 'INVALID_ORDER_TYPE', message: 'Тип ордера должен быть buy или sell.' });
      return;
    }
    if (!isTradeableResource(resource) || !TRADEABLE_RESOURCES.includes(resource)) {
      res.status(400).json({ ok: false, error: 'INVALID_RESOURCE', message: 'Этот ресурс не торгуется на бирже.' });
      return;
    }
    const qtyU = readPositiveAmount(quantity);
    const minQtyU = toUnits(String(MARKET_CONSTANTS.MIN_ORDER_QUANTITY), 6);
    if (qtyU === null || qtyU < minQtyU) {
      res.status(400).json({
        ok: false,
        error: 'INVALID_QUANTITY',
        message: `Минимальный объём ордера — ${MARKET_CONSTANTS.MIN_ORDER_QUANTITY} единиц, не более 6 знаков после запятой.`,
      });
      return;
    }
    const priceU = readPositiveAmount(pricePerUnit);
    if (priceU === null) {
      res.status(400).json({ ok: false, error: 'INVALID_PRICE', message: 'Некорректная цена (до 6 знаков после запятой).' });
      return;
    }

    // beginTx() ВНУТРИ try: получение соединения из пула тоже может упасть
    // ('timeout exceeded when trying to connect'). Раньше эта ошибка улетала
    // мимо обработчика в дефолтный error handler Express и отдавалась HTML-ом
    // со стеком и абсолютными путями — клиент не мог ни распарсить JSON, ни
    // показать русское сообщение.
    let client = null;

    try {
      client = await beginTx(pool);

      // Advisory-лок биржи берётся ПЕРВЫМ, до любых row-локов: только так
      // сведение ордеров и приём предложений не могут закольцеваться с локами
      // строк сейфа (подробнее — в шапке server/market-vault.js).
      await acquireMarketLock(client);

      // Проверка лимита активных ордеров
      const activeOrdersResult = await client.query(
        "SELECT COUNT(*)::int AS n FROM market_orders WHERE player_id = $1 AND status IN ('open', 'partial')",
        [playerId]
      );
      if (activeOrdersResult.rows[0].n >= MARKET_CONSTANTS.MAX_ACTIVE_ORDERS) {
        await rollbackQuietly(client);
        res.status(400).json({
          ok: false,
          error: 'MAX_ORDERS_REACHED',
          message: `Нельзя держать больше ${MARKET_CONSTANTS.MAX_ACTIVE_ORDERS} активных ордеров.`,
        });
        return;
      }

      // Проверка cooldown
      const traderResult = await client.query(
        'SELECT last_order_time, guild_id, total_volume::text AS total_volume FROM traders WHERE player_id = $1',
        [playerId]
      );

      if (MARKET_CONSTANTS.ORDER_COOLDOWN_MS > 0 && traderResult.rows[0]?.last_order_time) {
        const lastOrderTime = new Date(traderResult.rows[0].last_order_time).getTime();
        const now = Date.now();
        if (now - lastOrderTime < MARKET_CONSTANTS.ORDER_COOLDOWN_MS) {
          await rollbackQuietly(client);
          const remainingMs = MARKET_CONSTANTS.ORDER_COOLDOWN_MS - (now - lastOrderTime);
          res.status(400).json({
            ok: false,
            error: 'ORDER_COOLDOWN',
            message: 'Слишком часто. Подождите пару секунд перед следующим ордером.',
            remainingSeconds: Math.ceil(remainingMs / 1000),
          });
          return;
        }
      }

      // Получаем гильдию и проверяем бонусы
      const guildId = traderResult.rows[0]?.guild_id || null;
      let hasExtendedDuration = false;

      if (guildId) {
        const guildResult = await client.query('SELECT level FROM guilds WHERE id = $1', [guildId]);
        if (guildResult.rows.length > 0 && guildResult.rows[0].level >= 7) {
          hasExtendedDuration = true;
        }
      }

      const duration = hasExtendedDuration
        ? MARKET_CONSTANTS.EXTENDED_ORDER_DURATION_MS
        : MARKET_CONSTANTS.DEFAULT_ORDER_DURATION_MS;

      const expiresAt = new Date(Date.now() + duration);

      // --- Расчёт эскроу ----------------------------------------------------
      // Процент комиссии фиксируется в ордере: см. «МОДЕЛЬ КОМИССИИ» в шапке файла.
      const feePercentU = feePercentUnits(traderResult.rows[0]?.total_volume, !!guildId);
      const isSell = type === 'sell';
      const escrowResourceKey = isSell ? resource : VAULT_CREDITS;
      let escrowResourceU = 0n;
      let escrowCreditsU = 0n;

      if (isSell) {
        escrowResourceU = qtyU;
      } else {
        const goodsU = mulUnits(qtyU, priceU);
        // Резерв комиссии — с округлением ВВЕРХ, фактическая при исполнении — ВНИЗ.
        escrowCreditsU = goodsU + feeUnits(goodsU, feePercentU, 'ceil');
      }
      const requiredU = isSell ? escrowResourceU : escrowCreditsU;

      const lockedRows = await lockVaultRows(client, [{ playerId, resource: escrowResourceKey }]);
      const balance = vaultBalance(lockedRows, playerId, escrowResourceKey);
      if (balance.availableU < requiredU) {
        await rollbackQuietly(client);
        res.status(400).json({
          ok: false,
          error: 'INSUFFICIENT_VAULT_BALANCE',
          message: isSell
            ? 'В сейфе биржи недостаточно ресурса. Сначала внесите его через пополнение сейфа.'
            : 'В сейфе биржи недостаточно кредитов (нужна ещё и комиссия). Сначала внесите кредиты.',
          resource: escrowResourceKey,
          required: fromUnits(requiredU),
          available: fromUnits(balance.availableU),
          shortfall: fromUnits(requiredU - balance.availableU),
        });
        return;
      }

      // Создаём ордер (уже с эскроу-полями)
      const orderResult = await client.query(
        `INSERT INTO market_orders
          (player_id, order_type, resource, quantity, quantity_filled, price_per_unit, expires_at, guild_id,
           fee_percent, escrow_resource, escrow_credits, escrow_backed)
         VALUES ($1, $2, $3, $4::numeric, 0, $5::numeric, $6, $7, $8::numeric, $9::numeric, $10::numeric, TRUE)
         RETURNING id, player_id, order_type, resource, quantity::text AS quantity,
                   quantity_filled::text AS quantity_filled, price_per_unit::text AS price_per_unit,
                   fee_percent::text AS fee_percent, escrow_resource::text AS escrow_resource,
                   escrow_credits::text AS escrow_credits, status, created_at, expires_at, guild_id`,
        [
          playerId,
          type,
          resource,
          fromUnits(qtyU),
          fromUnits(priceU),
          expiresAt,
          guildId,
          fromUnits(feePercentU),
          fromUnits(escrowResourceU),
          fromUnits(escrowCreditsU),
        ]
      );

      const newOrder = orderResult.rows[0];

      // Обеспечение уходит available -> locked. Ссылка в журнале — id ордера.
      await vaultLock(
        client,
        playerId,
        escrowResourceKey,
        requiredU,
        'escrow_lock',
        newOrder.id
      );

      // Обновляем время последнего ордера
      await client.query(
        `INSERT INTO traders (player_id, player_name, last_order_time)
         VALUES ($1, (SELECT email FROM users WHERE id = $1), NOW())
         ON CONFLICT (player_id) DO UPDATE SET last_order_time = NOW()`,
        [playerId]
      );

      // Пытаемся сопоставить с существующими ордерами (расчёт — сразу и в сейфе)
      const executedTrades = await matchOrder(client, newOrder, playerId);

      // Дочитываем ордер ТЕМ ЖЕ КЛИЕНТОМ И ДО COMMIT.
      //
      // Раньше здесь был pool.query() ПОСЛЕ COMMIT, пока `client` ещё не отдан
      // в пул (release() стоит в finally). Каждая постановка ордера требовала
      // ДВУХ соединений одновременно, и при числе параллельных постановок >=
      // PG_POOL_MAX пул вставал насмерть: все держат по одному соединению и
      // ждут второе, которое взять уже негде, — до connectionTimeoutMillis
      // (10 c). Замеры: 100 игроков / 45 c -> 558 запросов, 272 (49%) с 500
      // 'timeout exceeded when trying to connect'; голодали и все остальные
      // маршруты, включая read-only.
      //
      // Внутри транзакции строка уже видна (мы её сами и меняли), поэтому
      // отдельное соединение не нужно вовсе. ИНВАРИАНТ ФАЙЛА: пока на руках
      // есть client, обращаться к pool.query()/pool.connect() нельзя.
      const updatedOrderResult = await client.query(
        `SELECT o.id, o.player_id, o.order_type, o.resource, trim_scale(o.quantity)::text AS quantity,
                trim_scale(o.quantity_filled)::text AS quantity_filled,
                trim_scale(o.price_per_unit)::text AS price_per_unit,
                o.status, o.created_at, o.expires_at, o.guild_id, trim_scale(o.fee_percent)::text AS fee_percent,
                trim_scale(o.escrow_resource)::text AS escrow_resource,
                trim_scale(o.escrow_credits)::text AS escrow_credits,
                split_part(u.email, '@', 1) AS player_name
         FROM market_orders o
         JOIN users u ON o.player_id = u.id
         WHERE o.id = $1`,
        [newOrder.id]
      );

      const updatedOrder = updatedOrderResult.rows[0];

      await client.query('COMMIT');

      /*
       * Уведомляем остальных игроков о новом ордере (bigplan.md, пункты 17, 24).
       *
       * Рассылаем ПОСЛЕ COMMIT: до него ордера ещё нет, и при откате транзакции все получили бы
       * тост про заказ, которого не существует.
       *
       * Отправляем всем, кроме автора, и НЕ фильтруем по складу на сервере: сервер не знает
       * инвентарь игрока (он лежит в его сейве), а payload крошечный. Решает клиент — он
       * показывает тост только если этот ресурс у него реально есть (см. useServerStream).
       *
       * Полностью исполненный ордер не анонсируем: предлагать «проверьте и продайте» по
       * закрытой заявке значит гарантированно тратить внимание игрока впустую.
       */
      if (updatedOrder.status === 'active') {
        realtimeHub.broadcast(
          'market.order.created',
          {
            id: updatedOrder.id,
            playerName: updatedOrder.player_name,
            type: updatedOrder.order_type,
            resource: updatedOrder.resource,
            quantity: updatedOrder.quantity,
            pricePerUnit: updatedOrder.price_per_unit,
            createdAt: new Date(updatedOrder.created_at).getTime(),
          },
          (c) => c.userId !== playerId,
        );
      }

      res.json({
        ok: true,
        order: {
          id: updatedOrder.id,
          playerId: updatedOrder.player_id.toString(),
          playerName: updatedOrder.player_name,
          type: updatedOrder.order_type,
          resource: updatedOrder.resource,
          quantity: updatedOrder.quantity,
          quantityFilled: updatedOrder.quantity_filled,
          pricePerUnit: updatedOrder.price_per_unit,
          status: updatedOrder.status,
          createdAt: new Date(updatedOrder.created_at).getTime(),
          expiresAt: new Date(updatedOrder.expires_at).getTime(),
          guildId: updatedOrder.guild_id,
          feePercent: updatedOrder.fee_percent,
          escrow: {
            resource: updatedOrder.escrow_resource,
            credits: updatedOrder.escrow_credits,
          },
        },
        executedTrades,
      });
    } catch (e) {
      if (client) await rollbackQuietly(client);
      if (isBusyError(e) || isUnavailableError(e)) {
        res.status(503).json({ ok: false, error: 'MARKET_BUSY', message: 'Биржа занята, попробуйте ещё раз через секунду.' });
        return;
      }
      // Наружу — только код инварианта; полный текст (с id и суммами) в логе.
      console.error('Error creating order:', e);
      res.status(500).json({ ok: false, error: invariantCode(e) ?? 'INTERNAL', message: 'Не удалось выставить ордер.' });
    } finally {
      if (client) client.release();
    }
  });

  /**
   * DELETE /api/market/orders/:id - Отменить свой ордер
   *
   * Возвращает НЕИСПОЛНЕННЫЙ остаток эскроу locked -> available. Раньше отмена
   * частично исполненного ордера не возвращала ничего (возвращать было нечего —
   * эскроу не существовало).
   */
  app.delete('/api/market/orders/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const playerId = req.userId;
    if (!isUuid(id)) {
      res.status(400).json({ ok: false, error: 'INVALID_ID', message: 'Некорректный идентификатор ордера.' });
      return;
    }

    let client = null;
    try {
      client = await beginTx(pool);
      const orderRes = await client.query(
        `SELECT id, player_id, order_type, resource, trim_scale(quantity)::text AS quantity,
                trim_scale(quantity_filled)::text AS quantity_filled,
                trim_scale(price_per_unit)::text AS price_per_unit,
                trim_scale(escrow_resource)::text AS escrow_resource,
                trim_scale(escrow_credits)::text AS escrow_credits,
                status, created_at, expires_at
           FROM market_orders
          WHERE id = $1 AND player_id = $2
          FOR UPDATE`,
        [id, playerId]
      );

      if (orderRes.rowCount === 0) {
        await rollbackQuietly(client);
        res.status(404).json({ ok: false, error: 'ORDER_NOT_FOUND', message: 'Ордер не найден.' });
        return;
      }
      const order = orderRes.rows[0];
      if (!['open', 'partial'].includes(order.status)) {
        await rollbackQuietly(client);
        res.status(409).json({ ok: false, error: 'ORDER_NOT_ACTIVE', message: 'Ордер уже закрыт.', status: order.status });
        return;
      }

      const refund = await closeOrderAndRefund(client, order, 'cancelled');
      await client.query('COMMIT');

      res.json({
        ok: true,
        order: {
          id: order.id,
          playerId: String(order.player_id),
          type: order.order_type,
          resource: order.resource,
          quantity: order.quantity,
          quantityFilled: order.quantity_filled,
          pricePerUnit: order.price_per_unit,
          status: 'cancelled',
          createdAt: new Date(order.created_at).getTime(),
          expiresAt: new Date(order.expires_at).getTime(),
        },
        refunded: refund,
      });
    } catch (e) {
      if (client) await rollbackQuietly(client);
      if (isBusyError(e) || isUnavailableError(e)) {
        res.status(503).json({ ok: false, error: 'MARKET_BUSY', message: 'Биржа занята, попробуйте ещё раз через секунду.' });
        return;
      }
      console.error('Error cancelling order:', e);
      res.status(500).json({ ok: false, error: invariantCode(e) ?? 'INTERNAL', message: 'Не удалось отменить ордер.' });
    } finally {
      if (client) client.release();
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
        SELECT o.*, split_part(u.email, '@', 1) as player_name
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
   *
   * Было: 74 последовательных запроса (2 на каждый из 37 ресурсов) на каждый вызов,
   * а вызывается это каждые 30 секунд из PriceList.tsx у каждого игрока.
   * Стало: ОДИН запрос + короткий кэш в памяти.
   *
   * lastPrice = COALESCE(реальная сделка игроков, котировка симулятора, референсная цена),
   * поэтому на пустой базе цены НЕ нулевые, но реальные сделки всегда важнее синтетики.
   * volume24h считается ТОЛЬКО по реальным сделкам (synthetic = FALSE).
   */
  const PRICES_CACHE_MS = 15_000;
  let pricesCache = { at: 0, payload: null };

  app.get('/api/market/prices', async (req, res) => {
    try {
      const now = Date.now();
      if (pricesCache.payload && now - pricesCache.at < PRICES_CACHE_MS) {
        res.json(pricesCache.payload);
        return;
      }

      const resources = TRADEABLE_RESOURCES;
      const references = resources.map((r) => RESOURCE_REFERENCE_PRICES[r] ?? 1);

      const result = await pool.query(
        `
        WITH universe AS (
          SELECT * FROM unnest($1::text[], $2::float8[]) AS u(resource, reference_price)
        ),
        agg AS (
          SELECT resource,
                 AVG(price) AS avg_price,
                 MAX(price) AS high_price,
                 MIN(price) AS low_price,
                 COALESCE(SUM(volume), 0) AS total_volume
          FROM market_price_history
          WHERE recorded_at > NOW() - INTERVAL '24 hours' AND synthetic = FALSE
          GROUP BY resource
        ),
        last_real AS (
          SELECT DISTINCT ON (resource) resource, price
          FROM market_price_history
          WHERE synthetic = FALSE
          ORDER BY resource, recorded_at DESC
        ),
        old_real AS (
          SELECT DISTINCT ON (resource) resource, price
          FROM market_price_history
          WHERE recorded_at <= NOW() - INTERVAL '24 hours' AND synthetic = FALSE
          ORDER BY resource, recorded_at DESC
        )
        SELECT u.resource,
               u.reference_price,
               q.price          AS sim_price,
               q.change_pct     AS sim_change_pct,
               l.price          AS last_real,
               o.price          AS old_real,
               a.avg_price,
               a.high_price,
               a.low_price,
               COALESCE(a.total_volume, 0) AS total_volume
        FROM universe u
        LEFT JOIN market_sim_resource_quotes q ON q.resource = u.resource
        LEFT JOIN agg a       ON a.resource = u.resource
        LEFT JOIN last_real l ON l.resource = u.resource
        LEFT JOIN old_real o  ON o.resource = u.resource
        `,
        [resources, references]
      );

      const prices = result.rows.map((row) => {
        const reference = parseFloat(row.reference_price) || 1;
        const simPrice = row.sim_price !== null ? parseFloat(row.sim_price) : null;
        const fallbackPrice = simPrice && simPrice > 0 ? simPrice : reference;

        const lastReal = row.last_real !== null ? parseFloat(row.last_real) : null;
        const lastPrice = lastReal && lastReal > 0 ? lastReal : fallbackPrice;

        const avg = row.avg_price !== null ? parseFloat(row.avg_price) : null;
        const high = row.high_price !== null ? parseFloat(row.high_price) : null;
        const low = row.low_price !== null ? parseFloat(row.low_price) : null;

        // Изменение за 24ч: по реальным сделкам, если они есть, иначе по симуляции.
        const oldReal = row.old_real !== null ? parseFloat(row.old_real) : null;
        let priceChange24h;
        if (lastReal && lastReal > 0 && oldReal && oldReal > 0) {
          priceChange24h = ((lastReal - oldReal) / oldReal) * 100;
        } else {
          priceChange24h = row.sim_change_pct !== null ? parseFloat(row.sim_change_pct) : 0;
        }

        return {
          resource: row.resource,
          lastPrice: String(lastPrice),
          avgPrice24h: String(avg && avg > 0 ? avg : fallbackPrice),
          highPrice24h: String(high && high > 0 ? high : fallbackPrice),
          lowPrice24h: String(low && low > 0 ? low : fallbackPrice),
          volume24h: String(parseFloat(row.total_volume) || 0),
          priceChange24h,
          // Дополнительные поля (старые потребители их игнорируют)
          referencePrice: String(reference),
          simPrice: simPrice !== null ? String(simPrice) : null,
          hasRealTrades: !!(lastReal && lastReal > 0),
        };
      });

      const payload = { ok: true, prices, cachedForMs: PRICES_CACHE_MS };
      pricesCache = { at: now, payload };
      res.json(payload);
    } catch (e) {
      // Даже при отказе БД игрок должен видеть ориентир цены, а не нули.
      console.error('Error fetching market prices, falling back to reference prices:', e);
      const prices = TRADEABLE_RESOURCES.map((resource) => {
        const reference = RESOURCE_REFERENCE_PRICES[resource] ?? 1;
        return {
          resource,
          lastPrice: String(reference),
          avgPrice24h: String(reference),
          highPrice24h: String(reference),
          lowPrice24h: String(reference),
          volume24h: '0',
          priceChange24h: 0,
          referencePrice: String(reference),
          simPrice: null,
          hasRealTrades: false,
        };
      });
      res.json({ ok: true, prices, degraded: true });
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
      
      /*
       * status IN ('open','partial'), а не status='open': частично исполненный
       * ордер ПО-ПРЕЖНЕМУ стоит в книге своим остатком, и раньше он из книги
       * молча исчезал — игрок видел стакан, в котором нет части ликвидности,
       * с которой его же ордер немедленно сведётся. Один запрос вместо двух:
       * стакан читают все игроки каждые несколько секунд.
       */
      const bookResult = await pool.query(
        `SELECT order_type, trim_scale(price_per_unit)::text AS price,
                trim_scale(SUM(quantity - quantity_filled))::text AS total_quantity,
                COUNT(*)::int AS order_count
           FROM market_orders
          WHERE resource = $1 AND status IN ('open', 'partial') AND expires_at > NOW()
            AND quantity - quantity_filled > 0
          GROUP BY order_type, price_per_unit
          ORDER BY order_type, price_per_unit`,
        [resource]
      );

      const toLevel = (r) => ({
        price: r.price,
        quantity: r.total_quantity,
        orderCount: r.order_count,
      });

      const bids = bookResult.rows
        .filter((r) => r.order_type === 'buy')
        .sort((a, b) => (dbUnits(b.price) > dbUnits(a.price) ? 1 : -1))
        .slice(0, MARKET_CONSTANTS.ORDER_BOOK_DEPTH)
        .map(toLevel);

      const asks = bookResult.rows
        .filter((r) => r.order_type === 'sell')
        .sort((a, b) => (dbUnits(a.price) > dbUnits(b.price) ? 1 : -1))
        .slice(0, MARKET_CONSTANTS.ORDER_BOOK_DEPTH)
        .map(toLevel);

      // Спред считается в точной арифметике, а не в float.
      const bestBidU = bids.length > 0 ? dbUnits(bids[0].price) : 0n;
      const bestAskU = asks.length > 0 ? dbUnits(asks[0].price) : 0n;
      const spreadU = bestAskU > 0n && bestBidU > 0n ? bestAskU - bestBidU : 0n;

      res.json({
        ok: true,
        orderBook: {
          resource,
          bids,
          asks,
          spread: fromUnits(spreadU),
        },
      });
    } catch (e) {
      console.error('Error fetching order book:', e);
      res.status(500).json({ ok: false, error: String(e?.message ?? e) });
    }
  });

  // ==========================================
  // ТРЕЙДЕРЫ
  // ==========================================

  // NOTE: registered before `/api/traders/:id` on purpose. Express matches routes in
  // registration order, so with `:id` first every GET /api/traders/leaderboard was handled
  // as id="leaderboard" and returned 500 'invalid input syntax for type integer'.
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
          playerName: publicPlayerName(row.player_name),
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
          playerName: publicPlayerName(row.player_name),
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


  // ==========================================
  // PENDING ТРАНЗАКЦИИ
  // ==========================================

  /**
   * GET /api/market/pending-transactions - Получить ожидающие транзакции текущего игрока
   *
   * ОТДАЁТ ТОЛЬКО settlement='client' — расчёты СТАРОЙ модели, которые клиент
   * действительно должен применить к своему состоянию (такие строки уже лежат в
   * рабочей БД). Сделки, рассчитанные в сейфе, создаются сразу 'applied' и здесь
   * не появляются: иначе клиент начислил бы себе то, что биржа уже начислила в сейф,
   * то есть двойное начисление. Фильтр по settlement — второй рубеж к фильтру по
   * status, чтобы это нельзя было сломать случайно.
   */
  app.get('/api/market/pending-transactions', authMiddleware, async (req, res) => {
    try {
      const playerId = req.userId;

      const result = await pool.query(`
        SELECT
          pt.*,
          mt.resource,
          mt.quantity,
          mt.price_per_unit,
          mt.executed_at
        FROM market_pending_transactions pt
        JOIN market_trades mt ON pt.trade_id = mt.id
        WHERE pt.player_id = $1 AND pt.status = 'pending' AND pt.settlement = 'client'
        ORDER BY pt.created_at ASC
      `, [playerId]);

      res.json({
        ok: true,
        transactions: result.rows.map(row => ({
          id: row.id,
          tradeId: row.trade_id,
          transactionType: row.transaction_type,
          resource: row.resource,
          resourceAmount: row.resource_amount.toString(),
          creditsAmount: row.credits_amount.toString(),
          feeAmount: row.fee_amount.toString(),
          settlement: row.settlement,
          createdAt: new Date(row.created_at).getTime(),
          tradeInfo: {
            pricePerUnit: row.price_per_unit.toString(),
            executedAt: new Date(row.executed_at).getTime()
          }
        }))
      });
    } catch (e) {
      console.error('Error fetching pending transactions:', e);
      res.status(500).json({ ok: false, error: String(e?.message ?? e) });
    }
  });

  /**
   * POST /api/market/apply-transactions - Подтвердить применение транзакций
   * Клиент вызывает этот endpoint после успешного применения транзакций к своему игровому состоянию
   */
  app.post('/api/market/apply-transactions', authMiddleware, async (req, res) => {
    try {
      const playerId = req.userId;
      const { transactionIds } = req.body;
      
      if (!transactionIds || !Array.isArray(transactionIds) || transactionIds.length === 0) {
        res.status(400).json({ ok: false, error: 'INVALID_TRANSACTION_IDS' });
        return;
      }
      
      if (transactionIds.some((id) => !isUuid(id))) {
        res.status(400).json({ ok: false, error: 'INVALID_TRANSACTION_IDS', message: 'Некорректные идентификаторы транзакций.' });
        return;
      }

      // Обновляем статус транзакций только для этого игрока.
      // settlement='client': строку, рассчитанную в сейфе, клиент «применить» не может
      // (и не должен) — она уже applied. Условие оставлено явным, чтобы будущая
      // правка запроса не открыла путь к двойному начислению.
      const result = await pool.query(`
        UPDATE market_pending_transactions
        SET status = 'applied', applied_at = NOW()
        WHERE id = ANY($1::uuid[]) AND player_id = $2 AND status = 'pending' AND settlement = 'client'
        RETURNING id
      `, [transactionIds, playerId]);

      res.json({
        ok: true,
        appliedCount: result.rowCount,
        appliedIds: result.rows.map(r => r.id)
      });
    } catch (e) {
      console.error('Error applying transactions:', e);
      res.status(500).json({ ok: false, error: String(e?.message ?? e) });
    }
  });

  // ==========================================
  // СЛУЖЕБНЫЕ
  // ==========================================

  /**
   * POST /api/market/expire-orders - Истечение старых ордеров
   *
   * Раньше: БЕЗ АВТОРИЗАЦИИ (любой мог дёргать), только status='open' (частично
   * исполненные не истекали никогда) и без возврата эскроу. Теперь: требует токен,
   * захватывает 'open' И 'partial', возвращает эскроу и делает ту же работу, что
   * периодическая зачистка. Сам сервер вызывает это по таймеру
   * (startMarketMaintenance), маршрут остаётся для внешнего cron и админки.
   */
  app.post('/api/market/expire-orders', authMiddleware, async (req, res) => {
    try {
      const result = await runMarketMaintenance(pool);
      res.json({ ok: true, ...result });
    } catch (e) {
      if (isBusyError(e) || isUnavailableError(e)) {
        res.status(503).json({ ok: false, error: 'MARKET_BUSY', message: 'Биржа занята, попробуйте ещё раз через секунду.' });
        return;
      }
      console.error('Error expiring orders:', e);
      res.status(500).json({ ok: false, error: invariantCode(e) ?? 'INTERNAL', message: 'Не удалось выполнить зачистку ордеров.' });
    }
  });

  // ==========================================
  // СЕЙФ, ВЫВОДЫ И ПРЯМЫЕ ПРЕДЛОЖЕНИЯ
  // ==========================================
  // Регистрируются здесь же, чтобы server/index.js не нужно было править
  // отдельно под каждый новый маршрут биржи.
  createVaultRoutes(app, pool, authMiddleware);
}

// ============================================================================
// СЛУЖЕБНАЯ ЗАЧИСТКА
// ============================================================================

/**
 * Один прогон зачистки:
 *   1. истёкшие ордера ('open' И 'partial') -> 'expired';
 *   2. ВОЗВРАТ ЭСКРОУ у любого неактивного ордера, у которого он ещё висит.
 *
 * Шаг 2 намеренно не привязан к шагу 1. Ордер могли закрыть посторонние пути,
 * которые про сейф не знают (POST /api/admin/players/:id/orders/cancel-all и
 * POST /api/admin/maintenance/expire-orders в server/admin.js — их править нельзя).
 * Без этого шага их эскроу заморозился бы навсегда; с ним — обеспечение
 * возвращается на следующем прогоне, и правки admin.js не требуется.
 * Возврат идемпотентен: escrow_* обнуляются той же транзакцией.
 */
export async function runMarketMaintenance(pool) {
  let client = null;
  let expiredCount = 0;
  let refundedOrders = 0;
  try {
    client = await beginTx(pool);
    await acquireMarketLock(client);

    const expired = await client.query(
      `UPDATE market_orders SET status = 'expired'
        WHERE status IN ('open', 'partial') AND expires_at < NOW()
        RETURNING id`
    );
    expiredCount = expired.rowCount;

    const stray = await client.query(
      `SELECT id, player_id, order_type, resource, status,
              escrow_resource::text AS escrow_resource, escrow_credits::text AS escrow_credits
         FROM market_orders
        WHERE status NOT IN ('open', 'partial') AND (escrow_resource > 0 OR escrow_credits > 0)
        ORDER BY player_id, resource
        FOR UPDATE`
    );

    if (stray.rowCount > 0) {
      const keys = [];
      for (const row of stray.rows) {
        if (dbUnits(row.escrow_resource) > 0n) keys.push({ playerId: row.player_id, resource: row.resource });
        if (dbUnits(row.escrow_credits) > 0n) keys.push({ playerId: row.player_id, resource: VAULT_CREDITS });
      }
      await lockVaultRows(client, keys);
      for (const row of stray.rows) {
        await refundOrderEscrow(client, row);
        refundedOrders += 1;
      }
    }

    await client.query('COMMIT');
  } catch (e) {
    if (client) {
      await rollbackQuietly(client);
      client.release();
      client = null;
    }
    throw e;
  }
  client.release();

  // Прямые предложения живут в модуле сейфа, но зачищаются тем же тиком.
  // ВАЖНО: соединение уже отдано в пул — второе одновременно мы не держим.
  const offers = await expireDirectOffers(pool);

  return {
    expiredCount,
    refundedOrders,
    expiredOffers: offers.expiredCount,
    refundedOffers: offers.refundedCount,
  };
}

let maintenanceTimer = null;
let maintenanceRunning = false;

/**
 * Периодическая зачистка. Раньше POST /api/market/expire-orders не вызывал НИКТО,
 * поэтому ордера не истекали вообще.
 *
 * maintenanceRunning — защита от наложения прогонов (лучше пропустить тик, чем
 * держать два конкурирующих сканирования); таймер unref(), чтобы не мешать
 * штатному завершению процесса.
 */
export function startMarketMaintenance(pool, { intervalMs = MARKET_CONSTANTS.MAINTENANCE_INTERVAL_MS } = {}) {
  if (maintenanceTimer) return maintenanceTimer;

  const tick = async () => {
    if (maintenanceRunning) {
      console.warn('[market] предыдущая зачистка ещё идёт, тик пропущен');
      return;
    }
    maintenanceRunning = true;
    try {
      const r = await runMarketMaintenance(pool);
      if (r.expiredCount || r.refundedOrders || r.expiredOffers || r.refundedOffers) {
        console.log(
          `[market] зачистка: ордеров истекло ${r.expiredCount}, эскроу возвращено по ${r.refundedOrders} ордерам, ` +
            `предложений истекло ${r.expiredOffers}, эскроу возвращено по ${r.refundedOffers} предложениям`
        );
      }
    } catch (e) {
      console.error('[market] зачистка не удалась:', describeError(e));
    } finally {
      maintenanceRunning = false;
    }
  };

  maintenanceTimer = setInterval(tick, intervalMs);
  if (typeof maintenanceTimer.unref === 'function') maintenanceTimer.unref();
  // Первый прогон — сразу после старта: за время простоя сервера ордера истекли.
  setTimeout(tick, 2_000).unref();
  return maintenanceTimer;
}

export function stopMarketMaintenance() {
  if (maintenanceTimer) {
    clearInterval(maintenanceTimer);
    maintenanceTimer = null;
  }
}

// ============================================================================
// ВСПОМОГАТЕЛЬНОЕ
// ============================================================================

async function rollbackQuietly(client) {
  try {
    await client.query('ROLLBACK');
  } catch {
    /* соединение уже могло умереть — ROLLBACK всё равно не нужен */
  }
}

/**
 * Процент комиссии в точных юнитах (шкала 12) по той же лестнице, что и раньше.
 * Порог VIP сравнивается точно, без float: total_volume приходит из NUMERIC строкой.
 */
function feePercentUnits(totalVolumeText, hasGuild) {
  const volumeU = dbUnits(totalVolumeText ?? '0');
  const vipThresholdU = toUnits(String(MARKET_CONSTANTS.VIP_VOLUME_THRESHOLD), 0);
  const percent =
    volumeU >= vipThresholdU
      ? MARKET_CONSTANTS.VIP_FEE_PERCENT
      : hasGuild
        ? MARKET_CONSTANTS.GUILD_FEE_PERCENT
        : MARKET_CONSTANTS.BASE_FEE_PERCENT;
  return toUnits(String(percent), 2);
}

/**
 * Вернуть в available остаток эскроу ордера и обнулить escrow_*.
 * Строки сейфа должны быть уже заблокированы вызывающим.
 */
async function refundOrderEscrow(client, order) {
  const resourceU = dbUnits(order.escrow_resource);
  const creditsU = dbUnits(order.escrow_credits);
  if (resourceU === 0n && creditsU === 0n) return { resource: '0', credits: '0' };

  await client.query('UPDATE market_orders SET escrow_resource = 0, escrow_credits = 0 WHERE id = $1', [order.id]);
  if (resourceU > 0n) {
    await vaultUnlock(client, order.player_id, order.resource, resourceU, 'escrow_release', order.id);
  }
  if (creditsU > 0n) {
    await vaultUnlock(client, order.player_id, VAULT_CREDITS, creditsU, 'escrow_release', order.id);
  }
  return { resource: fromUnits(resourceU), credits: fromUnits(creditsU) };
}

/** Закрыть активный ордер в статус status и вернуть неисполненный остаток эскроу. */
async function closeOrderAndRefund(client, order, status) {
  const keys = [];
  if (dbUnits(order.escrow_resource) > 0n) keys.push({ playerId: order.player_id, resource: order.resource });
  if (dbUnits(order.escrow_credits) > 0n) keys.push({ playerId: order.player_id, resource: VAULT_CREDITS });
  if (keys.length > 0) await lockVaultRows(client, keys);

  await client.query('UPDATE market_orders SET status = $2 WHERE id = $1', [order.id, status]);
  return refundOrderEscrow(client, order);
}

// ============================================================================
// MATCHING ENGINE
// ============================================================================

/**
 * Сопоставление ордеров + АТОМАРНЫЙ РАСЧЁТ В СЕЙФЕ.
 *
 * Что было сломано:
 *   1. НИ ОДНОГО row-лока: встречные ордера читались обычным SELECT, потом им
 *      писался quantity_filled. Две параллельные заявки читали один и тот же
 *      стоящий ордер и обе его исполняли — классический lost update, который
 *      ДУБЛИРУЕТ товар. На 100 игроках это происходит регулярно.
 *   2. Расчёт делал КЛИЕНТ (market_pending_transactions + опрос из
 *      useMarketTransactions.ts). Клиент, который просто не вызвал
 *      apply-transactions, оставлял себе и ресурс, и кредиты.
 *
 * Как теперь:
 *   - вся функция работает внутри транзакции постановки ордера, которая ДО этого
 *     взяла advisory-лок биржи (см. market-vault.js), поэтому сведение
 *     сериализовано целиком;
 *   - встречный ордер выбирается по одному и блокируется
 *     `SELECT ... FOR UPDATE SKIP LOCKED`. Почему SKIP LOCKED, а не обычный
 *     FOR UPDATE: строку ордера могут держать посторонние пути (админская отмена,
 *     отмена самим владельцем, зачистка), и ждать их, застыв посреди сведения,
 *     хуже, чем взять следующий по цене — приоритет цена-время сохраняется среди
 *     доступных ордеров, а «залоченный сейчас» ордер всё равно нельзя исполнить
 *     корректно. Обычный FOR UPDATE здесь означал бы ожидание с пустыми руками и
 *     риск кольца ожиданий;
 *   - строки сейфа обеих сторон блокируются ОДНИМ запросом в порядке
 *     (player_id, resource) — детерминированный порядок исключает дедлок;
 *   - расчёт (списание из locked, зачисление в available, комиссия, журнал)
 *     происходит здесь же. Клиентская pending-строка создаётся уже 'applied'
 *     и служит только историей — двойного начисления быть не может.
 */
async function matchOrder(client, takerOrder, playerId) {
  const executedTrades = [];
  const resource = takerOrder.resource;
  const takerIsBuy = takerOrder.order_type === 'buy';
  const oppositeType = takerIsBuy ? 'sell' : 'buy';
  const priceComparison = takerIsBuy ? '<=' : '>=';
  const priceOrder = takerIsBuy ? 'ASC' : 'DESC';

  const takerQuantityU = dbUnits(takerOrder.quantity);
  const takerLimitU = dbUnits(takerOrder.price_per_unit);
  const takerFeePctU = dbUnits(takerOrder.fee_percent);
  let remainingU = takerQuantityU - dbUnits(takerOrder.quantity_filled);
  let takerEscrowResourceU = dbUnits(takerOrder.escrow_resource);
  let takerEscrowCreditsU = dbUnits(takerOrder.escrow_credits);
  let takerStatus = takerOrder.status;

  const skipIds = [];
  let fills = 0;

  while (remainingU > 0n && fills < MARKET_CONSTANTS.MAX_FILLS_PER_ORDER) {
    const candidate = await client.query(
      `SELECT id, player_id, order_type, quantity::text AS quantity,
              quantity_filled::text AS quantity_filled, price_per_unit::text AS price_per_unit,
              fee_percent::text AS fee_percent, escrow_resource::text AS escrow_resource,
              escrow_credits::text AS escrow_credits, status
         FROM market_orders
        WHERE resource = $1
          AND order_type = $2
          AND status IN ('open', 'partial')
          AND price_per_unit ${priceComparison} $3::numeric
          AND player_id <> $4
          AND expires_at > NOW()
          AND quantity - quantity_filled > 0
          AND NOT (id = ANY($5::uuid[]))
        ORDER BY price_per_unit ${priceOrder}, created_at ASC, id ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED`,
      [resource, oppositeType, takerOrder.price_per_unit, playerId, skipIds]
    );
    if (candidate.rowCount === 0) break;

    const maker = candidate.rows[0];
    const makerRemainingU = dbUnits(maker.quantity) - dbUnits(maker.quantity_filled);
    if (makerRemainingU <= 0n) {
      skipIds.push(maker.id);
      continue;
    }

    const tradeQuantityU = remainingU < makerRemainingU ? remainingU : makerRemainingU;
    // Цена сделки — цена СТОЯЩЕГО в книге ордера (price-time priority).
    const tradePriceU = dbUnits(maker.price_per_unit);
    const grossU = mulUnits(tradeQuantityU, tradePriceU);

    const buyerId = takerIsBuy ? playerId : maker.player_id;
    const sellerId = takerIsBuy ? maker.player_id : playerId;
    const buyOrderId = takerIsBuy ? takerOrder.id : maker.id;
    const sellOrderId = takerIsBuy ? maker.id : takerOrder.id;

    const buyerFeePctU = takerIsBuy ? takerFeePctU : dbUnits(maker.fee_percent);
    const sellerFeePctU = takerIsBuy ? dbUnits(maker.fee_percent) : takerFeePctU;
    const buyerFeeU = feeUnits(grossU, buyerFeePctU, 'trunc');
    const sellerFeeU = feeUnits(grossU, sellerFeePctU, 'trunc');
    const totalFeeU = buyerFeeU + sellerFeeU;

    // Лимит покупателя: у тейкера-покупателя — его цена, у мейкера-покупателя
    // цена ордера И ЕСТЬ цена сделки, поэтому улучшения нет.
    const buyLimitU = takerIsBuy ? takerLimitU : tradePriceU;
    const reservedGoodsU = mulUnits(tradeQuantityU, buyLimitU);
    const improvementU = reservedGoodsU - grossU; // >= 0
    const buyerChargeU = grossU + buyerFeeU;

    const buyerEscrowU = takerIsBuy ? takerEscrowCreditsU : dbUnits(maker.escrow_credits);
    const sellerEscrowU = takerIsBuy ? dbUnits(maker.escrow_resource) : takerEscrowResourceU;

    /*
     * Инварианты эскроу. Доказательство, что они выполняются всегда:
     *   покупатель: escrow_credits = лимит*остаток + (резерв комиссии - взятая),
     *   резерв считался с округлением вверх, фактические — вниз, значит
     *   buyerCharge + improvement = tradeQty*лимит + fee <= escrow_credits;
     *   продавец: escrow_resource = остаток ордера >= tradeQty.
     * Если инвариант когда-нибудь нарушится — падаем и откатываем всю постановку,
     * а не «дорисовываем» баланс.
     */
    if (buyerEscrowU < buyerChargeU + improvementU) {
      throw new Error(
        `ESCROW_UNDERFUNDED_BUY order=${buyOrderId} escrow=${fromUnits(buyerEscrowU)} need=${fromUnits(buyerChargeU + improvementU)}`
      );
    }
    if (sellerEscrowU < tradeQuantityU) {
      throw new Error(
        `ESCROW_UNDERFUNDED_SELL order=${sellOrderId} escrow=${fromUnits(sellerEscrowU)} need=${fromUnits(tradeQuantityU)}`
      );
    }

    // --- Блокировка строк сейфа в детерминированном порядке -----------------
    const vault = await lockVaultRows(client, [
      { playerId: sellerId, resource },
      { playerId: buyerId, resource },
      { playerId: buyerId, resource: VAULT_CREDITS },
      { playerId: sellerId, resource: VAULT_CREDITS },
    ]);
    const sellerResourceBal = vaultBalance(vault, sellerId, resource);
    const buyerCreditsBal = vaultBalance(vault, buyerId, VAULT_CREDITS);
    if (sellerResourceBal.lockedU < tradeQuantityU) {
      throw new Error(
        `VAULT_LOCKED_MISMATCH seller=${sellerId} ${resource} locked=${fromUnits(sellerResourceBal.lockedU)} need=${fromUnits(tradeQuantityU)}`
      );
    }
    if (buyerCreditsBal.lockedU < buyerChargeU + improvementU) {
      throw new Error(
        `VAULT_LOCKED_MISMATCH buyer=${buyerId} credits locked=${fromUnits(buyerCreditsBal.lockedU)} need=${fromUnits(buyerChargeU + improvementU)}`
      );
    }

    // --- Сделка -------------------------------------------------------------
    const tradeResult = await client.query(
      `INSERT INTO market_trades
        (buy_order_id, sell_order_id, buyer_id, seller_id, resource, quantity, price_per_unit,
         total_amount, fee, buyer_fee, seller_fee)
       VALUES ($1, $2, $3, $4, $5, $6::numeric, $7::numeric, $8::numeric, $9::numeric, $10::numeric, $11::numeric)
       RETURNING id, executed_at`,
      [
        buyOrderId,
        sellOrderId,
        buyerId,
        sellerId,
        resource,
        fromUnits(tradeQuantityU),
        fromUnits(tradePriceU),
        fromUnits(grossU),
        fromUnits(totalFeeU),
        fromUnits(buyerFeeU),
        fromUnits(sellerFeeU),
      ]
    );
    const tradeId = tradeResult.rows[0].id;

    /*
     * РАСЧЁТ. Порядок движений выбран так, чтобы ни один промежуточный баланс не
     * мог стать отрицательным (иначе CHECK(available>=0)/CHECK(locked>=0) отменит
     * всю транзакцию — и это правильное поведение, а не то, что нужно обходить).
     */
    // 1. Улучшение цены покупателю — обратно в доступное (полный баланс не меняется).
    if (improvementU > 0n) {
      await vaultUnlock(client, buyerId, VAULT_CREDITS, improvementU, 'escrow_price_improvement', buyOrderId);
    }
    // 2. Товар: из эскроу продавца -> в доступное покупателю.
    await vaultSpendLocked(client, sellerId, resource, tradeQuantityU, 'trade_sell_resource', tradeId);
    await vaultCredit(client, buyerId, resource, tradeQuantityU, 'trade_buy_resource', tradeId);
    // 3. Кредиты: из эскроу покупателя -> в доступное продавцу.
    await vaultSpendLocked(client, buyerId, VAULT_CREDITS, grossU, 'trade_buy_credits', tradeId);
    await vaultCredit(client, sellerId, VAULT_CREDITS, grossU, 'trade_sell_credits', tradeId);
    // 4. Комиссии сжигаются: покупательская — из эскроу, продавцовая — из выручки.
    if (buyerFeeU > 0n) {
      await vaultSpendLocked(client, buyerId, VAULT_CREDITS, buyerFeeU, 'trade_fee', tradeId);
    }
    if (sellerFeeU > 0n) {
      await vaultDebit(client, sellerId, VAULT_CREDITS, sellerFeeU, 'trade_fee', tradeId);
    }

    // --- Ордера -------------------------------------------------------------
    const makerSpentResourceU = takerIsBuy ? tradeQuantityU : 0n;
    const makerSpentCreditsU = takerIsBuy ? 0n : buyerChargeU + improvementU;
    const makerAfter = await applyFillToOrder(client, maker.id, tradeQuantityU, makerSpentResourceU, makerSpentCreditsU);

    const takerSpentResourceU = takerIsBuy ? 0n : tradeQuantityU;
    const takerSpentCreditsU = takerIsBuy ? buyerChargeU + improvementU : 0n;
    const takerAfter = await applyFillToOrder(client, takerOrder.id, tradeQuantityU, takerSpentResourceU, takerSpentCreditsU);

    // Полностью исполненный ордер отдаёт остаток эскроу (пыль от округления
    // комиссии вверх и неиспользованный резерв) обратно владельцу.
    if (makerAfter.status === 'filled') {
      await refundOrderEscrow(client, {
        id: maker.id,
        player_id: maker.player_id,
        resource,
        escrow_resource: makerAfter.escrowResource,
        escrow_credits: makerAfter.escrowCredits,
      });
    }
    takerEscrowResourceU = dbUnits(takerAfter.escrowResource);
    takerEscrowCreditsU = dbUnits(takerAfter.escrowCredits);
    takerStatus = takerAfter.status;
    if (takerStatus === 'filled') {
      await refundOrderEscrow(client, {
        id: takerOrder.id,
        player_id: playerId,
        resource,
        escrow_resource: takerAfter.escrowResource,
        escrow_credits: takerAfter.escrowCredits,
      });
      takerEscrowResourceU = 0n;
      takerEscrowCreditsU = 0n;
    }

    // --- Статистика, история цен, клиентская запись --------------------------
    await client.query(
      `INSERT INTO traders (player_id, player_name, total_trades, successful_trades, total_volume)
       VALUES ($1, (SELECT email FROM users WHERE id = $1), 1, 1, $2::numeric)
       ON CONFLICT (player_id) DO UPDATE SET
         total_trades = traders.total_trades + 1,
         successful_trades = traders.successful_trades + 1,
         total_volume = traders.total_volume + $2::numeric`,
      [buyerId, fromUnits(grossU)]
    );
    await client.query(
      `INSERT INTO traders (player_id, player_name, total_trades, successful_trades, total_volume)
       VALUES ($1, (SELECT email FROM users WHERE id = $1), 1, 1, $2::numeric)
       ON CONFLICT (player_id) DO UPDATE SET
         total_trades = traders.total_trades + 1,
         successful_trades = traders.successful_trades + 1,
         total_volume = traders.total_volume + $2::numeric`,
      [sellerId, fromUnits(grossU)]
    );

    await client.query(
      `INSERT INTO market_price_history (resource, price, volume, synthetic)
       VALUES ($1, $2::numeric, $3::numeric, FALSE)`,
      [resource, fromUnits(tradePriceU), fromUnits(tradeQuantityU)]
    );

    /*
     * Клиентская запись расчёта: settlement='vault', status='applied'.
     * Сделка УЖЕ рассчитана в сейфе, поэтому строка — история, а не задание.
     * GET /api/market/pending-transactions её не отдаёт (там фильтр
     * status='pending' AND settlement='client'), и старый клиент не может
     * начислить сделку второй раз. Числа — фактические:
     *   покупатель: ушло gross + его комиссия;
     *   продавец:   пришло gross - его комиссия.
     */
    await client.query(
      `INSERT INTO market_pending_transactions
        (trade_id, player_id, transaction_type, resource, resource_amount, credits_amount, fee_amount,
         status, applied_at, settlement)
       VALUES ($1, $2, 'buy', $3, $4::numeric, $5::numeric, $6::numeric, 'applied', NOW(), 'vault')
       ON CONFLICT (trade_id, player_id) DO NOTHING`,
      [tradeId, buyerId, resource, fromUnits(tradeQuantityU), fromUnits(buyerChargeU), fromUnits(buyerFeeU)]
    );
    await client.query(
      `INSERT INTO market_pending_transactions
        (trade_id, player_id, transaction_type, resource, resource_amount, credits_amount, fee_amount,
         status, applied_at, settlement)
       VALUES ($1, $2, 'sell', $3, $4::numeric, $5::numeric, $6::numeric, 'applied', NOW(), 'vault')
       ON CONFLICT (trade_id, player_id) DO NOTHING`,
      [tradeId, sellerId, resource, fromUnits(tradeQuantityU), fromUnits(grossU - sellerFeeU), fromUnits(sellerFeeU)]
    );

    executedTrades.push({
      id: tradeId,
      buyOrderId,
      sellOrderId,
      buyerId: String(buyerId),
      sellerId: String(sellerId),
      resource,
      quantity: fromUnits(tradeQuantityU),
      pricePerUnit: fromUnits(tradePriceU),
      totalAmount: fromUnits(grossU),
      fee: fromUnits(totalFeeU),
      buyerFee: fromUnits(buyerFeeU),
      sellerFee: fromUnits(sellerFeeU),
      executedAt: new Date(tradeResult.rows[0].executed_at).getTime(),
    });

    remainingU -= tradeQuantityU;
    fills += 1;
  }

  return executedTrades;
}

/**
 * Применить исполнение к ордеру: quantity_filled += q, статус, списание эскроу.
 * Всё считает сам NUMERIC — в JS не уезжает ни одного промежуточного значения.
 */
async function applyFillToOrder(client, orderId, tradeQuantityU, spentResourceU, spentCreditsU) {
  // trim_scale — чтобы NUMERIC не тащил за собой шкалу операндов и клиент не видел
  // «50.0000000» вместо «50» (см. тот же приём в market-vault.js).
  const res = await client.query(
    `UPDATE market_orders
        SET quantity_filled = trim_scale(quantity_filled + $2::numeric),
            status = CASE WHEN quantity_filled + $2::numeric >= quantity THEN 'filled' ELSE 'partial' END,
            escrow_resource = trim_scale(escrow_resource - $3::numeric),
            escrow_credits = trim_scale(escrow_credits - $4::numeric)
      WHERE id = $1
      RETURNING quantity_filled::text AS quantity_filled, status,
                escrow_resource::text AS escrow_resource, escrow_credits::text AS escrow_credits`,
    [orderId, fromUnits(tradeQuantityU), fromUnits(spentResourceU), fromUnits(spentCreditsU)]
  );
  if (res.rowCount === 0) throw new Error(`ORDER_VANISHED: ${orderId}`);
  return {
    quantityFilled: res.rows[0].quantity_filled,
    status: res.rows[0].status,
    escrowResource: res.rows[0].escrow_resource,
    escrowCredits: res.rows[0].escrow_credits,
  };
}

export { MARKET_CONSTANTS, TRADEABLE_RESOURCES };
