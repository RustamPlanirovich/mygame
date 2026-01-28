/**
 * EnergyBreakdown Component
 * 
 * Показывает разбивку потребления энергии по зданиям
 * с учётом уровней зданий и эволюции
 */

import { useMemo } from 'react';
import { Zap, TrendingUp, TrendingDown } from 'lucide-react';
import { useGameStore } from '../../../features/gameStore';
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

export function EnergyBreakdown() {
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
      <div className="bg-cyber-gray-800/50 rounded-lg border border-cyber-gray-700 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-5 h-5 text-yellow-400" />
          <h3 className="text-lg font-medium text-cyber-gray-200">Энергобаланс</h3>
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="p-2 rounded bg-green-900/30 border border-green-500/30">
            <div className="text-lg font-bold text-green-400">+{formatNumber(totalProduction)}</div>
            <div className="text-[10px] text-green-300/70">Производство/с</div>
          </div>
          <div className="p-2 rounded bg-red-900/30 border border-red-500/30">
            <div className="text-lg font-bold text-red-400">-{formatNumber(totalConsumption)}</div>
            <div className="text-[10px] text-red-300/70">Потребление/с</div>
          </div>
          <div className={`p-2 rounded ${isDeficit ? 'bg-red-900/40 border-red-500/50' : 'bg-cyan-900/30 border-cyan-500/30'}`}>
            <div className={`text-lg font-bold ${isDeficit ? 'text-red-400' : 'text-cyan-400'}`}>
              {balance.gte(0) ? '+' : ''}{formatNumber(balance)}
            </div>
            <div className={`text-[10px] ${isDeficit ? 'text-red-300/70' : 'text-cyan-300/70'}`}>Баланс/с</div>
          </div>
        </div>

        {isDeficit && (
          <div className="mt-2 p-2 bg-red-900/30 rounded text-xs text-red-300">
            ⚠️ Дефицит энергии! Постройте больше электростанций.
          </div>
        )}
      </div>

      {/* Производители */}
      <div className="bg-cyber-gray-800/50 rounded-lg border border-cyber-gray-700 p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-green-400" />
          <h4 className="text-sm font-medium text-cyber-gray-200">Производители энергии</h4>
          <span className="text-xs text-cyber-gray-500">({producers.length})</span>
        </div>

        {producers.length === 0 ? (
          <div className="text-xs text-cyber-gray-500 text-center py-4">
            Нет электростанций
          </div>
        ) : (
          <div className="space-y-2">
            {producers.map(p => (
              <div key={p.buildingId} className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-cyber-gray-300 truncate">{p.buildingName}</span>
                    <span className="text-green-400 font-mono ml-2">+{formatNumber(p.total)}/с</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-1.5 bg-cyber-gray-900 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-green-500 transition-all"
                        style={{ width: `${p.percentage}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-cyber-gray-500 w-12 text-right">
                      {p.percentage.toFixed(1)}%
                    </span>
                  </div>
                  <div className="text-[10px] text-cyber-gray-600 mt-0.5">
                    {p.count}× ~{formatNumber(p.perBuilding)}/с (в среднем)
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Потребители */}
      <div className="bg-cyber-gray-800/50 rounded-lg border border-cyber-gray-700 p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingDown className="w-4 h-4 text-red-400" />
          <h4 className="text-sm font-medium text-cyber-gray-200">Потребители энергии</h4>
          <span className="text-xs text-cyber-gray-500">({consumers.length})</span>
        </div>

        {consumers.length === 0 ? (
          <div className="text-xs text-cyber-gray-500 text-center py-4">
            Нет зданий, потребляющих энергию
          </div>
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {consumers.map(c => (
              <div key={c.buildingId} className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-cyber-gray-300 truncate">{c.buildingName}</span>
                    <span className="text-red-400 font-mono ml-2">-{formatNumber(c.total)}/с</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-1.5 bg-cyber-gray-900 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-red-500 transition-all"
                        style={{ width: `${c.percentage}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-cyber-gray-500 w-12 text-right">
                      {c.percentage.toFixed(1)}%
                    </span>
                  </div>
                  <div className="text-[10px] text-cyber-gray-600 mt-0.5">
                    {c.count}× ~{formatNumber(c.perBuilding)}/с (в среднем)
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
