/**
 * BarChart Component
 *
 * Столбчатая диаграмма
 */

import { memo, useMemo } from 'react';
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { EmptyState } from '../../../ui';
import { D, formatNumber } from '../../../../core/math/format';
import {
  AXIS_FONT_SIZE,
  AXIS_STROKE,
  CHART_MARGIN,
  DEFAULT_SERIES_COLOR,
  GRID_STROKE,
  TOOLTIP_CONTENT_STYLE,
  TOOLTIP_LABEL_STYLE,
  Y_AXIS_WIDTH,
} from './chartTheme';

interface BarDataPoint {
  name: string;
  value: number;
  color?: string;
}

interface BarChartProps {
  data: BarDataPoint[];
  title?: string;
  color?: string;
  showGrid?: boolean;
  showLegend?: boolean;
  height?: number;
  horizontal?: boolean;
  formatValue?: (value: number) => string;
}

const BAR_RADIUS: [number, number, number, number] = [4, 4, 0, 0];

/** Мемоизирован по той же причине, что и AreaChart. */
export const BarChart = memo(function BarChart({
  data,
  title,
  color = DEFAULT_SERIES_COLOR,
  showGrid = true,
  showLegend = false,
  height = 300,
  horizontal = false,
  formatValue,
}: BarChartProps) {
  const tickFormatter = useMemo(
    () => (value: number) => (formatValue ? formatValue(value) : formatNumber(D(value))),
    [formatValue],
  );

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
        <RechartsBarChart
          data={data}
          layout={horizontal ? 'vertical' : 'horizontal'}
          margin={CHART_MARGIN}
        >
          {showGrid && <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} opacity={0.5} />}
          {horizontal ? (
            <>
              <XAxis
                type="number"
                stroke={AXIS_STROKE}
                fontSize={AXIS_FONT_SIZE}
                tickLine={false}
                tickFormatter={tickFormatter}
              />
              <YAxis
                type="category"
                dataKey="name"
                stroke={AXIS_STROKE}
                fontSize={AXIS_FONT_SIZE}
                tickLine={false}
                width={100}
              />
            </>
          ) : (
            <>
              <XAxis dataKey="name" stroke={AXIS_STROKE} fontSize={AXIS_FONT_SIZE} tickLine={false} minTickGap={20} />
              <YAxis
                stroke={AXIS_STROKE}
                fontSize={AXIS_FONT_SIZE}
                width={Y_AXIS_WIDTH}
                tickLine={false}
                tickFormatter={tickFormatter}
              />
            </>
          )}
          <Tooltip
            contentStyle={TOOLTIP_CONTENT_STYLE}
            labelStyle={TOOLTIP_LABEL_STYLE}
            formatter={tooltipFormatter}
          />
          {showLegend && <Legend />}
          <Bar dataKey="value" radius={BAR_RADIUS}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color || color} />
            ))}
          </Bar>
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
});
