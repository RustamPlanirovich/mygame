/**
 * MultiLineChart Component
 *
 * График с несколькими линиями для сравнения ресурсов
 */

import { memo, useMemo } from 'react';
import {
  LineChart,
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
  GRID_STROKE,
  TOOLTIP_CONTENT_STYLE,
  TOOLTIP_LABEL_STYLE,
} from './chartTheme';

interface MultiLineChartProps {
  data: Array<Record<string, number | string>>;
  lines: Array<{
    key: string;
    name: string;
    color: string;
  }>;
  title?: string;
  showGrid?: boolean;
  showLegend?: boolean;
  height?: number;
  formatValue?: (value: number) => string;
}

/** Мемоизирован по той же причине, что и AreaChart. */
export const MultiLineChart = memo(function MultiLineChart({
  data,
  lines,
  title,
  showGrid = true,
  showLegend = true,
  height = 300,
  formatValue,
}: MultiLineChartProps) {
  const tickFormatter = useMemo(
    () => (value: number) => (formatValue ? formatValue(value) : formatNumber(D(value))),
    [formatValue],
  );

  const tooltipFormatter = useMemo(
    () => (value: number | undefined, name: string | undefined) =>
      [
        formatValue ? formatValue(value ?? 0) : formatNumber(D(value ?? 0)),
        lines.find(l => l.key === name)?.name || String(name ?? ''),
      ] as [string, string],
    [formatValue, lines],
  );

  const legendFormatter = useMemo(
    () => (value: string) => {
      const line = lines.find(l => l.key === value);
      return (
        <span style={{ color: '#e5e7eb', fontSize: '12px' }}>{line?.name || value}</span>
      );
    },
    [lines],
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
        <LineChart data={data} margin={CHART_MARGIN}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} opacity={0.5} />}
          <XAxis dataKey="timeLabel" stroke={AXIS_STROKE} fontSize={12} tickLine={false} />
          <YAxis
            stroke={AXIS_STROKE}
            fontSize={12}
            tickLine={false}
            tickFormatter={tickFormatter}
          />
          <Tooltip
            contentStyle={TOOLTIP_CONTENT_STYLE}
            labelStyle={TOOLTIP_LABEL_STYLE}
            formatter={tooltipFormatter}
          />
          {showLegend && <Legend formatter={legendFormatter} />}
          {lines.map((line) => (
            <Line
              key={line.key}
              type="monotone"
              dataKey={line.key}
              name={line.key}
              stroke={line.color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: line.color }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
});
