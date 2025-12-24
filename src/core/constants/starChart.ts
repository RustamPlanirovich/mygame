import type Decimal from 'break_eternity.js';
import type { ResourceType, StarChartUpgradeId } from '../gameTypes';
import { D } from '../math/format.ts';

export const STAR_CHART_UPGRADE_DEFS: Record<
  StarChartUpgradeId,
  {
    name: string;
    description: string;
    maxLevel: number;
    baseCost: Partial<Record<ResourceType, Decimal>>;
    costFactor: number;
  }
> = {
  subspace: {
    name: 'Навигация: Subspace',
    description: 'Сокращает время экспедиций.',
    maxLevel: 10,
    baseCost: { energy: D(500), steel: D(20) },
    costFactor: 1.6,
  },
  anomaly: {
    name: 'Сканеры: Anomaly',
    description: 'Повышает шанс найти аномалию с бонусной добычей.',
    maxLevel: 10,
    baseCost: { energy: D(520), steel: D(22) },
    costFactor: 1.6,
  },
};

export const starChartUpgradeCost = (id: StarChartUpgradeId, level: number) => {
  const def = STAR_CHART_UPGRADE_DEFS[id];
  const cost: Partial<Record<ResourceType, Decimal>> = {};
  for (const [res, base] of Object.entries(def.baseCost)) {
    cost[res as ResourceType] = D(base).mul(Math.pow(def.costFactor, level));
  }
  return cost;
};

export const computeStarChartDurationMultiplier = (subspaceLevel: number) => {
  // -4% per level, capped to 60% speedup.
  const l = Math.max(0, subspaceLevel);
  return Math.max(0.4, 1 - 0.04 * l);
};

export const computeStarChartAnomalyChance = (anomalyLevel: number) => {
  // +2.5% per level, capped.
  const l = Math.max(0, anomalyLevel);
  return Math.max(0, Math.min(0.35, 0.025 * l));
};

export const computeStarChartAnomalySteelBonus = (anomalyLevel: number) => {
  // Bonus steel when anomaly triggers.
  const l = Math.max(0, anomalyLevel);
  return D(1 + 0.35 * l);
};
