/**
 * Прохождение карты (bigplan.md, замечание к итерации 11).
 *
 * До этой правки понятия «пройти карту» в игре не существовало: `completeMap` был написан,
 * но не вызывался НИОТКУДА, `mapProgress` не рос, а `unlockedMaps` навсегда оставался
 * стартовой парой карт. Здесь закрепляется то, что теперь есть: прохождение засчитывается
 * ровно один раз, открывает следующую карту по каталогу и НЕ заканчивает партию.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { useGameStore } from './gameStore';
import { MAP_DEFINITIONS, mapCompletionGoal, nextMapAfter } from '../core/constants/maps';

beforeEach(() => {
  useGameStore.getState().resetGame();
});

/** Поставить карту как активную, минуя требования разблокировки. */
function enterMap(mapId: string) {
  useGameStore.setState((s) => ({
    maps: {
      ...s.maps,
      currentMapId: mapId as never,
      activeMapData: {
        mapId,
        startedAt: Date.now() - 60_000,
        gridType: 'square',
        gridDimensions: { width: 8, height: 8 },
        modifiers: [],
        activeEvents: [],
        discoveredArtifacts: [],
        stats: { buildingsPlaced: 0, resourcesProduced: 0, enemiesDefeated: 0, eventsTriggered: 0 },
        completedAt: null,
      },
    },
  }));
}

describe('mapCompletionGoal', () => {
  it('цель растёт со сложностью', () => {
    const easy = MAP_DEFINITIONS.find((m) => m.difficulty === 'easy');
    const hard = MAP_DEFINITIONS.find((m) => m.difficulty === 'hard');
    expect(mapCompletionGoal(easy)).toBeLessThan(mapCompletionGoal(hard));
  });

  it('у каждой карты каталога цель конечна — иначе её нельзя пройти в принципе', () => {
    for (const map of MAP_DEFINITIONS) {
      expect(Number.isFinite(mapCompletionGoal(map))).toBe(true);
    }
  });
});

describe('nextMapAfter', () => {
  it('идёт по каталогу, а не по захардкоженному списку id', () => {
    for (let i = 0; i < MAP_DEFINITIONS.length - 1; i++) {
      expect(nextMapAfter(MAP_DEFINITIONS[i].id)).toBe(MAP_DEFINITIONS[i + 1].id);
    }
    // Последняя карта никуда не ведёт.
    expect(nextMapAfter(MAP_DEFINITIONS[MAP_DEFINITIONS.length - 1].id)).toBeNull();
  });

  it('неизвестная карта не ломает цепочку', () => {
    expect(nextMapAfter('нет_такой')).toBeNull();
  });
});

describe('completeMap', () => {
  it('засчитывает прохождение и открывает следующую карту', () => {
    const first = MAP_DEFINITIONS[0].id;
    const second = MAP_DEFINITIONS[1].id;
    enterMap(first);

    useGameStore.getState().completeMap();

    const { maps } = useGameStore.getState();
    expect(maps.mapProgress[first]?.completions).toBe(1);
    expect(maps.unlockedMaps).toContain(second);
  });

  it('НЕ заканчивает партию: карта остаётся под ногами', () => {
    enterMap(MAP_DEFINITIONS[0].id);
    useGameStore.getState().completeMap();

    // Раньше здесь стояло activeMapData: null — для бесконечной игры это означало бы
    // «карта исчезла» ровно в момент успеха.
    expect(useGameStore.getState().maps.activeMapData).not.toBeNull();
    expect(useGameStore.getState().maps.currentMapId).toBe(MAP_DEFINITIONS[0].id);
  });

  it('повторный вызов за ту же партию ничего не меняет', () => {
    enterMap(MAP_DEFINITIONS[0].id);
    useGameStore.getState().completeMap();
    const after = useGameStore.getState().maps;

    useGameStore.getState().completeMap();

    // Критерий проверяется в цикле каждые 2 секунды: без защиты счётчик рос бы бесконечно.
    expect(useGameStore.getState().maps.mapProgress[MAP_DEFINITIONS[0].id]?.completions).toBe(1);
    expect(useGameStore.getState().maps).toBe(after);
  });

  it('записывает лучшее время и не ухудшает его', () => {
    const first = MAP_DEFINITIONS[0].id;
    enterMap(first);
    useGameStore.getState().completeMap();
    const best = useGameStore.getState().maps.mapProgress[first]?.bestTime;
    expect(best).toBeGreaterThan(0);

    // Вторая партия, заметно дольше.
    enterMap(first);
    useGameStore.setState((s) => ({
      maps: {
        ...s.maps,
        activeMapData: { ...s.maps.activeMapData!, startedAt: Date.now() - 10 * 60_000 },
      },
    }));
    useGameStore.getState().completeMap();

    expect(useGameStore.getState().maps.mapProgress[first]?.completions).toBe(2);
    expect(useGameStore.getState().maps.mapProgress[first]?.bestTime).toBe(best);
  });

  it('без активной карты ничего не делает', () => {
    const before = useGameStore.getState().maps;
    useGameStore.setState((s) => ({ maps: { ...s.maps, currentMapId: null } }));
    useGameStore.getState().completeMap();
    expect(useGameStore.getState().maps.mapProgress).toEqual(before.mapProgress);
  });
});
