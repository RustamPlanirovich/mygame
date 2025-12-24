import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ResourceType } from '../core/gameTypes';

const LS_KEY = 'ygg_pinned_resources_v1';

const DEFAULT_PINS: ResourceType[] = ['energy', 'ore', 'ice', 'carbon', 'steel', 'dark_matter'];

function normalizePins(pins: unknown): ResourceType[] {
  if (!Array.isArray(pins)) return DEFAULT_PINS;
  const allowed = new Set<ResourceType>(['energy', 'ore', 'ice', 'carbon', 'steel', 'dark_matter']);
  const next: ResourceType[] = [];
  for (const p of pins) {
    if (typeof p !== 'string') continue;
    if (!allowed.has(p as ResourceType)) continue;
    if (!next.includes(p as ResourceType)) next.push(p as ResourceType);
  }
  if (!next.includes('energy')) next.unshift('energy');
  return next.length > 0 ? next : DEFAULT_PINS;
}

export function usePinnedResources() {
  const [pins, setPins] = useState<ResourceType[]>(DEFAULT_PINS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      setPins(normalizePins(JSON.parse(raw)));
    } catch {
      // ignore
    }
  }, []);

  const persist = useCallback((next: ResourceType[]) => {
    setPins(next);
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }, []);

  const togglePin = useCallback(
    (id: ResourceType) => {
      const next = normalizePins(
        pins.includes(id) ? pins.filter((x) => x !== id) : [...pins, id],
      );
      persist(next);
    },
    [pins, persist],
  );

  const isPinned = useCallback((id: ResourceType) => pins.includes(id), [pins]);

  return useMemo(
    () => ({ pins, setPins: persist, togglePin, isPinned }),
    [pins, persist, togglePin, isPinned],
  );
}
