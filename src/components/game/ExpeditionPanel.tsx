import { useMemo } from 'react';
import { useGameStore } from '../../features/gameStore';
import { formatNumber, D } from '../../core/math/format.ts';
import type { ShipModuleId, ShipSlot } from '../../core/gameTypes';
import { Rocket } from 'lucide-react';
import {
  SHIP_MODULE_DEFS,
  SHIP_SLOT_LABEL,
  computeShipExpeditionDurationMs,
  computeShipRewardMultiplier,
  computeShipSteelBonusChance,
} from '../../core/constants/ship';
import {
  STAR_CHART_UPGRADE_DEFS,
  computeStarChartAnomalyChance,
  computeStarChartDurationMultiplier,
  starChartUpgradeCost,
} from '../../core/constants/starChart';

export function ExpeditionPanel() {
  const expedition = useGameStore((s) => s.expedition);
  const resources = useGameStore((s) => s.resources);
  const blueprints = useGameStore((s) => s.meta.blueprints);
  const startExpedition = useGameStore((s) => s.startExpedition);
  const ship = useGameStore((s) => s.ship);
  const selectShipModule = useGameStore((s) => s.selectShipModule);
  const unlockShipModule = useGameStore((s) => s.unlockShipModule);
  const starChart = useGameStore((s) => s.starChart);
  const buyStarChartUpgrade = useGameStore((s) => s.buyStarChartUpgrade);

  const { active, secondsLeft } = useMemo(() => {
    const active = expedition.active;
    const ms = active ? Math.max(0, expedition.endsAt - Date.now()) : 0;
    const secondsLeft = active ? Math.ceil(ms / 1000) : 0;
    return { active, secondsLeft };
  }, [expedition.active, expedition.endsAt]);

  const costEnergy = D(180);
  const costSteel = D(8);
  const canAfford = resources.energy.amount.gte(costEnergy) && resources.steel.amount.gte(costSteel);

  const shipUi = useMemo(() => {
    const shipDurationMs = computeShipExpeditionDurationMs(ship.installed);
    const rewardMult = computeShipRewardMultiplier(ship.installed);
    const steelChance = computeShipSteelBonusChance(ship.installed);

    const durationMult = computeStarChartDurationMultiplier(starChart.levels.subspace ?? 0);
    const durationMs = Math.max(5_000, Math.round(shipDurationMs * durationMult));
    const anomalyChancePct = Math.round(computeStarChartAnomalyChance(starChart.levels.anomaly ?? 0) * 100);

    const unlockedIds = (Object.keys(ship.unlocked) as ShipModuleId[]).filter((id) => ship.unlocked[id]);
    const bySlot: Record<ShipSlot, ShipModuleId[]> = { hull: [], engine: [], cargo: [] };
    for (const id of unlockedIds) {
      const def = SHIP_MODULE_DEFS[id];
      if (!def) continue;
      bySlot[def.slot].push(id);
    }
    return {
      durationSeconds: Math.max(1, Math.round(durationMs / 1000)),
      rewardMult,
      steelChancePct: Math.round(steelChance * 100),
      anomalyChancePct,
      subspaceMult: durationMult,
      options: bySlot,
    };
  }, [ship.installed, ship.unlocked, starChart.levels.subspace, starChart.levels.anomaly]);

  return (
    <div className="p-3 border-b border-cyber-gray">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg text-cyber-green uppercase tracking-wide flex items-center gap-1.5">
          <Rocket size={16} className="text-cyber-green" />
          <span>Экспедиции</span>
        </h2>
        <div className="text-[10px] text-cyber-text-dim">
          {active ? `🚀 ${secondsLeft}с` : '✓ готово'}
          <span className="text-cyber-text-dim"> · 📐 {formatNumber(blueprints)}</span>
        </div>
      </div>

      <div className="cyber-panel p-2">
        {active ? (
          <div className="text-[10px] text-cyber-text-dim">
            Экспедиция в пути… <span className="text-cyber-text">{secondsLeft}с</span>
          </div>
        ) : (
          <div className="text-[10px] text-cyber-text-dim">
            Готово к запуску.
          </div>
        )}

        {expedition.lastReport ? (
          <div className="text-[10px] text-cyber-gray-light mt-1">{expedition.lastReport}</div>
        ) : null}

        <div className="mt-2 border-t border-cyber-gray/40 pt-2">
          <div className="text-[10px] text-cyber-text-dim mb-1.5">Корабль</div>

          <div className="grid gap-2">
            {(['hull', 'engine', 'cargo'] as ShipSlot[]).map((slot) => {
              const current = ship.installed[slot];
              const options = shipUi.options[slot];
              return (
                <div key={slot}>
                  <div className="flex items-center justify-between text-xs text-cyber-text-dim">
                    <div className="text-cyber-text-dim">{SHIP_SLOT_LABEL[slot]}</div>
                    <div className="text-cyber-gray-light">{SHIP_MODULE_DEFS[current]?.name ?? current}</div>
                  </div>
                  <select
                    className="w-full mt-1 px-2 py-1 text-xs bg-cyber-dark border border-cyber-gray text-cyber-text rounded"
                    value={current}
                    disabled={active}
                    onChange={(e) => selectShipModule(slot, e.target.value as ShipModuleId)}
                  >
                    {options.map((id) => (
                      <option key={id} value={id}>{SHIP_MODULE_DEFS[id]?.name ?? id}</option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>

          <div className="mt-2 text-xs text-cyber-gray-light flex flex-wrap gap-x-3 gap-y-1">
            <div>Длительность: <span className="text-cyber-text">{shipUi.durationSeconds}с</span></div>
            <div>Лут: <span className="text-cyber-text">x{shipUi.rewardMult.toFixed(2)}</span></div>
            <div>Бонус сталь: <span className="text-cyber-text">{shipUi.steelChancePct}%</span></div>
            <div>Аномалия: <span className="text-cyber-text">{shipUi.anomalyChancePct}%</span></div>
          </div>

          <div className="mt-3 grid gap-2">
            {(['hull_mk2', 'engine_mk2', 'cargo_mk2'] as ShipModuleId[]).map((id) => {
              if (ship.unlocked[id]) return null;
              const def = SHIP_MODULE_DEFS[id];
              const e = def.cost.energy ?? D(0);
              const s = def.cost.steel ?? D(0);
              const canBuy = resources.energy.amount.gte(e) && resources.steel.amount.gte(s);
              return (
                <button
                  key={id}
                  className="cyber-button text-xs py-2 px-3 w-full"
                  disabled={active || !canBuy}
                  onClick={() => unlockShipModule(id)}
                >
                  <div className="flex items-center justify-between">
                    <span>Собрать: {def.name}</span>
                    <span className="text-cyber-text-dim">{formatNumber(e)}⚡, {formatNumber(s)} сталь</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 border-t border-cyber-gray/40 pt-3">
          <div className="text-xs text-cyber-text-dim mb-2">Навигационная карта</div>

          <div className="grid gap-2">
            {(['subspace', 'anomaly'] as const).map((id) => {
              const def = STAR_CHART_UPGRADE_DEFS[id];
              const level = starChart.levels[id] ?? 0;
              const cost = starChartUpgradeCost(id, level);
              const canBuy = Object.entries(cost).every(([res, amt]) => resources[res as keyof typeof resources].amount.gte(amt));
              const atMax = level >= def.maxLevel;

              const costText = Object.entries(cost)
                .map(([res, amt]) => `${formatNumber(amt)}${res === 'energy' ? '⚡' : ` ${res}`}`)
                .join(', ');

              const hint = id === 'subspace'
                ? `Сейчас: x${shipUi.subspaceMult.toFixed(2)} к времени`
                : `Сейчас: ${shipUi.anomalyChancePct}% шанс`;

              return (
                <div key={id} className="cyber-panel">
                  <div className="flex items-start justify-between gap-3">
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
                      className="cyber-button text-xs py-2 px-3"
                      disabled={active || atMax || !canBuy}
                      onClick={() => buyStarChartUpgrade(id)}
                    >
                      <div className="text-center">{atMax ? 'МАКС' : 'УЛУЧШИТЬ'}</div>
                      <div className="text-[10px] mt-1 text-cyber-text-dim">{atMax ? '—' : (costText || '—')}</div>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <button
          className="cyber-button text-sm py-2 px-4 w-full mt-3"
          disabled={active || !canAfford}
          onClick={() => startExpedition()}
        >
          <div className="flex items-center justify-center gap-2">
            <span>{active ? 'В ПРОЦЕССЕ' : 'СТАРТ: РАЗВЕДКА'}</span>
          </div>
          <div className="text-xs mt-1">
            Цена: {formatNumber(costEnergy)} ⚡, {formatNumber(costSteel)} сталь
          </div>
        </button>

        <div className="text-xs text-cyber-text-dim mt-3">
          Награда приходит в буфер базы и ограничена лимитами складов.
        </div>
      </div>
    </div>
  );
}
