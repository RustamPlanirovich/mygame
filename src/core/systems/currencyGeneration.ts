/**
 * ГЕНЕРАЦИЯ ВАЛЮТ — подсистема тика как чистая функция (bigplan.md, пункт 22).
 *
 * Всё, что за тик прибавляется к кредитам, очкам исследований и влиянию, плюс единственное
 * списание — содержание активных политик.
 *
 * ПОЧЕМУ ЭТО ОДИН МОДУЛЬ, А НЕ ЧЕТЫРЕ РАЗБРОСАННЫХ БЛОКА
 * Внутри тика это были четыре независимых куска, каждый со своим `nextCurrency = {...}`.
 * Из-за этого было невозможно увидеть главное: ВСЁ здесь умножается на `energyEfficiency`
 * (кроме фиксированных выплат от политик и содержания), и любой новый источник валюты
 * легко забывал этот множитель — то есть при полном обесточивании базы продолжал капать.
 *
 * КОНТРАКТ. Функция ничего не мутирует и возвращает НОВОЕ значение валют плюс отдельный
 * флаг «влияние обнулилось». Флаг нужен потому, что нулевое влияние означает отключение
 * всех политик, а политики — не валюта, и трогать их отсюда было бы смешением слоёв.
 */

import type Decimal from 'break_eternity.js';
import { D } from '../math/format';
import type { CurrencyState } from '../gameTypes';
import { POLICIES } from '../constants/policies';
import { baseInfluencePerSecond, baseResearchPointsPerSecond } from '../production/currencyRates';

/** id здания, чей единственный смысл — печатать кредиты. */
const BITCOIN_FARM_ID = 'bitcoin_farm_mk1';
/** Кредитов в секунду с одной фермы. */
const CREDITS_PER_FARM_PER_SEC = 5.0;

export interface CurrencyGenerationInput {
  currency: CurrencyState;
  /** Клетки базы: по ним считаются ставки очков исследований и влияния. */
  tiles: Record<string, string>;
  /** Секунды тика. */
  dt: number;
  /**
   * Эффективность энергосети (0..1). Обесточенная база не должна печатать ни очки, ни
   * кредиты — это тот множитель, который легче всего забыть в новом источнике дохода.
   */
  energyEfficiency: number;
  /** Кредиты, вырученные Smart-Broker'ом в этом тике. Уже посчитаны, множители не нужны. */
  autoSellCredits: Decimal;
  /** Множители скорости исследований: артефакты, вознесение, повторяемые, политики. */
  researchMultipliers: {
    artifacts: number | Decimal;
    ascension: number | Decimal;
    repeatable: number | Decimal;
    policies: number | Decimal;
  };
  /** Фиксированная выплата кредитов от политик, в секунду. */
  policyCreditsPerSecond: Decimal;
  /** Прибавка «идеологических» политик к притоку влияния. */
  influenceMultiplier: number;
  /** Активные политики: с них берётся содержание. */
  activePolicies: readonly string[];
}

export interface CurrencyGenerationResult {
  currency: CurrencyState;
  /**
   * Влияние ушло в ноль из-за содержания политик. Вызывающий обязан отключить политики:
   * без этого игрок держал бы их бесплатно.
   */
  influenceExhausted: boolean;
}

export function generateCurrencies(input: CurrencyGenerationInput): CurrencyGenerationResult {
  const {
    currency,
    tiles,
    dt,
    energyEfficiency,
    autoSellCredits,
    researchMultipliers,
    policyCreditsPerSecond,
    influenceMultiplier,
    activePolicies,
  } = input;

  let credits = currency.credits;
  let researchPoints = currency.researchPoints;
  let influence = currency.influence;

  // Выручка биржевого автопродавца: уже итоговая сумма, домножать нечем.
  if (autoSellCredits.gt(0)) credits = credits.add(autoSellCredits);

  /*
   * Очки исследований. Ставка живёт в production/currencyRates, чтобы панель валют
   * показывала ровно то число, которое тик и производит: раньше она читала
   * несуществующее поле Building.production.researchPoints и всегда рисовала +0/с.
   */
  const rpPerSec = baseResearchPointsPerSecond(tiles);
  if (rpPerSec.gt(0)) {
    researchPoints = researchPoints.add(
      rpPerSec
        .mul(dt)
        .mul(energyEfficiency)
        .mul(D(researchMultipliers.artifacts))
        .mul(D(researchMultipliers.ascension))
        .mul(D(researchMultipliers.repeatable))
        .mul(D(researchMultipliers.policies)),
    );
  }

  // Биткоин-фермы печатают кредиты.
  let farms = 0;
  for (const key in tiles) {
    if (tiles[key] === BITCOIN_FARM_ID) farms++;
  }
  if (farms > 0) {
    credits = credits.add(D(CREDITS_PER_FARM_PER_SEC).mul(farms).mul(dt).mul(energyEfficiency));
  }

  /*
   * Фиксированная выплата от политик. Умышленно БЕЗ energyEfficiency: это не производство,
   * а бюджетная строка — она не зависит от того, есть ли на базе свет.
   */
  if (policyCreditsPerSecond.gt(0)) {
    credits = credits.add(policyCreditsPerSecond.mul(dt));
  }

  // Влияние с политических центров.
  const influencePerSec = baseInfluencePerSecond(tiles);
  if (influencePerSec.gt(0)) {
    influence = influence.add(
      influencePerSec.mul(dt).mul(energyEfficiency).mul(influenceMultiplier),
    );
  }

  // Содержание активных политик — единственное списание в этом модуле.
  let influenceExhausted = false;
  if (activePolicies.length > 0) {
    let upkeep = D(0);
    for (const policyId of activePolicies) {
      const policy = POLICIES[policyId as keyof typeof POLICIES];
      if (policy?.influenceUpkeep) upkeep = upkeep.add(D(policy.influenceUpkeep).mul(dt));
    }
    if (upkeep.gt(0)) {
      const next = influence.sub(upkeep);
      if (next.lte(0)) {
        influence = D(0);
        influenceExhausted = true;
      } else {
        influence = next;
      }
    }
  }

  return {
    currency: { ...currency, credits, researchPoints, influence },
    influenceExhausted,
  };
}
