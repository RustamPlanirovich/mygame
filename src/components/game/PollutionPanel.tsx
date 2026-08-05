import { useGameStore } from '../../features/gameStore';
import { formatNumber } from '../../core/math/format';
import { RESOURCE_SHORT } from '../../core/constants/labels';
import { GameIcon } from '../ui';

export const PollutionPanel = () => {
  const pollution = useGameStore((s) => s.pollution);

  const wasteNum = Number(pollution.wasteAmount.toString());
  const radioactiveNum = Number(pollution.radioactiveWasteAmount.toString());
  const efficiencyPercent = (pollution.efficiencyMultiplier * 100).toFixed(1);

  // Color based on efficiency
  const getEfficiencyColor = () => {
    const eff = pollution.efficiencyMultiplier;
    if (eff >= 0.9) return 'text-green-400';
    if (eff >= 0.7) return 'text-yellow-400';
    if (eff >= 0.5) return 'text-orange-400';
    return 'text-red-400';
  };

  // Show warning if pollution is high
  const showWarning = pollution.efficiencyMultiplier < 0.9;

  return (
    <div className="bg-cyber-darker/50 border border-cyber-gray rounded p-2 space-y-1.5">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-cyber-text flex items-center gap-1.5">
          <GameIcon icon={RESOURCE_SHORT.waste} />
          Экология
        </h3>
        <span className={`text-xs font-mono ${getEfficiencyColor()}`}>
          {efficiencyPercent}%
        </span>
      </div>

      {/* Waste Amount */}
      <div className="space-y-0.5">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-cyber-text-dim flex items-center gap-1">
            <GameIcon icon={RESOURCE_SHORT.waste} /> Мусор
          </span>
          <span className="text-cyber-text font-mono">{formatNumber(wasteNum)}</span>
        </div>
        <div className="h-1 bg-cyber-black/50 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-yellow-600 to-orange-500 transition-all duration-300"
            style={{ width: `${Math.min(100, (wasteNum / 1000) * 10)}%` }}
          />
        </div>
      </div>

      {/* Radioactive Waste */}
      {radioactiveNum > 0 && (
        <div className="space-y-0.5">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-cyber-text-dim flex items-center gap-1">
              <GameIcon icon={RESOURCE_SHORT.radioactive_waste} /> Рад. отходы
            </span>
            <span className="text-cyber-text font-mono">{formatNumber(radioactiveNum)}</span>
          </div>
          <div className="h-1 bg-cyber-black/50 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-green-500 to-yellow-500 transition-all duration-300 animate-pulse"
              style={{ width: `${Math.min(100, (radioactiveNum / 500) * 10)}%` }}
            />
          </div>
        </div>
      )}

      {/* Warning Message - компактное */}
      {showWarning && (
        <div className="text-[10px] text-cyber-text-dim bg-red-900/10 border border-red-700/20 rounded p-1.5">
          <GameIcon icon="💡" /> Постройте Переработчик для снижения загрязнения
        </div>
      )}

      {/* Pollution Zones Info */}
      {pollution.pollutionZones.length > 0 && (
        <div className="text-[10px] text-green-400 bg-green-900/10 border border-green-700/20 rounded p-1.5">
          <GameIcon icon="♻️" /> {pollution.pollutionZones.length} зон переработки
        </div>
      )}
    </div>
  );
};
