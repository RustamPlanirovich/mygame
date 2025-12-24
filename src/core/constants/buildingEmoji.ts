// Emoji иконки для зданий (для использования в PixiJS)
export const BUILDING_EMOJI: Record<string, string> = {
  generator_mk1: '⚡',
  battery_mk1: '🔋',
  miner_mk1: '⛏️',
  ice_extractor_mk1: '❄️',
  carbon_harvester_mk1: '🌿',
  warehouse_mk1: '📦',
  steel_smelter_mk1: '🔥',
  turret_mk1: '🎯',
  shield_mk1: '🛡️',
  dark_matter_condenser_mk1: '🌌',
  smart_broker_mk1: '💹',
  quantum_lab_mk1: '🔬',
  research_lab_mk1: '🔬',
  factory_mk1: '🏭',
  base: '🏠',
};

export const DEPOSIT_EMOJI: Record<string, string> = {
  ore: '🪨',
  ice: '🧊',
  carbon: '🌱',
};

export const getBuildingEmoji = (buildingId: string): string => {
  return BUILDING_EMOJI[buildingId] ?? '🏗️';
};

export const getDepositEmoji = (deposit: string): string => {
  return DEPOSIT_EMOJI[deposit] ?? '💎';
};
