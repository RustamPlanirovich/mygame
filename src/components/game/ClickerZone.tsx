import { useState } from 'react';
import { useGameStore } from '../../features/gameStore';
import { Zap } from 'lucide-react';

export function ClickerZone() {
  const addResource = useGameStore(state => state.addResource);
  const energy = useGameStore(state => state.resources.energy);
  const [isActive, setIsActive] = useState(false);
  const [clicks, setClicks] = useState(0);

  const handleClick = () => {
    addResource('energy', 1);
    setIsActive(true);
    setClicks(prev => prev + 1);
    setTimeout(() => setIsActive(false), 100);
  };

  return (
    <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-cyber-dark to-cyber-darker border-t border-cyber-gray h-full">
      {/* Инфо панель */}
      <div className="flex-1">
        <h2 className="text-lg text-cyber-green mb-1 flex items-center gap-2">
          <Zap size={20} />
          РУЧНАЯ ГЕНЕРАЦИЯ
        </h2>
        <p className="text-cyber-text-dim text-xs mb-2">
          Кликайте для получения энергии. Постройте генератор для автоматизации.
        </p>
        <div className="flex gap-4 text-xs">
          <div>
            <span className="text-cyber-text-dim">Энергия: </span>
            <span className="text-cyber-green font-bold">{energy.amount.toFixed(0)}</span>
            <span className="text-cyber-text-dim">/{energy.max.toFixed(0)}</span>
          </div>
          <div>
            <span className="text-cyber-text-dim">Кликов: </span>
            <span className="text-cyber-blue font-bold">{clicks}</span>
          </div>
        </div>
      </div>

      {/* Кнопка кликера */}
      <div className="flex flex-col items-center">
        <button 
          onClick={handleClick}
          className={`
            w-32 h-32 rounded-full border-4 border-cyber-green 
            flex flex-col items-center justify-center
            transition-all duration-100
            hover:shadow-[0_0_30px_rgba(0,255,157,0.4)]
            hover:scale-105
            active:scale-95
            ${isActive ? 'bg-cyber-green/20 shadow-[0_0_50px_rgba(0,255,157,0.6)]' : 'bg-cyber-gray/10'}
          `}
        >
          <Zap size={48} className={isActive ? 'text-white' : 'text-cyber-green'} />
          <span className="mt-1 text-xs font-bold text-cyber-green">+1 ⚡</span>
        </button>
      </div>

      {/* Подсказка */}
      <div className="flex-1 flex justify-end">
        <div className="bg-cyber-green/10 border border-cyber-green/30 rounded px-3 py-2 max-w-[200px]">
          <p className="text-xs text-cyber-green">
            💡 <strong>Совет:</strong> Постройте "Аварийный Генератор" за 5⚡ для автоматической выработки энергии
          </p>
        </div>
      </div>
    </div>
  );
}
