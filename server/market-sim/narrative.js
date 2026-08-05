/**
 * server/market-sim/narrative.js
 *
 * Русские тексты, выведенные ТОЛЬКО из реализованных чисел снимка.
 * Ничего не «выдумывается»: режим и его длительность, ширина рынка, лидер и отстающий
 * сектор, волатильность относительно нормы, крупнейший скачок с его поводом,
 * активные новостные события и их фаза.
 *
 * Вариант формулировки выбирается детерминированно: hash(worldSeed, hourIndex, ...).
 * Поэтому один и тот же час всегда рендерится одинаково — перезапуск сервера
 * не меняет текст, который игрок уже прочитал.
 */

import { variantIndex } from './rng.js';
import { regimeLabelRu } from './regime.js';
import { SECTOR_RU, STOCK_BY_ID } from './universe.js';
import { PHASE_RU } from './events.js';

function hourIndex(snap) {
  return Math.floor(snap.tick / 12);
}

function pickVariant(snap, key, variants) {
  const i = variantIndex(snap.worldSeed, hourIndex(snap), `narr:${key}`, variants.length);
  return variants[i];
}

function hours(n) {
  const h = Math.round(n);
  const mod100 = h % 100;
  const mod10 = h % 10;
  if (mod100 >= 11 && mod100 <= 14) return `${h} часов`;
  if (mod10 === 1) return `${h} час`;
  if (mod10 >= 2 && mod10 <= 4) return `${h} часа`;
  return `${h} часов`;
}

function pct(v, digits = 1) {
  const s = v.toFixed(digits);
  return v > 0 ? `+${s}%` : `${s}%`;
}

/** Крупнейший скачок за последний час (по всем акциям). */
function biggestJump(snap) {
  let best = null;
  for (const s of snap.stocks) {
    if (!s.lastJump) continue;
    if (snap.tick - s.lastJump.tick > 12) continue;
    if (!best || Math.abs(s.lastJump.size) > Math.abs(best.jump.size)) {
      best = { stock: s, jump: s.lastJump };
    }
  }
  return best;
}

/** Самое «свежее» по влиянию активное событие. */
function leadEvent(snap) {
  const live = (snap.events || []).filter((e) => e.phase !== 'done' && e.phase !== 'scheduled');
  if (live.length === 0) return null;
  return live.slice().sort((a, b) => b.magnitude - a.magnitude)[0];
}

/**
 * Обзор рынка: 3 предложения — режим, ширина/секторы, волатильность или новость.
 */
export function marketNarrative(snap) {
  const ageH = snap.regimeAgeTicks / 12;
  const regime = regimeLabelRu(snap.regime);

  const s1 = pickVariant(snap, '1', [
    `На рынке ${regime}, он держится уже ${hours(ageH)}.`,
    `Рынок ${ageH < 8 ? 'недавно перешёл в состояние' : 'продолжает жить в состоянии'} «${regime}» (${hours(ageH)}).`,
    `Текущий режим — ${regime}; длительность ${hours(ageH)}.`,
  ]);

  const leader = snap.sectorRanked[0];
  const laggard = snap.sectorRanked[snap.sectorRanked.length - 1];
  const s2 = pickVariant(snap, '2', [
    `Растут ${snap.upCount} из ${snap.total} бумаг, лидирует ${SECTOR_RU[leader.sector]}, слабее всех ${SECTOR_RU[laggard.sector]}.`,
    `Ширина рынка: ${snap.upCount} из ${snap.total} в плюсе; впереди ${SECTOR_RU[leader.sector]}, позади ${SECTOR_RU[laggard.sector]}.`,
    `В плюсе ${snap.upCount} из ${snap.total}; спрос идёт в ${SECTOR_RU[leader.sector]}, из ${SECTOR_RU[laggard.sector]} деньги выходят.`,
  ]);

  let s3;
  const ev = leadEvent(snap);
  const jump = biggestJump(snap);
  if (ev) {
    const dirWord = ev.sign > 0 ? 'в пользу' : 'против';
    s3 = pickVariant(snap, '3e', [
      `Главная новость: ${ev.headline} (фаза «${PHASE_RU[ev.phase]}»), рынок играет ${dirWord} сектора.`,
      `${ev.headline} — стадия «${PHASE_RU[ev.phase]}»; движение ${dirWord} затронутых бумаг ещё не отыграно полностью.`,
      `Фон определяет событие «${ev.headline}» (${PHASE_RU[ev.phase]}).`,
    ]);
  } else if (jump) {
    s3 = pickVariant(snap, '3j', [
      `Резче всех двинулась ${jump.stock.symbol} (${pct(jump.jump.size * 100)}): ${jump.jump.reason}.`,
      `Отдельная история — ${jump.stock.symbol}, ${pct(jump.jump.size * 100)} на новости: ${jump.jump.reason}.`,
      `${jump.stock.symbol} ушла на ${pct(jump.jump.size * 100)}, повод — ${jump.jump.reason}.`,
    ]);
  } else {
    const volTxt = `${Math.round(snap.volRatio * 100)}% от нормы`;
    const rateTxt =
      snap.rateDirection === 'rising'
        ? 'кредитная ставка подрастает'
        : snap.rateDirection === 'falling'
          ? 'кредитная ставка снижается'
          : 'кредитная ставка стоит на месте';
    s3 = pickVariant(snap, '3v', [
      `Волатильность ${volTxt}, ${rateTxt} (${(snap.baseRate * 100).toFixed(1)}%).`,
      `Крупных новостей нет: волатильность ${volTxt}, ${rateTxt}.`,
      `Рынок спокоен — волатильность ${volTxt}; ${rateTxt} до ${(snap.baseRate * 100).toFixed(1)}%.`,
    ]);
  }

  return `${s1} ${s2} ${s3}`;
}

/**
 * Объяснение прогноза по акции: argmax накопленной за час атрибуции.
 * Никакой отсебятины — какая компонента дала больше всего движения, о ней и пишем.
 */
export function stockReasoning(snap, stockId) {
  const s = snap.stocks.find((x) => x.id === stockId);
  if (!s) return 'Недостаточно данных по бумаге';

  const def = STOCK_BY_ID[stockId];
  const sectorRu = SECTOR_RU[def.sector];

  // Активное событие бьёт всё остальное — это самая информативная причина.
  const ev = (snap.events || []).find(
    (e) => e.phase !== 'done' && (e.scope === 'stock' ? e.target === stockId : e.target === def.sector)
  );
  if (ev) {
    const phase = PHASE_RU[ev.phase];
    return ev.phase === 'rumour'
      ? `${ev.rumourHeadline}: движение только начинается (${phase})`
      : `${ev.headline}: ${ev.reason} (${phase})`;
  }

  if (s.lastJump && snap.tick - s.lastJump.tick <= 12) {
    return `${s.lastJump.size > 0 ? 'Позитивный' : 'Негативный'} повод — ${s.lastJump.reason}`;
  }

  const attr = s.attr;
  const parts = [
    { key: 'mkt', v: Math.abs(attr.mkt) },
    { key: 'sec', v: Math.abs(attr.sec) },
    { key: 'idio', v: Math.abs(attr.idio) },
    { key: 'rev', v: Math.abs(attr.rev) },
  ];
  parts.sort((a, b) => b.v - a.v);
  const top = parts[0].key;
  const up = s.forecast.m > 0;

  if (top === 'mkt') {
    return up
      ? `Бумагу тянет общий рынок (${regimeLabelRu(snap.regime)}), бета ${(def.marketCap > 2e10 ? 'высокая' : 'умеренная')}`
      : `Давит общий рынок: ${regimeLabelRu(snap.regime)}`;
  }
  if (top === 'sec') {
    return up
      ? `Приток денег в сектор «${sectorRu}»`
      : `Отток денег из сектора «${sectorRu}»`;
  }
  if (top === 'rev') {
    return s.x > 0
      ? `Цена ушла на ${pct(100 * (Math.exp(s.x) - 1))} выше справедливого уровня, ждём возврата`
      : `Цена на ${pct(100 * (Math.exp(s.x) - 1))} ниже справедливого уровня, ждём восстановления`;
  }
  return up
    ? `Собственная динамика компании сильнее рынка`
    : `Собственные проблемы компании перевешивают рыночный фон`;
}

/** Пояснение к прогнозу кредитной ставки. */
export function rateReasoning(snap) {
  const regime = regimeLabelRu(snap.regime);
  if (snap.rateDirection === 'rising') {
    return `Ставка растёт: ${regime} разогревает спрос на кредит, цель регулятора ${(snap.rateTarget * 100).toFixed(1)}%`;
  }
  if (snap.rateDirection === 'falling') {
    return `Ставка снижается: ${regime} вынуждает смягчать условия, цель ${(snap.rateTarget * 100).toFixed(1)}%`;
  }
  return `Ставка стабильна около ${(snap.baseRate * 100).toFixed(1)}% при цели ${(snap.rateTarget * 100).toFixed(1)}%`;
}

/** Условия, влияющие на дивиденды. */
export function dividendConditions(snap, updates) {
  const inc = updates.filter((u) => u.change === 'increased').length;
  const dec = updates.filter((u) => u.change === 'decreased').length;
  const payers = updates.filter((u) => u.newYield > 0).length;
  const regime = regimeLabelRu(snap.regime);

  return pickVariant(snap, 'div', [
    `${regime}: ${payers} компаний платят дивиденды, ${inc} повысили ставку, ${dec} урезали. Базовая ставка ${(snap.baseRate * 100).toFixed(1)}%.`,
    `Дивидендная картина при режиме «${regime}»: повышений ${inc}, снижений ${dec}, платят ${payers} из ${snap.total}.`,
    `Условия: ${regime}, ставка ${(snap.baseRate * 100).toFixed(1)}%. Повысили выплаты ${inc}, снизили ${dec}.`,
  ]);
}

/** Обоснование рекомендации под профиль риска. */
export function recReasoning(snap, item, profile) {
  const isFund = item.type.endsWith('fund');
  const label = isFund ? 'фонд' : 'бумага';

  if (item.type === 'sell_stock' || item.type === 'sell_fund') {
    const f = isFund
      ? snap.funds.find((x) => x.id === item.targetId)
      : snap.stocks.find((x) => x.id === item.targetId)?.forecast;
    const p = f ? pct(f.pct) : '—';
    return `Ожидаемое движение ${p} на горизонте часа — ${label} лучше сократить`;
  }

  if (isFund) {
    const f = snap.funds.find((x) => x.id === item.targetId);
    const p = f ? pct(f.pct) : '—';
    if (profile === 'conservative') return `Низкий риск (уровень ${f?.riskLevel ?? '?'}) и ожидаемая доходность ${p}`;
    if (profile === 'aggressive') return `Агрессивный фонд, ожидаемая доходность ${p} при высокой волатильности`;
    return `Сбалансированный фонд: ожидаемая доходность ${p}, риск ${f?.riskLevel ?? '?'}`;
  }

  const s = snap.stocks.find((x) => x.id === item.targetId);
  if (!s) return 'Рекомендация на основе модели рынка';
  const why = stockReasoning(snap, item.targetId);

  if (profile === 'conservative') {
    const y = (s.dividendYield * 100).toFixed(1);
    return `Низкая волатильность и дивиденды ${y}%. ${why}`;
  }
  if (profile === 'aggressive') {
    return `Потенциал ${pct(s.forecast.pct)} при волатильности ${Math.round(s.relVol * 100)}% от нормы. ${why}`;
  }
  return `Ожидаемое движение ${pct(s.forecast.pct)} при умеренном риске. ${why}`;
}
