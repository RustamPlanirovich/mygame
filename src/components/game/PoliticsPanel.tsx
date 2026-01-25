import { useMemo, useState } from 'react';
import { useGameStore } from '../../features/gameStore';
import { formatNumber } from '../../core/math/format.ts';
import type { PolicyId, PolicyCategory } from '../../core/gameTypes';
import { POLICIES, canActivatePolicy, getPoliciesByCategory } from '../../core/constants/policies';
import { Landmark, Info, XCircle } from 'lucide-react';

const CATEGORY_LABELS: Record<PolicyCategory, string> = {
  production: '🏭 Производственные',
  energy: '⚡ Энергетические',
  economic: '💰 Экономические',
  science: '🔬 Научные',
  military: '⚔️ Военные',
  space: '🚀 Космические',
  special: '✨ Специальные',
};

const CATEGORY_ORDER: PolicyCategory[] = ['production', 'energy', 'economic', 'science', 'military', 'space', 'special'];

export function PoliticsPanel() {
  const politics = useGameStore((s) => s.politics);
  const currency = useGameStore((s) => s.currency);
  const research = useGameStore((s) => s.research);
  const activatePolicy = useGameStore((s) => s.activatePolicy);
  const deactivatePolicy = useGameStore((s) => s.deactivatePolicy);
  
  const [selectedCategory, setSelectedCategory] = useState<PolicyCategory>('production');
  const [expandedPolicyId, setExpandedPolicyId] = useState<PolicyId | null>(null);

  const influence = useMemo(() => Number(currency.influence.toString()), [currency.influence]);
  
  const activePolicies = useMemo(() => {
    return politics.activePolicies.map(id => POLICIES[id]).filter(Boolean);
  }, [politics.activePolicies]);
  
  const totalUpkeep = useMemo(() => {
    return activePolicies.reduce((sum, policy) => sum + (policy?.influenceUpkeep ?? 0), 0);
  }, [activePolicies]);
  
  const categorizedPolicies = useMemo(() => {
    return getPoliciesByCategory(selectedCategory);
  }, [selectedCategory]);

  const handleActivate = (policyId: PolicyId) => {
    const check = canActivatePolicy(
      policyId,
      influence,
      research.technologies,
      politics.activePolicies,
      politics.maxActivePolicies
    );
    
    if (check.can) {
      activatePolicy(policyId);
    } else {
      alert(check.reason);
    }
  };

  const handleDeactivate = (policyId: PolicyId) => {
    deactivatePolicy(policyId);
  };

  const toggleExpand = (policyId: PolicyId) => {
    setExpandedPolicyId(expandedPolicyId === policyId ? null : policyId);
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="p-3 border-b border-slate-700 bg-slate-800/50">
        <div className="flex items-center gap-2 mb-2">
          <Landmark className="w-5 h-5 text-purple-400" />
          <h2 className="text-lg font-bold text-white">Политика</h2>
        </div>
        
        {/* Stats */}
        <div className="grid grid-cols-3 gap-1.5 text-[10px]">
          <div className="bg-slate-700/50 rounded px-2 py-1.5">
            <div className="text-slate-400">Влияние</div>
            <div className="text-purple-300 font-bold">{formatNumber(influence)}</div>
          </div>
          <div className="bg-slate-700/50 rounded px-2 py-1.5">
            <div className="text-slate-400">Активных</div>
            <div className="text-blue-300 font-bold">{politics.activePolicies.length} / {politics.maxActivePolicies}</div>
          </div>
          <div className="bg-slate-700/50 rounded px-2 py-1.5">
            <div className="text-slate-400">Расход/с</div>
            <div className="text-red-300 font-bold">-{totalUpkeep.toFixed(1)}</div>
          </div>
        </div>
      </div>

      {/* Active Policies */}
      {activePolicies.length > 0 && (
        <div className="p-4 border-b border-slate-700 bg-slate-800/30">
          <h3 className="text-sm font-bold text-green-400 mb-2">✓ Активные политики</h3>
          <div className="space-y-2">
            {activePolicies.map(policy => (
              <div key={policy.id} className="bg-green-900/20 border border-green-700/50 rounded p-2">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="text-white font-semibold text-sm">{policy.name}</div>
                    <div className="text-green-300 text-xs">-{policy.influenceUpkeep}/сек</div>
                  </div>
                  <button
                    onClick={() => handleDeactivate(policy.id)}
                    className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-white text-xs transition-colors"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category Tabs */}
      <div className="flex gap-1 p-1.5 bg-slate-800/50 border-b border-slate-700 overflow-x-auto">
        {CATEGORY_ORDER.map(category => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`px-2 py-1 rounded text-[10px] font-medium transition-colors whitespace-nowrap ${
              selectedCategory === category
                ? 'bg-purple-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            {CATEGORY_LABELS[category]}
          </button>
        ))}
      </div>

      {/* Policies List */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-2">
          {categorizedPolicies.map(policy => {
            const isActive = politics.activePolicies.includes(policy.id);
            const check = canActivatePolicy(
              policy.id,
              influence,
              research.technologies,
              politics.activePolicies,
              politics.maxActivePolicies
            );
            const isExpanded = expandedPolicyId === policy.id;
            
            // Check if prerequisites are met
            const prerequisitesMet = !policy.prerequisites || policy.prerequisites.every(
              techId => research.technologies[techId]
            );
            
            return (
              <div
                key={policy.id}
                className={`border rounded-lg transition-all ${
                  isActive
                    ? 'bg-green-900/20 border-green-600/50'
                    : prerequisitesMet
                      ? 'bg-slate-800/50 border-slate-600 hover:border-slate-500'
                      : 'bg-slate-900/50 border-slate-700 opacity-50'
                }`}
              >
                <div className="p-3">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className={`font-semibold ${isActive ? 'text-green-300' : 'text-white'}`}>
                          {policy.name}
                        </h4>
                        {isActive && <span className="text-xs text-green-400">✓</span>}
                      </div>
                      <p className="text-sm text-slate-300 mt-1">{policy.description}</p>
                    </div>
                    <button
                      onClick={() => toggleExpand(policy.id)}
                      className="p-1 hover:bg-slate-700 rounded transition-colors"
                    >
                      <Info className="w-4 h-4 text-slate-400" />
                    </button>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-slate-700 space-y-2 text-xs">
                      <div>
                        <span className="text-slate-400">Категория:</span>
                        <span className="text-white ml-2">{CATEGORY_LABELS[policy.category]}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Стоимость активации:</span>
                        <span className="text-purple-300 ml-2">{policy.influenceCost} влияния</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Расход:</span>
                        <span className="text-red-300 ml-2">{policy.influenceUpkeep}/сек</span>
                      </div>
                      
                      {policy.prerequisites && policy.prerequisites.length > 0 && (
                        <div>
                          <span className="text-slate-400">Требуется:</span>
                          <div className="ml-2 mt-1 space-y-1">
                            {policy.prerequisites.map(techId => (
                              <div
                                key={techId}
                                className={research.technologies[techId] ? 'text-green-400' : 'text-red-400'}
                              >
                                {research.technologies[techId] ? '✓' : '✗'} {techId}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {policy.risks && policy.risks.length > 0 && (
                        <div>
                          <span className="text-orange-400">⚠ Риски:</span>
                          <div className="ml-2 mt-1 text-orange-300">
                            {policy.risks.join(', ')}
                          </div>
                        </div>
                      )}
                      
                      {policy.effects.specialEffect && (
                        <div>
                          <span className="text-slate-400">Особый эффект:</span>
                          <span className="text-cyan-300 ml-2">{policy.effects.specialEffect}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action Button */}
                  <div className="mt-3 flex items-center justify-between">
                    <div className="text-xs space-y-1">
                      {policy.effects.productionMultiplier && policy.effects.productionMultiplier !== 1 && (
                        <div className="text-blue-300">
                          Производство: {((policy.effects.productionMultiplier - 1) * 100).toFixed(0)}%
                        </div>
                      )}
                      {policy.effects.energyConsumptionMultiplier && policy.effects.energyConsumptionMultiplier !== 1 && (
                        <div className="text-yellow-300">
                          Энергопотребление: {((policy.effects.energyConsumptionMultiplier - 1) * 100).toFixed(0)}%
                        </div>
                      )}
                      {policy.effects.researchMultiplier && policy.effects.researchMultiplier !== 1 && (
                        <div className="text-purple-300">
                          Исследования: {((policy.effects.researchMultiplier - 1) * 100).toFixed(0)}%
                        </div>
                      )}
                    </div>
                    
                    {isActive ? (
                      <button
                        onClick={() => handleDeactivate(policy.id)}
                        className="px-4 py-1.5 bg-red-600 hover:bg-red-700 rounded text-white text-sm font-medium transition-colors"
                      >
                        Деактивировать
                      </button>
                    ) : (
                      <button
                        onClick={() => handleActivate(policy.id)}
                        disabled={!check.can}
                        className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                          check.can
                            ? 'bg-purple-600 hover:bg-purple-700 text-white'
                            : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                        }`}
                        title={!check.can ? check.reason : ''}
                      >
                        Активировать
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
