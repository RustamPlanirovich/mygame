import { useGameStore } from '../../features/gameStore';
import { formatNumber } from '../../core/math/format';
import { GameIcon } from '../ui/icons';

export function EnergyBalancePanel() {
  const energyProduction = useGameStore((s) => s.energyProduction);
  const energyConsumption = useGameStore((s) => s.energyConsumption);
  const energyEfficiency = useGameStore((s) => s.energyEfficiency);
  
  // Calculate percentage for progress bar
  const percentage = energyConsumption.gt(0) 
    ? Math.min(100, energyProduction.div(energyConsumption).mul(100).toNumber())
    : 100;
  
  // Determine color based on efficiency
  const getStatusColor = () => {
    if (energyEfficiency >= 1.0) return 'bg-green-500';
    if (energyEfficiency >= 0.75) return 'bg-yellow-500';
    if (energyEfficiency >= 0.5) return 'bg-orange-500';
    return 'bg-red-500';
  };
  
  const getTextColor = () => {
    if (energyEfficiency >= 1.0) return 'text-green-400';
    if (energyEfficiency >= 0.75) return 'text-yellow-400';
    if (energyEfficiency >= 0.5) return 'text-orange-400';
    return 'text-red-400';
  };

  const isDeficit = energyEfficiency < 1.0;

  return (
    <div className="bg-cyber-darker/50 rounded border border-cyber-gray p-2">
      <div className="flex items-center justify-between mb-1.5">
        <h3 className="text-xs font-semibold text-cyber-text flex items-center gap-1.5">
          <GameIcon icon="⚡" /> Энергобаланс
        </h3>
        <span className={`text-xs font-mono ${getTextColor()}`}>
          {(energyEfficiency * 100).toFixed(0)}%
        </span>
      </div>
      
      {/* Energy Bar */}
      <div className="relative w-full h-4 bg-cyber-black/50 rounded overflow-hidden mb-2">
        <div 
          className={`h-full ${getStatusColor()} transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
        <div className="absolute inset-0 flex items-center justify-center text-[10px] font-mono text-white drop-shadow-elev-3">
          {formatNumber(energyProduction)} / {formatNumber(energyConsumption)}
        </div>
      </div>
      
      {/* Details */}
      <div className="space-y-0.5 text-xs">
        <div className="flex justify-between text-cyber-text-dim">
          <span>Производство:</span>
          <span className="font-mono text-cyber-green">+{formatNumber(energyProduction)}/с</span>
        </div>
        <div className="flex justify-between text-cyber-text-dim">
          <span>Потребление:</span>
          <span className="font-mono text-cyber-blue">-{formatNumber(energyConsumption)}/с</span>
        </div>
        <div className="flex justify-between text-cyber-text-dim">
          <span>Баланс:</span>
          <span className={`font-mono ${getTextColor()}`}>
            {energyProduction.sub(energyConsumption).gte(0) ? '+' : ''}
            {formatNumber(energyProduction.sub(energyConsumption))}/с
          </span>
        </div>
      </div>
      
      {/* Warning - более компактное */}
      {isDeficit && (
        <div className="mt-2 p-1.5 bg-red-900/20 border border-red-700/30 rounded text-[10px] text-red-300">
          <span className="font-semibold"><GameIcon icon="⚠️" /> Дефицит энергии!</span> 
          Производство снижено до {(energyEfficiency * 100).toFixed(0)}%.
          {energyEfficiency < 0.5 && (
            <span className="text-red-400 font-semibold"> Критический!</span>
          )}
        </div>
      )}
    </div>
  );
}
