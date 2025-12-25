/**
 * Логистическая система
 * Система расчета эффективности транспортировки ресурсов
 */

import type { Building, GridCoord } from '../core/gameTypes';

/**
 * Максимальная дистанция без штрафа (базовое значение)
 */
const BASE_MAX_DISTANCE = 5;

/**
 * Штраф за каждую клетку свыше базовой дистанции (15% за клетку)
 */
const DISTANCE_PENALTY_PER_CELL = 0.15;

/**
 * Минимальная эффективность (не может быть меньше 40%)
 */
const MIN_EFFICIENCY = 0.4;

/**
 * Проверяет, находится ли точка в зоне покрытия логистической сети
 */
export function isInLogisticsZone(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  radius: number
): boolean {
  const dx = Math.abs(targetX - sourceX);
  const dy = Math.abs(targetY - sourceY);
  return dx + dy <= radius;
}

/**
 * Получает все логистические узлы (склады и логистические центры)
 */
export function getLogisticsHubs(buildings: Building[]): Array<{ building: Building; radius: number }> {
  return buildings
    .filter((b) => b.coord && b.logisticsRadius && b.logisticsRadius > 0)
    .map((b) => ({
      building: b,
      radius: b.logisticsRadius!
    }));
}

/**
 * Проверяет, находится ли здание в зоне покрытия логистической сети
 * @param coord Координаты здания
 * @param buildings Список всех зданий
 * @returns true если здание в зоне покрытия хотя бы одного логистического узла
 */
export function isInLogisticsNetwork(
  coord: GridCoord,
  buildings: Building[]
): boolean {
  const hubs = getLogisticsHubs(buildings);

  for (const { building, radius } of hubs) {
    if (!building.coord) continue;
    
    if (isInLogisticsZone(
      building.coord.x,
      building.coord.y,
      coord.x,
      coord.y,
      radius
    )) {
      return true;
    }
  }

  return false;
}

/**
 * Рассчитывает расстояние между двумя точками (манхэттенское)
 */
export function calculateDistance(from: GridCoord, to: GridCoord): number {
  return Math.abs(from.x - to.x) + Math.abs(from.y - to.y);
}

/**
 * Рассчитывает эффективность логистики для здания на основе расстояния до базы
 * и наличия логистических узлов
 * 
 * @param buildingCoord Координаты здания
 * @param baseCoord Координаты базы
 * @param buildings Список всех зданий
 * @returns Множитель эффективности (1.0 = 100%, 0.85 = 85%, и т.д.)
 */
export function calculateLogisticsEfficiency(
  buildingCoord: GridCoord,
  baseCoord: GridCoord,
  buildings: Building[]
): number {
  // Если здание в зоне логистического узла, штрафов нет
  if (isInLogisticsNetwork(buildingCoord, buildings)) {
    return 1.0;
  }

  // Считаем расстояние до базы
  const distance = calculateDistance(buildingCoord, baseCoord);

  // Если в пределах базовой дистанции, штрафов нет
  if (distance <= BASE_MAX_DISTANCE) {
    return 1.0;
  }

  // Рассчитываем штраф
  const excessDistance = distance - BASE_MAX_DISTANCE;
  const penalty = excessDistance * DISTANCE_PENALTY_PER_CELL;
  const efficiency = Math.max(MIN_EFFICIENCY, 1.0 - penalty);

  return efficiency;
}

/**
 * Получает ближайший логистический узел для заданной точки
 */
export function getNearestLogisticsHub(
  coord: GridCoord,
  buildings: Building[]
): Building | null {
  const hubs = getLogisticsHubs(buildings);
  
  let nearest: Building | null = null;
  let minDistance = Infinity;

  for (const { building } of hubs) {
    if (!building.coord) continue;

    const distance = calculateDistance(building.coord, coord);
    
    if (distance < minDistance) {
      minDistance = distance;
      nearest = building;
    }
  }

  return nearest;
}

/**
 * Получает информацию о логистике для здания
 */
export interface LogisticsInfo {
  efficiency: number; // Эффективность (0.4 - 1.0)
  inNetwork: boolean; // Находится ли в зоне логистического узла
  distanceToBase: number; // Расстояние до базы
  nearestHub: Building | null; // Ближайший логистический узел
  penaltyPercent: number; // Штраф в процентах (0-60%)
}

/**
 * Получает полную информацию о логистике для здания
 */
export function getLogisticsInfo(
  buildingCoord: GridCoord,
  baseCoord: GridCoord,
  buildings: Building[]
): LogisticsInfo {
  const inNetwork = isInLogisticsNetwork(buildingCoord, buildings);
  const efficiency = calculateLogisticsEfficiency(buildingCoord, baseCoord, buildings);
  const distanceToBase = calculateDistance(buildingCoord, baseCoord);
  const nearestHub = getNearestLogisticsHub(buildingCoord, buildings);
  const penaltyPercent = Math.round((1 - efficiency) * 100);

  return {
    efficiency,
    inNetwork,
    distanceToBase,
    nearestHub,
    penaltyPercent
  };
}

/**
 * Получает все здания с логистическими штрафами
 */
export function getBuildingsWithLogisticsPenalty(
  buildings: Building[],
  baseCoord: GridCoord
): Array<{ building: Building; efficiency: number; penalty: number }> {
  const result: Array<{ building: Building; efficiency: number; penalty: number }> = [];

  for (const building of buildings) {
    if (!building.coord) continue;

    const efficiency = calculateLogisticsEfficiency(building.coord, baseCoord, buildings);
    
    if (efficiency < 1.0) {
      result.push({
        building,
        efficiency,
        penalty: Math.round((1 - efficiency) * 100)
      });
    }
  }

  return result;
}

/**
 * Получает все покрытые логистикой клетки
 */
export function getLogisticsCoveredCells(
  buildings: Building[],
  gridWidth: number,
  gridHeight: number
): Set<string> {
  const covered = new Set<string>();
  const hubs = getLogisticsHubs(buildings);

  for (const { building, radius } of hubs) {
    if (!building.coord) continue;

    const { x: cx, y: cy } = building.coord;

    for (let x = Math.max(0, cx - radius); x <= Math.min(gridWidth - 1, cx + radius); x++) {
      for (let y = Math.max(0, cy - radius); y <= Math.min(gridHeight - 1, cy + radius); y++) {
        if (isInLogisticsZone(cx, cy, x, y, radius)) {
          covered.add(`${x},${y}`);
        }
      }
    }
  }

  return covered;
}
