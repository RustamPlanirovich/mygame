/**
 * РАСПИСАНИЕ И СРОК ЖИЗНИ СЛУЧАЙНЫХ СОБЫТИЙ (bigplan.md, пункт 22).
 *
 * Само событие придумывает `generateRandomEvent`, применяет `applyEventEffects` — они
 * давно живут отдельно. А вот РЕШЕНИЯ вокруг них жили в теле тика: когда назначить
 * следующее событие, какие активные пора убрать и каким тоном сообщить игроку.
 *
 * ЗАЧЕМ ВЫНОСИЛОСЬ. Из-за одной строки, вокруг которой в тике стоял предупреждающий
 * комментарий: множитель частоты — это ДЕЛИТЕЛЬ интервала, а не множитель. `0.5` означает
 * «вдвое реже», то есть интервал вдвое БОЛЬШЕ. Написать `interval * 0.5` вместо
 * `interval / 0.5` — значит перевернуть знак эффекта у всех политик разом, и заметить это
 * можно только секундомером. Такая арифметика обязана быть под тестом, а не в комментарии.
 */

/** Границы базового интервала между событиями, в миллисекундах. */
export interface EventIntervalRange {
  min: number;
  max: number;
}

/** Событие с необязательным сроком жизни. */
export interface ExpirableEvent {
  expiresAt?: number;
}

/**
 * Через сколько миллисекунд назначить следующее событие.
 *
 * @param roll случайное число [0,1) — передаётся снаружи, чтобы функция была детерминирована
 * @param range базовый разброс интервала
 * @param frequencyMultipliers множители ЧАСТОТЫ (не интервала): 2 — вдвое чаще, 0.5 — вдвое реже
 *
 * Нулевой или отрицательный итоговый множитель означает «частота не определена» — тогда
 * берётся базовый интервал. Делить на ноль здесь нельзя: получилась бы Infinity, и события
 * не наступили бы никогда, причём молча.
 */
export function nextEventDelay(
  roll: number,
  range: EventIntervalRange,
  ...frequencyMultipliers: number[]
): number {
  const safeRoll = Number.isFinite(roll) ? Math.min(1, Math.max(0, roll)) : 0;
  const baseInterval = range.min + safeRoll * (range.max - range.min);

  let frequency = 1;
  for (const m of frequencyMultipliers) {
    if (Number.isFinite(m)) frequency *= m;
  }

  // Частота в знаменателе: выше частота — короче интервал.
  return frequency > 0 ? baseInterval / frequency : baseInterval;
}

/**
 * Убрать события, у которых вышел срок.
 *
 * Возвращает ИСХОДНЫЙ массив, если убирать нечего. Функция вызывается каждый тик, и новый
 * массив на пустом месте будил бы панель событий 20 раз в секунду.
 */
export function dropExpiredEvents<T extends ExpirableEvent>(
  events: readonly T[],
  now: number,
): readonly T[] {
  let hasExpired = false;
  for (const event of events) {
    if (event.expiresAt && now >= event.expiresAt) {
      hasExpired = true;
      break;
    }
  }
  if (!hasExpired) return events;
  return events.filter((event) => !(event.expiresAt && now >= event.expiresAt));
}

/**
 * Типы событий, которые игроку стоит показать как предупреждение, а не как новость.
 * Список явный: «вредность» события не выводится из его полей, а объявляется здесь.
 */
const HARMFUL_EVENT_TYPES = new Set([
  'pirate_raid',
  'power_outage',
  'solar_flare',
  'chain_reaction',
]);

export function eventNotificationType(eventType: string): 'warning' | 'info' {
  return HARMFUL_EVENT_TYPES.has(eventType) ? 'warning' : 'info';
}
