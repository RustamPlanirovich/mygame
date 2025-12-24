import type Decimal from 'break_eternity.js';
import type { AegisUpgradeId, ResourceType } from '../gameTypes';
import { D } from '../math/format.ts';

export const AEGIS_UPGRADE_DEFS: Record<
  AegisUpgradeId,
  {
    name: string;
    description: string;
    maxLevel: number;
    baseCost: Partial<Record<ResourceType, Decimal>>;
    costFactor: number;
  }
> = {
  smart_targeting: {
    name: 'Эгида: Smart Targeting',
    description: 'Турели и рой фокусируют цель с максимальным HP (меньше оверкилла).',
    maxLevel: 1,
    baseCost: { energy: D(420), steel: D(18) },
    costFactor: 1.0,
  },
  encryption: {
    name: 'Эгида: Encryption',
    description: 'Снижает влияние боевой интерференции на производство во время волны.',
    maxLevel: 10,
    baseCost: { energy: D(360), steel: D(16) },
    costFactor: 1.55,
  },
};

export const aegisUpgradeCost = (id: AegisUpgradeId, level: number) => {
  const def = AEGIS_UPGRADE_DEFS[id];
  const cost: Partial<Record<ResourceType, Decimal>> = {};
  for (const [res, base] of Object.entries(def.baseCost)) {
    cost[res as ResourceType] = D(base).mul(Math.pow(def.costFactor, level));
  }
  return cost;
};

export const computeAegisSmartTargetingEnabled = (levels: Record<AegisUpgradeId, number>) => {
  return (levels.smart_targeting ?? 0) > 0;
};

export const computeAegisInterference = (enemyCount: number) => {
  // 0..0.5 slowdown factor
  return Math.max(0, Math.min(0.5, enemyCount * 0.02));
};

export const computeAegisInterferenceMultiplier = (enemyCount: number, encryptionLevel: number, waveActive: boolean) => {
  if (!waveActive) return 1;
  const raw = computeAegisInterference(enemyCount);
  // Up to 60% mitigation at level 10.
  const mitigation = Math.max(0, Math.min(0.6, 0.06 * Math.max(0, encryptionLevel)));
  const effective = raw * (1 - mitigation);
  return Math.max(0.1, 1 - effective);
};
