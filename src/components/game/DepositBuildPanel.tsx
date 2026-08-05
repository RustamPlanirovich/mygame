import { useMemo, useState } from 'react';
import { useGameStore, calculateCost } from '../../features/gameStore';
import { formatNumber } from '../../core/math/format.ts';
import { RESOURCE_LABEL } from '../../core/constants/labels';
import { getBuildingIcon } from '../../core/constants/buildingIcons';
import type { ResourceType, DepositType } from '../../core/gameTypes';
import { Search, ChevronDown, ChevronUp } from 'lucide-react';
import { GameIcon, IconText } from '../ui/icons';

const requiredDepositForBuilding = (buildingId: string): DepositType | null => {
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

const getDepositLabel = (deposit: DepositType) => {
  switch (deposit) {
    case 'ore': return 'РУДА';
    case 'ice': return 'ЛЁД';
    case 'carbon': return 'УГЛЕРОД';
    case 'natural_gas': return 'ПРИРОДНЫЙ ГАЗ';
    case 'oil': return 'НЕФТЬ';
    case 'sand': return 'ПЕСОК';
    case 'uranium': return 'УРАН';
    case 'chrome': return 'ХРОМ';
    case 'titanium': return 'ТИТАН';
    case 'copper': return 'МЕДЬ';
  }
};

export function DepositBuildPanel({ deposit }: { deposit: DepositType }) {
  const buildings = useGameStore((s) => s.buildings);
  // Get resources from active platform or main base
  const resources = useGameStore((s) => {
    const platformId = s.galaxies.activePlatformId;
    if (platformId) {
      const platform = s.galaxies.platforms.find(p => p.id === platformId);
      return platform?.resources || s.resources;
    }
    return s.resources;
  });
  
  // Get selectedBuildId from either platform or main grid
  const selectedBuildId = useGameStore((s) => {
    const platformId = s.galaxies.activePlatformId;
    if (platformId) {
      const platform = s.galaxies.platforms.find(p => p.id === platformId);
      return platform?.grid.selectedBuildId || null;
    }
    return s.grid.selectedBuildId;
  });
  
  const selectBuild = useGameStore((s) => s.selectBuild);
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnlyPositive, setShowOnlyPositive] = useState(true);

  // Кэшируем бонусы эффективности для каждого здания - считаем один раз при выборе депозита
  const buildingBonuses = useMemo(() => {
    const bonuses: Record<string, number> = {};
    buildings.forEach((b) => {
      const reqDeposit = requiredDepositForBuilding(b.id);
      if (reqDeposit && reqDeposit === deposit) {
        // Генерируем стабильный бонус на основе ID здания и типа депозита
        const seed = b.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) + deposit.charCodeAt(0);
        const random = (Math.sin(seed) * 10000) % 1;
        bonuses[b.id] = Math.floor(random * 20 + 10);
      }
    });
    return bonuses;
  }, [buildings, deposit]);

  // Фильтруем здания по месторождению и поисковому запросу
  const filteredBuildings = useMemo(() => {
    return buildings.filter((b) => {
      const reqDeposit = requiredDepositForBuilding(b.id);
      
      // Если требуется месторождение и оно совпадает, показываем как положительное
      if (reqDeposit && reqDeposit === deposit) {
        if (searchQuery && !b.name.toLowerCase().includes(searchQuery.toLowerCase())) {
          return false;
        }
        return true;
      }

      // Здания без требования к месторождению показываем если не включен фильтр
      if (!reqDeposit && !showOnlyPositive) {
        if (searchQuery && !b.name.toLowerCase().includes(searchQuery.toLowerCase())) {
          return false;
        }
        return true;
      }

      return false;
    });
  }, [buildings, deposit, searchQuery, showOnlyPositive]);

  // Проверяем доступность постройки
  const affordability = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const b of filteredBuildings) {
      const cost = calculateCost(b);
      map[b.id] = Object.entries(cost).every(([res, amount]) => {
        const r = resources[res as ResourceType];
        return Boolean(r) && r.amount.gte(amount);
      });
    }
    return map;
  }, [filteredBuildings, resources]);

  // Группируем здания: сначала с бонусом (положительные), потом остальные
  const positiveBuildings = filteredBuildings.filter((b) => requiredDepositForBuilding(b.id) === deposit);
  const neutralBuildings = filteredBuildings.filter((b) => !requiredDepositForBuilding(b.id));

  const displayBuildings = showOnlyPositive ? positiveBuildings : [...positiveBuildings, ...neutralBuildings];

  return (
    <div className="p-3">
      {/* Информация о месторождении */}
      <div className="mb-4 p-3 rounded bg-cyber-gray/10 border border-cyber-gray/30">
        <div className="text-xs text-cyber-text-dim mb-1">Месторождение:</div>
        <div className="text-base font-bold text-cyber-blue">{getDepositLabel(deposit)}</div>
        <div className="text-xs text-cyber-text-dim mt-2">
          На этой клетке можно построить специализированные здания с повышенной эффективностью
        </div>
        <div className="text-[10px] text-cyber-green mt-2 italic">
          <GameIcon icon="✅" /> Добытые ресурсы автоматически поступают на базу (склад)
        </div>
      </div>

      {/* Поиск */}
      <div className="mb-3">
        <div className="relative">
          <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-cyber-text-dim" />
          <input
            type="text"
            placeholder="Найти здание или ресурс"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-cyber-gray/20 border border-cyber-gray/50 rounded px-8 py-2 text-xs text-cyber-text placeholder:text-cyber-text-dim focus:outline-none focus:border-cyber-blue"
          />
        </div>
      </div>

      {/* Фильтр */}
      <button
        type="button"
        onClick={() => setShowOnlyPositive(!showOnlyPositive)}
        className="w-full flex items-start gap-2 p-2 mb-3 rounded border border-cyber-gray/50 bg-cyber-gray/10 hover:bg-cyber-gray/20 transition-colors text-left"
      >
        <div className="shrink-0 mt-0.5">
          {showOnlyPositive ? (
            <ChevronDown size={14} className="text-cyber-green" />
          ) : (
            <ChevronUp size={14} className="text-cyber-text-dim" />
          )}
        </div>
        <div className="flex-1">
          <div className="text-[10px] text-cyber-text-dim uppercase tracking-wide">
            <IconText>{showOnlyPositive ? '⚡ Показывать только положительные' : 'Показывать все здания'}</IconText>
          </div>
          <div className="text-xs text-cyber-text-dim mt-0.5">модификаторы плитки</div>
        </div>
      </button>

      {/* Список зданий */}
      <div className="space-y-1.5">
        {displayBuildings.length === 0 ? (
          <div className="text-center py-6 text-cyber-text-dim text-xs">
            {searchQuery ? 'Ничего не найдено' : 'Нет доступных зданий'}
          </div>
        ) : (
          displayBuildings.map((b) => {
            const Icon = getBuildingIcon(b.id);
            const isSelected = selectedBuildId === b.id;
            const canAfford = affordability[b.id];
            const hasBonus = requiredDepositForBuilding(b.id) === deposit;
            const cost = calculateCost(b);

            return (
              <div key={b.id} className="relative">
                <button
                  type="button"
                  onClick={() => selectBuild(isSelected ? null : b.id)}
                  className={
                    `w-full flex items-start gap-2 p-2 rounded transition-all border ` +
                    (isSelected
                      ? 'bg-cyber-green/10 border-cyber-green text-cyber-green'
                      : canAfford
                        ? 'bg-cyber-gray/20 border-cyber-gray/50 hover:bg-cyber-gray/30 text-cyber-text'
                        : 'bg-cyber-gray/10 border-cyber-gray/30 opacity-50 cursor-not-allowed text-cyber-text-dim')
                  }
                  disabled={!canAfford && !isSelected}
                >
                  {/* Иконка */}
                  <Icon size={16} className={isSelected ? 'text-cyber-green' : hasBonus ? 'text-cyber-blue' : 'text-cyber-text-dim'} />

                  {/* Контент */}
                  <div className="flex-1 text-left min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium truncate">{b.name}</span>
                      {hasBonus && (
                        <span className="text-[10px] font-bold text-cyber-green">+{buildingBonuses[b.id]}%</span>
                      )}
                    </div>
                    <div className="text-[10px] text-cyber-text-dim">Ур. {b.count}</div>
                    {/* Требования */}
                    {Object.entries(cost).length > 0 && (
                      <div className="text-[10px] text-cyber-text-dim mt-1 flex items-center gap-1 flex-wrap">
                        {Object.entries(cost).map(([res, amt]) => (
                          <span key={res} className="flex items-center gap-0.5">
                            <span><IconText>{res === 'energy' ? '⚡' : RESOURCE_LABEL[res as keyof typeof RESOURCE_LABEL]}</IconText></span>
                            <span>{formatNumber(amt)}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Стоимость справа */}
                  <div className="text-right shrink-0">
                    <div className="text-[11px] font-bold text-cyber-blue">
                      {formatNumber(cost.energy || 0)}
                    </div>
                    <div className="text-[9px] text-cyber-text-dim">
                      +{formatNumber(cost.steel || cost.ore || 0)}
                    </div>
                  </div>
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
