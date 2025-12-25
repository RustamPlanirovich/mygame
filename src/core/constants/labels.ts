import type { Enemy, ResourceType, TradeResourceType } from '../gameTypes';

export const RESOURCE_LABEL: Record<ResourceType, string> = {
  energy: 'Энергия',
  ore: 'Руда',
  ice: 'Лёд',
  carbon: 'Углерод',
  steel: 'Сталь',
  dark_matter: 'Тёмная Материя',
  // Фаза 2: Базовые новые ресурсы
  natural_gas: 'Природный газ',
  oil: 'Нефть',
  gasoline: 'Бензин',
  plastic: 'Пластик',
  glass: 'Стекло',
  chemicals: 'Химикаты',
  sand: 'Песок',
  // Фаза 2.3: Металлические ресурсы
  uranium: 'Уран',
  chrome: 'Хром',
  titanium: 'Титан',
  // Фаза 2.4-2.5: Продвинутые ресурсы
  copper: 'Медь',
  semiconductors: 'Полупроводники',
  dynamite: 'Динамит',
  fiber: 'Волокно',
  // Фаза 2.6: Сложные производственные ресурсы
  integrated_circuit: 'Интегральная микросхема',
  battery: 'Гальванический аккумулятор',
  engine: 'Двигатель',
  display: 'Экраны',
  computer: 'Компьютер',
  liquid_fuel: 'Жидкое топливо',
  chrome_alloy: 'Хромовый сплав',
  titanium_alloy: 'Титановый сплав',
  enriched_uranium: 'Обогащённый уран',
  // Фаза 2.7: Военные ресурсы
  weapon: 'Оружие',
  artillery: 'Артиллерия',
  radar: 'Радар',
  nuclear_bomb: 'Атомная бомба',
  // Фаза 2.8: Космические ресурсы
  jet_engine: 'Реактивный двигатель',
  satellite: 'Спутник',
  rocket: 'Ракета',
  spaceship: 'Космический корабль',
  console: 'Консоль',
  space_station: 'Космическая станция',
  // Фаза 2.9: Специальные ресурсы
  robot: 'Робот',
  // Фаза 8.1: Экология
  waste: 'Мусор',
  radioactive_waste: 'Радиоактивные отходы',
};

export const RESOURCE_SHORT: Record<ResourceType, string> = {
  energy: '⚡',
  ore: 'РУД',
  ice: 'ЛЁД',
  carbon: 'УГЛ',
  steel: 'СТ',
  dark_matter: 'ТМ',
  // Фаза 2: Базовые новые ресурсы
  natural_gas: '💨',
  oil: '🛢️',
  gasoline: '⛽',
  plastic: '🧴',
  glass: '🪟',
  chemicals: '🧪',
  sand: '🏖️',
  // Фаза 2.3: Металлические ресурсы
  uranium: '☢️',
  chrome: '⚪',
  titanium: '🔹',
  // Фаза 2.4-2.5: Продвинутые ресурсы
  copper: '🟠',
  semiconductors: '💾',
  dynamite: '💥',
  fiber: '🧵',
  // Фаза 2.6: Сложные производственные ресурсы
  integrated_circuit: '🔌',
  battery: '🔋',
  engine: '⚙️',
  display: '📺',
  computer: '🖥️',
  liquid_fuel: '🫠',
  chrome_alloy: '🔩',
  titanium_alloy: '🔧',
  enriched_uranium: '⚛️',
  // Фаза 2.7: Военные ресурсы
  weapon: '🔫',
  artillery: '💣',
  radar: '📡',
  nuclear_bomb: '💣',
  // Фаза 2.8: Космические ресурсы
  jet_engine: '🚀',
  satellite: '🛰️',
  rocket: '🚀',
  spaceship: '🛸',
  console: '🖥️',
  space_station: '🏭',
  // Фаза 2.9: Специальные ресурсы
  robot: '🤖',
  // Фаза 8.1: Экология
  waste: '🗑️',
  radioactive_waste: '☢️',
};

// RESOURCE_EMOJI - алиас для RESOURCE_SHORT (удобство использования в UI)
export const RESOURCE_EMOJI = RESOURCE_SHORT;

export const TRADE_LABEL: Record<TradeResourceType, string> = {
  ore: 'Руда',
  ice: 'Лёд',
  carbon: 'Углерод',
  steel: 'Сталь',
  // Фаза 2: Базовые новые ресурсы
  natural_gas: 'Природный газ',
  oil: 'Нефть',
  gasoline: 'Бензин',
  plastic: 'Пластик',
  glass: 'Стекло',
  sand: 'Песок',
  // Фаза 2.3: Металлические ресурсы
  uranium: 'Уран',
  chrome: 'Хром',
  titanium: 'Титан',
  // Фаза 2.4-2.5: Продвинутые ресурсы
  copper: 'Медь',
  semiconductors: 'Полупроводники',
  dynamite: 'Динамит',
  fiber: 'Волокно',
  // Фаза 2.6: Сложные производственные ресурсы
  integrated_circuit: 'Интегральная микросхема',
  battery: 'Гальванический аккумулятор',
  engine: 'Двигатель',
  display: 'Экраны',
  computer: 'Компьютер',
  liquid_fuel: 'Жидкое топливо',
  chrome_alloy: 'Хромовый сплав',
  titanium_alloy: 'Титановый сплав',
  enriched_uranium: 'Обогащённый уран',
  // Фаза 2.7: Военные ресурсы
  weapon: 'Оружие',
  artillery: 'Артиллерия',
  radar: 'Радар',
  nuclear_bomb: 'Атомная бомба',
  // Фаза 2.8: Космические ресурсы
  jet_engine: 'Реактивный двигатель',
  satellite: 'Спутник',
  rocket: 'Ракета',
  spaceship: 'Космический корабль',
  console: 'Консоль',
  space_station: 'Космическая станция',
  // Фаза 2.9: Специальные ресурсы
  robot: 'Робот',
};

export const ENEMY_LABEL: Record<Enemy['type'], string> = {
  scout: 'Глитч: Разведчик',
  swarmer: 'Глитч: Рой',
  brute: 'Глитч: Брут',
};
