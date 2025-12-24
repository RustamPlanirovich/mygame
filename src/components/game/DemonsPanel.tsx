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
        <div className="text-xs text-gray-500">аренда за ⚡/с</div>
      </div>

      <div className="space-y-2">
        {ORDER.map((id) => {
          const def = DEMON_DEFS[id];
          const active = Boolean(demons.active[id]);
          const paid = Boolean(demons.rentPaid?.[id]);
          const effective = active && paid;

          return (
            <div key={id} className={`cyber-panel flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:border-cyber-blue transition-colors ${active ? 'border-cyber-green' : ''}`}>
              <div>
                <div className="text-cyber-blue font-bold">{def.name}</div>
                <div className="text-xs text-gray-500">{def.description}</div>
                <div className="text-xs text-gray-600 mt-1">
                  Аренда: <span className="text-gray-300">{formatNumber(def.energyPerSecond)}⚡/с</span>
                  <span className="text-gray-700"> · Статус: {active ? 'ВКЛ' : 'ВЫКЛ'}</span>
                  {active ? (
                    <span className={effective ? 'text-gray-700' : 'text-cyber-blue'}>
                      {' '}· {effective ? 'оплачено' : 'не оплачено'}
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
        <div className="text-xs text-gray-600 mt-3">
          Oracle: выгоднее всего сейчас <span className="text-gray-300">{oracleHint.name}</span>
          <span className="text-gray-700"> · ROI ≈ {oracleHint.roi}с</span>
        </div>
      ) : (
        <div className="text-xs text-gray-600 mt-3">
          Эффекты демонов работают только если аренда оплачена (хватает ⚡ на базе).
        </div>
      )}
    </div>
  );
}
