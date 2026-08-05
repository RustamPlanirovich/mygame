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
  innerRadius?: number;
  outerRadius?: number;
  formatValue?: (value: number) => string;
}

const LABEL_LINE = { stroke: '#6b7280' };

const renderSliceLabel = ({ name, percent }: { name?: string; percent?: number }) =>
  `${name} ${((percent ?? 0) * 100).toFixed(0)}%`;

const renderLegendLabel = (value: string) => (
  <span style={{ color: '#e5e7eb', fontSize: '12px' }}>{value}</span>
);

/** Мемоизирован по той же причине, что и AreaChart. */
export const PieChart = memo(function PieChart({
  data,
  title,
  showLegend = true,
  height = 300,
  innerRadius = 60,
  outerRadius = 100,
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

  return (
    <div className="w-full" style={{ height }}>
      {title && <h3 className="mb-2 text-sm font-medium text-cyber-gray-300">{title}</h3>}
      <ResponsiveContainer width="100%" height="100%">
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
            label={renderSliceLabel}
            labelLine={LABEL_LINE}
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
      <PieChart {...props} innerRadius={70} outerRadius={100} />
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
