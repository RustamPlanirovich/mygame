/**
 * Очереди кораблей и мегаструктур на едином движке (bigplan.md, пункт 25).
 *
 * Проверяется ровно то, чего раньше не было:
 *   - `buildTime` у кораблей ПЕРЕСТАЛ быть мёртвым числом: корабль появляется не по клику,
 *     а по времени;
 *   - стоимость списывается при постановке в очередь (иначе можно поставить сто кораблей
 *     бесплатно), а отмена её возвращает;
 *   - мегаструктура достраивается за оффлайн: раньше её прогресс накапливался в тике и
 *     замирал вместе со свёрнутой вкладкой;
 *   - старый сейв с `progress` мигрирует, не теряя пройденную часть.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useGameStore } from './gameStore';
import { loadSavePayload } from './gameSave';
import { D } from '../core/math/format';
import { SHIP_DEFINITIONS } from '../core/constants/ships';
import { MEGASTRUCTURES } from '../core/constants/megastructures';
import type { ResourceType } from '../core/gameTypes';

function fundBase() {
  useGameStore.setState((s) => {
    const buffers = { ...s.grid.buffers, base: { ...(s.grid.buffers.base ?? {}) } };
    const resources = { ...s.resources };
    for (const key of Object.keys(resources) as ResourceType[]) {
      const half = resources[key].max.div(2);
      buffers.base[key] = half.toString();
      resources[key] = { ...resources[key], amount: half };
    }
    return {
      grid: { ...s.grid, buffers },
      resources,
      currency: { ...s.currency, credits: D('1000000000') },
    };
  });
}

beforeEach(() => {
  useGameStore.getState().resetGame();
  fundBase();
  vi.useRealTimers();
});

describe('очередь постройки кораблей', () => {
  it('корабль не появляется мгновенно — он встаёт в очередь', () => {
    useGameStore.getState().buildShip('fighter');

    const { fleet } = useGameStore.getState();
    expect(fleet.ships).toHaveLength(0);
    expect(fleet.buildQueue).toHaveLength(1);
    expect(fleet.buildQueue[0]).toMatchObject({
      kind: 'ship',
      target: 'fighter',
      duration: SHIP_DEFINITIONS.fighter.buildTime,
    });
  });

  it('стоимость списывается СРАЗУ, а не по готовности', () => {
    const before = useGameStore.getState().currency.credits;
    useGameStore.getState().buildShip('fighter');
    const after = useGameStore.getState().currency.credits;

    const price = SHIP_DEFINITIONS.fighter.buildCost.credits;
    if (price) {
      // Иначе можно было бы поставить сто кораблей бесплатно и ждать.
      expect(after.lt(before)).toBe(true);
    }
  });

  it('тик достраивает корабль, когда время вышло', () => {
    useGameStore.getState().buildShip('fighter');
    const job = useGameStore.getState().fleet.buildQueue[0];

    // Сдвигаем старт в прошлое — то же самое, что вернуться в игру после оффлайна.
    useGameStore.setState((s) => ({
      fleet: {
        ...s.fleet,
        buildQueue: [{ ...job, startedAt: job.startedAt - job.duration - 1000 }],
      },
    }));

    useGameStore.getState().tick(0.05);

    const { fleet } = useGameStore.getState();
    expect(fleet.buildQueue).toHaveLength(0);
    expect(fleet.ships).toHaveLength(1);
    expect(fleet.ships[0].type).toBe('fighter');
  });

  it('пока время не вышло, тик НЕ создаёт корабль и не меняет ссылку на флот', () => {
    useGameStore.getState().buildShip('fighter');
    const fleetBefore = useGameStore.getState().fleet;

    useGameStore.getState().tick(0.05);

    // Новая ссылка каждый тик перерисовывала бы панель флота впустую.
    expect(useGameStore.getState().fleet).toBe(fleetBefore);
    expect(useGameStore.getState().fleet.ships).toHaveLength(0);
  });

  it('отмена возвращает стоимость и убирает работу', () => {
    const creditsBefore = useGameStore.getState().currency.credits;
    useGameStore.getState().buildShip('fighter');
    const jobId = useGameStore.getState().fleet.buildQueue[0].id;

    useGameStore.getState().cancelShipJob(jobId);

    expect(useGameStore.getState().fleet.buildQueue).toHaveLength(0);
    expect(useGameStore.getState().currency.credits.toString()).toBe(creditsBefore.toString());
  });

  it('отмена несуществующей работы ничего не ломает', () => {
    const before = useGameStore.getState().fleet;
    useGameStore.getState().cancelShipJob('нет-такой');
    expect(useGameStore.getState().fleet).toBe(before);
  });
});

describe('очередь мегаструктур', () => {
  it('хранит абсолютное время, а не накопленный прогресс', () => {
    useGameStore.setState((s) => ({
      megastructures: {
        ...s.megastructures,
        constructionQueue: [
          { megastructureId: 'dyson_sphere', startedAt: Date.now(), duration: 60_000 },
        ],
      },
    }));

    // Тик на 0.05 с не должен ничего достроить — время идёт по часам, а не по dt.
    useGameStore.getState().tick(0.05);
    expect(useGameStore.getState().megastructures.constructionQueue).toHaveLength(1);
    expect(useGameStore.getState().megastructures.built.dyson_sphere).toBeUndefined();
  });

  it('достраивается за оффлайн одним тиком', () => {
    useGameStore.setState((s) => ({
      megastructures: {
        ...s.megastructures,
        constructionQueue: [
          { megastructureId: 'dyson_sphere', startedAt: Date.now() - 120_000, duration: 60_000 },
        ],
      },
    }));

    useGameStore.getState().tick(0.05);

    expect(useGameStore.getState().megastructures.constructionQueue).toHaveLength(0);
    expect(useGameStore.getState().megastructures.built.dyson_sphere?.active).toBe(true);
  });
});

describe('миграция старого сейва', () => {
  it('очередь мегаструктур с progress не теряет пройденную часть', () => {
    const fullMs = MEGASTRUCTURES.dyson_sphere.buildTime * 1000;
    const restored = loadSavePayload({
      megastructures: {
        built: {},
        constructionQueue: [
          { megastructureId: 'dyson_sphere', startedAt: 1, progress: 50 },
        ],
      },
    });

    const queue = restored.megastructures!.constructionQueue;
    expect(queue).toHaveLength(1);
    expect(queue[0].duration).toBe(fullMs);
    /*
     * startedAt сдвинут в прошлое ровно на пройденную половину: иначе стройка, доведённая
     * до 90%, отсчитала бы полное время заново.
     */
    const elapsed = Date.now() - queue[0].startedAt;
    expect(elapsed).toBeGreaterThanOrEqual(fullMs / 2 - 1000);
    expect(elapsed).toBeLessThanOrEqual(fullMs / 2 + 1000);
  });

  it('запись с неизвестной мегаструктурой выбрасывается, а не висит вечно', () => {
    const restored = loadSavePayload({
      megastructures: {
        built: {},
        constructionQueue: [{ megastructureId: 'нет_такой', startedAt: 1, progress: 10 }],
      },
    });
    expect(restored.megastructures!.constructionQueue).toHaveLength(0);
  });

  it('старая fleet.productionQueue не переезжает в новую очередь', () => {
    const restored = loadSavePayload({
      fleet: {
        ships: [],
        autoDefend: true,
        productionQueue: [{ shipType: 'fighter', progress: 0.5, timeRemaining: 1000 }],
      },
    });
    // Её никто никогда не заполнял: корабли создавались мгновенно.
    expect(restored.fleet!.buildQueue).toHaveLength(0);
  });

  it('работа без id отбрасывается: по id идёт отмена', () => {
    const restored = loadSavePayload({
      fleet: {
        ships: [],
        autoDefend: true,
        buildQueue: [
          { id: '', kind: 'ship', target: 'fighter', startedAt: 1, duration: 1000 },
          { id: 'ok', kind: 'ship', target: 'fighter', startedAt: 1, duration: 1000 },
        ],
      },
    });
    expect(restored.fleet!.buildQueue.map((j) => j.id)).toEqual(['ok']);
  });
});
