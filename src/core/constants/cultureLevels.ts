import { D } from '../math/format';
import type Decimal from 'break_eternity.js';
import type { CultureLevel, HappinessTierInfo } from '../gameTypes.culture';

// ==========================================
// УРОВНИ КУЛЬТУРЫ
// ==========================================

export const CULTURE_LEVELS: CultureLevel[] = [
  {
    level: 1,
    name: 'Примитивная',
    requiredCulture: D(0),
    happinessBonus: 0,
    unlocks: [],
    description: 'Цивилизация только начинает своё развитие. Основные потребности - выживание.',
  },
  {
    level: 2,
    name: 'Развивающаяся',
    requiredCulture: D(1000),
    happinessBonus: 2,
    unlocks: ['park_mk1', 'library_mk1'],
    description: 'Появляются первые культурные институты. Люди начинают ценить искусство.',
  },
  {
    level: 3,
    name: 'Традиционная',
    requiredCulture: D(10000),
    happinessBonus: 5,
    unlocks: ['museum_mk1', 'theater_mk1', 'university_mk1'],
    description: 'Формируются традиции и обычаи. Культура становится частью повседневной жизни.',
  },
  {
    level: 4,
    name: 'Индустриальная',
    requiredCulture: D(50000),
    happinessBonus: 8,
    unlocks: ['stadium_mk1', 'observatory_mk1', 'broadcast_tower_mk1'],
    description: 'Массовая культура и спорт. Технологии расширяют доступ к развлечениям.',
  },
  {
    level: 5,
    name: 'Современная',
    requiredCulture: D(200000),
    happinessBonus: 12,
    unlocks: ['museum_mk2', 'theater_mk2', 'opera_house_mk1', 'monument_mk1'],
    description: 'Расцвет современного искусства. Культурные институты достигают зрелости.',
  },
  {
    level: 6,
    name: 'Цифровая',
    requiredCulture: D(1000000),
    happinessBonus: 16,
    unlocks: ['stadium_mk2', 'university_mk2', 'library_mk2', 'amusement_park_mk1'],
    description: 'Цифровые технологии трансформируют культуру. Виртуальные миры становятся реальностью.',
  },
  {
    level: 7,
    name: 'Пост-Информационная',
    requiredCulture: D(5000000),
    happinessBonus: 20,
    unlocks: ['colosseum_mk1', 'broadcast_tower_mk2', 'observatory_mk2', 'monument_mk2'],
    description: 'Культура выходит за пределы физического мира. Новые формы самовыражения.',
  },
  {
    level: 8,
    name: 'Межзвёздная',
    requiredCulture: D(25000000),
    happinessBonus: 25,
    unlocks: ['museum_mk3', 'park_mk2'],
    description: 'Культурный обмен между звёздными системами. Космические цивилизации объединяются.',
  },
  {
    level: 9,
    name: 'Галактическая',
    requiredCulture: D(100000000),
    happinessBonus: 30,
    unlocks: ['monument_mk3'],
    description: 'Единая галактическая культура. Искусство достигает немыслимых высот.',
  },
  {
    level: 10,
    name: 'Трансцендентная',
    requiredCulture: D(500000000),
    happinessBonus: 50,
    unlocks: [],
    description: 'Культура превосходит материальное существование. Абсолютная гармония духа и разума.',
  },
];

// ==========================================
// УРОВНИ СЧАСТЬЯ
// ==========================================

export const HAPPINESS_TIERS: HappinessTierInfo[] = [
  {
    tier: 'miserable',
    name: 'Несчастны',
    minHappiness: 0,
    maxHappiness: 20,
    productivityMultiplier: 0.7,
    color: '#ff5555', // red-500
    icon: '😢',
  },
  {
    tier: 'discontent',
    name: 'Недовольны',
    minHappiness: 21,
    maxHappiness: 40,
    productivityMultiplier: 0.85,
    color: '#f39c12', // orange-500
    icon: '😕',
  },
  {
    tier: 'neutral',
    name: 'Нейтрально',
    minHappiness: 41,
    maxHappiness: 60,
    productivityMultiplier: 1.0,
    color: '#f1fa8c', // yellow-500
    icon: '😐',
  },
  {
    tier: 'content',
    name: 'Довольны',
    minHappiness: 61,
    maxHappiness: 80,
    productivityMultiplier: 1.15,
    color: '#3ee07f', // green-500
    icon: '🙂',
  },
  {
    tier: 'happy',
    name: 'Счастливы',
    minHappiness: 81,
    maxHappiness: 100,
    productivityMultiplier: 1.3,
    color: '#8be9fd', // blue-500
    icon: '😄',
  },
];

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Get culture level by current culture amount
 */
export function getCultureLevel(culture: Decimal): CultureLevel {
  let result = CULTURE_LEVELS[0];
  for (const level of CULTURE_LEVELS) {
    if (culture.gte(level.requiredCulture)) {
      result = level;
    } else {
      break;
    }
  }
  return result;
}

/**
 * Get culture level by level number
 */
export function getCultureLevelByNumber(levelNumber: number): CultureLevel {
  return CULTURE_LEVELS[Math.min(Math.max(levelNumber - 1, 0), CULTURE_LEVELS.length - 1)];
}

/**
 * Get next culture level (or null if at max)
 */
export function getNextCultureLevel(currentLevel: number): CultureLevel | null {
  if (currentLevel >= CULTURE_LEVELS.length) return null;
  return CULTURE_LEVELS[currentLevel]; // 0-indexed, so level 1 -> index 0, next is index 1
}

/**
 * Calculate progress to next culture level (0-1)
 */
export function getCultureProgress(culture: Decimal, currentLevel: number): number {
  const current = getCultureLevelByNumber(currentLevel);
  const next = getNextCultureLevel(currentLevel);
  
  if (!next) return 1; // Max level
  
  const currentReq = current.requiredCulture;
  const nextReq = next.requiredCulture;
  const diff = nextReq.sub(currentReq);
  
  if (diff.lte(0)) return 1;
  
  const progress = culture.sub(currentReq).div(diff);
  return Math.min(Math.max(progress.toNumber(), 0), 1);
}

/**
 * Get happiness tier by happiness value
 */
export function getHappinessTier(happiness: number): HappinessTierInfo {
  for (const tier of HAPPINESS_TIERS) {
    if (happiness >= tier.minHappiness && happiness <= tier.maxHappiness) {
      return tier;
    }
  }
  // Default to neutral if somehow out of range
  return HAPPINESS_TIERS[2];
}

/**
 * Get productivity multiplier from happiness
 */
export function getHappinessProductivityMultiplier(happiness: number): number {
  const tier = getHappinessTier(happiness);
  
  // Interpolate within the tier for smoother transitions
  const tierRange = tier.maxHappiness - tier.minHappiness;
  const positionInTier = (happiness - tier.minHappiness) / tierRange;
  
  // Find next tier multiplier for interpolation
  const tierIndex = HAPPINESS_TIERS.findIndex(t => t.tier === tier.tier);
  const nextTier = HAPPINESS_TIERS[tierIndex + 1];
  
  if (!nextTier) return tier.productivityMultiplier;
  
  // Linear interpolation between tiers
  const multiplierDiff = nextTier.productivityMultiplier - tier.productivityMultiplier;
  return tier.productivityMultiplier + (multiplierDiff * positionInTier);
}

/**
 * Calculate happiness bonus from culture level
 */
export function getCultureHappinessBonus(cultureLevel: number): number {
  const level = getCultureLevelByNumber(cultureLevel);
  return level.happinessBonus;
}

/**
 * Check if a building is unlocked by culture level
 */
export function isBuildingUnlockedByCulture(buildingType: string, cultureLevel: number): boolean {
  for (let i = 0; i < cultureLevel && i < CULTURE_LEVELS.length; i++) {
    if (CULTURE_LEVELS[i].unlocks.includes(buildingType)) {
      return true;
    }
  }
  return false;
}

/**
 * Get all buildings unlocked at a specific culture level
 */
export function getBuildingsUnlockedAtLevel(level: number): string[] {
  const levelData = getCultureLevelByNumber(level);
  return levelData.unlocks;
}
