/**
 * FinancePanel - Главная панель финансовой системы
 * Фаза 6: Вкладки для банка, акций, кредитов и портфеля
 */

import { memo, useState, useEffect } from 'react';
import { useFinanceStore } from '../../../features/financeStore';
import { useAdvisorStore } from '../../../features/advisorStore';
import { BankAccount } from './BankAccount';
import { LoanManager } from './LoanManager';
import { StockMarket } from './StockMarket';
import { Portfolio } from './Portfolio';
import { CreditScore } from './CreditScore';
import { NetWorthTracker } from './NetWorthTracker';
import { AIAdvisor } from './AIAdvisor';
import { P2PLending } from './P2PLending';
import { formatNumber } from '../../../core/math/format';
import { Stat, Tabs, type TabItem } from '../../ui';
import Decimal from 'break_eternity.js';
import { GameIcon } from '../../ui/icons';

type FinanceTab = 'overview' | 'bank' | 'stocks' | 'funds' | 'loans' | 'advisor' | 'p2p';

interface FinancePanelProps {
  creditsBalance: Decimal;
  onTransfer: (amount: Decimal, direction: 'toBank' | 'fromBank') => void;
}

/*
 * memo со сравнением по ЗНАЧЕНИЮ: SidePanelTabs берёт creditsBalance из gameStore, а
 * tick() создаёт новый Decimal каждые 50 мс — по ссылке он «меняется» всегда, поэтому
 * memo по умолчанию не отсёк бы ни одного рендера. onTransfer стабилизирован
 * useCallback на стороне SidePanelTabs.
 *
 * Панель всё равно будет просыпаться на пересчёт netWorth/liquidAssets (её собственные
 * селекторы), но каждый дочерний компонент обёрнут в memo и на этих рендерах не
 * пересчитывается — раньше все десять перерисовывались вместе с родителем.
 */
export const FinancePanel = memo(
  FinancePanelImpl,
  (prev, next) =>
    prev.onTransfer === next.onTransfer && prev.creditsBalance.eq(next.creditsBalance),
);

function FinancePanelImpl({ creditsBalance, onTransfer }: FinancePanelProps) {
  const [activeTab, setActiveTab] = useState<FinanceTab>('overview');

  /*
   * Раньше здесь стояло `useFinanceStore()` без селектора: панель перерисовывалась на
   * ЛЮБОЙ set() стора. Эффект ниже вызывает recalculateNetWorth() на каждое изменение
   * creditsBalance (20 раз в секунду), а он делает set() — то есть подписка на весь стор
   * удваивала работу. Точечные селекторы отдают ровно те же ссылки, но будят компонент
   * только когда меняются именно эти поля.
   */
  const savingsBalance = useFinanceStore((s) => s.bank.savingsBalance);
  const creditScore = useFinanceStore((s) => s.creditScore);
  const netWorth = useFinanceStore((s) => s.netWorth);
  const liquidAssets = useFinanceStore((s) => s.liquidAssets);
  const totalDebt = useFinanceStore((s) => s.totalDebt);
  const loans = useFinanceStore((s) => s.loans);
  const positions = useFinanceStore((s) => s.positions);
  const fundInvestments = useFinanceStore((s) => s.fundInvestments);
  const stocksCount = useFinanceStore((s) => s.stocks.length);
  const initializeFinance = useFinanceStore((s) => s.initializeFinance);
  const recalculateNetWorth = useFinanceStore((s) => s.recalculateNetWorth);

  // Инициализация при первом рендере
  useEffect(() => {
    if (stocksCount === 0) {
      initializeFinance();
    }
  }, [stocksCount, initializeFinance]);

  // Пересчёт чистой стоимости
  useEffect(() => {
    recalculateNetWorth(creditsBalance);
  }, [creditsBalance, positions, fundInvestments, loans, recalculateNetWorth]);

  const activeLoans = loans.filter(l => l.status === 'active').length;

  // P2P кредиты
  const myLoansAsBorrower = useAdvisorStore((s) => s.myLoansAsBorrower);
  const fetchMyP2PData = useAdvisorStore((s) => s.fetchMyP2PData);

  useEffect(() => {
    fetchMyP2PData();
  }, [fetchMyP2PData]);

  const activeP2PLoans = myLoansAsBorrower.filter(l => l.status === 'active');
  const p2pDebt = activeP2PLoans.reduce(
    (sum, loan) => sum.add(new Decimal(loan.remainingBalance)),
    new Decimal(0)
  );
  const combinedTotalDebt = new Decimal(totalDebt).add(p2pDebt);

  const loansBadge = activeLoans + activeP2PLoans.length;

  const tabs: TabItem<FinanceTab>[] = [
    { id: 'overview', label: 'Обзор', icon: <span aria-hidden="true"><GameIcon icon="📊" /></span> },
    { id: 'bank', label: 'Банк', icon: <span aria-hidden="true"><GameIcon icon="🏦" /></span> },
    { id: 'stocks', label: 'Акции', icon: <span aria-hidden="true"><GameIcon icon="📈" /></span> },
    { id: 'funds', label: 'Фонды', icon: <span aria-hidden="true"><GameIcon icon="💼" /></span> },
    {
      id: 'loans',
      label: 'Кредиты',
      icon: <span aria-hidden="true"><GameIcon icon="💳" /></span>,
      badge: loansBadge > 0 ? loansBadge : undefined,
    },
    { id: 'advisor', label: 'AI', icon: <span aria-hidden="true"><GameIcon icon="🤖" /></span> },
    { id: 'p2p', label: 'P2P', icon: <span aria-hidden="true"><GameIcon icon="💱" /></span> },
  ];

  return (
    /*
     * `min-w-0` на корне обязателен. Ряд вкладок — флекс-контейнер с `whitespace-nowrap`
     * внутри: его min-content равен сумме ширин вкладок, и семь вкладок распирали всю
     * панель вширь — она уезжала горизонтально целиком, вместе с заголовком.
     */
    <div className="flex min-h-full min-w-0 flex-col bg-slate-900 text-white">
      {/* Заголовок */}
      <div className="shrink-0 border-b border-slate-700 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-base font-bold">
            <GameIcon icon="💰" /> Финансы
          </h2>
          <CreditScore score={creditScore} compact />
        </div>

        {/* Быстрая статистика: две колонки — в четыре подписи не помещались */}
        <div className="grid grid-cols-2 gap-2">
          <div className="card">
            <Stat
              label="Чистая стоимость"
              value={`${formatNumber(new Decimal(netWorth))} ₡`}
              tone={parseFloat(netWorth) >= 0 ? 'accent' : 'danger'}
            />
          </div>
          <div className="card">
            <Stat
              label="Ликвидные активы"
              value={`${formatNumber(new Decimal(liquidAssets))} ₡`}
              tone="info"
            />
          </div>
          <div className="card">
            <Stat
              label="Долги"
              value={`${formatNumber(combinedTotalDebt)} ₡`}
              tone="warning"
              hint={p2pDebt.gt(0) ? `(P2P: ${formatNumber(p2pDebt)})` : undefined}
            />
          </div>
          <div className="card">
            <Stat
              label="Сбережения"
              value={`${formatNumber(new Decimal(savingsBalance))} ₡`}
              tone="accent"
            />
          </div>
        </div>
      </div>

      {/* Табы: семь штук в 400px не влезают — ряд прокручивается */}
      <div className="shrink-0 overflow-x-auto px-3 pt-2">
        <Tabs items={tabs} value={activeTab} onChange={setActiveTab} size="sm" scroll />
      </div>

      {/* Контент */}
      <div className="min-w-0 p-3">
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <NetWorthTracker />

            <div className="grid grid-cols-2 gap-2">
              {/* Краткая информация о портфеле */}
              <div className="card">
                <h3 className="font-bold mb-3 flex items-center gap-2">
                  <GameIcon icon="📊" /> Портфель
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Акции</span>
                    <span><span className="font-mono tabular-nums">{positions.length}</span> позиций</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Фонды</span>
                    <span><span className="font-mono tabular-nums">{fundInvestments.length}</span> инвестиций</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('stocks')}
                  className="btn-info btn-block mt-3"
                >
                  Подробнее
                </button>
              </div>

              {/* Краткая информация о кредитах */}
              <div className="card">
                <h3 className="font-bold mb-3 flex items-center gap-2">
                  <GameIcon icon="💳" /> Кредиты
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Активные</span>
                    <span><span className="font-mono tabular-nums">{activeLoans}</span> кредитов</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Общий долг</span>
                    <span className="font-mono tabular-nums text-orange-400">
                      {formatNumber(new Decimal(totalDebt))} ₡
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('loans')}
                  className="btn btn-block mt-3"
                >
                  Управление
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'bank' && (
          <BankAccount
            creditsBalance={creditsBalance}
            onTransfer={onTransfer}
          />
        )}

        {activeTab === 'stocks' && (
          <StockMarket />
        )}

        {activeTab === 'funds' && (
          <Portfolio />
        )}

        {activeTab === 'loans' && (
          <LoanManager />
        )}

        {activeTab === 'advisor' && (
          <AIAdvisor />
        )}

        {activeTab === 'p2p' && (
          <P2PLending />
        )}
      </div>
    </div>
  );
}
