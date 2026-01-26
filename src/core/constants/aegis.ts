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
    maxLevel: 20,
    baseCost: { energy: D(360), steel: D(16) },
    costFactor: 1.45,
  },
  shield_boost: {
    name: 'Эгида: Shield Boost',
    description: 'Увеличивает скорость регенерации щита на +10% за уровень.',
    maxLevel: 15,
    baseCost: { energy: D(500), steel: D(25) },
    costFactor: 1.5,
  },
  turret_overdrive: {
    name: 'Эгида: Turret Overdrive',
    description: 'Увеличивает урон турелей на +8% за уровень.',
    maxLevel: 15,
    baseCost: { energy: D(600), steel: D(30) },
    costFactor: 1.55,
  },
  auto_repair: {
    name: 'Эгида: Auto Repair',
    description: 'База восстанавливает +0.2 HP/сек за уровень даже во время боя.',
    maxLevel: 10,
    baseCost: { energy: D(800), steel: D(40) },
    costFactor: 1.6,
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
  // Up to 80% mitigation at level 20 (4% per level).
  const mitigation = Math.max(0, Math.min(0.8, 0.04 * Math.max(0, encryptionLevel)));
  const effective = raw * (1 - mitigation);
  return Math.max(0.1, 1 - effective);
};

// Shield Boost: +10% shield regen per level
export const computeAegisShieldBoostMultiplier = (shieldBoostLevel: number): number => {
  return 1 + 0.1 * Math.max(0, shieldBoostLevel);
};

// Turret Overdrive: +8% turret damage per level
export const computeAegisTurretOverdriveMultiplier = (turretOverdriveLevel: number): number => {
  return 1 + 0.08 * Math.max(0, turretOverdriveLevel);
};

// Auto Repair: +0.2 HP/sec per level (works even during combat)
export const computeAegisAutoRepairPerSecond = (autoRepairLevel: number): number => {
  return 0.2 * Math.max(0, autoRepairLevel);
};
