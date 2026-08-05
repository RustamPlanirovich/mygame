import { useGameStore } from '../../features/gameStore';
import { formatNumber } from '../../core/math/format';
// Статусы контрактов рисуются эмодзи из getStatusIcon, отдельные иконки lucide не нужны.
import { Clock, Gift, Award, Zap } from 'lucide-react';
import type { ResourceType, Contract, GameState } from '../../core/gameTypes';
import { 
  analyzeContract, 
  formatTimeRemaining, 
  getStatusIcon, 
  getStatusColor 
} from '../../utils/contractHelpers';
import { useMemo } from 'react';
import Decimal from 'break_eternity.js';
import { GameIcon, IconText } from '../ui/icons';

const getTierColor = (tier: string) => {
  switch (tier) {
    case 'easy': return 'text-green-400 border-green-500/30 bg-green-900/10';
    case 'medium': return 'text-blue-400 border-blue-500/30 bg-blue-900/10';
    case 'hard': return 'text-purple-400 border-purple-500/30 bg-purple-900/10';
    case 'epic': return 'text-orange-400 border-orange-500/30 bg-orange-900/10';
    default: return 'text-gray-400 border-gray-500/30 bg-gray-900/10';
  }
};

interface ContractCardProps {
  contract: Contract;
  state: GameState;
  affordable: boolean;
  onComplete: (id: string) => void;
}

function ContractCard({ contract, state, affordable, onComplete }: ContractCardProps) {
  const tierColor = getTierColor(contract.tier);
  const timeLeftMs = Math.max(0, contract.expiresAt - Date.now());
  const timeLeftSec = timeLeftMs / 1000;
  
  // useMemo теперь вызывается на верхнем уровне компонента
  const analysis = useMemo(() => analyzeContract(contract, state), [contract, state]);

  return (
    <div
      className={`cyber-panel border-l-4 ${tierColor}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <h4 className="font-semibold text-white text-sm"><IconText>{contract.title}</IconText></h4>
          <p className="text-xs text-cyber-text-dim"><IconText>{contract.description}</IconText></p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-1 text-xs text-cyber-text-dim">
            <Clock className="w-3 h-3" />
            <span>{formatTimeRemaining(timeLeftSec)}</span>
          </div>
          {contract.speedBonus && analysis.speedBonus && (
            <div className="flex items-center gap-1 text-xs text-yellow-400">
              <Zap className="w-3 h-3" />
              <span>Бонус</span>
            </div>
          )}
        </div>
      </div>

      {/* Analysis Panel */}
      <div className="mb-3 p-2 bg-cyber-bg-dark/50 rounded border border-cyber-border">
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-lg ${getStatusColor(analysis.overallStatus)}`}>
            <GameIcon icon={getStatusIcon(analysis.overallStatus)} />
          </span>
          <span className={`text-xs font-semibold ${getStatusColor(analysis.overallStatus)}`}>
            {analysis.overallStatus === 'ready' && 'ГОТОВО К СДАЧЕ'}
            {analysis.overallStatus === 'on_track' && 'ВСЁ ПО ПЛАНУ'}
            {analysis.overallStatus === 'at_risk' && 'НУЖНО УСКОРИТЬСЯ'}
            {analysis.overallStatus === 'will_fail' && 'НЕ УСПЕЕТЕ!'}
          </span>
        </div>

        {/* Resource Analysis Table */}
        <div className="text-xs space-y-1">
          {analysis.perResource.map((res) => {
            const progress = res.needed.gt(0) 
              ? res.current.div(res.needed).times(100).toNumber() 
              : 100;
            const progressClamped = Math.min(100, Math.max(0, progress));

            return (
              <div key={res.resource} className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-cyber-text-dim">{res.resource}</span>
                  <div className="flex items-center gap-2">
                    <span className={res.willComplete ? 'text-green-400' : 'text-red-400'}>
                      {formatNumber(res.current)} / {formatNumber(res.needed)}
                    </span>
                    {res.production.gt(0) && (
                      <span className="text-xs text-cyber-text-dim">
                        ({formatNumber(res.production)}/с)
                      </span>
                    )}
                    {res.etaSeconds !== Infinity && res.etaSeconds > 0 && (
                      <span className={`text-xs ${res.willComplete ? 'text-blue-400' : 'text-red-400'}`}>
                        ETA: {formatTimeRemaining(res.etaSeconds)}
                      </span>
                    )}
                  </div>
                </div>
                {/* Progress bar */}
                <div className="w-full h-1 bg-cyber-bg-dark rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all ${
                      res.willComplete ? 'bg-green-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${progressClamped}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Suggestion */}
        {analysis.suggestion && (
          <div className="mt-2 text-xs text-cyber-text-dim italic border-t border-cyber-border pt-2">
            {analysis.suggestion}
          </div>
        )}
      </div>

      {/* Rewards */}
      <div className="mb-3">
        <div className="text-xs text-cyber-text-dim mb-1 flex items-center gap-1">
          <Award className="w-3 h-3" />
          Награды:
        </div>
        <div className="flex gap-3 text-xs flex-wrap">
          {contract.rewards.credits && (
            <span className="text-yellow-400">
              <GameIcon icon="💰" /> {formatNumber(contract.rewards.credits)}
            </span>
          )}
          {contract.rewards.researchPoints && (
            <span className="text-blue-400">
              <GameIcon icon="🔬" /> {formatNumber(contract.rewards.researchPoints)}
            </span>
          )}
          {contract.rewards.influence && (
            <span className="text-purple-400">
              <GameIcon icon="👑" /> {formatNumber(contract.rewards.influence)}
            </span>
          )}
          {analysis.speedBonus && contract.speedBonus?.credits && (
            <span className="text-yellow-300 flex items-center gap-1">
              <Zap className="w-3 h-3" />
              +{formatNumber(contract.speedBonus.credits)}
            </span>
          )}
        </div>
      </div>

      {/* Complete Button */}
      <button
        onClick={() => onComplete(contract.id)}
        disabled={!affordable}
        className={`w-full py-2 rounded-lg text-sm font-semibold transition-all ${
          affordable
            ? 'bg-cyber-green hover:bg-cyber-green/90 text-white shadow-elev-3 shadow-cyber-green/20'
            : 'bg-cyber-gray/20 text-cyber-gray-light cursor-not-allowed'
        }`}
      >
        {affordable ? 'ВЫПОЛНИТЬ' : 'НЕДОСТАТОЧНО РЕСУРСОВ'}
      </button>
    </div>
  );
}

export function ContractsPanel() {
  const state = useGameStore();
  const contracts = state.market.contracts ?? [];
  const completeContract = state.completeContract;

  const canComplete = (contractId: string) => {
    const contract = contracts.find(c => c.id === contractId);
    if (!contract) return false;
    
    for (const [resType, amount] of Object.entries(contract.requirements)) {
      const rType = resType as ResourceType;
      const rawValue = state.grid.buffers.base?.[rType];
      const have = rawValue != null ? new Decimal(rawValue) : new Decimal(0);
      if (have.lt(amount)) return false;
    }
    return true;
  };

  if (contracts.length === 0) {
    return (
      <div className="p-4 text-center text-cyber-text-dim">
        <Gift className="w-12 h-12 mx-auto mb-2 opacity-30" />
        <p>Нет доступных контрактов</p>
        <p className="text-xs mt-1">Новые контракты появляются автоматически</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2 mb-3">
        <Gift className="w-5 h-5 text-cyber-green" />
        <h3 className="text-lg font-semibold text-cyber-green">Контракты</h3>
        <span className="text-xs text-cyber-text-dim">({contracts.length}/5)</span>
      </div>

      {contracts.map((contract) => (
        <ContractCard
          key={contract.id}
          contract={contract}
          state={state}
          affordable={canComplete(contract.id)}
          onComplete={completeContract}
        />
      ))}
    </div>
  );
}
