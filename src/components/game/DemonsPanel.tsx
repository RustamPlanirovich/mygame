import { useMemo, useState } from 'react';
import { useGameStore } from '../../features/gameStore';
import { formatNumber } from '../../core/math/format.ts';
import type { DemonId, TradeResourceType } from '../../core/gameTypes';
import { DEMON_DEFS } from '../../core/constants/progression';
import { TRADE_LABEL } from '../../core/constants/labels';
import { Skull, Settings } from 'lucide-react';
import { GameIcon, IconText } from '../ui/icons';

/*
 * Порядок ручной, а не по Object.keys: сверху три демона с одной только арендой (их можно
 * держать включёнными постоянно), ниже — со сдельной оплатой, где счёт растёт вместе с
 * пользой. Так список читается как «дешёвые → дорогие», а не как история коммитов.
 */
const ORDER: DemonId[] = [
  'smart_broker',
  'overclocker',
  'oracle',
  'supplier',
  'scrubber',
  'geologist',
  'archivist',
  'night_shift',
];

const TRADEABLE_RESOURCES: TradeResourceType[] = [
  'ore', 'ice', 'carbon', 'steel',
  'natural_gas', 'oil', 'gasoline', 'plastic', 'glass', 'sand',
  'uranium', 'chrome', 'titanium',
  'copper', 'semiconductors', 'dynamite', 'fiber',
  'integrated_circuit', 'battery', 'engine', 'display', 'computer',
  'liquid_fuel', 'chrome_alloy', 'titanium_alloy', 'enriched_uranium',
  'weapon', 'artillery', 'radar', 'nuclear_bomb',
  'jet_engine', 'satellite', 'rocket', 'spaceship', 'console', 'space_station',
  'robot'
];

export function DemonsPanel() {
  const demons = useGameStore((s) => s.demons);
  const buildings = useGameStore((s) => s.buildings);
  const toggleDemon = useGameStore((s) => s.toggleDemon);
  const toggleBrokerAutoSell = useGameStore((s) => s.toggleBrokerAutoSell);
  const [showBrokerSettings, setShowBrokerSettings] = useState(false);

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
        <div className="text-[10px] text-cyber-text-dim">аренда за <GameIcon icon="⚡" />/с</div>
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
                  <IconText>{def.description}</IconText>
                </div>
                {def.variableCost && (
                  <div className="text-[10px] text-cyber-yellow/80 mt-0.5">
                    <GameIcon icon="🧾" /> сдельно: <IconText>{def.variableCost}</IconText>
                  </div>
                )}
                <div className="text-[10px] text-cyber-text-dim mt-0.5">
                  {formatNumber(def.energyPerSecond)}<GameIcon icon="⚡" />/с аренда
                  <span className="text-cyber-gray-light"> · {active ? (
                    <span className={effective ? 'text-cyber-green' : 'text-cyber-red'}>
                      <IconText>{effective ? '✓ опл.' : '✗ не опл.'}</IconText>
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
          <GameIcon icon="🔮" /> Oracle: <span className="text-cyber-text">{oracleHint.name}</span>
          <span className="text-cyber-gray-light"> · ROI ≈ {oracleHint.roi}с</span>
        </div>
      ) : null}
      
      <div className="text-[10px] text-cyber-text-dim mt-2">
        <GameIcon icon="💡" /> Эффекты работают только при оплате (хватает <GameIcon icon="⚡" />).
      </div>

      {/* Smart-Broker Settings */}
      {demons.active.smart_broker && (
        <div className="mt-3 pt-3 border-t border-cyber-gray/50">
          <button
            onClick={() => setShowBrokerSettings(!showBrokerSettings)}
            className="flex items-center gap-2 text-xs text-cyber-blue hover:text-cyber-green transition-colors mb-2"
          >
            <Settings size={14} />
            <span>Настройки автопродажи Smart-Broker</span>
            <span className="text-cyber-gray-light"><IconText>{showBrokerSettings ? '▼' : '▶'}</IconText></span>
          </button>

          {showBrokerSettings && (
            <div className="space-y-1.5 max-h-48 overflow-y-auto cyber-scrollbar">
              <div className="text-[10px] text-cyber-text-dim mb-2">
                <GameIcon icon="💡" /> Отключите автопродажу для ресурсов, которые нужно копить
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {TRADEABLE_RESOURCES.map((res) => {
                  const excluded = Boolean(demons.brokerExcludeFromAutoSell[res]);
                  return (
                    <button
                      key={res}
                      onClick={() => toggleBrokerAutoSell(res)}
                      className={`text-[10px] py-1.5 px-2 rounded border transition-colors text-left ${
                        excluded
                          ? 'bg-cyber-dark border-cyber-gray text-cyber-gray-light'
                          : 'bg-cyber-green/10 border-cyber-green text-cyber-green'
                      }`}
                      title={excluded ? 'Не продается' : 'Продается автоматически'}
                    >
                      <span className="mr-1"><IconText>{excluded ? '🚫' : '✓'}</IconText></span>
                      {TRADE_LABEL[res] || res}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
