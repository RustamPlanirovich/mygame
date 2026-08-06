/**
 * Подсистема загрязнения, вынесенная из тика (bigplan.md, пункт 22).
 *
 * Ради этого её и выносили: раньше эти 90 строк жили внутри одного `set` на 3400 строк и
 * проверить их можно было только подняв весь стор. Здесь — чистая функция и три вещи,
 * которые важно не сломать: неизменное состояние отдаёт ПРЕЖНЮЮ ссылку, замедление не
 * меняет итог, переработчики уменьшают мусор.
 */

import { describe, expect, it } from 'vitest';
import { stepPollution, type PollutionInput } from './pollution';
import { D } from '../math/format';
import type { Building, PollutionState } from '../gameTypes';

const EMPTY: PollutionState = {
  wasteAmount: D(0),
  radioactiveWasteAmount: D(0),
  efficiencyMultiplier: 1,
  pollutionZones: [],
};

/** Минимальное «здание» — подсистеме нужны только id, count и production. */
function factory(id: string, count: number, perSecond: number): Building {
  return {
    id,
    name: id,
    description: '',
    baseCost: {},
    production: { steel: D(perSecond) },
    count,
  } as unknown as Building;
}

const input = (over: Partial<PollutionInput> = {}): PollutionInput => ({
  buildings: [],
  tiles: {},
  dt: 1,
  autoRecycleWaste: false,
  ...over,
});

describe('stepPollution', () => {
  it('на пустой базе возвращает ИСХОДНУЮ ссылку', () => {
    const result = stepPollution(EMPTY, input());
    // Раньше на этом месте безусловно создавался новый объект, и подписчики загрязнения
    // перерисовывались 20 раз в секунду при полностью неизменном состоянии.
    expect(result).toBe(EMPTY);
  });

  it('производственные здания копят мусор', () => {
    const result = stepPollution(
      EMPTY,
      input({ buildings: [factory('smelter_mk1', 2, 10)], tiles: { '0,0': 'smelter_mk1', '1,0': 'smelter_mk1' } }),
    );
    expect(result.wasteAmount.gt(0)).toBe(true);
  });

  it('генераторы и панели не мусорят', () => {
    const result = stepPollution(
      EMPTY,
      input({ buildings: [factory('solar_panel_mk1', 5, 10)], tiles: { '0,0': 'solar_panel_mk1' } }),
    );
    expect(result).toBe(EMPTY);
  });

  it('один шаг на 1 с равен двадцати шагам по 1/20 с', () => {
    const buildings = [factory('smelter_mk1', 1, 10)];
    const tiles = { '0,0': 'smelter_mk1' };

    const once = stepPollution(EMPTY, input({ buildings, tiles, dt: 1 }));

    let many = EMPTY;
    for (let i = 0; i < 20; i++) {
      many = stepPollution(many, input({ buildings, tiles, dt: 1 / 20 }));
    }

    // Именно это и позволяет запускать подсистему раз в секунду вместо двадцати:
    // замедление не должно уменьшать количество отходов.
    expect(many.wasteAmount.sub(once.wasteAmount).abs().lt(D('1e-9'))).toBe(true);
  });

  it('автопереработка уменьшает отходы вдвое', () => {
    const buildings = [factory('smelter_mk1', 1, 10)];
    const tiles = { '0,0': 'smelter_mk1' };

    const normal = stepPollution(EMPTY, input({ buildings, tiles }));
    const recycled = stepPollution(EMPTY, input({ buildings, tiles, autoRecycleWaste: true }));

    expect(recycled.wasteAmount.mul(2).sub(normal.wasteAmount).abs().lt(D('1e-9'))).toBe(true);
  });

  it('ядерные здания дают радиоактивные отходы', () => {
    const nuclear = { ...factory('nuclear_plant_mk1', 1, 0), production: undefined } as unknown as Building;
    const result = stepPollution(EMPTY, input({ buildings: [nuclear], tiles: { '0,0': 'nuclear_plant_mk1' } }));
    expect(result.radioactiveWasteAmount.gt(0)).toBe(true);
  });

  it('переработчик снимает мусор и создаёт зону', () => {
    const dirty: PollutionState = { ...EMPTY, wasteAmount: D(1000) };
    const result = stepPollution(
      dirty,
      input({ buildings: [factory('recycler_mk1', 1, 0)], tiles: { '3,4': 'recycler_mk1' } }),
    );

    expect(result.wasteAmount.lt(dirty.wasteAmount)).toBe(true);
    expect(result.pollutionZones).toHaveLength(1);
    expect(result.pollutionZones[0]).toMatchObject({ x: 3, y: 4 });
  });

  it('мусор не уходит в минус', () => {
    const almostClean: PollutionState = { ...EMPTY, wasteAmount: D(0.1) };
    const result = stepPollution(
      almostClean,
      input({ buildings: [factory('recycler_mk1', 1, 0)], tiles: { '0,0': 'recycler_mk1' }, dt: 100 }),
    );
    expect(result.wasteAmount.gte(0)).toBe(true);
  });

  it('штраф эффективности не опускается ниже 10%', () => {
    const catastrophe: PollutionState = { ...EMPTY, wasteAmount: D('1e9') };
    const result = stepPollution(catastrophe, input());
    expect(result.efficiencyMultiplier).toBe(0.1);
  });

  it('здание, которого нет на сетке, не мусорит', () => {
    // count > 0, но ни одной размещённой клетки: это здание существует только в каталоге.
    const result = stepPollution(EMPTY, input({ buildings: [factory('smelter_mk1', 5, 10)], tiles: {} }));
    expect(result).toBe(EMPTY);
  });
});
