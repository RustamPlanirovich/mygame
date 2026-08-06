/**
 * РАСПИСАНИЕ ТИКА (bigplan.md, пункт 22)
 *
 * Игровой цикл вызывает `tick` 20 раз в секунду, и раньше КАЖДЫЙ вызов прогонял все
 * подсистемы разом. Для производства это правильно — оно должно быть плавным. Для
 * загрязнения, логистики и агрегатов аналитики это чистая трата: мусор копится единицами
 * в секунду, караван едет минуты, а график аналитики игрок смотрит глазами.
 *
 * Здесь — единственное место, где решается «что запускается на этом тике». Не разбросанные
 * по тику счётчики: их невозможно ни увидеть целиком, ни протестировать.
 *
 * ПОЧЕМУ НАКОПЛЕННЫЙ dt, А НЕ ПРОСТО ПРОПУСК. Подсистема, запущенная раз в секунду,
 * получает dt за всю секунду, а не за 1/20. Иначе замедление в 20 раз выглядело бы как
 * «отходов стало меньше», и баланс поехал бы молча. Итог за минуту обязан совпадать с
 * прежним — это и проверяет тест.
 *
 * ПОЧЕМУ ФАЗЫ СМЕЩЕНЫ. Подсистемы с разными периодами не должны сходиться в один кадр:
 * если раз в 5 секунд всё тяжёлое считается разом, игрок увидит регулярный рывок. Каждая
 * подсистема стартует со своим сдвигом, поэтому нагрузка размазана.
 */

/** Подсистемы, которым не нужна частота игрового цикла. */
export type SlowSystem = 'pollution' | 'logistics' | 'culture';

export interface SlowSystemState {
  /** Секунды, накопленные с прошлого запуска. */
  accumulated: number;
  /** Сколько секунд ждать до следующего запуска. */
  period: number;
}

export type TickSchedule = Record<SlowSystem, SlowSystemState>;

/**
 * Периоды подобраны по тому, как быстро меняется сама величина, а не «на глаз»:
 *  - pollution: мусор копится единицами в секунду, 1 с не заметна;
 *  - logistics: караван едет минуты, 1 с — с большим запасом;
 *  - culture: счастье меняется со скоростью в единицы в секунду и дополнительно сглажено
 *    (smoothHappinessTransition ограничивает шаг по dt), а уровень культуры растёт минутами.
 * Сдвиги фаз не кратны друг другу, чтобы запуски не собирались в один кадр.
 */
export const SLOW_SYSTEM_PERIODS: Record<SlowSystem, number> = {
  pollution: 1,
  logistics: 1,
  culture: 2,
};

const PHASE_OFFSETS: Record<SlowSystem, number> = {
  pollution: 0,
  logistics: 0.37,
  culture: 0.71,
};

export function createTickSchedule(): TickSchedule {
  return {
    pollution: { accumulated: PHASE_OFFSETS.pollution, period: SLOW_SYSTEM_PERIODS.pollution },
    logistics: { accumulated: PHASE_OFFSETS.logistics, period: SLOW_SYSTEM_PERIODS.logistics },
    culture: { accumulated: PHASE_OFFSETS.culture, period: SLOW_SYSTEM_PERIODS.culture },
  };
}

/** Что подсистеме досталось на этом тике: запускать ли и с каким dt. */
export interface SlowRun {
  due: boolean;
  /** Секунды, накопленные с прошлого ЗАПУСКА. Ноль, если запускать не пора. */
  dt: number;
}

/**
 * Продвинуть расписание на `dt` секунд и сказать, какие подсистемы пора запустить.
 *
 * МУТИРУЕТ переданное расписание: оно живёт вне стора (это не игровое состояние, а
 * состояние планировщика) и меняется 20 раз в секунду — создавать под него объекты значит
 * платить сборщику мусора ровно за то, ради чего всё и затевалось.
 *
 * Один длинный кадр (свёрнутая вкладка, загрузка сейва) НЕ превращается в несколько
 * запусков подряд: подсистема получает весь накопленный dt разом и отрабатывает один раз.
 */
export function advanceSchedule(schedule: TickSchedule, dt: number): Record<SlowSystem, SlowRun> {
  const safeDt = Number.isFinite(dt) && dt > 0 ? dt : 0;

  const result = {} as Record<SlowSystem, SlowRun>;
  for (const key of Object.keys(schedule) as SlowSystem[]) {
    const entry = schedule[key];
    entry.accumulated += safeDt;
    if (entry.accumulated >= entry.period) {
      result[key] = { due: true, dt: entry.accumulated };
      entry.accumulated = 0;
    } else {
      result[key] = { due: false, dt: 0 };
    }
  }
  return result;
}
