import React from 'react';
import { CheckCircle2, Circle, Gift } from 'lucide-react';
import type { Quest } from '../../core/gameTypes.tutorial';
import { formatNumber, D } from '../../core/math/format';

interface QuestsPanelProps {
  quests: Quest[];
  onClaimReward?: (questId: string) => void;
}

export const QuestsPanel: React.FC<QuestsPanelProps> = ({ quests }) => {
  const activeQuests = quests.filter(q => q.isActive && !q.isCompleted);
  const completedQuests = quests.filter(q => q.isCompleted);

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

  return (
    <div className="h-full flex flex-col bg-cyber-darker">
      <div className="shrink-0 p-4 border-b border-cyber-gray bg-cyber-dark">
        <h2 className="text-lg font-bold text-cyber-green flex items-center gap-2">
          <span>📋</span>
          <span>Квесты</span>
        </h2>
        <p className="text-xs text-cyber-text-dim mt-1">
          Выполняйте задания для получения наград
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Active Quests */}
        {activeQuests.length > 0 && (
          <div>
            <h3 className="text-sm font-bold text-cyber-blue mb-2">
              Активные ({activeQuests.length})
            </h3>
            <div className="space-y-2">
              {activeQuests.map((quest) => (
                <div
                  key={quest.id}
                  className="bg-cyber-dark border border-cyber-gray rounded-lg p-3 hover:border-cyber-green transition-colors animate-slide-up"
                >
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">{getQuestIcon(quest.type)}</div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-cyber-text text-sm">
                        {quest.title}
                      </h4>
                      <p className="text-xs text-cyber-text-dim mt-1">
                        {quest.description}
                      </p>
                      
                      {/* Progress */}
                      {quest.targetAmount && quest.targetAmount > 1 && (
                        <div className="mt-2">
                          <div className="flex items-center justify-between text-[10px] mb-1">
                            <span className="text-cyber-text-dim">Прогресс</span>
                            <span className="text-cyber-green font-mono">
                              {quest.currentAmount || 0} / {quest.targetAmount}
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
                        <span className="text-[10px] text-cyber-yellow">
                          {renderQuestRewards(quest.reward)}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0">
                      <Circle size={20} className="text-cyber-gray" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Completed Quests */}
        {completedQuests.length > 0 && (
          <div>
            <h3 className="text-sm font-bold text-cyber-green mb-2">
              Завершено ({completedQuests.length})
            </h3>
            <div className="space-y-2">
              {completedQuests.map((quest) => (
                <div
                  key={quest.id}
                  className="bg-cyber-dark/50 border border-cyber-green/30 rounded-lg p-3 opacity-75"
                >
                  <div className="flex items-start gap-3">
                    <div className="text-2xl opacity-50">{getQuestIcon(quest.type)}</div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-cyber-text text-sm line-through">
                        {quest.title}
                      </h4>
                      <p className="text-xs text-cyber-green mt-1">
                        ✓ Завершено
                      </p>
                    </div>
                    <div className="shrink-0">
                      <CheckCircle2 size={20} className="text-cyber-green" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeQuests.length === 0 && completedQuests.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="text-6xl mb-4">📋</div>
            <p className="text-cyber-text-dim">
              Нет доступных квестов
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
