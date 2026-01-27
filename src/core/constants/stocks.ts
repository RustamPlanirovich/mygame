/**
 * Определения акций для финансовой системы
 * Фаза 6: 12 акций различных секторов
 */

import type { Stock, StockSector, VolatilityLevel } from '../gameTypes.finance';

/**
 * Определение акции (без динамических данных)
 */
export interface StockDefinition {
  id: string;
  symbol: string;
  name: string;
  sector: StockSector;
  basePrice: number;
  volatility: VolatilityLevel;
  dividendYield: number;
  marketCap: number;
  emoji: string;
  description: string;
}

/**
 * Множители волатильности для симуляции цен
 */
export const VOLATILITY_MULTIPLIERS: Record<VolatilityLevel, { min: number; max: number; trend: number }> = {
  low: { min: 0.98, max: 1.02, trend: 0.005 },
  medium: { min: 0.95, max: 1.05, trend: 0.01 },
  high: { min: 0.90, max: 1.10, trend: 0.02 },
  very_high: { min: 0.85, max: 1.15, trend: 0.03 },
  extreme: { min: 0.75, max: 1.25, trend: 0.05 },
};

/**
 * Все доступные акции
 */
export const STOCK_DEFINITIONS: StockDefinition[] = [
  {
    id: 'ores',
    symbol: 'ORES',
    name: 'Ore Mining Corporation',
    sector: 'mining',
    basePrice: 45.50,
    volatility: 'low',
    dividendYield: 0.03,
    marketCap: 5000000000,
    emoji: '⛏️',
    description: 'Крупнейшая горнодобывающая корпорация, специализирующаяся на добыче руды и редких металлов.',
  },
  {
    id: 'enrg',
    symbol: 'ENRG',
    name: 'Energy Solutions Inc',
    sector: 'energy',
    basePrice: 78.25,
    volatility: 'medium',
    dividendYield: 0.04,
    marketCap: 8500000000,
    emoji: '⚡',
    description: 'Диверсифицированная энергетическая компания с фокусом на традиционные источники энергии.',
  },
  {
    id: 'slrs',
    symbol: 'SLRS',
    name: 'Solar Systems Incorporated',
    sector: 'energy',
    basePrice: 125.00,
    volatility: 'high',
    dividendYield: 0.01,
    marketCap: 12000000000,
    emoji: '☀️',
    description: 'Инновационная компания в области солнечной энергетики и систем хранения энергии.',
  },
  {
    id: 'chip',
    symbol: 'CHIP',
    name: 'ChipTech Industries',
    sector: 'technology',
    basePrice: 250.00,
    volatility: 'high',
    dividendYield: 0,
    marketCap: 25000000000,
    emoji: '💾',
    description: 'Лидер в производстве полупроводников и интегральных схем нового поколения.',
  },
  {
    id: 'mech',
    symbol: 'MECH',
    name: 'MechFactory Ltd',
    sector: 'manufacturing',
    basePrice: 62.75,
    volatility: 'medium',
    dividendYield: 0.025,
    marketCap: 4200000000,
    emoji: '🏭',
    description: 'Многопрофильный производственный холдинг с заводами по всей галактике.',
  },
  {
    id: 'aero',
    symbol: 'AERO',
    name: 'AeroSpace Dynamics',
    sector: 'aerospace',
    basePrice: 420.00,
    volatility: 'high',
    dividendYield: 0.005,
    marketCap: 35000000000,
    emoji: '🚀',
    description: 'Разработка и производство космических кораблей, спутников и орбитальных станций.',
  },
  {
    id: 'medi',
    symbol: 'MEDI',
    name: 'MediBiotech Corporation',
    sector: 'biotech',
    basePrice: 180.00,
    volatility: 'very_high',
    dividendYield: 0,
    marketCap: 15000000000,
    emoji: '🧬',
    description: 'Биотехнологическая компания, разрабатывающая генную терапию и биоимпланты.',
  },
  {
    id: 'game',
    symbol: 'GAME',
    name: 'GameStream Corporation',
    sector: 'entertainment',
    basePrice: 95.50,
    volatility: 'high',
    dividendYield: 0.01,
    marketCap: 8000000000,
    emoji: '🎮',
    description: 'Крупнейший производитель видеоигр и стриминговых платформ в галактике.',
  },
  {
    id: 'arms',
    symbol: 'ARMS',
    name: 'DefenseTech Industries',
    sector: 'manufacturing',
    basePrice: 88.00,
    volatility: 'low',
    dividendYield: 0.05,
    marketCap: 6500000000,
    emoji: '🛡️',
    description: 'Оборонный подрядчик, производящий вооружение и системы защиты.',
  },
  {
    id: 'cryo',
    symbol: 'CRYO',
    name: 'CryoGenetics Research',
    sector: 'biotech',
    basePrice: 145.00,
    volatility: 'very_high',
    dividendYield: 0,
    marketCap: 9500000000,
    emoji: '❄️',
    description: 'Исследования в области криоконсервации и продления жизни.',
  },
  {
    id: 'qntm',
    symbol: 'QNTM',
    name: 'Quantum Computing Corp',
    sector: 'technology',
    basePrice: 550.00,
    volatility: 'extreme',
    dividendYield: 0,
    marketCap: 45000000000,
    emoji: '⚛️',
    description: 'Пионеры квантовых вычислений и квантовых коммуникаций.',
  },
  {
    id: 'dark',
    symbol: 'DARK',
    name: 'Dark Matter Ventures',
    sector: 'exotic',
    basePrice: 1200.00,
    volatility: 'extreme',
    dividendYield: 0,
    marketCap: 100000000000,
    emoji: '🌌',
    description: 'Исследование и добыча тёмной материи для передовых технологий.',
  },
];

/**
 * Получить определение акции по ID
 */
export function getStockDefinition(stockId: string): StockDefinition | undefined {
  return STOCK_DEFINITIONS.find(s => s.id === stockId);
}

/**
 * Получить акции по сектору
 */
export function getStocksBySector(sector: StockSector): StockDefinition[] {
  return STOCK_DEFINITIONS.filter(s => s.sector === sector);
}

/**
 * Получить все секторы с акциями
 */
export function getAllSectors(): StockSector[] {
  return [...new Set(STOCK_DEFINITIONS.map(s => s.sector))];
}

/**
 * Создать начальное состояние акции из определения
 */
export function createStockFromDefinition(def: StockDefinition): Stock {
  const now = Date.now();
  return {
    id: def.id,
    symbol: def.symbol,
    name: def.name,
    sector: def.sector,
    currentPrice: def.basePrice.toString(),
    previousClose: def.basePrice.toString(),
    dayChange: 0,
    volume: '0',
    marketCap: def.marketCap.toString(),
    dividendYield: def.dividendYield,
    priceHistory: [{ timestamp: now, value: def.basePrice.toString() }],
    volatility: def.volatility,
    basePrice: def.basePrice.toString(),
    trend: 0,
    emoji: def.emoji,
    description: def.description,
  };
}

/**
 * Создать все акции из определений
 */
export function createAllStocks(): Stock[] {
  return STOCK_DEFINITIONS.map(createStockFromDefinition);
}
