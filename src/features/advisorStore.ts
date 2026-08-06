/**
 * Advisor Store
 * Финансовый помощник и AI-интеграция
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import Decimal from 'break_eternity.js';
import type {
  FinancialAdvisorConfig,
  FinancialAdvisorTier,
  AdvisorRecommendation,
  AIMarketAnalysis,
  AIMarketPrediction,
  P2PLoanOffer,
  P2PLoan,
  AIDividendPrediction,
} from '../core/gameTypes.ai';
import { ADVISOR_PRICES } from '../core/gameTypes.ai';
import { D } from '../core/math/format';
import { useFinanceStore } from './financeStore';

// ==========================================
// API ФУНКЦИИ
// ==========================================

const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api`;

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const token = localStorage.getItem('authToken');
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE}${url}`, { ...options, headers });
  return response.json();
}

// ==========================================
// STORE ТИПЫ
// ==========================================

interface P2PStats {
  openOffers: number;
  availableAmount: string;
  averageRate: number;
  totalLoans: number;
  activeLoans: number;
  paidLoans: number;
  defaultedLoans: number;
  totalVolume: string;
}

interface OfflineTrade {
  session: number;
  type: 'profit' | 'loss';
  asset: string;
  action: string;
  amount: string;
  profit: string;
  returnPercent: string;
}

interface OfflineProfitResult {
  hasOfflineProfit: boolean;
  reason?: string;
  offlineMinutes?: number;
  offlineTimeFormatted?: string;
  tradesExecuted?: number;
  totalProfit?: string;
  trades?: OfflineTrade[];
  riskTolerance?: string;
  efficiencyPercent?: number;
}

interface AdvisorStore {
  // Конфигурация помощника
  advisor: FinancialAdvisorConfig;

  // AI анализ рынка
  marketAnalysis: AIMarketAnalysis | null;
  lastAnalysisUpdate: number;
  isLoadingAnalysis: boolean;

  // Рекомендации
  recommendations: AdvisorRecommendation[];

  // P2P данные (кэш)
  p2pOffers: P2PLoanOffer[];
  myP2POffers: P2PLoanOffer[];
  myLoansAsLender: P2PLoan[];
  myLoansAsBorrower: P2PLoan[];
  p2pStats: P2PStats | null;

  // AI дивиденды
  dividendPrediction: AIDividendPrediction | null;
  lastDividendUpdate: number;

  // AI статус
  aiEnabled: boolean;

  // Интервал автотрейдера
  autoTraderInterval: ReturnType<typeof setInterval> | null;

  // Статистика автотрейдера
  autoTraderStats: {
    startingBalance: string;
    tradesThisHour: number;
    lastHourReset: number;
    totalProfitLoss: string;
    isPaused: boolean;
    pauseReason: string;
    // Система защиты капитала
    tradingCapital: string;      // Базовый торговый капитал
    frozenProfit: string;        // Замороженная прибыль (90% от заработка)
    accumulatedLoss: string;     // Накопленные убытки
    capitalProtectionActive: boolean; // Флаг активности защиты
    lastTradeBalance: string;    // Баланс после последней сделки для отслеживания P/L
    totalSavedToSavings: string; // Сколько всего переведено на сберегательный
  };

  // Действия
  purchaseAdvisor: (tier: FinancialAdvisorTier, payCredits: (amount: Decimal) => boolean) => boolean;
  upgradeToPremiun: (payCredits: (amount: Decimal) => boolean) => boolean;
  updateAdvisorSettings: (settings: Partial<FinancialAdvisorConfig['autoTrading']>) => void;
  startAutoTrader: () => void;
  stopAutoTrader: () => void;

  // AI
  checkAIStatus: () => Promise<void>;
  fetchMarketAnalysis: (prices: Record<string, string>) => Promise<void>;
  fetchRecommendations: () => Promise<void>;
  executeRecommendation: (id: string) => Promise<boolean>;
  fetchAIDividends: (stocks: Array<{ id: string; symbol: string; sector: string; dividendYield: number; currentPrice: string }>) => Promise<AIDividendPrediction | null>;
  getAIDividendYield: (stockId: string) => number | null;

  // P2P
  fetchP2POffers: () => Promise<void>;
  fetchMyP2PData: () => Promise<void>;
  fetchP2PStats: () => Promise<void>;
  createP2POffer: (
    amount: string,
    interestRate: number,
    termDays: number,
    minCreditScore: number
  ) => Promise<{ success: boolean; error?: string }>;
  cancelP2POffer: (offerId: string) => Promise<boolean>;
  borrowP2P: (
    offerId: string,
    creditScore: number
  ) => Promise<{ success: boolean; amountReceived?: string; error?: string }>;
  payP2PLoan: (loanId: string, amount: string) => Promise<{ success: boolean; error?: string }>;

  // Офлайн-трейдинг
  offlineProfit: OfflineProfitResult | null;
  saveOfflineState: (slotId: number) => Promise<void>;
  calculateOfflineProfit: (slotId: number) => Promise<OfflineProfitResult | null>;
  sendHeartbeat: (slotId: number) => Promise<void>;
  clearOfflineProfit: () => void;

  // Автоматический трейдинг
  runAutoTrader: () => Promise<void>;

  // Сброс
  resetAdvisor: () => void;
}

// ==========================================
// НАЧАЛЬНОЕ СОСТОЯНИЕ
// ==========================================

const INITIAL_ADVISOR_STATE: FinancialAdvisorConfig = {
  tier: 'none',
  autoTrading: {
    enabled: false,
    maxInvestmentPercent: 10,
    minConfidence: 0.7,
    riskTolerance: 'medium',
    allowLoans: false,
    allowLending: false,
    takeProfitPercent: 10, // Фиксировать при +10%
    stopLossPercent: 5, // Продавать при -5%
  },
};

// ==========================================
// СОЗДАНИЕ STORE
// ==========================================

export const useAdvisorStore = create<AdvisorStore>()(
  persist(
    (set, get) => ({
      advisor: INITIAL_ADVISOR_STATE,
      marketAnalysis: null,
      lastAnalysisUpdate: 0,
      isLoadingAnalysis: false,
      recommendations: [],
      p2pOffers: [],
      myP2POffers: [],
      myLoansAsLender: [],
      myLoansAsBorrower: [],
      p2pStats: null,
      dividendPrediction: null,
      lastDividendUpdate: 0,
      aiEnabled: false,
      autoTraderInterval: null,
      autoTraderStats: {
        startingBalance: '0',
        tradesThisHour: 0,
        lastHourReset: 0,
        totalProfitLoss: '0',
        isPaused: false,
        pauseReason: '',
        // Система защиты капитала
        tradingCapital: '0',
        frozenProfit: '0',
        accumulatedLoss: '0',
        capitalProtectionActive: true,
        lastTradeBalance: '0',
        totalSavedToSavings: '0',
      },
      
      // Офлайн-прибыль
      offlineProfit: null,

      // ========================================
      // ПОКУПКА ПОМОЩНИКА
      // ========================================

      purchaseAdvisor: (tier, payCredits) => {
        if (tier === 'none') return true;

        const priceData = ADVISOR_PRICES[tier];
        const price = D(priceData.credits);

        if (!payCredits(price)) {
          return false;
        }

        set({
          advisor: {
            ...get().advisor,
            tier,
            purchasedAt: Date.now(),
          },
        });

        // Для премиума автоматически запускаем автотрейдер
        if (tier === 'premium') {
          get().startAutoTrader();
        }

        return true;
      },

      upgradeToPremiun: (payCredits) => {
        const state = get();
        
        if (state.advisor.tier !== 'basic') {
          return false;
        }

        // Цена апгрейда = разница между премиум и базовым
        const upgradeCost = D(ADVISOR_PRICES.premium.credits).sub(D(ADVISOR_PRICES.basic.credits));

        if (!payCredits(upgradeCost)) {
          return false;
        }

        set({
          advisor: {
            ...state.advisor,
            tier: 'premium',
            purchasedAt: Date.now(),
          },
        });

        // Запускаем автотрейдер
        get().startAutoTrader();

        return true;
      },

      updateAdvisorSettings: (settings) => {
        set({
          advisor: {
            ...get().advisor,
            autoTrading: {
              ...get().advisor.autoTrading,
              ...settings,
            },
          },
        });

        // Если включили/выключили автоторговлю
        const state = get();
        if (state.advisor.tier === 'premium') {
          if (settings.enabled === true) {
            state.startAutoTrader();
          } else if (settings.enabled === false) {
            state.stopAutoTrader();
          }
        }
      },

      startAutoTrader: () => {
        const state = get();
        
        console.log('[AutoTrader] Starting...');
        
        // Останавливаем предыдущий если есть
        if (state.autoTraderInterval) {
          clearInterval(state.autoTraderInterval);
        }

        // Запускаем автотрейдер каждые 30 секунд
        const interval = setInterval(() => {
          const currentState = get();
          console.log('[AutoTrader] Interval tick');
          if (currentState.advisor.tier === 'premium' && currentState.advisor.autoTrading.enabled) {
            currentState.runAutoTrader();
          }
        }, 30 * 1000); // 30 секунд

        // Первый запуск сразу
        console.log('[AutoTrader] First run');
        if (state.advisor.autoTrading.enabled) {
          state.runAutoTrader();
        }

        set({ autoTraderInterval: interval });
      },

      stopAutoTrader: () => {
        const state = get();
        if (state.autoTraderInterval) {
          clearInterval(state.autoTraderInterval);
          set({ autoTraderInterval: null });
        }
      },

      // ========================================
      // AI СТАТУС И АНАЛИЗ
      // ========================================

      checkAIStatus: async () => {
        try {
          const response = await fetch(`${API_BASE}/ai/status`);
          const data = await response.json();
          if (data.ok) {
            set({ aiEnabled: data.aiEnabled });
          }
        } catch (error) {
          console.error('Error checking AI status:', error);
          set({ aiEnabled: false });
        }
      },

      fetchMarketAnalysis: async (prices) => {
        const state = get();

        // Данные кэшируются на сервере (Oracle), можем запрашивать чаще
        // Но клиент всё равно ограничиваем до 1 раза в минуту для снижения нагрузки
        if (Date.now() - state.lastAnalysisUpdate < 60 * 1000) {
          return;
        }

        set({ isLoadingAnalysis: true });

        try {
          const pricesParam = encodeURIComponent(JSON.stringify(prices));
          const response = await fetchWithAuth(`/ai/market-prediction?prices=${pricesParam}`);

          if (response.ok) {
            const prediction = response.prediction;

            const analysis: AIMarketAnalysis = {
              overallSentiment: prediction.overallSentiment || 'neutral',
              topBuyRecommendations:
                prediction.stockPredictions
                  ?.filter((p: AIMarketPrediction) => p.predictedDirection === 'up')
                  .sort((a: AIMarketPrediction, b: AIMarketPrediction) => b.confidence - a.confidence)
                  .slice(0, 3) || [],
              topSellRecommendations:
                prediction.stockPredictions
                  ?.filter((p: AIMarketPrediction) => p.predictedDirection === 'down')
                  .sort((a: AIMarketPrediction, b: AIMarketPrediction) => b.confidence - a.confidence)
                  .slice(0, 3) || [],
              creditRatePrediction: prediction.creditRatePrediction || {
                predictedBaseRate: 0.1,
                rateDirection: 'stable',
                reasoning: 'Стабильные условия',
              },
              marketNarrative: prediction.marketNarrative || 'Анализ рынка недоступен',
              generatedAt: Date.now(),
            };

            set({
              marketAnalysis: analysis,
              lastAnalysisUpdate: Date.now(),
              isLoadingAnalysis: false,
            });
          }
        } catch (error) {
          console.error('Error fetching market analysis:', error);
          set({ isLoadingAnalysis: false });
        }
      },

      fetchRecommendations: async () => {
        const state = get();

        if (state.advisor.tier === 'none') {
          return;
        }

        try {
          const financeStore = useFinanceStore.getState();
          
          // Определяем профиль риска на основе настроек автотрейдера
          const riskTolerance = state.advisor.autoTrading.riskTolerance || 'balanced';

          const response = await fetchWithAuth('/ai/advisor-recommendations', {
            method: 'POST',
            body: JSON.stringify({
              portfolio: financeStore.positions,
              balance: financeStore.bank.balance,
              riskTolerance, // Передаём профиль риска для персонализации
            }),
          });

          if (response.ok && response.recommendations) {
            const recommendations: AdvisorRecommendation[] = response.recommendations.map(
              (r: Partial<AdvisorRecommendation>, i: number) => ({
                id: `rec_${Date.now()}_${i}`,
                type: r.type || 'buy_stock',
                targetId: r.targetId || '',
                amount: r.amount,
                reasoning: r.reasoning || '',
                expectedProfit: r.expectedProfit,
                confidence: r.confidence || 0.5,
                timestamp: Date.now(),
                executed: false,
              })
            );

            set({ recommendations });
          }
        } catch (error) {
          console.error('Error fetching recommendations:', error);
        }
      },

      executeRecommendation: async (id) => {
        const state = get();
        const rec = state.recommendations.find((r) => r.id === id);

        if (!rec || rec.executed) {
          return false;
        }

        const financeStore = useFinanceStore.getState();
        let success = false;

        try {
          switch (rec.type) {
            case 'buy_stock': {
              const buyResult = financeStore.buyStock(rec.targetId, D(rec.amount || '1'));
              success = buyResult.success;
              break;
            }

            case 'sell_stock': {
              const sellResult = financeStore.sellStock(rec.targetId, D(rec.amount || '1'));
              success = sellResult.success;
              break;
            }

            case 'buy_fund': {
              const fundResult = financeStore.investInFund(rec.targetId, D(rec.amount || '1000'));
              success = fundResult.success;
              break;
            }

            case 'sell_fund': {
              const withdrawResult = financeStore.withdrawFromFund(rec.targetId, D(rec.amount || '1'));
              success = withdrawResult.success;
              break;
            }

            case 'take_loan': {
              const loanResult = financeStore.takeLoan(rec.targetId, D(rec.amount || '1000'));
              success = loanResult.success;
              break;
            }

            case 'pay_loan': {
              const payResult = financeStore.makePayment(rec.targetId, D(rec.amount || '100'));
              success = payResult.success;
              break;
            }

            default:
              break;
          }

          set({
            recommendations: state.recommendations.map((r) =>
              r.id === id ? { ...r, executed: true, executedAt: Date.now(), result: success ? 'success' : 'failed' } : r
            ),
          });

          return success;
        } catch (error) {
          console.error('Error executing recommendation:', error);
          return false;
        }
      },

      // ========================================
      // AI ДИВИДЕНДЫ
      // ========================================

      fetchAIDividends: async (_stocks) => {
        const state = get();

        // Дивиденды теперь кэшируются на сервере (Oracle)
        // Клиент ограничиваем до 1 раза в 5 минут
        const DIVIDEND_UPDATE_INTERVAL = 5 * 60 * 1000;
        if (Date.now() - state.lastDividendUpdate < DIVIDEND_UPDATE_INTERVAL) {
          return state.dividendPrediction;
        }

        try {
          // Больше не нужно передавать stocks - сервер хранит данные для всех акций
          const response = await fetchWithAuth('/ai/dividends', {
            method: 'POST',
            body: JSON.stringify({}),
          });

          if (response.ok) {
            const prediction: AIDividendPrediction = {
              dividendUpdates: response.dividendUpdates || [],
              marketConditions: response.marketConditions || 'Стабильные условия',
              generatedAt: Date.now(),
              source: response.source || 'fallback',
            };

            set({
              dividendPrediction: prediction,
              lastDividendUpdate: Date.now(),
            });

            return prediction;
          }

          return null;
        } catch (error) {
          console.error('Error fetching AI dividends:', error);
          return null;
        }
      },

      getAIDividendYield: (stockId) => {
        const state = get();

        if (!state.dividendPrediction || !state.dividendPrediction.dividendUpdates) {
          return null;
        }

        const update = state.dividendPrediction.dividendUpdates.find((u) => u.stockId === stockId);
        return update ? update.newYield : null;
      },

      // ========================================
      // P2P КРЕДИТОВАНИЕ
      // ========================================

      fetchP2POffers: async () => {
        try {
          const response = await fetchWithAuth('/p2p/offers');

          if (response.ok) {
            set({ p2pOffers: response.offers });
          }
        } catch (error) {
          console.error('Error fetching P2P offers:', error);
        }
      },

      fetchMyP2PData: async () => {
        try {
          const [offersRes, lenderRes, borrowerRes] = await Promise.all([
            fetchWithAuth('/p2p/my/offers'),
            fetchWithAuth('/p2p/my/loans-as-lender'),
            fetchWithAuth('/p2p/my/loans-as-borrower'),
          ]);

          set({
            myP2POffers: offersRes.ok ? offersRes.offers : [],
            myLoansAsLender: lenderRes.ok ? lenderRes.loans : [],
            myLoansAsBorrower: borrowerRes.ok ? borrowerRes.loans : [],
          });
        } catch (error) {
          console.error('Error fetching my P2P data:', error);
        }
      },

      fetchP2PStats: async () => {
        try {
          const response = await fetchWithAuth('/p2p/stats');

          if (response.ok) {
            set({ p2pStats: response.stats });
          }
        } catch (error) {
          console.error('Error fetching P2P stats:', error);
        }
      },

      createP2POffer: async (amount, interestRate, termDays, minCreditScore) => {
        try {
          const response = await fetchWithAuth('/p2p/offers', {
            method: 'POST',
            body: JSON.stringify({ amount: parseFloat(amount), interestRate, termDays, minCreditScore }),
          });

          if (response.ok) {
            await get().fetchMyP2PData();
            return { success: true };
          }

          return { success: false, error: response.error };
        } catch (error) {
          return { success: false, error: String(error) };
        }
      },

      cancelP2POffer: async (offerId) => {
        try {
          const response = await fetchWithAuth(`/p2p/offers/${offerId}`, {
            method: 'DELETE',
          });

          if (response.ok) {
            await get().fetchMyP2PData();
            return true;
          }

          return false;
        } catch (error) {
          console.error('Error cancelling P2P offer:', error);
          return false;
        }
      },

      borrowP2P: async (offerId, creditScore) => {
        try {
          const response = await fetchWithAuth(`/p2p/borrow/${offerId}`, {
            method: 'POST',
            body: JSON.stringify({ creditScore }),
          });

          if (response.ok) {
            await get().fetchMyP2PData();
            await get().fetchP2POffers();
            return { success: true, amountReceived: response.amountReceived };
          }

          return { success: false, error: response.error };
        } catch (error) {
          return { success: false, error: String(error) };
        }
      },

      payP2PLoan: async (loanId, amount) => {
        try {
          const response = await fetchWithAuth(`/p2p/loans/${loanId}/pay`, {
            method: 'POST',
            body: JSON.stringify({ amount: parseFloat(amount) }),
          });

          if (response.ok) {
            await get().fetchMyP2PData();
            return { success: true };
          }

          return { success: false, error: response.error };
        } catch (error) {
          return { success: false, error: String(error) };
        }
      },

      // ========================================
      // АВТОМАТИЧЕСКИЙ ТРЕЙДИНГ
      // ========================================

      runAutoTrader: async () => {
        const state = get();

        console.log('[AutoTrader] Running...', {
          tier: state.advisor.tier,
          enabled: state.advisor.autoTrading.enabled,
        });

        if (state.advisor.tier !== 'premium' || !state.advisor.autoTrading.enabled) {
          console.log('[AutoTrader] Skipped - not premium or disabled');
          return;
        }

        // Проверяем stop-loss
        if (state.autoTraderStats.isPaused) {
          console.log('[AutoTrader] PAUSED:', state.autoTraderStats.pauseReason);
          return;
        }

        const { autoTrading } = state.advisor;
        const financeStore = useFinanceStore.getState();
        const balance = D(financeStore.bank.balance);
        
        // === КОНСТАНТЫ ЗАЩИТЫ КАПИТАЛА ===
        const ABSOLUTE_MAX_TRADE = D(20000);     // Макс. сумма одной сделки
        const MAX_TRADES_PER_HOUR = 10;          // Лимит сделок в час
        const CAPITAL_MULTIPLIER = 3;            // Разморозка при 3x прибыли
        const PROFIT_TO_CAPITAL_PERCENT = 0.10;  // 10% прибыли → в торговый капитал
        const PROFIT_TO_FROZEN_PERCENT = 0.90;   // 90% прибыли → замораживается
        
        // Сбрасываем счётчик сделок каждый час
        const now = Date.now();
        let stats = { ...state.autoTraderStats };
        if (now - stats.lastHourReset > 60 * 60 * 1000) {
          stats = {
            ...stats,
            tradesThisHour: 0,
            lastHourReset: now,
          };
        }
        
        // === ИНИЦИАЛИЗАЦИЯ СИСТЕМЫ ЗАЩИТЫ КАПИТАЛА ===
        if (stats.startingBalance === '0' || D(stats.startingBalance).lte(0)) {
          stats.startingBalance = balance.toString();
          console.log('[AutoTrader] Set starting balance:', stats.startingBalance);
        }
        
        // Инициализируем торговый капитал если нужно
        if (stats.tradingCapital === '0' || D(stats.tradingCapital).lte(0)) {
          // Торговый капитал = min(% от баланса, ABSOLUTE_MAX_TRADE)
          const initialCapital = Decimal.min(
            balance.mul(autoTrading.maxInvestmentPercent / 100),
            ABSOLUTE_MAX_TRADE
          );
          stats.tradingCapital = initialCapital.toString();
          stats.lastTradeBalance = balance.toString();
          console.log('[AutoTrader] Initialized trading capital:', stats.tradingCapital);
        }
        
        // === ОТСЛЕЖИВАНИЕ ПРИБЫЛИ/УБЫТКА МЕЖДУ ЦИКЛАМИ ===
        const lastBalance = D(stats.lastTradeBalance);
        const tradingCapital = D(stats.tradingCapital);
        let frozenProfit = D(stats.frozenProfit);
        let accumulatedLoss = D(stats.accumulatedLoss);
        
        if (lastBalance.gt(0)) {
          const balanceChange = balance.sub(lastBalance);
          
          if (balanceChange.gt(0)) {
            // ПРИБЫЛЬ: 10% в торговый капитал, 90% замораживаем
            const toCapital = balanceChange.mul(PROFIT_TO_CAPITAL_PERCENT);
            const toFrozen = balanceChange.mul(PROFIT_TO_FROZEN_PERCENT);
            
            stats.tradingCapital = tradingCapital.add(toCapital).toString();
            frozenProfit = frozenProfit.add(toFrozen);
            stats.frozenProfit = frozenProfit.toString();
            
            console.log('[AutoTrader] PROFIT detected:', {
              change: balanceChange.toString(),
              toCapital: toCapital.toString(),
              toFrozen: toFrozen.toString(),
              newTradingCapital: stats.tradingCapital,
              totalFrozen: stats.frozenProfit,
            });
          } else if (balanceChange.lt(0)) {
            // УБЫТОК: накапливаем
            const loss = balanceChange.abs();
            accumulatedLoss = accumulatedLoss.add(loss);
            stats.accumulatedLoss = accumulatedLoss.toString();
            
            console.log('[AutoTrader] LOSS detected:', {
              loss: loss.toString(),
              totalAccumulatedLoss: stats.accumulatedLoss,
            });
          }
        }
        
        // === ПРОВЕРКА РАЗМОРОЗКИ (frozenProfit >= tradingCapital * 3) ===
        const originalTradingCapital = D(stats.tradingCapital);
        const unfreezeThreshold = originalTradingCapital.mul(CAPITAL_MULTIPLIER);
        
        if (frozenProfit.gte(unfreezeThreshold) && frozenProfit.gt(0)) {
          console.log('[AutoTrader] UNFREEZE TRIGGERED!', {
            frozenProfit: frozenProfit.toString(),
            threshold: unfreezeThreshold.toString(),
            accumulatedLoss: accumulatedLoss.toString(),
          });
          
          // Восстанавливаем потерянную сумму в торговый капитал
          const restoredCapital = originalTradingCapital.add(accumulatedLoss);
          
          // Остаток переводим на сберегательный счёт
          const toSavings = frozenProfit.sub(accumulatedLoss);
          
          if (toSavings.gt(0)) {
            // Переводим на сберегательный счёт
            financeStore.depositToSavings(toSavings);
            stats.totalSavedToSavings = D(stats.totalSavedToSavings).add(toSavings).toString();
            
            console.log('[AutoTrader] Transferred to savings:', toSavings.toString());
          }
          
          // Сбрасываем систему защиты для нового цикла
          stats.tradingCapital = restoredCapital.toString();
          stats.frozenProfit = '0';
          stats.accumulatedLoss = '0';
          
          console.log('[AutoTrader] New cycle started with capital:', stats.tradingCapital);
        }
        
        // Обновляем баланс для следующего цикла
        stats.lastTradeBalance = balance.toString();
        
        // Проверяем лимит сделок
        if (stats.tradesThisHour >= MAX_TRADES_PER_HOUR) {
          console.log('[AutoTrader] Hourly trade limit reached:', stats.tradesThisHour);
          set({ autoTraderStats: stats });
          return;
        }
        
        // === РАСЧЁТ ДОСТУПНОЙ СУММЫ ДЛЯ ТОРГОВЛИ ===
        // Эффективный капитал = торговый капитал - накопленные убытки
        let effectiveTradingCapital = D(stats.tradingCapital).sub(D(stats.accumulatedLoss));
        
        // Если эффективный капитал истощён, но на балансе есть деньги - пересчитываем
        // Это позволяет продолжать торговлю, беря новый капитал из доступных средств
        if (effectiveTradingCapital.lt(100) && balance.gt(1000)) {
          console.log('[AutoTrader] Effective capital exhausted, recalculating from balance...');
          
          // Новый торговый капитал = min(% от баланса, абсолютный лимит)
          const newTradingCapital = Decimal.min(
            balance.mul(autoTrading.maxInvestmentPercent / 100),
            ABSOLUTE_MAX_TRADE
          );
          
          // Сбрасываем систему защиты для нового цикла
          // НО сохраняем замороженную прибыль и общую статистику!
          stats.tradingCapital = newTradingCapital.toString();
          stats.accumulatedLoss = '0';
          stats.lastTradeBalance = balance.toString();
          
          effectiveTradingCapital = newTradingCapital;
          
          console.log('[AutoTrader] New trading capital set:', stats.tradingCapital);
        }
        
        // Используем меньшее из: эффективный капитал, % от баланса, абсолютный лимит
        const maxInvestment = Decimal.min(
          Decimal.min(effectiveTradingCapital, balance.mul(autoTrading.maxInvestmentPercent / 100)),
          ABSOLUTE_MAX_TRADE
        );
        
        // Не торгуем если капитал слишком мал
        if (maxInvestment.lt(100)) {
          console.log('[AutoTrader] Effective capital too low:', maxInvestment.toString());
          set({ autoTraderStats: stats });
          return;
        }
        
        console.log('[AutoTrader] Capital Protection Status:', {
          tradingCapital: stats.tradingCapital,
          frozenProfit: stats.frozenProfit,
          accumulatedLoss: stats.accumulatedLoss,
          effectiveCapital: effectiveTradingCapital.toString(),
          maxInvestment: maxInvestment.toString(),
          totalSavedToSavings: stats.totalSavedToSavings,
        });

        let executedCount = 0;

        console.log('[AutoTrader] Settings:', {
          maxInvestmentPercent: autoTrading.maxInvestmentPercent,
          minConfidence: autoTrading.minConfidence,
          riskTolerance: autoTrading.riskTolerance,
          balance: balance.toString(),
          maxInvestment: maxInvestment.toString(),
          tradesThisHour: stats.tradesThisHour,
        });

        // === АВТОМАТИЧЕСКАЯ ФИКСАЦИЯ ПРИБЫЛИ / УБЫТКОВ ===
        const takeProfitPercent = autoTrading.takeProfitPercent || 10;
        const positionStopLoss = autoTrading.stopLossPercent || 5;
        
        console.log('[AutoTrader] Checking positions for take-profit/stop-loss:', {
          takeProfitPercent,
          positionStopLoss,
        });

        const currentFinanceState = useFinanceStore.getState();
        for (const position of currentFinanceState.positions) {
          const stock = currentFinanceState.stocks.find(s => s.id === position.stockId);
          if (!stock) continue;

          const avgPrice = D(position.avgBuyPrice);
          const currentPrice = D(stock.currentPrice);
          const shares = D(position.shares);
          
          if (shares.lte(0)) continue;

          const profitPercent = currentPrice.sub(avgPrice).div(avgPrice).mul(100).toNumber();
          
          console.log(`[AutoTrader] Position ${stock.symbol}: profit ${profitPercent.toFixed(1)}%`);

          // Take-profit: продаём если выросли на X%
          if (profitPercent >= takeProfitPercent) {
            console.log(`[AutoTrader] TAKE-PROFIT: ${stock.symbol} +${profitPercent.toFixed(1)}% - selling all`);
            const result = currentFinanceState.sellStock(stock.id, shares);
            if (result.success) {
              executedCount++;
              stats.tradesThisHour++;
              console.log(`[AutoTrader] Sold ${stock.symbol}, profit: ${result.profit?.toString()}`);
            }
            continue;
          }

          // Stop-loss для позиции: продаём если упали на X%
          if (profitPercent <= -positionStopLoss) {
            console.log(`[AutoTrader] POSITION STOP-LOSS: ${stock.symbol} ${profitPercent.toFixed(1)}% - selling all`);
            const result = currentFinanceState.sellStock(stock.id, shares);
            if (result.success) {
              executedCount++;
              stats.tradesThisHour++;
              console.log(`[AutoTrader] Sold ${stock.symbol} at loss: ${result.profit?.toString()}`);
            }
            continue;
          }
        }

        // Также проверяем фонды
        for (const investment of currentFinanceState.fundInvestments) {
          const fund = currentFinanceState.funds.find(f => f.id === investment.fundId);
          if (!fund) continue;

          const invested = D(investment.investedAmount);
          const currentValue = D(investment.currentValue);
          const shares = D(investment.shares);
          
          if (shares.lte(0) || invested.lte(0)) continue;

          const profitPercent = currentValue.sub(invested).div(invested).mul(100).toNumber();
          
          console.log(`[AutoTrader] Fund ${fund.name}: profit ${profitPercent.toFixed(1)}%`);

          // Take-profit для фондов
          if (profitPercent >= takeProfitPercent) {
            console.log(`[AutoTrader] FUND TAKE-PROFIT: ${fund.name} +${profitPercent.toFixed(1)}% - withdrawing all`);
            const result = currentFinanceState.withdrawFromFund(fund.id, shares);
            if (result.success) {
              executedCount++;
              stats.tradesThisHour++;
              console.log(`[AutoTrader] Withdrew from ${fund.name}, profit: ${result.profit?.toString()}`);
            }
            continue;
          }

          // Stop-loss для фондов
          if (profitPercent <= -positionStopLoss) {
            console.log(`[AutoTrader] FUND STOP-LOSS: ${fund.name} ${profitPercent.toFixed(1)}% - withdrawing all`);
            const result = currentFinanceState.withdrawFromFund(fund.id, shares);
            if (result.success) {
              executedCount++;
              stats.tradesThisHour++;
            }
            continue;
          }
        }

        // Обновляем статистику после фиксации
        set({ autoTraderStats: stats });

        // Получаем свежие рекомендации
        await get().fetchRecommendations();

        const allRecs = get().recommendations;
        console.log('[AutoTrader] All recommendations:', allRecs.length);

        const recommendations = allRecs
          .filter((r) => !r.executed && r.confidence >= autoTrading.minConfidence)
          .sort((a, b) => b.confidence - a.confidence);

        console.log('[AutoTrader] Filtered recommendations:', recommendations.length);

        for (const rec of recommendations) {
          console.log('[AutoTrader] Checking rec:', {
            type: rec.type,
            targetId: rec.targetId,
            confidence: rec.confidence,
            amount: rec.amount,
          });

          // Проверяем тип рекомендации и настройки
          if (rec.type === 'take_loan' && !autoTrading.allowLoans) {
            console.log('[AutoTrader] Skipped - loans not allowed');
            continue;
          }
          if (rec.type === 'lend_credits' && !autoTrading.allowLending) {
            console.log('[AutoTrader] Skipped - lending not allowed');
            continue;
          }

          // Фильтр по риску
          if (autoTrading.riskTolerance === 'low' && rec.confidence < 0.8) {
            console.log('[AutoTrader] Skipped - confidence too low for low risk');
            continue;
          }
          if (autoTrading.riskTolerance === 'medium' && rec.confidence < 0.6) {
            console.log('[AutoTrader] Skipped - confidence too low for medium risk');
            continue;
          }

          // Для погашения кредита - умная стратегия
          if (rec.type === 'pay_loan') {
            const currentBalance = D(useFinanceStore.getState().bank.balance);
            const loanAmount = D(rec.amount || '0'); // Полная сумма долга
            
            // Стратегия погашения:
            // 1. Если баланс >= 1.5x долга - можем закрыть полностью
            // 2. Иначе - платим не более 10% от баланса
            
            let payAmount: Decimal;
            
            if (currentBalance.gte(loanAmount.mul(1.5))) {
              // Достаточно денег - закрываем полностью
              payAmount = loanAmount;
              console.log('[AutoTrader] Full loan payoff - balance is 1.5x+ of debt');
            } else {
              // Платим частями - максимум 10% от баланса
              payAmount = Decimal.min(loanAmount, currentBalance.mul(0.1));
              console.log('[AutoTrader] Partial payment - 10% of balance');
            }
            
            if (payAmount.lte(100)) {
              console.log('[AutoTrader] Skipped - payment amount too small:', payAmount.toString());
              continue;
            }
            
            console.log('[AutoTrader] Paying loan:', payAmount.toString(), 'of', loanAmount.toString());
            const result = financeStore.makePayment(rec.targetId, payAmount);
            if (result.success) {
              executedCount++;
              set({
                recommendations: get().recommendations.map((r) =>
                  r.id === rec.id ? { ...r, executed: true, executedAt: Date.now(), result: 'success' } : r
                ),
              });
            }
            continue;
          }

          // Для покупок используем адаптивную сумму в рамках лимита
          let investAmount = D(rec.amount || '0');
          
          // Если сумма превышает лимит, уменьшаем до лимита
          if (investAmount.gt(maxInvestment)) {
            investAmount = maxInvestment;
            console.log('[AutoTrader] Adjusted amount to max investment:', investAmount.toString());
          }
          
          // Минимальная сумма для инвестиции
          if (investAmount.lt(100)) {
            console.log('[AutoTrader] Skipped - amount too small');
            continue;
          }

          // Выполняем рекомендацию с адаптированной суммой
          console.log('[AutoTrader] Executing:', rec.type, rec.targetId, 'amount:', investAmount.toString());
          
          let success = false;
          const currentFinance = useFinanceStore.getState();
          
          switch (rec.type) {
            case 'buy_stock': {
              // Находим акцию по id или символу
              const stock = currentFinance.stocks.find(
                s => s.id === rec.targetId || s.symbol.toLowerCase() === rec.targetId.toLowerCase()
              );
              if (stock) {
                const shares = investAmount.div(D(stock.currentPrice));
                console.log('[AutoTrader] Buying', shares.toString(), 'shares of', stock.symbol);
                const result = currentFinance.buyStock(stock.id, shares);
                success = result.success;
                if (!success) console.log('[AutoTrader] Buy failed:', result.error);
              } else {
                console.log('[AutoTrader] Stock not found:', rec.targetId);
              }
              break;
            }
            case 'sell_stock': {
              const stock = currentFinance.stocks.find(
                s => s.id === rec.targetId || s.symbol.toLowerCase() === rec.targetId.toLowerCase()
              );
              if (stock) {
                const position = currentFinance.positions.find(p => p.stockId === stock.id);
                if (position) {
                  const shares = D(position.shares);
                  const sellShares = Decimal.min(shares, D(rec.amount || shares.toString()));
                  const result = currentFinance.sellStock(stock.id, sellShares);
                  success = result.success;
                }
              }
              break;
            }
            case 'buy_fund': {
              const result = currentFinance.investInFund(rec.targetId, investAmount);
              success = result.success;
              if (!success) console.log('[AutoTrader] Fund buy failed:', result.error);
              break;
            }
            case 'sell_fund': {
              const result = currentFinance.withdrawFromFund(rec.targetId, D(rec.amount || '1'));
              success = result.success;
              break;
            }
          }
          
          console.log('[AutoTrader] Execution result:', success);
          
          if (success) {
            executedCount++;
            stats.tradesThisHour++;
            set({
              recommendations: get().recommendations.map((r) =>
                r.id === rec.id ? { ...r, executed: true, executedAt: Date.now(), result: 'success' } : r
              ),
              autoTraderStats: stats,
            });
            
            // Проверяем лимит сделок после каждой
            if (stats.tradesThisHour >= MAX_TRADES_PER_HOUR) {
              console.log('[AutoTrader] Hourly limit reached, stopping');
              break;
            }
          }
        }

        // Обновляем статистику
        const finalBalance = D(useFinanceStore.getState().bank.balance);
        const profitLoss = finalBalance.sub(D(stats.startingBalance));
        stats.totalProfitLoss = profitLoss.toString();
        set({ autoTraderStats: stats });

        console.log('[AutoTrader] Finished. Executed:', executedCount, 'P/L:', profitLoss.toString());
      },

      // ========================================
      // ОФЛАЙН-ТРЕЙДИНГ
      // ========================================

      saveOfflineState: async (slotId: number) => {
        const state = get();
        const financeStore = useFinanceStore.getState();
        
        if (state.advisor.tier !== 'premium') {
          return; // Только для премиум пользователей
        }
        
        try {
          await fetchWithAuth('/offline-trading/save-state', {
            method: 'POST',
            body: JSON.stringify({
              slotId,
              autotraderEnabled: state.advisor.autoTrading.enabled,
              riskTolerance: state.advisor.autoTrading.riskTolerance,
              maxInvestmentPercent: state.advisor.autoTrading.maxInvestmentPercent,
              takeProfitPercent: state.advisor.autoTrading.takeProfitPercent,
              stopLossPercent: state.advisor.autoTrading.stopLossPercent,
              portfolio: financeStore.positions,
              balance: financeStore.bank.balance,
            }),
          });
          console.log('[Offline Trading] State saved');
        } catch (error) {
          console.error('[Offline Trading] Failed to save state:', error);
        }
      },

      calculateOfflineProfit: async (slotId: number) => {
        try {
          const response = await fetchWithAuth('/offline-trading/calculate', {
            method: 'POST',
            body: JSON.stringify({ slotId }),
          });
          
          if (response.ok && response.hasOfflineProfit) {
            const result: OfflineProfitResult = {
              hasOfflineProfit: true,
              offlineMinutes: response.offlineMinutes,
              offlineTimeFormatted: response.offlineTimeFormatted,
              tradesExecuted: response.tradesExecuted,
              totalProfit: response.totalProfit,
              trades: response.trades,
              riskTolerance: response.riskTolerance,
              efficiencyPercent: response.efficiencyPercent,
            };
            
            set({ offlineProfit: result });
            return result;
          }
          
          return null;
        } catch (error) {
          console.error('[Offline Trading] Failed to calculate profit:', error);
          return null;
        }
      },

      sendHeartbeat: async (slotId: number) => {
        try {
          await fetchWithAuth('/offline-trading/heartbeat', {
            method: 'POST',
            body: JSON.stringify({ slotId }),
          });
        } catch {
          // Игнорируем ошибки heartbeat
        }
      },

      clearOfflineProfit: () => {
        set({ offlineProfit: null });
      },

      // ========================================
      // СБРОС
      // ========================================

      resetAdvisor: () => {
        set({
          advisor: INITIAL_ADVISOR_STATE,
          marketAnalysis: null,
          lastAnalysisUpdate: 0,
          recommendations: [],
          p2pOffers: [],
          myP2POffers: [],
          myLoansAsLender: [],
          myLoansAsBorrower: [],
          p2pStats: null,
          offlineProfit: null,
          autoTraderStats: {
            startingBalance: '0',
            tradesThisHour: 0,
            lastHourReset: 0,
            totalProfitLoss: '0',
            isPaused: false,
            pauseReason: '',
            tradingCapital: '0',
            frozenProfit: '0',
            accumulatedLoss: '0',
            capitalProtectionActive: true,
            lastTradeBalance: '0',
            totalSavedToSavings: '0',
          },
        });
      },
    }),
    {
      name: 'advisor-storage',
      partialize: (state) => ({
        advisor: state.advisor,
        recommendations: state.recommendations.slice(0, 50), // Храним только последние 50
        autoTraderStats: state.autoTraderStats, // Сохраняем систему защиты капитала
      }),
      onRehydrateStorage: () => (state) => {
        // Автоматически запускаем автотрейдер при загрузке приложения если есть премиум
        if (state && state.advisor.tier === 'premium' && state.advisor.autoTrading.enabled) {
          console.log('[AdvisorStore] Rehydrated with premium tier, starting autotrader...');
          // Небольшая задержка чтобы store полностью инициализировался
          setTimeout(() => {
            state.startAutoTrader();
          }, 1000);
        }
      },
    }
  )
);

// Регистрируем store в глобальном объекте для доступа из financeStore
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).__advisorStore = useAdvisorStore;
