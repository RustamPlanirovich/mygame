/**
 * Zustand Store для глобальной торговой биржи
 * Фаза 1: Мультиплеерная торговля
 */

import { create } from 'zustand';
import type {
  MarketOrderDTO,
  MarketTradeDTO,
  MarketPricesDTO,
  OrderBookDTO,
  TraderProfileDTO,
  TradeGuildDTO,
  TradeResourceType,
  OrderType,
  VaultResource,
  VaultBalanceDTO,
  VaultWithdrawalDTO,
  VaultLedgerEntryDTO,
  DirectOfferDTO,
  CreateOfferRequest,
} from '../core/gameTypes.market';
import {
  VAULT_CREDITS,
  MARKET_CONSTANTS,
  calculateFeePercent,
} from '../core/gameTypes.market';
import * as api from '../utils/marketApi';
import type { GuildChatMessage, PendingTransaction } from '../utils/marketApi';
import { getUserId } from '../utils/settingsApi';
import { D } from '../core/math/format';
import { resourceLabel } from '../core/i18n/label';
import { orderEscrowRequirement, formatAmount } from './marketEscrow';
import {
  creditGameState,
  debitGameState,
  isKnownGameResource,
  isWithdrawalCredited,
  markWithdrawalCredited,
  parseAmountInput,
  persistGameState,
  readHeld,
} from './vaultBridge';

/** Пустой баланс: сервер не присылает нулевые строки, а UI должен что-то показать. */
const EMPTY_BALANCE = (resource: string): VaultBalanceDTO => ({
  resource,
  available: '0',
  locked: '0',
  total: '0',
  updatedAt: 0,
});

/** Ответ сервера -> карта балансов по ресурсу. */
function indexBalances(balances: VaultBalanceDTO[]): Record<string, VaultBalanceDTO> {
  const map: Record<string, VaultBalanceDTO> = {};
  for (const b of balances) map[b.resource] = b;
  return map;
}

/** Сообщение об ошибке из ответа сервера: message для игрока, error как запас. */
function errorText(
  result: { error?: string; message?: string } | null | undefined,
  fallback: string,
): string {
  return result?.message || result?.error || fallback;
}

// ==========================================
// ТИПЫ СТЕЙТА
// ==========================================

interface MarketState {
  // Состояние загрузки
  isLoading: boolean;
  error: string | null;
  
  // Ордера
  orders: MarketOrderDTO[];
  myOrders: MarketOrderDTO[];
  ordersTotal: number;
  
  // Книга ордеров
  orderBook: OrderBookDTO | null;
  selectedResource: TradeResourceType | null;
  
  // История сделок
  tradeHistory: MarketTradeDTO[];
  tradeHistoryTotal: number;
  
  // Цены
  prices: MarketPricesDTO[];
  
  // Трейдеры
  traderProfile: TraderProfileDTO | null;
  leaderboard: TraderProfileDTO[];
  leaderboardTotal: number;
  
  // Гильдии
  myGuild: TradeGuildDTO | null;
  guilds: TradeGuildDTO[];
  guildsTotal: number;
  selectedGuild: TradeGuildDTO | null;
  guildChat: GuildChatMessage[];
  
  // Pending транзакции
  pendingTransactions: PendingTransaction[];

  // ------------------------------------------------------------------
  // СЕЙФ БИРЖИ
  // Отдельные флаги загрузки/ошибки: сейф грузится независимо от книги
  // ордеров, и общий isLoading заставлял бы мигать обе панели сразу.
  // ------------------------------------------------------------------
  vaultCredits: VaultBalanceDTO;
  /** Только ненулевые ресурсы (сервер нулевые строки не присылает). */
  vaultBalances: Record<string, VaultBalanceDTO>;
  vaultLoadedAt: number;
  vaultLoading: boolean;
  vaultError: string | null;
  /** Идёт пополнение или вывод — на это время формы блокируются. */
  vaultBusy: boolean;
  vaultLedger: VaultLedgerEntryDTO[];
  vaultLedgerLoading: boolean;

  // Незавершённые выводы (сервер уже списал, игрок ещё не получил)
  pendingWithdrawals: VaultWithdrawalDTO[];
  withdrawalsLoading: boolean;
  withdrawalsError: string | null;

  // Прямые сделки с игроками
  offersPublic: DirectOfferDTO[];
  offersIncoming: DirectOfferDTO[];
  offersOutgoing: DirectOfferDTO[];
  offersLoading: boolean;
  offersError: string | null;
  /** id предложения, по которому сейчас идёт действие (принять/отклонить/отменить). */
  offerBusyId: string | null;

  /** Моя ставка комиссии в процентах: нужна, чтобы посчитать эскроу ДО отправки. */
  myFeePercent: number;

  // UI состояние
  activeTab: 'orders' | 'myOrders' | 'history' | 'prices' | 'leaderboard' | 'guild' | 'vault' | 'offers';
  orderFormType: OrderType;
  orderFormResource: TradeResourceType | null;
  orderFormQuantity: string;
  orderFormPrice: string;
}

interface MarketActions {
  // Загрузка данных
  fetchOrders: (resource?: TradeResourceType, type?: OrderType) => Promise<void>;
  fetchMyOrders: () => Promise<void>;
  fetchOrderBook: (resource: TradeResourceType) => Promise<void>;
  fetchTradeHistory: () => Promise<void>;
  fetchPrices: () => Promise<void>;
  fetchLeaderboard: (sortBy?: 'volume' | 'trades') => Promise<void>;
  fetchTraderProfile: (playerId: string) => Promise<void>;
  
  // Ордера
  createOrder: () => Promise<boolean>;
  cancelOrder: (orderId: string) => Promise<boolean>;
  
  // Гильдии
  fetchMyGuild: () => Promise<void>;
  fetchGuilds: (search?: string) => Promise<void>;
  fetchGuild: (guildId: string) => Promise<void>;
  createGuild: (name: string, tag: string) => Promise<boolean>;
  joinGuild: (guildId: string) => Promise<boolean>;
  leaveGuild: () => Promise<boolean>;
  promoteMember: (targetPlayerId: string) => Promise<boolean>;
  demoteMember: (targetPlayerId: string) => Promise<boolean>;
  kickMember: (targetPlayerId: string) => Promise<boolean>;
  depositToTreasury: (amount: number) => Promise<boolean>;
  
  // Чат гильдии
  fetchGuildChat: () => Promise<void>;
  sendGuildMessage: (message: string) => Promise<boolean>;
  
  /**
   * Pending-транзакции: ТОЛЬКО ЧТЕНИЕ (bigplan.md, пункт 33). Расчёт делает сервер,
   * клиент этот список не применяет — обычно он пуст.
   */
  fetchPendingTransactions: () => Promise<PendingTransaction[]>;

  // Сейф биржи
  fetchVault: () => Promise<void>;
  fetchVaultLedger: (resource?: VaultResource) => Promise<void>;
  /** Пополнить сейф: СНАЧАЛА списывает игровое состояние (см. vaultBridge). */
  depositToVault: (resource: VaultResource, amount: string) => Promise<VaultOpResult>;
  /** Вывести из сейфа и сразу начислить в игровое состояние. */
  withdrawFromVault: (resource: VaultResource, amount: string) => Promise<VaultOpResult>;
  fetchPendingWithdrawals: () => Promise<VaultWithdrawalDTO[]>;
  /** Дочислить незавершённые выводы (восстановление после сбоя). */
  settlePendingWithdrawals: () => Promise<number>;

  // Прямые сделки
  fetchOffers: () => Promise<void>;
  createDirectOffer: (request: CreateOfferRequest) => Promise<VaultOpResult>;
  acceptDirectOffer: (offerId: string) => Promise<VaultOpResult>;
  declineDirectOffer: (offerId: string) => Promise<VaultOpResult>;
  cancelDirectOffer: (offerId: string) => Promise<VaultOpResult>;

  /** Обновить свою ставку комиссии (нужна для расчёта эскроу в формах). */
  fetchMyFeePercent: () => Promise<void>;

  // UI
  setActiveTab: (tab: MarketState['activeTab']) => void;
  setSelectedResource: (resource: TradeResourceType | null) => void;
  setOrderFormType: (type: OrderType) => void;
  setOrderFormResource: (resource: TradeResourceType | null) => void;
  setOrderFormQuantity: (quantity: string) => void;
  setOrderFormPrice: (price: string) => void;
  resetOrderForm: () => void;
  clearError: () => void;
}

type MarketStore = MarketState & MarketActions;

/**
 * Результат операции с сейфом. Компоненты показывают message рядом с формой,
 * поэтому текст всегда человеческий и на русском.
 */
export interface VaultOpResult {
  ok: boolean;
  message?: string;
  /** Предупреждение при успехе: например, «начислено, но игра не сохранилась». */
  warning?: string;
}

/**
 * Довести вывод до конца: начислить в игровое состояние РОВНО ОДИН РАЗ и
 * подтвердить заявку. Используется и обычным выводом, и восстановлением
 * незавершённых выводов, поэтому логика одна и живёт здесь.
 */
async function settleWithdrawal(withdrawal: VaultWithdrawalDTO): Promise<VaultOpResult> {
  const { id, amount } = withdrawal;
  const resource = withdrawal.resource as VaultResource;

  if (!isKnownGameResource(resource)) {
    /*
     * Начислять некуда. Заявку НЕ подтверждаем: она останется 'pending', и
     * товар не исчезнет — его дочислят, когда ресурс появится в состоянии.
     */
    return {
      ok: false,
      message: `Ресурс ${resourceLabel(withdrawal.resource)} отсутствует в игровом состоянии — вывод оставлен в очереди.`,
    };
  }

  let warning: string | undefined;
  if (!isWithdrawalCredited(id)) {
    if (!creditGameState(resource, amount)) {
      return { ok: false, message: 'Не удалось начислить вывод в игровое состояние.' };
    }
    /*
     * Отметка ставится СРАЗУ, синхронно: между мутацией состояния и записью в
     * localStorage нет ни одного await, поэтому даже мгновенная перезагрузка не
     * приведёт к повторному начислению того же вывода.
     */
    markWithdrawalCredited(id);
    if (!(await persistGameState())) {
      warning = 'Начислено, но игру сохранить не удалось — дождитесь автосохранения, не закрывая вкладку.';
    }
  }

  const confirmed = await api.confirmWithdrawal(id).catch(() => null);
  if (!confirmed?.ok) {
    // Локальная отметка уже стоит, поэтому повторное подтверждение (кнопкой или
    // фоновым восстановлением) начислит НОЛЬ и просто закроет заявку.
    return { ok: true, warning: warning ?? 'Начислено, подтверждение не дошло — повторим автоматически.' };
  }
  return warning ? { ok: true, warning } : { ok: true };
}

// ==========================================
// СОЗДАНИЕ СТОРА
// ==========================================

export const useMarketStore = create<MarketStore>((set, get) => ({
  // Начальное состояние
  isLoading: false,
  error: null,
  
  orders: [],
  myOrders: [],
  ordersTotal: 0,
  
  orderBook: null,
  selectedResource: null,
  
  tradeHistory: [],
  tradeHistoryTotal: 0,
  
  prices: [],
  
  traderProfile: null,
  leaderboard: [],
  leaderboardTotal: 0,
  
  myGuild: null,
  guilds: [],
  guildsTotal: 0,
  selectedGuild: null,
  guildChat: [],
  
  pendingTransactions: [],

  vaultCredits: EMPTY_BALANCE(VAULT_CREDITS),
  vaultBalances: {},
  vaultLoadedAt: 0,
  vaultLoading: false,
  vaultError: null,
  vaultBusy: false,
  vaultLedger: [],
  vaultLedgerLoading: false,

  pendingWithdrawals: [],
  withdrawalsLoading: false,
  withdrawalsError: null,

  offersPublic: [],
  offersIncoming: [],
  offersOutgoing: [],
  offersLoading: false,
  offersError: null,
  offerBusyId: null,

  myFeePercent: MARKET_CONSTANTS.BASE_FEE_PERCENT,

  activeTab: 'orders',
  orderFormType: 'buy',
  orderFormResource: null,
  orderFormQuantity: '',
  orderFormPrice: '',

  // ==========================================
  // ЗАГРУЗКА ДАННЫХ
  // ==========================================
  
  fetchOrders: async (resource, type) => {
    set({ isLoading: true, error: null });
    try {
      const result = await api.getMarketOrders({ resource, type });
      if (result.ok) {
        set({ orders: result.orders, ordersTotal: result.total });
      } else {
        set({ error: result.error || 'Ошибка загрузки ордеров' });
      }
    } catch (e) {
      set({ error: String(e) });
    } finally {
      set({ isLoading: false });
    }
  },
  
  fetchMyOrders: async () => {
    set({ isLoading: true, error: null });
    try {
      const result = await api.getMyOrders();
      if (result.ok) {
        set({ myOrders: result.orders });
      } else {
        set({ error: result.error || 'Ошибка загрузки ваших ордеров' });
      }
    } catch (e) {
      set({ error: String(e) });
    } finally {
      set({ isLoading: false });
    }
  },
  
  fetchOrderBook: async (resource) => {
    set({ isLoading: true, error: null, selectedResource: resource });
    try {
      const result = await api.getOrderBook(resource);
      if (result.ok) {
        set({ orderBook: result.orderBook });
      } else {
        set({ error: result.error || 'Ошибка загрузки книги ордеров' });
      }
    } catch (e) {
      set({ error: String(e) });
    } finally {
      set({ isLoading: false });
    }
  },
  
  fetchTradeHistory: async () => {
    set({ isLoading: true, error: null });
    try {
      const result = await api.getTradeHistory();
      if (result.ok) {
        set({ tradeHistory: result.trades, tradeHistoryTotal: result.total });
      } else {
        set({ error: result.error || 'Ошибка загрузки истории' });
      }
    } catch (e) {
      set({ error: String(e) });
    } finally {
      set({ isLoading: false });
    }
  },
  
  fetchPrices: async () => {
    set({ isLoading: true, error: null });
    try {
      const result = await api.getMarketPrices();
      if (result.ok) {
        set({ prices: result.prices });
      } else {
        set({ error: result.error || 'Ошибка загрузки цен' });
      }
    } catch (e) {
      set({ error: String(e) });
    } finally {
      set({ isLoading: false });
    }
  },
  
  fetchLeaderboard: async (sortBy = 'volume') => {
    set({ isLoading: true, error: null });
    try {
      const result = await api.getTraderLeaderboard(50, 0, sortBy);
      if (result.ok) {
        set({ leaderboard: result.traders, leaderboardTotal: result.total });
      } else {
        set({ error: result.error || 'Ошибка загрузки лидерборда' });
      }
    } catch (e) {
      set({ error: String(e) });
    } finally {
      set({ isLoading: false });
    }
  },
  
  fetchTraderProfile: async (playerId) => {
    set({ isLoading: true, error: null });
    try {
      const result = await api.getTraderProfile(playerId);
      if (result.ok) {
        set({ traderProfile: result.trader });
      } else {
        set({ error: result.error || 'Ошибка загрузки профиля' });
      }
    } catch (e) {
      set({ error: String(e) });
    } finally {
      set({ isLoading: false });
    }
  },
  
  // ==========================================
  // ОРДЕРА
  // ==========================================
  
  createOrder: async () => {
    const { orderFormType, orderFormResource, orderFormQuantity, orderFormPrice } = get();

    if (!orderFormResource) {
      set({ error: 'Выберите ресурс' });
      return false;
    }

    const parsedQuantity = parseAmountInput(orderFormQuantity);
    if ('error' in parsedQuantity) {
      set({ error: `Количество: ${parsedQuantity.error}` });
      return false;
    }
    if (D(parsedQuantity.amount).lt(MARKET_CONSTANTS.MIN_ORDER_QUANTITY)) {
      set({ error: `Минимальное количество: ${MARKET_CONSTANTS.MIN_ORDER_QUANTITY}` });
      return false;
    }

    const parsedPrice = parseAmountInput(orderFormPrice);
    if ('error' in parsedPrice) {
      set({ error: `Цена: ${parsedPrice.error}` });
      return false;
    }

    set({ isLoading: true, error: null });
    try {
      /*
       * ЭСКРОУ ПРОВЕРЯЕТСЯ ДО ОТПРАВКИ.
       * Сервер всё равно откажет (INSUFFICIENT_VAULT_BALANCE), но узнавать об этом
       * после нажатия кнопки — плохо: игрок не понимает, что торговать можно только
       * тем, что внесено в сейф. Сейф перечитывается свежим запросом: по устаревшему
       * снимку легко заблокировать ордер, который сервер бы принял.
       */
      await get().fetchVault();
      const requirement = orderEscrowRequirement(
        orderFormType,
        orderFormResource,
        parsedQuantity.amount,
        parsedPrice.amount,
        get().myFeePercent,
      );
      const balance =
        requirement.resource === VAULT_CREDITS
          ? get().vaultCredits
          : get().vaultBalances[requirement.resource] ?? EMPTY_BALANCE(requirement.resource);

      if (D(balance.available).lt(requirement.required)) {
        set({
          error:
            requirement.resource === VAULT_CREDITS
              ? `В сейфе биржи недостаточно кредитов: нужно ${formatAmount(requirement.required)} ` +
                `(включая комиссию ${formatAmount(requirement.fee)}), свободно ${formatAmount(balance.available)}. ` +
                'Пополните сейф во вкладке «Кошелёк биржи».'
              : `В сейфе биржи недостаточно ресурса: нужно ${formatAmount(requirement.required)}, ` +
                `свободно ${formatAmount(balance.available)}. Внесите ресурс во вкладке «Кошелёк биржи».`,
        });
        return false;
      }

      const result = await api.createOrder({
        type: orderFormType,
        resource: orderFormResource,
        quantity: parsedQuantity.amount,
        pricePerUnit: parsedPrice.amount,
      });

      if (result.ok) {
        // Сервер прислал ставку комиссии, зафиксированную в ордере — она
        // авторитетнее той, что мы вывели из профиля трейдера.
        const serverFee = result.order?.feePercent;
        if (serverFee && Number.isFinite(parseFloat(serverFee))) {
          set({ myFeePercent: parseFloat(serverFee) });
        }
        // Обновляем списки
        get().fetchMyOrders();
        get().fetchOrders(orderFormResource);
        if (get().selectedResource === orderFormResource) {
          get().fetchOrderBook(orderFormResource);
        }
        // Эскроу ушло в locked, а исполнение уже зачислено в сейф.
        get().fetchVault();
        get().resetOrderForm();
        return true;
      } else {
        set({ error: errorText(result, 'Ошибка создания ордера') });
        return false;
      }
    } catch (e) {
      set({ error: String(e) });
      return false;
    } finally {
      set({ isLoading: false });
    }
  },
  
  cancelOrder: async (orderId) => {
    set({ isLoading: true, error: null });
    try {
      const result = await api.cancelOrder(orderId);
      if (result.ok) {
        get().fetchMyOrders();
        // Неисполненный остаток эскроу вернулся locked -> available.
        get().fetchVault();
        return true;
      } else {
        set({ error: errorText(result, 'Ошибка отмены ордера') });
        return false;
      }
    } catch (e) {
      set({ error: String(e) });
      return false;
    } finally {
      set({ isLoading: false });
    }
  },
  
  // ==========================================
  // ГИЛЬДИИ
  // ==========================================
  
  fetchMyGuild: async () => {
    set({ isLoading: true, error: null });
    try {
      const result = await api.getMyGuild();
      if (result.ok) {
        set({ myGuild: result.guild || null });
      } else {
        set({ error: result.error || 'Ошибка загрузки гильдии' });
      }
    } catch (e) {
      set({ error: String(e) });
    } finally {
      set({ isLoading: false });
    }
  },
  
  fetchGuilds: async (search) => {
    set({ isLoading: true, error: null });
    try {
      const result = await api.getGuilds(50, 0, search);
      if (result.ok) {
        set({ guilds: result.guilds, guildsTotal: result.total });
      } else {
        set({ error: result.error || 'Ошибка загрузки гильдий' });
      }
    } catch (e) {
      set({ error: String(e) });
    } finally {
      set({ isLoading: false });
    }
  },
  
  fetchGuild: async (guildId) => {
    set({ isLoading: true, error: null });
    try {
      const result = await api.getGuild(guildId);
      if (result.ok && result.guild) {
        set({ selectedGuild: result.guild });
      } else {
        set({ error: result.error || 'Ошибка загрузки гильдии' });
      }
    } catch (e) {
      set({ error: String(e) });
    } finally {
      set({ isLoading: false });
    }
  },
  
  createGuild: async (name, tag) => {
    set({ isLoading: true, error: null });
    try {
      const result = await api.createGuild(name, tag);
      if (result.ok) {
        get().fetchMyGuild();
        return true;
      } else {
        set({ error: result.error || 'Ошибка создания гильдии' });
        return false;
      }
    } catch (e) {
      set({ error: String(e) });
      return false;
    } finally {
      set({ isLoading: false });
    }
  },
  
  joinGuild: async (guildId) => {
    set({ isLoading: true, error: null });
    try {
      const result = await api.joinGuild(guildId);
      if (result.ok) {
        get().fetchMyGuild();
        return true;
      } else {
        set({ error: result.error || 'Ошибка вступления в гильдию' });
        return false;
      }
    } catch (e) {
      set({ error: String(e) });
      return false;
    } finally {
      set({ isLoading: false });
    }
  },
  
  leaveGuild: async () => {
    const { myGuild } = get();
    if (!myGuild) return false;
    
    set({ isLoading: true, error: null });
    try {
      const result = await api.leaveGuild(myGuild.id);
      if (result.ok) {
        set({ myGuild: null, guildChat: [] });
        return true;
      } else {
        set({ error: result.error || 'Ошибка выхода из гильдии' });
        return false;
      }
    } catch (e) {
      set({ error: String(e) });
      return false;
    } finally {
      set({ isLoading: false });
    }
  },
  
  promoteMember: async (targetPlayerId) => {
    const { myGuild } = get();
    if (!myGuild) return false;
    
    set({ isLoading: true, error: null });
    try {
      const result = await api.promoteMember(myGuild.id, targetPlayerId);
      if (result.ok) {
        get().fetchGuild(myGuild.id);
        return true;
      } else {
        set({ error: result.error || 'Ошибка повышения' });
        return false;
      }
    } catch (e) {
      set({ error: String(e) });
      return false;
    } finally {
      set({ isLoading: false });
    }
  },
  
  demoteMember: async (targetPlayerId) => {
    const { myGuild } = get();
    if (!myGuild) return false;
    
    set({ isLoading: true, error: null });
    try {
      const result = await api.demoteMember(myGuild.id, targetPlayerId);
      if (result.ok) {
        get().fetchGuild(myGuild.id);
        return true;
      } else {
        set({ error: result.error || 'Ошибка понижения' });
        return false;
      }
    } catch (e) {
      set({ error: String(e) });
      return false;
    } finally {
      set({ isLoading: false });
    }
  },
  
  kickMember: async (targetPlayerId) => {
    const { myGuild } = get();
    if (!myGuild) return false;
    
    set({ isLoading: true, error: null });
    try {
      const result = await api.kickMember(myGuild.id, targetPlayerId);
      if (result.ok) {
        get().fetchGuild(myGuild.id);
        return true;
      } else {
        set({ error: result.error || 'Ошибка исключения' });
        return false;
      }
    } catch (e) {
      set({ error: String(e) });
      return false;
    } finally {
      set({ isLoading: false });
    }
  },
  
  depositToTreasury: async (amount) => {
    const { myGuild } = get();
    if (!myGuild) return false;
    
    set({ isLoading: true, error: null });
    try {
      const result = await api.depositToTreasury(myGuild.id, amount);
      if (result.ok) {
        get().fetchMyGuild();
        return true;
      } else {
        set({ error: result.error || 'Ошибка взноса' });
        return false;
      }
    } catch (e) {
      set({ error: String(e) });
      return false;
    } finally {
      set({ isLoading: false });
    }
  },
  
  // ==========================================
  // ЧАТ ГИЛЬДИИ
  // ==========================================
  
  fetchGuildChat: async () => {
    const { myGuild } = get();
    if (!myGuild) return;
    
    try {
      const result = await api.getGuildChat(myGuild.id);
      if (result.ok) {
        set({ guildChat: result.messages });
      }
    } catch (e) {
      console.error('Error fetching guild chat:', e);
    }
  },
  
  sendGuildMessage: async (message) => {
    const { myGuild } = get();
    if (!myGuild) return false;
    
    try {
      const result = await api.sendGuildMessage(myGuild.id, message);
      if (result.ok && result.message) {
        set(state => ({
          guildChat: [...state.guildChat, result.message!]
        }));
        return true;
      } else {
        set({ error: result.error || 'Ошибка отправки сообщения' });
        return false;
      }
    } catch (e) {
      set({ error: String(e) });
      return false;
    }
  },
  
  // ==========================================
  // PENDING ТРАНЗАКЦИИ
  // ==========================================
  
  fetchPendingTransactions: async () => {
    try {
      const result = await api.getPendingTransactions();
      if (result.ok) {
        set({ pendingTransactions: result.transactions });
        return result.transactions;
      }
      return [];
    } catch (e) {
      console.error('Error fetching pending transactions:', e);
      return [];
    }
  },
  

  // ==========================================
  // СЕЙФ БИРЖИ
  // ==========================================

  fetchVault: async () => {
    set({ vaultLoading: true, vaultError: null });
    try {
      const result = await api.getVault();
      if (result.ok) {
        set({
          vaultCredits: result.credits ?? EMPTY_BALANCE(VAULT_CREDITS),
          vaultBalances: indexBalances(result.balances ?? []),
          vaultLoadedAt: Date.now(),
        });
      } else {
        set({ vaultError: errorText(result, 'Не удалось загрузить сейф биржи') });
      }
    } catch (e) {
      set({ vaultError: String(e) });
    } finally {
      set({ vaultLoading: false });
    }
  },

  fetchVaultLedger: async (resource) => {
    set({ vaultLedgerLoading: true });
    try {
      const result = await api.getVaultLedger(50, resource);
      if (result.ok) {
        set({ vaultLedger: result.entries ?? [] });
      } else {
        set({ vaultError: errorText(result, 'Не удалось загрузить журнал сейфа') });
      }
    } catch (e) {
      set({ vaultError: String(e) });
    } finally {
      set({ vaultLedgerLoading: false });
    }
  },

  /**
   * ПОПОЛНЕНИЕ: списать у себя -> сохранить -> сообщить серверу.
   *
   * Именно в этом порядке. Обратный порядок (сначала сервер) при падении между
   * запросом и списанием оставлял бы ресурс и в сейфе, и в игре — то самое
   * удвоение, против которого весь сейф и сделан. Подробнее — в шапке vaultBridge.ts.
   */
  depositToVault: async (resource, amount) => {
    if (get().vaultBusy) return { ok: false, message: 'Операция с сейфом уже выполняется.' };

    const parsed = parseAmountInput(amount);
    if ('error' in parsed) return { ok: false, message: parsed.error };
    const value = parsed.amount;

    if (!isKnownGameResource(resource)) {
      return { ok: false, message: 'Этот ресурс не найден в вашем игровом состоянии.' };
    }

    // Никогда не вносим больше, чем игрок реально держит.
    const held = readHeld(resource);
    if (held.lt(D(value))) {
      return {
        ok: false,
        message: `У вас в игре только ${formatAmount(held)} — внести ${formatAmount(value)} нельзя.`,
      };
    }

    set({ vaultBusy: true, vaultError: null });
    try {
      // Снимок ИТОГА до операции: нужен для сверки, если ответ потеряется.
      // Сам снимок не критичен — если его не удалось получить, сверка просто
      // не сможет подтвердить спорный случай и трактует его как «не дошло».
      const before = await api.getVault().catch(() => null);
      const beforeTotal = before?.ok
        ? (before.balances ?? []).find((b) => b.resource === resource)?.total ?? '0'
        : null;

      if (!debitGameState(resource, value)) {
        return { ok: false, message: 'Не удалось списать ресурс из игрового состояния.' };
      }
      const savedBefore = await persistGameState();

      let result;
      try {
        result = await api.depositToVault(resource, value);
      } catch (networkError) {
        /*
         * Сетевой сбой: неизвестно, дошёл ли запрос. Сверяемся с сейфом —
         * если итог вырос на внесённую величину, значит дошёл и списание верно.
         * Сомнение трактуем в пользу «дошло»: вернуть игроку ресурс, который
         * уже лёг в сейф, значит выпустить его из воздуха.
         */
        const after = await api.getVault().catch(() => null);
        const afterTotal = after?.ok
          ? (after.balances ?? []).find((b) => b.resource === resource)?.total ?? '0'
          : null;
        const landed =
          beforeTotal !== null &&
          afterTotal !== null &&
          D(afterTotal).gte(D(beforeTotal).add(D(value)));

        if (!landed) {
          creditGameState(resource, value);
          await persistGameState();
          return { ok: false, message: `Сеть недоступна, пополнение отменено (${String(networkError)}).` };
        }
        await get().fetchVault();
        return { ok: true, warning: 'Ответ сервера потерялся, но пополнение подтверждено сверкой с сейфом.' };
      }

      if (!result.ok) {
        // Явный отказ = сервер точно ничего не записал, списание откатываем.
        creditGameState(resource, value);
        await persistGameState();
        return { ok: false, message: errorText(result, 'Не удалось пополнить сейф') };
      }

      await get().fetchVault();
      get().fetchVaultLedger();
      return {
        ok: true,
        warning: savedBefore ? undefined : 'Внесено, но игру сохранить не удалось — проверьте соединение.',
      };
    } catch (e) {
      /*
       * Непредвиденный сбой. Списание к этому моменту либо ещё не выполнялось,
       * либо уже подтверждено сервером (сам запрос обёрнут отдельно выше), так
       * что откатывать нечего — сообщаем и обновляем сейф из истины.
       */
      await get().fetchVault();
      return { ok: false, message: `Сбой при пополнении сейфа: ${String(e)}` };
    } finally {
      set({ vaultBusy: false });
    }
  },

  /**
   * ВЫВОД: сервер списывает из сейфа и создаёт заявку 'pending', затем клиент
   * начисляет себе, отмечает это локально и подтверждает заявку. Порядок обратен
   * пополнению по той же причине: потерянный шаг должен приводить к «товар ещё
   * на сервере», а не к «товар и там, и там».
   */
  withdrawFromVault: async (resource, amount) => {
    if (get().vaultBusy) return { ok: false, message: 'Операция с сейфом уже выполняется.' };

    const parsed = parseAmountInput(amount);
    if ('error' in parsed) return { ok: false, message: parsed.error };
    const value = parsed.amount;

    if (!isKnownGameResource(resource)) {
      return { ok: false, message: 'Этот ресурс не найден в вашем игровом состоянии — начислять его некуда.' };
    }

    set({ vaultBusy: true, vaultError: null });
    try {
      const result = await api.withdrawFromVault(resource, value);
      if (!result.ok || !result.withdrawal) {
        const detail =
          result.required && result.available
            ? ` Нужно ${formatAmount(result.required)}, свободно ${formatAmount(result.available)}.`
            : '';
        return { ok: false, message: `${errorText(result, 'Не удалось вывести из сейфа')}${detail}` };
      }

      const settled = await settleWithdrawal(result.withdrawal);
      await get().fetchVault();
      get().fetchVaultLedger();
      await get().fetchPendingWithdrawals();
      return settled;
    } catch (e) {
      /*
       * Заявка могла быть создана до обрыва: ценность уже вне сейфа и висит в
       * pending. Не теряем её — показываем в «Незавершённые выводы», откуда её
       * дочислит либо кнопка «Забрать», либо фоновое восстановление.
       */
      await get().fetchPendingWithdrawals();
      return {
        ok: false,
        message: `Связь прервалась (${String(e)}). Проверьте раздел «Незавершённые выводы».`,
      };
    } finally {
      set({ vaultBusy: false });
    }
  },

  fetchPendingWithdrawals: async () => {
    set({ withdrawalsLoading: true, withdrawalsError: null });
    try {
      const result = await api.getPendingWithdrawals();
      if (result.ok) {
        const withdrawals = result.withdrawals ?? [];
        set({ pendingWithdrawals: withdrawals });
        return withdrawals;
      }
      set({ withdrawalsError: errorText(result, 'Не удалось загрузить незавершённые выводы') });
      return [];
    } catch (e) {
      set({ withdrawalsError: String(e) });
      return [];
    } finally {
      set({ withdrawalsLoading: false });
    }
  },

  settlePendingWithdrawals: async () => {
    const withdrawals = await get().fetchPendingWithdrawals();
    if (withdrawals.length === 0) return 0;

    let settled = 0;
    for (const withdrawal of withdrawals) {
      const result = await settleWithdrawal(withdrawal);
      if (result.ok) settled += 1;
    }
    if (settled > 0) {
      await get().fetchPendingWithdrawals();
      await get().fetchVault();
    }
    return settled;
  },

  // ==========================================
  // ПРЯМЫЕ СДЕЛКИ С ИГРОКАМИ
  // ==========================================

  fetchOffers: async () => {
    set({ offersLoading: true, offersError: null });
    try {
      const [open, mine] = await Promise.all([api.getOffers(), api.getMyOffers()]);

      if (open.ok) {
        // Свои публичные предложения приходят и здесь — в «Доступные» им не место.
        set({ offersPublic: (open.offers ?? []).filter((o) => !o.isMine) });
      } else {
        set({ offersError: errorText(open, 'Не удалось загрузить предложения') });
      }

      if (mine.ok) {
        set({
          offersIncoming: mine.incoming ?? [],
          offersOutgoing: mine.outgoing ?? [],
        });
      } else {
        set({ offersError: errorText(mine, 'Не удалось загрузить ваши предложения') });
      }
    } catch (e) {
      set({ offersError: String(e) });
    } finally {
      set({ offersLoading: false });
    }
  },

  createDirectOffer: async (request) => {
    set({ offersLoading: true, offersError: null });
    try {
      const result = await api.createOffer(request);
      if (!result.ok) {
        const detail =
          result.required && result.available
            ? ` Нужно ${formatAmount(result.required)}, свободно ${formatAmount(result.available)}.`
            : '';
        const message = `${errorText(result, 'Не удалось создать предложение')}${detail}`;
        set({ offersError: message });
        return { ok: false, message };
      }
      await get().fetchOffers();
      // Товар ушёл в эскроу: available уменьшился, locked вырос.
      // Ждём обновления сейфа: вызвавший код (и UI) должен увидеть новый locked
      // сразу после успеха, а не через один кадр.
      await get().fetchVault();
      return { ok: true };
    } catch (e) {
      set({ offersError: String(e) });
      return { ok: false, message: String(e) };
    } finally {
      set({ offersLoading: false });
    }
  },

  acceptDirectOffer: async (offerId) => {
    set({ offerBusyId: offerId, offersError: null });
    try {
      const result = await api.acceptOffer(offerId);
      if (!result.ok) {
        const detail =
          result.required && result.available
            ? ` Нужно ${formatAmount(result.required)}, свободно ${formatAmount(result.available)}.`
            : '';
        const message = `${errorText(result, 'Не удалось принять предложение')}${detail}`;
        set({ offersError: message });
        return { ok: false, message };
      }
      await get().fetchOffers();
      await get().fetchVault();
      get().fetchVaultLedger();
      return {
        ok: true,
        // Обмен произошёл ВНУТРИ сейфа: в игровое состояние товар попадёт
        // только после вывода, и игрок должен это понимать.
        warning: 'Товар зачислен в сейф биржи. Чтобы использовать его в игре, выведите его во вкладке «Кошелёк биржи».',
      };
    } catch (e) {
      set({ offersError: String(e) });
      return { ok: false, message: String(e) };
    } finally {
      set({ offerBusyId: null });
    }
  },

  declineDirectOffer: async (offerId) => {
    set({ offerBusyId: offerId, offersError: null });
    try {
      const result = await api.declineOffer(offerId);
      if (!result.ok) {
        const message = errorText(result, 'Не удалось отклонить предложение');
        set({ offersError: message });
        return { ok: false, message };
      }
      await get().fetchOffers();
      return { ok: true };
    } catch (e) {
      set({ offersError: String(e) });
      return { ok: false, message: String(e) };
    } finally {
      set({ offerBusyId: null });
    }
  },

  cancelDirectOffer: async (offerId) => {
    set({ offerBusyId: offerId, offersError: null });
    try {
      const result = await api.cancelOffer(offerId);
      if (!result.ok) {
        const message = errorText(result, 'Не удалось отменить предложение');
        set({ offersError: message });
        return { ok: false, message };
      }
      await get().fetchOffers();
      // Эскроу вернулось в available.
      await get().fetchVault();
      return { ok: true };
    } catch (e) {
      set({ offersError: String(e) });
      return { ok: false, message: String(e) };
    } finally {
      set({ offerBusyId: null });
    }
  },

  fetchMyFeePercent: async () => {
    const playerId = getUserId();
    if (!playerId) return;
    try {
      const result = await api.getTraderProfile(playerId);
      if (!result.ok || !result.trader) return; // 404 у новичка — остаётся базовая ставка
      const volume = parseFloat(result.trader.totalVolume ?? '0');
      set({
        myFeePercent: calculateFeePercent(
          Number.isFinite(volume) ? volume : 0,
          !!result.trader.guildId,
        ),
      });
    } catch {
      // Ставка нужна только для предварительной оценки эскроу — молча оставляем базовую.
    }
  },

  // ==========================================
  // UI
  // ==========================================
  
  setActiveTab: (tab) => set({ activeTab: tab }),
  
  setSelectedResource: (resource) => {
    set({ selectedResource: resource });
    if (resource) {
      get().fetchOrderBook(resource);
    }
  },
  
  setOrderFormType: (type) => set({ orderFormType: type }),
  setOrderFormResource: (resource) => set({ orderFormResource: resource }),
  setOrderFormQuantity: (quantity) => set({ orderFormQuantity: quantity }),
  setOrderFormPrice: (price) => set({ orderFormPrice: price }),
  
  resetOrderForm: () => set({
    orderFormType: 'buy',
    orderFormResource: null,
    orderFormQuantity: '',
    orderFormPrice: '',
  }),
  
  clearError: () => set({ error: null }),
}));

// Экспортируем типы для использования в компонентах
export type { MarketState, MarketActions };
