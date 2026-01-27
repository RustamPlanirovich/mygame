/**
 * LossTracker Component
 * 
 * Отслеживание потерь ресурсов
 */

import React, { useMemo } from 'react';
import { AlertCircle, Trash2, Flame, Swords, Sparkles, RefreshCw } from 'lucide-react';
import { useAnalyticsStore } from '../../../features/analyticsStore';
import type { ResourceLoss, LossReason } from '../../../core/gameTypes.analytics';
import { D, formatNumber } from '../../../core/math/format';
import { PieChart } from './charts';

const LOSS_REASON_CONFIG: Record<LossReason, { 
  label: string; 
  icon: React.ComponentType<{ className?: string }>; 
  color: string;
}> = {
  overflow: { label: 'Переполнение', icon: Trash2, color: '#f59e0b' },
  decay: { label: 'Распад', icon: Flame, color: '#ef4444' },
  combat: { label: 'Бой', icon: Swords, color: '#8b5cf6' },
  event: { label: 'Событие', icon: Sparkles, color: '#3b82f6' },
  conversion: { label: 'Конвертация', icon: RefreshCw, color: '#22c55e' },
};

interface LossItemProps {
  loss: ResourceLoss;
}

function LossItem({ loss }: LossItemProps) {
  const config = LOSS_REASON_CONFIG[loss.reason];
  const Icon = config.icon;
  const timeAgo = getTimeAgo(loss.timestamp);

  return (
    <div className="flex items-center justify-between p-3 bg-cyber-gray-900/50 rounded-lg">
      <div className="flex items-center gap-3">
        <div 
          className="w-8 h-8 rounded-full flex items-center justify-center"
          style={{ backgroundColor: `${config.color}20` }}
        >
          <Icon className="w-4 h-4" style={{ color: config.color }} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-cyber-gray-200 capitalize">
              {loss.resource.replace(/_/g, ' ')}
            </span>
            <span 
              className="text-xs px-2 py-0.5 rounded"
              style={{ 
                backgroundColor: `${config.color}20`,
                color: config.color,
              }}
            >
              {config.label}
            </span>
          </div>
          {loss.details && (
            <p className="text-xs text-cyber-gray-500">{loss.details}</p>
          )}
        </div>
      </div>
      <div className="text-right">
        <p className="text-sm font-medium text-red-400">
          -{formatNumber(D(loss.amount))}
        </p>
        <p className="text-xs text-cyber-gray-500">{timeAgo}</p>
      </div>
    </div>
  );
}

function getTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  
  if (seconds < 60) return 'только что';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} мин назад`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} ч назад`;
  return `${Math.floor(seconds / 86400)} дн назад`;
}

export function LossTracker() {
  const losses = useAnalyticsStore(state => state.losses);
  const clearOldLosses = useAnalyticsStore(state => state.clearOldLosses);

  // Статистика по причинам
  const statsByReason = useMemo(() => {
    const stats: Record<LossReason, number> = {
      overflow: 0,
      decay: 0,
      combat: 0,
      event: 0,
      conversion: 0,
    };
    
    for (const loss of losses) {
      stats[loss.reason] += D(loss.amount).toNumber();
    }
    
    return stats;
  }, [losses]);

  // Статистика по ресурсам
  const statsByResource = useMemo(() => {
    const stats: Record<string, number> = {};
    
    for (const loss of losses) {
      const amount = D(loss.amount).toNumber();
      stats[loss.resource] = (stats[loss.resource] || 0) + amount;
    }
    
    return Object.entries(stats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [losses]);

  // Общие потери
  const totalLosses = useMemo(() => {
    return losses.reduce((acc, loss) => acc.add(D(loss.amount)), D(0));
  }, [losses]);

  // Данные для pie chart
  const pieData = useMemo(() => {
    return Object.entries(statsByReason)
      .filter(([, value]) => value > 0)
      .map(([reason, value]) => ({
        name: LOSS_REASON_CONFIG[reason as LossReason].label,
        value,
        color: LOSS_REASON_CONFIG[reason as LossReason].color,
      }));
  }, [statsByReason]);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="bg-cyber-gray-800/50 rounded-lg border border-cyber-gray-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <h3 className="text-lg font-medium text-cyber-gray-200">
              Потери ресурсов
            </h3>
          </div>
          <button
            onClick={clearOldLosses}
            className="text-xs bg-cyber-gray-700 hover:bg-cyber-gray-600 text-cyber-gray-300 px-3 py-1 rounded transition-colors"
          >
            Очистить старые
          </button>
        </div>

        {losses.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-2">✨</div>
            <p className="text-green-400 font-medium">Потерь не зафиксировано</p>
            <p className="text-cyber-gray-500 text-sm mt-1">
              Ресурсы используются эффективно
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Stats */}
            <div className="space-y-4">
              <div className="p-4 bg-red-900/20 rounded-lg text-center">
                <p className="text-3xl font-bold text-red-400">
                  {formatNumber(totalLosses)}
                </p>
                <p className="text-sm text-red-400/70">Всего потеряно</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {Object.entries(LOSS_REASON_CONFIG).map(([reason, config]) => {
                  const value = statsByReason[reason as LossReason];
                  if (value === 0) return null;
                  
                  const Icon = config.icon;
                  return (
                    <div 
                      key={reason}
                      className="flex items-center gap-2 p-2 rounded"
                      style={{ backgroundColor: `${config.color}10` }}
                    >
                      <Icon className="w-4 h-4" style={{ color: config.color }} />
                      <div>
                        <p className="text-xs text-cyber-gray-400">{config.label}</p>
                        <p className="text-sm font-medium" style={{ color: config.color }}>
                          {formatNumber(D(value))}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Top lost resources */}
              <div>
                <h4 className="text-sm font-medium text-cyber-gray-400 mb-2">
                  Больше всего потеряно:
                </h4>
                <div className="space-y-1">
                  {statsByResource.map(([resource, value]) => (
                    <div 
                      key={resource}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-cyber-gray-300 capitalize">
                        {resource.replace(/_/g, ' ')}
                      </span>
                      <span className="text-red-400">-{formatNumber(D(value))}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Pie Chart */}
            {pieData.length > 0 && (
              <PieChart
                data={pieData}
                title="По причинам"
                height={250}
              />
            )}
          </div>
        )}
      </div>

      {/* Recent Losses */}
      {losses.length > 0 && (
        <div className="bg-cyber-gray-800/50 rounded-lg border border-cyber-gray-700 p-4">
          <h4 className="text-sm font-medium text-cyber-gray-300 mb-3">
            Последние потери
          </h4>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {losses.slice(0, 20).map(loss => (
              <LossItem key={loss.id} loss={loss} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
