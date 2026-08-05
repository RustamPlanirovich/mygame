import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ResourceType } from '../core/gameTypes';
import { RESOURCE_LABEL } from '../core/constants/labels';
import { loadPinnedResourcesFromServer, savePinnedResourcesToServer } from '../utils/settingsApi';

const DEFAULT_PINS: ResourceType[] = ['energy', 'ore', 'ice', 'carbon', 'steel', 'dark_matter'];

/**
 * Сколько ресурсов имеет смысл держать в строке TopBar. Ограничение — визуальное:
 * дальше строка начинает переноситься и вытеснять валюты.
 */
export const MAX_PINS = 14;

/*
 * Здесь был захардкоженный белый список из шести ресурсов
 * (['energy','ore','ice','carbon','steel','dark_matter']), и normalizePins выбрасывала всё
 * остальное — то есть закрепить пластик, титан или микросхемы было невозможно by design:
 * togglePin добавлял ресурс в массив, normalizePins тут же его удаляла, состояние не менялось,
 * и это выглядело как «кнопка не работает».
 *
 * Единственный корректный источник допустимых значений — ключи RESOURCE_LABEL: это
 * Record<ResourceType, string>, то есть тип гарантирует полноту, и новый ресурс автоматически
 * становится закрепляемым, без правки этого файла.
 */
const ALLOWED = new Set(Object.keys(RESOURCE_LABEL) as ResourceType[]);

export function isPinnableResource(id: string): id is ResourceType {
  return ALLOWED.has(id as ResourceType);
}

function normalizePins(pins: unknown): ResourceType[] {
  if (!Array.isArray(pins)) return DEFAULT_PINS;

  const next: ResourceType[] = [];
  for (const p of pins) {
    if (typeof p !== 'string') continue;
    if (!isPinnableResource(p)) continue;
    if (next.includes(p)) continue;
    next.push(p);
  }

  // Энергия — единственный ресурс, который нужен всегда: без неё не читается ни один дефицит.
  if (!next.includes('energy')) next.unshift('energy');

  return next.length > 0 ? next.slice(0, MAX_PINS) : DEFAULT_PINS;
}

export function usePinnedResources() {
  const [pins, setPins] = useState<ResourceType[]>(DEFAULT_PINS);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Загружаем pinned resources с сервера при монтировании
    loadPinnedResourcesFromServer().then((loadedPins) => {
      setPins(normalizePins(loadedPins));
    }).catch((err) => {
      console.error('Ошибка загрузки pinned resources:', err);
    });
  }, []);

  // Снимаем отложенное сохранение при анмаунте, чтобы не писать на сервер после выхода.
  useEffect(() => () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
  }, []);

  /*
   * Дебаунс: клик по звёздочке в списке из сотни ресурсов — это серия кликов, и без него
   * каждый давал PUT на сервер. Последний выигрывает, промежуточные состояния никому не нужны.
   */
  const scheduleSave = useCallback((next: ResourceType[]) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      savePinnedResourcesToServer(next).catch((err) => {
        console.error('Ошибка сохранения pinned resources:', err);
      });
    }, 400);
  }, []);

  const persist = useCallback((next: ResourceType[]) => {
    const normalized = normalizePins(next);
    setPins(normalized);
    scheduleSave(normalized);
  }, [scheduleSave]);

  const togglePin = useCallback(
    (id: ResourceType) => {
      // Через функциональный setPins, а не через замыкание на `pins`: иначе быстрая серия
      // кликов считает от одного и того же устаревшего массива и часть пинов теряется.
      setPins((current) => {
        const next = normalizePins(
          current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
        );
        scheduleSave(next);
        return next;
      });
    },
    [scheduleSave],
  );

  const isPinned = useCallback((id: ResourceType) => pins.includes(id), [pins]);

  /**
   * Достигнут ли лимит. Нужен UI, чтобы объяснить, почему следующая звёздочка не сработает,
   * вместо молчаливого игнорирования клика.
   */
  const isFull = pins.length >= MAX_PINS;

  return useMemo(
    () => ({ pins, setPins: persist, togglePin, isPinned, isFull, maxPins: MAX_PINS }),
    [pins, persist, togglePin, isPinned, isFull],
  );
}
