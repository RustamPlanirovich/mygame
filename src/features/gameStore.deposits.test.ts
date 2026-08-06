/**
 * ИССЯКАЕМЫЕ МЕСТОРОЖДЕНИЯ НА ЖИВОМ СТОРЕ (bigplan.md, пункт 38).
 *
 * Формулы генерации и истощения проверяет core/systems/deposits.test.ts. Здесь — что стор их
 * действительно применяет: карта больше не состоит из месторождений наполовину, добыча
 * вычитает из жилы, выработанная шахта встаёт и считается разрушенной, разбор возвращает
 * долю вложенного, а сейв всё это переживает.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useGameStore } from './gameStore';
import { deserializeGame, serializeGame } from './gameSave';
import { D } from '../core/math/format';
import type { ResourceType } from '../core/gameTypes';
import {
  RUIN_REFUND_MAX,
  RUIN_REFUND_MIN,
  depositLeft,
  isDepositExhausted,
} from '../core/systems/deposits';

/** Сейв как изменяемый объект: тесты про совместимость правят payload руками. */
type MutablePayload = {
  grid: { depositReserves?: Record<string, { left: string; total: string }> };
};

/** Наполняет базу до половины вместимости: строить и улучшать должно быть на что. */
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

/** Первая клетка с рудой, куда можно поставить майнер. */
function findOreTile(): { key: string; pos: { x: number; y: number } } {
  const grid = useGameStore.getState().grid;
  for (const [key, type] of Object.entries(grid.deposits ?? {})) {
    if (type !== 'ore') continue;
    const [x, y] = key.split(',').map(Number);
    if (grid.tiles[key]) continue;
    // Рядом должно найтись место под генератор: без энергопокрытия шахта не работает вовсе.
    if (x <= 0 && y <= 0) continue;
    return { key, pos: { x, y } };
  }
  throw new Error('на стартовой карте нет свободной рудной жилы');
}

/**
 * Ставит генератор рядом с клеткой.
 *
 * Без энергопокрытия тик пропускает здание целиком (Фаза 8.2), и тест «добыча вычитает из
 * жилы» проверял бы неработающую шахту.
 */
function powerUp(pos: { x: number; y: number }) {
  const grid = useGameStore.getState().grid;
  const candidates = [
    { x: pos.x - 1, y: pos.y },
    { x: pos.x, y: pos.y - 1 },
    { x: pos.x + 1, y: pos.y },
    { x: pos.x, y: pos.y + 1 },
  ];
  for (const c of candidates) {
    if (c.x < 0 || c.y < 0 || c.x >= grid.width || c.y >= grid.height) continue;
    if (grid.tiles[`${c.x},${c.y}`]) continue;
    placeAndFinish('generator_mk1', c);
    return;
  }
  throw new Error('некуда поставить генератор рядом с шахтой');
}

/** Ставит здание и мгновенно доводит стройку до конца. */
function placeAndFinish(buildingId: string, pos: { x: number; y: number }) {
  const store = useGameStore.getState();
  store.selectBuild(buildingId);
  store.placeSelectedBuildAt(pos);

  const key = `${pos.x},${pos.y}`;
  const job = useGameStore.getState().grid.tileJobs?.[key];
  if (!job) return;

  vi.spyOn(Date, 'now').mockReturnValue(job.startedAt + job.duration + 1);
  try {
    useGameStore.getState().tick(0.05);
  } finally {
    vi.restoreAllMocks();
  }
}

/** Оставляет в жиле ровно `left` единиц — иначе тест ждал бы реальные часы добычи. */
function setReserve(key: string, left: number, total = 40000) {
  useGameStore.setState((s) => ({
    grid: {
      ...s.grid,
      depositReserves: {
        ...(s.grid.depositReserves ?? {}),
        [key]: { left: String(left), total: String(total) },
      },
    },
  }));
}

beforeEach(() => {
  useGameStore.getState().resetGame();
  fundBase();
});

describe('раскладка месторождений на стартовой карте', () => {
  it('занимает малую часть карты, а не половину', () => {
    // Регрессия: сумма независимых шансов старого генератора давала ~51% занятых клеток.
    const grid = useGameStore.getState().grid;
    const share = Object.keys(grid.deposits ?? {}).length / (grid.width * grid.height);
    expect(share).toBeGreaterThan(0.05);
    expect(share).toBeLessThan(0.25);
  });

  it('у каждой жилы есть запас', () => {
    const grid = useGameStore.getState().grid;
    for (const key of Object.keys(grid.deposits ?? {})) {
      expect(depositLeft(grid.depositReserves, key)).toBeGreaterThan(0);
    }
  });

  it('на карте есть разные типы, а не один', () => {
    const grid = useGameStore.getState().grid;
    const types = new Set(Object.values(grid.deposits ?? {}));
    expect(types.size).toBeGreaterThanOrEqual(4);
    expect(types.has('ore')).toBe(true);
  });
});

describe('добыча вычитает из жилы', () => {
  it('запас клетки уменьшается по мере работы шахты', () => {
    const { key, pos } = findOreTile();
    powerUp(pos);
    placeAndFinish('miner_mk1', pos);
    const before = depositLeft(useGameStore.getState().grid.depositReserves, key);

    for (let i = 0; i < 20; i++) useGameStore.getState().tick(0.5);

    const after = depositLeft(useGameStore.getState().grid.depositReserves, key);
    expect(after).toBeLessThan(before);
  });

  it('выработанная жила останавливает добычу, а не уходит в минус', () => {
    const { key, pos } = findOreTile();
    powerUp(pos);
    placeAndFinish('miner_mk1', pos);
    setReserve(key, 3);

    for (let i = 0; i < 40; i++) useGameStore.getState().tick(0.5);

    const grid = useGameStore.getState().grid;
    expect(depositLeft(grid.depositReserves, key)).toBe(0);
    expect(isDepositExhausted(grid.depositReserves, key)).toBe(true);
    // Здание на месте — оно именно разрушено, а не исчезло.
    expect(grid.tiles[key]).toBe('miner_mk1');
  });

  it('разрушенная шахта больше ничего не добывает', () => {
    const { key, pos } = findOreTile();
    powerUp(pos);
    placeAndFinish('miner_mk1', pos);
    setReserve(key, 0);

    const before = D(useGameStore.getState().grid.buffers[key]?.ore ?? '0');
    for (let i = 0; i < 10; i++) useGameStore.getState().tick(0.5);
    const after = D(useGameStore.getState().grid.buffers[key]?.ore ?? '0');

    expect(after.lte(before)).toBe(true);
  });

  it('на выработанную жилу новую шахту не поставить', () => {
    const { key, pos } = findOreTile();
    setReserve(key, 0);

    const store = useGameStore.getState();
    store.selectBuild('miner_mk1');
    store.placeSelectedBuildAt(pos);

    expect(useGameStore.getState().grid.tiles[key]).toBeUndefined();
  });
});

describe('разбор руины', () => {
  it('возвращает 25–50% вложенного и начисляет кредиты за улучшения', () => {
    const { key, pos } = findOreTile();
    powerUp(pos);
    placeAndFinish('miner_mk1', pos);

    // Пара улучшений: у руины возвращается доля ВСЕГО вложенного, включая их.
    for (let i = 0; i < 2; i++) {
      fundBase();
      useGameStore.getState().upgradeBuildingAt(pos);
      const job = useGameStore.getState().grid.tileJobs?.[key];
      if (!job) continue;
      vi.spyOn(Date, 'now').mockReturnValue(job.startedAt + job.duration + 1);
      try {
        useGameStore.getState().tick(0.05);
      } finally {
        vi.restoreAllMocks();
      }
    }

    expect(useGameStore.getState().grid.tileLevels?.[key]).toBe(3);
    setReserve(key, 0);

    /*
     * Вложено: постройка по счётчику каталога НА МОМЕНТ СНОСА (100⚡ × 1.15^count) плюс два
     * улучшения по 100 × 1.15^уровень. Счётчик читается до сноса — снос его уменьшает.
     */
    const count = useGameStore.getState().buildings.find((b) => b.id === 'miner_mk1')!.count;
    const invested = 100 * Math.pow(1.15, count) + 100 * (Math.pow(1.15, 1) + Math.pow(1.15, 2));

    // Считаем от ПУСТОЙ базы: так возврат виден целиком и его не срезает потолок склада.
    useGameStore.setState((s) => ({
      grid: { ...s.grid, buffers: { ...s.grid.buffers, base: {} } },
      currency: { ...s.currency, credits: D(0) },
    }));

    useGameStore.getState().removeBuildingAt(pos);

    const after = useGameStore.getState();
    const energyBack = D(after.grid.buffers.base?.energy ?? '0');
    expect(energyBack.toNumber()).toBeGreaterThanOrEqual(invested * RUIN_REFUND_MIN - 1e-6);
    expect(energyBack.toNumber()).toBeLessThanOrEqual(invested * RUIN_REFUND_MAX + 1e-6);
    // Кредиты за улучшения тоже вложены в клетку и тоже частично возвращаются.
    expect(after.currency.credits.gt(0)).toBe(true);
    expect(after.grid.tiles[key]).toBeUndefined();
  });

  it('целая шахта сносится по прежнему правилу — 75% постройки', () => {
    const { key, pos } = findOreTile();
    placeAndFinish('miner_mk1', pos);

    // Стоимость постройки растёт со счётчиком каталога, и возврат считается от неё же.
    const count = useGameStore.getState().buildings.find((b) => b.id === 'miner_mk1')!.count;
    const buildCost = 100 * Math.pow(1.15, count);

    useGameStore.setState((s) => ({
      grid: { ...s.grid, buffers: { ...s.grid.buffers, base: {} } },
    }));
    useGameStore.getState().removeBuildingAt(pos);

    const energyBack = D(useGameStore.getState().grid.buffers.base?.energy ?? '0');
    expect(energyBack.toNumber()).toBeCloseTo(buildCost * 0.75, 6);
    expect(useGameStore.getState().grid.tiles[key]).toBeUndefined();
  });
});

describe('запасы переживают сохранение', () => {
  it('остаток жилы восстанавливается из сейва', () => {
    const { key } = findOreTile();
    setReserve(key, 1234, 40000);

    const payload = serializeGame(useGameStore.getState());
    const restored = deserializeGame(payload);

    expect(depositLeft(restored.grid?.depositReserves, key)).toBe(1234);
  });

  it('сейв БЕЗ секции запасов читается как «неизвестно», а не как «выработано»', () => {
    /*
     * Ровно тот случай, ради которого написан ensureReserves: сохранения, сделанные до
     * появления истощения, знают про deposits и ничего не знают про depositReserves.
     * Если бы пустота читалась как ноль, все шахты старого игрока стали бы руинами при
     * первой же загрузке. Досоздаёт запасы стор (withDepositReserves), а от декодера
     * требуется именно «пусто», а не карта нулей.
     */
    const payload = serializeGame(useGameStore.getState()) as unknown as MutablePayload;
    delete payload.grid.depositReserves;

    const restored = deserializeGame(payload);
    expect(restored.grid?.depositReserves).toEqual({});
    for (const key of Object.keys(restored.grid?.deposits ?? {})) {
      expect(isDepositExhausted(restored.grid?.depositReserves, key)).toBe(false);
    }
  });

  it('битые записи запаса выбрасываются, а не превращаются в выработанную жилу', () => {
    const { key } = findOreTile();
    const payload = serializeGame(useGameStore.getState()) as unknown as MutablePayload;
    payload.grid.depositReserves = { [key]: { left: 'мусор', total: '0' } };

    const restored = deserializeGame(payload);
    expect(restored.grid?.depositReserves?.[key]).toBeUndefined();
    expect(isDepositExhausted(restored.grid?.depositReserves, key)).toBe(false);
  });
});

describe('расширение сектора', () => {
  it('новые клетки получают месторождения вместе с запасами', () => {
    const before = useGameStore.getState().grid;
    const beforeKeys = new Set(Object.keys(before.deposits ?? {}));

    // Расширение стоит 450⚡ и 40 стали — половины стартовых складов на это не хватает.
    useGameStore.setState((s) => ({
      grid: {
        ...s.grid,
        buffers: { ...s.grid.buffers, base: { ...s.grid.buffers.base, energy: '1e12', steel: '1e12' } },
      },
    }));
    useGameStore.getState().buyUpgrade('sector_expansion');

    const after = useGameStore.getState().grid;
    expect(after.width).toBeGreaterThan(before.width);

    const fresh = Object.keys(after.deposits ?? {}).filter((k) => !beforeKeys.has(k));
    // Полоса могла достаться и без жил, но если они есть — запас обязан быть у каждой.
    for (const key of fresh) {
      expect(depositLeft(after.depositReserves, key)).toBeGreaterThan(0);
    }
    // Старые остатки не переписаны заново.
    for (const key of beforeKeys) {
      expect(after.depositReserves?.[key]).toEqual(before.depositReserves?.[key]);
    }
  });
});
