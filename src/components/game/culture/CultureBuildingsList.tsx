import React, { useMemo } from 'react';
import { useCultureStore } from '../../../features/cultureStore';
import { CULTURE_BUILDINGS, isCultureBuildingAvailable } from '../../../core/constants/cultureBuildings';
import type { CultureBuilding, CultureBuildingType, CultureBuildingEffect } from '../../../core/gameTypes.culture';
import { formatNumber } from '../../../core/math/format';

// ==========================================
// CULTURE BUILDINGS LIST
// ==========================================

interface CultureBuildingsListProps {
  onBuildingSelect?: (buildingId: CultureBuildingType) => void;
  selectedBuilding?: CultureBuildingType | null;
}

export const CultureBuildingsList: React.FC<CultureBuildingsListProps> = ({
  onBuildingSelect,
  selectedBuilding,
}) => {
  const currentLevel = useCultureStore((state) => state.currentLevel);

  // Group buildings by tier
  const buildingsByTier = useMemo(() => {
    const tiers: Record<number, CultureBuilding[]> = { 1: [], 2: [], 3: [] };
    
    for (const building of Object.values(CULTURE_BUILDINGS)) {
      tiers[building.tier] = tiers[building.tier] || [];
      tiers[building.tier].push(building);
    }
    
    return tiers;
  }, []);

  const tierNames: Record<number, string> = {
    1: '🏛️ Базовые',
    2: '🎭 Продвинутые',
    3: '✨ Эпические',
  };

  return (
    <div className="flex flex-col gap-4 p-4 bg-gray-800/50 rounded-lg">
      <h3 className="text-lg font-bold text-purple-400">Культурные здания</h3>
      
      {[1, 2, 3].map((tier) => (
        <div key={tier} className="flex flex-col gap-2">
          <div className="text-sm text-gray-400 font-semibold">
            {tierNames[tier]}
          </div>
          
          <div className="grid grid-cols-1 gap-2">
            {buildingsByTier[tier].map((building) => {
              const isAvailable = isCultureBuildingAvailable(building.id as CultureBuildingType, currentLevel);
              const isSelected = selectedBuilding === building.id;
              
              return (
                <CultureBuildingCard
                  key={building.id}
                  building={building}
                  isAvailable={isAvailable}
                  isSelected={isSelected}
                  onClick={() => onBuildingSelect?.(building.id as CultureBuildingType)}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

// ==========================================
// CULTURE BUILDING CARD
// ==========================================

interface CultureBuildingCardProps {
  building: CultureBuilding;
  isAvailable: boolean;
  isSelected: boolean;
  onClick?: () => void;
}

const CultureBuildingCard: React.FC<CultureBuildingCardProps> = ({
  building,
  isAvailable,
  isSelected,
  onClick,
}) => {
  const requiredLevel = building.requiredCultureLevel || 1;
  
  return (
    <div
      className={`
        relative p-3 rounded-lg border transition-all cursor-pointer
        ${isSelected 
          ? 'border-purple-500 bg-purple-900/40' 
          : isAvailable 
            ? 'border-gray-600 bg-gray-700/50 hover:border-purple-400 hover:bg-gray-700/70' 
            : 'border-gray-700 bg-gray-800/50 opacity-60'
        }
      `}
      onClick={isAvailable ? onClick : undefined}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl">{building.emoji}</span>
        <div className="flex-1">
          <div className="font-semibold text-white">{building.name}</div>
          <div className="text-xs text-gray-400">Уровень {building.tier}</div>
        </div>
        {!isAvailable && (
          <div className="text-xs text-yellow-500 bg-yellow-500/20 px-2 py-1 rounded">
            🔒 Ур. {requiredLevel}
          </div>
        )}
      </div>

      {/* Description */}
      <p className="text-xs text-gray-400 mb-2">{building.description}</p>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        {/* Production */}
        {building.culturePerSecond.gt(0) && (
          <div className="flex items-center gap-1 text-purple-400">
            <span>🎭</span>
            <span>+{formatNumber(building.culturePerSecond)}/с</span>
          </div>
        )}
        {building.sciencePerSecond.gt(0) && (
          <div className="flex items-center gap-1 text-blue-400">
            <span>🔬</span>
            <span>+{formatNumber(building.sciencePerSecond)}/с</span>
          </div>
        )}
        
        {/* Happiness */}
        {building.happinessBonus > 0 && (
          <div className="flex items-center gap-1 text-green-400">
            <span>😊</span>
            <span>+{building.happinessBonus} счастье</span>
          </div>
        )}

        {/* Energy */}
        <div className="flex items-center gap-1 text-yellow-400">
          <span>⚡</span>
          <span>-{formatNumber(building.energyConsumption)}/с</span>
        </div>
      </div>

      {/* Special Effects */}
      {building.specialEffects && building.specialEffects.length > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-600">
          <div className="text-xs text-gray-400 mb-1">Спец. эффекты:</div>
          {building.specialEffects.map((effect, index) => (
            <div key={index} className="text-xs text-cyan-400">
              {formatSpecialEffect(effect)}
            </div>
          ))}
        </div>
      )}

      {/* Cost */}
      <div className="mt-2 pt-2 border-t border-gray-600">
        <div className="text-xs text-gray-400 mb-1">Стоимость:</div>
        <div className="flex flex-wrap gap-2 text-xs">
          {building.creditCost.gt(0) && (
            <span className="text-yellow-400">💰 {formatNumber(building.creditCost)}</span>
          )}
          {Object.entries(building.baseCost).map(([resource, amount]) => (
            <span key={resource} className="text-gray-300">
              {formatNumber(amount as any)} {resource}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

// ==========================================
// HELPER FUNCTIONS
// ==========================================

function formatSpecialEffect(effect: CultureBuildingEffect): string {
  const percent = Math.round(effect.value * 100);
  
  switch (effect.type) {
    case 'global_productivity':
      return `+${percent}% производительность`;
    case 'building_durability':
      return `+${percent}% прочность зданий`;
    case 'research_speed':
      return `+${percent}% скорость исследований`;
    case 'building_cost':
      return `-${percent}% стоимость зданий`;
    case 'trade_prices':
      return `+${percent}% торговые цены`;
    case 'credits_per_sale':
      return `+${percent}% кредитов за продажу`;
    case 'pollution_reduction':
      return `-${percent}% загрязнение`;
    default:
      return '';
  }
}

export default CultureBuildingsList;
