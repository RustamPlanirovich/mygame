import { useMemo, useState, useEffect } from 'react';
import { useGameStore } from '../../features/gameStore';
import { TileInspector } from './TileInspector';
import { CombatPanel } from './CombatPanel';
import { MarketPanel } from './MarketPanel';
import { ResearchPanel } from './ResearchPanel';
import { DemonsPanel } from './DemonsPanel';
import { PrestigePanel } from './PrestigePanel';
import { ExpeditionPanel } from './ExpeditionPanel';
import { BuildingList } from './BuildingList';
import { DepositBuildPanel } from './DepositBuildPanel';
import { Search, Swords, Store, FlaskConical, Ghost, Sparkles, Rocket, Hammer, ChevronLeft } from 'lucide-react';
import type { DepositType } from '../../core/gameTypes';

type TabId =
  | 'inspector'
  | 'combat'
  | 'market'
  | 'research'
  | 'demons'
  | 'prestige'
  | 'expedition'
  | 'building'
  | 'deposit';

export function SidePanelTabs() {
  const grid = useGameStore((s) => s.grid);
  
  // Определяем тип выбранной клетки
  const selectedKey = grid.selected ? `${grid.selected.x},${grid.selected.y}` : null;
  const buildingId = selectedKey ? grid.tiles[selectedKey] : null;
  const deposit = selectedKey ? grid.deposits?.[selectedKey] : null;

  const tabs = useMemo(
    () =>
      [
        { id: 'building' as const, label: 'Строительство', icon: Hammer, Node: <BuildingList /> },
        { id: 'inspector' as const, label: 'Инспектор', icon: Search, Node: <TileInspector /> },
        { id: 'combat' as const, label: 'Бой', icon: Swords, Node: <CombatPanel /> },
        { id: 'market' as const, label: 'Рынок', icon: Store, Node: <MarketPanel /> },
        { id: 'research' as const, label: 'Исследования', icon: FlaskConical, Node: <ResearchPanel /> },
        { id: 'demons' as const, label: 'Демоны', icon: Ghost, Node: <DemonsPanel /> },
        { id: 'prestige' as const, label: 'Престиж', icon: Sparkles, Node: <PrestigePanel /> },
        { id: 'expedition' as const, label: 'Экспедиция', icon: Rocket, Node: <ExpeditionPanel /> },
      ],
    [],
  );

  const [active, setActive] = useState<TabId | null>(null);

  // Автоматическое переключение при выборе клетки
  useEffect(() => {
    if (!selectedKey) {
      // Пустая клетка - возвращаемся в главное меню
      setActive(null);
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
  }, [selectedKey, buildingId, deposit]);

  const activeTab = tabs.find((t) => t.id === active);

  // Специальный рендер для панели с месторождением
  const renderContent = () => {
    if (active === 'deposit' && deposit) {
      return <DepositBuildPanel deposit={deposit as DepositType} />;
    }
    return activeTab?.Node;
  };

  const getTitle = () => {
    if (active === 'deposit' && deposit) {
      const labels: Record<DepositType, string> = {
        ore: 'Месторождение: Руда',
        ice: 'Месторождение: Лёд',
        carbon: 'Месторождение: Углерод',
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
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActive(t.id)}
                className="w-full flex items-center gap-3 p-3 rounded transition-all border border-cyber-gray/50 bg-cyber-gray/20 hover:bg-cyber-gray/30 hover:border-cyber-green/50 text-cyber-text"
              >
                <Icon size={20} className="text-cyber-blue" />
                <span className="text-sm font-medium">{t.label}</span>
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
