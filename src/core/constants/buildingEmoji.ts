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
  // Фаза 3: Развлечения (Entertainment)
  recording_studio_mk1: '🎵',
  film_studio_mk1: '🎬',
  game_studio_mk1: '🎮',
  streaming_center_mk1: '📺',
  vr_factory_mk1: '🥽',
  ar_factory_mk1: '👓',
  console_factory_mk2: '🕹️',
  tv_factory_mk1: '📺',
  // Фаза 3: Культура (Culture)
  art_gallery_mk1: '🎨',
  sculptor_workshop_mk1: '🗿',
  publishing_house_mk1: '📚',
  architecture_bureau_mk1: '🏛️',
  fashion_house_mk1: '👗',
  jewelry_workshop_mk1: '💎',
  // Фаза 3: Социальные сети (Social Networks)
  data_center_mk1: '📱',
  comm_hub_mk1: '💬',
  search_cluster_mk1: '🔍',
  cloud_farm_mk1: '☁️',
  ai_lab_mk1: '🤖',
  mining_rig_mk1: '₿',
  // Фаза 3: Медицина и биотех (Medicine & Biotech)
  pharma_factory_mk1: '💊',
  biolab_mk1: '💉',
  implant_factory_mk1: '🦾',
  gene_lab_mk1: '🧬',
  cryo_facility_mk1: '❄️',
  // Фаза 3: Мегаструктуры (Megastructures)
  habitat_constructor_mk1: '🛸',
  dyson_forge_mk1: '☀️',
  warp_assembly_mk1: '🌀',
  quantum_lab_mk2: '⚛️',
  antimatter_reactor_mk1: '⚡',
  // Фаза 3: Трансцендентность (Transcendence)
  singularity_chamber_mk1: '🕳️',
  temporal_forge_mk1: '⏳',
  rift_generator_mk1: '🌌',
  omega_synthesizer_mk1: 'Ω',
  ascension_altar_mk1: '✨',
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
