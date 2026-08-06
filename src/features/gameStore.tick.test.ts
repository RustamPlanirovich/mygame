/**
 * Тик не должен пересоздавать то, что не менялось (bigplan.md, пункт 22).
 *
 * Это не косметика и не микрооптимизация. Zustand будит подписчика при смене ССЫЛКИ, а
 * тик выполняется 20 раз в секунду: срез, который пересобирается впустую, перерисовывает
 * свою панель 20 раз в секунду на пустом месте. Раньше так вели себя загрязнение,
 * культура, случайные события, мегаструктуры, meta и логистика — все сразу.
 *
 * Тест закрепляет ровно это свойство: на базе, где ничего не происходит, ссылки стоят.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { useGameStore } from './gameStore';

const FRAME = 1 / 20;

beforeEach(() => {
  useGameStore.getState().resetGame();
});

/** Прогнать N кадров игрового цикла. */
function run(seconds: number) {
  const frames = Math.round(seconds / FRAME);
  for (let i = 0; i < frames; i++) useGameStore.getState().tick(FRAME);
}

describe('стабильность ссылок в тике', () => {
  it('на старте один кадр не подменяет срезы, которым нечего менять', () => {
    // Первый кадр может отработать фазу расписания — пропускаем его.
    useGameStore.getState().tick(FRAME);
    const before = useGameStore.getState();

    useGameStore.getState().tick(FRAME);
    const after = useGameStore.getState();

    expect(after.pollution).toBe(before.pollution);
    expect(after.culture).toBe(before.culture);
    expect(after.randomEvents).toBe(before.randomEvents);
    expect(after.megastructures).toBe(before.megastructures);
    expect(after.intergalacticLogistics).toBe(before.intergalacticLogistics);
    expect(after.fleet).toBe(before.fleet);
    expect(after.quests).toBe(before.quests);
    expect(after.scenario).toBe(before.scenario);
  });

  it('за 5 секунд редкие подсистемы меняют ссылку СИЛЬНО реже, чем идут кадры', () => {
    run(1); // разогрев: пусть фазы расписания разойдутся

    let pollutionChanges = 0;
    let cultureChanges = 0;
    let logisticsChanges = 0;

    let prev = useGameStore.getState();
    const frames = Math.round(5 / FRAME);
    for (let i = 0; i < frames; i++) {
      useGameStore.getState().tick(FRAME);
      const next = useGameStore.getState();
      if (next.pollution !== prev.pollution) pollutionChanges++;
      if (next.culture !== prev.culture) cultureChanges++;
      if (next.intergalacticLogistics !== prev.intergalacticLogistics) logisticsChanges++;
      prev = next;
    }

    // 100 кадров за 5 секунд. Раньше каждый из этих срезов менялся все 100 раз.
    expect(pollutionChanges).toBeLessThanOrEqual(6);
    expect(cultureChanges).toBeLessThanOrEqual(4);
    // Караванов нет вовсе — ссылка не должна меняться НИ РАЗУ.
    expect(logisticsChanges).toBe(0);
  });

  it('сетка и ресурсы продолжают обновляться каждый кадр', () => {
    // Обратная проверка: экономия не должна незаметно заморозить саму симуляцию.
    const before = useGameStore.getState();
    useGameStore.getState().tick(FRAME);
    const after = useGameStore.getState();

    expect(after.lastTick).toBeGreaterThanOrEqual(before.lastTick);
    expect(after.resources).not.toBe(before.resources);
  });
});
