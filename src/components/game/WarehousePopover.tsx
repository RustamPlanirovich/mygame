import { useEffect, useMemo, useRef, useState } from 'react';
import type Decimal from 'break_eternity.js';
import type { ResourceType, Building } from '../../core/gameTypes';
import { RESOURCE_LABEL } from '../../core/constants/labels';
import { formatNumber } from '../../core/math/format';
import { Pin, X, Search, Factory } from 'lucide-react';

function productionTone(p: Decimal | undefined) {
  if (!p) return 'text-cyber-text-dim';
  if (p.gt(0)) return 'text-cyber-green';
  if (p.lt(0)) return 'text-cyber-red';
  return 'text-cyber-text-dim';
}

/**
 * Подсчитывает количество зданий, производящих ресурс
 */
function countProducingBuildings(buildings: Record<string, Building>, resource: ResourceType): number {
  let count = 0;
  for (const b of Object.values(buildings)) {
    if (b.production && b.production[resource] && b.count > 0) {
      count += b.count;
    }
  }
  return count;
}

export function WarehousePopover(props: {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  resources: Record<ResourceType, { amount: Decimal; max: Decimal; production: Decimal }>;
  buildings: Record<string, Building>;
  isPinned: (id: ResourceType) => boolean;
  togglePin: (id: ResourceType) => void;
}) {
  const { open, onClose, anchorRef, resources, buildings, isPinned, togglePin } = props;
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement | null>(null);

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
    
    // Группировка ресурсов для логической сортировки
    const groups = {
      basic: ['energy', 'ore', 'ice', 'carbon', 'steel'] as ResourceType[],
      phase2_basic: ['natural_gas', 'oil', 'sand', 'gasoline', 'plastic', 'glass', 'chemicals'] as ResourceType[],
      phase2_metals: ['copper', 'uranium', 'chrome', 'titanium'] as ResourceType[],
      phase2_advanced: ['semiconductors', 'dynamite', 'fiber'] as ResourceType[],
      phase2_complex: ['integrated_circuit', 'battery', 'engine', 'display', 'computer', 'liquid_fuel', 'chrome_alloy', 'titanium_alloy', 'enriched_uranium'] as ResourceType[],
      phase2_military: ['weapon', 'artillery', 'radar', 'nuclear_bomb'] as ResourceType[],
      phase2_space: ['jet_engine', 'satellite', 'rocket', 'spaceship', 'console', 'space_station'] as ResourceType[],
      special: ['dark_matter', 'robot', 'waste', 'radioactive_waste'] as ResourceType[],
    };
    
    // Собираем в правильном порядке
    const ordered: ResourceType[] = [];
    for (const group of Object.values(groups)) {
      for (const res of group) {
        if (all.includes(res)) {
          ordered.push(res);
        }
      }
    }
    
    // Добавляем ресурсы которые не попали ни в одну группу
    for (const res of all) {
      if (!ordered.includes(res)) {
        ordered.push(res);
      }
    }
    
    return ordered.map((k) => ({ key: k, ...resources[k] }));
  }, [resources]);

  // Фильтрация по поиску
  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return entries;
    const query = searchQuery.toLowerCase().trim();
    return entries.filter(({ key }) => {
      const label = RESOURCE_LABEL[key]?.toLowerCase() || key.toLowerCase();
      return label.includes(query) || key.includes(query);
    });
  }, [entries, searchQuery]);

  // Фокус на поле поиска при открытии
  useEffect(() => {
    if (open && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    if (!open) {
      setSearchQuery('');
    }
  }, [open]);

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      className="absolute right-3 sm:right-4 top-full mt-2 w-[min(560px,calc(100vw-1.5rem))] max-h-[calc(100vh-8rem)] cyber-panel z-50 flex flex-col"
      role="dialog"
      aria-label="Склад"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-3 flex-shrink-0">
        <div className="text-sm text-cyber-green uppercase tracking-wider font-bold">Склад</div>
        <button 
          type="button" 
          className="p-1.5 rounded border border-cyber-gray/50 hover:border-cyber-red hover:bg-cyber-red/10 transition-colors" 
          onClick={onClose} 
          title="Закрыть (Esc)"
        >
          <X size={14} className="text-cyber-text-dim hover:text-cyber-red" />
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-3 flex-shrink-0">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-cyber-text-dim" />
        <input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Поиск ресурса..."
          className="w-full pl-8 pr-3 py-2 bg-cyber-black/50 border border-cyber-gray/50 rounded text-sm text-cyber-text placeholder:text-cyber-text-dim focus:border-cyber-blue focus:outline-none"
        />
        {searchQuery && (
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-cyber-text-dim hover:text-cyber-text"
            onClick={() => setSearchQuery('')}
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Resources grid */}
      <div className="grid grid-cols-2 gap-2 overflow-y-auto pr-1 flex-1">
        {filteredEntries.map(({ key, amount, max, production }) => {
          if (!amount || !max) return null;
          const full = max.gt(0) && amount.gte(max);
          const pinned = isPinned(key);
          const producingCount = countProducingBuildings(buildings, key);
          
          return (
            <div 
              key={key} 
              className={`border rounded p-2.5 bg-cyber-black/40 transition-colors ${
                pinned 
                  ? 'border-cyber-green/50 bg-cyber-green/5' 
                  : 'border-cyber-gray/40 hover:border-cyber-gray/60'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                {/* Левая часть - информация */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm text-cyber-blue font-bold truncate">{RESOURCE_LABEL[key]}</span>
                    {producingCount > 0 && (
                      <span 
                        className="flex items-center gap-0.5 text-[10px] text-cyber-text-dim shrink-0"
                        title={`${producingCount} зданий производят этот ресурс`}
                      >
                        <Factory size={10} />
                        <span>{producingCount}</span>
                      </span>
                    )}
                  </div>
                  <div className={`text-xs font-mono mt-0.5 ${full ? 'text-cyber-red' : 'text-cyber-text'}`}>
                    {formatNumber(amount)} / {formatNumber(max)}
                    {full && <span className="ml-1.5 text-[9px] text-cyber-red font-sans uppercase">Полно</span>}
                  </div>
                  <div className={`text-xs font-mono ${productionTone(production)}`}>
                    {production?.gt(0) ? '+' : ''}{formatNumber(production)}/с
                  </div>
                </div>

                {/* Кнопка закрепления - только иконка */}
                <button
                  type="button"
                  className={`p-1.5 rounded border transition-all shrink-0 ${
                    pinned 
                      ? 'border-cyber-green bg-cyber-green/20 text-cyber-green' 
                      : 'border-cyber-gray/50 hover:border-cyber-blue text-cyber-text-dim hover:text-cyber-blue'
                  }`}
                  onClick={() => togglePin(key)}
                  title={pinned ? 'Открепить' : 'Закрепить в панели'}
                >
                  <Pin size={12} className={pinned ? 'fill-current' : ''} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Пустой результат поиска */}
      {filteredEntries.length === 0 && searchQuery && (
        <div className="text-center py-4 text-cyber-text-dim text-sm">
          Ничего не найдено по запросу "{searchQuery}"
        </div>
      )}

      {/* Footer */}
      <div className="text-[11px] text-cyber-text-dim mt-3 pt-2 border-t border-cyber-gray/30 flex-shrink-0 flex items-center gap-2">
        <Pin size={10} className="text-cyber-green" />
        <span>Закреплённые ресурсы показываются в верхней панели</span>
      </div>
    </div>
  );
}
