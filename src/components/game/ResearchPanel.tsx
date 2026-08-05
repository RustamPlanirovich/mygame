import { useMemo, useState } from 'react';
import { useGameStore } from '../../features/gameStore';
import { formatNumber } from '../../core/math/format.ts';
import type { UpgradeId } from '../../core/gameTypes';
import { RESOURCE_LABEL } from '../../core/constants/labels';
import { Microscope } from 'lucide-react';
import { TechTreePanel } from './TechTreePanel';
import { RepeatableResearchList } from './RepeatableResearchList';
import {
  UPGRADE_DEFS,
  computeBandwidth,
  computeCapsMultiplier,
  computeCombatMultiplier,
  computeSpeedMultiplier,
  computeTradeMultiplier,
  upgradeCost,
} from '../../core/constants/progression';
import {
  PRODUCTION_MATRIX_UPGRADE_DEFS,
  computeColdFusionEnergyMultiplier,
  computeMolecularStabilityDoubleChance,
  computeAutoSortStartRatio,
  computeAutoSortTargetRatio,
  productionMatrixUpgradeCost,
} from '../../core/constants/productionMatrix';
import { GameIcon } from '../ui/icons';

const ORDER: UpgradeId[] = [
  'kernel_speed',
  'logistics_bandwidth',
  'storage_caps',
  'trade_margin',
  'combat_protocols',
  'sector_expansion',
];

const EFFECT_TEXT: Record<UpgradeId, string> = {
  kernel_speed: '+5% скорость зданий/ур.',
  logistics_bandwidth: '+25% пропускная линий/ур.',
  storage_caps: '+10% лимиты хранения/ур.',
  trade_margin: '+5% выручка от продаж/ур.',
  combat_protocols: '+10% турели/щит/ур.',
  sector_expansion: '+2×2 клетки сетки/ур.',
};

export function ResearchPanel() {
  const [activeTab, setActiveTab] = useState<'upgrades' | 'repeatable'>('upgrades');
  const research = useGameStore((s) => s.research);
  const meta = useGameStore((s) => s.meta);
  const demons = useGameStore((s) => s.demons);
  const resources = useGameStore((s) => s.resources);
  const buyUpgrade = useGameStore((s) => s.buyUpgrade);
  const productionMatrix = useGameStore((s) => s.productionMatrix);
  const buyProductionMatrixUpgrade = useGameStore((s) => s.buyProductionMatrixUpgrade);
  const ascension = useGameStore((s) => s.ascension);
  
  const showRepeatable = ascension?.unlocks?.infiniteResearch || false;

  const summary = useMemo(() => {
    const levels = research.levels;
    const overclockerPaid = Boolean(demons.active.overclocker && demons.rentPaid?.overclocker);

    const speedMult = computeSpeedMultiplier(levels, meta.qubits, overclockerPaid);
    const bw = computeBandwidth(levels);
    const capsMult = computeCapsMultiplier(levels, meta.qubits);
    const tradeMult = computeTradeMultiplier(levels);
    const combatMult = computeCombatMultiplier(levels, meta.qubits);

    return {
      speedMult,
      bw,
      capsMult,
      tradeMult,
      combatMult,
      overclockerPaid,
    };
  }, [research.levels, meta.qubits, demons.active.overclocker, demons.rentPaid?.overclocker]);

  const items = useMemo(() => {
    return ORDER.map((id) => {
      const def = UPGRADE_DEFS[id];
      const level = research.levels[id] ?? 0;
      const cost = upgradeCost(id, level);
      const canAfford = Object.entries(cost).every(([res, amt]) => resources[res as keyof typeof resources].amount.gte(amt));
      const atMax = level >= def.maxLevel;

      const costText = Object.entries(cost)
        .map(([res, amt]) => `${formatNumber(amt)} ${res === 'energy' ? '⚡' : RESOURCE_LABEL[res as keyof typeof RESOURCE_LABEL]}`)
        .join(', ');

      return { id, def, level, costText, canAfford, atMax };
    });
  }, [research.levels, resources]);

  const matrixItems = useMemo(() => {
    return (['cold_fusion', 'molecular_stability', 'auto_sort'] as const).map((id) => {
      const def = PRODUCTION_MATRIX_UPGRADE_DEFS[id];
      const level = productionMatrix.levels[id] ?? 0;
      const cost = productionMatrixUpgradeCost(id, level);
      const canAfford = meta.blueprints.gte(cost);
      const atMax = level >= def.maxLevel;

      const hint = id === 'cold_fusion'
        ? `Сейчас: x${computeColdFusionEnergyMultiplier(level).toFixed(2)} к ⚡-расходу`
        : id === 'molecular_stability'
          ? `Сейчас: ${Math.round(computeMolecularStabilityDoubleChance(level) * 100)}% шанс`
          : `Сейчас: чистка при ≥${Math.round(computeAutoSortStartRatio(level) * 100)}% → до ${Math.round(computeAutoSortTargetRatio(level) * 100)}%`;

      return { id, def, level, cost, canAfford, atMax, hint };
    });
  }, [productionMatrix.levels, meta.blueprints]);

  return (
    <div className="p-3 border-b border-cyber-gray">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg text-cyber-green uppercase tracking-wide flex items-center gap-1.5">
          <Microscope size={16} className="text-cyber-green" />
          <span>Исследования</span>
        </h2>
        <div className="text-[10px] text-cyber-text-dim">Чертежи: <span className="text-cyber-text">{formatNumber(meta.blueprints)}</span></div>
      </div>

      {/* Вкладки */}
      <div className="flex gap-1.5 mb-3">
        <button
          className={`px-3 py-1.5 rounded text-[11px] font-semibold transition-colors ${
            activeTab === 'upgrades'
              ? 'bg-cyber-blue/20 text-cyber-blue border border-cyber-blue'
              : 'bg-gray-800/50 text-gray-400 hover:text-gray-300'
          }`}
          onClick={() => setActiveTab('upgrades')}
        >
          <GameIcon icon="🔬" /> Базовые
        </button>
        
        <button
          className={`px-3 py-1.5 rounded text-[11px] font-semibold transition-colors ${
            activeTab === 'repeatable'
              ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-400'
              : showRepeatable
              ? 'bg-gray-800/50 text-gray-400 hover:text-gray-300'
              : 'bg-gray-900/50 text-gray-600 cursor-not-allowed'
          }`}
          onClick={() => showRepeatable && setActiveTab('repeatable')}
          disabled={!showRepeatable}
          title={!showRepeatable ? 'Разблокируется после первого Вознесения' : ''}
        >
          <GameIcon icon="♾️" /> Повторяемые {!showRepeatable && '🔒'}
        </button>
      </div>

      {/* Содержимое вкладок */}
      {activeTab === 'upgrades' ? (
        <div>
          {/* Tech Tree */}
          <div className="mb-3">
            <TechTreePanel />
          </div>

      <div className="text-[10px] text-cyber-text-dim mb-2 flex flex-wrap gap-x-2 gap-y-0.5">
        <div>Скор.: x<span className="text-cyber-text">{summary.speedMult.toFixed(2)}</span></div>
        <div>Пропуск: <span className="text-cyber-text">{formatNumber(summary.bw)}</span></div>
        <div>Лим.: x<span className="text-cyber-text">{formatNumber(summary.capsMult)}</span></div>
        <div>Маржа: x<span className="text-cyber-text">{summary.tradeMult.toFixed(2)}</span></div>
        <div>Обор.: x<span className="text-cyber-text">{formatNumber(summary.combatMult)}</span></div>
      </div>

      <div className="space-y-1.5">
        {items.map(({ id, def, level, costText, canAfford, atMax }) => (
          <div key={id} className="cyber-panel p-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 hover:border-cyber-blue transition-colors">
            <div className="flex-1 min-w-0">
              <div className="text-sm text-cyber-blue font-semibold truncate">{def.name}</div>
              <div className="text-[10px] text-cyber-text-dim mt-0.5">
                Ур.: {level}/{def.maxLevel}
                <span className="text-cyber-gray-light"> · {EFFECT_TEXT[id]}</span>
              </div>
            </div>

            <button
              className="cyber-button text-[11px] py-1.5 px-3 w-full sm:w-auto sm:min-w-[120px] shrink-0"
              disabled={atMax || !canAfford}
              onClick={() => buyUpgrade(id)}
            >
              <div>{atMax ? 'МАКС' : 'КУПИТЬ'}</div>
              <div className="text-[9px] mt-0.5">
                {atMax ? '—' : (costText || '—')}
              </div>
            </button>
          </div>
        ))}
      </div>

      <div className="mt-3 border-t border-cyber-gray/40 pt-2">
        <div className="flex items-center justify-between mb-1.5">
          <div className="text-[10px] text-cyber-text-dim"><GameIcon icon="🔷" /> Произв. матрица</div>
          <div className="text-[9px] text-cyber-gray-light">тратит чертежи</div>
        </div>

        <div className="space-y-1.5">
          {matrixItems.map(({ id, def, level, cost, canAfford, atMax, hint }) => (
            <div key={id} className="cyber-panel p-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 hover:border-cyber-blue transition-colors">
              <div className="flex-1 min-w-0">
                <div className="text-sm text-cyber-blue font-semibold truncate">{def.name}</div>
                <div className="text-[10px] text-cyber-text-dim mt-0.5">
                  Ур.: {level}/{def.maxLevel}
                  <span className="text-cyber-gray-light"> · {hint}</span>
                </div>
              </div>

              <button
                className="cyber-button text-[11px] py-1.5 px-3 w-full sm:w-auto sm:min-w-[120px] shrink-0"
                disabled={atMax || !canAfford}
                onClick={() => buyProductionMatrixUpgrade(id)}
              >
                <div>{atMax ? 'МАКС' : 'КУПИТЬ'}</div>
                <div className="text-[9px] mt-0.5">
                  {atMax ? '—' : `${cost} черт.`}
                </div>
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="text-[10px] text-cyber-text-dim mt-2">
        <GameIcon icon="💡" /> Исследования списывают ресурсы с базы.
      </div>
        </div>
      ) : (
        // Вкладка повторяемых исследований
        showRepeatable ? (
          <RepeatableResearchList />
        ) : (
          <div className="p-8 text-center space-y-3">
            <div className="text-4xl"><GameIcon icon="🔒" /></div>
            <p className="text-gray-300 font-semibold">Повторяемые Исследования</p>
            <p className="text-gray-400 text-sm">
              Разблокируются после первого Вознесения
            </p>
          </div>
        )
      )}
    </div>
  );
}
