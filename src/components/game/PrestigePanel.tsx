import { useMemo } from 'react';
import { useGameStore } from '../../features/gameStore';
import { formatNumber } from '../../core/math/format.ts';
import {
  QUANTUM_NET_UPGRADE_DEFS,
  computeChronoShiftStartingBonus,
  computeMemoryPreservationEnabled,
  quantumNetUpgradeCost,
} from '../../core/constants/quantumNet';
import { RotateCcw } from 'lucide-react';

const estimateQubitGain = (lifetimeEnergyProducedStr: string) => {
  // MVP: gain = floor(log10(lifetimeEnergyProduced + 1))
  // Keep robust for huge numbers like 1e+123.
  const s = lifetimeEnergyProducedStr;
  if (s.includes('e')) {
    const parts = s.split('e');
    const exp = Number(parts[1]);
    if (Number.isFinite(exp) && exp > 0) return Math.floor(exp);
  }
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(Math.log10(n + 1));
};

export function PrestigePanel() {
  const meta = useGameStore((s) => s.meta);
  const prestigeReset = useGameStore((s) => s.prestigeReset);
  const quantumNet = useGameStore((s) => s.quantumNet);
  const buyQuantumNetUpgrade = useGameStore((s) => s.buyQuantumNetUpgrade);
  const setQuantumNetPreservedBuildingId = useGameStore((s) => s.setQuantumNetPreservedBuildingId);
  const buildings = useGameStore((s) => s.buildings);

  const gain = useMemo(() => estimateQubitGain(meta.lifetimeEnergyProduced.toString()), [meta.lifetimeEnergyProduced]);

  const chronoLevel = quantumNet.levels.chrono_shift ?? 0;
  const memoryEnabled = computeMemoryPreservationEnabled(quantumNet.levels.memory_preservation ?? 0);
  const chronoBonus = useMemo(() => computeChronoShiftStartingBonus(chronoLevel), [chronoLevel]);

  return (
    <div className="p-4 border-b border-cyber-gray">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-xl text-cyber-green uppercase tracking-wider flex items-center gap-2">
          <RotateCcw size={18} className="text-cyber-green" />
          <span>Престиж</span>
        </h2>
        <div className="text-xs text-gray-500">Кубиты</div>
      </div>

      <div className="cyber-panel">
        <div className="text-xs text-gray-600">
          Кубиты: <span className="text-gray-300">{formatNumber(meta.qubits)}</span>
        </div>
        <div className="text-xs text-gray-600 mt-1">
          Энергии произведено за цикл: <span className="text-gray-300">{formatNumber(meta.lifetimeEnergyProduced)}</span>
        </div>
        <div className="text-xs text-gray-700 mt-2">
          Бонусы от кубитов (MVP): +2% лимиты хранения, +2% скорость, +2% усиление обороны за кубит.
        </div>

        <button
          className="cyber-button text-sm py-2 px-4 w-full mt-3"
          disabled={gain <= 0}
          onClick={() => prestigeReset()}
        >
          <div className="flex items-center justify-center gap-2">
            <span>ПРЕСТИЖ: СБРОС</span>
          </div>
          <div className="text-xs mt-1">
            {gain > 0 ? `Получить: +${gain} кубит(ов)` : 'Недостаточно произведённой энергии'}
          </div>
        </button>

        <div className="mt-4 border-t border-cyber-gray/40 pt-3">
          <div className="flex items-baseline justify-between mb-2">
            <div className="text-xs text-gray-500">Квантовая нейросеть</div>
            <div className="text-[10px] text-gray-700">тратит кубиты</div>
          </div>

          <div className="space-y-2">
            {(['chrono_shift', 'memory_preservation'] as const).map((id) => {
              const def = QUANTUM_NET_UPGRADE_DEFS[id];
              const level = quantumNet.levels[id] ?? 0;
              const cost = quantumNetUpgradeCost(id, level);
              const atMax = level >= def.maxLevel;
              const canBuy = meta.qubits.gte(cost);

              const hint = id === 'chrono_shift'
                ? `Бонус после престижа: +${chronoBonus.energy}⚡, +${chronoBonus.ore} руда, +${chronoBonus.ice} лёд, +${chronoBonus.carbon} углерод, +${chronoBonus.steel} сталь`
                : (memoryEnabled ? 'Активно' : 'Не активно');

              return (
                <div key={id} className="cyber-panel flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:border-cyber-blue transition-colors">
                  <div>
                    <div className="text-cyber-blue font-bold">{def.name}</div>
                    <div className="text-xs text-gray-500">{def.description}</div>
                    <div className="text-xs text-gray-600 mt-1">
                      Уровень: <span className="text-gray-300">{level}</span>
                      <span className="text-gray-700"> / {def.maxLevel}</span>
                      <span className="text-gray-700"> · {hint}</span>
                    </div>
                  </div>

                  <button
                    className="cyber-button text-sm py-2 px-4 w-full sm:w-auto sm:min-w-[160px]"
                    disabled={atMax || !canBuy}
                    onClick={() => buyQuantumNetUpgrade(id)}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <span>{atMax ? 'МАКС' : 'КУПИТЬ'}</span>
                    </div>
                    <div className="text-xs mt-1">
                      {atMax ? '—' : `${cost} кубит(ов)`}
                    </div>
                  </button>
                </div>
              );
            })}
          </div>

          <div className="mt-3">
            <div className="text-xs text-gray-600 mb-1">Сохранить здание после престижа</div>
            <select
              className="w-full px-2 py-1 text-xs bg-cyber-dark border border-cyber-gray text-cyber-text rounded"
              value={quantumNet.preservedBuildingId ?? ''}
              disabled={!memoryEnabled}
              onChange={(e) => setQuantumNetPreservedBuildingId(e.target.value ? e.target.value : null)}
            >
              <option value="">—</option>
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <div className="text-[10px] text-gray-700 mt-1">
              При престиже здание будет размещено в (0,0), если оно было построено в текущем цикле.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
