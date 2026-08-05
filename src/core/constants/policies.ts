import type { Policy, PolicyCategory, PolicyId } from '../gameTypes';
import { D } from '../math/format';

// All available policies in the game
export const POLICIES: Record<PolicyId, Policy> = {
  // ============ PRODUCTION POLICIES (10) ============
  overtime: {
    id: 'overtime',
    name: 'Сверхурочная работа',
    description: '+30% производства всех ресурсов, но +50% потребления энергии',
    category: 'production',
    influenceCost: 100,
    influenceUpkeep: 2,
    effects: {
      productionMultiplier: 1.3,
      energyConsumptionMultiplier: 1.5,
    },
    risks: ['Высокая нагрузка на энергосистему'],
  },

  production_efficiency: {
    id: 'production_efficiency',
    name: 'Эффективность производства',
    description: '-20% расход ресурсов, но -10% скорость производства',
    category: 'production',
    influenceCost: 80,
    influenceUpkeep: 1.5,
    effects: {
      productionMultiplier: 0.9,
      specialEffect: 'reduces_consumption_20',
    },
  },

  gas_synthesis: {
    id: 'gas_synthesis',
    name: 'Газовый синтез',
    description: 'Газовые электростанции теперь производят бензин в качестве побочного продукта',
    category: 'production',
    influenceCost: 150,
    influenceUpkeep: 3,
    prerequisites: ['gas_power'],
    effects: {
      specialEffect: 'gas_power_produces_gasoline',
    },
  },

  double_silicon: {
    id: 'double_silicon',
    name: 'Двойной кремний',
    // Ресурса `silicon` в игре нет; кремниевая цепочка — sand -> semiconductors -> ИС.
    description: '+100% выпуска полупроводников, но +50% потребления энергии',
    category: 'production',
    influenceCost: 200,
    influenceUpkeep: 4,
    prerequisites: ['semiconductors'],
    effects: {
      specialEffect: 'double_silicon_production',
      energyConsumptionMultiplier: 1.5,
    },
  },

  smart_production: {
    id: 'smart_production',
    name: 'Умное производство',
    description: 'Автоматически останавливает убыточные производства',
    category: 'production',
    influenceCost: 250,
    influenceUpkeep: 5,
    prerequisites: ['automation'],
    effects: {
      specialEffect: 'auto_stop_unprofitable',
    },
  },

  waste_recycling: {
    id: 'waste_recycling',
    name: 'Переработка отходов',
    description: '10% израсходованных материалов возвращается обратно',
    category: 'production',
    influenceCost: 180,
    influenceUpkeep: 3.5,
    prerequisites: ['advanced_processing'],
    effects: {
      specialEffect: 'recycle_10_percent',
    },
  },

  robotization: {
    id: 'robotization',
    name: 'Роботизация',
    description: 'Каждый робот добавляет +5% к производству всех ресурсов',
    category: 'production',
    influenceCost: 300,
    influenceUpkeep: 6,
    prerequisites: ['robotics'],
    effects: {
      specialEffect: 'robots_boost_production',
    },
  },

  mass_production: {
    id: 'mass_production',
    name: 'Массовое производство',
    description: '+20% производство всех ресурсов, но -10% эффективности',
    category: 'production',
    influenceCost: 150,
    influenceUpkeep: 3,
    effects: {
      productionMultiplier: 1.2,
      specialEffect: 'quality_penalty_10',
    },
  },

  industrial_revolution: {
    id: 'industrial_revolution',
    name: 'Промышленная революция',
    description: '+15% производство всех ресурсов',
    category: 'production',
    influenceCost: 200,
    influenceUpkeep: 4,
    prerequisites: ['advanced_processing'],
    effects: {
      productionMultiplier: 1.15,
    },
  },

  chain_optimization: {
    id: 'chain_optimization',
    name: 'Оптимизация цепочек',
    description: '-15% время производства в производственных цепочках',
    category: 'production',
    influenceCost: 250,
    influenceUpkeep: 5,
    prerequisites: ['automation'],
    effects: {
      specialEffect: 'production_speed_15',
    },
  },

  // ============ ENERGY POLICIES (6) ============
  energy_saving: {
    id: 'energy_saving',
    name: 'Энергосбережение',
    description: '-30% потребление энергии, но -20% производство всех ресурсов',
    category: 'energy',
    influenceCost: 100,
    influenceUpkeep: 2,
    effects: {
      energyConsumptionMultiplier: 0.7,
      productionMultiplier: 0.8,
    },
  },

  energy_priority: {
    id: 'energy_priority',
    name: 'Приоритет энергии',
    description: 'Электростанции +50% производства, но +100% стоимость постройки',
    category: 'energy',
    influenceCost: 200,
    influenceUpkeep: 4,
    effects: {
      specialEffect: 'power_plants_boost_50',
      buildingCostMultiplier: 2.0,
    },
  },

  backup_energy: {
    id: 'backup_energy',
    name: 'Резервная энергия',
    description: 'Энергохранилища +100% емкость',
    category: 'energy',
    influenceCost: 150,
    influenceUpkeep: 3,
    effects: {
      specialEffect: 'energy_storage_double',
    },
  },

  atomic_boost: {
    id: 'atomic_boost',
    name: 'Атомный форсаж',
    description: 'Атомные электростанции +200% производства, но повышенный риск аварий',
    category: 'energy',
    influenceCost: 300,
    influenceUpkeep: 6,
    prerequisites: ['nuclear_power'],
    effects: {
      specialEffect: 'nuclear_boost_200',
    },
    risks: ['Риск радиоактивных аварий'],
  },

  solar_grid: {
    id: 'solar_grid',
    name: 'Солнечная сеть',
    description: 'Солнечные панели +50% производства энергии',
    category: 'energy',
    influenceCost: 120,
    influenceUpkeep: 2.5,
    prerequisites: ['solar_panels'],
    effects: {
      specialEffect: 'solar_boost_50',
    },
  },

  energy_independence: {
    id: 'energy_independence',
    name: 'Энергетическая независимость',
    // Потерь при передаче в игре нет — сеть бинарная, здание либо запитано, либо нет.
    // Единственная настоящая потеря энергии — дефицит, режущий всё производство.
    description: 'Просадка производства при нехватке энергии вдвое слабее',
    category: 'energy',
    influenceCost: 250,
    influenceUpkeep: 5,
    effects: {
      specialEffect: 'reduce_energy_loss',
    },
  },

  // ============ ECONOMIC POLICIES (6) ============
  free_market: {
    id: 'free_market',
    name: 'Свободный рынок',
    description: 'Торговля выгоднее на 25%: продажа дороже, закупка дешевле',
    category: 'economic',
    influenceCost: 150,
    influenceUpkeep: 3,
    effects: {
      /*
       * Было 0.8 при описании «цены -20%, выгоднее покупать». В сторе множитель работает
       * в одну сторону для обеих операций: выручка `price * tradeMult` (gameStore ~3385),
       * закупка `price / tradeMult` (~3441). То есть 0.8 делало продажу на 20% хуже И
       * закупку на 25% дороже — политика была строго вредной, хотя стоила 150 влияния
       * и 3/с содержания. Значение >1 — единственное, что соответствует названию.
       */
      tradePriceMultiplier: 1.25,
    },
  },

  export_economy: {
    id: 'export_economy',
    name: 'Экспортная экономика',
    description: 'Продажа ресурсов приносит +30% кредитов',
    category: 'economic',
    influenceCost: 180,
    influenceUpkeep: 3.5,
    effects: {
      specialEffect: 'export_bonus_30',
    },
  },

  tax_benefits: {
    id: 'tax_benefits',
    name: 'Налоговые льготы',
    description: 'Стоимость постройки зданий -15%',
    category: 'economic',
    influenceCost: 200,
    influenceUpkeep: 4,
    effects: {
      buildingCostMultiplier: 0.85,
    },
  },

  bitcoin_boom: {
    id: 'bitcoin_boom',
    name: 'Биткоин-бум',
    description: 'Биткоин-фермы и майнинг-риги производят +100% кредитов',
    category: 'economic',
    influenceCost: 250,
    influenceUpkeep: 5,
    effects: {
      specialEffect: 'bitcoin_farm_double',
    },
  },

  credit_program: {
    id: 'credit_program',
    name: 'Кредитная программа',
    description: '+10 кредитов в секунду пассивно',
    category: 'economic',
    influenceCost: 300,
    influenceUpkeep: 6,
    effects: {
      creditsPerSecond: D(10),
    },
  },

  trade_routes: {
    id: 'trade_routes',
    name: 'Торговые пути',
    description: 'Межгалактическая торговля дешевле на 25%',
    category: 'economic',
    influenceCost: 500,
    influenceUpkeep: 10,
    prerequisites: ['intergalactic_gates'],
    effects: {
      specialEffect: 'intergalactic_trade_discount',
    },
  },

  // ============ SCIENCE POLICIES (4) ============
  scientific_breakthrough: {
    id: 'scientific_breakthrough',
    name: 'Научный прорыв',
    description: '+50% производства очков исследований',
    category: 'science',
    influenceCost: 200,
    influenceUpkeep: 4,
    effects: {
      researchMultiplier: 1.5,
    },
  },

  quantum_computing: {
    id: 'quantum_computing',
    name: 'Квантовые вычисления',
    description: 'Квантовые компьютеры +100% производства RP',
    category: 'science',
    influenceCost: 300,
    influenceUpkeep: 6,
    prerequisites: ['quantum_tech'],
    effects: {
      specialEffect: 'quantum_computer_double',
    },
  },

  experimental_science: {
    id: 'experimental_science',
    name: 'Экспериментальная наука',
    description: '+100% производства RP, но есть риск неудач',
    category: 'science',
    influenceCost: 250,
    influenceUpkeep: 5,
    effects: {
      researchMultiplier: 2.0,
    },
    risks: ['Случайные потери ресурсов при экспериментах'],
  },

  academic_freedom: {
    id: 'academic_freedom',
    name: 'Академическая свобода',
    description: 'Случайные бонусы к исследованиям',
    category: 'science',
    influenceCost: 150,
    influenceUpkeep: 3,
    effects: {
      specialEffect: 'random_research_bonus',
    },
  },

  // ============ MILITARY POLICIES (4) ============
  military_economy: {
    id: 'military_economy',
    name: 'Военная экономика',
    description: 'Производство оружия и военных ресурсов +50%',
    category: 'military',
    influenceCost: 250,
    influenceUpkeep: 5,
    prerequisites: ['advanced_weapons'],
    effects: {
      specialEffect: 'military_production_50',
    },
  },

  defense_reinforcement: {
    id: 'defense_reinforcement',
    name: 'Укрепление обороны',
    description: 'Защитные платформы +100% прочности и урона',
    category: 'military',
    influenceCost: 300,
    influenceUpkeep: 6,
    prerequisites: ['defense_systems'],
    effects: {
      specialEffect: 'defense_double',
    },
  },

  aggressive_expansion: {
    id: 'aggressive_expansion',
    name: 'Агрессивная экспансия',
    description: '+50% урон по врагам, но -дипломатия с другими фракциями',
    category: 'military',
    influenceCost: 350,
    influenceUpkeep: 7,
    effects: {
      specialEffect: 'damage_boost_50',
    },
    risks: ['Ухудшение отношений с другими цивилизациями'],
  },

  peaceful_coexistence: {
    id: 'peaceful_coexistence',
    name: 'Мирное сосуществование',
    description: 'Меньше нападений демонов, но -30% военное производство',
    category: 'military',
    influenceCost: 200,
    influenceUpkeep: 4,
    effects: {
      specialEffect: 'reduce_demon_attacks',
    },
  },

  // ============ SPACE POLICIES (1) ============
  terraforming: {
    id: 'terraforming',
    name: 'Терраформирование',
    description: 'Новые планеты дают дополнительные ресурсы',
    category: 'space',
    influenceCost: 500,
    influenceUpkeep: 10,
    prerequisites: ['advanced_colonies'],
    effects: {
      specialEffect: 'planet_bonus_resources',
    },
  },

  // ============ SPECIAL POLICIES (6) ============
  eco_friendly: {
    id: 'eco_friendly',
    name: 'Экологичность',
    description: 'Мусор автоматически перерабатывается',
    category: 'special',
    influenceCost: 250,
    influenceUpkeep: 5,
    effects: {
      specialEffect: 'auto_recycle_waste',
    },
  },

  innovations: {
    id: 'innovations',
    name: 'Инновации',
    description: 'Шанс открыть случайную технологию бесплатно',
    category: 'special',
    influenceCost: 400,
    influenceUpkeep: 8,
    effects: {
      specialEffect: 'random_tech_unlock',
    },
  },

  megaprojects: {
    id: 'megaprojects',
    name: 'Мегапроекты',
    description: 'Разблокирует уникальные мегаструктуры',
    category: 'special',
    influenceCost: 600,
    influenceUpkeep: 12,
    prerequisites: ['megastructures'],
    effects: {
      specialEffect: 'unlock_megastructures',
    },
  },

  time_accelerator: {
    id: 'time_accelerator',
    name: 'Временной ускоритель',
    description: '+20% скорость игры, но огромные затраты энергии и влияния',
    category: 'special',
    influenceCost: 1000,
    influenceUpkeep: 20,
    prerequisites: ['time_control'],
    effects: {
      specialEffect: 'game_speed_20',
      energyConsumptionMultiplier: 2.0,
    },
    risks: ['Огромное потребление энергии и влияния'],
  },

  quantum_stability: {
    id: 'quantum_stability',
    name: 'Квантовая стабильность',
    description: 'Меньше случайных событий, более предсказуемая игра',
    category: 'special',
    influenceCost: 300,
    influenceUpkeep: 6,
    prerequisites: ['quantum_tech'],
    effects: {
      specialEffect: 'reduce_random_events',
    },
  },

  divine_machine: {
    id: 'divine_machine',
    name: 'Божественная машина',
    description: 'Финальная политика: небольшие бонусы ко всем параметрам',
    category: 'special',
    influenceCost: 2000,
    influenceUpkeep: 40,
    prerequisites: ['galactic_rule'],
    effects: {
      productionMultiplier: 1.1,
      researchMultiplier: 1.1,
      energyProductionMultiplier: 1.1,
      specialEffect: 'divine_machine_all_bonus',
    },
  },
};

// Helper function to check if policy can be activated
export function canActivatePolicy(
  policyId: PolicyId,
  currentInfluence: number,
  unlockedTechnologies: Record<string, boolean>,
  activePolicies: PolicyId[],
  maxActivePolicies: number
): { can: boolean; reason?: string } {
  const policy = POLICIES[policyId];
  
  // Check if already active
  if (activePolicies.includes(policyId)) {
    return { can: false, reason: 'Политика уже активна' };
  }
  
  // Check max active policies limit
  if (activePolicies.length >= maxActivePolicies) {
    return { can: false, reason: `Достигнут лимит активных политик (${maxActivePolicies})` };
  }
  
  // Check influence cost
  if (currentInfluence < policy.influenceCost) {
    return { can: false, reason: `Недостаточно влияния (требуется ${policy.influenceCost})` };
  }
  
  // Check prerequisites
  if (policy.prerequisites) {
    for (const techId of policy.prerequisites) {
      if (!unlockedTechnologies[techId]) {
        return { can: false, reason: `Требуется технология: ${techId}` };
      }
    }
  }
  
  return { can: true };
}

// Get policies by category
export function getPoliciesByCategory(category: PolicyCategory): Policy[] {
  return Object.values(POLICIES).filter(p => p.category === category);
}
