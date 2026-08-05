/**
 * Русские названия торгуемых ресурсов и их список.
 *
 * Раньше и то и другое лежало в OrderForm.tsx, и половина панелей биржи
 * импортировала константы из формы — то есть тянула форму в граф зависимостей
 * ради словаря. Теперь словарь живёт отдельно; OrderForm его реэкспортирует,
 * чтобы старые импорты продолжали работать.
 *
 * Список обязан совпадать с RESOURCE_UNIVERSE в server/market-sim/universe.js:
 * сервер отвергнет всё, чего там нет.
 */

import type { TradeResourceType } from '../../../core/gameTypes.market';

export const TRADEABLE_RESOURCES: TradeResourceType[] = [
  'ore', 'ice', 'carbon', 'steel',
  'natural_gas', 'oil', 'gasoline', 'plastic', 'glass', 'sand',
  'uranium', 'chrome', 'titanium',
  'copper', 'semiconductors', 'dynamite', 'fiber',
  'integrated_circuit', 'battery', 'engine', 'display', 'computer',
  'liquid_fuel', 'chrome_alloy', 'titanium_alloy', 'enriched_uranium',
  'weapon', 'artillery', 'radar', 'nuclear_bomb',
  'jet_engine', 'satellite', 'rocket', 'spaceship', 'console', 'space_station',
  'robot',
  // Фаза 3: Торгуемые T6-T7 ресурсы
  'music_album', 'movie', 'video_game', 'vr_headset', 'ar_glasses',
  'gaming_console', 'smart_tv', 'artwork', 'sculpture', 'literature',
  'fashion', 'jewelry', 'medicine', 'vaccine', 'cryptocurrency',
];

export const RESOURCE_NAMES: Record<TradeResourceType, string> = {
  ore: 'Руда',
  ice: 'Лёд',
  carbon: 'Углерод',
  steel: 'Сталь',
  natural_gas: 'Природный газ',
  oil: 'Нефть',
  gasoline: 'Бензин',
  plastic: 'Пластик',
  glass: 'Стекло',
  sand: 'Песок',
  uranium: 'Уран',
  chrome: 'Хром',
  titanium: 'Титан',
  copper: 'Медь',
  semiconductors: 'Полупроводники',
  dynamite: 'Динамит',
  fiber: 'Волокно',
  integrated_circuit: 'Микросхема',
  battery: 'Батарея',
  engine: 'Двигатель',
  display: 'Дисплей',
  computer: 'Компьютер',
  liquid_fuel: 'Жидкое топливо',
  chrome_alloy: 'Хромовый сплав',
  titanium_alloy: 'Титановый сплав',
  enriched_uranium: 'Обогащённый уран',
  weapon: 'Оружие',
  artillery: 'Артиллерия',
  radar: 'Радар',
  nuclear_bomb: 'Ядерная бомба',
  jet_engine: 'Реактивный двигатель',
  satellite: 'Спутник',
  rocket: 'Ракета',
  spaceship: 'Космический корабль',
  console: 'Консоль управления',
  space_station: 'Космическая станция',
  robot: 'Робот',
  // Фаза 3: Торгуемые T6-T7 ресурсы
  music_album: 'Музыкальный альбом',
  movie: 'Фильм',
  video_game: 'Видеоигра',
  vr_headset: 'VR-гарнитура',
  ar_glasses: 'AR-очки',
  gaming_console: 'Игровая консоль',
  smart_tv: 'Смарт-ТВ',
  artwork: 'Произведение искусства',
  sculpture: 'Скульптура',
  literature: 'Литература',
  fashion: 'Мода',
  jewelry: 'Ювелирное украшение',
  medicine: 'Лекарство',
  vaccine: 'Вакцина',
  cryptocurrency: 'Криптовалюта',
};

/** Название ресурса или самого ключа сейфа ('__credits__' -> «Кредиты»). */
export function vaultResourceName(resource: string): string {
  if (resource === '__credits__') return 'Кредиты';
  return RESOURCE_NAMES[resource as TradeResourceType] ?? resource;
}
