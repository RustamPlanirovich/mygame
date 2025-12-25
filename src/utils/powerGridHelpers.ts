/**
 * Энергетическая сеть (Power Grid)
 * Система зон покрытия энергией
 */

import type { Building, GridCoord } from '../core/gameTypes';

/**
 * Проверяет, находится ли точка (targetX, targetY) в радиусе покрытия от точки (sourceX, sourceY)
 */
export function isInRadius(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  radius: number
): boolean {
  const dx = Math.abs(targetX - sourceX);
  const dy = Math.abs(targetY - sourceY);
  // Используем манхэттенское расстояние (клетчатая сетка)
  return dx + dy <= radius;
}

/**
 * Проверяет, находится ли здание в зоне покрытия энергосети
 * @param targetCoord Координаты проверяемого здания
 * @param buildings Список всех зданий
 * @returns true если здание находится в зоне покрытия
 */
export function isBuildingPowered(
  targetCoord: GridCoord,
  buildings: Building[]
): boolean {
  // Находим все здания с powerGridRadius (электростанции и подстанции)
  const powerSources = buildings.filter(
    (b) => b.coord && b.powerGridRadius && b.powerGridRadius > 0
  );

  // Проверяем, находится ли здание в радиусе хотя бы одного источника энергии
  for (const source of powerSources) {
    if (!source.coord) continue;
    
    if (isInRadius(
      source.coord.x,
      source.coord.y,
      targetCoord.x,
      targetCoord.y,
      source.powerGridRadius!
    )) {
      return true;
    }
  }

  return false;
}

/**
 * Получает список всех зданий, которые находятся вне зоны покрытия энергосети
 * @param buildings Список всех зданий
 * @returns Массив зданий без энергопокрытия
 */
export function getUnpoweredBuildings(buildings: Building[]): Building[] {
  const unpowered: Building[] = [];

  for (const building of buildings) {
    // Пропускаем здания без координат или сами источники энергии
    if (!building.coord) continue;
    if (building.powerGridRadius && building.powerGridRadius > 0) continue;

    // Проверяем покрытие
    if (!isBuildingPowered(building.coord, buildings)) {
      unpowered.push(building);
    }
  }

  return unpowered;
}

/**
 * Получает все источники энергии с их радиусами покрытия
 * @param buildings Список всех зданий
 */
export function getPowerSources(buildings: Building[]): Array<{ building: Building; radius: number }> {
  return buildings
    .filter((b) => b.coord && b.powerGridRadius && b.powerGridRadius > 0)
    .map((b) => ({
      building: b,
      radius: b.powerGridRadius!
    }));
}

/**
 * Проверяет, будет ли здание в зоне покрытия, если его построить на указанных координатах
 * @param coord Координаты для постройки
 * @param buildings Существующие здания
 * @returns true если место покрыто энергосетью
 */
export function isLocationPowered(
  coord: GridCoord,
  buildings: Building[]
): boolean {
  return isBuildingPowered(coord, buildings);
}

/**
 * Получает ближайший источник энергии для заданной точки
 * @param coord Координаты точки
 * @param buildings Список всех зданий
 * @returns Ближайший источник энергии или null
 */
export function getNearestPowerSource(
  coord: GridCoord,
  buildings: Building[]
): Building | null {
  const powerSources = getPowerSources(buildings);
  
  let nearest: Building | null = null;
  let minDistance = Infinity;

  for (const { building } of powerSources) {
    if (!building.coord) continue;

    const distance = Math.abs(building.coord.x - coord.x) + Math.abs(building.coord.y - coord.y);
    
    if (distance < minDistance) {
      minDistance = distance;
      nearest = building;
    }
  }

  return nearest;
}

/**
 * Получает все клетки, покрытые энергосетью
 * @param buildings Список всех зданий
 * @param gridWidth Ширина сетки
 * @param gridHeight Высота сетки
 * @returns Set координат в формате "x,y"
 */
export function getPoweredCells(
  buildings: Building[],
  gridWidth: number,
  gridHeight: number
): Set<string> {
  const powered = new Set<string>();
  const powerSources = getPowerSources(buildings);

  for (const { building, radius } of powerSources) {
    if (!building.coord) continue;

    const { x: cx, y: cy } = building.coord;

    // Проходим по всем клеткам в радиусе
    for (let x = Math.max(0, cx - radius); x <= Math.min(gridWidth - 1, cx + radius); x++) {
      for (let y = Math.max(0, cy - radius); y <= Math.min(gridHeight - 1, cy + radius); y++) {
        if (isInRadius(cx, cy, x, y, radius)) {
          powered.add(`${x},${y}`);
        }
      }
    }
  }

  return powered;
}
