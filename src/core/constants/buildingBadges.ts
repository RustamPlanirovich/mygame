export const BUILDING_BADGE: Record<string, string> = {
  generator_mk1: 'ГЕН',
  battery_mk1: 'АКБ',
  miner_mk1: 'РУД',
  ice_extractor_mk1: 'ЛЁД',
  carbon_harvester_mk1: 'УГЛ',
  warehouse_mk1: 'СКЛ',
  steel_smelter_mk1: 'СТЛ',
  turret_mk1: 'ТУР',
  shield_mk1: 'ЩИТ',
};

export const getBuildingBadge = (buildingId: string): string => {
  return BUILDING_BADGE[buildingId] ?? '???';
};
