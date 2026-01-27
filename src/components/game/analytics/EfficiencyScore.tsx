/**
 * EfficiencyScore Component
 * 
 * Общая оценка эффективности производства
 */

import React from 'react';
import { Gauge, Zap, Box, AlertTriangle, Factory } from 'lucide-react';
import { useAnalyticsStore } from '../../../features/analyticsStore';
import { DonutChart } from './charts';

interface ScoreBarProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}

function ScoreBar({ label, value, icon, color }: ScoreBarProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-cyber-gray-300">{label}</span>
        </div>
        <span style={{ color }}>{value.toFixed(0)}%</span>
      </div>
      <div className="h-2 bg-cyber-gray-700 rounded-full overflow-hidden">
        <div 
          className="h-full rounded-full transition-all duration-500"
          style={{ 
            width: `${value}%`,
            backgroundColor: color,
          }}
        />
      </div>
    </div>
  );
}

export function EfficiencyScore() {
  const efficiencyScore = useAnalyticsStore(state => state.efficiencyScore);
  const breakdown = useAnalyticsStore(state => state.efficiencyBreakdown);

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#22c55e';
    if (score >= 60) return '#84cc16';
    if (score >= 40) return '#eab308';
    if (score >= 20) return '#f97316';
    return '#ef4444';
  };

  const scoreColor = getScoreColor(efficiencyScore);

  const getScoreLabel = (score: number) => {
    if (score >= 90) return 'Отлично';
    if (score >= 75) return 'Хорошо';
    if (score >= 50) return 'Средне';
    if (score >= 25) return 'Плохо';
    return 'Критично';
  };

  const chartData = [
    { name: 'Производство', value: breakdown.production, color: '#22c55e' },
    { name: 'Энергия', value: breakdown.energy, color: '#eab308' },
    { name: 'Хранилища', value: breakdown.storage, color: '#3b82f6' },
    { name: 'Узкие места', value: breakdown.bottlenecks, color: '#ef4444' },
  ];

  return (
    <div className="bg-cyber-gray-800/50 rounded-lg border border-cyber-gray-700 p-6">
      <div className="flex items-center gap-2 mb-6">
        <Gauge className="w-5 h-5 text-cyber-green-400" />
        <h3 className="text-lg font-medium text-cyber-gray-200">
          Эффективность производства
        </h3>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Score Circle */}
        <div className="flex flex-col items-center">
          <div className="relative w-48 h-48">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="96"
                cy="96"
                r="80"
                fill="none"
                stroke="#1f2937"
                strokeWidth="16"
              />
              <circle
                cx="96"
                cy="96"
                r="80"
                fill="none"
                stroke={scoreColor}
                strokeWidth="16"
                strokeDasharray={`${(efficiencyScore / 100) * 502.4} 502.4`}
                strokeLinecap="round"
                className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span 
                className="text-4xl font-bold"
                style={{ color: scoreColor }}
              >
                {efficiencyScore.toFixed(0)}%
              </span>
              <span className="text-sm text-cyber-gray-400 mt-1">
                {getScoreLabel(efficiencyScore)}
              </span>
            </div>
          </div>
        </div>

        {/* Breakdown Bars */}
        <div className="space-y-4">
          <ScoreBar
            label="Производство"
            value={breakdown.production}
            icon={<Factory className="w-4 h-4 text-green-400" />}
            color={getScoreColor(breakdown.production)}
          />
          <ScoreBar
            label="Энергия"
            value={breakdown.energy}
            icon={<Zap className="w-4 h-4 text-yellow-400" />}
            color={getScoreColor(breakdown.energy)}
          />
          <ScoreBar
            label="Хранилища"
            value={breakdown.storage}
            icon={<Box className="w-4 h-4 text-blue-400" />}
            color={getScoreColor(breakdown.storage)}
          />
          <ScoreBar
            label="Без узких мест"
            value={breakdown.bottlenecks}
            icon={<AlertTriangle className="w-4 h-4 text-red-400" />}
            color={getScoreColor(breakdown.bottlenecks)}
          />
        </div>
      </div>

      {/* Tips based on lowest score */}
      <div className="mt-6 p-4 bg-cyber-gray-900/50 rounded-lg">
        <h4 className="text-sm font-medium text-cyber-gray-300 mb-2">
          💡 Рекомендации
        </h4>
        <ul className="text-xs text-cyber-gray-400 space-y-1">
          {breakdown.production < 80 && (
            <li>• Увеличьте производство ключевых ресурсов</li>
          )}
          {breakdown.energy < 80 && (
            <li>• Постройте больше электростанций или оптимизируйте потребление</li>
          )}
          {breakdown.storage < 80 && (
            <li>• Расширьте хранилища или продайте избыток ресурсов</li>
          )}
          {breakdown.bottlenecks < 80 && (
            <li>• Устраните узкие места в производственных цепочках</li>
          )}
          {efficiencyScore >= 90 && (
            <li>✨ Отличная работа! Ваше производство работает эффективно!</li>
          )}
        </ul>
      </div>
    </div>
  );
}
