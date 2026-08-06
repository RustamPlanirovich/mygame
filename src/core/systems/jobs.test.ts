/**
 * Единый движок отложенных задач (bigplan.md, пункт 25).
 *
 * Главное свойство, ради которого он и заводился: время считается от АБСОЛЮТНЫХ меток,
 * а не накапливается в тике. Именно поэтому работа достраивается за оффлайн и не замирает
 * в свёрнутой вкладке — накопитель `progress += rate * dt` не умел ни того, ни другого.
 */

import { describe, expect, it } from 'vitest';
import {
  createJob,
  formatRemaining,
  isComplete,
  pauseJob,
  progressOf,
  remainingMs,
  resumeJob,
  splitCompleted,
} from './jobs';

const T0 = 1_000_000;
const job = (durationMs: number, startedAt = T0) =>
  createJob({ id: 'j', kind: 'ship', target: 'fighter', durationMs, now: startedAt });

describe('прогресс и готовность', () => {
  it('считаются от абсолютных меток, а не от накопленного dt', () => {
    const j = job(10_000);
    expect(progressOf(j, T0)).toBe(0);
    expect(progressOf(j, T0 + 5_000)).toBeCloseTo(0.5);
    expect(progressOf(j, T0 + 10_000)).toBe(1);
  });

  it('работа, начатая до закрытия игры, готова сразу после загрузки', () => {
    // Ровно то, что делает оффлайн: игру не открывали час, работа была на 30 секунд.
    const j = job(30_000);
    expect(isComplete(j, T0 + 60 * 60 * 1000)).toBe(true);
    expect(remainingMs(j, T0 + 60 * 60 * 1000)).toBe(0);
  });

  it('прогресс не уходит за границы при часах, сдвинутых назад', () => {
    const j = job(10_000);
    expect(progressOf(j, T0 - 5_000)).toBe(0);
    expect(remainingMs(j, T0 + 999_999)).toBe(0);
  });

  it('нулевая длительность — сразу готово, а не вечная работа', () => {
    const j = job(0);
    expect(progressOf(j, T0)).toBe(1);
    expect(isComplete(j, T0)).toBe(true);
  });

  it('отрицательная длительность обнуляется', () => {
    expect(job(-5_000).duration).toBe(0);
  });
});

describe('пауза', () => {
  it('не даёт работе завершиться и замораживает прогресс', () => {
    const paused = pauseJob(job(10_000), T0 + 3_000);
    expect(progressOf(paused, T0 + 100_000)).toBeCloseTo(0.3);
    expect(isComplete(paused, T0 + 100_000)).toBe(false);
  });

  it('снятие с паузы сохраняет ОСТАТОК, а не момент завершения', () => {
    const paused = pauseJob(job(10_000), T0 + 3_000); // осталось 7 секунд
    const resumed = resumeJob(paused, T0 + 50_000); // простой 47 секунд
    expect(remainingMs(resumed, T0 + 50_000)).toBe(7_000);
    expect(isComplete(resumed, T0 + 50_000 + 7_000)).toBe(true);
  });

  it('повторная пауза и снятие с не-паузы ничего не меняют', () => {
    const j = job(10_000);
    const paused = pauseJob(j, T0 + 1_000);
    expect(pauseJob(paused, T0 + 5_000)).toBe(paused);
    expect(resumeJob(j, T0 + 5_000)).toBe(j);
  });
});

describe('splitCompleted', () => {
  it('возвращает ИСХОДНЫЙ массив, когда ничего не готово', () => {
    const queue = [job(10_000)];
    const result = splitCompleted(queue, T0 + 1_000);
    // Ссылка та же: обработчик вызывается 20 раз в секунду, и новый массив каждый раз
    // сбрасывал бы ===-мемоизацию у всех подписчиков очереди.
    expect(result.pending).toBe(queue);
    expect(result.done).toHaveLength(0);
  });

  it('делит очередь и не теряет записи', () => {
    const queue = [job(1_000), job(10_000), job(2_000)];
    const { done, pending } = splitCompleted(queue, T0 + 5_000);
    expect(done).toHaveLength(2);
    expect(pending).toHaveLength(1);
    expect(done.length + pending.length).toBe(queue.length);
  });

  it('пустая и отсутствующая очередь не падают', () => {
    expect(splitCompleted([], T0).done).toHaveLength(0);
    expect(splitCompleted(undefined, T0).done).toHaveLength(0);
  });
});

describe('formatRemaining', () => {
  it('секунды, минуты и часы', () => {
    expect(formatRemaining(12_000)).toBe('12с');
    expect(formatRemaining(65_000)).toBe('1м 05с');
    expect(formatRemaining(2 * 3600_000 + 3 * 60_000)).toBe('2ч 03м');
  });

  it('отрицательное время показывается как ноль, а не как минус', () => {
    expect(formatRemaining(-5_000)).toBe('0с');
  });
});
