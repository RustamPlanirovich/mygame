/**
 * BankAccount - Компонент банковского счёта
 * Управление балансом и сберегательным счётом
 */

import { memo, useState } from 'react';
import Decimal from 'break_eternity.js';
import { useFinanceStore } from '../../../features/financeStore';
import { formatNumber, D } from '../../../core/math/format';
import { Panel, Stat } from '../../ui';

interface BankAccountProps {
  creditsBalance: Decimal;
  onTransfer: (amount: Decimal, direction: 'toBank' | 'fromBank') => void;
}

const QUICK_PERCENTS = [10, 25, 50, 100];

/*
 * memo со сравнением по ЗНАЧЕНИЮ: tick() отдаёт новый экземпляр Decimal каждые 50 мс,
 * даже когда сумма не изменилась, поэтому сравнение по ссылке (memo по умолчанию)
 * не отсекло бы ни одного рендера.
 */
export const BankAccount = memo(
  BankAccountImpl,
  (prev, next) =>
    prev.onTransfer === next.onTransfer && prev.creditsBalance.eq(next.creditsBalance),
);

function BankAccountImpl({ creditsBalance, onTransfer }: BankAccountProps) {
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
      <Panel title="🏦 Банковский счёт" bodyClassName="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="card">
            <Stat
              label="Расчётный счёт"
              value={`${formatNumber(D(bank.balance))} ₡`}
              tone="info"
              hint="Доходы от акций/фондов"
            />
          </div>

          <div className="card">
            <Stat
              label="Сберегательный счёт"
              value={`${formatNumber(D(bank.savingsBalance))} ₡`}
              tone="accent"
              hint={`+${periodRatePercent}% каждые 5 мин`}
            />
          </div>
        </div>

        {/* Кредиты из игры */}
        <div className="card border-yellow-500/30">
          <div className="flex items-center justify-between gap-3">
            <Stat
              label="Кредиты в игре"
              value={`${formatNumber(creditsBalance)} ₡`}
              tone="warning"
            />
            <div className="text-xs text-slate-500 max-w-32 text-right">
              Основной баланс из вашей колонии
            </div>
          </div>
        </div>

        {/* Информация о процентах */}
        <div className="card bg-gradient-to-r from-emerald-900/50 to-teal-900/50">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-emerald-400 font-medium">Процентная ставка</div>
              <div className="text-sm text-slate-400">
                Начисление каждые 5 минут
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono text-2xl font-bold tabular-nums text-emerald-400">
                {periodRatePercent}%
              </div>
              <div className="text-sm text-slate-400">за период</div>
            </div>
          </div>
        </div>

        {/* Статистика */}
        <div className="grid grid-cols-3 gap-2">
          <div className="card">
            <Stat
              label="Всего заработано"
              value={`+${formatNumber(D(bank.stats.totalInterestEarned))} ₡`}
              tone="accent"
              align="center"
            />
          </div>
          <div className="card">
            <Stat
              label="Всего внесено"
              value={`${formatNumber(D(bank.stats.totalDeposited))} ₡`}
              align="center"
            />
          </div>
          <div className="card">
            <Stat
              label="Всего снято"
              value={`${formatNumber(D(bank.stats.totalWithdrawn))} ₡`}
              align="center"
            />
          </div>
        </div>
      </Panel>

      {/* Пополнение расчётного счёта из кредитов игры */}
      <Panel title="📤 Пополнить расчётный счёт" className="border-yellow-500/30">
        <p className="text-sm text-slate-400 mb-3">
          Переведите кредиты из колонии на расчётный счёт для покупки акций и фондов
        </p>
        <div className="flex gap-2 mb-2">
          {QUICK_PERCENTS.map(percent => (
            <button
              key={percent}
              type="button"
              onClick={() => {
                const amount = creditsBalance.mul(percent / 100);
                if (amount.gt(0)) {
                  onTransfer(amount, 'toBank');
                }
              }}
              disabled={creditsBalance.lte(0)}
              className="btn flex-1 font-mono tabular-nums"
            >
              {percent}%
            </button>
          ))}
        </div>
        <div className="text-xs text-slate-500 text-center">
          Доступно: <span className="font-mono tabular-nums">{formatNumber(creditsBalance)}</span> ₡
        </div>
      </Panel>

      {/* Вывод с расчётного счёта в кредиты игры */}
      {D(bank.balance).gt(0) && (
        <Panel title="💸 Вывести в кредиты игры" className="border-blue-500/30">
          <p className="text-sm text-slate-400 mb-3">
            Переведите средства с расчётного счёта в основные кредиты колонии
          </p>
          <button
            type="button"
            onClick={() => {
              const currentBalance = D(bank.balance);
              if (currentBalance.gt(0)) {
                onTransfer(currentBalance, 'fromBank');
              }
            }}
            className="btn-info btn-block"
          >
            Вывести всё ({formatNumber(D(bank.balance))} ₡)
          </button>
        </Panel>
      )}

      {/* Депозит */}
      <Panel title="📥 Внести на сберегательный">
        <div className="flex gap-2 mb-3">
          <input
            type="number"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            placeholder="Сумма"
            className="flex-1 px-3 py-2"
          />
          <button
            type="button"
            onClick={handleDeposit}
            disabled={!depositAmount || D(depositAmount).lte(0) || D(depositAmount).gt(creditsBalance)}
            className="btn-primary"
          >
            Внести
          </button>
        </div>

        <div className="flex gap-2">
          {QUICK_PERCENTS.map(percent => (
            <button
              key={percent}
              type="button"
              onClick={() => handleQuickDeposit(percent)}
              disabled={creditsBalance.lte(0)}
              className="btn flex-1 font-mono tabular-nums"
            >
              {percent}%
            </button>
          ))}
        </div>
      </Panel>

      {/* Снятие */}
      <Panel title="📤 Снять со сберегательного">
        <div className="flex gap-2 mb-3">
          <input
            type="number"
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value)}
            placeholder="Сумма"
            className="flex-1 px-3 py-2"
          />
          <button
            type="button"
            onClick={handleWithdraw}
            disabled={!withdrawAmount || D(withdrawAmount).lte(0) || D(withdrawAmount).gt(D(bank.savingsBalance))}
            className="btn-info"
          >
            Снять
          </button>
        </div>

        <div className="flex gap-2">
          {QUICK_PERCENTS.map(percent => (
            <button
              key={percent}
              type="button"
              onClick={() => handleQuickWithdraw(percent)}
              disabled={D(bank.savingsBalance).lte(0)}
              className="btn flex-1 font-mono tabular-nums"
            >
              {percent}%
            </button>
          ))}
        </div>
      </Panel>

      {/* Информация */}
      <Panel title="ℹ️ Информация">
        <ul className="space-y-1 list-disc list-inside text-sm text-slate-400">
          <li>Проценты начисляются автоматически каждые 5 минут</li>
          <li>
            Ставка: <span className="font-mono tabular-nums">{periodRatePercent}</span>% за период
            (≈<span className="font-mono tabular-nums">{annualRatePercent}</span>% годовых при сложных %)
          </li>
          <li>Сбережения защищены и не используются для покупок</li>
          <li>Вы можете снять средства в любой момент без штрафов</li>
        </ul>
      </Panel>
    </div>
  );
}
