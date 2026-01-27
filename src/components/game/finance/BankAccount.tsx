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
  
  // Используем селекторы для правильного отслеживания изменений
  const bank = useFinanceStore(s => s.bank);
  const depositToSavings = useFinanceStore(s => s.depositToSavings);
  const withdrawFromSavings = useFinanceStore(s => s.withdrawFromSavings);
  
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
  
  const periodRatePercent = (bank.interestRate * 100).toFixed(1);
  // Расчет годовой ставки при сложных процентах: (1 + r)^n - 1, где n = кол-во периодов в году
  const periodsPerYear = (365 * 24 * 60) / 5; // Периодов по 5 минут в году
  const annualRatePercent = ((Math.pow(1 + bank.interestRate, periodsPerYear) - 1) * 100).toFixed(0);
  
  return (
    <div className="space-y-4">
      {/* Информация о счёте */}
      <div className="bg-slate-800 rounded-lg p-4">
        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
          🏦 Банковский счёт
        </h3>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-slate-700 rounded p-3">
            <div className="text-slate-400 text-sm">Расчётный счёт</div>
            <div className="text-xl font-bold text-blue-400">
              {formatNumber(D(bank.balance))} ₡
            </div>
            <div className="text-xs text-slate-500 mt-1">Доходы от акций/фондов</div>
          </div>
          
          <div className="bg-slate-700 rounded p-3">
            <div className="text-slate-400 text-sm">Сберегательный счёт</div>
            <div className="text-xl font-bold text-emerald-400">
              {formatNumber(D(bank.savingsBalance))} ₡
            </div>
            <div className="text-xs text-slate-500 mt-1">+{periodRatePercent}% каждые 5 мин</div>
          </div>
        </div>
        
        {/* Кредиты из игры */}
        <div className="bg-slate-700/50 rounded p-3 mb-4 border border-yellow-500/30">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-slate-400 text-sm">Кредиты в игре</div>
              <div className="text-lg font-bold text-yellow-400">
                {formatNumber(creditsBalance)} ₡
              </div>
            </div>
            <div className="text-xs text-slate-500 max-w-32 text-right">
              Основной баланс из вашей колонии
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
              <div className="text-2xl font-bold text-emerald-400">{periodRatePercent}%</div>
              <div className="text-sm text-slate-400">за период</div>
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
      
      {/* Пополнение расчётного счёта из кредитов игры */}
      <div className="bg-gradient-to-r from-yellow-900/50 to-slate-800 rounded-lg p-4 border border-yellow-500/30">
        <h4 className="font-medium mb-3 flex items-center gap-2">
          📤 Пополнить расчётный счёт
        </h4>
        <p className="text-sm text-slate-400 mb-3">
          Переведите кредиты из колонии на расчётный счёт для покупки акций и фондов
        </p>
        <div className="flex gap-2 mb-2">
          {[10, 25, 50, 100].map(percent => (
            <button
              key={percent}
              onClick={() => {
                const amount = creditsBalance.mul(percent / 100);
                if (amount.gt(0)) {
                  onTransfer(amount, 'toBank');
                }
              }}
              disabled={creditsBalance.lte(0)}
              className="flex-1 py-1.5 bg-yellow-600/50 hover:bg-yellow-600 disabled:bg-slate-700 rounded text-sm font-medium"
            >
              {percent}%
            </button>
          ))}
        </div>
        <div className="text-xs text-slate-500 text-center">
          Доступно: {formatNumber(creditsBalance)} ₡
        </div>
      </div>
      
      {/* Вывод с расчётного счёта в кредиты игры */}
      {D(bank.balance).gt(0) && (
        <div className="bg-gradient-to-r from-blue-900/50 to-slate-800 rounded-lg p-4 border border-blue-500/30">
          <h4 className="font-medium mb-3 flex items-center gap-2">
            💸 Вывести в кредиты игры
          </h4>
          <p className="text-sm text-slate-400 mb-3">
            Переведите средства с расчётного счёта в основные кредиты колонии
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                const currentBalance = D(bank.balance);
                if (currentBalance.gt(0)) {
                  onTransfer(currentBalance, 'fromBank');
                }
              }}
              className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 rounded font-medium"
            >
              Вывести всё ({formatNumber(D(bank.balance))} ₡)
            </button>
          </div>
        </div>
      )}
      
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
          <li>Ставка: {periodRatePercent}% за период (≈{annualRatePercent}% годовых при сложных %)</li>
          <li>Сбережения защищены и не используются для покупок</li>
          <li>Вы можете снять средства в любой момент без штрафов</li>
        </ul>
      </div>
    </div>
  );
}
