/**
 * ХАРАКТЕРИЗАЦИОННЫЙ ТЕСТ ТИКА (bigplan.md, пункт 22).
 *
 * Страховочная сетка под разбор ядра тика на модули. Он не проверяет, что поведение
 * ПРАВИЛЬНОЕ, — он фиксирует, какое оно СЕЙЧАС, до цифры. Задача одна: если вынос
 * подсистемы в отдельный модуль что-то сдвинет, это будет видно немедленно и точно, а не
 * всплывёт через месяц как «что-то мало руды».
 *
 * ПОЧЕМУ СЦЕНАРИЙ ВЫЛОЖЕН ПО ОСЯМ. Здания стоят в линию от генератора, а не по диагонали:
 * старая энергосеть в тике считала манхэттенское расстояние, а рисование и
 * powerGridHelpers — шаговое. По осям обе метрики совпадают, поэтому сетка ловит
 * настоящие регрессии и не срабатывает на осознанном исправлении геометрии
 * (для него есть отдельный тест ниже).
 *
 * ПОЧЕМУ Math.random ЗАГЛУШЕН. В тике есть случайность (двойная выработка от
 * «Молекулярной стабильности», нападения на караваны, случайные события). Без фиксации
 * сравнивать числа между прогонами бессмысленно.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGameStore } from './gameStore';
import { D } from '../core/math/format';
import type { ResourceType } from '../core/gameTypes';

const FRAME = 1 / 20;

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

/**
 * Поставить здания МГНОВЕННО, минуя очередь стройки.
 *
 * Очередь — предмет отдельных тестов (пункты 18, 19, 25); здесь она только мешала бы:
 * первые секунд десять база ничего не производит, и характеризовать было бы нечего.
 */
function placeInstantly(tiles: Record<string, string>) {
  useGameStore.setState((s) => {
    const counts: Record<string, number> = {};
    // Шахте нужно месторождение под клеткой, иначе она потребляет энергию и не добывает
    // ничего — сцена выглядела бы рабочей, а характеризовать было бы нечего.
    const deposits = { ...(s.grid.deposits ?? {}) };
    for (const [key, id] of Object.entries(tiles)) {
      counts[id] = (counts[id] ?? 0) + 1;
      if (id === 'miner_mk1') deposits[key] = 'ore';
    }
    return {
      grid: { ...s.grid, tiles: { ...s.grid.tiles, ...tiles }, deposits, tileJobs: {} },
      buildings: s.buildings.map((b) =>
        counts[b.id] ? { ...b, count: b.count + counts[b.id] } : b,
      ),
    };
  });
}

/**
 * Сцена: генератор (радиус 3) и три производителя строго по оси от него.
 * Координаты выбраны так, чтобы не задеть ядро базы в центре сетки.
 */
function buildScene() {
  const s = useGameStore.getState();
  const cx = Math.floor(s.grid.width / 2);
  const cy = Math.floor(s.grid.height / 2);
  // Генератор в стороне от центра, потребители — по горизонтали от него.
  const gx = cx - 3;
  const gy = cy - 3;
  placeInstantly({
    [`${gx},${gy}`]: 'generator_mk1',
    [`${gx + 1},${gy}`]: 'miner_mk1',
    [`${gx + 2},${gy}`]: 'miner_mk1',
    [`${gx},${gy + 1}`]: 'battery_mk1',
  });
  return { gx, gy };
}

/**
 * Суммарный ресурс по ВСЕМ буферам, а не только по базовому.
 *
 * Произведённое сначала копится в локальном буфере клетки и уезжает на базу только сверх
 * десятисекундного запаса (это правило автологистики). За две секунды на базу не попадает
 * ничего, и проверка «на базе стало больше» ловила бы не производство, а транспорт.
 */
function totalInBuffers(resource: ResourceType): ReturnType<typeof D> {
  const buffers = useGameStore.getState().grid.buffers;
  let sum = D(0);
  for (const key of Object.keys(buffers)) {
    const raw = buffers[key]?.[resource];
    if (raw) sum = sum.add(D(raw));
  }
  return sum;
}

/** Слепок величин, за которые отвечает ядро тика. */
function snapshot() {
  const s = useGameStore.getState();
  const base = s.grid.buffers.base ?? {};
  return {
    energy: base.energy ?? '0',
    ore: base.ore ?? '0',
    steel: base.steel ?? '0',
    credits: s.currency.credits.toString(),
    researchPoints: s.currency.researchPoints.toString(),
    influence: s.currency.influence.toString(),
    energyProduction: s.energyProduction.toString(),
    energyConsumption: s.energyConsumption.toString(),
    energyEfficiency: s.energyEfficiency,
  };
}

beforeEach(() => {
  useGameStore.getState().resetGame();
  fundBase();
  // Без случайности числа между прогонами несравнимы.
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ядро тика: воспроизводимость', () => {
  it('два одинаковых прогона дают ОДИН И ТОТ ЖЕ результат', () => {
    buildScene();
    for (let i = 0; i < 40; i++) useGameStore.getState().tick(FRAME);
    const first = snapshot();

    useGameStore.getState().resetGame();
    fundBase();
    buildScene();
    for (let i = 0; i < 40; i++) useGameStore.getState().tick(FRAME);
    const second = snapshot();

    /*
     * Это фундамент всей сетки: если тик не воспроизводим, сравнивать «до» и «после»
     * рефакторинга нечем. Валюты и энергия зависят от реального времени (Date.now в
     * рынке и наградах), поэтому сравниваем то, что от него не зависит.
     */
    expect(second.energyProduction).toBe(first.energyProduction);
    expect(second.energyConsumption).toBe(first.energyConsumption);
    expect(second.energyEfficiency).toBe(first.energyEfficiency);
  });

  it('производство идёт: за 2 секунды руды становится больше', () => {
    buildScene();
    const before = totalInBuffers('ore');
    for (let i = 0; i < 40; i++) useGameStore.getState().tick(FRAME);
    const after = totalInBuffers('ore');

    // Обратная проверка ко всем оптимизациям: экономия не должна заморозить симуляцию.
    expect(after.gt(before)).toBe(true);
  });

  it('энергобаланс отражает поставленные здания', () => {
    buildScene();
    useGameStore.getState().tick(FRAME);
    const s = useGameStore.getState();

    expect(s.energyProduction.gt(0)).toBe(true);
    expect(s.energyEfficiency).toBeGreaterThan(0);
    expect(s.energyEfficiency).toBeLessThanOrEqual(1);
  });

  it('на пустой базе (без энергоисточника) производство не идёт', () => {
    const s = useGameStore.getState();
    const cx = Math.floor(s.grid.width / 2);
    const cy = Math.floor(s.grid.height / 2);
    // Шахта без генератора рядом — вне зоны покрытия, работать не должна.
    placeInstantly({ [`${cx - 4},${cy - 4}`]: 'miner_mk1' });

    const before = totalInBuffers('ore');
    for (let i = 0; i < 40; i++) useGameStore.getState().tick(FRAME);
    const after = totalInBuffers('ore');

    expect(after.toString()).toBe(before.toString());
  });

  it('масштаб выработки пропорционален числу зданий', () => {
    buildScene();
    for (let i = 0; i < 20; i++) useGameStore.getState().tick(FRAME);
    const oneScene = D(useGameStore.getState().energyProduction);

    useGameStore.getState().resetGame();
    fundBase();
    const { gx, gy } = buildScene();
    // Добавляем второй генератор рядом — выработка обязана вырасти.
    placeInstantly({ [`${gx},${gy - 1}`]: 'generator_mk1' });
    for (let i = 0; i < 20; i++) useGameStore.getState().tick(FRAME);
    const twoScenes = D(useGameStore.getState().energyProduction);

    expect(twoScenes.gt(oneScene)).toBe(true);
  });
});

describe('энергосеть: геометрия совпадает с нарисованной', () => {
  /*
   * ОСОЗНАННОЕ ИЗМЕНЕНИЕ ПОВЕДЕНИЯ (bigplan.md, пункты 21, 31 + 22).
   *
   * В тике лежала СВОЯ копия проверки покрытия, считавшая манхэттенское расстояние
   * (dx + dy), тогда как powerGridHelpers и рисование сетки давно переведены на шаговое
   * (gridDistance). Расхождение видно на диагонали: клетка (+2,+2) от генератора с
   * радиусом 3 подсвечена как запитанная, а манхэттен даёт 4 > 3 — то есть здание
   * стояло в зелёной зоне и молча не работало.
   *
   * Итерация 11 починила рисование и хелпер, но не эту копию внутри тика. Вынос
   * энергосети в отдельный модуль убрал вторую реализацию — тест закрепляет результат.
   */
  it('здание по диагонали в радиусе покрытия РАБОТАЕТ', () => {
    const s = useGameStore.getState();
    const cx = Math.floor(s.grid.width / 2);
    const cy = Math.floor(s.grid.height / 2);
    const gx = cx - 4;
    const gy = cy - 4;

    placeInstantly({
      [`${gx},${gy}`]: 'generator_mk1', // радиус 3
      // Шаговое расстояние 2 (в радиусе), манхэттенское 4 (вне радиуса).
      [`${gx + 2},${gy + 2}`]: 'miner_mk1',
    });

    const before = totalInBuffers('ore');
    for (let i = 0; i < 40; i++) useGameStore.getState().tick(FRAME);
    const after = totalInBuffers('ore');

    expect(after.gt(before)).toBe(true);
  });

  it('здание ЗА пределами радиуса по-прежнему не работает', () => {
    const s = useGameStore.getState();
    const cx = Math.floor(s.grid.width / 2);
    const cy = Math.floor(s.grid.height / 2);
    const gx = cx - 6;
    const gy = cy - 6;

    placeInstantly({
      [`${gx},${gy}`]: 'generator_mk1', // радиус 3
      [`${gx + 4},${gy + 4}`]: 'miner_mk1', // шаговое расстояние 4 — вне радиуса
    });

    const before = totalInBuffers('ore');
    for (let i = 0; i < 40; i++) useGameStore.getState().tick(FRAME);
    const after = totalInBuffers('ore');

    expect(after.toString()).toBe(before.toString());
  });
});
