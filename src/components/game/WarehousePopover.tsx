import { useEffect, useMemo, useRef } from 'react';
import type Decimal from 'break_eternity.js';
import type { ResourceType } from '../../core/gameTypes';
import { RESOURCE_LABEL } from '../../core/constants/labels';
import { formatNumber } from '../../core/math/format';
import { Pin, X } from 'lucide-react';

function productionTone(p: Decimal) {
  if (p.gt(0)) return 'text-cyber-green';
  if (p.lt(0)) return 'text-cyber-red';
  return 'text-cyber-text-dim';
}

export function WarehousePopover(props: {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  resources: Record<ResourceType, { amount: Decimal; max: Decimal; production: Decimal }>;
  isPinned: (id: ResourceType) => boolean;
  togglePin: (id: ResourceType) => void;
}) {
  const { open, onClose, anchorRef, resources, isPinned, togglePin } = props;
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    const onDown = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      const panel = panelRef.current;
      const anchor = anchorRef.current;
      if (panel && panel.contains(t)) return;
      if (anchor && anchor.contains(t)) return;
      onClose();
    };

    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onDown);
    };
  }, [open, onClose, anchorRef]);

  const entries = useMemo(() => {
    const all = Object.keys(resources) as ResourceType[];
    return all.map((k) => ({ key: k, ...resources[k] }));
  }, [resources]);

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      className="absolute right-3 sm:right-4 top-full mt-2 w-[min(520px,calc(100vw-1.5rem))] cyber-panel z-50"
      role="dialog"
      aria-label="Склад"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-cyber-green uppercase tracking-wider">Склад</div>
        <button type="button" className="cyber-button px-3 py-2 h-9" onClick={onClose} title="Закрыть">
          <div className="flex items-center gap-2">
            <X size={14} className="text-cyber-green" />
            <span className="text-xs">Закрыть</span>
          </div>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {entries.map(({ key, amount, max, production }) => {
          const full = max.gt(0) && amount.gte(max);
          const pinned = isPinned(key);
          return (
            <div key={key} className="border border-cyber-gray rounded px-3 py-2 bg-cyber-black/30">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm text-cyber-blue font-bold">{RESOURCE_LABEL[key]}</div>
                  <div className={`text-xs font-mono ${full ? 'text-cyber-red' : 'text-cyber-text'}`}>
                    {formatNumber(amount)} / {formatNumber(max)}
                    {full ? <span className="ml-2 text-[10px] text-cyber-red font-sans">ПОЛНО</span> : null}
                  </div>
                  <div className={`text-xs font-mono ${productionTone(production)}`}>
                    {production.gt(0) ? '+' : ''}{formatNumber(production)}/с
                  </div>
                </div>

                <button
                  type="button"
                  className={`cyber-button px-3 py-2 h-9 ${pinned ? 'border-cyber-green' : ''}`}
                  onClick={() => togglePin(key)}
                  title={pinned ? 'Убрать из закреплённых' : 'Закрепить в верхней панели'}
                >
                  <div className="flex items-center gap-2">
                    <Pin size={14} className={pinned ? 'text-cyber-green' : 'text-cyber-blue'} />
                    <span className="text-xs">{pinned ? 'Закрепл.' : 'Закрепить'}</span>
                  </div>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-[11px] text-cyber-text-dim mt-2">
        Закреплённые ресурсы показываются в верхней строке.
      </div>
    </div>
  );
}
