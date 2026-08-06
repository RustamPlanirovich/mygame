/**
 * Скан сетки и энергосеть (bigplan.md, пункт 22).
 *
 * Ключевое здесь — ГЕОМЕТРИЯ. Внутри тика лежала своя копия проверки радиуса, считавшая
 * манхэттенское расстояние, тогда как рисование зоны и powerGridHelpers считают шаговое.
 * Здание, стоящее в нарисованной зелёной зоне по диагонали от генератора, молча не
 * работало. Первый же тест ниже — ровно про это.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { scanGrid } from './gridScan';
import { setActiveGridGeometry } from '../math/hexGeometry';
import type { Building } from '../gameTypes';

function building(id: string, extra: Partial<Building> = {}): Building {
  return { id, name: id, description: '', baseCost: {}, count: 1, ...extra } as unknown as Building;
}

const GENERATOR = building('generator_mk1', { powerGridRadius: 3 });
const HUB = building('hub', { logisticsRadius: 4 });
const PLAIN = building('miner_mk1');

const catalog = new Map<string, Building>([
  ['generator_mk1', GENERATOR],
  ['hub', HUB],
  ['miner_mk1', PLAIN],
]);

const scan = (tiles: Record<string, string>, tileDisabled: Record<string, boolean> = {}) =>
  scanGrid({ tiles, buildingsById: catalog, tileDisabled, width: 30, height: 30 });

beforeEach(() => {
  setActiveGridGeometry('square');
});

describe('индекс клеток', () => {
  it('группирует клетки по id здания', () => {
    const result = scan({ '1,1': 'miner_mk1', '2,1': 'miner_mk1', '5,5': 'generator_mk1' });
    expect(result.tilesByBuildingId.get('miner_mk1')).toEqual(['1,1', '2,1']);
    expect(result.tilesByBuildingId.get('generator_mk1')).toEqual(['5,5']);
  });

  it('здание, которого нет в каталоге, попадает в индекс, но не даёт радиусов', () => {
    const result = scan({ '1,1': 'нет_такого' });
    expect(result.tilesByBuildingId.get('нет_такого')).toEqual(['1,1']);
    expect(result.activePowerSources).toHaveLength(0);
  });

  it('битый ключ клетки не ломает скан', () => {
    const result = scan({ 'мусор': 'generator_mk1' });
    expect(result.activePowerSources).toHaveLength(0);
  });
});

describe('энергосеть: шаговое расстояние, а не манхэттенское', () => {
  it('клетка по диагонали в радиусе — ЗАПИТАНА', () => {
    const result = scan({ '10,10': 'generator_mk1' });
    /*
     * Шаговое расстояние (Чебышёв на квадратах) до (12,12) равно 2 — в радиусе 3.
     * Манхэттен дал бы 4, то есть старый тик эту клетку не запитывал, а сетка
     * рисовала её зелёной.
     */
    expect(result.isPowered(12, 12)).toBe(true);
  });

  it('клетка за радиусом по-прежнему не запитана', () => {
    const result = scan({ '10,10': 'generator_mk1' });
    expect(result.isPowered(14, 14)).toBe(false);
    expect(result.isPowered(10, 14)).toBe(false);
  });

  it('зона покрытия — квадрат, а не ромб', () => {
    const result = scan({ '10,10': 'generator_mk1' });
    let covered = 0;
    for (let y = 0; y < 30; y++) {
      for (let x = 0; x < 30; x++) if (result.isPowered(x, y)) covered++;
    }
    // Квадрат 7×7 вокруг источника, включая его самого.
    expect(covered).toBe(7 * 7);
  });

  it('на гексах зона ОТЛИЧАЕТСЯ от квадратной', () => {
    setActiveGridGeometry('square');
    const square = scan({ '10,10': 'generator_mk1' });
    let squareCovered = 0;
    for (let y = 0; y < 30; y++) {
      for (let x = 0; x < 30; x++) if (square.isPowered(x, y)) squareCovered++;
    }

    setActiveGridGeometry('hex');
    const hex = scan({ '10,10': 'generator_mk1' });
    let hexCovered = 0;
    for (let y = 0; y < 30; y++) {
      for (let x = 0; x < 30; x++) if (hex.isPowered(x, y)) hexCovered++;
    }

    // Гексагональный «диск» радиуса 3 — это 37 клеток против 49 у квадрата.
    // Если бы геометрия игнорировалась, числа совпали бы.
    expect(hexCovered).not.toBe(squareCovered);
    expect(hexCovered).toBe(3 * 3 * (3 + 1) + 1);
  });

  it('на гексах зона не обрезается по вертикали', () => {
    /*
     * Ограничивающий прямоугольник берётся с запасом ±1 по строкам: на гексах сдвиг
     * нечётных столбцов утаскивает часть соседей на полстроки вниз, и ровный ±r
     * срезал бы край зоны. Проверяем полнотой набора — перебором по всей сетке.
     */
    setActiveGridGeometry('hex');
    const result = scan({ '10,10': 'generator_mk1' });
    let covered = 0;
    for (let y = 0; y < 30; y++) {
      for (let x = 0; x < 30; x++) if (result.isPowered(x, y)) covered++;
    }
    expect(covered).toBe(37);
  });

  it('несколько источников объединяют зоны, не задваивая клетки', () => {
    const result = scan({ '10,10': 'generator_mk1', '11,10': 'generator_mk1' });
    let covered = 0;
    for (let y = 0; y < 30; y++) {
      for (let x = 0; x < 30; x++) if (result.isPowered(x, y)) covered++;
    }
    // Два перекрывающихся квадрата 7×7 со сдвигом на 1: 7 столбцов + 1 новый = 8×7.
    expect(covered).toBe(8 * 7);
  });

  it('зона обрезается границами карты', () => {
    const result = scanGrid({
      tiles: { '0,0': 'generator_mk1' },
      buildingsById: catalog,
      tileDisabled: {},
      width: 5,
      height: 5,
    });
    expect(result.isPowered(0, 0)).toBe(true);
    // За краем карты клеток нет — и в наборе их быть не должно.
    expect(result.isPowered(-1, 0)).toBe(false);
  });
});

describe('отключённые здания', () => {
  it('отключённый генератор не питает ничего', () => {
    const result = scan({ '10,10': 'generator_mk1' }, { '10,10': true });
    expect(result.activePowerSources).toHaveLength(0);
    expect(result.isPowered(10, 10)).toBe(false);
  });

  it('строящийся хаб не даёт логистики', () => {
    const result = scan({ '4,4': 'hub' }, { '4,4': true });
    expect(result.activeLogisticsHubs).toHaveLength(0);
  });

  it('включённый хаб попадает в список с правильным радиусом', () => {
    const result = scan({ '4,4': 'hub' });
    expect(result.activeLogisticsHubs).toEqual([{ x: 4, y: 4, radius: 4 }]);
  });
});

describe('пустая сетка', () => {
  it('не падает и ничего не запитывает', () => {
    const result = scan({});
    expect(result.tilesByBuildingId.size).toBe(0);
    expect(result.activePowerSources).toHaveLength(0);
    expect(result.isPowered(0, 0)).toBe(false);
  });
});
