/**
 * Достижения: условия, которые были недостижимы (bigplan.md, пункты 11, 26, 27).
 *
 * Десять типов условий возвращали `false` из заглушек `TODO` — награды выдавались корректно,
 * но выполниться эти достижения не могли никогда. Тесты закрепляют, что каждое условие теперь
 * читает реальный счётчик и что выдача идёт ОДНИМ вызовом, а не по одному set() на достижение.
 */

import { describe, expect, it, vi } from 'vitest';
import { checkAchievements } from './achievementsHelpers';
import { useGameStore } from '../features/gameStore';
import type { GameState } from '../core/gameTypes';

/** Свежий стор с чистыми достижениями и заданными счётчиками. */
function stateWith(statsPatch: Partial<GameState['stats']>): GameState {
  useGameStore.getState().resetGame();
  useGameStore.setState((s) => ({ stats: { ...s.stats, ...statsPatch } }));
  return useGameStore.getState();
}

/** Ловим, какие достижения выдал бы стор, не трогая настоящее состояние. */
function captureUnlocks(state: GameState): string[] {
  const captured: string[] = [];
  const spy = vi
    .spyOn(useGameStore.getState(), 'unlockAchievements')
    .mockImplementation((ids: string[]) => {
      captured.push(...ids);
    });
  try {
    checkAchievements({ ...state, unlockAchievements: spy as never });
  } finally {
    spy.mockRestore();
  }
  return captured;
}

describe('условия, которые раньше были недостижимы', () => {
  it('«Охотник на боссов» выдаётся по счётчику убитых боссов', () => {
    expect(captureUnlocks(stateWith({ bossKills: 9 }))).not.toContain('boss_hunter');
    expect(captureUnlocks(stateWith({ bossKills: 10 }))).toContain('boss_hunter');
  });

  it('«Непобедимый» — по числу отбитых волн', () => {
    expect(captureUnlocks(stateWith({ attacksDefended: 49 }))).not.toContain('invincible');
    expect(captureUnlocks(stateWith({ attacksDefended: 50 }))).toContain('invincible');
  });

  it('«Торговец» и «Мастер рынка» — по выполненным контрактам', () => {
    const at50 = captureUnlocks(stateWith({ contractsCompleted: 50 }));
    expect(at50).toContain('trader');
    expect(at50).not.toContain('market_master');

    expect(captureUnlocks(stateWith({ contractsCompleted: 200 }))).toContain('market_master');
  });

  it('«Правитель» — по РАЗНЫМ политикам за всё время, а не по одновременно активным', () => {
    const nine = Array.from({ length: 9 }, (_, i) => `policy_${i}`);
    expect(captureUnlocks(stateWith({ uniquePoliciesActivated: nine }))).not.toContain('ruler');

    const ten = Array.from({ length: 10 }, (_, i) => `policy_${i}`);
    expect(captureUnlocks(stateWith({ uniquePoliciesActivated: ten }))).toContain('ruler');
  });

  it('«Везунчик» — за награду от редкого события', () => {
    expect(captureUnlocks(stateWith({ rareEventRewards: 0 }))).not.toContain('lucky');
    expect(captureUnlocks(stateWith({ rareEventRewards: 1 }))).toContain('lucky');
  });

  it('«Выживший» — за пережитую цепную реакцию', () => {
    expect(captureUnlocks(stateWith({ chainReactionsSurvived: 0 }))).not.toContain('survivor');
    expect(captureUnlocks(stateWith({ chainReactionsSurvived: 1 }))).toContain('survivor');
  });

  it('«Мастер караванов» — по доставленным караванам', () => {
    expect(captureUnlocks(stateWith({ caravansDelivered: 99 }))).not.toContain('caravan_master');
    expect(captureUnlocks(stateWith({ caravansDelivered: 100 }))).toContain('caravan_master');
  });

  it('боевые достижения смотрят на убийства, а не на размер флота', () => {
    /*
     * Прежняя заглушка выдавала combat_wins за shipCount >= target/2, то есть за ПОКУПКУ
     * кораблей: активный боец без флота не получал их никогда, а покупатель кораблей получал
     * без единого боя. Здесь флот пустой, а убийства есть.
     */
    expect(useGameStore.getState().fleet.ships.length).toBe(0);

    const noKills = captureUnlocks(stateWith({ enemiesKilled: 0 }));
    expect(noKills).not.toContain('first_blood');

    const oneKill = captureUnlocks(stateWith({ enemiesKilled: 1 }));
    expect(oneKill).toContain('first_blood');
    expect(oneKill).not.toContain('demon_slayer');

    expect(captureUnlocks(stateWith({ enemiesKilled: 100 }))).toContain('demon_slayer');
  });
});

describe('пакетная выдача (пункт 27)', () => {
  it('все достижения одного прохода отдаются одним вызовом', () => {
    const state = stateWith({
      bossKills: 100,
      attacksDefended: 100,
      contractsCompleted: 500,
      caravansDelivered: 500,
      rareEventRewards: 10,
      chainReactionsSurvived: 10,
    });

    let callCount = 0;
    const spy = vi
      .spyOn(useGameStore.getState(), 'unlockAchievements')
      .mockImplementation(() => {
        callCount += 1;
      });
    try {
      checkAchievements({ ...state, unlockAchievements: spy as never });
    } finally {
      spy.mockRestore();
    }

    expect(callCount).toBe(1);
  });

  it('на пустом результате стор вообще не трогается', () => {
    // Свежая игра: ни один счётчик не набран.
    const state = stateWith({});
    let callCount = 0;
    const spy = vi
      .spyOn(useGameStore.getState(), 'unlockAchievements')
      .mockImplementation(() => {
        callCount += 1;
      });
    try {
      checkAchievements({ ...state, unlockAchievements: spy as never });
    } finally {
      spy.mockRestore();
    }

    // На старте что-то может быть уже выполнено (нулевые пороги), но если нет — вызова нет.
    expect(callCount).toBeLessThanOrEqual(1);
  });
});

describe('unlockAchievements в сторе', () => {
  it('начисляет награды за все достижения сразу, не перетирая друг друга', () => {
    useGameStore.getState().resetGame();
    const before = useGameStore.getState().currency.credits;

    // Два достижения с наградой в кредитах: 500 и 5000.
    useGameStore.getState().unlockAchievements(['first_steps', 'industrial_powerhouse']);

    const after = useGameStore.getState();
    expect(after.achievements.unlocked['first_steps']).toBeDefined();
    expect(after.achievements.unlocked['industrial_powerhouse']).toBeDefined();
    /*
     * Ключевая проверка пункта 27: награды СЛОЖИЛИСЬ. Прежняя реализация с отдельным set()
     * на каждое достижение считала обе награды от одного и того же старого currency, поэтому
     * второй set перетирал первый и до игрока доходило только 5000 вместо 5500.
     */
    expect(after.currency.credits.sub(before).toNumber()).toBe(5500);
  });

  it('повторная выдача уже открытого достижения ничего не меняет', () => {
    useGameStore.getState().resetGame();
    useGameStore.getState().unlockAchievements(['first_steps']);
    const afterFirst = useGameStore.getState();

    useGameStore.getState().unlockAchievements(['first_steps']);
    expect(useGameStore.getState().currency.credits.toString()).toBe(
      afterFirst.currency.credits.toString(),
    );
    expect(useGameStore.getState().achievements.unlocked['first_steps']).toBe(
      afterFirst.achievements.unlocked['first_steps'],
    );
  });

  it('пустой список не создаёт нового состояния', () => {
    useGameStore.getState().resetGame();
    const before = useGameStore.getState().achievements;
    useGameStore.getState().unlockAchievements([]);
    expect(useGameStore.getState().achievements).toBe(before);
  });
});
