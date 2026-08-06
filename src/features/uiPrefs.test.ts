/**
 * Пер-слотовые настройки интерфейса (bigplan.md, пункт 30.2).
 *
 * Главное, что здесь проверяется, — что настройки ЕДУТ В СЕЙВЕ и переживают круг
 * «сериализовать → разобрать». Раньше пины лежали в колонке аккаунта, а фильтры панели —
 * в localStorage, и обе штуки применялись ко всем картам разом.
 *
 * Второе — что нормализация живёт в одном месте (setUiPrefs) и её нельзя обойти: сейв
 * это внешние данные, в нём может оказаться что угодно.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { useGameStore, INITIAL_UI_PREFS, MAX_PINNED_RESOURCES } from './gameStore';
import { serializeGame } from './gameSave';
import { loadSavePayload } from './gameSave';
import type { ResourceType } from '../core/gameTypes';

beforeEach(() => {
  useGameStore.setState({
    uiPrefs: { ...INITIAL_UI_PREFS, buildPanel: { ...INITIAL_UI_PREFS.buildPanel } },
  });
});

const prefs = () => useGameStore.getState().uiPrefs;

describe('setUiPrefs', () => {
  it('меняет только то, что передали: фильтры не трогают пины и наоборот', () => {
    useGameStore.getState().setUiPrefs({ buildPanel: { sortBy: 'cost' } });
    expect(prefs().buildPanel.sortBy).toBe('cost');
    expect(prefs().pinnedResources).toEqual(INITIAL_UI_PREFS.pinnedResources);

    useGameStore.getState().setUiPrefs({ pinnedResources: ['ore'] });
    // Остальные фильтры не сбросились в умолчания.
    expect(prefs().buildPanel.sortBy).toBe('cost');
  });

  it('выбрасывает неизвестные ресурсы и дубли', () => {
    useGameStore.getState().setUiPrefs({
      pinnedResources: ['ore', 'ore', 'нет_такого' as ResourceType, 'ice'],
    });
    expect(prefs().pinnedResources).toEqual(['energy', 'ore', 'ice']);
  });

  it('энергия добавляется всегда: без неё не читается ни один дефицит', () => {
    useGameStore.getState().setUiPrefs({ pinnedResources: ['ore'] });
    expect(prefs().pinnedResources[0]).toBe('energy');
  });

  it('режет по лимиту', () => {
    const many = Object.keys(
      // Любые известные ресурсы: важно только их количество.
      useGameStore.getState().resources,
    ) as ResourceType[];
    expect(many.length).toBeGreaterThan(MAX_PINNED_RESOURCES);

    useGameStore.getState().setUiPrefs({ pinnedResources: many });
    expect(prefs().pinnedResources).toHaveLength(MAX_PINNED_RESOURCES);
  });

  it('не создаёт новую ссылку, когда ничего не изменилось', () => {
    const before = prefs();
    useGameStore.getState().setUiPrefs({ buildPanel: { sortBy: before.buildPanel.sortBy } });
    // Настройки лежат в том же сторе, что и тик: лишняя ссылка = перерисовка подписчиков.
    expect(prefs()).toBe(before);
  });
});

describe('сохранение настроек в сейв слота', () => {
  it('переживают круг сериализации', () => {
    useGameStore.getState().setUiPrefs({
      pinnedResources: ['ore', 'ice', 'steel'],
      buildPanel: { onlyAffordable: true, sortBy: 'placed' },
      accountPinsImported: true,
    });

    const restored = loadSavePayload(serializeGame(useGameStore.getState()));

    expect(restored.uiPrefs?.pinnedResources).toEqual(['energy', 'ore', 'ice', 'steel']);
    expect(restored.uiPrefs?.buildPanel).toMatchObject({ onlyAffordable: true, sortBy: 'placed' });
    expect(restored.uiPrefs?.accountPinsImported).toBe(true);
  });

  it('сейв БЕЗ секции даёт undefined, а не умолчания', () => {
    /*
     * Разница принципиальная: undefined означает «настроек ещё не было», и тогда пины
     * переносятся из аккаунта. Умолчания на этом месте молча затёрли бы то, что игрок
     * закрепил до этой правки.
     */
    const restored = loadSavePayload({});
    expect(restored.uiPrefs).toBeUndefined();
  });

  it('мусор в сейве не ломает загрузку', () => {
    const restored = loadSavePayload({
      uiPrefs: { pinnedResources: 'не массив', buildPanel: { sortBy: 'по-своему' } },
    });
    expect(restored.uiPrefs?.pinnedResources).toEqual([]);
    expect(restored.uiPrefs?.buildPanel.sortBy).toBe('name');
  });
});
