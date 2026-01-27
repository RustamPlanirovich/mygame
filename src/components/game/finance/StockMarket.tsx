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
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilterSector('all')}
          className={`px-3 py-1.5 rounded text-sm ${
            filterSector === 'all' ? 'bg-blue-600' : 'bg-slate-700 hover:bg-slate-600'
          }`}
        >
          Все
        </button>
        {sectors.map(sector => (
          <button
            key={sector}
            onClick={() => setFilterSector(sector)}
            className={`px-3 py-1.5 rounded text-sm ${
              filterSector === sector ? 'bg-blue-600' : 'bg-slate-700 hover:bg-slate-600'
            }`}
          >
            {getStockSectorName(sector)}
          </button>
        ))}
      </div>
      
      {/* Таблица акций */}
      <div className="bg-slate-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-700">
            <tr>
              <th 
                className="text-left p-3 cursor-pointer hover:bg-slate-600"
                onClick={() => handleSort('symbol')}
              >
                Тикер {sortBy === 'symbol' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th 
                className="text-right p-3 cursor-pointer hover:bg-slate-600"
                onClick={() => handleSort('price')}
              >
                Цена {sortBy === 'price' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th 
                className="text-right p-3 cursor-pointer hover:bg-slate-600"
                onClick={() => handleSort('change')}
              >
                Изм. {sortBy === 'change' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th 
                className="text-right p-3 cursor-pointer hover:bg-slate-600"
                onClick={() => handleSort('dividend')}
              >
                Див. {sortBy === 'dividend' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th className="text-right p-3">Ваши</th>
              <th className="text-center p-3">Действия</th>
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
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{stock.emoji}</span>
                      <div>
                        <div className="font-bold">{stock.symbol}</div>
                        <div className="text-xs text-slate-400">{stock.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="text-right p-3 font-mono">
                    {formatNumber(D(stock.currentPrice))} ₡
                  </td>
                  <td className={`text-right p-3 font-mono ${
                    stock.dayChange > 0 ? 'text-green-400' : stock.dayChange < 0 ? 'text-red-400' : ''
                  }`}>
                    {stock.dayChange > 0 ? '+' : ''}{stock.dayChange.toFixed(2)}%
                  </td>
                  <td className="text-right p-3 text-emerald-400">
                    {stock.dividendYield > 0 ? `${(stock.dividendYield * 100).toFixed(1)}%` : '-'}
                  </td>
                  <td className="text-right p-3">
                    {position ? (
                      <div>
                        <div>{formatNumber(D(position.shares))}</div>
                        <div className={`text-xs ${
                          D(position.unrealizedPnL).gt(0) ? 'text-green-400' : 
                          D(position.unrealizedPnL).lt(0) ? 'text-red-400' : ''
                        }`}>
                          {D(position.unrealizedPnL).gt(0) ? '+' : ''}
                          {formatNumber(D(position.unrealizedPnL))} ₡
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-500">-</span>
                    )}
                  </td>
                  <td className="text-center p-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedStock(stock);
                      }}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs"
                    >
                      Торговать
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {/* Панель торговли */}
      {selectedStock && (
        <div className="bg-slate-800 rounded-lg p-4">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="font-bold text-lg flex items-center gap-2">
                {selectedStock.emoji} {selectedStock.symbol}
              </h3>
              <div className="text-slate-400">{selectedStock.name}</div>
              <div className="text-sm mt-1">{selectedStock.description}</div>
            </div>
            <button
              onClick={() => setSelectedStock(null)}
              className="text-slate-400 hover:text-white"
            >
              ✕
            </button>
          </div>
          
          <div className="grid grid-cols-4 gap-3 mb-4">
            <div className="bg-slate-700 rounded p-2 text-center">
              <div className="text-slate-400 text-xs">Цена</div>
              <div className="font-bold">{formatNumber(D(selectedStock.currentPrice))} ₡</div>
            </div>
            <div className="bg-slate-700 rounded p-2 text-center">
              <div className="text-slate-400 text-xs">Изменение</div>
              <div className={`font-bold ${
                selectedStock.dayChange > 0 ? 'text-green-400' : 
                selectedStock.dayChange < 0 ? 'text-red-400' : ''
              }`}>
                {selectedStock.dayChange > 0 ? '+' : ''}{selectedStock.dayChange.toFixed(2)}%
              </div>
            </div>
            <div className="bg-slate-700 rounded p-2 text-center">
              <div className="text-slate-400 text-xs">Волатильность</div>
              <div className={`font-bold ${
                selectedStock.volatility === 'extreme' ? 'text-red-400' :
                selectedStock.volatility === 'very_high' ? 'text-orange-400' :
                selectedStock.volatility === 'high' ? 'text-yellow-400' : ''
              }`}>
                {selectedStock.volatility}
              </div>
            </div>
            <div className="bg-slate-700 rounded p-2 text-center">
              <div className="text-slate-400 text-xs">Дивиденды</div>
              <div className="font-bold text-emerald-400">
                {selectedStock.dividendYield > 0 ? `${(selectedStock.dividendYield * 100).toFixed(1)}%` : '-'}
              </div>
            </div>
          </div>
          
          {/* Ваша позиция */}
          {(() => {
            const position = getPosition(selectedStock.id);
            if (!position) return null;
            
            return (
              <div className="bg-slate-700/50 rounded p-3 mb-4">
                <h4 className="font-medium mb-2">Ваша позиция</h4>
                <div className="grid grid-cols-4 gap-2 text-sm">
                  <div>
                    <div className="text-slate-400">Акций</div>
                    <div className="font-medium">{formatNumber(D(position.shares))}</div>
                  </div>
                  <div>
                    <div className="text-slate-400">Ср. цена</div>
                    <div className="font-medium">{formatNumber(D(position.avgBuyPrice))} ₡</div>
                  </div>
                  <div>
                    <div className="text-slate-400">Стоимость</div>
                    <div className="font-medium">{formatNumber(D(position.currentValue))} ₡</div>
                  </div>
                  <div>
                    <div className="text-slate-400">P&L</div>
                    <div className={`font-medium ${
                      D(position.unrealizedPnL).gt(0) ? 'text-green-400' : 
                      D(position.unrealizedPnL).lt(0) ? 'text-red-400' : ''
                    }`}>
                      {D(position.unrealizedPnL).gt(0) ? '+' : ''}
                      {formatNumber(D(position.unrealizedPnL))} ₡
                      ({position.unrealizedPnLPercent.toFixed(1)}%)
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
          
          {/* Покупка/Продажа */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium mb-2 text-green-400">📈 Купить</h4>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={buyAmount}
                  onChange={(e) => setBuyAmount(e.target.value)}
                  placeholder="Кол-во акций"
                  className="flex-1 bg-slate-700 rounded px-3 py-2"
                />
                <button
                  onClick={handleBuy}
                  disabled={!buyAmount || D(buyAmount).lte(0)}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 rounded"
                >
                  Купить
                </button>
              </div>
              {buyAmount && D(buyAmount).gt(0) && (
                <div className="text-sm text-slate-400 mt-1">
                  Итого: {formatNumber(D(buyAmount).mul(D(selectedStock.currentPrice)))} ₡
                  <span className="text-xs ml-1">
                    (+{(FINANCE_CONFIG.STOCK_TRADING_FEE * 100).toFixed(1)}% комиссия)
                  </span>
                </div>
              )}
            </div>
            
            <div>
              <h4 className="font-medium mb-2 text-red-400">📉 Продать</h4>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={sellAmount}
                  onChange={(e) => setSellAmount(e.target.value)}
                  placeholder="Кол-во акций"
                  className="flex-1 bg-slate-700 rounded px-3 py-2"
                />
                <button
                  onClick={handleSell}
                  disabled={!sellAmount || D(sellAmount).lte(0) || !getPosition(selectedStock.id)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-600 rounded"
                >
                  Продать
                </button>
              </div>
              {sellAmount && D(sellAmount).gt(0) && (
                <div className="text-sm text-slate-400 mt-1">
                  Получите: {formatNumber(D(sellAmount).mul(D(selectedStock.currentPrice)).mul(1 - FINANCE_CONFIG.STOCK_TRADING_FEE))} ₡
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
