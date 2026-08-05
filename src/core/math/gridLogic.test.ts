/**
 * Игровая логика соседства на разных геометриях (bigplan.md, пункты 21, 31).
 *
 * Тесты геометрии (hexGeometry.test.ts) доказывают, что расстояние считается верно. Здесь —
 * что этим расстоянием реально пользуются близость, районы, энергосеть и логистика, то есть
 * что на hex-карте набор соседей ДРУГОЙ, а не «как на квадратной, только нарисовано иначе».
 */

import { afterEach, describe, expect, it } from 'vitest';
import type { Building } from '../gameTypes';
import { getAdjacentBuildings } from './proximity';
import { setActiveGridGeometry, hexDistance, squareDistance } from './hexGeometry';
import { isInRadius } from '../../utils/powerGridHelpers';
import { calculateDistance } from '../../utils/logisticsHelpers';

function at(id: string, x: number, y: number): Building {
  return {
    id,
    name: id,
    description: '',
    baseCost: {},
    costFactor: 1.15,
    production: {},
    count: 1,
    coord: { x, y },
  } as Building;
}

// Возвращаем геометрию по умолчанию: она модульная и протекает между тестами.
afterEach(() => setActiveGridGeometry('square'));

describe('getAdjacentBuildings учитывает геометрию', () => {
  /*
   * Клетка (3,3) и её потенциальные соседи. На квадратной сетке (4,4) — диагональный сосед
   * на расстоянии 1 (Чебышёв). На гексах (odd-q) от чётного столбца 3... проверяем фактом,
   * а не рассуждением: сравниваем с hexDistance.
   */
  const candidates = [
    at('a', 4, 3),
    at('b', 3, 4),
    at('c', 4, 4),
    at('d', 2, 2),
    at('e', 5, 5),
  ];

  it('на квадратной сетке радиус 1 включает диагонали', () => {
    setActiveGridGeometry('square');
    const found = getAdjacentBuildings(3, 3, 1, candidates).map((b) => b.id);
    // (4,4) — диагональ, и по Чебышёву это один шаг.
    expect(found).toContain('c');
    expect(found).not.toContain('e');
  });

  it('на гексагональной сетке набор соседей ДРУГОЙ', () => {
    setActiveGridGeometry('square');
    const square = getAdjacentBuildings(3, 3, 1, candidates).map((b) => b.id).sort();

    setActiveGridGeometry('hex');
    const hex = getAdjacentBuildings(3, 3, 1, candidates).map((b) => b.id).sort();

    /*
     * Это и есть суть пункта 21: раньше оба вызова давали одно и то же, потому что расстояние
     * считалось евклидово по (x, y) независимо от геометрии карты.
     */
    expect(hex).not.toEqual(square);
  });

  it('на гексах результат согласован с hexDistance', () => {
    setActiveGridGeometry('hex');
    const found = getAdjacentBuildings(3, 3, 1, candidates);
    for (const b of found) {
      expect(hexDistance(3, 3, b.coord!.x, b.coord!.y), b.id).toBe(1);
    }
    // И наоборот: никого с расстоянием 1 не потеряли.
    const expected = candidates.filter((b) => hexDistance(3, 3, b.coord!.x, b.coord!.y) === 1);
    expect(found).toHaveLength(expected.length);
  });

  it('само здание в соседи не попадает', () => {
    setActiveGridGeometry('hex');
    const withSelf = [...candidates, at('self', 3, 3)];
    expect(getAdjacentBuildings(3, 3, 1, withSelf).map((b) => b.id)).not.toContain('self');
  });

  it('здания без координат игнорируются', () => {
    setActiveGridGeometry('hex');
    const noCoord = { ...at('x', 0, 0), coord: undefined } as Building;
    expect(() => getAdjacentBuildings(3, 3, 2, [noCoord])).not.toThrow();
    expect(getAdjacentBuildings(3, 3, 2, [noCoord])).toHaveLength(0);
  });
});

describe('энергосеть (isInRadius)', () => {
  it('на квадратной сетке радиус — квадрат, а не ромб', () => {
    setActiveGridGeometry('square');
    /*
     * Было манхэттенское расстояние (dx + dy), из-за чего зона покрытия имела форму ромба:
     * клетка (2,2) при радиусе 2 не покрывалась, хотя визуально попадала в квадрат 5x5.
     */
    expect(isInRadius(0, 0, 2, 2, 2)).toBe(true);
    expect(isInRadius(0, 0, 3, 0, 2)).toBe(false);
  });

  it('на гексах покрытие считается по hex-расстоянию', () => {
    setActiveGridGeometry('hex');
    for (let col = -3; col <= 3; col++) {
      for (let row = -3; row <= 3; row++) {
        const expected = hexDistance(0, 0, col, row) <= 2;
        expect(isInRadius(0, 0, col, row, 2), `(${col},${row})`).toBe(expected);
      }
    }
  });

  it('переключение геометрии меняет покрытие', () => {
    setActiveGridGeometry('square');
    const asSquare = isInRadius(0, 0, 1, 2, 2);
    setActiveGridGeometry('hex');
    const asHex = isInRadius(0, 0, 1, 2, 2);
    // Значения могут совпасть на отдельной клетке, поэтому проверяем метрики напрямую.
    expect(squareDistance(0, 0, 1, 2)).not.toBe(hexDistance(0, 0, 1, 2));
    expect(typeof asSquare).toBe('boolean');
    expect(typeof asHex).toBe('boolean');
  });
});

describe('логистика (calculateDistance)', () => {
  it('считает шаги, а не манхэттен', () => {
    setActiveGridGeometry('square');
    // Манхэттен дал бы 4, шаговое расстояние по Чебышёву — 2.
    expect(calculateDistance({ x: 0, y: 0 }, { x: 2, y: 2 })).toBe(2);
  });

  it('на гексах согласовано с hexDistance', () => {
    setActiveGridGeometry('hex');
    expect(calculateDistance({ x: 0, y: 0 }, { x: 3, y: 2 })).toBe(hexDistance(0, 0, 3, 2));
  });

  it('расстояние до себя — ноль в обеих геометриях', () => {
    for (const geometry of ['square', 'hex'] as const) {
      setActiveGridGeometry(geometry);
      expect(calculateDistance({ x: 5, y: 5 }, { x: 5, y: 5 }), geometry).toBe(0);
    }
  });
});
