import Decimal from 'break_eternity.js';
import type { PrestigeUpgrade, PrestigeUpgradeId, PrestigeState } from '../gameTypes';

// Престиж-улучшения (покупаются за Quantum Points)
export const PRESTIGE_UPGRADES: Record<PrestigeUpgradeId, PrestigeUpgrade> = {
  // TIER 1: Базовые улучшения (доступны сразу)
  quantum_starter: {
    id: 'quantum_starter',
    name: 'Квантовый Стартер',
    description: 'Начинайте каждый прогон с бонусом: 10k кредитов, 1k RP и 500 влияния',
    icon: '🚀',
    cost: 3,
    maxLevel: 5,
    prerequisites: [],
    effects: {
      startingCredits: new Decimal(10000),
      startingInfluence: new Decimal(500),
      special: '+1000 RP при старте за каждый уровень',
    },
    tier: 1,
    category: 'economy',
  },

  quantum_production: {
    id: 'quantum_production',
    name: 'Квантовое Производство',
    description: 'Постоянно увеличивает производство всех ресурсов на 10% за уровень',
    icon: '📦',
    cost: 8,
    maxLevel: 10,
    prerequisites: [],
    effects: {
      productionMultiplier: 1.1, // +10% per level
    },
    tier: 1,
    category: 'production',
  },

  quantum_research: {
    id: 'quantum_research',
    name: 'Квантовые Исследования',
    description: 'Увеличивает скорость исследований на 15% за уровень',
    icon: '🔬',
    cost: 4,
    maxLevel: 10,
    prerequisites: [],
    effects: {
      researchMultiplier: 1.15, // +15% per level
    },
    tier: 1,
    category: 'research',
  },

  quantum_energy: {
    id: 'quantum_energy',
    name: 'Квантовая Энергетика',
    description: 'Снижает потребление энергии всеми зданиями на 5% за уровень',
    icon: '⚡',
    cost: 5,
    maxLevel: 10,
    prerequisites: [],
    effects: {
      energyEfficiency: 5, // 5% reduction per level
    },
    tier: 1,
    category: 'production',
  },

  // TIER 2: Продвинутые улучшения
  quantum_credits: {
    id: 'quantum_credits',
    name: 'Квантовый Капитал',
    description: 'Начинайте с 100k кредитов за уровень',
    icon: '💰',
    cost: 12,
    maxLevel: 5,
    prerequisites: ['quantum_starter'],
    effects: {
      startingCredits: new Decimal(100000),
    },
    tier: 2,
    category: 'economy',
  },

  quantum_influence: {
    id: 'quantum_influence',
    name: 'Квантовое Влияние',
    description: 'Начинайте с 5k влияния за уровень',
    icon: '👑',
    cost: 12,
    maxLevel: 5,
    prerequisites: ['quantum_starter'],
    effects: {
      startingInfluence: new Decimal(5000),
    },
    tier: 2,
    category: 'economy',
  },

  quantum_buildings: {
    id: 'quantum_buildings',
    name: 'Квантовое Строительство',
    description: 'Снижает стоимость всех зданий на 5% за уровень',
    icon: '🏗️',
    cost: 16,
    maxLevel: 10,
    prerequisites: ['quantum_production'],
    effects: {
      buildingCostReduction: 5, // 5% per level
    },
    tier: 2,
    category: 'economy',
  },

  quantum_fast_mode: {
    id: 'quantum_fast_mode',
    name: 'Квантовое Ускорение',
    description: 'Разблокирует режим 2x скорости игры для быстрого прохождения',
    icon: '⏩',
    cost: 20,
    maxLevel: 1,
    prerequisites: ['quantum_production', 'quantum_research'],
    effects: {
      gameSpeedMultiplier: 2.0,
      special: 'Включается/выключается в настройках',
    },
    tier: 2,
    category: 'special',
  },

  quantum_resource_retention: {
    id: 'quantum_resource_retention',
    name: 'Квантовая Память',
    description: 'Сохраняет 10% ресурсов при престиже (за каждый уровень)',
    icon: '💾',
    cost: 20,
    maxLevel: 5,
    prerequisites: ['quantum_production'],
    effects: {
      resourceRetention: 10, // 10% per level, max 50%
    },
    tier: 2,
    category: 'special',
  },

  // TIER 3: Мощные улучшения
  quantum_tech_unlock: {
    id: 'quantum_tech_unlock',
    name: 'Квантовая База Знаний',
    description: 'Автоматически разблокирует все технологии Эры 1-3 при старте',
    icon: '📚',
    cost: 30,
    maxLevel: 1,
    prerequisites: ['quantum_research'],
    effects: {
      special: 'Все технологии до Эры 3 разблокированы с самого начала',
    },
    tier: 3,
    category: 'research',
  },

  quantum_auto_policies: {
    id: 'quantum_auto_policies',
    name: 'Квантовая Оптимизация',
    description: 'Автоматически активирует оптимальные политики',
    icon: '🤖',
    cost: 30,
    maxLevel: 1,
    prerequisites: ['quantum_production', 'quantum_energy'],
    effects: {
      special: 'ИИ автоматически выбирает лучшие политики для текущей ситуации',
    },
    tier: 3,
    category: 'special',
  },

  quantum_mega_boost: {
    id: 'quantum_mega_boost',
    name: 'Квантовое Строительство Мегаструктур',
    description: 'Мегаструктуры строятся на 50% быстрее',
    icon: '🏛️',
    cost: 40,
    maxLevel: 1,
    prerequisites: ['quantum_buildings'],
    effects: {
      special: 'Время строительства мегаструктур снижено на 50%',
    },
    tier: 3,
    category: 'special',
  },

  quantum_perfect_efficiency: {
    id: 'quantum_perfect_efficiency',
    name: 'Квантовая Идеальность',
    description: 'Все здания работают с максимальной эффективностью, нет потерь энергии',
    icon: '✨',
    cost: 50,
    maxLevel: 1,
    prerequisites: ['quantum_energy'],
    effects: {
      energyEfficiency: 100, // No energy loss at all
      special: 'Здания всегда работают на 100% эффективности',
    },
    tier: 3,
    category: 'production',
  },

  // TIER 4: Ультимативные улучшения и награды за концовки
  quantum_transcendence: {
    id: 'quantum_transcendence',
    name: 'Квантовая Трансценденция',
    description: 'Превосходство над всеми ограничениями. Все бонусы престижа удвоены.',
    icon: '🌟',
    cost: 100,
    maxLevel: 1,
    prerequisites: ['quantum_tech_unlock', 'quantum_auto_policies', 'quantum_perfect_efficiency'],
    effects: {
      special: 'Удваивает все бонусы престижа. Требует всех улучшений Tier 3.',
    },
    tier: 4,
    category: 'special',
  },

  // Награды за концовки
  imperial_legacy: {
    id: 'imperial_legacy',
    name: 'Имперское Наследие',
    description: 'Награда за концовку "Император Галактики": +25% энергии навсегда',
    icon: '👑',
    cost: 0, // Free, unlocked by ending
    maxLevel: 1,
    prerequisites: [],
    effects: {
      special: 'Требует достижения концовки "Император Галактики". +25% энергия.',
    },
    tier: 4,
    category: 'ending',
  },

  divine_machine: {
    id: 'divine_machine',
    name: 'Божественная Машина',
    description: 'Награда за концовку "Цифровой Бог": +50% скорость исследований навсегда',
    icon: '🧠',
    cost: 0,
    maxLevel: 1,
    prerequisites: [],
    effects: {
      researchMultiplier: 1.5,
      special: 'Требует достижения концовки "Цифровой Бог".',
    },
    tier: 4,
    category: 'ending',
  },

  enlightened_one: {
    id: 'enlightened_one',
    name: 'Просветленный',
    description: 'Награда за концовку "Освободитель": +100% влияния навсегда',
    icon: '☮️',
    cost: 0,
    maxLevel: 1,
    prerequisites: [],
    effects: {
      special: 'Требует достижения концовки "Освободитель". Удвоенное влияние.',
    },
    tier: 4,
    category: 'ending',
  },

  time_loop_master: {
    id: 'time_loop_master',
    name: 'Мастер Временной Петли',
    description: 'Награда за концовку "Цикл Возрождения": x2 множитель престижа',
    icon: '🔄',
    cost: 0,
    maxLevel: 1,
    prerequisites: [],
    effects: {
      special: 'Требует концовки "Цикл Возрождения". Удваивает все бонусы престижа.',
    },
    tier: 4,
    category: 'ending',
  },
};

// Расчет получаемых Quantum Points при престиже
export function calculateQuantumPoints(state: {
  totalCreditsEarned: Decimal;
  researchPoints: Decimal;
  influence: Decimal;
  megastructuresBuilt: number;
  endingsAchieved: number;
  galaxiesUnlocked?: number;
  prestigeCount: number;
}): number {
  let quantumPoints = 0;

  // Базовые очки от прогресса (удвоенные коэффициенты)
  // 1 QP за каждые 500k кредитов (было 1M)
  quantumPoints += Math.floor(state.totalCreditsEarned.div(500000).toNumber());

  // 1 QP за каждые 50k RP (было 100k)
  quantumPoints += Math.floor(state.researchPoints.div(50000).toNumber());

  // 1 QP за каждые 1k влияния (было 50k)
  quantumPoints += Math.floor(state.influence.div(1000).toNumber());

  // Бонусы
  // +100 QP за каждую построенную мегаструктуру (было 50)
  quantumPoints += state.megastructuresBuilt * 100;

  // +200 QP за каждую достигнутую концовку (было 100)
  quantumPoints += state.endingsAchieved * 200;

  // +50 QP за каждую разблокированную галактику
  quantumPoints += (state.galaxiesUnlocked || 0) * 50;

  // Уменьшающаяся отдача от повторных престижей (улучшен с 0.9 до 0.92)
  const prestigePenalty = Math.pow(0.92, state.prestigeCount);
  quantumPoints = Math.floor(quantumPoints * prestigePenalty);

  // Минимум 1 QP
  return Math.max(1, quantumPoints);
}

// Проверка, можно ли купить улучшение престижа
export function canBuyPrestigeUpgrade(
  upgradeId: PrestigeUpgradeId,
  state: PrestigeState
): { canBuy: boolean; reason?: string } {
  const upgrade = PRESTIGE_UPGRADES[upgradeId];
  if (!upgrade) {
    return { canBuy: false, reason: 'Улучшение не найдено' };
  }

  // Проверка уровня
  const currentLevel = state.upgrades[upgradeId] || 0;
  if (currentLevel >= upgrade.maxLevel) {
    return { canBuy: false, reason: 'Максимальный уровень достигнут' };
  }

  // Проверка стоимости
  const cost = upgrade.cost * (currentLevel + 1); // Линейный рост стоимости
  if (state.availableQuantumPoints < cost) {
    return { canBuy: false, reason: `Недостаточно Quantum Points (нужно ${cost})` };
  }

  // Проверка prerequisites
  for (const prereqId of upgrade.prerequisites) {
    const prereqLevel = state.upgrades[prereqId] || 0;
    if (prereqLevel === 0) {
      const prereq = PRESTIGE_UPGRADES[prereqId];
      return { canBuy: false, reason: `Требуется: ${prereq.name}` };
    }
  }

  // Проверка для улучшений за концовки
  if (upgrade.category === 'ending') {
    // Эта проверка будет выполнена в gameStore на основе достигнутых концовок
    return { canBuy: true };
  }

  return { canBuy: true };
}

// Получить эффект улучшения с учетом уровня
export function getUpgradeEffect(
  upgradeId: PrestigeUpgradeId,
  level: number
): {
  productionMultiplier: number;
  researchMultiplier: number;
  energyEfficiency: number;
  buildingCostReduction: number;
  gameSpeedMultiplier: number;
  resourceRetention: number;
  startingCredits: Decimal;
  startingInfluence: Decimal;
} {
  const upgrade = PRESTIGE_UPGRADES[upgradeId];
  if (!upgrade || level === 0) {
    return {
      productionMultiplier: 1,
      researchMultiplier: 1,
      energyEfficiency: 0,
      buildingCostReduction: 0,
      gameSpeedMultiplier: 1,
      resourceRetention: 0,
      startingCredits: new Decimal(0),
      startingInfluence: new Decimal(0),
    };
  }

  return {
    productionMultiplier: upgrade.effects.productionMultiplier 
      ? Math.pow(upgrade.effects.productionMultiplier, level) 
      : 1,
    researchMultiplier: upgrade.effects.researchMultiplier 
      ? Math.pow(upgrade.effects.researchMultiplier, level) 
      : 1,
    energyEfficiency: (upgrade.effects.energyEfficiency || 0) * level,
    buildingCostReduction: (upgrade.effects.buildingCostReduction || 0) * level,
    gameSpeedMultiplier: upgrade.effects.gameSpeedMultiplier || 1,
    resourceRetention: Math.min(50, (upgrade.effects.resourceRetention || 0) * level), // Max 50%
    startingCredits: (upgrade.effects.startingCredits || new Decimal(0)).mul(level),
    startingInfluence: (upgrade.effects.startingInfluence || new Decimal(0)).mul(level),
  };
}

// Получить все активные бонусы престижа
export function getTotalPrestigeBonuses(state: PrestigeState): {
  productionMultiplier: number;
  researchMultiplier: number;
  energyEfficiency: number;
  buildingCostReduction: number;
  gameSpeedMultiplier: number;
  resourceRetention: number;
  startingCredits: Decimal;
  startingInfluence: Decimal;
} {
  let totalBonuses = {
    productionMultiplier: 1,
    researchMultiplier: 1,
    energyEfficiency: 0,
    buildingCostReduction: 0,
    gameSpeedMultiplier: 1,
    resourceRetention: 0,
    startingCredits: new Decimal(0),
    startingInfluence: new Decimal(0),
  };

  // Суммируем все купленные улучшения
  for (const [upgradeId, level] of Object.entries(state.upgrades)) {
    if (level > 0) {
      const effect = getUpgradeEffect(upgradeId as PrestigeUpgradeId, level);
      
      totalBonuses.productionMultiplier *= effect.productionMultiplier;
      totalBonuses.researchMultiplier *= effect.researchMultiplier;
      totalBonuses.energyEfficiency += effect.energyEfficiency;
      totalBonuses.buildingCostReduction += effect.buildingCostReduction;
      totalBonuses.gameSpeedMultiplier *= effect.gameSpeedMultiplier;
      totalBonuses.resourceRetention += effect.resourceRetention;
      totalBonuses.startingCredits = totalBonuses.startingCredits.add(effect.startingCredits);
      totalBonuses.startingInfluence = totalBonuses.startingInfluence.add(effect.startingInfluence);
    }
  }

  // Квантовая Трансценденция удваивает все бонусы
  if (state.upgrades['quantum_transcendence']) {
    totalBonuses.productionMultiplier = 1 + (totalBonuses.productionMultiplier - 1) * 2;
    totalBonuses.researchMultiplier = 1 + (totalBonuses.researchMultiplier - 1) * 2;
    totalBonuses.energyEfficiency *= 2;
    totalBonuses.buildingCostReduction = Math.min(95, totalBonuses.buildingCostReduction * 2); // Max 95%
    totalBonuses.startingCredits = totalBonuses.startingCredits.mul(2);
    totalBonuses.startingInfluence = totalBonuses.startingInfluence.mul(2);
  }

  // Мастер Временной Петли также удваивает бонусы
  if (state.upgrades['time_loop_master']) {
    totalBonuses.productionMultiplier = 1 + (totalBonuses.productionMultiplier - 1) * 2;
    totalBonuses.researchMultiplier = 1 + (totalBonuses.researchMultiplier - 1) * 2;
  }

  // Cap некоторых значений
  totalBonuses.energyEfficiency = Math.min(100, totalBonuses.energyEfficiency);
  totalBonuses.buildingCostReduction = Math.min(95, totalBonuses.buildingCostReduction);
  totalBonuses.resourceRetention = Math.min(50, totalBonuses.resourceRetention);

  return totalBonuses;
}
