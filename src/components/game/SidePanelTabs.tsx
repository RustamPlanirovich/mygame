import { useMemo, useState } from 'react';
import { TileInspector } from './TileInspector';
import { CombatPanel } from './CombatPanel';
import { MarketPanel } from './MarketPanel';
import { ResearchPanel } from './ResearchPanel';
import { DemonsPanel } from './DemonsPanel';
import { PrestigePanel } from './PrestigePanel';
import { ExpeditionPanel } from './ExpeditionPanel';

type TabId =
  | 'inspector'
  | 'combat'
  | 'market'
  | 'research'
  | 'demons'
  | 'prestige'
  | 'expedition';

export function SidePanelTabs() {
  const tabs = useMemo(
    () =>
      [
        { id: 'inspector' as const, label: 'Инспектор', Node: <TileInspector /> },
        { id: 'combat' as const, label: 'Бой', Node: <CombatPanel /> },
        { id: 'market' as const, label: 'Рынок', Node: <MarketPanel /> },
        { id: 'research' as const, label: 'Исслед.', Node: <ResearchPanel /> },
        { id: 'demons' as const, label: 'Демоны', Node: <DemonsPanel /> },
        { id: 'prestige' as const, label: 'Престиж', Node: <PrestigePanel /> },
        { id: 'expedition' as const, label: 'Экспедиция', Node: <ExpeditionPanel /> },
      ],
    [],
  );

  const [active, setActive] = useState<TabId>('inspector');

  const activeNode = tabs.find((t) => t.id === active)?.Node ?? tabs[0]!.Node;

  return (
    <section className="h-full overflow-hidden md:border-l border-cyber-gray bg-cyber-black/50">
      <div className="sticky top-0 z-10 bg-cyber-black/70 backdrop-blur border-b border-cyber-gray">
        <div className="px-3 py-2 overflow-x-auto">
          <div className="flex items-center gap-2 min-w-max">
            {tabs.map((t) => {
              const isActive = t.id === active;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActive(t.id)}
                  className={
                    `cyber-button px-3 py-2 h-9 text-xs ` +
                    (isActive ? 'border-cyber-green text-cyber-green' : 'opacity-80')
                  }
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="h-full overflow-y-auto pb-16">
        {activeNode}
      </div>
    </section>
  );
}
