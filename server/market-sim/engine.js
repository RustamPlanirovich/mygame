/**
 * server/market-sim/engine.js
 *
 * Один тик рыночной симуляции — чистая функция без ввода-вывода.
 *
 * Модель по каждой акции (x = ln(P / A), A — «якорь» цены):
 *   x <- x - k*x + mu + u + J
 *     k  — сила возврата к среднему, выведена из целевого коридора: k = sB^2 / (2*targetSd^2).
 *          Это даёт стационарное СКО ровно targetSd, поэтому цена НИКОГДА не уходит в бесконечность.
 *     mu — дрейф: k * (равновесный уровень режима * рыночная бета + секторный тилт) + дрейф новостей.
 *          Режим двигает УРОВЕНЬ равновесия, а не накапливает тренд.
 *     u  — шок = sig * (b*z_рынок + c*z_сектор + e*z_идиосинкратический), b^2+c^2+e^2 = 1,
 *          поэтому b и c буквально равны корреляциям (одинаковый сектор: b_i*b_j + c_i*c_j).
 *     sig— GARCH-lite: h <- w + 0.10*u_прошлый^2 + 0.86*h. Волатильность кластеризуется
 *          (после сильного дня следующий тоже нервный), но зажата в [0.25, 16]*sB^2.
 *     J  — новостной скачок (Пуассон), интенсивность и знак задаёт режим.
 *
 * Кредитная ставка — процесс Орнштейна-Уленбека к цели режима.
 * Дивиденды — AR(1) вокруг штатной доходности акции, мультипликативно (акции роста с 0 остаются с 0).
 *
 * Всё случайное берётся из rng.js как hash(worldSeed, tick, stream, id) — Math.random() нет.
 */

import { unit, gauss, variantIndex, normalCdf } from './rng.js';
import { REGIME_PARAMS, stepRegime } from './regime.js';
import {
  SECTORS,
  STOCKS,
  STOCK_IDS,
  STOCK_PARAMS,
  SECTOR_SECULAR,
  EVENT_CATALOGUE,
  FUNDS,
  RESOURCE_UNIVERSE,
  RESOURCE_SECTORS,
  RESOURCE_REFERENCE_PRICES,
  RESOURCE_PARAMS,
  PASSTHROUGH,
  PASSTHROUGH_WEIGHT,
} from './universe.js';
import { maybeSpawnEvent, isEventAlive, totalEventDrift, eventPhase } from './events.js';

/** Тик = 5 минут = FINANCE_CONFIG.STOCK_UPDATE_INTERVAL_MS на клиенте. */
export const TICK_MS = 5 * 60 * 1000;
/** 288 тиков в сутках = FINANCE_CONFIG.MAX_PRICE_HISTORY_POINTS. */
export const DAY_TICKS = 288;
/** Горизонт прогноза: 12 тиков = 1 час (совпадает с циклом оракула). */
export const HORIZON = 12;
/** Длина кольца истории ставки: 144 тика = 12 часов. */
export const RATE_LAG_LEN = 144;
/** Версия движка: меняется при изменении формул. Цены при этом НЕ сбрасываются. */
export const ENGINE_VERSION = 1;

/**
 * Жёсткий потолок дивидендной доходности.
 *
 * ВАЖНО: financeStore.processDividends платит positionValue * newYield КАЖДЫЕ 7 дней
 * и НЕ делит на 52 (в отличие от stockSimulator.calculateDividends). Поэтому 0.06 здесь —
 * это ~6% от позиции в неделю; расширять этот потолок нельзя, иначе дивиденды
 * превращаются в бесконечные деньги.
 */
export const DIV_YIELD_CAP = 0.06;

/** Коэффициент EWMA для 24-часового моментума (полураспад 288 тиков). */
const MOM_ALPHA = 1 - Math.pow(2, -1 / DAY_TICKS);

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function safe(v, fallback = 0) {
  return Number.isFinite(v) ? v : fallback;
}

// ==========================================
// ХОЛОДНЫЙ СТАРТ
// ==========================================

/**
 * Детерминированное начальное состояние. Без БД и без Math.random:
 * тот же worldSeed + tick всегда дают то же состояние.
 */
export function coldStartState(worldSeed, tick = 0, epochMs = Date.now()) {
  const t = Number(tick);
  const stocks = {};
  for (const def of STOCKS) {
    const p = STOCK_PARAMS[def.id];
    const sB = p.trend;
    // Небольшой стартовый разброс, чтобы все акции не стояли ровно на базовой цене.
    const x = clamp(0.3 * p.targetSd * gauss(worldSeed, 0, 'init:x', def.id), -0.6, 0.6);
    const lnAnchor = Math.log(def.basePrice);
    const price = clamp(Math.exp(lnAnchor + x), def.basePrice * 0.1, def.basePrice * 10);
    stocks[def.id] = {
      x: Math.log(price / Math.exp(lnAnchor)),
      h: sB * sB,
      uPrev: 0,
      lnAnchor,
      price,
      prevClose: price,
      dayChange: 0,
      volume: 0,
      xSlow: x,
      divDelta: 0,
      divPublished: Math.min(def.dividendYield, DIV_YIELD_CAP),
      lastJump: null,
      attr: { mkt: 0, sec: 0, idio: 0, rev: 0, jump: 0, event: 0 },
    };
  }

  const sectors = {};
  for (const sec of SECTORS) {
    sectors[sec] = { theta: clamp(0.02 * gauss(worldSeed, 0, 'init:theta', sec), -0.1, 0.1) };
  }

  const resources = {};
  for (const r of RESOURCE_UNIVERSE) {
    const ref = RESOURCE_REFERENCE_PRICES[r];
    const x = clamp(0.3 * RESOURCE_PARAMS.targetSd * gauss(worldSeed, 0, 'init:res', r), -0.5, 0.5);
    resources[r] = { x, xSlow: x, dx: 0, price: ref * Math.exp(x), volume: 0 };
  }

  const baseRate = 0.09;

  return {
    engineVersion: ENGINE_VERSION,
    worldSeed: Number(worldSeed),
    epochMs: Number(epochMs),
    tick: t,
    regime: 'sideways',
    regimeStartedTick: t,
    baseRate,
    rateLag: [baseRate],
    sectors,
    stocks,
    resources,
    events: [],
  };
}

/**
 * Пересобирает производные поля состояния под текущую версию движка,
 * СОХРАНЯЯ цены, x и якоря (bump ENGINE_VERSION не должен сбрасывать рынок).
 */
export function migrateState(state) {
  const cold = coldStartState(state.worldSeed ?? 1, state.tick ?? 0, state.epochMs ?? Date.now());
  const out = {
    ...cold,
    ...state,
    engineVersion: ENGINE_VERSION,
    sectors: { ...cold.sectors, ...(state.sectors || {}) },
    stocks: { ...cold.stocks },
    resources: { ...cold.resources },
    events: Array.isArray(state.events) ? state.events : [],
    rateLag: Array.isArray(state.rateLag) && state.rateLag.length ? state.rateLag : cold.rateLag,
  };

  for (const id of STOCK_IDS) {
    const prev = state.stocks?.[id];
    if (!prev) continue;
    out.stocks[id] = {
      ...cold.stocks[id],
      ...prev,
      attr: { ...cold.stocks[id].attr, ...(prev.attr || {}) },
    };
  }
  for (const r of RESOURCE_UNIVERSE) {
    const prev = state.resources?.[r];
    if (!prev) continue;
    out.resources[r] = { ...cold.resources[r], ...prev };
  }
  return out;
}

// ==========================================
// ОДИН ТИК
// ==========================================

/**
 * Чистый шаг симуляции. prev.tick должен быть равен tick-1.
 * Повторный вызов с тем же tick даёт тот же результат (идемпотентность).
 */
export function stepTick(prev, tick, worldSeed) {
  const seed = Number(worldSeed ?? prev.worldSeed);
  const t = Number(tick);

  // --- 1. Режим ---
  const rg = stepRegime({
    regime: prev.regime,
    regimeStartedTick: prev.regimeStartedTick,
    tick: t,
    worldSeed: seed,
  });
  const rp = REGIME_PARAMS[rg.regime];

  // --- 2. Новостные события (расписание вперёд) ---
  let events = (prev.events || []).filter((ev) => isEventAlive(ev, t));
  const born = maybeSpawnEvent({ tick: t, worldSeed: seed, regime: rg.regime, activeCount: events.length });
  if (born) events = events.concat([born]);

  // --- 3. Факторы (единичная дисперсия) ---
  const zM = gauss(seed, t, 'mkt', 'M');
  const zS = {};
  for (const sec of SECTORS) zS[sec] = gauss(seed, t, 'sec', sec);

  // --- 4. Секторный тилт AR(1) + ротация режима ---
  const sectors = {};
  for (const sec of SECTORS) {
    const prevTheta = safe(prev.sectors?.[sec]?.theta, 0);
    const rot = rp.rotation?.[sec] ?? 0;
    const theta = clamp(0.985 * prevTheta + 0.012 * gauss(seed, t, 'theta', sec) + rot, -0.35, 0.35);
    sectors[sec] = { theta };
  }

  // --- 5. Кредитная ставка: OU к цели режима ---
  let baseRate = safe(prev.baseRate, 0.09);
  baseRate = baseRate + 0.004 * (rp.rateTarget - baseRate) + 0.00012 * gauss(seed, t, 'rate', 'base');
  baseRate = clamp(baseRate, 0.03, 0.22);
  const rateLag = (Array.isArray(prev.rateLag) ? prev.rateLag : []).concat([baseRate]);
  while (rateLag.length > RATE_LAG_LEN) rateLag.shift();

  const newDay = Math.floor(t / DAY_TICKS) !== Math.floor((t - 1) / DAY_TICKS);
  const newHour = Math.floor(t / HORIZON) !== Math.floor((t - 1) / HORIZON);

  // --- 6. Акции ---
  const stocks = {};
  for (const def of STOCKS) {
    const p = STOCK_PARAMS[def.id];
    const ps = prev.stocks?.[def.id] || coldStartState(seed, t).stocks[def.id];

    const sB = p.trend * rp.volMult;
    const w = sB * sB * 0.04;
    let h = w + 0.1 * safe(ps.uPrev) ** 2 + 0.86 * safe(ps.h, sB * sB);
    h = clamp(h, 0.25 * sB * sB, 16 * sB * sB);
    const sig = Math.sqrt(h);
    const k = (sB * sB) / (2 * p.targetSd * p.targetSd);

    // Бета к уровню режима: в кризисе у оборонки она отрицательная (хедж), у DARK — максимальная.
    const levelBeta = rg.regime === 'crisis' ? p.b * p.crisisBeta : p.b;
    const level = levelBeta * rp.levelTarget + sectors[def.sector].theta;
    const muRegime = k * level;
    const evDrift = totalEventDrift(events, def.id, t);
    const mu = muRegime + evDrift;

    const zIdio = gauss(seed, t, 'idio', def.id);
    const u = sig * (p.b * zM + p.c * zS[def.sector] + p.e * zIdio);

    // Скачок
    let J = 0;
    let lastJump = ps.lastJump || null;
    if (unit(seed, t, 'jmp', def.id) < rp.jumpLambda * p.jumpMult) {
      const down = unit(seed, t, 'jdir', def.id) < rp.downJumpProb;
      const mag = clamp(sB * (3 + 5 * unit(seed, t, 'jmag', def.id)), 0.02, 0.22);
      J = down ? -mag : mag;
      const phrases = EVENT_CATALOGUE[def.sector][down ? 'down' : 'up'];
      lastJump = {
        tick: t,
        size: J,
        reason: phrases[variantIndex(seed, t, 'jreason', phrases.length, def.id)],
      };
    }

    const xPrev = safe(ps.x, 0);
    let x = xPrev - k * xPrev + mu + u + J;
    x = clamp(x, Math.log(0.1), Math.log(10));

    // Якорь: очень медленный секулярный тренд сектора, зажатый вокруг базовой цены.
    const lnBase = Math.log(def.basePrice);
    const lnAnchor = clamp(
      safe(ps.lnAnchor, lnBase) + 2e-5 * (SECTOR_SECULAR[def.sector] ?? 0),
      lnBase - 0.4,
      lnBase + 0.7
    );
    const anchor = Math.exp(lnAnchor);

    // Тот же коридор цен, что и у клиентского stockSimulator: [10%, 1000%] от базовой.
    let price = anchor * Math.exp(x);
    price = clamp(price, def.basePrice * 0.1, def.basePrice * 10);
    if (!Number.isFinite(price) || price <= 0) price = def.basePrice;
    // Возвращаем x в согласованное с ценой состояние — иначе clamp «уплывёт».
    x = Math.log(price / anchor);

    const dx = x - xPrev;
    const prevClose = newDay ? safe(ps.price, price) : safe(ps.prevClose, price);
    const dayChange = prevClose > 0 ? 100 * (price / prevClose - 1) : 0;

    const volume =
      (def.marketCap / anchor) *
      0.01 *
      Math.exp(clamp((0.8 * Math.abs(dx)) / sB - 0.4, -2, 3)) *
      (0.7 + 0.6 * unit(seed, t, 'vol', def.id));

    const baseAttr = newHour
      ? { mkt: 0, sec: 0, idio: 0, rev: 0, jump: 0, event: 0 }
      : { ...(ps.attr || { mkt: 0, sec: 0, idio: 0, rev: 0, jump: 0, event: 0 }) };
    const attr = {
      mkt: safe(baseAttr.mkt) + sig * p.b * zM,
      sec: safe(baseAttr.sec) + sig * p.c * zS[def.sector],
      idio: safe(baseAttr.idio) + sig * p.e * zIdio,
      rev: safe(baseAttr.rev) + -k * xPrev,
      jump: safe(baseAttr.jump) + J,
      event: safe(baseAttr.event) + evDrift,
    };

    // Дивиденды: AR(1) вокруг штатной доходности, мультипликативно.
    const divDelta = clamp(
      0.97 * safe(ps.divDelta) + 0.02 * gauss(seed, t, 'div', def.id) + rp.divTilt,
      -0.6,
      0.6
    );
    const divYield = clamp(p.dividendYield * (1 + divDelta), 0, DIV_YIELD_CAP);

    stocks[def.id] = {
      x,
      h,
      // 0.5*J подмешиваем в «прошлый шок», чтобы после новости волатильность оставалась повышенной.
      uPrev: u + 0.5 * J,
      lnAnchor,
      price,
      prevClose,
      dayChange,
      volume,
      xSlow: safe(ps.xSlow, x) + MOM_ALPHA * (x - safe(ps.xSlow, x)),
      divDelta,
      divYield,
      divPublished: safe(ps.divPublished, p.dividendYield),
      lastJump,
      attr,
    };
  }

  // --- 7. Товарные ресурсы (тот же рынок, те же 8 секторов, + передел с лагом 1 тик) ---
  const resources = {};
  const rB = RESOURCE_PARAMS.tickSd * rp.volMult;
  const rK = (rB * rB) / (2 * RESOURCE_PARAMS.targetSd * RESOURCE_PARAMS.targetSd);
  const rE = Math.sqrt(Math.max(0.0001, 1 - RESOURCE_PARAMS.b ** 2 - RESOURCE_PARAMS.c ** 2));
  for (const r of RESOURCE_UNIVERSE) {
    const sec = RESOURCE_SECTORS[r];
    const ref = RESOURCE_REFERENCE_PRICES[r];
    const ps = prev.resources?.[r] || { x: 0, dx: 0, price: ref };
    const xPrev = safe(ps.x, 0);

    const level = RESOURCE_PARAMS.b * rp.levelTarget + sectors[sec].theta;
    const inputId = PASSTHROUGH[r];
    // Лаг 1 тик: берём изменение входного ресурса на ПРЕДЫДУЩЕМ тике.
    const pass = inputId ? PASSTHROUGH_WEIGHT * safe(prev.resources?.[inputId]?.dx, 0) : 0;
    const u =
      rB *
      (RESOURCE_PARAMS.b * zM + RESOURCE_PARAMS.c * zS[sec] + rE * gauss(seed, t, 'res', r));

    let x = clamp(xPrev - rK * xPrev + rK * level + u + pass, -1.4, 1.4);
    let price = clamp(ref * Math.exp(x), ref * 0.25, ref * 4);
    if (!Number.isFinite(price) || price <= 0) price = ref;
    x = Math.log(price / ref);

    resources[r] = {
      x,
      // EWMA с полураспадом в сутки: даёт честную «динамику за 24ч» без хранения истории.
      xSlow: safe(ps.xSlow, x) + MOM_ALPHA * (x - safe(ps.xSlow, x)),
      dx: x - xPrev,
      price,
      // Индикативный объём: это НЕ реальные сделки игроков, в volume24h он не попадает.
      volume: Math.round(100 * (0.5 + unit(seed, t, 'resvol', r))),
    };
  }

  return {
    engineVersion: ENGINE_VERSION,
    worldSeed: seed,
    epochMs: Number(prev.epochMs),
    tick: t,
    regime: rg.regime,
    regimeStartedTick: rg.regimeStartedTick,
    baseRate,
    rateLag,
    sectors,
    stocks,
    resources,
    events,
  };
}

// ==========================================
// ПРОИЗВОДНЫЕ ВЕЛИЧИНЫ И ПРОГНОЗ
// ==========================================

/** Восстанавливает k, sig, mu по состоянию (не храним в БД — выводим). */
export function deriveStock(state, stockId) {
  const p = STOCK_PARAMS[stockId];
  const rp = REGIME_PARAMS[state.regime] || REGIME_PARAMS.sideways;
  const ss = state.stocks[stockId];
  const sB = p.trend * rp.volMult;
  const sig = Math.sqrt(clamp(safe(ss.h, sB * sB), 0.25 * sB * sB, 16 * sB * sB));
  const k = (sB * sB) / (2 * p.targetSd * p.targetSd);
  const levelBeta = state.regime === 'crisis' ? p.b * p.crisisBeta : p.b;
  const level = levelBeta * rp.levelTarget + safe(state.sectors?.[p.sector]?.theta, 0);
  return { p, sB, sig, k, muRegime: k * level, level };
}

/** Корреляция доходностей двух акций — прямо из загрузок факторов. */
export function correlation(idA, idB) {
  if (idA === idB) return 1;
  const a = STOCK_PARAMS[idA];
  const b = STOCK_PARAMS[idB];
  if (!a || !b) return 0;
  return a.b * b.b + (a.sector === b.sector ? a.c * b.c : 0);
}

/**
 * Честный прогноз собственного процесса на H тиков вперёд.
 * m — ожидаемое лог-изменение, s — его СКО, t = m/s — сигнал в сигмах.
 * Дрейф уже запланированных новостей учитывается точно (он детерминирован).
 */
export function forecast(state, stockId, H = HORIZON) {
  const { sig, k, muRegime } = deriveStock(state, stockId);
  const ss = state.stocks[stockId];
  const x = safe(ss.x, 0);
  const one = 1 - k;
  const decay = Math.pow(one, H);

  let m = (decay - 1) * x + (muRegime / k) * (1 - decay);
  for (let j = 1; j <= H; j++) {
    m += totalEventDrift(state.events || [], stockId, state.tick + j) * Math.pow(one, H - j);
  }

  const varRatio = (1 - Math.pow(one, 2 * H)) / (1 - one * one);
  const s = sig * Math.sqrt(varRatio);
  const tStat = s > 0 ? m / s : 0;

  return {
    m: safe(m),
    s: safe(s, 1e-6),
    t: safe(tStat),
    pct: safe(100 * (Math.exp(m) - 1)),
    direction: Math.abs(tStat) > 0.15 ? (tStat > 0 ? 'up' : 'down') : 'stable',
    confidence: clamp(0.5 + 1.6 * (normalCdf(Math.abs(tStat)) - 0.5), 0.35, 0.95),
  };
}

/** Прогноз фонда: дисперсия честно считается через ковариации из загрузок. */
export function fundForecast(state, fundId, perStock) {
  const fund = FUNDS.find((f) => f.id === fundId);
  if (!fund) return null;

  let m = 0;
  for (const c of fund.composition) {
    const f = perStock[c.stockId];
    if (f) m += c.weight * f.m;
  }

  let varSum = 0;
  for (const ci of fund.composition) {
    for (const cj of fund.composition) {
      const fi = perStock[ci.stockId];
      const fj = perStock[cj.stockId];
      if (!fi || !fj) continue;
      varSum += ci.weight * cj.weight * fi.s * fj.s * correlation(ci.stockId, cj.stockId);
    }
  }
  const s = Math.sqrt(Math.max(varSum, 1e-12));
  const tStat = s > 0 ? m / s : 0;

  return {
    id: fund.id,
    riskLevel: fund.riskLevel,
    m: safe(m),
    s: safe(s, 1e-6),
    t: safe(tStat),
    pct: safe(100 * (Math.exp(m) - 1)),
    direction: Math.abs(tStat) > 0.15 ? (tStat > 0 ? 'up' : 'down') : 'stable',
    confidence: clamp(0.5 + 1.6 * (normalCdf(Math.abs(tStat)) - 0.5), 0.35, 0.95),
  };
}

/** Направление ставки: сравнение с уровнем 12 часов назад. */
export function rateDirection(state) {
  const lag = state.rateLag || [];
  const old = lag.length >= RATE_LAG_LEN ? lag[0] : lag[0] ?? state.baseRate;
  const d = state.baseRate - old;
  if (d > 0.0015) return 'rising';
  if (d < -0.0015) return 'falling';
  return 'stable';
}

/**
 * Полный снимок рынка — единственная структура, которую читают
 * narrative.js, payloads.js и HTTP-роуты.
 */
export function buildSnapshot(state) {
  const rp = REGIME_PARAMS[state.regime] || REGIME_PARAMS.sideways;

  const perStockForecast = {};
  const stocks = STOCKS.map((def) => {
    const ss = state.stocks[def.id];
    const d = deriveStock(state, def.id);
    const f = forecast(state, def.id);
    perStockForecast[def.id] = f;
    const p = d.p;
    return {
      id: def.id,
      symbol: def.symbol,
      name: def.name,
      sector: def.sector,
      volatility: def.volatility,
      basePrice: def.basePrice,
      marketCap: def.marketCap,
      price: ss.price,
      prevClose: ss.prevClose,
      dayChange: ss.dayChange,
      volume: ss.volume,
      x: ss.x,
      sig: d.sig,
      k: d.k,
      // Кросс-секционная мера риска бумаги (не зависит от режима): целевой коридор.
      targetSd: p.targetSd,
      // Волатильность относительно собственной нормы (для нарратива).
      relVol: d.sig / (p.trend || 1e-6),
      mom24h: safe(ss.x - safe(ss.xSlow, ss.x)),
      forecast: f,
      dividendYield: safe(ss.divYield, Math.min(p.dividendYield, DIV_YIELD_CAP)),
      dividendPublished: safe(ss.divPublished, p.dividendYield),
      lastJump: ss.lastJump || null,
      attr: ss.attr || { mkt: 0, sec: 0, idio: 0, rev: 0, jump: 0, event: 0 },
    };
  });

  const funds = FUNDS.map((f) => fundForecast(state, f.id, perStockForecast)).filter(Boolean);

  // Ширина рынка: доля капитализации с положительным прогнозом, взвешенно, в [-1, 1].
  const totalCap = STOCKS.reduce((a, s) => a + s.marketCap, 0);
  let breadth = 0;
  let upCount = 0;
  for (const s of stocks) {
    const sign = s.forecast.m > 0 ? 1 : s.forecast.m < 0 ? -1 : 0;
    breadth += (s.marketCap / totalCap) * sign;
    if (s.dayChange > 0) upCount++;
  }

  const avgSig = stocks.reduce((a, s) => a + s.sig, 0) / stocks.length;
  const normSig = STOCKS.reduce((a, s) => a + STOCK_PARAMS[s.id].trend, 0) / STOCKS.length;

  // Сентимент: нормированный уровень режима (0.25 — характерный масштаб коридора) + ширина рынка.
  const z = rp.levelTarget / 0.25 + 0.5 * breadth;
  const overallSentiment = z > 0.18 ? 'bullish' : z < -0.18 ? 'bearish' : 'neutral';

  // Секторные лидеры/отстающие — по реализованному секторному фактору за час.
  const sectorScore = {};
  for (const s of stocks) {
    if (!sectorScore[s.sector]) sectorScore[s.sector] = { sum: 0, n: 0 };
    sectorScore[s.sector].sum += s.attr.sec + s.attr.mkt * 0.0;
    sectorScore[s.sector].n += 1;
  }
  const sectorRanked = Object.entries(sectorScore)
    .map(([sector, v]) => ({ sector, score: v.n ? v.sum / v.n : 0 }))
    .sort((a, b) => b.score - a.score);

  const events = (state.events || []).map((ev) => ({
    ...ev,
    phase: eventPhase(ev, state.tick),
  }));

  const resources = RESOURCE_UNIVERSE.map((r) => {
    const rs = state.resources[r];
    const slow = safe(rs.xSlow, rs.x);
    return {
      id: r,
      price: rs.price,
      referencePrice: RESOURCE_REFERENCE_PRICES[r],
      // Изменение относительно среднего уровня за сутки (EWMA) — аналог priceChange24h.
      changePct: 100 * (Math.exp(rs.x - slow) - 1),
      // Отклонение от референсной цены (насколько товар вообще дорог сейчас).
      deviationPct: 100 * (Math.exp(rs.x) - 1),
      volume: rs.volume,
      sector: RESOURCE_SECTORS[r],
    };
  });

  return {
    worldSeed: state.worldSeed,
    engineVersion: state.engineVersion,
    tick: state.tick,
    timeMs: Number(state.epochMs) + Number(state.tick) * TICK_MS,
    regime: state.regime,
    regimeStartedTick: state.regimeStartedTick,
    regimeAgeTicks: state.tick - state.regimeStartedTick,
    baseRate: state.baseRate,
    rateDirection: rateDirection(state),
    rateTarget: rp.rateTarget,
    overallSentiment,
    breadth,
    upCount,
    total: stocks.length,
    avgSig,
    normSig,
    volRatio: normSig > 0 ? avgSig / normSig : 1,
    sectorRanked,
    stocks,
    funds,
    events,
    resources,
  };
}
