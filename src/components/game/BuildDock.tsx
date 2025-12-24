import { useMemo } from 'react';
import { useGameStore, calculateCost } from '../../features/gameStore';
import { formatNumber } from '../../core/math/format';
import { RESOURCE_LABEL } from '../../core/constants/labels';
import { getBuildingIcon } from '../../core/constants/buildingIcons';
import type { Building, ResourceType } from '../../core/gameTypes';
import { Hammer, X } from 'lucide-react';

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

export function BuildDock() {
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
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-cyber-gray bg-cyber-dark">
      <div className="px-3 py-2 flex items-center gap-2">
        <div className="flex items-center gap-2 shrink-0 text-xs text-gray-500">
          <Hammer size={14} className="text-cyber-green" />
          <span>Строительство</span>
        </div>

        <div className="flex-1 overflow-x-auto">
          <div className="flex items-stretch gap-2 min-w-max">
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
                    `cyber-button px-3 py-2 h-10 flex items-center gap-2 ` +
                    (isSelected ? 'border-cyber-green' : '') +
                    (!canAfford && !isSelected ? ' opacity-50 cursor-not-allowed' : '')
                  }
                  disabled={!canAfford && !isSelected}
                >
                  <Icon size={16} className={isSelected ? 'text-cyber-green' : 'text-cyber-blue'} />
                  <div className="flex flex-col items-start leading-none">
                    <span className="text-[11px] font-semibold text-cyber-text whitespace-nowrap">{b.name}</span>
                    <span className="text-[10px] text-gray-500 whitespace-nowrap">ур. {b.count}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={() => selectBuild(null)}
          className="cyber-button px-3 py-2 h-10 shrink-0"
          title="Снять выбор здания"
        >
          <div className="flex items-center gap-2">
            <X size={14} className="text-cyber-green" />
            <span className="text-xs">Снять</span>
          </div>
        </button>
      </div>
    </div>
  );
}
