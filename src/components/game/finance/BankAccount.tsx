/**
 * BankAccount - Компонент банковского счёта
 * Управление балансом и сберегательным счётом
 */

import { useState } from 'react';
import Decimal from 'break_eternity.js';
import { useFinanceStore } from '../../../features/financeStore';
import { formatNumber, D } from '../../../core/math/format';

interface BankAccountProps {
  creditsBalance: Decimal;
  onTransfer: (amount: Decimal, direction: 'toBank' | 'fromBank') => void;
}

export function BankAccount({ creditsBalance, onTransfer }: BankAccountProps) {
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  
  const {
    bank,
    depositToSavings,
    withdrawFromSavings,
  } = useFinanceStore();
  
  const handleDeposit = () => {
    const amount = D(depositAmount || '0');
    if (amount.gt(0) && amount.lte(creditsBalance)) {
      // Сначала переводим в банк, потом на сберегательный
      onTransfer(amount, 'toBank');
      depositToSavings(amount);
      setDepositAmount('');
    }
  };
  
  const handleWithdraw = () => {
    const amount = D(withdrawAmount || '0');
    const savingsBalance = D(bank.savingsBalance);
    if (amount.gt(0) && amount.lte(savingsBalance)) {
      withdrawFromSavings(amount);
      onTransfer(amount, 'fromBank');
      setWithdrawAmount('');
    }
  };
  
  const handleQuickDeposit = (percent: number) => {
    const amount = creditsBalance.mul(percent / 100);
    if (amount.gt(0)) {
      onTransfer(amount, 'toBank');
      depositToSavings(amount);
    }
  };
  
  const handleQuickWithdraw = (percent: number) => {
    const savingsBalance = D(bank.savingsBalance);
    const amount = savingsBalance.mul(percent / 100);
    if (amount.gt(0)) {
      withdrawFromSavings(amount);
      onTransfer(amount, 'fromBank');
    }
  };
  
  const annualRatePercent = (bank.interestRate * 100).toFixed(1);
  const dailyRate = (bank.interestRate / 365 * 100).toFixed(4);
  
  return (
    <div className="space-y-4">
      {/* Информация о счёте */}
      <div className="bg-slate-800 rounded-lg p-4">
        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
          🏦 Банковский счёт
        </h3>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-slate-700 rounded p-3">
            <div className="text-slate-400 text-sm">Текущий баланс (кредиты)</div>
            <div className="text-xl font-bold text-yellow-400">
              {formatNumber(creditsBalance)} ₡
            </div>
          </div>
          
          <div className="bg-slate-700 rounded p-3">
            <div className="text-slate-400 text-sm">Сберегательный счёт</div>
            <div className="text-xl font-bold text-emerald-400">
              {formatNumber(D(bank.savingsBalance))} ₡
            </div>
          </div>
        </div>
        
        {/* Информация о процентах */}
        <div className="bg-gradient-to-r from-emerald-900/50 to-teal-900/50 rounded p-3 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-emerald-400 font-medium">Процентная ставка</div>
              <div className="text-sm text-slate-400">
                Начисление каждые 5 минут
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-emerald-400">{annualRatePercent}%</div>
              <div className="text-sm text-slate-400">годовых</div>
            </div>
          </div>
        </div>
        
        {/* Статистика */}
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div className="bg-slate-700/50 rounded p-2 text-center">
            <div className="text-slate-400">Всего заработано</div>
            <div className="font-medium text-emerald-400">
              +{formatNumber(D(bank.stats.totalInterestEarned))} ₡
            </div>
          </div>
          <div className="bg-slate-700/50 rounded p-2 text-center">
            <div className="text-slate-400">Всего внесено</div>
            <div className="font-medium">
              {formatNumber(D(bank.stats.totalDeposited))} ₡
            </div>
          </div>
          <div className="bg-slate-700/50 rounded p-2 text-center">
            <div className="text-slate-400">Всего снято</div>
            <div className="font-medium">
              {formatNumber(D(bank.stats.totalWithdrawn))} ₡
            </div>
          </div>
        </div>
      </div>
      
      {/* Депозит */}
      <div className="bg-slate-800 rounded-lg p-4">
        <h4 className="font-medium mb-3 flex items-center gap-2">
          📥 Внести на сберегательный
        </h4>
        
        <div className="flex gap-2 mb-3">
          <input
            type="number"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            placeholder="Сумма"
            className="flex-1 bg-slate-700 rounded px-3 py-2 text-white"
          />
          <button
            onClick={handleDeposit}
            disabled={!depositAmount || D(depositAmount).lte(0) || D(depositAmount).gt(creditsBalance)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-600 disabled:cursor-not-allowed rounded font-medium"
          >
            Внести
          </button>
        </div>
        
        <div className="flex gap-2">
          {[10, 25, 50, 100].map(percent => (
            <button
              key={percent}
              onClick={() => handleQuickDeposit(percent)}
              disabled={creditsBalance.lte(0)}
              className="flex-1 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 rounded text-sm"
            >
              {percent}%
            </button>
          ))}
        </div>
      </div>
      
      {/* Снятие */}
      <div className="bg-slate-800 rounded-lg p-4">
        <h4 className="font-medium mb-3 flex items-center gap-2">
          📤 Снять со сберегательного
        </h4>
        
        <div className="flex gap-2 mb-3">
          <input
            type="number"
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value)}
            placeholder="Сумма"
            className="flex-1 bg-slate-700 rounded px-3 py-2 text-white"
          />
          <button
            onClick={handleWithdraw}
            disabled={!withdrawAmount || D(withdrawAmount).lte(0) || D(withdrawAmount).gt(D(bank.savingsBalance))}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed rounded font-medium"
          >
            Снять
          </button>
        </div>
        
        <div className="flex gap-2">
          {[10, 25, 50, 100].map(percent => (
            <button
              key={percent}
              onClick={() => handleQuickWithdraw(percent)}
              disabled={D(bank.savingsBalance).lte(0)}
              className="flex-1 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 rounded text-sm"
            >
              {percent}%
            </button>
          ))}
        </div>
      </div>
      
      {/* Информация */}
      <div className="bg-slate-800/50 rounded-lg p-4 text-sm text-slate-400">
        <h4 className="font-medium text-white mb-2">ℹ️ Информация</h4>
        <ul className="space-y-1 list-disc list-inside">
          <li>Проценты начисляются автоматически каждые 5 минут</li>
          <li>Годовая ставка: {annualRatePercent}% (≈{dailyRate}% в день)</li>
          <li>Сбережения защищены и не используются для покупок</li>
          <li>Вы можете снять средства в любой момент без штрафов</li>
        </ul>
      </div>
    </div>
  );
}
