/**
 * Список рыночных цен
 */

import { useEffect } from 'react';
import { useMarketStore } from '../../../features/marketStore';
import { formatPrice, formatVolume, formatPriceChange, getPriceChangeColor } from '../../../utils/marketApi';
import { RESOURCE_NAMES } from './OrderForm';
import type { TradeResourceType } from '../../../core/gameTypes.market';
import { GameIcon } from '../../ui/icons';

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
          <span><GameIcon icon="💹" /></span>
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

        {/*
          Ровно две колонки. До этого сетка расширялась до пяти по ширине ОКНА, а не
          панели: в 400-пиксельной колонке карточка ужималась до ~75px и изменение
          цены («−15.52%») обрезалось на середине.
        */}
        <div className="grid grid-cols-2 gap-1.5">
          {sortedPrices.slice(0, 10).map(price => (
            <button
              key={price.resource}
              onClick={() => handleResourceClick(price.resource)}
              className="flex min-w-0 flex-col p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-left"
            >
              <span className="text-xs font-medium text-gray-300 truncate">
                {RESOURCE_NAMES[price.resource as TradeResourceType] || price.resource}
              </span>
              <div className="mt-0.5 flex min-w-0 items-baseline justify-between gap-1">
                <span className="truncate text-yellow-400 font-bold text-sm tabular-nums">
                  {formatPrice(price.lastPrice)}
                </span>
                <span className={`shrink-0 text-2xs tabular-nums ${getPriceChangeColor(price.priceChange24h)}`}>
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
    <div className="bg-gray-800 rounded-lg p-3">
      <h3 className="mb-3 flex flex-wrap items-baseline gap-x-2 text-sm font-bold">
        <span><GameIcon icon="💹" /></span>
        <span>Рыночные цены</span>
        <span className="text-2xs font-normal text-gray-400">
          обновляется каждые 30 сек
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

      {/*
        Шесть колонок в 400-пиксельную панель не влезают ни при каком размере шрифта,
        поэтому таблица прокручивается вбок целиком (`min-w`), а не ужимает колонки
        до нечитаемого состояния и не рвёт числа по разрядам.
      */}
      {!isLoading && sortedPrices.length > 0 && (
        <div className="-mx-1 overflow-x-auto px-1">
          <table className="w-full min-w-[460px] text-xs">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="whitespace-nowrap py-1.5 px-1.5 text-left">Ресурс</th>
                <th className="whitespace-nowrap py-1.5 px-1.5 text-right">Цена</th>
                <th className="whitespace-nowrap py-1.5 px-1.5 text-right">24ч</th>
                <th className="whitespace-nowrap py-1.5 px-1.5 text-right">Мин</th>
                <th className="whitespace-nowrap py-1.5 px-1.5 text-right">Макс</th>
                <th className="whitespace-nowrap py-1.5 px-1.5 text-right">Объём</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {sortedPrices.map(price => (
                <tr
                  key={price.resource}
                  onClick={() => handleResourceClick(price.resource)}
                  className="border-b border-gray-700/50 hover:bg-gray-700/30 cursor-pointer"
                >
                  <td className="whitespace-nowrap py-1.5 px-1.5 font-medium">
                    {RESOURCE_NAMES[price.resource as TradeResourceType] || price.resource}
                  </td>
                  <td className="whitespace-nowrap py-1.5 px-1.5 text-right text-yellow-400 font-bold">
                    {formatPrice(price.lastPrice)}
                  </td>
                  <td className={`whitespace-nowrap py-1.5 px-1.5 text-right ${getPriceChangeColor(price.priceChange24h)}`}>
                    {formatPriceChange(price.priceChange24h)}
                  </td>
                  <td className="whitespace-nowrap py-1.5 px-1.5 text-right text-red-400">
                    {formatPrice(price.lowPrice24h)}
                  </td>
                  <td className="whitespace-nowrap py-1.5 px-1.5 text-right text-green-400">
                    {formatPrice(price.highPrice24h)}
                  </td>
                  <td className="whitespace-nowrap py-1.5 px-1.5 text-right">
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
