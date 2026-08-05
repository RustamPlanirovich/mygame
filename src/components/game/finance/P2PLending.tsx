/**
 * P2PLending - P2P Кредитование
 * Глобальный рынок кредитов между игроками
 */

import { memo, useState, useEffect } from 'react';
import { useAdvisorStore } from '../../../features/advisorStore';
import { useFinanceStore } from '../../../features/financeStore';
import { formatNumber, D } from '../../../core/math/format';
import { P2P_LENDING_CONFIG } from '../../../core/gameTypes.ai';
import type { P2PLoanOffer, P2PLoan } from '../../../core/gameTypes.ai';
import { EmptyState, Field, Panel, Stat, Tabs, type TabItem } from '../../ui';
import { GameIcon } from '../../ui/icons';

type P2PTab = 'market' | 'my-offers' | 'as-lender' | 'as-borrower' | 'create';

// memo: родительская FinancePanel рендерится на каждый тик, пропсов у компонента нет.
export const P2PLending = memo(P2PLendingImpl);

function P2PLendingImpl() {
  const [activeTab, setActiveTab] = useState<P2PTab>('market');
  const [createForm, setCreateForm] = useState({
    amount: '10000',
    interestRate: 10,
    termDays: 30,
    minCreditScore: 500,
  });

  const {
    p2pOffers,
    myP2POffers,
    myLoansAsLender,
    myLoansAsBorrower,
    p2pStats,
    fetchP2POffers,
    fetchMyP2PData,
    fetchP2PStats,
    createP2POffer,
    cancelP2POffer,
    borrowP2P,
    payP2PLoan,
  } = useAdvisorStore();

  // Точечные подписки: раньше `useFinanceStore()` будил всю панель P2P на каждый
  // set() финансового стора (тик цен акций, начисление процентов и т.д.).
  const creditScore = useFinanceStore((s) => s.creditScore);
  const bankBalance = useFinanceStore((s) => s.bank.balance);
  const withdrawFromBank = useFinanceStore((s) => s.withdrawFromBank);
  const depositToBank = useFinanceStore((s) => s.depositToBank);

  // Загрузка данных
  useEffect(() => {
    fetchP2POffers();
    fetchMyP2PData();
    fetchP2PStats();
  }, [fetchP2POffers, fetchMyP2PData, fetchP2PStats]);

  const handleCreateOffer = async () => {
    // Проверяем баланс
    const amount = D(createForm.amount);
    if (amount.gt(D(bankBalance))) {
      alert('❌ Недостаточно средств на банковском счёте');
      return;
    }

    // Списываем со счёта
    if (!withdrawFromBank(amount)) {
      alert('❌ Не удалось списать средства');
      return;
    }

    const result = await createP2POffer(
      createForm.amount,
      createForm.interestRate / 100,
      createForm.termDays,
      createForm.minCreditScore
    );

    if (result.success) {
      alert(`✅ Оффер создан! ${formatNumber(amount)} ₡ заблокировано до взятия кредита или отмены.`);
      setActiveTab('my-offers');
    } else {
      // Возвращаем деньги
      depositToBank(amount);
      alert(`❌ Ошибка: ${result.error}`);
    }
  };

  const handleCancelOffer = async (offer: P2PLoanOffer) => {
    const success = await cancelP2POffer(offer.id);
    if (success) {
      // Возвращаем деньги на счёт
      depositToBank(D(offer.amount));
      alert(`✅ Оффер отменён. ${formatNumber(D(offer.amount))} ₡ возвращено на счёт.`);
    } else {
      alert('❌ Не удалось отменить оффер');
    }
  };

  const handleBorrow = async (offer: P2PLoanOffer) => {
    if (creditScore < offer.minCreditScore) {
      alert(`❌ Ваш кредитный рейтинг (${creditScore}) ниже требуемого (${offer.minCreditScore})`);
      return;
    }

    const result = await borrowP2P(offer.id, creditScore);
    if (result.success) {
      // Зачисляем деньги на счёт (за вычетом комиссии)
      depositToBank(D(result.amountReceived || '0'));
      alert(
        `✅ Кредит получен! ${formatNumber(D(result.amountReceived || '0'))} ₡ зачислено на банковский счёт.`
      );
      setActiveTab('as-borrower');
    } else {
      alert(`❌ Ошибка: ${result.error}`);
    }
  };

  const handlePayLoan = async (loan: P2PLoan, amount: string) => {
    const payAmount = D(amount);
    if (payAmount.gt(D(bankBalance))) {
      alert('❌ Недостаточно средств на банковском счёте');
      return;
    }

    // Списываем со счёта
    if (!withdrawFromBank(payAmount)) {
      alert('❌ Не удалось списать средства');
      return;
    }

    const result = await payP2PLoan(loan.id, amount);
    if (result.success) {
      alert(`✅ Платёж ${formatNumber(payAmount)} ₡ проведён успешно!`);
    } else {
      // Возвращаем деньги
      depositToBank(payAmount);
      alert(`❌ Ошибка: ${result.error}`);
    }
  };

  const openOffersCount = myP2POffers.filter((o) => o.status === 'open').length;
  const activeAsLenderCount = myLoansAsLender.filter((l) => l.status === 'active').length;
  const activeAsBorrowerCount = myLoansAsBorrower.filter((l) => l.status === 'active').length;

  const tabs: TabItem<P2PTab>[] = [
    { id: 'market', label: 'Рынок', icon: <span aria-hidden="true"><GameIcon icon="🏪" /></span> },
    { id: 'create', label: 'Создать', icon: <span aria-hidden="true"><GameIcon icon="➕" /></span> },
    {
      id: 'my-offers',
      label: 'Мои офферы',
      icon: <span aria-hidden="true"><GameIcon icon="📋" /></span>,
      badge: openOffersCount > 0 ? openOffersCount : undefined,
    },
    {
      id: 'as-lender',
      label: 'Я кредитор',
      icon: <span aria-hidden="true"><GameIcon icon="💰" /></span>,
      badge: activeAsLenderCount > 0 ? activeAsLenderCount : undefined,
    },
    {
      id: 'as-borrower',
      label: 'Я заёмщик',
      icon: <span aria-hidden="true"><GameIcon icon="📝" /></span>,
      badge: activeAsBorrowerCount > 0 ? activeAsBorrowerCount : undefined,
    },
  ];

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'text-blue-400';
      case 'active':
        return 'text-yellow-400';
      case 'paid':
        return 'text-green-400';
      case 'defaulted':
        return 'text-red-400';
      case 'cancelled':
      case 'expired':
        return 'text-slate-400';
      default:
        return '';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'open':
        return 'Открыт';
      case 'active':
        return 'Активен';
      case 'paid':
        return 'Погашен';
      case 'defaulted':
        return 'Дефолт';
      case 'cancelled':
        return 'Отменён';
      case 'expired':
        return 'Истёк';
      default:
        return status;
    }
  };

  return (
    <div className="space-y-4">
      {/* Статистика рынка */}
      {p2pStats && (
        <Panel title="💱 P2P Кредитный рынок">
          <div className="grid grid-cols-4 gap-3">
            <div className="card">
              <Stat label="Офферов" value={p2pStats.openOffers} tone="info" align="center" />
            </div>
            <div className="card">
              <Stat
                label="Доступно"
                value={`${formatNumber(D(p2pStats.availableAmount))} ₡`}
                tone="accent"
                align="center"
              />
            </div>
            <div className="card">
              <Stat
                label="Ср. ставка"
                value={`${(p2pStats.averageRate * 100).toFixed(1)}%`}
                tone="warning"
                align="center"
              />
            </div>
            <div className="card">
              <Stat label="Всего сделок" value={p2pStats.totalLoans} align="center" />
            </div>
          </div>
        </Panel>
      )}

      {/* Табы */}
      <Tabs items={tabs} value={activeTab} onChange={setActiveTab} size="sm" />

      {/* Контент */}
      <Panel>
        {/* Рынок офферов */}
        {activeTab === 'market' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-bold">Доступные кредиты</h4>
              <div className="text-sm text-slate-400">
                Ваш рейтинг: <span className="font-mono tabular-nums">{creditScore}</span>
              </div>
            </div>

            {p2pOffers.length === 0 ? (
              <EmptyState title="Нет доступных офферов" />
            ) : (
              <div className="space-y-2">
                {p2pOffers.map((offer) => (
                  <div key={offer.id} className="card">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="font-mono font-bold text-lg tabular-nums">{formatNumber(D(offer.amount))} ₡</div>
                        <div className="font-mono tabular-nums text-green-400">{(offer.interestRate * 100).toFixed(1)}% годовых</div>
                        <div className="text-slate-400"><span className="font-mono tabular-nums">{offer.termDays}</span> дней</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleBorrow(offer)}
                        disabled={creditScore < offer.minCreditScore}
                        className="btn-primary"
                      >
                        Взять
                      </button>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-400">
                      <span>Кредитор: {offer.lenderName}</span>
                      <span>Мин. рейтинг: <span className="font-mono tabular-nums">{offer.minCreditScore}</span></span>
                      <span>До: <span className="font-mono tabular-nums">{formatDate(offer.expiresAt)}</span></span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Создание оффера */}
        {activeTab === 'create' && (
          <div className="space-y-4">
            <h4 className="font-bold">Выставить кредит</h4>
            <p className="text-sm text-slate-400">
              Укажите условия кредита. Деньги будут заблокированы до взятия кредита или отмены оффера.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Сумма (₡)">
                <input
                  type="number"
                  value={createForm.amount}
                  onChange={(e) => setCreateForm({ ...createForm, amount: e.target.value })}
                  min={P2P_LENDING_CONFIG.MIN_LOAN_AMOUNT}
                  max={P2P_LENDING_CONFIG.MAX_LOAN_AMOUNT}
                  className="w-full px-3 py-2"
                />
              </Field>

              <Field label="Ставка (% годовых)">
                <input
                  type="number"
                  value={createForm.interestRate}
                  onChange={(e) => setCreateForm({ ...createForm, interestRate: parseFloat(e.target.value) })}
                  min={P2P_LENDING_CONFIG.MIN_INTEREST_RATE * 100}
                  max={P2P_LENDING_CONFIG.MAX_INTEREST_RATE * 100}
                  step={0.5}
                  className="w-full px-3 py-2"
                />
              </Field>

              <Field label="Срок (дней)">
                <input
                  type="number"
                  value={createForm.termDays}
                  onChange={(e) => setCreateForm({ ...createForm, termDays: parseInt(e.target.value) })}
                  min={P2P_LENDING_CONFIG.MIN_TERM_DAYS}
                  max={P2P_LENDING_CONFIG.MAX_TERM_DAYS}
                  className="w-full px-3 py-2"
                />
              </Field>

              <Field label="Мин. рейтинг заёмщика">
                <input
                  type="number"
                  value={createForm.minCreditScore}
                  onChange={(e) => setCreateForm({ ...createForm, minCreditScore: parseInt(e.target.value) })}
                  min={300}
                  max={850}
                  className="w-full px-3 py-2"
                />
              </Field>
            </div>

            {/* Предварительный расчёт */}
            <div className="card">
              <div className="stat-label mb-2">Ожидаемый доход:</div>
              <div className="flex items-center justify-between">
                <span>Сумма к возврату:</span>
                <span className="font-mono font-bold tabular-nums text-green-400">
                  {formatNumber(
                    D(createForm.amount).mul(1 + (createForm.interestRate / 100) * (createForm.termDays / 365))
                  )}{' '}
                  ₡
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Прибыль (до комиссии):</span>
                <span className="font-mono tabular-nums text-green-400">
                  +
                  {formatNumber(
                    D(createForm.amount).mul((createForm.interestRate / 100) * (createForm.termDays / 365))
                  )}{' '}
                  ₡
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-400">
                Баланс: <span className="font-mono tabular-nums">{formatNumber(D(bankBalance))}</span> ₡
              </div>
              <button
                type="button"
                onClick={handleCreateOffer}
                disabled={D(createForm.amount).gt(D(bankBalance))}
                className="btn-info"
              >
                Создать оффер
              </button>
            </div>
          </div>
        )}

        {/* Мои офферы */}
        {activeTab === 'my-offers' && (
          <div className="space-y-3">
            <h4 className="font-bold">Мои офферы</h4>

            {myP2POffers.length === 0 ? (
              <EmptyState title="Вы ещё не создавали офферов" />
            ) : (
              <div className="space-y-2">
                {myP2POffers.map((offer) => (
                  <div key={offer.id} className="card">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="font-mono font-bold tabular-nums">{formatNumber(D(offer.amount))} ₡</div>
                        <div className="font-mono tabular-nums text-green-400">{(offer.interestRate * 100).toFixed(1)}%</div>
                        <div className="text-slate-400"><span className="font-mono tabular-nums">{offer.termDays}</span> дн.</div>
                        <span className={`text-sm ${getStatusColor(offer.status)}`}>
                          {getStatusText(offer.status)}
                        </span>
                      </div>
                      {offer.status === 'open' && (
                        <button
                          type="button"
                          onClick={() => handleCancelOffer(offer)}
                          className="btn-danger btn-xs"
                        >
                          Отменить
                        </button>
                      )}
                    </div>
                    <div className="text-sm text-slate-400">
                      Создан: <span className="font-mono tabular-nums">{formatDate(offer.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Я кредитор */}
        {activeTab === 'as-lender' && (
          <div className="space-y-3">
            <h4 className="font-bold">Выданные кредиты</h4>

            {myLoansAsLender.length === 0 ? (
              <EmptyState title="Вы ещё не выдавали кредитов" />
            ) : (
              <div className="space-y-2">
                {myLoansAsLender.map((loan) => (
                  <div key={loan.id} className="card">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="font-mono font-bold tabular-nums">{formatNumber(D(loan.principal))} ₡</div>
                        <span className={`text-sm ${getStatusColor(loan.status)}`}>
                          {getStatusText(loan.status)}
                        </span>
                      </div>
                      <div className="text-sm">
                        Остаток: <span className="font-mono tabular-nums text-yellow-400">{formatNumber(D(loan.remainingBalance))} ₡</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-400">
                      <span>Заёмщик: {loan.borrowerName}</span>
                      <span>Ставка: <span className="font-mono tabular-nums">{(loan.interestRate * 100).toFixed(1)}%</span></span>
                      <span>До: <span className="font-mono tabular-nums">{formatDate(loan.dueDate)}</span></span>
                      {loan.daysOverdue > 0 && (
                        <span className="text-red-400">Просрочка: <span className="font-mono tabular-nums">{loan.daysOverdue}</span> дн.</span>
                      )}
                    </div>
                    <div className="mt-2 text-sm">
                      Получено процентов: <span className="font-mono tabular-nums text-green-400">+{formatNumber(D(loan.interestPaid))} ₡</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Я заёмщик */}
        {activeTab === 'as-borrower' && (
          <div className="space-y-3">
            <h4 className="font-bold">Взятые кредиты</h4>

            {myLoansAsBorrower.length === 0 ? (
              <EmptyState title="Вы не брали кредитов" />
            ) : (
              <div className="space-y-2">
                {myLoansAsBorrower.map((loan) => (
                  <LoanPaymentCard key={loan.id} loan={loan} onPay={handlePayLoan} bankBalance={bankBalance} />
                ))}
              </div>
            )}
          </div>
        )}
      </Panel>
    </div>
  );
}

// Компонент для погашения кредита
function LoanPaymentCard({
  loan,
  onPay,
  bankBalance,
}: {
  loan: P2PLoan;
  onPay: (loan: P2PLoan, amount: string) => void;
  bankBalance: string;
}) {
  const [payAmount, setPayAmount] = useState('');

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-yellow-400';
      case 'paid':
        return 'text-green-400';
      case 'defaulted':
        return 'text-red-400';
      default:
        return '';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return 'Активен';
      case 'paid':
        return 'Погашен';
      case 'defaulted':
        return 'Дефолт';
      default:
        return status;
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    });
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="font-mono font-bold tabular-nums">{formatNumber(D(loan.principal))} ₡</div>
          <span className={`text-sm ${getStatusColor(loan.status)}`}>{getStatusText(loan.status)}</span>
        </div>
        <div className="text-sm">
          Остаток: <span className="font-mono tabular-nums text-orange-400">{formatNumber(D(loan.remainingBalance))} ₡</span>
        </div>
      </div>

      <div className="flex items-center gap-4 text-sm text-slate-400 mb-2">
        <span>Кредитор: {loan.lenderName}</span>
        <span>Ставка: <span className="font-mono tabular-nums">{(loan.interestRate * 100).toFixed(1)}%</span></span>
        <span>До: <span className="font-mono tabular-nums">{formatDate(loan.dueDate)}</span></span>
        {loan.daysOverdue > 0 && <span className="text-red-400">Просрочка: <span className="font-mono tabular-nums">{loan.daysOverdue}</span> дн.</span>}
      </div>

      {loan.status === 'active' && (
        <div className="flex items-center gap-2 mt-2">
          <input
            type="number"
            value={payAmount}
            onChange={(e) => setPayAmount(e.target.value)}
            placeholder="Сумма платежа"
            className="flex-1 px-3 py-1 text-sm"
          />
          <button
            type="button"
            onClick={() => setPayAmount(loan.remainingBalance)}
            className="btn btn-xs"
          >
            Всё
          </button>
          <button
            type="button"
            onClick={() => onPay(loan, payAmount)}
            disabled={!payAmount || D(payAmount).lte(0) || D(payAmount).gt(D(bankBalance))}
            className="btn-primary"
          >
            Погасить
          </button>
        </div>
      )}
    </div>
  );
}
