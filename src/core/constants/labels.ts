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
  // Фаза 3: T6 - Развлечения (Entertainment)
  music_album: 'Музыкальный альбом',
  movie: 'Кинофильм',
  video_game: 'Видеоигра',
  streaming_service: 'Стриминговый сервис',
  vr_headset: 'VR-гарнитура',
  ar_glasses: 'AR-очки',
  gaming_console: 'Игровая консоль',
  smart_tv: 'Умный телевизор',
  // Фаза 3: T6 - Культура (Culture)
  artwork: 'Произведение искусства',
  sculpture: 'Скульптура',
  literature: 'Литература',
  architecture: 'Архитектурный проект',
  fashion: 'Мода',
  jewelry: 'Ювелирные изделия',
  // Фаза 3: T7 - Социальные сети и коммуникации
  social_network: 'Социальная сеть',
  messaging_app: 'Мессенджер',
  search_engine: 'Поисковая система',
  cloud_service: 'Облачный сервис',
  ai_assistant: 'ИИ-ассистент',
  cryptocurrency: 'Криптовалюта',
  // Фаза 3: T7 - Медицина и биотех
  medicine: 'Медикаменты',
  vaccine: 'Вакцина',
  bioimplant: 'Биоимплант',
  gene_therapy: 'Генная терапия',
  cryonics: 'Криоконсервация',
  // Фаза 3: T8 - Мегаструктуры и инфраструктура
  orbital_habitat: 'Орбитальный хабитат',
  dyson_component: 'Компонент Сферы Дайсона',
  warp_core: 'Варп-ядро',
  quantum_computer: 'Квантовый компьютер',
  antimatter: 'Антиматерия',
  // Фаза 3: T9 - Трансцендентные ресурсы
  singularity_core: 'Ядро сингулярности',
  time_crystal: 'Кристалл времени',
  dimensional_rift: 'Измерительный разрыв',
  omega_matter: 'Омега-материя',
  ascension_essence: 'Эссенция вознесения',
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
  // Фаза 3: T6 - Развлечения (Entertainment)
  music_album: '🎵',
  movie: '🎬',
  video_game: '🎮',
  streaming_service: '📺',
  vr_headset: '🥽',
  ar_glasses: '👓',
  gaming_console: '🕹️',
  smart_tv: '📺',
  // Фаза 3: T6 - Культура (Culture)
  artwork: '🎨',
  sculpture: '🗿',
  literature: '📚',
  architecture: '🏛️',
  fashion: '👗',
  jewelry: '💎',
  // Фаза 3: T7 - Социальные сети и коммуникации
  social_network: '📱',
  messaging_app: '💬',
  search_engine: '🔍',
  cloud_service: '☁️',
  ai_assistant: '🤖',
  cryptocurrency: '₿',
  // Фаза 3: T7 - Медицина и биотех
  medicine: '💊',
  vaccine: '💉',
  bioimplant: '🦾',
  gene_therapy: '🧬',
  cryonics: '❄️',
  // Фаза 3: T8 - Мегаструктуры и инфраструктура
  orbital_habitat: '🛸',
  dyson_component: '☀️',
  warp_core: '🌀',
  quantum_computer: '⚛️',
  antimatter: '⚡',
  // Фаза 3: T9 - Трансцендентные ресурсы
  singularity_core: '🕳️',
  time_crystal: '⏳',
  dimensional_rift: '🌌',
  omega_matter: 'Ω',
  ascension_essence: '✨',
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
  // Фаза 3: Торгуемые T6-T7 ресурсы
  music_album: 'Музыкальный альбом',
  movie: 'Кинофильм',
  video_game: 'Видеоигра',
  vr_headset: 'VR-гарнитура',
  ar_glasses: 'AR-очки',
  gaming_console: 'Игровая консоль',
  smart_tv: 'Умный телевизор',
  artwork: 'Произведение искусства',
  sculpture: 'Скульптура',
  literature: 'Литература',
  fashion: 'Мода',
  jewelry: 'Ювелирные изделия',
  medicine: 'Медикаменты',
  vaccine: 'Вакцина',
  cryptocurrency: 'Криптовалюта',
};

export const ENEMY_LABEL: Record<Enemy['type'], string> = {
  scout: 'Глитч: Разведчик',
  swarmer: 'Глитч: Рой',
  brute: 'Глитч: Брут',
};
