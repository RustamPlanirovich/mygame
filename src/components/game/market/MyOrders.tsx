/**
 * Список моих ордеров
 */

import { useEffect } from 'react';
import { useMarketStore } from '../../../features/marketStore';
import { formatPrice, formatVolume } from '../../../utils/marketApi';
import { RESOURCE_NAMES } from './OrderForm';
import type { TradeResourceType } from '../../../core/gameTypes.market';
import { GameIcon, IconText } from '../../ui/icons';

export function MyOrders() {
  // Узкие селекторы вместо подписки на весь стор: список ордеров не должен
  // перерисовываться от загрузки цен, гильдии или журнала сейфа.
  const myOrders = useMarketStore((s) => s.myOrders);
  const fetchMyOrders = useMarketStore((s) => s.fetchMyOrders);
  const cancelOrder = useMarketStore((s) => s.cancelOrder);
  const isLoading = useMarketStore((s) => s.isLoading);

  useEffect(() => {
    fetchMyOrders();
  }, [fetchMyOrders]);

  const activeOrders = myOrders.filter(o => o.status === 'open' || o.status === 'partial');
  const completedOrders = myOrders.filter(o => o.status !== 'open' && o.status !== 'partial');

  const handleCancel = async (orderId: string) => {
    if (confirm('Отменить этот ордер?')) {
      await cancelOrder(orderId);
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'open': return { text: 'Активен', color: 'text-blue-400' };
      case 'partial': return { text: 'Частично', color: 'text-yellow-400' };
      case 'filled': return { text: 'Исполнен', color: 'text-green-400' };
      case 'cancelled': return { text: 'Отменён', color: 'text-gray-400' };
      case 'expired': return { text: 'Истёк', color: 'text-red-400' };
      default: return { text: status, color: 'text-gray-400' };
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getProgress = (quantity: string, quantityFilled: string) => {
    const qty = parseFloat(quantity);
    const filled = parseFloat(quantityFilled);
    return qty > 0 ? (filled / qty) * 100 : 0;
  };

  return (
    <div className="space-y-3">
      {/* Активные ордера */}
      <div className="bg-gray-800 rounded-lg p-3">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-bold">
          <span><GameIcon icon="📋" /></span>
          <span>Активные ордера</span>
          <span className="text-2xs font-normal text-gray-400">
            ({activeOrders.length})
          </span>
        </h3>

        {isLoading && (
          <div className="py-4 text-center text-xs text-gray-400">Загрузка...</div>
        )}

        {!isLoading && activeOrders.length === 0 && (
          <div className="py-4 text-center text-xs text-gray-400">
            У вас нет активных ордеров
          </div>
        )}

        {!isLoading && activeOrders.length > 0 && (
          <div className="space-y-2">
            {activeOrders.map(order => (
              <div
                key={order.id}
                className="bg-gray-700 rounded-lg p-2.5"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-1.5 text-xs">
                    <span className={`shrink-0 ${order.type === 'buy' ? 'text-green-400' : 'text-red-400'}`}>
                      <IconText>{order.type === 'buy' ? '🛒 Покупка' : '💰 Продажа'}</IconText>
                    </span>
                    <span className="truncate font-bold">
                      {RESOURCE_NAMES[order.resource as TradeResourceType] || order.resource}
                    </span>
                  </div>
                  <button
                    onClick={() => handleCancel(order.id)}
                    className="shrink-0 whitespace-nowrap rounded bg-red-900/30 px-2 py-1 text-2xs text-red-400 hover:text-red-300"
                  >
                    <GameIcon icon="✕" /> Отменить
                  </button>
                </div>

                {/* Три колонки по ~110px: подписи мелкие и в одну строку, значения — моноширинные */}
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="min-w-0">
                    <div className="truncate text-2xs text-gray-400">Кол-во</div>
                    <div className="truncate font-medium tabular-nums">
                      {formatVolume(order.quantityFilled)}/{formatVolume(order.quantity)}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-2xs text-gray-400">Цена</div>
                    <div className="truncate font-medium tabular-nums text-yellow-400">
                      {formatPrice(order.pricePerUnit)}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-2xs text-gray-400">Истекает</div>
                    <div className="truncate font-medium tabular-nums">
                      {formatTime(order.expiresAt)}
                    </div>
                  </div>
                </div>

                {/* Прогресс-бар */}
                <div className="mt-2">
                  <div className="h-1 bg-gray-600 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${order.type === 'buy' ? 'bg-green-500' : 'bg-red-500'}`}
                      style={{ width: `${getProgress(order.quantity, order.quantityFilled)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* История ордеров */}
      <div className="bg-gray-800 rounded-lg p-3">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-bold">
          <span><GameIcon icon="📜" /></span>
          <span>Завершённые ордера</span>
          <span className="text-2xs font-normal text-gray-400">
            ({completedOrders.length})
          </span>
        </h3>

        {completedOrders.length === 0 && (
          <div className="py-4 text-center text-xs text-gray-400">
            Нет завершённых ордеров
          </div>
        )}

        {/* Шесть колонок не влезают в панель — таблица прокручивается вбок целиком. */}
        {completedOrders.length > 0 && (
          <div className="-mx-1 overflow-x-auto px-1">
            <table className="w-full min-w-[440px] text-xs">
              <thead>
                <tr className="text-gray-400 border-b border-gray-700">
                  <th className="whitespace-nowrap py-1.5 pr-1.5 text-left">Тип</th>
                  <th className="whitespace-nowrap py-1.5 pr-1.5 text-left">Ресурс</th>
                  <th className="whitespace-nowrap py-1.5 pr-1.5 text-right">Кол-во</th>
                  <th className="whitespace-nowrap py-1.5 pr-1.5 text-right">Цена</th>
                  <th className="whitespace-nowrap py-1.5 pr-1.5 text-left">Статус</th>
                  <th className="whitespace-nowrap py-1.5 text-right">Дата</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {completedOrders.slice(0, 20).map(order => {
                  const status = getStatusLabel(order.status);
                  return (
                    <tr key={order.id} className="border-b border-gray-700/50">
                      <td className="whitespace-nowrap py-1.5 pr-1.5">
                        <span className={order.type === 'buy' ? 'text-green-400' : 'text-red-400'}>
                          <IconText>{order.type === 'buy' ? '🛒' : '💰'}</IconText>
                        </span>
                      </td>
                      <td className="whitespace-nowrap py-1.5 pr-1.5">
                        {RESOURCE_NAMES[order.resource as TradeResourceType] || order.resource}
                      </td>
                      <td className="whitespace-nowrap py-1.5 pr-1.5 text-right">
                        {formatVolume(order.quantityFilled)}/{formatVolume(order.quantity)}
                      </td>
                      <td className="whitespace-nowrap py-1.5 pr-1.5 text-right text-yellow-400">
                        {formatPrice(order.pricePerUnit)}
                      </td>
                      <td className={`whitespace-nowrap py-1.5 pr-1.5 ${status.color}`}>
                        <IconText>{status.text}</IconText>
                      </td>
                      <td className="whitespace-nowrap py-1.5 text-right text-gray-400">
                        {formatTime(order.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
