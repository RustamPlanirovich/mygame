import React, { useState } from 'react';
import { Circle, Gift, ChevronDown, ChevronUp, Info } from 'lucide-react';
import type { Quest } from '../../core/gameTypes.tutorial';
import { formatNumber, D } from '../../core/math/format';
import { useGameStore } from '../../features/gameStore';
import { RESOURCE_LABEL } from '../../core/constants/labels';
import type { ResourceType, TechnologyId } from '../../core/gameTypes';
import { GameIcon, IconText } from '../ui/icons';

interface QuestsPanelProps {
  quests: Quest[];
  onClaimReward?: (questId: string) => void;
}

export const QuestsPanel: React.FC<QuestsPanelProps> = ({ quests, onClaimReward }) => {
  const [expandedQuest, setExpandedQuest] = useState<string | null>(null);
  
  const buildings = useGameStore(s => s.buildings);
  const resources = useGameStore(s => s.resources);
  const currency = useGameStore(s => s.currency);
  const research = useGameStore(s => s.research);
  const grid = useGameStore(s => s.grid);
  
  const inProgressQuests = quests.filter(q => q.isActive && !q.isCompleted);

  const getQuestIcon = (type: Quest['type']) => {
    switch (type) {
      case 'build': return '🏗️';
      case 'research': return '🔬';
      case 'produce': return '⚙️';
      case 'explore': return '🌌';
      case 'combat': return '⚔️';
      default: return '📋';
    }
  };

  const renderQuestRewards = (reward: Quest['reward']) => {
    const rewards = [];
    if (reward.credits) rewards.push(`${formatNumber(D(reward.credits))} 💰`);
    if (reward.researchPoints) rewards.push(`${formatNumber(D(reward.researchPoints))} 🔬`);
    if (reward.influence) rewards.push(`${formatNumber(D(reward.influence))} 👑`);
    return rewards.join(', ');
  };

  const getQuestRequirements = (quest: Quest) => {
    const requirements: Array<{ label: string; current: string; needed: string; met: boolean }> = [];

    if (quest.type === 'build') {
      // Найти здание
      const building = buildings.find(b => b.id === quest.target);
      
      if (building) {
        // Проверяем стоимость здания
        const baseCost = building.baseCost;
        const creditCost = building.creditCost;
        const costFactor = Math.pow(building.costFactor, building.count);
        
        // Кредиты
        if (creditCost) {
          const scaledCost = creditCost.mul(costFactor);
          const met = currency.credits.gte(scaledCost);
          requirements.push({
            label: 'Кредиты',
            current: formatNumber(currency.credits),
            needed: formatNumber(scaledCost),
            met,
          });
        }
        
        // Ресурсы
        Object.entries(baseCost).forEach(([res, cost]) => {
          const scaledCost = cost.mul(costFactor);
          const resType = res as ResourceType;
          const currentAmount = resources[resType]?.amount || D(0);
          const met = currentAmount.gte(scaledCost);
          
          requirements.push({
            label: res === 'energy' ? 'Энергия' : RESOURCE_LABEL[resType] || res,
            current: formatNumber(currentAmount),
            needed: formatNumber(scaledCost),
            met,
          });
        });
        
        // Проверяем требуемые технологии (если есть)
        // const reqTech = building.requiredTech;
        // if (reqTech && reqTech.length > 0) {
        //   reqTech.forEach((techId: TechnologyId) => {
        //     const hasTech = research.technologies[techId];
        //     requirements.push({
        //       label: `Технология: ${techId}`,
        //       current: hasTech ? '✓' : '✗',
        //       needed: '✓',
        //       met: hasTech || false,
        //     });
        //   });
        // }
        
        // Проверяем свободное место на сетке
        const totalTiles = grid.width * grid.height;
        const occupiedTiles = Object.keys(grid.tiles).length;
        const freeTiles = totalTiles - occupiedTiles;
        requirements.push({
          label: 'Свободных клеток',
          current: String(freeTiles),
          needed: '1',
          met: freeTiles > 0,
        });
      }
    } else if (quest.type === 'research') {
      // Поиск технологии
      const hasTech = research.technologies[quest.target as TechnologyId];
      requirements.push({
        label: `Исследование: ${quest.target}`,
        current: hasTech ? 'Завершено' : 'Не завершено',
        needed: 'Завершено',
        met: hasTech || false,
      });
    } else if (quest.type === 'produce') {
      // Производство ресурсов
      if (quest.target === 'market_sale') {
        requirements.push({
          label: 'Продажи на рынке',
          current: String(quest.currentAmount || 0),
          needed: String(quest.targetAmount || 1),
          met: (quest.currentAmount || 0) >= (quest.targetAmount || 1),
        });
      } else {
        const resType = quest.target as ResourceType;
        const currentAmount = resources[resType]?.amount || D(0);
        requirements.push({
          label: RESOURCE_LABEL[resType] || quest.target,
          current: formatNumber(currentAmount),
          needed: String(quest.targetAmount || 1),
          met: currentAmount.gte(quest.targetAmount || 1),
        });
      }
    } else if (quest.type === 'explore') {
      // Исследование галактик
      requirements.push({
        label: `Исследовать: ${quest.target}`,
        current: String(quest.currentAmount || 0),
        needed: String(quest.targetAmount || 1),
        met: (quest.currentAmount || 0) >= (quest.targetAmount || 1),
      });
    } else if (quest.type === 'combat') {
      // Битва
      requirements.push({
        label: `Победить: ${quest.target}`,
        current: String(quest.currentAmount || 0),
        needed: String(quest.targetAmount || 1),
        met: (quest.currentAmount || 0) >= (quest.targetAmount || 1),
      });
    }

    return requirements;
  };

  const renderQuestDetails = (quest: Quest) => {
    const requirements = getQuestRequirements(quest);
    const isExpanded = expandedQuest === quest.id;
    
    if (!isExpanded || requirements.length === 0) return null;

    return (
      <div className="mt-3 p-2 bg-cyber-black/50 rounded border border-cyber-gray/30">
        <h5 className="text-[10px] font-bold text-cyber-blue mb-2 flex items-center gap-1">
          <Info size={10} />
          Требования для выполнения:
        </h5>
        <div className="space-y-1">
          {requirements.map((req, idx) => (
            <div
              key={idx}
              className={`text-[10px] flex items-center justify-between ${
                req.met ? 'text-green-400' : 'text-red-400'
              }`}
            >
              <span className="flex items-center gap-1">
                <IconText>{req.met ? '✓' : '✗'}</IconText> <IconText>{req.label}</IconText>
              </span>
              <span className="font-mono">
                {req.current} / {req.needed}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-cyber-darker">
      <div className="shrink-0 p-4 border-b border-cyber-gray bg-cyber-dark">
        <h2 className="text-lg font-bold text-cyber-green flex items-center gap-2">
          <span><GameIcon icon="📋" /></span>
          <span>Квесты</span>
        </h2>
        <p className="text-xs text-cyber-text-dim mt-1">
          Выполняйте задания для получения наград
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Active Quests */}
        {inProgressQuests.length > 0 && (
          <div>
            <h3 className="text-sm font-bold text-cyber-blue mb-2">
              В процессе ({inProgressQuests.length})
            </h3>
            <div className="space-y-2">
              {inProgressQuests.map((quest) => (
                <div
                  key={quest.id}
                  className={`rounded-lg p-3 transition-colors animate-slide-up ${
                    quest.isCompleted
                      ? 'bg-cyber-dark border border-cyber-green hover:border-cyber-green/80'
                      : 'bg-cyber-dark border border-cyber-gray hover:border-cyber-green'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="text-2xl"><GameIcon icon={getQuestIcon(quest.type)} /></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <h4 className={`font-bold text-sm ${quest.isCompleted ? 'text-cyber-green' : 'text-cyber-text'}`}>
                            <IconText>{quest.title}</IconText>
                          </h4>
                          <p className="text-xs text-cyber-text-dim mt-1">
                            <IconText>{quest.description}</IconText>
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedQuest(expandedQuest === quest.id ? null : quest.id);
                          }}
                          className="shrink-0 p-1 hover:bg-cyber-gray/20 rounded transition-colors"
                          title="Показать детали"
                        >
                          {expandedQuest === quest.id ? (
                            <ChevronUp size={14} className="text-cyber-text-dim" />
                          ) : (
                            <ChevronDown size={14} className="text-cyber-text-dim" />
                          )}
                        </button>
                      </div>
                      
                      {/* Progress */}
                      {quest.targetAmount && quest.targetAmount > 1 && (
                        <div className="mt-2">
                          <div className="flex items-center justify-between text-[10px] mb-1">
                            <span className="text-cyber-text-dim">Прогресс</span>
                            <span className={`font-mono ${quest.isCompleted ? 'text-cyber-green' : 'text-cyber-text'}`}>
                              <IconText>{quest.isCompleted 
                                ? `${quest.targetAmount} / ${quest.targetAmount} ✓`
                                : `${quest.currentAmount || 0} / ${quest.targetAmount}`
                              }</IconText>
                            </span>
                          </div>
                          <div className="h-1.5 bg-cyber-black rounded-full overflow-hidden">
                            <div
                              className="h-full bg-cyber-green transition-all duration-300"
                              style={{
                                width: `${Math.min(
                                  100,
                                  ((quest.currentAmount || 0) / quest.targetAmount) * 100
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Rewards */}
                      <div className="mt-2 flex items-center gap-2">
                        <Gift size={12} className="text-cyber-yellow" />
                        <span className={`text-[10px] text-cyber-yellow ${quest.isCompleted ? 'font-bold' : ''}`}>
                          {renderQuestRewards(quest.reward)}
                        </span>
                      </div>
                      
                      {/* Quest Details */}
                      {renderQuestDetails(quest)}
                    </div>

                    <div className="shrink-0">
                      {quest.isCompleted && onClaimReward ? (
                        <button
                          onClick={() => onClaimReward(quest.id)}
                          className="px-4 py-2 bg-cyber-green text-cyber-darker font-bold text-sm rounded hover:bg-cyber-green/80 transition-colors animate-pulse"
                        >
                          Забрать
                        </button>
                      ) : (
                        <Circle size={20} className="text-cyber-gray" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {inProgressQuests.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="text-6xl mb-4"><GameIcon icon="📋" /></div>
            <p className="text-cyber-text-dim">
              Нет доступных квестов
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
