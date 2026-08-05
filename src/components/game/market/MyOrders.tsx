/**
 * Список моих ордеров
 */

import { useEffect } from 'react';
import { useMarketStore } from '../../../features/marketStore';
import { formatPrice, formatVolume } from '../../../utils/marketApi';
import { RESOURCE_NAMES } from './OrderForm';
import type { TradeResourceType } from '../../../core/gameTypes.market';

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
    <div className="space-y-6">
      {/* Активные ордера */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <span>📋</span>
          <span>Активные ордера</span>
          <span className="text-sm font-normal text-gray-400">
            ({activeOrders.length})
          </span>
        </h3>

        {isLoading && (
          <div className="text-center text-gray-400 py-8">Загрузка...</div>
        )}

        {!isLoading && activeOrders.length === 0 && (
          <div className="text-center text-gray-400 py-8">
            У вас нет активных ордеров
          </div>
        )}

        {!isLoading && activeOrders.length > 0 && (
          <div className="space-y-3">
            {activeOrders.map(order => (
              <div 
                key={order.id}
                className="bg-gray-700 rounded-lg p-3"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={order.type === 'buy' ? 'text-green-400' : 'text-red-400'}>
                      {order.type === 'buy' ? '🛒 Покупка' : '💰 Продажа'}
                    </span>
                    <span className="font-bold">
                      {RESOURCE_NAMES[order.resource as TradeResourceType] || order.resource}
                    </span>
                  </div>
                  <button
                    onClick={() => handleCancel(order.id)}
                    className="text-red-400 hover:text-red-300 text-sm px-2 py-1 bg-red-900/30 rounded"
                  >
                    ✕ Отменить
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-gray-400">Количество</div>
                    <div className="font-medium">
                      {formatVolume(order.quantityFilled)} / {formatVolume(order.quantity)}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-400">Цена</div>
                    <div className="font-medium text-yellow-400">
                      {formatPrice(order.pricePerUnit)} 💳
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-400">Истекает</div>
                    <div className="font-medium">
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
      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <span>📜</span>
          <span>Завершённые ордера</span>
          <span className="text-sm font-normal text-gray-400">
            ({completedOrders.length})
          </span>
        </h3>

        {completedOrders.length === 0 && (
          <div className="text-center text-gray-400 py-8">
            Нет завершённых ордеров
          </div>
        )}

        {completedOrders.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-gray-700">
                  <th className="text-left py-2">Тип</th>
                  <th className="text-left py-2">Ресурс</th>
                  <th className="text-right py-2">Кол-во</th>
                  <th className="text-right py-2">Цена</th>
                  <th className="text-center py-2">Статус</th>
                  <th className="text-right py-2">Дата</th>
                </tr>
              </thead>
              <tbody>
                {completedOrders.slice(0, 20).map(order => {
                  const status = getStatusLabel(order.status);
                  return (
                    <tr key={order.id} className="border-b border-gray-700/50">
                      <td className="py-2">
                        <span className={order.type === 'buy' ? 'text-green-400' : 'text-red-400'}>
                          {order.type === 'buy' ? '🛒' : '💰'}
                        </span>
                      </td>
                      <td className="py-2">
                        {RESOURCE_NAMES[order.resource as TradeResourceType] || order.resource}
                      </td>
                      <td className="py-2 text-right">
                        {formatVolume(order.quantityFilled)}/{formatVolume(order.quantity)}
                      </td>
                      <td className="py-2 text-right text-yellow-400">
                        {formatPrice(order.pricePerUnit)}
                      </td>
                      <td className={`py-2 text-center ${status.color}`}>
                        {status.text}
                      </td>
                      <td className="py-2 text-right text-gray-400">
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
