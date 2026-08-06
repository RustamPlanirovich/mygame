/**
 * МНОЖИТЕЛИ ВЫПУСКА КЛЕТКИ — ядро производства как чистая функция (bigplan.md, пункт 22).
 *
 * Сколько единиц ресурса даёт одна клетка за тик — это паспортная ставка здания, умноженная
 * на цепочку из десяти множителей: уровень, режим работы, политика на тип здания, эволюция,
 * энергоэффективность, загрязнение, близость соседей, бонус за экзотику, бонус галактики и
 * логистический штраф за дальность.
 *
 * ЗАЧЕМ ВЫНОСИЛОСЬ. Цепочка жила посреди цикла на 580 строк, и у неё есть свойство, которое
 * внутри цикла не видно: **часть множителей не применяется к энергии**. Энергия глобальна,
 * идёт сразу в базовый буфер и не зависит ни от энергоэффективности (иначе дефицит гасил бы
 * сам себя до нуля — обратная связь без дна), ни от загрязнения, ни от логистики (её не
 * везут). Забыть одно из этих исключений в новом множителе очень легко, а последствие —
 * либо разогнавшаяся, либо схлопнувшаяся экономика, и оба случая выглядят как «баланс».
 *
 * ПОРЯДОК СОХРАНЁН ДОСЛОВНО. Умножение коммутативно, но значения здесь — Decimal с
 * округлением на каждом шаге; перестановка меняла бы последние знаки, и характеризационный
 * тест тика поймал бы это как регрессию. Порядок здесь ровно тот, что был в цикле.
 */

import type Decimal from 'break_eternity.js';
import { D } from '../math/format';
import type { ResourceType } from '../gameTypes';
import { isExoticResource } from '../../utils/repeatableResearchHelpers';

export interface TileOutputInput {
  /** Какой ресурс производится. Энергия — особый случай, см. шапку. */
  resource: ResourceType;
  /** Уровень здания на клетке (линейный рост выпуска). */
  buildingLevel: number;
  /** Множитель режима работы клетки (ФАЗА 5: экономный / форсированный). */
  modeMultiplier: number;
  /** Политика, усиливающая этот тип здания (АЭС, солнечные панели, военка). */
  policyBuildingMultiplier: number;
  /** Множитель эволюции здания. 1 — эволюции нет. */
  evolutionMultiplier: number;
  /** Эффективность энергосети 0..1. К энергии НЕ применяется. */
  energyEfficiency: number;
  /** Штраф загрязнения 0..1. К энергии НЕ применяется. */
  pollutionEfficiency: number;
  /** Бонус близости соседних зданий. */
  proximityMultiplier: number;
  /** Бонус повторяемых исследований на экзотические ресурсы. */
  exoticMultiplier: number | Decimal;
  /** Бонус текущей галактики на этот ресурс. 1 — бонуса нет. */
  galaxyBonus: number;
  /** Логистическая эффективность 0..1 за дальность от базы. К энергии НЕ применяется. */
  logisticsEfficiency: number;
}

const ONE = D(1);

/**
 * Итоговый множитель к паспортной ставке здания.
 *
 * Возвращает именно множитель, а не готовое количество: базовая часть
 * (`ставка × dt × доля_ресурсов`) считается в цикле, где живут проверки переполнения
 * буферов, и тащить их сюда значило бы тащить сюда сами буферы.
 */
export function outputMultiplier(input: TileOutputInput): Decimal {
  const isEnergy = input.resource === 'energy';

  let multiplier = D(input.buildingLevel);

  multiplier = multiplier.mul(input.modeMultiplier);

  if (input.policyBuildingMultiplier !== 1) {
    multiplier = multiplier.mul(input.policyBuildingMultiplier);
  }

  if (input.evolutionMultiplier !== 1) {
    multiplier = multiplier.mul(input.evolutionMultiplier);
  }

  /*
   * Энергия не режется энергоэффективностью. Иначе получилась бы обратная связь без дна:
   * дефицит снижает выработку, снижение выработки углубляет дефицит, и база гаснет
   * навсегда с одного случайного провала.
   */
  if (!isEnergy && input.energyEfficiency < 1.0) {
    multiplier = multiplier.mul(input.energyEfficiency);
  }

  // Загрязнение бьёт по производству, но не по электростанциям.
  if (!isEnergy && input.pollutionEfficiency < 1.0) {
    multiplier = multiplier.mul(input.pollutionEfficiency);
  }

  if (input.proximityMultiplier && input.proximityMultiplier !== 1) {
    multiplier = multiplier.mul(input.proximityMultiplier);
  }

  if (isExoticResource(input.resource)) {
    multiplier = multiplier.mul(D(input.exoticMultiplier));
  }

  if (input.galaxyBonus && input.galaxyBonus !== 1) {
    multiplier = multiplier.mul(input.galaxyBonus);
  }

  /*
   * Логистический штраф за дальность — тоже мимо энергии: её не везут по клеткам, она
   * попадает в общий буфер напрямую.
   */
  if (!isEnergy && input.logisticsEfficiency < 1.0) {
    multiplier = multiplier.mul(input.logisticsEfficiency);
  }

  return multiplier.max(D(0));
}

/** Множитель, не меняющий ничего. Удобно как база в тестах и как явное «бонусов нет». */
export const NEUTRAL_OUTPUT_MULTIPLIER = ONE;
