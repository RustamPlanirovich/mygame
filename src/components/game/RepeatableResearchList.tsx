import React from 'react';
import { useGameStore } from '../../features/gameStore';
import { REPEATABLE_RESEARCHES } from '../../core/constants/repeatableResearch';
import { RepeatableResearchItem } from './RepeatableResearchItem';
import {
  getMaxLevelPerAscension,
  checkCanAffordRepeatable,
} from '../../utils/repeatableResearchHelpers';

export const RepeatableResearchList: React.FC = () => {
  const game = useGameStore();
  const maxLevel = getMaxLevelPerAscension(game.ascension.ascensionCount);
  
  // Расчет общей статистики
  const totalLevels = Object.values(game.repeatableResearch || {}).reduce(
    (sum, level) => sum + level,
    0
  );
  
  return (
    <div className="repeatable-research-list space-y-6 p-6">
      {/* Заголовок */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-2xl font-bold text-white flex items-center gap-2">
            <span>🔬</span>
            <span>Повторяемые Исследования</span>
          </h3>
          <div className="text-right">
            <div className="text-sm text-gray-400">Суммарно уровней</div>
            <div className="text-xl font-bold text-cyan-400">{totalLevels}</div>
          </div>
        </div>
        
        <p className="text-gray-300 text-sm">
          Бесконечно улучшаемые технологии. Максимум <span className="text-cyan-400 font-semibold">{maxLevel}</span> уровня за прохождение.
          {' '}Уровни сбрасываются при Вознесении.
        </p>
      </div>
      
      {/* Сетка исследований */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.values(REPEATABLE_RESEARCHES).map((research) => {
          const currentLevel = game.repeatableResearch?.researches?.[research.id] || 0;
          const canAfford = checkCanAffordRepeatable(game, research.id, currentLevel);
          
          return (
            <RepeatableResearchItem
              key={research.id}
              research={research}
              currentLevel={currentLevel}
              maxLevel={maxLevel}
              canAfford={canAfford && currentLevel < maxLevel}
              onResearch={() => game.researchRepeatable(research.id)}
            />
          );
        })}
      </div>
      
      {/* Подсказка */}
      <div className="mt-6 p-4 bg-blue-900/20 border border-blue-700/50 rounded-lg">
        <div className="flex items-start gap-3">
          <span className="text-2xl">💡</span>
          <div className="text-sm text-gray-300 space-y-1">
            <p className="font-semibold text-blue-300">Совет:</p>
            <p>
              Повторяемые исследования дают постоянные бонусы, но их уровни сбрасываются при каждом Вознесении.
              Выбирайте что качать в первую очередь в зависимости от вашей стратегии!
            </p>
            <p className="text-xs text-gray-400 mt-2">
              С каждым Вознесением максимальный уровень увеличивается на 25.
            </p>
          </div>
        </div>
      </div>
      
      {/* Статистика (если есть хоть один уровень) */}
      {totalLevels > 0 && (
        <div className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-4">
          {Object.values(REPEATABLE_RESEARCHES).map((research) => {
            const level = game.repeatableResearch?.researches?.[research.id] || 0;
            if (level === 0) return null;
            
            return (
              <div
                key={research.id}
                className="bg-gray-800/30 border border-gray-700 rounded-lg p-3"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">{research.icon}</span>
                  <span className="text-sm text-gray-400">{research.name}</span>
                </div>
                <div className="text-2xl font-bold text-white">{level}</div>
                <div className="text-xs text-gray-500">
                  {((level / maxLevel) * 100).toFixed(1)}% от макс.
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
