/**
 * Интеграционная проверка очереди стройки прямо на сторе (bigplan.md, пункты 18–19).
 *
 * Юнит-тесты в core/systems/construction.test.ts проверяют формулы. Здесь — что стор их
 * действительно применяет: клетка занимается, стоимость списывается ИЗ БУФЕРА (а не только
 * из resources[*].amount, иначе она возвращалась бы при перезагрузке), здание не работает до
 * завершения, а тик доводит работу до конца.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useGameStore } from './gameStore';
import { D } from '../core/math/format';
import type { ResourceType } from '../core/gameTypes';

/*
 * Наполняем базу до ПОЛОВИНЫ реальной вместимости склада, а не произвольным огромным числом.
 * Причина: recomputeCaps пересчитывает `max` из зданий при каждой постройке и затирает
 * искусственно завышенный лимит, а возврат при отмене обрезается по вместимости — на полном
 * складе он бы просто не поместился, и тест ловил бы не то, что проверяет.
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
    return {
      grid: { ...s.grid, buffers },
      resources,
      currency: { ...s.currency, credits: D('1000000000') },
    };
  });
}

/** Пустая клетка, где точно нет базы и нет требования по месторождению. */
const FREE_TILE = { x: 0, y: 0 };

beforeEach(() => {
  useGameStore.getState().resetGame();
  fundBase();
});

describe('постройка занимает время', () => {
  it('клик по клетке создаёт работу, а не готовое здание', () => {
    const store = useGameStore.getState();
    store.selectBuild('solar_panel_mk1');
    store.placeSelectedBuildAt(FREE_TILE);

    const grid = useGameStore.getState().grid;
    const key = `${FREE_TILE.x},${FREE_TILE.y}`;

    // Клетка занята — второй раз сюда не поставить.
    expect(grid.tiles[key]).toBe('solar_panel_mk1');
    // Но работа ещё идёт.
    const job = grid.tileJobs?.[key];
    expect(job).toBeDefined();
    expect(job?.kind).toBe('build');
    expect(job?.duration).toBeGreaterThan(0);
  });

  it('стоимость списывается из grid.buffers.base — иначе вернулась бы при перезагрузке', () => {
    const before = D(useGameStore.getState().grid.buffers.base?.steel ?? '0');

    const store = useGameStore.getState();
    store.selectBuild('solar_panel_mk1');
    store.placeSelectedBuildAt(FREE_TILE);

    const after = D(useGameStore.getState().grid.buffers.base?.steel ?? '0');
    expect(after.lt(before)).toBe(true);
  });

  it('тик достраивает, когда время вышло', () => {
    const store = useGameStore.getState();
    store.selectBuild('solar_panel_mk1');
    store.placeSelectedBuildAt(FREE_TILE);

    const key = `${FREE_TILE.x},${FREE_TILE.y}`;
    const job = useGameStore.getState().grid.tileJobs![key];

    // Работа ещё не готова — тик её не трогает.
    useGameStore.getState().tick(0.05);
    expect(useGameStore.getState().grid.tileJobs?.[key]).toBeDefined();

    // Перематываем время за конец работы. Именно так работает и оффлайн: длительность
    // считается от абсолютного startedAt, а не накоплением прогресса.
    vi.spyOn(Date, 'now').mockReturnValue(job.startedAt + job.duration + 1);
    try {
      useGameStore.getState().tick(0.05);
      expect(useGameStore.getState().grid.tileJobs?.[key]).toBeUndefined();
      expect(useGameStore.getState().grid.tiles[key]).toBe('solar_panel_mk1');
    } finally {
      vi.restoreAllMocks();
    }
  });
});

describe('отмена работы', () => {
  it('возвращает ресурсы и освобождает клетку', () => {
    const key = `${FREE_TILE.x},${FREE_TILE.y}`;
    const store = useGameStore.getState();

    const before = D(useGameStore.getState().grid.buffers.base?.steel ?? '0');
    store.selectBuild('solar_panel_mk1');
    store.placeSelectedBuildAt(FREE_TILE);
    expect(useGameStore.getState().grid.tileJobs?.[key]).toBeDefined();

    useGameStore.getState().cancelTileJob(FREE_TILE);

    const after = useGameStore.getState();
    expect(after.grid.tileJobs?.[key]).toBeUndefined();
    expect(after.grid.tiles[key]).toBeUndefined();
    expect(D(after.grid.buffers.base?.steel ?? '0').toString()).toBe(before.toString());
  });

  it('на клетке без работы ничего не делает', () => {
    const before = useGameStore.getState().grid;
    useGameStore.getState().cancelTileJob({ x: 5, y: 5 });
    expect(useGameStore.getState().grid).toBe(before);
  });
});

describe('улучшение занимает время', () => {
  /** Ставит здание и мгновенно доводит стройку до конца. */
  function placeAndFinish(buildingId: string, pos: { x: number; y: number }) {
    const store = useGameStore.getState();
    store.selectBuild(buildingId);
    store.placeSelectedBuildAt(pos);

    const key = `${pos.x},${pos.y}`;
    const job = useGameStore.getState().grid.tileJobs![key];
    vi.spyOn(Date, 'now').mockReturnValue(job.startedAt + job.duration + 1);
    useGameStore.getState().tick(0.05);
    vi.restoreAllMocks();
    return key;
  }

  it('уровень поднимается только по завершении работы', () => {
    const key = placeAndFinish('solar_panel_mk1', FREE_TILE);
    expect(useGameStore.getState().grid.tileLevels?.[key]).toBe(1);

    useGameStore.getState().upgradeBuildingAt(FREE_TILE);

    // Работа поставлена, уровень пока прежний.
    const job = useGameStore.getState().grid.tileJobs?.[key];
    expect(job?.kind).toBe('upgrade');
    expect(job?.targetLevel).toBe(2);
    expect(useGameStore.getState().grid.tileLevels?.[key]).toBe(1);

    vi.spyOn(Date, 'now').mockReturnValue(job!.startedAt + job!.duration + 1);
    try {
      useGameStore.getState().tick(0.05);
      expect(useGameStore.getState().grid.tileLevels?.[key]).toBe(2);
      expect(useGameStore.getState().grid.tileJobs?.[key]).toBeUndefined();
    } finally {
      vi.restoreAllMocks();
    }
  });

  it('второе улучшение в очередь не встаёт, пока идёт первое', () => {
    const key = placeAndFinish('solar_panel_mk1', FREE_TILE);
    useGameStore.getState().upgradeBuildingAt(FREE_TILE);
    const jobAfterFirst = useGameStore.getState().grid.tileJobs?.[key];

    useGameStore.getState().upgradeBuildingAt(FREE_TILE);
    expect(useGameStore.getState().grid.tileJobs?.[key]).toBe(jobAfterFirst);
  });

  it('стоимость улучшения списывается из буфера, а не только из resources', () => {
    placeAndFinish('solar_panel_mk1', FREE_TILE);

    const beforeBuffer = D(useGameStore.getState().grid.buffers.base?.steel ?? '0');
    useGameStore.getState().upgradeBuildingAt(FREE_TILE);
    const afterBuffer = D(useGameStore.getState().grid.buffers.base?.steel ?? '0');

    expect(afterBuffer.lt(beforeBuffer)).toBe(true);
    // И resources согласован с буфером — иначе UI и загрузка расходятся.
    expect(useGameStore.getState().resources.steel.amount.toString()).toBe(afterBuffer.toString());
  });

  it('отмена улучшения возвращает стоимость и оставляет прежний уровень', () => {
    const key = placeAndFinish('solar_panel_mk1', FREE_TILE);

    const before = D(useGameStore.getState().grid.buffers.base?.steel ?? '0');
    useGameStore.getState().upgradeBuildingAt(FREE_TILE);
    useGameStore.getState().cancelTileJob(FREE_TILE);

    const after = useGameStore.getState();
    expect(after.grid.tileJobs?.[key]).toBeUndefined();
    expect(after.grid.tileLevels?.[key]).toBe(1);
    expect(after.grid.tiles[key]).toBe('solar_panel_mk1');
    expect(D(after.grid.buffers.base?.steel ?? '0').toString()).toBe(before.toString());
  });
});
