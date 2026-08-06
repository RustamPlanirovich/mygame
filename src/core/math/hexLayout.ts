/**
 * РАСКЛАДКА СЕТКИ В ПИКСЕЛЯХ (bigplan.md, пункты 21, 31)
 *
 * ЧТО БЫЛО СЛОМАНО
 * Гексы рисовались ОСТРЫМ ВЕРХОМ (вершина сверху и снизу), а расставлялись по раскладке
 * «odd-q» — со сдвигом нечётных СТОЛБЦОВ вниз. Эти две вещи несовместимы: сдвиг по столбцам
 * бывает только у гексов с ПЛОСКИМ верхом. Плюс шаг между строками стоял 3R при высоте гекса
 * 2R, поэтому даже внутри столбца между клетками оставалась пустая полоса в R пикселей.
 * Соты не смыкались: получалась россыпь отдельных шестиугольников с дырами.
 *
 * Игровая логика (hexGeometry.ts) при этом считает соседство именно по odd-q с плоским верхом.
 * То есть рисовалось одно, а игралось другое.
 *
 * КАК СЕЙЧАС
 * Плоский верх + odd-q, шаги подобраны так, что соты смыкаются без зазоров:
 *   - ширина гекса (по вершинам, горизонталь) = 2R, высота (между плоскими сторонами) = √3·R;
 *   - шаг столбцов = 1.5R — соседние столбцы входят друг в друга «зубцами»;
 *   - шаг строк = √3·R, нечётные столбцы сдвинуты на полстроки вниз.
 * Именно эта раскладка обратна offsetToCube/cubeToOffset из hexGeometry.ts, что и проверяется
 * в hexLayout.test.ts: центры шести соседей клетки отстоят ровно на один шаг сот.
 *
 * ЯКОРЬ — ЦЕНТР КЛЕТКИ
 * Раньше конвертер возвращал левый-верхний угол для квадратов и центр для гексов, а вызывающий
 * код каждый раз дописывал `mode === 'hex' ? px : px + CELL / 2`. Где забывали — рисовался
 * квадрат 48×48 поверх сот (подсветка энергосети, зона логистики, рамки штрафов). Теперь
 * координата клетки всегда означает ЦЕНТР, а прямоугольник смещается на половину клетки в
 * единственном месте — там, где он рисуется.
 */

import { cubeRound, cubeToOffset, type GridGeometry } from './hexGeometry';

/** Радиус описанной окружности гекса: половина ширины по вершинам. */
export const HEX_SIZE = 28;
/** Ширина гекса с плоским верхом — расстояние между левой и правой вершинами. */
export const HEX_WIDTH = HEX_SIZE * 2;
/** Высота гекса с плоским верхом — расстояние между плоскими сторонами. */
export const HEX_HEIGHT = Math.sqrt(3) * HEX_SIZE;
/** Шаг между центрами соседних столбцов. */
export const HEX_COL_STEP = HEX_SIZE * 1.5;
/** Шаг между центрами клеток внутри столбца. */
export const HEX_ROW_STEP = HEX_HEIGHT;
/** Сдвиг нечётных столбцов вниз (раскладка odd-q). */
export const HEX_ODD_COL_OFFSET = HEX_HEIGHT / 2;

/** Сторона квадратной клетки. */
export const CELL = 48;
/** Зазор между квадратными клетками. */
export const GAP = 1;

/** Шаг между центрами квадратных клеток по обеим осям. */
export const SQUARE_STEP = CELL + GAP;

/** Центр клетки в мировых пикселях. */
export function cellCenterIn(
  geometry: GridGeometry,
  x: number,
  y: number,
): { px: number; py: number } {
  if (geometry === 'hex') {
    return {
      px: HEX_WIDTH / 2 + x * HEX_COL_STEP,
      // Чётность столбца — через `& 1`, как в offsetToCube: у отрицательных столбцов
      // `x % 2` даёт -1, и левее нулевого столбца сдвиг рядов пропадал бы.
      py: HEX_HEIGHT / 2 + y * HEX_ROW_STEP + ((x & 1) === 1 ? HEX_ODD_COL_OFFSET : 0),
    };
  }
  return {
    px: GAP + x * SQUARE_STEP + CELL / 2,
    py: GAP + y * SQUARE_STEP + CELL / 2,
  };
}

/**
 * Клетка, которой принадлежит точка. Обратная к cellCenterIn.
 *
 * На гексах «ближайший центр» и «клетка, внутри которой точка» — это одно и то же
 * (гекс совпадает с ячейкой Вороного своего центра), поэтому округления cube-координат
 * достаточно и отдельной проверки попадания в шестиугольник не нужно.
 */
export function pixelToCellIn(
  geometry: GridGeometry,
  px: number,
  py: number,
): { x: number; y: number } {
  if (geometry === 'hex') {
    const localX = px - HEX_WIDTH / 2;
    const localY = py - HEX_HEIGHT / 2;

    // Стандартное обратное преобразование для гексов с плоским верхом.
    const q = ((2 / 3) * localX) / HEX_SIZE;
    const r = (-localX / 3 + (Math.sqrt(3) / 3) * localY) / HEX_SIZE;

    const { col, row } = cubeToOffset(cubeRound({ x: q, y: -q - r, z: r }));
    // `col === 0 ? 0 : col` — округление точки чуть левее нулевого столбца даёт -0, а он
    // ведёт себя как 0 везде, кроме Object.is и ключей Map. Отдаём наружу обычный ноль.
    return { x: col === 0 ? 0 : col, y: row === 0 ? 0 : row };
  }
  return {
    x: Math.floor((px - GAP) / SQUARE_STEP),
    y: Math.floor((py - GAP) / SQUARE_STEP),
  };
}

/** Размер игрового поля в пикселях — по нему считается посадка и клампы камеры. */
export function worldSizeIn(
  geometry: GridGeometry,
  width: number,
  height: number,
): { w: number; h: number } {
  if (geometry === 'hex') {
    return {
      w: HEX_WIDTH + Math.max(0, width - 1) * HEX_COL_STEP,
      // Нечётный столбец свисает ниже чётного ровно на полстроки — если он вообще есть.
      h:
        HEX_HEIGHT +
        Math.max(0, height - 1) * HEX_ROW_STEP +
        (width > 1 ? HEX_ODD_COL_OFFSET : 0),
    };
  }
  return {
    w: width * SQUARE_STEP + GAP,
    h: height * SQUARE_STEP + GAP,
  };
}

/** Шаг сетки по осям — нужен рендеру, чтобы отсечь невидимые клетки. */
export function cellStepIn(geometry: GridGeometry): { colStep: number; rowStep: number } {
  return geometry === 'hex'
    ? { colStep: HEX_COL_STEP, rowStep: HEX_ROW_STEP }
    : { colStep: SQUARE_STEP, rowStep: SQUARE_STEP };
}

/**
 * Вершины гекса с ПЛОСКИМ верхом: углы 0°, 60°, ... — крайние точки слева и справа,
 * плоские стороны сверху и снизу. Плоский верх обязателен: только он смыкается в соты
 * при сдвиге нечётных столбцов (odd-q), по которому считается соседство.
 */
export function hexPolygonPoints(cx: number, cy: number, radius: number): number[] {
  const points: number[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i;
    points.push(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
  }
  return points;
}
