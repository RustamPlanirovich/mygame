/**
 * ROI Calculator
 * 
 * Калькулятор окупаемости зданий
 */

import Decimal from 'break_eternity.js';
import type { 
  ResourceType, 
  Building,
  ResourceState
} from '../core/gameTypes';
import type {
  BuildingROI,
  ProfitabilityLevel,
  ROI_THRESHOLDS,
} from '../core/gameTypes.analytics';
import { D, formatNumber, formatRate } from '../core/math/format';
import { formatDuration } from '../core/gameTypes.analytics';

// ============================================================================
// Типы для расчётов
// ============================================================================

/**
 * Рыночные цены ресурсов (приблизительные, для расчёта стоимости)
 */
const RESOURCE_BASE_PRICES: Partial<Record<ResourceType, number>> = {
  ore: 1,
  ice: 1,
  carbon: 2,
  steel: 5,
  natural_gas: 3,
  oil: 4,
  gasoline: 8,
  plastic: 10,
  glass: 8,
  chemicals: 12,
  sand: 1,
  uranium: 50,
  chrome: 20,
  titanium: 30,
  copper: 8,
  semiconductors: 25,
  dynamite: 15,
  fiber: 5,
  integrated_circuit: 100,
  battery: 80,
  engine: 150,
  display: 120,
  computer: 500,
  liquid_fuel: 20,
  chrome_alloy: 60,
  titanium_alloy: 100,
  enriched_uranium: 200,
  weapon: 80,
  artillery: 300,
  radar: 250,
  nuclear_bomb: 5000,
  jet_engine: 400,
  satellite: 1000,
  rocket: 2000,
  spaceship: 10000,
  console: 600,
  space_station: 50000,
  robot: 300,
  dark_matter: 10000,
  energy: 0.1,
};

/**
 * Получает цену ресурса
 */
export function getResourcePrice(resource: ResourceType): number {
  return RESOURCE_BASE_PRICES[resource] || 1;
}

// ============================================================================
// Расчёт ROI
// ============================================================================

/**
 * Рассчитывает ROI для одного здания
 */
export function calculateBuildingROI(
  building: Building,
  resources: Record<ResourceType, ResourceState>,
  energyPrice: number = 0.1
): BuildingROI {
  // Стоимость постройки
  const totalCost = calculateBuildingCost(building);
  
  // Операционные расходы (энергия + upkeep)
  const operatingCost = calculateOperatingCost(building, energyPrice);
  
  // Доход от производства
  const revenue = calculateRevenue(building);
  
  // Чистая прибыль
  const netProfit = revenue.sub(operatingCost);
  
  // Время окупаемости
  let paybackTimeSeconds = Infinity;
  if (netProfit.gt(0)) {
    paybackTimeSeconds = totalCost.div(netProfit).toNumber();
  } else if (netProfit.lt(0)) {
    paybackTimeSeconds = -1; // Убыточное здание
  }
  
  // ROI в % (часовой)
  let currentROI = 0;
  if (totalCost.gt(0)) {
    currentROI = netProfit.mul(3600).div(totalCost).mul(100).toNumber();
  }
  
  // Уровень прибыльности
  const profitability = getProfitabilityLevel(currentROI);
  
  // Потребление энергии
  const energyConsumption = building.upkeep?.energy || building.inputs?.energy || D(0);
  
  return {
    buildingId: building.id,
    buildingName: building.name,
    buildingType: building.type,
    totalCost: totalCost.toString(),
    operatingCostPerSec: operatingCost.toString(),
    revenuePerSec: revenue.toString(),
    netProfitPerSec: netProfit.toString(),
    paybackTimeSeconds,
    paybackTimeFormatted: paybackTimeSeconds > 0 && paybackTimeSeconds < Infinity
      ? formatDuration(paybackTimeSeconds)
      : paybackTimeSeconds < 0 ? 'Убыточно' : 'N/A',
    currentROI,
    profitability,
    energyConsumption: energyConsumption.mul(building.count || 1).toString(),
    isOperating: !building.disabled && building.count > 0,
  };
}

/**
 * Рассчитывает ROI для всех зданий
 */
export function calculateAllBuildingsROI(
  buildings: Building[],
  resources: Record<ResourceType, ResourceState>
): BuildingROI[] {
  return buildings
    .filter(b => b.count > 0)
    .map(b => calculateBuildingROI(b, resources))
    .sort((a, b) => b.currentROI - a.currentROI);
}

// ============================================================================
// Вспомогательные расчёты
// ============================================================================

/**
 * Рассчитывает стоимость постройки здания
 */
export function calculateBuildingCost(building: Building): Decimal {
  let total = D(0);
  
  if (building.baseCost) {
    for (const [resource, amount] of Object.entries(building.baseCost)) {
      const price = getResourcePrice(resource as ResourceType);
      total = total.add(amount.mul(price));
    }
  }
  
  return total;
}

/**
 * Рассчитывает операционные расходы здания в секунду
 */
export function calculateOperatingCost(
  building: Building, 
  energyPrice: number = 0.1
): Decimal {
  let total = D(0);
  const count = building.count || 1;
  
  // Энергия
  const energy = building.upkeep?.energy || building.inputs?.energy;
  if (energy) {
    total = total.add(energy.mul(count).mul(energyPrice));
  }
  
  // Другие upkeep ресурсы
  if (building.upkeep) {
    for (const [resource, amount] of Object.entries(building.upkeep)) {
      if (resource !== 'energy') {
        const price = getResourcePrice(resource as ResourceType);
        total = total.add(amount.mul(count).mul(price));
      }
    }
  }
  
  // Inputs (потребление для производства)
  if (building.inputs) {
    for (const [resource, amount] of Object.entries(building.inputs)) {
      if (resource !== 'energy') {
        const price = getResourcePrice(resource as ResourceType);
        total = total.add(amount.mul(count).mul(price));
      }
    }
  }
  
  return total;
}

/**
 * Рассчитывает доход от производства здания в секунду
 */
export function calculateRevenue(building: Building): Decimal {
  let total = D(0);
  const count = building.count || 1;
  
  if (building.production) {
    for (const [resource, amount] of Object.entries(building.production)) {
      // Не считаем энергию как доход (она используется внутри)
      if (resource !== 'energy') {
        const price = getResourcePrice(resource as ResourceType);
        total = total.add(amount.mul(count).mul(price));
      }
    }
  }
  
  return total;
}

/**
 * Определяет уровень прибыльности по ROI
 */
export function getProfitabilityLevel(roiPercent: number): ProfitabilityLevel {
  if (roiPercent >= 50) return 'excellent';
  if (roiPercent >= 20) return 'good';
  if (roiPercent >= 5) return 'average';
  if (roiPercent > 0) return 'poor';
  return 'negative';
}

// ============================================================================
// Анализ прибыльности
// ============================================================================

/**
 * Находит самые прибыльные здания
 */
export function getMostProfitableBuildings(
  buildings: Building[],
  resources: Record<ResourceType, ResourceState>,
  limit: number = 10
): BuildingROI[] {
  return calculateAllBuildingsROI(buildings, resources)
    .filter(roi => roi.currentROI > 0)
    .slice(0, limit);
}

/**
 * Находит убыточные здания
 */
export function getUnprofitableBuildings(
  buildings: Building[],
  resources: Record<ResourceType, ResourceState>
): BuildingROI[] {
  return calculateAllBuildingsROI(buildings, resources)
    .filter(roi => roi.currentROI < 0);
}

/**
 * Рассчитывает общий ROI всех зданий
 */
export function calculateTotalROI(
  buildings: Building[],
  resources: Record<ResourceType, ResourceState>
): {
  totalCost: Decimal;
  totalRevenue: Decimal;
  totalOperatingCost: Decimal;
  netProfit: Decimal;
  overallROI: number;
} {
  let totalCost = D(0);
  let totalRevenue = D(0);
  let totalOperatingCost = D(0);
  
  for (const building of buildings) {
    if (building.count === 0 || building.disabled) continue;
    
    const cost = calculateBuildingCost(building);
    const revenue = calculateRevenue(building);
    const opCost = calculateOperatingCost(building);
    
    totalCost = totalCost.add(cost.mul(building.count));
    totalRevenue = totalRevenue.add(revenue);
    totalOperatingCost = totalOperatingCost.add(opCost);
  }
  
  const netProfit = totalRevenue.sub(totalOperatingCost);
  const overallROI = totalCost.gt(0) 
    ? netProfit.mul(3600).div(totalCost).mul(100).toNumber()
    : 0;
  
  return {
    totalCost,
    totalRevenue,
    totalOperatingCost,
    netProfit,
    overallROI,
  };
}

// ============================================================================
// Рекомендации
// ============================================================================

/**
 * Генерирует рекомендации по оптимизации
 */
export function generateROIRecommendations(
  buildings: Building[],
  resources: Record<ResourceType, ResourceState>
): string[] {
  const recommendations: string[] = [];
  const allROIs = calculateAllBuildingsROI(buildings, resources);
  
  // Убыточные здания
  const unprofitable = allROIs.filter(r => r.currentROI < 0);
  if (unprofitable.length > 0) {
    recommendations.push(
      `⚠️ ${unprofitable.length} здание(й) работают в убыток. ` +
      `Рассмотрите их отключение или модернизацию.`
    );
  }
  
  // Здания с отличным ROI
  const excellent = allROIs.filter(r => r.profitability === 'excellent');
  if (excellent.length > 0) {
    recommendations.push(
      `✅ ${excellent.length} здание(й) имеют отличную рентабельность. ` +
      `Рассмотрите их расширение.`
    );
  }
  
  // Долгая окупаемость
  const slowPayback = allROIs.filter(r => 
    r.paybackTimeSeconds > 3600 * 24 && r.paybackTimeSeconds < Infinity
  );
  if (slowPayback.length > 0) {
    recommendations.push(
      `⏰ ${slowPayback.length} здание(й) окупаются дольше 24 часов. ` +
      `Это нормально для дорогих построек.`
    );
  }
  
  // Здания с высоким потреблением энергии
  const highEnergy = allROIs.filter(r => D(r.energyConsumption).gt(100));
  if (highEnergy.length > 0) {
    recommendations.push(
      `⚡ ${highEnergy.length} здание(й) потребляют много энергии. ` +
      `Убедитесь в достаточности энергоснабжения.`
    );
  }
  
  return recommendations;
}

// ============================================================================
// Сравнение зданий
// ============================================================================

/**
 * Сравнивает два здания по ROI
 */
export function compareBuildingsROI(
  building1: Building,
  building2: Building,
  resources: Record<ResourceType, ResourceState>
): {
  winner: Building;
  roiDiff: number;
  paybackDiff: number;
  recommendation: string;
} {
  const roi1 = calculateBuildingROI(building1, resources);
  const roi2 = calculateBuildingROI(building2, resources);
  
  const roiDiff = roi1.currentROI - roi2.currentROI;
  const paybackDiff = roi2.paybackTimeSeconds - roi1.paybackTimeSeconds;
  
  const winner = roi1.currentROI >= roi2.currentROI ? building1 : building2;
  
  let recommendation = '';
  if (Math.abs(roiDiff) < 5) {
    recommendation = 'Оба здания имеют схожую рентабельность.';
  } else {
    recommendation = `${winner.name} выгоднее на ${Math.abs(roiDiff).toFixed(1)}% ROI.`;
  }
  
  return { winner, roiDiff, paybackDiff, recommendation };
}

// ============================================================================
// Форматирование
// ============================================================================

/**
 * Форматирует ROI для отображения
 */
export function formatROI(roi: number): string {
  if (roi >= 1000) return `+${(roi / 1000).toFixed(1)}K%`;
  if (roi >= 100) return `+${roi.toFixed(0)}%`;
  if (roi > 0) return `+${roi.toFixed(1)}%`;
  if (roi === 0) return '0%';
  return `${roi.toFixed(1)}%`;
}

/**
 * Получает цвет для ROI
 */
export function getROIColor(roi: number): string {
  if (roi >= 50) return '#22c55e';  // green
  if (roi >= 20) return '#84cc16';  // lime
  if (roi >= 5) return '#eab308';   // yellow
  if (roi > 0) return '#f97316';    // orange
  return '#ef4444';                  // red
}

/**
 * Получает иконку для уровня прибыльности
 */
export function getProfitabilityIcon(level: ProfitabilityLevel): string {
  switch (level) {
    case 'excellent': return '🚀';
    case 'good': return '✅';
    case 'average': return '📊';
    case 'poor': return '⚠️';
    case 'negative': return '❌';
  }
}
