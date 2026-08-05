/**
 * BottleneckAnalyzer Component
 *
 * Анализ и отображение узких мест производства
 */

import { memo, useCallback } from 'react';
import { AlertTriangle, AlertCircle, Info, Skull, Clock, ArrowRight } from 'lucide-react';
import { useAnalyticsStore } from '../../../features/analyticsStore';
import { useGameStore } from '../../../features/gameStore';
import { EmptyState, Panel, Stat } from '../../ui';
import type { Bottleneck } from '../../../core/gameTypes.analytics';
import { getSeverityColor, formatDuration } from '../../../core/gameTypes.analytics';
import { D, formatNumber, formatRate } from '../../../core/math/format';

const SEVERITY_ICON = {
  low: Info,
  medium: AlertCircle,
  high: AlertTriangle,
  critical: Skull,
} as const;

const SEVERITY_LABEL = {
  low: 'Низкий',
  medium: 'Средний',
  high: 'Высокий',
  critical: 'Критично',
} as const;

interface BottleneckCardProps {
  bottleneck: Bottleneck;
}

const BottleneckCard = memo(function BottleneckCard({ bottleneck }: BottleneckCardProps) {
  const buildings = useGameStore(state => state.buildings);

  const SeverityIcon = SEVERITY_ICON[bottleneck.severity];
  const severityColor = getSeverityColor(bottleneck.severity);

  const producerNames = bottleneck.producingBuildings
    .map(id => buildings.find(b => b.id === id)?.name || id)
    .slice(0, 3);

  const consumerNames = bottleneck.consumingBuildings
    .map(id => buildings.find(b => b.id === id)?.name || id)
    .slice(0, 3);

  return (
    <div className="card" style={{ borderColor: severityColor }}>
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <SeverityIcon className="h-5 w-5" style={{ color: severityColor }} />
          <span
            className="text-sm font-medium capitalize"
            style={{ color: severityColor }}
          >
            {bottleneck.resource.replace(/_/g, ' ')}
          </span>
        </div>
        <span
          className="rounded-full px-2 py-1 text-xs"
          style={{
            backgroundColor: `${severityColor}20`,
            color: severityColor,
          }}
        >
          {SEVERITY_LABEL[bottleneck.severity]}
        </span>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-3">
        <Stat
          label="Производство"
          tone="accent"
          value={`${formatRate(D(bottleneck.production))}/с`}
        />
        <Stat
          label="Потребление"
          tone="danger"
          value={`${formatRate(D(bottleneck.consumption))}/с`}
        />
        <Stat
          label="Дефицит"
          tone="warning"
          value={`-${formatRate(D(bottleneck.deficit))}/с`}
        />
        <Stat label="Запас" value={formatNumber(D(bottleneck.currentStock))} />
      </div>

      {bottleneck.timeToDepletion !== null && bottleneck.timeToDepletion > 0 && (
        <div className="mb-3 flex items-center gap-2 text-xs">
          <Clock className="h-3 w-3 text-yellow-500" />
          <span className="text-yellow-400">
            Истощится через {formatDuration(bottleneck.timeToDepletion)}
          </span>
        </div>
      )}

      <div className="mb-3 flex items-center gap-2 text-xs text-cyber-gray-400">
        <div className="flex-1">
          <span className="mb-1 block">Производители:</span>
          <div className="flex flex-wrap gap-1">
            {producerNames.length > 0 ? (
              producerNames.map((name, i) => (
                <span key={i} className="rounded bg-green-900/30 px-2 py-0.5 text-green-400">
                  {name}
                </span>
              ))
            ) : (
              <span className="text-red-400">Нет производителей!</span>
            )}
            {bottleneck.producingBuildings.length > 3 && (
              <span className="text-cyber-gray-500">
                +{bottleneck.producingBuildings.length - 3}
              </span>
            )}
          </div>
        </div>
        <ArrowRight className="h-4 w-4 text-cyber-gray-600" />
        <div className="flex-1">
          <span className="mb-1 block">Потребители:</span>
          <div className="flex flex-wrap gap-1">
            {consumerNames.map((name, i) => (
              <span key={i} className="rounded bg-red-900/30 px-2 py-0.5 text-red-400">
                {name}
              </span>
            ))}
            {bottleneck.consumingBuildings.length > 3 && (
              <span className="text-cyber-gray-500">
                +{bottleneck.consumingBuildings.length - 3}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="rounded bg-cyber-gray-900/50 p-2 text-xs">
        <p className="text-cyber-gray-300">{bottleneck.recommendation}</p>
      </div>
    </div>
  );
});

export const BottleneckAnalyzer = memo(function BottleneckAnalyzer() {
  const bottlenecks = useAnalyticsStore(state => state.bottlenecks);
  const updateBottlenecks = useAnalyticsStore(state => state.updateBottlenecks);

  /*
   * buildings/resources нужны ТОЛЬКО в обработчике кнопки. Подписка на них
   * перерисовывала эту панель 20 раз в секунду (tick() возвращает новый `resources`
   * на каждый тик). Читаем актуальное состояние в момент клика — не из замыкания.
   */
  const handleRefresh = useCallback(() => {
    const { buildings, resources } = useGameStore.getState();
    updateBottlenecks(buildings, resources);
  }, [updateBottlenecks]);

  const criticalCount = bottlenecks.filter(b => b.severity === 'critical').length;
  const highCount = bottlenecks.filter(b => b.severity === 'high').length;
  const mediumCount = bottlenecks.filter(b => b.severity === 'medium').length;
  const lowCount = bottlenecks.filter(b => b.severity === 'low').length;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <Panel
        title="Анализ узких мест"
        actions={
          <button onClick={handleRefresh} className="btn btn-xs">
            Обновить
          </button>
        }
      >
        {bottlenecks.length === 0 ? (
          <EmptyState
            icon={<span className="text-4xl">✅</span>}
            title={<span className="text-green-400">Узких мест не обнаружено</span>}
            hint="Производство работает эффективно"
          />
        ) : (
          <div className="grid grid-cols-4 gap-2">
            <div className="rounded bg-red-900/20 p-2">
              <Stat align="center" tone="danger" label="Критичных" value={criticalCount} />
            </div>
            <div className="rounded bg-orange-900/20 p-2">
              <Stat align="center" tone="warning" label="Высоких" value={highCount} />
            </div>
            <div className="rounded bg-yellow-900/20 p-2">
              <Stat align="center" tone="warning" label="Средних" value={mediumCount} />
            </div>
            <div className="rounded bg-blue-900/20 p-2">
              <Stat align="center" tone="info" label="Низких" value={lowCount} />
            </div>
          </div>
        )}
      </Panel>

      {/* Bottleneck Cards */}
      {bottlenecks.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {bottlenecks.map(bottleneck => (
            <BottleneckCard key={bottleneck.id} bottleneck={bottleneck} />
          ))}
        </div>
      )}
    </div>
  );
});
