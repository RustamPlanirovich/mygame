import type Decimal from 'break_eternity.js';
import type { ResourceType, BuildingType, TechnologyId } from './gameTypes';

// ==========================================
// ФАЗА 7: КУЛЬТУРА И НАУКА
// ==========================================

// Культурный уровень цивилизации
export interface CultureLevel {
  level: number;                // 1-10
  name: string;                 // Название культуры
  requiredCulture: Decimal;     // Культура для достижения этого уровня
  happinessBonus: number;       // +X% к productivity
  unlocks: BuildingType[];      // Разблокирует здания
  description: string;          // Описание уровня
}

// Фактор влияющий на счастье
export interface HappinessFactor {
  id: string;                   // Уникальный идентификатор
  source: string;               // Источник (здание, политика, событие и т.д.)
  category: HappinessCategory;  // Категория фактора
  value: number;                // Может быть отрицательным (-100 до +100)
  description: string;          // Описание для UI
  icon?: string;                // Эмодзи/иконка
  temporary?: boolean;          // Временный фактор (исчезает со временем)
  expiresAt?: number;           // Когда истекает (timestamp)
}

export type HappinessCategory = 
  | 'culture'           // Культурные здания и уровень
  | 'entertainment'     // Развлечения
  | 'work_conditions'   // Условия труда (overclock/economy)
  | 'ecology'           // Экология
  | 'economy'           // Экономическое состояние
  | 'events'            // События
  | 'warfare';          // Война/конфликты

// Состояние счастья населения
export interface HappinessState {
  current: number;              // Текущий уровень 0-100
  factors: HappinessFactor[];   // Все активные факторы
  productivityMultiplier: number; // Множитель производства (0.7 - 1.3)
  trend: 'rising' | 'stable' | 'falling'; // Тренд счастья
  lastUpdated: number;          // Timestamp последнего обновления
}

// Уровень счастья населения
export type HappinessTier = 
  | 'miserable'    // 0-20%: Несчастны
  | 'discontent'   // 21-40%: Недовольны  
  | 'neutral'      // 41-60%: Нейтрально
  | 'content'      // 61-80%: Довольны
  | 'happy';       // 81-100%: Счастливы

export interface HappinessTierInfo {
  tier: HappinessTier;
  name: string;
  minHappiness: number;
  maxHappiness: number;
  productivityMultiplier: number;
  color: string;
  icon: string;
}

// Культурное здание (производит культуру и/или даёт счастье)
export interface CultureBuilding {
  id: string;
  name: string;
  description: string;
  emoji: string;
  tier: number;                 // 1-3 уровень здания
  baseCost: Partial<Record<ResourceType, Decimal>>;
  creditCost: Decimal;
  costFactor: number;
  
  // Производство
  culturePerSecond: Decimal;    // Культура в секунду
  sciencePerSecond: Decimal;    // Наука в секунду
  
  // Эффекты на счастье
  happinessBonus: number;       // Бонус к счастью от этого здания
  
  // Потребление
  energyConsumption: Decimal;
  consumption?: Partial<Record<ResourceType, Decimal>>;
  
  // Требования
  requiredTechnology?: TechnologyId;
  requiredCultureLevel?: number;
  
  // Специальные эффекты
  specialEffects?: CultureBuildingEffect[];
}

export type CultureBuildingEffect = 
  | { type: 'global_productivity'; value: number }     // +X% глобальная производительность
  | { type: 'building_durability'; value: number }     // +X% прочность зданий
  | { type: 'research_speed'; value: number }          // +X% скорость исследований
  | { type: 'building_cost'; value: number }           // -X% стоимость зданий
  | { type: 'trade_prices'; value: number }            // +X% цены торговли
  | { type: 'credits_per_sale'; value: number }        // +X% кредитов за продажу
  | { type: 'pollution_reduction'; value: number };    // -X% загрязнения

// Состояние системы культуры
export interface CultureState {
  // Накопленные валюты
  science: Decimal;             // Научные очки
  culture: Decimal;             // Культурные очки
  
  // Текущий культурный уровень
  currentLevel: number;         // 1-10
  cultureProgress: Decimal;     // Прогресс к следующему уровню
  
  // Счастье населения
  happiness: HappinessState;
  
  // Производство в секунду (кэшированные значения)
  sciencePerSecond: Decimal;
  culturePerSecond: Decimal;
  
  // Статистика
  totalScienceProduced: Decimal;
  totalCultureProduced: Decimal;
  
  // Unlocked culture buildings
  unlockedCultureBuildings: string[];
  
  // Бонусы от культурных зданий (агрегированные)
  aggregatedEffects: {
    globalProductivity: number;     // Множитель
    buildingDurability: number;
    researchSpeed: number;
    buildingCost: number;
    tradePrices: number;
    creditsPerSale: number;
    pollutionReduction: number;
  };
}

// События влияющие на счастье
export interface CultureEvent {
  id: string;
  name: string;
  description: string;
  happinessEffect: number;      // -30 to +30
  duration: number;             // В миллисекундах
  icon: string;
}

// Типы культурных зданий
export type CultureBuildingType = 
  // Музеи и галереи
  | 'museum_mk1'
  | 'museum_mk2'
  | 'museum_mk3'
  // Театры и опера
  | 'theater_mk1'
  | 'theater_mk2'
  | 'opera_house_mk1'
  // Спортивные сооружения
  | 'stadium_mk1'
  | 'stadium_mk2'
  | 'colosseum_mk1'
  // Парки и отдых
  | 'park_mk1'
  | 'park_mk2'
  | 'amusement_park_mk1'
  // Образование
  | 'university_mk1'
  | 'university_mk2'
  | 'library_mk1'
  | 'library_mk2'
  // Исследования
  | 'observatory_mk1'
  | 'observatory_mk2'
  // Медиа
  | 'broadcast_tower_mk1'
  | 'broadcast_tower_mk2'
  // Монументы
  | 'monument_mk1'
  | 'monument_mk2'
  | 'monument_mk3';

// Технологии культуры и науки
export type CultureTechnologyId = 
  | 'cultural_foundation'       // Базовые культурные здания
  | 'public_education'          // Библиотеки и университеты
  | 'mass_media'                // Медиа и вещание
  | 'entertainment_complex'     // Развлекательные комплексы
  | 'cultural_heritage'         // Музеи и монументы
  | 'advanced_research'         // Продвинутые исследования
  | 'transcendent_culture';     // Трансцендентная культура

// Default initial state
export const INITIAL_CULTURE_STATE: Omit<CultureState, 'science' | 'culture' | 'cultureProgress' | 'sciencePerSecond' | 'culturePerSecond' | 'totalScienceProduced' | 'totalCultureProduced'> = {
  currentLevel: 1,
  happiness: {
    current: 50,
    factors: [],
    productivityMultiplier: 1.0,
    trend: 'stable',
    lastUpdated: Date.now(),
  },
  unlockedCultureBuildings: [],
  aggregatedEffects: {
    globalProductivity: 1.0,
    buildingDurability: 1.0,
    researchSpeed: 1.0,
    buildingCost: 1.0,
    tradePrices: 1.0,
    creditsPerSale: 1.0,
    pollutionReduction: 1.0,
  },
};
