import Decimal from 'break_eternity.js';
import type { 
  Artifact, 
  ArtifactRarity, 
  ArtifactSource, 
  ArtifactEffect,
  ArtifactEffectType,
  ArtifactRarityConfig,
  ResourceType 
} from '../core/gameTypes';

// ============================================================================
// RARITY CONFIGURATIONS
// ============================================================================

export const ARTIFACT_RARITY_CONFIGS: Record<ArtifactRarity, ArtifactRarityConfig> = {
  common: {
    color: '#9CA3AF',      // Gray
    effectRange: [5, 15],  // 5-15% effect
    slots: 1,
    dropRate: 45,          // 45% chance
    baseCost: 1_000_000,
  },
  rare: {
    color: '#3B82F6',      // Blue
    effectRange: [15, 30],
    slots: 1,
    dropRate: 30,          // 30% chance
    baseCost: 5_000_000,
  },
  epic: {
    color: '#8B5CF6',      // Purple
    effectRange: [30, 50],
    slots: 2,
    dropRate: 15,          // 15% chance
    baseCost: 25_000_000,
  },
  legendary: {
    color: '#F59E0B',      // Orange
    effectRange: [50, 100],
    slots: 2,
    dropRate: 8,           // 8% chance
    baseCost: 100_000_000,
  },
  mythic: {
    color: '#EF4444',      // Red
    effectRange: [100, 200],
    slots: 3,
    dropRate: 2,           // 2% chance
    baseCost: 500_000_000,
  },
};

// ============================================================================
// ARTIFACT NAMES AND DESCRIPTIONS
// ============================================================================

const ARTIFACT_TEMPLATES = [
  // Production artifacts
  { 
    name: 'Квантовый Ускоритель', 
    effect: 'globalProduction' as ArtifactEffectType,
    desc: 'Увеличивает производство всех ресурсов'
  },
  { 
    name: 'Материализатор Энергии', 
    effect: 'energyCapacity' as ArtifactEffectType,
    desc: 'Увеличивает максимальную энергию'
  },
  { 
    name: 'Нанокатализатор', 
    effect: 'buildingEfficiency' as ArtifactEffectType,
    desc: 'Повышает эффективность зданий'
  },
  // Logistics artifact - снижение штрафов дальности
  {
    name: 'Логистические Дроны',
    effect: 'logisticsPenaltyReduction' as ArtifactEffectType,
    desc: 'Автономные дроны снижают штрафы за дальность зданий'
  },
  {
    name: 'Телепортационная Сеть',
    effect: 'logisticsPenaltyReduction' as ArtifactEffectType,
    desc: 'Мгновенная телепортация ресурсов убирает ограничения дальности'
  },
  // Research artifacts
  { 
    name: 'Кристалл Познания', 
    effect: 'researchSpeed' as ArtifactEffectType,
    desc: 'Ускоряет научные исследования'
  },
  { 
    name: 'Реликт Древних', 
    effect: 'researchSpeed' as ArtifactEffectType,
    desc: 'Древние знания ускоряют прогресс'
  },
  // Combat artifacts
  { 
    name: 'Плазменный Сердечник', 
    effect: 'combatPower' as ArtifactEffectType,
    desc: 'Увеличивает боевую мощь флота'
  },
  { 
    name: 'Защитное Поле', 
    effect: 'combatPower' as ArtifactEffectType,
    desc: 'Усиливает оборону'
  },
  // Prestige artifacts
  { 
    name: 'Квантовый Осколок', 
    effect: 'prestigeGain' as ArtifactEffectType,
    desc: 'Увеличивает получение Квантовых Очков'
  },
  { 
    name: 'Сингулярность', 
    effect: 'ascensionPoints' as ArtifactEffectType,
    desc: 'Усиливает получение Очков Вознесения'
  },
  // Exploration artifacts
  { 
    name: 'Карта Звёзд', 
    effect: 'galaxyUnlockCost' as ArtifactEffectType,
    desc: 'Снижает стоимость открытия галактик'
  },
  { 
    name: 'Навигационный Маяк', 
    effect: 'expeditionSuccess' as ArtifactEffectType,
    desc: 'Повышает шанс успеха экспедиций'
  },
];

// ============================================================================
// ARTIFACT GENERATION
// ============================================================================

/**
 * Determines artifact rarity based on drop rates
 */
export function rollArtifactRarity(): ArtifactRarity {
  const roll = Math.random() * 100;
  let cumulative = 0;
  
  const rarities: ArtifactRarity[] = ['mythic', 'legendary', 'epic', 'rare', 'common'];
  
  for (const rarity of rarities) {
    cumulative += ARTIFACT_RARITY_CONFIGS[rarity].dropRate;
    if (roll < cumulative) {
      return rarity;
    }
  }
  
  return 'common'; // Fallback
}

/**
 * Generates a random artifact effect value within rarity range
 */
export function generateEffectValue(rarity: ArtifactRarity): number {
  const config = ARTIFACT_RARITY_CONFIGS[rarity];
  const [min, max] = config.effectRange;
  return min + Math.random() * (max - min);
}

/**
 * Generates a new artifact
 */
export function generateArtifact(
  source: ArtifactSource,
  forcedRarity?: ArtifactRarity,
  bonusMultiplier: number = 1
): Artifact {
  const rarity = forcedRarity || rollArtifactRarity();
  const config = ARTIFACT_RARITY_CONFIGS[rarity];
  
  // Pick random template
  const template = ARTIFACT_TEMPLATES[Math.floor(Math.random() * ARTIFACT_TEMPLATES.length)];
  
  // Generate effects (1-2 effects for common/rare, 2-3 for epic+)
  const effectCount = rarity === 'common' || rarity === 'rare' ? 
    (Math.random() < 0.7 ? 1 : 2) : 
    (Math.random() < 0.5 ? 2 : 3);
  
  const effects: ArtifactEffect[] = [];
  const usedEffects = new Set<ArtifactEffectType>();
  
  // Main effect from template
  effects.push({
    stat: template.effect,
    value: generateEffectValue(rarity) * bonusMultiplier,
    isPercentage: true,
  });
  usedEffects.add(template.effect);
  
  // Additional random effects
  const possibleEffects: ArtifactEffectType[] = [
    'globalProduction',
    'researchSpeed',
    'buildingEfficiency',
    'energyCapacity',
    'prestigeGain',
  ];
  
  while (effects.length < effectCount) {
    const randomEffect = possibleEffects[Math.floor(Math.random() * possibleEffects.length)];
    if (!usedEffects.has(randomEffect)) {
      effects.push({
        stat: randomEffect,
        value: generateEffectValue(rarity) * bonusMultiplier * 0.5, // Secondary effects are weaker
        isPercentage: true,
      });
      usedEffects.add(randomEffect);
    }
  }
  
  const id = `artifact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  return {
    id,
    name: `${template.name} (${getRarityName(rarity)})`,
    description: template.desc,
    rarity,
    effects,
    level: 0,
    maxLevel: 10,
    source,
    discoveredAt: Date.now(),
    slotsRequired: config.slots,
  };
}

/**
 * Gets Russian name for rarity
 */
export function getRarityName(rarity: ArtifactRarity): string {
  const names: Record<ArtifactRarity, string> = {
    common: 'Обычный',
    rare: 'Редкий',
    epic: 'Эпический',
    legendary: 'Легендарный',
    mythic: 'Мифический',
  };
  return names[rarity];
}

/**
 * Gets effect description in Russian
 */
export function getEffectDescription(effect: ArtifactEffect): string {
  const effectNames: Record<ArtifactEffectType, string> = {
    globalProduction: 'Производство всех ресурсов',
    resourceProduction: 'Производство ресурса',
    researchSpeed: 'Скорость исследований',
    buildingEfficiency: 'Эффективность зданий',
    expeditionSuccess: 'Успех экспедиций',
    combatPower: 'Боевая мощь',
    energyCapacity: 'Максимум энергии',
    prestigeGain: 'Получение QP',
    ascensionPoints: 'Получение AP',
    galaxyUnlockCost: 'Стоимость галактик',
    // Без этой строки артефакт с таким эффектом печатался как «+X% undefined».
    logisticsPenaltyReduction: 'Снижение логистических штрафов',
  };
  
  const sign = effect.stat === 'galaxyUnlockCost' ? '-' : '+';
  return `${sign}${effect.value.toFixed(1)}% ${effectNames[effect.stat]}`;
}

// ============================================================================
// ARTIFACT UPGRADE SYSTEM
// ============================================================================

/**
 * Calculates upgrade cost for artifact
 */
export function getUpgradeCost(artifact: Artifact): { credits: Decimal; qp?: Decimal; ap?: Decimal } {
  const config = ARTIFACT_RARITY_CONFIGS[artifact.rarity];
  const costMultiplier = 1.5;
  const baseCost = config.baseCost;
  
  const cost: { credits: Decimal; qp?: Decimal; ap?: Decimal } = {
    credits: new Decimal(baseCost).times(Math.pow(costMultiplier, artifact.level)),
  };
  
  // Epic+ requires QP
  if (artifact.rarity === 'epic' || artifact.rarity === 'legendary') {
    cost.qp = new Decimal(10).times(Math.pow(1.3, artifact.level));
  }
  
  // Mythic requires AP
  if (artifact.rarity === 'mythic') {
    cost.ap = new Decimal(1).times(Math.pow(1.2, artifact.level));
  }
  
  return cost;
}

/**
 * Gets effect multiplier at current level
 */
export function getEffectMultiplier(artifact: Artifact): number {
  return 1 + artifact.level * 0.2; // +20% per level
}

/**
 * Calculates actual effect value including level
 */
export function getActualEffectValue(artifact: Artifact, effect: ArtifactEffect): number {
  return effect.value * getEffectMultiplier(artifact);
}

// ============================================================================
// ARTIFACT DISCOVERY
// ============================================================================

/**
 * Checks if artifact should drop from galaxy exploration
 */
export function shouldDropArtifactFromGalaxy(galaxyNumber: number): boolean {
  // Base 5% chance, increases with galaxy number
  const baseChance = 0.05;
  const bonusChance = Math.min(0.15, (galaxyNumber - 8) * 0.02); // +2% per galaxy, max +15%
  return Math.random() < (baseChance + bonusChance);
}

/**
 * Gets rarity multiplier based on galaxy number
 */
export function getGalaxyRarityBonus(galaxyNumber: number): number {
  // Higher galaxies have better chances for rare artifacts
  return 1 + Math.min(2, (galaxyNumber - 8) * 0.1); // Up to +200%
}

/**
 * Generates artifact from galaxy exploration
 */
export function generateGalaxyArtifact(galaxyNumber: number): Artifact {
  const bonusMultiplier = getGalaxyRarityBonus(galaxyNumber);
  
  // Higher chance for better rarity in later galaxies
  let rarity = rollArtifactRarity();
  
  // Boost rarity chance for later galaxies
  if (galaxyNumber >= 15 && rarity === 'common') {
    rarity = Math.random() < 0.5 ? 'rare' : 'common';
  }
  if (galaxyNumber >= 20 && rarity === 'rare') {
    rarity = Math.random() < 0.3 ? 'epic' : 'rare';
  }
  
  return generateArtifact('galaxy', rarity, bonusMultiplier);
}

/**
 * Generates artifact from achievement
 */
export function generateAchievementArtifact(): Artifact {
  // Achievements always give at least rare
  const rarityRoll = Math.random();
  let rarity: ArtifactRarity;
  
  if (rarityRoll < 0.05) rarity = 'legendary';
  else if (rarityRoll < 0.25) rarity = 'epic';
  else rarity = 'rare';
  
  return generateArtifact('achievement', rarity, 1.5);
}

/**
 * Generates artifact from ascension milestone
 */
export function generateAscensionArtifact(ascensionCount: number): Artifact {
  // Higher ascensions give better artifacts
  let rarity: ArtifactRarity;
  
  if (ascensionCount >= 10) rarity = 'mythic';
  else if (ascensionCount >= 7) rarity = 'legendary';
  else if (ascensionCount >= 5) rarity = 'epic';
  else rarity = 'rare';
  
  return generateArtifact('ascension', rarity, 1 + ascensionCount * 0.1);
}

// ============================================================================
// ARTIFACT SLOT MANAGEMENT
// ============================================================================

/**
 * Calculates max artifact slots based on ascension count
 */
export function calculateMaxSlots(ascensionCount: number): number {
  const baseSlots = 2;
  const bonusSlots = Math.floor(ascensionCount / 5); // +1 slot per 5 ascensions
  return Math.min(10, baseSlots + bonusSlots);
}

/**
 * Calculates used slots from equipped artifacts
 */
export function calculateUsedSlots(artifacts: Artifact[], equippedIds: string[]): number {
  return equippedIds.reduce((total, id) => {
    const artifact = artifacts.find(a => a.id === id);
    return total + (artifact?.slotsRequired || 0);
  }, 0);
}

/**
 * Checks if artifact can be equipped
 */
export function canEquipArtifact(
  artifact: Artifact,
  equippedIds: string[],
  allArtifacts: Artifact[],
  maxSlots: number
): boolean {
  // Already equipped
  if (equippedIds.includes(artifact.id)) {
    return false;
  }
  
  // Check slots
  const usedSlots = calculateUsedSlots(allArtifacts, equippedIds);
  return usedSlots + artifact.slotsRequired <= maxSlots;
}

// ============================================================================
// ARTIFACT EFFECTS APPLICATION
// ============================================================================

export interface ArtifactMultipliers {
  globalProduction: number;
  researchSpeed: number;
  buildingEfficiency: number;
  energyCapacity: number;
  prestigeGain: number;
  ascensionPoints: number;
  expeditionSuccess: number;
  combatPower: number;
  galaxyUnlockCost: number;
  logisticsPenaltyReduction: number; // Снижение логистических штрафов (0-0.9)
  resourceProduction: Partial<Record<ResourceType, number>>;
}

/**
 * Calculates all multipliers from equipped artifacts
 */
export function calculateArtifactBonuses(
  artifacts: Artifact[],
  equippedIds: string[]
): ArtifactMultipliers {
  const multipliers: ArtifactMultipliers = {
    globalProduction: 1,
    researchSpeed: 1,
    buildingEfficiency: 1,
    energyCapacity: 1,
    prestigeGain: 1,
    ascensionPoints: 1,
    expeditionSuccess: 1,
    combatPower: 1,
    galaxyUnlockCost: 1,
    logisticsPenaltyReduction: 0,
    resourceProduction: {},
  };
  
  equippedIds.forEach(id => {
    const artifact = artifacts.find(a => a.id === id);
    if (!artifact) return;
    
    artifact.effects.forEach(effect => {
      const actualValue = getActualEffectValue(artifact, effect);
      const bonus = actualValue / 100;
      
      switch (effect.stat) {
        case 'globalProduction':
          multipliers.globalProduction *= (1 + bonus);
          break;
        case 'researchSpeed':
          multipliers.researchSpeed *= (1 + bonus);
          break;
        case 'buildingEfficiency':
          multipliers.buildingEfficiency *= (1 + bonus);
          break;
        case 'energyCapacity':
          multipliers.energyCapacity *= (1 + bonus);
          break;
        case 'prestigeGain':
          multipliers.prestigeGain *= (1 + bonus);
          break;
        case 'ascensionPoints':
          multipliers.ascensionPoints *= (1 + bonus);
          break;
        case 'expeditionSuccess':
          multipliers.expeditionSuccess *= (1 + bonus);
          break;
        case 'combatPower':
          multipliers.combatPower *= (1 + bonus);
          break;
        case 'galaxyUnlockCost':
          multipliers.galaxyUnlockCost *= (1 - bonus); // Reduction
          break;
        case 'logisticsPenaltyReduction':
          // Суммируется, но не больше 0.9 (90%)
          multipliers.logisticsPenaltyReduction = Math.min(0.9, multipliers.logisticsPenaltyReduction + bonus);
          break;
        case 'resourceProduction':
          if (effect.affectsResource) {
            const current = multipliers.resourceProduction[effect.affectsResource] || 1;
            multipliers.resourceProduction[effect.affectsResource] = current * (1 + bonus);
          }
          break;
      }
    });
  });
  
  return multipliers;
}
