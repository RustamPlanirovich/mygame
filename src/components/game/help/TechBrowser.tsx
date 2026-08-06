/**
 * СПРАВОЧНИК ТЕХНОЛОГИЙ — дерево по эрам с ценой, предпосылками и разблокировками.
 *
 * Отмечает уже открытые технологии по состоянию игры: справка о дереве, которая не показывает,
 * где вы сейчас, заставляет держать в голове два списка вместо одного.
 */

import React, { useDeferredValue, useMemo, useState } from 'react';
import { Check, Lock, Search } from 'lucide-react';
import { useGameStore } from '../../../features/gameStore';
import { TECHNOLOGIES, ERA_NAMES } from '../../../core/constants/technologies';
import { resourceLabel, technologyLabel } from '../../../core/i18n/label';
import { formatNumber } from '../../../core/math/format';
import { EmptyState } from '../../ui';
import { IconText } from '../../ui/icons';
import type { ResourceType } from '../../../core/gameTypes';

interface TechRow {
  id: string;
  name: string;
  description: string;
  era: number;
  cost: number;
  prerequisites: string[];
  buildings: string[];
  resources: string[];
  search: string;
}

export const TechBrowser: React.FC = () => {
  const unlocked = useGameStore((s) => s.research.technologies);
  const buildings = useGameStore((s) => s.buildings);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);

  const buildingNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of buildings) map.set(b.id, b.name);
    return map;
  }, [buildings]);

  const rows = useMemo<TechRow[]>(
    () =>
      Object.values(TECHNOLOGIES).map((tech) => {
        const buildingNames = (tech.unlocks.buildings ?? []).map(
          (id) => buildingNameById.get(id) ?? id,
        );
        const resourceNames = (tech.unlocks.resources ?? []).map((id) =>
          resourceLabel(id as ResourceType),
        );
        return {
          id: tech.id,
          name: tech.name,
          description: tech.description,
          era: tech.era,
          cost: tech.cost,
          prerequisites: tech.prerequisites.map((id) => technologyLabel(id)),
          buildings: buildingNames,
          resources: resourceNames,
          search: [tech.name, tech.id, tech.description, ...buildingNames, ...resourceNames]
            .join(' ')
            .toLowerCase(),
        };
      }),
    [buildingNameById],
  );

  const filtered = useMemo(() => {
    const needle = deferredQuery.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) => r.search.includes(needle));
  }, [rows, deferredQuery]);

  const byEra = useMemo(() => {
    const map = new Map<number, TechRow[]>();
    for (const row of filtered) {
      const list = map.get(row.era) ?? [];
      list.push(row);
      map.set(row.era, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.cost - b.cost);
    return [...map.entries()].sort(([a], [b]) => a - b);
  }, [filtered]);

  const openCount = useMemo(
    () => Object.values(unlocked ?? {}).filter(Boolean).length,
    [unlocked],
  );

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-content-faint" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Найти технологию, здание или ресурс…"
          className="w-full rounded border border-edge bg-surface-base py-1.5 pl-8 pr-2 text-xs text-content-primary placeholder-content-faint focus:border-accent focus:outline-none"
        />
      </div>

      <p className="text-3xs text-content-faint">
        Открыто {openCount} из {rows.length}. Здание закрыто только если его явно упоминает
        какая-то технология — всё остальное доступно с начала партии.
      </p>

      {filtered.length === 0 ? (
        <EmptyState icon={<Search size={20} />} title="Ничего не нашлось" hint="Попробуйте другое слово" />
      ) : (
        byEra.map(([era, items]) => (
          <div key={era} className="overflow-hidden rounded border border-edge-subtle">
            <div className="flex items-center gap-2 border-b border-edge-subtle bg-white/5 px-3 py-1.5">
              <span className="text-2xs font-bold uppercase tracking-wider text-content-secondary">
                {ERA_NAMES[era] ?? `Эра ${era}`}
              </span>
              <span className="ml-auto font-mono text-3xs text-content-faint">{items.length}</span>
            </div>
            <table className="w-full text-2xs">
              <tbody>
                {items.map((row) => {
                  const isOpen = Boolean(unlocked?.[row.id as keyof typeof unlocked]);
                  return (
                    <tr key={row.id} className="border-b border-edge-subtle/60 align-top last:border-0">
                      <td className="w-6 px-2 py-1.5">
                        {isOpen ? (
                          <Check size={12} className="text-accent" />
                        ) : (
                          <Lock size={11} className="text-content-faint" />
                        )}
                      </td>
                      <td className="px-1 py-1.5">
                        <div
                          className={`text-xs font-semibold ${
                            isOpen ? 'text-accent' : 'text-content-primary'
                          }`}
                        >
                          <IconText>{row.name}</IconText>
                        </div>
                        <div className="text-content-faint">
                          <IconText>{row.description}</IconText>
                        </div>
                        {row.prerequisites.length > 0 && (
                          <div className="mt-0.5 text-content-faint">
                            Требует: {row.prerequisites.join(', ')}
                          </div>
                        )}
                        {row.buildings.length > 0 && (
                          <div className="mt-0.5 text-info">
                            Открывает: <IconText>{row.buildings.join(', ')}</IconText>
                          </div>
                        )}
                        {row.resources.length > 0 && (
                          <div className="text-content-muted">
                            Ресурсы: {row.resources.join(', ')}
                          </div>
                        )}
                      </td>
                      <td className="w-20 px-2 py-1.5 text-right font-mono text-content-secondary">
                        {row.cost > 0 ? `${formatNumber(row.cost)} 🔬` : 'стартовая'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))
      )}
    </div>
  );
};
