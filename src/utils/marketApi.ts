/**
 * API клиент для глобальной торговой биржи
 * Фаза 1: Мультиплеерная торговля
 */

import type {
  MarketOrdersResponse,
  CreateOrderRequest,
  CreateOrderResponse,
  TradeHistoryResponse,
  MarketPricesResponse,
  OrderBookResponse,
  TraderProfileResponse,
  TraderLeaderboardResponse,
  GuildResponse,
  GuildListResponse,
  MarketOrdersFilter,
  MarketOrderDTO,
  TradeResourceType,
} from '../core/gameTypes.market';
import { getAuthHeaders } from './settingsApi';

const API_URL = 'http://127.0.0.1:5174';

// ==========================================
// ОРДЕРА
// ==========================================

/**
 * Получить активные ордера
 */
export async function getMarketOrders(
  filters: MarketOrdersFilter = {}
): Promise<MarketOrdersResponse> {
  const params = new URLSearchParams();
  
  if (filters.resource) params.append('resource', filters.resource);
  if (filters.type) params.append('type', filters.type);
  if (filters.status) params.append('status', filters.status);
  if (filters.limit) params.append('limit', filters.limit.toString());
  if (filters.offset) params.append('offset', filters.offset.toString());
  
  const queryString = params.toString();
  const url = `${API_URL}/api/market/orders${queryString ? `?${queryString}` : ''}`;
  
  const response = await fetch(url);
  return response.json();
}

/**
 * Получить мои ордера
 */
export async function getMyOrders(
  status?: string
): Promise<{ ok: boolean; orders: MarketOrderDTO[]; error?: string }> {
  const params = new URLSearchParams();
  if (status) params.append('status', status);
  
  const queryString = params.toString();
  const url = `${API_URL}/api/market/my-orders${queryString ? `?${queryString}` : ''}`;
  
  const response = await fetch(url, {
    headers: getAuthHeaders(),
  });
  return response.json();
}

/**
 * Создать новый ордер
 */
export async function createOrder(
  order: CreateOrderRequest
): Promise<CreateOrderResponse> {
  const response = await fetch(`${API_URL}/api/market/orders`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(order),
  });
  return response.json();
}

/**
 * Отменить ордер
 */
export async function cancelOrder(
  orderId: string
): Promise<{ ok: boolean; error?: string }> {
  const response = await fetch(`${API_URL}/api/market/orders/${orderId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  return response.json();
}

// ==========================================
// ИСТОРИЯ СДЕЛОК
// ==========================================

/**
 * Получить историю своих сделок
 */
export async function getTradeHistory(
  limit = 50,
  offset = 0
): Promise<TradeHistoryResponse> {
  const response = await fetch(
    `${API_URL}/api/market/history?limit=${limit}&offset=${offset}`,
    {
      headers: getAuthHeaders(),
    }
  );
  return response.json();
}

// ==========================================
// РЫНОЧНЫЕ ЦЕНЫ
// ==========================================

/**
 * Получить текущие рыночные цены
 */
export async function getMarketPrices(): Promise<MarketPricesResponse> {
  const response = await fetch(`${API_URL}/api/market/prices`);
  return response.json();
}

// ==========================================
// КНИГА ОРДЕРОВ
// ==========================================

/**
 * Получить книгу ордеров для ресурса
 */
export async function getOrderBook(
  resource: TradeResourceType
): Promise<OrderBookResponse> {
  const response = await fetch(`${API_URL}/api/market/orderbook/${resource}`);
  return response.json();
}

// ==========================================
// ТРЕЙДЕРЫ
// ==========================================

/**
 * Получить профиль трейдера
 */
export async function getTraderProfile(
  playerId: string
): Promise<TraderProfileResponse> {
  const response = await fetch(`${API_URL}/api/traders/${playerId}`);
  return response.json();
}

/**
 * Получить лидерборд трейдеров
 */
export async function getTraderLeaderboard(
  limit = 50,
  offset = 0,
  sortBy: 'volume' | 'trades' = 'volume'
): Promise<TraderLeaderboardResponse> {
  const response = await fetch(
    `${API_URL}/api/traders/leaderboard?limit=${limit}&offset=${offset}&sortBy=${sortBy}`
  );
  return response.json();
}

// ==========================================
// ГИЛЬДИИ
// ==========================================

/**
 * Получить список гильдий
 */
export async function getGuilds(
  limit = 50,
  offset = 0,
  search?: string
): Promise<GuildListResponse> {
  const params = new URLSearchParams();
  params.append('limit', limit.toString());
  params.append('offset', offset.toString());
  if (search) params.append('search', search);
  
  const response = await fetch(`${API_URL}/api/guilds?${params.toString()}`);
  return response.json();
}

/**
 * Получить информацию о гильдии
 */
export async function getGuild(guildId: string): Promise<GuildResponse> {
  const response = await fetch(`${API_URL}/api/guilds/${guildId}`);
  return response.json();
}

/**
 * Получить мою гильдию
 */
export async function getMyGuild(): Promise<GuildResponse> {
  const response = await fetch(`${API_URL}/api/guilds/my`, {
    headers: getAuthHeaders(),
  });
  return response.json();
}

/**
 * Создать гильдию
 */
export async function createGuild(
  name: string,
  tag: string
): Promise<GuildResponse> {
  const response = await fetch(`${API_URL}/api/guilds`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ name, tag }),
  });
  return response.json();
}

/**
 * Вступить в гильдию
 */
export async function joinGuild(
  guildId: string
): Promise<{ ok: boolean; error?: string }> {
  const response = await fetch(`${API_URL}/api/guilds/${guildId}/join`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  return response.json();
}

/**
 * Покинуть гильдию
 */
export async function leaveGuild(
  guildId: string
): Promise<{ ok: boolean; error?: string }> {
  const response = await fetch(`${API_URL}/api/guilds/${guildId}/leave`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  return response.json();
}

/**
 * Повысить участника
 */
export async function promoteMember(
  guildId: string,
  targetPlayerId: string
): Promise<{ ok: boolean; newRole?: string; error?: string }> {
  const response = await fetch(`${API_URL}/api/guilds/${guildId}/promote`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ targetPlayerId }),
  });
  return response.json();
}

/**
 * Понизить участника
 */
export async function demoteMember(
  guildId: string,
  targetPlayerId: string
): Promise<{ ok: boolean; newRole?: string; error?: string }> {
  const response = await fetch(`${API_URL}/api/guilds/${guildId}/demote`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ targetPlayerId }),
  });
  return response.json();
}

/**
 * Исключить участника
 */
export async function kickMember(
  guildId: string,
  targetPlayerId: string
): Promise<{ ok: boolean; error?: string }> {
  const response = await fetch(`${API_URL}/api/guilds/${guildId}/kick`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ targetPlayerId }),
  });
  return response.json();
}

/**
 * Внести в казну гильдии
 */
export async function depositToTreasury(
  guildId: string,
  amount: number
): Promise<{ ok: boolean; error?: string }> {
  const response = await fetch(`${API_URL}/api/guilds/${guildId}/treasury/deposit`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ amount }),
  });
  return response.json();
}

// ==========================================
// ЧАТ ГИЛЬДИИ
// ==========================================

export interface GuildChatMessage {
  id: string;
  guildId: string;
  playerId: string;
  playerName: string;
  message: string;
  createdAt: number;
}

/**
 * Получить сообщения чата гильдии
 */
export async function getGuildChat(
  guildId: string
): Promise<{ ok: boolean; messages: GuildChatMessage[]; error?: string }> {
  const response = await fetch(`${API_URL}/api/guilds/${guildId}/chat`, {
    headers: getAuthHeaders(),
  });
  return response.json();
}

/**
 * Отправить сообщение в чат гильдии
 */
export async function sendGuildMessage(
  guildId: string,
  message: string
): Promise<{ ok: boolean; message?: GuildChatMessage; error?: string }> {
  const response = await fetch(`${API_URL}/api/guilds/${guildId}/chat`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ message }),
  });
  return response.json();
}

// ==========================================
// PENDING ТРАНЗАКЦИИ
// ==========================================

export interface PendingTransaction {
  id: string;
  tradeId: string;
  transactionType: 'buy' | 'sell';
  resource: string;
  resourceAmount: string;
  creditsAmount: string;
  feeAmount: string;
  createdAt: number;
  tradeInfo: {
    pricePerUnit: string;
    executedAt: number;
  };
}

export interface PendingTransactionsResponse {
  ok: boolean;
  transactions: PendingTransaction[];
  error?: string;
}

export interface ApplyTransactionsResponse {
  ok: boolean;
  appliedCount: number;
  appliedIds: string[];
  error?: string;
}

/**
 * Получить ожидающие транзакции биржи
 */
export async function getPendingTransactions(): Promise<PendingTransactionsResponse> {
  const response = await fetch(`${API_URL}/api/market/pending-transactions`, {
    headers: getAuthHeaders(),
  });
  return response.json();
}

/**
 * Подтвердить применение транзакций
 */
export async function applyTransactions(
  transactionIds: string[]
): Promise<ApplyTransactionsResponse> {
  const response = await fetch(`${API_URL}/api/market/apply-transactions`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ transactionIds }),
  });
  return response.json();
}

// ==========================================
// УТИЛИТЫ
// ==========================================

/**
 * Форматирование цены
 */
export function formatPrice(price: string | number): string {
  const num = typeof price === 'string' ? parseFloat(price) : price;
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(2)}M`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(2)}K`;
  }
  return num.toFixed(2);
}

/**
 * Форматирование объёма
 */
export function formatVolume(volume: string | number): string {
  const num = typeof volume === 'string' ? parseFloat(volume) : volume;
  if (num >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(2)}B`;
  }
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(2)}M`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(2)}K`;
  }
  return num.toFixed(0);
}

/**
 * Получить цвет для изменения цены
 */
export function getPriceChangeColor(change: number): string {
  if (change > 0) return 'text-green-400';
  if (change < 0) return 'text-red-400';
  return 'text-gray-400';
}

/**
 * Форматирование процента изменения
 */
export function formatPriceChange(change: number): string {
  const sign = change > 0 ? '+' : '';
  return `${sign}${change.toFixed(2)}%`;
}
