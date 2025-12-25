import { useGameStore } from '../../features/gameStore';
import { formatNumber } from '../../core/math/format';
import { Clock, Gift, Award } from 'lucide-react';
import type { ResourceType } from '../../core/gameTypes';

export function ContractsPanel() {
  const contracts = useGameStore((s) => s.market.contracts ?? []);
  const completeContract = useGameStore((s) => s.completeContract);
  const buffers = useGameStore((s) => s.grid.buffers);

  const getBuf = (key: string, type: ResourceType) => {
    const val = buffers[key]?.[type];
    return val ? (typeof val === 'string' ? parseFloat(val) : val) : 0;
  };

  const canComplete = (contractId: string) => {
    const contract = contracts.find(c => c.id === contractId);
    if (!contract) return false;
    
    for (const [resType, amount] of Object.entries(contract.requirements)) {
      const rType = resType as ResourceType;
      const have = getBuf('base', rType);
      if (have < Number(amount.toString())) return false;
    }
    return true;
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'easy': return 'text-green-400 border-green-500/30 bg-green-900/10';
      case 'medium': return 'text-blue-400 border-blue-500/30 bg-blue-900/10';
      case 'hard': return 'text-purple-400 border-purple-500/30 bg-purple-900/10';
      case 'epic': return 'text-orange-400 border-orange-500/30 bg-orange-900/10';
      default: return 'text-gray-400 border-gray-500/30 bg-gray-900/10';
    }
  };

  const getTimeLeft = (expiresAt: number) => {
    const ms = Math.max(0, expiresAt - Date.now());
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    return minutes > 0 ? `${minutes}м ${seconds % 60}с` : `${seconds}с`;
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
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-2 mb-3">
        <Gift className="w-5 h-5 text-cyber-green" />
        <h3 className="text-lg font-semibold text-cyber-green">Контракты</h3>
        <span className="text-xs text-cyber-text-dim">({contracts.length}/5)</span>
      </div>

      {contracts.map((contract) => {
        const affordable = canComplete(contract.id);
        const tierColor = getTierColor(contract.tier);
        const timeLeft = getTimeLeft(contract.expiresAt);

        return (
          <div
            key={contract.id}
            className={`cyber-panel border-l-4 ${tierColor}`}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-2">
              <div>
                <h4 className="font-semibold text-white text-sm">{contract.title}</h4>
                <p className="text-xs text-cyber-text-dim">{contract.description}</p>
              </div>
              <div className="flex items-center gap-1 text-xs text-cyber-text-dim">
                <Clock className="w-3 h-3" />
                <span>{timeLeft}</span>
              </div>
            </div>

            {/* Requirements */}
            <div className="mb-2">
              <div className="text-xs text-cyber-text-dim mb-1">Требования:</div>
              <div className="grid grid-cols-2 gap-1 text-xs">
                {Object.entries(contract.requirements).map(([resType, amount]) => {
                  const rType = resType as ResourceType;
                  const have = getBuf('base', rType);
                  const need = Number(amount.toString());
                  const hasEnough = have >= need;

                  return (
                    <div
                      key={resType}
                      className={`flex justify-between ${hasEnough ? 'text-green-400' : 'text-red-400'}`}
                    >
                      <span>{rType}:</span>
                      <span className="font-mono">
                        {formatNumber(have)} / {formatNumber(need)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Rewards */}
            <div className="mb-3">
              <div className="text-xs text-cyber-text-dim mb-1 flex items-center gap-1">
                <Award className="w-3 h-3" />
                Награды:
              </div>
              <div className="flex gap-3 text-xs">
                {contract.rewards.credits && (
                  <span className="text-yellow-400">
                    💰 {formatNumber(contract.rewards.credits)}
                  </span>
                )}
                {contract.rewards.researchPoints && (
                  <span className="text-blue-400">
                    🔬 {formatNumber(contract.rewards.researchPoints)}
                  </span>
                )}
                {contract.rewards.influence && (
                  <span className="text-purple-400">
                    👑 {formatNumber(contract.rewards.influence)}
                  </span>
                )}
              </div>
            </div>

            {/* Complete Button */}
            <button
              onClick={() => completeContract(contract.id)}
              disabled={!affordable}
              className={`w-full py-2 rounded-lg text-sm font-semibold transition-all ${
                affordable
                  ? 'bg-cyber-green hover:bg-cyber-green/90 text-white shadow-lg shadow-cyber-green/20'
                  : 'bg-cyber-gray/20 text-cyber-gray-light cursor-not-allowed'
              }`}
            >
              {affordable ? 'ВЫПОЛНИТЬ' : 'НЕДОСТАТОЧНО РЕСУРСОВ'}
            </button>
          </div>
        );
      })}
    </div>
  );
}
