/**
 * Компонент отображения офлайн-прибыли
 * Показывается при входе в игру если автотрейдер работал пока пользователь отсутствовал
 */

import React from 'react';
import { useAdvisorStore } from '../../../features/advisorStore';
import { useFinanceStore } from '../../../features/financeStore';
import { D, formatNumber } from '../../../core/math/format';

interface OfflineProfitModalProps {
  onClose: () => void;
  onCollect: () => void;
}

export const OfflineProfitModal: React.FC<OfflineProfitModalProps> = ({ onClose, onCollect }) => {
  const { offlineProfit, clearOfflineProfit } = useAdvisorStore();
  const { depositToBank } = useFinanceStore();

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

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl max-w-md w-full p-6 animate-fade-in">
        {/* Заголовок */}
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">
            {isPositive ? '📈' : '📉'}
          </div>
          <h2 className="text-xl font-bold text-white mb-2">
            С возвращением!
          </h2>
          <p className="text-gray-400 text-sm">
            Пока вас не было ({offlineProfit.offlineTimeFormatted}), ваш AI-трейдер работал
          </p>
        </div>

        {/* Результат */}
        <div className={`text-center p-4 rounded-lg mb-4 ${
          isPositive ? 'bg-green-900/30 border border-green-700' : 'bg-red-900/30 border border-red-700'
        }`}>
          <div className="text-sm text-gray-400 mb-1">
            Результат офлайн-торговли
          </div>
          <div className={`text-3xl font-bold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
            {isPositive ? '+' : ''}{formatNumber(D(offlineProfit.totalProfit || '0'))} ¤
          </div>
          <div className="text-sm text-gray-500 mt-1">
            {offlineProfit.tradesExecuted} сделок выполнено
          </div>
        </div>

        {/* Детали */}
        <div className="bg-gray-800/50 rounded-lg p-3 mb-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-400">Профиль риска:</span>
            <span className="text-white capitalize">
              {offlineProfit.riskTolerance === 'conservative' && '🛡️ Консервативный'}
              {offlineProfit.riskTolerance === 'balanced' && '⚖️ Сбалансированный'}
              {offlineProfit.riskTolerance === 'aggressive' && '🚀 Агрессивный'}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Эффективность офлайн:</span>
            <span className="text-yellow-400">{offlineProfit.efficiencyPercent}%</span>
          </div>
        </div>

        {/* Список сделок (первые 5) */}
        {offlineProfit.trades && offlineProfit.trades.length > 0 && (
          <div className="mb-4">
            <div className="text-sm text-gray-400 mb-2">Последние сделки:</div>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {offlineProfit.trades.slice(0, 5).map((trade, index) => (
                <div 
                  key={index}
                  className="flex justify-between text-xs bg-gray-800/30 rounded px-2 py-1"
                >
                  <span className="text-gray-300">
                    {trade.asset.toUpperCase()}
                  </span>
                  <span className={parseFloat(trade.profit) >= 0 ? 'text-green-400' : 'text-red-400'}>
                    {parseFloat(trade.profit) >= 0 ? '+' : ''}{trade.profit} ¤
                  </span>
                </div>
              ))}
              {offlineProfit.trades.length > 5 && (
                <div className="text-xs text-gray-500 text-center">
                  ... и ещё {offlineProfit.trades.length - 5} сделок
                </div>
              )}
            </div>
          </div>
        )}

        {/* Информация */}
        <div className="text-xs text-gray-500 text-center mb-4">
          💡 Офлайн-торговля работает с эффективностью {offlineProfit.efficiencyPercent}% от онлайн.
          <br />
          Играйте онлайн для максимальной прибыли!
        </div>

        {/* Кнопки */}
        <div className="flex gap-3">
          <button
            onClick={handleClose}
            className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
          >
            Закрыть
          </button>
          <button
            onClick={handleCollect}
            className={`flex-1 px-4 py-2 rounded-lg transition font-medium ${
              isPositive 
                ? 'bg-green-600 hover:bg-green-500 text-white' 
                : 'bg-gray-600 hover:bg-gray-500 text-white'
            }`}
          >
            {isPositive ? '💰 Забрать прибыль' : 'Понятно'}
          </button>
        </div>
      </div>
    </div>
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
