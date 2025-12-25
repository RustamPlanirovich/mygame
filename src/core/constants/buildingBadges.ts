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
  // Фаза 2.8: Космические здания
  jet_engine_factory_mk1: 'РД',
  satellite_factory_mk1: 'СПТ',
  rocket_factory_mk1: 'РКТ',
  spaceship_factory_mk1: 'КРБ',
  console_factory_mk1: 'КНС',
  space_station_factory_mk1: 'СТН',
  space_colony_mk1: 'КЛН',
  // Фаза 2.9: Специальные здания
  robot_factory_mk1: 'РБТ',
  resource_accelerator_mk1: 'УСК',
  recycler_mk1: 'РЦК',
  bitcoin_farm_mk1: 'БТК',
  advanced_warehouse_mk1: 'СКЛ+',
  logistics_hub_mk1: 'ЛГС',
  power_substation_mk1: 'ПДС',
  cooling_system_mk1: 'ОХЛ',
  // Фаза 4: Исследовательские здания
  research_center_mk1: 'ИСЛ',
  supercomputer_lab_mk1: 'СПК',
  quantum_lab_mk1: 'КВТ',
};

export const getBuildingBadge = (buildingId: string): string => {
  return BUILDING_BADGE[buildingId] ?? '???';
};
