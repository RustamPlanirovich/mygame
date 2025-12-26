import type { GameState } from '../core/gameTypes';
import { REPEATABLE_RESEARCHES } from '../core/constants/repeatableResearch';

/**
 * Бонусы от повторяемых исследований
 */
export interface RepeatableBonuses {
  productionMultiplier: number;       // Matter Compression
  researchSpeedMultiplier: number;    // Neural Networks
  energyEfficiency: number;           // Energy Optimization
  qpGainMultiplier: number;          // Quantum Computing
  automationSpeed: number;            // Automation Efficiency
  exoticResourcesMultiplier: number; // Dark Matter Manipulation
}

/**
 * Расчет стоимости следующего уровня повторяемого исследования
 */
export function calculateRepeatableCost(
  baseCost: Record<string, number>,
  currentLevel: number
): Record<string, number> {
  const scaling = 1.5;
  const result: Record<string, number> = {};
  
  for (const [resourceId, baseAmount] of Object.entries(baseCost)) {
    result[resourceId] = Math.floor(baseAmount * Math.pow(scaling, currentLevel));
  }
  
  return result;
}

/**
 * Расчет эффекта от уровня повторяемого исследования
 */
export function calculateRepeatableEffect(
  valuePerLevel: number,
  currentLevel: number
): number {
  return 1 + (valuePerLevel * currentLevel);
}

/**
 * Максимальный уровень повторяемого исследования за одно прохождение (Ascension)
 */
export function getMaxLevelPerAscension(ascensionCount: number): number {
  return 100 + (ascensionCount * 25);
}

/**
 * Получить все бонусы от текущих повторяемых исследований
 */
export function getTotalRepeatableBonuses(
  repeatableResearch: Record<string, number>
): RepeatableBonuses {
  const bonuses: RepeatableBonuses = {
    productionMultiplier: 1.0,
    researchSpeedMultiplier: 1.0,
    energyEfficiency: 1.0,
    qpGainMultiplier: 1.0,
    automationSpeed: 1.0,
    exoticResourcesMultiplier: 1.0,
  };
  
  // Matter Compression: +1% к производству базовых ресурсов за уровень
  const matterLevel = repeatableResearch['matter_compression'] || 0;
  bonuses.productionMultiplier += matterLevel * 0.01;
  
  // Neural Networks: +2% к скорости исследований за уровень
  const neuralLevel = repeatableResearch['neural_networks'] || 0;
  bonuses.researchSpeedMultiplier += neuralLevel * 0.02;
  
  // Energy Optimization: +1% снижение потребления за уровень
  const energyLevel = repeatableResearch['energy_optimization'] || 0;
  bonuses.energyEfficiency = Math.max(0.01, 1 - (energyLevel * 0.01));
  
  // Quantum Computing: +3% к QP за уровень
  const quantumLevel = repeatableResearch['quantum_computing'] || 0;
  bonuses.qpGainMultiplier += quantumLevel * 0.03;
  
  // Automation Efficiency: +2% к скорости автопокупок за уровень
  const automationLevel = repeatableResearch['automation_efficiency'] || 0;
  bonuses.automationSpeed += automationLevel * 0.02;
  
  // Dark Matter Manipulation: +1.5% к производству экзотики за уровень
  const darkMatterLevel = repeatableResearch['dark_matter_manipulation'] || 0;
  bonuses.exoticResourcesMultiplier += darkMatterLevel * 0.015;
  
  return bonuses;
}

/**
 * Проверка является ли ресурс базовым
 */
export function isBasicResource(resourceId: string): boolean {
  return ['iron', 'copper', 'silicon', 'titanium', 'crystal'].includes(resourceId);
}

/**
 * Проверка является ли ресурс экзотическим
 */
export function isExoticResource(resourceId: string): boolean {
  return ['darkMatter', 'antimatter', 'exotic_matter', 'strange_quarks'].includes(resourceId);
}

/**
 * Проверка может ли игрок позволить себе следующий уровень
 */
export function checkCanAffordRepeatable(
  state: GameState,
  researchId: string,
  currentLevel: number
): boolean {
  const researches = Object.values(REPEATABLE_RESEARCHES);
  const research = researches.find(r => r.id === researchId);
  if (!research) return false;
  
  const cost = calculateRepeatableCost(research.baseCost, currentLevel);
  
  for (const [resourceId, amount] of Object.entries(cost)) {
    const resource = state.resources[resourceId as keyof typeof state.resources];
    if (!resource || resource.amount.lt(amount)) {
      return false;
    }
  }
  
  return true;
}

/**
 * Форматирование значения эффекта
 */
export function formatEffectValue(value: number, type: 'percentage' | 'multiplier'): string {
  if (type === 'percentage') {
    const percent = (value - 1) * 100;
    return `+${percent.toFixed(1)}%`;
  }
  
  if (type === 'multiplier') {
    return `×${value.toFixed(2)}`;
  }
  
  return value.toString();
}

/**
 * Статистика повторяемого исследования
 */
export interface RepeatableResearchStats {
  totalLevels: number;
  highestLevel: number;
  totalSpent: Record<string, number>;
}

/**
 * История прохождения с повторяемыми исследованиями
 */
export interface RepeatableResearchRunHistory {
  ascensionNumber: number;
  timestamp: number;
  researches: Record<string, number>;
  totalLevels: number;
  stats: Record<string, RepeatableResearchStats>;
}
