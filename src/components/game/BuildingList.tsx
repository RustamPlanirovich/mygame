import { useGameStore, calculateCost } from '../../features/gameStore';
import { formatNumber } from '../../core/math/format.ts';
import type { Building, ResourceType } from '../../core/gameTypes';
import { RESOURCE_LABEL } from '../../core/constants/labels';
import { getBuildingIcon } from '../../core/constants/buildingIcons';
import { isBuildingUnlocked, getTechnologyForBuilding } from '../../core/constants/technologies';
import { X, Lock, Search, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import { useMemo, useState, useEffect, useRef } from 'react';
import { ResourceProductionChain } from './ResourceProductionChain';

const requiredDepositForBuilding = (buildingId: string) => {
  if (buildingId === 'miner_mk1') return 'ore';
  if (buildingId === 'ice_extractor_mk1') return 'ice';
  if (buildingId === 'carbon_harvester_mk1') return 'carbon';
  // Фаза 2: Новые добывающие здания
  if (buildingId === 'gas_well_mk1') return 'natural_gas';
  if (buildingId === 'oil_well_mk1') return 'oil';
  if (buildingId === 'sand_quarry_mk1') return 'sand';
  // Фаза 2.3: Металлические шахты
  if (buildingId === 'uranium_mine_mk1') return 'uranium';
  if (buildingId === 'chrome_mine_mk1') return 'chrome';
  if (buildingId === 'titanium_mine_mk1') return 'titanium';
  // Фаза 2.4: Медная шахта
  if (buildingId === 'copper_mine_mk1') return 'copper';
  return null;
};

function buildTitle(building: Building) {
  const cost = calculateCost(building);

  const costText = Object.entries(cost)
    .map(([res, amt]) => `${formatNumber(amt)} ${res === 'energy' ? '⚡' : RESOURCE_LABEL[res as keyof typeof RESOURCE_LABEL]}`)
    .join(', ');

  const prodText = Object.entries(building.production)
    .map(([res, amt]) => `${formatNumber(amt)} ${RESOURCE_LABEL[res as keyof typeof RESOURCE_LABEL]}/с`)
    .join(', ');

  const consText = building.consumption
    ? Object.entries(building.consumption)
        .map(([res, amt]) => `${formatNumber(amt)} ${RESOURCE_LABEL[res as keyof typeof RESOURCE_LABEL]}/с`)
        .join(', ')
    : '';

  const req = requiredDepositForBuilding(building.id);
  const reqText = req
    ? `\nТребуется месторождение: ${req === 'ore' ? 'РУДА' : req === 'ice' ? 'ЛЁД' : 'УГЛЕРОД'}`
    : '';

  return `${building.name} (Ур. ${building.count})\nСтоимость: ${costText || '—'}\nПроизводство: ${prodText || '—'}${consText ? `\nПотребление: ${consText}` : ''}${reqText}`;
}

export function BuildingList() {
  const buildings = useGameStore((s) => s.buildings);
  // Read selectedBuildId from active platform or main base
  const selectedBuildId = useGameStore((s) => {
    const platformId = s.galaxies.activePlatformId;
    if (platformId) {
      const platform = s.galaxies.platforms.find(p => p.id === platformId);
      return platform?.grid.selectedBuildId ?? null;
    }
    return s.grid.selectedBuildId;
  });
  const highlightedBuildingId = useGameStore((s) => s.grid.highlightedBuildingId);
  const selectBuild = useGameStore((s) => s.selectBuild);
  const setHighlightedBuilding = useGameStore((s) => s.setHighlightedBuilding);
  // Get resources from active platform or main base
  const resources = useGameStore((s) => {
    const platformId = s.galaxies.activePlatformId;
    if (platformId) {
      const platform = s.galaxies.platforms.find(p => p.id === platformId);
      return platform?.resources || s.resources;
    }
    return s.resources;
  });
  const currency = useGameStore((s) => s.currency);
  const research = useGameStore((s) => s.research);
  // Get grid tiles from active platform or main base
  const gridTiles = useGameStore((s) => {
    const platformId = s.galaxies.activePlatformId;
    if (platformId) {
      const platform = s.galaxies.platforms.find(p => p.id === platformId);
      return platform?.grid.tiles || s.grid.tiles;
    }
    return s.grid.tiles;
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [showOnlyAffordable, setShowOnlyAffordable] = useState(false);
  const [showOnlyUnlocked, setShowOnlyUnlocked] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'cost' | 'level'>('name');
  const [expandedChains, setExpandedChains] = useState<Set<string>>(new Set());
  
  // Debounce для поискового запроса - оптимизация производительности
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  useEffect(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    
    debounceTimeoutRef.current = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 150); // 150ms debounce для быстрого отклика
    
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  // Подсчитываем количество зданий каждого типа на карте
  const buildingCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    Object.values(gridTiles).forEach((buildingId) => {
      counts[buildingId] = (counts[buildingId] || 0) + 1;
    });
    return counts;
  }, [gridTiles]);

  const affordability = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const b of buildings) {
      // Check if building is unlocked
      if (!isBuildingUnlocked(b.id, research.technologies)) {
        map[b.id] = false;
        continue;
      }
      
      // Check credit cost if specified
      if (b.creditCost) {
        const creditCostScaled = b.creditCost.mul(Math.pow(b.costFactor, b.count));
        if (currency.credits.lt(creditCostScaled)) {
          map[b.id] = false;
          continue;
        }
      }
      
      // Check resource cost
      const cost = calculateCost(b);
      map[b.id] = Object.entries(cost).every(([res, amount]) => {
        const r = resources[res as ResourceType];
        return Boolean(r) && r.amount.gte(amount);
      });
    }
    return map;
  }, [buildings, resources, currency, research.technologies]);

  // Фильтрация и сортировка (использует debouncedSearchQuery для производительности)
  const filteredBuildings = useMemo(() => {
    let filtered = buildings;

    // Поиск по названию или по производимым/потребляемым ресурсам
    if (debouncedSearchQuery) {
      const query = debouncedSearchQuery.toLowerCase();
      filtered = filtered.filter(b => {
        // Поиск по названию здания
        if (b.name.toLowerCase().includes(query)) {
          return true;
        }

        // Поиск по производимым ресурсам
        if (b.production) {
          for (const res of Object.keys(b.production)) {
            const resLabel = RESOURCE_LABEL[res as ResourceType]?.toLowerCase() || res.toLowerCase();
            if (resLabel.includes(query) || res.toLowerCase().includes(query)) {
              return true;
            }
          }
        }

        // Поиск по потребляемым ресурсам
        if (b.consumption) {
          for (const res of Object.keys(b.consumption)) {
            const resLabel = RESOURCE_LABEL[res as ResourceType]?.toLowerCase() || res.toLowerCase();
            if (resLabel.includes(query) || res.toLowerCase().includes(query)) {
              return true;
            }
          }
        }

        // Поиск по стоимости строительства
        if (b.baseCost) {
          for (const res of Object.keys(b.baseCost)) {
            const resLabel = RESOURCE_LABEL[res as ResourceType]?.toLowerCase() || res.toLowerCase();
            if (resLabel.includes(query) || res.toLowerCase().includes(query)) {
              return true;
            }
          }
        }

        return false;
      });
    }

    // Фильтр: только доступные
    if (showOnlyAffordable) {
      filtered = filtered.filter(b => affordability[b.id]);
    }

    // Фильтр: только разблокированные
    if (showOnlyUnlocked) {
      filtered = filtered.filter(b => 
        isBuildingUnlocked(b.id, research.technologies)
      );
    }

    // Сортировка
    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      } else if (sortBy === 'level') {
        return b.count - a.count;
      } else if (sortBy === 'cost') {
        const costA = a.creditCost?.toNumber() || 0;
        const costB = b.creditCost?.toNumber() || 0;
        return costA - costB;
      }
      return 0;
    });

    return sorted;
  }, [buildings, debouncedSearchQuery, showOnlyAffordable, showOnlyUnlocked, sortBy, affordability, research.technologies]);

  // Определяем, ищет ли пользователь конкретный ресурс (использует debouncedSearchQuery)
  const searchedResource = useMemo<ResourceType | null>(() => {
    if (!debouncedSearchQuery) return null;

    const query = debouncedSearchQuery.toLowerCase();
    
    // Проверяем все ресурсы
    for (const [resKey, resLabel] of Object.entries(RESOURCE_LABEL)) {
      if (resLabel.toLowerCase().includes(query) || resKey.toLowerCase().includes(query)) {
        return resKey as ResourceType;
      }
    }

    return null;
  }, [debouncedSearchQuery]);

  const toggleChainExpansion = (buildingId: string) => {
    const newExpanded = new Set(expandedChains);
    if (newExpanded.has(buildingId)) {
      newExpanded.delete(buildingId);
    } else {
      newExpanded.add(buildingId);
    }
    setExpandedChains(newExpanded);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Фильтры и поиск */}
      <div className="shrink-0 p-3 space-y-2 border-b border-cyber-gray bg-cyber-dark/50">
        {/* Поиск */}
        <div className="relative">
          <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-cyber-text-dim" />
          <input
            type="text"
            placeholder="Поиск зданий или ресурсов..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-cyber-black border border-cyber-gray rounded pl-8 pr-3 py-1.5 text-xs text-cyber-text placeholder-cyber-text-dim focus:outline-none focus:border-cyber-green"
          />
        </div>

        {/* Фильтры */}
        <div className="flex items-center gap-2 text-xs">
          <Filter size={12} className="text-cyber-text-dim" />
          <label className="flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={showOnlyAffordable}
              onChange={(e) => setShowOnlyAffordable(e.target.checked)}
              className="w-3 h-3"
            />
            <span className="text-cyber-text-dim">Доступные</span>
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={showOnlyUnlocked}
              onChange={(e) => setShowOnlyUnlocked(e.target.checked)}
              className="w-3 h-3"
            />
            <span className="text-cyber-text-dim">Разблокированные</span>
          </label>
        </div>

        {/* Сортировка */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-cyber-text-dim">Сортировка:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="flex-1 bg-cyber-black border border-cyber-gray rounded px-2 py-1 text-xs text-cyber-text"
          >
            <option value="name">По названию</option>
            <option value="level">По уровню</option>
            <option value="cost">По стоимости</option>
          </select>
        </div>

        {/* Счетчик */}
        <div className="text-[10px] text-cyber-text-dim text-center">
          Показано: {filteredBuildings.length} из {buildings.length}
        </div>
      </div>

      {/* Список зданий */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="space-y-2">
          {/* Показываем производственную цепочку для искомого ресурса с debounce */}
          {searchedResource && (
            <div className="mb-3 p-3 bg-cyber-blue/5 border border-cyber-blue/30 rounded">
              <div className="text-xs font-medium text-cyber-blue mb-2">
                📊 Ищете: {RESOURCE_LABEL[searchedResource]}
              </div>
              <ResourceProductionChain 
                resource={searchedResource} 
                buildings={buildings}
                useDebounce={true}
                debounceDelay={300}
              />
            </div>
          )}

          {filteredBuildings.map((b) => {
          const Icon = getBuildingIcon(b.id);
          const isSelected = selectedBuildId === b.id;
          const isHighlighted = highlightedBuildingId === b.id;
          const isUnlocked = isBuildingUnlocked(b.id, research.technologies);
          const canAfford = affordability[b.id];
          const cost = calculateCost(b);
          const req = requiredDepositForBuilding(b.id);
          const requiredTech = !isUnlocked ? getTechnologyForBuilding(b.id) : null;
          const placedCount = buildingCounts[b.id] || 0;

          const handleClick = () => {
            if (!isUnlocked) return;
            
            // Переключаем режим строительства
            selectBuild(isSelected ? null : b.id);
            
            // Устанавливаем подсветку для этого типа зданий
            setHighlightedBuilding(isHighlighted ? null : b.id);
          };

          const handleMouseEnter = () => {
            if (!isUnlocked) return;
            // При наведении подсвечиваем здания этого типа на карте
            setHighlightedBuilding(b.id);
          };

          const handleMouseLeave = () => {
            // Убираем подсветку только если здание не выбрано
            if (selectedBuildId !== b.id) {
              setHighlightedBuilding(null);
            }
          };

          return (
            <button
              key={b.id}
              type="button"
              title={buildTitle(b)}
              onClick={handleClick}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
              className={
                `w-full flex flex-col gap-1.5 p-2.5 rounded transition-all border ` +
                (!isUnlocked
                  ? 'bg-cyber-gray/5 border-cyber-gray/20 opacity-40 cursor-not-allowed text-cyber-text-dim'
                  : isSelected 
                    ? 'bg-cyber-green/10 border-cyber-green text-cyber-green' 
                    : isHighlighted
                      ? 'bg-cyber-yellow/10 border-cyber-yellow text-cyber-yellow'
                      : canAfford 
                        ? 'bg-cyber-gray/20 border-cyber-gray/50 hover:bg-cyber-gray/30 text-cyber-text' 
                        : 'bg-cyber-gray/10 border-cyber-gray/30 opacity-50 cursor-not-allowed text-cyber-text-dim')
              }
              disabled={!isUnlocked || (!canAfford && !isSelected)}
            >
              <div className="flex items-center gap-2 w-full">
                {!isUnlocked ? (
                  <Lock size={18} className="text-cyber-gray" />
                ) : (
                  <Icon size={18} className={isSelected ? 'text-cyber-green' : isHighlighted ? 'text-cyber-yellow' : 'text-cyber-blue'} />
                )}
                <div className="flex-1 text-left">
                  <div className="text-xs font-medium">{b.name}</div>
                  <div className="text-[10px] text-cyber-text-dim">
                    {!isUnlocked && requiredTech ? `🔒 ${requiredTech.name}` : `Уровень ${b.count}`}
                  </div>
                  {/* Отображаем количество построенных зданий */}
                  {isUnlocked && placedCount > 0 && (
                    <div className="text-[10px] text-cyber-blue mt-0.5">
                      📍 Построено: {placedCount}
                    </div>
                  )}
                </div>
                {isSelected && (
                  <X size={14} className="text-cyber-green" />
                )}
              </div>
              
              {!isUnlocked && requiredTech && (
                <div className="text-[10px] text-cyber-red italic">
                  Требуется технология: {requiredTech.name} ({formatNumber(requiredTech.cost)} RP)
                </div>
              )}
              
              {isUnlocked && (
                <>
                  {/* Стоимость в кредитах */}
                  {b.creditCost && (
                <div className="flex gap-1.5 text-[10px]">
                  <span className="text-cyber-text-dim">Цена:</span>
                  <span className={currency.credits.gte(b.creditCost.mul(Math.pow(b.costFactor, b.count))) ? 'text-cyber-yellow' : 'text-red-400'}>
                    💰 {formatNumber(b.creditCost.mul(Math.pow(b.costFactor, b.count)))}
                  </span>
                </div>
              )}

              {/* Стоимость в ресурсах */}
              {Object.keys(cost).length > 0 && (
                <div className="flex flex-wrap gap-1.5 text-[10px]">
                  <span className="text-cyber-text-dim">Ресурсы:</span>
                  {Object.entries(cost).map(([res, amt]) => {
                    const r = resources[res as ResourceType];
                    const hasEnough = r && r.amount.gte(amt);
                    
                    return (
                      <span 
                        key={res} 
                        className={hasEnough ? 'text-cyber-green' : 'text-red-400'}
                      >
                        {formatNumber(amt)} {res === 'energy' ? '⚡' : RESOURCE_LABEL[res as keyof typeof RESOURCE_LABEL]}
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Производство */}
              {Object.keys(b.production).length > 0 && (
                <div className="space-y-1">
                  <div className="flex flex-wrap gap-1.5 text-[10px] items-center">
                    <span className="text-cyber-text-dim">+</span>
                    {Object.entries(b.production).map(([res, amt]) => (
                      <span key={res} className="text-cyber-blue">
                        {formatNumber(amt)} {RESOURCE_LABEL[res as keyof typeof RESOURCE_LABEL]}/с
                      </span>
                    ))}
                    
                    {/* Кнопка показать цепочку */}
                    {Object.keys(b.production).length > 0 && (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleChainExpansion(b.id);
                        }}
                        className="ml-auto flex items-center gap-0.5 text-[9px] text-cyber-blue hover:text-cyber-green transition-colors cursor-pointer"
                      >
                        {expandedChains.has(b.id) ? (
                          <>
                            <ChevronUp size={10} />
                            <span>Скрыть цепочку</span>
                          </>
                        ) : (
                          <>
                            <ChevronDown size={10} />
                            <span>Показать цепочку</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Производственная цепочка */}
                  {expandedChains.has(b.id) && Object.keys(b.production).map((res) => (
                    <ResourceProductionChain
                      key={res}
                      resource={res as ResourceType}
                      buildings={buildings}
                    />
                  ))}
                </div>
              )}

              {/* Потребление */}
              {b.consumption && Object.keys(b.consumption).length > 0 && (
                <div className="flex flex-wrap gap-1.5 text-[10px]">
                  <span className="text-cyber-text-dim">−</span>
                  {Object.entries(b.consumption).map(([res, amt]) => (
                    <span key={res} className="text-orange-400">
                      {formatNumber(amt)} {RESOURCE_LABEL[res as keyof typeof RESOURCE_LABEL]}/с
                    </span>
                  ))}
                </div>
              )}

              {/* Требование месторождения */}
              {req && (
                <div className="text-[10px] text-cyber-text-dim italic">
                  Требует: {req === 'ore' ? '🪨 Руда' : req === 'ice' ? '🧊 Лёд' : '⚫ Углерод'}
                </div>
              )}
                </>
              )}
            </button>
          );
        })}
      </div>

      {filteredBuildings.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="text-4xl mb-2">🔍</div>
          <p className="text-cyber-text-dim text-sm">
            Ничего не найдено
          </p>
        </div>
      )}
    </div>
    </div>
  );
}
