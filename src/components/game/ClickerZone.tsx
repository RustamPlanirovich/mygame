import { useState } from 'react';
import { useGameStore } from '../../features/gameStore';
import { Zap } from 'lucide-react';

export function ClickerZone() {
  const addResource = useGameStore(state => state.addResource);
  const [isActive, setIsActive] = useState(false);

  const handleClick = () => {
    addResource('energy', 1);
    setIsActive(true);
    setTimeout(() => setIsActive(false), 100);
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 sm:p-8 md:border-r border-b md:border-b-0 border-cyber-gray bg-cyber-dark/50 h-full">
      <div className="mb-8 text-center">
        <h2 className="text-2xl text-cyber-green mb-2">РУЧНОЙ РЕЖИМ</h2>
        <p className="text-gray-500 text-sm">Аварийная система генерации энергии</p>
      </div>

      <button 
        onClick={handleClick}
        className={`
          w-40 h-40 sm:w-48 sm:h-48 rounded-full border-4 border-cyber-green 
          flex flex-col items-center justify-center
          transition-all duration-100
          hover:shadow-[0_0_30px_rgba(0,255,157,0.4)]
          active:scale-95
          ${isActive ? 'bg-cyber-green/20 shadow-[0_0_50px_rgba(0,255,157,0.6)]' : 'bg-transparent'}
        `}
      >
        <Zap size={56} className={isActive ? 'text-white' : 'text-cyber-green'} />
        <span className="mt-2 font-bold text-cyber-green">ГЕНЕРИРОВАТЬ</span>
      </button>
    </div>
  );
}
