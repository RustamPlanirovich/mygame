import { useGameStore } from '../../features/gameStore';
import { ACHIEVEMENTS, getAchievementsByCategory, getTotalAchievementsCount } from '../../core/constants/achievements';
import type { AchievementCategory } from '../../core/gameTypes';
import { D } from '../../core/math/format';
import { GameIcon, IconText } from '../ui/icons';

const CATEGORY_NAMES: Record<AchievementCategory, string> = {
  construction: 'Строительство',
  production: 'Производство',
  research: 'Исследования',
  combat: 'Боевые',
  exploration: 'Исследование',
  economy: 'Экономика',
  special: 'Специальные',
};

const CATEGORY_COLORS: Record<AchievementCategory, string> = {
  construction: 'from-amber-600/40 to-orange-700/40',
  production: 'from-green-600/40 to-emerald-700/40',
  research: 'from-blue-600/40 to-cyan-700/40',
  combat: 'from-red-600/40 to-rose-700/40',
  exploration: 'from-purple-600/40 to-pink-700/40',
  economy: 'from-yellow-600/40 to-amber-700/40',
  special: 'from-indigo-600/40 to-violet-700/40',
};

export default function AchievementsPanel() {
  const achievements = useGameStore((s) => s.achievements);
  const currency = useGameStore((s) => s.currency);
  const buildings = useGameStore((s) => s.buildings);
  const resources = useGameStore((s) => s.resources);
  const technologies = useGameStore((s) => s.research.technologies);
  const galaxies = useGameStore((s) => s.galaxies);
  const fleet = useGameStore((s) => s.fleet);

  const totalCount = getTotalAchievementsCount();
  const unlockedCount = Object.keys(achievements.unlocked).length;
  const progressPercent = Math.floor((unlockedCount / totalCount) * 100);

  // Calculate progress for each achievement
  const getAchievementProgress = (achievementId: string): { current: number; target: number; percent: number } => {
    const achievement = ACHIEVEMENTS.find(a => a.id === achievementId);
    if (!achievement) return { current: 0, target: 0, percent: 0 };

    const { type, specificBuilding, specificResource } = achievement.requirement;
    // target необязателен: у 'custom'-достижений вместо него собственный предикат,
    // измеримой шкалы прогресса у них нет.
    const target = achievement.requirement.target ?? 0;
    let current = 0;

    switch (type) {
      case 'building_count':
        if (specificBuilding) {
          current = buildings.filter(b => b.id === specificBuilding).length;
        } else {
          current = buildings.length;
        }
        break;
      case 'resource_amount':
        if (specificResource) {
          current = resources[specificResource]?.amount.toNumber() || 0;
        }
        break;
      case 'technology_count':
        current = Object.keys(technologies).filter(key => technologies[key as keyof typeof technologies]).length;
        break;
      case 'galaxy_count':
        current = galaxies.unlockedGalaxies.length;
        break;
      case 'ship_count':
        current = fleet.ships.length;
        break;
      case 'energy_production':
        current = useGameStore.getState().energyProduction.toNumber();
        break;
      case 'credits_earned':
        current = currency.credits.toNumber();
        break;
      // Special checks would need custom logic
      case 'combat_wins':
      case 'synergy_buildings':
      case 'zero_waste':
      case 'special':
        // These require tracking in game state - for now show as 0
        current = 0;
        break;
    }

    // Без цели деление давало NaN/Infinity и полоска прогресса ломалась.
    const percent = target > 0 ? Math.min(100, Math.floor((current / target) * 100)) : 0;
    return { current, target, percent };
  };

  // Group achievements by category
  const categories: AchievementCategory[] = ['construction', 'production', 'research', 'combat', 'exploration', 'economy', 'special'];

  return (
    <div className="p-4 space-y-4 text-sm">
      {/* Overall Progress */}
      <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold text-white"><GameIcon icon="🏆" /> Достижения</h2>
          <span className="text-gray-300 font-semibold">
            {unlockedCount} / {totalCount} ({progressPercent}%)
          </span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Achievements by Category */}
      {categories.map(category => {
        const categoryAchievements = getAchievementsByCategory(category);
        const unlockedInCategory = categoryAchievements.filter(a => achievements.unlocked[a.id]).length;

        return (
          <div key={category} className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">
                {CATEGORY_NAMES[category]}
              </h3>
              <span className="text-xs text-gray-400">
                {unlockedInCategory} / {categoryAchievements.length}
              </span>
            </div>

            <div className="space-y-2">
              {categoryAchievements.map(achievement => {
                const isUnlocked = !!achievements.unlocked[achievement.id];
                const isHidden = achievement.hidden && !isUnlocked;
                const progress = getAchievementProgress(achievement.id);

                if (isHidden) {
                  return (
                    <div 
                      key={achievement.id}
                      className="bg-gray-900/50 rounded-lg p-3 border border-gray-700/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-2xl opacity-30"><GameIcon icon="❓" /></div>
                        <div className="flex-1">
                          <div className="font-semibold text-gray-500 italic">Скрытое достижение</div>
                          <div className="text-xs text-gray-600">Выполните особое условие, чтобы разблокировать</div>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div 
                    key={achievement.id}
                    className={`
                      rounded-lg p-3 border transition-all duration-300
                      ${isUnlocked 
                        ? `bg-gradient-to-r ${CATEGORY_COLORS[category]} bg-opacity-20 border-${category === 'construction' ? 'amber' : category === 'production' ? 'green' : category === 'research' ? 'blue' : category === 'combat' ? 'red' : category === 'exploration' ? 'purple' : category === 'economy' ? 'yellow' : 'indigo'}-500/50` 
                        : 'bg-gray-800/30 border-gray-700/50'
                      }
                    `}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`text-2xl ${isUnlocked ? '' : 'opacity-40 grayscale'}`}>
                        <GameIcon icon={achievement.icon} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className={`font-semibold ${isUnlocked ? 'text-white' : 'text-gray-400'}`}>
                            {achievement.name}
                          </div>
                          {isUnlocked && (
                            <div className="text-green-400 text-lg flex-shrink-0"><GameIcon icon="✓" /></div>
                          )}
                        </div>
                        <div className={`text-xs mb-2 ${isUnlocked ? 'text-gray-300' : 'text-gray-500'}`}>
                          <IconText>{achievement.description}</IconText>
                        </div>

                        {/* Progress bar for incomplete achievements */}
                        {!isUnlocked && progress.target > 0 && (
                          <div className="mb-2">
                            <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                              <span>Прогресс: {progress.current.toLocaleString()} / {progress.target.toLocaleString()}</span>
                              <span>{progress.percent}%</span>
                            </div>
                            <div className="w-full bg-gray-700 rounded-full h-1.5 overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-300"
                                style={{ width: `${progress.percent}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Rewards */}
                        {achievement.reward && (
                          <div className="flex flex-wrap gap-2 text-xs">
                            {achievement.reward.credits && D(achievement.reward.credits).gt(0) && (
                              <span className={`px-2 py-0.5 rounded ${isUnlocked ? 'bg-yellow-500/20 text-yellow-300' : 'bg-gray-700/50 text-gray-500'}`}>
                                <GameIcon icon="💰" /> {D(achievement.reward.credits).toNumber().toLocaleString()}
                              </span>
                            )}
                            {achievement.reward.researchPoints && D(achievement.reward.researchPoints).gt(0) && (
                              <span className={`px-2 py-0.5 rounded ${isUnlocked ? 'bg-blue-500/20 text-blue-300' : 'bg-gray-700/50 text-gray-500'}`}>
                                <GameIcon icon="🔬" /> {D(achievement.reward.researchPoints).toNumber().toLocaleString()}
                              </span>
                            )}
                            {achievement.reward.influence && D(achievement.reward.influence).gt(0) && (
                              <span className={`px-2 py-0.5 rounded ${isUnlocked ? 'bg-purple-500/20 text-purple-300' : 'bg-gray-700/50 text-gray-500'}`}>
                                <GameIcon icon="👑" /> {D(achievement.reward.influence).toNumber().toLocaleString()}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Unlock timestamp */}
                        {isUnlocked && achievements.unlocked[achievement.id] && (
                          <div className="text-xs text-gray-500 mt-2">
                            Разблокировано: {new Date(achievements.unlocked[achievement.id]).toLocaleString('ru-RU')}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
