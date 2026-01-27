/**
 * Типы для системы аналитики и графиков
 * Фаза 2: Подробные графики и аналитика
 */

import type Decimal from 'break_eternity.js';
import type { ResourceType } from './gameTypes';

// ==========================================
// ТОЧКИ ДАННЫХ
// ==========================================

/**
 * Точка данных для графика
 */
export interface DataPoint {
  timestamp: number;          // Unix timestamp в миллисекундах
  value: string;              // Decimal как строка для сериализации
}

/**
 * Точка данных с меткой (для pie charts и др.)
 */
export interface LabeledDataPoint {
  label: string;
  value: string;
  color?: string;
}

// ==========================================
// ИСТОРИЯ ПРОИЗВОДСТВА
// ==========================================

/**
 * История производства ресурса
 */
export interface ProductionHistory {
  resource: ResourceType;
  data: DataPoint[];          // Последние 24 часа, точка каждые 5 минут (288 точек макс)
  avgProduction: string;      // Среднее производство/сек (Decimal)
  peakProduction: string;     // Пиковое производство (Decimal)
  minProduction: string;      // Минимальное производство (Decimal)
  totalProduced: string;      // Всего произведено за период (Decimal)
  trend: 'up' | 'down' | 'stable'; // Тренд производства
  trendPercent: number;       // Изменение в % за последний час
}

/**
 * Конфигурация сбора данных
 */
export const ANALYTICS_CONFIG = {
  /** Интервал сбора данных в миллисекундах (5 минут) */
  COLLECTION_INTERVAL_MS: 5 * 60 * 1000,
  /** Максимальное количество точек данных (24 часа) */
  MAX_DATA_POINTS: 288,
  /** Интервал для агрегированных данных (1 час) */
  AGGREGATION_INTERVAL_MS: 60 * 60 * 1000,
  /** Максимальное количество агрегированных точек (30 дней) */
  MAX_AGGREGATED_POINTS: 720,
} as const;

// ==========================================
// УЗКИЕ МЕСТА (BOTTLENECKS)
// ==========================================

/**
 * Уровень серьёзности узкого места
 */
export type BottleneckSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Узкое место в производстве
 */
export interface Bottleneck {
  id: string;                     // Уникальный ID
  resource: ResourceType;
  severity: BottleneckSeverity;
  consumingBuildings: string[];   // ID зданий, которые потребляют
  producingBuildings: string[];   // ID зданий, которые производят
  consumption: string;            // Потребление/сек (Decimal)
  production: string;             // Производство/сек (Decimal)
  deficit: string;                // Дефицит/сек (Decimal) - положительное = дефицит
  currentStock: string;           // Текущий запас (Decimal)
  timeToDepletion: number | null; // Секунд до истощения (null = не истощится)
  recommendation: string;         // Подсказка для игрока
  detectedAt: number;             // Когда обнаружено
}

/**
 * Пороги для определения серьёзности узкого места
 */
export const BOTTLENECK_THRESHOLDS = {
  /** Потребление > производства × 1.1 */
  LOW: 1.1,
  /** Потребление > производства × 1.5 */
  MEDIUM: 1.5,
  /** Потребление > производства × 2.0 */
  HIGH: 2.0,
  /** Ресурс = 0 и есть потребление */
  CRITICAL: 'depleted',
} as const;

// ==========================================
// ПОТЕРИ РЕСУРСОВ
// ==========================================

/**
 * Причина потери ресурса
 */
export type LossReason = 'overflow' | 'decay' | 'combat' | 'event' | 'conversion';

/**
 * Запись о потере ресурса
 */
export interface ResourceLoss {
  id: string;
  resource: ResourceType;
  reason: LossReason;
  amount: string;             // Decimal
  timestamp: number;
  details?: string;           // Дополнительная информация
}

// ==========================================
// ROI (ОКУПАЕМОСТЬ)
// ==========================================

/**
 * Уровень прибыльности
 */
export type ProfitabilityLevel = 'excellent' | 'good' | 'average' | 'poor' | 'negative';

/**
 * ROI расчёт для здания
 */
export interface BuildingROI {
  buildingId: string;
  buildingName: string;
  buildingType: string;
  totalCost: string;              // Стоимость постройки (Decimal)
  operatingCostPerSec: string;    // Операционные расходы/сек (энергия и пр.)
  revenuePerSec: string;          // Доход/сек от производства
  netProfitPerSec: string;        // Чистая прибыль/сек (Decimal)
  paybackTimeSeconds: number;     // Время окупаемости в секундах
  paybackTimeFormatted: string;   // Форматированное время ("2ч 15м")
  currentROI: number;             // Текущий ROI в % (часовой)
  profitability: ProfitabilityLevel;
  energyConsumption: string;      // Потребление энергии/сек
  isOperating: boolean;           // Работает ли здание
}

/**
 * Пороги ROI для классификации прибыльности
 */
export const ROI_THRESHOLDS = {
  /** ROI > 50% в час */
  EXCELLENT: 50,
  /** ROI > 20% в час */
  GOOD: 20,
  /** ROI > 5% в час */
  AVERAGE: 5,
  /** ROI > 0% в час */
  POOR: 0,
  /** ROI <= 0% */
  NEGATIVE: -Infinity,
} as const;

// ==========================================
// ОБЩАЯ АНАЛИТИКА
// ==========================================

/**
 * Тип графика
 */
export type ChartType = 
  | 'line'           // Линейный график
  | 'area'           // График с заливкой
  | 'bar'            // Столбчатый
  | 'pie'            // Круговая диаграмма
  | 'heatmap'        // Тепловая карта
  | 'candlestick';   // Свечной (для цен)

/**
 * Временной диапазон для графиков
 */
export type TimeRange = '1h' | '6h' | '12h' | '24h' | '7d' | '30d';

/**
 * Настройки графика
 */
export interface ChartSettings {
  type: ChartType;
  timeRange: TimeRange;
  showGrid: boolean;
  showLegend: boolean;
  animated: boolean;
  stacked?: boolean;          // Для area/bar charts
}

/**
 * Состояние аналитики
 */
export interface AnalyticsState {
  // История производства по ресурсам
  productionHistory: Partial<Record<ResourceType, ProductionHistory>>;
  
  // Текущие узкие места
  bottlenecks: Bottleneck[];
  
  // Журнал потерь ресурсов (последние 100 записей)
  losses: ResourceLoss[];
  
  // ROI всех зданий
  buildingROIs: BuildingROI[];
  
  // Финансовая статистика
  totalCreditsEarned: string;     // Decimal
  totalCreditsSpent: string;      // Decimal
  profitLossHistory: DataPoint[]; // История P/L
  
  // Общая оценка эффективности (0-100%)
  efficiencyScore: number;
  efficiencyBreakdown: {
    production: number;           // Эффективность производства
    energy: number;               // Эффективность энергии
    storage: number;              // Использование хранилищ
    bottlenecks: number;          // Штраф за узкие места
  };
  
  // Время последнего обновления
  lastUpdated: number;
  lastCollected: number;          // Последний сбор данных
  
  // Настройки отображения
  chartSettings: ChartSettings;
  selectedResources: ResourceType[];
  showOnlyProblems: boolean;
}

// ==========================================
// АГРЕГИРОВАННЫЕ ДАННЫЕ
// ==========================================

/**
 * Агрегированная точка данных (для долгосрочного хранения)
 */
export interface AggregatedDataPoint {
  timestamp: number;        // Начало периода
  min: string;              // Минимум за период
  max: string;              // Максимум за период
  avg: string;              // Среднее за период
  sum: string;              // Сумма за период
  count: number;            // Количество точек
}

/**
 * Долгосрочная история ресурса
 */
export interface LongTermHistory {
  resource: ResourceType;
  hourlyData: AggregatedDataPoint[];   // Почасовые данные (30 дней)
  dailyData: AggregatedDataPoint[];    // Дневные данные (1 год)
}

// ==========================================
// ЭКСПОРТ ОТЧЁТОВ
// ==========================================

/**
 * Формат экспорта отчёта
 */
export type ExportFormat = 'json' | 'csv' | 'pdf';

/**
 * Конфигурация экспорта
 */
export interface ExportConfig {
  format: ExportFormat;
  includeProduction: boolean;
  includeBottlenecks: boolean;
  includeLosses: boolean;
  includeROI: boolean;
  includeFinancials: boolean;
  timeRange: TimeRange;
}

/**
 * Сгенерированный отчёт
 */
export interface AnalyticsReport {
  generatedAt: number;
  config: ExportConfig;
  data: {
    production?: Partial<Record<ResourceType, ProductionHistory>>;
    bottlenecks?: Bottleneck[];
    losses?: ResourceLoss[];
    buildingROIs?: BuildingROI[];
    financials?: {
      totalEarned: string;
      totalSpent: string;
      netProfit: string;
      history: DataPoint[];
    };
    efficiency?: number;
  };
}

// ==========================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ ТИПОВ
// ==========================================

/**
 * Получить цвет для уровня серьёзности
 */
export function getSeverityColor(severity: BottleneckSeverity): string {
  switch (severity) {
    case 'low': return '#22c55e';      // green-500
    case 'medium': return '#eab308';   // yellow-500
    case 'high': return '#f97316';     // orange-500
    case 'critical': return '#ef4444'; // red-500
  }
}

/**
 * Получить цвет для уровня прибыльности
 */
export function getProfitabilityColor(level: ProfitabilityLevel): string {
  switch (level) {
    case 'excellent': return '#22c55e';  // green-500
    case 'good': return '#84cc16';       // lime-500
    case 'average': return '#eab308';    // yellow-500
    case 'poor': return '#f97316';       // orange-500
    case 'negative': return '#ef4444';   // red-500
  }
}

/**
 * Получить иконку для уровня серьёзности
 */
export function getSeverityIcon(severity: BottleneckSeverity): string {
  switch (severity) {
    case 'low': return '⚡';
    case 'medium': return '⚠️';
    case 'high': return '🔥';
    case 'critical': return '💀';
  }
}

/**
 * Форматировать время в читаемый вид
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}с`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}м ${Math.floor(seconds % 60)}с`;
  if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}ч ${mins}м`;
  }
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  return `${days}д ${hours}ч`;
}

/**
 * Получить метку для временного диапазона
 */
export function getTimeRangeLabel(range: TimeRange): string {
  switch (range) {
    case '1h': return '1 час';
    case '6h': return '6 часов';
    case '12h': return '12 часов';
    case '24h': return '24 часа';
    case '7d': return '7 дней';
    case '30d': return '30 дней';
  }
}

/**
 * Дефолтное состояние аналитики
 */
export function getDefaultAnalyticsState(): AnalyticsState {
  return {
    productionHistory: {},
    bottlenecks: [],
    losses: [],
    buildingROIs: [],
    totalCreditsEarned: '0',
    totalCreditsSpent: '0',
    profitLossHistory: [],
    efficiencyScore: 100,
    efficiencyBreakdown: {
      production: 100,
      energy: 100,
      storage: 100,
      bottlenecks: 100,
    },
    lastUpdated: Date.now(),
    lastCollected: 0,
    chartSettings: {
      type: 'area',
      timeRange: '24h',
      showGrid: true,
      showLegend: true,
      animated: true,
    },
    selectedResources: [],
    showOnlyProblems: false,
  };
}
