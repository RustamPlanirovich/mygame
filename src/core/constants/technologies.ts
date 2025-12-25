import type { Technology, TechnologyId } from '../gameTypes';

// Complete technology tree organized by era
export const TECHNOLOGIES: Record<TechnologyId, Technology> = {
  // ERA 1: ВОССТАНОВЛЕНИЕ (Recovery)
  basic_mining: {
    id: 'basic_mining',
    name: 'Базовая добыча',
    description: 'Открывает доступ к базовым ресурсам: уголь, железо, медь',
    era: 1,
    cost: 0, // Starting technology
    prerequisites: [],
    unlocks: {
      buildings: ['coal_mine', 'iron_mine', 'copper_mine'],
      resources: ['ore', 'carbon', 'copper']
    }
  },
  simple_power: {
    id: 'simple_power',
    name: 'Простые электростанции',
    description: 'Разблокирует первые источники энергии на основе угля',
    era: 1,
    cost: 150,
    prerequisites: ['basic_mining'],
    unlocks: {
      buildings: ['coal_power_plant']
    }
  },
  basic_processing: {
    id: 'basic_processing',
    name: 'Базовая переработка',
    description: 'Позволяет перерабатывать руду в сталь и другие базовые материалы',
    era: 1,
    cost: 250,
    prerequisites: ['basic_mining'],
    unlocks: {
      buildings: ['steel_mill'],
      resources: ['steel']
    }
  },
  solar_panels: {
    id: 'solar_panels',
    name: 'Солнечные панели',
    description: 'Чистая и эффективная энергия от солнца',
    era: 1,
    cost: 600,
    prerequisites: ['simple_power'],
    unlocks: {
      buildings: ['solar_panel']
    }
  },

  // ERA 2: ИНДУСТРИАЛИЗАЦИЯ (Industrialization)
  gas_exploration: {
    id: 'gas_exploration',
    name: 'Газовая разведка',
    description: 'Технология добычи природного газа',
    era: 2,
    cost: 1200,
    prerequisites: ['basic_mining'],
    unlocks: {
      buildings: ['gas_well'],
      resources: ['natural_gas']
    }
  },
  oil_drilling: {
    id: 'oil_drilling',
    name: 'Нефтедобыча',
    description: 'Разведка и добыча нефти из недр планеты',
    era: 2,
    cost: 1800,
    prerequisites: ['gas_exploration'],
    unlocks: {
      buildings: ['oil_well'],
      resources: ['oil']
    }
  },
  advanced_processing: {
    id: 'advanced_processing',
    name: 'Продвинутая переработка',
    description: 'Сложные химические процессы переработки',
    era: 2,
    cost: 2200,
    prerequisites: ['basic_processing'],
    unlocks: {
      buildings: ['oil_refinery', 'gas_refinery', 'chemical_plant'],
      resources: ['gasoline', 'chemicals']
    }
  },
  plastics_glass: {
    id: 'plastics_glass',
    name: 'Пластик и стекло',
    description: 'Производство пластмасс и стекла для промышленности',
    era: 2,
    cost: 3200,
    prerequisites: ['advanced_processing'],
    unlocks: {
      buildings: ['glass_factory'],
      resources: ['plastic', 'glass']
    }
  },
  semiconductors: {
    id: 'semiconductors',
    name: 'Полупроводники',
    description: 'Основа современной электроники',
    era: 2,
    cost: 5500,
    prerequisites: ['plastics_glass'],
    unlocks: {
      buildings: ['semiconductor_factory', 'sand_quarry'],
      resources: ['semiconductors', 'sand']
    }
  },
  gas_power: {
    id: 'gas_power',
    name: 'Газовые электростанции',
    description: 'Эффективная генерация энергии из природного газа',
    era: 2,
    cost: 4500,
    prerequisites: ['gas_exploration', 'simple_power'],
    unlocks: {
      buildings: ['gas_power_plant']
    }
  },

  // ERA 3: ЭЛЕКТРОНИКА (Electronics)
  microchips: {
    id: 'microchips',
    name: 'Микросхемы',
    description: 'Интегральные схемы для сложных устройств',
    era: 3,
    cost: 8000,
    prerequisites: ['semiconductors'],
    unlocks: {
      buildings: ['integrated_circuit_factory'],
      resources: ['integrated_circuit']
    }
  },
  computers: {
    id: 'computers',
    name: 'Компьютеры',
    description: 'Вычислительные машины нового поколения',
    era: 3,
    cost: 12000,
    prerequisites: ['microchips'],
    unlocks: {
      buildings: ['computer_factory'],
      resources: ['computer']
    }
  },
  displays: {
    id: 'displays',
    name: 'Экраны',
    description: 'Производство дисплеев и экранов',
    era: 3,
    cost: 10000,
    prerequisites: ['microchips'],
    unlocks: {
      buildings: ['display_factory'],
      resources: ['display']
    }
  },
  robotics: {
    id: 'robotics',
    name: 'Роботы',
    description: 'Автоматизированные машины для производства',
    era: 3,
    cost: 12000,
    prerequisites: ['computers'],
    unlocks: {
      buildings: ['robot_factory'],
      resources: ['robot']
    }
  },
  automation: {
    id: 'automation',
    name: 'Автоматизация производства',
    description: 'Полностью автоматизированные производственные линии',
    era: 3,
    cost: 18000,
    prerequisites: ['robotics'],
    unlocks: {
      buildings: ['logistics_center', 'resource_accelerator']
    }
  },

  // ERA 4: ВОЕННАЯ ПРОМЫШЛЕННОСТЬ (Military Industry)
  advanced_weapons: {
    id: 'advanced_weapons',
    name: 'Продвинутое оружие',
    description: 'Современные системы вооружений',
    era: 4,
    cost: 22000,
    prerequisites: ['automation'],
    unlocks: {
      buildings: ['weapon_factory'],
      resources: ['weapon']
    }
  },
  artillery: {
    id: 'artillery',
    name: 'Артиллерия',
    description: 'Тяжелое артиллерийское вооружение',
    era: 4,
    cost: 28000,
    prerequisites: ['advanced_weapons'],
    unlocks: {
      buildings: ['artillery_factory'],
      resources: ['artillery']
    }
  },
  defense_systems: {
    id: 'defense_systems',
    name: 'Защитные системы',
    description: 'Оборонительные сооружения и щиты',
    era: 4,
    cost: 30000,
    prerequisites: ['advanced_weapons'],
    unlocks: {
      buildings: ['defense_platform', 'turret', 'defense_turret_mk1', 'shield_generator_mk1', 'armor_plating_mk1']
    }
  },
  radar_tech: {
    id: 'radar_tech',
    name: 'Радары',
    description: 'Системы обнаружения и наведения',
    era: 4,
    cost: 28000,
    prerequisites: ['advanced_weapons'],
    unlocks: {
      buildings: ['radar_factory', 'radar_station_mk1'],
      resources: ['radar']
    }
  },
  nuclear_physics: {
    id: 'nuclear_physics',
    name: 'Ядерная физика',
    description: 'Исследование атомного ядра и радиации',
    era: 4,
    cost: 35000,
    prerequisites: ['defense_systems'],
    unlocks: {
      buildings: ['uranium_mine', 'uranium_enrichment_plant'],
      resources: ['uranium', 'enriched_uranium']
    }
  },
  nuclear_power: {
    id: 'nuclear_power',
    name: 'Атомная энергия',
    description: 'Чистая и мощная атомная энергетика',
    era: 4,
    cost: 45000,
    prerequisites: ['nuclear_physics'],
    unlocks: {
      buildings: ['nuclear_power_plant', 'nuclear_bomb_factory'],
      resources: ['nuclear_bomb']
    }
  },
  advanced_defense: {
    id: 'advanced_defense',
    name: 'Продвинутая оборона',
    description: 'Улучшенные оборонительные системы для защиты платформ',
    era: 4,
    cost: 55000,
    prerequisites: ['defense_systems', 'radar_tech'],
    unlocks: {
      buildings: ['defense_turret_mk2', 'shield_generator_mk2']
    }
  },

  // ERA 5: КОСМИЧЕСКАЯ ЭРА (Space Era)
  rocket_science: {
    id: 'rocket_science',
    name: 'Ракетная техника',
    description: 'Технология создания ракет и реактивных двигателей',
    era: 5,
    cost: 50000,
    prerequisites: ['nuclear_power'],
    unlocks: {
      buildings: ['jet_engine_factory'],
      resources: ['jet_engine']
    }
  },
  satellites: {
    id: 'satellites',
    name: 'Спутники',
    description: 'Искусственные спутники для связи и наблюдения',
    era: 5,
    cost: 60000,
    prerequisites: ['rocket_science'],
    unlocks: {
      buildings: ['satellite_factory'],
      resources: ['satellite']
    }
  },
  spaceships: {
    id: 'spaceships',
    name: 'Космические корабли',
    description: 'Корабли для полетов в космосе',
    era: 5,
    cost: 80000,
    prerequisites: ['satellites'],
    unlocks: {
      buildings: ['rocket_factory', 'spaceship_factory'],
      resources: ['rocket', 'spaceship']
    }
  },
  interplanetary: {
    id: 'interplanetary',
    name: 'Межпланетные путешествия',
    description: 'Технологии для путешествий между планетами',
    era: 5,
    cost: 100000,
    prerequisites: ['spaceships'],
    unlocks: {
      buildings: ['console_factory'],
      resources: ['console']
    }
  },
  first_colony: {
    id: 'first_colony',
    name: 'Первая колония',
    description: 'Создание первых внепланетных поселений',
    era: 5,
    cost: 120000,
    prerequisites: ['interplanetary'],
    unlocks: {
      buildings: ['space_colony']
    }
  },

  // ERA 6: ГАЛАКТИЧЕСКАЯ ЭКСПАНСИЯ (Galactic Expansion)
  intergalactic_gates: {
    id: 'intergalactic_gates',
    name: 'Межгалактические врата',
    description: 'Мгновенные перемещения между галактиками',
    era: 6,
    cost: 150000,
    prerequisites: ['first_colony'],
    unlocks: {
      buildings: []
    }
  },
  space_stations: {
    id: 'space_stations',
    name: 'Космические станции',
    description: 'Огромные орбитальные комплексы',
    era: 6,
    cost: 200000,
    prerequisites: ['intergalactic_gates'],
    unlocks: {
      buildings: ['space_station_factory'],
      resources: ['space_station']
    }
  },
  quantum_tech: {
    id: 'quantum_tech',
    name: 'Квантовые технологии',
    description: 'Управление квантовыми состояниями материи',
    era: 6,
    cost: 250000,
    prerequisites: ['space_stations'],
    unlocks: {
      buildings: ['quantum_lab']
    }
  },
  advanced_colonies: {
    id: 'advanced_colonies',
    name: 'Продвинутые колонии',
    description: 'Самодостаточные колонии нового поколения',
    era: 6,
    cost: 300000,
    prerequisites: ['quantum_tech'],
    unlocks: {
      buildings: []
    }
  },
  galactic_fleet: {
    id: 'galactic_fleet',
    name: 'Галактический флот',
    description: 'Огромный военный флот для контроля галактики',
    era: 6,
    cost: 400000,
    prerequisites: ['advanced_colonies'],
    unlocks: {
      buildings: []
    }
  },

  // ERA 7: ДОМИНАЦИЯ (Domination)
  megastructures: {
    id: 'megastructures',
    name: 'Мегаструктуры',
    description: 'Гигантские космические сооружения: Сфера Дайсона и Кольцо-Мир',
    era: 7,
    cost: 500000,
    prerequisites: ['galactic_fleet'],
    unlocks: {
      buildings: [],
      special: ['dyson_sphere', 'ring_world'] // Мегаструктуры
    }
  },
  time_control: {
    id: 'time_control',
    name: 'Контроль времени',
    description: 'Манипуляции с пространством-временем для ускорения процессов',
    era: 7,
    cost: 700000,
    prerequisites: ['megastructures'],
    unlocks: {
      buildings: [],
      special: ['time_acceleration_policy'] // Разблокирует особые политики
    }
  },
  quantum_teleport: {
    id: 'quantum_teleport',
    name: 'Квантовая телепортация',
    description: 'Мгновенное перемещение материи. Открывает доступ к Вратам между Измерениями',
    era: 7,
    cost: 900000,
    prerequisites: ['time_control'],
    unlocks: {
      buildings: [],
      special: ['dimensional_gate'] // Мегаструктура
    }
  },
  ai_restoration: {
    id: 'ai_restoration',
    name: 'Полное восстановление ИИ',
    description: 'Восстановление всех систем древнего ИИ. Разблокирует Квантовый Суперкомпьютер',
    era: 7,
    cost: 1200000,
    prerequisites: ['quantum_teleport'],
    unlocks: {
      buildings: [],
      special: ['quantum_supercomputer'] // Финальная мегаструктура
    }
  },
  galactic_rule: {
    id: 'galactic_rule',
    name: 'Галактическое правление',
    description: 'Полный контроль над галактикой. Открывает путь к концовкам игры',
    era: 7,
    cost: 1500000,
    prerequisites: ['ai_restoration'],
    unlocks: {
      buildings: [],
      special: ['game_endings'] // Разблокирует систему концовок
    }
  }
};

// Helper function to check if a technology can be researched
export function canResearchTechnology(
  techId: TechnologyId,
  unlockedTechs: Record<TechnologyId, boolean>,
  researchPoints: number
): boolean {
  const tech = TECHNOLOGIES[techId];
  
  // Already unlocked
  if (unlockedTechs[techId]) {
    return false;
  }
  
  // Check if enough research points
  if (researchPoints < tech.cost) {
    return false;
  }
  
  // Check prerequisites
  for (const prereq of tech.prerequisites) {
    if (!unlockedTechs[prereq]) {
      return false;
    }
  }
  
  return true;
}

// Get all technologies for a specific era
export function getTechnologiesByEra(era: number): Technology[] {
  return Object.values(TECHNOLOGIES).filter(tech => tech.era === era);
}

// Get tech tree structure for visualization
export function getTechTreeStructure() {
  const eras = new Map<number, Technology[]>();
  
  for (const tech of Object.values(TECHNOLOGIES)) {
    if (!eras.has(tech.era)) {
      eras.set(tech.era, []);
    }
    eras.get(tech.era)!.push(tech);
  }
  
  return Array.from(eras.entries())
    .sort(([a], [b]) => a - b)
    .map(([era, techs]) => ({ era, technologies: techs }));
}

export const ERA_NAMES: Record<number, string> = {
  1: 'Эра 1: Восстановление',
  2: 'Эра 2: Индустриализация',
  3: 'Эра 3: Электроника',
  4: 'Эра 4: Военная промышленность',
  5: 'Эра 5: Космическая эра',
  6: 'Эра 6: Галактическая экспансия',
  7: 'Эра 7: Доминация'
};

// Check if a building is unlocked based on technologies
export function isBuildingUnlocked(
  buildingId: string,
  unlockedTechs: Record<TechnologyId, boolean>
): boolean {
  // Find which technology unlocks this building
  for (const tech of Object.values(TECHNOLOGIES)) {
    if (tech.unlocks.buildings?.includes(buildingId)) {
      // Check if this technology is unlocked
      if (!unlockedTechs[tech.id]) {
        return false; // Building is locked
      }
    }
  }
  
  // If no technology specifies this building, it's unlocked by default (legacy buildings)
  return true;
}

// Get the technology that unlocks a building
export function getTechnologyForBuilding(buildingId: string): Technology | null {
  for (const tech of Object.values(TECHNOLOGIES)) {
    if (tech.unlocks.buildings?.includes(buildingId)) {
      return tech;
    }
  }
  return null;
}
