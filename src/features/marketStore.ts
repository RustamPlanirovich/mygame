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
} from '../core/gameTypes.market';
import * as api from '../utils/marketApi';
import type { GuildChatMessage } from '../utils/marketApi';

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
  
  // UI состояние
  activeTab: 'orders' | 'myOrders' | 'history' | 'prices' | 'leaderboard' | 'guild';
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
    
    const quantity = parseFloat(orderFormQuantity);
    const price = parseFloat(orderFormPrice);
    
    if (isNaN(quantity) || quantity < 10) {
      set({ error: 'Минимальное количество: 10' });
      return false;
    }
    
    if (isNaN(price) || price <= 0) {
      set({ error: 'Укажите корректную цену' });
      return false;
    }
    
    set({ isLoading: true, error: null });
    try {
      const result = await api.createOrder({
        type: orderFormType,
        resource: orderFormResource,
        quantity: orderFormQuantity,
        pricePerUnit: orderFormPrice,
      });
      
      if (result.ok) {
        // Обновляем списки
        get().fetchMyOrders();
        get().fetchOrders(orderFormResource);
        if (get().selectedResource === orderFormResource) {
          get().fetchOrderBook(orderFormResource);
        }
        get().resetOrderForm();
        return true;
      } else {
        set({ error: result.error || 'Ошибка создания ордера' });
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
        return true;
      } else {
        set({ error: result.error || 'Ошибка отмены ордера' });
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
