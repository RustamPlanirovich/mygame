/**
 * ЗАГРЯЗНЕНИЕ — подсистема тика как чистая функция (bigplan.md, пункт 22).
 *
 * Была врезана прямо в `tick` (~90 строк из 3400 внутри одного `set`). Вынос сюда даёт
 * три вещи, которых внутри тика не было и быть не могло:
 *
 *  1. её можно ПРОТЕСТИРОВАТЬ, не заводя весь стор;
 *  2. видно, что она читает: сетка, здания, эффекты политик — и ничего больше;
 *  3. она возвращает ИСХОДНУЮ ссылку, когда ничего не изменилось, а внутри тика на её
 *     месте безусловно создавался новый объект `{...state.pollution}` — 20 раз в секунду,
 *     то есть каждый подписчик загрязнения перерисовывался всегда, даже на пустой базе.
 *
 * ЧАСТОТА. Вызывается раз в секунду, а не 20 (см. tickSchedule): мусор копится единицами
 * в секунду, и считать его 20 раз ради одной и той же цифры незачем. `dt` при этом
 * передаётся накопленный за интервал, поэтому итог за минуту не меняется.
 */

import Decimal from 'break_eternity.js';
import { D } from '../math/format';
import type { Building, PollutionState } from '../gameTypes';
import { getEvolutionMultiplier } from '../constants/buildingEvolutions';

export interface PollutionInput {
  /** Здания с посчитанным множителем близости — то же, что использует производство. */
  buildings: readonly Building[];
  /** Клетки: `"x,y"` → id здания. */
  tiles: Record<string, string>;
  /** Уровни эволюции по клеткам: усиливают переработку. */
  tileEvolutionLevels?: Record<string, number>;
  /** Секунды, прошедшие с прошлого запуска подсистемы. */
  dt: number;
  /** Политика «автопереработка»: вдвое меньше отходов. */
  autoRecycleWaste: boolean;
}

/** Разбор ключа клетки. Локальный, чтобы модуль не зависел от стора. */
function parseKey(key: string): { x: number; y: number } | null {
  const comma = key.indexOf(',');
  if (comma === -1) return null;
  const x = Number(key.slice(0, comma));
  const y = Number(key.slice(comma + 1));
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

const RECYCLER_ID = 'recycler_mk1';
const RECYCLER_RADIUS = 3;
const RECYCLER_INTENSITY = 0.8;

/**
 * Штраф к эффективности от накопленных отходов: −5% за каждую 1000 мусора и −10% за каждые
 * 500 радиоактивных, но не ниже 10%.
 *
 * Вынесено из stepPollution отдельной функцией, потому что мусор снимает не только
 * переработчик: демон-Санитар жжёт отходы ПОСЛЕ шага загрязнения (ему нужна энергия базы,
 * которой у чистой функции нет), и пересчитать штраф он обязан по этой же формуле. Второй
 * экземпляр формулы разошёлся бы с первым молча — панель показывала бы одно, тик считал бы
 * другое.
 */
export function pollutionEfficiencyMultiplier(waste: Decimal, radioactive: Decimal): number {
  const wastePenalty = waste.div(1000).mul(0.05).toNumber();
  const radioactivePenalty = radioactive.div(500).mul(0.1).toNumber();
  return Math.max(0.1, 1.0 - wastePenalty - radioactivePenalty);
}

/**
 * Один шаг подсистемы загрязнения.
 *
 * @returns прежний объект, если ни одна величина не изменилась.
 */
export function stepPollution(state: PollutionState, input: PollutionInput): PollutionState {
  const { buildings, tiles, tileEvolutionLevels, dt, autoRecycleWaste } = input;

  // Сколько каких зданий стоит. Один проход по сетке вместо прохода на КАЖДОЕ здание
  // каталога: раньше здесь был `Object.values(tiles).filter(...)` внутри цикла по зданиям,
  // то есть O(зданий × клеток) на каждом тике.
  const placedByBuilding: Record<string, number> = {};
  for (const key in tiles) {
    const id = tiles[key];
    placedByBuilding[id] = (placedByBuilding[id] ?? 0) + 1;
  }

  let wasteGenerated = D(0);
  let radioactiveGenerated = D(0);

  for (const b of buildings) {
    if (b.count <= 0) continue;
    const placedCount = placedByBuilding[b.id] ?? 0;
    if (placedCount === 0) continue;

    let wastePerBuilding = D(0);
    let radioactivePerBuilding = D(0);

    // Производственные здания мусорят; генераторы и панели — нет.
    if (b.production && !b.id.includes('generator') && !b.id.includes('solar')) {
      let productionTotal: Decimal = D(0);
      for (const amount of Object.values(b.production)) productionTotal = productionTotal.add(amount);
      wastePerBuilding = productionTotal.mul(0.01).mul(dt);
    }

    if (b.id.includes('nuclear') || b.id.includes('enriched_uranium')) {
      radioactivePerBuilding = D(0.05).mul(dt).mul(placedCount);
    }

    if (autoRecycleWaste) {
      wastePerBuilding = wastePerBuilding.mul(0.5);
      radioactivePerBuilding = radioactivePerBuilding.mul(0.5);
    }

    wasteGenerated = wasteGenerated.add(wastePerBuilding.mul(placedCount));
    radioactiveGenerated = radioactiveGenerated.add(radioactivePerBuilding);
  }

  let waste = D(state.wasteAmount).add(wasteGenerated);
  const radioactive = D(state.radioactiveWasteAmount).add(radioactiveGenerated);

  // Переработчики: снимают мусор и рисуют зоны влияния.
  let zones = state.pollutionZones;
  if ((placedByBuilding[RECYCLER_ID] ?? 0) > 0) {
    const basePower = D(2).mul(dt);
    const nextZones: PollutionState['pollutionZones'] = [];
    for (const tileKey in tiles) {
      if (tiles[tileKey] !== RECYCLER_ID) continue;
      const pos = parseKey(tileKey);
      if (!pos) continue;

      nextZones.push({ x: pos.x, y: pos.y, radius: RECYCLER_RADIUS, intensity: RECYCLER_INTENSITY });

      const evolutionLevel = tileEvolutionLevels?.[tileKey] ?? 0;
      const evolutionMult = evolutionLevel > 0 ? getEvolutionMultiplier(RECYCLER_ID, evolutionLevel) : 1;
      waste = waste.sub(basePower.mul(evolutionMult)).max(D(0));
    }
    zones = nextZones;
  }

  const efficiencyMultiplier = pollutionEfficiencyMultiplier(waste, radioactive);

  /*
   * Ничего не изменилось — отдаём ИСХОДНУЮ ссылку. Внутри тика на этом месте всегда
   * создавался новый объект, и подписчики загрязнения перерисовывались 20 раз в секунду
   * даже когда на базе нет ни одного мусорящего здания.
   */
  const zonesSame = zones === state.pollutionZones;
  if (
    zonesSame &&
    efficiencyMultiplier === state.efficiencyMultiplier &&
    waste.eq(state.wasteAmount) &&
    radioactive.eq(state.radioactiveWasteAmount)
  ) {
    return state;
  }

  return {
    ...state,
    wasteAmount: waste,
    radioactiveWasteAmount: radioactive,
    pollutionZones: zones,
    efficiencyMultiplier,
  };
}

// --------------------------------------------------------------- демон-Санитар --

export interface ScrubberInput {
  /** Секунды с прошлого запуска — тот же накопленный dt, что у шага загрязнения. */
  dt: number;
  /** Сколько единиц в секунду демон способен сжечь. */
  wastePerSecond: number;
  radioactivePerSecond: number;
  /** Сколько ⚡ стоит одна сожжённая единица. */
  energyPerWaste: number;
  energyPerRadioactive: number;
  /** Энергия базы на этот момент: сдельную часть платят из неё. */
  energyAvailable: Decimal;
}

export interface ScrubberResult {
  /** Остаток мусора после работы демона. */
  wasteAmount: Decimal;
  radioactiveWasteAmount: Decimal;
  /** Пересчитанный штраф к эффективности. */
  efficiencyMultiplier: number;
  /** Сколько ⚡ списать с базы. */
  energySpent: Decimal;
}

/**
 * Санитар: жжёт накопленные отходы за энергию (bigplan: демоны со сдельной оплатой).
 *
 * ПОЧЕМУ ОТДЕЛЬНО ОТ stepPollution. Шаг загрязнения — чистая функция от сетки, у неё нет и
 * не должно быть доступа к энергии базы. Демон же платит именно энергией, поэтому он
 * работает ПОСЛЕ шага, по его результату, и сам пересчитывает штраф общей формулой.
 *
 * ЧАСТИЧНАЯ ОПЛАТА. Если энергии на весь объём не хватает, демон жжёт ровно столько,
 * сколько оплачено, а не отключается целиком: иначе на грязной базе он молча простаивал бы
 * ровно тогда, когда нужнее всего. Радиоактивные отходы разгребаются первыми — они дороже
 * по эффективности (−10% за 500 против −5% за 1000).
 *
 * @returns null, если жечь нечего или платить нечем — вызывающий тогда не трогает состояние.
 */
export function runScrubber(state: PollutionState, input: ScrubberInput): ScrubberResult | null {
  const { dt, energyAvailable } = input;
  if (!(dt > 0) || energyAvailable.lte(0)) return null;

  const waste = D(state.wasteAmount);
  const radioactive = D(state.radioactiveWasteAmount);
  if (waste.lte(0) && radioactive.lte(0)) return null;

  let budget = energyAvailable;
  let spent = D(0);

  // Радиоактивные — первыми: единица радиоактивных отходов бьёт по эффективности в 4 раза
  // сильнее единицы мусора, поэтому при нехватке энергии выгоднее вывезти именно их.
  const radPrice = D(input.energyPerRadioactive);
  let radLeft = radioactive;
  if (radioactive.gt(0) && radPrice.gt(0)) {
    const wanted = radioactive.min(D(input.radioactivePerSecond).mul(dt));
    const affordable = budget.div(radPrice);
    const burned = wanted.min(affordable).max(D(0));
    if (burned.gt(0)) {
      const cost = burned.mul(radPrice);
      radLeft = radioactive.sub(burned).max(D(0));
      budget = budget.sub(cost).max(D(0));
      spent = spent.add(cost);
    }
  }

  const wastePrice = D(input.energyPerWaste);
  let wasteLeft = waste;
  if (waste.gt(0) && wastePrice.gt(0)) {
    const wanted = waste.min(D(input.wastePerSecond).mul(dt));
    const affordable = budget.div(wastePrice);
    const burned = wanted.min(affordable).max(D(0));
    if (burned.gt(0)) {
      const cost = burned.mul(wastePrice);
      wasteLeft = waste.sub(burned).max(D(0));
      budget = budget.sub(cost).max(D(0));
      spent = spent.add(cost);
    }
  }

  if (spent.lte(0)) return null;

  return {
    wasteAmount: wasteLeft,
    radioactiveWasteAmount: radLeft,
    efficiencyMultiplier: pollutionEfficiencyMultiplier(wasteLeft, radLeft),
    energySpent: spent,
  };
}
