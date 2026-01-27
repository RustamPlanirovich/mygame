/**
 * AreaChart Component
 * 
 * Компонент графика с заливкой
 */

import React, { useMemo } from 'react';
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
import { D, formatNumber } from '../../../../core/math/format';

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

export function AreaChart({
  data,
  title,
  color = '#22c55e',
  gradientColor,
  showGrid = true,
  showLegend = false,
  height = 300,
  yAxisLabel,
  formatValue,
}: AreaChartProps) {
  const gradientId = useMemo(() => `gradient-${Math.random().toString(36).substr(2, 9)}`, []);
  const fillColor = gradientColor || color;

  const formattedData = useMemo(() => {
    return data.map(point => ({
      ...point,
      displayValue: formatValue 
        ? formatValue(point.value) 
        : point.displayValue || formatNumber(D(point.value)),
    }));
  }, [data, formatValue]);

  if (data.length === 0) {
    return (
      <div 
        className="flex items-center justify-center bg-cyber-gray-800/50 rounded-lg border border-cyber-gray-700"
        style={{ height }}
      >
        <p className="text-cyber-gray-500">Нет данных для отображения</p>
      </div>
    );
  }

  return (
    <div className="w-full" style={{ height }}>
      {title && (
        <h3 className="text-sm font-medium text-cyber-gray-300 mb-2">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height="100%">
        <RechartsAreaChart
          data={formattedData}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={fillColor} stopOpacity={0.3}/>
              <stop offset="95%" stopColor={fillColor} stopOpacity={0}/>
            </linearGradient>
          </defs>
          {showGrid && (
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="#374151" 
              opacity={0.5}
            />
          )}
          <XAxis 
            dataKey="timeLabel" 
            stroke="#9ca3af"
            fontSize={12}
            tickLine={false}
          />
          <YAxis 
            stroke="#9ca3af"
            fontSize={12}
            tickLine={false}
            tickFormatter={(value) => formatValue ? formatValue(value) : formatNumber(D(value))}
            label={yAxisLabel ? {
              value: yAxisLabel,
              angle: -90,
              position: 'insideLeft',
              style: { fill: '#9ca3af', fontSize: 12 },
            } : undefined}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '8px',
              color: '#e5e7eb',
            }}
            labelStyle={{ color: '#9ca3af' }}
            formatter={(value: number) => [
              formatValue ? formatValue(value) : formatNumber(D(value)),
              'Значение'
            ]}
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
}
