/**
 * Определения правил близости для различных типов зданий
 */

import type { ProximityRule } from '../gameTypes';

// Правила для энергетических зданий
export const ENERGY_BUILDING_PROXIMITY: Record<string, ProximityRule[]> = {
  'Gas Power Plant': [
    {
      type: 'bonus',
      targetCategory: 'energy',
      radius: 2,
      multiplier: 1.1,
      maxCount: 3,
      description: 'Энергосеть: +10% энергии за каждую соседнюю электростанцию ({count})',
    },
    {
      type: 'bonus',
      targetBuildingType: 'Energy Storage',
      radius: 2,
      multiplier: 1.15,
      maxCount: 2,
      description: 'Энергохранилище рядом: +15% эффективности',
    },
  ],
  
  'Fuel Power Plant': [
    {
      type: 'bonus',
      targetCategory: 'energy',
      radius: 2,
      multiplier: 1.1,
      maxCount: 3,
      description: 'Энергосеть: +10% энергии за каждую соседнюю электростанцию',
    },
  ],
  
  'Solar Panel': [
    {
      type: 'penalty',
      targetCategory: 'production',
      radius: 1,
      multiplier: 0.9,
      maxCount: 4,
      description: 'Затенение: -10% энергии за каждое высокое здание рядом',
    },
  ],
  
  'Energy Storage': [
    {
      type: 'bonus',
      targetCategory: 'energy',
      radius: 2,
      multiplier: 1.2,
      minCount: 2,
      maxCount: 1,
      description: 'Энергетический узел: +20% при 2+ электростанциях рядом',
    },
  ],
};

// Правила для добывающих зданий
export const MINING_PROXIMITY: Record<string, ProximityRule[]> = {
  'Ore Extractor': [
    {
      type: 'bonus',
      targetBuildingType: 'Resource Accelerator',
      radius: 3,
      multiplier: 1.5,
      maxCount: 1,
      description: 'Ускоритель ресурсов: +50% добычи',
    },
    {
      type: 'bonus',
      targetBuildingType: 'Logistics Hub',
      radius: 3,
      multiplier: 1.15,
      maxCount: 1,
      description: 'Логистический центр: +15% эффективности',
    },
  ],
  
  'Ice Harvester': [
    {
      type: 'bonus',
      targetBuildingType: 'Resource Accelerator',
      radius: 3,
      multiplier: 1.5,
      maxCount: 1,
      description: 'Ускоритель ресурсов: +50% добычи',
    },
  ],
  
  'Carbon Scraper': [
    {
      type: 'bonus',
      targetBuildingType: 'Resource Accelerator',
      radius: 3,
      multiplier: 1.5,
      maxCount: 1,
      description: 'Ускоритель ресурсов: +50% добычи',
    },
  ],
  
  'Gas Well': [
    {
      type: 'bonus',
      targetBuildingType: 'Resource Accelerator',
      radius: 3,
      multiplier: 1.5,
      maxCount: 1,
      description: 'Ускоритель ресурсов: +50% добычи',
    },
  ],
  
  'Oil Well': [
    {
      type: 'bonus',
      targetBuildingType: 'Resource Accelerator',
      radius: 3,
      multiplier: 1.5,
      maxCount: 1,
      description: 'Ускоритель ресурсов: +50% добычи',
    },
  ],
};

// Правила для производственных зданий
export const PRODUCTION_PROXIMITY: Record<string, ProximityRule[]> = {
  'Foundry': [
    {
      type: 'bonus',
      targetBuildingType: 'Ore Extractor',
      radius: 3,
      multiplier: 1.15,
      maxCount: 2,
      description: 'Шахта рядом: +15% переработки за каждую',
    },
    {
      type: 'bonus',
      targetBuildingType: 'Cooling System',
      radius: 2,
      multiplier: 1.25,
      maxCount: 1,
      description: 'Система охлаждения: +25% производства',
    },
  ],
  
  'Chemical Plant': [
    {
      type: 'bonus',
      targetCategory: 'production',
      radius: 2,
      multiplier: 1.1,
      maxCount: 3,
      description: 'Промышленная зона: +10% за завод рядом',
    },
    {
      type: 'incompatible',
      targetCategory: 'research',
      radius: 3,
      multiplier: 0,
      description: '⚠️ Химический завод нельзя строить рядом с исследовательскими зданиями',
    },
  ],
  
  'Semiconductor Factory': [
    {
      type: 'required',
      targetBuildingType: 'Cooling System',
      radius: 2,
      multiplier: 0,
      description: '⚠️ Требуется система охлаждения в радиусе 2 клеток',
    },
    {
      type: 'bonus',
      targetBuildingType: 'Cooling System',
      radius: 2,
      multiplier: 1.3,
      maxCount: 2,
      description: 'Охлаждение: +30% производства за систему',
    },
  ],
};

// Правила для специальных зданий
export const SPECIAL_PROXIMITY: Record<string, ProximityRule[]> = {
  'Resource Accelerator': [
    {
      type: 'bonus',
      targetCategory: 'mining',
      radius: 3,
      multiplier: 1.2,
      minCount: 3,
      maxCount: 1,
      description: 'Зона действия: +20% при 3+ шахтах в радиусе',
    },
  ],
  
  'Warehouse': [
    {
      type: 'bonus',
      targetCategory: 'production',
      radius: 3,
      multiplier: 1.1,
      maxCount: 5,
      description: 'Складская логистика: +10% за производственное здание рядом',
    },
  ],
  
  'Logistics Hub': [
    {
      type: 'bonus',
      targetCategory: 'mining',
      radius: 4,
      multiplier: 1.15,
      maxCount: 5,
      description: 'Оптимизация транспорта: +15% добычи',
    },
    {
      type: 'bonus',
      targetCategory: 'production',
      radius: 4,
      multiplier: 1.15,
      maxCount: 5,
      description: 'Оптимизация транспорта: +15% производства',
    },
  ],
  
  'Bitcoin Farm': [
    {
      type: 'required',
      targetBuildingType: 'Nuclear Power Plant',
      radius: 4,
      multiplier: 0,
      description: '⚠️ Требуется атомная электростанция поблизости',
    },
    {
      type: 'bonus',
      targetBuildingType: 'Cooling System',
      radius: 2,
      multiplier: 1.4,
      maxCount: 3,
      description: 'Охлаждение: +40% добычи за систему',
    },
  ],
  
  'Cooling System': [
    {
      type: 'bonus',
      targetCategory: 'production',
      radius: 2,
      multiplier: 1.15,
      minCount: 2,
      maxCount: 1,
      description: 'Промышленное охлаждение: +15% при 2+ зданиях рядом',
    },
  ],
  
  'Trash Recycler': [
    {
      type: 'bonus',
      targetCategory: 'production',
      radius: 3,
      multiplier: 1.1,
      maxCount: 5,
      description: 'Переработка отходов: +10% за завод рядом',
    },
  ],
};

// Правила для военных зданий
export const MILITARY_PROXIMITY: Record<string, ProximityRule[]> = {
  'Turret': [
    {
      type: 'bonus',
      targetBuildingType: 'Radar Factory',
      radius: 3,
      multiplier: 1.25,
      maxCount: 2,
      description: 'Наведение радаром: +25% урона',
    },
    {
      type: 'bonus',
      targetBuildingType: 'Turret',
      radius: 2,
      multiplier: 1.1,
      maxCount: 3,
      description: 'Перекрестный огонь: +10% урона за турель',
    },
  ],
};

// Правила для космических зданий
export const SPACE_PROXIMITY: Record<string, ProximityRule[]> = {
  'Rocket Factory': [
    {
      type: 'bonus',
      targetCategory: 'space',
      radius: 2,
      multiplier: 1.15,
      maxCount: 4,
      description: 'Космический комплекс: +15% за здание',
    },
  ],
  
  'Spaceship Factory': [
    {
      type: 'bonus',
      targetCategory: 'space',
      radius: 2,
      multiplier: 1.2,
      maxCount: 4,
      description: 'Космическая верфь: +20% за здание',
    },
  ],
  
  'Space Colony': [
    {
      type: 'bonus',
      targetCategory: 'space',
      radius: 3,
      multiplier: 1.25,
      minCount: 3,
      maxCount: 1,
      description: 'Космопорт: +25% при 3+ космических зданий',
    },
  ],
};

// Объединенный экспорт всех правил
export const ALL_PROXIMITY_RULES: Record<string, ProximityRule[]> = {
  ...ENERGY_BUILDING_PROXIMITY,
  ...MINING_PROXIMITY,
  ...PRODUCTION_PROXIMITY,
  ...SPECIAL_PROXIMITY,
  ...MILITARY_PROXIMITY,
  ...SPACE_PROXIMITY,
};

/**
 * Получить правила близости для здания по имени
 */
export function getProximityRulesForBuilding(buildingName: string): ProximityRule[] | undefined {
  return ALL_PROXIMITY_RULES[buildingName];
}
