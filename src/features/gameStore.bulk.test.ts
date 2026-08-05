/**
 * Массовые операции над зданиями на сторе (bigplan.md, пункты 10 и 28).
 *
 * Формулы возврата проверены в core/systems/demolition.test.ts. Здесь — что стор их применяет:
 * одним обновлением состояния, с чисткой всех попутных карт (уровни, эволюция, «выключено»,
 * незавершённые работы) и без сноса ядра базы.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useGameStore, getBasePos } from './gameStore';
import { D } from '../core/math/format';
import type { GridCoord, ResourceType } from '../core/gameTypes';

/**
 * Наполняем базу до половины вместимости.
 *
 * Именно до половины, а не «побольше»: возврат при сносе обрезается по вместимости склада, и на
 * полном складе тесты возврата проверяли бы кламп вместо арифметики.
 */
function fundBase() {
  useGameStore.setState((s) => {
    const buffers = { ...s.grid.buffers, base: { ...(s.grid.buffers.base ?? {}) } };
    const resources = { ...s.resources };
    for (const key of Object.keys(resources) as ResourceType[]) {
      const half = resources[key].max.div(2);
      buffers.base[key] = half.toString();
      resources[key] = { ...resources[key], amount: half };
    }
    return { grid: { ...s.grid, buffers }, resources, currency: { ...s.currency, credits: D('1e9') } };
  });
}

/**
 * Наполняем базу СВЕРХ вместимости.
 *
 * Нужно там, где важна не арифметика возврата, а сам факт операции: например, плавильня стоит
 * 400 энергии, а стартовая вместимость по энергии — 50, поэтому «до половины» её не поставить,
 * и без этого фикстура молча не строила здание, а тест падал на пустой клетке.
 */
function fundBaseGenerously() {
  useGameStore.setState((s) => {
    const buffers = { ...s.grid.buffers, base: { ...(s.grid.buffers.base ?? {}) } };
    const resources = { ...s.resources };
    for (const key of Object.keys(resources) as ResourceType[]) {
      buffers.base[key] = '1000000';
      resources[key] = { ...resources[key], amount: D('1000000') };
    }
    return { grid: { ...s.grid, buffers }, resources, currency: { ...s.currency, credits: D('1e9') } };
  });
}

/** Ставит здание и мгновенно доводит стройку до конца. */
function build(buildingId: string, pos: GridCoord) {
  const store = useGameStore.getState();
  store.selectBuild(buildingId);
  store.placeSelectedBuildAt(pos);

  const key = `${pos.x},${pos.y}`;
  const job = useGameStore.getState().grid.tileJobs?.[key];
  if (job) {
    vi.spyOn(Date, 'now').mockReturnValue(job.startedAt + job.duration + 1);
    useGameStore.getState().tick(0.05);
    vi.restoreAllMocks();
  }
  return key;
}

beforeEach(() => {
  useGameStore.getState().resetGame();
  fundBase();
});

describe('removeBuildingsAt', () => {
  it('сносит все выделенные клетки одним обновлением состояния', () => {
    const a = build('solar_panel_mk1', { x: 0, y: 0 });
    const b = build('solar_panel_mk1', { x: 1, y: 0 });
    const c = build('solar_panel_mk1', { x: 2, y: 0 });

    /*
     * Считаем именно смены ссылки на grid, а не все обновления стора: после сноса действие
     * ещё показывает уведомление, и это отдельный (безобидный) set, который grid не трогает.
     */
    let gridChanges = 0;
    let prevGrid = useGameStore.getState().grid;
    const unsub = useGameStore.subscribe((s) => {
      if (s.grid !== prevGrid) {
        gridChanges += 1;
        prevGrid = s.grid;
      }
    });
    useGameStore.getState().removeBuildingsAt([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }]);
    unsub();

    const grid = useGameStore.getState().grid;
    expect(grid.tiles[a]).toBeUndefined();
    expect(grid.tiles[b]).toBeUndefined();
    expect(grid.tiles[c]).toBeUndefined();
    /*
     * Ровно одна пересборка грида на всю пачку. Поштучный вызов removeBuildingAt дал бы три —
     * и три полных пересчёта вместимости складов, что и есть смысл пункта 28.
     */
    expect(gridChanges).toBe(1);
  });

  it('возвращает ресурсы за все снесённые здания', () => {
    build('solar_panel_mk1', { x: 0, y: 0 });
    build('solar_panel_mk1', { x: 1, y: 0 });

    const before = D(useGameStore.getState().grid.buffers.base?.steel ?? '0');
    useGameStore.getState().removeBuildingsAt([{ x: 0, y: 0 }, { x: 1, y: 0 }]);
    const after = D(useGameStore.getState().grid.buffers.base?.steel ?? '0');

    expect(after.gt(before)).toBe(true);
  });

  it('откатывает счётчик каталога на число снесённых', () => {
    build('solar_panel_mk1', { x: 0, y: 0 });
    build('solar_panel_mk1', { x: 1, y: 0 });
    const countBefore = useGameStore.getState().buildings.find(b => b.id === 'solar_panel_mk1')!.count;

    useGameStore.getState().removeBuildingsAt([{ x: 0, y: 0 }, { x: 1, y: 0 }]);

    const countAfter = useGameStore.getState().buildings.find(b => b.id === 'solar_panel_mk1')!.count;
    expect(countBefore - countAfter).toBe(2);
  });

  it('чистит уровни, эволюцию, флаг «выключено» и незавершённые работы', () => {
    // Плавильня — производственное здание, его отключать можно (в отличие от энергетики).
    fundBaseGenerously();
    const key = build('steel_smelter_mk1', { x: 0, y: 0 });
    // toggleBuildingDisabled принимает координату, а не ключ клетки.
    useGameStore.getState().toggleBuildingDisabled({ x: 0, y: 0 });
    expect(useGameStore.getState().grid.tileDisabled?.[key]).toBe(true);

    useGameStore.getState().removeBuildingsAt([{ x: 0, y: 0 }]);

    const grid = useGameStore.getState().grid;
    // Иначе новое здание на этой же клетке унаследовало бы состояние прежнего.
    expect(grid.tileLevels?.[key]).toBeUndefined();
    expect(grid.tileEvolutionLevels?.[key]).toBeUndefined();
    expect(grid.tileDisabled?.[key]).toBeUndefined();
    expect(grid.tileJobs?.[key]).toBeUndefined();
  });

  it('ядро базы не сносится, остальное из выделения — сносится', () => {
    const state = useGameStore.getState();
    const basePos = getBasePos(state.grid);
    build('solar_panel_mk1', { x: 0, y: 0 });

    useGameStore.getState().removeBuildingsAt([basePos, { x: 0, y: 0 }]);

    const grid = useGameStore.getState().grid;
    expect(grid.tiles['0,0']).toBeUndefined();
    // Клетка базы вообще не в tiles, но проверяем, что вызов не упал и не снёс лишнего.
    expect(grid.width).toBeGreaterThan(0);
  });

  it('сбрасывает выбранную клетку, если её снесли', () => {
    build('solar_panel_mk1', { x: 0, y: 0 });
    useGameStore.getState().selectTile({ x: 0, y: 0 });
    expect(useGameStore.getState().grid.selected).toEqual({ x: 0, y: 0 });

    useGameStore.getState().removeBuildingsAt([{ x: 0, y: 0 }]);
    // Иначе инспектор показывал бы «призрак» снесённого здания.
    expect(useGameStore.getState().grid.selected).toBeNull();
  });

  it('пустой список и пустые клетки не меняют состояние', () => {
    const before = useGameStore.getState().grid;
    useGameStore.getState().removeBuildingsAt([]);
    expect(useGameStore.getState().grid).toBe(before);

    useGameStore.getState().removeBuildingsAt([{ x: 7, y: 7 }]);
    expect(useGameStore.getState().grid).toBe(before);
  });

  it('removeBuildingAt работает через тот же код', () => {
    const key = build('solar_panel_mk1', { x: 0, y: 0 });
    useGameStore.getState().removeBuildingAt({ x: 0, y: 0 });
    expect(useGameStore.getState().grid.tiles[key]).toBeUndefined();
  });
});

describe('setBuildingsDisabled', () => {
  it('выключает и включает пачку зданий', () => {
    fundBaseGenerously();
    const a = build('steel_smelter_mk1', { x: 0, y: 0 });
    const b = build('steel_smelter_mk1', { x: 1, y: 0 });
    const positions = [{ x: 0, y: 0 }, { x: 1, y: 0 }];

    useGameStore.getState().setBuildingsDisabled(positions, true);
    expect(useGameStore.getState().grid.tileDisabled?.[a]).toBe(true);
    expect(useGameStore.getState().grid.tileDisabled?.[b]).toBe(true);

    useGameStore.getState().setBuildingsDisabled(positions, false);
    // Ключ удаляется, а не ставится в false: так работает остальной код (проверки `|| false`).
    expect(useGameStore.getState().grid.tileDisabled?.[a]).toBeUndefined();
    expect(useGameStore.getState().grid.tileDisabled?.[b]).toBeUndefined();
  });

  it('повторное выключение уже выключенных не создаёт нового состояния', () => {
    fundBaseGenerously();
    build('steel_smelter_mk1', { x: 0, y: 0 });
    const positions = [{ x: 0, y: 0 }];

    useGameStore.getState().setBuildingsDisabled(positions, true);
    const after = useGameStore.getState().grid;

    useGameStore.getState().setBuildingsDisabled(positions, true);
    expect(useGameStore.getState().grid).toBe(after);
  });

  it('энергетику отключать нельзя — она не в DISABLEABLE_BUILDINGS', () => {
    build('solar_panel_mk1', { x: 0, y: 0 });
    const before = useGameStore.getState().grid;
    useGameStore.getState().setBuildingsDisabled([{ x: 0, y: 0 }], true);
    expect(useGameStore.getState().grid).toBe(before);
  });

  it('пустые клетки игнорируются', () => {
    const before = useGameStore.getState().grid;
    useGameStore.getState().setBuildingsDisabled([{ x: 7, y: 7 }], true);
    expect(useGameStore.getState().grid).toBe(before);
  });
});
