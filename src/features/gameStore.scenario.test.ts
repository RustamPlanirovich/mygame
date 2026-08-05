/**
 * Продвижение сценария в тике (bigplan.md, пункты 20, 29).
 *
 * Условия шагов проверены в constants/scenario.test.ts. Здесь — что стор действительно двигает
 * цепочку сам, начисляет награду и сохраняет прогресс, а не требует от игрока нажать «Далее»
 * (именно этим было плохо старое обучение из слайдов).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useGameStore } from './gameStore';
import { SCENARIO } from '../core/constants/scenario';
import { serializeGame, deserializeGame } from './gameSave';

/*
 * Проверка сценария в тике троттлится (раз в секунду), и троттлинг — МОДУЛЬНАЯ переменная,
 * общая для всех тестов файла. Поэтому фейковые часы монотонно растут и НЕ сбрасываются в
 * beforeEach: иначе второй тест ставил бы «сейчас» почти туда же, где остановился первый,
 * разница выходила бы меньше секунды, и проверка молча пропускалась.
 */
let fakeNow = Date.now() + 1_000_000;

function tickWithTimeAdvance(seconds = 5) {
  fakeNow += seconds * 1000;
  const spy = vi.spyOn(Date, 'now').mockReturnValue(fakeNow);
  try {
    useGameStore.getState().tick(0.05);
  } finally {
    spy.mockRestore();
  }
}

beforeEach(() => {
  useGameStore.getState().resetGame();
});

describe('продвижение цепочки', () => {
  it('на свежей игре сценарий стоит на первом шаге', () => {
    const scenario = useGameStore.getState().scenario;
    expect(scenario.currentIndex).toBe(0);
    expect(scenario.completedIds).toEqual([]);
    expect(scenario.dismissed).toBe(false);
  });

  it('шаг закрывается САМ, когда условие выполнено — без нажатия «Далее»', () => {
    // Выполняем условие первого шага напрямую.
    useGameStore.setState((s) => ({
      grid: { ...s.grid, tiles: { ...s.grid.tiles, '0,0': 'generator_mk1' } },
    }));

    tickWithTimeAdvance();

    const scenario = useGameStore.getState().scenario;
    expect(scenario.currentIndex).toBe(1);
    expect(scenario.completedIds).toEqual([SCENARIO[0].id]);
  });

  it('награда за шаг начисляется', () => {
    const before = useGameStore.getState().currency.credits;
    const reward = SCENARIO[0].reward?.credits ?? 0;
    expect(reward).toBeGreaterThan(0);

    useGameStore.setState((s) => ({
      grid: { ...s.grid, tiles: { ...s.grid.tiles, '0,0': 'generator_mk1' } },
    }));
    tickWithTimeAdvance();

    // Тик мог начислить и производство, поэтому проверяем «не меньше награды».
    const gained = useGameStore.getState().currency.credits.sub(before).toNumber();
    expect(gained).toBeGreaterThanOrEqual(reward);
  });

  it('невыполненный шаг не двигается, сколько бы тиков ни прошло', () => {
    for (let i = 0; i < 5; i++) tickWithTimeAdvance();
    expect(useGameStore.getState().scenario.currentIndex).toBe(0);
  });

  it('ссылка на scenario не меняется, когда прогресса нет', () => {
    // Иначе подписчик (панель подсказки) перерисовывался бы каждую секунду впустую.
    const before = useGameStore.getState().scenario;
    tickWithTimeAdvance();
    expect(useGameStore.getState().scenario).toBe(before);
  });

  it('закрытый сценарий не проверяется и не двигается', () => {
    useGameStore.getState().dismissScenario();
    useGameStore.setState((s) => ({
      grid: { ...s.grid, tiles: { ...s.grid.tiles, '0,0': 'generator_mk1' } },
    }));

    tickWithTimeAdvance();
    expect(useGameStore.getState().scenario.currentIndex).toBe(0);
  });

  it('пройденная цепочка больше не двигается и не падает', () => {
    useGameStore.setState((s) => ({
      scenario: { ...s.scenario, currentIndex: SCENARIO.length },
    }));

    expect(() => tickWithTimeAdvance()).not.toThrow();
    expect(useGameStore.getState().scenario.currentIndex).toBe(SCENARIO.length);
  });
});

describe('управление подсказкой', () => {
  it('свернуть/развернуть не сбрасывает прогресс', () => {
    useGameStore.setState((s) => ({ scenario: { ...s.scenario, currentIndex: 3 } }));

    useGameStore.getState().setScenarioCollapsed(true);
    expect(useGameStore.getState().scenario.collapsed).toBe(true);
    expect(useGameStore.getState().scenario.currentIndex).toBe(3);

    useGameStore.getState().setScenarioCollapsed(false);
    expect(useGameStore.getState().scenario.collapsed).toBe(false);
  });

  it('повторное сворачивание не создаёт нового состояния', () => {
    useGameStore.getState().setScenarioCollapsed(true);
    const after = useGameStore.getState().scenario;
    useGameStore.getState().setScenarioCollapsed(true);
    expect(useGameStore.getState().scenario).toBe(after);
  });

  it('restoreScenario возвращает и закрытую, и свёрнутую подсказку', () => {
    useGameStore.getState().dismissScenario();
    useGameStore.getState().setScenarioCollapsed(true);

    useGameStore.getState().restoreScenario();

    const scenario = useGameStore.getState().scenario;
    expect(scenario.dismissed).toBe(false);
    expect(scenario.collapsed).toBe(false);
  });
});

describe('сохранение прогресса', () => {
  it('прогресс переживает сериализацию', () => {
    useGameStore.setState({
      scenario: { currentIndex: 4, completedIds: ['energy', 'mining'], collapsed: true, dismissed: false },
    });

    const saved = serializeGame(useGameStore.getState());
    const restored = deserializeGame(saved);

    /*
     * Без этого «текущая цель» сбрасывалась бы на первый шаг при каждой загрузке — ориентир
     * превратился бы в шум, который игрок сразу закроет.
     */
    expect(restored.scenario?.currentIndex).toBe(4);
    expect(restored.scenario?.completedIds).toEqual(['energy', 'mining']);
    expect(restored.scenario?.collapsed).toBe(true);
  });

  it('старый сейв без секции сценария даёт начальный прогресс, а не undefined', () => {
    const restored = deserializeGame({});
    expect(restored.scenario?.currentIndex).toBe(0);
    expect(restored.scenario?.completedIds).toEqual([]);
  });

  it('resetGame начинает сценарий заново', () => {
    useGameStore.setState((s) => ({ scenario: { ...s.scenario, currentIndex: 5 } }));
    useGameStore.getState().resetGame();
    expect(useGameStore.getState().scenario.currentIndex).toBe(0);
  });
});
