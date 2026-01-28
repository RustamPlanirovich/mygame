/**
 * P2PLending - P2P Кредитование
 * Глобальный рынок кредитов между игроками
 */

import { useState, useEffect } from 'react';
import { useAdvisorStore } from '../../../features/advisorStore';
import { useFinanceStore } from '../../../features/financeStore';
import { formatNumber, D } from '../../../core/math/format';
import { P2P_LENDING_CONFIG } from '../../../core/gameTypes.ai';
import type { P2PLoanOffer, P2PLoan } from '../../../core/gameTypes.ai';

type P2PTab = 'market' | 'my-offers' | 'as-lender' | 'as-borrower' | 'create';

export function P2PLending() {
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

  const { creditScore, bank, withdrawFromBank, depositToBank } = useFinanceStore();

  // Загрузка данных
  useEffect(() => {
    fetchP2POffers();
    fetchMyP2PData();
    fetchP2PStats();
  }, [fetchP2POffers, fetchMyP2PData, fetchP2PStats]);

  const handleCreateOffer = async () => {
    // Проверяем баланс
    const amount = D(createForm.amount);
    if (amount.gt(D(bank.balance))) {
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
    if (payAmount.gt(D(bank.balance))) {
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

  const tabs: { id: P2PTab; label: string; icon: string; badge?: number }[] = [
    { id: 'market', label: 'Рынок', icon: '🏪' },
    { id: 'create', label: 'Создать', icon: '➕' },
    { id: 'my-offers', label: 'Мои офферы', icon: '📋', badge: myP2POffers.filter((o) => o.status === 'open').length },
    { id: 'as-lender', label: 'Я кредитор', icon: '💰', badge: myLoansAsLender.filter((l) => l.status === 'active').length },
    { id: 'as-borrower', label: 'Я заёмщик', icon: '📝', badge: myLoansAsBorrower.filter((l) => l.status === 'active').length },
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
        <div className="bg-slate-800 rounded-lg p-4">
          <h3 className="font-bold mb-3 flex items-center gap-2">💱 P2P Кредитный рынок</h3>
          <div className="grid grid-cols-4 gap-3 text-sm">
            <div className="bg-slate-700 rounded p-2 text-center">
              <div className="text-slate-400">Офферов</div>
              <div className="font-bold text-blue-400">{p2pStats.openOffers}</div>
            </div>
            <div className="bg-slate-700 rounded p-2 text-center">
              <div className="text-slate-400">Доступно</div>
              <div className="font-bold text-green-400">{formatNumber(D(p2pStats.availableAmount))} ₡</div>
            </div>
            <div className="bg-slate-700 rounded p-2 text-center">
              <div className="text-slate-400">Ср. ставка</div>
              <div className="font-bold text-yellow-400">{(p2pStats.averageRate * 100).toFixed(1)}%</div>
            </div>
            <div className="bg-slate-700 rounded p-2 text-center">
              <div className="text-slate-400">Всего сделок</div>
              <div className="font-bold">{p2pStats.totalLoans}</div>
            </div>
          </div>
        </div>
      )}

      {/* Табы */}
      <div className="flex gap-1 bg-slate-800 rounded-lg p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-colors cursor-pointer ${
              activeTab === tab.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            <span className="mr-1">{tab.icon}</span>
            {tab.label}
            {tab.badge && tab.badge > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-red-500 rounded-full text-xs">{tab.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* Контент */}
      <div className="bg-slate-800 rounded-lg p-4">
        {/* Рынок офферов */}
        {activeTab === 'market' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-bold">Доступные кредиты</h4>
              <div className="text-sm text-slate-400">Ваш рейтинг: {creditScore}</div>
            </div>

            {p2pOffers.length === 0 ? (
              <div className="text-center text-slate-400 py-8">Нет доступных офферов</div>
            ) : (
              <div className="space-y-2">
                {p2pOffers.map((offer) => (
                  <div key={offer.id} className="bg-slate-700 rounded p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="font-bold text-lg">{formatNumber(D(offer.amount))} ₡</div>
                        <div className="text-green-400">{(offer.interestRate * 100).toFixed(1)}% годовых</div>
                        <div className="text-slate-400">{offer.termDays} дней</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleBorrow(offer)}
                        disabled={creditScore < offer.minCreditScore}
                        className={`px-4 py-2 rounded font-medium transition-colors cursor-pointer ${
                          creditScore >= offer.minCreditScore
                            ? 'bg-green-600 hover:bg-green-700'
                            : 'bg-slate-600 cursor-not-allowed opacity-50'
                        }`}
                      >
                        Взять
                      </button>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-400">
                      <span>Кредитор: {offer.lenderName}</span>
                      <span>Мин. рейтинг: {offer.minCreditScore}</span>
                      <span>До: {formatDate(offer.expiresAt)}</span>
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
              <div>
                <label className="block text-sm text-slate-400 mb-1">Сумма (₡)</label>
                <input
                  type="number"
                  value={createForm.amount}
                  onChange={(e) => setCreateForm({ ...createForm, amount: e.target.value })}
                  min={P2P_LENDING_CONFIG.MIN_LOAN_AMOUNT}
                  max={P2P_LENDING_CONFIG.MAX_LOAN_AMOUNT}
                  className="w-full px-3 py-2 bg-slate-700 rounded border border-slate-600 focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Ставка (% годовых)</label>
                <input
                  type="number"
                  value={createForm.interestRate}
                  onChange={(e) => setCreateForm({ ...createForm, interestRate: parseFloat(e.target.value) })}
                  min={P2P_LENDING_CONFIG.MIN_INTEREST_RATE * 100}
                  max={P2P_LENDING_CONFIG.MAX_INTEREST_RATE * 100}
                  step={0.5}
                  className="w-full px-3 py-2 bg-slate-700 rounded border border-slate-600 focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Срок (дней)</label>
                <input
                  type="number"
                  value={createForm.termDays}
                  onChange={(e) => setCreateForm({ ...createForm, termDays: parseInt(e.target.value) })}
                  min={P2P_LENDING_CONFIG.MIN_TERM_DAYS}
                  max={P2P_LENDING_CONFIG.MAX_TERM_DAYS}
                  className="w-full px-3 py-2 bg-slate-700 rounded border border-slate-600 focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Мин. рейтинг заёмщика</label>
                <input
                  type="number"
                  value={createForm.minCreditScore}
                  onChange={(e) => setCreateForm({ ...createForm, minCreditScore: parseInt(e.target.value) })}
                  min={300}
                  max={850}
                  className="w-full px-3 py-2 bg-slate-700 rounded border border-slate-600 focus:border-blue-500 outline-none"
                />
              </div>
            </div>

            {/* Предварительный расчёт */}
            <div className="bg-slate-700 rounded p-3">
              <div className="text-sm text-slate-400 mb-2">Ожидаемый доход:</div>
              <div className="flex items-center justify-between">
                <span>Сумма к возврату:</span>
                <span className="font-bold text-green-400">
                  {formatNumber(
                    D(createForm.amount).mul(1 + (createForm.interestRate / 100) * (createForm.termDays / 365))
                  )}{' '}
                  ₡
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Прибыль (до комиссии):</span>
                <span className="text-green-400">
                  +
                  {formatNumber(
                    D(createForm.amount).mul((createForm.interestRate / 100) * (createForm.termDays / 365))
                  )}{' '}
                  ₡
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-400">Баланс: {formatNumber(D(bank.balance))} ₡</div>
              <button
                type="button"
                onClick={handleCreateOffer}
                disabled={D(createForm.amount).gt(D(bank.balance))}
                className={`px-6 py-2 rounded font-medium transition-colors cursor-pointer ${
                  D(createForm.amount).lte(D(bank.balance))
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'bg-slate-600 cursor-not-allowed'
                }`}
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
              <div className="text-center text-slate-400 py-8">Вы ещё не создавали офферов</div>
            ) : (
              <div className="space-y-2">
                {myP2POffers.map((offer) => (
                  <div key={offer.id} className="bg-slate-700 rounded p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="font-bold">{formatNumber(D(offer.amount))} ₡</div>
                        <div className="text-green-400">{(offer.interestRate * 100).toFixed(1)}%</div>
                        <div className="text-slate-400">{offer.termDays} дн.</div>
                        <span className={`text-sm ${getStatusColor(offer.status)}`}>
                          {getStatusText(offer.status)}
                        </span>
                      </div>
                      {offer.status === 'open' && (
                        <button
                          type="button"
                          onClick={() => handleCancelOffer(offer)}
                          className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm cursor-pointer transition-colors"
                        >
                          Отменить
                        </button>
                      )}
                    </div>
                    <div className="text-sm text-slate-400">Создан: {formatDate(offer.createdAt)}</div>
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
              <div className="text-center text-slate-400 py-8">Вы ещё не выдавали кредитов</div>
            ) : (
              <div className="space-y-2">
                {myLoansAsLender.map((loan) => (
                  <div key={loan.id} className="bg-slate-700 rounded p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="font-bold">{formatNumber(D(loan.principal))} ₡</div>
                        <span className={`text-sm ${getStatusColor(loan.status)}`}>
                          {getStatusText(loan.status)}
                        </span>
                      </div>
                      <div className="text-sm">
                        Остаток: <span className="text-yellow-400">{formatNumber(D(loan.remainingBalance))} ₡</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-400">
                      <span>Заёмщик: {loan.borrowerName}</span>
                      <span>Ставка: {(loan.interestRate * 100).toFixed(1)}%</span>
                      <span>До: {formatDate(loan.dueDate)}</span>
                      {loan.daysOverdue > 0 && (
                        <span className="text-red-400">Просрочка: {loan.daysOverdue} дн.</span>
                      )}
                    </div>
                    <div className="mt-2 text-sm">
                      Получено процентов: <span className="text-green-400">+{formatNumber(D(loan.interestPaid))} ₡</span>
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
              <div className="text-center text-slate-400 py-8">Вы не брали кредитов</div>
            ) : (
              <div className="space-y-2">
                {myLoansAsBorrower.map((loan) => (
                  <LoanPaymentCard key={loan.id} loan={loan} onPay={handlePayLoan} bankBalance={bank.balance} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
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
    <div className="bg-slate-700 rounded p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="font-bold">{formatNumber(D(loan.principal))} ₡</div>
          <span className={`text-sm ${getStatusColor(loan.status)}`}>{getStatusText(loan.status)}</span>
        </div>
        <div className="text-sm">
          Остаток: <span className="text-orange-400">{formatNumber(D(loan.remainingBalance))} ₡</span>
        </div>
      </div>

      <div className="flex items-center gap-4 text-sm text-slate-400 mb-2">
        <span>Кредитор: {loan.lenderName}</span>
        <span>Ставка: {(loan.interestRate * 100).toFixed(1)}%</span>
        <span>До: {formatDate(loan.dueDate)}</span>
        {loan.daysOverdue > 0 && <span className="text-red-400">Просрочка: {loan.daysOverdue} дн.</span>}
      </div>

      {loan.status === 'active' && (
        <div className="flex items-center gap-2 mt-2">
          <input
            type="number"
            value={payAmount}
            onChange={(e) => setPayAmount(e.target.value)}
            placeholder="Сумма платежа"
            className="flex-1 px-3 py-1 bg-slate-600 rounded border border-slate-500 focus:border-blue-500 outline-none text-sm"
          />
          <button
            type="button"
            onClick={() => setPayAmount(loan.remainingBalance)}
            className="px-2 py-1 bg-slate-600 hover:bg-slate-500 rounded text-xs cursor-pointer transition-colors"
          >
            Всё
          </button>
          <button
            type="button"
            onClick={() => onPay(loan, payAmount)}
            disabled={!payAmount || D(payAmount).lte(0) || D(payAmount).gt(D(bankBalance))}
            className="px-4 py-1 bg-green-600 hover:bg-green-700 rounded text-sm font-medium cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Погасить
          </button>
        </div>
      )}
    </div>
  );
}
