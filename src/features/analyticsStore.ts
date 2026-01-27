/**
 * Analytics Store
 * 
 * Zustand store для управления аналитикой и сбором данных
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import Decimal from 'break_eternity.js';
import type { ResourceType, Building, ResourceState } from '../core/gameTypes';
import type {
  AnalyticsState,
  ProductionHistory,
  Bottleneck,
  ResourceLoss,
  BuildingROI,
  DataPoint,
  TimeRange,
  ChartType,
  ChartSettings,
  LossReason,
  ANALYTICS_CONFIG,
} from '../core/gameTypes.analytics';
import { getDefaultAnalyticsState } from '../core/gameTypes.analytics';
import { D } from '../core/math/format';
import {
  updateProductionHistory,
  calculateResourceProduction,
  filterByTimeRange,
  calculateEfficiencyScore,
  calculateStorageEfficiency,
  calculateEnergyEfficiency,
} from '../utils/analyticsHelpers';
import { detectBottlenecks, calculateBottleneckPenalty } from '../utils/bottleneckDetector';
import { calculateAllBuildingsROI } from '../utils/roiCalculator';

// ============================================================================
// Store Interface
// ============================================================================

interface AnalyticsStoreState extends AnalyticsState {
  // Actions - Сбор данных
  collectData: (
    buildings: Building[],
    resources: Record<ResourceType, ResourceState>
  ) => void;
  
  // Actions - Узкие места
  updateBottlenecks: (
    buildings: Building[],
    resources: Record<ResourceType, ResourceState>
  ) => void;
  
  // Actions - ROI
  updateROIs: (
    buildings: Building[],
    resources: Record<ResourceType, ResourceState>
  ) => void;
  
  // Actions - Потери
  recordLoss: (
    resource: ResourceType,
    amount: Decimal,
    reason: LossReason,
    details?: string
  ) => void;
  clearOldLosses: () => void;
  
  // Actions - Финансы
  recordCreditsEarned: (amount: Decimal) => void;
  recordCreditsSpent: (amount: Decimal) => void;
  
  // Actions - Настройки отображения
  setChartSettings: (settings: Partial<ChartSettings>) => void;
  setTimeRange: (range: TimeRange) => void;
  setChartType: (type: ChartType) => void;
  toggleResource: (resource: ResourceType) => void;
  setSelectedResources: (resources: ResourceType[]) => void;
  setShowOnlyProblems: (show: boolean) => void;
  
  // Actions - Утилиты
  getFilteredHistory: (resource: ResourceType) => DataPoint[];
  getResourcesWithHistory: () => ResourceType[];
  reset: () => void;
}

// ============================================================================
// Store Implementation
// ============================================================================

export const useAnalyticsStore = create<AnalyticsStoreState>()(
  persist(
    (set, get) => ({
      ...getDefaultAnalyticsState(),

      // ==========================================
      // Сбор данных
      // ==========================================
      
      collectData: (buildings, resources) => {
        const state = get();
        const now = Date.now();
        
        // Проверяем интервал сбора (5 минут)
        const COLLECTION_INTERVAL = 5 * 60 * 1000;
        if (now - state.lastCollected < COLLECTION_INTERVAL) {
          return;
        }
        
        // Обновляем историю производства для каждого ресурса
        const newProductionHistory = { ...state.productionHistory };
        
        for (const resourceKey of Object.keys(resources)) {
          const resource = resourceKey as ResourceType;
          const production = calculateResourceProduction(buildings, resource);
          
          // Обновляем только если есть какое-то производство или уже есть история
          if (production.gt(0) || state.productionHistory[resource]) {
            newProductionHistory[resource] = updateProductionHistory(
              state.productionHistory[resource],
              resource,
              production
            );
          }
        }
        
        // Рассчитываем эффективность
        const energyProd = calculateResourceProduction(buildings, 'energy');
        const energyCons = buildings.reduce((acc, b) => {
          if (b.count === 0 || b.disabled) return acc;
          const upkeep = b.upkeep?.energy || b.inputs?.energy || D(0);
          return acc.add(upkeep.mul(b.count));
        }, D(0));
        
        const productionEfficiency = 100; // Упрощённо
        const energyEfficiency = calculateEnergyEfficiency(energyProd, energyCons);
        const storageEfficiency = calculateStorageEfficiency(resources);
        const bottleneckPenalty = calculateBottleneckPenalty(state.bottlenecks);
        
        const efficiencyScore = calculateEfficiencyScore(
          productionEfficiency,
          energyEfficiency,
          storageEfficiency,
          bottleneckPenalty
        );
        
        set({
          productionHistory: newProductionHistory,
          efficiencyScore,
          efficiencyBreakdown: {
            production: productionEfficiency,
            energy: energyEfficiency,
            storage: storageEfficiency,
            bottlenecks: 100 - bottleneckPenalty,
          },
          lastCollected: now,
          lastUpdated: now,
        });
      },

      // ==========================================
      // Узкие места
      // ==========================================
      
      updateBottlenecks: (buildings, resources) => {
        const bottlenecks = detectBottlenecks(buildings, resources);
        set({ 
          bottlenecks,
          lastUpdated: Date.now(),
        });
      },

      // ==========================================
      // ROI
      // ==========================================
      
      updateROIs: (buildings, resources) => {
        const buildingROIs = calculateAllBuildingsROI(buildings, resources);
        set({ 
          buildingROIs,
          lastUpdated: Date.now(),
        });
      },

      // ==========================================
      // Потери ресурсов
      // ==========================================
      
      recordLoss: (resource, amount, reason, details) => {
        const state = get();
        const newLoss: ResourceLoss = {
          id: `loss_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          resource,
          reason,
          amount: amount.toString(),
          timestamp: Date.now(),
          details,
        };
        
        // Храним последние 100 записей
        const losses = [newLoss, ...state.losses].slice(0, 100);
        set({ losses });
      },
      
      clearOldLosses: () => {
        const state = get();
        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
        const losses = state.losses.filter(l => l.timestamp >= oneDayAgo);
        set({ losses });
      },

      // ==========================================
      // Финансы
      // ==========================================
      
      recordCreditsEarned: (amount) => {
        const state = get();
        const newTotal = D(state.totalCreditsEarned).add(amount);
        
        // Добавляем точку в историю P/L
        const profitLossHistory = [
          ...state.profitLossHistory,
          {
            timestamp: Date.now(),
            value: newTotal.sub(D(state.totalCreditsSpent)).toString(),
          },
        ].slice(-288); // Последние 24 часа
        
        set({ 
          totalCreditsEarned: newTotal.toString(),
          profitLossHistory,
        });
      },
      
      recordCreditsSpent: (amount) => {
        const state = get();
        const newTotal = D(state.totalCreditsSpent).add(amount);
        
        // Добавляем точку в историю P/L
        const profitLossHistory = [
          ...state.profitLossHistory,
          {
            timestamp: Date.now(),
            value: D(state.totalCreditsEarned).sub(newTotal).toString(),
          },
        ].slice(-288);
        
        set({ 
          totalCreditsSpent: newTotal.toString(),
          profitLossHistory,
        });
      },

      // ==========================================
      // Настройки отображения
      // ==========================================
      
      setChartSettings: (settings) => {
        const state = get();
        set({
          chartSettings: { ...state.chartSettings, ...settings },
        });
      },
      
      setTimeRange: (timeRange) => {
        const state = get();
        set({
          chartSettings: { ...state.chartSettings, timeRange },
        });
      },
      
      setChartType: (type) => {
        const state = get();
        set({
          chartSettings: { ...state.chartSettings, type },
        });
      },
      
      toggleResource: (resource) => {
        const state = get();
        const selected = state.selectedResources.includes(resource)
          ? state.selectedResources.filter(r => r !== resource)
          : [...state.selectedResources, resource];
        set({ selectedResources: selected });
      },
      
      setSelectedResources: (resources) => {
        set({ selectedResources: resources });
      },
      
      setShowOnlyProblems: (show) => {
        set({ showOnlyProblems: show });
      },

      // ==========================================
      // Утилиты
      // ==========================================
      
      getFilteredHistory: (resource) => {
        const state = get();
        const history = state.productionHistory[resource];
        if (!history) return [];
        return filterByTimeRange(history.data, state.chartSettings.timeRange);
      },
      
      getResourcesWithHistory: () => {
        const state = get();
        return Object.keys(state.productionHistory) as ResourceType[];
      },
      
      reset: () => {
        set(getDefaultAnalyticsState());
      },
    }),
    {
      name: 'analytics-storage',
      version: 1,
      partialize: (state) => ({
        // Сохраняем только важные данные
        productionHistory: state.productionHistory,
        losses: state.losses,
        totalCreditsEarned: state.totalCreditsEarned,
        totalCreditsSpent: state.totalCreditsSpent,
        profitLossHistory: state.profitLossHistory,
        chartSettings: state.chartSettings,
        selectedResources: state.selectedResources,
        lastCollected: state.lastCollected,
      }),
    }
  )
);

// ============================================================================
// Селекторы
// ============================================================================

/**
 * Селектор для получения топ узких мест
 */
export const selectTopBottlenecks = (limit: number = 5) => 
  (state: AnalyticsStoreState) => state.bottlenecks.slice(0, limit);

/**
 * Селектор для получения критических узких мест
 */
export const selectCriticalBottlenecks = 
  (state: AnalyticsStoreState) => state.bottlenecks.filter(b => b.severity === 'critical');

/**
 * Селектор для топ прибыльных зданий
 */
export const selectTopProfitableBuildings = (limit: number = 5) =>
  (state: AnalyticsStoreState) => state.buildingROIs
    .filter(r => r.currentROI > 0)
    .slice(0, limit);

/**
 * Селектор для убыточных зданий
 */
export const selectUnprofitableBuildings = 
  (state: AnalyticsStoreState) => state.buildingROIs.filter(r => r.currentROI < 0);

/**
 * Селектор для общего P/L
 */
export const selectNetProfitLoss = (state: AnalyticsStoreState) => 
  D(state.totalCreditsEarned).sub(D(state.totalCreditsSpent));

/**
 * Селектор для истории выбранных ресурсов
 */
export const selectSelectedResourcesHistory = (state: AnalyticsStoreState) => {
  const result: Array<{ key: string; data: DataPoint[] }> = [];
  for (const resource of state.selectedResources) {
    const history = state.productionHistory[resource];
    if (history) {
      result.push({
        key: resource,
        data: filterByTimeRange(history.data, state.chartSettings.timeRange),
      });
    }
  }
  return result;
};
