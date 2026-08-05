/**
 * Геометрия сетки (bigplan.md, пункты 21, 31).
 *
 * Главное, что здесь проверяется, — сдвиг нечётных столбцов. Именно из-за него евклидово
 * расстояние по (x, y) давало на гексах неверное соседство: пара клеток с одинаковой разностью
 * координат может быть и соседями, и не соседями, в зависимости от чётности столбца.
 */

import { describe, expect, it } from 'vitest';
import {
  cellsInRadius,
  cubeToOffset,
  getActiveGridGeometry,
  gridDistance,
  gridNeighbors,
  hexDistance,
  hexNeighbors,
  offsetToCube,
  setActiveGridGeometry,
  squareDistance,
  squareNeighbors,
  activeGridDistance,
} from './hexGeometry';

describe('offsetToCube / cubeToOffset', () => {
  it('сохраняют инвариант cube-координат x + y + z = 0', () => {
    for (let col = -5; col <= 5; col++) {
      for (let row = -5; row <= 5; row++) {
        const c = offsetToCube(col, row);
        expect(c.x + c.y + c.z, `(${col},${row})`).toBe(0);
      }
    }
  });

  it('обратимы: offset -> cube -> offset даёт исходное', () => {
    for (let col = -6; col <= 6; col++) {
      for (let row = -6; row <= 6; row++) {
        const back = cubeToOffset(offsetToCube(col, row));
        expect(back, `(${col},${row})`).toEqual({ col, row });
      }
    }
  });
});

describe('hexDistance', () => {
  it('расстояние до себя — ноль', () => {
    expect(hexDistance(3, 3, 3, 3)).toBe(0);
  });

  it('у каждого гекса ровно шесть соседей на расстоянии 1', () => {
    for (const [col, row] of [[0, 0], [1, 1], [2, 5], [7, 3]]) {
      const neighbors = hexNeighbors(col, row);
      expect(neighbors, `(${col},${row})`).toHaveLength(6);
      for (const n of neighbors) {
        expect(hexDistance(col, row, n.x, n.y), `(${col},${row})->(${n.x},${n.y})`).toBe(1);
      }
    }
  });

  it('СДВИГ НЕЧЁТНЫХ СТОЛБЦОВ учитывается: одинаковая разность координат даёт разное расстояние', () => {
    /*
     * Вот из-за чего всё это и делается. Возьмём смещение (dx=1, dy=1) от чётного и от
     * нечётного столбца. Евклидово расстояние в обоих случаях одно и то же (≈1.41), а
     * фактическое соседство — разное.
     */
    const fromEven = hexDistance(2, 2, 3, 3);
    const fromOdd = hexDistance(3, 2, 4, 3);
    expect(fromEven).not.toBe(fromOdd);
  });

  it('симметрично', () => {
    expect(hexDistance(1, 2, 5, 7)).toBe(hexDistance(5, 7, 1, 2));
  });

  it('соблюдает неравенство треугольника', () => {
    const d = (a: number[], b: number[]) => hexDistance(a[0], a[1], b[0], b[1]);
    const A = [0, 0];
    const B = [3, 4];
    const C = [1, 2];
    expect(d(A, B)).toBeLessThanOrEqual(d(A, C) + d(C, B));
  });

  it('целочисленно: расстояние — это ШАГИ, а не длина отрезка', () => {
    // Евклидово расстояние давало 1.41 для диагоналей, и «радиус 2» вёл себя непредсказуемо.
    for (let col = 0; col < 8; col++) {
      for (let row = 0; row < 8; row++) {
        const d = hexDistance(0, 0, col, row);
        expect(Number.isInteger(d), `(${col},${row}) -> ${d}`).toBe(true);
      }
    }
  });
});

describe('squareDistance', () => {
  it('диагональ — один шаг (Чебышёв), а не 1.41', () => {
    /*
     * Раньше здесь было евклидово расстояние: диагональный сосед был на 1.41, поэтому радиус 1
     * не включал диагонали, а радиус 2 включал 12 клеток вместо 24. Правило «+X% за соседа»
     * работало не так, как читается.
     */
    expect(squareDistance(0, 0, 1, 1)).toBe(1);
    expect(squareDistance(0, 0, 2, 2)).toBe(2);
  });

  it('у квадратной клетки восемь соседей на расстоянии 1', () => {
    const neighbors = squareNeighbors(4, 4);
    expect(neighbors).toHaveLength(8);
    for (const n of neighbors) {
      expect(squareDistance(4, 4, n.x, n.y)).toBe(1);
    }
  });
});

describe('gridDistance / gridNeighbors', () => {
  it('выбирают геометрию по параметру', () => {
    expect(gridNeighbors('hex', 0, 0)).toHaveLength(6);
    expect(gridNeighbors('square', 0, 0)).toHaveLength(8);
    expect(gridDistance('square', 0, 0, 1, 1)).toBe(1);
    expect(gridDistance('hex', 0, 0, 1, 1)).toBe(hexDistance(0, 0, 1, 1));
  });
});

describe('cellsInRadius', () => {
  it('гексы: 6, 18, 36 клеток для радиусов 1..3', () => {
    // 3N(N+1): важно знать, что одно и то же правило соседства на гексах затрагивает
    // МЕНЬШЕ клеток, чем на квадратах, — это влияет на баланс бонусов.
    expect(cellsInRadius('hex', 1)).toBe(6);
    expect(cellsInRadius('hex', 2)).toBe(18);
    expect(cellsInRadius('hex', 3)).toBe(36);
  });

  it('квадраты: 8, 24, 48 клеток для радиусов 1..3', () => {
    expect(cellsInRadius('square', 1)).toBe(8);
    expect(cellsInRadius('square', 2)).toBe(24);
    expect(cellsInRadius('square', 3)).toBe(48);
  });

  it('на нулевом и отрицательном радиусе — ноль', () => {
    expect(cellsInRadius('hex', 0)).toBe(0);
    expect(cellsInRadius('square', -1)).toBe(0);
  });

  it('согласовано с перебором соседей', () => {
    // Проверка формулы честным подсчётом: сколько клеток в радиусе 2 на гексах.
    let count = 0;
    for (let col = -6; col <= 6; col++) {
      for (let row = -6; row <= 6; row++) {
        const d = hexDistance(0, 0, col, row);
        if (d > 0 && d <= 2) count++;
      }
    }
    expect(count).toBe(cellsInRadius('hex', 2));
  });
});

describe('активная геометрия', () => {
  it('по умолчанию квадратная — старые карты не должны менять поведение', () => {
    setActiveGridGeometry('square');
    expect(getActiveGridGeometry()).toBe('square');
    expect(activeGridDistance(0, 0, 1, 1)).toBe(1);
  });

  it('переключается на гексы и влияет на расстояние', () => {
    setActiveGridGeometry('hex');
    expect(getActiveGridGeometry()).toBe('hex');
    expect(activeGridDistance(0, 0, 1, 1)).toBe(hexDistance(0, 0, 1, 1));

    // Возвращаем, чтобы не влиять на другие тесты.
    setActiveGridGeometry('square');
  });
});
