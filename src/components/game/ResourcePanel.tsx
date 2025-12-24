import { useMemo, useRef, useState } from 'react';
import type Decimal from 'break_eternity.js';
import { useGameStore } from '../../features/gameStore';
import { formatNumber } from '../../core/math/format.ts';
import { Zap, Box, Snowflake, Atom, Layers, Sparkles, PackageOpen } from 'lucide-react';
import type { ResourceType } from '../../core/gameTypes';
import { RESOURCE_LABEL } from '../../core/constants/labels';
import { usePinnedResources } from '../../hooks/usePinnedResources';
import { WarehousePopover } from './WarehousePopover';

const ICON_BY_RESOURCE: Record<ResourceType, any> = {
  energy: Zap,
  ore: Box,
  ice: Snowflake,
  carbon: Atom,
  steel: Layers,
  dark_matter: Sparkles,
};

function productionTone(p: Decimal) {
  if (p.gt(0)) return 'text-cyber-green';
  if (p.lt(0)) return 'text-cyber-red';
  return 'text-cyber-text-dim';
}

export function ResourcePanel() {
  const resources = useGameStore(state => state.resources);
  const { pins, isPinned, togglePin } = usePinnedResources();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const pinned = useMemo(() => {
    // keep stable order from pins
    return pins
      .filter((k) => Boolean(resources[k as ResourceType]))
      .map((k) => k as ResourceType);
  }, [pins, resources]);

  // Проверяем переполнение складов
  const hasFullStorage = useMemo(() => {
    return Object.values(resources).some(r => r.max.gt(0) && r.amount.gte(r.max.mul(0.95)));
  }, [resources]);

  return (
    <div className="bg-cyber-dark border-b border-cyber-gray px-4 py-3 relative">
      {hasFullStorage && (
        <div className="mb-2 px-3 py-2 rounded bg-cyber-red/10 border border-cyber-red/50 flex items-center gap-2">
          <span className="text-xs text-cyber-red font-bold">⚠️ СКЛАД ПЕРЕПОЛНЕН</span>
          <span className="text-[10px] text-cyber-red">Постройте "Малый Конденсатор" или "Складской Модуль" для увеличения лимитов!</span>
        </div>
      )}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-4 overflow-x-auto flex-1">
          {pinned.map((key) => {
            const r = resources[key];
            const full = r.max.gt(0) && r.amount.gte(r.max);

            const Icon = ICON_BY_RESOURCE[key];
            const tone = key === 'energy' ? 'text-cyber-green' : 'text-cyber-blue';

            return (
              <div
                key={key}
                className={`shrink-0 flex items-center gap-2.5 px-3 py-2 rounded bg-cyber-darker/50 border border-cyber-gray/30 ${tone}`}
                title={`${RESOURCE_LABEL[key]}\n${formatNumber(r.amount)} / ${formatNumber(r.max)}\n${r.production.gt(0) ? '+' : ''}${formatNumber(r.production)}/с`}
              >
                <Icon size={18} />
                <div className="flex items-baseline gap-2">
                  <span className={`font-mono text-base font-bold ${full ? 'text-cyber-red' : 'text-cyber-text'}`}>{formatNumber(r.amount)}</span>
                  <span className={`text-xs font-mono ${productionTone(r.production)}`}>
                    ({r.production.gt(0) ? '+' : ''}{formatNumber(r.production)}/с)
                  </span>
                </div>
                {full ? <span className="text-[10px] text-cyber-red font-sans">ПОЛНО</span> : null}
              </div>
            );
          })}
        </div>

        <button
          ref={buttonRef}
          type="button"
          className="cyber-button px-3 py-2 h-9 shrink-0"
          onClick={() => setOpen((v) => !v)}
          title="Открыть склад и закрепление ресурсов"
        >
          <div className="flex items-center gap-2">
            <PackageOpen size={14} className="text-cyber-green" />
            <span className="text-xs">Склад</span>
          </div>
        </button>
      </div>

      <WarehousePopover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={buttonRef}
        resources={resources}
        isPinned={isPinned}
        togglePin={togglePin}
      />
    </div>
  );
}
