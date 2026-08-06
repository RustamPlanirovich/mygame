/**
 * Генератор карт (Фаза 4)
 * Процедурная генерация карт на основе MapDefinition
 *
 * ВНИМАНИЕ: раскладку месторождений в живой игре делает НЕ этот модуль, а
 * [core/systems/deposits.ts](../core/systems/deposits.ts) — жилами, с весами редкости и
 * иссякаемыми запасами (bigplan.md, пункт 38). `startMap` берёт отсюда только геометрию
 * карты; `generateDeposits` ниже осталась материалом для будущих режимов (острова
 * asteroid_field, blocked-клетки) и на состояние игры не влияет. Правки баланса
 * месторождений вносить туда, а не сюда.
 */

import type { DepositType } from '../core/gameTypes';
import type { 
  MapDefinition,
  GridType,
  MapModifier,
  MapId,
  ActiveMapState
} from '../core/gameTypes.maps';
import { MODIFIER_EFFECTS } from '../core/gameTypes.maps';
import { getMapDefinition } from '../core/constants/maps';

// Тип клетки на карте
export interface MapTile {
  x: number;
  y: number;
  type: 'empty' | 'deposit' | 'blocked' | 'base';
  deposit?: DepositType;
  depositAmount?: number;
  buildingId?: string;
  isIsland?: number; // ID острова для asteroid_field
}

// Сгенерированная карта
export interface GeneratedMap {
  mapId: string;
  width: number;
  height: number;
  gridType: GridType;
  tiles: Map<string, MapTile>;
  deposits: Record<string, DepositType>;
  islands?: number[][]; // Для asteroid_field
  basePosition: { x: number; y: number };
}

// Ключ для координат
export function coordKey(x: number, y: number): string {
  return `${x},${y}`;
}

// Парсинг ключа
export function parseCoordKey(key: string): { x: number; y: number } | null {
  const parts = key.split(',');
  if (parts.length !== 2) return null;
  const x = parseInt(parts[0], 10);
  const y = parseInt(parts[1], 10);
  if (isNaN(x) || isNaN(y)) return null;
  return { x, y };
}

/**
 * Генератор случайных чисел с seed (для воспроизводимости)
 */
class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    const x = Math.sin(this.seed++) * 10000;
    return x - Math.floor(x);
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}

/**
 * Генерация карты на основе определения
 */
export function generateMap(mapDef: MapDefinition, seed?: number): GeneratedMap {
  const rng = new SeededRandom(seed ?? Date.now());
  const { width, height } = mapDef.gridDimensions;
  const tiles = new Map<string, MapTile>();
  const deposits: Record<string, DepositType> = {};

  // Инициализация пустых клеток
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const key = coordKey(x, y);
      tiles.set(key, { x, y, type: 'empty' });
    }
  }

  // Определение позиции базы (центр карты)
  const baseX = Math.floor(width / 2);
  const baseY = Math.floor(height / 2);
  const baseKey = coordKey(baseX, baseY);
  tiles.set(baseKey, { x: baseX, y: baseY, type: 'base' });

  // Обработка модификатора asteroid_field (острова)
  let islands: number[][] | undefined;
  if (mapDef.modifiers.includes('asteroid_field')) {
    islands = generateAsteroidField(tiles, width, height, rng);
  }

  // Генерация депозитов
  generateDeposits(tiles, deposits, mapDef, rng, baseX, baseY);

  return {
    mapId: mapDef.id,
    width,
    height,
    gridType: mapDef.gridType,
    tiles,
    deposits,
    islands,
    basePosition: { x: baseX, y: baseY },
  };
}

/**
 * Генерация астероидного поля (острова)
 */
function generateAsteroidField(
  tiles: Map<string, MapTile>,
  width: number,
  height: number,
  rng: SeededRandom
): number[][] {
  const islands: number[][] = [];
  const islandCount = Math.floor(width * height * 0.01) + 5; // ~12 островов для huge карты
  
  // Генерируем центры островов
  const centers: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < islandCount; i++) {
    centers.push({
      x: rng.nextInt(2, width - 3),
      y: rng.nextInt(2, height - 3),
    });
  }

  // Для каждой клетки определяем, к какому острову она принадлежит
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const key = coordKey(x, y);
      const tile = tiles.get(key);
      if (!tile || tile.type === 'base') continue;

      // Находим ближайший центр
      let minDist = Infinity;
      let closestIsland = -1;
      for (let i = 0; i < centers.length; i++) {
        const dist = Math.abs(x - centers[i].x) + Math.abs(y - centers[i].y);
        if (dist < minDist) {
          minDist = dist;
          closestIsland = i;
        }
      }

      // Если слишком далеко от любого острова - блокируем
      const maxRadius = 3 + rng.nextInt(0, 2);
      if (minDist > maxRadius) {
        tiles.set(key, { ...tile, type: 'blocked' });
      } else {
        tile.isIsland = closestIsland;
      }
    }
  }

  // Собираем острова
  for (let i = 0; i < islandCount; i++) {
    const islandTiles: number[] = [];
    tiles.forEach((tile) => {
      if (tile.isIsland === i) {
        islandTiles.push(tile.x * 1000 + tile.y);
      }
    });
    if (islandTiles.length > 0) {
      islands.push(islandTiles);
    }
  }

  return islands;
}

/**
 * Генерация депозитов ресурсов
 */
function generateDeposits(
  tiles: Map<string, MapTile>,
  deposits: Record<string, DepositType>,
  mapDef: MapDefinition,
  rng: SeededRandom,
  baseX: number,
  baseY: number
): void {
  // Габариты карты здесь не нужны: обходим уже созданный набор клеток, а не координатную сетку.
  const depositDensity = mapDef.depositDensity;
  const availableDeposits = mapDef.availableDeposits;

  // Модификатор плотности
  let densityMod = 1.0;
  for (const mod of mapDef.modifiers) {
    const effect = MODIFIER_EFFECTS[mod];
    if (effect?.effects.depositMultiplier) {
      densityMod *= effect.effects.depositMultiplier;
    }
  }

  // Минимальное расстояние от базы
  const minDistFromBase = 2;

  // Проходим по всем клеткам
  tiles.forEach((tile, key) => {
    if (tile.type !== 'empty') return;

    // Проверяем расстояние от базы
    const distFromBase = Math.abs(tile.x - baseX) + Math.abs(tile.y - baseY);
    if (distFromBase < minDistFromBase) return;

    // Вероятность депозита
    const chance = depositDensity * densityMod;
    if (rng.next() > chance) return;

    // Выбираем тип ресурса
    const resourceIndex = rng.nextInt(0, availableDeposits.length - 1);
    const depositType = availableDeposits[resourceIndex] as DepositType;

    // Определяем количество ресурсов
    let amount = 100 + rng.nextInt(0, 200);
    if (mapDef.modifiers.includes('rich_deposits')) {
      amount = Math.floor(amount * 1.5);
    } else if (mapDef.modifiers.includes('poor_deposits')) {
      amount = Math.floor(amount * 0.7);
    }

    // Обновляем клетку
    tiles.set(key, {
      ...tile,
      type: 'deposit',
      deposit: depositType,
      depositAmount: amount,
    });

    // Добавляем в deposits
    deposits[key] = depositType;
  });
}

/**
 * Конвертация GeneratedMap в формат для gameStore.grid
 */
export function convertToGridFormat(genMap: GeneratedMap): {
  width: number;
  height: number;
  tiles: Record<string, string>;
  deposits: Record<string, DepositType>;
} {
  const tiles: Record<string, string> = {};
  
  genMap.tiles.forEach((tile, key) => {
    if (tile.buildingId) {
      tiles[key] = tile.buildingId;
    }
  });

  return {
    width: genMap.width,
    height: genMap.height,
    tiles,
    deposits: genMap.deposits,
  };
}

/**
 * Инициализация ActiveMapState.
 *
 * Возвращала объект из старой схемы (mapId/startedAt/gridType/modifiers/stats) — ни одного
 * из этих полей в ActiveMapState нет уже давно, так что результат не подходил ни под слайс
 * maps, ни под сериализацию. Вызовов у функции нет: живой путь инициализации — INITIAL_MAPS
 * в gameStore. Приведено к актуальной схеме, чтобы helper снова можно было подключить.
 */
export function createActiveMapState(mapId: MapId): ActiveMapState {
  const mapDef = getMapDefinition(mapId);
  if (!mapDef) {
    throw new Error(`Map not found: ${mapId}`);
  }

  return {
    currentMapId: mapId,
    unlockedMaps: [mapId],
    mapProgress: {},
    activeMapData: null,
    mapSeed: Date.now(),
    currentEvent: null,
    eventHistory: [],
  };
}

/**
 * Проверка, можно ли строить на клетке
 */
export function canBuildOnTile(tile: MapTile): boolean {
  return tile.type === 'empty' || tile.type === 'deposit';
}

/**
 * Получение соседей клетки (для hex или square)
 */
export function getNeighbors(
  x: number,
  y: number,
  gridType: GridType,
  width: number,
  height: number
): Array<{ x: number; y: number }> {
  const neighbors: Array<{ x: number; y: number }> = [];

  if (gridType === 'square') {
    // 4 направления для квадратной сетки
    const dirs = [
      { dx: 0, dy: -1 },
      { dx: 1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 },
    ];
    for (const { dx, dy } of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        neighbors.push({ x: nx, y: ny });
      }
    }
  } else {
    // 6 направлений для гексагональной сетки (offset coordinates)
    const isOddRow = y % 2 === 1;
    const dirs = isOddRow
      ? [
          { dx: 1, dy: -1 },
          { dx: 1, dy: 0 },
          { dx: 1, dy: 1 },
          { dx: 0, dy: 1 },
          { dx: -1, dy: 0 },
          { dx: 0, dy: -1 },
        ]
      : [
          { dx: 0, dy: -1 },
          { dx: 1, dy: 0 },
          { dx: 0, dy: 1 },
          { dx: -1, dy: 1 },
          { dx: -1, dy: 0 },
          { dx: -1, dy: -1 },
        ];
    for (const { dx, dy } of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        neighbors.push({ x: nx, y: ny });
      }
    }
  }

  return neighbors;
}

/**
 * Расчёт расстояния между клетками
 */
export function getDistance(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  gridType: GridType
): number {
  if (gridType === 'square') {
    return Math.abs(x1 - x2) + Math.abs(y1 - y2);
  } else {
    // Hex distance using cube coordinates
    const col1 = x1;
    const row1 = y1;
    const col2 = x2;
    const row2 = y2;

    // Convert offset to cube
    const x1c = col1 - Math.floor(row1 / 2);
    const z1c = row1;
    const y1c = -x1c - z1c;

    const x2c = col2 - Math.floor(row2 / 2);
    const z2c = row2;
    const y2c = -x2c - z2c;

    return Math.max(
      Math.abs(x1c - x2c),
      Math.abs(y1c - y2c),
      Math.abs(z1c - z2c)
    );
  }
}

/**
 * Проверка активности модификатора
 */
export function hasModifier(modifiers: MapModifier[], check: MapModifier): boolean {
  return modifiers.includes(check);
}

/**
 * Получение эффекта модификатора
 */
export function getModifierEffect(modifiers: MapModifier[], key: keyof typeof MODIFIER_EFFECTS[MapModifier]['effects']): number | boolean | string | undefined {
  for (const mod of modifiers) {
    const effect = MODIFIER_EFFECTS[mod];
    if (effect?.effects[key] !== undefined) {
      return effect.effects[key];
    }
  }
  return undefined;
}
