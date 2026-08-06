/**
 * Расписание случайных событий (bigplan.md, пункт 22).
 *
 * Модуль появился из-за одной строки, вокруг которой в тике стоял предупреждающий
 * комментарий: множитель частоты — это ДЕЛИТЕЛЬ интервала. `0.5` значит «вдвое реже», то
 * есть интервал вдвое БОЛЬШЕ. Перепутать здесь знак — перевернуть эффект всех политик на
 * частоту событий разом, а заметить это можно только секундомером. Такая арифметика
 * обязана быть под тестом, а не в комментарии.
 */

import { describe, expect, it } from 'vitest';
import {
  dropExpiredEvents,
  eventNotificationType,
  nextEventDelay,
} from './randomEventSchedule';

const RANGE = { min: 60_000, max: 120_000 };

describe('nextEventDelay', () => {
  it('без множителей даёт интервал из диапазона', () => {
    expect(nextEventDelay(0, RANGE)).toBe(60_000);
    expect(nextEventDelay(1, RANGE)).toBe(120_000);
    expect(nextEventDelay(0.5, RANGE)).toBe(90_000);
  });

  it('множитель 2 означает ВДВОЕ ЧАЩЕ, то есть вдвое короче интервал', () => {
    expect(nextEventDelay(0, RANGE, 2)).toBe(30_000);
  });

  it('множитель 0.5 означает ВДВОЕ РЕЖЕ, то есть вдвое длиннее интервал', () => {
    // Ровно тот случай, на котором знак и переворачивался.
    expect(nextEventDelay(0, RANGE, 0.5)).toBe(120_000);
  });

  it('несколько множителей перемножаются', () => {
    // 2 × 2 = вчетверо чаще.
    expect(nextEventDelay(0, RANGE, 2, 2)).toBe(15_000);
    // Взаимно гасящие множители возвращают базовый интервал.
    expect(nextEventDelay(0, RANGE, 2, 0.5)).toBe(60_000);
  });

  it('нулевой множитель НЕ даёт бесконечность', () => {
    /*
     * Деление на ноль дало бы Infinity, и события не наступили бы никогда — причём молча,
     * без единой ошибки. Возвращаем базовый интервал.
     */
    expect(nextEventDelay(0, RANGE, 0)).toBe(60_000);
    expect(nextEventDelay(0, RANGE, -1)).toBe(60_000);
  });

  it('мусорный множитель игнорируется, а не портит результат', () => {
    expect(nextEventDelay(0, RANGE, Number.NaN)).toBe(60_000);
    expect(nextEventDelay(0, RANGE, 2, Number.POSITIVE_INFINITY)).toBe(30_000);
  });

  it('бросок за границами [0,1) кламается', () => {
    expect(nextEventDelay(-5, RANGE)).toBe(60_000);
    expect(nextEventDelay(99, RANGE)).toBe(120_000);
    expect(nextEventDelay(Number.NaN, RANGE)).toBe(60_000);
  });
});

describe('dropExpiredEvents', () => {
  const now = 1_000_000;

  it('без истёкших возвращает ИСХОДНЫЙ массив', () => {
    const events = [{ expiresAt: now + 1000 }, {}];
    // Новый массив на пустом месте будил бы панель событий 20 раз в секунду.
    expect(dropExpiredEvents(events, now)).toBe(events);
  });

  it('убирает только истёкшие', () => {
    const alive = { expiresAt: now + 1 };
    const dead = { expiresAt: now - 1 };
    const forever = {};
    const result = dropExpiredEvents([alive, dead, forever], now);
    expect(result).toEqual([alive, forever]);
  });

  it('событие ровно на границе считается истёкшим', () => {
    expect(dropExpiredEvents([{ expiresAt: now }], now)).toEqual([]);
  });

  it('событие без срока живёт всегда', () => {
    const events = [{}];
    expect(dropExpiredEvents(events, now + 1e12)).toBe(events);
  });

  it('пустой список не падает', () => {
    expect(dropExpiredEvents([], now)).toEqual([]);
  });
});

describe('eventNotificationType', () => {
  it('вредное событие — предупреждение', () => {
    expect(eventNotificationType('pirate_raid')).toBe('warning');
    expect(eventNotificationType('chain_reaction')).toBe('warning');
  });

  it('остальное — новость', () => {
    expect(eventNotificationType('synergy_discovery')).toBe('info');
    expect(eventNotificationType('нет_такого_типа')).toBe('info');
  });
});
