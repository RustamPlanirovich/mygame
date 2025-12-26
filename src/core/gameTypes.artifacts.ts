import type Decimal from 'break_eternity.js';

/**
 * Типы для системы артефактов
 * Артефакты - это мощные предметы с уникальными бонусами, которые можно экипировать
 */

// Редкость артефакта
export type ArtifactRarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';

// Тип эффекта артефакта
export type ArtifactEffectType = 
  | 'global_production'          // Глобальное производство
  | 'resource_production'        // Производство конкретного ресурса
  | 'research_speed'            // Скорость исследований
  | 'building_efficiency'       // Эффективность зданий
  | 'expedition_success'        // Успех экспедиций
  | 'combat_power'              // Боевая мощь
  | 'energy_capacity'           // Максимальная энергия
  | 'prestige_gain'             // Получение QP
  | 'ascension_points'          // Получение AP
  | 'galaxy_unlock_cost';       // Стоимость открытия галактик

// Эффект артефакта
export interface ArtifactEffect {
  type: ArtifactEffectType;
  value: number;                 // Базовое значение эффекта (в процентах)
  isPercentage: boolean;         // Всегда true для текущей версии
  resourceType?: string;         // Опционально: тип ресурса для resource_production
}

// Источник получения артефакта
export type ArtifactSource = 'galaxy' | 'boss' | 'event' | 'achievement' | 'ascension';

// Артефакт
export interface Artifact {
  id: string;                    // Уникальный ID
  name: string;                  // Название
  nameRu: string;                // Название на русском
  description: string;           // Описание
  descriptionRu: string;         // Описание на русском
  rarity: ArtifactRarity;        // Редкость
  effects: ArtifactEffect[];     // Эффекты (1-3 эффекта в зависимости от редкости)
  level: number;                 // Текущий уровень (1-10)
  maxLevel: number;              // Максимальный уровень (обычно 10)
  source: ArtifactSource;        // Источник получения
  sourceId?: string;             // ID источника (например, номер галактики)
  discoveredAt: number;          // Timestamp открытия
  slots: number;                 // Сколько слотов занимает (1-3)
}

// Конфигурация редкости
export interface RarityConfig {
  color: string;                 // HEX цвет
  effectRange: [number, number]; // Диапазон эффекта в %
  effectCount: [number, number]; // Сколько эффектов (min, max)
  slots: number;                 // Сколько слотов занимает
  dropRate: number;              // Шанс выпадения (0-100)
  baseCost: number;              // Базовая стоимость улучшения
}

// Стоимость улучшения артефакта
export interface ArtifactUpgradeCost {
  credits: Decimal;
  quantum_points?: Decimal;      // Для epic+
  ascension_points?: Decimal;    // Для mythic
}

// Состояние системы артефактов
export interface ArtifactState {
  discovered: Artifact[];        // Все найденные артефакты
  equipped: string[];            // ID экипированных артефактов (массив ID)
  maxSlots: number;              // Максимум слотов (растёт с Ascension)
  totalFound: number;            // Всего найдено за всё время
  statistics: {
    byRarity: Record<ArtifactRarity, number>;           // Сколько найдено каждой редкости
    bySource: Record<ArtifactSource, number>;           // Сколько найдено из каждого источника
    totalUpgrades: number;                              // Всего улучшений
    highestLevel: number;                               // Максимальный уровень артефакта
  };
}

// Множители от экипированных артефактов (применяются в game loop)
export interface ArtifactMultipliers {
  globalProduction: number;
  researchSpeed: number;
  buildingEfficiency: number;
  expeditionSuccess: number;
  combatPower: number;
  energyCapacity: number;
  prestigeGain: number;
  ascensionPoints: number;
  galaxyUnlockCostReduction: number;
  resourceProduction: Partial<Record<string, number>>; // Ключ = тип ресурса
}
