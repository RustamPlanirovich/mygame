/**
 * Типы для AI-системы и финансового помощника
 * DeepSeek AI интеграция
 */

// ==========================================
// AI КОНФИГУРАЦИЯ
// ==========================================

export interface AIConfig {
  enabled: boolean;
  apiKey?: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

// ==========================================
// КОТИРОВКИ ОТ AI
// ==========================================

export interface AIMarketPrediction {
  stockId: string;
  symbol: string;
  predictedDirection: 'up' | 'down' | 'stable';
  confidence: number; // 0-1
  predictedChange: number; // процент изменения
  reasoning: string;
  timestamp: number;
  expiresAt: number; // когда прогноз устареет
}

export interface AIFundPrediction {
  fundId: string;
  predictedDirection: 'up' | 'down' | 'stable';
  confidence: number;
  predictedChange: number;
  reasoning: string;
  timestamp: number;
  expiresAt: number;
}

export interface AICreditRatePrediction {
  predictedBaseRate: number;
  rateDirection: 'rising' | 'falling' | 'stable';
  reasoning: string;
  timestamp: number;
}

// ==========================================
// AI ДИВИДЕНДЫ
// ==========================================

export interface AIDividendUpdate {
  stockId: string;
  newYield: number; // 0-0.10 (0-10%)
  change: 'increased' | 'decreased' | 'unchanged';
  reason: string;
}

export interface AIDividendPrediction {
  dividendUpdates: AIDividendUpdate[];
  marketConditions: string;
  generatedAt: number;
  source: 'ai' | 'fallback';
}

export interface AIMarketAnalysis {
  overallSentiment: 'bullish' | 'bearish' | 'neutral';
  topBuyRecommendations: AIMarketPrediction[];
  topSellRecommendations: AIMarketPrediction[];
  creditRatePrediction: AICreditRatePrediction;
  marketNarrative: string;
  generatedAt: number;
}

// ==========================================
// ФИНАНСОВЫЙ ПОМОЩНИК
// ==========================================

export type FinancialAdvisorTier = 'none' | 'basic' | 'premium';

export interface FinancialAdvisorConfig {
  tier: FinancialAdvisorTier;
  purchasedAt?: number;
  expiresAt?: number; // для подписки

  // Настройки автоматического трейдера (premium)
  autoTrading: {
    enabled: boolean;
    maxInvestmentPercent: number; // макс % от баланса для одной сделки
    minConfidence: number; // мин. уверенность AI для действия
    riskTolerance: 'low' | 'medium' | 'high';
    allowLoans: boolean; // разрешить брать кредиты
    allowLending: boolean; // разрешить выдавать кредиты
    
    // Take-profit и stop-loss для позиций
    takeProfitPercent: number; // фиксировать прибыль при росте на X%
    stopLossPercent: number; // продавать при падении на X%
  };
}

export interface AdvisorRecommendation {
  id: string;
  type: 'buy_stock' | 'sell_stock' | 'buy_fund' | 'sell_fund' | 'take_loan' | 'pay_loan' | 'lend_credits';
  targetId: string; // stockId, fundId, loanProductId
  amount?: string;
  reasoning: string;
  expectedProfit?: string;
  confidence: number;
  timestamp: number;
  executed?: boolean;
  executedAt?: number;
  result?: string;
}

// ==========================================
// P2P КРЕДИТОВАНИЕ
// ==========================================

export type P2PLoanStatus = 'open' | 'active' | 'paid' | 'defaulted' | 'cancelled';

/**
 * Предложение кредита на P2P рынке
 */
export interface P2PLoanOffer {
  id: string;
  lenderId: string;
  lenderName: string;
  /** Сумма кредита */
  amount: string;
  /** Годовая процентная ставка */
  interestRate: number;
  /** Срок в днях */
  termDays: number;
  /** Минимальный кредитный рейтинг заёмщика */
  minCreditScore: number;
  /** Статус */
  status: P2PLoanStatus;
  /** Дата создания */
  createdAt: number;
  /** Истекает */
  expiresAt: number;
  /** Требуется ли залог */
  requiresCollateral: boolean;
}

/**
 * Активный P2P кредит
 */
export interface P2PLoan {
  id: string;
  offerId: string;
  lenderId: string;
  lenderName: string;
  borrowerId: string;
  borrowerName: string;
  /** Сумма кредита */
  principal: string;
  /** Годовая процентная ставка */
  interestRate: number;
  /** Срок в днях */
  termDays: number;
  /** Остаток к выплате */
  remainingBalance: string;
  /** Статус */
  status: P2PLoanStatus;
  /** Дата начала */
  startDate: number;
  /** Дата окончания */
  dueDate: number;
  /** Выплачено процентов */
  interestPaid: string;
  /** Количество просроченных дней */
  daysOverdue: number;
}

/**
 * DTO для API
 */
export interface P2PLoanOfferDTO {
  id: string;
  lenderId: string;
  lenderName: string;
  amount: string;
  interestRate: number;
  termDays: number;
  minCreditScore: number;
  status: P2PLoanStatus;
  createdAt: number;
  expiresAt: number;
  requiresCollateral: boolean;
}

export interface P2PLoanDTO {
  id: string;
  offerId: string;
  lenderId: string;
  lenderName: string;
  borrowerId: string;
  borrowerName: string;
  principal: string;
  interestRate: number;
  termDays: number;
  remainingBalance: string;
  status: P2PLoanStatus;
  startDate: number;
  dueDate: number;
  interestPaid: string;
  daysOverdue: number;
}

// ==========================================
// СТОИМОСТЬ ПОМОЩНИКА
// ==========================================

export const ADVISOR_PRICES = {
  basic: {
    credits: '50000',
    description: 'Базовый советник - подсказки о выгодных моментах покупки/продажи',
  },
  premium: {
    credits: '500000',
    description: 'Премиум советник - автоматическая торговля и управление кредитами',
  },
} as const;

// ==========================================
// P2P РЫНОК КОНФИГУРАЦИЯ
// ==========================================

export const P2P_LENDING_CONFIG = {
  /** Минимальная сумма кредита */
  MIN_LOAN_AMOUNT: '1000',
  /** Максимальная сумма кредита */
  MAX_LOAN_AMOUNT: '10000000',
  /** Минимальная ставка */
  MIN_INTEREST_RATE: 0.01, // 1%
  /** Максимальная ставка */
  MAX_INTEREST_RATE: 0.50, // 50%
  /** Минимальный срок */
  MIN_TERM_DAYS: 1,
  /** Максимальный срок */
  MAX_TERM_DAYS: 365,
  /** Время жизни оффера (7 дней) */
  OFFER_LIFETIME_MS: 7 * 24 * 60 * 60 * 1000,
  /** Комиссия платформы */
  PLATFORM_FEE_PERCENT: 1,
} as const;
