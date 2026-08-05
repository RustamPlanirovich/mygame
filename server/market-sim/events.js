/**
 * server/market-sim/events.js
 *
 * Новостные события с расписанием вперёд.
 *
 * Событие не «применяется мгновенно», а живёт по фазам:
 *   announceTick -> startTick : слух (доставляется ~20% движения, есть время прочитать новость)
 *   startTick    -> peakTick  : основное движение (+65%)
 *   peakTick     -> endTick   : развязка. Обычное событие доносит остаток,
 *                              пузырь (bubble) лопается и уходит ниже нуля,
 *                              распродажа (relief) частично отыгрывается вверх.
 *
 * Всё расписание фиксируется в момент рождения события и сохраняется в БД
 * (таблица market_sim_events), поэтому после перезапуска сервера событие
 * продолжает разворачиваться ровно так же и прогноз остаётся согласованным.
 */

import { unit, unitInt, variantIndex } from './rng.js';
import { SECTORS, SECTOR_RU, STOCKS, STOCK_BY_ID, STOCK_PARAMS } from './universe.js';

/** Максимум одновременно живущих событий. */
export const MAX_ACTIVE_EVENTS = 2;

/** 8 шаблонов: их достаточно, чтобы причина была узнаваемой, но не превращалась в шум. */
export const EVENT_TEMPLATES = [
  {
    id: 'breakthrough',
    scope: 'sector',
    sign: 1,
    shape: 'normal',
    weight: 1.0,
    mag: [0.08, 0.18],
    head: (t) => `Технологический прорыв: ${t}`,
    rumour: (t) => `Слухи о прорыве в секторе ${t}`,
    reason: 'подтверждён технологический прорыв',
  },
  {
    id: 'megacontract',
    scope: 'sector',
    sign: 1,
    shape: 'normal',
    weight: 1.0,
    mag: [0.06, 0.14],
    head: (t) => `Мегаконтракт для сектора ${t}`,
    rumour: (t) => `На рынке ждут крупный заказ в секторе ${t}`,
    reason: 'подписан крупный контракт',
  },
  {
    id: 'regulation',
    scope: 'sector',
    sign: -1,
    shape: 'normal',
    weight: 1.0,
    mag: [0.07, 0.16],
    head: (t) => `Регуляторный удар по сектору ${t}`,
    rumour: (t) => `Готовится ужесточение правил для сектора ${t}`,
    reason: 'новые требования регулятора',
  },
  {
    id: 'supply_shock',
    scope: 'sector',
    sign: -1,
    shape: 'normal',
    weight: 1.0,
    mag: [0.06, 0.15],
    head: (t) => `Сбой поставок в секторе ${t}`,
    rumour: (t) => `Поставщики предупреждают о перебоях: сектор ${t}`,
    reason: 'сорваны поставки комплектующих',
  },
  {
    id: 'bubble',
    scope: 'sector',
    sign: 1,
    shape: 'bubble',
    weight: 0.6,
    mag: [0.14, 0.26],
    head: (t) => `Спекулятивный пузырь в секторе ${t}`,
    rumour: (t) => `Приток спекулятивных денег в сектор ${t}`,
    reason: 'спекулятивный перегрев и его схлопывание',
  },
  {
    id: 'crash_relief',
    scope: 'sector',
    sign: -1,
    shape: 'relief',
    weight: 0.7,
    mag: [0.12, 0.24],
    head: (t) => `Паническая распродажа: ${t}`,
    rumour: (t) => `Крупные держатели готовят выход из сектора ${t}`,
    reason: 'паническая распродажа с последующим отскоком',
  },
  {
    id: 'merger',
    scope: 'stock',
    sign: 1,
    shape: 'normal',
    weight: 0.9,
    mag: [0.1, 0.22],
    head: (t) => `${t}: сделка по слиянию`,
    rumour: (t) => `${t}: слухи о поглощении`,
    reason: 'сделка по слиянию',
  },
  {
    id: 'scandal',
    scope: 'stock',
    sign: -1,
    shape: 'normal',
    weight: 0.9,
    mag: [0.1, 0.24],
    head: (t) => `${t}: корпоративный скандал`,
    rumour: (t) => `${t}: в прессу утекли неудобные документы`,
    reason: 'корпоративный скандал',
  },
];

const TEMPLATE_BY_ID = Object.fromEntries(EVENT_TEMPLATES.map((t) => [t.id, t]));

/** Базовая вероятность рождения события за тик (≈ раз в 14 часов на слот). */
const BASE_SPAWN_RATE = 0.006;

/** Насколько режим смещает выбор знака события. */
const REGIME_NEGATIVE_BIAS = {
  bull: 0.35,
  melt_up: 0.4,
  sideways: 0.5,
  bear: 0.68,
  crisis: 0.8,
};

function lerp(a, b, u) {
  return a + (b - a) * u;
}

/**
 * Пробует создать новое событие на тике. Чистая функция.
 * @returns событие или null
 */
export function maybeSpawnEvent({ tick, worldSeed, regime, activeCount }) {
  if (activeCount >= MAX_ACTIVE_EVENTS) return null;

  const rate = BASE_SPAWN_RATE * (regime === 'crisis' || regime === 'melt_up' ? 1.8 : 1);
  if (unit(worldSeed, tick, 'evt:spawn', activeCount) >= rate) return null;

  // Выбираем знак согласно режиму, затем шаблон нужного знака по весам.
  const wantNegative = unit(worldSeed, tick, 'evt:sign', '') < (REGIME_NEGATIVE_BIAS[regime] ?? 0.5);
  const pool = EVENT_TEMPLATES.filter((t) => (wantNegative ? t.sign < 0 : t.sign > 0));
  let total = 0;
  for (const t of pool) total += t.weight;
  let r = unit(worldSeed, tick, 'evt:tpl', '') * total;
  let tpl = pool[pool.length - 1];
  for (const t of pool) {
    r -= t.weight;
    if (r <= 0) {
      tpl = t;
      break;
    }
  }

  let scope = tpl.scope;
  let target;
  let sector;
  let titleRu;

  if (scope === 'sector') {
    sector = SECTORS[unitInt(worldSeed, tick, 'evt:sector', '', SECTORS.length)];
    target = sector;
    titleRu = SECTOR_RU[sector];
  } else {
    const st = STOCKS[unitInt(worldSeed, tick, 'evt:stock', '', STOCKS.length)];
    target = st.id;
    sector = st.sector;
    titleRu = st.symbol;
  }

  const uMag = unit(worldSeed, tick, 'evt:mag', target);
  // Волатильные бумаги двигаются сильнее на той же новости.
  const volScale =
    scope === 'stock' ? 0.7 + 2.0 * STOCK_PARAMS[target].trend * 10 : 1.0;
  const magnitude = Math.min(0.35, lerp(tpl.mag[0], tpl.mag[1], uMag) * volScale);

  const rumourLen = 12 + unitInt(worldSeed, tick, 'evt:d1', target, 25);   // 1..3 часа
  const riseLen = 24 + unitInt(worldSeed, tick, 'evt:d2', target, 73);     // 2..8 часов
  const fadeLen = 24 + unitInt(worldSeed, tick, 'evt:d3', target, 49);     // 2..6 часов

  const announceTick = Number(tick);
  const startTick = announceTick + rumourLen;
  const peakTick = startTick + riseLen;
  const endTick = peakTick + fadeLen;

  const variant = variantIndex(worldSeed, tick, 'evt:variant', 1, target);

  return {
    id: `${tpl.id}:${target}:${announceTick}`,
    template: tpl.id,
    scope,
    target,
    sector,
    sign: tpl.sign,
    shape: tpl.shape,
    magnitude,
    announceTick,
    startTick,
    peakTick,
    endTick,
    headline: tpl.head(titleRu),
    rumourHeadline: tpl.rumour(titleRu),
    reason: tpl.reason,
    variant,
  };
}

/** Текущая фаза события на тике. */
export function eventPhase(ev, tick) {
  const t = Number(tick);
  if (t < ev.announceTick) return 'scheduled';
  if (t < ev.startTick) return 'rumour';
  if (t < ev.peakTick) return 'active';
  if (t < ev.endTick) return 'fade';
  return 'done';
}

export const PHASE_RU = {
  scheduled: 'ожидается',
  rumour: 'слухи',
  active: 'развитие',
  fade: 'развязка',
  done: 'отыграно',
};

/**
 * Доля полного движения, доставленная к тику t (со знаком «формы»).
 * Для пузыря итог отрицательный (-0.9), для распродажи — частичный откат (0.4).
 */
export function deliveredFraction(ev, tick) {
  const t = Number(tick);
  if (t <= ev.announceTick) return 0;

  const rumourSpan = Math.max(1, ev.startTick - ev.announceTick);
  const riseSpan = Math.max(1, ev.peakTick - ev.startTick);
  const fadeSpan = Math.max(1, ev.endTick - ev.peakTick);

  if (t < ev.startTick) {
    return 0.2 * ((t - ev.announceTick) / rumourSpan);
  }
  if (t < ev.peakTick) {
    return 0.2 + 0.65 * ((t - ev.startTick) / riseSpan);
  }

  const q = Math.min(1, (t - ev.peakTick) / fadeSpan);
  if (ev.shape === 'bubble') return 0.85 - 1.75 * q; // -> -0.90
  if (ev.shape === 'relief') return 0.85 - 0.45 * q; // -> +0.40
  return 0.85 + 0.15 * q; // -> 1.00
}

/** Вес влияния события на конкретную акцию. */
export function eventWeight(ev, stockId) {
  const st = STOCK_BY_ID[stockId];
  if (!st) return 0;
  if (ev.scope === 'sector') return st.sector === ev.target ? 1 : 0;
  if (stockId === ev.target) return 1;
  return st.sector === ev.sector ? 0.3 : 0;
}

/** Вклад события в лог-дрейф акции на тике t (разность накопленных долей). */
export function eventDrift(ev, stockId, tick) {
  const w = eventWeight(ev, stockId);
  if (w === 0) return 0;
  const d = deliveredFraction(ev, tick) - deliveredFraction(ev, tick - 1);
  return ev.sign * ev.magnitude * w * d;
}

/** Суммарный дрейф от всех событий. */
export function totalEventDrift(events, stockId, tick) {
  let sum = 0;
  for (const ev of events) sum += eventDrift(ev, stockId, tick);
  return sum;
}

/** Событие ещё живо на тике (можно держать в состоянии)? */
export function isEventAlive(ev, tick) {
  return Number(tick) <= ev.endTick;
}

export function templateById(id) {
  return TEMPLATE_BY_ID[id];
}
