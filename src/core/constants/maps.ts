/**
 * Определения карт (Фаза 4)
 * 8 уникальных карт с разными характеристиками
 */

import type { MapDefinition } from '../gameTypes.maps';

/**
 * Все доступные карты в игре
 */
export const MAP_DEFINITIONS: MapDefinition[] = [
  // ═══════════════════════════════════════════════════════════════
  // 🏕️ ТРЕНИРОВОЧНАЯ ПЛОЩАДКА - Начальная карта
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'map_training_ground',
    name: 'Тренировочная Площадка',
    emoji: '🏕️',
    description: 'Идеальное место для обучения. Богатые ресурсы, нет врагов, подробные подсказки.',
    size: 'tiny',
    gridType: 'square',
    difficulty: 'easy',
    modifiers: ['peaceful', 'rich_deposits'],
    gridDimensions: { width: 8, height: 8 },
    startingResources: {
      energy: 500,
      ore: 200,
      ice: 100,
      carbon: 50,
    },
    startingCredits: 1000,
    availableDeposits: ['ore', 'ice', 'carbon', 'copper'],
    depositDensity: 0.25,
    unlockRequirement: { type: 'none' },
    theme: {
      name: 'Учебная база',
      backgroundColor: '#1a2a1a',
      tileColors: {
        empty: '#2a3a2a',
        deposit: '#4a6a3a',
        building: '#3a5a4a',
        base: '#5a8a5a',
      },
      ambientParticles: 'none',
      borderColor: '#4a8a4a',
    },
    bonuses: [
      { type: 'production', modifier: 1.2, description: '+20% производство' },
      { type: 'building_cost', modifier: 0.8, description: '-20% стоимость строительства' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // 🌑 БЕСПЛОДНАЯ ЛУНА - Первый вызов
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'map_barren_moon',
    name: 'Бесплодная Луна',
    emoji: '🌑',
    description: 'Суровый мир с минимумом ресурсов. Эффективность - ключ к выживанию.',
    size: 'small',
    gridType: 'square',
    difficulty: 'normal',
    modifiers: ['poor_deposits'],
    gridDimensions: { width: 12, height: 12 },
    startingResources: {
      energy: 350,
      ore: 150,
    },
    startingCredits: 300,
    availableDeposits: ['ore', 'sand', 'titanium'],
    depositDensity: 0.12,
    unlockRequirement: { type: 'playtime', playtimeHours: 1 },
    theme: {
      name: 'Лунная пустошь',
      backgroundColor: '#1a1a1f',
      tileColors: {
        empty: '#2a2a2f',
        deposit: '#4a4a5f',
        building: '#3a3a4f',
        base: '#5a5a7f',
      },
      ambientParticles: 'dust',
      borderColor: '#3a3a4a',
    },
    bonuses: [
      { type: 'research', modifier: 1.15, description: '+15% скорость исследований' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // 💎 КРИСТАЛЬНЫЕ ПЕЩЕРЫ - Полупроводниковый рай
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'map_crystal_caves',
    name: 'Кристальные Пещеры',
    emoji: '💎',
    description: 'Подземный мир, богатый кристаллами и редкими минералами.',
    size: 'medium',
    gridType: 'hex',
    difficulty: 'normal',
    modifiers: ['rich_deposits'],
    gridDimensions: { width: 16, height: 16 },
    startingResources: {
      energy: 300,
      ore: 150,
      sand: 200,
    },
    startingCredits: 500,
    availableDeposits: ['sand', 'copper', 'chrome', 'titanium'],
    depositDensity: 0.22,
    unlockRequirement: { type: 'technology', technologyId: 'semiconductors' },
    theme: {
      name: 'Кристальные глубины',
      backgroundColor: '#1a1a2a',
      tileColors: {
        empty: '#2a2a4a',
        deposit: '#5a4a8a',
        building: '#4a3a6a',
        base: '#7a5aaa',
      },
      ambientParticles: 'sparkles',
      borderColor: '#6a4a9a',
    },
    bonuses: [
      { type: 'production', resource: 'semiconductors', modifier: 2.0, description: '+100% производство полупроводников' },
      { type: 'production', resource: 'copper', modifier: 1.5, description: '+50% производство меди' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // 🌋 ВУЛКАНИЧЕСКИЙ МИР - Огненный вызов
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'map_volcanic_world',
    name: 'Вулканический Мир',
    emoji: '🌋',
    description: 'Мир расплавленной лавы. Бесплатная геотермальная энергия, но опасные извержения.',
    size: 'medium',
    gridType: 'square',
    difficulty: 'hard',
    modifiers: ['volcanic', 'hostile'],
    gridDimensions: { width: 16, height: 16 },
    startingResources: {
      energy: 1000,
      ore: 100,
    },
    startingCredits: 400,
    availableDeposits: ['ore', 'uranium', 'chrome', 'titanium'],
    depositDensity: 0.18,
    unlockRequirement: { type: 'technology', technologyId: 'nuclear_physics' },
    theme: {
      name: 'Вулканические земли',
      backgroundColor: '#2a1a1a',
      tileColors: {
        empty: '#3a2a2a',
        deposit: '#8a4a2a',
        building: '#5a3a2a',
        base: '#aa5a3a',
        blocked: '#1a0a0a',
      },
      ambientParticles: 'ash',
      borderColor: '#aa4a2a',
    },
    bonuses: [
      { type: 'energy', modifier: 1.5, description: '+50% производство энергии' },
      { type: 'production', resource: 'uranium', modifier: 1.3, description: '+30% производство урана' },
    ],
    specialEvents: [
      {
        id: 'volcanic_eruption',
        name: 'Извержение вулкана',
        description: 'Лава наносит урон ближайшим зданиям',
        chance: 0.05, // 5% каждый тик
        effect: { type: 'damage_buildings', amount: 10 },
      },
      {
        id: 'geothermal_surge',
        name: 'Геотермальный всплеск',
        description: 'Энергия временно удваивается',
        chance: 0.03,
        effect: { type: 'energy_surge', multiplier: 2, durationSeconds: 60 },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // 🧊 ЛЕДЯНОЙ ГИГАНТ - Морозный вызов
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'map_ice_giant',
    name: 'Ледяной Гигант',
    emoji: '🧊',
    description: 'Замёрзшая луна с бесконечными запасами льда, но повышенным энергопотреблением.',
    size: 'large',
    gridType: 'hex',
    difficulty: 'hard',
    modifiers: ['frozen', 'rich_deposits'],
    gridDimensions: { width: 20, height: 20 },
    startingResources: {
      energy: 400,
      ore: 100,
      ice: 500,
    },
    startingCredits: 350,
    availableDeposits: ['ice', 'natural_gas', 'carbon'],
    depositDensity: 0.28,
    unlockRequirement: { type: 'technology', technologyId: 'first_colony' },
    theme: {
      name: 'Ледяные пустоши',
      backgroundColor: '#1a2a3a',
      tileColors: {
        empty: '#2a3a5a',
        deposit: '#5a7aaa',
        building: '#3a5a7a',
        base: '#7a9aca',
      },
      ambientParticles: 'snow',
      borderColor: '#5a8aba',
    },
    bonuses: [
      { type: 'production', resource: 'ice', modifier: 3.0, description: '+200% производство льда' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // ☠️ ТОКСИЧНЫЕ БОЛОТА - Экстремальный вызов
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'map_toxic_swamp',
    name: 'Токсичные Болота',
    emoji: '☠️',
    description: 'Ядовитая атмосфера разъедает здания. Постоянная борьба за выживание.',
    size: 'medium',
    gridType: 'square',
    difficulty: 'extreme',
    modifiers: ['toxic', 'hostile'],
    gridDimensions: { width: 16, height: 16 },
    startingResources: {
      energy: 350,
      ore: 150,
      chemicals: 100,
    },
    startingCredits: 500,
    availableDeposits: ['chemicals', 'oil', 'natural_gas'],
    depositDensity: 0.2,
    unlockRequirement: { type: 'ascension', ascensionLevel: 1 },
    theme: {
      name: 'Ядовитые топи',
      backgroundColor: '#1a2a1a',
      tileColors: {
        empty: '#2a4a2a',
        deposit: '#4a6a2a',
        building: '#3a5a2a',
        base: '#5a8a3a',
        blocked: '#1a1a0a',
      },
      ambientParticles: 'toxic',
      borderColor: '#4a8a2a',
    },
    bonuses: [
      { type: 'production', resource: 'chemicals', modifier: 2.0, description: '+100% производство химикатов' },
      { type: 'production', resource: 'oil', modifier: 1.5, description: '+50% производство нефти' },
    ],
    specialEvents: [
      {
        id: 'acid_rain',
        name: 'Кислотный дождь',
        description: 'Все здания получают дополнительный урон',
        chance: 0.08,
        effect: { type: 'damage_buildings', amount: 5 },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // 🪨 АСТЕРОИДНЫЙ ПОЯС - Космический архипелаг
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'map_asteroid_belt',
    name: 'Астероидный Пояс',
    emoji: '🪨',
    description: 'Сеть астероидов без единого рынка. Нужны мосты между островами.',
    size: 'huge',
    gridType: 'hex',
    difficulty: 'hard',
    modifiers: ['asteroid_field', 'isolated'],
    gridDimensions: { width: 24, height: 24 },
    startingResources: {
      energy: 500,
      ore: 300,
      titanium: 200,
    },
    startingCredits: 200,
    availableDeposits: ['ore', 'chrome', 'titanium', 'uranium'],
    depositDensity: 0.15,
    unlockRequirement: { type: 'technology', technologyId: 'spaceships' },
    theme: {
      name: 'Космический пояс',
      backgroundColor: '#0a0a1a',
      tileColors: {
        empty: '#1a1a2a',
        deposit: '#4a4a6a',
        building: '#2a2a4a',
        base: '#5a5a8a',
        blocked: '#000005',
      },
      ambientParticles: 'dust',
      borderColor: '#3a3a5a',
    },
    bonuses: [
      { type: 'production', resource: 'titanium', modifier: 1.5, description: '+50% производство титана' },
      { type: 'production', resource: 'chrome', modifier: 1.5, description: '+50% производство хрома' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // 🏛️ ДРЕВНИЕ РУИНЫ - Высший вызов
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'map_ancient_ruins',
    name: 'Древние Руины',
    emoji: '🏛️',
    description: 'Остатки древней цивилизации. Можно найти мощные артефакты, но опасность на каждом шагу.',
    size: 'large',
    gridType: 'hex',
    difficulty: 'nightmare',
    modifiers: ['ancient_ruins', 'hostile'],
    gridDimensions: { width: 20, height: 20 },
    startingResources: {
      energy: 250,
      ore: 100,
    },
    startingCredits: 100,
    availableDeposits: ['ore', 'ice', 'carbon', 'uranium', 'chrome', 'titanium', 'dark_matter'],
    depositDensity: 0.1,
    unlockRequirement: { type: 'ascension', ascensionLevel: 3 },
    theme: {
      name: 'Забытые руины',
      backgroundColor: '#1a1a15',
      tileColors: {
        empty: '#2a2a20',
        deposit: '#5a5a40',
        building: '#3a3a30',
        base: '#7a7a50',
      },
      ambientParticles: 'sparkles',
      borderColor: '#6a6a40',
    },
    bonuses: [
      { type: 'research', modifier: 1.5, description: '+50% скорость исследований' },
    ],
    specialEvents: [
      {
        id: 'artifact_discovery',
        name: 'Обнаружен артефакт',
        description: 'Найден древний артефакт с особыми свойствами',
        chance: 0.02,
        effect: { type: 'discover_artifact' },
      },
      {
        id: 'guardian_awakening',
        name: 'Пробуждение стража',
        description: 'Древние защитники атакуют базу',
        chance: 0.04,
        effect: { type: 'spawn_enemies', count: 5, strength: 3 },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // 🎨 ТВОРЧЕСКИЙ РЕЖИМ - Песочница без ограничений
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'map_creative',
    name: 'Творческий Режим',
    emoji: '🎨',
    description: 'Безграничная песочница для экспериментов. Все ресурсы, все технологии, без ограничений.',
    size: 'huge',
    gridType: 'square',
    difficulty: 'easy',
    modifiers: ['peaceful', 'rich_deposits', 'unlimited'],
    gridDimensions: { width: 200, height: 200 },
    startingResources: {
      energy: 1000000,
      ore: 100000,
      ice: 100000,
      carbon: 100000,
      copper: 100000,
      sand: 100000,
      titanium: 50000,
      chrome: 50000,
      uranium: 25000,
      oil: 50000,
    },
    startingCredits: 1000000,
    availableDeposits: ['ore', 'ice', 'carbon', 'copper', 'sand', 'titanium', 'chrome', 'uranium', 'oil'],
    depositDensity: 0.35,
    unlockRequirement: { type: 'none' },
    theme: {
      name: 'Творческая мастерская',
      backgroundColor: '#1a1a2a',
      tileColors: {
        empty: '#2a2a3a',
        deposit: '#5a5a7a',
        building: '#4a4a6a',
        base: '#7a7aaa',
      },
      ambientParticles: 'sparkles',
      borderColor: '#6a6a9a',
    },
    bonuses: [
      { type: 'production', modifier: 10.0, description: '+900% производство' },
      { type: 'research', modifier: 10.0, description: '+900% скорость исследований' },
      { type: 'building_cost', modifier: 0.01, description: '-99% стоимость строительства' },
      { type: 'energy', modifier: 10.0, description: '+900% выработка энергии' },
    ],
  },
];

/**
 * Получить определение карты по ID
 */
export function getMapDefinition(mapId: string): MapDefinition | undefined {
  return MAP_DEFINITIONS.find(m => m.id === mapId);
}

/**
 * Получить список разблокированных карт
 */
export function getUnlockedMaps(
  unlockedTechnologies: Set<string>,
  ascensionLevel: number,
  playtimeHours: number
): MapDefinition[] {
  return MAP_DEFINITIONS.filter(map => {
    const req = map.unlockRequirement;
    switch (req.type) {
      case 'none':
        return true;
      case 'technology':
        return req.technologyId ? unlockedTechnologies.has(req.technologyId) : true;
      case 'ascension':
        return ascensionLevel >= (req.ascensionLevel ?? 0);
      case 'playtime':
        return playtimeHours >= (req.playtimeHours ?? 0);
      default:
        return false;
    }
  });
}

/**
 * Получить карты по сложности
 */
export function getMapsByDifficulty(difficulty: string): MapDefinition[] {
  return MAP_DEFINITIONS.filter(m => m.difficulty === difficulty);
}

/**
 * Получить карты по типу сетки
 */
export function getMapsByGridType(gridType: 'square' | 'hex'): MapDefinition[] {
  return MAP_DEFINITIONS.filter(m => m.gridType === gridType);
}

// Экспорт ID карт для типизации
export const MAP_IDS = MAP_DEFINITIONS.map(m => m.id);
export type MapId = typeof MAP_IDS[number];
