import type { LucideIcon } from 'lucide-react';
import {
  BatteryCharging,
  Boxes,
  Shield,
  Crosshair,
  Drill,
  Flame,
  Leaf,
  Zap,
} from 'lucide-react';

export const BUILDING_ICON: Record<string, LucideIcon> = {
  generator_mk1: Zap,
  battery_mk1: BatteryCharging,
  miner_mk1: Drill,
  ice_extractor_mk1: Boxes,
  carbon_harvester_mk1: Leaf,
  warehouse_mk1: Boxes,
  steel_smelter_mk1: Flame,
  turret_mk1: Crosshair,
  shield_mk1: Shield,
};

export const getBuildingIcon = (buildingId: string): LucideIcon => {
  return BUILDING_ICON[buildingId] ?? Boxes;
};
