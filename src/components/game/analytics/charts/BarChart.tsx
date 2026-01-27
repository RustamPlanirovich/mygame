/**
 * BarChart Component
 * 
 * Столбчатая диаграмма
 */

import React from 'react';
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
import { D, formatNumber } from '../../../../core/math/format';

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

const DEFAULT_COLOR = '#22c55e';

export function BarChart({
  data,
  title,
  color = DEFAULT_COLOR,
  showGrid = true,
  showLegend = false,
  height = 300,
  horizontal = false,
  formatValue,
}: BarChartProps) {
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

  const ChartComponent = RechartsBarChart;
  
  return (
    <div className="w-full" style={{ height }}>
      {title && (
        <h3 className="text-sm font-medium text-cyber-gray-300 mb-2">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height="100%">
        <ChartComponent
          data={data}
          layout={horizontal ? 'vertical' : 'horizontal'}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          {showGrid && (
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="#374151" 
              opacity={0.5}
            />
          )}
          {horizontal ? (
            <>
              <XAxis 
                type="number"
                stroke="#9ca3af"
                fontSize={12}
                tickLine={false}
                tickFormatter={(value) => formatValue ? formatValue(value) : formatNumber(D(value))}
              />
              <YAxis 
                type="category"
                dataKey="name"
                stroke="#9ca3af"
                fontSize={12}
                tickLine={false}
                width={100}
              />
            </>
          ) : (
            <>
              <XAxis 
                dataKey="name" 
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
            </>
          )}
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
          <Bar 
            dataKey="value" 
            radius={[4, 4, 0, 0]}
          >
            {data.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={entry.color || color} 
              />
            ))}
          </Bar>
        </ChartComponent>
      </ResponsiveContainer>
    </div>
  );
}
