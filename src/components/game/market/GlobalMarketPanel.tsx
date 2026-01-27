/**
 * Главная панель глобальной биржи - компактная версия
 */

import { useEffect } from 'react';
import { useMarketStore } from '../../../features/marketStore';
import { OrderBook } from './OrderBook';
import { OrderForm } from './OrderForm';
import { MyOrders } from './MyOrders';
import { TradeHistory } from './TradeHistory';
import { PriceList } from './PriceList';
import { TraderLeaderboard } from './TraderLeaderboard';
import { GuildPanel } from './GuildPanel';

const TABS = [
  { id: 'orders', label: '📊 Биржа' },
  { id: 'myOrders', label: '📋 Мои ордера' },
  { id: 'history', label: '📜 История' },
] as const;

const SECONDARY_TABS = [
  { id: 'prices', label: '💹 Цены' },
  { id: 'leaderboard', label: '🏆 Лидеры' },
  { id: 'guild', label: '🏰 Гильдия' },
] as const;

export function GlobalMarketPanel() {
  const { 
    activeTab, 
    setActiveTab, 
    isLoading, 
    error, 
    clearError,
    fetchPrices,
    fetchMyGuild,
  } = useMarketStore();

  useEffect(() => {
    fetchPrices();
    fetchMyGuild();
  }, [fetchPrices, fetchMyGuild]);

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white">
      {/* Компактный заголовок */}
      <div className="px-3 py-2 border-b border-gray-700 flex items-center justify-between">
        <h2 className="text-base font-bold flex items-center gap-1.5">
          <span>🌐</span>
          <span>Глобальная биржа</span>
        </h2>
        <span className="text-xs text-gray-500">Торгуйте с другими игроками</span>
      </div>

      {/* Вкладки - две строки для компактности */}
      <div className="border-b border-gray-700">
        <div className="flex">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-2 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
          {SECONDARY_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-2 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-500 hover:text-white hover:bg-gray-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Ошибка - компактная */}
      {error && (
        <div className="mx-2 mt-2 p-2 bg-red-900/50 border border-red-500 rounded text-xs flex items-center justify-between">
          <span className="text-red-200">{error}</span>
          <button onClick={clearError} className="text-red-400 hover:text-red-200 ml-2">✕</button>
        </div>
      )}

      {/* Индикатор загрузки */}
      {isLoading && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-blue-500 animate-pulse" />
      )}

      {/* Контент */}
      <div className="flex-1 overflow-auto p-2">
        {activeTab === 'orders' && (
          <div className="space-y-2">
            {/* Форма и книга рядом */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <OrderForm />
              <OrderBook />
            </div>
            {/* Топ цен снизу */}
            <PriceList compact />
          </div>
        )}
        
        {activeTab === 'myOrders' && <MyOrders />}
        {activeTab === 'history' && <TradeHistory />}
        {activeTab === 'prices' && <PriceList />}
        {activeTab === 'leaderboard' && <TraderLeaderboard />}
        {activeTab === 'guild' && <GuildPanel />}
      </div>
    </div>
  );
}
