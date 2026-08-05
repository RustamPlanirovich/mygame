/**
 * Список рыночных цен
 */

import { useEffect } from 'react';
import { useMarketStore } from '../../../features/marketStore';
import { formatPrice, formatVolume, formatPriceChange, getPriceChangeColor } from '../../../utils/marketApi';
import { RESOURCE_NAMES } from './OrderForm';
import type { TradeResourceType } from '../../../core/gameTypes.market';

interface PriceListProps {
  compact?: boolean;
}

export function PriceList({ compact = false }: PriceListProps) {
  // Узкие селекторы вместо подписки на весь стор.
  const prices = useMarketStore((s) => s.prices);
  const fetchPrices = useMarketStore((s) => s.fetchPrices);
  const setSelectedResource = useMarketStore((s) => s.setSelectedResource);
  const setActiveTab = useMarketStore((s) => s.setActiveTab);
  const isLoading = useMarketStore((s) => s.isLoading);

  useEffect(() => {
    fetchPrices();
    // Обновляем каждые 30 секунд
    const interval = setInterval(fetchPrices, 30000);
    return () => clearInterval(interval);
  }, [fetchPrices]);

  const handleResourceClick = (resource: TradeResourceType) => {
    setSelectedResource(resource);
    setActiveTab('orders');
  };

  // Сортируем по объёму торгов
  const sortedPrices = [...prices]
    .filter(p => parseFloat(p.lastPrice) > 0)
    .sort((a, b) => parseFloat(b.volume24h) - parseFloat(a.volume24h));

  if (compact) {
    return (
      <div className="bg-gray-800 rounded-lg p-3">
        <h3 className="text-sm font-bold mb-2 flex items-center gap-1.5">
          <span>💹</span>
          <span>Топ по объёму</span>
        </h3>

        {isLoading && (
          <div className="text-center text-gray-400 py-2 text-sm">Загрузка...</div>
        )}

        {!isLoading && sortedPrices.length === 0 && (
          <div className="text-center text-gray-400 py-2 text-sm">
            Нет данных о ценах
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-1.5">
          {sortedPrices.slice(0, 10).map(price => (
            <button
              key={price.resource}
              onClick={() => handleResourceClick(price.resource)}
              className="flex flex-col p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-left"
            >
              <span className="text-xs font-medium text-gray-300 truncate">
                {RESOURCE_NAMES[price.resource as TradeResourceType] || price.resource}
              </span>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-yellow-400 font-bold text-sm">
                  {formatPrice(price.lastPrice)}
                </span>
                <span className={`text-xs ${getPriceChangeColor(price.priceChange24h)}`}>
                  {formatPriceChange(price.priceChange24h)}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
        <span>💹</span>
        <span>Рыночные цены</span>
        <span className="text-sm font-normal text-gray-400">
          (обновляется каждые 30 сек)
        </span>
      </h3>

      {isLoading && (
        <div className="text-center text-gray-400 py-8">Загрузка...</div>
      )}

      {!isLoading && sortedPrices.length === 0 && (
        <div className="text-center text-gray-400 py-8">
          Нет данных о ценах. Сделки ещё не совершались.
        </div>
      )}

      {!isLoading && sortedPrices.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left py-2 px-2">Ресурс</th>
                <th className="text-right py-2 px-2">Цена</th>
                <th className="text-right py-2 px-2">24ч</th>
                <th className="text-right py-2 px-2">Мин</th>
                <th className="text-right py-2 px-2">Макс</th>
                <th className="text-right py-2 px-2">Объём 24ч</th>
              </tr>
            </thead>
            <tbody>
              {sortedPrices.map(price => (
                <tr 
                  key={price.resource}
                  onClick={() => handleResourceClick(price.resource)}
                  className="border-b border-gray-700/50 hover:bg-gray-700/30 cursor-pointer"
                >
                  <td className="py-2 px-2 font-medium">
                    {RESOURCE_NAMES[price.resource as TradeResourceType] || price.resource}
                  </td>
                  <td className="py-2 px-2 text-right text-yellow-400 font-bold">
                    {formatPrice(price.lastPrice)}
                  </td>
                  <td className={`py-2 px-2 text-right ${getPriceChangeColor(price.priceChange24h)}`}>
                    {formatPriceChange(price.priceChange24h)}
                  </td>
                  <td className="py-2 px-2 text-right text-red-400">
                    {formatPrice(price.lowPrice24h)}
                  </td>
                  <td className="py-2 px-2 text-right text-green-400">
                    {formatPrice(price.highPrice24h)}
                  </td>
                  <td className="py-2 px-2 text-right">
                    {formatVolume(price.volume24h)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
