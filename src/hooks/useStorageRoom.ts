/**
 * СНИМОК СКЛАДА ПО ОДНОМУ РЕСУРСУ ДЛЯ ФОРМ ПОКУПКИ.
 *
 * Подписаться на стор нельзя: syncResourcesFromBase пересобирает объект resources КАЖДЫЙ
 * тик (до 20 раз в секунду), и `useGameStore((s) => s.resources)` перерисовывал бы форму
 * биржи вместе со всеми её списками. Поэтому состояние читается императивно по таймеру —
 * ровно тем же приёмом, что useHeldAmounts в VaultPanel, — и новый снимок отдаётся только
 * когда числа реально изменились.
 *
 * Остаток берётся из grid.buffers.base, а не из resources[r].amount: amount уже обрезан по
 * вместимости, и на переполненном складе «свободное место» посчиталось бы неправильно.
 */

import { useEffect, useMemo, useState } from 'react';
import type Decimal from 'break_eternity.js';
import { useGameStore } from '../features/gameStore';
import { D } from '../core/math/format';
import type { ResourceType } from '../core/gameTypes';

/** Как часто перечитывать склад. Секунды хватает: цифра в замечании не должна дёргаться. */
const SNAPSHOT_MS = 1000;

export interface StorageRoomSnapshot {
  /** Сколько ресурса лежит на базе. */
  held: Decimal;
  /** Вместимость склада по этому ресурсу. */
  cap: Decimal;
  /**
   * Ресурс вообще есть в игровом состоянии. Если нет (например, торгуемый на бирже, но
   * ещё не открытый), нулевые held/cap НЕ означают «склад полон» — замечание показывать
   * нельзя, оно соврёт.
   */
  known: boolean;
}

const UNKNOWN = { held: '0', cap: '0', known: false };

export function useStorageRoom(resource: ResourceType | null): StorageRoomSnapshot {
  const [snapshot, setSnapshot] = useState(UNKNOWN);

  useEffect(() => {
    if (!resource) {
      setSnapshot((prev) => (prev.known ? UNKNOWN : prev));
      return;
    }

    const read = () => {
      const state = useGameStore.getState();
      const entry = state.resources?.[resource];
      // Держим строки, а не Decimal: снимок сравнивается по значению, а два разных
      // Decimal с одним числом никогда не равны по ссылке и давали бы ререндер каждую секунду.
      const next = entry
        ? {
            held: D(state.grid?.buffers?.base?.[resource] ?? '0').toString(),
            cap: entry.max.toString(),
            known: true,
          }
        : UNKNOWN;

      setSnapshot((prev) =>
        prev.held === next.held && prev.cap === next.cap && prev.known === next.known ? prev : next,
      );
    };

    read();
    const timer = setInterval(read, SNAPSHOT_MS);
    return () => clearInterval(timer);
  }, [resource]);

  return useMemo(
    () => ({ held: D(snapshot.held), cap: D(snapshot.cap), known: snapshot.known }),
    [snapshot],
  );
}
