import type Decimal from 'break_eternity.js';
import type { ShipModuleId, ShipSlot } from '../gameTypes';
import type { ResourceType } from '../gameTypes';
import { D } from '../math/format.ts';

export type ShipModuleDef = {
  id: ShipModuleId;
  slot: ShipSlot;
  name: string;
  // Cost paid from base buffer.
  cost: Partial<Record<ResourceType, Decimal>>;
  // Expedition effects.
  expeditionDurationMult: number; // 1.0 = no change
  rewardMult: number; // 1.0 = no change
  steelBonusChanceAdd: number; // additive to base bonus chance
};

export const BASE_EXPEDITION_DURATION_MS = 30_000;
export const BASE_STEEL_BONUS_CHANCE = 0.35;

export const SHIP_MODULE_DEFS: Record<ShipModuleId, ShipModuleDef> = {
  hull_mk1: {
    id: 'hull_mk1',
    slot: 'hull',
    name: 'Корпус Mk.I',
    cost: { energy: D(0) },
    expeditionDurationMult: 1,
    rewardMult: 1,
    steelBonusChanceAdd: 0,
  },
  hull_mk2: {
    id: 'hull_mk2',
    slot: 'hull',
    name: 'Корпус Mk.II',
    cost: { energy: D(600), steel: D(40) },
    expeditionDurationMult: 0.95,
    rewardMult: 1.05,
    steelBonusChanceAdd: 0.20,
  },

  engine_mk1: {
    id: 'engine_mk1',
    slot: 'engine',
    name: 'Двигатель Mk.I',
    cost: { energy: D(0) },
    expeditionDurationMult: 1,
    rewardMult: 1,
    steelBonusChanceAdd: 0,
  },
  engine_mk2: {
    id: 'engine_mk2',
    slot: 'engine',
    name: 'Двигатель Mk.II',
    cost: { energy: D(700), steel: D(45) },
    expeditionDurationMult: 0.75,
    rewardMult: 1,
    steelBonusChanceAdd: 0,
  },

  cargo_mk1: {
    id: 'cargo_mk1',
    slot: 'cargo',
    name: 'Трюм Mk.I',
    cost: { energy: D(0) },
    expeditionDurationMult: 1,
    rewardMult: 1,
    steelBonusChanceAdd: 0,
  },
  cargo_mk2: {
    id: 'cargo_mk2',
    slot: 'cargo',
    name: 'Трюм Mk.II',
    cost: { energy: D(500), steel: D(35) },
    expeditionDurationMult: 1,
    rewardMult: 1.45,
    steelBonusChanceAdd: 0,
  },
};

export const SHIP_SLOT_LABEL: Record<ShipSlot, string> = {
  hull: 'Корпус',
  engine: 'Двигатель',
  cargo: 'Трюм',
};

export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export const computeShipExpeditionDurationMs = (installed: Record<ShipSlot, ShipModuleId>) => {
  const hull = SHIP_MODULE_DEFS[installed.hull];
  const engine = SHIP_MODULE_DEFS[installed.engine];
  const mult = (hull?.expeditionDurationMult ?? 1) * (engine?.expeditionDurationMult ?? 1);
  return Math.max(5_000, Math.round(BASE_EXPEDITION_DURATION_MS * mult));
};

export const computeShipRewardMultiplier = (installed: Record<ShipSlot, ShipModuleId>) => {
  const hull = SHIP_MODULE_DEFS[installed.hull];
  const cargo = SHIP_MODULE_DEFS[installed.cargo];
  return (hull?.rewardMult ?? 1) * (cargo?.rewardMult ?? 1);
};

export const computeShipSteelBonusChance = (installed: Record<ShipSlot, ShipModuleId>) => {
  const hull = SHIP_MODULE_DEFS[installed.hull];
  return clamp01(BASE_STEEL_BONUS_CHANCE + (hull?.steelBonusChanceAdd ?? 0));
};
