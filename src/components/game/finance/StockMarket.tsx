/**
 * StockMarket - Рынок акций
 * Просмотр акций, покупка и продажа
 */

import { memo, useState, useMemo } from 'react';
import { useFinanceStore } from '../../../features/financeStore';
import { formatNumber, D } from '../../../core/math/format';
import { getStockSectorName, FINANCE_CONFIG } from '../../../core/gameTypes.finance';
import type { Stock, StockSector } from '../../../core/gameTypes.finance';
import { Alert, EmptyState, Panel, Stat } from '../../ui';
import { GameIcon, IconText } from '../../ui/icons';

type SortBy = 'symbol' | 'price' | 'change' | 'volume' | 'dividend';
type SortOrder = 'asc' | 'desc';

/*
 * memo обязателен: FinancePanel перерисовывается на каждый тик (recalculateNetWorth
 * пишет новые netWorth/liquidAssets), а дочерние элементы рендерятся обычным JSX —
 * без memo React перерисовывал бы их 20 раз в секунду, сколь угодно узкими
 * ни были бы их селекторы. Пропсов нет, поэтому достаточно memo по умолчанию.
 */
export const StockMarket = memo(StockMarketImpl);

function StockMarketImpl() {
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [buyAmount, setBuyAmount] = useState('');
  const [sellAmount, setSellAmount] = useState('');
  const [filterSector, setFilterSector] = useState<StockSector | 'all'>('all');
  const [sortBy, setSortBy] = useState<SortBy>('symbol');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Точечные подписки вместо `useFinanceStore()`: подписка на весь стор будила таблицу
  // даже на изменение банковского баланса или кредитов, которых здесь нет.
  const stocks = useFinanceStore((s) => s.stocks);
  const positions = useFinanceStore((s) => s.positions);
  const marketEvents = useFinanceStore((s) => s.marketEvents);
  const buyStock = useFinanceStore((s) => s.buyStock);
  const sellStock = useFinanceStore((s) => s.sellStock);

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
        <Panel title="📰 Последние новости">
          <div className="space-y-1 max-h-24 overflow-y-auto">
            {marketEvents.slice(-3).reverse().map((event, idx) => (
              <Alert key={idx} tone={event.magnitude > 0 ? 'accent' : 'danger'}>
                <IconText>{event.description}</IconText>
              </Alert>
            ))}
          </div>
        </Panel>
      )}

      {/* Фильтры по секторам. Это набор чипов с переносом строк, а не таб-бар:
          <Tabs> раскладывает элементы в один нерастягивающийся ряд, а секторов девять. */}
      <div className="flex gap-1 flex-wrap">
        <button
          type="button"
          onClick={() => setFilterSector('all')}
          className={`btn btn-xs ${filterSector === 'all' ? 'btn-info' : ''}`}
        >
          Все
        </button>
        {sectors.map(sector => (
          <button
            key={sector}
            type="button"
            onClick={() => setFilterSector(sector)}
            className={`btn btn-xs ${filterSector === sector ? 'btn-info' : ''}`}
          >
            {getStockSectorName(sector)}
          </button>
        ))}
      </div>

      {/* Таблица акций */}
      {/* Пять колонок с `whitespace-nowrap` шире панели: раньше `overflow-hidden`
          просто срезал правый край, теперь таблица прокручивается вбок. */}
      <div className="panel overflow-x-auto">
        {filteredStocks.length === 0 ? (
          <div className="p-3">
            <EmptyState title="Нет акций в этом секторе" hint="Выберите другой сектор или «Все»." />
          </div>
        ) : (
          <table className="data-table min-w-[360px]">
            <thead>
              <tr>
                <th
                  className="text-left cursor-pointer"
                  onClick={() => handleSort('symbol')}
                >
                  Тикер {sortBy === 'symbol' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  className="text-right cursor-pointer whitespace-nowrap"
                  onClick={() => handleSort('price')}
                >
                  Цена {sortBy === 'price' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  className="text-right cursor-pointer whitespace-nowrap"
                  onClick={() => handleSort('change')}
                >
                  Изм. {sortBy === 'change' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  className="text-right cursor-pointer whitespace-nowrap"
                  onClick={() => handleSort('dividend')}
                >
                  Див. {sortBy === 'dividend' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th className="text-right whitespace-nowrap">Ваши</th>
              </tr>
            </thead>
            <tbody>
              {filteredStocks.map(stock => {
                const position = getPosition(stock.id);
                const isSelected = selectedStock?.id === stock.id;

                return (
                  <tr
                    key={stock.id}
                    className={`cursor-pointer ${isSelected ? 'bg-blue-900/30' : ''}`}
                    onClick={() => setSelectedStock(stock)}
                  >
                    <td>
                      <div className="flex items-center gap-1.5">
                        <span className="text-base"><GameIcon icon={stock.emoji} /></span>
                        <div>
                          <div className="font-mono font-bold text-sm">{stock.symbol}</div>
                          <div className="text-2xs text-slate-400 truncate max-w-[80px]">{stock.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="text-right font-mono tabular-nums whitespace-nowrap">
                      {formatNumber(D(stock.currentPrice))} ₡
                    </td>
                    <td className={`text-right font-mono tabular-nums whitespace-nowrap ${
                      stock.dayChange > 0 ? 'text-green-400' : stock.dayChange < 0 ? 'text-red-400' : ''
                    }`}>
                      {stock.dayChange > 0 ? '+' : ''}{stock.dayChange.toFixed(1)}%
                    </td>
                    <td className="text-right font-mono tabular-nums text-emerald-400 whitespace-nowrap">
                      {stock.dividendYield > 0 ? `${(stock.dividendYield * 100).toFixed(1)}%` : '-'}
                    </td>
                    <td className="text-right whitespace-nowrap">
                      {position ? (
                        <div>
                          <div className="font-mono font-medium tabular-nums">{formatNumber(D(position.shares))}</div>
                          <div className={`font-mono text-2xs tabular-nums ${
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
        )}
        <div className="text-2xs text-slate-500 text-center py-1 border-t border-edge">
          Нажмите на акцию для торговли
        </div>
      </div>

      {/* Панель торговли */}
      {selectedStock && (
        <Panel
          icon={<span className="text-2xl"><GameIcon icon={selectedStock.emoji} /></span>}
          title={selectedStock.symbol}
          subtitle={selectedStock.name}
          actions={
            <button
              type="button"
              onClick={() => setSelectedStock(null)}
              aria-label="Закрыть"
              className="icon-btn"
            >
              <GameIcon icon="✕" />
            </button>
          }
          bodyClassName="space-y-3"
        >
          <p className="text-sm text-slate-300"><IconText>{selectedStock.description}</IconText></p>

          {/* Компактные метрики */}
          {/* Две колонки: «Волатильность» в четверть панели не помещалась */}
          <div className="grid grid-cols-2 gap-2">
            <div className="card">
              <Stat label="Цена" value={`${formatNumber(D(selectedStock.currentPrice))} ₡`} />
            </div>
            <div className="card">
              <Stat
                label="Изменение"
                value={`${selectedStock.dayChange > 0 ? '+' : ''}${selectedStock.dayChange.toFixed(2)}%`}
                tone={selectedStock.dayChange > 0 ? 'accent' : selectedStock.dayChange < 0 ? 'danger' : 'neutral'}
              />
            </div>
            <div className="card">
              <Stat
                label="Волатильность"
                value={selectedStock.volatility}
                tone={
                  selectedStock.volatility === 'extreme'
                    ? 'danger'
                    : selectedStock.volatility === 'very_high' || selectedStock.volatility === 'high'
                      ? 'warning'
                      : 'neutral'
                }
              />
            </div>
            <div className="card">
              <Stat
                label="Дивиденды"
                value={selectedStock.dividendYield > 0 ? `${(selectedStock.dividendYield * 100).toFixed(1)}%` : '-'}
                tone="accent"
              />
            </div>
          </div>

          {/* Ваша позиция - компактно */}
          {(() => {
            const position = getPosition(selectedStock.id);
            if (!position) return null;

            return (
              <div className="card grid grid-cols-3 gap-2">
                <Stat label="Ваши акции:" value={`${formatNumber(D(position.shares))} шт.`} />
                <Stat label="Ср. цена:" value={`${formatNumber(D(position.avgBuyPrice))} ₡`} />
                <Stat
                  label="P&L:"
                  value={`${D(position.unrealizedPnL).gt(0) ? '+' : ''}${formatNumber(D(position.unrealizedPnL))} ₡`}
                  tone={
                    D(position.unrealizedPnL).gt(0)
                      ? 'accent'
                      : D(position.unrealizedPnL).lt(0)
                        ? 'danger'
                        : 'neutral'
                  }
                />
              </div>
            );
          })()}

          {/* Покупка/Продажа */}
          <div className="grid grid-cols-2 gap-3">
            {/* Покупка */}
            <div className="card border-green-700/30 bg-green-900/20">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-green-400"><GameIcon icon="📈" /></span>
                <span className="font-medium text-green-400">Купить</span>
              </div>
              <input
                type="number"
                min="1"
                step="1"
                value={buyAmount}
                onChange={(e) => setBuyAmount(e.target.value)}
                placeholder="Кол-во акций"
                className="w-full px-3 py-2 mb-2 text-sm"
              />
              <div className="text-xs text-slate-400 mb-2 h-8">
                {buyAmount && parseFloat(buyAmount) > 0 ? (
                  <>
                    Итого: <span className="font-mono tabular-nums">{formatNumber(D(buyAmount).mul(D(selectedStock.currentPrice)))}</span> ₡
                    <span className="text-slate-500 ml-1">
                      (+{(FINANCE_CONFIG.STOCK_TRADING_FEE * 100).toFixed(1)}% комиссия)
                    </span>
                  </>
                ) : (
                  <span className="text-slate-500">Введите количество акций</span>
                )}
              </div>
              <button
                type="button"
                onClick={handleBuy}
                disabled={!buyAmount || parseFloat(buyAmount) <= 0}
                className="btn-primary btn-block"
              >
                Купить
              </button>
            </div>

            {/* Продажа */}
            <div className="card border-red-700/30 bg-red-900/20">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-red-400"><GameIcon icon="📉" /></span>
                <span className="font-medium text-red-400">Продать</span>
              </div>
              <input
                type="number"
                min="1"
                step="1"
                value={sellAmount}
                onChange={(e) => setSellAmount(e.target.value)}
                placeholder="Кол-во акций"
                className="w-full px-3 py-2 mb-2 text-sm"
                disabled={!getPosition(selectedStock.id)}
              />
              <div className="text-xs text-slate-400 mb-2 h-8">
                {sellAmount && parseFloat(sellAmount) > 0 ? (
                  <>
                    Получите: <span className="font-mono tabular-nums">{formatNumber(D(sellAmount).mul(D(selectedStock.currentPrice)).mul(1 - FINANCE_CONFIG.STOCK_TRADING_FEE))}</span> ₡
                  </>
                ) : getPosition(selectedStock.id) ? (
                  <span className="text-slate-500">Введите количество акций</span>
                ) : (
                  <span className="text-slate-500">У вас нет этих акций</span>
                )}
              </div>
              <button
                type="button"
                onClick={handleSell}
                disabled={!sellAmount || parseFloat(sellAmount) <= 0 || !getPosition(selectedStock.id)}
                className="btn-danger btn-block"
              >
                Продать
              </button>
            </div>
          </div>
        </Panel>
      )}
    </div>
  );
}
