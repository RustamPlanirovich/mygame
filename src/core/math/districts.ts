/**
 * Система кластеризации зданий (производственные районы)
 * Определяет группы зданий одной категории и применяет бонусы за их концентрацию
 */

import type { Building } from '../gameTypes';
import { getBuildingCategory } from '../math/proximity';

export type DistrictType = 
  | 'electronics'    // Электронный район (полупроводники, микросхемы, компьютеры)
  | 'military'       // Военный район (оружие, турели, радары)
  | 'space'          // Космический район (ракеты, спутники, корабли)
  | 'research'       // Научный кампус (лаборатории, исследования)
  | 'energy'         // Энергетический район (электростанции)
  | 'production'     // Производственный район (заводы)
  | 'mining';        // Добывающий район (шахты)

export interface District {
  type: DistrictType;
  buildings: Building[];
  centerX: number;
  centerY: number;
  radius: number;
  bonus: number; // Множитель производства для зданий в районе
  description: string;
}

/**
 * Определить тип района по названиям зданий
 */
function determineDistrictType(buildings: Building[]): DistrictType | null {
  const categories = new Map<string, number>();
  
  for (const building of buildings) {
    const category = getBuildingCategory(building.name);
    if (category) {
      categories.set(category, (categories.get(category) || 0) + 1);
    }
  }
  
  // Специальные проверки для определенных типов зданий
  const names = buildings.map(b => b.name.toLowerCase());
  
  // Электронный район: полупроводники, микросхемы, компьютеры, дисплеи
  const electronicsKeywords = ['semiconductor', 'circuit', 'computer', 'display', 'полупроводник', 'микросхем', 'компьютер', 'экран'];
  const electronicsCount = names.filter(n => electronicsKeywords.some(k => n.includes(k))).length;
  if (electronicsCount >= 3) return 'electronics';
  
  // Военный район
  if ((categories.get('military') || 0) >= 3) return 'military';
  
  // Космический район
  if ((categories.get('space') || 0) >= 3) return 'space';
  
  // Научный кампус
  if ((categories.get('research') || 0) >= 3) return 'research';
  
  // Энергетический район
  if ((categories.get('energy') || 0) >= 4) return 'energy';
  
  // Производственный район
  if ((categories.get('production') || 0) >= 5) return 'production';
  
  // Добывающий район
  if ((categories.get('mining') || 0) >= 4) return 'mining';
  
  return null;
}

/**
 * Вычислить бонус для района на основе количества и типа зданий
 */
/**
 * Потолок множителя по типу района. Вынесено из calculateDistrictBonus, потому что нужно
 * снаружи: «идеальный район» в достижениях — это район, чей бонус дошёл до потолка
 * (см. isDistrictMaxed). Раньше этого понятия не существовало, и достижение «Перфекционист»
 * было недостижимо (bigplan.md, пункт 11).
 */
export const DISTRICT_MAX_MULTIPLIER: Record<DistrictType, number> = {
  electronics: 1.5,    // Макс +50%
  military: 1.4,       // Макс +40%
  space: 1.6,          // Макс +60%
  research: 1.8,       // Макс +80%
  energy: 1.3,         // Макс +30%
  production: 1.3,     // Макс +30%
  mining: 1.4,         // Макс +40%
};

function calculateDistrictBonus(type: DistrictType, buildingCount: number): number {
  const baseBonus = {
    electronics: 0.05,   // +5% за здание
    military: 0.04,      // +4% за здание
    space: 0.06,         // +6% за здание
    research: 0.08,      // +8% за здание
    energy: 0.03,        // +3% за здание
    production: 0.03,    // +3% за здание
    mining: 0.04,        // +4% за здание
  };

  const bonus = baseBonus[type];
  const multiplier = 1 + bonus * (buildingCount - 2); // -2 потому что бонус начинается с 3 зданий

  // Ограничиваем максимальный бонус
  return Math.min(multiplier, DISTRICT_MAX_MULTIPLIER[type]);
}

/**
 * Район «идеальный» — его бонус упёрся в потолок для своего типа.
 * Сравнение с допуском: bonus считается через умножение, точное равенство с 1.5 ненадёжно.
 */
export function isDistrictMaxed(district: District): boolean {
  return district.bonus >= DISTRICT_MAX_MULTIPLIER[district.type] - 1e-9;
}

/**
 * Получить описание района
 */
function getDistrictDescription(type: DistrictType, bonus: number): string {
  const bonusPercent = ((bonus - 1) * 100).toFixed(0);
  
  const descriptions = {
    electronics: `🔬 Электронный район: +${bonusPercent}% к производству электроники`,
    military: `⚔️ Военный комплекс: +${bonusPercent}% к производству вооружений`,
    space: `🚀 Космопорт: +${bonusPercent}% к производству космической техники`,
    research: `🎓 Научный кампус: +${bonusPercent}% к исследованиям`,
    energy: `⚡ Энергетический узел: +${bonusPercent}% к производству энергии`,
    production: `🏭 Промышленная зона: +${bonusPercent}% к производству`,
    mining: `⛏️ Добывающий сектор: +${bonusPercent}% к добыче`,
  };
  
  return descriptions[type];
}

/**
 * Проверить, принадлежит ли здание к типу района
 */
function isBuildingInDistrict(building: Building, districtType: DistrictType): boolean {
  const category = getBuildingCategory(building.name);
  const name = building.name.toLowerCase();
  
  switch (districtType) {
    case 'electronics':
      return ['semiconductor', 'circuit', 'computer', 'display', 'полупроводник', 'микросхем', 'компьютер', 'экран']
        .some(k => name.includes(k));
    
    case 'military':
      return category === 'military';
    
    case 'space':
      return category === 'space';
    
    case 'research':
      return category === 'research';
    
    case 'energy':
      return category === 'energy';
    
    case 'production':
      return category === 'production';
    
    case 'mining':
      return category === 'mining';
    
    default:
      return false;
  }
}

/**
 * Использовать DBSCAN алгоритм для кластеризации зданий
 */
function dbscan(buildings: Building[], epsilon: number, minPoints: number): Building[][] {
  if (buildings.length === 0) return [];
  
  const visited = new Set<string>();
  const clusters: Building[][] = [];
  
  for (const building of buildings) {
    if (!building.coord || visited.has(building.id)) continue;
    
    visited.add(building.id);
    
    // Найти соседей
    const neighbors = buildings.filter(b => {
      if (!b.coord || b.id === building.id) return false;
      const dx = b.coord.x - building.coord!.x;
      const dy = b.coord.y - building.coord!.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      return distance <= epsilon;
    });
    
    if (neighbors.length < minPoints - 1) continue; // -1 потому что building не включено в neighbors
    
    // Создать кластер
    const cluster: Building[] = [building];
    const queue = [...neighbors];
    
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current.id)) continue;
      
      visited.add(current.id);
      cluster.push(current);
      
      // Найти соседей текущего здания
      const currentNeighbors = buildings.filter(b => {
        if (!b.coord || b.id === current.id || visited.has(b.id)) return false;
        const dx = b.coord.x - current.coord!.x;
        const dy = b.coord.y - current.coord!.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance <= epsilon;
      });
      
      if (currentNeighbors.length >= minPoints - 1) {
        queue.push(...currentNeighbors);
      }
    }
    
    clusters.push(cluster);
  }
  
  return clusters;
}

/**
 * Обнаружить все районы на карте
 */
export function detectDistricts(buildingsWithCoords: Building[]): District[] {
  const districts: District[] = [];
  
  // Группируем здания по категориям
  const buildingsByCategory = new Map<string, Building[]>();
  
  for (const building of buildingsWithCoords) {
    const category = getBuildingCategory(building.name);
    if (!category) continue;
    
    if (!buildingsByCategory.has(category)) {
      buildingsByCategory.set(category, []);
    }
    buildingsByCategory.get(category)!.push(building);
  }
  
  // Кластеризуем здания каждой категории
  const epsilon = 4; // Радиус поиска соседей (клетки)
  const minPoints = 3; // Минимум зданий для формирования района
  
  for (const [, buildings] of buildingsByCategory.entries()) {
    if (buildings.length < minPoints) continue;
    
    const clusters = dbscan(buildings, epsilon, minPoints);
    
    for (const cluster of clusters) {
      const districtType = determineDistrictType(cluster);
      if (!districtType) continue;
      
      // Вычислить центр кластера
      const sumX = cluster.reduce((sum, b) => sum + (b.coord?.x || 0), 0);
      const sumY = cluster.reduce((sum, b) => sum + (b.coord?.y || 0), 0);
      const centerX = sumX / cluster.length;
      const centerY = sumY / cluster.length;
      
      // Вычислить радиус (максимальное расстояние от центра)
      const radius = Math.max(
        ...cluster.map(b => {
          if (!b.coord) return 0;
          const dx = b.coord.x - centerX;
          const dy = b.coord.y - centerY;
          return Math.sqrt(dx * dx + dy * dy);
        })
      );
      
      const bonus = calculateDistrictBonus(districtType, cluster.length);
      const description = getDistrictDescription(districtType, bonus);
      
      districts.push({
        type: districtType,
        buildings: cluster,
        centerX,
        centerY,
        radius: radius + 1, // +1 для небольшого запаса
        bonus,
        description,
      });
    }
  }
  
  return districts;
}

/**
 * Получить бонус района для конкретного здания
 */
export function getDistrictBonusForBuilding(
  building: Building,
  districts: District[]
): { bonus: number; districtType: DistrictType | null } {
  if (!building.coord) {
    return { bonus: 1, districtType: null };
  }
  
  // Проверяем, находится ли здание в каком-либо районе
  for (const district of districts) {
    const dx = building.coord.x - district.centerX;
    const dy = building.coord.y - district.centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance <= district.radius && isBuildingInDistrict(building, district.type)) {
      return { bonus: district.bonus, districtType: district.type };
    }
  }
  
  return { bonus: 1, districtType: null };
}
