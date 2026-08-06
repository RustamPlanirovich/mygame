/**
 * EfficiencyScore Component
 *
 * Общая оценка эффективности производства
 */

import { memo, type ReactNode } from 'react';
import { Gauge, Zap, Box, AlertTriangle, Factory } from 'lucide-react';
import { useAnalyticsStore } from '../../../features/analyticsStore';
import { Panel } from '../../ui';
import { GameIcon } from '../../ui/icons';

interface ScoreBarProps {
  label: string;
  value: number;
  icon: ReactNode;
  color: string;
}

/**
 * Полоса использует `.meter` из дизайн-системы, но заливку красит вручную:
 * `Meter` умеет только четыре семантических тона, а здесь непрерывная шкала из
 * пяти цветов (getScoreColor), и подменять её на три тона значило бы потерять
 * информацию, которую сейчас видит игрок.
 */
const ScoreBar = memo(function ScoreBar({ label, value, icon, color }: ScoreBarProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-xs">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0">{icon}</span>
          <span className="truncate text-cyber-gray-300">{label}</span>
        </div>
        <span className="shrink-0 tabular-nums" style={{ color }}>{value.toFixed(0)}%</span>
      </div>
      <div className="meter">
        <div
          className="meter-fill"
          style={{
            width: `${value}%`,
            backgroundColor: color,
          }}
        />
      </div>
    </div>
  );
});

function getScoreColor(score: number) {
  if (score >= 80) return '#3ee07f';
  if (score >= 60) return '#a1e245';
  if (score >= 40) return '#f1fa8c';
  if (score >= 20) return '#f39c12';
  return '#ff5555';
}

function getScoreLabel(score: number) {
  if (score >= 90) return 'Отлично';
  if (score >= 75) return 'Хорошо';
  if (score >= 50) return 'Средне';
  if (score >= 25) return 'Плохо';
  return 'Критично';
}

export const EfficiencyScore = memo(function EfficiencyScore() {
  const efficiencyScore = useAnalyticsStore(state => state.efficiencyScore);
  const breakdown = useAnalyticsStore(state => state.efficiencyBreakdown);

  const scoreColor = getScoreColor(efficiencyScore);

  return (
    <Panel title="Эффективность" icon={<Gauge className="h-5 w-5" />}>
      {/*
        Кольцо и шкалы — в столбик. При `lg:grid-cols-2` на десктопе кольцо шириной
        192px и четыре шкалы делили 400 пикселей панели пополам, и подписи шкал
        («Без узких мест») наезжали на цифры.
      */}
      <div className="space-y-4">
        {/* Score Circle */}
        <div className="flex flex-col items-center">
          <div className="relative h-48 w-48">
            <svg className="h-full w-full -rotate-90 transform">
              <circle cx="96" cy="96" r="80" fill="none" stroke="#2d2f3a" strokeWidth="16" />
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
              <span className="text-4xl font-bold" style={{ color: scoreColor }}>
                {efficiencyScore.toFixed(0)}%
              </span>
              <span className="mt-1 text-sm text-cyber-gray-400">
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
            icon={<Factory className="h-4 w-4 text-green-400" />}
            color={getScoreColor(breakdown.production)}
          />
          <ScoreBar
            label="Энергия"
            value={breakdown.energy}
            icon={<Zap className="h-4 w-4 text-yellow-400" />}
            color={getScoreColor(breakdown.energy)}
          />
          <ScoreBar
            label="Хранилища"
            value={breakdown.storage}
            icon={<Box className="h-4 w-4 text-blue-400" />}
            color={getScoreColor(breakdown.storage)}
          />
          <ScoreBar
            label="Без узких мест"
            value={breakdown.bottlenecks}
            icon={<AlertTriangle className="h-4 w-4 text-red-400" />}
            color={getScoreColor(breakdown.bottlenecks)}
          />
        </div>
      </div>

      {/* Tips based on lowest score */}
      <div className="mt-4 rounded-lg bg-cyber-gray-900/50 p-3">
        <h4 className="mb-1.5 text-xs font-medium text-cyber-gray-300">
          <GameIcon icon="💡" /> Рекомендации
        </h4>
        <ul className="space-y-1 text-2xs leading-relaxed text-cyber-gray-400">
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
            <li><GameIcon icon="✨" /> Отличная работа! Ваше производство работает эффективно!</li>
          )}
        </ul>
      </div>
    </Panel>
  );
});
