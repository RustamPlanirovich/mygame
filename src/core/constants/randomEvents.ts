import type { RandomEventType } from '../gameTypes';

export interface EventConfig {
  type: RandomEventType;
  weight: number; // Вес для случайного выбора (чем больше, тем чаще)
  minInterval: number; // Минимальный интервал между событиями этого типа (мс)
  title: string;
  descriptionTemplate: string; // Шаблон описания
  icon: string;
  soundEffect?: string;
}

// Базовый интервал между событиями (5-15 минут)
export const BASE_EVENT_INTERVAL_MIN = 5 * 60 * 1000; // 5 минут
export const BASE_EVENT_INTERVAL_MAX = 15 * 60 * 1000; // 15 минут

// Конфигурация всех типов событий
export const EVENT_CONFIGS: Record<RandomEventType, EventConfig> = {
  meteor_shower: {
    type: 'meteor_shower',
    weight: 20,
    minInterval: 10 * 60 * 1000, // 10 минут
    title: '☄️ Метеоритный дождь',
    descriptionTemplate: 'Рой метеоритов движется в вашу сторону! {damageCount} зданий получили повреждения, но вы собрали {oreGain} руды и {carbonGain} углерода из обломков.',
    icon: '☄️',
    soundEffect: 'meteor_impact',
  },
  
  scientific_breakthrough: {
    type: 'scientific_breakthrough',
    weight: 15,
    minInterval: 20 * 60 * 1000, // 20 минут
    title: '🔬 Научный прорыв',
    descriptionTemplate: 'Ваши исследователи совершили важное открытие! Вы получили {rpGain} очков исследований.',
    icon: '🔬',
    soundEffect: 'breakthrough',
  },
  
  pirate_raid: {
    type: 'pirate_raid',
    weight: 10,
    minInterval: 15 * 60 * 1000, // 15 минут
    title: '🏴‍☠️ Пиратский рейд',
    descriptionTemplate: 'Пираты атаковали вашу базу! Потеряно: {resourcesLost}.',
    icon: '🏴‍☠️',
    soundEffect: 'alarm',
  },
  
  cosmic_anomaly: {
    type: 'cosmic_anomaly',
    weight: 8,
    minInterval: 30 * 60 * 1000, // 30 минут
    title: '🌌 Космическая аномалия',
    descriptionTemplate: 'Обнаружена пространственная аномалия!',
    icon: '🌌',
    soundEffect: 'anomaly',
  },
  
  chain_reaction: {
    type: 'chain_reaction',
    weight: 5, // Редкое
    minInterval: 25 * 60 * 1000, // 25 минут
    title: '💥 Цепная реакция',
    descriptionTemplate: 'Перегрузка реактора вызвала цепную реакцию! Потеряно {energyLoss} энергии.',
    icon: '💥',
    soundEffect: 'explosion',
  },
  
  synergy_discovery: {
    type: 'synergy_discovery',
    weight: 5, // Редкое
    minInterval: 40 * 60 * 1000, // 40 минут
    title: '✨ Синергетическое открытие',
    descriptionTemplate: 'Ваши системы обнаружили синергию между технологиями! Открыта случайная технология.',
    icon: '✨',
    soundEffect: 'discovery',
  },
  
  power_surge: {
    type: 'power_surge',
    weight: 12,
    minInterval: 15 * 60 * 1000, // 15 минут
    title: '⚡ Скачок энергии',
    descriptionTemplate: 'Солнечная активность повысилась! Получено: {resources}.',
    icon: '⚡',
    soundEffect: 'power_up',
  },
  
  power_outage: {
    type: 'power_outage',
    weight: 8,
    minInterval: 20 * 60 * 1000, // 20 минут
    title: '🔌 Перегрузка сети',
    descriptionTemplate: 'Перегрузка энергосети! Потеряно {energyLoss} энергии.',
    icon: '🔌',
    soundEffect: 'power_down',
  },
  
  resource_cache: {
    type: 'resource_cache',
    weight: 18,
    minInterval: 12 * 60 * 1000, // 12 минут
    title: '📦 Тайник с ресурсами',
    descriptionTemplate: 'Обнаружен заброшенный груз! Получено: {resources}.',
    icon: '📦',
    soundEffect: 'treasure',
  },
  
  solar_flare: {
    type: 'solar_flare',
    weight: 10,
    minInterval: 18 * 60 * 1000, // 18 минут
    title: '🌟 Солнечная вспышка',
    descriptionTemplate: 'Мощная вспышка на ближайшей звезде! Электроника повреждена, {resourcesLost} ресурсов утеряно.',
    icon: '🌟',
    soundEffect: 'flare',
  },
};

// Эффекты событий по типам
export const EVENT_EFFECTS = {
  // Метеоритный дождь: урон + ресурсы
  meteor_shower: {
    damageBuildings: { min: 2, max: 5 }, // Сколько зданий повреждается
    damagePercent: 15, // Процент урона (для будущей системы HP)
    oreGain: { min: 50, max: 200 },
    carbonGain: { min: 30, max: 150 },
  },
  
  // Научный прорыв: бонус RP
  scientific_breakthrough: {
    rpMultiplier: { min: 1.5, max: 3.0 }, // От текущего производства RP
    baserpGain: { min: 100, max: 500 }, // Минимум RP
  },
  
  // Пиратский рейд: атака платформы
  pirate_raid: {
    targetRandomPlatform: true,
    enemyCount: { min: 3, max: 8 },
  },
  
  // Космическая аномалия: случайный эффект
  cosmic_anomaly: {
    effects: [
      { type: 'resource_bonus', weight: 30 },
      { type: 'resource_loss', weight: 20 },
      { type: 'production_boost', weight: 25 },
      { type: 'rp_bonus', weight: 25 },
    ],
  },
  
  // Цепная реакция: повреждение соседних зданий
  chain_reaction: {
    damageRadius: 2, // Радиус в клетках
    damagePercent: 25,
  },
  
  // Синергетическое открытие: разблокировка случайной технологии
  synergy_discovery: {
    unlockRandomTech: true,
  },
  
  // Скачок энергии: временный бонус производства
  power_surge: {
    productionMultiplier: 1.5,
    duration: 60 * 1000, // 60 секунд
  },
  
  // Перегрузка сети: временное отключение производства
  power_outage: {
    productionMultiplier: 0, // Остановка производства
    duration: 30 * 1000, // 30 секунд
    energyLoss: { min: 1000, max: 5000 },
  },
  
  // Тайник с ресурсами
  resource_cache: {
    resourceTypes: ['ore', 'copper', 'steel', 'titanium', 'carbon', 'uranium'],
    amountMultiplier: { min: 50, max: 300 }, // От базового производства
  },
  
  // Солнечная вспышка: потеря ресурсов
  solar_flare: {
    resourceLossPercent: { min: 5, max: 15 }, // Процент от текущих запасов
    affectedResources: ['semiconductors', 'computer', 'display'],
  },
};
