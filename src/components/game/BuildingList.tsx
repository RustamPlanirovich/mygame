import { useGameStore, calculateCost } from '../../features/gameStore';
import { formatNumber } from '../../core/math/format.ts';
import type { Building, ResourceType } from '../../core/gameTypes';
import { RESOURCE_LABEL } from '../../core/constants/labels';
import { getBuildingIcon } from '../../core/constants/buildingIcons';
import { X } from 'lucide-react';
import { useMemo } from 'react';

const requiredDepositForBuilding = (buildingId: string) => {
  if (buildingId === 'miner_mk1') return 'ore';
  if (buildingId === 'ice_extractor_mk1') return 'ice';
  if (buildingId === 'carbon_harvester_mk1') return 'carbon';
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
  const selectedBuildId = useGameStore((s) => s.grid.selectedBuildId);
  const selectBuild = useGameStore((s) => s.selectBuild);
  const resources = useGameStore((s) => s.resources);

  const affordability = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const b of buildings) {
      const cost = calculateCost(b);
      map[b.id] = Object.entries(cost).every(([res, amount]) => {
        const r = resources[res as ResourceType];
        return Boolean(r) && r.amount.gte(amount);
      });
    }
    return map;
  }, [buildings, resources]);

  return (
    <div className="p-3">
      <div className="space-y-1.5">
        {buildings.map((b) => {
          const Icon = getBuildingIcon(b.id);
          const isSelected = selectedBuildId === b.id;
          const canAfford = affordability[b.id];

          return (
            <button
              key={b.id}
              type="button"
              title={buildTitle(b)}
              onClick={() => selectBuild(isSelected ? null : b.id)}
              className={
                `w-full flex items-center gap-2 p-2 rounded transition-all border ` +
                (isSelected 
                  ? 'bg-cyber-green/10 border-cyber-green text-cyber-green' 
                  : canAfford 
                    ? 'bg-cyber-gray/20 border-cyber-gray/50 hover:bg-cyber-gray/30 text-cyber-text' 
                    : 'bg-cyber-gray/10 border-cyber-gray/30 opacity-50 cursor-not-allowed text-cyber-text-dim')
              }
              disabled={!canAfford && !isSelected}
            >
              <Icon size={16} className={isSelected ? 'text-cyber-green' : 'text-cyber-blue'} />
              <div className="flex-1 text-left">
                <div className="text-xs font-medium">{b.name}</div>
                <div className="text-[10px] text-cyber-text-dim">Ур. {b.count}</div>
              </div>
              {isSelected && (
                <X size={14} className="text-cyber-green" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
