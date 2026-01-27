/**
 * Главная панель глобальной биржи
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

  // Загружаем начальные данные при монтировании
  useEffect(() => {
    fetchPrices();
    fetchMyGuild();
  }, [fetchPrices, fetchMyGuild]);

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white">
      {/* Заголовок */}
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <span>🌐</span>
          <span>Глобальная торговая биржа</span>
        </h2>
        <p className="text-sm text-gray-400 mt-1">
          Торгуйте ресурсами с другими игроками в реальном времени
        </p>
      </div>

      {/* Вкладки */}
      <div className="flex border-b border-gray-700 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Ошибка */}
      {error && (
        <div className="m-4 p-3 bg-red-900/50 border border-red-500 rounded-lg flex items-center justify-between">
          <span className="text-red-200">{error}</span>
          <button
            onClick={clearError}
            className="text-red-400 hover:text-red-200"
          >
            ✕
          </button>
        </div>
      )}

      {/* Индикатор загрузки */}
      {isLoading && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500 animate-pulse" />
      )}

      {/* Контент */}
      <div className="flex-1 overflow-auto p-4">
        {activeTab === 'orders' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-4">
              <OrderForm />
              <OrderBook />
            </div>
            <div>
              <PriceList compact />
            </div>
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
