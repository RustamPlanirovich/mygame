import type Decimal from 'break_eternity.js';
import type { TradeResourceType } from './gameTypes';

// Реэкспортируем TradeResourceType для удобства
export type { TradeResourceType } from './gameTypes';

// ==========================================
// ТИПЫ ДЛЯ ГЛОБАЛЬНОЙ ТОРГОВОЙ БИРЖИ
// ==========================================

// Типы ордеров
export type OrderType = 'buy' | 'sell';
export type OrderStatus = 'open' | 'filled' | 'partial' | 'cancelled' | 'expired';

// Ордер на бирже
export interface MarketOrder {
  id: string;
  playerId: string;
  playerName: string;
  type: OrderType;
  resource: TradeResourceType;
  quantity: Decimal;           // Количество ресурса
  quantityFilled: Decimal;     // Сколько уже исполнено
  pricePerUnit: Decimal;       // Цена за единицу в кредитах
  status: OrderStatus;
  createdAt: number;           // timestamp
  expiresAt: number;           // timestamp (24ч по умолчанию)
  guildId?: string;            // Для гильдейских ордеров
}

// Сериализованный ордер (для API)
export interface MarketOrderDTO {
  id: string;
  playerId: string;
  playerName: string;
  type: OrderType;
  resource: TradeResourceType;
  quantity: string;
  quantityFilled: string;
  pricePerUnit: string;
  status: OrderStatus;
  createdAt: number;
  expiresAt: number;
  guildId?: string;
}

// Трейдер (профиль игрока на бирже)
export interface TraderProfile {
  playerId: string;
  playerName: string;
  rating: number;              // 1-5 звёзд
  totalTrades: number;
  successfulTrades: number;
  totalVolume: Decimal;        // Общий объём торгов
  memberSince: number;         // timestamp
  guildId?: string;
  badges: TraderBadge[];
}

export interface TraderProfileDTO {
  playerId: string;
  playerName: string;
  rating: number;
  totalTrades: number;
  successfulTrades: number;
  totalVolume: string;
  memberSince: number;
  guildId?: string;
  badges: TraderBadge[];
}

export type TraderBadge = 
  | 'newcomer'           // < 10 сделок
  | 'active_trader'      // > 100 сделок
  | 'whale'              // > 1M объём
  | 'reliable'           // > 95% успешных сделок
  | 'guild_master'       // Глава гильдии
  | 'market_maker';      // Поддерживает ликвидность

// Торговая гильдия
export interface TradeGuild {
  id: string;
  name: string;
  tag: string;                 // 3-4 буквы, например [TRD]
  leaderId: string;
  memberIds: string[];
  maxMembers: number;          // 5-50 в зависимости от уровня
  level: number;               // 1-10
  experience: Decimal;
  treasury: Decimal;           // Общая казна кредитов
  bonuses: GuildBonus[];
  createdAt: number;
}

export interface TradeGuildDTO {
  id: string;
  name: string;
  tag: string;
  leaderId: string;
  leaderName?: string;
  memberIds: string[];
  maxMembers: number;
  level: number;
  experience: string;
  experienceForNextLevel?: string;
  treasury: string;
  bonuses: GuildBonus[];
  createdAt: number;
  // Дополнительные поля для /api/guilds/my
  myRole?: 'leader' | 'officer' | 'member';
  myContribution?: string;
  memberCount?: number;
}

export type GuildBonus = 
  | 'trade_fee_reduction'     // -5% комиссии
  | 'priority_orders'         // Приоритет исполнения
  | 'bulk_discount'           // Скидка на большие объёмы
  | 'extended_order_time';    // Ордера живут 48ч вместо 24ч

// История сделок
export interface MarketTrade {
  id: string;
  buyOrderId: string;
  sellOrderId: string;
  buyerId: string;
  sellerId: string;
  resource: TradeResourceType;
  quantity: Decimal;
  pricePerUnit: Decimal;
  totalAmount: Decimal;
  fee: Decimal;
  executedAt: number;
}

export interface MarketTradeDTO {
  id: string;
  buyOrderId: string;
  sellOrderId: string;
  buyerId: string;
  sellerId: string;
  resource: TradeResourceType;
  quantity: string;
  pricePerUnit: string;
  totalAmount: string;
  fee: string;
  executedAt: number;
}

// Рыночные цены
export interface MarketPrices {
  resource: TradeResourceType;
  lastPrice: Decimal;
  avgPrice24h: Decimal;
  highPrice24h: Decimal;
  lowPrice24h: Decimal;
  volume24h: Decimal;
  priceChange24h: number;     // Процент изменения
}

export interface MarketPricesDTO {
  resource: TradeResourceType;
  lastPrice: string;
  avgPrice24h: string;
  highPrice24h: string;
  lowPrice24h: string;
  volume24h: string;
  priceChange24h: number;
}

// Книга ордеров
export interface OrderBookEntry {
  price: Decimal;
  quantity: Decimal;
  orderCount: number;
}

export interface OrderBookEntryDTO {
  price: string;
  quantity: string;
  orderCount: number;
}

export interface OrderBook {
  resource: TradeResourceType;
  bids: OrderBookEntry[];     // Ордера на покупку (отсортированы по убыванию цены)
  asks: OrderBookEntry[];     // Ордера на продажу (отсортированы по возрастанию цены)
  spread: Decimal;            // Разница между лучшей покупкой и продажей
}

export interface OrderBookDTO {
  resource: TradeResourceType;
  bids: OrderBookEntryDTO[];
  asks: OrderBookEntryDTO[];
  spread: string;
}

// Фильтры для запросов
export interface MarketOrdersFilter {
  resource?: TradeResourceType;
  type?: OrderType;
  status?: OrderStatus;
  playerId?: string;
  guildId?: string;
  minPrice?: string;
  maxPrice?: string;
  limit?: number;
  offset?: number;
}

// Запрос на создание ордера
export interface CreateOrderRequest {
  type: OrderType;
  resource: TradeResourceType;
  quantity: string;
  pricePerUnit: string;
}

// Ответы API
export interface MarketOrdersResponse {
  ok: boolean;
  orders: MarketOrderDTO[];
  total: number;
  error?: string;
}

export interface CreateOrderResponse {
  ok: boolean;
  order?: MarketOrderDTO;
  executedTrades?: MarketTradeDTO[];  // Если ордер был частично/полностью исполнен
  error?: string;
}

export interface TradeHistoryResponse {
  ok: boolean;
  trades: MarketTradeDTO[];
  total: number;
  error?: string;
}

export interface MarketPricesResponse {
  ok: boolean;
  prices: MarketPricesDTO[];
  error?: string;
}

export interface OrderBookResponse {
  ok: boolean;
  orderBook: OrderBookDTO;
  error?: string;
}

export interface TraderProfileResponse {
  ok: boolean;
  trader: TraderProfileDTO;
  error?: string;
}

export interface TraderLeaderboardResponse {
  ok: boolean;
  traders: TraderProfileDTO[];
  total: number;
  error?: string;
}

// Гильдии
export interface CreateGuildRequest {
  name: string;
  tag: string;
}

export interface GuildResponse {
  ok: boolean;
  guild?: TradeGuildDTO;
  error?: string;
}

export interface GuildListResponse {
  ok: boolean;
  guilds: TradeGuildDTO[];
  total: number;
  error?: string;
}

export interface GuildMember {
  playerId: string;
  playerName: string;
  role: 'leader' | 'officer' | 'member';
  joinedAt: number;
  contribution: Decimal;
}

export interface GuildMemberDTO {
  playerId: string;
  playerName: string;
  role: 'leader' | 'officer' | 'member';
  joinedAt: number;
  contribution: string;
}

// Чат гильдии
export interface GuildChatMessage {
  id: string;
  guildId: string;
  playerId: string;
  playerName: string;
  message: string;
  createdAt: number;
}

// Константы
export const MARKET_CONSTANTS = {
  // Комиссии
  BASE_FEE_PERCENT: 2,
  GUILD_FEE_PERCENT: 1.5,
  VIP_FEE_PERCENT: 1,
  VIP_VOLUME_THRESHOLD: 1_000_000,
  
  // Лимиты
  MAX_ACTIVE_ORDERS: 100,
  MIN_ORDER_QUANTITY: 10,
  ORDER_COOLDOWN_MS: 60_000,  // 1 минута
  DEFAULT_ORDER_DURATION_MS: 24 * 60 * 60 * 1000,  // 24 часа
  EXTENDED_ORDER_DURATION_MS: 48 * 60 * 60 * 1000, // 48 часов (для гильдий)
  
  // Гильдии
  GUILD_CREATE_COST: 10_000,
  MIN_GUILD_NAME_LENGTH: 3,
  MAX_GUILD_NAME_LENGTH: 24,
  MIN_GUILD_TAG_LENGTH: 2,
  MAX_GUILD_TAG_LENGTH: 4,
  BASE_MAX_GUILD_MEMBERS: 10,
  MAX_GUILD_LEVEL: 10,
  
  // OrderBook
  ORDER_BOOK_DEPTH: 20,       // Количество уровней цен
} as const;

// Расчёт максимального количества членов гильдии по уровню
export function getMaxGuildMembers(level: number): number {
  // Уровень 1: 10, Уровень 2: 15, ..., Уровень 10: 55
  return MARKET_CONSTANTS.BASE_MAX_GUILD_MEMBERS + (level - 1) * 5;
}

// Расчёт опыта для следующего уровня гильдии
export function getGuildLevelExperience(level: number): number {
  // Экспоненциальная формула: 1000 * 2^(level-1)
  return 1000 * Math.pow(2, level - 1);
}

// Расчёт комиссии
export function calculateFeePercent(
  totalVolume: number,
  hasGuild: boolean
): number {
  if (totalVolume >= MARKET_CONSTANTS.VIP_VOLUME_THRESHOLD) {
    return MARKET_CONSTANTS.VIP_FEE_PERCENT;
  }
  if (hasGuild) {
    return MARKET_CONSTANTS.GUILD_FEE_PERCENT;
  }
  return MARKET_CONSTANTS.BASE_FEE_PERCENT;
}

// Бейджи трейдера
export function calculateTraderBadges(
  totalTrades: number,
  successfulTrades: number,
  totalVolume: number,
  isGuildLeader: boolean
): TraderBadge[] {
  const badges: TraderBadge[] = [];
  
  if (totalTrades < 10) {
    badges.push('newcomer');
  }
  if (totalTrades >= 100) {
    badges.push('active_trader');
  }
  if (totalVolume >= 1_000_000) {
    badges.push('whale');
  }
  if (totalTrades >= 20 && successfulTrades / totalTrades >= 0.95) {
    badges.push('reliable');
  }
  if (isGuildLeader) {
    badges.push('guild_master');
  }
  
  return badges;
}

// Бонусы гильдии по уровню
export function getGuildBonuses(level: number): GuildBonus[] {
  const bonuses: GuildBonus[] = [];
  
  if (level >= 1) bonuses.push('trade_fee_reduction');
  if (level >= 3) bonuses.push('priority_orders');
  if (level >= 5) bonuses.push('bulk_discount');
  if (level >= 7) bonuses.push('extended_order_time');
  
  return bonuses;
}
