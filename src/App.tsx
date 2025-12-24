import { useEffect } from 'react';
import { useGameLoop } from './hooks/useGameLoop';
import { useGameStore } from './features/gameStore';
import { ResourcePanel } from './components/game/ResourcePanel';
import { FactoryGrid } from './components/game/FactoryGrid';
import { BuildDock } from './components/game/BuildDock';
import { SidePanelTabs } from './components/game/SidePanelTabs';

function App() {
  const loadGame = useGameStore(state => state.loadGame);
  
  // Initialize game loop
  useGameLoop();

  // Load save on mount
  useEffect(() => {
    loadGame();
  }, [loadGame]);

  return (
    <div className="h-[100dvh] flex flex-col bg-cyber-black text-cyber-text overflow-hidden">
      <div className="shrink-0 border-b border-cyber-gray bg-cyber-dark">
        <ResourcePanel />
      </div>

      <main className="flex-1 flex flex-col md:flex-row overflow-hidden pb-16">
        <aside className="w-full md:w-[360px] shrink-0 border-r border-cyber-gray bg-cyber-dark/40 overflow-y-auto">
          <SidePanelTabs />
        </aside>
        <section className="flex-1 h-full overflow-hidden">
          <FactoryGrid />
        </section>
      </main>

      <BuildDock />
    </div>
  );
}

export default App;
