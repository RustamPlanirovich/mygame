/**
 * PieChart Component
 *
 * Круговая диаграмма
 */

import { memo, useMemo } from 'react';
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { EmptyState } from '../../../ui';
import { D, formatNumber } from '../../../../core/math/format';
import {
  DEFAULT_PIE_COLORS,
  TOOLTIP_CONTENT_STYLE,
} from './chartTheme';

interface PieDataPoint {
  name: string;
  value: number;
  color?: string;
}

interface PieChartProps {
  data: PieDataPoint[];
  title?: string;
  showLegend?: boolean;
  height?: number;
  /** Доли («60%») предпочтительнее пикселей: панель узкая и её ширина не фиксирована. */
  innerRadius?: number | string;
  outerRadius?: number | string;
  formatValue?: (value: number) => string;
}

/*
 * Подписи секторов ВЫНЕСЕНЫ. Recharts рисует их снаружи круга выносными линиями:
 * в боковой панели (~400px) десять подписей вида «Титановый сплав 12%» ложились
 * друг на друга и на саму диаграмму. Процент читается по легенде и по тултипу,
 * а точные значения — в списке под диаграммой.
 */
const renderLegendLabel = (value: string) => (
  <span style={{ color: '#cbcdd8', fontSize: '10px' }}>{value}</span>
);

/** Легенда в узкой панели обязана переноситься, иначе она уезжает за край. */
const LEGEND_WRAPPER_STYLE = {
  paddingTop: 4,
  lineHeight: '16px',
  maxHeight: 52,
  overflow: 'hidden',
} as const;

/** Мемоизирован по той же причине, что и AreaChart. */
export const PieChart = memo(function PieChart({
  data,
  title,
  showLegend = true,
  height = 300,
  innerRadius = '55%',
  outerRadius = '80%',
  formatValue,
}: PieChartProps) {
  const formattedData = useMemo(() => {
    return data.map((item, index) => ({
      ...item,
      color: item.color || DEFAULT_PIE_COLORS[index % DEFAULT_PIE_COLORS.length],
    }));
  }, [data]);

  const tooltipFormatter = useMemo(
    () => (value: number | undefined) =>
      [formatValue ? formatValue(value ?? 0) : formatNumber(D(value ?? 0)), 'Значение'] as [string, string],
    [formatValue],
  );

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <EmptyState title="Нет данных для отображения" />
      </div>
    );
  }

  // Колонка с min-h-0: иначе заголовок прибавлялся к `height` и диаграмма вылезала за блок.
  return (
    <div className="flex w-full flex-col" style={{ height }}>
      {title && <h3 className="mb-1 shrink-0 text-xs font-medium text-cyber-gray-300">{title}</h3>}
      <ResponsiveContainer width="100%" height="100%" className="min-h-0 flex-1">
        <RechartsPieChart>
          <Pie
            data={formattedData}
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={2}
            dataKey="value"
            nameKey="name"
          >
            {formattedData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip contentStyle={TOOLTIP_CONTENT_STYLE} formatter={tooltipFormatter} />
          {showLegend && (
            <Legend
              layout="horizontal"
              verticalAlign="bottom"
              align="center"
              iconType="circle"
              iconSize={8}
              wrapperStyle={LEGEND_WRAPPER_STYLE}
              formatter={renderLegendLabel}
            />
          )}
        </RechartsPieChart>
      </ResponsiveContainer>
    </div>
  );
});

/**
 * Donut Chart (вариант с центральным текстом)
 */
interface DonutChartProps extends PieChartProps {
  centerLabel?: string;
  centerValue?: string;
}

export const DonutChart = memo(function DonutChart({
  centerLabel,
  centerValue,
  ...props
}: DonutChartProps) {
  return (
    <div className="relative">
      <PieChart {...props} innerRadius="60%" outerRadius="85%" />
      {(centerLabel || centerValue) && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          {centerValue && (
            <span className="text-2xl font-bold text-cyber-green-400">{centerValue}</span>
          )}
          {centerLabel && <span className="text-xs text-cyber-gray-400">{centerLabel}</span>}
        </div>
      )}
    </div>
  );
});
