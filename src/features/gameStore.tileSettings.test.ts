/**
 * Продвинутые настройки зданий обязаны переживать загрузку сейва.
 *
 * `serializeGame` писал `grid.tileSettings` в сейв с самой «Фазы 5», а вот обе рукописные
 * ветки восстановления в gameStore (`loadGameFromSave` и `loadGame`) перечисляют поля grid
 * по одному и про tileSettings просто забыли: базой шёл `...state.grid`, то есть пустой
 * INITIAL. Снаружи это выглядело как «изменения в продвинутых настройках не сохраняются» —
 * режим, приоритеты, авто-продажа и правила жили до первой перезагрузки страницы.
 *
 * Тест идёт через настоящий `loadGameFromSave` (с заглушками localStorage и fetch), потому что
 * ломалась именно эта ветка: сериализация и `deserializeGame` работали всё это время верно.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGameStore } from './gameStore';
import { serializeGame } from './gameSave';
import type { GameState } from '../core/gameTypes';

/** Токен нужен только чтобы `isAuthenticated()` пропустил загрузку дальше. */
const fakeLocalStorage = () => {
  const map = new Map<string, string>([['authToken', 'test-token']]);
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: () => null,
    length: 0,
  } as unknown as Storage;
};

describe('загрузка сейва: продвинутые настройки зданий', () => {
  const TILE = '3,3';
  let savePayload: Record<string, unknown>;

  beforeEach(() => {
    vi.stubGlobal('localStorage', fakeLocalStorage());

    // Ставим здание и настраиваем его так, как это делает панель настроек.
    useGameStore.setState((s) => ({
      grid: { ...s.grid, tiles: { ...s.grid.tiles, [TILE]: 'iron_mine' } },
    }));
    const store = useGameStore.getState();
    store.setBuildingMode(TILE, 'economy');
    store.setOutputPriority(TILE, 5);
    store.updateAutoSell(TILE, { enabled: true, resource: 'ore', threshold: 60, keepAmount: '0' });
    store.upsertBuildingRule(TILE, {
      id: 'rule_test',
      enabled: true,
      match: 'all',
      triggers: [{ id: 'rule_test_t0', metric: 'energy_coverage', op: 'lt', value: 50 }],
      action: { type: 'disable' },
    });

    savePayload = serializeGame(useGameStore.getState() as unknown as GameState) as unknown as Record<string, unknown>;

    // Полная перезагрузка страницы: в памяти снова пустые настройки.
    useGameStore.setState((s) => ({ grid: { ...s.grid, tileSettings: {} } }));

    // Сейв приходит через HTTP, поэтому прогоняем его через JSON — как в реальности.
    const wire = JSON.parse(JSON.stringify(savePayload));
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        new Response(
          JSON.stringify(
            String(url).startsWith('/api/saves/')
              ? { ok: true, save: { id: 1, revision: 1, data: wire } }
              : { ok: true },
          ),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    useGameStore.getState().resetGame();
  });

  /** Обе ветки восстановления забыли tileSettings, поэтому проверяются обе. */
  const expectRestored = () => {
    const settings = useGameStore.getState().grid.tileSettings?.[TILE];
    expect(settings).toBeDefined();
    expect(settings?.mode).toBe('economy');
    expect(settings?.outputPriority).toBe(5);
    expect(settings?.autoSell).toEqual([
      { enabled: true, resource: 'ore', threshold: 60, keepAmount: '0' },
    ]);
    expect(settings?.rules?.map((r) => r.id)).toEqual(['rule_test']);
  };

  it('loadGameFromSave: режим, приоритет, авто-продажа и правила возвращаются', async () => {
    const res = await useGameStore.getState().loadGameFromSave(1);
    expect(res.ok).toBe(true);
    expectRestored();
  });

  // Ветка перезагрузки страницы: App вызывает именно loadGame, а не loadGameFromSave.
  it('loadGame: настройки возвращаются при входе в игру', async () => {
    await useGameStore.getState().loadGame();
    expectRestored();
  });

  /*
   * Сброс на сервер при уходе со страницы и выход из аккаунта зовут saveGame поверх таймера
   * автосейва. Две одновременные записи в одну строку — это 409 SAVE_OUTDATED, а конфликт по
   * правилу перезагружает состояние с сервера, то есть выбрасывает то самое изменение, ради
   * которого сброс и делался.
   */
  it('второй saveGame во время первого не уходит на сервер', async () => {
    const first = useGameStore.getState().saveGame();
    const second = await useGameStore.getState().saveGame();
    expect(second).toEqual({ ok: false, error: 'SAVE_IN_FLIGHT' });

    await first;
    // Замок снят: следующая запись проходит.
    const third = await useGameStore.getState().saveGame();
    expect(third).not.toEqual({ ok: false, error: 'SAVE_IN_FLIGHT' });
  });
});
