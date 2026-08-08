/**
 * Платформы и топливо перевозок в живом сторе (bigplan.md, пункт 45).
 *
 * Чистые модули проверяются рядом с собой (`core/systems/platformProduction.test.ts`,
 * `transportFuel.test.ts`). Здесь — ровно те два противоречия, на которые указал игрок, но в
 * том виде, в каком он с ними сталкивается:
 *
 *   1. на карте без нефти караван не выезжал НИКОГДА, потому что топлива взять негде;
 *   2. здания на платформе работали без энергии и без сырья.
 *
 * Плюс регресс на списание через буфер базы: без него груз и топливо возвращались игроку при
 * каждой перезагрузке — `syncResourcesFromBase` перетирает `amount` значением из буфера.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { useGameStore } from './gameStore';
import { D } from '../core/math/format';
import type { ResourceType } from '../core/gameTypes';

beforeEach(() => {
  useGameStore.getState().resetGame();
});

/** Сколько ресурса лежит в буфере базы — единственный источник правды по складу. */
function baseBuffer(res: ResourceType) {
  const raw = useGameStore.getState().grid.buffers.base?.[res];
  return D(raw ?? 0);
}

function makePlatform() {
  useGameStore.setState((s) => ({
    currency: { ...s.currency, credits: D(1_000_000), influence: D(10_000) },
  }));
  const galaxyId = useGameStore.getState().galaxies.currentGalaxyId;
  useGameStore.getState().createPlatform(galaxyId, 'Тестовая');
  return useGameStore.getState().galaxies.platforms[0];
}

describe('платформа: производство', () => {
  it('без энергии и без сырья завод на платформе не производит ничего', () => {
    const platform = makePlatform();

    // Сталеплавильня требует руду и энергию — на новой платформе нет ни того, ни другого.
    useGameStore.setState((s) => ({
      galaxies: {
        ...s.galaxies,
        platforms: s.galaxies.platforms.map((p) =>
          p.id === platform.id
            ? { ...p, grid: { ...p.grid, tiles: { '3,3': 'steel_smelter_mk1' } } }
            : p,
        ),
      },
    }));

    useGameStore.getState().tick(1);

    const after = useGameStore.getState().galaxies.platforms[0];
    expect(after.resources.steel.amount.toNumber()).toBe(0);
    // Причина названа: либо нет энергии, либо нет входа — но клетка точно не «работает».
    expect((after.status?.noPower ?? 0) + (after.status?.noInput ?? 0)).toBe(1);
    expect(after.status?.working).toBe(0);
  });

  it('добытчик на жиле с генератором работает, и панель знает, что он работает', () => {
    const platform = makePlatform();

    useGameStore.setState((s) => ({
      galaxies: {
        ...s.galaxies,
        platforms: s.galaxies.platforms.map((p) =>
          p.id === platform.id
            ? {
                ...p,
                grid: {
                  ...p.grid,
                  tiles: { '0,0': 'solar_panel_mk1', '1,1': 'miner_mk1' },
                  deposits: { ...p.grid.deposits, '1,1': 'ore' as const },
                },
              }
            : p,
        ),
      },
    }));

    useGameStore.getState().tick(1);

    const after = useGameStore.getState().galaxies.platforms[0];
    expect(after.resources.ore.amount.toNumber()).toBeGreaterThan(0);
    expect(after.status?.working).toBe(2);
    expect(after.status?.noPower).toBe(0);
  });

  it('апгрейд «Хранилище» реально поднимает лимит склада', () => {
    const platform = makePlatform();
    const before = platform.resources.ore.max;

    useGameStore.getState().upgradePlatform(platform.id, 'storage');

    const after = useGameStore.getState().galaxies.platforms[0];
    expect(after.resources.ore.max.toNumber()).toBeCloseTo(before.mul(1.5).toNumber());
  });
});

describe('караван: топливо и списание', () => {
  it('КАРТА БЕЗ НЕФТИ: одного купленного резерва достаточно, чтобы отправить караван', () => {
    const platform = makePlatform();

    // Ни жидкого топлива, ни бензина — ровно ситуация «Бесплодной Луны».
    expect(baseBuffer('liquid_fuel').toNumber()).toBe(0);
    expect(baseBuffer('gasoline').toNumber()).toBe(0);

    useGameStore.getState().buyFuel(100);
    useGameStore.setState((s) => ({
      grid: { ...s.grid, buffers: { ...s.grid.buffers, base: { ...s.grid.buffers.base, ore: '100' } } },
    }));
    const reserveBefore = useGameStore.getState().galaxies.fuelReserve;

    useGameStore.getState().sendCaravan('main_base', platform.id, { ore: D(50) });

    const state = useGameStore.getState();
    expect(state.intergalacticLogistics.caravans).toHaveLength(1);
    // Топливо ушло из резерва, а не из несуществующего жидкого топлива.
    expect(state.galaxies.fuelReserve.lt(reserveBefore)).toBe(true);
    expect(baseBuffer('liquid_fuel').toNumber()).toBe(0);
  });

  it('груз списывается ИЗ БУФЕРА базы, иначе перезагрузка его вернёт', () => {
    const platform = makePlatform();
    useGameStore.getState().buyFuel(100);
    useGameStore.setState((s) => ({
      grid: { ...s.grid, buffers: { ...s.grid.buffers, base: { ...s.grid.buffers.base, ore: '100' } } },
    }));

    useGameStore.getState().sendCaravan('main_base', platform.id, { ore: D(40) });

    expect(baseBuffer('ore').toNumber()).toBe(60);
    expect(useGameStore.getState().resources.ore.amount.toNumber()).toBe(60);
  });

  it('без топлива вообще караван не уезжает и ничего не списывает', () => {
    const platform = makePlatform();
    useGameStore.setState((s) => ({
      galaxies: { ...s.galaxies, fuelReserve: D(0) },
      grid: { ...s.grid, buffers: { ...s.grid.buffers, base: { ...s.grid.buffers.base, ore: '100' } } },
    }));

    useGameStore.getState().sendCaravan('main_base', platform.id, { ore: D(100) });

    expect(useGameStore.getState().intergalacticLogistics.caravans).toHaveLength(0);
    expect(baseBuffer('ore').toNumber()).toBe(100);
  });
});
