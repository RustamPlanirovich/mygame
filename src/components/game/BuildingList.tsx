import { useGameStore, calculateCost } from '../../features/gameStore';
import { formatNumber } from '../../core/math/format.ts';
import type { Building } from '../../core/gameTypes';
import { RESOURCE_LABEL } from '../../core/constants/labels';
import { getBuildingIcon } from '../../core/constants/buildingIcons';
import { Factory } from 'lucide-react';

function BuildingCard({ building }: { building: Building }) {
  const selectBuild = useGameStore(state => state.selectBuild);
  const selectedBuildId = useGameStore(state => state.grid.selectedBuildId);
  const resources = useGameStore(state => state.resources);
  const cost = calculateCost(building);

  const canAfford = Object.entries(cost).every(([res, amount]) => {
    const r = resources[res as keyof typeof resources];
    if (!r) return false;
    return r.amount.gte(amount);
  });

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

  const combatText = building.combat
    ? `${formatNumber(building.combat.dps)} урон/с · ${formatNumber(building.combat.energyPerSecond)} ⚡/с (только при стрельбе)`
    : '';

  const defenseText = building.defense
    ? `${formatNumber(building.defense.shieldMaxHp)} щита · +${formatNumber(building.defense.shieldRegenPerSecond)} щита/с · ${formatNumber(building.defense.energyPerSecond)} ⚡/с (во время волны)`
    : '';

  const isSelected = selectedBuildId === building.id;
  const Icon = getBuildingIcon(building.id);

  return (
    <div className={`cyber-panel mb-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 hover:border-cyber-blue transition-colors ${isSelected ? 'border-cyber-green' : ''}`}>
      <div>
        <h3 className="text-cyber-blue font-bold text-lg flex items-center gap-2">
          <Icon size={18} className="text-cyber-blue" />
          <span>{building.name}</span>
          <span className="text-gray-500 text-sm">Ур. {building.count}</span>
        </h3>
        <p className="text-gray-400 text-sm mb-2">{building.description}</p>
        <div className="text-xs text-gray-500">
          Производство: {prodText || '—'}
        </div>
        {consText ? (
          <div className="text-xs text-gray-600 mt-1">
            Потребление: {consText}
          </div>
        ) : null}
        {combatText ? (
          <div className="text-xs text-gray-600 mt-1">
            Бой: {combatText}
          </div>
        ) : null}
        {defenseText ? (
          <div className="text-xs text-gray-600 mt-1">
            Защита: {defenseText}
          </div>
        ) : null}
      </div>
      
      <button 
        onClick={() => selectBuild(isSelected ? null : building.id)}
        disabled={!canAfford && !isSelected}
        className="cyber-button text-sm py-2 px-4 w-full sm:w-auto sm:min-w-[160px]"
      >
        <div className="flex items-center justify-center gap-2">
          <Icon size={16} className="text-cyber-green" />
          <span>{isSelected ? 'ВЫБРАНО' : 'ВЫБРАТЬ'}</span>
        </div>
        <div className="text-xs mt-1">
          {costText || '—'}
        </div>
      </button>
    </div>
  );
}

export function BuildingList() {
  const buildings = useGameStore(state => state.buildings);

  return (
    <div className="p-4 border-b border-cyber-gray">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-xl text-cyber-green uppercase tracking-wider flex items-center gap-2">
          <Factory size={18} className="text-cyber-green" />
          <span>Инфраструктура</span>
        </h2>
        <div className="text-xs text-gray-500">выбор зданий</div>
      </div>
      <div className="space-y-2">
        {buildings.map(b => (
          <BuildingCard key={b.id} building={b} />
        ))}
      </div>
    </div>
  );
}
