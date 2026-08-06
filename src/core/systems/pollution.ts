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

  // −5% эффективности за каждую 1000 мусора, −10% за каждые 500 радиоактивных отходов.
  const wastePenalty = waste.div(1000).mul(0.05).toNumber();
  const radioactivePenalty = radioactive.div(500).mul(0.1).toNumber();
  const efficiencyMultiplier = Math.max(0.1, 1.0 - wastePenalty - radioactivePenalty);

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
