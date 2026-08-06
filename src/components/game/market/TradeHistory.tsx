/**
 * История сделок
 */

import { useEffect } from 'react';
import { useMarketStore } from '../../../features/marketStore';
import { formatPrice, formatVolume } from '../../../utils/marketApi';
import { RESOURCE_NAMES } from './OrderForm';
import type { TradeResourceType } from '../../../core/gameTypes.market';
import { GameIcon } from '../../ui/icons';

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
      {/* Статистика: три плитки по ~120px — крупный шрифт и «Уплачено комиссий» туда не влезали */}
      <div className="grid grid-cols-3 gap-2">
        <div className="min-w-0 rounded-lg bg-gray-800 p-2 text-center">
          <div className="truncate text-lg font-bold tabular-nums text-blue-400">{stats.totalTrades}</div>
          <div className="truncate text-2xs text-gray-400">Всего сделок</div>
        </div>
        <div className="min-w-0 rounded-lg bg-gray-800 p-2 text-center">
          <div className="truncate text-lg font-bold tabular-nums text-yellow-400">
            {formatVolume(stats.totalVolume)}
          </div>
          <div className="truncate text-2xs text-gray-400">Объём <GameIcon icon="💳" /></div>
        </div>
        <div className="min-w-0 rounded-lg bg-gray-800 p-2 text-center">
          <div className="truncate text-lg font-bold tabular-nums text-red-400">
            {formatVolume(stats.totalFees)}
          </div>
          <div className="truncate text-2xs text-gray-400">Комиссии <GameIcon icon="💳" /></div>
        </div>
      </div>

      {/* Таблица сделок */}
      <div className="bg-gray-800 rounded-lg p-3">
        <h3 className="mb-2 flex flex-wrap items-baseline gap-x-2 text-sm font-bold">
          <span><GameIcon icon="📜" /></span>
          <span>История сделок</span>
          <span className="text-2xs font-normal text-gray-400">
            показано {tradeHistory.length} из {tradeHistoryTotal}
          </span>
        </h3>

        {isLoading && (
          <div className="py-4 text-center text-xs text-gray-400">Загрузка...</div>
        )}

        {!isLoading && tradeHistory.length === 0 && (
          <div className="py-4 text-center text-xs text-gray-400">
            У вас пока нет завершённых сделок
          </div>
        )}

        {!isLoading && tradeHistory.length > 0 && (
          <div className="-mx-1 overflow-x-auto px-1">
            <table className="w-full min-w-[520px] text-xs">
              <thead>
                <tr className="text-gray-400 border-b border-gray-700">
                  <th className="whitespace-nowrap py-1.5 px-1.5 text-left">Дата</th>
                  <th className="whitespace-nowrap py-1.5 px-1.5 text-left">Ресурс</th>
                  <th className="whitespace-nowrap py-1.5 px-1.5 text-right">Кол-во</th>
                  <th className="whitespace-nowrap py-1.5 px-1.5 text-right">Цена</th>
                  <th className="whitespace-nowrap py-1.5 px-1.5 text-right">Сумма</th>
                  <th className="whitespace-nowrap py-1.5 px-1.5 text-right">Комиссия</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {tradeHistory.map(trade => (
                  <tr 
                    key={trade.id} 
                    className="border-b border-gray-700/50 hover:bg-gray-700/30"
                  >
                    <td className="whitespace-nowrap py-1.5 px-1.5 text-gray-400">
                      {formatTime(trade.executedAt)}
                    </td>
                    <td className="whitespace-nowrap py-1.5 px-1.5 font-medium">
                      {RESOURCE_NAMES[trade.resource as TradeResourceType] || trade.resource}
                    </td>
                    <td className="whitespace-nowrap py-1.5 px-1.5 text-right">
                      {formatVolume(trade.quantity)}
                    </td>
                    <td className="whitespace-nowrap py-1.5 px-1.5 text-right text-yellow-400">
                      {formatPrice(trade.pricePerUnit)}
                    </td>
                    <td className="whitespace-nowrap py-1.5 px-1.5 text-right font-bold text-green-400">
                      {formatPrice(trade.totalAmount)} <GameIcon icon="💳" />
                    </td>
                    <td className="whitespace-nowrap py-1.5 px-1.5 text-right text-red-400">
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
