/**
 * Форма создания ордера
 */

import { useMarketStore } from '../../../features/marketStore';
import type { TradeResourceType } from '../../../core/gameTypes.market';

const TRADEABLE_RESOURCES: TradeResourceType[] = [
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
  'fashion', 'jewelry', 'medicine', 'vaccine', 'cryptocurrency'
];

const RESOURCE_NAMES: Record<TradeResourceType, string> = {
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

export function OrderForm() {
  const {
    orderFormType,
    orderFormResource,
    orderFormQuantity,
    orderFormPrice,
    setOrderFormType,
    setOrderFormResource,
    setOrderFormQuantity,
    setOrderFormPrice,
    createOrder,
    isLoading,
    setSelectedResource,
  } = useMarketStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createOrder();
  };

  // Синхронизируем ресурс формы с выбранным ресурсом
  const handleResourceChange = (resource: TradeResourceType | null) => {
    setOrderFormResource(resource);
    if (resource) {
      setSelectedResource(resource);
    }
  };

  const totalCost = (() => {
    const qty = parseFloat(orderFormQuantity) || 0;
    const price = parseFloat(orderFormPrice) || 0;
    return qty * price;
  })();

  return (
    <div className="bg-gray-800 rounded-lg p-3">
      {/* Компактный заголовок с типом ордера */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex bg-gray-900 rounded-lg p-0.5 flex-1">
          <button
            type="button"
            onClick={() => setOrderFormType('buy')}
            className={`flex-1 py-1.5 px-3 rounded-md text-sm font-medium transition-all ${
              orderFormType === 'buy'
                ? 'bg-green-600 text-white shadow-lg'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            🛒 Купить
          </button>
          <button
            type="button"
            onClick={() => setOrderFormType('sell')}
            className={`flex-1 py-1.5 px-3 rounded-md text-sm font-medium transition-all ${
              orderFormType === 'sell'
                ? 'bg-red-600 text-white shadow-lg'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            💰 Продать
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-2">
        {/* Ресурс - компактный */}
        <select
          value={orderFormResource || ''}
          onChange={(e) => handleResourceChange(e.target.value as TradeResourceType || null)}
          className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
        >
          <option value="">Выберите ресурс...</option>
          {TRADEABLE_RESOURCES.map(resource => (
            <option key={resource} value={resource}>
              {RESOURCE_NAMES[resource]}
            </option>
          ))}
        </select>

        {/* Количество и Цена в одну строку */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">Кол-во (мин. 10)</label>
            <input
              type="number"
              min="10"
              step="1"
              value={orderFormQuantity}
              onChange={(e) => setOrderFormQuantity(e.target.value)}
              placeholder="100"
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-2 py-1.5 text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">Цена 💳</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={orderFormPrice}
              onChange={(e) => setOrderFormPrice(e.target.value)}
              placeholder="1.50"
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-2 py-1.5 text-white text-sm"
            />
          </div>
        </div>

        {/* Итого + Кнопка в одной строке */}
        <div className="flex items-center gap-2 pt-1">
          {totalCost > 0 && (
            <div className="flex-1 text-sm">
              <span className="text-gray-400">Итого: </span>
              <span className="text-yellow-400 font-bold">{totalCost.toLocaleString()} 💳</span>
              <span className="text-gray-500 text-xs ml-1">(+2%)</span>
            </div>
          )}
          <button
            type="submit"
            disabled={isLoading || !orderFormResource || !orderFormQuantity || !orderFormPrice}
            className={`${totalCost > 0 ? '' : 'flex-1'} py-2 px-4 rounded-lg font-bold text-sm transition-colors ${
              orderFormType === 'buy'
                ? 'bg-green-600 hover:bg-green-500 disabled:bg-green-800'
                : 'bg-red-600 hover:bg-red-500 disabled:bg-red-800'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isLoading ? '...' : orderFormType === 'buy' ? '🛒 Купить' : '💰 Продать'}
          </button>
        </div>
      </form>
    </div>
  );
}

export { RESOURCE_NAMES, TRADEABLE_RESOURCES };
