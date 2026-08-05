/**
 * Утилиты для расчета близости и синергии зданий
 */

import type { Building, BuildingType } from '../gameTypes';
import { activeGridDistance } from './hexGeometry';

export type ProximityRuleType = 'bonus' | 'penalty' | 'required' | 'incompatible';

export interface ProximityRule {
  type: ProximityRuleType;
  // Тип здания, на который действует правило
  targetBuildingType?: BuildingType | BuildingType[];
  // Категория зданий (альтернатива targetBuildingType)
  targetCategory?: 'mining' | 'energy' | 'production' | 'military' | 'research' | 'space' | 'storage';
  // Радиус действия (в клетках)
  radius: number;
  // Множитель производства (1.0 = без изменений, 1.2 = +20%, 0.8 = -20%)
  multiplier: number;
  // Минимальное количество соседних зданий для активации
  minCount?: number;
  // Максимальное количество соседних зданий (для ограничения бонусов)
  maxCount?: number;
  // Описание эффекта для UI
  description: string;
}

export interface ProximityBonus {
  source: string; // ID здания-источника бонуса
  multiplier: number; // Множитель производства
  description: string;
}

/**
 * Получить все здания в радиусе от заданной позиции
 */
export function getAdjacentBuildings(
  x: number,
  y: number,
  radius: number,
  buildings: Building[]
): Building[] {
  /*
   * Расстояние считается по геометрии ТЕКУЩЕЙ карты (bigplan.md, пункты 21, 31).
   *
   * Здесь было `Math.sqrt(dx*dx + dy*dy)` — евклидово расстояние по (x, y). На гексагональных
   * картах (а их в игре четыре из девяти) это давало неверное соседство: клетки хранятся в
   * offset-координатах, у нечётных столбцов есть сдвиг на полряда, поэтому одинаковая разность
   * координат означает разное фактическое расстояние. Часть соседей терялась, часть
   * учитывалась ошибочно — то есть все правила близости на hex-картах работали не так.
   *
   * Заодно и на квадратных сетках поведение стало предсказуемым: теперь радиус измеряется
   * в ШАГАХ (Чебышёв), а не в длине отрезка, где диагональ стоила 1.41 и «радиус 1» не
   * включал диагональных соседей.
   */
  return buildings.filter(building => {
    if (!building.coord) return false;
    const distance = activeGridDistance(building.coord.x, building.coord.y, x, y);
    return distance <= radius && distance > 0; // Исключаем само здание (distance > 0)
  });
}

/*
 * Здесь были getManhattanDistance и getEuclideanDistance. Оба удалены (bigplan.md, пункты 21, 31):
 * ими никто не пользовался, а на гексагональных картах любая из этих метрик по (x, y) даёт
 * неверное расстояние — оставлять их значит оставлять готовую ловушку для следующей правки.
 * Единственный правильный способ — activeGridDistance из core/math/hexGeometry.
 */

/**
 * Определить категорию здания по его типу
 */
export function getBuildingCategory(buildingName: string): string | null {
  const name = buildingName.toLowerCase();
  
  // Добывающие
  if (name.includes('mine') || name.includes('well') || name.includes('quarry') || 
      name.includes('extractor') || name.includes('prospector')) {
    return 'mining';
  }
  
  // Энергетические
  if (name.includes('power') || name.includes('solar') || name.includes('generator') || 
      name.includes('reactor') || name.includes('battery') || name.includes('storage') && name.includes('energy')) {
    return 'energy';
  }
  
  // Производственные
  if (name.includes('factory') || name.includes('plant') || name.includes('refinery') || 
      name.includes('foundry') || name.includes('workshop') || name.includes('assembler')) {
    return 'production';
  }
  
  // Военные
  if (name.includes('turret') || name.includes('radar') || name.includes('weapon') || 
      name.includes('artillery') || name.includes('defense') || name.includes('military')) {
    return 'military';
  }
  
  // Исследовательские
  if (name.includes('lab') || name.includes('research') || name.includes('observatory') || 
      name.includes('academy')) {
    return 'research';
  }
  
  // Космические
  if (name.includes('rocket') || name.includes('space') || name.includes('satellite') || 
      name.includes('spaceport') || name.includes('launch')) {
    return 'space';
  }
  
  // Складские
  if (name.includes('warehouse') || name.includes('silo') || name.includes('depot')) {
    return 'storage';
  }
  
  return null;
}

/**
 * Проверить, соответствует ли здание правилу близости
 */
function matchesProximityRule(building: Building, rule: ProximityRule): boolean {
  // Проверка по типу здания
  if (rule.targetBuildingType) {
    const types = Array.isArray(rule.targetBuildingType) 
      ? rule.targetBuildingType 
      : [rule.targetBuildingType];
    if (!types.includes(building.name as BuildingType)) {
      return false;
    }
  }
  
  // Проверка по категории
  if (rule.targetCategory) {
    const category = getBuildingCategory(building.name);
    if (category !== rule.targetCategory) {
      return false;
    }
  }
  
  return true;
}

/**
 * Вычислить бонусы/штрафы от близости для конкретного здания
 */
export function calculateProximityBonus(
  _building: Building, // Префикс _ показывает, что параметр не используется напрямую
  neighbors: Building[],
  rules?: ProximityRule[]
): ProximityBonus[] {
  if (!rules || rules.length === 0) return [];
  
  const bonuses: ProximityBonus[] = [];
  
  for (const rule of rules) {
    // Найти здания, соответствующие правилу
    const matchingNeighbors = neighbors.filter(n => matchesProximityRule(n, rule));
    
    // Проверить количество
    const count = matchingNeighbors.length;
    const minCount = rule.minCount || 1;
    const maxCount = rule.maxCount || Infinity;
    
    if (count >= minCount) {
      // Ограничить количество эффектов
      const effectiveCount = Math.min(count, maxCount);
      
      // Вычислить итоговый множитель
      let totalMultiplier = 1;
      if (rule.type === 'bonus') {
        // Бонусы складываются аддитивно: 1.2 + 1.2 = 1.4 (не 1.44)
        totalMultiplier = 1 + (rule.multiplier - 1) * effectiveCount;
      } else if (rule.type === 'penalty') {
        // Штрафы также аддитивно
        totalMultiplier = 1 - (1 - rule.multiplier) * effectiveCount;
        // Не опускаем ниже 0
        totalMultiplier = Math.max(0, totalMultiplier);
      }
      
      bonuses.push({
        source: `proximity_rule_${rule.targetBuildingType || rule.targetCategory}`,
        multiplier: totalMultiplier,
        description: rule.description.replace('{count}', effectiveCount.toString()),
      });
    }
  }
  
  return bonuses;
}

/**
 * Получить общий множитель производства с учетом всех бонусов
 */
export function getTotalProximityMultiplier(bonuses: ProximityBonus[]): number {
  if (bonuses.length === 0) return 1;
  
  // Перемножаем все множители
  return bonuses.reduce((total, bonus) => total * bonus.multiplier, 1);
}

/**
 * Оценить качество размещения здания (для визуализации)
 * Возвращает: 'optimal' | 'good' | 'neutral' | 'warning' | 'critical'
 */
export function evaluatePlacementQuality(
  x: number,
  y: number,
  buildingName: string,
  buildings: Building[],
  rules?: ProximityRule[]
): { quality: string; multiplier: number; warnings: string[] } {
  if (!rules || rules.length === 0) {
    return { quality: 'neutral', multiplier: 1, warnings: [] };
  }
  
  const warnings: string[] = [];
  
  // Создаем временное здание для расчета (используем as Building для упрощения)
  const tempBuilding = {
    name: buildingName,
    coord: { x, y },
  } as Building;
  
  // Получаем соседей
  const maxRadius = Math.max(...rules.map(r => r.radius));
  const neighbors = getAdjacentBuildings(x, y, maxRadius, buildings);
  
  // Вычисляем бонусы
  const bonuses = calculateProximityBonus(tempBuilding, neighbors, rules);
  const multiplier = getTotalProximityMultiplier(bonuses);
  
  // Проверяем критичные правила
  for (const rule of rules) {
    if (rule.type === 'required') {
      const matchingNeighbors = neighbors.filter(n => matchesProximityRule(n, rule));
      if (matchingNeighbors.length === 0) {
        warnings.push(`⚠️ ${rule.description}`);
      }
    }
    
    if (rule.type === 'incompatible') {
      const matchingNeighbors = neighbors.filter(n => matchesProximityRule(n, rule));
      if (matchingNeighbors.length > 0) {
        warnings.push(`🚫 ${rule.description}`);
      }
    }
  }
  
  // Определяем качество
  let quality = 'neutral';
  if (warnings.length > 0) {
    quality = 'critical';
  } else if (multiplier >= 1.3) {
    quality = 'optimal';
  } else if (multiplier >= 1.1) {
    quality = 'good';
  } else if (multiplier <= 0.8) {
    quality = 'warning';
  }
  
  return { quality, multiplier, warnings };
}
