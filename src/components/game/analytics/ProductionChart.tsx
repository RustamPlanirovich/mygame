/**
 * ProductionChart Component
 *
 * График производства ресурсов
 */

import { memo, useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { AreaChart } from './charts';
import { EmptyState, Panel, Stat } from '../../ui';
import { useAnalyticsStore } from '../../../features/analyticsStore';
import type { ResourceType } from '../../../core/gameTypes';
import { D, formatNumber, formatRate } from '../../../core/math/format';
import { toRechartsData } from '../../../utils/analyticsHelpers';
import { resourceLabel } from '../../../core/i18n/label';

interface ProductionChartProps {
  resource: ResourceType;
  height?: number;
}

const RESOURCE_COLORS: Partial<Record<ResourceType, string>> = {
  ore: '#ffb86c',
  ice: '#3dc5de',
  carbon: '#7f849f',
  steel: '#8be9fd',
  energy: '#f1fa8c',
  dark_matter: '#bd93f9',
  natural_gas: '#3ee07f',
  oil: '#2d2f3a',
  plastic: '#ff79c6',
  uranium: '#3ee07f',
  copper: '#f39c12',
  computer: '#a370ef',
};

/**
 * Модульная константа, а не стрелка в JSX: `formatValue` — проп мемоизированного
 * AreaChart, и новая функция на каждый рендер сводила бы memo на нет.
 */
const formatPerSecond = (v: number) => formatRate(D(v));

export const ProductionChart = memo(function ProductionChart({
  resource,
  height = 200,
}: ProductionChartProps) {
  const history = useAnalyticsStore(state => state.productionHistory[resource]);
  const getFilteredHistory = useAnalyticsStore(state => state.getFilteredHistory);

  const chartData = useMemo(() => {
    const filtered = getFilteredHistory(resource);
    return toRechartsData(filtered);
  }, [resource, getFilteredHistory, history]);

  const color = RESOURCE_COLORS[resource] || '#3ee07f';
  const label = resourceLabel(resource);

  if (!history || history.data.length === 0) {
    return (
      <Panel
        title={<span className="capitalize">{label}</span>}
        icon={<span className="block h-3 w-3 rounded-full" style={{ backgroundColor: color }} />}
      >
        <div className="flex items-center justify-center" style={{ height: height - 60 }}>
          <EmptyState title="Нет данных" />
        </div>
      </Panel>
    );
  }

  const TrendIcon =
    history.trend === 'up' ? TrendingUp : history.trend === 'down' ? TrendingDown : Minus;

  const trendColor =
    history.trend === 'up'
      ? 'text-green-400'
      : history.trend === 'down'
        ? 'text-red-400'
        : 'text-gray-400';

  return (
    <Panel
      title={<span className="capitalize">{label}</span>}
      icon={<span className="block h-3 w-3 rounded-full" style={{ backgroundColor: color }} />}
      actions={
        <span className={`flex items-center gap-2 ${trendColor}`}>
          <TrendIcon className="h-4 w-4" />
          <span className="text-xs">
            {history.trendPercent > 0 ? '+' : ''}
            {history.trendPercent.toFixed(1)}%
          </span>
        </span>
      }
    >
      <div className="mb-3 grid grid-cols-3 gap-2">
        <Stat label="Средн." value={`${formatRate(D(history.avgProduction))}/с`} />
        <Stat label="Пик" value={`${formatRate(D(history.peakProduction))}/с`} />
        <Stat label="Всего" value={formatNumber(D(history.totalProduced))} />
      </div>

      <AreaChart
        data={chartData}
        color={color}
        height={height - 100}
        showGrid={false}
        formatValue={formatPerSecond}
      />
    </Panel>
  );
});

/**
 * Компонент для отображения нескольких ресурсов
 */
export const ProductionChartsGrid = memo(function ProductionChartsGrid() {
  const productionHistory = useAnalyticsStore(state => state.productionHistory);
  const selectedResources = useAnalyticsStore(state => state.selectedResources);

  const resources = useMemo(
    () =>
      selectedResources.length > 0
        ? selectedResources
        : (Object.keys(productionHistory) as ResourceType[]).slice(0, 6),
    [selectedResources, productionHistory],
  );

  if (resources.length === 0) {
    return (
      <EmptyState
        title="Данные о производстве ещё не собраны"
        hint="Подождите несколько минут."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {resources.map(resource => (
        <ProductionChart key={resource} resource={resource} />
      ))}
    </div>
  );
});
