/**
 * Офлайн-добыча должна пережить загрузку сейва (bigplan.md, пункт 41).
 *
 * Что было сломано: `loadGame` восстанавливал из сохранённого ресурса только `amount` и
 * `max`, а `production` молча оставлял нулевым — тем, что лежит в INITIAL_RESOURCES. Ставки
 * для офлайна берутся из УЖЕ загруженного состояния (см. шапку computeOfflineMining), то есть
 * функция каждый раз видела «выработка 0/с по всем ресурсам», возвращала null, и окно
 * «С возвращением!» не показывалось НИКОГДА, сколько бы игрок ни отсутствовал.
 *
 * Поэтому тест идёт через настоящий loadGame, а не через чистую функцию: сама
 * computeOfflineMining была исправна, ломалось звено между сейвом и ею.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGameStore } from './gameStore';
import { serializeGame } from './gameSave';
import { D } from '../core/math/format';

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

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const HOUR = 3600;

/** Сейв базы, которая на момент выхода добывала руду, сделанный `agoSeconds` назад. */
const makeSave = (agoSeconds: number) => {
  useGameStore.getState().resetGame();
  useGameStore.setState((s) => ({
    resources: {
      ...s.resources,
      ore: { ...s.resources.ore, amount: D(10), production: D(0.1) },
      // Отрицательная ставка офлайн ничего не списывает — проверяем и это.
      energy: { ...s.resources.energy, amount: D(100), production: D(-2) },
    },
  }));
  const data = { ...serializeGame(useGameStore.getState()), savedAt: Date.now() - agoSeconds * 1000 };
  useGameStore.getState().resetGame();
  return data;
};

/** GET /api/saves/latest/manual отдаёт подготовленный сейв; остальное — безобидные заглушки. */
const stubApi = (data: unknown) => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (String(url).includes('/api/saves/latest/manual')) {
        return json({ ok: true, save: { id: 7, revision: 3, name: 'test', save_type: 'manual', data } });
      }
      return json({ ok: true });
    }),
  );
};

describe('офлайн-добыча после загрузки сейва', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', fakeLocalStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    useGameStore.getState().resetGame();
  });

  it('восстанавливает ставки выработки из сейва', async () => {
    stubApi(makeSave(HOUR));

    await useGameStore.getState().loadGame();

    // Без этого офлайн-добыча мертва: ставка — единственный её вход.
    expect(useGameStore.getState().resources.ore.production.toNumber()).toBeCloseTo(0.1, 6);
  });

  it('после часа отсутствия начисляет отчёт с 75% выработки', async () => {
    stubApi(makeSave(HOUR));

    await useGameStore.getState().loadGame();

    const report = useGameStore.getState().offlineMining;
    expect(report).not.toBeNull();
    expect(report!.creditedSeconds).toBe(HOUR);
    expect(report!.efficiency).toBeCloseTo(0.75, 6);

    const ore = report!.gains.find((g) => g.resource === 'ore');
    expect(ore).toBeDefined();
    expect(ore!.amount.toNumber()).toBeCloseTo(0.1 * HOUR * 0.75, 3);

    // Отсутствие не штрафует: отрицательная ставка энергии в отчёт не попадает.
    expect(report!.gains.some((g) => g.resource === 'energy')).toBe(false);
  });

  it('короткая отлучка (перезагрузка страницы) окна не открывает', async () => {
    stubApi(makeSave(20));

    await useGameStore.getState().loadGame();

    expect(useGameStore.getState().offlineMining).toBeNull();
  });

  it('«Забрать» кладёт добычу в базовый буфер, иначе первый же тик её сотрёт', async () => {
    stubApi(makeSave(HOUR));
    await useGameStore.getState().loadGame();
    const before = D(useGameStore.getState().grid.buffers.base?.ore ?? 0);

    useGameStore.getState().claimOfflineMining();

    const after = D(useGameStore.getState().grid.buffers.base?.ore ?? 0);
    expect(after.sub(before).toNumber()).toBeCloseTo(0.1 * HOUR * 0.75, 3);
    // Отчёт гаснет в том же set(), поэтому повторный клик ничего не добавит.
    expect(useGameStore.getState().offlineMining).toBeNull();
    useGameStore.getState().claimOfflineMining();
    expect(D(useGameStore.getState().grid.buffers.base?.ore ?? 0).toNumber()).toBeCloseTo(
      after.toNumber(),
      6,
    );

    // claimOfflineMining дописывает сейв не дожидаясь вызывающего: даём записи уйти, пока
    // заглушки fetch/localStorage ещё на месте, иначе она падает уже после теста.
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  it('чужой отчёт не переживает загрузку другого сейва', async () => {
    stubApi(makeSave(HOUR));
    await useGameStore.getState().loadGame();
    expect(useGameStore.getState().offlineMining).not.toBeNull();

    // Второй вход (смена слота) — сейв свежий, начислять нечего. Отчёт прошлой базы,
    // посчитанный по её ставкам, начислять в новую нельзя.
    stubApi(makeSave(0));
    await useGameStore.getState().loadGame();

    expect(useGameStore.getState().offlineMining).toBeNull();
  });
});

/**
 * Свёрнутая вкладка — тоже офлайн: rAF в ней не вызывается, база стоит, а loadGame не
 * происходит. Раньше это время не оплачивалось вообще, и офлайн-добыча существовала только
 * для перезагрузки страницы. Здесь проверяется вход этого пути — creditOfflineMining.
 */
describe('creditOfflineMining', () => {
  beforeEach(() => {
    useGameStore.getState().resetGame();
    useGameStore.setState((s) => ({
      resources: { ...s.resources, ore: { ...s.resources.ore, amount: D(10), production: D(0.1) } },
    }));
  });

  afterEach(() => {
    useGameStore.getState().resetGame();
  });

  it('считает отчёт за время, пока база стояла', () => {
    useGameStore.getState().creditOfflineMining(Date.now() - HOUR * 1000);

    const report = useGameStore.getState().offlineMining;
    expect(report).not.toBeNull();
    expect(report!.creditedSeconds).toBe(HOUR);
    expect(report!.gains.find((g) => g.resource === 'ore')!.amount.toNumber()).toBeCloseTo(
      0.1 * HOUR * 0.75,
      3,
    );
  });

  it('переключение на соседнюю вкладку на полминуты окна не открывает', () => {
    useGameStore.getState().creditOfflineMining(Date.now() - 30 * 1000);

    expect(useGameStore.getState().offlineMining).toBeNull();
  });

  it('не перетирает отчёт, который игрок ещё не забрал', () => {
    useGameStore.getState().creditOfflineMining(Date.now() - 4 * HOUR * 1000);
    const first = useGameStore.getState().offlineMining;

    useGameStore.getState().creditOfflineMining(Date.now() - HOUR * 1000);

    // Ровно тот же объект: показанная игроку сумма не подменяется меньшей.
    expect(useGameStore.getState().offlineMining).toBe(first);
  });
});
