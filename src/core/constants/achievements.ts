import Decimal from 'break_eternity.js';
import type { Achievement, AchievementCategory } from '../gameTypes';

/**
 * Фаза 8.7: Система достижений
 * 50+ достижений различных категорий
 */

export const ACHIEVEMENTS: Achievement[] = [
  // ==================== CONSTRUCTION (Строительство) ====================
  {
    id: 'first_steps',
    name: 'Первые шаги',
    description: 'Постройте 10 зданий',
    category: 'construction',
    icon: '🏗️',
    requirement: {
      type: 'building_count',
      target: 10,
    },
    reward: {
      credits: new Decimal(500),
    },
  },
  {
    id: 'industrial_powerhouse',
    name: 'Промышленная держава',
    description: 'Постройте 50 зданий',
    category: 'construction',
    icon: '🏭',
    requirement: {
      type: 'building_count',
      target: 50,
    },
    reward: {
      credits: new Decimal(5000),
      researchPoints: new Decimal(1000),
    },
  },
  {
    id: 'metropolis',
    name: 'Мегаполис',
    description: 'Постройте 100 зданий без единого предупреждения о размещении',
    category: 'construction',
    icon: '🌆',
    requirement: {
      type: 'building_count',
      target: 100,
    },
    reward: {
      credits: new Decimal(25000),
      influence: new Decimal(500),
    },
  },
  {
    id: 'perfect_district',
    name: 'Идеальный район',
    description: 'Постройте 10 зданий с оптимальной синергией (все с бонусами)',
    category: 'construction',
    icon: '✨',
    requirement: {
      type: 'synergy_buildings',
      target: 10,
    },
    reward: {
      researchPoints: new Decimal(2000),
    },
  },
  {
    id: 'skyscraper',
    name: 'Небоскрёб',
    description: 'Улучшите одно здание до 100 уровня',
    category: 'construction',
    icon: '🏢',
    requirement: {
      type: 'special',
      target: 100,
      customCheck: 'max_building_level',
    },
    reward: {
      credits: new Decimal(10000),
    },
  },
  {
    id: 'mega_structure',
    name: 'Мегаструктура',
    description: 'Улучшите одно здание до 500 уровня',
    category: 'construction',
    icon: '🗼',
    requirement: {
      type: 'special',
      target: 500,
      customCheck: 'max_building_level',
    },
    reward: {
      credits: new Decimal(100000),
      influence: new Decimal(1000),
    },
  },

  // ==================== PRODUCTION (Производство) ====================
  {
    id: 'miner',
    name: 'Шахтёр',
    description: 'Добудьте 10,000 руды',
    category: 'production',
    icon: '⛏️',
    requirement: {
      type: 'resource_amount',
      target: 10000,
      specificResource: 'ore',
    },
    reward: {
      credits: new Decimal(1000),
    },
  },
  {
    id: 'steel_tycoon',
    name: 'Стальной магнат',
    description: 'Произведите 50,000 стали',
    category: 'production',
    icon: '🔩',
    requirement: {
      type: 'resource_amount',
      target: 50000,
      specificResource: 'steel',
    },
    reward: {
      credits: new Decimal(5000),
    },
  },
  {
    id: 'ecologist',
    name: 'Эколог',
    description: 'Поддерживайте 0 мусора при наличии 50+ производственных зданий',
    category: 'production',
    icon: '♻️',
    requirement: {
      type: 'zero_waste',
      target: 50,
    },
    reward: {
      influence: new Decimal(1000),
      researchPoints: new Decimal(3000),
    },
  },
  {
    id: 'computer_age',
    name: 'Компьютерная эра',
    description: 'Произведите 1,000 компьютеров',
    category: 'production',
    icon: '💻',
    requirement: {
      type: 'resource_amount',
      target: 1000,
      specificResource: 'computer',
    },
    reward: {
      researchPoints: new Decimal(5000),
    },
  },
  {
    id: 'space_industry',
    name: 'Космическая индустрия',
    description: 'Произведите 100 космических кораблей',
    category: 'production',
    icon: '🚀',
    requirement: {
      type: 'resource_amount',
      target: 100,
      specificResource: 'spaceship',
    },
    reward: {
      credits: new Decimal(50000),
      influence: new Decimal(2000),
    },
  },
  {
    id: 'nuclear_power',
    name: 'Атомная держава',
    description: 'Произведите 50 атомных бомб',
    category: 'production',
    icon: '☢️',
    requirement: {
      type: 'resource_amount',
      target: 50,
      specificResource: 'nuclear_bomb',
    },
    reward: {
      credits: new Decimal(20000),
    },
  },

  // ==================== RESEARCH (Исследования) ====================
  {
    id: 'scientist',
    name: 'Учёный',
    description: 'Исследуйте 5 технологий',
    category: 'research',
    icon: '🔬',
    requirement: {
      type: 'technology_count',
      target: 5,
    },
    reward: {
      researchPoints: new Decimal(500),
    },
  },
  {
    id: 'innovator',
    name: 'Новатор',
    description: 'Исследуйте 20 технологий',
    category: 'research',
    icon: '💡',
    requirement: {
      type: 'technology_count',
      target: 20,
    },
    reward: {
      researchPoints: new Decimal(5000),
    },
  },
  {
    id: 'tech_master',
    name: 'Мастер технологий',
    description: 'Исследуйте все технологии',
    category: 'research',
    icon: '🎓',
    requirement: {
      type: 'technology_count',
      target: 50, // Approximate number of all technologies
    },
    reward: {
      credits: new Decimal(100000),
      influence: new Decimal(5000),
    },
  },
  {
    id: 'quantum_genius',
    name: 'Квантовый гений',
    description: 'Разблокируйте квантовые технологии',
    category: 'research',
    icon: '⚛️',
    requirement: {
      type: 'special',
      target: 1,
      customCheck: 'has_quantum_tech',
    },
    reward: {
      researchPoints: new Decimal(10000),
    },
  },

  // ==================== ENERGY (Энергетика) ====================
  {
    id: 'power_plant',
    name: 'Электростанция',
    description: 'Достигните 100 кВт энергопроизводства',
    category: 'production',
    icon: '⚡',
    requirement: {
      type: 'energy_production',
      target: 100,
    },
    reward: {
      credits: new Decimal(2000),
    },
  },
  {
    id: 'energy_magnate',
    name: 'Энергетический магнат',
    description: 'Достигните 1000 кВт энергопроизводства',
    category: 'production',
    icon: '⚡',
    requirement: {
      type: 'energy_production',
      target: 1000,
    },
    reward: {
      credits: new Decimal(20000),
      influence: new Decimal(1000),
    },
  },
  {
    id: 'solar_empire',
    name: 'Солнечная империя',
    description: 'Постройте 50 солнечных панелей',
    category: 'construction',
    icon: '☀️',
    requirement: {
      type: 'building_count',
      target: 50,
      specificBuilding: 'solar_panel',
    },
    reward: {
      credits: new Decimal(5000),
    },
  },
  {
    id: 'nuclear_engineer',
    name: 'Ядерный инженер',
    description: 'Постройте атомную электростанцию',
    category: 'construction',
    icon: '☢️',
    requirement: {
      type: 'building_count',
      target: 1,
      specificBuilding: 'nuclear_power_plant',
    },
    reward: {
      researchPoints: new Decimal(3000),
    },
  },

  // ==================== EXPLORATION (Исследование) ====================
  {
    id: 'explorer',
    name: 'Исследователь',
    description: 'Откройте 3 галактики',
    category: 'exploration',
    icon: '🌌',
    requirement: {
      type: 'galaxy_count',
      target: 3,
    },
    reward: {
      influence: new Decimal(500),
    },
  },
  {
    id: 'star_cartographer',
    name: 'Звёздный картограф',
    description: 'Откройте все 7 галактик',
    category: 'exploration',
    icon: '🗺️',
    requirement: {
      type: 'galaxy_count',
      target: 7,
    },
    reward: {
      credits: new Decimal(50000),
      influence: new Decimal(5000),
    },
  },
  {
    id: 'platform_builder',
    name: 'Строитель платформ',
    description: 'Постройте 10 космических платформ',
    category: 'exploration',
    icon: '🛰️',
    requirement: {
      type: 'special',
      target: 10,
      customCheck: 'platform_count',
    },
    reward: {
      credits: new Decimal(10000),
    },
  },
  {
    id: 'galactic_empire',
    name: 'Галактическая империя',
    description: 'Постройте 50 космических платформ',
    category: 'exploration',
    icon: '👑',
    requirement: {
      type: 'special',
      target: 50,
      customCheck: 'platform_count',
    },
    reward: {
      credits: new Decimal(100000),
      influence: new Decimal(10000),
    },
  },

  // ==================== COMBAT (Боевые) ====================
  {
    id: 'first_blood',
    name: 'Первая кровь',
    description: 'Победите первого врага',
    category: 'combat',
    icon: '⚔️',
    requirement: {
      type: 'combat_wins',
      target: 1,
    },
    reward: {
      credits: new Decimal(500),
    },
  },
  {
    id: 'demon_slayer',
    name: 'Убийца демонов',
    description: 'Победите 100 врагов',
    category: 'combat',
    icon: '🗡️',
    requirement: {
      type: 'combat_wins',
      target: 100,
    },
    reward: {
      credits: new Decimal(10000),
      influence: new Decimal(1000),
    },
  },
  {
    id: 'fleet_commander',
    name: 'Командующий флотом',
    description: 'Постройте 100 кораблей',
    category: 'combat',
    icon: '🛸',
    requirement: {
      type: 'ship_count',
      target: 100,
    },
    reward: {
      credits: new Decimal(50000),
      influence: new Decimal(3000),
    },
  },
  {
    id: 'boss_hunter',
    name: 'Охотник на боссов',
    description: 'Победите 10 боссов',
    category: 'combat',
    icon: '👹',
    requirement: {
      type: 'special',
      target: 10,
      customCheck: 'boss_kills',
    },
    reward: {
      credits: new Decimal(25000),
      researchPoints: new Decimal(5000),
    },
  },
  {
    id: 'fortress',
    name: 'Крепость',
    description: 'Постройте 20 оборонительных турелей',
    category: 'combat',
    icon: '🏰',
    requirement: {
      type: 'special',
      target: 20,
      customCheck: 'defense_turret_count',
    },
    reward: {
      credits: new Decimal(5000),
    },
  },
  {
    id: 'invincible',
    name: 'Непобедимый',
    description: 'Отразите 50 атак без потери платформ',
    category: 'combat',
    icon: '🛡️',
    requirement: {
      type: 'special',
      target: 50,
      customCheck: 'attacks_defended',
    },
    reward: {
      influence: new Decimal(5000),
    },
  },

  // ==================== ECONOMY (Экономика) ====================
  {
    id: 'businessman',
    name: 'Бизнесмен',
    description: 'Накопите 100,000 кредитов',
    category: 'economy',
    icon: '💰',
    requirement: {
      type: 'credits_earned',
      target: 100000,
    },
    reward: {
      credits: new Decimal(10000),
    },
  },
  {
    id: 'millionaire',
    name: 'Миллионер',
    description: 'Накопите 1,000,000 кредитов',
    category: 'economy',
    icon: '💎',
    requirement: {
      type: 'credits_earned',
      target: 1000000,
    },
    reward: {
      credits: new Decimal(100000),
      influence: new Decimal(5000),
    },
  },
  {
    id: 'trader',
    name: 'Торговец',
    description: 'Выполните 50 контрактов на рынке',
    category: 'economy',
    icon: '📊',
    requirement: {
      type: 'special',
      target: 50,
      customCheck: 'contracts_completed',
    },
    reward: {
      credits: new Decimal(15000),
    },
  },
  {
    id: 'market_master',
    name: 'Мастер рынка',
    description: 'Выполните 200 контрактов на рынке',
    category: 'economy',
    icon: '📈',
    requirement: {
      type: 'special',
      target: 200,
      customCheck: 'contracts_completed',
    },
    reward: {
      credits: new Decimal(50000),
      influence: new Decimal(2000),
    },
  },
  {
    id: 'bitcoin_miner',
    name: 'Биткоин-майнер',
    description: 'Постройте ферму биткоинов',
    category: 'economy',
    icon: '₿',
    requirement: {
      type: 'building_count',
      target: 1,
      specificBuilding: 'bitcoin_farm',
    },
    reward: {
      credits: new Decimal(5000),
    },
  },

  // ==================== SPECIAL (Специальные) ====================
  {
    id: 'politician',
    name: 'Политик',
    description: 'Активируйте первую политику',
    category: 'special',
    icon: '🎩',
    requirement: {
      type: 'special',
      target: 1,
      customCheck: 'policies_activated',
    },
    reward: {
      influence: new Decimal(500),
    },
  },
  {
    id: 'ruler',
    name: 'Правитель',
    description: 'Активируйте 10 различных политик',
    category: 'special',
    icon: '👑',
    requirement: {
      type: 'special',
      target: 10,
      customCheck: 'unique_policies_activated',
    },
    reward: {
      influence: new Decimal(5000),
    },
  },
  {
    id: 'recycler',
    name: 'Переработчик',
    description: 'Постройте 10 переработчиков мусора',
    category: 'special',
    icon: '♻️',
    requirement: {
      type: 'building_count',
      target: 10,
      specificBuilding: 'recycler_mk1',
    },
    reward: {
      influence: new Decimal(1000),
    },
  },
  {
    id: 'lucky',
    name: 'Везунчик',
    description: 'Получите редкий ресурс из случайного события',
    category: 'special',
    icon: '🍀',
    requirement: {
      type: 'special',
      target: 1,
      customCheck: 'rare_event_reward',
    },
    reward: {
      credits: new Decimal(5000),
    },
    hidden: true,
  },
  {
    id: 'survivor',
    name: 'Выживший',
    description: 'Переживите цепную реакцию без потери зданий',
    category: 'special',
    icon: '💥',
    requirement: {
      type: 'special',
      target: 1,
      customCheck: 'survived_chain_reaction',
    },
    reward: {
      researchPoints: new Decimal(3000),
    },
    hidden: true,
  },
  {
    id: 'time_traveler',
    name: 'Путешественник во времени',
    description: 'Активируйте политику "Временной ускоритель"',
    category: 'special',
    icon: '⏰',
    requirement: {
      type: 'special',
      target: 1,
      customCheck: 'time_accelerator_used',
    },
    reward: {
      influence: new Decimal(2000),
    },
    hidden: true,
  },
  {
    id: 'perfectionist',
    name: 'Перфекционист',
    description: 'Достигните 100% эффективности во всех районах',
    category: 'special',
    icon: '✨',
    requirement: {
      type: 'special',
      target: 1,
      customCheck: 'perfect_districts',
    },
    reward: {
      credits: new Decimal(50000),
      researchPoints: new Decimal(10000),
      influence: new Decimal(5000),
    },
    hidden: true,
  },
  {
    id: 'automation_master',
    name: 'Мастер автоматизации',
    description: 'Постройте 50 роботов',
    category: 'special',
    icon: '🤖',
    requirement: {
      type: 'resource_amount',
      target: 50,
      specificResource: 'robot',
    },
    reward: {
      researchPoints: new Decimal(5000),
    },
  },
  {
    id: 'space_station_commander',
    name: 'Командир космической станции',
    description: 'Постройте космическую станцию',
    category: 'special',
    icon: '🛰️',
    requirement: {
      type: 'resource_amount',
      target: 1,
      specificResource: 'space_station',
    },
    reward: {
      credits: new Decimal(25000),
      influence: new Decimal(3000),
    },
  },
  {
    id: 'caravan_master',
    name: 'Мастер караванов',
    description: 'Отправьте 100 успешных караванов между галактиками',
    category: 'special',
    icon: '🚚',
    requirement: {
      type: 'special',
      target: 100,
      customCheck: 'successful_caravans',
    },
    reward: {
      credits: new Decimal(30000),
    },
  },
  {
    id: 'logistic_genius',
    name: 'Логистический гений',
    description: 'Постройте 10 логистических центров',
    category: 'special',
    icon: '📦',
    requirement: {
      type: 'building_count',
      target: 10,
      specificBuilding: 'logistics_center',
    },
    reward: {
      credits: new Decimal(10000),
    },
  },
  
  // ==================== REPEATABLE RESEARCH (Повторяемые Исследования) ====================
  {
    id: 'first_repeatable',
    name: 'Первые Шаги Бесконечности',
    description: 'Купите первый уровень любого повторяемого исследования',
    category: 'research',
    icon: '🔬',
    requirement: {
      type: 'custom',
      check: (state) => {
        if (!state.repeatableResearch) return false;
        const totalLevels = Object.values(state.repeatableResearch.researches || {}).reduce(
          (sum, level) => sum + level,
          0
        );
        return totalLevels >= 1;
      },
    },
    reward: {
      credits: new Decimal(100000),
    },
  },
  {
    id: 'repeatable_level_25',
    name: 'Продвинутый Исследователь',
    description: 'Достигните 25 уровня в любом повторяемом исследовании',
    category: 'research',
    icon: '📚',
    requirement: {
      type: 'custom',
      check: (state) => {
        if (!state.repeatableResearch) return false;
        return Object.values(state.repeatableResearch.researches || {}).some(level => level >= 25);
      },
    },
    reward: {
      researchPoints: new Decimal(1000),
    },
  },
  {
    id: 'repeatable_level_50',
    name: 'Мастер Исследований',
    description: 'Достигните 50 уровня в любом повторяемом исследовании',
    category: 'research',
    icon: '🎓',
    requirement: {
      type: 'custom',
      check: (state) => {
        if (!state.repeatableResearch) return false;
        return Object.values(state.repeatableResearch.researches || {}).some(level => level >= 50);
      },
    },
    reward: {
      researchPoints: new Decimal(5000),
    },
  },
  {
    id: 'century_researcher',
    name: 'Исследователь Века',
    description: 'Достигните 100 уровня в любом повторяемом исследовании',
    category: 'research',
    icon: '💯',
    requirement: {
      type: 'custom',
      check: (state) => {
        if (!state.repeatableResearch) return false;
        return Object.values(state.repeatableResearch.researches || {}).some(level => level >= 100);
      },
    },
    reward: {
      researchPoints: new Decimal(10000),
    },
  },
  {
    id: 'research_addict',
    name: 'Фанат Исследований',
    description: 'Достигните 50+ уровня во ВСЕХ повторяемых исследованиях',
    category: 'research',
    icon: '🧠',
    requirement: {
      type: 'custom',
      check: (state) => {
        if (!state.repeatableResearch) return false;
        const researches = Object.values(state.repeatableResearch.researches || {});
        return researches.length === 6 && researches.every(level => level >= 50);
      },
    },
    reward: {
      credits: new Decimal(1000000),
      researchPoints: new Decimal(20000),
    },
  },
  {
    id: 'infinite_mind_500',
    name: 'Бесконечный Разум',
    description: 'Суммарно 500+ уровней повторяемых исследований',
    category: 'research',
    icon: '♾️',
    requirement: {
      type: 'custom',
      check: (state) => {
        if (!state.repeatableResearch) return false;
        const totalLevels = Object.values(state.repeatableResearch.researches || {}).reduce(
          (sum, level) => sum + level,
          0
        );
        return totalLevels >= 500;
      },
    },
    reward: {
      credits: new Decimal(5000000),
    },
  },
  {
    id: 'infinite_mind_1000',
    name: 'Трансцендентальный Разум',
    description: 'Суммарно 1000+ уровней повторяемых исследований',
    category: 'research',
    icon: '✨',
    requirement: {
      type: 'custom',
      check: (state) => {
        if (!state.repeatableResearch) return false;
        const totalLevels = Object.values(state.repeatableResearch.researches || {}).reduce(
          (sum, level) => sum + level,
          0
        );
        return totalLevels >= 1000;
      },
    },
    reward: {
      credits: new Decimal(10000000),
      researchPoints: new Decimal(100000),
    },
  },

  // ========================================
  // PHASE 4: BUILDING EVOLUTION ACHIEVEMENTS
  // ========================================
  {
    id: 'first_evolution',
    name: 'Первая Эволюция',
    description: 'Эволюционировать здание впервые',
    category: 'buildings',
    icon: '🧬',
    requirement: {
      type: 'custom',
      check: (state) => {
        const tileEvolutionLevels = state.grid.tileEvolutionLevels || {};
        return Object.values(tileEvolutionLevels).some(level => level > 0);
      },
    },
    reward: {
      credits: new Decimal(50000),
    },
  },
  {
    id: 'evolution_master',
    name: 'Мастер Эволюции',
    description: 'Эволюционировать 10 зданий',
    category: 'buildings',
    icon: '🌟',
    requirement: {
      type: 'custom',
      check: (state) => {
        const tileEvolutionLevels = state.grid.tileEvolutionLevels || {};
        const evolvedCount = Object.values(tileEvolutionLevels).filter(level => level > 0).length;
        return evolvedCount >= 10;
      },
    },
    reward: {
      credits: new Decimal(250000),
    },
  },
  {
    id: 'ultimate_evolution',
    name: 'Окончательная Форма',
    description: 'Достичь максимальной эволюции (уровень 3) хотя бы у одного здания',
    category: 'buildings',
    icon: '⭐',
    requirement: {
      type: 'custom',
      check: (state) => {
        const tileEvolutionLevels = state.grid.tileEvolutionLevels || {};
        return Object.values(tileEvolutionLevels).some(level => level >= 3);
      },
    },
    reward: {
      credits: new Decimal(500000),
      researchPoints: new Decimal(10000),
    },
  },
  {
    id: 'evolution_city',
    name: 'Эволюционный Город',
    description: '25 зданий достигли максимальной эволюции',
    category: 'buildings',
    icon: '✨',
    requirement: {
      type: 'custom',
      check: (state) => {
        const tileEvolutionLevels = state.grid.tileEvolutionLevels || {};
        const maxEvolutionCount = Object.values(tileEvolutionLevels).filter(level => level >= 3).length;
        return maxEvolutionCount >= 25;
      },
    },
    reward: {
      credits: new Decimal(2000000),
      researchPoints: new Decimal(50000),
    },
  },
  {
    id: 'evolution_metropolis',
    name: 'Эволюционный Мегаполис',
    description: '50 зданий достигли максимальной эволюции',
    category: 'buildings',
    icon: '🌠',
    requirement: {
      type: 'custom',
      check: (state) => {
        const tileEvolutionLevels = state.grid.tileEvolutionLevels || {};
        const maxEvolutionCount = Object.values(tileEvolutionLevels).filter(level => level >= 3).length;
        return maxEvolutionCount >= 50;
      },
    },
    reward: {
      credits: new Decimal(5000000),
      researchPoints: new Decimal(100000),
    },
  },

  // ==================== PROCEDURAL GALAXIES (Процедурные галактики) ====================
  {
    id: 'first_procedural',
    name: 'Первооткрыватель',
    description: 'Сгенерируйте первую процедурную галактику',
    category: 'exploration',
    icon: '🌠',
    requirement: {
      type: 'custom',
      check: (state) => state.proceduralGalaxies.galaxies.length >= 1,
    },
    reward: {
      credits: new Decimal(1000000),
      influence: new Decimal(5000),
    },
  },
  {
    id: 'galaxy_explorer',
    name: 'Исследователь галактик',
    description: 'Исследуйте 5 процедурных галактик',
    category: 'exploration',
    icon: '🔭',
    requirement: {
      type: 'custom',
      check: (state) => state.proceduralGalaxies.totalDiscovered >= 5,
    },
    reward: {
      credits: new Decimal(5000000),
      researchPoints: new Decimal(25000),
    },
  },
  {
    id: 'galaxy_master',
    name: 'Мастер галактик',
    description: 'Исследуйте 10 процедурных галактик',
    category: 'exploration',
    icon: '🌌',
    requirement: {
      type: 'custom',
      check: (state) => state.proceduralGalaxies.totalDiscovered >= 10,
    },
    reward: {
      credits: new Decimal(10000000),
      researchPoints: new Decimal(50000),
    },
  },
  {
    id: 'black_hole_survivor',
    name: 'Покоритель черных дыр',
    description: 'Исследуйте галактику с черной дырой',
    category: 'exploration',
    icon: '🌀',
    requirement: {
      type: 'custom',
      check: (state) => {
        return state.proceduralGalaxies.galaxies.some(
          g => g.discovered && g.generated.specialFeature === 'black_hole'
        );
      },
    },
    reward: {
      credits: new Decimal(2000000),
      researchPoints: new Decimal(10000),
    },
  },
  {
    id: 'nebula_dancer',
    name: 'Танцор туманностей',
    description: 'Исследуйте галактику с туманностью',
    category: 'exploration',
    icon: '☁️',
    requirement: {
      type: 'custom',
      check: (state) => {
        return state.proceduralGalaxies.galaxies.some(
          g => g.discovered && g.generated.specialFeature === 'nebula'
        );
      },
    },
    reward: {
      credits: new Decimal(1500000),
      researchPoints: new Decimal(7500),
    },
  },
  {
    id: 'quasar_seeker',
    name: 'Охотник за квазарами',
    description: 'Исследуйте галактику с квазаром',
    category: 'exploration',
    icon: '💫',
    requirement: {
      type: 'custom',
      check: (state) => {
        return state.proceduralGalaxies.galaxies.some(
          g => g.discovered && g.generated.specialFeature === 'quasar'
        );
      },
    },
    reward: {
      credits: new Decimal(1500000),
      researchPoints: new Decimal(7500),
    },
  },
  {
    id: 'ancient_ruins',
    name: 'Археолог Вселенной',
    description: 'Исследуйте галактику с древними руинами',
    category: 'exploration',
    icon: '🏛️',
    requirement: {
      type: 'custom',
      check: (state) => {
        return state.proceduralGalaxies.galaxies.some(
          g => g.discovered && g.generated.specialFeature === 'ruins'
        );
      },
    },
    reward: {
      credits: new Decimal(2500000),
      researchPoints: new Decimal(15000),
    },
  },
  {
    id: 'deep_space_veteran',
    name: 'Ветеран дальнего космоса',
    description: 'Исследуйте 25 процедурных галактик',
    category: 'exploration',
    icon: '🚀',
    requirement: {
      type: 'custom',
      check: (state) => state.proceduralGalaxies.totalDiscovered >= 25,
    },
    reward: {
      credits: new Decimal(50000000),
      researchPoints: new Decimal(100000),
    },
    hidden: true,
  },
  {
    id: 'infinity_explorer',
    name: 'Исследователь Бесконечности',
    description: 'Исследуйте 50 процедурных галактик',
    category: 'exploration',
    icon: '♾️',
    requirement: {
      type: 'custom',
      check: (state) => state.proceduralGalaxies.totalDiscovered >= 50,
    },
    reward: {
      credits: new Decimal(100000000),
      researchPoints: new Decimal(250000),
    },
    hidden: true,
  },
];

// Helper function to get achievement by ID
export function getAchievementById(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find(a => a.id === id);
}

// Helper function to get achievements by category
export function getAchievementsByCategory(category: AchievementCategory): Achievement[] {
  return ACHIEVEMENTS.filter(a => a.category === category);
}

// Helper function to count total achievements
export function getTotalAchievementsCount(): number {
  return ACHIEVEMENTS.length;
}

// Helper function to get visible achievements (non-hidden)
export function getVisibleAchievements(): Achievement[] {
  return ACHIEVEMENTS.filter(a => !a.hidden);
}

// Helper function to get hidden achievements
export function getHiddenAchievements(): Achievement[] {
  return ACHIEVEMENTS.filter(a => a.hidden);
}
