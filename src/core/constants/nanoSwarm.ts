import type Decimal from 'break_eternity.js';
import type { NanoSwarmChannel, NanoSwarmState } from '../gameTypes';
import { D } from '../math/format.ts';

export const NANO_DEFAULT_TOTAL = 100;

export const NANO_ATTACK_DPS_PER_BOT = D(0.05);
export const NANO_REPAIR_HP_PER_BOT_PER_SEC = D(0.08);
export const NANO_BOOST_MAX = 0.5; // +50% facility speed at 100% boost allocation

export const nanoClamp01 = (v: number) => Math.max(0, Math.min(1, v));

export const normalizeNanoAllocation = (alloc: Record<NanoSwarmChannel, number>) => {
  const a = nanoClamp01(alloc.attack);
  const r = nanoClamp01(alloc.repair);
  const b = nanoClamp01(alloc.boost);
  const sum = a + r + b;
  if (sum <= 0) {
    return { attack: 1 / 3, repair: 1 / 3, boost: 1 / 3 } as Record<NanoSwarmChannel, number>;
  }
  return {
    attack: a / sum,
    repair: r / sum,
    boost: b / sum,
  } as Record<NanoSwarmChannel, number>;
};

export const INITIAL_NANO_SWARM: NanoSwarmState = {
  total: NANO_DEFAULT_TOTAL,
  allocation: { attack: 1 / 3, repair: 1 / 3, boost: 1 / 3 },
};

export const computeNanoBoostMultiplier = (boostAllocation: number) => {
  return 1 + nanoClamp01(boostAllocation) * NANO_BOOST_MAX;
};

export const computeNanoAttackDpsPerSecond = (
  total: number,
  attackAllocation: number,
  combatMult: Decimal,
) => {
  const bots = Math.max(0, total) * nanoClamp01(attackAllocation);
  return NANO_ATTACK_DPS_PER_BOT.mul(D(bots)).mul(combatMult);
};

export const computeNanoRepairHpPerSecond = (
  total: number,
  repairAllocation: number,
  combatMult: Decimal,
) => {
  const bots = Math.max(0, total) * nanoClamp01(repairAllocation);
  return NANO_REPAIR_HP_PER_BOT_PER_SEC.mul(D(bots)).mul(combatMult);
};
