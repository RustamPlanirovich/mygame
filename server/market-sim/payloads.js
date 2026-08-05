/**
 * server/market-sim/payloads.js
 *
 * Превращает снимок рынка в три документа оракула.
 *
 * Формы полей БАЙТ-СОВМЕСТИМЫ с тем, что уже читают:
 *   server/ai.js                                  (market-prediction / dividends / advisor-recommendations)
 *   src/features/advisorStore.ts                  (overallSentiment, stockPredictions[*].predictedDirection|confidence,
 *                                                  creditRatePrediction, marketNarrative, dividendUpdates[*].newYield)
 *   src/components/game/finance/AIAdvisor.tsx     (rec.predictedChange.toFixed(1), rec.confidence, source === 'ai')
 *   src/features/financeStore.ts                  (getAIDividendYield -> newYield)
 *   server/offline-trading.js                     (recommendations[riskTolerance] -> {type, targetId, confidence})
 *
 * Дополнительные поля (marketRegime, breadth, events, simTick) только ДОБАВЛЯЮТСЯ —
 * старые потребители их просто не замечают.
 */

import { FUNDS, STOCK_BY_ID, VOL_PARAMS } from './universe.js';
import { regimeLabelRu } from './regime.js';
import { DIV_YIELD_CAP } from './engine.js';
import {
  marketNarrative,
  stockReasoning,
  rateReasoning,
  dividendConditions,
  recReasoning,
} from './narrative.js';

const VOL_RANK = { low: 1, medium: 2, high: 3, very_high: 4, extreme: 5 };

function round(v, digits) {
  const f = Math.pow(10, digits);
  return Math.round(v * f) / f;
}

/** ===== 1. Прогноз рынка ===== */
export function buildMarketPrediction(snap) {
  return {
    overallSentiment: snap.overallSentiment,
    stockPredictions: snap.stocks.map((s) => ({
      stockId: s.id,
      symbol: s.symbol,
      predictedDirection: s.forecast.direction,
      confidence: round(s.forecast.confidence, 3),
      predictedChange: round(s.forecast.pct, 2),
      reasoning: stockReasoning(snap, s.id),
    })),
    creditRatePrediction: {
      predictedBaseRate: round(snap.baseRate, 4),
      rateDirection: snap.rateDirection,
      reasoning: rateReasoning(snap),
    },
    marketNarrative: marketNarrative(snap),
    source: 'local',
    // --- дополнительные поля (не ломают старых потребителей) ---
    marketRegime: snap.regime,
    marketRegimeRu: regimeLabelRu(snap.regime),
    breadth: round(snap.breadth, 3),
    upCount: snap.upCount,
    volRatio: round(snap.volRatio, 3),
    events: snap.events
      .filter((e) => e.phase !== 'done')
      .map((e) => ({
        id: e.id,
        headline: e.phase === 'rumour' ? e.rumourHeadline : e.headline,
        phase: e.phase,
        scope: e.scope,
        target: e.target,
        sector: e.sector,
        direction: e.sign > 0 ? 'up' : 'down',
        magnitude: round(e.magnitude, 4),
      })),
    simTick: snap.tick,
    generatedAt: Date.now(),
  };
}

/** ===== 2. Дивиденды ===== */
export function buildDividends(snap) {
  const dividendUpdates = snap.stocks.map((s) => {
    const newYield = Math.min(Math.max(s.dividendYield, 0), DIV_YIELD_CAP);
    const published = s.dividendPublished;
    let change = 'unchanged';
    if (published > 0) {
      const rel = newYield / published - 1;
      if (rel > 0.02) change = 'increased';
      else if (rel < -0.02) change = 'decreased';
    } else if (newYield > 0) {
      change = 'increased';
    }

    let reason;
    if (newYield <= 0) {
      reason = 'Компания роста: вся прибыль идёт в развитие';
    } else if (change === 'increased') {
      reason = `Прибыль позволяет повысить выплату (${regimeLabelRu(snap.regime)})`;
    } else if (change === 'decreased') {
      reason = `Выплата урезана: ${regimeLabelRu(snap.regime)} давит на маржу`;
    } else {
      reason = 'Дивидендная политика без изменений';
    }

    return {
      stockId: s.id,
      newYield: round(newYield, 5),
      change,
      reason,
    };
  });

  return {
    dividendUpdates,
    marketConditions: dividendConditions(snap, dividendUpdates),
    source: 'local',
    simTick: snap.tick,
    generatedAt: Date.now(),
  };
}

/** ===== 3. Рекомендации ===== */

const PROFILES = {
  conservative: {
    maxVolRank: VOL_RANK.medium,
    maxFundRisk: 2,
    minFundRisk: 1,
    score: (c) => c.t - 1.2 * (c.risk / 0.3) + 0.8 * (c.yield / 0.05),
  },
  balanced: {
    maxVolRank: VOL_RANK.high,
    maxFundRisk: 3,
    minFundRisk: 1,
    score: (c) => c.t - 0.5 * (c.risk / 0.3) + 0.3 * (c.yield / 0.05),
  },
  aggressive: {
    maxVolRank: VOL_RANK.extreme,
    maxFundRisk: 5,
    minFundRisk: 3,
    score: (c) => c.t + 0.4 * (c.risk / 0.3) + 0.3 * (c.mom * 10),
  },
};

function candidates(snap, profile) {
  const cfg = PROFILES[profile];
  const out = [];

  for (const s of snap.stocks) {
    const def = STOCK_BY_ID[s.id];
    if (VOL_RANK[def.volatility] > cfg.maxVolRank) continue;
    out.push({
      kind: 'stock',
      id: s.id,
      t: s.forecast.t,
      confidence: s.forecast.confidence,
      risk: s.targetSd ?? VOL_PARAMS[def.volatility].targetSd,
      yield: s.dividendYield,
      mom: s.mom24h,
    });
  }

  for (const f of snap.funds) {
    const def = FUNDS.find((x) => x.id === f.id);
    if (!def) continue;
    if (def.riskLevel > cfg.maxFundRisk) continue;
    if (profile === 'aggressive' && def.riskLevel < cfg.minFundRisk) continue;
    // Риск фонда переводим в ту же шкалу, что targetSd акций.
    out.push({
      kind: 'fund',
      id: f.id,
      t: f.t,
      confidence: f.confidence,
      risk: 0.08 * def.riskLevel,
      yield: 0.02,
      mom: 0,
    });
  }

  for (const c of out) c.score = cfg.score(c);
  return out;
}

function buildProfile(snap, profile) {
  const list = candidates(snap, profile);

  // Покупку предлагаем только там, где ожидаемая доходность не отрицательна:
  // «топ-3 из чего попало» приводил бы к рекомендации купить падающую бумагу.
  const buys = list
    .filter((c) => c.t > -0.15)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((c, i) => {
      const item = {
        type: c.kind === 'fund' ? 'buy_fund' : 'buy_stock',
        targetId: c.id,
        reasoning: '',
        confidence: round(c.confidence, 3),
        priority: i + 1,
      };
      item.reasoning = recReasoning(snap, item, profile);
      return item;
    });

  // Один и тот же актив не может одновременно попасть в покупки и в продажи.
  const buyIds = new Set(buys.map((b) => b.targetId));
  const sells = list
    .filter((c) => c.t < -0.2 && !buyIds.has(c.id))
    .sort((a, b) => a.t - b.t)
    .slice(0, 2)
    .map((c, i) => {
      const item = {
        type: c.kind === 'fund' ? 'sell_fund' : 'sell_stock',
        targetId: c.id,
        reasoning: '',
        confidence: round(c.confidence, 3),
        priority: buys.length + i + 1,
      };
      item.reasoning = recReasoning(snap, item, profile);
      return item;
    });

  return buys.concat(sells);
}

export function buildRecommendations(snap) {
  return {
    conservative: buildProfile(snap, 'conservative'),
    balanced: buildProfile(snap, 'balanced'),
    aggressive: buildProfile(snap, 'aggressive'),
    source: 'local',
    simTick: snap.tick,
    generatedAt: Date.now(),
  };
}

/** Полный набор из одного снимка (используется в оракуле и в sync-обёртках). */
export function buildAll(snap) {
  return {
    marketPrediction: buildMarketPrediction(snap),
    dividends: buildDividends(snap),
    recommendations: buildRecommendations(snap),
  };
}
