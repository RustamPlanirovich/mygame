/**
 * AreaChart Component
 *
 * Компонент графика с заливкой
 */

import { memo, useId, useMemo } from 'react';
import {
  AreaChart as RechartsAreaChart,
  Area,
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
  svgSafeId,
} from './chartTheme';

interface DataPoint {
  time: number;
  timeLabel: string;
  value: number;
  displayValue?: string;
}

interface AreaChartProps {
  data: DataPoint[];
  title?: string;
  color?: string;
  gradientColor?: string;
  showGrid?: boolean;
  showLegend?: boolean;
  height?: number;
  yAxisLabel?: string;
  formatValue?: (value: number) => string;
  stacked?: boolean;
}

/**
 * Мемоизирован: панель аналитики перерисовывается вместе с игровым тиком (20 раз в
 * секунду), а ряд данных приходит из истории аналитики и меняется в разы реже.
 * Без memo recharts пересобирал всю сцену на каждый тик.
 *
 * Чтобы memo работал, вызывающий код обязан передавать стабильные `data` и
 * `formatValue` — см. модульные форматтеры в панелях вместо стрелок по месту.
 */
export const AreaChart = memo(function AreaChart({
  data,
  title,
  color = DEFAULT_SERIES_COLOR,
  gradientColor,
  showGrid = true,
  showLegend = false,
  height = 300,
  yAxisLabel,
  formatValue,
}: AreaChartProps) {
  const gradientId = svgSafeId(useId());
  const fillColor = gradientColor || color;

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
        <RechartsAreaChart data={formattedData} margin={CHART_MARGIN}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={fillColor} stopOpacity={0.3} />
              <stop offset="95%" stopColor={fillColor} stopOpacity={0} />
            </linearGradient>
          </defs>
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
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
          />
        </RechartsAreaChart>
      </ResponsiveContainer>
    </div>
  );
});
