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
  } = useMarketStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createOrder();
  };

  const totalCost = (() => {
    const qty = parseFloat(orderFormQuantity) || 0;
    const price = parseFloat(orderFormPrice) || 0;
    return qty * price;
  })();

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
        <span>📝</span>
        <span>Создать ордер</span>
      </h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Тип ордера */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setOrderFormType('buy')}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
              orderFormType === 'buy'
                ? 'bg-green-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            🛒 Купить
          </button>
          <button
            type="button"
            onClick={() => setOrderFormType('sell')}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
              orderFormType === 'sell'
                ? 'bg-red-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            💰 Продать
          </button>
        </div>

        {/* Выбор ресурса */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">Ресурс</label>
          <select
            value={orderFormResource || ''}
            onChange={(e) => setOrderFormResource(e.target.value as TradeResourceType || null)}
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
          >
            <option value="">Выберите ресурс...</option>
            {TRADEABLE_RESOURCES.map(resource => (
              <option key={resource} value={resource}>
                {RESOURCE_NAMES[resource]}
              </option>
            ))}
          </select>
        </div>

        {/* Количество */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">
            Количество <span className="text-gray-500">(мин. 10)</span>
          </label>
          <input
            type="number"
            min="10"
            step="1"
            value={orderFormQuantity}
            onChange={(e) => setOrderFormQuantity(e.target.value)}
            placeholder="100"
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
          />
        </div>

        {/* Цена за единицу */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">Цена за единицу (кредиты)</label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={orderFormPrice}
            onChange={(e) => setOrderFormPrice(e.target.value)}
            placeholder="1.50"
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
          />
        </div>

        {/* Итого */}
        {totalCost > 0 && (
          <div className="bg-gray-700 rounded-lg p-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Итого:</span>
              <span className="text-xl font-bold text-yellow-400">
                {totalCost.toLocaleString()} 💳
              </span>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              + комиссия 2% = {(totalCost * 0.02).toLocaleString()} 💳
            </div>
          </div>
        )}

        {/* Кнопка создания */}
        <button
          type="submit"
          disabled={isLoading || !orderFormResource || !orderFormQuantity || !orderFormPrice}
          className={`w-full py-3 px-4 rounded-lg font-bold transition-colors ${
            orderFormType === 'buy'
              ? 'bg-green-600 hover:bg-green-500 disabled:bg-green-800'
              : 'bg-red-600 hover:bg-red-500 disabled:bg-red-800'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isLoading ? 'Создание...' : orderFormType === 'buy' ? '🛒 Создать ордер на покупку' : '💰 Создать ордер на продажу'}
        </button>
      </form>
    </div>
  );
}

export { RESOURCE_NAMES, TRADEABLE_RESOURCES };
