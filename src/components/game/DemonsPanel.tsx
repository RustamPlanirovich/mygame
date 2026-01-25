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
    <div className="p-3 border-b border-cyber-gray">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg text-cyber-green uppercase tracking-wide flex items-center gap-1.5">
          <Skull size={16} className="text-cyber-green" />
          <span>Демоны</span>
        </h2>
        <div className="text-[10px] text-cyber-text-dim">аренда за ⚡/с</div>
      </div>

      <div className="space-y-1.5">
        {ORDER.map((id) => {
          const def = DEMON_DEFS[id];
          const active = Boolean(demons.active[id]);
          const paid = Boolean(demons.rentPaid?.[id]);
          const effective = active && paid;

          return (
            <div key={id} className={`cyber-panel p-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 hover:border-cyber-blue transition-colors ${active ? (paid ? 'border-cyber-green' : 'border-cyber-red') : ''}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <div className="text-sm text-cyber-blue font-semibold truncate">{def.name}</div>
                  {active && !paid && <span className="text-[9px] px-1 py-0.5 rounded bg-cyber-red/20 text-cyber-red border border-cyber-red/50 shrink-0">НЕ ОПЛ.</span>}
                </div>
                <div className="text-[10px] text-cyber-text-dim mt-0.5">
                  {formatNumber(def.energyPerSecond)}⚡/с
                  <span className="text-cyber-gray-light"> · {active ? (
                    <span className={effective ? 'text-cyber-green' : 'text-cyber-red'}>
                      {effective ? '✓ опл.' : '✗ не опл.'}
                    </span>
                  ) : 'ВЫКЛ'}</span>
                </div>
              </div>

              <button
                className="cyber-button text-[11px] py-1.5 px-3 w-full sm:w-auto sm:min-w-[100px] shrink-0"
                onClick={() => toggleDemon(id)}
              >
                {active ? 'ВЫКЛ' : 'ВКЛ'}
              </button>
            </div>
          );
        })}
      </div>

      {oracleHint ? (
        <div className="text-[10px] text-cyber-text-dim mt-2">
          🔮 Oracle: <span className="text-cyber-text">{oracleHint.name}</span>
          <span className="text-cyber-gray-light"> · ROI ≈ {oracleHint.roi}с</span>
        </div>
      ) : null}
      
      <div className="text-[10px] text-cyber-text-dim mt-2">
        💡 Эффекты работают только при оплате (хватает ⚡).
      </div>
    </div>
  );
}
