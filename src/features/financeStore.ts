/**
 * Finance Store
 * Фаза 6: Zustand store для финансовой системы
 */

import { create } from 'zustand';
import Decimal from 'break_eternity.js';
import type {
  FinanceState,
  Stock,
  StockPosition,
  StockTransaction,
  InvestmentFund,
  FundInvestment,
  Loan,
  LoanProduct,
  LoanCollateral,
  CreditScoreEvent,
} from '../core/gameTypes.finance';
import {
  FINANCE_CONFIG,
  INITIAL_FINANCE_STATE,
} from '../core/gameTypes.finance';
import { createAllStocks } from '../core/constants/stocks';
import { createAllFunds, LOAN_PRODUCTS, calculateInterestRate } from '../core/constants/funds';
import {
  updateAllStockPrices,
  updateAllFundNavs,
  generateRandomMarketEvent,
  applyMarketEvent,
  type MarketEvent,
} from '../utils/stockSimulator';
import {
  createLoan,
  processLoanPayment,
  checkMissedPayments,
  updateCreditScore,
  calculateMaxLoanCapacity,
  isLoanProductAvailable,
  calculateEarlyPayoff,
} from '../utils/loanCalculator';
import { D } from '../core/math/format';
import { getServerStockPrices } from '../utils/marketApi';

// ==========================================
// ТИПЫ STORE
// ==========================================

interface FinanceStore extends FinanceState {
  // Данные рынка (не сохраняются, генерируются)
  stocks: Stock[];
  funds: InvestmentFund[];
  marketEvents: MarketEvent[];
  
  // Инициализация
  initializeFinance: () => void;
  
  // Банковские операции
  depositToSavings: (amount: Decimal) => boolean;
  withdrawFromSavings: (amount: Decimal) => boolean;
  depositToBank: (amount: Decimal) => void;  // Перевод кредитов игры -> bank.balance
  withdrawFromBank: (amount: Decimal) => boolean;  // Перевод bank.balance -> кредиты игры
  processInterest: () => void;
  
  // Кредиты
  takeLoan: (productId: string, amount: Decimal, collateral?: LoanCollateral) => { success: boolean; loan?: Loan; error?: string };
  makePayment: (loanId: string, amount: Decimal) => { success: boolean; isFullyPaid: boolean; error?: string };
  payOffLoan: (loanId: string) => { success: boolean; error?: string };
  checkAllLoans: () => void;
  
  // Акции
  buyStock: (stockId: string, shares: Decimal) => { success: boolean; error?: string };
  sellStock: (stockId: string, shares: Decimal) => { success: boolean; profit: Decimal; error?: string };
  updateStockPrices: () => void;
  /** Забрать авторитетные цены акций с сервера (единые для всех игроков) */
  syncStockPricesFromServer: () => Promise<boolean>;
  processDividends: () => void;
  
  // Фонды
  investInFund: (fundId: string, amount: Decimal) => { success: boolean; error?: string };
  withdrawFromFund: (fundId: string, shares: Decimal) => { success: boolean; profit: Decimal; error?: string };
  updateFundPrices: () => void;
  
  // Обновление финансов (вызывается из game loop).
  // Без параметров: реализация и все её подшаги (проценты, цены, кредиты, дивиденды)
  // сами берут Date.now(), поэтому объявленный когда-то deltaMs никто не передавал.
  updateFinance: () => void;
  
  // Утилиты
  recalculateNetWorth: (creditsBalance: Decimal) => void;
  getAvailableLoanProducts: () => LoanProduct[];
  getPositionValue: (stockId: string) => Decimal;
  getTotalPortfolioValue: () => Decimal;
  
  // Сброс
  resetFinance: () => void;
}

// ==========================================
// СИНХРОНИЗАЦИЯ ЦЕН С СЕРВЕРОМ
// ==========================================

/**
 * Цены акций считает сервер (server/market-sim) — это единственный источник правды.
 * Раньше каждый клиент крутил свой Math.random() в stockSimulator, и 100 игроков
 * видели 100 разных цен одной бумаги.
 *
 * Локальная симуляция остаётся ОФЛАЙН-режимом: она работает, только если сервер
 * недоступен (или ещё ни разу не ответил).
 *
 * Эти поля намеренно живут вне store: они не должны попадать в persist.
 */
let lastServerSyncAt = 0;
let lastServerSyncAttemptAt = 0;
let serverAuthoritative = false;

/** Как долго доверяем последнему ответу сервера, прежде чем считать себя офлайн. */
const SERVER_TRUST_MS = 3 * FINANCE_CONFIG.STOCK_UPDATE_INTERVAL_MS;
/** Не чаще одной попытки в минуту (сервер всё равно двигает цены раз в 5 минут). */
const SERVER_SYNC_THROTTLE_MS = 60 * 1000;

export function isStockPriceSourceServer(): boolean {
  return serverAuthoritative && Date.now() - lastServerSyncAt < SERVER_TRUST_MS;
}

// ==========================================
// МОСТ К ИГРОВЫМ КРЕДИТАМ
// ==========================================

/*
 * В игре два разных кошелька: `currency.credits` в gameStore (то, чем строят и что игрок
 * называет «балансом») и `bank.balance` здесь (расчётный счёт: акции, дивиденды, вклады).
 *
 * Кредит зачислялся на bank.balance, а платежи по нему списывались оттуда же. Для игрока это
 * выглядело как «взял кредит — деньги не пришли»: чтобы ими воспользоваться, надо было найти
 * в банке кнопку «Вывести в кредиты игры», о которой ниоткуда не узнать.
 *
 * Решение: КРЕДИТЫ — инструмент игровых кредитов. Тело кредита приходит сразу в
 * currency.credits, платежи и досрочное погашение списываются оттуда же. Расчётный счёт
 * остаётся тем, чем и был — счётом для биржи и вкладов.
 *
 * Мост инжектируется, а не импортируется: gameStore уже импортирует financeStore, и прямой
 * импорт в обратную сторону дал бы цикл модулей.
 */
export interface GameCreditsAdapter {
  /** Текущий баланс игровых кредитов. */
  read: () => Decimal;
  /** Начислить игровые кредиты. */
  add: (amount: Decimal) => void;
  /** Списать игровые кредиты. false — если не хватило. */
  spend: (amount: Decimal) => boolean;
}

let gameCredits: GameCreditsAdapter | null = null;

/** Вызывается один раз из gameStore при инициализации модуля. */
export function registerGameCreditsAdapter(adapter: GameCreditsAdapter): void {
  gameCredits = adapter;
}

/**
 * Кошелёк для операций по кредитам. Если мост не зарегистрирован (юнит-тест стора без
 * gameStore), падать нельзя — работаем по расчётному счёту, как раньше.
 */
function creditsWallet(): GameCreditsAdapter | null {
  return gameCredits;
}

// ==========================================
// СОЗДАНИЕ STORE
// ==========================================

/*
 * Здесь был `persist` с ключом 'finance-storage' — ОДИН на аккаунт, независимо от слота.
 * Финансы при этом уже сохраняются в серверный сейв слота (serializeFinance ниже вызывается
 * из gameStore.saveGame), поэтому localStorage дублировал их и восстанавливался при
 * монтировании РАНЬШЕ загрузки слота. Результат: кредиты, взятые на одной карте, висели
 * на всех остальных — это и есть пункт 8 в bigplan.md.
 *
 * Persist убран целиком: единственный источник правды — сейв слота. Старый ключ подчищает
 * cleanupLegacyLocalStorage().
 */
export const useFinanceStore = create<FinanceStore>()(
    (set, get) => ({
      // Начальное состояние
      ...INITIAL_FINANCE_STATE,
      stocks: [],
      funds: [],
      marketEvents: [],
      
      // ========================================
      // ИНИЦИАЛИЗАЦИЯ
      // ========================================
      
      initializeFinance: () => {
        const stocks = createAllStocks();
        const funds = createAllFunds();
        
        set({
          stocks,
          funds,
          lastStockUpdate: Date.now(),
          lastDividendPayout: Date.now(),
        });
      },
      
      // ========================================
      // БАНКОВСКИЕ ОПЕРАЦИИ
      // ========================================
      
      depositToSavings: (amount: Decimal) => {
        const state = get();
        const currentBalance = D(state.bank.balance);
        
        if (amount.gt(currentBalance)) {
          return false;
        }
        
        const newBalance = currentBalance.sub(amount);
        const newSavings = D(state.bank.savingsBalance).add(amount);
        const newTotalDeposited = D(state.bank.stats.totalDeposited).add(amount);
        
        set({
          bank: {
            ...state.bank,
            balance: newBalance.toString(),
            savingsBalance: newSavings.toString(),
            stats: {
              ...state.bank.stats,
              totalDeposited: newTotalDeposited.toString(),
            },
          },
        });
        
        return true;
      },
      
      withdrawFromSavings: (amount: Decimal) => {
        const state = get();
        const currentSavings = D(state.bank.savingsBalance);
        
        if (amount.gt(currentSavings)) {
          return false;
        }
        
        const newSavings = currentSavings.sub(amount);
        const newBalance = D(state.bank.balance).add(amount);
        const newTotalWithdrawn = D(state.bank.stats.totalWithdrawn).add(amount);
        
        set({
          bank: {
            ...state.bank,
            balance: newBalance.toString(),
            savingsBalance: newSavings.toString(),
            stats: {
              ...state.bank.stats,
              totalWithdrawn: newTotalWithdrawn.toString(),
            },
          },
        });
        
        return true;
      },
      
      // Перевод кредитов игры -> расчётный счёт банка
      depositToBank: (amount: Decimal) => {
        const state = get();
        const newBalance = D(state.bank.balance).add(amount);
        
        set({
          bank: {
            ...state.bank,
            balance: newBalance.toString(),
          },
        });
      },
      
      // Перевод с расчётного счёта банка -> кредиты игры
      withdrawFromBank: (amount: Decimal) => {
        const state = get();
        const currentBalance = D(state.bank.balance);
        
        if (amount.gt(currentBalance)) {
          return false;
        }
        
        const newBalance = currentBalance.sub(amount);
        
        set({
          bank: {
            ...state.bank,
            balance: newBalance.toString(),
          },
        });
        
        return true;
      },
      
      processInterest: () => {
        const state = get();
        const now = Date.now();
        const timeSinceLastInterest = now - state.bank.lastInterestPaid;
        
        if (timeSinceLastInterest < FINANCE_CONFIG.INTEREST_INTERVAL_MS) {
          return;
        }
        
        const savings = D(state.bank.savingsBalance);
        if (savings.lte(0)) {
          set({
            bank: {
              ...state.bank,
              lastInterestPaid: now,
            },
          });
          return;
        }
        
        // Рассчитываем проценты
        // interestRate - это ставка за один период (5 минут), например 0.02 = 2%
        const periods = Math.floor(timeSinceLastInterest / FINANCE_CONFIG.INTEREST_INTERVAL_MS);
        const ratePerPeriod = state.bank.interestRate; // Ставка напрямую за период
        
        // Сложные проценты
        const multiplier = Math.pow(1 + ratePerPeriod, periods);
        const newSavings = savings.mul(multiplier);
        const interest = newSavings.sub(savings);
        const newTotalInterest = D(state.bank.stats.totalInterestEarned).add(interest);
        
        set({
          bank: {
            ...state.bank,
            savingsBalance: newSavings.toString(),
            lastInterestPaid: now,
            stats: {
              ...state.bank.stats,
              totalInterestEarned: newTotalInterest.toString(),
            },
          },
        });
      },
      
      // ========================================
      // КРЕДИТЫ
      // ========================================
      
      takeLoan: (productId: string, amount: Decimal, collateral?: LoanCollateral) => {
        const state = get();
        const product = LOAN_PRODUCTS.find(p => p.id === productId);
        
        if (!product) {
          return { success: false, error: 'Кредитный продукт не найден' };
        }
        
        const availability = isLoanProductAvailable(
          product,
          state.creditScore,
          state.loans.filter(l => l.status === 'active').length
        );
        
        if (!availability.available) {
          return { success: false, error: availability.reason };
        }
        
        const minAmount = D(product.minAmount);
        const maxAmount = D(state.maxLoanCapacity);
        
        if (amount.lt(minAmount)) {
          return { success: false, error: `Минимальная сумма: ${minAmount.toString()}` };
        }
        
        if (amount.gt(maxAmount)) {
          return { success: false, error: `Максимальная сумма: ${maxAmount.toString()}` };
        }
        
        if (product.requiresCollateral && !collateral) {
          return { success: false, error: 'Требуется залог' };
        }
        
        // Рассчитываем эффективную ставку
        const effectiveRate = calculateInterestRate(product.baseInterestRate, state.creditScore);
        
        // Создаём кредит
        const loan = createLoan(product, amount, effectiveRate, collateral);

        // Обновляем кредитный рейтинг (небольшое снижение за новый кредит)
        const { newScore, event } = updateCreditScore(state.creditScore, {
          type: 'new_loan',
          change: -5,
          description: `Оформлен новый кредит: ${product.name}`,
        });

        const newTotalDebt = D(state.totalDebt).add(D(loan.remainingBalance));

        /*
         * Тело кредита зачисляем в ИГРОВЫЕ кредиты — это тот баланс, который игрок видит
         * в TopBar и которым строит. Раньше сумма уходила на bank.balance, и кредит выглядел
         * не зачисленным. Расчётный счёт — только запасной путь, если мост не поднят.
         */
        const wallet = creditsWallet();
        if (wallet) {
          wallet.add(amount);
          set({
            loans: [...state.loans, loan],
            creditScore: newScore,
            creditScoreHistory: [...state.creditScoreHistory, event],
            totalDebt: newTotalDebt.toString(),
          });
        } else {
          set({
            bank: {
              ...state.bank,
              balance: D(state.bank.balance).add(amount).toString(),
            },
            loans: [...state.loans, loan],
            creditScore: newScore,
            creditScoreHistory: [...state.creditScoreHistory, event],
            totalDebt: newTotalDebt.toString(),
          });
        }

        return { success: true, loan };
      },
      
      makePayment: (loanId: string, amount: Decimal) => {
        const state = get();
        const loanIndex = state.loans.findIndex(l => l.id === loanId);
        
        if (loanIndex === -1) {
          return { success: false, isFullyPaid: false, error: 'Кредит не найден' };
        }
        
        const loan = state.loans[loanIndex];
        
        if (loan.status !== 'active') {
          return { success: false, isFullyPaid: false, error: 'Кредит уже закрыт' };
        }
        
        /*
         * Платёж списывается из того же кошелька, куда пришло тело кредита — из игровых
         * кредитов (см. registerGameCreditsAdapter). Иначе игрок получал деньги в одном
         * месте, а платить должен был из другого.
         */
        const wallet = creditsWallet();
        const balance = wallet ? wallet.read() : D(state.bank.balance);
        if (amount.gt(balance)) {
          return { success: false, isFullyPaid: false, error: 'Недостаточно кредитов' };
        }

        // Обрабатываем платёж
        const { updatedLoan, isFullyPaid } = processLoanPayment(loan, amount);
        
        // Обновляем кредитный рейтинг
        const creditEvent: Omit<CreditScoreEvent, 'timestamp'> = isFullyPaid
          ? { type: 'loan_paid', change: FINANCE_CONFIG.CREDIT_SCORE_LOAN_PAID, description: 'Кредит полностью выплачен' }
          : { type: 'payment_on_time', change: FINANCE_CONFIG.CREDIT_SCORE_PAYMENT_ON_TIME, description: 'Платёж вовремя' };
        
        const { newScore, event } = updateCreditScore(state.creditScore, creditEvent);
        
        // Обновляем статистику
        const newLoans = [...state.loans];
        newLoans[loanIndex] = updatedLoan;
        
        const newTotalDebt = D(state.totalDebt).sub(amount);
        const newLoanInterestPaid = D(state.stats.totalLoanInterestPaid).add(
          D(updatedLoan.paymentHistory[updatedLoan.paymentHistory.length - 1]?.interestPart || '0')
        );

        // Сначала списываем деньги: если списание не прошло (баланс изменился между проверкой
        // и списанием), кредит не должен считаться оплаченным.
        if (wallet) {
          if (!wallet.spend(amount)) {
            return { success: false, isFullyPaid: false, error: 'Недостаточно кредитов' };
          }
        }

        set({
          ...(wallet
            ? {}
            : {
                bank: {
                  ...state.bank,
                  balance: balance.sub(amount).toString(),
                },
              }),
          loans: newLoans,
          creditScore: newScore,
          creditScoreHistory: [...state.creditScoreHistory, event],
          totalDebt: newTotalDebt.lt(0) ? '0' : newTotalDebt.toString(),
          stats: {
            ...state.stats,
            totalLoanInterestPaid: newLoanInterestPaid.toString(),
            loansFullyPaid: isFullyPaid ? state.stats.loansFullyPaid + 1 : state.stats.loansFullyPaid,
          },
        });

        return { success: true, isFullyPaid };
      },
      
      payOffLoan: (loanId: string) => {
        const state = get();
        const loan = state.loans.find(l => l.id === loanId);
        
        if (!loan) {
          return { success: false, error: 'Кредит не найден' };
        }
        
        const { earlyPayoffAmount } = calculateEarlyPayoff(loan);
        return get().makePayment(loanId, earlyPayoffAmount);
      },
      
      checkAllLoans: () => {
        const state = get();
        const updatedLoans: Loan[] = [];
        let creditScoreChange = 0;
        const newEvents: CreditScoreEvent[] = [];
        let defaultCount = 0;
        
        for (const loan of state.loans) {
          const { isMissed, isDefaulted, updatedLoan } = checkMissedPayments(loan);
          updatedLoans.push(updatedLoan);
          
          if (isMissed && !isDefaulted) {
            creditScoreChange += FINANCE_CONFIG.CREDIT_SCORE_PAYMENT_MISSED;
            newEvents.push({
              type: 'payment_missed',
              change: FINANCE_CONFIG.CREDIT_SCORE_PAYMENT_MISSED,
              timestamp: Date.now(),
              description: `Просрочен платёж по кредиту`,
            });
          } else if (isDefaulted) {
            creditScoreChange += FINANCE_CONFIG.CREDIT_SCORE_DEFAULT;
            defaultCount++;
            newEvents.push({
              type: 'loan_defaulted',
              change: FINANCE_CONFIG.CREDIT_SCORE_DEFAULT,
              timestamp: Date.now(),
              description: `Дефолт по кредиту`,
            });
          }
        }
        
        if (creditScoreChange !== 0 || defaultCount > 0) {
          const newScore = Math.max(
            FINANCE_CONFIG.MIN_CREDIT_SCORE,
            Math.min(FINANCE_CONFIG.MAX_CREDIT_SCORE, state.creditScore + creditScoreChange)
          );
          
          set({
            loans: updatedLoans,
            creditScore: newScore,
            creditScoreHistory: [...state.creditScoreHistory, ...newEvents],
            stats: {
              ...state.stats,
              loansDefaulted: state.stats.loansDefaulted + defaultCount,
            },
          });
        }
      },
      
      // ========================================
      // АКЦИИ
      // ========================================
      
      buyStock: (stockId: string, shares: Decimal) => {
        const state = get();
        const stock = state.stocks.find(s => s.id === stockId);
        
        if (!stock) {
          return { success: false, error: 'Акция не найдена' };
        }
        
        if (shares.lte(0)) {
          return { success: false, error: 'Количество должно быть положительным' };
        }
        
        const price = D(stock.currentPrice);
        const totalCost = price.mul(shares);
        const fee = totalCost.mul(FINANCE_CONFIG.STOCK_TRADING_FEE);
        const totalWithFee = totalCost.add(fee);
        
        const balance = D(state.bank.balance);
        if (totalWithFee.gt(balance)) {
          return { success: false, error: 'Недостаточно средств' };
        }
        
        // Обновляем или создаём позицию
        const existingPosition = state.positions.find(p => p.stockId === stockId);
        let newPositions: StockPosition[];
        
        if (existingPosition) {
          const existingShares = D(existingPosition.shares);
          const existingInvested = D(existingPosition.totalInvested);
          const newShares = existingShares.add(shares);
          const newInvested = existingInvested.add(totalCost);
          const newAvgPrice = newInvested.div(newShares);
          
          const updatedPosition: StockPosition = {
            ...existingPosition,
            shares: newShares.toString(),
            avgBuyPrice: newAvgPrice.toString(),
            totalInvested: newInvested.toString(),
            currentValue: newShares.mul(price).toString(),
            unrealizedPnL: newShares.mul(price).sub(newInvested).toString(),
            unrealizedPnLPercent: newShares.mul(price).sub(newInvested).div(newInvested).mul(100).toNumber(),
          };
          
          newPositions = state.positions.map(p =>
            p.stockId === stockId ? updatedPosition : p
          );
        } else {
          const newPosition: StockPosition = {
            stockId,
            shares: shares.toString(),
            avgBuyPrice: price.toString(),
            totalInvested: totalCost.toString(),
            currentValue: totalCost.toString(),
            unrealizedPnL: '0',
            unrealizedPnLPercent: 0,
            dividendsReceived: '0',
            firstPurchaseDate: Date.now(),
          };
          newPositions = [...state.positions, newPosition];
        }
        
        // Создаём транзакцию
        const transaction: StockTransaction = {
          id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          stockId,
          type: 'buy',
          shares: shares.toString(),
          pricePerShare: price.toString(),
          totalAmount: totalCost.toString(),
          fee: fee.toString(),
          timestamp: Date.now(),
        };
        
        const newBalance = balance.sub(totalWithFee);
        
        set({
          bank: {
            ...state.bank,
            balance: newBalance.toString(),
          },
          positions: newPositions,
          stockTransactions: [...state.stockTransactions, transaction],
        });
        
        return { success: true };
      },
      
      sellStock: (stockId: string, shares: Decimal) => {
        const state = get();
        const stock = state.stocks.find(s => s.id === stockId);
        const position = state.positions.find(p => p.stockId === stockId);
        
        if (!stock) {
          return { success: false, profit: D(0), error: 'Акция не найдена' };
        }
        
        if (!position) {
          return { success: false, profit: D(0), error: 'Нет позиции в этой акции' };
        }
        
        const positionShares = D(position.shares);
        if (shares.gt(positionShares)) {
          return { success: false, profit: D(0), error: 'Недостаточно акций' };
        }
        
        const price = D(stock.currentPrice);
        const totalSale = price.mul(shares);
        const fee = totalSale.mul(FINANCE_CONFIG.STOCK_TRADING_FEE);
        const netSale = totalSale.sub(fee);
        
        // Рассчитываем прибыль/убыток
        const avgBuyPrice = D(position.avgBuyPrice);
        const costBasis = avgBuyPrice.mul(shares);
        const profit = netSale.sub(costBasis);
        
        // Обновляем позицию
        const newShares = positionShares.sub(shares);
        let newPositions: StockPosition[];
        
        if (newShares.lte(0)) {
          // Позиция полностью закрыта
          newPositions = state.positions.filter(p => p.stockId !== stockId);
        } else {
          const totalInvested = D(position.totalInvested);
          const newInvested = totalInvested.sub(costBasis);
          
          const updatedPosition: StockPosition = {
            ...position,
            shares: newShares.toString(),
            totalInvested: newInvested.toString(),
            currentValue: newShares.mul(price).toString(),
            unrealizedPnL: newShares.mul(price).sub(newInvested).toString(),
            unrealizedPnLPercent: newShares.mul(price).sub(newInvested).div(newInvested).mul(100).toNumber(),
          };
          
          newPositions = state.positions.map(p =>
            p.stockId === stockId ? updatedPosition : p
          );
        }
        
        // Создаём транзакцию
        const transaction: StockTransaction = {
          id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          stockId,
          type: 'sell',
          shares: shares.toString(),
          pricePerShare: price.toString(),
          totalAmount: netSale.toString(),
          fee: fee.toString(),
          timestamp: Date.now(),
        };
        
        const newBalance = D(state.bank.balance).add(netSale);
        
        // Обновляем статистику
        const newStats = { ...state.stats };
        if (profit.gt(0)) {
          newStats.totalStockProfits = D(state.stats.totalStockProfits).add(profit).toString();
        } else {
          newStats.totalStockLosses = D(state.stats.totalStockLosses).add(profit.abs()).toString();
        }
        
        set({
          bank: {
            ...state.bank,
            balance: newBalance.toString(),
          },
          positions: newPositions,
          stockTransactions: [...state.stockTransactions, transaction],
          stats: newStats,
        });
        
        return { success: true, profit };
      },
      
      updateStockPrices: () => {
        const state = get();
        const now = Date.now();
        
        if (now - state.lastStockUpdate < FINANCE_CONFIG.STOCK_UPDATE_INTERVAL_MS) {
          return;
        }
        
        // Пока сервер отвечает, его цены — истина: локальный случайный шаг НЕ делаем,
        // иначе цены снова разъедутся между игроками.
        if (isStockPriceSourceServer()) {
          return;
        }
        
        let stocks = updateAllStockPrices(state.stocks);
        
        // Проверяем на случайные события
        const event = generateRandomMarketEvent(stocks);
        let newEvents = state.marketEvents;
        
        if (event) {
          stocks = applyMarketEvent(stocks, event);
          newEvents = [...state.marketEvents.slice(-9), event]; // Храним последние 10 событий
        }
        
        // Обновляем стоимость позиций
        const updatedPositions = state.positions.map(position => {
          const stock = stocks.find(s => s.id === position.stockId);
          if (!stock) return position;
          
          const shares = D(position.shares);
          const currentPrice = D(stock.currentPrice);
          const currentValue = shares.mul(currentPrice);
          const invested = D(position.totalInvested);
          const unrealizedPnL = currentValue.sub(invested);
          
          return {
            ...position,
            currentValue: currentValue.toString(),
            unrealizedPnL: unrealizedPnL.toString(),
            unrealizedPnLPercent: invested.gt(0) ? unrealizedPnL.div(invested).mul(100).toNumber() : 0,
          };
        });
        
        set({
          stocks,
          positions: updatedPositions,
          lastStockUpdate: now,
          marketEvents: newEvents,
        });
      },
      
      syncStockPricesFromServer: async () => {
        const now = Date.now();
        if (now - lastServerSyncAttemptAt < SERVER_SYNC_THROTTLE_MS) {
          return serverAuthoritative;
        }
        lastServerSyncAttemptAt = now;
        
        try {
          const response = await getServerStockPrices();
          
          // Флаг authoritative — «разрешение» принимать серверные цены.
          if (!response?.ok || !response.authoritative || !Array.isArray(response.stocks)) {
            serverAuthoritative = false;
            return false;
          }
          
          const quotes = new Map(response.stocks.map((q) => [q.id, q]));
          const state = get();
          
          const stocks = state.stocks.map((stock) => {
            const q = quotes.get(stock.id);
            if (!q || !(q.currentPrice > 0)) return stock;
            
            const priceStr = String(q.currentPrice);
            const history = [...stock.priceHistory];
            const last = history[history.length - 1];
            if (!last || last.value !== priceStr) {
              history.push({ timestamp: response.timeMs ?? now, value: priceStr });
              if (history.length > FINANCE_CONFIG.MAX_PRICE_HISTORY_POINTS) {
                history.shift();
              }
            }
            
            return {
              ...stock,
              currentPrice: priceStr,
              previousClose: String(q.previousClose),
              dayChange: q.dayChange,
              volume: String(q.volume),
              dividendYield: q.dividendYield,
              priceHistory: history,
            };
          });
          
          // Позиции пересчитываем по тем же серверным ценам
          const positions = state.positions.map((position) => {
            const stock = stocks.find((s) => s.id === position.stockId);
            if (!stock) return position;
            
            const currentValue = D(position.shares).mul(D(stock.currentPrice));
            const invested = D(position.totalInvested);
            const unrealizedPnL = currentValue.sub(invested);
            
            return {
              ...position,
              currentValue: currentValue.toString(),
              unrealizedPnL: unrealizedPnL.toString(),
              unrealizedPnLPercent: invested.gt(0) ? unrealizedPnL.div(invested).mul(100).toNumber() : 0,
            };
          });
          
          lastServerSyncAt = now;
          serverAuthoritative = true;
          set({ stocks, positions, lastStockUpdate: now });
          return true;
        } catch (error) {
          // Сервер недоступен -> остаёмся на локальной симуляции (офлайн-режим)
          console.warn('[finance] не удалось получить цены с сервера, работаем офлайн:', error);
          serverAuthoritative = false;
          return false;
        }
      },
      
      processDividends: () => {
        const state = get();
        const now = Date.now();
        
        if (now - state.lastDividendPayout < FINANCE_CONFIG.DIVIDEND_INTERVAL_MS) {
          return;
        }
        
        // Получаем AI дивиденды через глобальный объект (избегаем циклических зависимостей)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const advisorState = (window as any).__advisorStore?.getState?.();
        
        let totalDividends = D(0);
        const updatedPositions = state.positions.map(position => {
          const stock = state.stocks.find(s => s.id === position.stockId);
          if (!stock) return position;
          
          // Используем AI дивиденды если доступны, иначе базовые
          const aiYield = advisorState?.getAIDividendYield?.(position.stockId);
          const effectiveYield = aiYield !== null && aiYield !== undefined ? aiYield : stock.dividendYield;
          
          if (effectiveYield <= 0) return position;
          
          // Рассчитываем дивиденды с новой ставкой
          const shares = D(position.shares);
          const price = D(stock.currentPrice);
          const positionValue = shares.mul(price);
          const dividends = positionValue.mul(effectiveYield);
          
          totalDividends = totalDividends.add(dividends);
          
          return {
            ...position,
            dividendsReceived: D(position.dividendsReceived).add(dividends).toString(),
          };
        });
        
        if (totalDividends.gt(0)) {
          const newBalance = D(state.bank.balance).add(totalDividends);
          const newTotalDividends = D(state.stats.totalDividends).add(totalDividends);
          
          set({
            bank: {
              ...state.bank,
              balance: newBalance.toString(),
            },
            positions: updatedPositions,
            lastDividendPayout: now,
            stats: {
              ...state.stats,
              totalDividends: newTotalDividends.toString(),
            },
          });
        } else {
          set({ lastDividendPayout: now });
        }
      },
      
      // ========================================
      // ФОНДЫ
      // ========================================
      
      investInFund: (fundId: string, amount: Decimal) => {
        const state = get();
        const fund = state.funds.find(f => f.id === fundId);
        
        if (!fund) {
          return { success: false, error: 'Фонд не найден' };
        }
        
        const minInvestment = D(fund.minInvestment);
        if (amount.lt(minInvestment)) {
          return { success: false, error: `Минимальная инвестиция: ${minInvestment.toString()}` };
        }
        
        const balance = D(state.bank.balance);
        if (amount.gt(balance)) {
          return { success: false, error: 'Недостаточно средств' };
        }
        
        const navPerShare = D(fund.navPerShare);
        const shares = amount.div(navPerShare);
        
        // Обновляем или создаём инвестицию
        const existingInvestment = state.fundInvestments.find(i => i.fundId === fundId);
        let newInvestments: FundInvestment[];
        
        if (existingInvestment) {
          const existingShares = D(existingInvestment.shares);
          const existingInvested = D(existingInvestment.investedAmount);
          const newShares = existingShares.add(shares);
          const newInvested = existingInvested.add(amount);
          const newValue = newShares.mul(navPerShare);
          
          const updatedInvestment: FundInvestment = {
            ...existingInvestment,
            shares: newShares.toString(),
            investedAmount: newInvested.toString(),
            currentValue: newValue.toString(),
            unrealizedPnL: newValue.sub(newInvested).toString(),
          };
          
          newInvestments = state.fundInvestments.map(i =>
            i.fundId === fundId ? updatedInvestment : i
          );
        } else {
          const newInvestment: FundInvestment = {
            fundId,
            shares: shares.toString(),
            investedAmount: amount.toString(),
            currentValue: amount.toString(),
            unrealizedPnL: '0',
            investmentDate: Date.now(),
          };
          newInvestments = [...state.fundInvestments, newInvestment];
        }
        
        const newBalance = balance.sub(amount);
        
        set({
          bank: {
            ...state.bank,
            balance: newBalance.toString(),
          },
          fundInvestments: newInvestments,
        });
        
        return { success: true };
      },
      
      withdrawFromFund: (fundId: string, shares: Decimal) => {
        const state = get();
        const fund = state.funds.find(f => f.id === fundId);
        const investment = state.fundInvestments.find(i => i.fundId === fundId);
        
        if (!fund) {
          return { success: false, profit: D(0), error: 'Фонд не найден' };
        }
        
        if (!investment) {
          return { success: false, profit: D(0), error: 'Нет инвестиции в этот фонд' };
        }
        
        const investmentShares = D(investment.shares);
        if (shares.gt(investmentShares)) {
          return { success: false, profit: D(0), error: 'Недостаточно паёв' };
        }
        
        const navPerShare = D(fund.navPerShare);
        const withdrawAmount = shares.mul(navPerShare);
        
        // Рассчитываем пропорциональную стоимость инвестиции
        const shareRatio = shares.div(investmentShares);
        const costBasis = D(investment.investedAmount).mul(shareRatio);
        const profit = withdrawAmount.sub(costBasis);
        
        // Обновляем инвестицию
        const newShares = investmentShares.sub(shares);
        let newInvestments: FundInvestment[];
        
        if (newShares.lte(0)) {
          newInvestments = state.fundInvestments.filter(i => i.fundId !== fundId);
        } else {
          const newInvested = D(investment.investedAmount).sub(costBasis);
          const newValue = newShares.mul(navPerShare);
          
          const updatedInvestment: FundInvestment = {
            ...investment,
            shares: newShares.toString(),
            investedAmount: newInvested.toString(),
            currentValue: newValue.toString(),
            unrealizedPnL: newValue.sub(newInvested).toString(),
          };
          
          newInvestments = state.fundInvestments.map(i =>
            i.fundId === fundId ? updatedInvestment : i
          );
        }
        
        const newBalance = D(state.bank.balance).add(withdrawAmount);
        
        set({
          bank: {
            ...state.bank,
            balance: newBalance.toString(),
          },
          fundInvestments: newInvestments,
        });
        
        return { success: true, profit };
      },
      
      updateFundPrices: () => {
        const state = get();
        const funds = updateAllFundNavs(state.funds, state.stocks);
        
        // Обновляем стоимость инвестиций
        const updatedInvestments = state.fundInvestments.map(investment => {
          const fund = funds.find(f => f.id === investment.fundId);
          if (!fund) return investment;
          
          const shares = D(investment.shares);
          const navPerShare = D(fund.navPerShare);
          const currentValue = shares.mul(navPerShare);
          const invested = D(investment.investedAmount);
          
          return {
            ...investment,
            currentValue: currentValue.toString(),
            unrealizedPnL: currentValue.sub(invested).toString(),
          };
        });
        
        set({
          funds,
          fundInvestments: updatedInvestments,
        });
      },
      
      // ========================================
      // ОБНОВЛЕНИЕ ФИНАНСОВ
      // ========================================
      
      updateFinance: () => {
        const state = get();
        
        // Проценты на сбережения
        state.processInterest();
        
        // Авторитетные цены с сервера (сама себя троттлит, не блокирует тик)
        void state.syncStockPricesFromServer();
        
        // Обновление цен акций (локальная симуляция — только когда сервер недоступен)
        state.updateStockPrices();
        
        // Обновление NAV фондов
        state.updateFundPrices();
        
        // Проверка кредитов
        state.checkAllLoans();
        
        // Дивиденды
        state.processDividends();
      },
      
      // ========================================
      // УТИЛИТЫ
      // ========================================
      
      recalculateNetWorth: (creditsBalance: Decimal) => {
        const state = get();
        
        // Наличные
        const cash = creditsBalance.add(D(state.bank.savingsBalance));
        
        // Стоимость акций
        const stocksValue = state.positions.reduce(
          (sum, p) => sum.add(D(p.currentValue)),
          D(0)
        );
        
        // Стоимость фондов
        const fundsValue = state.fundInvestments.reduce(
          (sum, i) => sum.add(D(i.currentValue)),
          D(0)
        );
        
        // Ликвидные активы
        const liquidAssets = cash.add(stocksValue).add(fundsValue);
        
        // Долги
        const totalDebt = state.loans
          .filter(l => l.status === 'active')
          .reduce((sum, l) => sum.add(D(l.remainingBalance)), D(0));
        
        // Чистая стоимость
        const netWorth = liquidAssets.sub(totalDebt);
        
        // Максимальная сумма кредита
        const maxLoanCapacity = calculateMaxLoanCapacity(
          state.creditScore,
          liquidAssets,
          totalDebt
        );
        
        // История чистой стоимости
        const now = Date.now();
        const newHistory = [...state.netWorthHistory];
        newHistory.push({ timestamp: now, value: netWorth.toString() });
        if (newHistory.length > FINANCE_CONFIG.MAX_PRICE_HISTORY_POINTS) {
          newHistory.shift();
        }
        
        set({
          liquidAssets: liquidAssets.toString(),
          totalDebt: totalDebt.toString(),
          netWorth: netWorth.toString(),
          maxLoanCapacity: maxLoanCapacity.toString(),
          netWorthHistory: newHistory,
        });
      },
      
      getAvailableLoanProducts: () => {
        const state = get();
        return LOAN_PRODUCTS.filter(p => p.minCreditScore <= state.creditScore);
      },
      
      getPositionValue: (stockId: string) => {
        const position = get().positions.find(p => p.stockId === stockId);
        return position ? D(position.currentValue) : D(0);
      },
      
      getTotalPortfolioValue: () => {
        const state = get();
        const stocksValue = state.positions.reduce(
          (sum, p) => sum.add(D(p.currentValue)),
          D(0)
        );
        const fundsValue = state.fundInvestments.reduce(
          (sum, i) => sum.add(D(i.currentValue)),
          D(0)
        );
        return stocksValue.add(fundsValue);
      },
      
      // ========================================
      // СБРОС
      // ========================================
      
      resetFinance: () => {
        set({
          ...INITIAL_FINANCE_STATE,
          stocks: createAllStocks(),
          funds: createAllFunds(),
          marketEvents: [],
        });
      },
    })
);

// ============================================================================
// Серверное сохранение
// ============================================================================

/**
 * Снимок финансов для серверного сейва.
 *
 * Финансы хранились ТОЛЬКО в localStorage (`finance-storage`) и не попадали в серверный
 * сейв вообще. При этом AuthForm вызывает clearAllUserData() при каждом входе и
 * регистрации, а она удаляет именно этот ключ — то есть банковский счёт, вклады,
 * портфель акций, кредиты и кредитный рейтинг уничтожались при каждом логине, и на
 * другом устройстве их не было никогда.
 *
 * Набор полей совпадает с `partialize` выше: это и есть «то, что имеет смысл хранить».
 * Все значения там уже строки/числа (balance: string, netWorth: string, creditScore:
 * number), поэтому payload JSON-безопасен без конвертации Decimal.
 *
 * Намеренно НЕ сохраняются `stocks`, `funds` и `marketEvents`: цены на акции теперь
 * серверные (см. syncStockPricesFromServer), и сохранённый снимок цен при загрузке
 * конфликтовал бы с авторитетными. Они пересоздаются из констант.
 */
/**
 * Полный сброс финансов. Нужен gameStore.resetGame: новая игра обязана начинаться без
 * кредитов и портфеля предыдущей, иначе долг переезжает в свежую партию.
 */
export function resetFinanceState(): void {
  useFinanceStore.getState().resetFinance();
}

export function serializeFinance(): Record<string, unknown> {
  const s = useFinanceStore.getState();
  return {
    bank: s.bank,
    loans: s.loans,
    maxLoanCapacity: s.maxLoanCapacity,
    creditScore: s.creditScore,
    creditScoreHistory: s.creditScoreHistory,
    positions: s.positions,
    stockTransactions: s.stockTransactions.slice(-100),
    fundInvestments: s.fundInvestments,
    netWorth: s.netWorth,
    liquidAssets: s.liquidAssets,
    totalDebt: s.totalDebt,
    netWorthHistory: s.netWorthHistory,
    lastStockUpdate: s.lastStockUpdate,
    lastDividendPayout: s.lastDividendPayout,
    stats: s.stats,
  };
}

/**
 * Восстановление финансов из серверного сейва.
 *
 * Total by construction: любое отсутствующее или битое поле берётся из
 * INITIAL_FINANCE_STATE, поэтому старый сейв (без секции finance) и повреждённый сейв
 * дают играбельное состояние, а не падение при первом `.add()`.
 */
export function hydrateFinance(raw: unknown): void {
  const store = useFinanceStore.getState();

  /*
   * Нет секции finance — старый сейв или другая карта. Раньше здесь был просто `return`, и в
   * памяти оставались финансы ПРЕДЫДУЩЕГО слота: банковский счёт, кредиты и рейтинг переезжали
   * на новую карту. Загрузка слота обязана быть полной заменой состояния, поэтому сбрасываем
   * в начальное — иначе взятый на одной карте кредит виден на всех.
   */
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    store.resetFinance();
    return;
  }

  const r = raw as Record<string, unknown>;
  const isObj = (v: unknown) => !!v && typeof v === 'object' && !Array.isArray(v);
  const arr = <T>(v: unknown, fallback: T[]): T[] => (Array.isArray(v) ? (v as T[]) : fallback);
  const str = (v: unknown, fallback: string) => (typeof v === 'string' ? v : fallback);
  const num = (v: unknown, fallback: number) =>
    typeof v === 'number' && Number.isFinite(v) ? v : fallback;

  useFinanceStore.setState({
    bank: isObj(r.bank) ? { ...INITIAL_FINANCE_STATE.bank, ...(r.bank as object) } : INITIAL_FINANCE_STATE.bank,
    loans: arr(r.loans, INITIAL_FINANCE_STATE.loans),
    maxLoanCapacity: str(r.maxLoanCapacity, INITIAL_FINANCE_STATE.maxLoanCapacity),
    creditScore: num(r.creditScore, INITIAL_FINANCE_STATE.creditScore),
    creditScoreHistory: arr(r.creditScoreHistory, INITIAL_FINANCE_STATE.creditScoreHistory),
    positions: arr(r.positions, INITIAL_FINANCE_STATE.positions),
    stockTransactions: arr(r.stockTransactions, INITIAL_FINANCE_STATE.stockTransactions),
    fundInvestments: arr(r.fundInvestments, INITIAL_FINANCE_STATE.fundInvestments),
    netWorth: str(r.netWorth, INITIAL_FINANCE_STATE.netWorth),
    liquidAssets: str(r.liquidAssets, INITIAL_FINANCE_STATE.liquidAssets),
    totalDebt: str(r.totalDebt, INITIAL_FINANCE_STATE.totalDebt),
    netWorthHistory: arr(r.netWorthHistory, INITIAL_FINANCE_STATE.netWorthHistory),
    lastStockUpdate: num(r.lastStockUpdate, INITIAL_FINANCE_STATE.lastStockUpdate),
    lastDividendPayout: num(r.lastDividendPayout, INITIAL_FINANCE_STATE.lastDividendPayout),
    stats: isObj(r.stats)
      ? { ...INITIAL_FINANCE_STATE.stats, ...(r.stats as object) }
      : INITIAL_FINANCE_STATE.stats,
  } as never);

  // Каталоги акций/фондов не сохраняются — если их ещё нет, поднимаем из констант.
  if (store.stocks.length === 0) store.initializeFinance();
}
