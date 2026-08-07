/**
 * Конфликт версий сейва не должен стоить игроку сделанного (bigplan 30.3).
 *
 * Проверка версии защищала от затирания ЧУЖОЙ записи, но платила за это гарантированной
 * потерей СВОЕЙ: на 409 клиент сразу перезагружал состояние из БД, и всё, что игрок успел
 * сделать с последнего автосохранения, исчезало молча. Так пропадали продвинутые настройки
 * здания: игрок менял режим, автосейв ловил 409 — и настройка стиралась из памяти.
 *
 * Теперь первый конфликт разрешается ОДНИМ повтором записи поверх версии, которую назвал
 * сервер, и состояние остаётся при игроке. Перезагрузка — только если конфликтует и повтор.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGameStore } from './gameStore';

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

/** Ответы PUT /api/saves по порядку; остальные запросы — безобидные заглушки. */
const stubApi = (putResponses: Array<() => Response>) => {
  const puts: number[] = [];
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.includes('/api/preferences/current-save')) return json({ ok: true, currentSaveId: 4 });
    if (u.endsWith('/api/saves') && init?.method === 'PUT') {
      const body = JSON.parse(String(init.body));
      puts.push(body.baseRevision);
      const next = putResponses.shift();
      if (!next) throw new Error('лишний PUT: ' + puts.length);
      return next();
    }
    return json({ ok: true });
  });
  vi.stubGlobal('fetch', fetchMock);
  return { puts };
};

describe('автосохранение при конфликте версий', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', fakeLocalStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('после 409 повторяет запись с версией сервера и НЕ перезагружает состояние', async () => {
    const { puts } = stubApi([
      () => json({ ok: false, error: 'SAVE_OUTDATED', saveId: 4, revision: 61 }, 409),
      () => json({ ok: true, save: { id: 4, revision: 62 } }),
    ]);
    const loadGame = vi.spyOn(useGameStore.getState(), 'loadGame');

    const res = await useGameStore.getState().saveGame();

    expect(res).toEqual({ ok: true });
    // Вторая попытка ушла именно с той версией, которую назвал сервер в 409.
    expect(puts[1]).toBe(61);
    // Главное: состояние игрока осталось при нём.
    expect(loadGame).not.toHaveBeenCalled();
  });

  it('если конфликтует и повтор — перезагружает состояние и предупреждает игрока', async () => {
    stubApi([
      () => json({ ok: false, error: 'SAVE_OUTDATED', saveId: 4, revision: 61 }, 409),
      () => json({ ok: false, error: 'SAVE_OUTDATED', saveId: 4, revision: 62 }, 409),
    ]);
    const loadGame = vi
      .spyOn(useGameStore.getState(), 'loadGame')
      .mockImplementation(async () => {});

    const res = await useGameStore.getState().saveGame();

    expect(res).toEqual({ ok: false, error: 'SAVE_OUTDATED' });
    expect(loadGame).toHaveBeenCalledTimes(1);

    // Игроку сказали, что несохранённое потеряно, а не просто «загружаю состояние».
    // Уведомления живут в galaxies.notifications, новое кладётся в начало списка.
    const notes = useGameStore.getState().galaxies.notifications;
    expect(notes[0]?.message).toMatch(/потеряны/);
  });
});
