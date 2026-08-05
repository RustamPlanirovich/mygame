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
  /** Ставка комиссии, ЗАФИКСИРОВАННАЯ в ордере при постановке (в процентах). */
  feePercent?: string;
  /** Сколько ещё удерживается в сейфе под этот ордер. */
  escrow?: { resource: string; credits: string };
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

// ==========================================
// СЕЙФ БИРЖИ (ESCROW VAULT)
//
// Сервер больше не верит клиенту на слово внутри биржи: торговать можно только
// тем, что лежит в сейфе. Единственная точка доверия — пополнение (клиент
// утверждает, что списал ресурс у себя), поэтому клиент ОБЯЗАН списывать
// игровое состояние сам, до вызова /deposit, и начислять его после /withdraw.
// ==========================================

/** Псевдо-ресурс кредитов внутри сейфа. Совпадает с VAULT_CREDITS на сервере. */
export const VAULT_CREDITS = '__credits__';

/** Что может лежать в сейфе: любой торгуемый ресурс либо кредиты. */
export type VaultResource = TradeResourceType | typeof VAULT_CREDITS;

/** Баланс одной строки сейфа. Все величины — точные десятичные СТРОКИ, не числа. */
export interface VaultBalanceDTO {
  resource: string;
  /** Свободно: можно вывести или отдать в эскроу под ордер/предложение. */
  available: string;
  /** В эскроу: занято активными ордерами и предложениями. */
  locked: string;
  total: string;
  updatedAt: number;
}

export interface VaultResponse {
  ok: boolean;
  creditsKey?: string;
  credits?: VaultBalanceDTO;
  balances?: VaultBalanceDTO[];
  resources?: VaultBalanceDTO[];
  error?: string;
  message?: string;
}

export interface VaultDepositResponse {
  ok: boolean;
  resource?: string;
  amount?: string;
  balance?: { available: string; locked: string };
  error?: string;
  message?: string;
}

export type VaultWithdrawalStatus = 'pending' | 'applied';

/**
 * Вывод из сейфа. Пока status='pending', ценность уже НЕ в сейфе, но ещё не
 * начислена в игровое состояние: клиент начисляет и подтверждает через
 * /withdraw/:id/confirm. Список pending — точка восстановления после сбоя.
 */
export interface VaultWithdrawalDTO {
  id: string;
  resource: string;
  amount: string;
  status?: VaultWithdrawalStatus;
  createdAt: number;
  appliedAt?: number | null;
}

export interface VaultWithdrawResponse {
  ok: boolean;
  withdrawal?: VaultWithdrawalDTO;
  balance?: { available: string; locked: string };
  error?: string;
  message?: string;
  /** Для INSUFFICIENT_VAULT_BALANCE: сколько нужно и сколько есть. */
  required?: string;
  available?: string;
}

export interface VaultPendingResponse {
  ok: boolean;
  withdrawals?: VaultWithdrawalDTO[];
  error?: string;
  message?: string;
}

export interface VaultConfirmResponse {
  ok: boolean;
  alreadyApplied?: boolean;
  withdrawal?: VaultWithdrawalDTO;
  error?: string;
  message?: string;
}

/** Запись журнала сейфа: delta — изменение ИТОГА (available+locked). */
export interface VaultLedgerEntryDTO {
  id: string;
  resource: string;
  delta: string;
  reason: string;
  refId: string | null;
  balanceAfter: string;
  createdAt: number;
}

export interface VaultLedgerResponse {
  ok: boolean;
  entries?: VaultLedgerEntryDTO[];
  error?: string;
  message?: string;
}

// ==========================================
// ПРЯМЫЕ СДЕЛКИ С ИГРОКАМИ
// ==========================================

export type DirectOfferStatus = 'open' | 'accepted' | 'cancelled' | 'expired' | 'declined';

/** sale — ресурс за кредиты, barter — ресурс за ресурс. */
export type DirectOfferKind = 'sale' | 'barter';

export interface DirectOfferDTO {
  id: string;
  sellerId: string;
  sellerName: string | null;
  /** null — публичное предложение, доступное любому игроку. */
  buyerId: string | null;
  /**
   * Сервер НЕ возвращает имя получателя: buyerId задаёт сам создатель
   * предложения, и раньше через это можно было превратить любой user id в
   * полный email его владельца. Поле оставлено опциональным только чтобы старые
   * закешированные ответы не ломали типы; UI показывает «Игрок #id».
   */
  buyerName?: string | null;
  isPublic: boolean;
  isMine: boolean;
  offerResource: string;
  offerAmount: string;
  wantCredits: string | null;
  wantResource: string | null;
  wantAmount: string | null;
  kind: DirectOfferKind;
  status: DirectOfferStatus;
  message: string | null;
  feePercent: string | null;
  createdAt: number;
  expiresAt: number;
  acceptedAt: number | null;
}

export interface CreateOfferRequest {
  offerResource: TradeResourceType;
  offerAmount: string;
  /** Ровно одно из двух: цена в кредитах ИЛИ ресурс+количество для обмена. */
  wantCredits?: string;
  wantResource?: TradeResourceType;
  wantAmount?: string;
  /** null/undefined — публичное предложение. */
  buyerId?: string | number | null;
  message?: string;
  durationHours?: number;
}

export interface OffersResponse {
  ok: boolean;
  offers?: DirectOfferDTO[];
  error?: string;
  message?: string;
}

export interface MyOffersResponse {
  ok: boolean;
  outgoing?: DirectOfferDTO[];
  incoming?: DirectOfferDTO[];
  error?: string;
  message?: string;
}

export interface CreateOfferResponse {
  ok: boolean;
  offer?: DirectOfferDTO;
  error?: string;
  message?: string;
  required?: string;
  available?: string;
}

export interface AcceptOfferResponse {
  ok: boolean;
  offer?: {
    id: string;
    status: DirectOfferStatus;
    sellerId: string;
    buyerId: string;
    offerResource: string;
    offerAmount: string;
    payResource: string;
    payAmount: string;
    fee: string;
    kind: DirectOfferKind;
  };
  error?: string;
  message?: string;
  required?: string;
  available?: string;
}

export interface OfferActionResponse {
  ok: boolean;
  offer?: { id: string; status: DirectOfferStatus; refunded?: string };
  error?: string;
  message?: string;
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
  /*
   * Было 60_000 при MAX_ACTIVE_ORDERS=100 — до лимита нужно было жать кнопку
   * 100 минут. Сервер (server/market.js, MARKET_CONSTANTS.ORDER_COOLDOWN_MS)
   * теперь держит 2 секунды: кулдаун защищает от дребезга формы, а потолок —
   * от спама. Значение здесь только для подсказок в UI.
   */
  ORDER_COOLDOWN_MS: 2_000,
  DEFAULT_ORDER_DURATION_MS: 24 * 60 * 60 * 1000,  // 24 часа
  EXTENDED_ORDER_DURATION_MS: 48 * 60 * 60 * 1000, // 48 часов (для гильдий)

  // Сейф биржи
  /** Максимум знаков после запятой, которые принимает сервер (INPUT_MAX_DP). */
  VAULT_MAX_DECIMALS: 6,
  /** Потолок на ОДНУ операцию с сейфом (MAX_OPERATION_UNITS на сервере). */
  VAULT_MAX_OPERATION: 1e15,
  /** Максимум одновременно открытых прямых предложений (MAX_ACTIVE_OFFERS). */
  MAX_ACTIVE_OFFERS: 50,
  DEFAULT_OFFER_HOURS: 24,
  
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
