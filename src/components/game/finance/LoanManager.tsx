/**
 * LoanManager - Управление кредитами
 * Оформление новых кредитов и управление существующими
 */

import { useState, useEffect } from 'react';
import { useFinanceStore } from '../../../features/financeStore';
import { useAdvisorStore } from '../../../features/advisorStore';
import { formatNumber, D } from '../../../core/math/format';
import { LOAN_PRODUCTS, calculateInterestRate, calculateMaxLoanAmount } from '../../../core/constants/funds';
import { formatLoanSummary, generatePaymentSchedule } from '../../../utils/loanCalculator';
import { getCreditScoreCategory, getCreditScoreCategoryName, getCreditScoreColor } from '../../../core/gameTypes.finance';

export function LoanManager() {
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [loanAmount, setLoanAmount] = useState('');
  const [showSchedule, setShowSchedule] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<Record<string, string>>({});
  
  const {
    loans,
    creditScore,
    maxLoanCapacity,
    takeLoan,
    makePayment,
    payOffLoan,
  } = useFinanceStore();
  
  const {
    myLoansAsBorrower,
    fetchMyP2PData,
    payP2PLoan,
  } = useAdvisorStore();
  
  const { bank, withdrawFromBank, depositToBank } = useFinanceStore();
  
  // Загружаем P2P данные при монтировании
  useEffect(() => {
    fetchMyP2PData();
  }, [fetchMyP2PData]);
  
  const activeLoans = loans.filter(l => l.status === 'active');
  const paidLoans = loans.filter(l => l.status === 'paid');
  const defaultedLoans = loans.filter(l => l.status === 'defaulted');
  
  // P2P кредиты (где я заёмщик)
  const activeP2PLoans = myLoansAsBorrower.filter(l => l.status === 'active');
  const paidP2PLoans = myLoansAsBorrower.filter(l => l.status === 'paid');
  const defaultedP2PLoans = myLoansAsBorrower.filter(l => l.status === 'defaulted');
  
  const handleTakeLoan = () => {
    if (!selectedProduct) return;
    
    const amount = D(loanAmount || '0');
    if (amount.lte(0)) return;
    
    const result = takeLoan(selectedProduct, amount);
    
    if (result.success) {
      setSelectedProduct(null);
      setLoanAmount('');
    } else {
      alert(result.error);
    }
  };
  
  const handleMakePayment = (loanId: string) => {
    const amount = D(paymentAmount[loanId] || '0');
    if (amount.lte(0)) return;
    
    const result = makePayment(loanId, amount);
    
    if (result.success) {
      setPaymentAmount(prev => ({ ...prev, [loanId]: '' }));
    } else {
      alert(result.error);
    }
  };
  
  const handlePayOff = (loanId: string) => {
    if (confirm('Погасить кредит досрочно?')) {
      const result = payOffLoan(loanId);
      if (!result.success) {
        alert(result.error);
      }
    }
  };
  
  // P2P платёж
  const handleP2PPayment = async (loanId: string) => {
    const amount = D(paymentAmount[loanId] || '0');
    if (amount.lte(0)) return;
    
    if (amount.gt(D(bank.balance))) {
      alert('❌ Недостаточно средств на банковском счёте');
      return;
    }
    
    // Списываем со счёта
    if (!withdrawFromBank(amount)) {
      alert('❌ Не удалось списать средства');
      return;
    }
    
    const result = await payP2PLoan(loanId, paymentAmount[loanId]);
    if (result.success) {
      setPaymentAmount(prev => ({ ...prev, [loanId]: '' }));
      alert(`✅ Платёж ${formatNumber(amount)} ₡ проведён успешно!`);
    } else {
      // Возвращаем деньги
      depositToBank(amount);
      alert(`❌ Ошибка: ${result.error}`);
    }
  };
  
  const categoryColor = getCreditScoreColor(getCreditScoreCategory(creditScore));
  
  return (
    <div className="space-y-4">
      {/* Кредитный рейтинг */}
      <div className="bg-slate-800 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bold">📊 Кредитный рейтинг</h3>
          <div className="text-right">
            <div className="text-2xl font-bold" style={{ color: categoryColor }}>
              {creditScore}
            </div>
            <div className="text-sm text-slate-400">
              {getCreditScoreCategoryName(getCreditScoreCategory(creditScore))}
            </div>
          </div>
        </div>
        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${((creditScore - 300) / (850 - 300)) * 100}%`,
              backgroundColor: categoryColor,
            }}
          />
        </div>
        <div className="flex justify-between text-xs text-slate-500 mt-1">
          <span>300</span>
          <span>850</span>
        </div>
        <div className="mt-2 text-sm text-slate-400">
          Максимальная сумма кредита: <span className="text-white font-medium">
            {formatNumber(D(maxLoanCapacity))} ₡
          </span>
        </div>
      </div>
      
      {/* Новый кредит */}
      <div className="bg-slate-800 rounded-lg p-4">
        <h3 className="font-bold mb-4">💳 Оформить кредит</h3>
        
        {activeLoans.length >= 3 ? (
          <div className="text-center py-4 text-orange-400">
            Достигнут лимит активных кредитов (3)
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {LOAN_PRODUCTS.map(product => {
                const isAvailable = product.minCreditScore <= creditScore;
                const effectiveRate = calculateInterestRate(product.baseInterestRate, creditScore);
                const maxAmount = calculateMaxLoanAmount(product, creditScore);
                
                return (
                  <button
                    key={product.id}
                    onClick={() => isAvailable && setSelectedProduct(product.id)}
                    disabled={!isAvailable}
                    className={`p-3 rounded-lg text-left transition-all ${
                      selectedProduct === product.id
                        ? 'bg-blue-600 ring-2 ring-blue-400'
                        : isAvailable
                          ? 'bg-slate-700 hover:bg-slate-600'
                          : 'bg-slate-800 opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <div className="font-medium">{product.name}</div>
                    <div className="text-sm text-slate-300 mt-1">
                      {(effectiveRate * 100).toFixed(1)}% годовых
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      {product.termDays} дней • до {formatNumber(D(maxAmount))} ₡
                    </div>
                    {product.requiresCollateral && (
                      <div className="text-xs text-orange-400 mt-1">
                        Требуется залог
                      </div>
                    )}
                    {!isAvailable && (
                      <div className="text-xs text-red-400 mt-1">
                        Требуется рейтинг {product.minCreditScore}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            
            {selectedProduct && (
              <div className="flex gap-2">
                <input
                  type="number"
                  value={loanAmount}
                  onChange={(e) => setLoanAmount(e.target.value)}
                  placeholder="Сумма кредита"
                  className="flex-1 bg-slate-700 rounded px-3 py-2"
                />
                <button
                  onClick={handleTakeLoan}
                  disabled={!loanAmount || D(loanAmount).lte(0)}
                  className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 rounded font-medium"
                >
                  Оформить
                </button>
              </div>
            )}
          </>
        )}
      </div>
      
      {/* Активные кредиты */}
      {activeLoans.length > 0 && (
        <div className="bg-slate-800 rounded-lg p-4">
          <h3 className="font-bold mb-4">📋 Активные кредиты ({activeLoans.length})</h3>
          
          <div className="space-y-4">
            {activeLoans.map(loan => {
              const summary = formatLoanSummary(loan);
              const schedule = showSchedule === loan.id ? generatePaymentSchedule(loan) : [];
              
              return (
                <div key={loan.id} className="bg-slate-700 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="font-medium">
                        Кредит #{loan.id.slice(-6)}
                      </div>
                      <div className="text-sm text-slate-400">
                        {(loan.interestRate * 100).toFixed(1)}% годовых • {loan.termDays} дней
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-orange-400">
                        {formatNumber(D(summary.totalRemaining))} ₡
                      </div>
                      <div className="text-sm text-slate-400">
                        осталось выплатить
                      </div>
                    </div>
                  </div>
                  
                  {/* Прогресс */}
                  <div className="mb-3">
                    <div className="flex justify-between text-sm mb-1">
                      <span>Прогресс</span>
                      <span>{summary.progressPercent.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 bg-slate-600 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full"
                        style={{ width: `${summary.progressPercent}%` }}
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 text-sm mb-3">
                    <div className="text-center">
                      <div className="text-slate-400">Ежемесячный платёж</div>
                      <div className="font-medium">{formatNumber(D(loan.monthlyPayment))} ₡</div>
                    </div>
                    <div className="text-center">
                      <div className="text-slate-400">Дней до окончания</div>
                      <div className="font-medium">{summary.daysRemaining}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-slate-400">Пропущено платежей</div>
                      <div className={`font-medium ${loan.missedPayments > 0 ? 'text-red-400' : ''}`}>
                        {loan.missedPayments}
                      </div>
                    </div>
                  </div>
                  
                  {/* Действия */}
                  <div className="flex gap-2 mb-2">
                    <input
                      type="number"
                      value={paymentAmount[loan.id] || ''}
                      onChange={(e) => setPaymentAmount(prev => ({ ...prev, [loan.id]: e.target.value }))}
                      placeholder="Сумма платежа"
                      className="flex-1 bg-slate-600 rounded px-3 py-2 text-sm"
                    />
                    <button
                      onClick={() => handleMakePayment(loan.id)}
                      disabled={!paymentAmount[loan.id]}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 rounded text-sm"
                    >
                      Оплатить
                    </button>
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPaymentAmount(prev => ({ ...prev, [loan.id]: loan.monthlyPayment }))}
                      className="flex-1 py-2 bg-slate-600 hover:bg-slate-500 rounded text-sm"
                    >
                      Ежемесячный платёж
                    </button>
                    <button
                      onClick={() => handlePayOff(loan.id)}
                      className="flex-1 py-2 bg-green-600 hover:bg-green-700 rounded text-sm"
                    >
                      Погасить досрочно
                    </button>
                    <button
                      onClick={() => setShowSchedule(showSchedule === loan.id ? null : loan.id)}
                      className="px-4 py-2 bg-slate-600 hover:bg-slate-500 rounded text-sm"
                    >
                      📅
                    </button>
                  </div>
                  
                  {/* График платежей */}
                  {showSchedule === loan.id && schedule.length > 0 && (
                    <div className="mt-3 bg-slate-600 rounded p-3 max-h-48 overflow-y-auto">
                      <div className="text-sm font-medium mb-2">График платежей</div>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-slate-400">
                            <th className="text-left py-1">Дата</th>
                            <th className="text-right py-1">Платёж</th>
                            <th className="text-right py-1">Основной долг</th>
                            <th className="text-right py-1">Проценты</th>
                            <th className="text-right py-1">Остаток</th>
                          </tr>
                        </thead>
                        <tbody>
                          {schedule.slice(0, 12).map((payment, idx) => (
                            <tr key={idx} className="border-t border-slate-500">
                              <td className="py-1">
                                {new Date(payment.date).toLocaleDateString()}
                              </td>
                              <td className="text-right">{formatNumber(D(payment.amount))}</td>
                              <td className="text-right">{formatNumber(D(payment.principalPart))}</td>
                              <td className="text-right text-orange-400">
                                {formatNumber(D(payment.interestPart))}
                              </td>
                              <td className="text-right">{formatNumber(D(payment.remainingAfter))}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      {/* P2P Кредиты (я заёмщик) */}
      {activeP2PLoans.length > 0 && (
        <div className="bg-slate-800 rounded-lg p-4">
          <h3 className="font-bold mb-4 flex items-center gap-2">
            💱 P2P Кредиты ({activeP2PLoans.length})
            <span className="text-xs font-normal text-slate-400">где вы заёмщик</span>
          </h3>
          
          <div className="space-y-4">
            {activeP2PLoans.map(loan => {
              const principal = D(loan.principal);
              const remaining = D(loan.remainingBalance);
              const progress = principal.gt(0) 
                ? principal.minus(remaining).div(principal).mul(100).toNumber() 
                : 0;
              const daysLeft = Math.max(0, Math.ceil((loan.dueDate - Date.now()) / (1000 * 60 * 60 * 24)));
              
              return (
                <div key={loan.id} className="bg-slate-700 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        P2P Кредит #{loan.id.slice(-6)}
                        <span className="text-xs px-2 py-0.5 bg-purple-600/30 text-purple-400 rounded">
                          от {loan.lenderName || 'Кредитора'}
                        </span>
                      </div>
                      <div className="text-sm text-slate-400">
                        {(loan.interestRate * 100).toFixed(1)}% годовых • {loan.termDays} дней
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-orange-400">
                        {formatNumber(remaining)} ₡
                      </div>
                      <div className="text-sm text-slate-400">
                        осталось выплатить
                      </div>
                    </div>
                  </div>
                  
                  {/* Прогресс */}
                  <div className="mb-3">
                    <div className="flex justify-between text-sm mb-1">
                      <span>Прогресс</span>
                      <span>{progress.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 bg-slate-600 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-500 rounded-full"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 text-sm mb-3">
                    <div className="text-center">
                      <div className="text-slate-400">Сумма кредита</div>
                      <div className="font-medium">{formatNumber(principal)} ₡</div>
                    </div>
                    <div className="text-center">
                      <div className="text-slate-400">Дней до окончания</div>
                      <div className={`font-medium ${daysLeft <= 3 ? 'text-red-400' : ''}`}>{daysLeft}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-slate-400">Выплачено %</div>
                      <div className="font-medium text-green-400">
                        {formatNumber(D(loan.interestPaid))} ₡
                      </div>
                    </div>
                  </div>
                  
                  {/* Просрочка */}
                  {loan.daysOverdue > 0 && (
                    <div className="mb-3 p-2 bg-red-900/30 rounded text-sm text-red-400">
                      ⚠️ Просрочено: {loan.daysOverdue} дней
                    </div>
                  )}
                  
                  {/* Действия */}
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={paymentAmount[loan.id] || ''}
                      onChange={(e) => setPaymentAmount(prev => ({ ...prev, [loan.id]: e.target.value }))}
                      placeholder="Сумма платежа"
                      className="flex-1 bg-slate-600 rounded px-3 py-2 text-sm"
                    />
                    <button
                      onClick={() => handleP2PPayment(loan.id)}
                      disabled={!paymentAmount[loan.id]}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-600 rounded text-sm"
                    >
                      Оплатить
                    </button>
                  </div>
                  
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => setPaymentAmount(prev => ({ ...prev, [loan.id]: loan.remainingBalance }))}
                      className="flex-1 py-2 bg-green-600 hover:bg-green-700 rounded text-sm"
                    >
                      Погасить полностью ({formatNumber(remaining)} ₡)
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      {/* История кредитов */}
      {(paidLoans.length > 0 || defaultedLoans.length > 0 || paidP2PLoans.length > 0 || defaultedP2PLoans.length > 0) && (
        <div className="bg-slate-800 rounded-lg p-4">
          <h3 className="font-bold mb-4">📜 История кредитов</h3>
          
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {/* Банковские кредиты */}
            {paidLoans.map(loan => (
              <div key={loan.id} className="flex justify-between items-center bg-slate-700/50 rounded p-2">
                <div>
                  <span className="text-green-400">✓</span>
                  <span className="ml-2">Кредит #{loan.id.slice(-6)}</span>
                </div>
                <div className="text-sm text-slate-400">
                  {formatNumber(D(loan.principal))} ₡ • Выплачен
                </div>
              </div>
            ))}
            
            {defaultedLoans.map(loan => (
              <div key={loan.id} className="flex justify-between items-center bg-red-900/30 rounded p-2">
                <div>
                  <span className="text-red-400">✗</span>
                  <span className="ml-2">Кредит #{loan.id.slice(-6)}</span>
                </div>
                <div className="text-sm text-red-400">
                  {formatNumber(D(loan.principal))} ₡ • Дефолт
                </div>
              </div>
            ))}
            
            {/* P2P кредиты */}
            {paidP2PLoans.map(loan => (
              <div key={loan.id} className="flex justify-between items-center bg-purple-900/30 rounded p-2">
                <div>
                  <span className="text-green-400">✓</span>
                  <span className="ml-2">P2P #{loan.id.slice(-6)}</span>
                  <span className="text-xs text-purple-400 ml-1">от {loan.lenderName || 'Кредитора'}</span>
                </div>
                <div className="text-sm text-slate-400">
                  {formatNumber(D(loan.principal))} ₡ • Выплачен
                </div>
              </div>
            ))}
            
            {defaultedP2PLoans.map(loan => (
              <div key={loan.id} className="flex justify-between items-center bg-red-900/30 rounded p-2">
                <div>
                  <span className="text-red-400">✗</span>
                  <span className="ml-2">P2P #{loan.id.slice(-6)}</span>
                  <span className="text-xs text-purple-400 ml-1">от {loan.lenderName || 'Кредитора'}</span>
                </div>
                <div className="text-sm text-red-400">
                  {formatNumber(D(loan.principal))} ₡ • Дефолт
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
