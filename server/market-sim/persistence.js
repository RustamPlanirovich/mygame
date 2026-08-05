/**
 * server/market-sim/persistence.js
 *
 * Схема и доступ к БД для рыночной симуляции.
 *
 * Все таблицы создаются через CREATE TABLE IF NOT EXISTS в initMarketSimTables():
 * .sql-файлы в server/ применяются руками и на практике часто не применены,
 * поэтому полагаться на них нельзя (миграция server/migration_market_sim.sql
 * существует только для удобства DBA и повторяет этот же DDL).
 *
 * Состояние — ОДНА строка (id=1), перезаписываемая раз в тик (~5 минут).
 * Запись защищена оптимистичной проверкой tick: UPDATE ... WHERE tick = $expected.
 * Если другой процесс уже продвинул тик — rowCount = 0, и мы не пишем.
 */

import { RESOURCE_UNIVERSE } from './universe.js';
import { STOCK_IDS } from './universe.js';
import { DAY_TICKS } from './engine.js';

/** Ключ advisory-lock: защищает шаг симуляции от параллельного выполнения. */
export const MARKET_SIM_LOCK_KEY = 815342001;

/** Сколько тиков истории держим: 7 суток. */
export const HISTORY_RETENTION_TICKS = DAY_TICKS * 7;

export async function initMarketSimTables(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS market_sim_state (
      id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      world_seed BIGINT NOT NULL,
      epoch_ms BIGINT NOT NULL,
      tick BIGINT NOT NULL,
      regime TEXT NOT NULL,
      regime_started_tick BIGINT NOT NULL,
      base_rate DOUBLE PRECISION NOT NULL,
      rate_lag JSONB NOT NULL DEFAULT '[]'::jsonb,
      sector_state JSONB NOT NULL DEFAULT '{}'::jsonb,
      stock_state JSONB NOT NULL DEFAULT '{}'::jsonb,
      resource_state JSONB NOT NULL DEFAULT '{}'::jsonb,
      events JSONB NOT NULL DEFAULT '[]'::jsonb,
      engine_version INTEGER NOT NULL DEFAULT 1,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS market_sim_stock_history (
      stock_id TEXT NOT NULL,
      tick BIGINT NOT NULL,
      price DOUBLE PRECISION NOT NULL,
      volume DOUBLE PRECISION NOT NULL DEFAULT 0,
      day_change DOUBLE PRECISION NOT NULL DEFAULT 0,
      recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (stock_id, tick)
    );
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_market_sim_hist_tick ON market_sim_stock_history(tick DESC);`
  );

  /**
   * Референсные котировки товаров.
   * Держим ИХ ОТДЕЛЬНО от market_price_history: там лежат реальные сделки игроков,
   * и подмешивание синтетики испортило бы volume24h/avgPrice24h, которые наполняет
   * триггер trigger_record_price_history.
   */
  await pool.query(`
    CREATE TABLE IF NOT EXISTS market_sim_resource_quotes (
      resource TEXT PRIMARY KEY,
      tick BIGINT NOT NULL,
      price DOUBLE PRECISION NOT NULL,
      reference_price DOUBLE PRECISION NOT NULL,
      change_pct DOUBLE PRECISION NOT NULL DEFAULT 0,
      indicative_volume DOUBLE PRECISION NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS market_sim_events (
      id TEXT PRIMARY KEY,
      template TEXT NOT NULL,
      scope TEXT NOT NULL,
      target TEXT NOT NULL,
      sector TEXT NOT NULL,
      sign SMALLINT NOT NULL,
      shape TEXT NOT NULL,
      magnitude DOUBLE PRECISION NOT NULL,
      announce_tick BIGINT NOT NULL,
      start_tick BIGINT NOT NULL,
      peak_tick BIGINT NOT NULL,
      end_tick BIGINT NOT NULL,
      headline TEXT NOT NULL,
      rumour_headline TEXT NOT NULL,
      reason TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_market_sim_events_end ON market_sim_events(end_tick DESC);`
  );

  /**
   * Флаг синтетики на реальной истории цен.
   * Сейчас симулятор туда НЕ пишет, но столбец нужен, чтобы любые будущие
   * синтетические строки можно было исключить из агрегатов 24ч.
   */
  await pool.query(
    `ALTER TABLE market_price_history ADD COLUMN IF NOT EXISTS synthetic BOOLEAN NOT NULL DEFAULT FALSE;`
  ).catch((e) => {
    // market_price_history создаётся в market.js/миграции; если её ещё нет — не падаем.
    console.warn('[market-sim] не удалось добавить market_price_history.synthetic:', e.message);
  });

  console.log('[market-sim] tables initialized');
}

/** Загрузка состояния. null — строки нет (нужен холодный старт). */
export async function loadState(pool) {
  const res = await pool.query(
    `SELECT world_seed, epoch_ms, tick, regime, regime_started_tick, base_rate,
            rate_lag, sector_state, stock_state, resource_state, events, engine_version
     FROM market_sim_state WHERE id = 1`
  );
  if (res.rowCount === 0) return null;
  const r = res.rows[0];
  return {
    engineVersion: r.engine_version,
    worldSeed: Number(r.world_seed),
    epochMs: Number(r.epoch_ms),
    tick: Number(r.tick),
    regime: r.regime,
    regimeStartedTick: Number(r.regime_started_tick),
    baseRate: Number(r.base_rate),
    rateLag: Array.isArray(r.rate_lag) ? r.rate_lag.map(Number) : [],
    sectors: r.sector_state || {},
    stocks: r.stock_state || {},
    resources: r.resource_state || {},
    events: Array.isArray(r.events) ? r.events : [],
  };
}

/**
 * Сохранение состояния с оптимистичной проверкой тика.
 * @param expectedTick тик, который мы считали текущим до шага; null — первая вставка.
 * @returns true, если запись действительно прошла.
 */
export async function saveState(pool, state, expectedTick) {
  const params = [
    state.worldSeed,
    state.epochMs,
    state.tick,
    state.regime,
    state.regimeStartedTick,
    state.baseRate,
    JSON.stringify(state.rateLag),
    JSON.stringify(state.sectors),
    JSON.stringify(state.stocks),
    JSON.stringify(state.resources),
    JSON.stringify(state.events),
    state.engineVersion,
  ];

  if (expectedTick === null || expectedTick === undefined) {
    const res = await pool.query(
      `INSERT INTO market_sim_state
         (id, world_seed, epoch_ms, tick, regime, regime_started_tick, base_rate,
          rate_lag, sector_state, stock_state, resource_state, events, engine_version, updated_at)
       VALUES (1, $1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb,$11::jsonb,$12, NOW())
       ON CONFLICT (id) DO NOTHING`,
      params
    );
    return res.rowCount > 0;
  }

  const res = await pool.query(
    `UPDATE market_sim_state SET
       world_seed = $1, epoch_ms = $2, tick = $3, regime = $4, regime_started_tick = $5,
       base_rate = $6, rate_lag = $7::jsonb, sector_state = $8::jsonb, stock_state = $9::jsonb,
       resource_state = $10::jsonb, events = $11::jsonb, engine_version = $12, updated_at = NOW()
     WHERE id = 1 AND tick = $13`,
    params.concat([expectedTick])
  );
  return res.rowCount > 0;
}

/** История цен акций за тик (12 строк одним INSERT). */
export async function appendStockHistory(pool, state) {
  const values = [];
  const params = [];
  let i = 1;
  for (const id of STOCK_IDS) {
    const s = state.stocks[id];
    if (!s) continue;
    values.push(`($${i++}, $${i++}, $${i++}, $${i++}, $${i++})`);
    params.push(id, state.tick, s.price, s.volume, s.dayChange);
  }
  if (values.length === 0) return;
  await pool.query(
    `INSERT INTO market_sim_stock_history (stock_id, tick, price, volume, day_change)
     VALUES ${values.join(',')}
     ON CONFLICT (stock_id, tick) DO NOTHING`,
    params
  );
}

/** Референсные котировки товаров (52 строки одним UPSERT). */
export async function seedResourceQuotes(pool, state) {
  const values = [];
  const params = [];
  let i = 1;
  for (const r of RESOURCE_UNIVERSE) {
    const q = state.resources[r];
    if (!q) continue;
    const ref = q.price / Math.exp(q.x || 0);
    const slow = Number.isFinite(q.xSlow) ? q.xSlow : q.x || 0;
    values.push(`($${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++})`);
    params.push(
      r,
      state.tick,
      q.price,
      Number.isFinite(ref) && ref > 0 ? ref : q.price,
      // change_pct = движение относительно среднего уровня за сутки (не отклонение от референса)
      100 * (Math.exp((q.x || 0) - slow) - 1),
      q.volume || 0
    );
  }
  if (values.length === 0) return;
  await pool.query(
    `INSERT INTO market_sim_resource_quotes
       (resource, tick, price, reference_price, change_pct, indicative_volume)
     VALUES ${values.join(',')}
     ON CONFLICT (resource) DO UPDATE SET
       tick = EXCLUDED.tick,
       price = EXCLUDED.price,
       reference_price = EXCLUDED.reference_price,
       change_pct = EXCLUDED.change_pct,
       indicative_volume = EXCLUDED.indicative_volume,
       updated_at = NOW()`,
    params
  );
}

/** Расписание событий — чтобы после перезапуска новость продолжалась, а не исчезала. */
export async function persistEvents(pool, state) {
  const events = state.events || [];
  if (events.length === 0) return;
  const values = [];
  const params = [];
  let i = 1;
  for (const e of events) {
    values.push(
      `($${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++})`
    );
    params.push(
      e.id, e.template, e.scope, e.target, e.sector, e.sign, e.shape, e.magnitude,
      e.announceTick, e.startTick, e.peakTick, e.endTick, e.headline, e.rumourHeadline, e.reason
    );
  }
  await pool.query(
    `INSERT INTO market_sim_events
       (id, template, scope, target, sector, sign, shape, magnitude,
        announce_tick, start_tick, peak_tick, end_tick, headline, rumour_headline, reason)
     VALUES ${values.join(',')}
     ON CONFLICT (id) DO NOTHING`,
    params
  );
}

/** Чистка истории и старых событий. */
export async function pruneHistory(pool, tick) {
  const cutoff = Number(tick) - HISTORY_RETENTION_TICKS;
  await pool.query(`DELETE FROM market_sim_stock_history WHERE tick < $1`, [cutoff]);
  await pool.query(`DELETE FROM market_sim_events WHERE end_tick < $1`, [cutoff]);
}

/** История одной акции для графика. */
export async function readHistory(pool, stockId, limit = DAY_TICKS) {
  const res = await pool.query(
    `SELECT tick, price, volume, day_change, recorded_at
     FROM market_sim_stock_history
     WHERE stock_id = $1
     ORDER BY tick DESC
     LIMIT $2`,
    [stockId, Math.min(Math.max(1, limit), 2016)]
  );
  return res.rows
    .map((r) => ({
      tick: Number(r.tick),
      price: Number(r.price),
      volume: Number(r.volume),
      dayChange: Number(r.day_change),
      timestamp: new Date(r.recorded_at).getTime(),
    }))
    .reverse();
}

/** Вся история за последние N тиков по всем акциям (одним запросом). */
export async function readAllHistory(pool, sinceTick) {
  const res = await pool.query(
    `SELECT stock_id, tick, price
     FROM market_sim_stock_history
     WHERE tick >= $1
     ORDER BY stock_id, tick ASC`,
    [sinceTick]
  );
  const out = {};
  for (const r of res.rows) {
    if (!out[r.stock_id]) out[r.stock_id] = [];
    out[r.stock_id].push({ tick: Number(r.tick), price: Number(r.price) });
  }
  return out;
}

/**
 * Выполняет fn под сессионным advisory-lock.
 * Нужен поверх проверки тика: pm2 работает в один процесс, но `npm run dev:api`
 * рядом с живым pm2 давал бы двойной шаг (и двойное проигрывание катчапа).
 * @returns {{locked: boolean, result: any}}
 */
export async function withAdvisoryLock(pool, fn, key = MARKET_SIM_LOCK_KEY) {
  const client = await pool.connect();
  try {
    const r = await client.query('SELECT pg_try_advisory_lock($1) AS ok', [key]);
    if (!r.rows[0]?.ok) return { locked: false, result: null };
    try {
      const result = await fn();
      return { locked: true, result };
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [key]);
    }
  } finally {
    client.release();
  }
}
