import { useMemo } from 'react';
import { useGameStore } from '../../features/gameStore';
import { formatNumber } from '../../core/math/format.ts';
import type { DemonId } from '../../core/gameTypes';
import { DEMON_DEFS } from '../../core/constants/progression';
import { Skull } from 'lucide-react';

const ORDER: DemonId[] = ['smart_broker', 'overclocker', 'oracle'];

export function DemonsPanel() {
  const demons = useGameStore((s) => s.demons);
  const buildings = useGameStore((s) => s.buildings);
  const toggleDemon = useGameStore((s) => s.toggleDemon);

  const oracleHint = useMemo(() => {
    if (!demons.oracleRecommendationId || demons.oracleRecommendationRoiSeconds == null) return null;
    const b = buildings.find((x) => x.id === demons.oracleRecommendationId);
    const name = b?.name ?? demons.oracleRecommendationId;
    const roi = Math.max(0, Math.round(demons.oracleRecommendationRoiSeconds));
    return { name, roi };
  }, [demons.oracleRecommendationId, demons.oracleRecommendationRoiSeconds, buildings]);

  return (
    <div className="p-4 border-b border-cyber-gray">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-xl text-cyber-green uppercase tracking-wider flex items-center gap-2">
          <Skull size={18} className="text-cyber-green" />
          <span>Демоны</span>
        </h2>
        <div className="text-xs text-cyber-text-dim">аренда за ⚡/с</div>
      </div>

      <div className="space-y-2">
        {ORDER.map((id) => {
          const def = DEMON_DEFS[id];
          const active = Boolean(demons.active[id]);
          const paid = Boolean(demons.rentPaid?.[id]);
          const effective = active && paid;

          return (
            <div key={id} className={`cyber-panel flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:border-cyber-blue transition-colors ${active ? (paid ? 'border-cyber-green' : 'border-cyber-red') : ''}`}>
              <div>
                <div className="flex items-center gap-2">
                  <div className="text-cyber-blue font-bold">{def.name}</div>
                  {active && !paid && <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyber-red/20 text-cyber-red border border-cyber-red/50">НЕ ОПЛАЧЕНО</span>}
                </div>
                <div className="text-xs text-cyber-text-dim">{def.description}</div>
                <div className="text-xs text-cyber-text-dim mt-1">
                  Аренда: <span className="text-cyber-text">{formatNumber(def.energyPerSecond)}⚡/с</span>
                  <span className="text-cyber-gray-light"> · Статус: {active ? 'ВКЛ' : 'ВЫКЛ'}</span>
                  {active ? (
                    <span className={effective ? 'text-cyber-green' : 'text-cyber-red'}>
                      {' '}· {effective ? '✓ оплачено' : '✗ недостаточно энергии'}
                    </span>
                  ) : null}
                </div>
              </div>

              <button
                className="cyber-button text-sm py-2 px-4 w-full sm:w-auto sm:min-w-[160px]"
                onClick={() => toggleDemon(id)}
              >
                {active ? 'ОТКЛЮЧИТЬ' : 'ВКЛЮЧИТЬ'}
              </button>
            </div>
          );
        })}
      </div>

      {oracleHint ? (
        <div className="text-xs text-cyber-text-dim mt-3">
          Oracle: выгоднее всего сейчас <span className="text-cyber-text">{oracleHint.name}</span>
          <span className="text-cyber-gray-light"> · ROI ≈ {oracleHint.roi}с</span>
        </div>
      ) : null}
      
      <div className="text-xs text-cyber-text-dim mt-3">
        <div>💡 Эффекты демонов работают только если аренда оплачена (хватает ⚡ на базе).</div>
        <div className="text-[10px] text-cyber-gray-light mt-1 italic">
          ⚠️ Smart Broker не продаёт ресурсы если энергия {'>'} 85% (чтобы не терять прибыль)
        </div>
      </div>
    </div>
  );
}
