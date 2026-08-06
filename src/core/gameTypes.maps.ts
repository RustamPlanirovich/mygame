/**
 * Типы для системы карт (Фаза 4)
 */

import type { ResourceType, TechnologyId } from './gameTypes';

// Размер карты
export type MapSize = 'tiny' | 'small' | 'medium' | 'large' | 'huge';

// Тип сетки
export type GridType = 'square' | 'hex';

// Сложность карты
export type MapDifficulty = 'easy' | 'normal' | 'hard' | 'extreme' | 'nightmare';

// Модификаторы карты
export type MapModifier =
  | 'rich_deposits'       // +50% ресурсов в депозитах
  | 'poor_deposits'       // -30% ресурсов
  | 'hostile'             // Враги сильнее
  | 'peaceful'            // Без врагов
  | 'toxic'               // Урон зданиям со временем
  | 'radioactive'         // Уран везде, но радиация
  | 'frozen'              // Лёд повсюду, энергия нужна для обогрева
  | 'volcanic'            // Много энергии, но случайные извержения
  | 'asteroid_field'      // Много мелких островков
  | 'trade_hub'           // Бонус к торговле
  | 'isolated'            // Нет торговли
  | 'ancient_ruins'       // Можно найти артефакты
  | 'unlimited';          // Творческий режим - без ограничений

// Тема оформления карты
export interface MapTheme {
  name: string;
  backgroundColor: string;
  tileColors: {
    empty: string;
    deposit: string;
    building: string;
    base: string;
    blocked?: string;
  };
  ambientParticles?: 'snow' | 'ash' | 'dust' | 'sparkles' | 'toxic' | 'none';
  borderColor?: string;
}

// Требование для разблокировки карты
export interface MapUnlockRequirement {
  type: 'technology' | 'ascension' | 'playtime' | 'none';
  technologyId?: TechnologyId;
  ascensionLevel?: number;
  playtimeHours?: number;
}

// Спецсобытия карты
export interface MapEvent {
  id: string;
  name: string;
  description: string;
  chance: number; // 0-1
  effect: MapEventEffect;
}

export type MapEventEffect =
  | { type: 'damage_buildings'; amount: number } // % урона
  | { type: 'bonus_resources'; resource: ResourceType; amount: number }
  | { type: 'spawn_enemies'; count: number; strength: number }
  | { type: 'discover_artifact' }
  | { type: 'energy_surge'; multiplier: number; durationSeconds: number }
  | { type: 'resource_depletion'; resource: ResourceType; percentage: number };

// Определение карты
export interface MapDefinition {
  id: string;
  name: string;
  emoji: string;
  description: string;
  size: MapSize;
  gridType: GridType;
  difficulty: MapDifficulty;
  modifiers: MapModifier[];
  gridDimensions: { width: number; height: number };
  startingResources: Partial<Record<ResourceType, number>>;
  startingCredits: number;
  availableDeposits: ResourceType[];
  depositDensity: number; // 0.1 - 0.9
  unlockRequirement: MapUnlockRequirement;
  theme: MapTheme;
  specialEvents?: MapEvent[];
  bonuses?: MapBonus[];
}

// Бонусы карты
export interface MapBonus {
  type: 'production' | 'trade' | 'research' | 'building_cost' | 'energy';
  resource?: ResourceType;
  modifier: number; // 1.5 = +50%, 0.8 = -20%
  description: string;
}

// Состояние активной карты (для хранения генерированных данных)
export interface GeneratedMapData {
  mapId: string;
  startedAt: number;
  gridType: GridType;
  gridDimensions: { width: number; height: number };
  modifiers: MapModifier[];
  activeEvents: Array<{
    eventId: string;
    startedAt: number;
    endsAt: number;
  }>;
  discoveredArtifacts: string[];
  stats: {
    buildingsPlaced: number;
    resourcesProduced: number;
    enemiesDefeated: number;
    eventsTriggered: number;
  };
  /**
   * Когда карта была засчитана как пройденная (Date.now()), или null.
   *
   * Нужен, чтобы прохождение засчиталось РОВНО ОДИН РАЗ за партию: критерий проверяется
   * в тике, и без этой отметки он срабатывал бы на каждом прогоне после достижения цели.
   * Игра бесконечная, поэтому отметка не заканчивает партию — игрок продолжает строить.
   */
  completedAt?: number | null;
}

// Прогресс по конкретной карте
export interface MapProgressEntry {
  completions: number;
  bestTime: number | null;
  discovered: boolean;
}

// Состояние системы карт в GameState
export interface ActiveMapState {
  currentMapId: MapId | null;
  unlockedMaps: MapId[];
  mapProgress: Record<string, MapProgressEntry>;
  activeMapData: GeneratedMapData | null;
  mapSeed: number;
  currentEvent: string | null;
  eventHistory: string[];
}

// ID карт
export type MapId =
  | 'map_training_ground'
  | 'map_barren_moon'
  | 'map_crystal_caves'
  | 'map_volcanic_world'
  | 'map_ice_giant'
  | 'map_toxic_swamp'
  | 'map_asteroid_belt'
  | 'map_ancient_ruins'
  // map_creative объявлена в MAP_DEFINITIONS, но в этот union не попала, из-за чего
  // творческий режим нельзя было положить в currentMapId/unlockedMaps.
  | 'map_creative';

// Размеры карт
export const MAP_SIZE_DIMENSIONS: Record<MapSize, { width: number; height: number }> = {
  tiny: { width: 8, height: 8 },
  small: { width: 12, height: 12 },
  medium: { width: 16, height: 16 },
  large: { width: 20, height: 20 },
  huge: { width: 24, height: 24 },
};

// Множители сложности
export const DIFFICULTY_MULTIPLIERS: Record<MapDifficulty, {
  enemyStrength: number;
  resourceScarcity: number;
  eventFrequency: number;
  rewardMultiplier: number;
}> = {
  easy: { enemyStrength: 0.5, resourceScarcity: 0.8, eventFrequency: 0.5, rewardMultiplier: 0.8 },
  normal: { enemyStrength: 1.0, resourceScarcity: 1.0, eventFrequency: 1.0, rewardMultiplier: 1.0 },
  hard: { enemyStrength: 1.5, resourceScarcity: 1.2, eventFrequency: 1.3, rewardMultiplier: 1.3 },
  extreme: { enemyStrength: 2.0, resourceScarcity: 1.5, eventFrequency: 1.5, rewardMultiplier: 1.6 },
  nightmare: { enemyStrength: 3.0, resourceScarcity: 2.0, eventFrequency: 2.0, rewardMultiplier: 2.0 },
};

// Модификаторы эффектов
export const MODIFIER_EFFECTS: Record<MapModifier, {
  description: string;
  effects: Partial<{
    depositMultiplier: number;
    enemyMultiplier: number;
    energyConsumption: number;
    buildingDamagePerMinute: number;
    tradeBonus: number;
    hasEnemies: boolean;
    specialMechanic: string;
  }>;
}> = {
  rich_deposits: {
    description: '+50% ресурсов в депозитах',
    effects: { depositMultiplier: 1.5 },
  },
  poor_deposits: {
    description: '-30% ресурсов в депозитах',
    effects: { depositMultiplier: 0.7 },
  },
  hostile: {
    description: 'Враги на 50% сильнее',
    effects: { enemyMultiplier: 1.5 },
  },
  peaceful: {
    description: 'Нет атак врагов',
    effects: { hasEnemies: false },
  },
  toxic: {
    description: 'Здания получают 1% урона/мин',
    effects: { buildingDamagePerMinute: 0.01 },
  },
  radioactive: {
    description: 'Много урана, но радиация',
    effects: { specialMechanic: 'radiation' },
  },
  frozen: {
    description: '+50% потребление энергии',
    effects: { energyConsumption: 1.5 },
  },
  volcanic: {
    description: 'Геотермальная энергия, но извержения',
    effects: { specialMechanic: 'eruptions' },
  },
  asteroid_field: {
    description: 'Карта разделена на острова',
    effects: { specialMechanic: 'islands' },
  },
  trade_hub: {
    description: '+20% к торговым ценам',
    effects: { tradeBonus: 1.2 },
  },
  isolated: {
    description: 'Торговля недоступна',
    effects: { tradeBonus: 0 },
  },
  ancient_ruins: {
    description: 'Можно найти артефакты',
    effects: { specialMechanic: 'artifacts' },
  },
  // Модификатор карты map_creative: записи здесь не было, поэтому
  // MODIFIER_EFFECTS['unlimited'] возвращал undefined и песочница оставалась без описания.
  unlimited: {
    description: 'Творческий режим — без ограничений',
    effects: { specialMechanic: 'creative' },
  },
};
