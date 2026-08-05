/**
 * AnalyticsPanel Component
 *
 * Главная панель аналитики с вкладками
 */

import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart2,
  AlertTriangle,
  Calculator,
  Gauge,
  PieChart,
  TrendingUp,
  Clock,
  Settings,
  Zap,
} from 'lucide-react';
import { useAnalyticsStore } from '../../../features/analyticsStore';
import { useGameStore } from '../../../features/gameStore';
import { Badge, Field, Modal, Panel, Tabs, type TabItem } from '../../ui';
import { ProductionChartsGrid } from './ProductionChart';
import { BottleneckAnalyzer } from './BottleneckAnalyzer';
import { ROICalculator } from './ROICalculator';
import { EfficiencyScore } from './EfficiencyScore';
import { ResourceDistribution } from './ResourceDistribution';
import { LossTracker } from './LossTracker';
import { ProfitLossChart } from './ProfitLossChart';
import { EnergyBreakdown } from './EnergyBreakdown';
import type { TimeRange } from '../../../core/gameTypes.analytics';
import type { ResourceType } from '../../../core/gameTypes';
import { getTimeRangeLabel } from '../../../core/gameTypes.analytics';

type TabId = 'overview' | 'production' | 'energy' | 'bottlenecks' | 'roi' | 'losses' | 'financials';

const TAB_DEFS: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'overview', label: 'Обзор', icon: Gauge },
  { id: 'production', label: 'Производство', icon: BarChart2 },
  { id: 'energy', label: 'Энергия', icon: Zap },
  { id: 'bottlenecks', label: 'Узкие места', icon: AlertTriangle },
  { id: 'roi', label: 'ROI', icon: Calculator },
  { id: 'losses', label: 'Потери', icon: TrendingUp },
  { id: 'financials', label: 'Финансы', icon: PieChart },
];

const TIME_RANGES: TimeRange[] = ['1h', '6h', '12h', '24h', '7d', '30d'];

const TIME_RANGE_TABS: TabItem<TimeRange>[] = TIME_RANGES.map(range => ({
  id: range,
  label: getTimeRangeLabel(range),
}));

/**
 * Мемоизирован, потому что родитель (SidePanelTabs) подписан на широкие срезы стора
 * и перерисовывается вместе с игровым тиком, 20 раз в секунду. Без memo весь этот
 * поддерев — включая графики recharts — пересобирался бы с той же частотой.
 */
export const AnalyticsPanel = memo(function AnalyticsPanel() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [showSettings, setShowSettings] = useState(false);

  const timeRange = useAnalyticsStore(state => state.chartSettings.timeRange);
  const setTimeRange = useAnalyticsStore(state => state.setTimeRange);
  const collectData = useAnalyticsStore(state => state.collectData);
  const updateBottlenecks = useAnalyticsStore(state => state.updateBottlenecks);
  const updateROIs = useAnalyticsStore(state => state.updateROIs);
  const lastUpdated = useAnalyticsStore(state => state.lastUpdated);
  const bottlenecks = useAnalyticsStore(state => state.bottlenecks);

  /*
   * buildings/resources больше НЕ подписки: они нужны только как аргументы вызовов
   * внутри эффектов. tick() возвращает новый объект `resources` 20 раз в секунду, так что
   * подписка на него будила всю панель аналитики на каждом тике. Берём актуальное
   * состояние в момент вызова — не из замыкания.
   */

  // Обновляем данные при открытии панели
  useEffect(() => {
    const { buildings, resources } = useGameStore.getState();
    collectData(buildings, resources);
    updateBottlenecks(buildings, resources);
    updateROIs(buildings, resources);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
   * Периодическое обновление.
   *
   * ВАЖНО: раньше у этого эффекта были зависимости [buildings, resources]. Оба меняли
   * ссылку на каждом тике, поэтому интервал пересоздавался 20 раз в секунду и НИ РАЗУ
   * не доживал до своих 30 секунд — узкие места не пересчитывались вообще. Со стабильными
   * зависимостями таймер наконец срабатывает так, как и было задумано в комментарии.
   */
  useEffect(() => {
    const interval = setInterval(() => {
      const { buildings, resources } = useGameStore.getState();
      updateBottlenecks(buildings, resources);
    }, 30000); // каждые 30 секунд

    return () => clearInterval(interval);
  }, [updateBottlenecks]);

  const criticalBottlenecks = bottlenecks.filter(b => b.severity === 'critical').length;

  const tabItems = useMemo<TabItem<TabId>[]>(
    () =>
      TAB_DEFS.map(({ id, label, icon: Icon }) => ({
        id,
        label,
        icon: <Icon className="h-4 w-4" />,
        badge: id === 'bottlenecks' && criticalBottlenecks > 0 ? criticalBottlenecks : undefined,
      })),
    [criticalBottlenecks],
  );

  return (
    <div className="flex h-full flex-col bg-cyber-gray-900">
      {/* Header */}
      <div className="flex-none border-b border-cyber-gray-700 p-4">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BarChart2 className="h-6 w-6 text-cyber-green-400" />
            <h2 className="text-xl font-bold text-cyber-gray-100">Аналитика</h2>
            {criticalBottlenecks > 0 && (
              <Badge tone="danger" className="animate-pulse">
                {criticalBottlenecks} критично
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-xs text-cyber-gray-500">
              <Clock className="h-3 w-3" />
              <span>
                Обновлено: {new Date(lastUpdated).toLocaleTimeString('ru-RU')}
              </span>
            </div>
            <button
              onClick={() => setShowSettings(true)}
              className="icon-btn"
              aria-label="Настройки аналитики"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Time Range Selector */}
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-xs text-cyber-gray-500">Период:</span>
          <Tabs items={TIME_RANGE_TABS} value={timeRange} onChange={setTimeRange} size="sm" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-none overflow-x-auto p-2">
        <Tabs items={tabItems} value={activeTab} onChange={setActiveTab} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'production' && <ProductionTab />}
        {activeTab === 'energy' && <EnergyBreakdown />}
        {activeTab === 'bottlenecks' && <BottleneckAnalyzer />}
        {activeTab === 'roi' && <ROICalculator />}
        {activeTab === 'losses' && <LossTracker />}
        {activeTab === 'financials' && <FinancialsTab />}
      </div>

      {/* Settings Modal */}
      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
});

/**
 * Overview Tab
 */
const OverviewTab = memo(function OverviewTab() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <EfficiencyScore />
        <ResourceDistribution type="resources" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ResourceDistribution type="energy" />
        <ProfitLossChart />
      </div>
    </div>
  );
});

/**
 * Production Tab
 */
const ProductionTab = memo(function ProductionTab() {
  const productionHistory = useAnalyticsStore(state => state.productionHistory);
  const selectedResources = useAnalyticsStore(state => state.selectedResources);
  const setSelectedResources = useAnalyticsStore(state => state.setSelectedResources);
  const toggleResource = useAnalyticsStore(state => state.toggleResource);

  const availableResources = useMemo(
    () => Object.keys(productionHistory) as ResourceType[],
    [productionHistory],
  );

  return (
    <div className="space-y-4">
      {/* Resource Selector */}
      <Panel
        title="Выберите ресурсы для отображения"
        actions={
          <>
            <button
              onClick={() => setSelectedResources(availableResources.slice(0, 6))}
              className="btn btn-xs"
            >
              Топ-6
            </button>
            <button onClick={() => setSelectedResources([])} className="btn btn-xs">
              Сбросить
            </button>
          </>
        }
      >
        <div className="flex flex-wrap gap-2">
          {availableResources.map(resource => (
            <button
              key={resource}
              onClick={() => toggleResource(resource)}
              className={`btn btn-xs capitalize ${
                selectedResources.includes(resource) ? 'btn-primary' : ''
              }`}
            >
              {resource.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </Panel>

      <ProductionChartsGrid />
    </div>
  );
});

/**
 * Financials Tab
 */
const FinancialsTab = memo(function FinancialsTab() {
  return (
    <div className="space-y-6">
      <ProfitLossChart />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ResourceDistribution type="resources" />
        <ResourceDistribution type="energy" />
      </div>
    </div>
  );
});

/**
 * Settings Modal
 *
 * Было собственное `fixed inset-0` сz-50: без Escape, без ловушки фокуса, без блокировки
 * прокрутки фона и без корректного порядка слоёв поверх других окон. Теперь общий <Modal>.
 */
const SettingsModal = memo(function SettingsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const chartSettings = useAnalyticsStore(state => state.chartSettings);
  const setChartSettings = useAnalyticsStore(state => state.setChartSettings);
  const reset = useAnalyticsStore(state => state.reset);

  const handleReset = useCallback(() => {
    if (confirm('Сбросить все данные аналитики?')) {
      reset();
      onClose();
    }
  }, [reset, onClose]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Настройки аналитики"
      icon={<Settings size={18} />}
      size="sm"
      footer={
        <button onClick={handleReset} className="btn btn-danger btn-block">
          Сбросить все данные
        </button>
      }
    >
      <div className="space-y-4 p-4">
        <Field label="Сетка на графиках">
          <button
            onClick={() => setChartSettings({ showGrid: !chartSettings.showGrid })}
            className={`btn btn-block ${chartSettings.showGrid ? 'btn-primary' : ''}`}
          >
            {chartSettings.showGrid ? 'Включена' : 'Выключена'}
          </button>
        </Field>

        <Field label="Легенда">
          <button
            onClick={() => setChartSettings({ showLegend: !chartSettings.showLegend })}
            className={`btn btn-block ${chartSettings.showLegend ? 'btn-primary' : ''}`}
          >
            {chartSettings.showLegend ? 'Показана' : 'Скрыта'}
          </button>
        </Field>

        <Field label="Анимация">
          <button
            onClick={() => setChartSettings({ animated: !chartSettings.animated })}
            className={`btn btn-block ${chartSettings.animated ? 'btn-primary' : ''}`}
          >
            {chartSettings.animated ? 'Включена' : 'Выключена'}
          </button>
        </Field>
      </div>
    </Modal>
  );
});
