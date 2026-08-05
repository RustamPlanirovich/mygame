/**
 * План сноса, в том числе массового (bigplan.md, пункты 10 и 28).
 */

import { describe, expect, it } from 'vitest';
import Decimal from 'break_eternity.js';
import type { Building, ResourceType } from '../gameTypes';
import { DEMOLITION_REFUND_RATE, isEmptyPlan, planDemolition } from './demolition';
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

describe('isEmptyPlan', () => {
  it('различает пустой и непустой план', () => {
    expect(isEmptyPlan(planDemolition([], {}, BUILDINGS, flatCost))).toBe(true);
    expect(isEmptyPlan(planDemolition(['9,9'], {}, BUILDINGS, flatCost))).toBe(true);
    expect(
      isEmptyPlan(planDemolition(['1,1'], { '1,1': 'miner_mk1' }, BUILDINGS, flatCost)),
    ).toBe(false);
  });
});
