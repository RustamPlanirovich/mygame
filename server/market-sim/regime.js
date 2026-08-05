/**
 * server/market-sim/regime.js
 *
 * Скрытый режим рынка как полумарковская цепь (semi-Markov):
 *  - минимальное время жизни режима (dwell) — 6 часов, за это время переход невозможен;
 *  - дальше вероятность перехода растёт с возрастом (age-increasing hazard),
 *    поэтому «вечных» бычьих рынков не бывает, но и дрожания раз в тик тоже.
 *
 * Режим задаёт УРОВЕНЬ равновесных цен (а не бесконечный тренд): в бычьем режиме
 * равновесие выше на +12%, в кризисе — на -35%. Цены сходятся к новому уровню и
 * стабилизируются, а не улетают в бесконечность.
 */

import { unit, pick } from './rng.js';

export const REGIMES = ['bull', 'bear', 'sideways', 'crisis', 'melt_up'];

/** Минимальный срок жизни режима — 72 тика по 5 минут = 6 часов. */
export const MIN_DWELL_TICKS = 72;

/** Характерная длительность режима в тиках (288 тиков = сутки). */
const MEAN_DURATION = {
  sideways: 1440, // 5 суток
  bull: 2016,     // 7 суток
  bear: 1152,     // 4 суток
  crisis: 288,    // 1 сутки
  melt_up: 432,   // 1.5 суток
};

/** Матрица переходов: куда уходит режим, когда всё-таки решает уйти. */
const TRANSITIONS = {
  sideways: { bull: 0.42, bear: 0.34, crisis: 0.1, melt_up: 0.14 },
  bull: { sideways: 0.5, melt_up: 0.22, bear: 0.22, crisis: 0.06 },
  bear: { sideways: 0.55, crisis: 0.25, bull: 0.18, melt_up: 0.02 },
  crisis: { bear: 0.45, sideways: 0.45, bull: 0.1 },
  // Эйфория чаще заканчивается плохо, чем хорошо.
  melt_up: { bear: 0.3, bull: 0.3, sideways: 0.25, crisis: 0.15 },
};

/**
 * Параметры режима.
 * levelTarget — сдвиг равновесного уровня логарифма цены (умножается на рыночную бету b).
 * volMult     — множитель мгновенной волатильности.
 * jumpLambda  — вероятность новостного скачка за тик (до умножения на класс акции).
 * downJumpProb— доля скачков вниз.
 * rateTarget  — цель для базовой кредитной ставки (OU-процесс).
 * divTilt     — систематический сдвиг дивидендной политики за тик.
 * rotation    — секторная ротация: какие сектора «в моде» в этом режиме.
 */
export const REGIME_PARAMS = {
  bull: {
    levelTarget: 0.12,
    volMult: 1.0,
    jumpLambda: 0.0018,
    downJumpProb: 0.6,
    rateTarget: 0.095,
    divTilt: 0.002,
    rotation: { technology: 0.0006, aerospace: 0.0004, entertainment: 0.0003, mining: -0.0002 },
  },
  melt_up: {
    levelTarget: 0.3,
    volMult: 1.6,
    jumpLambda: 0.006,
    downJumpProb: 0.55,
    rateTarget: 0.115,
    divTilt: -0.001,
    rotation: { exotic: 0.0012, technology: 0.001, biotech: 0.0006, energy: -0.0003 },
  },
  sideways: {
    levelTarget: 0.0,
    volMult: 1.0,
    jumpLambda: 0.0015,
    downJumpProb: 0.65,
    rateTarget: 0.09,
    divTilt: 0.0,
    rotation: { manufacturing: 0.0003, energy: 0.0002, exotic: -0.0004 },
  },
  bear: {
    levelTarget: -0.15,
    volMult: 1.15,
    jumpLambda: 0.003,
    downJumpProb: 0.75,
    rateTarget: 0.075,
    divTilt: -0.002,
    rotation: { manufacturing: 0.0004, energy: 0.0004, technology: -0.0006, exotic: -0.001 },
  },
  crisis: {
    levelTarget: -0.35,
    volMult: 2.2,
    jumpLambda: 0.009,
    downJumpProb: 0.85,
    rateTarget: 0.055,
    divTilt: -0.006,
    rotation: { mining: 0.0005, energy: 0.0003, exotic: -0.0016, technology: -0.001, biotech: -0.0008 },
  },
};

export const REGIME_RU = {
  bull: 'бычий рынок',
  bear: 'медвежий рынок',
  sideways: 'боковик',
  crisis: 'кризис',
  melt_up: 'эйфория',
};

export function regimeLabelRu(regime) {
  return REGIME_RU[regime] || 'неопределённый режим';
}

/** Возраст режима в часах (12 тиков = 1 час). */
export function regimeAgeHours(tick, regimeStartedTick) {
  return Math.max(0, (Number(tick) - Number(regimeStartedTick)) / 12);
}

/**
 * Хазард перехода на данном тике.
 * До MIN_DWELL_TICKS — ноль. Далее база 1/T, растущая с возрастом, но не выше 0.25.
 */
export function transitionHazard(regime, age) {
  if (age < MIN_DWELL_TICKS) return 0;
  const T = MEAN_DURATION[regime] || 1000;
  const h = (1 / T) * (1 + (0.5 * age) / T);
  return h > 0.25 ? 0.25 : h;
}

/**
 * Один шаг режима. Чистая функция: результат зависит только от аргументов.
 * @returns {{regime: string, regimeStartedTick: number, changed: boolean}}
 */
export function stepRegime({ regime, regimeStartedTick, tick, worldSeed }) {
  const cur = REGIME_PARAMS[regime] ? regime : 'sideways';
  const age = Number(tick) - Number(regimeStartedTick);
  const h = transitionHazard(cur, age);

  if (h > 0 && unit(worldSeed, tick, 'regime', 'hazard') < h) {
    const next = pick(worldSeed, tick, 'regime:next', TRANSITIONS[cur], cur);
    if (next && next !== cur) {
      return { regime: next, regimeStartedTick: Number(tick), changed: true };
    }
  }
  return { regime: cur, regimeStartedTick: Number(regimeStartedTick), changed: false };
}
