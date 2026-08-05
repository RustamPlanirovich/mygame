/**
 * ГЕОМЕТРИЯ СЕТКИ: КВАДРАТЫ И ГЕКСЫ (bigplan.md, пункты 21 и 31)
 *
 * ЧТО БЫЛО СЛОМАНО
 * Рендер гексов существовал и работал: карты объявляют `gridType: 'hex'`, FactoryGrid рисует
 * шестиугольники. Но ВСЯ игровая логика соседства считала расстояние евклидово по (x, y):
 *
 *     const distance = Math.sqrt(dx * dx + dy * dy);
 *
 * На гексагональной сетке это неверно. Клетки хранятся в offset-координатах (столбец, строка),
 * и у нечётных столбцов есть сдвиг на полряда — поэтому пара клеток с одинаковой разностью
 * (dx, dy) может быть и соседями, и не соседями, в зависимости от чётности столбца.
 * Результат: на всех hex-картах бонусы соседства, районы, радиус энергосети и логистики
 * считались по чужой геометрии — часть соседей терялась, часть учитывалась ошибочно.
 *
 * ПОЧЕМУ OFFSET, А НЕ AXIAL В ХРАНЕНИИ
 * Ключи клеток — строки `"x,y"`, и на них опирается всё: сейвы, буферы, уровни, очередь работ.
 * Переезд на axial в хранении означал бы миграцию каждого существующего сейва. Вместо этого
 * offset остаётся форматом хранения, а cube-координаты вычисляются на месте, когда нужно
 * расстояние. Миграция сейвов не требуется вообще.
 *
 * РАСКЛАДКА
 * FactoryGrid рисует flat-top гексы, где НЕЧЁТНЫЕ столбцы сдвинуты вниз на полряда
 * (`offsetY = x % 2 === 1 ? HEX_VERT : 0`). Это раскладка «odd-q». Формулы ниже — для неё,
 * и при смене раскладки в рендере их придётся менять синхронно.
 */

export type GridGeometry = 'square' | 'hex';

export interface CubeCoord {
  x: number;
  y: number;
  z: number;
}

/**
 * Offset (odd-q) -> cube.
 *
 * Инвариант cube-координат: x + y + z = 0. Он и делает расстояние тривиальным.
 */
export function offsetToCube(col: number, row: number): CubeCoord {
  const x = col;
  // (col - (col & 1)) / 2 — целочисленная коррекция сдвига нечётных столбцов.
  const z = row - (col - (col & 1)) / 2;
  return { x, y: -x - z, z };
}

/** Cube -> offset (odd-q). Обратная к offsetToCube. */
export function cubeToOffset(cube: CubeCoord): { col: number; row: number } {
  const col = cube.x;
  const row = cube.z + (cube.x - (cube.x & 1)) / 2;
  return { col, row };
}

/**
 * Расстояние между гексами в ШАГАХ (сколько клеток надо пройти).
 *
 * В cube-координатах это максимум из абсолютных разностей — то же самое, что
 * (|dx| + |dy| + |dz|) / 2, но без деления.
 */
export function hexDistance(ax: number, ay: number, bx: number, by: number): number {
  const a = offsetToCube(ax, ay);
  const b = offsetToCube(bx, by);
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.z - b.z));
}

/**
 * Расстояние на квадратной сетке — тоже в шагах, но по Чебышёву (диагональ = один шаг).
 *
 * ВАЖНО: раньше здесь было евклидово расстояние, и радиус 2 захватывал 12 клеток вместо 24
 * (диагональ считалась за 1.41 шага). Чебышёв согласован с hexDistance: в обеих геометриях
 * «радиус N» означает «N шагов», и правила соседства читаются одинаково.
 */
export function squareDistance(ax: number, ay: number, bx: number, by: number): number {
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}

/** Расстояние в шагах для заданной геометрии. */
export function gridDistance(
  geometry: GridGeometry,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  return geometry === 'hex'
    ? hexDistance(ax, ay, bx, by)
    : squareDistance(ax, ay, bx, by);
}

/** Направления к шести соседям в cube-координатах. */
const CUBE_DIRECTIONS: CubeCoord[] = [
  { x: 1, y: -1, z: 0 },
  { x: 1, y: 0, z: -1 },
  { x: 0, y: 1, z: -1 },
  { x: -1, y: 1, z: 0 },
  { x: -1, y: 0, z: 1 },
  { x: 0, y: -1, z: 1 },
];

/** Шесть соседей гекса в offset-координатах. */
export function hexNeighbors(col: number, row: number): Array<{ x: number; y: number }> {
  const cube = offsetToCube(col, row);
  return CUBE_DIRECTIONS.map((d) => {
    const offset = cubeToOffset({ x: cube.x + d.x, y: cube.y + d.y, z: cube.z + d.z });
    return { x: offset.col, y: offset.row };
  });
}

/** Восемь соседей квадратной клетки (включая диагонали — согласовано с Чебышёвым). */
export function squareNeighbors(col: number, row: number): Array<{ x: number; y: number }> {
  const out: Array<{ x: number; y: number }> = [];
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (dx === 0 && dy === 0) continue;
      out.push({ x: col + dx, y: row + dy });
    }
  }
  return out;
}

/** Непосредственные соседи для заданной геометрии. */
export function gridNeighbors(
  geometry: GridGeometry,
  col: number,
  row: number,
): Array<{ x: number; y: number }> {
  return geometry === 'hex' ? hexNeighbors(col, row) : squareNeighbors(col, row);
}

/**
 * Сколько клеток попадает в радиус N (не считая центральной).
 * Нужно для баланса: одно и то же правило «+5% за соседа» на гексах и квадратах затрагивает
 * разное число клеток, и это стоит видеть в тестах, а не обнаруживать по жалобам.
 */
export function cellsInRadius(geometry: GridGeometry, radius: number): number {
  if (radius <= 0) return 0;
  if (geometry === 'hex') {
    // 3 * N * (N + 1) — известная формула для гексагонального «диска» без центра.
    return 3 * radius * (radius + 1);
  }
  // Квадрат со стороной (2N+1) без центра.
  const side = 2 * radius + 1;
  return side * side - 1;
}

// ============================================================================
// ТЕКУЩАЯ ГЕОМЕТРИЯ
// ============================================================================

/*
 * Геометрия — свойство КАРТЫ, а не отдельного вызова, и нужна она в глубине расчётов:
 * proximity, районы, энергосеть, логистика. Протаскивать её параметром через все эти слои
 * значило бы менять десятки сигнатур ради значения, которое меняется раз за партию.
 *
 * Поэтому модульная переменная с явным сеттером — тот же приём, что уже используется в проекте
 * для множителя энергоёмкости от политик (setPolicyEnergyStorageMult). Все функции расстояния
 * принимают геометрию и параметром тоже: тесты не должны зависеть от глобального состояния.
 */
let activeGeometry: GridGeometry = 'square';

/** Установить геометрию текущей карты. Вызывается при загрузке и смене карты. */
export function setActiveGridGeometry(geometry: GridGeometry): void {
  activeGeometry = geometry;
}

export function getActiveGridGeometry(): GridGeometry {
  return activeGeometry;
}

/** Расстояние в шагах по геометрии ТЕКУЩЕЙ карты. */
export function activeGridDistance(ax: number, ay: number, bx: number, by: number): number {
  return gridDistance(activeGeometry, ax, ay, bx, by);
}
