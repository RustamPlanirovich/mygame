/**
 * ProductionChart Component
 * 
 * График производства ресурсов
 */

import React, { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { AreaChart } from './charts';
import { useAnalyticsStore } from '../../../features/analyticsStore';
import { useGameStore } from '../../../features/gameStore';
import type { ResourceType } from '../../../core/gameTypes';
import { D, formatNumber, formatRate } from '../../../core/math/format';
import { toRechartsData } from '../../../utils/analyticsHelpers';
import { getTimeRangeLabel } from '../../../core/gameTypes.analytics';

interface ProductionChartProps {
  resource: ResourceType;
  height?: number;
}

const RESOURCE_COLORS: Partial<Record<ResourceType, string>> = {
  ore: '#f59e0b',
  ice: '#06b6d4',
  carbon: '#6b7280',
  steel: '#3b82f6',
  energy: '#eab308',
  dark_matter: '#8b5cf6',
  natural_gas: '#22c55e',
  oil: '#1f2937',
  plastic: '#ec4899',
  uranium: '#22c55e',
  copper: '#f97316',
  computer: '#6366f1',
};

export function ProductionChart({ resource, height = 200 }: ProductionChartProps) {
  const history = useAnalyticsStore(state => state.productionHistory[resource]);
  const timeRange = useAnalyticsStore(state => state.chartSettings.timeRange);
  const getFilteredHistory = useAnalyticsStore(state => state.getFilteredHistory);
  
  const chartData = useMemo(() => {
    const filtered = getFilteredHistory(resource);
    return toRechartsData(filtered);
  }, [resource, getFilteredHistory, history]);

  const color = RESOURCE_COLORS[resource] || '#22c55e';

  if (!history || history.data.length === 0) {
    return (
      <div 
        className="bg-cyber-gray-800/50 rounded-lg border border-cyber-gray-700 p-4"
        style={{ height }}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-cyber-gray-300 capitalize">
            {resource.replace(/_/g, ' ')}
          </span>
        </div>
        <div className="flex items-center justify-center h-32">
          <p className="text-cyber-gray-500 text-sm">Нет данных</p>
        </div>
      </div>
    );
  }

  const TrendIcon = history.trend === 'up' 
    ? TrendingUp 
    : history.trend === 'down' 
      ? TrendingDown 
      : Minus;

  const trendColor = history.trend === 'up' 
    ? 'text-green-400' 
    : history.trend === 'down' 
      ? 'text-red-400' 
      : 'text-gray-400';

  return (
    <div className="bg-cyber-gray-800/50 rounded-lg border border-cyber-gray-700 p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span 
            className="w-3 h-3 rounded-full" 
            style={{ backgroundColor: color }}
          />
          <span className="text-sm font-medium text-cyber-gray-200 capitalize">
            {resource.replace(/_/g, ' ')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <TrendIcon className={`w-4 h-4 ${trendColor}`} />
          <span className={`text-xs ${trendColor}`}>
            {history.trendPercent > 0 ? '+' : ''}{history.trendPercent.toFixed(1)}%
          </span>
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-2 mb-3 text-xs">
        <div>
          <span className="text-cyber-gray-500">Средн.</span>
          <p className="text-cyber-gray-200">{formatRate(D(history.avgProduction))}/с</p>
        </div>
        <div>
          <span className="text-cyber-gray-500">Пик</span>
          <p className="text-cyber-gray-200">{formatRate(D(history.peakProduction))}/с</p>
        </div>
        <div>
          <span className="text-cyber-gray-500">Всего</span>
          <p className="text-cyber-gray-200">{formatNumber(D(history.totalProduced))}</p>
        </div>
      </div>

      <AreaChart
        data={chartData}
        color={color}
        height={height - 100}
        showGrid={false}
        formatValue={(v) => formatRate(D(v))}
      />
    </div>
  );
}

/**
 * Компонент для отображения нескольких ресурсов
 */
export function ProductionChartsGrid() {
  const productionHistory = useAnalyticsStore(state => state.productionHistory);
  const selectedResources = useAnalyticsStore(state => state.selectedResources);
  
  const resources = selectedResources.length > 0 
    ? selectedResources 
    : (Object.keys(productionHistory) as ResourceType[]).slice(0, 6);

  if (resources.length === 0) {
    return (
      <div className="bg-cyber-gray-800/50 rounded-lg border border-cyber-gray-700 p-8">
        <p className="text-cyber-gray-500 text-center">
          Данные о производстве ещё не собраны. Подождите несколько минут.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {resources.map(resource => (
        <ProductionChart key={resource} resource={resource} />
      ))}
    </div>
  );
}
