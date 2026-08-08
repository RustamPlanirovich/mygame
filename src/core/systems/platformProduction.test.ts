/**
 * Производство на платформе (bigplan.md, пункт 45).
 *
 * Проверяется ровно то, чего раньше не было вообще: платформа не выдаёт продукцию без
 * входного сырья и без энергии, а причина простоя называется. Плюс регресс на «апгрейд
 * клетки должен что-то менять» — до этого уровень не читался нигде.
 */

import { describe, expect, it } from 'vitest';
import { computePlatformTick, type PlatformTickInput } from './platformProduction';
import { D } from '../math/format';
import type { Building, ResourceState, ResourceType } from '../gameTypes';

function building(id: string, extra: Partial<Building> = {}): Building {
  return { id, name: id, description: '', baseCost: {}, costFactor: 1, production: {}, count: 1, ...extra } as Building;
}

/** Генератор, шахта на жиле, завод с входом — минимальный набор для всех веток. */
const GENERATOR = building('gen', { production: { energy: D(10) } });
const MINER = building('miner_mk1', { production: { ore: D(1) }, energyConsumption: D(2) });
const FACTORY = building('steel_smelter', {
  production: { steel: D(1) },
  consumption: { ore: D(2) },
  energyConsumption: D(1),
});

const CATALOG = new Map<string, Building>([
  [GENERATOR.id, GENERATOR],
  [MINER.id, MINER],
  [FACTORY.id, FACTORY],
]);

function resources(over: Partial<Record<ResourceType, number>> = {}): Record<ResourceType, ResourceState> {
  const keys: ResourceType[] = ['energy', 'ore', 'steel'];
  const out = {} as Record<ResourceType, ResourceState>;
  for (const key of keys) {
    out[key] = { amount: D(over[key] ?? 0), max: D(1000), production: D(0) };
  }
  return out;
}

function input(over: Partial<PlatformTickInput> = {}): PlatformTickInput {
  return {
    tiles: {},
    buildingsById: CATALOG,
    resources: resources(),
    dt: 1,
    miningBonus: 1,
    underAttack: false,
    ...over,
  };
}

describe('производство платформы', () => {
  it('пустая сетка ничего не меняет', () => {
    const before = resources({ ore: 5 });
    const result = computePlatformTick(input({ resources: before }));
    expect(result.resources).toBe(before);
    expect(result.status.working).toBe(0);
  });

  it('без энергии добытчик не производит и причина названа', () => {
    const result = computePlatformTick(
      input({
        tiles: { '1,1': MINER.id },
        deposits: { '1,1': 'ore' },
      }),
    );

    expect(result.resources.ore.amount.toNumber()).toBe(0);
    expect(result.status.noPower).toBe(1);
    expect(result.status.tileStates['1,1']).toBe('no_power');
  });

  it('с генератором добытчик работает', () => {
    const result = computePlatformTick(
      input({
        tiles: { '0,0': GENERATOR.id, '1,1': MINER.id },
        deposits: { '1,1': 'ore' },
      }),
    );

    expect(result.resources.ore.amount.toNumber()).toBeCloseTo(1);
    // Генератор тоже «работает»: он производит энергию. Простаивающих нет ни одного.
    expect(result.status.working).toBe(2);
    // Приход энергии минус расход добытчика: 10 − 2.
    expect(result.resources.energy.amount.toNumber()).toBeCloseTo(8);
  });

  it('добытчик не на своей жиле не работает', () => {
    const result = computePlatformTick(
      input({
        tiles: { '0,0': GENERATOR.id, '1,1': MINER.id },
        deposits: {},
      }),
    );

    expect(result.resources.ore.amount.toNumber()).toBe(0);
    expect(result.status.noDeposit).toBe(1);
  });

  it('ЗАВОД БЕЗ ВХОДНОГО СЫРЬЯ НИЧЕГО НЕ ДЕЛАЕТ — главный сломанный случай', () => {
    const result = computePlatformTick(
      input({
        tiles: { '0,0': GENERATOR.id, '2,2': FACTORY.id },
        resources: resources({ ore: 0 }),
      }),
    );

    expect(result.resources.steel.amount.toNumber()).toBe(0);
    expect(result.status.noInput).toBe(1);
    expect(result.status.missingInputs).toContain('ore');
  });

  it('завод с сырьём производит и тратит вход', () => {
    const result = computePlatformTick(
      input({
        tiles: { '0,0': GENERATOR.id, '2,2': FACTORY.id },
        resources: resources({ ore: 10 }),
      }),
    );

    expect(result.resources.steel.amount.toNumber()).toBeCloseTo(1);
    expect(result.resources.ore.amount.toNumber()).toBeCloseTo(8);
    expect(result.status.working).toBe(2);
  });

  it('сырья хватает на половину шага — выпуск ровно половинный', () => {
    const result = computePlatformTick(
      input({
        tiles: { '0,0': GENERATOR.id, '2,2': FACTORY.id },
        resources: resources({ ore: 1 }),
      }),
    );

    expect(result.resources.steel.amount.toNumber()).toBeCloseTo(0.5);
    expect(result.resources.ore.amount.toNumber()).toBeCloseTo(0);
  });

  it('уровень клетки увеличивает выпуск: за апгрейд теперь есть что показать', () => {
    const result = computePlatformTick(
      input({
        tiles: { '0,0': GENERATOR.id, '1,1': MINER.id },
        deposits: { '1,1': 'ore' },
        tileLevels: { '1,1': 3 },
      }),
    );

    expect(result.resources.ore.amount.toNumber()).toBeCloseTo(3);
  });

  it('апгрейд «Добыча» и бонус галактики умножаются', () => {
    const result = computePlatformTick(
      input({
        tiles: { '0,0': GENERATOR.id, '1,1': MINER.id },
        deposits: { '1,1': 'ore' },
        miningBonus: 1.5,
        galaxyBonuses: { ore: 2 },
      }),
    );

    expect(result.resources.ore.amount.toNumber()).toBeCloseTo(3);
  });

  it('строящееся здание не производит и не ест энергию', () => {
    const result = computePlatformTick(
      input({
        tiles: { '0,0': GENERATOR.id, '1,1': MINER.id },
        deposits: { '1,1': 'ore' },
        tileJobs: { '1,1': { kind: 'build' } },
      }),
    );

    expect(result.resources.ore.amount.toNumber()).toBe(0);
    expect(result.status.building).toBe(1);
    // Расхода нет вовсе: в запас ушла вся выработка генератора.
    expect(result.resources.energy.amount.toNumber()).toBeCloseTo(10);
  });

  it('полный склад отмечается отдельной причиной', () => {
    const full = resources();
    full.ore = { amount: D(1000), max: D(1000), production: D(0) };
    const result = computePlatformTick(
      input({
        tiles: { '0,0': GENERATOR.id, '1,1': MINER.id },
        deposits: { '1,1': 'ore' },
        resources: full,
      }),
    );

    expect(result.status.storageFull).toBe(1);
    expect(result.resources.ore.amount.toNumber()).toBe(1000);
  });

  it('дефицит энергии режет выпуск, но не выработку самой энергии', () => {
    // Генератор 10 ⚡/с против двадцати добытчиков по 2 ⚡/с: покрыта четверть потребности.
    const tiles: Record<string, string> = { '0,0': GENERATOR.id };
    const deposits: Record<string, 'ore'> = {};
    for (let i = 0; i < 20; i++) {
      tiles[`1,${i}`] = MINER.id;
      deposits[`1,${i}`] = 'ore';
    }

    const result = computePlatformTick(input({ tiles, deposits }));

    expect(result.status.energyEfficiency).toBeCloseTo(0.25);
    // 20 добытчиков × 1 ед./с × 0.25 эффективности.
    expect(result.resources.ore.amount.toNumber()).toBeCloseTo(5);
  });

  it('исходный склад не мутируется', () => {
    const before = resources({ ore: 10 });
    computePlatformTick(
      input({
        tiles: { '0,0': GENERATOR.id, '2,2': FACTORY.id },
        resources: before,
      }),
    );

    expect(before.ore.amount.toNumber()).toBe(10);
    expect(before.steel.amount.toNumber()).toBe(0);
  });
});
