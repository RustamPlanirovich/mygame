/**
 * PieChart Component
 * 
 * Круговая диаграмма
 */

import React, { useMemo } from 'react';
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { D, formatNumber } from '../../../../core/math/format';

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

const DEFAULT_COLORS = [
  '#22c55e', // green
  '#3b82f6', // blue
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#84cc16', // lime
  '#f97316', // orange
  '#6366f1', // indigo
];

export function PieChart({
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
      color: item.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length],
    }));
  }, [data]);

  const total = useMemo(() => {
    return data.reduce((acc, item) => acc + item.value, 0);
  }, [data]);

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
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            labelLine={{ stroke: '#6b7280' }}
          >
            {formattedData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '8px',
              color: '#e5e7eb',
            }}
            formatter={(value: number) => [
              formatValue ? formatValue(value) : formatNumber(D(value)),
              'Значение'
            ]}
          />
          {showLegend && (
            <Legend
              layout="horizontal"
              verticalAlign="bottom"
              align="center"
              iconType="circle"
              formatter={(value) => (
                <span style={{ color: '#e5e7eb', fontSize: '12px' }}>{value}</span>
              )}
            />
          )}
        </RechartsPieChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Donut Chart (вариант с центральным текстом)
 */
interface DonutChartProps extends PieChartProps {
  centerLabel?: string;
  centerValue?: string;
}

export function DonutChart({
  centerLabel,
  centerValue,
  ...props
}: DonutChartProps) {
  return (
    <div className="relative">
      <PieChart {...props} innerRadius={70} outerRadius={100} />
      {(centerLabel || centerValue) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {centerValue && (
            <span className="text-2xl font-bold text-cyber-green-400">
              {centerValue}
            </span>
          )}
          {centerLabel && (
            <span className="text-xs text-cyber-gray-400">
              {centerLabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
