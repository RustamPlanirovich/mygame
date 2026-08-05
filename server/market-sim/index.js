/**
 * server/market-sim/index.js
 *
 * Оркестратор рыночной симуляции.
 *
 * - Тик привязан к настенным часам: tick = floor((now - epochMs) / TICK_MS).
 *   Поэтому перезапуск сервера не «телепортирует» цены: мы просто доигрываем
 *   пропущенные тики теми же самыми хешами и приходим в то же состояние,
 *   в котором был бы непрерывно работающий процесс.
 * - Шаг защищён pg advisory-lock (от параллельного процесса) И оптимистичной
 *   проверкой тика при записи (от гонки внутри одного тика).
 * - lastSnapshot держится в памяти, чтобы синхронные fallback-обёртки оракула
 *   (getFallbackMarketPrediction и т.п.) могли отдать данные без await.
 */

import {
  TICK_MS,
  DAY_TICKS,
  ENGINE_VERSION,
  coldStartState,
  migrateState,
  stepTick,
  buildSnapshot,
} from './engine.js';
import {
  initMarketSimTables,
  loadState,
  saveState,
  appendStockHistory,
  seedResourceQuotes,
  persistEvents,
  pruneHistory,
  readHistory,
  withAdvisoryLock,
} from './persistence.js';
import { assertParity, RESOURCE_UNIVERSE, STOCKS } from './universe.js';
import { regimeLabelRu } from './regime.js';
import { buildMarketPrediction, buildDividends, buildRecommendations } from './payloads.js';

export { TICK_MS, DAY_TICKS };

/** Максимум тиков, которые доигрываем за один заход (7 суток). */
const MAX_CATCHUP_TICKS = DAY_TICKS * 7;

/**
 * Сид для синхронного холодного старта (когда БД ещё не прочитана).
 * Фиксированный — чтобы такой ответ был воспроизводимым, а не случайным.
 */
export const DEFAULT_WORLD_SEED = 1_874_263_951;

let lastSnapshot = null;
let lastState = null;
let timer = null;
let stepping = false;

/** Текущий снимок из памяти (синхронно). null — ещё ни одного шага не было. */
export function getSnapshot() {
  return lastSnapshot;
}

/**
 * Снимок из памяти или детерминированный холодный (без обращения к БД).
 * Нужен для синхронных fallback-обёрток в ai-oracle.js.
 */
export function getSnapshotOrCold(worldSeed = DEFAULT_WORLD_SEED) {
  if (lastSnapshot) return lastSnapshot;
  const epochMs = Date.now();
  const cold = coldStartState(worldSeed, 0, epochMs);
  return buildSnapshot(cold);
}

/** Тик по настенным часам. */
function wallTick(epochMs, now) {
  return Math.floor((Number(now) - Number(epochMs)) / TICK_MS);
}

function newWorldSeed(now) {
  // Разыгрывается ОДИН раз в жизни установки и сохраняется в БД навсегда.
  // Дальше вся случайность выводится из него хешами, поэтому здесь допустимо
  // взять время старта: воспроизводимость обеспечивается сохранением сида.
  const t = Number(now);
  return ((t % 2_147_483_647) * 2 + 1) % 4_294_967_291;
}

/**
 * Один цикл продвижения симуляции до текущего настенного тика.
 * @returns снимок рынка (никогда не null)
 */
export async function stepMarketSim(pool, { now = Date.now() } = {}) {
  if (stepping) {
    // Параллельный вызов внутри процесса — отдаём последний снимок.
    return lastSnapshot || getSnapshotOrCold();
  }
  stepping = true;
  try {
    const { locked, result } = await withAdvisoryLock(pool, () => advance(pool, now));
    if (locked) return result;

    // Лок держит другой процесс — читаем состояние только для чтения.
    const state = await loadState(pool);
    if (state) {
      lastState = state.engineVersion === ENGINE_VERSION ? state : migrateState(state);
      lastSnapshot = buildSnapshot(lastState);
    }
    return lastSnapshot || getSnapshotOrCold();
  } catch (e) {
    console.error('[market-sim] step failed:', e.message);
    return lastSnapshot || getSnapshotOrCold();
  } finally {
    stepping = false;
  }
}

async function advance(pool, now) {
  let state = await loadState(pool);
  let firstInsert = false;
  let expectedTick = null;

  if (!state) {
    const seed = newWorldSeed(now);
    state = coldStartState(seed, 0, now);
    firstInsert = true;
    console.log(`[market-sim] cold start, worldSeed=${seed}`);
  } else {
    expectedTick = state.tick;
    if (state.engineVersion !== ENGINE_VERSION) {
      console.log(
        `[market-sim] engine ${state.engineVersion} -> ${ENGINE_VERSION}: пересчитываем производные, цены сохраняем`
      );
      state = migrateState(state);
    }
  }

  const target = wallTick(state.epochMs, now);
  let gap = target - state.tick;

  if (gap > MAX_CATCHUP_TICKS) {
    console.log(
      `[market-sim] пропуск ${gap} тиков превышает лимит ${MAX_CATCHUP_TICKS}: доигрываем последние ${DAY_TICKS}`
    );
    state = { ...state, tick: target - DAY_TICKS, regimeStartedTick: target - DAY_TICKS };
    gap = DAY_TICKS;
  }

  if (gap > 0) {
    for (let i = 1; i <= gap; i++) {
      state = stepTick(state, state.tick + 1, state.worldSeed);
    }
  }

  const wrote = await saveState(pool, state, firstInsert ? null : expectedTick);
  if (!wrote) {
    // Кто-то опередил нас — перечитываем и НЕ пишем.
    const fresh = await loadState(pool);
    if (fresh) {
      lastState = fresh.engineVersion === ENGINE_VERSION ? fresh : migrateState(fresh);
      lastSnapshot = buildSnapshot(lastState);
      return lastSnapshot;
    }
  } else if (gap > 0 || firstInsert) {
    await appendStockHistory(pool, state);
    await seedResourceQuotes(pool, state);
    await persistEvents(pool, state);
    if (state.tick % DAY_TICKS === 0 || firstInsert) {
      await pruneHistory(pool, state.tick);
    }
  }

  lastState = state;
  lastSnapshot = buildSnapshot(state);
  return lastSnapshot;
}

/** Запуск: догоняем настенный тик и встаём на 5-минутный интервал. */
export async function startMarketSim(pool) {
  assertParity();
  await initMarketSimTables(pool);

  const snap = await stepMarketSim(pool);
  console.log(
    `[market-sim] started: tick=${snap.tick}, режим=${regimeLabelRu(snap.regime)}, ` +
      `акций=${snap.stocks.length}, ресурсов=${snap.resources.length}, ставка=${(snap.baseRate * 100).toFixed(2)}%`
  );

  stopMarketSim();
  timer = setInterval(() => {
    stepMarketSim(pool).catch((e) => console.error('[market-sim] scheduled step failed:', e.message));
  }, TICK_MS);
  // unref: симуляция не должна мешать процессу завершиться.
  if (typeof timer.unref === 'function') timer.unref();

  return snap;
}

export function stopMarketSim() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

/**
 * HTTP-роуты симуляции.
 *
 * GET /api/market/stock-prices — АВТОРИТЕТНЫЕ цены акций.
 * Именно это лечит баг «100 игроков видят 100 разных цен»: раньше каждый клиент
 * крутил свой Math.random() в src/utils/stockSimulator.ts.
 */
export function createMarketSimRoutes(app, pool) {
  app.get('/api/market/stock-prices', async (_req, res) => {
    try {
      const snap = lastSnapshot || (await stepMarketSim(pool));
      res.json({
        ok: true,
        authoritative: true,
        source: 'local-sim',
        tick: snap.tick,
        timeMs: snap.timeMs,
        intervalMs: TICK_MS,
        nextUpdateAt: snap.timeMs + TICK_MS,
        regime: snap.regime,
        regimeRu: regimeLabelRu(snap.regime),
        overallSentiment: snap.overallSentiment,
        baseRate: snap.baseRate,
        stocks: snap.stocks.map((s) => ({
          id: s.id,
          symbol: s.symbol,
          sector: s.sector,
          volatility: s.volatility,
          basePrice: s.basePrice,
          marketCap: s.marketCap,
          currentPrice: s.price,
          previousClose: s.prevClose,
          dayChange: s.dayChange,
          volume: s.volume,
          dividendYield: s.dividendYield,
        })),
      });
    } catch (e) {
      console.error('[market-sim] stock-prices failed:', e);
      res.status(500).json({ ok: false, error: String(e?.message ?? e) });
    }
  });

  app.get('/api/market/stock-prices/:stockId/history', async (req, res) => {
    try {
      const { stockId } = req.params;
      if (!STOCKS.some((s) => s.id === stockId)) {
        res.status(400).json({ ok: false, error: 'INVALID_STOCK' });
        return;
      }
      const limit = Math.min(parseInt(req.query.limit, 10) || DAY_TICKS, 2016);
      const history = await readHistory(pool, stockId, limit);
      res.json({ ok: true, stockId, intervalMs: TICK_MS, history });
    } catch (e) {
      console.error('[market-sim] history failed:', e);
      res.status(500).json({ ok: false, error: String(e?.message ?? e) });
    }
  });

  app.get('/api/market/sim-status', async (_req, res) => {
    const snap = lastSnapshot;
    res.json({
      ok: true,
      running: timer !== null,
      engineVersion: ENGINE_VERSION,
      intervalMs: TICK_MS,
      resources: RESOURCE_UNIVERSE.length,
      stocks: STOCKS.length,
      snapshot: snap
        ? {
            tick: snap.tick,
            timeMs: snap.timeMs,
            regime: snap.regime,
            regimeRu: regimeLabelRu(snap.regime),
            regimeAgeHours: Math.round((snap.regimeAgeTicks / 12) * 10) / 10,
            overallSentiment: snap.overallSentiment,
            baseRate: snap.baseRate,
            rateDirection: snap.rateDirection,
            breadth: Math.round(snap.breadth * 1000) / 1000,
            activeEvents: snap.events.filter((e) => e.phase !== 'done').length,
          }
        : null,
    });
  });
}

/** Синхронные сборщики документов из последнего снимка (для оракула). */
export function localMarketPrediction() {
  return buildMarketPrediction(getSnapshotOrCold());
}
export function localDividends() {
  return buildDividends(getSnapshotOrCold());
}
export function localRecommendations() {
  return buildRecommendations(getSnapshotOrCold());
}

/** Для тестов/диагностики. */
export function getState() {
  return lastState;
}
