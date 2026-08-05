/**
 * LoanManager - Управление кредитами
 * Оформление новых кредитов и управление существующими
 */

import { memo, useState, useEffect } from 'react';
import { useFinanceStore } from '../../../features/financeStore';
import { useAdvisorStore } from '../../../features/advisorStore';
import { useGameStore } from '../../../features/gameStore';
import { formatNumber, D } from '../../../core/math/format';
import { LOAN_PRODUCTS, calculateInterestRate, calculateMaxLoanAmount } from '../../../core/constants/funds';
import { formatLoanSummary, generatePaymentSchedule } from '../../../utils/loanCalculator';
import { getCreditScoreCategory, getCreditScoreCategoryName, getCreditScoreColor } from '../../../core/gameTypes.finance';
import { Alert, Badge, Meter, Panel, Stat } from '../../ui';
import { GameIcon } from '../../ui/icons';

// memo: родительская FinancePanel рендерится на каждый тик, пропсов у компонента нет.
export const LoanManager = memo(LoanManagerImpl);

function LoanManagerImpl() {
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [loanAmount, setLoanAmount] = useState('');
  const [showSchedule, setShowSchedule] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<Record<string, string>>({});

  // Точечные подписки: раньше компонент дважды вызывал `useFinanceStore()` без
  // селектора и перерисовывался на каждый set() стора (в т.ч. на тик цен акций).
  const loans = useFinanceStore((s) => s.loans);
  const creditScore = useFinanceStore((s) => s.creditScore);
  const maxLoanCapacity = useFinanceStore((s) => s.maxLoanCapacity);
  const takeLoan = useFinanceStore((s) => s.takeLoan);
  const makePayment = useFinanceStore((s) => s.makePayment);
  const payOffLoan = useFinanceStore((s) => s.payOffLoan);

  const myLoansAsBorrower = useAdvisorStore((s) => s.myLoansAsBorrower);
  const fetchMyP2PData = useAdvisorStore((s) => s.fetchMyP2PData);
  const payP2PLoan = useAdvisorStore((s) => s.payP2PLoan);

  /*
   * Кредиты — банковские и P2P — работают с игровыми кредитами (см. registerGameCreditsAdapter
   * в gameStore). Раньше платежи списывались с расчётного счёта биржи, куда игрок деньги
   * не кладёт.
   */
  const gameCredits = useGameStore((s) => s.currency.credits);

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

    if (amount.gt(gameCredits)) {
      alert('❌ Недостаточно кредитов колонии');
      return;
    }

    // Списываем кредиты колонии одним set: тик тоже меняет баланс.
    let debited = false;
    useGameStore.setState((s) => {
      if (s.currency.credits.lt(amount)) return s;
      debited = true;
      return { currency: { ...s.currency, credits: s.currency.credits.sub(amount) } };
    });
    if (!debited) {
      alert('❌ Не удалось списать средства');
      return;
    }

    const result = await payP2PLoan(loanId, paymentAmount[loanId]);
    if (result.success) {
      setPaymentAmount(prev => ({ ...prev, [loanId]: '' }));
      alert(`✅ Платёж ${formatNumber(amount)} ₡ проведён успешно!`);
    } else {
      // Возвращаем деньги
      useGameStore.setState((s) => ({
        currency: { ...s.currency, credits: s.currency.credits.add(amount) },
      }));
      alert(`❌ Ошибка: ${result.error}`);
    }
  };

  const categoryColor = getCreditScoreColor(getCreditScoreCategory(creditScore));

  return (
    <div className="space-y-4">
      {/* Кредитный рейтинг */}
      <Panel title="📊 Кредитный рейтинг">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-slate-400">
            {getCreditScoreCategoryName(getCreditScoreCategory(creditScore))}
          </span>
          <div className="font-mono text-2xl font-bold tabular-nums" style={{ color: categoryColor }}>
            {creditScore}
          </div>
        </div>
        {/*
          Цвет заливки приходит из getCreditScoreColor() как произвольный hex, а <Meter>
          принимает только фиксированный набор тонов — поэтому берём CSS-примитивы
          .meter/.meter-fill и красим заливку инлайном.
        */}
        <div className="meter">
          <div
            className="meter-fill"
            style={{
              width: `${((creditScore - 300) / (850 - 300)) * 100}%`,
              backgroundColor: categoryColor,
            }}
          />
        </div>
        <div className="flex justify-between text-xs text-slate-500 mt-1 font-mono tabular-nums">
          <span>300</span>
          <span>850</span>
        </div>
        <div className="mt-2 text-sm text-slate-400">
          Максимальная сумма кредита: <span className="text-white font-mono font-medium tabular-nums">
            {formatNumber(D(maxLoanCapacity))} ₡
          </span>
        </div>
      </Panel>

      {/* Новый кредит */}
      <Panel title="💳 Оформить кредит">
        {activeLoans.length >= 3 ? (
          <Alert tone="warning">Достигнут лимит активных кредитов (3)</Alert>
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
                    type="button"
                    onClick={() => isAvailable && setSelectedProduct(product.id)}
                    disabled={!isAvailable}
                    className={`card text-left ${
                      selectedProduct === product.id
                        ? 'border-accent ring-1 ring-accent'
                        : isAvailable
                          ? 'card-interactive'
                          : 'opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <div className="font-medium">{product.name}</div>
                    <div className="text-sm text-slate-300 mt-1 font-mono tabular-nums">
                      {(effectiveRate * 100).toFixed(1)}% годовых
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      <span className="font-mono tabular-nums">{product.termDays}</span> дней • до{' '}
                      <span className="font-mono tabular-nums">{formatNumber(D(maxAmount))}</span> ₡
                    </div>
                    {product.requiresCollateral && (
                      <div className="text-xs text-orange-400 mt-1">
                        Требуется залог
                      </div>
                    )}
                    {!isAvailable && (
                      <div className="text-xs text-red-400 mt-1">
                        Требуется рейтинг <span className="font-mono tabular-nums">{product.minCreditScore}</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {selectedProduct && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={loanAmount}
                    onChange={(e) => setLoanAmount(e.target.value)}
                    placeholder="Сумма кредита"
                    className="flex-1 px-3 py-2"
                  />
                  <button
                    type="button"
                    onClick={handleTakeLoan}
                    disabled={!loanAmount || D(loanAmount).lte(0)}
                    className="btn-primary"
                  >
                    Оформить
                  </button>
                </div>
                {/* Явно говорим, куда придут деньги: раньше сумма молча уходила на
                    расчётный счёт, и это читалось как «кредит не зачислился». */}
                <div className="text-xs text-slate-400">
                  Сумма придёт сразу в кредиты колонии (баланс в верхней панели). Платежи
                  списываются оттуда же.
                </div>
              </div>
            )}
          </>
        )}
      </Panel>

      {/* Активные кредиты */}
      {activeLoans.length > 0 && (
        <Panel title={`📋 Активные кредиты (${activeLoans.length})`}>
          <div className="space-y-4">
            {activeLoans.map(loan => {
              const summary = formatLoanSummary(loan);
              const schedule = showSchedule === loan.id ? generatePaymentSchedule(loan) : [];

              return (
                <div key={loan.id} className="card">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="font-medium">
                        Кредит #<span className="font-mono">{loan.id.slice(-6)}</span>
                      </div>
                      <div className="text-sm text-slate-400 font-mono tabular-nums">
                        {(loan.interestRate * 100).toFixed(1)}% годовых • {loan.termDays} дней
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-lg font-bold tabular-nums text-orange-400">
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
                      <span className="font-mono tabular-nums">{summary.progressPercent.toFixed(1)}%</span>
                    </div>
                    <Meter value={summary.progressPercent} max={100} tone="accent" />
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <Stat
                      label="Ежемесячный платёж"
                      value={`${formatNumber(D(loan.monthlyPayment))} ₡`}
                      align="center"
                    />
                    <Stat label="Дней до окончания" value={summary.daysRemaining} align="center" />
                    <Stat
                      label="Пропущено платежей"
                      value={loan.missedPayments}
                      tone={loan.missedPayments > 0 ? 'danger' : 'neutral'}
                      align="center"
                    />
                  </div>

                  {/* Действия */}
                  <div className="flex gap-2 mb-2">
                    <input
                      type="number"
                      value={paymentAmount[loan.id] || ''}
                      onChange={(e) => setPaymentAmount(prev => ({ ...prev, [loan.id]: e.target.value }))}
                      placeholder="Сумма платежа"
                      className="flex-1 px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => handleMakePayment(loan.id)}
                      disabled={!paymentAmount[loan.id]}
                      className="btn-info"
                    >
                      Оплатить
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentAmount(prev => ({ ...prev, [loan.id]: loan.monthlyPayment }))}
                      className="btn flex-1"
                    >
                      Ежемесячный платёж
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePayOff(loan.id)}
                      className="btn-primary flex-1"
                    >
                      Погасить досрочно
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowSchedule(showSchedule === loan.id ? null : loan.id)}
                      aria-label="График платежей"
                      className="btn"
                    >
                      <GameIcon icon="📅" />
                    </button>
                  </div>

                  {/* График платежей */}
                  {showSchedule === loan.id && schedule.length > 0 && (
                    <div className="mt-3 rounded-lg border border-edge">
                      <div className="border-b border-edge px-2 py-1.5 text-sm font-medium">График платежей</div>
                      <div className="max-h-48 overflow-y-auto">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th className="text-left">Дата</th>
                            <th className="text-right">Платёж</th>
                            <th className="text-right">Основной долг</th>
                            <th className="text-right">Проценты</th>
                            <th className="text-right">Остаток</th>
                          </tr>
                        </thead>
                        <tbody>
                          {schedule.slice(0, 12).map((payment, idx) => (
                            <tr key={idx}>
                              <td className="font-mono tabular-nums">
                                {new Date(payment.date).toLocaleDateString()}
                              </td>
                              <td className="text-right font-mono tabular-nums">{formatNumber(D(payment.amount))}</td>
                              <td className="text-right font-mono tabular-nums">{formatNumber(D(payment.principalPart))}</td>
                              <td className="text-right font-mono tabular-nums text-orange-400">
                                {formatNumber(D(payment.interestPart))}
                              </td>
                              <td className="text-right font-mono tabular-nums">{formatNumber(D(payment.remainingAfter))}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      {/* P2P Кредиты (я заёмщик) */}
      {activeP2PLoans.length > 0 && (
        <Panel
          title={`💱 P2P Кредиты (${activeP2PLoans.length})`}
          subtitle="где вы заёмщик"
        >
          <div className="space-y-4">
            {activeP2PLoans.map(loan => {
              const principal = D(loan.principal);
              const remaining = D(loan.remainingBalance);
              const progress = principal.gt(0)
                ? principal.minus(remaining).div(principal).mul(100).toNumber()
                : 0;
              const daysLeft = Math.max(0, Math.ceil((loan.dueDate - Date.now()) / (1000 * 60 * 60 * 24)));

              return (
                <div key={loan.id} className="card">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        P2P Кредит #<span className="font-mono">{loan.id.slice(-6)}</span>
                        <span className="text-xs px-2 py-0.5 bg-purple-600/30 text-purple-400 rounded">
                          от {loan.lenderName || 'Кредитора'}
                        </span>
                      </div>
                      <div className="text-sm text-slate-400 font-mono tabular-nums">
                        {(loan.interestRate * 100).toFixed(1)}% годовых • {loan.termDays} дней
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-lg font-bold tabular-nums text-orange-400">
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
                      <span className="font-mono tabular-nums">{progress.toFixed(1)}%</span>
                    </div>
                    {/* .meter/.meter-fill вместо самодельной дорожки; фиолетовый цвет P2P
                        сохраняем, у <Meter> такого тона нет. */}
                    <div className="meter">
                      <div className="meter-fill bg-purple-500" style={{ width: `${progress}%` }} />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <Stat label="Сумма кредита" value={`${formatNumber(principal)} ₡`} align="center" />
                    <Stat
                      label="Дней до окончания"
                      value={daysLeft}
                      tone={daysLeft <= 3 ? 'danger' : 'neutral'}
                      align="center"
                    />
                    <Stat
                      label="Выплачено %"
                      value={`${formatNumber(D(loan.interestPaid))} ₡`}
                      tone="accent"
                      align="center"
                    />
                  </div>

                  {/* Просрочка */}
                  {loan.daysOverdue > 0 && (
                    <div className="mb-3">
                      <Alert tone="danger"><GameIcon icon="⚠️" /> Просрочено: {loan.daysOverdue} дней</Alert>
                    </div>
                  )}

                  {/* Действия */}
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={paymentAmount[loan.id] || ''}
                      onChange={(e) => setPaymentAmount(prev => ({ ...prev, [loan.id]: e.target.value }))}
                      placeholder="Сумма платежа"
                      className="flex-1 px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => handleP2PPayment(loan.id)}
                      disabled={!paymentAmount[loan.id]}
                      className="btn"
                    >
                      Оплатить
                    </button>
                  </div>

                  <div className="flex gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => setPaymentAmount(prev => ({ ...prev, [loan.id]: loan.remainingBalance }))}
                      className="btn-primary flex-1"
                    >
                      Погасить полностью ({formatNumber(remaining)} ₡)
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      {/* История кредитов */}
      {(paidLoans.length > 0 || defaultedLoans.length > 0 || paidP2PLoans.length > 0 || defaultedP2PLoans.length > 0) && (
        <Panel title="📜 История кредитов">
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {/* Банковские кредиты */}
            {paidLoans.map(loan => (
              <div key={loan.id} className="flex justify-between items-center card py-2">
                <div>
                  <span className="text-green-400"><GameIcon icon="✓" /></span>
                  <span className="ml-2">Кредит #<span className="font-mono">{loan.id.slice(-6)}</span></span>
                </div>
                <div className="text-sm text-slate-400">
                  <span className="font-mono tabular-nums">{formatNumber(D(loan.principal))}</span> ₡ • Выплачен
                </div>
              </div>
            ))}

            {defaultedLoans.map(loan => (
              <div key={loan.id} className="flex justify-between items-center card py-2 border-danger/40 bg-danger/10">
                <div>
                  <span className="text-red-400"><GameIcon icon="✗" /></span>
                  <span className="ml-2">Кредит #<span className="font-mono">{loan.id.slice(-6)}</span></span>
                </div>
                <div className="text-sm text-red-400">
                  <span className="font-mono tabular-nums">{formatNumber(D(loan.principal))}</span> ₡ • Дефолт
                </div>
              </div>
            ))}

            {/* P2P кредиты */}
            {paidP2PLoans.map(loan => (
              <div key={loan.id} className="flex justify-between items-center card py-2 border-purple-500/30">
                <div>
                  <span className="text-green-400"><GameIcon icon="✓" /></span>
                  <span className="ml-2">P2P #<span className="font-mono">{loan.id.slice(-6)}</span></span>
                  <Badge className="ml-1 text-purple-400">от {loan.lenderName || 'Кредитора'}</Badge>
                </div>
                <div className="text-sm text-slate-400">
                  <span className="font-mono tabular-nums">{formatNumber(D(loan.principal))}</span> ₡ • Выплачен
                </div>
              </div>
            ))}

            {defaultedP2PLoans.map(loan => (
              <div key={loan.id} className="flex justify-between items-center card py-2 border-danger/40 bg-danger/10">
                <div>
                  <span className="text-red-400"><GameIcon icon="✗" /></span>
                  <span className="ml-2">P2P #<span className="font-mono">{loan.id.slice(-6)}</span></span>
                  <Badge className="ml-1 text-purple-400">от {loan.lenderName || 'Кредитора'}</Badge>
                </div>
                <div className="text-sm text-red-400">
                  <span className="font-mono tabular-nums">{formatNumber(D(loan.principal))}</span> ₡ • Дефолт
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
