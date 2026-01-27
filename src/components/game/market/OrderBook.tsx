/**
 * Книга ордеров (Order Book)
 */

import { useEffect } from 'react';
import { useMarketStore } from '../../../features/marketStore';
import { formatPrice, formatVolume } from '../../../utils/marketApi';
import { TRADEABLE_RESOURCES, RESOURCE_NAMES } from './OrderForm';
import type { TradeResourceType } from '../../../core/gameTypes.market';

export function OrderBook() {
  const {
    orderBook,
    selectedResource,
    setSelectedResource,
    fetchOrderBook,
    isLoading,
  } = useMarketStore();

  useEffect(() => {
    if (selectedResource) {
      fetchOrderBook(selectedResource);
      // Обновляем каждые 10 секунд
      const interval = setInterval(() => fetchOrderBook(selectedResource), 10000);
      return () => clearInterval(interval);
    }
  }, [selectedResource, fetchOrderBook]);

  const maxBidQuantity = orderBook?.bids.reduce((max, b) => 
    Math.max(max, parseFloat(b.quantity)), 0) || 1;
  const maxAskQuantity = orderBook?.asks.reduce((max, a) => 
    Math.max(max, parseFloat(a.quantity)), 0) || 1;

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
        <span>📖</span>
        <span>Книга ордеров</span>
      </h3>

      {/* Выбор ресурса */}
      <div className="mb-4">
        <select
          value={selectedResource || ''}
          onChange={(e) => setSelectedResource(e.target.value as TradeResourceType || null)}
          className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
        >
          <option value="">Выберите ресурс...</option>
          {TRADEABLE_RESOURCES.map(resource => (
            <option key={resource} value={resource}>
              {RESOURCE_NAMES[resource]}
            </option>
          ))}
        </select>
      </div>

      {!selectedResource && (
        <div className="text-center text-gray-400 py-8">
          Выберите ресурс для просмотра книги ордеров
        </div>
      )}

      {selectedResource && isLoading && (
        <div className="text-center text-gray-400 py-8">
          Загрузка...
        </div>
      )}

      {selectedResource && orderBook && !isLoading && (
        <div className="space-y-4">
          {/* Спред */}
          <div className="text-center bg-gray-700 rounded-lg py-2">
            <span className="text-gray-400 text-sm">Спред: </span>
            <span className="text-yellow-400 font-bold">
              {formatPrice(orderBook.spread)} 💳
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Bids (покупка) */}
            <div>
              <div className="text-sm font-bold text-green-400 mb-2">
                🛒 Покупка (Bids)
              </div>
              <div className="space-y-1">
                {orderBook.bids.length === 0 ? (
                  <div className="text-gray-500 text-sm text-center py-4">
                    Нет ордеров
                  </div>
                ) : (
                  orderBook.bids.map((bid, index) => (
                    <div 
                      key={index}
                      className="relative bg-gray-700 rounded px-2 py-1 text-sm overflow-hidden"
                    >
                      {/* Полоса объёма */}
                      <div 
                        className="absolute inset-y-0 left-0 bg-green-600/30"
                        style={{ 
                          width: `${(parseFloat(bid.quantity) / maxBidQuantity) * 100}%` 
                        }}
                      />
                      <div className="relative flex justify-between">
                        <span className="text-green-400">{formatPrice(bid.price)}</span>
                        <span className="text-gray-300">{formatVolume(bid.quantity)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Asks (продажа) */}
            <div>
              <div className="text-sm font-bold text-red-400 mb-2">
                💰 Продажа (Asks)
              </div>
              <div className="space-y-1">
                {orderBook.asks.length === 0 ? (
                  <div className="text-gray-500 text-sm text-center py-4">
                    Нет ордеров
                  </div>
                ) : (
                  orderBook.asks.map((ask, index) => (
                    <div 
                      key={index}
                      className="relative bg-gray-700 rounded px-2 py-1 text-sm overflow-hidden"
                    >
                      {/* Полоса объёма */}
                      <div 
                        className="absolute inset-y-0 right-0 bg-red-600/30"
                        style={{ 
                          width: `${(parseFloat(ask.quantity) / maxAskQuantity) * 100}%` 
                        }}
                      />
                      <div className="relative flex justify-between">
                        <span className="text-red-400">{formatPrice(ask.price)}</span>
                        <span className="text-gray-300">{formatVolume(ask.quantity)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
