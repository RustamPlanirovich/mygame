/**
 * Закреплённые в TopBar ресурсы (bigplan.md, пункты 14 и 30.2).
 *
 * ГДЕ ОНИ ЖИВУТ ТЕПЕРЬ. В сейве слота (`state.uiPrefs.pinnedResources`), а не в колонке
 * `users.pinned_resources`. Колонка была одна на АККАУНТ: закрепив на одной карте руду и
 * лёд, игрок видел их и на карте, где этих ресурсов нет, — а любая правка на второй карте
 * тут же меняла первую. Сейв слота — то же место, где лежит остальное состояние партии,
 * поэтому пины больше не могут разъехаться со слотом и не требуют отдельного запроса.
 *
 * РАЗОВЫЙ ПЕРЕНОС. У существующих игроков пины уже лежат в аккаунте, и терять их нельзя.
 * Пока в сейве не стоит `accountPinsImported`, хук один раз читает старое значение и
 * переносит его в слот. Флаг живёт в сейве, поэтому перенос происходит ровно один раз на
 * слот и не повторяется после перезагрузки. Эвристики «список выглядит как умолчание»
 * здесь быть не может: у игрока могли быть закреплены ровно те же шесть ресурсов.
 *
 * Правила нормализации (только известные ресурсы, без дублей, энергия всегда, лимит)
 * живут в `setUiPrefs` — в одном месте, а не в каждом вызывающем.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { ResourceType } from '../core/gameTypes';
import { RESOURCE_LABEL } from '../core/constants/labels';
import { useGameStore, MAX_PINNED_RESOURCES } from '../features/gameStore';
import { loadPinnedResourcesFromServer } from '../utils/settingsApi';

/** Сохранён для совместимости с местами, которые показывают лимит игроку. */
export const MAX_PINS = MAX_PINNED_RESOURCES;

const ALLOWED = new Set(Object.keys(RESOURCE_LABEL) as ResourceType[]);

export function isPinnableResource(id: string): id is ResourceType {
  return ALLOWED.has(id as ResourceType);
}

export function usePinnedResources() {
  const pins = useGameStore((s) => s.uiPrefs.pinnedResources);
  const imported = useGameStore((s) => s.uiPrefs.accountPinsImported);
  const setUiPrefs = useGameStore((s) => s.setUiPrefs);

  // Перенос запускается один раз за монтирование, даже если рендеров будет много.
  const migrationStartedRef = useRef(false);

  useEffect(() => {
    if (imported || migrationStartedRef.current) return;
    migrationStartedRef.current = true;

    loadPinnedResourcesFromServer()
      .then((legacy) => {
        // Пустой ответ — не повод затирать то, что уже есть в слоте.
        if (Array.isArray(legacy) && legacy.length > 0) {
          setUiPrefs({ pinnedResources: legacy, accountPinsImported: true });
        } else {
          setUiPrefs({ accountPinsImported: true });
        }
      })
      .catch((err) => {
        /*
         * Сеть отвалилась — флаг НЕ ставим: перенос попробуем в следующий раз.
         * Иначе один неудачный запрос навсегда оставил бы игрока без его пинов.
         */
        console.error('Не удалось перенести закреплённые ресурсы из аккаунта:', err);
        migrationStartedRef.current = false;
      });
  }, [imported, setUiPrefs]);

  const setPins = useCallback(
    (next: ResourceType[]) => setUiPrefs({ pinnedResources: next }),
    [setUiPrefs],
  );

  const togglePin = useCallback(
    (id: ResourceType) => {
      // Читаем актуальный список из стора, а не из замыкания: серия быстрых кликов
      // иначе считает от одного и того же устаревшего массива и часть пинов теряется.
      const current = useGameStore.getState().uiPrefs.pinnedResources;
      setUiPrefs({
        pinnedResources: current.includes(id)
          ? current.filter((x) => x !== id)
          : [...current, id],
      });
    },
    [setUiPrefs],
  );

  const isPinned = useCallback((id: ResourceType) => pins.includes(id), [pins]);

  /**
   * Достигнут ли лимит. Нужен UI, чтобы объяснить, почему следующая звёздочка не сработает,
   * вместо молчаливого игнорирования клика.
   */
  const isFull = pins.length >= MAX_PINNED_RESOURCES;

  return useMemo(
    () => ({ pins, setPins, togglePin, isPinned, isFull, maxPins: MAX_PINNED_RESOURCES }),
    [pins, setPins, togglePin, isPinned, isFull],
  );
}
