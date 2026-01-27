/**
 * Книга ордеров (Order Book) - компактная версия
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
    setOrderFormPrice,
    setOrderFormType,
  } = useMarketStore();

  useEffect(() => {
    if (selectedResource) {
      fetchOrderBook(selectedResource);
      const interval = setInterval(() => fetchOrderBook(selectedResource), 10000);
      return () => clearInterval(interval);
    }
  }, [selectedResource, fetchOrderBook]);

  const maxBidQuantity = orderBook?.bids.reduce((max, b) => 
    Math.max(max, parseFloat(b.quantity)), 0) || 1;
  const maxAskQuantity = orderBook?.asks.reduce((max, a) => 
    Math.max(max, parseFloat(a.quantity)), 0) || 1;

  // Клик на ордер — автозаполнение формы
  const handleBidClick = (price: string) => {
    setOrderFormPrice(price);
    setOrderFormType('sell'); // Продаём по цене покупателя
  };

  const handleAskClick = (price: string) => {
    setOrderFormPrice(price);
    setOrderFormType('buy'); // Покупаем по цене продавца
  };

  return (
    <div className="bg-gray-800 rounded-lg p-3">
      {/* Заголовок с выбором ресурса */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-bold">📖</span>
        <select
          value={selectedResource || ''}
          onChange={(e) => setSelectedResource(e.target.value as TradeResourceType || null)}
          className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-2 py-1.5 text-white text-sm"
        >
          <option value="">Выберите ресурс...</option>
          {TRADEABLE_RESOURCES.map(resource => (
            <option key={resource} value={resource}>
              {RESOURCE_NAMES[resource]}
            </option>
          ))}
        </select>
        {orderBook && (
          <div className="text-xs bg-gray-700 px-2 py-1 rounded">
            <span className="text-gray-400">Спред: </span>
            <span className="text-yellow-400 font-bold">{formatPrice(orderBook.spread)}</span>
          </div>
        )}
      </div>

      {!selectedResource && (
        <div className="text-center text-gray-500 text-sm py-4">
          Выберите ресурс
        </div>
      )}

      {selectedResource && isLoading && (
        <div className="text-center text-gray-400 py-4 text-sm">Загрузка...</div>
      )}

      {selectedResource && orderBook && !isLoading && (
        <div className="grid grid-cols-2 gap-2">
          {/* Bids (покупка) */}
          <div>
            <div className="text-xs font-bold text-green-400 mb-1 flex items-center gap-1">
              <span>🛒</span>
              <span>Покупка</span>
            </div>
            <div className="space-y-0.5 max-h-32 overflow-y-auto">
              {orderBook.bids.length === 0 ? (
                <div className="text-gray-500 text-xs text-center py-2">Нет</div>
              ) : (
                orderBook.bids.slice(0, 5).map((bid, index) => (
                  <button 
                    key={index}
                    onClick={() => handleBidClick(bid.price)}
                    className="w-full relative bg-gray-700 hover:bg-gray-600 rounded px-1.5 py-0.5 text-xs overflow-hidden transition-colors"
                    title="Нажмите для продажи по этой цене"
                  >
                    <div 
                      className="absolute inset-y-0 left-0 bg-green-600/30"
                      style={{ width: `${(parseFloat(bid.quantity) / maxBidQuantity) * 100}%` }}
                    />
                    <div className="relative flex justify-between">
                      <span className="text-green-400 font-medium">{formatPrice(bid.price)}</span>
                      <span className="text-gray-400">{formatVolume(bid.quantity)}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Asks (продажа) */}
          <div>
            <div className="text-xs font-bold text-red-400 mb-1 flex items-center gap-1">
              <span>💰</span>
              <span>Продажа</span>
            </div>
            <div className="space-y-0.5 max-h-32 overflow-y-auto">
              {orderBook.asks.length === 0 ? (
                <div className="text-gray-500 text-xs text-center py-2">Нет</div>
              ) : (
                orderBook.asks.slice(0, 5).map((ask, index) => (
                  <button 
                    key={index}
                    onClick={() => handleAskClick(ask.price)}
                    className="w-full relative bg-gray-700 hover:bg-gray-600 rounded px-1.5 py-0.5 text-xs overflow-hidden transition-colors"
                    title="Нажмите для покупки по этой цене"
                  >
                    <div 
                      className="absolute inset-y-0 right-0 bg-red-600/30"
                      style={{ width: `${(parseFloat(ask.quantity) / maxAskQuantity) * 100}%` }}
                    />
                    <div className="relative flex justify-between">
                      <span className="text-red-400 font-medium">{formatPrice(ask.price)}</span>
                      <span className="text-gray-400">{formatVolume(ask.quantity)}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
