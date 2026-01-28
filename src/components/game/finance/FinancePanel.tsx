/**
 * FinancePanel - Главная панель финансовой системы
 * Фаза 6: Вкладки для банка, акций, кредитов и портфеля
 */

import { useState, useEffect } from 'react';
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
import Decimal from 'break_eternity.js';

type FinanceTab = 'overview' | 'bank' | 'stocks' | 'funds' | 'loans' | 'advisor' | 'p2p';

interface FinancePanelProps {
  creditsBalance: Decimal;
  onTransfer: (amount: Decimal, direction: 'toBank' | 'fromBank') => void;
}

export function FinancePanel({ creditsBalance, onTransfer }: FinancePanelProps) {
  const [activeTab, setActiveTab] = useState<FinanceTab>('overview');
  
  const {
    bank,
    creditScore,
    netWorth,
    liquidAssets,
    totalDebt,
    loans,
    positions,
    fundInvestments,
    stocks,
    initializeFinance,
    recalculateNetWorth,
  } = useFinanceStore();
  
  // Инициализация при первом рендере
  useEffect(() => {
    if (stocks.length === 0) {
      initializeFinance();
    }
  }, [stocks.length, initializeFinance]);
  
  // Пересчёт чистой стоимости
  useEffect(() => {
    recalculateNetWorth(creditsBalance);
  }, [creditsBalance, positions, fundInvestments, loans, recalculateNetWorth]);
  
  const tabs: { id: FinanceTab; label: string; icon: string }[] = [
    { id: 'overview', label: 'Обзор', icon: '📊' },
    { id: 'bank', label: 'Банк', icon: '🏦' },
    { id: 'stocks', label: 'Акции', icon: '📈' },
    { id: 'funds', label: 'Фонды', icon: '💼' },
    { id: 'loans', label: 'Кредиты', icon: '💳' },
    { id: 'advisor', label: 'AI', icon: '🤖' },
    { id: 'p2p', label: 'P2P', icon: '💱' },
  ];
  
  const activeLoans = loans.filter(l => l.status === 'active').length;
  
  // P2P кредиты
  const { myLoansAsBorrower, fetchMyP2PData } = useAdvisorStore();
  
  useEffect(() => {
    fetchMyP2PData();
  }, [fetchMyP2PData]);
  
  const activeP2PLoans = myLoansAsBorrower.filter(l => l.status === 'active');
  const p2pDebt = activeP2PLoans.reduce(
    (sum, loan) => sum.add(new Decimal(loan.remainingBalance)),
    new Decimal(0)
  );
  const combinedTotalDebt = new Decimal(totalDebt).add(p2pDebt);
  
  return (
    <div className="flex flex-col min-h-full bg-slate-900 text-white">
      {/* Заголовок */}
      <div className="p-4 border-b border-slate-700 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-bold flex items-center gap-2">
            💰 Финансы
          </h2>
          <CreditScore score={creditScore} compact />
        </div>
        
        {/* Быстрая статистика */}
        <div className="grid grid-cols-4 gap-2 text-sm">
          <div className="bg-slate-800 rounded p-2">
            <div className="text-slate-400">Чистая стоимость</div>
            <div className={`font-bold ${parseFloat(netWorth) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {formatNumber(new Decimal(netWorth))} ₡
            </div>
          </div>
          <div className="bg-slate-800 rounded p-2">
            <div className="text-slate-400">Ликвидные активы</div>
            <div className="font-bold text-blue-400">
              {formatNumber(new Decimal(liquidAssets))} ₡
            </div>
          </div>
          <div className="bg-slate-800 rounded p-2">
            <div className="text-slate-400">Долги</div>
            <div className="font-bold text-orange-400">
              {formatNumber(combinedTotalDebt)} ₡
              {p2pDebt.gt(0) && (
                <span className="text-xs text-purple-400 ml-1">
                  (P2P: {formatNumber(p2pDebt)})
                </span>
              )}
            </div>
          </div>
          <div className="bg-slate-800 rounded p-2">
            <div className="text-slate-400">Сбережения</div>
            <div className="font-bold text-emerald-400">
              {formatNumber(new Decimal(bank.savingsBalance))} ₡
            </div>
          </div>
        </div>
      </div>
      
      {/* Табы */}
      <div className="flex border-b border-slate-700 shrink-0">
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors cursor-pointer
              ${activeTab === tab.id 
                ? 'bg-slate-800 text-white border-b-2 border-blue-500' 
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
          >
            <span className="mr-1">{tab.icon}</span>
            {tab.label}
            {tab.id === 'loans' && (activeLoans > 0 || activeP2PLoans.length > 0) && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-orange-500 rounded-full">
                {activeLoans + activeP2PLoans.length}
              </span>
            )}
          </button>
        ))}
      </div>
      
      {/* Контент */}
      <div className="p-4">
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <NetWorthTracker />
            
            <div className="grid grid-cols-2 gap-4">
              {/* Краткая информация о портфеле */}
              <div className="bg-slate-800 rounded-lg p-4">
                <h3 className="font-bold mb-3 flex items-center gap-2">
                  📊 Портфель
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Акции</span>
                    <span>{positions.length} позиций</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Фонды</span>
                    <span>{fundInvestments.length} инвестиций</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('stocks')}
                  className="mt-3 w-full py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm cursor-pointer transition-colors"
                >
                  Подробнее
                </button>
              </div>
              
              {/* Краткая информация о кредитах */}
              <div className="bg-slate-800 rounded-lg p-4">
                <h3 className="font-bold mb-3 flex items-center gap-2">
                  💳 Кредиты
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Активные</span>
                    <span>{activeLoans} кредитов</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Общий долг</span>
                    <span className="text-orange-400">
                      {formatNumber(new Decimal(totalDebt))} ₡
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('loans')}
                  className="mt-3 w-full py-2 bg-orange-600 hover:bg-orange-700 rounded text-sm cursor-pointer transition-colors"
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
