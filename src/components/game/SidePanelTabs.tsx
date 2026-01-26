import { useMemo, useState, useEffect } from 'react';
import { useGameStore } from '../../features/gameStore';
import { TileInspector } from './TileInspector';
import { CombatPanel } from './CombatPanel';
import { MarketPanel } from './MarketPanel';
import { ResearchPanel } from './ResearchPanel';
import { DemonsPanel } from './DemonsPanel';
import { PrestigePanel } from './PrestigePanel';
import { ArtifactsPanel } from './ArtifactsPanel';
import { DailyRewardsPanel } from './DailyRewardsPanel';
import { ProductionChainVisualizer } from './ProductionChainVisualizer';
import { ExpeditionPanel } from './ExpeditionPanel';
import { BuildingList } from './BuildingList';
import { DepositBuildPanel } from './DepositBuildPanel';
import { PoliticsPanel } from './PoliticsPanel';
import { GalaxyMap } from './GalaxyMap';
import { PlatformsPanel } from './PlatformsPanel';
import { FleetPanel } from './FleetPanel';
import { IntergalacticLogisticsPanel } from './IntergalacticLogisticsPanel';
import { RandomEventsPanel } from './RandomEventsPanel';
import AchievementsPanel from './AchievementsPanel';
import { MegastructuresPanel } from './MegastructuresPanel';
import { QuestsPanel } from './QuestsPanel';
import { HelpPanel } from './HelpPanel';
import { Search, Swords, Store, FlaskConical, Ghost, Sparkles, Rocket, Hammer, Landmark, ChevronLeft, Globe, Satellite, Ship, Truck, Zap, Trophy, Building2, ClipboardList, BookOpen, Gift, CalendarDays, Network } from 'lucide-react';
import type { DepositType } from '../../core/gameTypes';

type TabId =
  | 'inspector'
  | 'combat'
  | 'market'
  | 'research'
  | 'demons'
  | 'prestige'
  | 'artifacts'
  | 'rewards'
  | 'chains'
  | 'expedition'
  | 'building'
  | 'deposit'
  | 'politics'
  | 'galaxies'
  | 'platforms'
  | 'fleet'
  | 'logistics'
  | 'events'
  | 'achievements'
  | 'megastructures'
  | 'quests'
  | 'help';

export function SidePanelTabs() {
  const mainGrid = useGameStore((s) => s.grid);
  const activePlatformId = useGameStore((s) => s.galaxies.activePlatformId);
  const platforms = useGameStore((s) => s.galaxies.platforms);
  const activeEventsCount = useGameStore(s => s.randomEvents.activeEvents.filter(e => e.status === 'pending').length);
  const unlockedAchievementsCount = useGameStore(s => Object.keys(s.achievements.unlocked).length);
  const recentAchievementsCount = useGameStore(s => {
    const now = Date.now();
    return s.achievements.recentlyUnlocked.filter(a => now - a.unlockedAt < 10000).length;
  });
  
  // Получаем квесты из стора
  const quests = useGameStore(s => s.quests.activeQuests);
  const claimQuestReward = useGameStore(s => s.claimQuestReward);
  
  // Получаем активный грид (платформа или основная база)
  const grid = activePlatformId 
    ? platforms.find(p => p.id === activePlatformId)?.grid || mainGrid
    : mainGrid;
  
  // Определяем тип выбранной клетки
  const selectedKey = grid.selected ? `${grid.selected.x},${grid.selected.y}` : null;
  const buildingId = selectedKey ? grid.tiles[selectedKey] : null;
  const deposit = selectedKey ? grid.deposits?.[selectedKey] : null;
  
  // Проверяем, является ли выбранная клетка базой (только для главной базы, не для платформ)
  const isBaseSelected = !activePlatformId && grid.selected ? 
    grid.selected.x === Math.floor(grid.width / 2) && grid.selected.y === Math.floor(grid.height / 2) 
    : false;

  const tabs = useMemo(
    () =>
      [
        { id: 'building' as const, label: 'Строительство', icon: Hammer, Component: BuildingList },
        { id: 'inspector' as const, label: 'Инспектор', icon: Search, Component: TileInspector },
        { id: 'quests' as const, label: 'Квесты', icon: ClipboardList, Component: () => <QuestsPanel quests={quests} onClaimReward={claimQuestReward} /> },
        { id: 'combat' as const, label: 'Бой', icon: Swords, Component: CombatPanel },
        { id: 'market' as const, label: 'Рынок', icon: Store, Component: MarketPanel },
        { id: 'research' as const, label: 'Исследования', icon: FlaskConical, Component: ResearchPanel },
        { id: 'politics' as const, label: 'Политика', icon: Landmark, Component: PoliticsPanel },
        { id: 'galaxies' as const, label: 'Галактики', icon: Globe, Component: GalaxyMap },
        { id: 'platforms' as const, label: 'Платформы', icon: Satellite, Component: PlatformsPanel },
        { id: 'fleet' as const, label: 'Флот', icon: Ship, Component: FleetPanel },
        { id: 'logistics' as const, label: 'Логистика', icon: Truck, Component: IntergalacticLogisticsPanel },
        { id: 'events' as const, label: 'События', icon: Zap, Component: RandomEventsPanel },
        { id: 'achievements' as const, label: 'Достижения', icon: Trophy, Component: AchievementsPanel },
        { id: 'megastructures' as const, label: 'Мегаструктуры', icon: Building2, Component: MegastructuresPanel },
        { id: 'help' as const, label: 'Справка', icon: BookOpen, Component: HelpPanel },
        { id: 'demons' as const, label: 'Демоны', icon: Ghost, Component: DemonsPanel },
        { id: 'prestige' as const, label: 'Престиж', icon: Sparkles, Component: PrestigePanel },
        { id: 'artifacts' as const, label: 'Артефакты', icon: Gift, Component: ArtifactsPanel },
        { id: 'rewards' as const, label: 'Награды', icon: CalendarDays, Component: DailyRewardsPanel },
        { id: 'chains' as const, label: 'Цепочки', icon: Network, Component: ProductionChainVisualizer },
        { id: 'expedition' as const, label: 'Экспедиция', icon: Rocket, Component: ExpeditionPanel },
      ],
    [quests, claimQuestReward],
  );

  const [active, setActive] = useState<TabId | null>(null);

  // Автоматическое переключение при выборе клетки
  useEffect(() => {
    if (!selectedKey) {
      // Пустая клетка - возвращаемся в главное меню
      setActive(null);
    } else if (isBaseSelected) {
      // База - открываем инспектор
      setActive('inspector');
    } else if (buildingId) {
      // Клетка с постройкой - открываем инспектор
      setActive('inspector');
    } else if (deposit) {
      // Клетка с ресурсом - открываем панель рекомендаций
      setActive('deposit');
    } else {
      // Пустая клетка без ресурса - возвращаемся в меню
      setActive(null);
    }
  }, [selectedKey, buildingId, deposit, isBaseSelected]);

  const activeTab = tabs.find((t) => t.id === active);

  // Специальный рендер для панели с месторождением
  const renderContent = () => {
    if (active === 'deposit' && deposit) {
      return <DepositBuildPanel deposit={deposit as DepositType} />;
    }
    const Comp = activeTab?.Component;
    return Comp ? <Comp /> : null;
  };

  const getTitle = () => {
    if (active === 'deposit' && deposit) {
      const labels: Record<DepositType, string> = {
        ore: 'Месторождение: Руда',
        ice: 'Месторождение: Лёд',
        carbon: 'Месторождение: Углерод',
        natural_gas: 'Месторождение: Природный газ',
        oil: 'Месторождение: Нефть',
        sand: 'Месторождение: Песок',
        uranium: 'Месторождение: Уран',
        chrome: 'Месторождение: Хром',
        titanium: 'Месторождение: Титан',
        copper: 'Месторождение: Медь',
      };
      return labels[deposit as DepositType] || 'Месторождение';
    }
    return activeTab?.label || '';
  };

  const getIcon = () => {
    if (active === 'deposit') {
      return Hammer;
    }
    return activeTab?.icon;
  };

  return (
    <div className="flex flex-col h-full bg-cyber-darker">
      {!active ? (
        // Главное меню - список всех пунктов
        <div className="p-3 space-y-2">
          {tabs.map((t) => {
            const Icon = t.icon;
            const hasEventNotification = t.id === 'events' && activeEventsCount > 0;
            const hasAchievementNotification = t.id === 'achievements' && recentAchievementsCount > 0;
            const notificationCount = hasEventNotification ? activeEventsCount : hasAchievementNotification ? recentAchievementsCount : 0;
            const showBadge = hasEventNotification || hasAchievementNotification || (t.id === 'achievements' && unlockedAchievementsCount > 0);
            
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActive(t.id)}
                className="w-full flex items-center gap-3 p-3 rounded transition-all border border-cyber-gray/50 bg-cyber-gray/20 hover:bg-cyber-gray/30 hover:border-cyber-green/50 text-cyber-text relative"
              >
                <Icon size={20} className="text-cyber-blue" />
                <span className="text-sm font-medium">{t.label}</span>
                {showBadge && (
                  <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${
                    hasEventNotification || hasAchievementNotification 
                      ? 'bg-yellow-500 text-black animate-pulse' 
                      : 'bg-purple-500 text-white'
                  }`}>
                    {notificationCount > 0 ? notificationCount : unlockedAchievementsCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        // Открытый пункт меню
        <div className="flex flex-col h-full">
          {/* Шапка с кнопкой назад */}
          <div className="shrink-0 bg-cyber-dark border-b border-cyber-gray p-3">
            <button
              type="button"
              onClick={() => setActive(null)}
              className="flex items-center gap-2 text-cyber-text hover:text-cyber-green transition-colors"
            >
              <ChevronLeft size={18} />
              <span className="text-sm font-medium">Назад</span>
            </button>
            <h2 className="text-base font-bold text-cyber-green mt-2 flex items-center gap-2">
              {getIcon() && <>{(() => { const Icon = getIcon()!; return <Icon size={18} />; })()}</>}
              {getTitle()}
            </h2>
          </div>
          
          {/* Контент */}
          <div className="flex-1 overflow-y-auto">
            {renderContent()}
          </div>
        </div>
      )}
    </div>
  );
}
