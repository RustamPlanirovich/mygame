import { useGameStore } from '../../features/gameStore';
import { formatNumber } from '../../core/math/format';
import { TECHNOLOGIES } from '../../core/constants/technologies';
import { ACHIEVEMENTS } from '../../core/constants/achievements';
import { GALAXIES } from '../../core/constants/galaxies';
import { UserCircle } from 'lucide-react';

interface DashboardProps {
  onOpenProfile: () => void;
}

export const Dashboard = ({ onOpenProfile }: DashboardProps) => {
  const buildings = useGameStore(state => state.buildings);
  const grid = useGameStore(state => state.grid);
  const research = useGameStore(state => state.research);
  const fleet = useGameStore(state => state.fleet);
  const galaxies = useGameStore(state => state.galaxies);
  const combat = useGameStore(state => state.combat);
  const achievementsData = useGameStore(state => state.achievements);
  const artifacts = useGameStore(state => state.artifacts);

  // Подсчет статистики
  const totalBuildings = buildings.reduce((sum, b) => sum + b.count, 0);
  const totalTileCount = Object.keys(grid.tiles).length;
  
  const unlockedTech = Object.values(research.technologies).filter(Boolean).length;
  const totalTech = Object.keys(TECHNOLOGIES).length;
  
  const totalShips = fleet.ships.length;
  const totalPlatforms = galaxies.platforms?.length || 0;
  
  const activeEnemies = combat.enemies.length;
  
  const unlockedAchievements = Object.keys(achievementsData.unlocked).length;
  const totalAchievements = ACHIEVEMENTS.length;
  
  const unlockedGalaxies = galaxies.unlockedGalaxies?.length || 0;
  const totalGalaxies = Object.keys(GALAXIES).length;

  // Основные метрики - компактно
  const mainStats = [
    {
      label: 'Зданий',
      value: totalBuildings,
      icon: '🏗️',
      color: 'text-blue-400',
    },
    {
      label: 'Клеток занято',
      value: totalTileCount,
      icon: '📐',
      color: 'text-purple-400',
    },
    {
      label: 'Технологий',
      value: `${unlockedTech}/${totalTech}`,
      icon: '🔬',
      color: 'text-green-400',
    },
    {
      label: 'Кораблей',
      value: totalShips,
      icon: '🚀',
      color: 'text-cyan-400',
    },
  ];

  // Дополнительные метрики - показываются только при наличии
  const secondaryStats = [
    {
      label: 'Платформ',
      value: totalPlatforms,
      icon: '🛰️',
      color: 'text-yellow-400',
      show: totalPlatforms > 0,
    },
    {
      label: 'Активных врагов',
      value: activeEnemies,
      icon: '👾',
      color: 'text-red-400',
      show: activeEnemies > 0,
    },
    {
      label: 'Достижений',
      value: `${unlockedAchievements}/${totalAchievements}`,
      icon: '🏆',
      color: 'text-amber-400',
      show: unlockedAchievements > 0,
    },
    {
      label: 'Галактик',
      value: `${unlockedGalaxies}/${totalGalaxies}`,
      icon: '🌌',
      color: 'text-indigo-400',
      show: unlockedGalaxies > 0,
    },
    {
      label: 'Артефактов',
      value: `${artifacts.equipped.length}/${artifacts.discovered.length}`,
      icon: '✨',
      color: 'text-purple-400',
      show: artifacts.discovered.length > 0,
    },
  ].filter(s => s.show);

  return (
    <div className="px-3 py-2 bg-cyber-darker border-b border-cyber-gray animate-fade-in">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap flex-1">
          {mainStats.map((stat, index) => (
            <div
              key={index}
              className="flex items-center gap-1.5 px-2 py-1 rounded bg-cyber-dark/50 border border-cyber-gray/30 hover:border-cyber-green/50 transition-all"
              title={stat.label}
            >
              <span className="text-base">{stat.icon}</span>
              <div className="flex flex-col">
                <span className="text-[9px] text-cyber-text-dim uppercase">{stat.label}</span>
                <span className={`text-sm font-bold ${stat.color}`}>
                  {typeof stat.value === 'number' ? formatNumber(stat.value) : stat.value}
                </span>
              </div>
            </div>
          ))}
        
          {/* Дополнительные метрики показываем только если есть */}
          {secondaryStats.map((stat, index) => (
            <div
              key={`secondary-${index}`}
              className="flex items-center gap-1.5 px-2 py-1 rounded bg-cyber-dark/30 border border-cyber-gray/20 hover:border-cyber-green/30 transition-all"
              title={stat.label}
            >
              <span className="text-base opacity-80">{stat.icon}</span>
              <div className="flex flex-col">
                <span className="text-[9px] text-cyber-text-dim uppercase">{stat.label}</span>
                <span className={`text-sm font-bold ${stat.color}`}>
                  {typeof stat.value === 'number' ? formatNumber(stat.value) : stat.value}
                </span>
              </div>
            </div>
          ))}
        </div>
        
        {/* Подсказка о справке и кнопка профиля */}
        <div className="shrink-0 flex items-center gap-2">
          <div className="text-[10px] text-cyber-text-dim px-2 py-1 bg-cyber-dark/30 rounded border border-cyber-gray/20">
            Нажмите <kbd className="px-1 py-0.5 bg-cyber-gray/50 text-cyber-green rounded text-[9px] font-mono">F1</kbd> для справки
          </div>
          <button
            onClick={onOpenProfile}
            className="p-1.5 bg-cyber-dark/30 hover:bg-cyan-500/20 rounded border border-cyber-gray/20 hover:border-cyan-500/50 transition-colors"
            title="Профиль"
          >
            <UserCircle className="w-4 h-4 text-cyan-400" />
          </button>
        </div>
      </div>
    </div>
  );
};
