/**
 * Расписание тика (bigplan.md, пункт 22).
 *
 * Главное свойство: замедление подсистемы НЕ должно менять итог. Подсистема, запущенная
 * раз в секунду, получает dt за всю секунду — иначе «в 20 раз реже» тихо превратилось бы
 * в «в 20 раз меньше», и баланс поехал бы там, где никто не смотрит.
 */

import { describe, expect, it } from 'vitest';
import { advanceSchedule, createTickSchedule, SLOW_SYSTEM_PERIODS } from './tickSchedule';

const FRAME = 1 / 20; // игровой цикл: 20 тиков в секунду

describe('advanceSchedule', () => {
  it('за минуту сумма выданных dt равна реально прошедшему времени', () => {
    const schedule = createTickSchedule();
    let pollutionTime = 0;
    let ticks = 0;

    for (let i = 0; i < 60 * 20; i++) {
      const runs = advanceSchedule(schedule, FRAME);
      if (runs.pollution.due) {
        pollutionTime += runs.pollution.dt;
        ticks++;
      }
    }

    // Ни секунды не потеряно и не удвоено (стартовый сдвиг фазы — в пределах периода).
    expect(pollutionTime).toBeGreaterThan(59);
    expect(pollutionTime).toBeLessThanOrEqual(60.5);
    // И запусков примерно раз в секунду, а не 1200 раз.
    expect(ticks).toBeGreaterThanOrEqual(59);
    expect(ticks).toBeLessThanOrEqual(61);
  });

  it('редкая подсистема запускается реже частой', () => {
    const schedule = createTickSchedule();
    let pollution = 0;
    let culture = 0;

    for (let i = 0; i < 20 * 20; i++) {
      const runs = advanceSchedule(schedule, FRAME);
      if (runs.pollution.due) pollution++;
      if (runs.culture.due) culture++;
    }

    expect(SLOW_SYSTEM_PERIODS.culture).toBeGreaterThan(SLOW_SYSTEM_PERIODS.pollution);
    expect(culture).toBeLessThan(pollution);
  });

  it('фазы не сходятся: подсистемы не запускаются все в одном кадре постоянно', () => {
    const schedule = createTickSchedule();
    let framesWithAllThree = 0;

    for (let i = 0; i < 60 * 20; i++) {
      const runs = advanceSchedule(schedule, FRAME);
      if (runs.pollution.due && runs.logistics.due && runs.culture.due) framesWithAllThree++;
    }

    // Иначе игрок видел бы регулярный рывок, когда всё тяжёлое считается разом.
    expect(framesWithAllThree).toBe(0);
  });

  it('один длинный кадр даёт ОДИН запуск с полным dt, а не пачку подряд', () => {
    const schedule = createTickSchedule();
    // Вкладка была свёрнута минуту.
    const runs = advanceSchedule(schedule, 60);

    expect(runs.pollution.due).toBe(true);
    expect(runs.pollution.dt).toBeGreaterThanOrEqual(60);

    // Следующий обычный кадр уже не должен ничего запускать.
    const next = advanceSchedule(schedule, FRAME);
    expect(next.pollution.due).toBe(false);
  });

  it('нулевой и мусорный dt не двигают расписание', () => {
    const schedule = createTickSchedule();
    const before = schedule.pollution.accumulated;

    advanceSchedule(schedule, 0);
    advanceSchedule(schedule, Number.NaN);
    advanceSchedule(schedule, -5);

    expect(schedule.pollution.accumulated).toBe(before);
  });

  it('когда запускать не пора, dt равен нулю — чтобы его нельзя было использовать по ошибке', () => {
    const schedule = createTickSchedule();
    const runs = advanceSchedule(schedule, FRAME);
    for (const key of Object.keys(runs) as Array<keyof typeof runs>) {
      if (!runs[key].due) expect(runs[key].dt).toBe(0);
    }
  });
});
