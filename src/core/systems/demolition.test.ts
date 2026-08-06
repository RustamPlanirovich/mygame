/**
 * План сноса, в том числе массового (bigplan.md, пункты 10 и 28).
 */

import { describe, expect, it } from 'vitest';
import Decimal from 'break_eternity.js';
import type { Building, ResourceType } from '../gameTypes';
import {
  DEMOLITION_REFUND_RATE,
  investedMultiplier,
  isEmptyPlan,
  planDemolition,
} from './demolition';
import { RUIN_REFUND_MIN } from './deposits';
import type { TileJob } from './construction';

const D = (v: number | string) => new Decimal(v);

function building(id: string, cost: Partial<Record<ResourceType, Decimal>>): Building {
  return {
    id,
    name: id,
    description: '',
    baseCost: cost,
    costFactor: 1.15,
    production: {},
    count: 0,
  } as Building;
}

const BUILDINGS = [
  building('miner_mk1', { energy: D(100) }),
  building('smelter', { steel: D(200), copper: D(50) }),
];

/** Стоимость = baseCost, без прогрессии: так проверяется именно арифметика возврата. */
const flatCost = (b: Building) => b.baseCost;

describe('planDemolition', () => {
  it('считает возврат 75% за одно здание', () => {
    const plan = planDemolition(['1,1'], { '1,1': 'miner_mk1' }, BUILDINGS, flatCost);
    expect(plan.keys).toEqual(['1,1']);
    expect(plan.refund.energy?.toNumber()).toBe(100 * DEMOLITION_REFUND_RATE);
    expect(plan.countByBuilding).toEqual({ miner_mk1: 1 });
  });

  it('складывает возврат по нескольким клеткам и ресурсам', () => {
    const tiles = { '1,1': 'miner_mk1', '2,2': 'miner_mk1', '3,3': 'smelter' };
    const plan = planDemolition(['1,1', '2,2', '3,3'], tiles, BUILDINGS, flatCost);

    expect(plan.keys).toHaveLength(3);
    expect(plan.refund.energy?.toNumber()).toBe(200 * DEMOLITION_REFUND_RATE);
    expect(plan.refund.steel?.toNumber()).toBe(200 * DEMOLITION_REFUND_RATE);
    expect(plan.refund.copper?.toNumber()).toBe(50 * DEMOLITION_REFUND_RATE);
    expect(plan.countByBuilding).toEqual({ miner_mk1: 2, smelter: 1 });
  });

  it('дубликат ключа не удваивает возврат', () => {
    // Рамка и Shift-клик легко дают один и тот же ключ дважды.
    const plan = planDemolition(
      ['1,1', '1,1', '1,1'],
      { '1,1': 'miner_mk1' },
      BUILDINGS,
      flatCost,
    );
    expect(plan.keys).toEqual(['1,1']);
    expect(plan.refund.energy?.toNumber()).toBe(100 * DEMOLITION_REFUND_RATE);
  });

  it('возврат одинаков за каждое здание в пачке — порядок обхода не влияет', () => {
    const tiles = { '1,1': 'miner_mk1', '2,2': 'miner_mk1' };
    const forward = planDemolition(['1,1', '2,2'], tiles, BUILDINGS, flatCost);
    const backward = planDemolition(['2,2', '1,1'], tiles, BUILDINGS, flatCost);
    expect(forward.refund.energy?.toString()).toBe(backward.refund.energy?.toString());
  });

  it('пустые клетки попадают в skipped, а не в снос', () => {
    const plan = planDemolition(['1,1', '9,9'], { '1,1': 'miner_mk1' }, BUILDINGS, flatCost);
    expect(plan.keys).toEqual(['1,1']);
    expect(plan.skipped).toEqual([{ key: '9,9', reason: 'empty' }]);
  });

  it('клетку базы снести нельзя, и об этом сообщается', () => {
    const plan = planDemolition(
      ['5,5', '1,1'],
      { '5,5': 'base_core', '1,1': 'miner_mk1' },
      BUILDINGS,
      flatCost,
      { baseKey: '5,5' },
    );
    expect(plan.keys).toEqual(['1,1']);
    expect(plan.skipped).toEqual([{ key: '5,5', reason: 'base' }]);
  });

  it('здание, которого нет в каталоге, пропускается без падения', () => {
    const plan = planDemolition(['1,1'], { '1,1': 'нет_такого' }, BUILDINGS, flatCost);
    expect(plan.keys).toEqual([]);
    expect(plan.skipped).toEqual([{ key: '1,1', reason: 'unknown-building' }]);
  });

  it('за незавершённую работу возвращается ПОЛНАЯ стоимость, а не 75%', () => {
    const job: TileJob = {
      kind: 'build',
      buildingId: 'miner_mk1',
      startedAt: 0,
      duration: 10_000,
      paidCost: { energy: '100' },
      paidCredits: '250',
    };
    const plan = planDemolition(
      ['1,1'],
      { '1,1': 'miner_mk1' },
      BUILDINGS,
      flatCost,
      { tileJobs: { '1,1': job } },
    );

    // 75 за само здание + 100 полной стоимости незавершённой работы.
    expect(plan.refund.energy?.toNumber()).toBe(100 * DEMOLITION_REFUND_RATE + 100);
    expect(plan.refundCredits.toNumber()).toBe(250);
  });

  it('учитывает прогрессию цены через переданный calculateCost', () => {
    const withProgression = (b: Building) => {
      const out: Partial<Record<ResourceType, Decimal>> = {};
      for (const [res, amount] of Object.entries(b.baseCost)) {
        out[res as ResourceType] = amount!.mul(2); // как будто счётчик уже вырос
      }
      return out;
    };
    const plan = planDemolition(['1,1'], { '1,1': 'miner_mk1' }, BUILDINGS, withProgression);
    expect(plan.refund.energy?.toNumber()).toBe(200 * DEMOLITION_REFUND_RATE);
  });
});

describe('разбор руин (bigplan 38)', () => {
  /** Здание с кредитной ценой: у руины возвращаются и кредиты за улучшения. */
  const MINE = {
    ...building('miner_mk1', { energy: D(100) }),
    creditCost: D(250),
  } as Building;
  const CATALOG = [MINE];

  it('за руину возвращается доля ВСЕГО вложенного, а не только постройки', () => {
    const plan = planDemolition(['1,1'], { '1,1': 'miner_mk1' }, CATALOG, flatCost, {
      isRuined: () => true,
      tileLevels: { '1,1': 3 },
      ruinRefundRate: 0.5,
    });

    // Улучшения до 3-го уровня: baseCost × (1.15¹ + 1.15²) = 100 × 2.4725.
    const upgrades = Math.pow(1.15, 1) + Math.pow(1.15, 2);
    expect(plan.refund.energy?.toNumber()).toBeCloseTo((100 + 100 * upgrades) * 0.5, 6);
    expect(plan.refundCredits.toNumber()).toBeCloseTo(250 * upgrades * 0.5, 6);
    expect(plan.ruined.keys).toEqual(['1,1']);
    expect(plan.ruined.rate).toBe(0.5);
  });

  it('руина первого уровня возвращает долю одной только постройки', () => {
    const plan = planDemolition(['1,1'], { '1,1': 'miner_mk1' }, CATALOG, flatCost, {
      isRuined: () => true,
      tileLevels: { '1,1': 1 },
      ruinRefundRate: 0.25,
    });
    expect(plan.refund.energy?.toNumber()).toBeCloseTo(100 * 0.25, 6);
    // Кредиты за постройку возвращает не снос, а отмена работы: улучшений тут не было.
    expect(plan.refundCredits.toNumber()).toBe(0);
  });

  it('обычный снос считается по-прежнему, даже если рядом сносят руину', () => {
    const tiles = { '1,1': 'miner_mk1', '2,2': 'miner_mk1' };
    const plan = planDemolition(['1,1', '2,2'], tiles, CATALOG, flatCost, {
      isRuined: (key) => key === '1,1',
      tileLevels: { '1,1': 1, '2,2': 5 },
      ruinRefundRate: 0.25,
    });

    // Целая шахта: 75% постройки и ни кредита за улучшения — правило не изменилось.
    // Руина: 25% постройки. Итого 25 + 75.
    expect(plan.refund.energy?.toNumber()).toBeCloseTo(100 * 0.25 + 100 * DEMOLITION_REFUND_RATE, 6);
    expect(plan.ruined.keys).toEqual(['1,1']);
  });

  it('без явной ставки берётся самая скромная из объявленных', () => {
    const plan = planDemolition(['1,1'], { '1,1': 'miner_mk1' }, CATALOG, flatCost, {
      isRuined: () => true,
      tileLevels: { '1,1': 1 },
    });
    expect(plan.refund.energy?.toNumber()).toBeCloseTo(100 * RUIN_REFUND_MIN, 6);
  });
});

describe('investedMultiplier', () => {
  it('первый уровень — улучшений ещё не было', () => {
    expect(investedMultiplier(1)).toBe(0);
    expect(investedMultiplier(0)).toBe(0);
  });

  it('совпадает с суммой шагов улучшения baseCost × 1.15^уровень', () => {
    for (const level of [2, 5, 12]) {
      let manual = 0;
      for (let l = 1; l < level; l++) manual += Math.pow(1.15, l);
      expect(investedMultiplier(level)).toBeCloseTo(manual, 6);
    }
  });
});

describe('isEmptyPlan', () => {
  it('различает пустой и непустой план', () => {
    expect(isEmptyPlan(planDemolition([], {}, BUILDINGS, flatCost))).toBe(true);
    expect(isEmptyPlan(planDemolition(['9,9'], {}, BUILDINGS, flatCost))).toBe(true);
    expect(
      isEmptyPlan(planDemolition(['1,1'], { '1,1': 'miner_mk1' }, BUILDINGS, flatCost)),
    ).toBe(false);
  });
});
