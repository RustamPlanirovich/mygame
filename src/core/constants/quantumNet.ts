import type { QuantumNetUpgradeId } from '../gameTypes';

export const QUANTUM_NET_UPGRADE_DEFS: Record<
  QuantumNetUpgradeId,
  { name: string; description: string; maxLevel: number }
> = {
  chrono_shift: {
    name: 'Хроно‑Сдвиг',
    description: 'После престижа стартуешь с дополнительными ресурсами.',
    maxLevel: 12,
  },
  memory_preservation: {
    name: 'Сохранение Памяти',
    description: 'Одно здание сохраняется на сетке после престижа.',
    maxLevel: 1,
  },
};

export function quantumNetUpgradeCost(id: QuantumNetUpgradeId, level: number): number {
  const l = Math.max(0, Math.floor(level));
  if (id === 'chrono_shift') return Math.floor(2 + l * 3 + l * l * 0.8);
  if (id === 'memory_preservation') return 8;
  return 999999;
}

export function computeChronoShiftStartingBonus(level: number): {
  energy: number;
  ore: number;
  ice: number;
  carbon: number;
  steel: number;
} {
  const l = Math.max(0, Math.floor(level));
  return {
    energy: 50 * l,
    ore: 20 * l,
    ice: 15 * l,
    carbon: 15 * l,
    steel: 2 * l,
  };
}

export function computeMemoryPreservationEnabled(level: number): boolean {
  return Math.max(0, Math.floor(level)) > 0;
}
