/**
 * NetWorthTracker - График чистой стоимости
 */

import { useMemo } from 'react';
import { useFinanceStore } from '../../../features/financeStore';
import { formatNumber, D } from '../../../core/math/format';

export function NetWorthTracker() {
  const { netWorth, netWorthHistory, stats } = useFinanceStore();
  
  // Рассчитываем статистику
  const historyStats = useMemo(() => {
    if (netWorthHistory.length < 2) {
      return {
        change24h: D(0),
        changePercent24h: 0,
        high: D(netWorth),
        low: D(netWorth),
        trend: 'neutral' as 'up' | 'down' | 'neutral',
      };
    }
    
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    
    // Данные за последние 24 часа
    const last24h = netWorthHistory.filter(p => p.timestamp >= now - day);
    
    if (last24h.length < 2) {
      return {
        change24h: D(0),
        changePercent24h: 0,
        high: D(netWorth),
        low: D(netWorth),
        trend: 'neutral' as 'up' | 'down' | 'neutral',
      };
    }
    
    const startValue = D(last24h[0].value);
    const endValue = D(netWorth);
    const change24h = endValue.sub(startValue);
    const changePercent24h = startValue.eq(0) ? 0 : change24h.div(startValue.abs()).mul(100).toNumber();
    
    let high = D(last24h[0].value);
    let low = D(last24h[0].value);
    
    for (const point of last24h) {
      const val = D(point.value);
      if (val.gt(high)) high = val;
      if (val.lt(low)) low = val;
    }
    
    const trend = change24h.gt(0) ? 'up' : change24h.lt(0) ? 'down' : 'neutral';
    
    return { change24h, changePercent24h, high, low, trend };
  }, [netWorth, netWorthHistory]);
  
  // Рисуем мини-график
  const chartPath = useMemo(() => {
    if (netWorthHistory.length < 2) return '';
    
    const width = 200;
    const height = 50;
    const padding = 4;
    
    const values = netWorthHistory.slice(-50).map(p => D(p.value).toNumber());
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    
    const points = values.map((val, idx) => {
      const x = padding + (idx / (values.length - 1)) * (width - padding * 2);
      const y = height - padding - ((val - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    });
    
    return `M ${points.join(' L ')}`;
  }, [netWorthHistory]);
  
  const chartColor = historyStats.trend === 'up' ? '#22c55e' : historyStats.trend === 'down' ? '#ef4444' : '#6b7280';
  
  return (
    <div className="bg-slate-800 rounded-lg p-4">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-slate-400 text-sm">Чистая стоимость</h3>
          <div className={`text-3xl font-bold ${
            D(netWorth).gt(0) ? 'text-green-400' : D(netWorth).lt(0) ? 'text-red-400' : ''
          }`}>
            {formatNumber(D(netWorth))} ₡
          </div>
          <div className={`text-sm flex items-center gap-1 ${
            historyStats.trend === 'up' ? 'text-green-400' :
            historyStats.trend === 'down' ? 'text-red-400' : 'text-slate-400'
          }`}>
            {historyStats.trend === 'up' && '↑'}
            {historyStats.trend === 'down' && '↓'}
            {historyStats.change24h.gt(0) ? '+' : ''}
            {formatNumber(historyStats.change24h)} ₡
            ({historyStats.changePercent24h > 0 ? '+' : ''}{historyStats.changePercent24h.toFixed(2)}%)
            <span className="text-slate-500 ml-1">24ч</span>
          </div>
        </div>
        
        {/* Мини-график */}
        {netWorthHistory.length > 1 && (
          <svg width="200" height="50" className="opacity-70">
            <defs>
              <linearGradient id="netWorthGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={chartColor} stopOpacity="0.3" />
                <stop offset="100%" stopColor={chartColor} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d={chartPath}
              fill="none"
              stroke={chartColor}
              strokeWidth="2"
            />
          </svg>
        )}
      </div>
      
      {/* Статистика */}
      <div className="grid grid-cols-4 gap-2 text-sm">
        <div className="bg-slate-700/50 rounded p-2 text-center">
          <div className="text-slate-400 text-xs">24ч Максимум</div>
          <div className="font-medium text-green-400">{formatNumber(historyStats.high)}</div>
        </div>
        <div className="bg-slate-700/50 rounded p-2 text-center">
          <div className="text-slate-400 text-xs">24ч Минимум</div>
          <div className="font-medium text-red-400">{formatNumber(historyStats.low)}</div>
        </div>
        <div className="bg-slate-700/50 rounded p-2 text-center">
          <div className="text-slate-400 text-xs">Прибыль от акций</div>
          <div className="font-medium text-emerald-400">
            +{formatNumber(D(stats.totalStockProfits))}
          </div>
        </div>
        <div className="bg-slate-700/50 rounded p-2 text-center">
          <div className="text-slate-400 text-xs">Дивиденды</div>
          <div className="font-medium text-emerald-400">
            +{formatNumber(D(stats.totalDividends))}
          </div>
        </div>
      </div>
    </div>
  );
}
