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
  // Фаза 3: Развлечения (Entertainment)
  recording_studio_mk1: 'СТД',
  film_studio_mk1: 'КИН',
  game_studio_mk1: 'ИГР',
  streaming_center_mk1: 'СТР',
  vr_factory_mk1: 'VR',
  ar_factory_mk1: 'AR',
  console_factory_mk2: 'КНС',
  tv_factory_mk1: 'ТВ',
  // Фаза 3: Культура (Culture)
  art_gallery_mk1: 'ГАЛ',
  sculptor_workshop_mk1: 'СКУ',
  publishing_house_mk1: 'ИЗД',
  architecture_bureau_mk1: 'АРХ',
  fashion_house_mk1: 'МОД',
  jewelry_workshop_mk1: 'ЮВЛ',
  // Фаза 3: Социальные сети (Social Networks)
  data_center_mk1: 'ДЦ',
  comm_hub_mk1: 'КОМ',
  search_cluster_mk1: 'ПСК',
  cloud_farm_mk1: 'ОБЛ',
  ai_lab_mk1: 'ИИ',
  mining_rig_mk1: 'МАЙ',
  // Фаза 3: Медицина и биотех (Medicine & Biotech)
  pharma_factory_mk1: 'ФРМ',
  biolab_mk1: 'БИО',
  implant_factory_mk1: 'ИМП',
  gene_lab_mk1: 'ГЕН',
  cryo_facility_mk1: 'КРИ',
  // Фаза 3: Мегаструктуры (Megastructures)
  habitat_constructor_mk1: 'ХАБ',
  dyson_forge_mk1: 'ДСН',
  warp_assembly_mk1: 'ВРП',
  quantum_lab_mk2: 'КВТ+',
  antimatter_reactor_mk1: 'АМТ',
  // Фаза 3: Трансцендентность (Transcendence)
  singularity_chamber_mk1: 'СНГ',
  temporal_forge_mk1: 'ТМП',
  rift_generator_mk1: 'РАЗ',
  omega_synthesizer_mk1: 'ОМГ',
  ascension_altar_mk1: 'ВЗН',
};

export const getBuildingBadge = (buildingId: string): string => {
  return BUILDING_BADGE[buildingId] ?? '???';
};
