import { useMemo } from 'react';
import { useGameStore } from '../../features/gameStore';
import { formatNumber } from '../../core/math/format.ts';
import { DollarSign, Beaker, Crown } from 'lucide-react';
import {
  baseInfluencePerSecond,
  baseResearchPointsPerSecond,
} from '../../core/production/currencyRates';

export function CurrencyPanel() {
  const currency = useGameStore(state => state.currency);
  // Placed tiles are what actually produce; `state.buildings` is the shop catalogue and its
  // `.count` says nothing about output. Subscribing to `tiles` also means this only recomputes
  // when the player builds something, not 20 times a second like `currency` does.
  const tiles = useGameStore(state => state.grid.tiles);
  const energyEfficiency = useGameStore(state => state.energyEfficiency);

  /*
   * These used to be derived from `b.production?.researchPoints` / `.influence` — fields that do
   * not exist on Building, so the filters matched nothing and both tooltips permanently showed
   * "+0/с". They also applied policy multipliers by hand and looked for a building id
   * `quantum_lab` that does not exist (the real id is `quantum_lab_mk1`).
   *
   * Now both come from the same module the tick uses, including the energy-efficiency factor the
   * tick multiplies in, so the displayed rate is the rate the player actually receives.
   */
  const rpProduction = useMemo(
    () => baseResearchPointsPerSecond(tiles).mul(energyEfficiency),
    [tiles, energyEfficiency],
  );
  const influenceProduction = useMemo(
    () => baseInfluencePerSecond(tiles).mul(energyEfficiency),
    [tiles, energyEfficiency],
  );

  return (
    <div className="px-3 py-2">
      <div className="flex items-center gap-3">
        {/* Кредиты */}
        <div
          className="flex items-center gap-1.5 px-2 py-1 rounded bg-cyber-dark/50 border border-cyber-gray/30"
          title="Кредиты - основная валюта для покупки зданий"
        >
          <DollarSign size={14} className="text-cyber-yellow" />
          <div className="flex flex-col">
            <span className="text-[9px] text-cyber-text-dim font-sans uppercase">Кредиты</span>
            <span className="font-mono text-xs font-bold text-cyber-yellow">
              {formatNumber(currency.credits)}
            </span>
          </div>
        </div>

        {/* Очки исследований */}
        <div
          className="flex items-center gap-1.5 px-2 py-1 rounded bg-cyber-dark/50 border border-cyber-gray/30"
          title={`Очки исследований - для разблокировки технологий\nПроизводство: +${formatNumber(rpProduction)}/с`}
        >
          <Beaker size={14} className="text-cyber-blue" />
          <div className="flex flex-col">
            <span className="text-[9px] text-cyber-text-dim font-sans uppercase">Исследования</span>
            <span className="font-mono text-xs font-bold text-cyber-blue">
              {formatNumber(currency.researchPoints)}
            </span>
          </div>
        </div>

        {/* Влияние */}
        <div
          className="flex items-center gap-1.5 px-2 py-1 rounded bg-cyber-dark/50 border border-cyber-gray/30"
          title={`Влияние - для дипломатии и особых действий\nПроизводство: +${formatNumber(influenceProduction)}/с`}
        >
          <Crown size={14} className="text-cyber-purple" />
          <div className="flex flex-col">
            <span className="text-[9px] text-cyber-text-dim font-sans uppercase">Влияние</span>
            <span className="font-mono text-xs font-bold text-cyber-purple">
              {formatNumber(currency.influence)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
