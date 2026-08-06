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
  VaultResource,
  VaultResponse,
  VaultDepositResponse,
  VaultWithdrawResponse,
  VaultPendingResponse,
  VaultConfirmResponse,
  VaultLedgerResponse,
  OffersResponse,
  MyOffersResponse,
  CreateOfferRequest,
  CreateOfferResponse,
  AcceptOfferResponse,
  OfferActionResponse,
} from '../core/gameTypes.market';
import { getAuthHeaders } from './settingsApi';

const API_URL = import.meta.env.VITE_API_URL || '';

/**
 * Единый разбор ответа биржи.
 *
 * Старые обёртки делали `response.json()` вслепую: 429 от rate-limiter'а,
 * 503 «биржа занята» или HTML от прокси превращались в исключение SyntaxError
 * без единого понятного слова для игрока. Здесь любой ответ приводится к
 * {ok:false, error, message} с текстом на русском.
 */
async function parseJson<T extends { ok: boolean; error?: string; message?: string }>(
  response: Response,
  fallbackMessage: string,
): Promise<T> {
  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }

  if (body && typeof body === 'object') {
    const parsed = body as T;
    // Сервер отвечает ok:false с человеческим message — просто отдаём как есть.
    if (typeof parsed.ok === 'boolean') return parsed;
  }

  return {
    ok: false,
    error: `HTTP_${response.status}`,
    message: response.status === 429
      ? 'Слишком много запросов к бирже. Подождите немного.'
      : `${fallbackMessage} (код ${response.status}).`,
  } as T;
}

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

/**
 * Авторитетная цена акции с сервера.
 *
 * До этого каждый клиент крутил собственный Math.random() в src/utils/stockSimulator.ts,
 * из-за чего 100 игроков видели 100 разных цен одной и той же бумаги.
 * Теперь единственный источник правды — серверная симуляция (server/market-sim).
 */
export interface ServerStockQuote {
  id: string;
  symbol: string;
  sector: string;
  volatility: string;
  basePrice: number;
  marketCap: number;
  currentPrice: number;
  previousClose: number;
  dayChange: number;
  volume: number;
  dividendYield: number;
}

export interface ServerStockPricesResponse {
  ok: boolean;
  /** true — цены можно принимать как истину и не крутить локальную симуляцию */
  authoritative?: boolean;
  source?: string;
  tick?: number;
  timeMs?: number;
  intervalMs?: number;
  nextUpdateAt?: number;
  regime?: string;
  regimeRu?: string;
  overallSentiment?: string;
  baseRate?: number;
  stocks?: ServerStockQuote[];
  error?: string;
}

export async function getServerStockPrices(): Promise<ServerStockPricesResponse> {
  const response = await fetch(`${API_URL}/api/market/stock-prices`);
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
  /**
   * 'client' — старая схема: расчёт применяет КЛИЕНТ (эти строки остались в БД
   * с до-сейфовых времён, и их надо доработать).
   * 'vault'  — сделка уже рассчитана сервером в сейфе; такие строки создаются
   * сразу applied и в pending не попадают. Если поле всё же приехало со
   * значением 'vault' — применять его НЕЛЬЗЯ, это было бы двойное начисление.
   */
  settlement?: 'client' | 'vault';
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

/**
 * Получить ожидающие транзакции биржи
 */
export async function getPendingTransactions(): Promise<PendingTransactionsResponse> {
  const response = await fetch(`${API_URL}/api/market/pending-transactions`, {
    headers: getAuthHeaders(),
  });
  return response.json();
}

/*
 * applyTransactions УДАЛЁН (bigplan.md, пункт 33): расчёт сделок целиком серверный,
 * подтверждать со стороны клиента больше нечего. Маршрут отвечает 410.
 */

// ==========================================
// СЕЙФ БИРЖИ
// ==========================================

/**
 * Балансы сейфа: available (свободно) + locked (в эскроу) по каждому ненулевому
 * ресурсу, плюс кредиты под ключом '__credits__'.
 */
export async function getVault(): Promise<VaultResponse> {
  const response = await fetch(`${API_URL}/api/market/vault`, {
    headers: getAuthHeaders(),
  });
  return parseJson<VaultResponse>(response, 'Не удалось загрузить сейф биржи');
}

/**
 * Пополнение сейфа.
 *
 * ВНИМАНИЕ: сервер верит этому вызову на слово. Списание из игрового состояния —
 * обязанность клиента, и оно должно произойти ДО вызова (см. marketStore.depositToVault).
 * Вызывать напрямую из компонентов нельзя.
 */
export async function depositToVault(
  resource: VaultResource,
  amount: string,
): Promise<VaultDepositResponse> {
  const response = await fetch(`${API_URL}/api/market/vault/deposit`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ resource, amount }),
  });
  return parseJson<VaultDepositResponse>(response, 'Не удалось пополнить сейф');
}

/**
 * Заявка на вывод. Сервер сразу списывает из сейфа и создаёт запись
 * status='pending'; начислить себе и подтвердить — задача клиента.
 */
export async function withdrawFromVault(
  resource: VaultResource,
  amount: string,
): Promise<VaultWithdrawResponse> {
  const response = await fetch(`${API_URL}/api/market/vault/withdraw`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ resource, amount }),
  });
  return parseJson<VaultWithdrawResponse>(response, 'Не удалось создать заявку на вывод');
}

/** Незавершённые выводы: точка восстановления, если клиент упал на полпути. */
export async function getPendingWithdrawals(): Promise<VaultPendingResponse> {
  const response = await fetch(`${API_URL}/api/market/vault/pending`, {
    headers: getAuthHeaders(),
  });
  return parseJson<VaultPendingResponse>(response, 'Не удалось загрузить незавершённые выводы');
}

/** Подтверждение вывода (идемпотентно: повторный вызов вернёт alreadyApplied). */
export async function confirmWithdrawal(withdrawalId: string): Promise<VaultConfirmResponse> {
  const response = await fetch(
    `${API_URL}/api/market/vault/withdraw/${withdrawalId}/confirm`,
    {
      method: 'POST',
      headers: getAuthHeaders(),
    },
  );
  return parseJson<VaultConfirmResponse>(response, 'Не удалось подтвердить вывод');
}

/** Журнал движений сейфа — тот самый аудит, который доказывает сходимость. */
export async function getVaultLedger(
  limit = 50,
  resource?: VaultResource,
): Promise<VaultLedgerResponse> {
  const params = new URLSearchParams();
  params.append('limit', limit.toString());
  if (resource) params.append('resource', resource);

  const response = await fetch(`${API_URL}/api/market/vault/ledger?${params.toString()}`, {
    headers: getAuthHeaders(),
  });
  return parseJson<VaultLedgerResponse>(response, 'Не удалось загрузить журнал сейфа');
}

// ==========================================
// ПРЯМЫЕ СДЕЛКИ С ИГРОКАМИ
// ==========================================

/** Открытые предложения: публичные + адресованные мне. */
export async function getOffers(resource?: TradeResourceType): Promise<OffersResponse> {
  const params = new URLSearchParams();
  if (resource) params.append('resource', resource);
  const queryString = params.toString();

  const response = await fetch(
    `${API_URL}/api/market/offers${queryString ? `?${queryString}` : ''}`,
    { headers: getAuthHeaders() },
  );
  return parseJson<OffersResponse>(response, 'Не удалось загрузить предложения');
}

/** Мои предложения: исходящие (я продавец) и входящие (адресованы мне). */
export async function getMyOffers(): Promise<MyOffersResponse> {
  const response = await fetch(`${API_URL}/api/market/offers/mine`, {
    headers: getAuthHeaders(),
  });
  return parseJson<MyOffersResponse>(response, 'Не удалось загрузить ваши предложения');
}

/** Создать предложение. Товар сразу уходит в эскроу сейфа. */
export async function createOffer(offer: CreateOfferRequest): Promise<CreateOfferResponse> {
  const response = await fetch(`${API_URL}/api/market/offers`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(offer),
  });
  return parseJson<CreateOfferResponse>(response, 'Не удалось создать предложение');
}

/** Принять предложение: обмен выполняется атомарно внутри сейфа. */
export async function acceptOffer(offerId: string): Promise<AcceptOfferResponse> {
  const response = await fetch(`${API_URL}/api/market/offers/${offerId}/accept`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  return parseJson<AcceptOfferResponse>(response, 'Не удалось принять предложение');
}

/** Отклонить адресованное мне предложение (эскроу вернётся продавцу). */
export async function declineOffer(offerId: string): Promise<OfferActionResponse> {
  const response = await fetch(`${API_URL}/api/market/offers/${offerId}/decline`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  return parseJson<OfferActionResponse>(response, 'Не удалось отклонить предложение');
}

/** Отменить своё предложение (эскроу вернётся в available). */
export async function cancelOffer(offerId: string): Promise<OfferActionResponse> {
  const response = await fetch(`${API_URL}/api/market/offers/${offerId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  return parseJson<OfferActionResponse>(response, 'Не удалось отменить предложение');
}

// ==========================================
// УТИЛИТЫ
// ==========================================

/**
 * Имя игрока для показа: сервер возвращает email (users.email), а светить
 * чужие адреса в публичном списке предложений незачем.
 */
export function displayPlayerName(name: string | null | undefined, fallbackId?: string | null): string {
  if (!name) return fallbackId ? `Игрок #${fallbackId}` : 'Игрок';
  const at = name.indexOf('@');
  return at > 0 ? name.slice(0, at) : name;
}

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
