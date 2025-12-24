import type { ProductionMatrixUpgradeId } from '../gameTypes';

export const PRODUCTION_MATRIX_UPGRADE_DEFS: Record<
  ProductionMatrixUpgradeId,
  { name: string; description: string; maxLevel: number }
> = {
  cold_fusion: {
    name: 'Cold Fusion',
    description: 'Снижает потребление энергии у производственных зданий.',
    maxLevel: 10,
  },
  molecular_stability: {
    name: 'Molecular Stability',
    description: 'Даёт шанс удвоить выпуск (кроме энергии).',
    maxLevel: 12,
  },
  auto_sort: {
    name: 'Auto-Sort',
    description: 'Автоматически удаляет дешёвые ресурсы при переполнении базы.',
    maxLevel: 10,
  },
};

export function productionMatrixUpgradeCost(id: ProductionMatrixUpgradeId, level: number): number {
  const l = Math.max(0, Math.floor(level));
  if (id === 'cold_fusion') return Math.floor(3 + l * 3 + l * l * 0.8);
  if (id === 'molecular_stability') return Math.floor(4 + l * 4 + l * l * 1.0);
  if (id === 'auto_sort') return Math.floor(5 + l * 5 + l * l * 1.1);
  return 999999;
}

// 1.0 = no change; applied to energy consumption only.
export function computeColdFusionEnergyMultiplier(level: number): number {
  const l = Math.max(0, Math.floor(level));
  // -5% per level, capped at -60%
  return Math.max(0.4, 1 - 0.05 * l);
}

// 0..1 chance to double output for non-energy production.
export function computeMolecularStabilityDoubleChance(level: number): number {
  const l = Math.max(0, Math.floor(level));
  // +3% per level, capped at 35%
  return Math.min(0.35, 0.03 * l);
}

export function computeAutoSortEnabled(level: number): boolean {
  return Math.max(0, Math.floor(level)) > 0;
}

// When base buffer ratio exceeds startRatio, delete down to targetRatio.
export function computeAutoSortStartRatio(level: number): number {
  const l = Math.max(0, Math.floor(level));
  // from 0.98 down to 0.90
  return Math.max(0.9, 0.98 - 0.008 * l);
}

export function computeAutoSortTargetRatio(level: number): number {
  const l = Math.max(0, Math.floor(level));
  // from 0.90 down to 0.75
  return Math.max(0.75, 0.90 - 0.015 * l);
}
