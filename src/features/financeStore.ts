/**
 * Finance Store
 * Фаза 6: Zustand store для финансовой системы
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
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
  processDividends: () => void;
  
  // Фонды
  investInFund: (fundId: string, amount: Decimal) => { success: boolean; error?: string };
  withdrawFromFund: (fundId: string, shares: Decimal) => { success: boolean; profit: Decimal; error?: string };
  updateFundPrices: () => void;
  
  // Обновление финансов (вызывается из game loop)
  updateFinance: (deltaMs: number) => void;
  
  // Утилиты
  recalculateNetWorth: (creditsBalance: Decimal) => void;
  getAvailableLoanProducts: () => LoanProduct[];
  getPositionValue: (stockId: string) => Decimal;
  getTotalPortfolioValue: () => Decimal;
  
  // Сброс
  resetFinance: () => void;
}

// ==========================================
// СОЗДАНИЕ STORE
// ==========================================

export const useFinanceStore = create<FinanceStore>()(
  persist(
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
        
        // Зачисляем сумму на счёт
        const newBalance = D(state.bank.balance).add(amount);
        const newTotalDebt = D(state.totalDebt).add(D(loan.remainingBalance));
        
        set({
          bank: {
            ...state.bank,
            balance: newBalance.toString(),
          },
          loans: [...state.loans, loan],
          creditScore: newScore,
          creditScoreHistory: [...state.creditScoreHistory, event],
          totalDebt: newTotalDebt.toString(),
        });
        
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
        
        const balance = D(state.bank.balance);
        if (amount.gt(balance)) {
          return { success: false, isFullyPaid: false, error: 'Недостаточно средств' };
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
        
        const newBalance = balance.sub(amount);
        const newTotalDebt = D(state.totalDebt).sub(amount);
        const newLoanInterestPaid = D(state.stats.totalLoanInterestPaid).add(
          D(updatedLoan.paymentHistory[updatedLoan.paymentHistory.length - 1]?.interestPart || '0')
        );
        
        set({
          bank: {
            ...state.bank,
            balance: newBalance.toString(),
          },
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
        
        // Обновление цен акций
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
    }),
    {
      name: 'finance-storage',
      partialize: (state) => ({
        bank: state.bank,
        loans: state.loans,
        maxLoanCapacity: state.maxLoanCapacity,
        creditScore: state.creditScore,
        creditScoreHistory: state.creditScoreHistory,
        positions: state.positions,
        stockTransactions: state.stockTransactions.slice(-100), // Последние 100 транзакций
        fundInvestments: state.fundInvestments,
        netWorth: state.netWorth,
        liquidAssets: state.liquidAssets,
        totalDebt: state.totalDebt,
        netWorthHistory: state.netWorthHistory,
        lastStockUpdate: state.lastStockUpdate,
        lastDividendPayout: state.lastDividendPayout,
        stats: state.stats,
      }),
      onRehydrateStorage: () => (state) => {
        // После восстановления из storage, инициализируем акции и фонды
        if (state && state.stocks.length === 0) {
          state.initializeFinance();
        }
      },
    }
  )
);
