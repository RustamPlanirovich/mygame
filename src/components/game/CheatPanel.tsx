import React, { useState } from 'react';
import { useGameStore } from '../../features/gameStore';
import type { ResourceType } from '../../core/gameTypes';
import { MAP_DEFINITIONS } from '../../core/constants/maps';
import type { MapId } from '../../core/gameTypes.maps';
import { Modal } from '../ui';

// Список всех ресурсов по категориям
const resourceCategories = {
  'Базовые': ['energy', 'ore', 'ice', 'carbon', 'steel', 'dark_matter'] as ResourceType[],
  'Фаза 2: Базовые': ['natural_gas', 'oil', 'gasoline', 'plastic', 'glass', 'sand', 'chemicals'] as ResourceType[],
  'Фаза 2: Металлы': ['uranium', 'chrome', 'titanium', 'copper'] as ResourceType[],
  'Фаза 2: Продвинутые': ['semiconductors', 'dynamite', 'fiber'] as ResourceType[],
  'Фаза 2: Сложные': ['integrated_circuit', 'battery', 'engine', 'display', 'computer', 'liquid_fuel', 'chrome_alloy', 'titanium_alloy', 'enriched_uranium'] as ResourceType[],
  'Фаза 2: Военные': ['weapon', 'artillery', 'radar', 'nuclear_bomb'] as ResourceType[],
  'Фаза 2: Космические': ['jet_engine', 'satellite', 'rocket', 'spaceship', 'console', 'space_station'] as ResourceType[],
  'Фаза 2: Специальные': ['robot', 'waste', 'radioactive_waste'] as ResourceType[],
  'Фаза 3: Развлечения': ['music_album', 'movie', 'video_game', 'streaming_service', 'vr_headset', 'ar_glasses', 'gaming_console', 'smart_tv'] as ResourceType[],
  'Фаза 3: Культура': ['artwork', 'sculpture', 'literature', 'architecture', 'fashion', 'jewelry'] as ResourceType[],
  'Фаза 3: Социальные': ['social_network', 'messaging_app', 'search_engine', 'cloud_service', 'ai_assistant', 'cryptocurrency'] as ResourceType[],
  'Фаза 3: Медицина': ['medicine', 'vaccine', 'bioimplant', 'gene_therapy', 'cryonics'] as ResourceType[],
  'Фаза 3: Мегаструктуры': ['orbital_habitat', 'dyson_component', 'warp_core', 'quantum_computer', 'antimatter'] as ResourceType[],
  'Фаза 3: Трансцендентность': ['singularity_core', 'time_crystal', 'dimensional_rift', 'omega_matter', 'ascension_essence'] as ResourceType[],
};

// Русские названия ресурсов
const resourceNames: Record<ResourceType, string> = {
  energy: 'Энергия',
  ore: 'Руда',
  ice: 'Лёд',
  carbon: 'Углерод',
  steel: 'Сталь',
  dark_matter: 'Тёмная материя',
  natural_gas: 'Природный газ',
  oil: 'Нефть',
  gasoline: 'Бензин',
  plastic: 'Пластик',
  glass: 'Стекло',
  sand: 'Песок',
  chemicals: 'Химикаты',
  uranium: 'Уран',
  chrome: 'Хром',
  titanium: 'Титан',
  copper: 'Медь',
  semiconductors: 'Полупроводники',
  dynamite: 'Динамит',
  fiber: 'Волокно',
  integrated_circuit: 'Интегральная схема',
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
  console: 'Консоль',
  space_station: 'Космическая станция',
  robot: 'Робот',
  waste: 'Отходы',
  radioactive_waste: 'Радиоактивные отходы',
  // Фаза 3: T6 Entertainment
  music_album: 'Музыкальный альбом',
  movie: 'Фильм',
  video_game: 'Видеоигра',
  streaming_service: 'Стриминговый сервис',
  vr_headset: 'VR-гарнитура',
  ar_glasses: 'AR-очки',
  gaming_console: 'Игровая консоль',
  smart_tv: 'Смарт-ТВ',
  // Фаза 3: T6 Culture
  artwork: 'Произведение искусства',
  sculpture: 'Скульптура',
  literature: 'Литература',
  architecture: 'Архитектура',
  fashion: 'Мода',
  jewelry: 'Ювелирное украшение',
  // Фаза 3: T7 Social
  social_network: 'Социальная сеть',
  messaging_app: 'Мессенджер',
  search_engine: 'Поисковая система',
  cloud_service: 'Облачный сервис',
  ai_assistant: 'ИИ-ассистент',
  cryptocurrency: 'Криптовалюта',
  // Фаза 3: T7 Medical
  medicine: 'Лекарство',
  vaccine: 'Вакцина',
  bioimplant: 'Биоимплант',
  gene_therapy: 'Генная терапия',
  cryonics: 'Криоконсервация',
  // Фаза 3: T8 Megastructures
  orbital_habitat: 'Орбитальный хабитат',
  dyson_component: 'Компонент Дайсона',
  warp_core: 'Варп-ядро',
  quantum_computer: 'Квантовый компьютер',
  antimatter: 'Антиматерия',
  // Фаза 3: T9 Transcendence
  singularity_core: 'Ядро сингулярности',
  time_crystal: 'Кристалл времени',
  dimensional_rift: 'Разлом измерения',
  omega_matter: 'Омега-материя',
  ascension_essence: 'Эссенция вознесения',
};

interface CheatPanelProps {
  onClose: () => void;
}

export const CheatPanel: React.FC<CheatPanelProps> = ({ onClose }) => {
  const [selectedResource, setSelectedResource] = useState<ResourceType>('energy');
  const [amount, setAmount] = useState('10000');
  const [currencyAmount, setCurrencyAmount] = useState('100000');
  const addResource = useGameStore((state) => state.addResource);
  const addCredits = useGameStore((state) => state.addCredits);
  const addResearchPoints = useGameStore((state) => state.addResearchPoints);
  const addInfluence = useGameStore((state) => state.addInfluence);
  
  // Map system
  const maps = useGameStore((state) => state.maps);
  const startMap = useGameStore((state) => state.startMap);

  const traceFlows = useGameStore((state: any) => state.debug?.traceFlows ?? false);
  const lastFlow = useGameStore((state: any) => state.debug?.lastFlow ?? null);
  
  // Разблокировать все карты через прямое изменение стора
  const unlockAllMaps = () => {
    const allMapIds = MAP_DEFINITIONS.map(m => m.id) as MapId[];
    useGameStore.setState((state) => ({
      maps: {
        ...state.maps,
        unlockedMaps: allMapIds,
      },
    }));
  };
  
  // Запустить карту напрямую (разблокирует и стартует)
  const forceStartMap = (mapId: MapId) => {
    // Сначала разблокируем карту
    useGameStore.setState((state) => ({
      maps: {
        ...state.maps,
        unlockedMaps: state.maps.unlockedMaps.includes(mapId) 
          ? state.maps.unlockedMaps 
          : [...state.maps.unlockedMaps, mapId],
      },
    }));
    // Затем стартуем
    startMap(mapId);
  };

  const toggleAllProductionBuildingsExceptPower = (disabled: boolean) => {
    // Это dev-only панель, поэтому делаем прямое изменение стора.
    // Отключаем все здания, у которых есть production, кроме:
    // - источников энергии (production.energy > 0)
    // - конденсаторов (productionMultipliers.energy > 0)
    useGameStore.setState((state) => {
      const tileDisabled = { ...(state.grid.tileDisabled || {}) };

      const toNumberSafe = (v: any): number => {
        if (v == null) return 0;
        if (typeof v === 'number') return v;
        if (typeof v === 'string') return Number(v);
        if (typeof v?.toNumber === 'function') return v.toNumber();
        if (typeof v?.toString === 'function') return Number(v.toString());
        return Number(v);
      };

      let changed = 0;
      for (const [tileKey, buildingId] of Object.entries(state.grid.tiles)) {
        if (!buildingId) continue;
        if (tileKey === 'base') continue;

        const b = state.buildings.find((x) => x.id === buildingId);
        if (!b) continue;

        const prod = b.production || {};
        const hasProduction = Object.keys(prod).length > 0;
        if (!hasProduction) continue;

        const energyProd = toNumberSafe((prod as any).energy);
        const energyCap = toNumberSafe((b as any).productionMultipliers?.energy);

        const isEnergySource = energyProd > 0;
        const isCapacitor = energyCap > 0;

        if (isEnergySource || isCapacitor) continue;

        const next = disabled;
        const prev = tileDisabled[tileKey] || false;
        if (prev !== next) {
          tileDisabled[tileKey] = next;
          changed++;
        }
      }

      if (changed > 0) {
        console.log(`🧪 Cheat: ${disabled ? 'disabled' : 'enabled'} ${changed} production tiles (except power/capacitors)`);
      }

      return {
        ...state,
        grid: {
          ...state.grid,
          tileDisabled,
        },
      };
    });
  };

  const handleGiveResource = () => {
    const numAmount = parseFloat(amount);
    if (!isNaN(numAmount) && numAmount > 0) {
      addResource(selectedResource, numAmount);
    }
  };

  const handleGiveAll = () => {
    const numAmount = parseFloat(amount);
    if (!isNaN(numAmount) && numAmount > 0) {
      Object.values(resourceCategories).flat().forEach(resource => {
        addResource(resource, numAmount);
      });
    }
  };

  const presetAmounts = [100, 1000, 10000, 100000, 1000000];

  return (
    <Modal open onClose={onClose} title="🎮 Чит-панель" size="xl">
      <div className="p-6">
        {/* Быстрые действия */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-cyan-300 mb-2">⚡ Быстрые действия</h3>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                setAmount('10000');
                handleGiveAll();
              }}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded transition-colors"
            >
              Все ресурсы (10K)
            </button>
            <button
              onClick={() => {
                setAmount('100000');
                handleGiveAll();
              }}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded transition-colors"
            >
              Все ресурсы (100K)
            </button>
            <button
              onClick={() => {
                addResource('energy', 1000000);
              }}
              className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded transition-colors"
            >
              Энергия (1M)
            </button>

            <button
              onClick={() => toggleAllProductionBuildingsExceptPower(true)}
              className="px-4 py-2 bg-red-700 hover:bg-red-600 text-white rounded transition-colors"
              title="Отключает все здания с production, кроме источников энергии (production.energy) и конденсаторов (productionMultipliers.energy)"
            >
              🧪 Отключить производство
            </button>
            <button
              onClick={() => toggleAllProductionBuildingsExceptPower(false)}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
              title="Включает обратно отключенные чит-кнопкой производственные здания"
            >
              🧪 Включить производство
            </button>

            <button
              onClick={() => {
                useGameStore.setState((state: any) => ({
                  ...state,
                  debug: {
                    ...(state.debug || {}),
                    traceFlows: !traceFlows,
                  },
                }));
              }}
              className={`px-4 py-2 ${traceFlows ? 'bg-emerald-700 hover:bg-emerald-600' : 'bg-gray-800 hover:bg-gray-700'} text-white rounded transition-colors`}
              title="Собирает диагностику: расход энергии по категориям + агрегаты логистических переносов (base→тайлы и т.п.)"
            >
              🧭 Трассировка потоков: {traceFlows ? 'ON' : 'OFF'}
            </button>

            <button
              onClick={() => {
                console.log('🧭 lastFlow', lastFlow);
                if (lastFlow?.energy) {
                  console.group('🧭 Energy');
                  console.log('start → end', lastFlow.energy.start, '→', lastFlow.energy.end);
                  console.log('producedTick', lastFlow.energy.producedTick, 'consumedTick', lastFlow.energy.consumedTick);
                  console.table(lastFlow.energy.drains);
                  console.log('waveActive', lastFlow.energy.waveActive, 'enemies', lastFlow.energy.enemies);
                  console.log('demonsActive', lastFlow.energy.demonsActive);
                  console.groupEnd();
                }
                if (lastFlow?.transports) {
                  console.group('🧭 Transports');
                  console.log('count', lastFlow.transports.count);
                  console.table(lastFlow.transports.fromBaseByResource);
                  console.table(lastFlow.transports.totalByResource);
                  console.table(lastFlow.transports.topDestinations);
                  console.groupEnd();
                }
              }}
              className="px-4 py-2 bg-indigo-700 hover:bg-indigo-600 text-white rounded transition-colors"
              title="Печатает диагностику последнего тика в консоль"
            >
              🧭 Показать последний тик
            </button>
          </div>
          <div className="mt-2 text-xs text-gray-400">
            Для теста накопления энергии: отключает все производственные здания, кроме электростанций и конденсаторов.
          </div>
        </div>

        {/* Валюты */}
        <div className="mb-6 border border-cyan-700 rounded-lg p-4 bg-gray-800/50">
          <h3 className="text-lg font-semibold text-cyan-300 mb-3">💰 Валюты</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
            <button
              onClick={() => {
                const amount = parseFloat(currencyAmount);
                if (!isNaN(amount) && amount > 0) addCredits(amount);
              }}
              className="px-4 py-2 bg-green-700 hover:bg-green-600 text-white rounded transition-colors"
            >
              💵 Кредиты
            </button>
            <button
              onClick={() => {
                const amount = parseFloat(currencyAmount);
                if (!isNaN(amount) && amount > 0) addResearchPoints(amount);
              }}
              className="px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded transition-colors"
            >
              🔬 Исследования
            </button>
            <button
              onClick={() => {
                const amount = parseFloat(currencyAmount);
                if (!isNaN(amount) && amount > 0) addInfluence(amount);
              }}
              className="px-4 py-2 bg-purple-700 hover:bg-purple-600 text-white rounded transition-colors"
            >
              ⭐ Влияние
            </button>
          </div>
          <input
            type="number"
            value={currencyAmount}
            onChange={(e) => setCurrencyAmount(e.target.value)}
            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white text-sm"
            placeholder="Количество валюты"
          />
          <div className="flex flex-wrap gap-2 mt-2">
            {[1000, 10000, 100000, 1000000].map((preset) => (
              <button
                key={preset}
                onClick={() => setCurrencyAmount(preset.toString())}
                className={`px-2 py-1 rounded text-xs transition-colors ${
                  currencyAmount === preset.toString()
                    ? 'bg-cyan-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {preset >= 1000000 ? `${preset / 1000000}M` : preset >= 1000 ? `${preset / 1000}K` : preset}
              </button>
            ))}
          </div>
        </div>

        {/* Карты */}
        <div className="mb-6 border border-cyan-700 rounded-lg p-4 bg-gray-800/50">
          <h3 className="text-lg font-semibold text-cyan-300 mb-3">🗺️ Карты (Фаза 4)</h3>
          <div className="mb-3 text-sm text-gray-400">
            Текущая карта: <span className="text-cyan-400">{maps?.currentMapId ?? 'не выбрана'}</span>
          </div>
          <div className="flex flex-wrap gap-2 mb-3">
            <button
              onClick={unlockAllMaps}
              className="px-3 py-1.5 bg-purple-700 hover:bg-purple-600 text-white rounded text-sm transition-colors"
            >
              🔓 Разблокировать все карты
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {MAP_DEFINITIONS.map((map) => {
              const isUnlocked = maps?.unlockedMaps?.includes(map.id as MapId);
              const isCurrent = maps?.currentMapId === map.id;
              return (
                <button
                  key={map.id}
                  onClick={() => forceStartMap(map.id as MapId)}
                  className={`p-2 rounded text-left text-xs transition-colors border ${
                    isCurrent
                      ? 'bg-cyan-600 border-cyan-400 text-white'
                      : isUnlocked
                      ? 'bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'
                  }`}
                  title={`${map.name}\n${map.description}\nРазмер: ${map.gridDimensions.width}×${map.gridDimensions.height}\nСетка: ${map.gridType}\nСложность: ${map.difficulty}`}
                >
                  <div className="flex items-center gap-1">
                    <span className="text-lg">{map.emoji}</span>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{map.name}</div>
                      <div className="text-[10px] text-gray-400">
                        {map.gridDimensions.width}×{map.gridDimensions.height} • {map.difficulty}
                      </div>
                    </div>
                  </div>
                  {!isUnlocked && <span className="text-[10px] text-yellow-500">🔒</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Выбор ресурса */}
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-cyan-300 mb-2">📦 Выбор ресурса</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(resourceCategories).map(([category, resources]) => (
              <div key={category} className="border border-gray-700 rounded p-3">
                <h4 className="text-sm font-semibold text-gray-400 mb-2">{category}</h4>
                <div className="space-y-1">
                  {resources.map((resource) => (
                    <button
                      key={resource}
                      onClick={() => setSelectedResource(resource)}
                      className={`w-full text-left px-2 py-1 rounded text-sm transition-colors ${
                        selectedResource === resource
                          ? 'bg-cyan-600 text-white'
                          : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      {resourceNames[resource]}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Выбор количества */}
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-cyan-300 mb-2">🔢 Количество</h3>
          <div className="flex flex-wrap gap-2 mb-3">
            {presetAmounts.map((preset) => (
              <button
                key={preset}
                onClick={() => setAmount(preset.toString())}
                className={`px-3 py-1 rounded text-sm transition-colors ${
                  amount === preset.toString()
                    ? 'bg-cyan-600 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {preset >= 1000000 ? `${preset / 1000000}M` : preset >= 1000 ? `${preset / 1000}K` : preset}
              </button>
            ))}
          </div>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white"
            placeholder="Введите количество"
          />
        </div>

        {/* Кнопка выдачи */}
        <div className="flex gap-3">
          <button
            onClick={handleGiveResource}
            className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-500 text-white font-semibold rounded transition-colors"
          >
            ✅ Выдать {resourceNames[selectedResource]} ({amount})
          </button>
          <button
            onClick={onClose}
            className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
          >
            Закрыть
          </button>
        </div>

        {/* Подсказка */}
        <div className="mt-4 text-xs text-gray-500 border-t border-gray-800 pt-3">
          💡 Совет: Используйте горячую клавишу <kbd className="px-2 py-1 bg-gray-800 rounded">Ctrl+K</kbd> для быстрого открытия панели
        </div>
      </div>
    </Modal>
  );
};
