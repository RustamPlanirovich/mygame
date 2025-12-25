/**
 * Вспомогательные функции для работы с близостью в игровом стейте
 */

import type { Building, GridCoord } from '../core/gameTypes';
import { 
  getAdjacentBuildings, 
  calculateProximityBonus, 
  getTotalProximityMultiplier,
  evaluatePlacementQuality 
} from '../core/math/proximity';
import { detectDistricts, getDistrictBonusForBuilding } from '../core/math/districts';

/**
 * Парсинг ключа тайла в координаты
 */
export function parseTileKey(key: string): GridCoord | null {
  const match = key.match(/^(-?\d+),(-?\d+)$/);
  if (!match) return null;
  return { x: parseInt(match[1]), y: parseInt(match[2]) };
}

/**
 * Создание ключа тайла из координат
 */
export function makeTileKey(x: number, y: number): string {
  return `${x},${y}`;
}

/**
 * Получить список всех зданий с их координатами из сетки
 */
export function getBuildingsWithCoordinates(
  buildings: Building[],
  tiles: Record<string, string>
): Building[] {
  const buildingsMap = new Map(buildings.map(b => [b.id, b]));
  const result: Building[] = [];
  
  for (const [tileKey, buildingId] of Object.entries(tiles)) {
    const building = buildingsMap.get(buildingId);
    if (!building) continue;
    
    const coord = parseTileKey(tileKey);
    if (!coord) continue;
    
    // Создаем копию здания с координатами
    result.push({
      ...building,
      coord,
    });
  }
  
  return result;
}

/**
 * Обновить множители близости для всех зданий на сетке
 * Теперь также учитывает бонусы от производственных районов
 */
export function updateAllProximityMultipliers(
  buildings: Building[],
  tiles: Record<string, string>
): Building[] {
  // Получаем здания с координатами
  const buildingsWithCoords = getBuildingsWithCoordinates(buildings, tiles);
  
  // Обнаруживаем районы
  const districts = detectDistricts(buildingsWithCoords);
  
  // Создаем Map для быстрого доступа
  const buildingMap = new Map(buildings.map(b => [b.id, b]));
  
  // Обновляем множители для каждого размещенного здания
  const updatedMultipliers = new Map<string, number>();
  
  for (const [tileKey, buildingId] of Object.entries(tiles)) {
    const building = buildingMap.get(buildingId);
    if (!building) continue;
    
    const coord = parseTileKey(tileKey);
    if (!coord) continue;
    
    let totalMultiplier = 1;
    
    // Бонусы от близости
    if (building.proximityRules && building.proximityRules.length > 0) {
      // Находим максимальный радиус из всех правил
      const maxRadius = Math.max(...building.proximityRules.map(r => r.radius));
      
      // Получаем соседние здания
      const neighbors = getAdjacentBuildings(coord.x, coord.y, maxRadius, buildingsWithCoords);
      
      // Вычисляем бонусы
      const bonuses = calculateProximityBonus(
        { ...building, coord },
        neighbors,
        building.proximityRules
      );
      
      // Получаем итоговый множитель от близости
      const proximityMultiplier = getTotalProximityMultiplier(bonuses);
      totalMultiplier *= proximityMultiplier;
    }
    
    // Бонусы от районов
    const buildingWithCoord = { ...building, coord };
    const districtBonus = getDistrictBonusForBuilding(buildingWithCoord, districts);
    totalMultiplier *= districtBonus.bonus;
    
    // Сохраняем множитель для этого экземпляра здания
    updatedMultipliers.set(tileKey, totalMultiplier);
  }
  
  // Возвращаем обновленные здания
  return buildings.map(b => {
    // Находим все тайлы с этим зданием и вычисляем средний множитель
    const buildingTiles = Object.entries(tiles)
      .filter(([_, id]) => id === b.id)
      .map(([key, _]) => key);
    
    if (buildingTiles.length === 0) {
      return { ...b, proximityMultiplier: 1 };
    }
    
    // Вычисляем средний множитель
    let totalMultiplier = 0;
    let count = 0;
    for (const tileKey of buildingTiles) {
      const mult = updatedMultipliers.get(tileKey);
      if (mult !== undefined) {
        totalMultiplier += mult;
        count++;
      }
    }
    
    const avgMultiplier = count > 0 ? totalMultiplier / count : 1;
    
    return {
      ...b,
      proximityMultiplier: avgMultiplier,
    };
  });
}

/**
 * Получить множитель близости для конкретного тайла
 */
export function getProximityMultiplierForTile(
  x: number,
  y: number,
  building: Building,
  tiles: Record<string, string>,
  buildings: Building[]
): number {
  if (!building.proximityRules || building.proximityRules.length === 0) {
    return 1;
  }
  
  const buildingsWithCoords = getBuildingsWithCoordinates(buildings, tiles);
  const maxRadius = Math.max(...building.proximityRules.map(r => r.radius));
  const neighbors = getAdjacentBuildings(x, y, maxRadius, buildingsWithCoords);
  const bonuses = calculateProximityBonus(
    { ...building, coord: { x, y } },
    neighbors,
    building.proximityRules
  );
  
  return getTotalProximityMultiplier(bonuses);
}

export { evaluatePlacementQuality, detectDistricts };
export type { District, DistrictType } from '../core/math/districts';
