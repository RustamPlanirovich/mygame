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
 * Список добывающих зданий (привязаны к месторождениям)
 * Эти здания НЕ получают логистический штраф, так как их местоположение
 * определяется расположением месторождений, а не выбором игрока
 */
export const EXTRACTOR_BUILDING_IDS = new Set([
  'miner_mk1',
  'ice_extractor_mk1',
  'carbon_harvester_mk1',
  'gas_well_mk1',
  'oil_well_mk1',
  'sand_quarry_mk1',
  'uranium_mine_mk1',
  'chrome_mine_mk1',
  'titanium_mine_mk1',
  'copper_mine_mk1',
]);

/**
 * Проверяет, является ли здание добывающим (привязано к месторождению)
 */
export function isExtractorBuilding(buildingId: string): boolean {
  return EXTRACTOR_BUILDING_IDS.has(buildingId);
}

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

export type SimpleLogisticsHub = { x: number; y: number; radius: number };

/**
 * Проверяет, находится ли здание в зоне покрытия логистической сети
 * @param coord Координаты здания
 * @param buildingsOrHubs Список всех зданий или оптимизированный список хабов
 * @returns true если здание в зоне покрытия хотя бы одного логистического узла
 */
export function isInLogisticsNetwork(
  coord: GridCoord,
  buildingsOrHubs: Building[] | SimpleLogisticsHub[]
): boolean {
  let hubs: SimpleLogisticsHub[];

  // Duck typing check for optimized hubs
  if (buildingsOrHubs.length > 0 && 'radius' in buildingsOrHubs[0] && 'x' in buildingsOrHubs[0] && !('id' in buildingsOrHubs[0])) {
      hubs = buildingsOrHubs as SimpleLogisticsHub[];
  } else {
      const buildings = buildingsOrHubs as Building[];
      hubs = getLogisticsHubs(buildings).map(h => {
        if (!h.building.coord) return { x: 0, y: 0, radius: 0 }; // Should not happen due to filter
        return { x: h.building.coord.x, y: h.building.coord.y, radius: h.radius };
      });
  }

  for (const hub of hubs) {
    if (isInLogisticsZone(
      hub.x,
      hub.y,
      coord.x,
      coord.y,
      hub.radius
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
 * @param buildingsOrHubs Список всех зданий или оптимизированный список хабов
 * @param buildingId ID здания (опционально) - добывающие здания не получают штраф
 * @param logisticsPenaltyReduction Бонус снижения штрафа от артефактов (0-1, например 0.3 = снижение на 30%)
 * @returns Множитель эффективности (1.0 = 100%, 0.85 = 85%, и т.д.)
 */
export function calculateLogisticsEfficiency(
  buildingCoord: GridCoord,
  baseCoord: GridCoord,
  buildingsOrHubs: Building[] | SimpleLogisticsHub[],
  buildingId?: string,
  logisticsPenaltyReduction: number = 0
): number {
  // Добывающие здания не получают логистический штраф
  // Они привязаны к месторождениям и не могут быть размещены рядом с базой
  if (buildingId && isExtractorBuilding(buildingId)) {
    return 1.0;
  }
  
  // Если здание в зоне логистического узла, штрафов нет
  if (isInLogisticsNetwork(buildingCoord, buildingsOrHubs)) {
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
  let penalty = excessDistance * DISTANCE_PENALTY_PER_CELL;
  
  // Применяем бонус снижения штрафа от артефактов
  if (logisticsPenaltyReduction > 0) {
    penalty = penalty * (1 - Math.min(logisticsPenaltyReduction, 0.9)); // Максимум 90% снижения
  }
  
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
  isExtractor: boolean; // Добывающее здание (нет штрафа)
}

/**
 * Получает полную информацию о логистике для здания
 */
export function getLogisticsInfo(
  buildingCoord: GridCoord,
  baseCoord: GridCoord,
  buildings: Building[],
  buildingId?: string
): LogisticsInfo {
  const inNetwork = isInLogisticsNetwork(buildingCoord, buildings);
  const isExtractor = buildingId ? isExtractorBuilding(buildingId) : false;
  const efficiency = calculateLogisticsEfficiency(buildingCoord, baseCoord, buildings, buildingId);
  const distanceToBase = calculateDistance(buildingCoord, baseCoord);
  const nearestHub = getNearestLogisticsHub(buildingCoord, buildings);
  const penaltyPercent = Math.round((1 - efficiency) * 100);

  return {
    efficiency,
    inNetwork,
    distanceToBase,
    nearestHub,
    penaltyPercent,
    isExtractor
  };
}

/**
 * Получает все здания с логистическими штрафами
 * Добывающие здания не включаются, так как не получают штраф
 */
export function getBuildingsWithLogisticsPenalty(
  buildings: Building[],
  baseCoord: GridCoord
): Array<{ building: Building; efficiency: number; penalty: number }> {
  const result: Array<{ building: Building; efficiency: number; penalty: number }> = [];

  for (const building of buildings) {
    if (!building.coord) continue;

    // Передаём ID здания для корректной проверки добывающих зданий
    const efficiency = calculateLogisticsEfficiency(building.coord, baseCoord, buildings, building.id);
    
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
