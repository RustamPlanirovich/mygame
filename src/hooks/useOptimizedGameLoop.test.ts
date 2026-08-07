/**
 * Учёт свёрнутой вкладки для офлайн-добычи.
 *
 * rAF в скрытой вкладке браузер не вызывает, а накопитель времени в игровом цикле зажат
 * `maxFrameTime`: догоняющих тиков нет, база стоит. Отчёт об офлайн-добыче до этого считался
 * только в `loadGame`, то есть при перезагрузке страницы, и свёрнутая на четверть часа
 * вкладка не приносила игроку ничего.
 *
 * Проверяется ЧИСТОЕ правило «сколько времени не было просчитано» — сам обработчик
 * visibilitychange держится на DOM, а тесты здесь идут без jsdom (см. vitest.config.ts).
 */

import { describe, expect, it } from 'vitest';
import { unsimulatedAwayMs } from './useOptimizedGameLoop';

const NOW = 1_700_000_000_000;
const MINUTE = 60_000;

describe('unsimulatedAwayMs', () => {
  it('вкладка была скрыта 15 минут и не считалась — оплачиваются все 15', () => {
    expect(unsimulatedAwayMs(NOW - 15 * MINUTE, 0, NOW)).toBe(15 * MINUTE);
  });

  it('фоновые кадры вычитаются: за них выработка уже начислена по полной ставке', () => {
    // Браузер будил rAF в фоне и успел просчитать 2 минуты игрового времени из 15.
    expect(unsimulatedAwayMs(NOW - 15 * MINUTE, 2 * MINUTE, NOW)).toBe(13 * MINUTE);
  });

  it('вкладка считалась всё время, пока была скрыта — платить не за что', () => {
    expect(unsimulatedAwayMs(NOW - 5 * MINUTE, 5 * MINUTE, NOW)).toBe(0);
    // И тем более если фон насчитал больше, чем прошло по часам.
    expect(unsimulatedAwayMs(NOW - 5 * MINUTE, 9 * MINUTE, NOW)).toBe(0);
  });

  it('вкладку не скрывали — начислять нечего', () => {
    expect(unsimulatedAwayMs(null, 0, NOW)).toBe(0);
  });

  it('прыжок системных часов назад не превращается в долг', () => {
    expect(unsimulatedAwayMs(NOW + 10 * MINUTE, 0, NOW)).toBe(0);
    expect(unsimulatedAwayMs(Number.NaN, 0, NOW)).toBe(0);
  });
});
