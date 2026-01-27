/**
 * StockMarket - Рынок акций
 * Просмотр акций, покупка и продажа
 */

import { useState, useMemo } from 'react';
import { useFinanceStore } from '../../../features/financeStore';
import { formatNumber, D } from '../../../core/math/format';
import { getStockSectorName, FINANCE_CONFIG } from '../../../core/gameTypes.finance';
import type { Stock, StockSector } from '../../../core/gameTypes.finance';

type SortBy = 'symbol' | 'price' | 'change' | 'volume' | 'dividend';
type SortOrder = 'asc' | 'desc';

export function StockMarket() {
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [buyAmount, setBuyAmount] = useState('');
  const [sellAmount, setSellAmount] = useState('');
  const [filterSector, setFilterSector] = useState<StockSector | 'all'>('all');
  const [sortBy, setSortBy] = useState<SortBy>('symbol');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  
  const {
    stocks,
    positions,
    marketEvents,
    buyStock,
    sellStock,
  } = useFinanceStore();
  
  // Фильтрация и сортировка
  const filteredStocks = useMemo(() => {
    let result = [...stocks];
    
    if (filterSector !== 'all') {
      result = result.filter(s => s.sector === filterSector);
    }
    
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'symbol':
          comparison = a.symbol.localeCompare(b.symbol);
          break;
        case 'price':
          comparison = D(a.currentPrice).sub(D(b.currentPrice)).toNumber();
          break;
        case 'change':
          comparison = a.dayChange - b.dayChange;
          break;
        case 'volume':
          comparison = D(a.volume).sub(D(b.volume)).toNumber();
          break;
        case 'dividend':
          comparison = a.dividendYield - b.dividendYield;
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    
    return result;
  }, [stocks, filterSector, sortBy, sortOrder]);
  
  const sectors: StockSector[] = ['energy', 'mining', 'technology', 'manufacturing', 'aerospace', 'entertainment', 'biotech', 'exotic'];
  
  const handleBuy = () => {
    if (!selectedStock) return;
    const shares = D(buyAmount || '0');
    if (shares.lte(0)) return;
    
    const result = buyStock(selectedStock.id, shares);
    if (result.success) {
      setBuyAmount('');
    } else {
      alert(result.error);
    }
  };
  
  const handleSell = () => {
    if (!selectedStock) return;
    const shares = D(sellAmount || '0');
    if (shares.lte(0)) return;
    
    const result = sellStock(selectedStock.id, shares);
    if (result.success) {
      setSellAmount('');
    } else {
      alert(result.error);
    }
  };
  
  const getPosition = (stockId: string) => positions.find(p => p.stockId === stockId);
  
  const handleSort = (column: SortBy) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };
  
  return (
    <div className="space-y-4">
      {/* Новости рынка */}
      {marketEvents.length > 0 && (
        <div className="bg-slate-800 rounded-lg p-3">
          <h4 className="font-medium mb-2 flex items-center gap-2">
            📰 Последние новости
          </h4>
          <div className="space-y-1 text-sm max-h-24 overflow-y-auto">
            {marketEvents.slice(-3).reverse().map((event, idx) => (
              <div
                key={idx}
                className={`p-2 rounded ${
                  event.magnitude > 0 ? 'bg-green-900/30' : 'bg-red-900/30'
                }`}
              >
                {event.description}
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Фильтры */}
      <div className="flex gap-1 flex-wrap">
        <button
          onClick={() => setFilterSector('all')}
          className={`px-2 py-1 rounded text-xs ${
            filterSector === 'all' ? 'bg-blue-600' : 'bg-slate-700 hover:bg-slate-600'
          }`}
        >
          Все
        </button>
        {sectors.map(sector => (
          <button
            key={sector}
            onClick={() => setFilterSector(sector)}
            className={`px-2 py-1 rounded text-xs ${
              filterSector === sector ? 'bg-blue-600' : 'bg-slate-700 hover:bg-slate-600'
            }`}
          >
            {getStockSectorName(sector)}
          </button>
        ))}
      </div>
      
      {/* Таблица акций */}
      <div className="bg-slate-800 rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-slate-700">
            <tr>
              <th 
                className="text-left p-2 cursor-pointer hover:bg-slate-600"
                onClick={() => handleSort('symbol')}
              >
                Тикер {sortBy === 'symbol' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th 
                className="text-right p-2 cursor-pointer hover:bg-slate-600 whitespace-nowrap"
                onClick={() => handleSort('price')}
              >
                Цена {sortBy === 'price' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th 
                className="text-right p-2 cursor-pointer hover:bg-slate-600 whitespace-nowrap"
                onClick={() => handleSort('change')}
              >
                Изм. {sortBy === 'change' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th 
                className="text-right p-2 cursor-pointer hover:bg-slate-600 whitespace-nowrap"
                onClick={() => handleSort('dividend')}
              >
                Див. {sortBy === 'dividend' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th className="text-right p-2 whitespace-nowrap">Ваши</th>
            </tr>
          </thead>
          <tbody>
            {filteredStocks.map(stock => {
              const position = getPosition(stock.id);
              const isSelected = selectedStock?.id === stock.id;
              
              return (
                <tr
                  key={stock.id}
                  className={`border-t border-slate-700 hover:bg-slate-700/50 cursor-pointer ${
                    isSelected ? 'bg-blue-900/30' : ''
                  }`}
                  onClick={() => setSelectedStock(stock)}
                >
                  <td className="p-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-base">{stock.emoji}</span>
                      <div>
                        <div className="font-bold text-sm">{stock.symbol}</div>
                        <div className="text-[10px] text-slate-400 truncate max-w-[80px]">{stock.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="text-right p-2 font-mono whitespace-nowrap">
                    {formatNumber(D(stock.currentPrice))} ₡
                  </td>
                  <td className={`text-right p-2 font-mono whitespace-nowrap ${
                    stock.dayChange > 0 ? 'text-green-400' : stock.dayChange < 0 ? 'text-red-400' : ''
                  }`}>
                    {stock.dayChange > 0 ? '+' : ''}{stock.dayChange.toFixed(1)}%
                  </td>
                  <td className="text-right p-2 text-emerald-400 whitespace-nowrap">
                    {stock.dividendYield > 0 ? `${(stock.dividendYield * 100).toFixed(1)}%` : '-'}
                  </td>
                  <td className="text-right p-2 whitespace-nowrap">
                    {position ? (
                      <div>
                        <div className="font-medium">{formatNumber(D(position.shares))}</div>
                        <div className={`text-[10px] ${
                          D(position.unrealizedPnL).gt(0) ? 'text-green-400' : 
                          D(position.unrealizedPnL).lt(0) ? 'text-red-400' : ''
                        }`}>
                          {D(position.unrealizedPnL).gt(0) ? '+' : ''}
                          {formatNumber(D(position.unrealizedPnL))}
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-500">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="text-[10px] text-slate-500 text-center py-1 border-t border-slate-700">
          Нажмите на акцию для торговли
        </div>
      </div>
      
      {/* Панель торговли */}
      {selectedStock && (
        <div className="bg-slate-800 rounded-lg p-4">
          <div className="flex justify-between items-start mb-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{selectedStock.emoji}</span>
              <div>
                <h3 className="font-bold text-lg">{selectedStock.symbol}</h3>
                <div className="text-sm text-slate-400">{selectedStock.name}</div>
              </div>
            </div>
            <button
              onClick={() => setSelectedStock(null)}
              className="text-slate-400 hover:text-white text-xl"
            >
              ✕
            </button>
          </div>
          
          <p className="text-sm text-slate-300 mb-3">{selectedStock.description}</p>
          
          {/* Компактные метрики */}
          <div className="grid grid-cols-4 gap-2 mb-3 text-xs">
            <div className="bg-slate-700/70 rounded px-2 py-1.5">
              <div className="text-slate-400">Цена</div>
              <div className="font-bold text-sm">{formatNumber(D(selectedStock.currentPrice))} ₡</div>
            </div>
            <div className="bg-slate-700/70 rounded px-2 py-1.5">
              <div className="text-slate-400">Изменение</div>
              <div className={`font-bold text-sm ${
                selectedStock.dayChange > 0 ? 'text-green-400' : 
                selectedStock.dayChange < 0 ? 'text-red-400' : ''
              }`}>
                {selectedStock.dayChange > 0 ? '+' : ''}{selectedStock.dayChange.toFixed(2)}%
              </div>
            </div>
            <div className="bg-slate-700/70 rounded px-2 py-1.5">
              <div className="text-slate-400">Волатильность</div>
              <div className={`font-bold text-sm ${
                selectedStock.volatility === 'extreme' ? 'text-red-400' :
                selectedStock.volatility === 'very_high' ? 'text-orange-400' :
                selectedStock.volatility === 'high' ? 'text-yellow-400' : ''
              }`}>
                {selectedStock.volatility}
              </div>
            </div>
            <div className="bg-slate-700/70 rounded px-2 py-1.5">
              <div className="text-slate-400">Дивиденды</div>
              <div className="font-bold text-sm text-emerald-400">
                {selectedStock.dividendYield > 0 ? `${(selectedStock.dividendYield * 100).toFixed(1)}%` : '-'}
              </div>
            </div>
          </div>
          
          {/* Ваша позиция - компактно */}
          {(() => {
            const position = getPosition(selectedStock.id);
            if (!position) return null;
            
            return (
              <div className="bg-slate-700/30 border border-slate-600 rounded p-2 mb-3 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Ваши акции:</span>
                  <span className="font-medium">{formatNumber(D(position.shares))} шт.</span>
                  <span className="text-slate-400">Ср. цена:</span>
                  <span className="font-medium">{formatNumber(D(position.avgBuyPrice))} ₡</span>
                  <span className="text-slate-400">P&L:</span>
                  <span className={`font-medium ${
                    D(position.unrealizedPnL).gt(0) ? 'text-green-400' : 
                    D(position.unrealizedPnL).lt(0) ? 'text-red-400' : ''
                  }`}>
                    {D(position.unrealizedPnL).gt(0) ? '+' : ''}
                    {formatNumber(D(position.unrealizedPnL))} ₡
                  </span>
                </div>
              </div>
            );
          })()}
          
          {/* Покупка/Продажа - улучшенный UI */}
          <div className="grid grid-cols-2 gap-3">
            {/* Покупка */}
            <div className="bg-green-900/20 border border-green-700/30 rounded p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-green-400">📈</span>
                <span className="font-medium text-green-400">Купить</span>
              </div>
              <input
                type="number"
                min="1"
                step="1"
                value={buyAmount}
                onChange={(e) => setBuyAmount(e.target.value)}
                placeholder="Кол-во акций"
                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 mb-2 text-sm focus:border-green-500 focus:outline-none"
              />
              <div className="text-xs text-slate-400 mb-2 h-8">
                {buyAmount && parseFloat(buyAmount) > 0 ? (
                  <>
                    Итого: {formatNumber(D(buyAmount).mul(D(selectedStock.currentPrice)))} ₡
                    <span className="text-slate-500 ml-1">
                      (+{(FINANCE_CONFIG.STOCK_TRADING_FEE * 100).toFixed(1)}% комиссия)
                    </span>
                  </>
                ) : (
                  <span className="text-slate-500">Введите количество акций</span>
                )}
              </div>
              <button
                onClick={handleBuy}
                disabled={!buyAmount || parseFloat(buyAmount) <= 0}
                className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:cursor-not-allowed rounded font-medium transition-colors"
              >
                Купить
              </button>
            </div>
            
            {/* Продажа */}
            <div className="bg-red-900/20 border border-red-700/30 rounded p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-red-400">📉</span>
                <span className="font-medium text-red-400">Продать</span>
              </div>
              <input
                type="number"
                min="1"
                step="1"
                value={sellAmount}
                onChange={(e) => setSellAmount(e.target.value)}
                placeholder="Кол-во акций"
                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 mb-2 text-sm focus:border-red-500 focus:outline-none"
                disabled={!getPosition(selectedStock.id)}
              />
              <div className="text-xs text-slate-400 mb-2 h-8">
                {sellAmount && parseFloat(sellAmount) > 0 ? (
                  <>
                    Получите: {formatNumber(D(sellAmount).mul(D(selectedStock.currentPrice)).mul(1 - FINANCE_CONFIG.STOCK_TRADING_FEE))} ₡
                  </>
                ) : getPosition(selectedStock.id) ? (
                  <span className="text-slate-500">Введите количество акций</span>
                ) : (
                  <span className="text-slate-500">У вас нет этих акций</span>
                )}
              </div>
              <button
                onClick={handleSell}
                disabled={!sellAmount || parseFloat(sellAmount) <= 0 || !getPosition(selectedStock.id)}
                className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-600 disabled:cursor-not-allowed rounded font-medium transition-colors"
              >
                Продать
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
