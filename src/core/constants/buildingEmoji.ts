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
  // Фаза 2: Новые здания
  gas_well_mk1: '💨',
  oil_well_mk1: '🛢️',
  sand_quarry_mk1: '🏖️',
  oil_refinery_mk1: '🏭',
  glass_factory_mk1: '🪟',
  chemical_plant_mk1: '🧪',
  // Фаза 2.2: Энергетические здания
  solar_panel_mk1: '☀️',
  gas_power_plant_mk1: '⚡',
  fuel_power_plant_mk1: '🔥',
  energy_storage_mk1: '🔋',
  // Фаза 2.3: Металлические шахты
  uranium_mine_mk1: '☢️',
  chrome_mine_mk1: '⚪',
  titanium_mine_mk1: '🔹',
  // Фаза 2.4: Перерабатывающие здания
  copper_mine_mk1: '🟠',
  gas_refinery_mk1: '⛽',
  semiconductor_factory_mk1: '💾',
  dynamite_factory_mk1: '💥',
  fiber_factory_mk1: '🧵',
  // Фаза 2.6: Сложные производственные здания
  ic_factory_mk1: '🔌',
  battery_factory_mk1: '🔋',
  engine_factory_mk1: '⚙️',
  display_factory_mk1: '📺',
  computer_factory_mk1: '🖥️',
  liquid_fuel_plant_mk1: '🫠',
  chrome_alloy_smelter_mk1: '🔩',
  titanium_alloy_smelter_mk1: '🔧',
  uranium_enrichment_plant_mk1: '⚛️',
  // Фаза 2.7: Военные здания
  weapon_factory_mk1: '🔫',
  artillery_factory_mk1: '💣',
  radar_factory_mk1: '📡',
  nuclear_bomb_factory_mk1: '💣',
  // Фаза 2.8: Космические здания
  jet_engine_factory_mk1: '🚀',
  satellite_factory_mk1: '🛰️',
  rocket_factory_mk1: '🚀',
  spaceship_factory_mk1: '🛸',
  console_factory_mk1: '🖥️',
  space_station_factory_mk1: '🏗️',
  space_colony_mk1: '🌌',
  // Фаза 2.9: Специальные здания
  robot_factory_mk1: '🤖',
  resource_accelerator_mk1: '⚡',
  recycler_mk1: '♻️',
  bitcoin_farm_mk1: '💰',
  advanced_warehouse_mk1: '🏪',
  logistics_hub_mk1: '🚛',
  power_substation_mk1: '🔌',
  cooling_system_mk1: '❄️',
  // Фаза 4: Исследовательские здания
  research_center_mk1: '🔬',
  supercomputer_lab_mk1: '💻',
};

export const DEPOSIT_EMOJI: Record<string, string> = {
  ore: '🪨',
  ice: '🧊',
  carbon: '🌱',
  // Фаза 2: Новые месторождения
  natural_gas: '💨',
  oil: '🛢️',
  sand: '🏖️',
  // Фаза 2.3: Металлические месторождения
  uranium: '☢️',
  chrome: '⚪',
  titanium: '🔹',
  // Фаза 2.4: Медь
  copper: '🟠',
};

export const getBuildingEmoji = (buildingId: string): string => {
  return BUILDING_EMOJI[buildingId] ?? '🏗️';
};

export const getDepositEmoji = (deposit: string): string => {
  return DEPOSIT_EMOJI[deposit] ?? '💎';
};
