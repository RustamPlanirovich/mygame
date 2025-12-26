import type { RepeatableResearch, RepeatableResearchId } from '../gameTypes';

/**
 * Повторяемые исследования (Repeatable Research)
 * Разблокируются после первого Ascension
 * Могут быть улучшены бесконечно, но есть лимит за одно прохождение
 */

export const REPEATABLE_RESEARCHES: Record<RepeatableResearchId, RepeatableResearch> = {
  automation_efficiency: {
    id: 'automation_efficiency',
    name: 'Эффективность Автоматизации',
    description: 'Улучшает эффективность всех автоматических процессов',
    icon: '⚡',
    currentLevel: 0,
    maxLevelPerAscension: 100,
    baseCost: {
      credits: 1_000_000,
    },
    costScaling: 1.5,
    effect: {
      type: 'production',
      valuePerLevel: 0.02,
    },
    effectType: 'percentage',
    valuePerLevel: 0.02,
  },

  quantum_computing: {
    id: 'quantum_computing',
    name: 'Квантовые Вычисления',
    description: 'Увеличивает получение Quantum Points при престиже',
    icon: '💎',
    currentLevel: 0,
    maxLevelPerAscension: 100,
    baseCost: {
      quantumPoints: 500_000,
    },
    costScaling: 1.5,
    effect: {
      type: 'speed',
      valuePerLevel: 0.03,
    },
    effectType: 'percentage',
    valuePerLevel: 0.03,
  },

  matter_compression: {
    id: 'matter_compression',
    name: 'Сжатие Материи',
    description: 'Увеличивает производство всех базовых ресурсов',
    icon: '🗜️',
    currentLevel: 0,
    maxLevelPerAscension: 100,
    baseCost: {
      iron: 10_000_000,
      copper: 5_000_000,
      silicon: 1_000_000,
    },
    costScaling: 1.5,
    effect: {
      type: 'capacity',
      valuePerLevel: 0.01,
    },
    effectType: 'percentage',
    valuePerLevel: 0.01,
  },

  energy_optimization: {
    id: 'energy_optimization',
    name: 'Оптимизация Энергии',
    description: 'Снижает потребление энергии всеми зданиями',
    icon: '⚙️',
    currentLevel: 0,
    maxLevelPerAscension: 100,
    baseCost: {
      energy: 50_000_000,
    },
    costScaling: 1.5,
    effect: {
      type: 'efficiency',
      valuePerLevel: 0.01,
    },
    effectType: 'percentage',
    valuePerLevel: 0.01,
  },

  // Повторяемое исследование #5
  neural_networks: {
    id: 'neural_networks',
    name: 'Нейронные Сети',
    description: 'Увеличивает скорость обычных исследований из дерева',
    icon: '🧠',
    currentLevel: 0,
    maxLevelPerAscension: 100,
    baseCost: {
      data: 100_000,
      credits: 1_000_000,
    },
    costScaling: 1.5,
    effect: {
      type: 'speed',
      valuePerLevel: 0.02,
    },
    effectType: 'percentage',
    valuePerLevel: 0.02,
  },

  dark_matter_manipulation: {
    id: 'dark_matter_manipulation',
    name: 'Манипуляция Темной Материей',
    description: 'Увеличивает производство экзотических ресурсов',
    icon: '🌌',
    currentLevel: 0,
    maxLevelPerAscension: 100,
    baseCost: {
      darkMatter: 10_000,
      antimatter: 1_000_000,
    },
    costScaling: 1.5,
    effect: {
      type: 'production',
      valuePerLevel: 0.015,
    },
    effectType: 'percentage',
    valuePerLevel: 0.015,
  },
};

/**
 * Рассчитывает стоимость следующего уровня повторяемого исследования
 */
export function calculateRepeatableResearchCost(
  researchId: RepeatableResearchId,
  currentLevel: number
): Record<string, number> {
  const research = REPEATABLE_RESEARCHES[researchId];
  const cost: Record<string, number> = {};

  for (const [resource, baseAmount] of Object.entries(research.baseCost)) {
    const scaledCost = baseAmount * Math.pow(research.costScaling, currentLevel);
    cost[resource] = Math.floor(scaledCost);
  }

  return cost;
}

/**
 * Рассчитывает общий бонус от всех уровней повторяемого исследования
 */
export function getRepeatableResearchBonus(
  researchId: RepeatableResearchId,
  currentLevel: number
): number {
  const research = REPEATABLE_RESEARCHES[researchId];
  return research.effect.valuePerLevel * currentLevel;
}

/**
 * Проверяет, может ли игрок купить следующий уровень повторяемого исследования
 */
export function canResearchRepeatable(
  researchId: RepeatableResearchId,
  currentLevel: number,
  resources: Record<string, any>,
  unlocked: boolean
): { canResearch: boolean; reason?: string } {
  if (!unlocked) {
    return {
      canResearch: false,
      reason: 'Разблокируется после первого Ascension',
    };
  }

  const research = REPEATABLE_RESEARCHES[researchId];

  // Проверка максимального уровня за одно прохождение
  if (currentLevel >= research.maxLevelPerAscension) {
    return {
      canResearch: false,
      reason: `Максимум ${research.maxLevelPerAscension} уровней за одно Ascension`,
    };
  }

  // Проверка стоимости
  const cost = calculateRepeatableResearchCost(researchId, currentLevel);
  for (const [resource, amount] of Object.entries(cost)) {
    if (!resources[resource] || resources[resource].amount < amount) {
      return {
        canResearch: false,
        reason: `Недостаточно ресурсов`,
      };
    }
  }

  return { canResearch: true };
}

/**
 * Возвращает общие бонусы от всех повторяемых исследований
 */
export function getTotalRepeatableBonuses(researches: Partial<Record<RepeatableResearchId, number>>): {
  productionMultiplier: number;
  researchSpeedMultiplier: number;
  capacityMultiplier: number;
  efficiencyMultiplier: number;
} {
  let productionBonus = 0;
  let researchSpeedBonus = 0;
  let capacityBonus = 0;
  let efficiencyBonus = 0;

  for (const [researchId, level] of Object.entries(researches) as [RepeatableResearchId, number][]) {
    const research = REPEATABLE_RESEARCHES[researchId];
    const bonus = getRepeatableResearchBonus(researchId, level);

    switch (research.effect.type) {
      case 'production':
        productionBonus += bonus;
        break;
      case 'speed':
        researchSpeedBonus += bonus;
        break;
      case 'capacity':
        capacityBonus += bonus;
        break;
      case 'efficiency':
        efficiencyBonus += bonus;
        break;
    }
  }

  return {
    productionMultiplier: 1 + productionBonus,
    researchSpeedMultiplier: 1 + researchSpeedBonus,
    capacityMultiplier: 1 + capacityBonus,
    efficiencyMultiplier: 1 + efficiencyBonus,
  };
}
