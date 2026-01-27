import React from 'react';
import { useCultureStore, useHappinessFactors } from '../../../features/cultureStore';
import { getHappinessTier, HAPPINESS_TIERS } from '../../../core/constants/cultureLevels';
import { getFactorsByCategory } from '../../../utils/happinessCalculator';
import type { HappinessCategory, HappinessFactor } from '../../../core/gameTypes.culture';

// ==========================================
// HAPPINESS DETAILS PANEL
// ==========================================

export const HappinessDetailsPanel: React.FC = () => {
  const happiness = useCultureStore((state) => state.happiness);
  const factors = useHappinessFactors();
  
  const tierInfo = getHappinessTier(happiness.current);
  const factorsByCategory = getFactorsByCategory(factors);
  
  const categoryLabels: Record<HappinessCategory, { label: string; icon: string }> = {
    culture: { label: 'Культура', icon: '🎭' },
    entertainment: { label: 'Развлечения', icon: '🎡' },
    work_conditions: { label: 'Условия труда', icon: '⚙️' },
    ecology: { label: 'Экология', icon: '🌿' },
    economy: { label: 'Экономика', icon: '💰' },
    events: { label: 'События', icon: '📅' },
    warfare: { label: 'Военные действия', icon: '⚔️' },
  };

  return (
    <div className="flex flex-col gap-4 p-4 bg-gray-800/50 rounded-lg">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-green-400">😊 Счастье населения</h3>
        <div className="flex items-center gap-2">
          <span className="text-3xl">{tierInfo.icon}</span>
        </div>
      </div>

      {/* Main happiness display */}
      <div className="bg-gray-700/50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-3xl font-bold" style={{ color: tierInfo.color }}>
              {Math.round(happiness.current)}%
            </div>
            <div className="text-sm text-gray-400">{tierInfo.name}</div>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-400">Производительность</div>
            <div className={`text-xl font-bold ${happiness.productivityMultiplier >= 1 ? 'text-green-400' : 'text-red-400'}`}>
              {happiness.productivityMultiplier >= 1 ? '+' : ''}
              {Math.round((happiness.productivityMultiplier - 1) * 100)}%
            </div>
          </div>
        </div>

        {/* Happiness bar with markers */}
        <div className="relative h-6 bg-gray-600 rounded-full overflow-hidden">
          {/* Tier backgrounds */}
          {HAPPINESS_TIERS.map((tier) => (
            <div
              key={tier.tier}
              className="absolute h-full opacity-30"
              style={{
                left: `${tier.minHappiness}%`,
                width: `${tier.maxHappiness - tier.minHappiness}%`,
                backgroundColor: tier.color,
              }}
            />
          ))}
          
          {/* Current happiness */}
          <div 
            className="absolute h-full transition-all duration-500"
            style={{ 
              width: `${happiness.current}%`,
              backgroundColor: tierInfo.color,
            }}
          />
          
          {/* Tier markers */}
          {HAPPINESS_TIERS.slice(1).map((tier) => (
            <div
              key={tier.tier}
              className="absolute top-0 h-full w-0.5 bg-gray-800"
              style={{ left: `${tier.minHappiness}%` }}
            />
          ))}
        </div>

        {/* Tier labels */}
        <div className="flex justify-between mt-1 text-xs">
          {HAPPINESS_TIERS.map((tier) => (
            <span 
              key={tier.tier} 
              className="text-gray-500"
              style={{ color: happiness.current >= tier.minHappiness && happiness.current <= tier.maxHappiness ? tier.color : undefined }}
            >
              {tier.icon}
            </span>
          ))}
        </div>
      </div>

      {/* Factors by category */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-gray-400">Факторы влияния:</h4>
        
        {(Object.keys(categoryLabels) as HappinessCategory[]).map((category) => {
          const categoryFactors = factorsByCategory[category];
          if (categoryFactors.length === 0) return null;
          
          const totalValue = categoryFactors.reduce((sum, f) => sum + f.value, 0);
          const { label, icon } = categoryLabels[category];
          
          return (
            <CategorySection
              key={category}
              label={label}
              icon={icon}
              factors={categoryFactors}
              totalValue={totalValue}
            />
          );
        })}
        
        {factors.length === 0 && (
          <div className="text-center text-gray-500 py-4">
            Нет активных факторов влияния
          </div>
        )}
      </div>

      {/* Tips */}
      <div className="bg-gray-700/30 rounded-lg p-3">
        <h4 className="text-sm font-semibold text-gray-400 mb-2">💡 Советы:</h4>
        <ul className="text-xs text-gray-400 space-y-1">
          <li>• Стройте культурные здания для повышения счастья</li>
          <li>• Избегайте форсированного режима работы</li>
          <li>• Следите за экологией и загрязнением</li>
          <li>• Поддерживайте стабильную экономику</li>
        </ul>
      </div>
    </div>
  );
};

// ==========================================
// CATEGORY SECTION
// ==========================================

interface CategorySectionProps {
  label: string;
  icon: string;
  factors: HappinessFactor[];
  totalValue: number;
}

const CategorySection: React.FC<CategorySectionProps> = ({
  label,
  icon,
  factors,
  totalValue,
}) => {
  const [expanded, setExpanded] = React.useState(false);
  
  return (
    <div className="bg-gray-700/30 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        className="w-full flex items-center justify-between p-2 hover:bg-gray-700/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <span>{icon}</span>
          <span className="text-sm text-white">{label}</span>
          <span className="text-xs text-gray-500">({factors.length})</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold ${totalValue >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {totalValue >= 0 ? '+' : ''}{totalValue}
          </span>
          <span className="text-gray-500">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>
      
      {/* Expanded factors */}
      {expanded && (
        <div className="px-2 pb-2 space-y-1">
          {factors.map((factor) => (
            <div
              key={factor.id}
              className="flex items-center justify-between text-xs py-1 px-2 bg-gray-800/50 rounded"
            >
              <div className="flex items-center gap-2">
                {factor.icon && <span>{factor.icon}</span>}
                <span className="text-gray-300">{factor.description}</span>
                {factor.temporary && (
                  <span className="text-yellow-500 text-xs">(временно)</span>
                )}
              </div>
              <span className={factor.value >= 0 ? 'text-green-400' : 'text-red-400'}>
                {factor.value >= 0 ? '+' : ''}{factor.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default HappinessDetailsPanel;
