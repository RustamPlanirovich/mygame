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
import type { GridState, ResourceType, SpacePlatform } from '../core/gameTypes';
import { createPlatformEnemy } from '../core/constants/enemies';

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

/** Точечно поправить платформу в сторе, не переписывая всё дерево galaxies руками. */
function patchPlatform(id: string, patch: (p: SpacePlatform) => Partial<SpacePlatform>) {
  useGameStore.setState((s) => ({
    galaxies: {
      ...s.galaxies,
      platforms: s.galaxies.platforms.map((p) => (p.id === id ? { ...p, ...patch(p) } : p)),
    },
  }));
}

const platformGrid = (p: SpacePlatform, tiles: Record<string, string>): { grid: GridState } => ({
  grid: { ...p.grid, tiles },
});

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

/*
 * ОБОРОНА: КТО КОГО ЗАЩИЩАЕТ.
 *
 * Жалоба игрока: «турели с основной базы охраняют и платформу, хотя платформа в космосе».
 * Разбор показал склейку в обе стороны — бой базы считал турели по глобальному счётчику
 * каталога (а тот растёт и от построек на платформе), а собственные турели платформы не
 * стреляли вообще, потому что их считало действие, которое никто не вызывал.
 */
describe('платформа: оборона', () => {
  /** Немирная карта: на «Тренировочном полигоне» волн не бывает вовсе. */
  function hostileMap() {
    useGameStore.setState((s) => ({ maps: { ...s.maps, currentMapId: 'map_barren_moon' } }));
  }

  it('турель, построенная на платформе, не защищает базу', () => {
    hostileMap();
    const platform = makePlatform();

    // Ровно то, что делает placeSelectedBuildAt на платформе: клетка платформы + счётчик
    // каталога (счётчик общий на базу и платформы, и именно он раньше шёл в бой базы).
    patchPlatform(platform.id, (p) => platformGrid(p, { '2,2': 'turret_mk1' }));
    useGameStore.setState((s) => ({
      buildings: s.buildings.map((b) => (b.id === 'turret_mk1' ? { ...b, count: b.count + 3 } : b)),
      combat: {
        ...s.combat,
        enemies: [{ id: 'e1', type: 'scout' as const, maxHp: D(50), hp: D(50), distance: 0.9, speed: 0.01 }],
        waveEndsAt: Date.now() + 30_000,
      },
    }));

    useGameStore.getState().tick(1);

    const combat = useGameStore.getState().combat;
    /*
     * Турели на базе нет: стрелять нечем, значит и энергии оборона не просит. Проверяем
     * именно расход и долю залпа — HP врага трогает ещё и нанорой, он работает бесплатно и
     * к турелям отношения не имеет.
     */
    expect(combat.defenseEnergyNeedPerSecond.toNumber()).toBe(0);
    expect(combat.defenseEnergyUsedPerSecond.toNumber()).toBe(0);
    expect(combat.defenseFireRatio.toNumber()).toBe(0);
  });

  it('турель на платформе стреляет по врагам платформы', () => {
    const platform = makePlatform();

    patchPlatform(platform.id, (p) => ({
      ...platformGrid(p, { '0,0': 'solar_panel_mk1', '1,1': 'defense_turret_mk1' }),
      combat: { ...p.combat, enemies: [createPlatformEnemy('pirate_raider', 1)] },
    }));
    const hpBefore = useGameStore.getState().galaxies.platforms[0].combat.enemies[0].hp;

    useGameStore.getState().tick(1);

    const after = useGameStore.getState().galaxies.platforms[0];
    // Панель наконец показывает реальное число стволов, а враг получает урон.
    expect(after.combat.turretCount).toBe(1);
    const enemy = after.combat.enemies[0];
    expect(enemy === undefined || enemy.hp.lt(hpBefore)).toBe(true);
  });

  it('без энергии турель платформы не стреляет', () => {
    const platform = makePlatform();

    // Та же турель, но без электростанции: энергобаланс платформы в нуле.
    patchPlatform(platform.id, (p) => ({
      ...platformGrid(p, { '1,1': 'defense_turret_mk1' }),
      combat: { ...p.combat, enemies: [createPlatformEnemy('pirate_raider', 1)] },
    }));
    const hpBefore = useGameStore.getState().galaxies.platforms[0].combat.enemies[0].hp;

    useGameStore.getState().tick(1);

    const after = useGameStore.getState().galaxies.platforms[0];
    expect(after.combat.turretCount).toBe(1);
    expect(after.combat.enemies[0].hp.toNumber()).toBe(hpBefore.toNumber());
  });

  it('строящаяся турель платформы в бою не участвует', () => {
    const platform = makePlatform();

    patchPlatform(platform.id, (p) => ({
      grid: {
        ...p.grid,
        tiles: { '0,0': 'solar_panel_mk1', '1,1': 'defense_turret_mk1' },
        tileJobs: {
          '1,1': { kind: 'build', buildingId: 'defense_turret_mk1', startedAt: Date.now(), duration: 60_000 },
        },
      },
      combat: { ...p.combat, enemies: [createPlatformEnemy('pirate_raider', 1)] },
    }));
    const hpBefore = useGameStore.getState().galaxies.platforms[0].combat.enemies[0].hp;

    useGameStore.getState().tick(1);

    const after = useGameStore.getState().galaxies.platforms[0];
    expect(after.combat.turretCount).toBe(0);
    expect(after.combat.enemies[0].hp.toNumber()).toBe(hpBefore.toNumber());
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
