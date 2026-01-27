/**
 * ProfitLossChart Component
 * 
 * График прибыли и убытков
 */

import React, { useMemo } from 'react';
import { DollarSign, TrendingUp, TrendingDown } from 'lucide-react';
import { useAnalyticsStore, selectNetProfitLoss } from '../../../features/analyticsStore';
import { AreaChart } from './charts';
import { D, formatNumber } from '../../../core/math/format';
import { toRechartsData, filterByTimeRange } from '../../../utils/analyticsHelpers';

export function ProfitLossChart() {
  const profitLossHistory = useAnalyticsStore(state => state.profitLossHistory);
  const totalCreditsEarned = useAnalyticsStore(state => state.totalCreditsEarned);
  const totalCreditsSpent = useAnalyticsStore(state => state.totalCreditsSpent);
  const timeRange = useAnalyticsStore(state => state.chartSettings.timeRange);
  const netProfitLoss = useAnalyticsStore(selectNetProfitLoss);

  const chartData = useMemo(() => {
    const filtered = filterByTimeRange(profitLossHistory, timeRange);
    return toRechartsData(filtered, (v) => formatNumber(D(v)));
  }, [profitLossHistory, timeRange]);

  const isProfit = netProfitLoss.gte(0);
  const color = isProfit ? '#22c55e' : '#ef4444';

  return (
    <div className="bg-cyber-gray-800/50 rounded-lg border border-cyber-gray-700 p-6">
      <div className="flex items-center gap-2 mb-4">
        <DollarSign className="w-5 h-5 text-cyber-green-400" />
        <h3 className="text-lg font-medium text-cyber-gray-200">
          Прибыль и убытки
        </h3>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="p-4 bg-green-900/20 rounded-lg text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <TrendingUp className="w-4 h-4 text-green-400" />
            <span className="text-xs text-green-400/70">Заработано</span>
          </div>
          <p className="text-xl font-bold text-green-400">
            {formatNumber(D(totalCreditsEarned))}
          </p>
        </div>

        <div className="p-4 bg-red-900/20 rounded-lg text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <TrendingDown className="w-4 h-4 text-red-400" />
            <span className="text-xs text-red-400/70">Потрачено</span>
          </div>
          <p className="text-xl font-bold text-red-400">
            {formatNumber(D(totalCreditsSpent))}
          </p>
        </div>

        <div 
          className="p-4 rounded-lg text-center"
          style={{ backgroundColor: isProfit ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)' }}
        >
          <div className="flex items-center justify-center gap-1 mb-1">
            <DollarSign className="w-4 h-4" style={{ color }} />
            <span className="text-xs" style={{ color: `${color}b3` }}>Баланс</span>
          </div>
          <p className="text-xl font-bold" style={{ color }}>
            {isProfit ? '+' : ''}{formatNumber(netProfitLoss)}
          </p>
        </div>
      </div>

      {/* Chart */}
      {chartData.length > 0 ? (
        <AreaChart
          data={chartData}
          color={color}
          height={200}
          showGrid={true}
          formatValue={(v) => formatNumber(D(v))}
        />
      ) : (
        <div className="flex items-center justify-center h-48 bg-cyber-gray-900/50 rounded-lg">
          <p className="text-cyber-gray-500 text-sm">
            История прибыли/убытков ещё не записана
          </p>
        </div>
      )}
    </div>
  );
}
