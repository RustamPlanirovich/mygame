/**
 * Типы для финансовой системы
 * Фаза 6: Банковская система, инвестиции, кредиты, акции
 */

import type { DataPoint } from './gameTypes.analytics';

// ==========================================
// БАНКОВСКИЙ СЧЁТ
// ==========================================

/**
 * Банковский счёт игрока
 */
export interface BankAccount {
  /** Баланс текущего счёта (кредиты) */
  balance: string;
  /** Баланс сберегательного счёта (кредиты) */
  savingsBalance: string;
  /** Годовая процентная ставка сберегательного счёта (0.02 = 2%) */
  interestRate: number;
  /** Timestamp последнего начисления процентов */
  lastInterestPaid: number;
  /** Статистика */
  stats: {
    /** Всего заработано процентов */
    totalInterestEarned: string;
    /** Всего внесено на сберегательный */
    totalDeposited: string;
    /** Всего снято со сберегательного */
    totalWithdrawn: string;
  };
}

// ==========================================
// КРЕДИТЫ
// ==========================================

/**
 * Статус кредита
 */
export type LoanStatus = 'active' | 'paid' | 'defaulted';

/**
 * Тип залога
 */
export type CollateralType = 'buildings' | 'resources' | 'none';

/**
 * Залог по кредиту
 */
export interface LoanCollateral {
  type: CollateralType;
  /** Оценочная стоимость залога */
  value: string;
  /** Описание залога (ID зданий или ресурсы) */
  description: string;
}

/**
 * Кредит
 */
export interface Loan {
  /** Уникальный ID кредита */
  id: string;
  /** Сумма кредита (принципал) */
  principal: string;
  /** Годовая процентная ставка */
  interestRate: number;
  /** Срок кредита в игровых днях */
  termDays: number;
  /** Остаток к выплате */
  remainingBalance: string;
  /** Ежемесячный платёж (каждые 30 игровых минут) */
  monthlyPayment: string;
  /** Timestamp начала кредита */
  startDate: number;
  /** Timestamp окончания кредита */
  dueDate: number;
  /** Следующий платёж (timestamp) */
  nextPaymentDate: number;
  /** Статус кредита */
  status: LoanStatus;
  /** Залог (опционально) */
  collateral?: LoanCollateral;
  /** Количество просроченных платежей */
  missedPayments: number;
  /** История платежей */
  paymentHistory: LoanPayment[];
}

/**
 * Платёж по кредиту
 */
export interface LoanPayment {
  /** Timestamp платежа */
  date: number;
  /** Сумма платежа */
  amount: string;
  /** Сумма на погашение основного долга */
  principalPart: string;
  /** Сумма процентов */
  interestPart: string;
  /** Остаток после платежа */
  remainingAfter: string;
}

/**
 * Доступный кредитный продукт
 */
export interface LoanProduct {
  id: string;
  name: string;
  /** Минимальная сумма */
  minAmount: string;
  /** Максимальная сумма (множитель от creditScore) */
  maxAmountMultiplier: number;
  /** Базовая процентная ставка */
  baseInterestRate: number;
  /** Срок в днях */
  termDays: number;
  /** Требуется ли залог */
  requiresCollateral: boolean;
  /** Минимальный кредитный рейтинг */
  minCreditScore: number;
  /** Описание */
  description: string;
}

// ==========================================
// АКЦИИ
// ==========================================

/**
 * Секторы фондового рынка
 */
export type StockSector =
  | 'energy'
  | 'mining'
  | 'technology'
  | 'manufacturing'
  | 'aerospace'
  | 'entertainment'
  | 'biotech'
  | 'exotic';

/**
 * Уровень волатильности
 */
export type VolatilityLevel = 'low' | 'medium' | 'high' | 'very_high' | 'extreme';

/**
 * Акция
 */
export interface Stock {
  /** Уникальный ID */
  id: string;
  /** Тикер (3-4 буквы) */
  symbol: string;
  /** Полное название компании */
  name: string;
  /** Сектор */
  sector: StockSector;
  /** Текущая цена */
  currentPrice: string;
  /** Цена закрытия предыдущего дня */
  previousClose: string;
  /** Изменение за день в % */
  dayChange: number;
  /** Объём торгов за день */
  volume: string;
  /** Рыночная капитализация */
  marketCap: string;
  /** Годовая дивидендная доходность (0.03 = 3%) */
  dividendYield: number;
  /** История цен (30 дней) */
  priceHistory: DataPoint[];
  /** Уровень волатильности */
  volatility: VolatilityLevel;
  /** Базовая цена (для симуляции) */
  basePrice: string;
  /** Тренд (-1 до 1, влияет на направление движения) */
  trend: number;
  /** Эмодзи для отображения */
  emoji: string;
  /** Описание компании */
  description: string;
}

/**
 * Позиция в акциях (портфель игрока)
 */
export interface StockPosition {
  /** ID акции */
  stockId: string;
  /** Количество акций */
  shares: string;
  /** Средняя цена покупки */
  avgBuyPrice: string;
  /** Всего инвестировано */
  totalInvested: string;
  /** Текущая стоимость */
  currentValue: string;
  /** Нереализованная прибыль/убыток */
  unrealizedPnL: string;
  /** Нереализованная P&L в % */
  unrealizedPnLPercent: number;
  /** Полученные дивиденды */
  dividendsReceived: string;
  /** Дата первой покупки */
  firstPurchaseDate: number;
}

/**
 * Транзакция по акциям
 */
export interface StockTransaction {
  id: string;
  stockId: string;
  type: 'buy' | 'sell';
  shares: string;
  pricePerShare: string;
  totalAmount: string;
  fee: string;
  timestamp: number;
}

// ==========================================
// ИНВЕСТИЦИОННЫЕ ФОНДЫ
// ==========================================

/**
 * Тип инвестиционного фонда
 */
export type FundType = 'index' | 'sector' | 'growth' | 'income' | 'balanced';

/**
 * Уровень риска фонда
 */
export type RiskLevel = 1 | 2 | 3 | 4 | 5;

/**
 * Состав фонда
 */
export interface FundComposition {
  stockId: string;
  /** Вес в портфеле (0-1) */
  weight: number;
}

/**
 * Инвестиционный фонд
 */
export interface InvestmentFund {
  id: string;
  name: string;
  type: FundType;
  riskLevel: RiskLevel;
  /** Ожидаемая годовая доходность */
  annualReturn: number;
  /** Комиссия за управление (годовая) */
  managementFee: number;
  /** Состав фонда */
  composition: FundComposition[];
  /** Текущая стоимость пая */
  navPerShare: string;
  /** История NAV */
  navHistory: DataPoint[];
  /** Описание фонда */
  description: string;
  /** Минимальная инвестиция */
  minInvestment: string;
}

/**
 * Инвестиция в фонд
 */
export interface FundInvestment {
  fundId: string;
  /** Количество паёв */
  shares: string;
  /** Вложенная сумма */
  investedAmount: string;
  /** Текущая стоимость */
  currentValue: string;
  /** Нереализованная P&L */
  unrealizedPnL: string;
  /** Дата инвестирования */
  investmentDate: number;
}

// ==========================================
// КРЕДИТНЫЙ РЕЙТИНГ
// ==========================================

/**
 * Категория кредитного рейтинга
 */
export type CreditScoreCategory = 
  | 'excellent'   // 800-850
  | 'very_good'   // 740-799
  | 'good'        // 670-739
  | 'fair'        // 580-669
  | 'poor';       // 300-579

/**
 * Событие, влияющее на кредитный рейтинг
 */
export interface CreditScoreEvent {
  type: 'loan_paid' | 'loan_defaulted' | 'payment_missed' | 'payment_on_time' | 'new_loan';
  change: number;
  timestamp: number;
  description: string;
}

// ==========================================
// ФИНАНСОВОЕ СОСТОЯНИЕ
// ==========================================

/**
 * Полное финансовое состояние игрока
 */
export interface FinanceState {
  /** Банковский счёт */
  bank: BankAccount;
  
  /** Активные кредиты */
  loans: Loan[];
  
  /** Максимальная сумма кредита (зависит от creditScore и активов) */
  maxLoanCapacity: string;
  
  /** Кредитный рейтинг (300-850) */
  creditScore: number;
  
  /** История изменений кредитного рейтинга */
  creditScoreHistory: CreditScoreEvent[];
  
  /** Позиции в акциях */
  positions: StockPosition[];
  
  /** История транзакций по акциям */
  stockTransactions: StockTransaction[];
  
  /** Инвестиции в фонды */
  fundInvestments: FundInvestment[];
  
  /** Чистая стоимость (все активы - все обязательства) */
  netWorth: string;
  
  /** Ликвидные активы (наличные + акции) */
  liquidAssets: string;
  
  /** Всего долгов */
  totalDebt: string;
  
  /** История чистой стоимости */
  netWorthHistory: DataPoint[];
  
  /** Последнее обновление цен акций */
  lastStockUpdate: number;
  
  /** Последняя выплата дивидендов */
  lastDividendPayout: number;
  
  /** Статистика */
  stats: {
    /** Всего заработано на акциях */
    totalStockProfits: string;
    /** Всего потеряно на акциях */
    totalStockLosses: string;
    /** Всего получено дивидендов */
    totalDividends: string;
    /** Всего выплачено процентов по кредитам */
    totalLoanInterestPaid: string;
    /** Количество успешно закрытых кредитов */
    loansFullyPaid: number;
    /** Количество дефолтов */
    loansDefaulted: number;
  };
}

// ==========================================
// КОНФИГУРАЦИЯ ФИНАНСОВОЙ СИСТЕМЫ
// ==========================================

export const FINANCE_CONFIG = {
  /** Базовая ставка сберегательного счёта */
  SAVINGS_INTEREST_RATE: 0.02,
  
  /** Интервал начисления процентов (каждые 5 минут игрового времени) */
  INTEREST_INTERVAL_MS: 5 * 60 * 1000,
  
  /** Интервал обновления цен акций (каждые 5 минут) */
  STOCK_UPDATE_INTERVAL_MS: 5 * 60 * 1000,
  
  /** Интервал выплаты дивидендов (каждые 7 дней игрового времени) */
  DIVIDEND_INTERVAL_MS: 7 * 24 * 60 * 60 * 1000,
  
  /** Комиссия за покупку/продажу акций */
  STOCK_TRADING_FEE: 0.001, // 0.1%
  
  /** Начальный кредитный рейтинг */
  INITIAL_CREDIT_SCORE: 600,
  
  /** Минимальный кредитный рейтинг */
  MIN_CREDIT_SCORE: 300,
  
  /** Максимальный кредитный рейтинг */
  MAX_CREDIT_SCORE: 850,
  
  /** Изменение рейтинга за вовремя выплаченный кредит */
  CREDIT_SCORE_LOAN_PAID: 10,
  
  /** Изменение рейтинга за просроченный платёж */
  CREDIT_SCORE_PAYMENT_MISSED: -20,
  
  /** Изменение рейтинга за дефолт */
  CREDIT_SCORE_DEFAULT: -100,
  
  /** Изменение рейтинга за платёж вовремя */
  CREDIT_SCORE_PAYMENT_ON_TIME: 2,
  
  /** Максимальное количество точек истории цен */
  MAX_PRICE_HISTORY_POINTS: 288,
  
  /** Максимальное количество активных кредитов */
  MAX_ACTIVE_LOANS: 3,
} as const;

// ==========================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ТИПОВ
// ==========================================

/**
 * Получает категорию кредитного рейтинга
 */
export function getCreditScoreCategory(score: number): CreditScoreCategory {
  if (score >= 800) return 'excellent';
  if (score >= 740) return 'very_good';
  if (score >= 670) return 'good';
  if (score >= 580) return 'fair';
  return 'poor';
}

/**
 * Получает название категории кредитного рейтинга
 */
export function getCreditScoreCategoryName(category: CreditScoreCategory): string {
  const names: Record<CreditScoreCategory, string> = {
    excellent: 'Превосходный',
    very_good: 'Очень хороший',
    good: 'Хороший',
    fair: 'Удовлетворительный',
    poor: 'Плохой',
  };
  return names[category];
}

/**
 * Получает цвет для категории кредитного рейтинга
 */
export function getCreditScoreColor(category: CreditScoreCategory): string {
  const colors: Record<CreditScoreCategory, string> = {
    excellent: '#3ee07f',
    very_good: '#a1e245',
    good: '#f1fa8c',
    fair: '#f39c12',
    poor: '#ff5555',
  };
  return colors[category];
}

/**
 * Получает название сектора акций
 */
export function getStockSectorName(sector: StockSector): string {
  const names: Record<StockSector, string> = {
    energy: 'Энергетика',
    mining: 'Добыча',
    technology: 'Технологии',
    manufacturing: 'Производство',
    aerospace: 'Аэрокосмос',
    entertainment: 'Развлечения',
    biotech: 'Биотехнологии',
    exotic: 'Экзотика',
  };
  return names[sector];
}

/**
 * Получает название типа фонда
 */
export function getFundTypeName(type: FundType): string {
  const names: Record<FundType, string> = {
    index: 'Индексный',
    sector: 'Секторный',
    growth: 'Роста',
    income: 'Доходный',
    balanced: 'Сбалансированный',
  };
  return names[type];
}

/**
 * Получает описание уровня риска
 */
export function getRiskLevelDescription(level: RiskLevel): string {
  const descriptions: Record<RiskLevel, string> = {
    1: 'Очень низкий',
    2: 'Низкий',
    3: 'Средний',
    4: 'Высокий',
    5: 'Очень высокий',
  };
  return descriptions[level];
}

/**
 * Получает цвет для уровня риска
 */
export function getRiskLevelColor(level: RiskLevel): string {
  const colors: Record<RiskLevel, string> = {
    1: '#3ee07f',
    2: '#a1e245',
    3: '#f1fa8c',
    4: '#f39c12',
    5: '#ff5555',
  };
  return colors[level];
}

/**
 * Начальное состояние финансовой системы
 */
export const INITIAL_FINANCE_STATE: FinanceState = {
  bank: {
    balance: '0',
    savingsBalance: '0',
    interestRate: FINANCE_CONFIG.SAVINGS_INTEREST_RATE,
    lastInterestPaid: Date.now(),
    stats: {
      totalInterestEarned: '0',
      totalDeposited: '0',
      totalWithdrawn: '0',
    },
  },
  loans: [],
  maxLoanCapacity: '10000',
  creditScore: FINANCE_CONFIG.INITIAL_CREDIT_SCORE,
  creditScoreHistory: [],
  positions: [],
  stockTransactions: [],
  fundInvestments: [],
  netWorth: '0',
  liquidAssets: '0',
  totalDebt: '0',
  netWorthHistory: [],
  lastStockUpdate: Date.now(),
  lastDividendPayout: Date.now(),
  stats: {
    totalStockProfits: '0',
    totalStockLosses: '0',
    totalDividends: '0',
    totalLoanInterestPaid: '0',
    loansFullyPaid: 0,
    loansDefaulted: 0,
  },
};
