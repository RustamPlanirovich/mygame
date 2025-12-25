import { useGameStore } from '../../features/gameStore';
import { formatNumber } from '../../core/math/format.ts';
import { DollarSign, Beaker, Crown } from 'lucide-react';
import Decimal from 'break_eternity.js';

export function CurrencyPanel() {
  const currency = useGameStore(state => state.currency);
  const buildings = useGameStore(state => state.buildings);
  const technologies = useGameStore(state => state.technologies);
  const activePolicies = useGameStore(state => state.politics.activePolicies);
  
  // Calculate RP production
  const rpProduction = buildings
    .filter(b => b.count > 0 && b.production?.researchPoints)
    .reduce((sum, b) => {
      const base = b.production!.researchPoints!.mul(b.count);
      
      // Apply policy bonuses
      let multiplier = 1;
      if (activePolicies.includes('scientific_breakthrough')) multiplier += 0.5;
      if (activePolicies.includes('quantum_computing')) {
        const quantumLabs = buildings.find(b2 => b2.id === 'quantum_lab')?.count || 0;
        if (quantumLabs > 0) multiplier += 1.0;
      }
      if (activePolicies.includes('experimental_science')) multiplier += 1.0;
      
      return sum.add(base.mul(multiplier));
    }, new Decimal(0));
  
  // Calculate Influence production
  const influenceProduction = buildings
    .filter(b => b.count > 0 && b.production?.influence)
    .reduce((sum, b) => {
      const base = b.production!.influence!.mul(b.count);
      
      // Apply policy bonuses
      let multiplier = 1;
      if (activePolicies.includes('colonial_expansion')) {
        const colonies = buildings.find(b2 => b2.id === 'space_colony')?.count || 0;
        if (colonies > 0) multiplier += 0.5;
      }
      
      return sum.add(base.mul(multiplier));
    }, new Decimal(0));

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
