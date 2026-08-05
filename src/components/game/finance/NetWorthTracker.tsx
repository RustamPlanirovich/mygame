/**
 * NetWorthTracker - График чистой стоимости
 */

import { memo, useMemo } from 'react';
import { useFinanceStore } from '../../../features/financeStore';
import { formatNumber, D } from '../../../core/math/format';
import { Sparkline, Stat } from '../../ui';
import { IconText } from '../../ui/icons';

// memo: родительская FinancePanel рендерится на каждый тик, пропсов у компонента нет.
// Сам компонент всё равно будет обновляться на каждый пересчёт netWorthHistory — это
// его данные; memo убирает только «холостые» рендеры, вызванные родителем.
export const NetWorthTracker = memo(NetWorthTrackerImpl);

function NetWorthTrackerImpl() {
  // Точечные подписки вместо `useFinanceStore()`: компонент просыпался на любой set()
  // стора, включая обновления акций и банка, которые он даже не показывает.
  const netWorth = useFinanceStore((s) => s.netWorth);
  const netWorthHistory = useFinanceStore((s) => s.netWorthHistory);
  const totalStockProfits = useFinanceStore((s) => s.stats.totalStockProfits);
  const totalDividends = useFinanceStore((s) => s.stats.totalDividends);

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

  // Точки для мини-графика. Раньше здесь вручную считался SVG-path (и объявлялся
  // linearGradient, который ни разу не использовался) — теперь этим занимается <Sparkline>.
  const chartPoints = useMemo(
    () => netWorthHistory.slice(-50).map((p) => D(p.value).toNumber()),
    [netWorthHistory],
  );

  const chartTone = historyStats.trend === 'up' ? 'accent' : historyStats.trend === 'down' ? 'danger' : 'info';

  return (
    <div className="card">
      <div className="flex justify-between items-start gap-4 mb-4">
        <div>
          <h3 className="stat-label">Чистая стоимость</h3>
          <div className={`font-mono text-3xl font-bold tabular-nums ${
            D(netWorth).gt(0) ? 'text-green-400' : D(netWorth).lt(0) ? 'text-red-400' : ''
          }`}>
            {formatNumber(D(netWorth))} ₡
          </div>
          <div className={`text-sm flex items-center gap-1 font-mono tabular-nums ${
            historyStats.trend === 'up' ? 'text-green-400' :
            historyStats.trend === 'down' ? 'text-red-400' : 'text-slate-400'
          }`}>
            <IconText>{historyStats.trend === 'up' && '↑'}</IconText>
            {historyStats.trend === 'down' && '↓'}
            {historyStats.change24h.gt(0) ? '+' : ''}
            {formatNumber(historyStats.change24h)} ₡
            ({historyStats.changePercent24h > 0 ? '+' : ''}{historyStats.changePercent24h.toFixed(2)}%)
            <span className="text-slate-500 ml-1">24ч</span>
          </div>
        </div>

        {/* Мини-график */}
        {netWorthHistory.length > 1 && (
          <div className="w-[200px] shrink-0">
            <Sparkline points={chartPoints} height={50} tone={chartTone} />
          </div>
        )}
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-4 gap-2">
        <div className="card">
          <Stat label="24ч Максимум" value={formatNumber(historyStats.high)} tone="accent" align="center" />
        </div>
        <div className="card">
          <Stat label="24ч Минимум" value={formatNumber(historyStats.low)} tone="danger" align="center" />
        </div>
        <div className="card">
          <Stat
            label="Прибыль от акций"
            value={`+${formatNumber(D(totalStockProfits))}`}
            tone="accent"
            align="center"
          />
        </div>
        <div className="card">
          <Stat
            label="Дивиденды"
            value={`+${formatNumber(D(totalDividends))}`}
            tone="accent"
            align="center"
          />
        </div>
      </div>
    </div>
  );
}
