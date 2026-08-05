/**
 * Bottleneck Detector
 * 
 * Детектор узких мест в производстве
 */

import Decimal from 'break_eternity.js';
import type { 
  ResourceType, 
  Building,
  ResourceState
} from '../core/gameTypes';
import type {
  Bottleneck,
  BottleneckSeverity,
} from '../core/gameTypes.analytics';
// BOTTLENECK_THRESHOLDS — const, а не тип: он лежал в `import type`, поэтому пороги
// ниже стояли числами по месту и разъезжались бы с конфигом.
import { formatDuration, BOTTLENECK_THRESHOLDS } from '../core/gameTypes.analytics';
import { 
  calculateResourceProduction, 
  calculateResourceConsumption 
} from './analyticsHelpers';

// ============================================================================
// Основной детектор
// ============================================================================

/**
 * Анализирует все ресурсы и находит узкие места
 */
export function detectBottlenecks(
  buildings: Building[],
  resources: Record<ResourceType, ResourceState>
): Bottleneck[] {
  const bottlenecks: Bottleneck[] = [];
  const now = Date.now();
  
  for (const [resourceKey, state] of Object.entries(resources)) {
    const resource = resourceKey as ResourceType;
    
    // Пропускаем энергию и кредиты - они обрабатываются отдельно
    if (resource === 'energy') continue;
    
    const production = calculateResourceProduction(buildings, resource);
    const consumption = calculateResourceConsumption(buildings, resource);
    
    // Если нет потребления - нет проблемы
    if (consumption.eq(0)) continue;
    
    const deficit = consumption.sub(production);
    
    // Проверяем есть ли узкое место
    const severity = calculateSeverity(
      production, 
      consumption, 
      state.amount
    );
    
    if (severity === null) continue;
    
    // Находим здания-производители и потребители
    const producers = findProducers(buildings, resource);
    const consumers = findConsumers(buildings, resource);
    
    // Рассчитываем время до истощения
    const timeToDepletion = deficit.gt(0) && state.amount.gt(0)
      ? state.amount.div(deficit).toNumber()
      : null;
    
    // Генерируем рекомендацию
    const recommendation = generateRecommendation(
      resource,
      severity,
      production,
      consumption,
      producers
    );
    
    bottlenecks.push({
      id: `bottleneck_${resource}_${now}`,
      resource,
      severity,
      consumingBuildings: consumers,
      producingBuildings: producers,
      consumption: consumption.toString(),
      production: production.toString(),
      deficit: deficit.toString(),
      currentStock: state.amount.toString(),
      timeToDepletion,
      recommendation,
      detectedAt: now,
    });
  }
  
  // Сортируем по серьёзности
  return sortBottlenecksBySeverity(bottlenecks);
}

// ============================================================================
// Расчёт серьёзности
// ============================================================================

/**
 * Определяет уровень серьёзности узкого места
 */
export function calculateSeverity(
  production: Decimal,
  consumption: Decimal,
  currentStock: Decimal
): BottleneckSeverity | null {
  // Критический: ресурс на нуле и есть потребление
  if (currentStock.eq(0) && consumption.gt(0)) {
    return 'critical';
  }
  
  // Нет производства, но есть потребление
  if (production.eq(0) && consumption.gt(0)) {
    return 'high';
  }
  
  const ratio = consumption.div(production);
  
  if (ratio.gte(BOTTLENECK_THRESHOLDS.HIGH)) {
    return 'high';
  }

  if (ratio.gte(BOTTLENECK_THRESHOLDS.MEDIUM)) {
    return 'medium';
  }

  if (ratio.gte(BOTTLENECK_THRESHOLDS.LOW)) {
    return 'low';
  }
  
  return null; // Нет узкого места
}

/**
 * Сортирует узкие места по серьёзности
 */
function sortBottlenecksBySeverity(bottlenecks: Bottleneck[]): Bottleneck[] {
  const severityOrder: Record<BottleneckSeverity, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  
  return bottlenecks.sort((a, b) => 
    severityOrder[a.severity] - severityOrder[b.severity]
  );
}

// ============================================================================
// Поиск зданий
// ============================================================================

/**
 * Находит все здания, производящие ресурс
 */
export function findProducers(
  buildings: Building[],
  resource: ResourceType
): string[] {
  return buildings
    .filter(b => b.count > 0 && b.production?.[resource]?.gt(0))
    .map(b => b.id);
}

/**
 * Находит все здания, потребляющие ресурс
 */
export function findConsumers(
  buildings: Building[],
  resource: ResourceType
): string[] {
      // Building has `consumption`, not `upkeep`/`inputs` — no building anywhere defines those
      // two, so this filter matched nothing and the detector reported zero consumers for
      // every resource. `disabled` is likewise not a Building field (per-tile disabling lives
      // in grid.tileDisabled), so the check was always a no-op and is dropped.
  return buildings
    .filter(b => b.count > 0 && b.consumption?.[resource]?.gt(0))
    .map(b => b.id);
}

// ============================================================================
// Рекомендации
// ============================================================================

/**
 * Генерирует рекомендацию для устранения узкого места
 */
export function generateRecommendation(
  resource: ResourceType,
  severity: BottleneckSeverity,
  production: Decimal,
  consumption: Decimal,
  producers: string[]
): string {
  const resourceName = getResourceDisplayName(resource);
  
  if (severity === 'critical') {
    if (producers.length === 0) {
      return `⚠️ Нет производства ${resourceName}! Постройте здания для добычи этого ресурса.`;
    }
    return `🔴 Критический дефицит ${resourceName}! Срочно увеличьте производство или уменьшите потребление.`;
  }
  
  if (severity === 'high') {
    const needed = consumption.div(production).ceil();
    return `🟠 Сильный дефицит ${resourceName}. Нужно увеличить производство в ${needed.toString()}x раз.`;
  }
  
  if (severity === 'medium') {
    return `🟡 Умеренный дефицит ${resourceName}. Рекомендуется построить дополнительные производственные здания.`;
  }
  
  return `🔵 Небольшой дефицит ${resourceName}. Ситуация под контролем, но стоит следить.`;
}

/**
 * Возвращает локализованное имя ресурса
 */
function getResourceDisplayName(resource: ResourceType): string {
  const names: Partial<Record<ResourceType, string>> = {
    energy: 'Энергии',
    ore: 'Руды',
    ice: 'Льда',
    carbon: 'Углерода',
    steel: 'Стали',
    dark_matter: 'Тёмной материи',
    natural_gas: 'Природного газа',
    oil: 'Нефти',
    gasoline: 'Бензина',
    plastic: 'Пластика',
    glass: 'Стекла',
    chemicals: 'Химикатов',
    sand: 'Песка',
    uranium: 'Урана',
    chrome: 'Хрома',
    titanium: 'Титана',
    copper: 'Меди',
    semiconductors: 'Полупроводников',
    dynamite: 'Динамита',
    fiber: 'Волокна',
    integrated_circuit: 'Микросхем',
    battery: 'Батарей',
    engine: 'Двигателей',
    display: 'Дисплеев',
    computer: 'Компьютеров',
    liquid_fuel: 'Жидкого топлива',
    chrome_alloy: 'Хромового сплава',
    titanium_alloy: 'Титанового сплава',
    enriched_uranium: 'Обогащённого урана',
    weapon: 'Оружия',
    artillery: 'Артиллерии',
    radar: 'Радаров',
    nuclear_bomb: 'Ядерных бомб',
    jet_engine: 'Реактивных двигателей',
    satellite: 'Спутников',
    rocket: 'Ракет',
    spaceship: 'Космических кораблей',
    console: 'Консолей',
    space_station: 'Космических станций',
    robot: 'Роботов',
    waste: 'Отходов',
    radioactive_waste: 'Радиоактивных отходов',
  };
  
  return names[resource] || resource;
}

// ============================================================================
// Анализ тенденций
// ============================================================================

/**
 * Прогнозирует будущие узкие места
 */
export function predictBottlenecks(
  buildings: Building[],
  resources: Record<ResourceType, ResourceState>,
  hoursAhead: number = 1
): Bottleneck[] {
  const predictedBottlenecks: Bottleneck[] = [];
  const now = Date.now();
  const secondsAhead = hoursAhead * 3600;
  
  for (const [resourceKey, state] of Object.entries(resources)) {
    const resource = resourceKey as ResourceType;
    if (resource === 'energy') continue;
    
    const production = calculateResourceProduction(buildings, resource);
    const consumption = calculateResourceConsumption(buildings, resource);
    
    if (consumption.lte(production)) continue; // Нет дефицита
    
    const deficit = consumption.sub(production);
    
    // Рассчитываем время до истощения
    if (state.amount.gt(0)) {
      const timeToDepletion = state.amount.div(deficit).toNumber();
      
      // Если истощится в пределах прогноза
      if (timeToDepletion <= secondsAhead && timeToDepletion > 0) {
        const producers = findProducers(buildings, resource);
        const consumers = findConsumers(buildings, resource);
        
        predictedBottlenecks.push({
          id: `predicted_${resource}_${now}`,
          resource,
          severity: 'medium',
          consumingBuildings: consumers,
          producingBuildings: producers,
          consumption: consumption.toString(),
          production: production.toString(),
          deficit: deficit.toString(),
          currentStock: state.amount.toString(),
          timeToDepletion,
          recommendation: `⏰ ${getResourceDisplayName(resource)} закончится через ${formatDuration(timeToDepletion)}. Подготовьтесь заранее!`,
          detectedAt: now,
        });
      }
    }
  }
  
  return sortBottlenecksBySeverity(predictedBottlenecks);
}

// ============================================================================
// Группировка и приоритизация
// ============================================================================

/**
 * Группирует узкие места по категориям
 */
export function groupBottlenecksByCategory(
  bottlenecks: Bottleneck[]
): Record<string, Bottleneck[]> {
  const groups: Record<string, Bottleneck[]> = {
    critical: [],
    production: [],
    storage: [],
    chain: [],
  };
  
  for (const bottleneck of bottlenecks) {
    if (bottleneck.severity === 'critical') {
      groups.critical.push(bottleneck);
    } else if (bottleneck.producingBuildings.length === 0) {
      groups.production.push(bottleneck);
    } else {
      groups.chain.push(bottleneck);
    }
  }
  
  return groups;
}

/**
 * Возвращает топ N самых критичных узких мест
 */
export function getTopBottlenecks(
  bottlenecks: Bottleneck[],
  limit: number = 5
): Bottleneck[] {
  return sortBottlenecksBySeverity(bottlenecks).slice(0, limit);
}

/**
 * Подсчитывает штраф эффективности от узких мест
 */
export function calculateBottleneckPenalty(bottlenecks: Bottleneck[]): number {
  let penalty = 0;
  
  for (const bottleneck of bottlenecks) {
    switch (bottleneck.severity) {
      case 'critical':
        penalty += 15;
        break;
      case 'high':
        penalty += 10;
        break;
      case 'medium':
        penalty += 5;
        break;
      case 'low':
        penalty += 2;
        break;
    }
  }
  
  return Math.min(100, penalty);
}
