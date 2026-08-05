import React from 'react';
import type { RepeatableResearch } from '../../core/gameTypes';
import {
  calculateRepeatableCost,
  calculateRepeatableEffect,
  formatEffectValue,
} from '../../utils/repeatableResearchHelpers';
import { formatBigNumber } from '../../utils/bigNumber';
import { GameIcon, IconText } from '../ui/icons';

interface RepeatableResearchItemProps {
  research: RepeatableResearch;
  currentLevel: number;
  maxLevel: number;
  canAfford: boolean;
  onResearch: () => void;
}

export const RepeatableResearchItem: React.FC<RepeatableResearchItemProps> = ({
  research,
  currentLevel,
  maxLevel,
  canAfford,
  onResearch,
}) => {
  const nextCost = calculateRepeatableCost(research.baseCost, currentLevel);
  const currentEffect = calculateRepeatableEffect(research.valuePerLevel || 0, currentLevel);
  const nextEffect = calculateRepeatableEffect(research.valuePerLevel || 0, currentLevel + 1);
  const effectDelta = nextEffect - currentEffect;
  
  const effectType = research.effectType || 'percentage';
  const isMaxLevel = currentLevel >= maxLevel;
  const progress = (currentLevel / maxLevel) * 100;
  
  return (
    <div
      className={`
        repeatable-research-item
        bg-gray-800/50
        border border-gray-700
        rounded-lg p-4 space-y-3
        transition-all duration-200
        ${canAfford && !isMaxLevel ? 'hover:border-cyan-500 hover:shadow-elev-3 hover:shadow-cyan-500/20' : ''}
        ${isMaxLevel ? 'opacity-75' : ''}
      `}
    >
      {/* Заголовок */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="text-3xl"><GameIcon icon={research.icon} /></span>
          <div>
            <h4 className="text-white font-semibold text-lg">{research.name}</h4>
            <span className="text-gray-400 text-sm">
              Уровень {currentLevel} / {maxLevel}
            </span>
          </div>
        </div>
      </div>
      
      {/* Прогресс-бар */}
      <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
        <div
          className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full transition-all duration-300"
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>
      
      {/* Описание */}
      <p className="text-gray-300 text-sm"><IconText>{research.description}</IconText></p>
      
      {/* Эффекты */}
      <div className="space-y-2">
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-400">Текущий бонус:</span>
          <span className="text-green-400 font-semibold">
            {formatEffectValue(currentEffect, effectType)}
          </span>
        </div>
        
        {!isMaxLevel && (
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-400">Следующий уровень:</span>
            <span className="text-cyan-400">
              +{formatEffectValue(effectDelta, effectType)}
              {' '}
              <span className="text-gray-500">
                (всего {formatEffectValue(nextEffect, effectType)})
              </span>
            </span>
          </div>
        )}
      </div>
      
      {/* Стоимость */}
      {!isMaxLevel && (
        <div className="border-t border-gray-700 pt-3 space-y-2">
          <div className="text-gray-400 text-sm mb-2">Стоимость:</div>
          <div className="grid grid-cols-1 gap-1">
            {Object.entries(nextCost).map(([resourceId, amount]) => {
              const resourceName = getResourceName(resourceId);
              const resourceIcon = getResourceIcon(resourceId);
              
              return (
                <div
                  key={resourceId}
                  className="flex justify-between items-center text-sm"
                >
                  <span className="text-gray-300">
                    {resourceIcon} {resourceName}
                  </span>
                  <span className={canAfford ? 'text-white' : 'text-red-400'}>
                    {formatBigNumber(amount)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      {/* Кнопка */}
      <button
        className={`
          w-full py-2 px-4 rounded-lg font-semibold
          transition-all duration-200
          ${isMaxLevel
            ? 'bg-green-600/50 text-green-200 cursor-not-allowed'
            : canAfford
            ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white hover:from-cyan-500 hover:to-blue-500 hover:shadow-elev-3'
            : 'bg-gray-700 text-gray-400 cursor-not-allowed'
          }
        `}
        disabled={!canAfford || isMaxLevel}
        onClick={onResearch}
      >
        <IconText>{isMaxLevel ? '✅ Макс. уровень' : canAfford ? 'Исследовать' : '❌ Недостаточно ресурсов'}</IconText>
      </button>
      
      {/* Статистика */}
      {currentLevel > 0 && (
        <div className="text-center text-xs text-gray-500 pt-2 border-t border-gray-700">
          Всего улучшено: {currentLevel} раз
        </div>
      )}
    </div>
  );
};

// Хелперы для отображения имен и иконок ресурсов
function getResourceName(resourceId: string): string {
  const names: Record<string, string> = {
    credits: 'Кредиты',
    iron: 'Железо',
    copper: 'Медь',
    silicon: 'Кремний',
    titanium: 'Титан',
    crystal: 'Кристаллы',
    energy: 'Энергия',
    data: 'Данные',
    darkMatter: 'Темная Материя',
    antimatter: 'Антиматерия',
    quantumPoints: 'Quantum Points',
  };
  return names[resourceId] || resourceId;
}

function getResourceIcon(resourceId: string): string {
  const icons: Record<string, string> = {
    credits: '💰',
    iron: '⛏️',
    copper: '🔶',
    silicon: '🔷',
    titanium: '⚙️',
    crystal: '💎',
    energy: '⚡',
    data: '📊',
    darkMatter: '🌌',
    antimatter: '⚛️',
    quantumPoints: '✨',
  };
  return icons[resourceId] || '📦';
}
