/**
 * Analytics Helpers
 * 
 * Вспомогательные функции для сбора и обработки аналитических данных
 */

import Decimal from 'break_eternity.js';
import type { 
  ResourceType, 
  Building,
  ResourceState
} from '../core/gameTypes';
import type {
  DataPoint,
  ProductionHistory,
  LabeledDataPoint,
  AggregatedDataPoint,
  TimeRange,
} from '../core/gameTypes.analytics';
// ANALYTICS_CONFIG — это const, а не тип: он лежал в `import type`, поэтому не
// компилировался в реальный импорт и лимиты дублировались числом 288 по месту.
import { ANALYTICS_CONFIG } from '../core/gameTypes.analytics';
import { D, formatRate } from '../core/math/format';

// ============================================================================
// Сбор данных
// ============================================================================

/**
 * Создаёт точку данных для текущего момента
 */
export function createDataPoint(value: Decimal): DataPoint {
  return {
    timestamp: Date.now(),
    value: value.toString(),
  };
}

/**
 * Добавляет точку данных в историю с лимитом
 */
export function addDataPoint(
  history: DataPoint[],
  point: DataPoint,
  maxPoints: number = ANALYTICS_CONFIG.MAX_DATA_POINTS
): DataPoint[] {
  const newHistory = [...history, point];
  if (newHistory.length > maxPoints) {
    return newHistory.slice(-maxPoints);
  }
  return newHistory;
}

/**
 * Рассчитывает производство ресурса за секунду от всех зданий
 */
export function calculateResourceProduction(
  buildings: Building[],
  resource: ResourceType
): Decimal {
  let total = D(0);
  
  for (const building of buildings) {
    if (!building || building.count === 0) continue;
    
    const prod = building.production?.[resource];
    if (prod) {
      total = total.add(D(prod).mul(building.count));
    }
  }
  
  return total;
}

/**
 * Рассчитывает потребление ресурса за секунду всеми зданиями
 */
export function calculateResourceConsumption(
  buildings: Building[],
  resource: ResourceType
): Decimal {
  let total = D(0);
  
  for (const building of buildings) {
    if (!building || building.count === 0) continue;
    
    // Расход берётся из consumption: полей `upkeep`/`inputs` нет ни в типе Building,
    // ни в определениях зданий, поэтому старое чтение всегда давало 0.
    const upkeep = building.consumption?.[resource];
    if (upkeep) {
      total = total.add(D(upkeep).mul(building.count));
    }
  }
  
  return total;
}

/**
 * Создаёт или обновляет историю производства ресурса
 */
export function updateProductionHistory(
  existingHistory: ProductionHistory | undefined,
  resource: ResourceType,
  currentProduction: Decimal,
  maxPoints: number = ANALYTICS_CONFIG.MAX_DATA_POINTS
): ProductionHistory {
  const now = Date.now();
  const newPoint = createDataPoint(currentProduction);
  
  if (!existingHistory) {
    return {
      resource,
      data: [newPoint],
      avgProduction: currentProduction.toString(),
      peakProduction: currentProduction.toString(),
      minProduction: currentProduction.toString(),
      totalProduced: '0',
      trend: 'stable',
      trendPercent: 0,
    };
  }
  
  const newData = addDataPoint(existingHistory.data, newPoint, maxPoints);
  
  // Рассчитываем статистику
  const values = newData.map(p => D(p.value));
  const sum = values.reduce((a, b) => a.add(b), D(0));
  const avg = values.length > 0 ? sum.div(values.length) : D(0);
  const peak = values.reduce((a, b) => Decimal.max(a, b), D(0));
  const min = values.reduce((a, b) => Decimal.min(a, b), values[0] || D(0));
  
  // Рассчитываем тренд (сравниваем последний час с предыдущим)
  const hourAgo = now - 60 * 60 * 1000;
  const twoHoursAgo = now - 2 * 60 * 60 * 1000;
  
  const lastHour = newData.filter(p => p.timestamp >= hourAgo);
  const prevHour = newData.filter(p => p.timestamp >= twoHoursAgo && p.timestamp < hourAgo);
  
  let trend: 'up' | 'down' | 'stable' = 'stable';
  let trendPercent = 0;
  
  if (lastHour.length > 0 && prevHour.length > 0) {
    const lastHourAvg = lastHour.reduce((a, p) => a.add(D(p.value)), D(0)).div(lastHour.length);
    const prevHourAvg = prevHour.reduce((a, p) => a.add(D(p.value)), D(0)).div(prevHour.length);
    
    if (prevHourAvg.gt(0)) {
      trendPercent = lastHourAvg.sub(prevHourAvg).div(prevHourAvg).mul(100).toNumber();
      if (trendPercent > 5) trend = 'up';
      else if (trendPercent < -5) trend = 'down';
    }
  }
  
  // Рассчитываем общее произведённое количество (интегрирование)
  // Приближённо: сумма (значение * интервал между точками)
  let totalProduced = D(existingHistory.totalProduced || '0');
  if (newData.length >= 2) {
    const lastPoint = newData[newData.length - 1];
    const prevPoint = newData[newData.length - 2];
    const intervalSec = (lastPoint.timestamp - prevPoint.timestamp) / 1000;
    totalProduced = totalProduced.add(D(lastPoint.value).mul(intervalSec));
  }
  
  return {
    resource,
    data: newData,
    avgProduction: avg.toString(),
    peakProduction: peak.toString(),
    minProduction: min.toString(),
    totalProduced: totalProduced.toString(),
    trend,
    trendPercent,
  };
}

// ============================================================================
// Агрегация данных
// ============================================================================

/**
 * Агрегирует точки данных за период
 */
export function aggregateDataPoints(
  points: DataPoint[],
  intervalMs: number
): AggregatedDataPoint[] {
  if (points.length === 0) return [];
  
  const buckets = new Map<number, DataPoint[]>();
  
  // Группируем точки по интервалам
  for (const point of points) {
    const bucketStart = Math.floor(point.timestamp / intervalMs) * intervalMs;
    if (!buckets.has(bucketStart)) {
      buckets.set(bucketStart, []);
    }
    buckets.get(bucketStart)!.push(point);
  }
  
  // Создаём агрегированные точки
  const result: AggregatedDataPoint[] = [];
  
  for (const [timestamp, bucketPoints] of buckets) {
    const values = bucketPoints.map(p => D(p.value));
    const sum = values.reduce((a, b) => a.add(b), D(0));
    const min = values.reduce((a, b) => Decimal.min(a, b), values[0]);
    const max = values.reduce((a, b) => Decimal.max(a, b), values[0]);
    const avg = sum.div(values.length);
    
    result.push({
      timestamp,
      min: min.toString(),
      max: max.toString(),
      avg: avg.toString(),
      sum: sum.toString(),
      count: values.length,
    });
  }
  
  return result.sort((a, b) => a.timestamp - b.timestamp);
}

// ============================================================================
// Фильтрация по временному диапазону
// ============================================================================

/**
 * Возвращает timestamp начала периода для диапазона
 */
export function getTimeRangeStart(range: TimeRange): number {
  const now = Date.now();
  switch (range) {
    case '1h': return now - 60 * 60 * 1000;
    case '6h': return now - 6 * 60 * 60 * 1000;
    case '12h': return now - 12 * 60 * 60 * 1000;
    case '24h': return now - 24 * 60 * 60 * 1000;
    case '7d': return now - 7 * 24 * 60 * 60 * 1000;
    case '30d': return now - 30 * 24 * 60 * 60 * 1000;
  }
}

/**
 * Фильтрует точки данных по временному диапазону
 */
export function filterByTimeRange(
  points: DataPoint[],
  range: TimeRange
): DataPoint[] {
  const start = getTimeRangeStart(range);
  return points.filter(p => p.timestamp >= start);
}

// ============================================================================
// Форматирование для графиков
// ============================================================================

/**
 * Преобразует DataPoint[] в формат для recharts
 */
export function toRechartsData(
  points: DataPoint[],
  valueFormatter?: (value: Decimal) => string
): Array<{ time: number; timeLabel: string; value: number; displayValue: string }> {
  return points.map(point => {
    const value = D(point.value);
    return {
      time: point.timestamp,
      timeLabel: formatTimeLabel(point.timestamp),
      value: value.toNumber(),
      displayValue: valueFormatter 
        ? valueFormatter(value) 
        : formatRate(value) + '/с',
    };
  });
}

/**
 * Преобразует несколько историй для мультилинейного графика
 */
export function toMultiLineRechartsData(
  histories: Array<{ key: string; data: DataPoint[] }>
): Array<Record<string, number | string>> {
  // Собираем все уникальные timestamps
  const allTimestamps = new Set<number>();
  for (const history of histories) {
    for (const point of history.data) {
      allTimestamps.add(point.timestamp);
    }
  }
  
  // Создаём записи для каждого timestamp
  const result: Array<Record<string, number | string>> = [];
  const sortedTimestamps = Array.from(allTimestamps).sort((a, b) => a - b);
  
  for (const timestamp of sortedTimestamps) {
    const record: Record<string, number | string> = {
      time: timestamp,
      timeLabel: formatTimeLabel(timestamp),
    };
    
    for (const history of histories) {
      const point = history.data.find(p => p.timestamp === timestamp);
      record[history.key] = point ? D(point.value).toNumber() : 0;
    }
    
    result.push(record);
  }
  
  return result;
}

/**
 * Форматирует timestamp для отображения на графике
 */
export function formatTimeLabel(timestamp: number): string {
  const date = new Date(timestamp);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Форматирует timestamp с датой
 */
export function formatDateTimeLabel(timestamp: number): string {
  const date = new Date(timestamp);
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${day}.${month} ${hours}:${minutes}`;
}

// ============================================================================
// Расчёт эффективности
// ============================================================================

/**
 * Рассчитывает общую эффективность производства
 */
export function calculateEfficiencyScore(
  productionEfficiency: number,
  energyEfficiency: number,
  storageEfficiency: number,
  bottleneckPenalty: number
): number {
  // Взвешенная оценка
  const weights = {
    production: 0.35,
    energy: 0.25,
    storage: 0.20,
    bottlenecks: 0.20,
  };
  
  const score = 
    productionEfficiency * weights.production +
    energyEfficiency * weights.energy +
    storageEfficiency * weights.storage +
    (100 - bottleneckPenalty) * weights.bottlenecks;
  
  return Math.max(0, Math.min(100, score));
}

/**
 * Рассчитывает эффективность использования хранилища
 */
export function calculateStorageEfficiency(
  resources: Record<ResourceType, ResourceState>
): number {
  let totalUsed = D(0);
  let totalCap = D(0);
  
  for (const res of Object.values(resources)) {
    if (!res) continue;
    const cap = res.max ? D(res.max) : D(0);
    const current = res.amount ? D(res.amount) : D(0);
    if (cap.gt(0)) {
      totalUsed = totalUsed.add(current);
      totalCap = totalCap.add(cap);
    }
  }
  
  if (totalCap.eq(0)) return 100;
  
  // Оптимальная заполненность - 50-80%
  const usage = totalUsed.div(totalCap).toNumber();
  if (usage >= 0.5 && usage <= 0.8) return 100;
  if (usage < 0.5) return 50 + usage * 100; // 50-100 при 0-50%
  return 100 - (usage - 0.8) * 250; // 100-50 при 80-100%
}

/**
 * Рассчитывает эффективность энергии
 */
export function calculateEnergyEfficiency(
  energyProduction: Decimal,
  energyConsumption: Decimal
): number {
  if (energyConsumption.eq(0)) return 100;
  
  const ratio = energyProduction.div(energyConsumption).toNumber();
  
  if (ratio >= 1.2) return 100;  // 20%+ запас - отлично
  if (ratio >= 1.0) return 80 + (ratio - 1.0) * 100;  // 80-100
  return ratio * 80;  // 0-80 при дефиците
}

// ============================================================================
// Создание данных для pie charts
// ============================================================================

/**
 * Создаёт данные о распределении ресурсов для pie chart
 */
export function createResourceDistributionData(
  resources: Record<ResourceType, ResourceState>,
  topN: number = 10
): LabeledDataPoint[] {
  const entries = Object.entries(resources)
    .map(([key, state]) => ({
      label: key,
      value: state?.amount ? D(state.amount) : D(0),
    }))
    .filter(e => e.value && e.value.gt(0))
    .sort((a, b) => b.value.cmp(a.value))
    .slice(0, topN);
  
  // Генерируем цвета
  const colors = [
    '#3ee07f', '#8be9fd', '#ffb86c', '#ff5555', '#bd93f9',
    '#3dc5de', '#ff79c6', '#a1e245', '#f39c12', '#a370ef',
  ];
  
  return entries.map((e, i) => ({
    label: e.label,
    value: e.value.toString(),
    color: colors[i % colors.length],
  }));
}

/**
 * Создаёт данные о потреблении энергии для pie chart
 */
export function createEnergyConsumptionData(
  buildings: Building[]
): LabeledDataPoint[] {
  const consumption = new Map<string, Decimal>();
  
  for (const building of buildings) {
    if (building.count === 0) continue;
    
    const energyUse = building.consumption?.energy ?? building.energyConsumption;
    if (energyUse) {
      const total = energyUse.mul(building.count);
      consumption.set(
        building.name,
        (consumption.get(building.name) || D(0)).add(total)
      );
    }
  }
  
  const entries = Array.from(consumption.entries())
    .sort((a, b) => b[1].cmp(a[1]))
    .slice(0, 10);
  
  const colors = [
    '#ff5555', '#f39c12', '#ffb86c', '#f1fa8c', '#a1e245',
    '#3ee07f', '#3dc5de', '#8be9fd', '#bd93f9', '#ff79c6',
  ];
  
  return entries.map(([name, value], i) => ({
    label: name,
    value: value.toString(),
    color: colors[i % colors.length],
  }));
}

// ============================================================================
// Утилиты
// ============================================================================

/**
 * Интерполирует данные для сглаживания
 */
export function interpolateData(
  points: DataPoint[],
  targetCount: number
): DataPoint[] {
  if (points.length <= 1 || points.length >= targetCount) return points;
  
  const result: DataPoint[] = [];
  const step = (points.length - 1) / (targetCount - 1);
  
  for (let i = 0; i < targetCount; i++) {
    const exactIndex = i * step;
    const lowerIndex = Math.floor(exactIndex);
    const upperIndex = Math.min(lowerIndex + 1, points.length - 1);
    const fraction = exactIndex - lowerIndex;
    
    const lower = points[lowerIndex];
    const upper = points[upperIndex];
    
    const interpolatedValue = D(lower.value)
      .add(D(upper.value).sub(D(lower.value)).mul(fraction));
    const interpolatedTime = lower.timestamp + 
      (upper.timestamp - lower.timestamp) * fraction;
    
    result.push({
      timestamp: Math.round(interpolatedTime),
      value: interpolatedValue.toString(),
    });
  }
  
  return result;
}

/**
 * Вычисляет скользящее среднее
 */
export function movingAverage(
  points: DataPoint[],
  windowSize: number = 5
): DataPoint[] {
  if (points.length < windowSize) return points;
  
  const result: DataPoint[] = [];
  
  for (let i = windowSize - 1; i < points.length; i++) {
    const window = points.slice(i - windowSize + 1, i + 1);
    const sum = window.reduce((acc, p) => acc.add(D(p.value)), D(0));
    const avg = sum.div(windowSize);
    
    result.push({
      timestamp: points[i].timestamp,
      value: avg.toString(),
    });
  }
  
  return result;
}
