/**
 * Энергобаланс (bigplan.md, пункт 22).
 *
 * Главное здесь — `efficiency`: множитель, на который дальше умножается выпуск КАЖДОГО
 * здания. Ошибка в нём ничего не роняет и нигде не логируется, она просто делает базу
 * медленнее на несколько процентов — поэтому каждая ветка дефицита проверяется отдельно.
 */

import { describe, expect, it } from 'vitest';
import { computeEnergyBalance, type EnergyBalanceInput } from './energyBalance';
import { D } from '../math/format';
import type { Building } from '../gameTypes';

function building(id: string, extra: Partial<Building> = {}): Building {
  return { id, name: id, description: '', baseCost: {}, count: 1, ...extra } as unknown as Building;
}

const GENERATOR = building('gen', { production: { energy: D(10) } });
const CONSUMER = building('mine', { energyConsumption: D(4) });

function input(over: Partial<EnergyBalanceInput> = {}): EnergyBalanceInput {
  return {
    buildings: [],
    tilesByBuildingId: new Map(),
    tileDisabled: {},
    tileSettings: undefined,
    tileLevels: {},
    tileEvolutionLevels: {},
    autoStoppedBuildingIds: null,
    buildingTypeMultipliers: {},
    waveActive: false,
    repeatableEnergyEfficiency: 1,
    policyEnergyConsumption: 1,
    policyEnergyProduction: 1,
    specialConsumption: 1,
    energyDeficitRelief: 0,
    storedEnergy: D(0),
    dtFacilities: 1,
    ...over,
  };
}

const oneOfEach = () =>
  input({
    buildings: [GENERATOR, CONSUMER],
    tilesByBuildingId: new Map([
      ['gen', ['0,0']],
      ['mine', ['1,0']],
    ]),
  });

describe('суммирование', () => {
  it('считает выработку и расход по размещённым клеткам', () => {
    const r = computeEnergyBalance(oneOfEach());
    expect(r.production.toString()).toBe('10');
    expect(r.consumption.toString()).toBe('4');
    expect(r.efficiency).toBe(1);
  });

  it('здание из каталога без клеток на карте не влияет ни на что', () => {
    const r = computeEnergyBalance(input({ buildings: [GENERATOR, CONSUMER] }));
    expect(r.production.toString()).toBe('0');
    expect(r.consumption.toString()).toBe('0');
  });

  it('уровень здания умножает и выработку, и расход', () => {
    const r = computeEnergyBalance(
      input({
        buildings: [GENERATOR, CONSUMER],
        tilesByBuildingId: new Map([
          ['gen', ['0,0']],
          ['mine', ['1,0']],
        ]),
        tileLevels: { '0,0': 3, '1,0': 2 },
      }),
    );
    expect(r.production.toString()).toBe('30');
    expect(r.consumption.toString()).toBe('8');
  });

  it('отключённая клетка не считается', () => {
    const r = computeEnergyBalance({ ...oneOfEach(), tileDisabled: { '0,0': true } });
    expect(r.production.toString()).toBe('0');
    expect(r.consumption.toString()).toBe('4');
  });

  it('клетка, выключенная в настройках, не считается', () => {
    const r = computeEnergyBalance({
      ...oneOfEach(),
      tileSettings: { '1,0': { enabled: false } },
    });
    expect(r.consumption.toString()).toBe('0');
  });

  it('здание, заглушенное политикой, выпадает из итогов целиком', () => {
    const r = computeEnergyBalance({
      ...oneOfEach(),
      autoStoppedBuildingIds: new Set(['mine']),
    });
    expect(r.consumption.toString()).toBe('0');
    expect(r.production.toString()).toBe('10');
  });

  it('активный расход суммируется поверх пассивного', () => {
    const both = building('both', { energyConsumption: D(4), consumption: { energy: D(6) } });
    const r = computeEnergyBalance(
      input({ buildings: [both], tilesByBuildingId: new Map([['both', ['0,0']]]) }),
    );
    expect(r.consumption.toString()).toBe('10');
  });
});

describe('боевые здания', () => {
  const turret = building('turret', { defense: { energyPerSecond: D(5) } as never });
  const withTurret = (waveActive: boolean) =>
    computeEnergyBalance(
      input({
        buildings: [turret],
        tilesByBuildingId: new Map([['turret', ['2,2', '3,3']]]),
        waveActive,
      }),
    );

  it('вне волны не потребляют', () => {
    expect(withTurret(false).consumption.toString()).toBe('0');
  });

  it('во время волны потребляют за каждую активную клетку', () => {
    expect(withTurret(true).consumption.toString()).toBe('10');
  });

  it('отключённая турель не потребляет даже в бою', () => {
    const r = computeEnergyBalance(
      input({
        buildings: [turret],
        tilesByBuildingId: new Map([['turret', ['2,2', '3,3']]]),
        tileDisabled: { '2,2': true },
        waveActive: true,
      }),
    );
    expect(r.consumption.toString()).toBe('5');
  });
});

describe('множители применяются к итогам', () => {
  it('политика повышенного расхода поднимает потребление', () => {
    const r = computeEnergyBalance({ ...oneOfEach(), policyEnergyConsumption: 1.5 });
    expect(r.consumption.toString()).toBe('6');
  });

  it('множитель здания от политики влияет и на энергобаланс', () => {
    /*
     * Иначе энергобаланс считался бы по «непрокачанной» станции и резал бы производство
     * мнимым дефицитом, которого на деле нет.
     */
    const r = computeEnergyBalance({ ...oneOfEach(), buildingTypeMultipliers: { gen: 2 } });
    expect(r.production.toString()).toBe('20');
  });

  it('эффективность исследований снижает расход', () => {
    const r = computeEnergyBalance({ ...oneOfEach(), repeatableEnergyEfficiency: 0.5 });
    expect(r.consumption.toString()).toBe('2');
  });
});

describe('дефицит: три ветки', () => {
  const deficit = (storedEnergy: number, over: Partial<EnergyBalanceInput> = {}) =>
    computeEnergyBalance(
      input({
        buildings: [GENERATOR, CONSUMER],
        tilesByBuildingId: new Map([
          ['gen', ['0,0']],
          ['mine', ['1,0', '2,0', '3,0']], // расход 12 против выработки 10
        ]),
        storedEnergy: D(storedEnergy),
        ...over,
      }),
    );

  it('запаса хватает — работаем на полную', () => {
    // Недостача 2/с; в буфере 100 — просаживать производство не за что.
    expect(deficit(100).efficiency).toBe(1);
  });

  it('запаса нет — эффективность равна доле выработки', () => {
    // 10 / 12
    expect(deficit(0).efficiency).toBeCloseTo(10 / 12, 6);
  });

  it('запас частичный — учитывается вместе с выработкой', () => {
    /*
     * Ключевая ветка: без учёта запаса база с полным аккумулятором проседала бы ровно так
     * же, как база с пустым. Здесь (10·1 + 1) / (12·1).
     */
    const partial = deficit(1).efficiency;
    expect(partial).toBeCloseTo(11 / 12, 6);
    expect(partial).toBeGreaterThan(deficit(0).efficiency);
  });

  it('совсем без выработки и запаса — ноль', () => {
    const r = computeEnergyBalance(
      input({
        buildings: [CONSUMER],
        tilesByBuildingId: new Map([['mine', ['1,0']]]),
        storedEnergy: D(0),
      }),
    );
    expect(r.efficiency).toBe(0);
  });

  it('«снижение потерь» прощает долю провала', () => {
    const raw = deficit(0).efficiency;
    const relieved = deficit(0, { energyDeficitRelief: 0.5 }).efficiency;
    expect(relieved).toBeCloseTo(raw + (1 - raw) * 0.5, 6);
  });

  it('«снижение потерь» не поднимает эффективность выше единицы', () => {
    expect(deficit(100, { energyDeficitRelief: 1 }).efficiency).toBe(1);
  });

  it('эффективность всегда в границах 0..1', () => {
    for (const stored of [0, 0.001, 1, 5, 1e9]) {
      const e = deficit(stored).efficiency;
      expect(e).toBeGreaterThanOrEqual(0);
      expect(e).toBeLessThanOrEqual(1);
    }
  });
});

describe('профицит', () => {
  it('избыток выработки не даёт эффективность выше единицы', () => {
    const r = computeEnergyBalance(oneOfEach());
    expect(r.efficiency).toBe(1);
  });

  it('пустая база: ни выработки, ни расхода — полная эффективность', () => {
    const r = computeEnergyBalance(input());
    expect(r.efficiency).toBe(1);
  });
});
