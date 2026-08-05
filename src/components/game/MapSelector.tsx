/**
 * Компонент выбора карты (Фаза 4)
 */

import { useMemo, useState } from 'react';
import { Map, Lock, Star, Zap } from 'lucide-react';
import { Modal, EmptyState } from '../ui';
import { MAP_DEFINITIONS, getUnlockedMaps, getMapDefinition } from '../../core/constants/maps';
import type { MapDefinition, MapDifficulty, MapSize, GridType } from '../../core/gameTypes.maps';
import { DIFFICULTY_MULTIPLIERS } from '../../core/gameTypes.maps';
import { GameIcon, IconText } from '../ui/icons';

interface MapSelectorProps {
  unlockedTechnologies: Set<string>;
  ascensionLevel: number;
  playtimeHours: number;
  currentMapId?: string;
  onSelectMap: (mapId: string) => void;
  onClose: () => void;
}

// Цвета сложности
const DIFFICULTY_COLORS: Record<MapDifficulty, string> = {
  easy: 'text-green-400 border-green-400/30 bg-green-400/10',
  normal: 'text-blue-400 border-blue-400/30 bg-blue-400/10',
  hard: 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10',
  extreme: 'text-orange-400 border-orange-400/30 bg-orange-400/10',
  nightmare: 'text-red-400 border-red-400/30 bg-red-400/10',
};

// Названия сложности
const DIFFICULTY_NAMES: Record<MapDifficulty, string> = {
  easy: 'Легко',
  normal: 'Нормально',
  hard: 'Сложно',
  extreme: 'Экстрим',
  nightmare: 'Кошмар',
};

// Названия размеров
const SIZE_NAMES: Record<MapSize, string> = {
  tiny: 'Крошечная',
  small: 'Маленькая',
  medium: 'Средняя',
  large: 'Большая',
  huge: 'Огромная',
};

// Иконки типа сетки
const GRID_TYPE_INFO: Record<GridType, { name: string; icon: string }> = {
  square: { name: 'Квадратная', icon: '⬜' },
  hex: { name: 'Гексагональная', icon: '⬡' },
};

export function MapSelector({
  unlockedTechnologies,
  ascensionLevel,
  playtimeHours,
  currentMapId,
  onSelectMap,
  onClose,
}: MapSelectorProps) {
  const [selectedMapId, setSelectedMapId] = useState<string | null>(currentMapId ?? null);
  const [filter, setFilter] = useState<'all' | 'unlocked' | 'locked'>('all');

  // Получаем разблокированные карты
  const unlockedMaps = useMemo(() => {
    return getUnlockedMaps(unlockedTechnologies, ascensionLevel, playtimeHours);
  }, [unlockedTechnologies, ascensionLevel, playtimeHours]);

  const unlockedMapIds = useMemo(() => new Set(unlockedMaps.map(m => m.id)), [unlockedMaps]);

  // Фильтрация карт
  const filteredMaps = useMemo(() => {
    if (filter === 'unlocked') return unlockedMaps;
    if (filter === 'locked') return MAP_DEFINITIONS.filter(m => !unlockedMapIds.has(m.id));
    return MAP_DEFINITIONS;
  }, [filter, unlockedMaps, unlockedMapIds]);

  // Выбранная карта для предпросмотра
  const selectedMap = selectedMapId ? getMapDefinition(selectedMapId) : null;

  const handleConfirm = () => {
    if (selectedMapId && unlockedMapIds.has(selectedMapId)) {
      onSelectMap(selectedMapId);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Выбор карты"
      icon={<Map size={18} />}
      size="xl"
      footer={
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded bg-cyber-gray/20 text-cyber-text-dim hover:bg-cyber-gray/30 transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedMapId || !unlockedMapIds.has(selectedMapId!)}
            className={`px-4 py-2 rounded font-medium transition-colors ${
              selectedMapId && unlockedMapIds.has(selectedMapId)
                ? 'bg-cyber-blue text-white hover:bg-cyber-blue/80'
                : 'bg-cyber-gray/30 text-cyber-text-dim cursor-not-allowed'
            }`}
          >
            {selectedMapId === currentMapId ? 'Перезапустить' : 'Начать игру'}
          </button>
        </div>
      }
    >
      <div className="flex h-full min-h-0 flex-col">
        {/* Фильтры */}
        <div className="flex shrink-0 gap-2 p-4 border-b border-cyber-gray/20">
          {(['all', 'unlocked', 'locked'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                filter === f
                  ? 'bg-cyber-blue text-white'
                  : 'bg-cyber-gray/20 text-cyber-text-dim hover:bg-cyber-gray/30'
              }`}
            >
              {f === 'all' ? 'Все' : f === 'unlocked' ? 'Доступные' : 'Заблокированные'}
            </button>
          ))}
          <span className="ml-auto text-cyber-text-dim text-sm">
            Доступно: {unlockedMaps.length} / {MAP_DEFINITIONS.length}
          </span>
        </div>

        {/* Основной контент */}
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* Список карт */}
          <div className="w-1/2 overflow-y-auto p-4 border-r border-cyber-gray/20">
            <div className="grid gap-2">
              {filteredMaps.map(map => {
                const isUnlocked = unlockedMapIds.has(map.id);
                const isSelected = selectedMapId === map.id;
                const isCurrent = currentMapId === map.id;

                return (
                  <button
                    key={map.id}
                    onClick={() => setSelectedMapId(map.id)}
                    className={`p-3 rounded-lg text-left transition-all ${
                      isSelected
                        ? 'bg-cyber-blue/20 border border-cyber-blue'
                        : isUnlocked
                        ? 'bg-cyber-gray/10 border border-cyber-gray/30 hover:border-cyber-blue/50'
                        : 'bg-cyber-gray/5 border border-cyber-gray/20 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl"><GameIcon icon={map.emoji} /></span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${isUnlocked ? 'text-cyber-text' : 'text-cyber-text-dim'}`}>
                            {map.name}
                          </span>
                          {!isUnlocked && <Lock size={14} className="text-cyber-text-dim" />}
                          {isCurrent && (
                            <span className="px-1.5 py-0.5 rounded text-xs bg-cyber-green/20 text-cyber-green">
                              Текущая
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-xs px-1.5 py-0.5 rounded border ${DIFFICULTY_COLORS[map.difficulty]}`}>
                            {DIFFICULTY_NAMES[map.difficulty]}
                          </span>
                          <span className="text-xs text-cyber-text-dim">
                            {SIZE_NAMES[map.size]}
                          </span>
                          <span className="text-xs text-cyber-text-dim">
                            <GameIcon icon={GRID_TYPE_INFO[map.gridType].icon} />
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Предпросмотр карты */}
          <div className="w-1/2 p-4 overflow-y-auto">
            {selectedMap ? (
              <MapPreview
                map={selectedMap}
                isUnlocked={unlockedMapIds.has(selectedMap.id)}
                isCurrent={currentMapId === selectedMap.id}
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <EmptyState icon={<Map size={22} />} title="Выберите карту для просмотра" />
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

// Компонент предпросмотра карты
function MapPreview({
  map,
  isUnlocked,
  isCurrent,
}: {
  map: MapDefinition;
  isUnlocked: boolean;
  isCurrent: boolean;
}) {
  const diffMult = DIFFICULTY_MULTIPLIERS[map.difficulty];

  return (
    <div className="space-y-4">
      {/* Заголовок */}
      <div className="flex items-center gap-3">
        <span className="text-4xl"><GameIcon icon={map.emoji} /></span>
        <div>
          <h3 className="text-xl font-bold text-cyber-text">{map.name}</h3>
          <p className="text-sm text-cyber-text-dim"><IconText>{map.description}</IconText></p>
        </div>
      </div>

      {/* Статус */}
      {!isUnlocked && (
        <div className="p-3 rounded bg-cyber-red/10 border border-cyber-red/30">
          <div className="flex items-center gap-2 text-cyber-red">
            <Lock size={16} />
            <span className="font-medium">Карта заблокирована</span>
          </div>
          <p className="text-sm text-cyber-text-dim mt-1">
            {getUnlockRequirementText(map)}
          </p>
        </div>
      )}

      {isCurrent && (
        <div className="p-3 rounded bg-cyber-green/10 border border-cyber-green/30">
          <div className="flex items-center gap-2 text-cyber-green">
            <Star size={16} />
            <span className="font-medium">Текущая карта</span>
          </div>
        </div>
      )}

      {/* Характеристики */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded bg-cyber-gray/10">
          <div className="text-xs text-cyber-text-dim mb-1">Размер</div>
          <div className="font-medium text-cyber-text">
            {SIZE_NAMES[map.size]} ({map.gridDimensions.width}×{map.gridDimensions.height})
          </div>
        </div>
        <div className="p-3 rounded bg-cyber-gray/10">
          <div className="text-xs text-cyber-text-dim mb-1">Тип сетки</div>
          <div className="font-medium text-cyber-text">
            <GameIcon icon={GRID_TYPE_INFO[map.gridType].icon} /> {GRID_TYPE_INFO[map.gridType].name}
          </div>
        </div>
        <div className="p-3 rounded bg-cyber-gray/10">
          <div className="text-xs text-cyber-text-dim mb-1">Сложность</div>
          <div className={`font-medium ${DIFFICULTY_COLORS[map.difficulty].split(' ')[0]}`}>
            {DIFFICULTY_NAMES[map.difficulty]}
          </div>
        </div>
        <div className="p-3 rounded bg-cyber-gray/10">
          <div className="text-xs text-cyber-text-dim mb-1">Награда</div>
          <div className="font-medium text-cyber-yellow">
            ×{diffMult.rewardMultiplier}
          </div>
        </div>
      </div>

      {/* Стартовые ресурсы */}
      <div className="p-3 rounded bg-cyber-gray/10">
        <div className="text-xs text-cyber-text-dim mb-2">Стартовые ресурсы</div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(map.startingResources).map(([resource, amount]) => (
            <span
              key={resource}
              className="px-2 py-1 rounded bg-cyber-blue/20 text-cyber-blue text-sm"
            >
              {resource}: {amount}
            </span>
          ))}
          <span className="px-2 py-1 rounded bg-cyber-yellow/20 text-cyber-yellow text-sm">
            <GameIcon icon="💰" /> {map.startingCredits}
          </span>
        </div>
      </div>

      {/* Доступные депозиты */}
      <div className="p-3 rounded bg-cyber-gray/10">
        <div className="text-xs text-cyber-text-dim mb-2">Доступные ресурсы</div>
        <div className="flex flex-wrap gap-1">
          {map.availableDeposits.map(deposit => (
            <span
              key={deposit}
              className="px-2 py-0.5 rounded bg-cyber-gray/30 text-cyber-text-dim text-xs"
            >
              {deposit}
            </span>
          ))}
        </div>
      </div>

      {/* Модификаторы */}
      {map.modifiers.length > 0 && (
        <div className="p-3 rounded bg-cyber-gray/10">
          <div className="text-xs text-cyber-text-dim mb-2">Особенности</div>
          <div className="space-y-1">
            {map.modifiers.map(mod => (
              <div key={mod} className="flex items-center gap-2 text-sm">
                <span className="text-cyber-yellow">•</span>
                <span className="text-cyber-text">{getModifierName(mod)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Бонусы */}
      {map.bonuses && map.bonuses.length > 0 && (
        <div className="p-3 rounded bg-cyber-green/10 border border-cyber-green/30">
          <div className="text-xs text-cyber-green mb-2">Бонусы карты</div>
          <div className="space-y-1">
            {map.bonuses.map((bonus, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <Zap size={12} className="text-cyber-green" />
                <span className="text-cyber-text"><IconText>{bonus.description}</IconText></span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Спецсобытия */}
      {map.specialEvents && map.specialEvents.length > 0 && (
        <div className="p-3 rounded bg-cyber-orange/10 border border-cyber-orange/30">
          <div className="text-xs text-cyber-orange mb-2"><GameIcon icon="⚠️" /> Случайные события</div>
          <div className="space-y-1">
            {map.specialEvents.map(event => (
              <div key={event.id} className="text-sm text-cyber-text-dim">
                • {event.name}: {event.description}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Вспомогательные функции
function getUnlockRequirementText(map: MapDefinition): string {
  const req = map.unlockRequirement;
  switch (req.type) {
    case 'technology':
      return `Требуется технология: ${req.technologyId}`;
    case 'ascension':
      return `Требуется Вознесение уровня ${req.ascensionLevel}`;
    case 'playtime':
      return `Требуется ${req.playtimeHours} часов игры`;
    default:
      return 'Доступна с начала игры';
  }
}

function getModifierName(modifier: string): string {
  const names: Record<string, string> = {
    rich_deposits: '+50% ресурсов в депозитах',
    poor_deposits: '-30% ресурсов в депозитах',
    hostile: 'Усиленные враги',
    peaceful: 'Нет атак врагов',
    toxic: 'Токсичная атмосфера (урон зданиям)',
    radioactive: 'Радиоактивная зона',
    frozen: '+50% потребление энергии',
    volcanic: 'Вулканическая активность',
    asteroid_field: 'Карта разделена на острова',
    trade_hub: '+20% к торговле',
    isolated: 'Торговля недоступна',
    ancient_ruins: 'Можно найти артефакты',
  };
  return names[modifier] || modifier;
}
