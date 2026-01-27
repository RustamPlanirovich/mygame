import type Decimal from 'break_eternity.js';
import type { Building } from '../core/gameTypes';
import type { HappinessFactor, HappinessState, HappinessCategory } from '../core/gameTypes.culture';
import { getCultureHappinessBonus, getHappinessTier } from '../core/constants/cultureLevels';
import { CULTURE_BUILDINGS, isCultureBuilding } from '../core/constants/cultureBuildings';
import type { CultureBuildingType } from '../core/gameTypes.culture';

// ==========================================
// КОНСТАНТЫ СЧАСТЬЯ
// ==========================================

// Базовое счастье (без факторов)
export const BASE_HAPPINESS = 50;

// Максимальное и минимальное счастье
export const MIN_HAPPINESS = 0;
export const MAX_HAPPINESS = 100;

// Скорость изменения счастья (в единицах за тик)
export const HAPPINESS_CHANGE_RATE = 0.1;

// ==========================================
// ФАКТОРЫ РАБОТЫ
// ==========================================

interface WorkConditionFactors {
  overclockActive: boolean;       // Overclock активен
  economyModeActive: boolean;     // Экономный режим
  overclockBuildings: number;     // Количество зданий в overclock
  totalBuildings: number;         // Всего зданий
}

/**
 * Calculate work conditions happiness factor
 * Overclock = -20 to -5 based on percentage
 * Economy mode = +5 to +10
 * Normal = 0
 */
export function calculateWorkConditionsFactor(conditions: WorkConditionFactors): HappinessFactor | null {
  const { overclockActive, economyModeActive, overclockBuildings, totalBuildings } = conditions;
  
  if (totalBuildings === 0) return null;
  
  const overclockRatio = overclockBuildings / totalBuildings;
  
  if (overclockActive && overclockRatio > 0) {
    // More overclock = more unhappiness
    const penalty = -5 - (overclockRatio * 15); // -5 to -20
    return {
      id: 'work_overclock',
      source: 'Рабочие условия',
      category: 'work_conditions',
      value: Math.round(penalty),
      description: `Форсированный режим (${Math.round(overclockRatio * 100)}% зданий)`,
      icon: '⚡',
    };
  }
  
  if (economyModeActive) {
    return {
      id: 'work_economy',
      source: 'Рабочие условия',
      category: 'work_conditions',
      value: 5,
      description: 'Экономный режим работы',
      icon: '🌿',
    };
  }
  
  return null;
}

// ==========================================
// ФАКТОРЫ ЭКОЛОГИИ
// ==========================================

interface EcologyFactors {
  pollutionLevel: number;         // 0-100 pollution level
  cleanEnergyRatio: number;       // 0-1 ratio of clean energy
}

/**
 * Calculate ecology happiness factor
 * High pollution = -20
 * Clean energy = +5
 */
export function calculateEcologyFactor(ecology: EcologyFactors): HappinessFactor | null {
  const { pollutionLevel, cleanEnergyRatio } = ecology;
  
  let value = 0;
  let description = '';
  
  // Pollution penalty
  if (pollutionLevel > 80) {
    value -= 20;
    description = 'Критическое загрязнение';
  } else if (pollutionLevel > 60) {
    value -= 15;
    description = 'Высокое загрязнение';
  } else if (pollutionLevel > 40) {
    value -= 8;
    description = 'Среднее загрязнение';
  } else if (pollutionLevel > 20) {
    value -= 3;
    description = 'Низкое загрязнение';
  }
  
  // Clean energy bonus
  if (cleanEnergyRatio > 0.8) {
    value += 5;
    description = description ? `${description}, чистая энергия` : 'Чистая энергия';
  } else if (cleanEnergyRatio > 0.5) {
    value += 2;
    description = description ? `${description}, частично чистая энергия` : 'Частично чистая энергия';
  }
  
  if (value === 0) return null;
  
  return {
    id: 'ecology',
    source: 'Экология',
    category: 'ecology',
    value,
    description,
    icon: value > 0 ? '🌱' : '🏭',
  };
}

// ==========================================
// ФАКТОРЫ ЭКОНОМИКИ
// ==========================================

interface EconomyFactors {
  credits: Decimal;
  creditsPerSecond: Decimal;
  isInDebt: boolean;
}

/**
 * Calculate economy happiness factor
 * Debt = -10
 * Prosperity = +10
 */
export function calculateEconomyFactor(economy: EconomyFactors): HappinessFactor | null {
  const { credits, creditsPerSecond, isInDebt } = economy;
  
  if (isInDebt || credits.lt(0)) {
    return {
      id: 'economy_debt',
      source: 'Экономика',
      category: 'economy',
      value: -10,
      description: 'Долговой кризис',
      icon: '📉',
    };
  }
  
  // High credits = prosperity
  if (credits.gte(1000000) && creditsPerSecond.gt(0)) {
    return {
      id: 'economy_prosperity',
      source: 'Экономика',
      category: 'economy',
      value: 10,
      description: 'Процветающая экономика',
      icon: '💰',
    };
  }
  
  if (credits.gte(100000) && creditsPerSecond.gt(0)) {
    return {
      id: 'economy_stable',
      source: 'Экономика',
      category: 'economy',
      value: 5,
      description: 'Стабильная экономика',
      icon: '📊',
    };
  }
  
  if (credits.lt(1000) && creditsPerSecond.lte(0)) {
    return {
      id: 'economy_poor',
      source: 'Экономика',
      category: 'economy',
      value: -5,
      description: 'Экономические трудности',
      icon: '📉',
    };
  }
  
  return null;
}

// ==========================================
// ФАКТОРЫ ВОЙНЫ
// ==========================================

interface WarfareFactors {
  isUnderAttack: boolean;
  recentDamage: boolean;
  enemyCount: number;
}

/**
 * Calculate warfare happiness factor
 * Under attack = -10 to -30
 */
export function calculateWarfareFactor(warfare: WarfareFactors): HappinessFactor | null {
  const { isUnderAttack, recentDamage, enemyCount } = warfare;
  
  if (!isUnderAttack && enemyCount === 0) return null;
  
  let value = -10;
  let description = 'Угроза нападения';
  
  if (isUnderAttack) {
    value = -20;
    description = 'База под атакой';
  }
  
  if (recentDamage) {
    value = -30;
    description = 'Недавние повреждения от атаки';
  }
  
  return {
    id: 'warfare',
    source: 'Военные действия',
    category: 'warfare',
    value,
    description,
    icon: '⚔️',
  };
}

// ==========================================
// ФАКТОРЫ КУЛЬТУРНЫХ ЗДАНИЙ
// ==========================================

/**
 * Calculate happiness from culture buildings
 */
export function calculateCultureBuildingsFactor(buildings: Building[]): HappinessFactor | null {
  let totalHappiness = 0;
  let buildingCount = 0;
  
  for (const building of buildings) {
    if (isCultureBuilding(building.id)) {
      const cultureDef = CULTURE_BUILDINGS[building.id as CultureBuildingType];
      if (cultureDef) {
        totalHappiness += cultureDef.happinessBonus * building.count;
        buildingCount += building.count;
      }
    }
  }
  
  if (totalHappiness === 0) return null;
  
  return {
    id: 'culture_buildings',
    source: 'Культурные здания',
    category: 'culture',
    value: Math.min(totalHappiness, 50), // Cap at +50
    description: `${buildingCount} культурных зданий`,
    icon: '🏛️',
  };
}

// ==========================================
// ФАКТОРЫ КУЛЬТУРНОГО УРОВНЯ
// ==========================================

/**
 * Calculate happiness from culture level
 */
export function calculateCultureLevelFactor(cultureLevel: number): HappinessFactor | null {
  const bonus = getCultureHappinessBonus(cultureLevel);
  
  if (bonus === 0) return null;
  
  return {
    id: 'culture_level',
    source: 'Уровень культуры',
    category: 'culture',
    value: bonus,
    description: `Культурный уровень ${cultureLevel}`,
    icon: '🎭',
  };
}

// ==========================================
// АГРЕГАЦИЯ ФАКТОРОВ
// ==========================================

export interface HappinessInputs {
  buildings: Building[];
  cultureLevel: number;
  pollutionLevel: number;
  cleanEnergyRatio: number;
  credits: Decimal;
  creditsPerSecond: Decimal;
  isInDebt: boolean;
  isUnderAttack: boolean;
  recentDamage: boolean;
  enemyCount: number;
  overclockActive: boolean;
  economyModeActive: boolean;
  overclockBuildings: number;
  totalBuildings: number;
  temporaryFactors?: HappinessFactor[];
}

/**
 * Calculate all happiness factors and total happiness
 */
export function calculateHappiness(inputs: HappinessInputs): HappinessState {
  const factors: HappinessFactor[] = [];
  
  // Culture level factor
  const cultureLevelFactor = calculateCultureLevelFactor(inputs.cultureLevel);
  if (cultureLevelFactor) factors.push(cultureLevelFactor);
  
  // Culture buildings factor
  const cultureBuildingsFactor = calculateCultureBuildingsFactor(inputs.buildings);
  if (cultureBuildingsFactor) factors.push(cultureBuildingsFactor);
  
  // Work conditions factor
  const workFactor = calculateWorkConditionsFactor({
    overclockActive: inputs.overclockActive,
    economyModeActive: inputs.economyModeActive,
    overclockBuildings: inputs.overclockBuildings,
    totalBuildings: inputs.totalBuildings,
  });
  if (workFactor) factors.push(workFactor);
  
  // Ecology factor
  const ecologyFactor = calculateEcologyFactor({
    pollutionLevel: inputs.pollutionLevel,
    cleanEnergyRatio: inputs.cleanEnergyRatio,
  });
  if (ecologyFactor) factors.push(ecologyFactor);
  
  // Economy factor
  const economyFactor = calculateEconomyFactor({
    credits: inputs.credits,
    creditsPerSecond: inputs.creditsPerSecond,
    isInDebt: inputs.isInDebt,
  });
  if (economyFactor) factors.push(economyFactor);
  
  // Warfare factor
  const warfareFactor = calculateWarfareFactor({
    isUnderAttack: inputs.isUnderAttack,
    recentDamage: inputs.recentDamage,
    enemyCount: inputs.enemyCount,
  });
  if (warfareFactor) factors.push(warfareFactor);
  
  // Add temporary factors
  if (inputs.temporaryFactors) {
    const now = Date.now();
    for (const factor of inputs.temporaryFactors) {
      if (!factor.temporary || !factor.expiresAt || factor.expiresAt > now) {
        factors.push(factor);
      }
    }
  }
  
  // Calculate total
  let totalHappiness = BASE_HAPPINESS;
  for (const factor of factors) {
    totalHappiness += factor.value;
  }
  
  // Clamp to valid range
  totalHappiness = Math.max(MIN_HAPPINESS, Math.min(MAX_HAPPINESS, totalHappiness));
  
  // Get productivity multiplier
  const tier = getHappinessTier(totalHappiness);
  const productivityMultiplier = tier.productivityMultiplier;
  
  return {
    current: totalHappiness,
    factors,
    productivityMultiplier,
    trend: 'stable', // Will be calculated by comparing with previous state
    lastUpdated: Date.now(),
  };
}

/**
 * Calculate trend based on previous and current happiness
 */
export function calculateHappinessTrend(
  previousHappiness: number,
  currentHappiness: number
): 'rising' | 'stable' | 'falling' {
  const diff = currentHappiness - previousHappiness;
  
  if (diff > 1) return 'rising';
  if (diff < -1) return 'falling';
  return 'stable';
}

/**
 * Smooth happiness transition (for animations and gradual changes)
 */
export function smoothHappinessTransition(
  currentHappiness: number,
  targetHappiness: number,
  dt: number
): number {
  const diff = targetHappiness - currentHappiness;
  const change = HAPPINESS_CHANGE_RATE * dt;
  
  if (Math.abs(diff) <= change) {
    return targetHappiness;
  }
  
  return currentHappiness + Math.sign(diff) * change;
}

/**
 * Get happiness summary for UI
 */
export function getHappinessSummary(state: HappinessState): {
  tier: string;
  icon: string;
  color: string;
  productivityBonus: string;
  topPositive: HappinessFactor | null;
  topNegative: HappinessFactor | null;
} {
  const tierInfo = getHappinessTier(state.current);
  
  // Find top positive and negative factors
  let topPositive: HappinessFactor | null = null;
  let topNegative: HappinessFactor | null = null;
  
  for (const factor of state.factors) {
    if (factor.value > 0 && (!topPositive || factor.value > topPositive.value)) {
      topPositive = factor;
    }
    if (factor.value < 0 && (!topNegative || factor.value < topNegative.value)) {
      topNegative = factor;
    }
  }
  
  const productivityBonus = state.productivityMultiplier >= 1
    ? `+${Math.round((state.productivityMultiplier - 1) * 100)}%`
    : `${Math.round((state.productivityMultiplier - 1) * 100)}%`;
  
  return {
    tier: tierInfo.name,
    icon: tierInfo.icon,
    color: tierInfo.color,
    productivityBonus,
    topPositive,
    topNegative,
  };
}

/**
 * Get factors grouped by category
 */
export function getFactorsByCategory(factors: HappinessFactor[]): Record<HappinessCategory, HappinessFactor[]> {
  const result: Record<HappinessCategory, HappinessFactor[]> = {
    culture: [],
    entertainment: [],
    work_conditions: [],
    ecology: [],
    economy: [],
    events: [],
    warfare: [],
  };
  
  for (const factor of factors) {
    result[factor.category].push(factor);
  }
  
  return result;
}
