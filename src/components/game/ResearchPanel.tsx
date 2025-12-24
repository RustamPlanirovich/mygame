import { useMemo } from 'react';
import { useGameStore } from '../../features/gameStore';
import { formatNumber } from '../../core/math/format.ts';
import type { UpgradeId } from '../../core/gameTypes';
import { RESOURCE_LABEL } from '../../core/constants/labels';
import { Microscope } from 'lucide-react';
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
  const research = useGameStore((s) => s.research);
  const meta = useGameStore((s) => s.meta);
  const demons = useGameStore((s) => s.demons);
  const resources = useGameStore((s) => s.resources);
  const buyUpgrade = useGameStore((s) => s.buyUpgrade);
  const productionMatrix = useGameStore((s) => s.productionMatrix);
  const buyProductionMatrixUpgrade = useGameStore((s) => s.buyProductionMatrixUpgrade);

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
    <div className="p-4 border-b border-cyber-gray">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-xl text-cyber-green uppercase tracking-wider flex items-center gap-2">
          <Microscope size={18} className="text-cyber-green" />
          <span>Исследования</span>
        </h2>
        <div className="text-xs text-cyber-text-dim">5 веток · уровни сохраняются</div>
      </div>

      <div className="text-xs text-cyber-text-dim mb-2">
        Чертежи: <span className="text-cyber-text">{formatNumber(meta.blueprints)}</span>
      </div>

      <div className="text-xs text-cyber-text-dim mb-3">
        Итог: скорость x<span className="text-cyber-text">{summary.speedMult.toFixed(2)}</span>
        <span className="text-cyber-gray-light">{summary.overclockerPaid ? ' (Overclocker)' : ''}</span>
        <span className="text-cyber-gray-light"> · пропускная </span>
        <span className="text-cyber-text">{formatNumber(summary.bw)}</span>
        <span className="text-cyber-gray-light">/с · лимиты x</span>
        <span className="text-cyber-text">{formatNumber(summary.capsMult)}</span>
        <span className="text-cyber-gray-light"> · маржа x</span>
        <span className="text-cyber-text">{summary.tradeMult.toFixed(2)}</span>
        <span className="text-cyber-gray-light"> · оборона x</span>
        <span className="text-cyber-text">{formatNumber(summary.combatMult)}</span>
      </div>

      <div className="space-y-2">
        {items.map(({ id, def, level, costText, canAfford, atMax }) => (
          <div key={id} className="cyber-panel flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:border-cyber-blue transition-colors">
            <div>
              <div className="text-cyber-blue font-bold">{def.name}</div>
              <div className="text-xs text-cyber-text-dim">{def.description}</div>
              <div className="text-xs text-cyber-text-dim mt-1">
                Уровень: <span className="text-cyber-text">{level}</span>
                <span className="text-cyber-gray-light"> / {def.maxLevel}</span>
                <span className="text-cyber-gray-light"> · Эффект: {EFFECT_TEXT[id]}</span>
              </div>
            </div>

            <button
              className="cyber-button text-sm py-2 px-4 w-full sm:w-auto sm:min-w-[160px]"
              disabled={atMax || !canAfford}
              onClick={() => buyUpgrade(id)}
            >
              <div className="flex items-center justify-center gap-2">
                <span>{atMax ? 'МАКС' : 'КУПИТЬ'}</span>
              </div>
              <div className="text-xs mt-1">
                {atMax ? '—' : (costText || '—')}
              </div>
            </button>
          </div>
        ))}
      </div>

      <div className="mt-4 border-t border-cyber-gray/40 pt-3">
        <div className="flex items-baseline justify-between mb-2">
          <div className="text-xs text-cyber-text-dim">Производственная матрица</div>
          <div className="text-[10px] text-cyber-gray-light">тратит чертежи</div>
        </div>

        <div className="space-y-2">
          {matrixItems.map(({ id, def, level, cost, canAfford, atMax, hint }) => (
            <div key={id} className="cyber-panel flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:border-cyber-blue transition-colors">
              <div>
                <div className="text-cyber-blue font-bold">{def.name}</div>
                <div className="text-xs text-cyber-text-dim">{def.description}</div>
                <div className="text-xs text-cyber-text-dim mt-1">
                  Уровень: <span className="text-cyber-text">{level}</span>
                  <span className="text-cyber-gray-light"> / {def.maxLevel}</span>
                  <span className="text-cyber-gray-light"> · {hint}</span>
                </div>
              </div>

              <button
                className="cyber-button text-sm py-2 px-4 w-full sm:w-auto sm:min-w-[160px]"
                disabled={atMax || !canAfford}
                onClick={() => buyProductionMatrixUpgrade(id)}
              >
                <div className="flex items-center justify-center gap-2">
                  <span>{atMax ? 'МАКС' : 'КУПИТЬ'}</span>
                </div>
                <div className="text-xs mt-1">
                  {atMax ? '—' : `${cost} чертеж.`}
                </div>
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="text-xs text-cyber-text-dim mt-3">
        Исследования списывают ресурсы с базы (буфера) и влияют на симуляцию в реальном времени.
      </div>
    </div>
  );
}
