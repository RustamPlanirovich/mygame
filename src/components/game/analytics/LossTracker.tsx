/**
 * LossTracker Component
 *
 * Отслеживание потерь ресурсов
 */

import { memo, useMemo, type ComponentType, type CSSProperties } from 'react';
import { AlertCircle, Trash2, Flame, Swords, Sparkles, RefreshCw } from 'lucide-react';
import { useAnalyticsStore } from '../../../features/analyticsStore';
import { EmptyState, Panel, Stat } from '../../ui';
import type { ResourceLoss, LossReason } from '../../../core/gameTypes.analytics';
import { D, formatNumber } from '../../../core/math/format';
import { resourceLabel } from '../../../core/i18n/label';
import { PieChart } from './charts';
import { GameIcon, IconText } from '../../ui/icons';

/**
 * Иконкам ниже передаётся `style` (цвет причины потери), поэтому тип должен его
 * допускать — с прежним `ComponentType<{ className?: string }>` это была ошибка типов.
 */
type LossIcon = ComponentType<{ className?: string; style?: CSSProperties }>;

const LOSS_REASON_CONFIG: Record<LossReason, {
  label: string;
  icon: LossIcon;
  color: string;
}> = {
  overflow: { label: 'Переполнение', icon: Trash2, color: '#ffb86c' },
  decay: { label: 'Распад', icon: Flame, color: '#ff5555' },
  combat: { label: 'Бой', icon: Swords, color: '#bd93f9' },
  event: { label: 'Событие', icon: Sparkles, color: '#8be9fd' },
  conversion: { label: 'Конвертация', icon: RefreshCw, color: '#3ee07f' },
};

interface LossItemProps {
  loss: ResourceLoss;
}

const LossItem = memo(function LossItem({ loss }: LossItemProps) {
  const config = LOSS_REASON_CONFIG[loss.reason];
  const Icon = config.icon;
  const timeAgo = getTimeAgo(loss.timestamp);

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-cyber-gray-900/50 p-2.5">
      <div className="flex min-w-0 items-center gap-2">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full"
          style={{ backgroundColor: `${config.color}20` }}
        >
          <Icon className="h-4 w-4" style={{ color: config.color }} />
        </div>
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2">
            <span className="truncate text-xs font-medium capitalize text-cyber-gray-200">
              {resourceLabel(loss.resource)}
            </span>
            <span
              className="rounded px-2 py-0.5 text-xs"
              style={{
                backgroundColor: `${config.color}20`,
                color: config.color,
              }}
            >
              <IconText>{config.label}</IconText>
            </span>
          </div>
          {loss.details && (
            <p className="text-xs text-cyber-gray-500"><IconText>{loss.details}</IconText></p>
          )}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className="whitespace-nowrap text-xs font-medium tabular-nums text-red-400">
          -{formatNumber(D(loss.amount))}
        </p>
        <p className="whitespace-nowrap text-2xs text-cyber-gray-500">{timeAgo}</p>
      </div>
    </div>
  );
});

function getTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return 'только что';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} мин назад`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} ч назад`;
  return `${Math.floor(seconds / 86400)} дн назад`;
}

export const LossTracker = memo(function LossTracker() {
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
      <Panel
        title="Потери ресурсов"
        icon={<AlertCircle className="h-5 w-5 text-red-400" />}
        actions={
          <button onClick={clearOldLosses} className="btn btn-xs">
            Очистить старые
          </button>
        }
      >
        {losses.length === 0 ? (
          <EmptyState
            icon={<span className="text-4xl"><GameIcon icon="✨" /></span>}
            title={<span className="text-green-400">Потерь не зафиксировано</span>}
            hint="Ресурсы используются эффективно"
          />
        ) : (
          /* Один столбец: `lg:grid-cols-2` смотрел на ширину окна, а не панели. */
          <div className="space-y-3">
            {/* Stats */}
            <div className="space-y-3">
              <div className="rounded-lg bg-red-900/20 p-3">
                <Stat
                  align="center"
                  tone="danger"
                  label="Всего потеряно"
                  value={formatNumber(totalLosses)}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                {Object.entries(LOSS_REASON_CONFIG).map(([reason, config]) => {
                  const value = statsByReason[reason as LossReason];
                  if (value === 0) return null;

                  const Icon = config.icon;
                  return (
                    <div
                      key={reason}
                      className="flex items-center gap-2 rounded p-2"
                      style={{ backgroundColor: `${config.color}10` }}
                    >
                      <Icon className="h-4 w-4" style={{ color: config.color }} />
                      <div>
                        <p className="text-xs text-cyber-gray-400"><IconText>{config.label}</IconText></p>
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
                <h4 className="mb-2 text-sm font-medium text-cyber-gray-400">
                  Больше всего потеряно:
                </h4>
                <div className="space-y-1">
                  {statsByResource.map(([resource, value]) => (
                    <div
                      key={resource}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="capitalize text-cyber-gray-300">
                        {resourceLabel(resource)}
                      </span>
                      <span className="text-red-400">-{formatNumber(D(value))}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Pie Chart */}
            {pieData.length > 0 && (
              <PieChart data={pieData} title="По причинам" height={220} />
            )}
          </div>
        )}
      </Panel>

      {/* Recent Losses */}
      {losses.length > 0 && (
        <Panel title="Последние потери">
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {losses.slice(0, 20).map(loss => (
              <LossItem key={loss.id} loss={loss} />
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
});
