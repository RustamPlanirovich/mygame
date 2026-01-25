import type Decimal from 'break_eternity.js';
import type { DemonId, ResourceType, UpgradeId } from '../gameTypes';
import { D } from '../math/format.ts';

export const UPGRADE_DEFS: Record<
  UpgradeId,
  {
    name: string;
    description: string;
    maxLevel: number;
    baseCost: Partial<Record<ResourceType, Decimal>>;
    costFactor: number;
  }
> = {
  kernel_speed: {
    name: 'Системное Ядро: Частота',
    description: 'Ускоряет работу всех зданий (производство/потребление).',
    maxLevel: 10,
    baseCost: { energy: D(250), steel: D(8) },
    costFactor: 1.55,
  },
  logistics_bandwidth: {
    name: 'Логистика: Пропускная',
    description: 'Увеличивает пропускную способность всех линий.',
    maxLevel: 10,
    baseCost: { energy: D(220), steel: D(10) },
    costFactor: 1.55,
  },
  storage_caps: {
    name: 'Склады: Контейнеры',
    description: 'Увеличивает множитель вместимости центральной БАЗЫ для всех ресурсов (работает со складскими модулями).',
    maxLevel: 10,
    baseCost: { energy: D(200), steel: D(12) },
    costFactor: 1.55,
  },
  trade_margin: {
    name: 'Биржа: Маржа',
    description: 'Продажа на бирже приносит больше ⚡.',
    maxLevel: 10,
    baseCost: { energy: D(180), steel: D(6) },
    costFactor: 1.55,
  },
  combat_protocols: {
    name: 'Протоколы Обороны',
    description: 'Усиляет турели и регенерацию щита.',
    maxLevel: 10,
    baseCost: { energy: D(260), steel: D(14) },
    costFactor: 1.55,
  },
  sector_expansion: {
    name: 'Сектор: Расширение',
    description: 'Увеличивает размер сетки фабрики (+2×2 клеток за уровень).',
    maxLevel: 8,
    baseCost: { energy: D(450), steel: D(40) },
    costFactor: 1.75,
  },
};

export const DEMON_DEFS: Record<DemonId, { name: string; description: string; energyPerSecond: Decimal }> = {
  smart_broker: {
    name: 'Smart-Broker',
    description: 'Автопродажа излишков, чтобы не упираться в лимиты складов.',
    energyPerSecond: D(2.0),
  },
  overclocker: {
    name: 'Overclocker',
    description: 'Ускоряет заводы в 2 раза, но ест ⚡ каждую секунду.',
    energyPerSecond: D(6.0),
  },
  oracle: {
    name: 'Oracle',
    description: 'Подсказывает, какое здание выгоднее по окупаемости (ROI).',
    energyPerSecond: D(2.5),
  },
};

export const upgradeCost = (id: UpgradeId, level: number) => {
  const def = UPGRADE_DEFS[id];
  const cost: Partial<Record<ResourceType, Decimal>> = {};
  for (const [res, base] of Object.entries(def.baseCost)) {
    cost[res as ResourceType] = D(base).mul(Math.pow(def.costFactor, level));
  }
  return cost;
};

export const computeTradeMultiplier = (levels: Record<UpgradeId, number>) => 1 + 0.05 * (levels.trade_margin ?? 0);

export const computeCapsMultiplier = (levels: Record<UpgradeId, number>, qubits: Decimal) => {
  const l = levels.storage_caps ?? 0;
  return D(1).add(D('0.10').mul(l)).add(D('0.02').mul(qubits));
};

export const computeSpeedMultiplier = (levels: Record<UpgradeId, number>, qubits: Decimal, overclockerActive: boolean) => {
  const l = levels.kernel_speed ?? 0;
  const base = 1 + 0.05 * l + 0.02 * Number(qubits.toString());
  return base * (overclockerActive ? 2 : 1);
};

export const computeBandwidth = (levels: Record<UpgradeId, number>) => {
  const l = levels.logistics_bandwidth ?? 0;
  return D(6).mul(D(1).add(D('0.25').mul(l)));
};

export const computeCombatMultiplier = (levels: Record<UpgradeId, number>, qubits: Decimal) => {
  const l = levels.combat_protocols ?? 0;
  return D(1).add(D('0.10').mul(l)).add(D('0.02').mul(qubits));
};
