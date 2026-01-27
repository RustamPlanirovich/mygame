/**
 * MultiLineChart Component
 * 
 * График с несколькими линиями для сравнения ресурсов
 */

import React from 'react';
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
import { D, formatNumber } from '../../../../core/math/format';

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

export function MultiLineChart({
  data,
  lines,
  title,
  showGrid = true,
  showLegend = true,
  height = 300,
  formatValue,
}: MultiLineChartProps) {
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
        <LineChart
          data={data}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
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
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '8px',
              color: '#e5e7eb',
            }}
            labelStyle={{ color: '#9ca3af' }}
            formatter={(value: number, name: string) => [
              formatValue ? formatValue(value) : formatNumber(D(value)),
              lines.find(l => l.key === name)?.name || name
            ]}
          />
          {showLegend && (
            <Legend
              formatter={(value) => {
                const line = lines.find(l => l.key === value);
                return (
                  <span style={{ color: '#e5e7eb', fontSize: '12px' }}>
                    {line?.name || value}
                  </span>
                );
              }}
            />
          )}
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
}
