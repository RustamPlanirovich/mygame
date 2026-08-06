/**
 * Пиксельная раскладка сетки (bigplan.md, пункты 21, 31).
 *
 * hexGeometry.test.ts доказывает, что соседство считается верно. Здесь — что оно СОВПАДАЕТ
 * С РИСУНКОМ: центры шести соседей отстоят ровно на шаг сот, соты смыкаются без дыр, а клик
 * попадает в ту клетку, которую игрок видит под курсором.
 *
 * Именно этого теста не хватало раньше: гексы рисовались острым верхом, а расставлялись по
 * раскладке для плоского верха — соты не смыкались, между клетками зияли пустоты.
 */

import { describe, expect, it } from 'vitest';
import { hexNeighbors } from './hexGeometry';
import {
  CELL,
  GAP,
  HEX_HEIGHT,
  HEX_SIZE,
  HEX_WIDTH,
  cellCenterIn,
  cellStepIn,
  hexPolygonPoints,
  pixelToCellIn,
  worldSizeIn,
} from './hexLayout';

function distance(a: { px: number; py: number }, b: { px: number; py: number }): number {
  return Math.hypot(a.px - b.px, a.py - b.py);
}

/** Шаг сот: расстояние между центрами двух смежных гексов. */
const HEX_PITCH = HEX_HEIGHT;

describe('гексы смыкаются в соты', () => {
  /*
   * Ключевой тест. Соседи берутся ИГРОВОЙ логикой (hexNeighbors), а расстояние между их
   * центрами — раскладкой рендера. Совпадение шага для всех шести означает, что нарисованные
   * соты — это ровно те клетки, которые логика считает соседними.
   */
  it('центры всех шести соседей отстоят ровно на шаг сот', () => {
    // Оба варианта чётности столбца: сдвиг нечётных столбцов — самое хрупкое место раскладки.
    for (const [col, row] of [
      [4, 4],
      [5, 4],
      [0, 0],
      [7, 3],
    ]) {
      const center = cellCenterIn('hex', col, row);

      for (const n of hexNeighbors(col, row)) {
        const d = distance(center, cellCenterIn('hex', n.x, n.y));
        expect(d).toBeCloseTo(HEX_PITCH, 6);
      }
    }
  });

  it('шаг сот равен высоте гекса — стороны соприкасаются, зазора нет', () => {
    // Соседние гексы соприкасаются плоскими сторонами: расстояние между центрами равно
    // расстоянию между противоположными сторонами. Раньше шаг строк был 1.5 * высоты,
    // и внутри столбца между клетками оставалась пустая полоса.
    expect(HEX_PITCH).toBeCloseTo(HEX_HEIGHT, 6);
    expect(HEX_HEIGHT).toBeCloseTo(Math.sqrt(3) * HEX_SIZE, 6);
    expect(HEX_WIDTH).toBeCloseTo(2 * HEX_SIZE, 6);
  });

  it('соседей ровно шесть и все они разные клетки', () => {
    const seen = new Set(hexNeighbors(3, 3).map((n) => `${n.x},${n.y}`));
    expect(seen.size).toBe(6);
  });

  it('гекс нарисован с ПЛОСКИМ верхом: крайние точки слева и справа', () => {
    const points = hexPolygonPoints(0, 0, HEX_SIZE);
    const xs = points.filter((_, i) => i % 2 === 0);
    const ys = points.filter((_, i) => i % 2 === 1);

    // Ширина по вершинам — полные 2R, высота между плоскими сторонами — √3·R.
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(HEX_WIDTH, 6);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(HEX_HEIGHT, 6);
    // Ровно две вершины на крайних x — признак плоского верха (у острого их было бы по одной).
    expect(xs.filter((x) => Math.abs(x - HEX_SIZE) < 1e-9)).toHaveLength(1);
    expect(ys.filter((y) => Math.abs(y) < 1e-9)).toHaveLength(2);
  });
});

describe('пиксель -> клетка', () => {
  it('центр клетки возвращает саму клетку (обе геометрии)', () => {
    for (const geometry of ['hex', 'square'] as const) {
      for (let x = 0; x < 6; x++) {
        for (let y = 0; y < 6; y++) {
          const { px, py } = cellCenterIn(geometry, x, y);
          expect(pixelToCellIn(geometry, px, py)).toEqual({ x, y });
        }
      }
    }
  });

  it('точка внутри гекса, но далеко от центра, всё ещё принадлежит ему', () => {
    const { px, py } = cellCenterIn('hex', 3, 2);
    // Почти до плоской стороны сверху и почти до вершины справа.
    expect(pixelToCellIn('hex', px, py - HEX_HEIGHT / 2 + 1)).toEqual({ x: 3, y: 2 });
    expect(pixelToCellIn('hex', px + HEX_SIZE - 1, py)).toEqual({ x: 3, y: 2 });
  });

  /*
   * Дыр в сотах нет: какую точку поля ни возьми, она принадлежит клетке с БЛИЖАЙШИМ центром.
   * Раньше между гексами были пустые промежутки, и клик по ним уезжал в произвольную клетку.
   */
  it('любая точка поля попадает в клетку с ближайшим центром', () => {
    const width = 6;
    const height = 6;
    const world = worldSizeIn('hex', width, height);

    // Берём и кольцо клеток ЗА полем: у сот прямоугольная рамка поля срезает углы клеток,
    // и точка у самого края честно принадлежит клетке за границей — рендер её просто не рисует.
    const centers: Array<{ x: number; y: number; px: number; py: number }> = [];
    for (let x = -1; x <= width; x++) {
      for (let y = -1; y <= height; y++) {
        centers.push({ x, y, ...cellCenterIn('hex', x, y) });
      }
    }

    for (let px = 5; px < world.w; px += 7) {
      for (let py = 5; py < world.h; py += 7) {
        const sorted = centers
          .map((c) => ({ c, d: distance(c, { px, py }) }))
          .sort((a, b) => a.d - b.d);

        // Точки почти на границе двух клеток пропускаем: там любой ответ верен.
        if (sorted[1].d - sorted[0].d < 0.5) continue;

        const got = pixelToCellIn('hex', px, py);
        expect(got).toEqual({ x: sorted[0].c.x, y: sorted[0].c.y });
      }
    }
  });

  it('на квадратной сетке клетка определяется по границам, а не по близости центра', () => {
    // Левый верхний угол клетки (2,3) и точка чуть левее — разные клетки.
    const step = CELL + GAP;
    expect(pixelToCellIn('square', GAP + 2 * step + 1, GAP + 3 * step + 1)).toEqual({ x: 2, y: 3 });
    expect(pixelToCellIn('square', GAP + 2 * step - 1, GAP + 3 * step + 1)).toEqual({ x: 1, y: 3 });
  });
});

describe('размер мира', () => {
  it('все клетки помещаются в поле целиком (гексы)', () => {
    const width = 9;
    const height = 7;
    const { w, h } = worldSizeIn('hex', width, height);

    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const { px, py } = cellCenterIn('hex', x, y);
        expect(px - HEX_WIDTH / 2).toBeGreaterThanOrEqual(-1e-9);
        expect(py - HEX_HEIGHT / 2).toBeGreaterThanOrEqual(-1e-9);
        expect(px + HEX_WIDTH / 2).toBeLessThanOrEqual(w + 1e-9);
        expect(py + HEX_HEIGHT / 2).toBeLessThanOrEqual(h + 1e-9);
      }
    }
  });

  it('поле не раздуто: крайние клетки касаются краёв', () => {
    // Пустой запас по краям — это пустые поля вокруг карты и неверная посадка камеры.
    // Нижний край задаёт НЕЧЁТНЫЙ столбец: он сдвинут на полстроки вниз.
    const width = 9;
    const height = 7;
    const { w, h } = worldSizeIn('hex', width, height);

    let maxRight = 0;
    let maxBottom = 0;
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        const { px, py } = cellCenterIn('hex', x, y);
        maxRight = Math.max(maxRight, px + HEX_WIDTH / 2);
        maxBottom = Math.max(maxBottom, py + HEX_HEIGHT / 2);
      }
    }

    expect(w - maxRight).toBeCloseTo(0, 6);
    expect(h - maxBottom).toBeCloseTo(0, 6);
  });

  it('квадратная раскладка не изменилась', () => {
    expect(worldSizeIn('square', 10, 8)).toEqual({
      w: 10 * (CELL + GAP) + GAP,
      h: 8 * (CELL + GAP) + GAP,
    });
    expect(cellCenterIn('square', 0, 0)).toEqual({ px: GAP + CELL / 2, py: GAP + CELL / 2 });
  });
});

describe('шаг сетки для отсечения невидимых клеток', () => {
  /*
   * Рендер по этому шагу считает, какие клетки попадают в экран. Если взять шаг больше
   * настоящего, клеток насчитается меньше, чем видно, и край карты обрежется.
   */
  it('шаг не превышает реальное расстояние между соседними столбцами и строками', () => {
    for (const geometry of ['hex', 'square'] as const) {
      const { colStep, rowStep } = cellStepIn(geometry);
      const origin = cellCenterIn(geometry, 4, 4);
      expect(colStep).toBeLessThanOrEqual(cellCenterIn(geometry, 5, 4).px - origin.px + 1e-9);
      expect(rowStep).toBeLessThanOrEqual(cellCenterIn(geometry, 4, 5).py - origin.py + 1e-9);
    }
  });
});
