import Decimal from 'break_eternity.js';
import type {
  AscensionState,
  AscensionRequirements,
  AscensionMultipliers,
  AscensionUnlocks,
  PrestigeState,
  MegastructuresState,
  MegastructureId,
} from '../gameTypes';
import { MEGASTRUCTURES } from './megastructures';

/**
 * Константы для системы Вознесения (Ascension)
 * Второй уровень престижа, разблокирует бесконечный геймплей
 */

// ============================================================================
// ТРЕБОВАНИЯ ДЛЯ ВОЗНЕСЕНИЯ
// ============================================================================

/**
 * Базовые требования для первого вознесения
 */
export const BASE_ASCENSION_REQUIREMENTS: AscensionRequirements = {
  minPrestigeCount: 10,           // Минимум 10 престижей
  minQuantumPoints: 1_000_000,    // Минимум 1M Quantum Points заработано за все время
  allMegastructures: true,        // Все 4 мегаструктуры должны быть построены
};

/**
 * Проверяет, может ли игрок вознестись
 */
export function canAscend(
  prestige: PrestigeState,
  megastructures: MegastructuresState
): { can: boolean; reason?: string } {
  const reqs = BASE_ASCENSION_REQUIREMENTS;
  
  // Проверка количества престижей
  if (prestige.prestigeCount < reqs.minPrestigeCount) {
    return {
      can: false,
      reason: `Нужно ${reqs.minPrestigeCount} престижей (текущее: ${prestige.prestigeCount})`,
    };
  }
  
  // Проверка Quantum Points
  if (prestige.lifetimeQuantumPoints < reqs.minQuantumPoints) {
    return {
      can: false,
      reason: `Нужно ${reqs.minQuantumPoints.toLocaleString()} QP за все время (текущее: ${prestige.lifetimeQuantumPoints.toLocaleString()})`,
    };
  }
  
  // Проверка мегаструктур
  if (reqs.allMegastructures) {
    const allMegastructureIds = Object.keys(MEGASTRUCTURES) as MegastructureId[];
    const builtCount = allMegastructureIds.filter(id => megastructures.built[id]?.active).length;
    
    if (builtCount < allMegastructureIds.length) {
      return {
        can: false,
        reason: `Нужно построить все мегаструктуры (${builtCount}/${allMegastructureIds.length})`,
      };
    }
  }
  
  return { can: true };
}

// ============================================================================
// ВОЗНЕСЕНИЕ - РАСЧЁТЫ
// ============================================================================

/**
 * Рассчитывает количество Ascension Points (AP), которое получит игрок
 * Формула: AP = floor(sqrt(lifetime_QP / 1_000_000))
 */
export function calculateAscensionPoints(lifetimeQP: number): number {
  if (lifetimeQP < BASE_ASCENSION_REQUIREMENTS.minQuantumPoints) {
    return 0;
  }
  
  // AP = sqrt(QP / 1M)
  const normalized = lifetimeQP / 1_000_000;
  const ap = Math.floor(Math.sqrt(normalized));
  
  return ap;
}

/**
 * Рассчитывает множители на основе количества вознесений
 */
export function calculateAscensionMultipliers(ascensionCount: number): AscensionMultipliers {
  return {
    qpGain: 1 + (ascensionCount * 0.5),              // +50% QP за каждое вознесение
    globalProduction: 1 + (ascensionCount * 0.1),    // +10% производства за каждое вознесение
    researchSpeed: 1 + (ascensionCount * 0.2),       // +20% скорости исследований
    startingCredits: ascensionCount * 1_000_000,     // +1M стартовых кредитов за вознесение
  };
}

/**
 * Определяет разблокировки на основе количества вознесений
 */
export function getAscensionUnlocks(ascensionCount: number): AscensionUnlocks {
  return {
    infiniteResearch: ascensionCount >= 1,      // Разблокируется после 1-го вознесения
    buildingEvolution: ascensionCount >= 2,     // Разблокируется после 2-го вознесения
    proceduralGalaxies: ascensionCount >= 3,    // Разблокируется после 3-го вознесения
  };
}

// ============================================================================
// ASCENSION UPGRADES (Покупаются за Ascension Points)
// ============================================================================

export interface AscensionUpgrade {
  id: string;
  name: string;
  description: string;
  icon: string;
  cost: number;                    // Стоимость в AP
  maxLevel: number;                // Максимальный уровень (0 = бесконечно)
  
  effect: {
    type: 'qp_multiplier' | 'production_multiplier' | 'research_multiplier' | 'unlock';
    value: number;                 // Значение за уровень
  };
}

/**
 * Улучшения, покупаемые за Ascension Points
 */
export const ASCENSION_UPGRADES: Record<string, AscensionUpgrade> = {
  // Базовые множители
  quantum_boost: {
    id: 'quantum_boost',
    name: 'Квантовое Усиление',
    description: 'Увеличивает получение QP на 10% за уровень',
    icon: '✨',
    cost: 1,
    maxLevel: 0, // Бесконечно
    effect: {
      type: 'qp_multiplier',
      value: 0.1,
    },
  },
  
  production_ascension: {
    id: 'production_ascension',
    name: 'Вознесённое Производство',
    description: 'Увеличивает производство всех ресурсов на 5% за уровень',
    icon: '📈',
    cost: 2,
    maxLevel: 0, // Бесконечно
    effect: {
      type: 'production_multiplier',
      value: 0.05,
    },
  },
  
  research_transcendence: {
    id: 'research_transcendence',
    name: 'Трансцендентные Исследования',
    description: 'Увеличивает скорость исследований на 8% за уровень',
    icon: '🔬',
    cost: 2,
    maxLevel: 0, // Бесконечно
    effect: {
      type: 'research_multiplier',
      value: 0.08,
    },
  },
  
  // Разблокировки
  infinite_research_unlock: {
    id: 'infinite_research_unlock',
    name: 'Разблокировать Бесконечные Исследования',
    description: 'Разблокирует систему повторяемых исследований',
    icon: '♾️',
    cost: 5,
    maxLevel: 1,
    effect: {
      type: 'unlock',
      value: 1,
    },
  },
  
  building_evolution_unlock: {
    id: 'building_evolution_unlock',
    name: 'Разблокировать Эволюцию Зданий',
    description: 'Разблокирует систему эволюции зданий',
    icon: '🏗️',
    cost: 10,
    maxLevel: 1,
    effect: {
      type: 'unlock',
      value: 1,
    },
  },
  
  procedural_galaxies_unlock: {
    id: 'procedural_galaxies_unlock',
    name: 'Разблокировать Процедурные Галактики',
    description: 'Разблокирует бесконечные случайно генерируемые галактики',
    icon: '🌌',
    cost: 15,
    maxLevel: 1,
    effect: {
      type: 'unlock',
      value: 1,
    },
  },
};

// ============================================================================
// НАЧАЛЬНОЕ СОСТОЯНИЕ
// ============================================================================

export const INITIAL_ASCENSION_STATE: AscensionState = {
  ascensionCount: 0,
  ascensionPoints: 0,
  lifetimeAscensionPoints: 0,
  requirements: BASE_ASCENSION_REQUIREMENTS,
  multipliers: calculateAscensionMultipliers(0),
  unlocks: getAscensionUnlocks(0),
  stats: {
    totalAscensionTime: 0,
    fastestAscension: 0,
    totalQuantumPointsEarned: 0,
  },
};

// ============================================================================
// ХЕЛПЕРЫ
// ============================================================================

/**
 * Применяет бонусы вознесения к производству
 */
export function applyAscensionProductionBonus(
  baseProduction: Decimal,
  ascensionState: AscensionState
): Decimal {
  return baseProduction.mul(ascensionState.multipliers.globalProduction);
}

/**
 * Применяет бонусы вознесения к скорости исследований
 */
export function applyAscensionResearchBonus(
  baseSpeed: number,
  ascensionState: AscensionState
): number {
  return baseSpeed * ascensionState.multipliers.researchSpeed;
}

/**
 * Применяет бонусы вознесения к получению QP
 */
export function applyAscensionQPBonus(
  baseQP: number,
  ascensionState: AscensionState
): number {
  return Math.floor(baseQP * ascensionState.multipliers.qpGain);
}

/**
 * Получает стартовые кредиты с учётом вознесения
 */
export function getAscensionStartingCredits(ascensionState: AscensionState): Decimal {
  return new Decimal(ascensionState.multipliers.startingCredits);
}

/**
 * Форматирует прогресс до следующего вознесения
 */
export function getAscensionProgress(
  prestige: PrestigeState,
  megastructures: MegastructuresState
): {
  prestigeProgress: number;    // 0-1
  qpProgress: number;          // 0-1
  megastructuresProgress: number; // 0-1
  overallProgress: number;     // 0-1
} {
  const reqs = BASE_ASCENSION_REQUIREMENTS;
  
  const prestigeProgress = Math.min(1, prestige.prestigeCount / reqs.minPrestigeCount);
  const qpProgress = Math.min(1, prestige.lifetimeQuantumPoints / reqs.minQuantumPoints);
  
  const allMegastructureIds = Object.keys(MEGASTRUCTURES) as MegastructureId[];
  const builtCount = allMegastructureIds.filter(id => megastructures.built[id]?.active).length;
  const megastructuresProgress = builtCount / allMegastructureIds.length;
  
  const overallProgress = (prestigeProgress + qpProgress + megastructuresProgress) / 3;
  
  return {
    prestigeProgress,
    qpProgress,
    megastructuresProgress,
    overallProgress,
  };
}

/**
 * Получает описание текущего прогресса вознесения
 */
export function getAscensionRequirementStatus(
  prestige: PrestigeState,
  megastructures: MegastructuresState
): string[] {
  const reqs = BASE_ASCENSION_REQUIREMENTS;
  const status: string[] = [];
  
  // Престижи
  if (prestige.prestigeCount >= reqs.minPrestigeCount) {
    status.push(`✅ Престижи: ${prestige.prestigeCount}/${reqs.minPrestigeCount}`);
  } else {
    status.push(`❌ Престижи: ${prestige.prestigeCount}/${reqs.minPrestigeCount}`);
  }
  
  // Quantum Points
  if (prestige.lifetimeQuantumPoints >= reqs.minQuantumPoints) {
    status.push(`✅ QP за все время: ${prestige.lifetimeQuantumPoints.toLocaleString()}/${reqs.minQuantumPoints.toLocaleString()}`);
  } else {
    status.push(`❌ QP за все время: ${prestige.lifetimeQuantumPoints.toLocaleString()}/${reqs.minQuantumPoints.toLocaleString()}`);
  }
  
  // Мегаструктуры
  const allMegastructureIds = Object.keys(MEGASTRUCTURES) as MegastructureId[];
  const builtCount = allMegastructureIds.filter(id => megastructures.built[id]?.active).length;
  const totalCount = allMegastructureIds.length;
  
  if (builtCount >= totalCount) {
    status.push(`✅ Мегаструктуры: ${builtCount}/${totalCount}`);
  } else {
    status.push(`❌ Мегаструктуры: ${builtCount}/${totalCount}`);
  }
  
  return status;
}
