/**
 * LineChart Component
 *
 * Универсальный компонент линейного графика на базе recharts
 */

import { memo, useMemo } from 'react';
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { EmptyState } from '../../../ui';
import { D, formatNumber } from '../../../../core/math/format';
import {
  AXIS_STROKE,
  CHART_MARGIN,
  DEFAULT_SERIES_COLOR,
  GRID_STROKE,
  TOOLTIP_CONTENT_STYLE,
  TOOLTIP_LABEL_STYLE,
} from './chartTheme';

interface DataPoint {
  time: number;
  timeLabel: string;
  value: number;
  displayValue?: string;
}

interface LineChartProps {
  data: DataPoint[];
  title?: string;
  color?: string;
  showGrid?: boolean;
  showLegend?: boolean;
  height?: number;
  yAxisLabel?: string;
  formatValue?: (value: number) => string;
}

/** Мемоизирован по той же причине, что и AreaChart. */
export const LineChart = memo(function LineChart({
  data,
  title,
  color = DEFAULT_SERIES_COLOR,
  showGrid = true,
  showLegend = false,
  height = 300,
  yAxisLabel,
  formatValue,
}: LineChartProps) {
  const formattedData = useMemo(() => {
    return data.map(point => ({
      ...point,
      displayValue: formatValue
        ? formatValue(point.value)
        : point.displayValue || formatNumber(D(point.value)),
    }));
  }, [data, formatValue]);

  const tickFormatter = useMemo(
    () => (value: number) => (formatValue ? formatValue(value) : formatNumber(D(value))),
    [formatValue],
  );

  const tooltipFormatter = useMemo(
    () => (value: number | undefined) =>
      [formatValue ? formatValue(value ?? 0) : formatNumber(D(value ?? 0)), 'Значение'] as [string, string],
    [formatValue],
  );

  const yAxisLabelConfig = useMemo(
    () =>
      yAxisLabel
        ? {
            value: yAxisLabel,
            angle: -90,
            position: 'insideLeft' as const,
            style: { fill: AXIS_STROKE, fontSize: 12 },
          }
        : undefined,
    [yAxisLabel],
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
        <RechartsLineChart data={formattedData} margin={CHART_MARGIN}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} opacity={0.5} />}
          <XAxis dataKey="timeLabel" stroke={AXIS_STROKE} fontSize={12} tickLine={false} />
          <YAxis
            stroke={AXIS_STROKE}
            fontSize={12}
            tickLine={false}
            tickFormatter={tickFormatter}
            label={yAxisLabelConfig}
          />
          <Tooltip
            contentStyle={TOOLTIP_CONTENT_STYLE}
            labelStyle={TOOLTIP_LABEL_STYLE}
            formatter={tooltipFormatter}
          />
          {showLegend && <Legend />}
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: color }}
          />
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  );
});
