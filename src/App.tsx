import { useEffect } from 'react';
import { useGameLoop } from './hooks/useGameLoop';
import { useGameStore } from './features/gameStore';
import { ResourcePanel } from './components/game/ResourcePanel';
import { FactoryGrid } from './components/game/FactoryGrid';
import { SidePanelTabs } from './components/game/SidePanelTabs';
import { ClickerZone } from './components/game/ClickerZone';

function App() {
  const loadGame = useGameStore(state => state.loadGame);
  const buildings = useGameStore(state => state.buildings);
  
  // Initialize game loop
  useGameLoop();

  // Load save on mount
  useEffect(() => {
    loadGame();
  }, [loadGame]);

  // Показываем кликер только если нет ни одного генератора
  const showClicker = buildings.find(b => b.id === 'generator_mk1')?.count === 0;

  return (
    <div className="h-[100dvh] flex bg-cyber-black text-cyber-text overflow-hidden">
      {/* Центральная область - игровое поле */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="shrink-0 border-b border-cyber-gray bg-cyber-dark">
          <ResourcePanel />
        </div>
        <section className="flex-1 overflow-hidden">
          {showClicker ? (
            <div className="h-full flex flex-col">
              <div className="flex-1">
                <FactoryGrid />
              </div>
              <div className="shrink-0 h-[280px] border-t border-cyber-gray">
                <ClickerZone />
              </div>
            </div>
          ) : (
            <div className="h-full">
              <FactoryGrid />
            </div>
          )}
        </section>
      </main>

      {/* Правая панель управления */}
      <aside className="w-[420px] shrink-0 border-l border-cyber-gray bg-cyber-darker flex flex-col overflow-hidden">
        <div className="shrink-0 border-b border-cyber-gray bg-cyber-dark p-3">
          <h1 className="text-base font-bold text-cyber-green">🏭 Фабрика</h1>
          <p className="text-[10px] text-cyber-text-dim mt-0.5">Управление производством</p>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          <SidePanelTabs />
        </div>
      </aside>
    </div>
  );
}

export default App;
