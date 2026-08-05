import React from 'react';
import { useCultureStore, useCultureLevelInfo, useHappinessTier, useCultureProduction } from '../../../features/cultureStore';
import { formatNumber } from '../../../core/math/format';
import type { HappinessState, HappinessFactor } from '../../../core/gameTypes.culture';
import { GameIcon, IconText } from '../../ui/icons';

// Aggregated effects type (inline since not exported from gameTypes.culture)
interface AggregatedCultureEffects {
  globalProductivity: number;
  buildingDurability: number;
  researchSpeed: number;
  buildingCost: number;
  tradePrices: number;
  creditsPerSale: number;
  pollutionReduction: number;
}

// ==========================================
// CULTURE PANEL - Главная панель культуры и науки
// ==========================================

export const CulturePanel: React.FC = () => {
  const culture = useCultureStore((state) => state.culture);
  const science = useCultureStore((state) => state.science);
  const happiness = useCultureStore((state) => state.happiness);
  const aggregatedEffects = useCultureStore((state) => state.aggregatedEffects);
  
  const levelInfo = useCultureLevelInfo();
  const tierInfo = useHappinessTier();
  const production = useCultureProduction();

  return (
    <div className="flex flex-col gap-4 p-4 bg-gray-800/50 rounded-lg">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-purple-400"><GameIcon icon="🎭" /> Культура и Наука</h2>
        <div className="flex items-center gap-2">
          <span className="text-2xl"><GameIcon icon={tierInfo.icon} /></span>
          <span style={{ color: tierInfo.color }}>{tierInfo.name}</span>
        </div>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-2 gap-4">
        {/* Culture */}
        <div className="bg-purple-900/30 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl"><GameIcon icon="🎭" /></span>
            <span className="text-purple-300 font-semibold">Культура</span>
          </div>
          <div className="text-2xl font-bold text-white">
            {formatNumber(culture)}
          </div>
          <div className="text-sm text-purple-400">
            +{formatNumber(production.culturePerSecond)}/с
          </div>
        </div>

        {/* Science */}
        <div className="bg-blue-900/30 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl"><GameIcon icon="🔬" /></span>
            <span className="text-blue-300 font-semibold">Наука</span>
          </div>
          <div className="text-2xl font-bold text-white">
            {formatNumber(science)}
          </div>
          <div className="text-sm text-blue-400">
            +{formatNumber(production.sciencePerSecond)}/с
          </div>
        </div>
      </div>

      {/* Culture Level */}
      <CultureLevelSection levelInfo={levelInfo} />

      {/* Happiness Section */}
      <HappinessSection happiness={happiness} tierInfo={tierInfo} />

      {/* Effects Section */}
      <EffectsSection effects={aggregatedEffects} />
    </div>
  );
};

// ==========================================
// CULTURE LEVEL SECTION
// ==========================================

interface CultureLevelSectionProps {
  levelInfo: ReturnType<typeof useCultureLevelInfo>;
}

const CultureLevelSection: React.FC<CultureLevelSectionProps> = ({ levelInfo }) => {
  const progressPercent = Math.round(levelInfo.progress * 100);

  return (
    <div className="bg-gray-700/50 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="text-gray-400 text-sm">Культурный уровень</span>
          <div className="text-lg font-bold text-purple-300">
            {levelInfo.level}. {levelInfo.name}
          </div>
        </div>
        <div className="text-right">
          <span className="text-green-400 text-sm">+{levelInfo.happinessBonus}% счастье</span>
        </div>
      </div>

      {/* Progress bar */}
      {!levelInfo.isMaxLevel && (
        <div className="mt-2">
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>Прогресс к след. уровню</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="h-2 bg-gray-600 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-purple-500 to-purple-300 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          {levelInfo.nextLevelRequirement && (
            <div className="text-xs text-gray-500 mt-1">
              Требуется: {formatNumber(levelInfo.nextLevelRequirement)} культуры
            </div>
          )}
        </div>
      )}

      {levelInfo.isMaxLevel && (
        <div className="text-center text-yellow-400 text-sm mt-2">
          <GameIcon icon="✨" /> Максимальный уровень достигнут!
        </div>
      )}

      {/* Description */}
      <p className="text-xs text-gray-400 mt-2 italic">
        <IconText>{levelInfo.description}</IconText>
      </p>
    </div>
  );
};

// ==========================================
// HAPPINESS SECTION
// ==========================================

interface HappinessSectionProps {
  happiness: HappinessState;
  tierInfo: ReturnType<typeof useHappinessTier>;
}

const HappinessSection: React.FC<HappinessSectionProps> = ({ happiness, tierInfo }) => {
  const trendIcon = happiness.trend === 'rising' ? '📈' : happiness.trend === 'falling' ? '📉' : '➡️';
  const productivityBonus = happiness.productivityMultiplier >= 1
    ? `+${Math.round((happiness.productivityMultiplier - 1) * 100)}%`
    : `${Math.round((happiness.productivityMultiplier - 1) * 100)}%`;

  return (
    <div className="bg-gray-700/50 rounded-lg p-3">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl"><GameIcon icon={tierInfo.icon} /></span>
          <div>
            <span className="text-gray-400 text-sm">Счастье населения</span>
            <div className="font-bold" style={{ color: tierInfo.color }}>
              {tierInfo.name} ({Math.round(happiness.current)}%)
            </div>
          </div>
        </div>
        <div className="text-right">
          <span className="text-xs text-gray-400">Тренд</span>
          <div className="text-xl">{trendIcon}</div>
        </div>
      </div>

      {/* Happiness bar */}
      <div className="h-3 bg-gray-600 rounded-full overflow-hidden mb-2">
        <div 
          className="h-full transition-all duration-500"
          style={{ 
            width: `${happiness.current}%`,
            backgroundColor: tierInfo.color,
          }}
        />
      </div>

      {/* Productivity effect */}
      <div className="flex items-center justify-center gap-2 text-sm">
        <span className="text-gray-400">Производительность:</span>
        <span className={happiness.productivityMultiplier >= 1 ? 'text-green-400' : 'text-red-400'}>
          {productivityBonus}
        </span>
      </div>

      {/* Factors */}
      {happiness.factors.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-600">
          <div className="text-xs text-gray-400 mb-2">Факторы влияния:</div>
          <div className="grid grid-cols-2 gap-1">
            {happiness.factors.slice(0, 6).map((factor: HappinessFactor) => (
              <div 
                key={factor.id}
                className="flex items-center gap-1 text-xs"
              >
                <span>{factor.icon || '•'}</span>
                <span className="text-gray-300 truncate">{factor.source}</span>
                <span className={factor.value >= 0 ? 'text-green-400' : 'text-red-400'}>
                  {factor.value >= 0 ? '+' : ''}{factor.value}
                </span>
              </div>
            ))}
          </div>
          {happiness.factors.length > 6 && (
            <div className="text-xs text-gray-500 mt-1">
              +{happiness.factors.length - 6} других факторов
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ==========================================
// EFFECTS SECTION
// ==========================================

interface EffectsSectionProps {
  effects: AggregatedCultureEffects;
}

const EffectsSection: React.FC<EffectsSectionProps> = ({ effects }) => {
  const formatEffect = (value: number, inverse = false) => {
    const adjusted = inverse ? (1 - value) : (value - 1);
    const percent = Math.round(adjusted * 100);
    if (percent === 0) return null;
    return percent >= 0 ? `+${percent}%` : `${percent}%`;
  };

  const effectsList = [
    { label: 'Производительность', value: formatEffect(effects.globalProductivity), icon: '⚙️' },
    { label: 'Скорость исследований', value: formatEffect(effects.researchSpeed), icon: '🔬' },
    { label: 'Стоимость зданий', value: formatEffect(effects.buildingCost, true), icon: '🏗️' },
    { label: 'Торговые цены', value: formatEffect(effects.tradePrices), icon: '💰' },
    { label: 'Кредиты за продажу', value: formatEffect(effects.creditsPerSale), icon: '💵' },
    { label: 'Снижение загрязнения', value: formatEffect(effects.pollutionReduction, true), icon: '🌿' },
  ].filter(e => e.value !== null);

  if (effectsList.length === 0) {
    return null;
  }

  return (
    <div className="bg-gray-700/50 rounded-lg p-3">
      <div className="text-sm text-gray-400 mb-2">Бонусы от культуры:</div>
      <div className="grid grid-cols-2 gap-2">
        {effectsList.map((effect, index) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <span><GameIcon icon={effect.icon} /></span>
            <span className="text-gray-300"><IconText>{effect.label}</IconText></span>
            <span className="text-green-400 ml-auto">{effect.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CulturePanel;
