import type { Galaxy, GalaxyId, TechnologyId } from '../gameTypes';

export const GALAXIES: Record<GalaxyId, Galaxy> = {
  galaxy_1_nebula_beginning: {
    id: 'galaxy_1_nebula_beginning',
    name: '🌫️ Туманность Начала',
    description: 'Стартовая галактика, богатая базовыми ресурсами. Низкая опасность, идеальна для первых шагов.',
    dangerLevel: 'very_low',
    availableDeposits: ['ore', 'ice', 'carbon', 'copper', 'sand'],
    enemyTypes: ['scout', 'swarmer'],
    enemyLevelRange: [1, 3],
    bossChance: 0,
    theme: {
      backgroundColor: '#1a1a2e',
      tileColor: '#16213e',
    },
  },

  galaxy_2_gas_giants: {
    id: 'galaxy_2_gas_giants',
    name: '💨 Газовые Гиганты',
    description: 'Огромные газовые планеты, богатые природным газом и нефтью. Отлично подходят для энергетики.',
    dangerLevel: 'low',
    resourceBonuses: {
      natural_gas: 1.5,
      oil: 1.5,
      gasoline: 1.3,
    },
    availableDeposits: ['natural_gas', 'oil', 'carbon'],
    enemyTypes: ['scout', 'brute', 'pirate_fighter'],
    enemyLevelRange: [3, 6],
    bossChance: 0.05,
    unlockRequirement: 'gas_exploration',
    theme: {
      backgroundColor: '#1a2332',
      tileColor: '#0f4c75',
    },
  },

  galaxy_3_crystal_belts: {
    id: 'galaxy_3_crystal_belts',
    name: '💎 Кристальные Пояса',
    description: 'Астероидные пояса с огромным количеством кремния и кристаллов. Бонус к производству электроники.',
    dangerLevel: 'medium',
    resourceBonuses: {
      semiconductors: 1.2,
      integrated_circuit: 1.2,
      computer: 1.15,
      display: 1.15,
    },
    availableDeposits: ['sand', 'copper', 'ice'],
    enemyTypes: ['scout', 'brute', 'swarmer', 'pirate_fighter', 'pirate_raider'],
    enemyLevelRange: [5, 9],
    bossChance: 0.1,
    unlockRequirement: 'semiconductors',
    theme: {
      backgroundColor: '#1f1f3a',
      tileColor: '#3a3a5c',
    },
  },

  galaxy_4_uranium_depths: {
    id: 'galaxy_4_uranium_depths',
    name: '☢️ Урановые Недра',
    description: 'Опасная галактика с высоким уровнем радиации, но богатая ураном и радиоактивными материалами.',
    dangerLevel: 'high',
    resourceBonuses: {
      uranium: 2.0,
      enriched_uranium: 1.5,
      nuclear_bomb: 1.3,
    },
    availableDeposits: ['uranium', 'ore', 'carbon'],
    enemyTypes: ['brute', 'swarmer', 'pirate_destroyer', 'void_hunter'],
    enemyLevelRange: [8, 12],
    bossChance: 0.15,
    unlockRequirement: 'nuclear_physics',
    theme: {
      backgroundColor: '#1a2a1a',
      tileColor: '#2d4a2d',
    },
  },

  galaxy_5_metal_asteroids: {
    id: 'galaxy_5_metal_asteroids',
    name: '⚙️ Металлические Астероиды',
    description: 'Астероидное поле из редких металлов: хром, титан, вольфрам. Идеально для продвинутого производства.',
    dangerLevel: 'high',
    resourceBonuses: {
      chrome: 1.8,
      titanium: 1.8,
      chrome_alloy: 1.4,
      titanium_alloy: 1.4,
    },
    availableDeposits: ['chrome', 'titanium', 'ore', 'copper'],
    enemyTypes: ['void_hunter', 'plasma_bomber', 'heavy_assault', 'elite_interceptor'],
    enemyLevelRange: [10, 15],
    bossChance: 0.2,
    unlockRequirement: 'interplanetary',
    theme: {
      backgroundColor: '#2a2a2a',
      tileColor: '#3f3f3f',
    },
  },

  galaxy_6_energy_nebula: {
    id: 'galaxy_6_energy_nebula',
    name: '⚡ Туманность Энергии',
    description: 'Экзотическая туманность, полная энергетических аномалий. Огромные бонусы к производству энергии.',
    dangerLevel: 'very_high',
    resourceBonuses: {
      energy: 2.5,
      liquid_fuel: 1.5,
    },
    availableDeposits: ['oil', 'natural_gas', 'uranium'],
    enemyTypes: ['void_hunter', 'plasma_bomber', 'heavy_assault', 'elite_interceptor', 'ancient_guardian'],
    enemyLevelRange: [15, 18],
    bossChance: 0.25,
    unlockRequirement: 'quantum_tech',
    theme: {
      backgroundColor: '#1a1a3e',
      tileColor: '#2e2e5e',
    },
  },

  galaxy_7_ancient_ruins: {
    id: 'galaxy_7_ancient_ruins',
    name: '🏛️ Древние Руины',
    description: 'Остатки древней цивилизации. Опасные стражи охраняют невероятные технологии и артефакты.',
    dangerLevel: 'extreme',
    resourceBonuses: {
      robot: 1.5,
      computer: 1.3,
      space_station: 1.5,
      spaceship: 1.3,
    },
    availableDeposits: ['ore', 'copper', 'sand', 'uranium', 'chrome', 'titanium'],
    enemyTypes: ['ancient_sentinel', 'ancient_warden', 'ancient_colossus', 'rogue_ai_scout', 'rogue_ai_destroyer'],
    enemyLevelRange: [18, 25],
    bossChance: 0.35,
    unlockRequirement: 'galactic_fleet',
    theme: {
      backgroundColor: '#1a1a1a',
      tileColor: '#2a2a3a',
    },
  },
};

// Helper function to check if a galaxy can be unlocked
export function canUnlockGalaxy(galaxyId: GalaxyId, unlockedTechnologies: Record<TechnologyId, boolean>): boolean {
  const galaxy = GALAXIES[galaxyId];
  
  // Galaxy 1 is always available
  if (galaxyId === 'galaxy_1_nebula_beginning') {
    return true;
  }
  
  // Check technology requirement
  if (galaxy.unlockRequirement) {
    return unlockedTechnologies[galaxy.unlockRequirement] === true;
  }
  
  return false;
}

// Get list of available galaxies based on unlocked technologies
export function getAvailableGalaxies(unlockedTechnologies: Record<TechnologyId, boolean>): GalaxyId[] {
  return Object.keys(GALAXIES).filter((galaxyId) =>
    canUnlockGalaxy(galaxyId as GalaxyId, unlockedTechnologies)
  ) as GalaxyId[];
}

// Get resource production bonus for a specific resource in a galaxy
export function getGalaxyResourceBonus(galaxyId: GalaxyId, resourceType: string): number {
  const galaxy = GALAXIES[galaxyId];
  return galaxy.resourceBonuses?.[resourceType as keyof typeof galaxy.resourceBonuses] || 1.0;
}

// Get danger level as a numeric value for calculations
export function getDangerLevelValue(dangerLevel: Galaxy['dangerLevel']): number {
  const dangerMap = {
    very_low: 1,
    low: 2,
    medium: 3,
    high: 4,
    very_high: 5,
    extreme: 6,
  };
  return dangerMap[dangerLevel];
}
