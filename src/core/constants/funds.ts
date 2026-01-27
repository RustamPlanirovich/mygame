/**
 * Определения инвестиционных фондов и кредитных продуктов
 * Фаза 6: 5 инвестиционных фондов и кредитные продукты
 */

import type { 
  InvestmentFund, 
  FundComposition, 
  FundType, 
  RiskLevel,
  LoanProduct
} from '../gameTypes.finance';

/**
 * Определение инвестиционного фонда (без динамических данных)
 */
export interface FundDefinition {
  id: string;
  name: string;
  type: FundType;
  riskLevel: RiskLevel;
  annualReturn: number;
  managementFee: number;
  composition: FundComposition[];
  description: string;
  minInvestment: number;
  emoji: string;
}

/**
 * Все инвестиционные фонды
 */
export const FUND_DEFINITIONS: FundDefinition[] = [
  {
    id: 'stable_index',
    name: 'Stable Index Fund',
    type: 'index',
    riskLevel: 1,
    annualReturn: 0.05, // 5% годовых
    managementFee: 0.002, // 0.2%
    composition: [
      { stockId: 'ores', weight: 0.25 },
      { stockId: 'enrg', weight: 0.25 },
      { stockId: 'mech', weight: 0.25 },
      { stockId: 'arms', weight: 0.25 },
    ],
    description: 'Консервативный индексный фонд с низким риском. Инвестирует в стабильные компании с высокими дивидендами.',
    minInvestment: 1000,
    emoji: '🏦',
  },
  {
    id: 'growth_leaders',
    name: 'Growth Leaders Fund',
    type: 'growth',
    riskLevel: 3,
    annualReturn: 0.12, // 12% годовых
    managementFee: 0.01, // 1%
    composition: [
      { stockId: 'chip', weight: 0.30 },
      { stockId: 'slrs', weight: 0.25 },
      { stockId: 'aero', weight: 0.25 },
      { stockId: 'game', weight: 0.20 },
    ],
    description: 'Фонд роста с умеренным риском. Инвестирует в быстрорастущие технологические компании.',
    minInvestment: 5000,
    emoji: '📈',
  },
  {
    id: 'tech_innovation',
    name: 'Tech Innovation Fund',
    type: 'sector',
    riskLevel: 4,
    annualReturn: 0.18, // 18% годовых
    managementFee: 0.015, // 1.5%
    composition: [
      { stockId: 'chip', weight: 0.25 },
      { stockId: 'qntm', weight: 0.30 },
      { stockId: 'medi', weight: 0.25 },
      { stockId: 'cryo', weight: 0.20 },
    ],
    description: 'Высокорисковый секторный фонд. Инвестирует в передовые технологии и биотехнологии.',
    minInvestment: 10000,
    emoji: '🔬',
  },
  {
    id: 'high_dividend',
    name: 'High Dividend Income Fund',
    type: 'income',
    riskLevel: 2,
    annualReturn: 0.08, // 8% годовых
    managementFee: 0.005, // 0.5%
    composition: [
      { stockId: 'arms', weight: 0.30 },
      { stockId: 'enrg', weight: 0.30 },
      { stockId: 'ores', weight: 0.25 },
      { stockId: 'mech', weight: 0.15 },
    ],
    description: 'Доходный фонд с фокусом на компании с высокими дивидендами. Стабильный пассивный доход.',
    minInvestment: 2500,
    emoji: '💰',
  },
  {
    id: 'balanced_portfolio',
    name: 'Balanced Portfolio Fund',
    type: 'balanced',
    riskLevel: 2,
    annualReturn: 0.07, // 7% годовых
    managementFee: 0.008, // 0.8%
    composition: [
      { stockId: 'ores', weight: 0.15 },
      { stockId: 'enrg', weight: 0.15 },
      { stockId: 'chip', weight: 0.15 },
      { stockId: 'aero', weight: 0.15 },
      { stockId: 'mech', weight: 0.15 },
      { stockId: 'arms', weight: 0.15 },
      { stockId: 'game', weight: 0.10 },
    ],
    description: 'Сбалансированный фонд с диверсификацией по секторам. Оптимальное соотношение риска и доходности.',
    minInvestment: 3000,
    emoji: '⚖️',
  },
];

/**
 * Кредитные продукты
 */
export const LOAN_PRODUCTS: LoanProduct[] = [
  {
    id: 'quick_loan',
    name: 'Быстрый кредит',
    minAmount: '1000',
    maxAmountMultiplier: 10, // creditScore * 10
    baseInterestRate: 0.15, // 15% годовых
    termDays: 7,
    requiresCollateral: false,
    minCreditScore: 300,
    description: 'Небольшой краткосрочный кредит без залога. Высокая ставка, но быстрое одобрение.',
  },
  {
    id: 'standard_loan',
    name: 'Стандартный кредит',
    minAmount: '5000',
    maxAmountMultiplier: 50,
    baseInterestRate: 0.10, // 10% годовых
    termDays: 30,
    requiresCollateral: false,
    minCreditScore: 500,
    description: 'Стандартный кредит на месяц. Требуется умеренный кредитный рейтинг.',
  },
  {
    id: 'business_loan',
    name: 'Бизнес кредит',
    minAmount: '25000',
    maxAmountMultiplier: 150,
    baseInterestRate: 0.08, // 8% годовых
    termDays: 90,
    requiresCollateral: true,
    minCreditScore: 650,
    description: 'Крупный бизнес-кредит под залог. Низкая ставка для надёжных заёмщиков.',
  },
  {
    id: 'mega_loan',
    name: 'Мегакредит',
    minAmount: '100000',
    maxAmountMultiplier: 500,
    baseInterestRate: 0.06, // 6% годовых
    termDays: 180,
    requiresCollateral: true,
    minCreditScore: 750,
    description: 'Огромный кредит для масштабных проектов. Только для заёмщиков с превосходным рейтингом.',
  },
];

/**
 * Получить определение фонда по ID
 */
export function getFundDefinition(fundId: string): FundDefinition | undefined {
  return FUND_DEFINITIONS.find(f => f.id === fundId);
}

/**
 * Получить фонды по типу
 */
export function getFundsByType(type: FundType): FundDefinition[] {
  return FUND_DEFINITIONS.filter(f => f.type === type);
}

/**
 * Получить фонды по уровню риска
 */
export function getFundsByRiskLevel(level: RiskLevel): FundDefinition[] {
  return FUND_DEFINITIONS.filter(f => f.riskLevel === level);
}

/**
 * Получить кредитный продукт по ID
 */
export function getLoanProduct(productId: string): LoanProduct | undefined {
  return LOAN_PRODUCTS.find(p => p.id === productId);
}

/**
 * Получить доступные кредитные продукты для данного кредитного рейтинга
 */
export function getAvailableLoanProducts(creditScore: number): LoanProduct[] {
  return LOAN_PRODUCTS.filter(p => p.minCreditScore <= creditScore);
}

/**
 * Рассчитать процентную ставку для заёмщика
 * Чем выше кредитный рейтинг, тем ниже ставка
 */
export function calculateInterestRate(baseRate: number, creditScore: number): number {
  // Идеальный рейтинг (850) даёт скидку 30%
  // Минимальный рейтинг (300) даёт штраф 50%
  const scoreNormalized = (creditScore - 300) / (850 - 300); // 0 to 1
  const modifier = 1.5 - (scoreNormalized * 0.8); // 1.5 to 0.7
  return baseRate * modifier;
}

/**
 * Рассчитать максимальную сумму кредита
 */
export function calculateMaxLoanAmount(product: LoanProduct, creditScore: number): number {
  return creditScore * product.maxAmountMultiplier;
}

/**
 * Создать инвестиционный фонд из определения
 */
export function createFundFromDefinition(def: FundDefinition): InvestmentFund {
  const now = Date.now();
  const initialNav = 100; // Начальная стоимость пая
  
  return {
    id: def.id,
    name: def.name,
    type: def.type,
    riskLevel: def.riskLevel,
    annualReturn: def.annualReturn,
    managementFee: def.managementFee,
    composition: def.composition,
    navPerShare: initialNav.toString(),
    navHistory: [{ timestamp: now, value: initialNav.toString() }],
    description: def.description,
    minInvestment: def.minInvestment.toString(),
  };
}

/**
 * Создать все фонды из определений
 */
export function createAllFunds(): InvestmentFund[] {
  return FUND_DEFINITIONS.map(createFundFromDefinition);
}
