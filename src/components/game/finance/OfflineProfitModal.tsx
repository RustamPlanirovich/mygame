/**
 * Компонент отображения офлайн-прибыли
 * Показывается при входе в игру если автотрейдер работал пока пользователь отсутствовал
 */

import React from 'react';
import { useAdvisorStore } from '../../../features/advisorStore';
import { useFinanceStore } from '../../../features/financeStore';
import { D, formatNumber } from '../../../core/math/format';
import { Alert, Modal } from '../../ui';

interface OfflineProfitModalProps {
  onClose: () => void;
  onCollect: () => void;
}

export const OfflineProfitModal: React.FC<OfflineProfitModalProps> = ({ onClose, onCollect }) => {
  // Точечные подписки: окно перерисовывается только когда меняется офлайн-прибыль,
  // а не на каждое обновление advisor/finance-стора.
  const offlineProfit = useAdvisorStore((s) => s.offlineProfit);
  const clearOfflineProfit = useAdvisorStore((s) => s.clearOfflineProfit);
  const depositToBank = useFinanceStore((s) => s.depositToBank);

  if (!offlineProfit || !offlineProfit.hasOfflineProfit) {
    return null;
  }

  const profit = parseFloat(offlineProfit.totalProfit || '0');
  const isPositive = profit >= 0;

  const handleCollect = () => {
    // Начисляем прибыль на банковский счёт
    if (profit > 0) {
      depositToBank(D(profit));
    }
    clearOfflineProfit();
    onCollect();
  };

  const handleClose = () => {
    // Начисляем прибыль даже при закрытии
    if (profit > 0) {
      depositToBank(D(profit));
    }
    clearOfflineProfit();
    onClose();
  };

  const riskLabel =
    offlineProfit.riskTolerance === 'conservative'
      ? '🛡️ Консервативный'
      : offlineProfit.riskTolerance === 'balanced'
        ? '⚖️ Сбалансированный'
        : offlineProfit.riskTolerance === 'aggressive'
          ? '🚀 Агрессивный'
          : '';

  return (
    <Modal
      open
      onClose={handleClose}
      size="sm"
      icon={<span className="text-lg">{isPositive ? '📈' : '📉'}</span>}
      title="С возвращением!"
      subtitle={`Пока вас не было (${offlineProfit.offlineTimeFormatted}), ваш AI-трейдер работал`}
      footer={
        <div className="flex gap-3">
          <button type="button" onClick={handleClose} className="btn flex-1">
            Закрыть
          </button>
          <button
            type="button"
            data-autofocus
            onClick={handleCollect}
            className={`${isPositive ? 'btn-primary' : 'btn'} flex-1`}
          >
            {isPositive ? '💰 Забрать прибыль' : 'Понятно'}
          </button>
        </div>
      }
    >
      <div className="space-y-4 p-4">
        {/* Результат */}
        <div
          className={`rounded-lg border p-4 text-center ${
            isPositive ? 'border-accent/40 bg-accent/10' : 'border-danger/40 bg-danger/10'
          }`}
        >
          <div className="stat-label">Результат офлайн-торговли</div>
          <div
            className={`mt-1 font-mono text-3xl font-bold tabular-nums ${
              isPositive ? 'text-accent' : 'text-danger'
            }`}
          >
            {isPositive ? '+' : ''}
            {formatNumber(D(offlineProfit.totalProfit || '0'))} ¤
          </div>
          <div className="mt-1 text-xs text-content-faint">
            <span className="font-mono tabular-nums">{offlineProfit.tradesExecuted}</span> сделок
            выполнено
          </div>
        </div>

        {/* Детали. Строки «подпись — значение», а не <Stat>: значение слева —
            текст, и моноширинный шрифт <Stat> смотрелся бы на нём чужеродно. */}
        <div className="card">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-content-faint">Профиль риска:</span>
            <span className="text-content-primary">{riskLabel}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-content-faint">Эффективность офлайн:</span>
            <span className="font-mono tabular-nums text-warning">
              {offlineProfit.efficiencyPercent}%
            </span>
          </div>
        </div>

        {/* Список сделок (первые 5) */}
        {offlineProfit.trades && offlineProfit.trades.length > 0 && (
          <div>
            <div className="stat-label mb-2">Последние сделки:</div>
            <div className="max-h-32 space-y-1 overflow-y-auto">
              {offlineProfit.trades.slice(0, 5).map((trade, index) => (
                <div
                  key={index}
                  className="flex justify-between rounded bg-surface-3 px-2 py-1 text-xs"
                >
                  <span className="font-mono text-content-secondary">
                    {trade.asset.toUpperCase()}
                  </span>
                  <span
                    className={`font-mono tabular-nums ${
                      parseFloat(trade.profit) >= 0 ? 'text-accent' : 'text-danger'
                    }`}
                  >
                    {parseFloat(trade.profit) >= 0 ? '+' : ''}
                    {trade.profit} ¤
                  </span>
                </div>
              ))}
              {offlineProfit.trades.length > 5 && (
                <div className="text-center text-xs text-content-faint">
                  ... и ещё {offlineProfit.trades.length - 5} сделок
                </div>
              )}
            </div>
          </div>
        )}

        {/* Информация */}
        <Alert tone="info">
          💡 Офлайн-торговля работает с эффективностью{' '}
          <span className="font-mono tabular-nums">{offlineProfit.efficiencyPercent}</span>% от
          онлайн.
          <br />
          Играйте онлайн для максимальной прибыли!
        </Alert>
      </div>
    </Modal>
  );
};

/**
 * Хук для автоматического сохранения состояния и heartbeat
 */
export function useOfflineTrading(slotId: number | null) {
  const { advisor, saveOfflineState, sendHeartbeat, calculateOfflineProfit } = useAdvisorStore();
  const [hasCalculated, setHasCalculated] = React.useState(false);

  // Проверяем, есть ли хотя бы базовый тариф
  const hasAdvisor = advisor.tier === 'basic' || advisor.tier === 'premium';

  // Логируем состояние при первой загрузке
  React.useEffect(() => {
    console.log('[OfflineTrading] Hook initialized:', {
      slotId,
      advisorTier: advisor.tier,
      hasAdvisor,
      autotraderEnabled: advisor.autoTrading.enabled,
      hasToken: !!localStorage.getItem('authToken'),
    });
  }, []);

  // Рассчитываем офлайн-прибыль при загрузке (даже без премиума - чтобы проверить)
  React.useEffect(() => {
    if (slotId && !hasCalculated) {
      console.log('[OfflineTrading] Calculating offline profit for slot:', slotId);
      calculateOfflineProfit(slotId).then((result) => {
        console.log('[OfflineTrading] Calculate result:', result);
        setHasCalculated(true);
      }).catch((err) => {
        console.error('[OfflineTrading] Calculate error:', err);
      });
    }
  }, [slotId, calculateOfflineProfit, hasCalculated]);

  // Сохраняем состояние при изменении настроек автотрейдера (без проверки тарифа)
  React.useEffect(() => {
    if (slotId) {
      console.log('[OfflineTrading] Saving state for slot:', slotId, 'autotrader:', advisor.autoTrading.enabled);
      saveOfflineState(slotId);
    }
  }, [
    slotId,
    advisor.autoTrading.enabled,
    advisor.autoTrading.riskTolerance,
    advisor.autoTrading.maxInvestmentPercent,
    saveOfflineState,
  ]);

  // Heartbeat и периодическое сохранение каждые 2 минуты
  React.useEffect(() => {
    if (!slotId) return;

    const interval = setInterval(() => {
      console.log('[OfflineTrading] Heartbeat + save for slot:', slotId);
      sendHeartbeat(slotId);
      saveOfflineState(slotId);
    }, 2 * 60 * 1000); // 2 минуты

    return () => clearInterval(interval);
  }, [slotId, sendHeartbeat, saveOfflineState]);

  // Сохраняем состояние перед закрытием страницы (без проверки тарифа)
  React.useEffect(() => {
    if (!slotId) {
      console.log('[OfflineTrading] No slotId, skipping beforeunload handler');
      return;
    }

    const handleBeforeUnload = () => {
      console.log('[OfflineTrading] beforeunload triggered, saving state...');
      // Используем sendBeacon для надёжной отправки
      const token = localStorage.getItem('authToken');
      const financeState = useFinanceStore.getState();

      console.log('[OfflineTrading] Beacon data:', {
        hasToken: !!token,
        slotId,
        autotraderEnabled: advisor.autoTrading.enabled,
        portfolioCount: financeState.positions?.length || 0,
      });

      if (token) {
        const success = navigator.sendBeacon(
          '/api/offline-trading/beacon-save',
          new Blob([JSON.stringify({
            token,
            slotId,
            autotraderEnabled: advisor.autoTrading.enabled,
            riskTolerance: advisor.autoTrading.riskTolerance,
            maxInvestmentPercent: advisor.autoTrading.maxInvestmentPercent,
            takeProfitPercent: advisor.autoTrading.takeProfitPercent,
            stopLossPercent: advisor.autoTrading.stopLossPercent,
            portfolio: financeState.positions,
            balance: financeState.bank.balance,
          })], { type: 'application/json' })
        );
        console.log('[OfflineTrading] sendBeacon result:', success);
      } else {
        console.log('[OfflineTrading] No auth token, cannot send beacon');
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    console.log('[OfflineTrading] beforeunload handler registered for slot:', slotId);

    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [slotId, advisor]);
}

export default OfflineProfitModal;
