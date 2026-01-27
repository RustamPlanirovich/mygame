/**
 * Калькулятор кредитов
 * Фаза 6: Расчёт платежей, процентов и управление кредитами
 */

import Decimal from 'break_eternity.js';
import type { 
  Loan, 
  LoanPayment, 
  LoanProduct, 
  LoanCollateral,
  CreditScoreEvent
} from '../core/gameTypes.finance';
import { FINANCE_CONFIG } from '../core/gameTypes.finance';
import { D } from '../core/math/format';

/**
 * Генерирует уникальный ID для кредита
 */
function generateLoanId(): string {
  return `loan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Рассчитывает ежемесячный платёж по кредиту (аннуитет)
 * @param principal Сумма кредита
 * @param annualRate Годовая процентная ставка
 * @param termDays Срок кредита в днях
 * @returns Ежемесячный платёж
 */
export function calculateMonthlyPayment(
  principal: Decimal,
  annualRate: number,
  termDays: number
): Decimal {
  // Количество платежей (считаем месяц = 30 дней)
  const numberOfPayments = Math.ceil(termDays / 30);
  
  if (numberOfPayments <= 0) return principal;
  
  // Месячная ставка
  const monthlyRate = annualRate / 12;
  
  if (monthlyRate === 0) {
    // Беспроцентный кредит
    return principal.div(numberOfPayments);
  }
  
  // Формула аннуитета: P * (r * (1 + r)^n) / ((1 + r)^n - 1)
  const onePlusR = 1 + monthlyRate;
  const onePlusRtoN = Math.pow(onePlusR, numberOfPayments);
  
  const numerator = principal.mul(monthlyRate * onePlusRtoN);
  const denominator = onePlusRtoN - 1;
  
  return numerator.div(denominator);
}

/**
 * Рассчитывает общую сумму к выплате
 */
export function calculateTotalPayment(
  principal: Decimal,
  annualRate: number,
  termDays: number
): Decimal {
  const monthlyPayment = calculateMonthlyPayment(principal, annualRate, termDays);
  const numberOfPayments = Math.ceil(termDays / 30);
  return monthlyPayment.mul(numberOfPayments);
}

/**
 * Рассчитывает общую сумму процентов
 */
export function calculateTotalInterest(
  principal: Decimal,
  annualRate: number,
  termDays: number
): Decimal {
  const totalPayment = calculateTotalPayment(principal, annualRate, termDays);
  return totalPayment.sub(principal);
}

/**
 * Создаёт новый кредит
 */
export function createLoan(
  product: LoanProduct,
  amount: Decimal,
  effectiveRate: number,
  collateral?: LoanCollateral
): Loan {
  const now = Date.now();
  const termMs = product.termDays * 24 * 60 * 60 * 1000;
  const monthMs = 30 * 24 * 60 * 60 * 1000;
  
  const monthlyPayment = calculateMonthlyPayment(amount, effectiveRate, product.termDays);
  const totalPayment = calculateTotalPayment(amount, effectiveRate, product.termDays);
  
  return {
    id: generateLoanId(),
    principal: amount.toString(),
    interestRate: effectiveRate,
    termDays: product.termDays,
    remainingBalance: totalPayment.toString(),
    monthlyPayment: monthlyPayment.toString(),
    startDate: now,
    dueDate: now + termMs,
    nextPaymentDate: now + monthMs,
    status: 'active',
    collateral,
    missedPayments: 0,
    paymentHistory: [],
  };
}

/**
 * Обрабатывает платёж по кредиту
 */
export function processLoanPayment(loan: Loan, paymentAmount: Decimal): {
  updatedLoan: Loan;
  payment: LoanPayment;
  isFullyPaid: boolean;
} {
  const remainingBalance = D(loan.remainingBalance);
  const monthlyPayment = D(loan.monthlyPayment);
  
  // Рассчитываем, сколько идёт на проценты и основной долг
  // Для упрощения: проценты = остаток * месячная ставка
  const monthlyRate = loan.interestRate / 12;
  const interestPart = remainingBalance.mul(monthlyRate);
  const principalPart = paymentAmount.sub(interestPart);
  
  // Новый остаток
  let newRemainingBalance = remainingBalance.sub(paymentAmount);
  if (newRemainingBalance.lt(0)) {
    newRemainingBalance = D(0);
  }
  
  const now = Date.now();
  const monthMs = 30 * 24 * 60 * 60 * 1000;
  
  const payment: LoanPayment = {
    date: now,
    amount: paymentAmount.toString(),
    principalPart: principalPart.gt(0) ? principalPart.toString() : '0',
    interestPart: interestPart.toString(),
    remainingAfter: newRemainingBalance.toString(),
  };
  
  const isFullyPaid = newRemainingBalance.lte(0);
  
  const updatedLoan: Loan = {
    ...loan,
    remainingBalance: newRemainingBalance.toString(),
    nextPaymentDate: isFullyPaid ? loan.nextPaymentDate : now + monthMs,
    status: isFullyPaid ? 'paid' : 'active',
    paymentHistory: [...loan.paymentHistory, payment],
  };
  
  return { updatedLoan, payment, isFullyPaid };
}

/**
 * Проверяет просроченные платежи
 */
export function checkMissedPayments(loan: Loan): {
  isMissed: boolean;
  isDefaulted: boolean;
  updatedLoan: Loan;
} {
  if (loan.status !== 'active') {
    return { isMissed: false, isDefaulted: false, updatedLoan: loan };
  }
  
  const now = Date.now();
  const isMissed = now > loan.nextPaymentDate;
  
  if (!isMissed) {
    return { isMissed: false, isDefaulted: false, updatedLoan: loan };
  }
  
  const newMissedPayments = loan.missedPayments + 1;
  const isDefaulted = newMissedPayments >= 3; // Дефолт после 3 просрочек
  
  const updatedLoan: Loan = {
    ...loan,
    missedPayments: newMissedPayments,
    status: isDefaulted ? 'defaulted' : 'active',
    // Штрафные проценты за просрочку
    remainingBalance: D(loan.remainingBalance).mul(1.05).toString(), // +5% штраф
  };
  
  return { isMissed, isDefaulted, updatedLoan };
}

/**
 * Рассчитывает досрочное погашение
 */
export function calculateEarlyPayoff(loan: Loan): {
  currentBalance: Decimal;
  earlyPayoffAmount: Decimal;
  savings: Decimal;
} {
  const remainingBalance = D(loan.remainingBalance);
  const monthlyPayment = D(loan.monthlyPayment);
  
  // Досрочное погашение = текущий остаток минус скидка за досрочное погашение
  // Обычно скидка = непогашенные будущие проценты
  const monthsRemaining = Math.ceil(
    (loan.dueDate - Date.now()) / (30 * 24 * 60 * 60 * 1000)
  );
  
  // Приблизительная экономия = 50% от оставшихся процентов
  const estimatedRemainingInterest = remainingBalance.mul(loan.interestRate / 12 * monthsRemaining);
  const earlyPayoffDiscount = estimatedRemainingInterest.mul(0.5);
  
  const earlyPayoffAmount = remainingBalance.sub(earlyPayoffDiscount);
  
  return {
    currentBalance: remainingBalance,
    earlyPayoffAmount,
    savings: earlyPayoffDiscount,
  };
}

/**
 * Обновляет кредитный рейтинг
 */
export function updateCreditScore(
  currentScore: number,
  event: Omit<CreditScoreEvent, 'timestamp'>
): { newScore: number; event: CreditScoreEvent } {
  const now = Date.now();
  let newScore = currentScore + event.change;
  
  // Ограничиваем рейтинг
  newScore = Math.max(FINANCE_CONFIG.MIN_CREDIT_SCORE, newScore);
  newScore = Math.min(FINANCE_CONFIG.MAX_CREDIT_SCORE, newScore);
  
  return {
    newScore,
    event: {
      ...event,
      timestamp: now,
    },
  };
}

/**
 * Рассчитывает максимальную сумму кредита на основе активов и рейтинга
 */
export function calculateMaxLoanCapacity(
  creditScore: number,
  totalAssets: Decimal,
  existingDebt: Decimal
): Decimal {
  // Базовая сумма = рейтинг * 100
  const baseAmount = D(creditScore * 100);
  
  // Добавляем 50% от активов
  const assetBonus = totalAssets.mul(0.5);
  
  // Вычитаем существующий долг
  const maxAmount = baseAmount.add(assetBonus).sub(existingDebt);
  
  // Минимум 1000
  if (maxAmount.lt(1000)) {
    return D(1000);
  }
  
  return maxAmount;
}

/**
 * Проверяет, доступен ли кредитный продукт для игрока
 */
export function isLoanProductAvailable(
  product: LoanProduct,
  creditScore: number,
  activeLoans: number
): { available: boolean; reason?: string } {
  if (activeLoans >= FINANCE_CONFIG.MAX_ACTIVE_LOANS) {
    return { available: false, reason: 'Достигнут лимит активных кредитов' };
  }
  
  if (creditScore < product.minCreditScore) {
    return { 
      available: false, 
      reason: `Требуется кредитный рейтинг ${product.minCreditScore} (ваш: ${creditScore})` 
    };
  }
  
  return { available: true };
}

/**
 * Форматирует информацию о кредите
 */
export function formatLoanSummary(loan: Loan): {
  totalPaid: string;
  totalRemaining: string;
  progressPercent: number;
  daysRemaining: number;
  monthlyPaymentFormatted: string;
} {
  const principal = D(loan.principal);
  const remaining = D(loan.remainingBalance);
  const totalPayment = calculateTotalPayment(principal, loan.interestRate, loan.termDays);
  
  const totalPaid = totalPayment.sub(remaining);
  const progressPercent = totalPaid.div(totalPayment).mul(100).toNumber();
  
  const now = Date.now();
  const msRemaining = Math.max(0, loan.dueDate - now);
  const daysRemaining = Math.ceil(msRemaining / (24 * 60 * 60 * 1000));
  
  return {
    totalPaid: totalPaid.toString(),
    totalRemaining: remaining.toString(),
    progressPercent: Math.min(100, Math.max(0, progressPercent)),
    daysRemaining,
    monthlyPaymentFormatted: loan.monthlyPayment,
  };
}

/**
 * Генерирует график платежей
 */
export function generatePaymentSchedule(loan: Loan): LoanPayment[] {
  const schedule: LoanPayment[] = [];
  const monthlyPayment = D(loan.monthlyPayment);
  let remainingBalance = D(loan.remainingBalance);
  let currentDate = loan.startDate;
  const monthMs = 30 * 24 * 60 * 60 * 1000;
  const monthlyRate = loan.interestRate / 12;
  
  while (remainingBalance.gt(0) && schedule.length < 100) {
    const interestPart = remainingBalance.mul(monthlyRate);
    let principalPart = monthlyPayment.sub(interestPart);
    
    // Последний платёж может быть меньше
    if (principalPart.gt(remainingBalance.sub(interestPart))) {
      principalPart = remainingBalance.sub(interestPart);
    }
    
    const payment = principalPart.add(interestPart);
    remainingBalance = remainingBalance.sub(payment);
    
    if (remainingBalance.lt(0)) {
      remainingBalance = D(0);
    }
    
    currentDate += monthMs;
    
    schedule.push({
      date: currentDate,
      amount: payment.toString(),
      principalPart: principalPart.toString(),
      interestPart: interestPart.toString(),
      remainingAfter: remainingBalance.toString(),
    });
  }
  
  return schedule;
}
