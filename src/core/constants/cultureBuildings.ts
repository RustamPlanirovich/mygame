import { D } from '../math/format';
import type { CultureBuilding, CultureBuildingType } from '../gameTypes.culture';
import type Decimal from 'break_eternity.js';

// ==========================================
// КУЛЬТУРНЫЕ ЗДАНИЯ
// ==========================================

export const CULTURE_BUILDINGS: Record<CultureBuildingType, CultureBuilding> = {
  // ==========================================
  // ПАРКИ И ОТДЫХ
  // ==========================================
  park_mk1: {
    id: 'park_mk1',
    name: 'Парк',
    description: 'Зелёная зона для отдыха населения. Улучшает экологию и счастье.',
    emoji: '🌳',
    tier: 1,
    baseCost: { steel: D(100), plastic: D(50) },
    creditCost: D(5000),
    costFactor: 1.15,
    culturePerSecond: D(0),
    sciencePerSecond: D(0),
    happinessBonus: 2,
    energyConsumption: D(5),
    specialEffects: [
      { type: 'pollution_reduction', value: 0.05 },
    ],
  },
  park_mk2: {
    id: 'park_mk2',
    name: 'Ботанический Сад',
    description: 'Продвинутый парк с редкими растениями и научной лабораторией.',
    emoji: '🌿',
    tier: 2,
    baseCost: { steel: D(500), plastic: D(200), glass: D(100) },
    creditCost: D(50000),
    costFactor: 1.18,
    culturePerSecond: D(2),
    sciencePerSecond: D(1),
    happinessBonus: 5,
    energyConsumption: D(15),
    requiredCultureLevel: 8,
    specialEffects: [
      { type: 'pollution_reduction', value: 0.1 },
    ],
  },
  
  // ==========================================
  // БИБЛИОТЕКИ И ОБРАЗОВАНИЕ
  // ==========================================
  library_mk1: {
    id: 'library_mk1',
    name: 'Библиотека',
    description: 'Хранилище знаний. Производит науку и немного культуры.',
    emoji: '📚',
    tier: 1,
    baseCost: { steel: D(80), plastic: D(40) },
    creditCost: D(8000),
    costFactor: 1.15,
    culturePerSecond: D(2),
    sciencePerSecond: D(5),
    happinessBonus: 2,
    energyConsumption: D(10),
  },
  library_mk2: {
    id: 'library_mk2',
    name: 'Цифровая Библиотека',
    description: 'Современное хранилище данных с ИИ-ассистентами.',
    emoji: '💾',
    tier: 2,
    baseCost: { steel: D(400), computer: D(10), fiber: D(50) },
    creditCost: D(80000),
    costFactor: 1.18,
    culturePerSecond: D(5),
    sciencePerSecond: D(15),
    happinessBonus: 4,
    energyConsumption: D(30),
    requiredCultureLevel: 6,
  },
  
  // ==========================================
  // УНИВЕРСИТЕТЫ
  // ==========================================
  university_mk1: {
    id: 'university_mk1',
    name: 'Университет',
    description: 'Высшее учебное заведение. Производит много науки.',
    emoji: '🎓',
    tier: 1,
    baseCost: { steel: D(200), glass: D(50), plastic: D(30) },
    creditCost: D(15000),
    costFactor: 1.18,
    culturePerSecond: D(0),
    sciencePerSecond: D(10),
    happinessBonus: 3,
    energyConsumption: D(25),
    requiredCultureLevel: 3,
    specialEffects: [
      { type: 'research_speed', value: 0.02 },
    ],
  },
  university_mk2: {
    id: 'university_mk2',
    name: 'Исследовательский Институт',
    description: 'Продвинутый научный центр с новейшим оборудованием.',
    emoji: '🔬',
    tier: 2,
    baseCost: { steel: D(800), computer: D(20), integrated_circuit: D(10) },
    creditCost: D(150000),
    costFactor: 1.2,
    culturePerSecond: D(3),
    sciencePerSecond: D(30),
    happinessBonus: 5,
    energyConsumption: D(60),
    requiredCultureLevel: 6,
    specialEffects: [
      { type: 'research_speed', value: 0.05 },
    ],
  },
  
  // ==========================================
  // МУЗЕИ
  // ==========================================
  museum_mk1: {
    id: 'museum_mk1',
    name: 'Музей',
    description: 'Хранит культурное наследие. Производит культуру и даёт счастье.',
    emoji: '🏛️',
    tier: 1,
    baseCost: { steel: D(150), glass: D(80) },
    creditCost: D(12000),
    costFactor: 1.16,
    culturePerSecond: D(5),
    sciencePerSecond: D(0),
    happinessBonus: 3,
    energyConsumption: D(15),
    requiredCultureLevel: 3,
    specialEffects: [
      { type: 'global_productivity', value: 0.01 },
    ],
  },
  museum_mk2: {
    id: 'museum_mk2',
    name: 'Галерея Искусств',
    description: 'Выставочный зал современного искусства мирового уровня.',
    emoji: '🎨',
    tier: 2,
    baseCost: { steel: D(600), glass: D(300), artwork: D(5) },
    creditCost: D(100000),
    costFactor: 1.18,
    culturePerSecond: D(15),
    sciencePerSecond: D(2),
    happinessBonus: 6,
    energyConsumption: D(35),
    requiredCultureLevel: 5,
    specialEffects: [
      { type: 'global_productivity', value: 0.03 },
    ],
  },
  museum_mk3: {
    id: 'museum_mk3',
    name: 'Культурный Центр Галактики',
    description: 'Величайший музей известной вселенной.',
    emoji: '🌌',
    tier: 3,
    baseCost: { titanium_alloy: D(500), glass: D(1000), artwork: D(50), sculpture: D(20) },
    creditCost: D(2000000),
    costFactor: 1.25,
    culturePerSecond: D(100),
    sciencePerSecond: D(20),
    happinessBonus: 15,
    energyConsumption: D(200),
    requiredCultureLevel: 8,
    specialEffects: [
      { type: 'global_productivity', value: 0.1 },
    ],
  },
  
  // ==========================================
  // ТЕАТРЫ И ОПЕРА
  // ==========================================
  theater_mk1: {
    id: 'theater_mk1',
    name: 'Театр',
    description: 'Место для представлений и спектаклей.',
    emoji: '🎭',
    tier: 1,
    baseCost: { steel: D(120), glass: D(40), plastic: D(20) },
    creditCost: D(10000),
    costFactor: 1.15,
    culturePerSecond: D(3),
    sciencePerSecond: D(0),
    happinessBonus: 5,
    energyConsumption: D(20),
    requiredCultureLevel: 3,
  },
  theater_mk2: {
    id: 'theater_mk2',
    name: 'Концертный Зал',
    description: 'Современный зал для музыкальных выступлений.',
    emoji: '🎵',
    tier: 2,
    baseCost: { steel: D(500), glass: D(200), display: D(10) },
    creditCost: D(80000),
    costFactor: 1.18,
    culturePerSecond: D(10),
    sciencePerSecond: D(0),
    happinessBonus: 8,
    energyConsumption: D(50),
    requiredCultureLevel: 5,
  },
  opera_house_mk1: {
    id: 'opera_house_mk1',
    name: 'Оперный Театр',
    description: 'Величественное здание для оперных постановок.',
    emoji: '🎼',
    tier: 2,
    baseCost: { steel: D(800), glass: D(400), chrome_alloy: D(50) },
    creditCost: D(150000),
    costFactor: 1.2,
    culturePerSecond: D(8),
    sciencePerSecond: D(0),
    happinessBonus: 8,
    energyConsumption: D(40),
    requiredCultureLevel: 5,
  },
  
  // ==========================================
  // СПОРТИВНЫЕ СООРУЖЕНИЯ
  // ==========================================
  stadium_mk1: {
    id: 'stadium_mk1',
    name: 'Стадион',
    description: 'Спортивная арена для массовых мероприятий.',
    emoji: '🏟️',
    tier: 1,
    baseCost: { steel: D(300), plastic: D(100) },
    creditCost: D(25000),
    costFactor: 1.18,
    culturePerSecond: D(0),
    sciencePerSecond: D(0),
    happinessBonus: 10,
    energyConsumption: D(50),
    requiredCultureLevel: 4,
  },
  stadium_mk2: {
    id: 'stadium_mk2',
    name: 'Мега-Арена',
    description: 'Гигантский спортивный комплекс с современными технологиями.',
    emoji: '🏆',
    tier: 2,
    baseCost: { steel: D(1000), glass: D(500), display: D(50), computer: D(20) },
    creditCost: D(300000),
    costFactor: 1.22,
    culturePerSecond: D(5),
    sciencePerSecond: D(0),
    happinessBonus: 18,
    energyConsumption: D(150),
    requiredCultureLevel: 6,
  },
  colosseum_mk1: {
    id: 'colosseum_mk1',
    name: 'Колизей',
    description: 'Грандиозная арена для зрелищных событий.',
    emoji: '⚔️',
    tier: 3,
    baseCost: { steel: D(2000), chrome_alloy: D(200), glass: D(500) },
    creditCost: D(500000),
    costFactor: 1.25,
    culturePerSecond: D(10),
    sciencePerSecond: D(0),
    happinessBonus: 15,
    energyConsumption: D(100),
    requiredCultureLevel: 7,
  },
  
  // ==========================================
  // РАЗВЛЕЧЕНИЯ
  // ==========================================
  amusement_park_mk1: {
    id: 'amusement_park_mk1',
    name: 'Парк Развлечений',
    description: 'Огромный парк аттракционов для всей семьи.',
    emoji: '🎡',
    tier: 2,
    baseCost: { steel: D(800), plastic: D(400), display: D(30), engine: D(20) },
    creditCost: D(200000),
    costFactor: 1.2,
    culturePerSecond: D(3),
    sciencePerSecond: D(0),
    happinessBonus: 20,
    energyConsumption: D(100),
    requiredCultureLevel: 6,
  },
  
  // ==========================================
  // ОБСЕРВАТОРИИ
  // ==========================================
  observatory_mk1: {
    id: 'observatory_mk1',
    name: 'Обсерватория',
    description: 'Наблюдательный пункт для изучения космоса.',
    emoji: '🔭',
    tier: 1,
    baseCost: { steel: D(200), glass: D(150), integrated_circuit: D(5) },
    creditCost: D(20000),
    costFactor: 1.18,
    culturePerSecond: D(0),
    sciencePerSecond: D(8),
    happinessBonus: 1,
    energyConsumption: D(30),
    requiredCultureLevel: 4,
  },
  observatory_mk2: {
    id: 'observatory_mk2',
    name: 'Космическая Обсерватория',
    description: 'Орбитальный телескоп с невероятной разрешающей способностью.',
    emoji: '🛰️',
    tier: 2,
    baseCost: { titanium_alloy: D(100), computer: D(50), satellite: D(5) },
    creditCost: D(500000),
    costFactor: 1.22,
    culturePerSecond: D(5),
    sciencePerSecond: D(25),
    happinessBonus: 3,
    energyConsumption: D(80),
    requiredCultureLevel: 7,
  },
  
  // ==========================================
  // МЕДИА И ВЕЩАНИЕ
  // ==========================================
  broadcast_tower_mk1: {
    id: 'broadcast_tower_mk1',
    name: 'Телебашня',
    description: 'Центр теле- и радиовещания.',
    emoji: '📡',
    tier: 1,
    baseCost: { steel: D(250), integrated_circuit: D(10), fiber: D(20) },
    creditCost: D(30000),
    costFactor: 1.16,
    culturePerSecond: D(6),
    sciencePerSecond: D(0),
    happinessBonus: 4,
    energyConsumption: D(40),
    requiredCultureLevel: 4,
  },
  broadcast_tower_mk2: {
    id: 'broadcast_tower_mk2',
    name: 'Медиа-Центр',
    description: 'Глобальный центр создания и распространения контента.',
    emoji: '📺',
    tier: 2,
    baseCost: { steel: D(600), computer: D(30), satellite: D(3), display: D(20) },
    creditCost: D(250000),
    costFactor: 1.2,
    culturePerSecond: D(20),
    sciencePerSecond: D(5),
    happinessBonus: 8,
    energyConsumption: D(100),
    requiredCultureLevel: 7,
  },
  
  // ==========================================
  // МОНУМЕНТЫ
  // ==========================================
  monument_mk1: {
    id: 'monument_mk1',
    name: 'Монумент',
    description: 'Памятник великим достижениям цивилизации.',
    emoji: '🗽',
    tier: 1,
    baseCost: { steel: D(500), chrome_alloy: D(50) },
    creditCost: D(50000),
    costFactor: 1.2,
    culturePerSecond: D(15),
    sciencePerSecond: D(0),
    happinessBonus: 7,
    energyConsumption: D(10),
    requiredCultureLevel: 5,
  },
  monument_mk2: {
    id: 'monument_mk2',
    name: 'Чудо Света',
    description: 'Грандиозное архитектурное сооружение, известное по всей галактике.',
    emoji: '🏰',
    tier: 2,
    baseCost: { titanium_alloy: D(200), chrome_alloy: D(100), glass: D(300), sculpture: D(10) },
    creditCost: D(500000),
    costFactor: 1.25,
    culturePerSecond: D(50),
    sciencePerSecond: D(10),
    happinessBonus: 12,
    energyConsumption: D(50),
    requiredCultureLevel: 7,
  },
  monument_mk3: {
    id: 'monument_mk3',
    name: 'Вечный Маяк',
    description: 'Символ цивилизации, видимый из космоса. Вдохновляет поколения.',
    emoji: '✨',
    tier: 3,
    baseCost: { 
      titanium_alloy: D(1000), 
      chrome_alloy: D(500), 
      dark_matter: D(100),
      sculpture: D(50),
      artwork: D(100),
    },
    creditCost: D(5000000),
    costFactor: 1.3,
    culturePerSecond: D(200),
    sciencePerSecond: D(50),
    happinessBonus: 25,
    energyConsumption: D(200),
    requiredCultureLevel: 9,
    specialEffects: [
      { type: 'global_productivity', value: 0.15 },
      { type: 'research_speed', value: 0.1 },
    ],
  },
};

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Get culture building by ID
 */
export function getCultureBuilding(id: CultureBuildingType): CultureBuilding | undefined {
  return CULTURE_BUILDINGS[id];
}

/**
 * Get all culture buildings
 */
export function getAllCultureBuildings(): CultureBuilding[] {
  return Object.values(CULTURE_BUILDINGS);
}

/**
 * Get culture buildings by tier
 */
export function getCultureBuildingsByTier(tier: number): CultureBuilding[] {
  return Object.values(CULTURE_BUILDINGS).filter(b => b.tier === tier);
}

/**
 * Check if a culture building is available at given culture level
 */
export function isCultureBuildingAvailable(buildingId: CultureBuildingType, cultureLevel: number): boolean {
  const building = CULTURE_BUILDINGS[buildingId];
  if (!building) return false;
  
  const requiredLevel = building.requiredCultureLevel || 1;
  return cultureLevel >= requiredLevel;
}

/**
 * Calculate total happiness bonus from culture buildings
 */
export function calculateTotalHappinessFromBuildings(buildingCounts: Record<string, number>): number {
  let total = 0;
  
  for (const [buildingId, count] of Object.entries(buildingCounts)) {
    const building = CULTURE_BUILDINGS[buildingId as CultureBuildingType];
    if (building) {
      total += building.happinessBonus * count;
    }
  }
  
  return total;
}

/**
 * Calculate total culture production per second from buildings
 */
export function calculateCultureProduction(buildingCounts: Record<string, number>): Decimal {
  let total = D(0);
  
  for (const [buildingId, count] of Object.entries(buildingCounts)) {
    const building = CULTURE_BUILDINGS[buildingId as CultureBuildingType];
    if (building && building.culturePerSecond.gt(0)) {
      total = total.add(building.culturePerSecond.mul(count));
    }
  }
  
  return total;
}

/**
 * Calculate total science production per second from buildings
 */
export function calculateScienceProduction(buildingCounts: Record<string, number>): Decimal {
  let total = D(0);
  
  for (const [buildingId, count] of Object.entries(buildingCounts)) {
    const building = CULTURE_BUILDINGS[buildingId as CultureBuildingType];
    if (building && building.sciencePerSecond.gt(0)) {
      total = total.add(building.sciencePerSecond.mul(count));
    }
  }
  
  return total;
}

/**
 * Get aggregated special effects from culture buildings
 */
export function aggregateCultureEffects(buildingCounts: Record<string, number>): {
  globalProductivity: number;
  buildingDurability: number;
  researchSpeed: number;
  buildingCost: number;
  tradePrices: number;
  creditsPerSale: number;
  pollutionReduction: number;
} {
  const effects = {
    globalProductivity: 1.0,
    buildingDurability: 1.0,
    researchSpeed: 1.0,
    buildingCost: 1.0,
    tradePrices: 1.0,
    creditsPerSale: 1.0,
    pollutionReduction: 1.0,
  };
  
  for (const [buildingId, count] of Object.entries(buildingCounts)) {
    const building = CULTURE_BUILDINGS[buildingId as CultureBuildingType];
    if (!building || !building.specialEffects) continue;
    
    for (const effect of building.specialEffects) {
      switch (effect.type) {
        case 'global_productivity':
          effects.globalProductivity += effect.value * count;
          break;
        case 'building_durability':
          effects.buildingDurability += effect.value * count;
          break;
        case 'research_speed':
          effects.researchSpeed += effect.value * count;
          break;
        case 'building_cost':
          effects.buildingCost -= effect.value * count; // Negative = cheaper
          break;
        case 'trade_prices':
          effects.tradePrices += effect.value * count;
          break;
        case 'credits_per_sale':
          effects.creditsPerSale += effect.value * count;
          break;
        case 'pollution_reduction':
          effects.pollutionReduction -= effect.value * count; // Negative = less pollution
          break;
      }
    }
  }
  
  // Ensure minimums
  effects.buildingCost = Math.max(0.5, effects.buildingCost);
  effects.pollutionReduction = Math.max(0.1, effects.pollutionReduction);
  
  return effects;
}

/**
 * Get list of culture building types
 */
export function getCultureBuildingTypes(): CultureBuildingType[] {
  return Object.keys(CULTURE_BUILDINGS) as CultureBuildingType[];
}

/**
 * Check if a building ID is a culture building
 */
export function isCultureBuilding(buildingId: string): boolean {
  return buildingId in CULTURE_BUILDINGS;
}
