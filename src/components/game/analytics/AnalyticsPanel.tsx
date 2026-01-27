/**
 * AnalyticsPanel Component
 * 
 * Главная панель аналитики с вкладками
 */

import React, { useState, useEffect } from 'react';
import { 
  BarChart2, 
  AlertTriangle, 
  Calculator, 
  Gauge, 
  PieChart, 
  TrendingUp,
  Clock,
  Settings,
  X
} from 'lucide-react';
import { useAnalyticsStore } from '../../../features/analyticsStore';
import { useGameStore } from '../../../features/gameStore';
import { ProductionChartsGrid } from './ProductionChart';
import { BottleneckAnalyzer } from './BottleneckAnalyzer';
import { ROICalculator } from './ROICalculator';
import { EfficiencyScore } from './EfficiencyScore';
import { ResourceDistribution } from './ResourceDistribution';
import { LossTracker } from './LossTracker';
import { ProfitLossChart } from './ProfitLossChart';
import type { TimeRange, ResourceType } from '../../../core/gameTypes.analytics';
import { getTimeRangeLabel } from '../../../core/gameTypes.analytics';

type TabId = 'overview' | 'production' | 'bottlenecks' | 'roi' | 'losses' | 'financials';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TABS: Tab[] = [
  { id: 'overview', label: 'Обзор', icon: Gauge },
  { id: 'production', label: 'Производство', icon: BarChart2 },
  { id: 'bottlenecks', label: 'Узкие места', icon: AlertTriangle },
  { id: 'roi', label: 'ROI', icon: Calculator },
  { id: 'losses', label: 'Потери', icon: TrendingUp },
  { id: 'financials', label: 'Финансы', icon: PieChart },
];

const TIME_RANGES: TimeRange[] = ['1h', '6h', '12h', '24h', '7d', '30d'];

export function AnalyticsPanel() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [showSettings, setShowSettings] = useState(false);
  
  const buildings = useGameStore(state => state.buildings);
  const resources = useGameStore(state => state.resources);
  
  const timeRange = useAnalyticsStore(state => state.chartSettings.timeRange);
  const setTimeRange = useAnalyticsStore(state => state.setTimeRange);
  const collectData = useAnalyticsStore(state => state.collectData);
  const updateBottlenecks = useAnalyticsStore(state => state.updateBottlenecks);
  const updateROIs = useAnalyticsStore(state => state.updateROIs);
  const lastUpdated = useAnalyticsStore(state => state.lastUpdated);
  const bottlenecks = useAnalyticsStore(state => state.bottlenecks);

  // Обновляем данные при открытии панели
  useEffect(() => {
    collectData(buildings, resources);
    updateBottlenecks(buildings, resources);
    updateROIs(buildings, resources);
  }, []);

  // Периодическое обновление
  useEffect(() => {
    const interval = setInterval(() => {
      updateBottlenecks(buildings, resources);
    }, 30000); // каждые 30 секунд
    
    return () => clearInterval(interval);
  }, [buildings, resources]);

  const criticalBottlenecks = bottlenecks.filter(b => b.severity === 'critical').length;

  return (
    <div className="h-full flex flex-col bg-cyber-gray-900">
      {/* Header */}
      <div className="flex-none p-4 border-b border-cyber-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <BarChart2 className="w-6 h-6 text-cyber-green-400" />
            <h2 className="text-xl font-bold text-cyber-gray-100">Аналитика</h2>
            {criticalBottlenecks > 0 && (
              <span className="bg-red-600 text-white text-xs px-2 py-0.5 rounded-full animate-pulse">
                {criticalBottlenecks} критично
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-xs text-cyber-gray-500">
              <Clock className="w-3 h-3" />
              <span>
                Обновлено: {new Date(lastUpdated).toLocaleTimeString('ru-RU')}
              </span>
            </div>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2 rounded transition-colors ${
                showSettings 
                  ? 'bg-cyber-green-600 text-white' 
                  : 'bg-cyber-gray-700 text-cyber-gray-300 hover:bg-cyber-gray-600'
              }`}
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Time Range Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-cyber-gray-500">Период:</span>
          {TIME_RANGES.map(range => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`text-xs px-3 py-1 rounded transition-colors ${
                timeRange === range
                  ? 'bg-cyber-green-600 text-white'
                  : 'bg-cyber-gray-700 text-cyber-gray-300 hover:bg-cyber-gray-600'
              }`}
            >
              {getTimeRangeLabel(range)}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-none flex border-b border-cyber-gray-700 overflow-x-auto">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                isActive
                  ? 'text-cyber-green-400 border-b-2 border-cyber-green-400 bg-cyber-gray-800/50'
                  : 'text-cyber-gray-400 hover:text-cyber-gray-200 hover:bg-cyber-gray-800/30'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {tab.id === 'bottlenecks' && criticalBottlenecks > 0 && (
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'production' && <ProductionTab />}
        {activeTab === 'bottlenecks' && <BottleneckAnalyzer />}
        {activeTab === 'roi' && <ROICalculator />}
        {activeTab === 'losses' && <LossTracker />}
        {activeTab === 'financials' && <FinancialsTab />}
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}

/**
 * Overview Tab
 */
function OverviewTab() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <EfficiencyScore />
        <ResourceDistribution type="resources" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ResourceDistribution type="energy" />
        <ProfitLossChart />
      </div>
    </div>
  );
}

/**
 * Production Tab
 */
function ProductionTab() {
  const productionHistory = useAnalyticsStore(state => state.productionHistory);
  const selectedResources = useAnalyticsStore(state => state.selectedResources);
  const setSelectedResources = useAnalyticsStore(state => state.setSelectedResources);
  const toggleResource = useAnalyticsStore(state => state.toggleResource);

  const availableResources = Object.keys(productionHistory) as ResourceType[];

  return (
    <div className="space-y-4">
      {/* Resource Selector */}
      <div className="bg-cyber-gray-800/50 rounded-lg border border-cyber-gray-700 p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-cyber-gray-300">
            Выберите ресурсы для отображения
          </h4>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedResources(availableResources.slice(0, 6))}
              className="text-xs bg-cyber-gray-700 hover:bg-cyber-gray-600 text-cyber-gray-300 px-2 py-1 rounded"
            >
              Топ-6
            </button>
            <button
              onClick={() => setSelectedResources([])}
              className="text-xs bg-cyber-gray-700 hover:bg-cyber-gray-600 text-cyber-gray-300 px-2 py-1 rounded"
            >
              Сбросить
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {availableResources.map(resource => (
            <button
              key={resource}
              onClick={() => toggleResource(resource)}
              className={`text-xs px-3 py-1 rounded capitalize transition-colors ${
                selectedResources.includes(resource)
                  ? 'bg-cyber-green-600 text-white'
                  : 'bg-cyber-gray-700 text-cyber-gray-300 hover:bg-cyber-gray-600'
              }`}
            >
              {resource.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      <ProductionChartsGrid />
    </div>
  );
}

/**
 * Financials Tab
 */
function FinancialsTab() {
  return (
    <div className="space-y-6">
      <ProfitLossChart />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ResourceDistribution type="resources" />
        <ResourceDistribution type="energy" />
      </div>
    </div>
  );
}

/**
 * Settings Modal
 */
interface SettingsModalProps {
  onClose: () => void;
}

function SettingsModal({ onClose }: SettingsModalProps) {
  const chartSettings = useAnalyticsStore(state => state.chartSettings);
  const setChartSettings = useAnalyticsStore(state => state.setChartSettings);
  const reset = useAnalyticsStore(state => state.reset);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-cyber-gray-800 rounded-lg border border-cyber-gray-700 p-6 w-96">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-cyber-gray-200">
            Настройки аналитики
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-cyber-gray-700 rounded"
          >
            <X className="w-5 h-5 text-cyber-gray-400" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-cyber-gray-400 mb-2">
              Сетка на графиках
            </label>
            <button
              onClick={() => setChartSettings({ showGrid: !chartSettings.showGrid })}
              className={`w-full py-2 rounded transition-colors ${
                chartSettings.showGrid
                  ? 'bg-cyber-green-600 text-white'
                  : 'bg-cyber-gray-700 text-cyber-gray-300'
              }`}
            >
              {chartSettings.showGrid ? 'Включена' : 'Выключена'}
            </button>
          </div>

          <div>
            <label className="block text-sm text-cyber-gray-400 mb-2">
              Легенда
            </label>
            <button
              onClick={() => setChartSettings({ showLegend: !chartSettings.showLegend })}
              className={`w-full py-2 rounded transition-colors ${
                chartSettings.showLegend
                  ? 'bg-cyber-green-600 text-white'
                  : 'bg-cyber-gray-700 text-cyber-gray-300'
              }`}
            >
              {chartSettings.showLegend ? 'Показана' : 'Скрыта'}
            </button>
          </div>

          <div>
            <label className="block text-sm text-cyber-gray-400 mb-2">
              Анимация
            </label>
            <button
              onClick={() => setChartSettings({ animated: !chartSettings.animated })}
              className={`w-full py-2 rounded transition-colors ${
                chartSettings.animated
                  ? 'bg-cyber-green-600 text-white'
                  : 'bg-cyber-gray-700 text-cyber-gray-300'
              }`}
            >
              {chartSettings.animated ? 'Включена' : 'Выключена'}
            </button>
          </div>

          <hr className="border-cyber-gray-700" />

          <button
            onClick={() => {
              if (confirm('Сбросить все данные аналитики?')) {
                reset();
                onClose();
              }
            }}
            className="w-full py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
          >
            Сбросить все данные
          </button>
        </div>
      </div>
    </div>
  );
}
