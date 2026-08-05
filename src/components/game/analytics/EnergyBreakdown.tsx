/**
 * EnergyBreakdown Component
 *
 * Показывает разбивку потребления энергии по зданиям
 * с учётом уровней зданий и эволюции
 */

import { memo, useMemo } from 'react';
import { Zap, TrendingUp, TrendingDown } from 'lucide-react';
import { useGameStore } from '../../../features/gameStore';
import { Alert, EmptyState, Meter, Panel, Stat } from '../../ui';
import { D, formatNumber } from '../../../core/math/format';
import { getEvolutionMultiplier } from '../../../core/constants/buildingEvolutions';
import Decimal from 'break_eternity.js';

interface EnergyUsage {
  buildingName: string;
  buildingId: string;
  count: number;
  perBuilding: Decimal; // Среднее производство/потребление на здание
  total: Decimal;
  percentage: number;
}

/** Строка списка производителя/потребителя — вынесена, чтобы мемоизироваться отдельно. */
const UsageRow = memo(function UsageRow({
  usage,
  tone,
}: {
  usage: EnergyUsage;
  tone: 'accent' | 'danger';
}) {
  const sign = tone === 'accent' ? '+' : '-';
  const valueClass = tone === 'accent' ? 'text-green-400' : 'text-red-400';

  return (
    <div className="flex items-center gap-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between text-xs">
          <span className="truncate text-cyber-gray-300">{usage.buildingName}</span>
          <span className={`ml-2 font-mono ${valueClass}`}>
            {sign}{formatNumber(usage.total)}/с
          </span>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <Meter value={usage.percentage} max={100} tone={tone} className="flex-1" />
          <span className="w-12 text-right text-[10px] text-cyber-gray-500">
            {usage.percentage.toFixed(1)}%
          </span>
        </div>
        <div className="mt-0.5 text-[10px] text-cyber-gray-600">
          {usage.count}× ~{formatNumber(usage.perBuilding)}/с (в среднем)
        </div>
      </div>
    </div>
  );
});

export const EnergyBreakdown = memo(function EnergyBreakdown() {
  const buildings = useGameStore(state => state.buildings);
  const tiles = useGameStore(state => state.grid.tiles);
  const tileLevels = useGameStore(state => state.grid.tileLevels);
  const tileEvolutionLevels = useGameStore(state => state.grid.tileEvolutionLevels);
  const tileDisabled = useGameStore(state => state.grid.tileDisabled);
  const tileSettings = useGameStore(state => state.grid.tileSettings);

  const { consumers, producers, totalConsumption, totalProduction } = useMemo(() => {
    // Создаём Map для быстрого доступа к зданиям
    const buildingsMap = new Map(buildings.map(b => [b.id, b]));

    const consumerMap = new Map<string, EnergyUsage>();
    const producerMap = new Map<string, EnergyUsage>();
    let totalCons = D(0);
    let totalProd = D(0);

    // Итерируем по всем клеткам с учётом уровней
    for (const [tileKey, buildingId] of Object.entries(tiles)) {
      const building = buildingsMap.get(buildingId);
      if (!building) continue;

      // Проверяем, не отключено ли здание
      if (tileDisabled?.[tileKey]) continue;
      const tileSett = tileSettings?.[tileKey];
      if (tileSett && !tileSett.enabled) continue;

      const buildingLevel = tileLevels?.[tileKey] || 1;
      const evolutionLevel = tileEvolutionLevels?.[tileKey] || 0;
      const evolutionMult = evolutionLevel > 0 ? getEvolutionMultiplier(buildingId, evolutionLevel) : 1;

      // Производители энергии
      if (building.production?.energy && D(building.production.energy).gt(0)) {
        const baseRate = D(building.production.energy);
        const tileProduction = baseRate.mul(buildingLevel).mul(evolutionMult);
        totalProd = totalProd.add(tileProduction);

        const existing = producerMap.get(building.id);
        if (existing) {
          existing.count += 1;
          existing.total = existing.total.add(tileProduction);
        } else {
          producerMap.set(building.id, {
            buildingName: building.name,
            buildingId: building.id,
            count: 1,
            perBuilding: tileProduction,
            total: tileProduction,
            percentage: 0,
          });
        }
      }

      // Потребители энергии (energyConsumption или consumption.energy)
      const energyConsumption = building.energyConsumption
        ? D(building.energyConsumption)
        : building.consumption?.energy
          ? D(building.consumption.energy)
          : D(0);

      if (energyConsumption.gt(0)) {
        const tileConsumption = energyConsumption.mul(buildingLevel);
        totalCons = totalCons.add(tileConsumption);

        const existing = consumerMap.get(building.id);
        if (existing) {
          existing.count += 1;
          existing.total = existing.total.add(tileConsumption);
        } else {
          consumerMap.set(building.id, {
            buildingName: building.name,
            buildingId: building.id,
            count: 1,
            perBuilding: tileConsumption,
            total: tileConsumption,
            percentage: 0,
          });
        }
      }
    }

    // Рассчитываем проценты и среднее производство на здание
    const consumers = Array.from(consumerMap.values())
      .map(c => ({
        ...c,
        perBuilding: c.count > 0 ? c.total.div(c.count) : D(0),
        percentage: totalCons.gt(0) ? c.total.div(totalCons).mul(100).toNumber() : 0,
      }))
      .sort((a, b) => b.total.cmp(a.total));

    const producers = Array.from(producerMap.values())
      .map(p => ({
        ...p,
        perBuilding: p.count > 0 ? p.total.div(p.count) : D(0),
        percentage: totalProd.gt(0) ? p.total.div(totalProd).mul(100).toNumber() : 0,
      }))
      .sort((a, b) => b.total.cmp(a.total));

    return { consumers, producers, totalConsumption: totalCons, totalProduction: totalProd };
  }, [buildings, tiles, tileLevels, tileEvolutionLevels, tileDisabled, tileSettings]);

  const balance = totalProduction.sub(totalConsumption);
  const isDeficit = balance.lt(0);

  return (
    <div className="space-y-4">
      {/* Сводка */}
      <Panel title="Энергобаланс" icon={<Zap className="h-5 w-5 text-yellow-400" />}>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded border border-green-500/30 bg-green-900/30 p-2">
            <Stat
              align="center"
              tone="accent"
              label="Производство/с"
              value={`+${formatNumber(totalProduction)}`}
            />
          </div>
          <div className="rounded border border-red-500/30 bg-red-900/30 p-2">
            <Stat
              align="center"
              tone="danger"
              label="Потребление/с"
              value={`-${formatNumber(totalConsumption)}`}
            />
          </div>
          <div
            className={`rounded p-2 ${
              isDeficit
                ? 'border border-red-500/50 bg-red-900/40'
                : 'border border-cyan-500/30 bg-cyan-900/30'
            }`}
          >
            <Stat
              align="center"
              tone={isDeficit ? 'danger' : 'info'}
              label="Баланс/с"
              value={`${balance.gte(0) ? '+' : ''}${formatNumber(balance)}`}
            />
          </div>
        </div>

        {isDeficit && (
          <div className="mt-2">
            <Alert tone="danger" title="⚠️ Дефицит энергии! Постройте больше электростанций." />
          </div>
        )}
      </Panel>

      {/* Производители */}
      <Panel
        title="Производители энергии"
        icon={<TrendingUp className="h-4 w-4 text-green-400" />}
        actions={<span className="text-xs text-cyber-gray-500">({producers.length})</span>}
      >
        {producers.length === 0 ? (
          <EmptyState title="Нет электростанций" />
        ) : (
          <div className="space-y-2">
            {producers.map(p => (
              <UsageRow key={p.buildingId} usage={p} tone="accent" />
            ))}
          </div>
        )}
      </Panel>

      {/* Потребители */}
      <Panel
        title="Потребители энергии"
        icon={<TrendingDown className="h-4 w-4 text-red-400" />}
        actions={<span className="text-xs text-cyber-gray-500">({consumers.length})</span>}
      >
        {consumers.length === 0 ? (
          <EmptyState title="Нет зданий, потребляющих энергию" />
        ) : (
          <div className="max-h-[300px] space-y-2 overflow-y-auto">
            {consumers.map(c => (
              <UsageRow key={c.buildingId} usage={c} tone="danger" />
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
});
