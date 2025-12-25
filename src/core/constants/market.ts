import { D } from '../math/format';
import type { ResourceType } from '../gameTypes';
import Decimal from 'break_eternity.js';

/**
 * Базовые цены ресурсов в кредитах (Credits)
 * Согласно balance.md
 */
export const BASE_RESOURCE_PRICES: Partial<Record<ResourceType, Decimal>> = {
  ore: D(2),
  ice: D(3),
  carbon: D(4),
  steel: D(15),
  dark_matter: D(1000), // Редкий ресурс
  // Фаза 2: Базовые новые ресурсы
  natural_gas: D(5),
  oil: D(6),
  gasoline: D(12),
  plastic: D(10),
  glass: D(8),
  chemicals: D(14),
  sand: D(1),
  // Фаза 2.3: Металлические ресурсы
  uranium: D(50),
  chrome: D(25),
  titanium: D(30),
  // Фаза 2.4-2.5: Продвинутые ресурсы
  copper: D(8),
  semiconductors: D(35),
  dynamite: D(22),
  fiber: D(16),
  // Фаза 2.6: Сложные производственные ресурсы
  integrated_circuit: D(60),
  battery: D(45),
  engine: D(80),
  display: D(55),
  computer: D(120),
  liquid_fuel: D(18),
  chrome_alloy: D(40),
  titanium_alloy: D(50),
  enriched_uranium: D(150),
  // Фаза 2.7: Военные ресурсы
  weapon: D(70),
  artillery: D(100),
  radar: D(90),
  nuclear_bomb: D(500),
  // Фаза 2.8: Космические ресурсы
  jet_engine: D(200),
  satellite: D(300),
  rocket: D(250),
  spaceship: D(500),
  console: D(150),
  space_station: D(1000),
  // Фаза 2.9: Специальные ресурсы
  robot: D(180),
};

/**
 * Модификаторы цен для рыночных событий
 */
export const MARKET_EVENT_MODIFIERS = {
  normal: { name: 'Обычный рынок', multiplier: 1.0 },
  war: { name: 'Военное время', multiplier: 1.5 }, // +50% к ценам
  deficit: { name: 'Дефицит', multiplier: 1.8 }, // +80% к ценам
  surplus: { name: 'Перепроизводство', multiplier: 0.7 }, // -30% к ценам
  boom: { name: 'Экономический бум', multiplier: 1.2 }, // +20% к ценам
  crisis: { name: 'Кризис', multiplier: 0.5 }, // -50% к ценам
} as const;

export type MarketEventType = keyof typeof MARKET_EVENT_MODIFIERS;

/**
 * Список ресурсов доступных для торговли
 */
export const TRADEABLE_RESOURCES: ResourceType[] = [
  'ore', 
  'ice', 
  'carbon', 
  'steel',
  // Фаза 2: Новые торгуемые ресурсы
  'natural_gas',
  'oil',
  'gasoline',
  'plastic',
  'glass',
  'sand',
  // Фаза 2.3: Металлы
  'uranium',
  'chrome',
  'titanium',
  // Фаза 2.4-2.5: Продвинутые ресурсы
  'copper',
  'semiconductors',
  'dynamite',
  'fiber',
  // Фаза 2.6: Сложные производственные ресурсы
  'integrated_circuit',
  'battery',
  'engine',
  'display',
  'computer',
  'liquid_fuel',
  'chrome_alloy',
  'titanium_alloy',
  'enriched_uranium',
  // Фаза 2.7: Военные ресурсы
  'weapon',
  'artillery',
  'radar',
  'nuclear_bomb',
];

/**
 * Вычисление цены продажи с учетом события
 */
export function calculateSellPrice(
  resource: ResourceType,
  event: MarketEventType = 'normal'
): Decimal {
  const basePrice = BASE_RESOURCE_PRICES[resource] ?? D(1);
  const modifier = MARKET_EVENT_MODIFIERS[event]?.multiplier ?? 1.0;
  return basePrice.mul(D(modifier));
}

/**
 * Вычисление цены покупки (обычно выше цены продажи)
 * Наценка 30% для баланса
 */
export function calculateBuyPrice(
  resource: ResourceType,
  event: MarketEventType = 'normal'
): Decimal {
  const sellPrice = calculateSellPrice(resource, event);
  return sellPrice.mul(D(1.3)); // +30% наценка для покупки
}
