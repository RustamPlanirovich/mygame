/**
 * Building Evolution Definitions
 * Phase 4 из infinitely.md
 * 
 * Эволюция зданий разблокируется после 2-го Ascension
 * При достижении уровня 100/250/500 здание можно эволюционировать
 * Каждая эволюция требует Quantum Points и Credits
 */

import Decimal from 'break_eternity.js';
import type { BuildingType, BuildingEvolutionTier } from '../gameTypes';

/**
 * Определение эволюции для конкретного здания
 */
export interface BuildingEvolutionConfig {
  buildingType: BuildingType;
  tiers: BuildingEvolutionTier[];
}

/**
 * Все эволюции зданий
 */
export const BUILDING_EVOLUTIONS: Record<string, BuildingEvolutionConfig> = {
  // ==================== ENERGY BUILDINGS ====================
  solar_panel: {
    buildingType: 'solar_panel_mk1',
    tiers: [
      {
        level: 100,
        name: 'Orbital Solar Array',
        nameRu: 'Орбитальная Солнечная Батарея',
        multiplier: 2,
        description: 'Расширенные панели с улучшенным КПД',
        visualUpgrade: '☀️+',
        cost: { credits: new Decimal(5e5), quantum_points: new Decimal(50) },
      },
      {
        level: 250,
        name: 'Dyson Swarm Element',
        nameRu: 'Элемент Роя Дайсона',
        multiplier: 5,
        description: 'Часть сферы Дайсона, собирающая энергию звезды',
        visualUpgrade: '⭐',
        cost: { credits: new Decimal(5e7), quantum_points: new Decimal(500) },
      },
      {
        level: 500,
        name: 'Star Lifter',
        nameRu: 'Звездный Подъёмник',
        multiplier: 10,
        description: 'Извлекает энергию напрямую из ядра звезды',
        visualUpgrade: '✨',
        cost: { credits: new Decimal(5e10), quantum_points: new Decimal(5000) },
      },
    ],
  },

  reactor: {
    buildingType: 'reactor_mk1',
    tiers: [
      {
        level: 100,
        name: 'Fusion Reactor',
        nameRu: 'Термоядерный Реактор',
        multiplier: 2,
        description: 'Термоядерный синтез для чистой энергии',
        visualUpgrade: '⚛️+',
        cost: { credits: new Decimal(8e5), quantum_points: new Decimal(80) },
      },
      {
        level: 250,
        name: 'Antimatter Reactor',
        nameRu: 'Антиматериальный Реактор',
        multiplier: 5,
        description: 'Использует аннигиляцию материи и антиматерии',
        visualUpgrade: '💥',
        cost: { credits: new Decimal(8e7), quantum_points: new Decimal(800) },
      },
      {
        level: 500,
        name: 'Zero Point Reactor',
        nameRu: 'Реактор Нулевой Точки',
        multiplier: 10,
        description: 'Извлекает энергию из вакуума пространства-времени',
        visualUpgrade: '🌌',
        cost: { credits: new Decimal(8e10), quantum_points: new Decimal(8000) },
      },
    ],
  },

  // ==================== MINING BUILDINGS ====================
  iron_mine: {
    buildingType: 'iron_mine_mk1',
    tiers: [
      {
        level: 100,
        name: 'Deep Core Excavator',
        nameRu: 'Глубинный Экскаватор',
        multiplier: 2,
        description: 'Добывает руду из глубин планеты',
        visualUpgrade: '⛏️+',
        cost: { credits: new Decimal(6e5), quantum_points: new Decimal(60) },
      },
      {
        level: 250,
        name: 'Planetary Extractor',
        nameRu: 'Планетарный Экстрактор',
        multiplier: 5,
        description: 'Разбирает планеты на атомарном уровне',
        visualUpgrade: '🏗️',
        cost: { credits: new Decimal(6e7), quantum_points: new Decimal(600) },
      },
      {
        level: 500,
        name: 'Star Mining Station',
        nameRu: 'Звездная Добывающая Станция',
        multiplier: 10,
        description: 'Добывает тяжёлые элементы из звёзд',
        visualUpgrade: '💫',
        cost: { credits: new Decimal(6e10), quantum_points: new Decimal(6000) },
      },
    ],
  },

  copper_mine: {
    buildingType: 'copper_mine_mk1',
    tiers: [
      {
        level: 100,
        name: 'Automated Mining Complex',
        nameRu: 'Автоматизированный Комплекс',
        multiplier: 2,
        description: 'Полностью автоматизированная добыча',
        visualUpgrade: '🔶+',
        cost: { credits: new Decimal(5e5), quantum_points: new Decimal(50) },
      },
      {
        level: 250,
        name: 'Molecular Separator',
        nameRu: 'Молекулярный Сепаратор',
        multiplier: 5,
        description: 'Разделяет молекулы на чистую медь',
        visualUpgrade: '⚗️',
        cost: { credits: new Decimal(5e7), quantum_points: new Decimal(500) },
      },
      {
        level: 500,
        name: 'Transmutation Chamber',
        nameRu: 'Камера Трансмутации',
        multiplier: 10,
        description: 'Преобразует другие элементы в медь',
        visualUpgrade: '🔮',
        cost: { credits: new Decimal(5e10), quantum_points: new Decimal(5000) },
      },
    ],
  },

  // ==================== PRODUCTION BUILDINGS ====================
  factory: {
    buildingType: 'factory_mk1',
    tiers: [
      {
        level: 100,
        name: 'Mega Factory',
        nameRu: 'Мега-Фабрика',
        multiplier: 2,
        description: 'Расширенная фабрика с дополнительными линиями',
        visualUpgrade: '🏭+',
        cost: { credits: new Decimal(7e5), quantum_points: new Decimal(70) },
      },
      {
        level: 250,
        name: 'Automated Complex',
        nameRu: 'Автоматический Комплекс',
        multiplier: 5,
        description: 'Полностью автоматизированное производство',
        visualUpgrade: '🤖',
        cost: { credits: new Decimal(7e7), quantum_points: new Decimal(700) },
      },
      {
        level: 500,
        name: 'Molecular Assembler',
        nameRu: 'Молекулярный Ассемблер',
        multiplier: 10,
        description: 'Создаёт продукты на молекулярном уровне',
        visualUpgrade: '⚙️',
        cost: { credits: new Decimal(7e10), quantum_points: new Decimal(7000) },
      },
    ],
  },

  // ==================== RESEARCH BUILDINGS ====================
  lab: {
    buildingType: 'research_lab_mk1',
    tiers: [
      {
        level: 100,
        name: 'Advanced Research Facility',
        nameRu: 'Продвинутый Исследовательский Центр',
        multiplier: 2,
        description: 'Современное оборудование для исследований',
        visualUpgrade: '🔬+',
        cost: { credits: new Decimal(1e6), quantum_points: new Decimal(100) },
      },
      {
        level: 250,
        name: 'Quantum Lab',
        nameRu: 'Квантовая Лаборатория',
        multiplier: 5,
        description: 'Использует квантовые эффекты для исследований',
        visualUpgrade: '⚛️',
        cost: { credits: new Decimal(1e8), quantum_points: new Decimal(1000) },
      },
      {
        level: 500,
        name: 'Dimensional Research Station',
        nameRu: 'Межпространственная Станция',
        multiplier: 10,
        description: 'Исследует другие измерения',
        visualUpgrade: '🌀',
        cost: { credits: new Decimal(1e11), quantum_points: new Decimal(10000) },
      },
    ],
  },

  // ==================== STORAGE BUILDINGS ====================
  warehouse: {
    buildingType: 'warehouse_mk1',
    tiers: [
      {
        level: 100,
        name: 'Mega Warehouse',
        nameRu: 'Мега-Склад',
        multiplier: 2,
        description: 'Увеличенные хранилища',
        visualUpgrade: '📦+',
        cost: { credits: new Decimal(4e5), quantum_points: new Decimal(40) },
      },
      {
        level: 250,
        name: 'Dimensional Storage',
        nameRu: 'Пространственное Хранилище',
        multiplier: 5,
        description: 'Использует искривление пространства для хранения',
        visualUpgrade: '🗄️',
        cost: { credits: new Decimal(4e7), quantum_points: new Decimal(400) },
      },
      {
        level: 500,
        name: 'Quantum Vault',
        nameRu: 'Квантовое Хранилище',
        multiplier: 10,
        description: 'Хранит ресурсы в квантовом состоянии',
        visualUpgrade: '🔐',
        cost: { credits: new Decimal(4e10), quantum_points: new Decimal(4000) },
      },
    ],
  },

  // ==================== MILITARY BUILDINGS ====================
  turret: {
    buildingType: 'turret_mk1',
    tiers: [
      {
        level: 100,
        name: 'Plasma Turret',
        nameRu: 'Плазменная Турель',
        multiplier: 2,
        description: 'Стреляет плазменными зарядами',
        visualUpgrade: '🔫+',
        cost: { credits: new Decimal(9e5), quantum_points: new Decimal(90) },
      },
      {
        level: 250,
        name: 'Antimatter Cannon',
        nameRu: 'Антиматериальная Пушка',
        multiplier: 5,
        description: 'Разрушительная мощь антиматерии',
        visualUpgrade: '💣',
        cost: { credits: new Decimal(9e7), quantum_points: new Decimal(900) },
      },
      {
        level: 500,
        name: 'Singularity Weapon',
        nameRu: 'Сингулярное Оружие',
        multiplier: 10,
        description: 'Создаёт микро-чёрные дыры',
        visualUpgrade: '⚫',
        cost: { credits: new Decimal(9e10), quantum_points: new Decimal(9000) },
      },
    ],
  },

  // ==================== ADDITIONAL MINES ====================
  silicon_mine: {
    buildingType: 'silicon_mine_mk1',
    tiers: [
      {
        level: 100,
        name: 'Crystal Refinery',
        nameRu: 'Кристаллический Завод',
        multiplier: 2,
        description: 'Выращивает идеальные кристаллы кремния',
        visualUpgrade: '💎+',
        cost: { credits: new Decimal(5.5e5), quantum_points: new Decimal(55) },
      },
      {
        level: 250,
        name: 'Quantum Silicon Farm',
        nameRu: 'Квантовая Кремниевая Ферма',
        multiplier: 5,
        description: 'Использует квантовые эффекты для роста',
        visualUpgrade: '🔷',
        cost: { credits: new Decimal(5.5e7), quantum_points: new Decimal(550) },
      },
      {
        level: 500,
        name: 'Dimensional Silicon Extractor',
        nameRu: 'Межпространственный Экстрактор',
        multiplier: 10,
        description: 'Извлекает кремний из параллельных измерений',
        visualUpgrade: '✨',
        cost: { credits: new Decimal(5.5e10), quantum_points: new Decimal(5500) },
      },
    ],
  },

  titanium_mine: {
    buildingType: 'titanium_mine_mk1',
    tiers: [
      {
        level: 100,
        name: 'Asteroid Mining Rig',
        nameRu: 'Астероидная Платформа',
        multiplier: 2,
        description: 'Добывает титан из астероидов',
        visualUpgrade: '☄️+',
        cost: { credits: new Decimal(7.5e5), quantum_points: new Decimal(75) },
      },
      {
        level: 250,
        name: 'Stellar Forge',
        nameRu: 'Звёздная Кузница',
        multiplier: 5,
        description: 'Синтезирует титан в ядре звезды',
        visualUpgrade: '🌟',
        cost: { credits: new Decimal(7.5e7), quantum_points: new Decimal(750) },
      },
      {
        level: 500,
        name: 'Neutron Star Harvester',
        nameRu: 'Сборщик Нейтронных Звёзд',
        multiplier: 10,
        description: 'Извлекает сверхплотный титан',
        visualUpgrade: '🌌',
        cost: { credits: new Decimal(7.5e10), quantum_points: new Decimal(7500) },
      },
    ],
  },

  // ==================== ADVANCED PRODUCTION ====================
  refinery: {
    buildingType: 'refinery_mk1',
    tiers: [
      {
        level: 100,
        name: 'Advanced Refinery',
        nameRu: 'Продвинутый Завод',
        multiplier: 2,
        description: 'Улучшенная переработка с минимальными потерями',
        visualUpgrade: '⚗️+',
        cost: { credits: new Decimal(6.5e5), quantum_points: new Decimal(65) },
      },
      {
        level: 250,
        name: 'Molecular Converter',
        nameRu: 'Молекулярный Конвертор',
        multiplier: 5,
        description: 'Преобразует материалы на молекулярном уровне',
        visualUpgrade: '🧬',
        cost: { credits: new Decimal(6.5e7), quantum_points: new Decimal(650) },
      },
      {
        level: 500,
        name: 'Matter Replicator',
        nameRu: 'Репликатор Материи',
        multiplier: 10,
        description: 'Создаёт любые материалы из энергии',
        visualUpgrade: '⚛️',
        cost: { credits: new Decimal(6.5e10), quantum_points: new Decimal(6500) },
      },
    ],
  },

  // ==================== SPECIAL BUILDINGS ====================
  shield_generator: {
    buildingType: 'shield_generator_mk1',
    tiers: [
      {
        level: 100,
        name: 'Advanced Shield Grid',
        nameRu: 'Продвинутая Щитовая Сеть',
        multiplier: 2,
        description: 'Распределённые щиты для лучшей защиты',
        visualUpgrade: '🛡️+',
        cost: { credits: new Decimal(8.5e5), quantum_points: new Decimal(85) },
      },
      {
        level: 250,
        name: 'Quantum Barrier',
        nameRu: 'Квантовый Барьер',
        multiplier: 5,
        description: 'Использует квантовую запутанность',
        visualUpgrade: '🌐',
        cost: { credits: new Decimal(8.5e7), quantum_points: new Decimal(850) },
      },
      {
        level: 500,
        name: 'Reality Anchor',
        nameRu: 'Якорь Реальности',
        multiplier: 10,
        description: 'Защищает от любых угроз',
        visualUpgrade: '⚡',
        cost: { credits: new Decimal(8.5e10), quantum_points: new Decimal(8500) },
      },
    ],
  },

  trading_post: {
    buildingType: 'trading_post_mk1',
    tiers: [
      {
        level: 100,
        name: 'Trade Hub',
        nameRu: 'Торговый Узел',
        multiplier: 2,
        description: 'Центр межпланетной торговли',
        visualUpgrade: '💰+',
        cost: { credits: new Decimal(1.2e6), quantum_points: new Decimal(120) },
      },
      {
        level: 250,
        name: 'Galactic Exchange',
        nameRu: 'Галактическая Биржа',
        multiplier: 5,
        description: 'Торговля в масштабе галактики',
        visualUpgrade: '🌌',
        cost: { credits: new Decimal(1.2e8), quantum_points: new Decimal(1200) },
      },
      {
        level: 500,
        name: 'Universal Market',
        nameRu: 'Универсальный Рынок',
        multiplier: 10,
        description: 'Торговля между вселенными',
        visualUpgrade: '🔮',
        cost: { credits: new Decimal(1.2e11), quantum_points: new Decimal(12000) },
      },
    ],
  },
};

/**
 * Получить следующую доступную эволюцию для здания
 * @param buildingId - ID здания
 * @param evolutionLevel - текущий уровень эволюции (0, 1, 2...)
 */
export function getNextEvolution(buildingId: string, evolutionLevel: number): BuildingEvolutionTier | null {
  const evolution = BUILDING_EVOLUTIONS[buildingId];
  if (!evolution) return null;

  // Следующий тир эволюции = evolutionLevel
  return evolution.tiers[evolutionLevel] || null;
}

/**
 * Получить текущую эволюцию здания
 * @param buildingId - ID здания
 * @param evolutionLevel - текущий уровень эволюции (0, 1, 2...)
 */
export function getCurrentEvolution(buildingId: string, evolutionLevel: number): BuildingEvolutionTier | null {
  const evolution = BUILDING_EVOLUTIONS[buildingId];
  if (!evolution) return null;

  // Если evolutionLevel = 0, эволюции нет
  if (evolutionLevel === 0) return null;
  
  // Текущий тир = evolutionLevel - 1 (т.к. после эволюции уровень увеличивается)
  return evolution.tiers[evolutionLevel - 1] || null;
}

/**
 * Рассчитать общий множитель от эволюции
 * @param buildingId - ID здания
 * @param evolutionLevel - текущий уровень эволюции (0, 1, 2...)
 */
export function getEvolutionMultiplier(buildingId: string, evolutionLevel: number): number {
  const currentEvolution = getCurrentEvolution(buildingId, evolutionLevel);
  return currentEvolution ? currentEvolution.multiplier : 1;
}

/**
 * Проверить может ли здание эволюционировать
 */
export function canEvolve(buildingId: string, currentLevel: number, evolutionLevel: number): boolean {
  const evolution = BUILDING_EVOLUTIONS[buildingId];
  if (!evolution) return false;

  // Найти следующий тир эволюции
  const nextTier = evolution.tiers.find(tier => tier.level > currentLevel && evolutionLevel < evolution.tiers.indexOf(tier));
  
  return nextTier !== undefined && currentLevel >= nextTier.level;
}

/**
 * Получить прогресс до следующей эволюции
 */
export function getEvolutionProgress(buildingId: string, currentLevel: number): {
  current: number;
  next: number;
  progress: number;
} | null {
  const evolution = BUILDING_EVOLUTIONS[buildingId];
  if (!evolution) return null;

  // Найти текущую и следующую эволюцию
  const currentEvolution = getCurrentEvolution(buildingId, currentLevel);
  const currentTierIndex = currentEvolution 
    ? evolution.tiers.indexOf(currentEvolution) 
    : -1;

  const nextTier = evolution.tiers[currentTierIndex + 1];
  if (!nextTier) return null; // Уже максимальная эволюция

  const previousLevel = currentEvolution ? currentEvolution.level : 0;
  const progress = ((currentLevel - previousLevel) / (nextTier.level - previousLevel)) * 100;

  return {
    current: currentLevel,
    next: nextTier.level,
    progress: Math.min(progress, 100),
  };
}
