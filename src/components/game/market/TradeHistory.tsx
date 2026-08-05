/**
 * История сделок
 */

import { useEffect } from 'react';
import { useMarketStore } from '../../../features/marketStore';
import { formatPrice, formatVolume } from '../../../utils/marketApi';
import { RESOURCE_NAMES } from './OrderForm';
import type { TradeResourceType } from '../../../core/gameTypes.market';

export function TradeHistory() {
  // Узкие селекторы вместо подписки на весь стор.
  const tradeHistory = useMarketStore((s) => s.tradeHistory);
  const tradeHistoryTotal = useMarketStore((s) => s.tradeHistoryTotal);
  const fetchTradeHistory = useMarketStore((s) => s.fetchTradeHistory);
  const isLoading = useMarketStore((s) => s.isLoading);

  useEffect(() => {
    fetchTradeHistory();
  }, [fetchTradeHistory]);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Подсчёт статистики
  const stats = {
    totalTrades: tradeHistory.length,
    totalVolume: tradeHistory.reduce((sum, t) => sum + parseFloat(t.totalAmount), 0),
    totalFees: tradeHistory.reduce((sum, t) => sum + parseFloat(t.fee), 0),
  };

  return (
    <div className="space-y-4">
      {/* Статистика */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-800 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-blue-400">{stats.totalTrades}</div>
          <div className="text-sm text-gray-400">Всего сделок</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-yellow-400">
            {formatVolume(stats.totalVolume)}
          </div>
          <div className="text-sm text-gray-400">Общий объём 💳</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-red-400">
            {formatVolume(stats.totalFees)}
          </div>
          <div className="text-sm text-gray-400">Уплачено комиссий 💳</div>
        </div>
      </div>

      {/* Таблица сделок */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <span>📜</span>
          <span>История сделок</span>
          <span className="text-sm font-normal text-gray-400">
            (показано {tradeHistory.length} из {tradeHistoryTotal})
          </span>
        </h3>

        {isLoading && (
          <div className="text-center text-gray-400 py-8">Загрузка...</div>
        )}

        {!isLoading && tradeHistory.length === 0 && (
          <div className="text-center text-gray-400 py-8">
            У вас пока нет завершённых сделок
          </div>
        )}

        {!isLoading && tradeHistory.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-gray-700">
                  <th className="text-left py-2 px-2">Дата</th>
                  <th className="text-left py-2 px-2">Ресурс</th>
                  <th className="text-right py-2 px-2">Кол-во</th>
                  <th className="text-right py-2 px-2">Цена</th>
                  <th className="text-right py-2 px-2">Сумма</th>
                  <th className="text-right py-2 px-2">Комиссия</th>
                </tr>
              </thead>
              <tbody>
                {tradeHistory.map(trade => (
                  <tr 
                    key={trade.id} 
                    className="border-b border-gray-700/50 hover:bg-gray-700/30"
                  >
                    <td className="py-2 px-2 text-gray-400">
                      {formatTime(trade.executedAt)}
                    </td>
                    <td className="py-2 px-2 font-medium">
                      {RESOURCE_NAMES[trade.resource as TradeResourceType] || trade.resource}
                    </td>
                    <td className="py-2 px-2 text-right">
                      {formatVolume(trade.quantity)}
                    </td>
                    <td className="py-2 px-2 text-right text-yellow-400">
                      {formatPrice(trade.pricePerUnit)}
                    </td>
                    <td className="py-2 px-2 text-right font-bold text-green-400">
                      {formatPrice(trade.totalAmount)} 💳
                    </td>
                    <td className="py-2 px-2 text-right text-red-400">
                      -{formatPrice(trade.fee)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
