/**
 * ProfitLossChart Component
 *
 * График прибыли и убытков
 */

import { memo, useMemo } from 'react';
import { DollarSign, TrendingUp, TrendingDown } from 'lucide-react';
import { useAnalyticsStore } from '../../../features/analyticsStore';
import { AreaChart } from './charts';
import { EmptyState, Panel, Stat } from '../../ui';
import { D, formatNumber } from '../../../core/math/format';
import { toRechartsData, filterByTimeRange } from '../../../utils/analyticsHelpers';

/** Стабильная ссылка: проп мемоизированного AreaChart. */
const formatCredits = (v: number) => formatNumber(D(v));

export const ProfitLossChart = memo(function ProfitLossChart() {
  const profitLossHistory = useAnalyticsStore(state => state.profitLossHistory);
  const totalCreditsEarned = useAnalyticsStore(state => state.totalCreditsEarned);
  const totalCreditsSpent = useAnalyticsStore(state => state.totalCreditsSpent);
  const timeRange = useAnalyticsStore(state => state.chartSettings.timeRange);

  /*
   * Раньше здесь стоял `useAnalyticsStore(selectNetProfitLoss)`. Этот селектор строит
   * НОВЫЙ Decimal на каждый вызов, поэтому Object.is всегда давал false и компонент
   * перерисовывался на любое изменение стора аналитики, даже не связанное с финансами.
   * Подписываемся на две строки-примитива и считаем разницу локально.
   */
  const netProfitLoss = useMemo(
    () => D(totalCreditsEarned).sub(D(totalCreditsSpent)),
    [totalCreditsEarned, totalCreditsSpent],
  );

  const chartData = useMemo(() => {
    const filtered = filterByTimeRange(profitLossHistory, timeRange);
    return toRechartsData(filtered, (v) => formatNumber(D(v)));
  }, [profitLossHistory, timeRange]);

  const isProfit = netProfitLoss.gte(0);
  const color = isProfit ? '#3ee07f' : '#ff5555';

  return (
    <Panel title="Прибыль и убытки" icon={<DollarSign className="h-5 w-5" />}>
      {/* Summary Cards */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="rounded-lg bg-green-900/20 p-4">
          <Stat
            align="center"
            tone="accent"
            icon={<TrendingUp className="h-4 w-4" />}
            label="Заработано"
            value={formatNumber(D(totalCreditsEarned))}
          />
        </div>

        <div className="rounded-lg bg-red-900/20 p-4">
          <Stat
            align="center"
            tone="danger"
            icon={<TrendingDown className="h-4 w-4" />}
            label="Потрачено"
            value={formatNumber(D(totalCreditsSpent))}
          />
        </div>

        <div
          className="rounded-lg p-4"
          style={{ backgroundColor: isProfit ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)' }}
        >
          <Stat
            align="center"
            tone={isProfit ? 'accent' : 'danger'}
            icon={<DollarSign className="h-4 w-4" />}
            label="Баланс"
            value={`${isProfit ? '+' : ''}${formatNumber(netProfitLoss)}`}
          />
        </div>
      </div>

      {/* Chart */}
      {chartData.length > 0 ? (
        <AreaChart
          data={chartData}
          color={color}
          height={200}
          showGrid={true}
          formatValue={formatCredits}
        />
      ) : (
        <EmptyState title="История прибыли/убытков ещё не записана" />
      )}
    </Panel>
  );
});
