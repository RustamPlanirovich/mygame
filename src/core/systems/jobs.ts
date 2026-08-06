/**
 * ЕДИНЫЙ ДВИЖОК ОТЛОЖЕННЫХ ЗАДАЧ (bigplan.md, пункт 25)
 *
 * В проекте было ТРИ разных представления «это будет готово через N секунд»:
 *   1. `grid.tileJobs` — постройка и улучшение зданий: `startedAt` + `duration`;
 *   2. `megastructures.constructionQueue` — накопитель `progress += 100/buildTime * dt`;
 *   3. `SHIP_DEFINITIONS[*].buildTime` — поле в каталоге, которое НИКТО не читал:
 *      корабли появлялись мгновенно.
 * Три представления означали три набора багов: правило «достраивается за оффлайн»
 * работало только у первого, «не тикает в свёрнутой вкладке» — только у второго,
 * а третье просто не существовало.
 *
 * ПОЧЕМУ АБСОЛЮТНОЕ ВРЕМЯ, А НЕ НАКОПЛЕНИЕ ПРОГРЕССА
 * Задача хранит `startedAt` + `duration`. Накопитель (`progress += rate * dt`) выглядит
 * проще, но у него два дефекта, и оба ловятся не сразу:
 *   - игровой цикл крутится на requestAnimationFrame, который браузер глушит в неактивной
 *     вкладке: свёрнутое окно замораживает стройку;
 *   - dt в тике обрезается по maxFrameTime, поэтому под нагрузкой время ТЕРЯЕТСЯ
 *     безвозвратно — стройка идёт медленнее, чем обещано в интерфейсе.
 * С абсолютным временем оффлайн работает сам: всё, что успело достроиться, закрывается
 * первым же тиком после загрузки, и отдельной оффлайн-логики не нужно.
 *
 * ПАУЗА — это сдвиг `startedAt` на длительность простоя, а не отдельный накопитель:
 * инвариант «готово в момент startedAt + duration» должен выполняться всегда, иначе
 * оффлайн-достройка снова разъедется с показанным временем.
 */

export type JobKind = 'build' | 'upgrade' | 'ship' | 'megastructure';

/** Отложенная работа: одна запись — одно «будет готово в такой-то момент». */
export interface Job {
  /** Уникален в пределах своей очереди. */
  id: string;
  kind: JobKind;
  /** Что именно делается: id здания, тип корабля, id мегаструктуры. */
  target: string;
  /** Date.now() на момент старта (или момент последнего снятия с паузы). */
  startedAt: number;
  /** Длительность в миллисекундах. */
  duration: number;
  /** Момент постановки на паузу; пока стоит — работа не идёт. */
  pausedAt?: number;
}

/**
 * Минимум, нужный движку: когда началось, сколько длится, не на паузе ли.
 *
 * Функции ниже принимают именно это, а не полный Job: очередь мегаструктур адресуется
 * своим id и заводить ей синтетические `id`/`kind`/`target` только ради общих формул
 * значило бы городить переходник вокруг того, что и так совпадает.
 */
export interface Timed {
  startedAt: number;
  duration: number;
  pausedAt?: number;
}

/** Момент завершения. Единственное место, где это считается. */
export function jobEndsAt(job: Timed): number {
  return job.startedAt + job.duration;
}

/** Доля выполнения от 0 до 1. */
export function progressOf(job: Timed, now: number): number {
  if (job.duration <= 0) return 1;
  const at = job.pausedAt ?? now;
  const elapsed = at - job.startedAt;
  if (elapsed <= 0) return 0;
  return Math.min(1, elapsed / job.duration);
}

/** Сколько миллисекунд осталось (0, если уже готово). */
export function remainingMs(job: Timed, now: number): number {
  const at = job.pausedAt ?? now;
  return Math.max(0, jobEndsAt(job) - at);
}

export function isComplete(job: Timed, now: number): boolean {
  // Работа на паузе не завершается сама — иначе пауза не пауза.
  if (job.pausedAt !== undefined) return false;
  return now >= jobEndsAt(job);
}

/**
 * Поставить на паузу. Момент фиксируется, чтобы простой не засчитался в работу.
 * Повторный вызов ничего не меняет.
 */
export function pauseJob(job: Job, now: number): Job {
  if (job.pausedAt !== undefined) return job;
  return { ...job, pausedAt: now };
}

/**
 * Снять с паузы: `startedAt` сдвигается на длительность простоя, поэтому остаток
 * времени ровно тот, что был на момент паузы.
 */
export function resumeJob(job: Job, now: number): Job {
  if (job.pausedAt === undefined) return job;
  const paused = Math.max(0, now - job.pausedAt);
  const { pausedAt: _dropped, ...rest } = job;
  return { ...rest, startedAt: job.startedAt + paused };
}

/**
 * Разделить очередь на завершённые и оставшиеся.
 *
 * Возвращает ИСХОДНЫЙ массив в `pending`, если ничего не завершилось. Это не
 * микрооптимизация: обработчик вызывается 20 раз в секунду, и новый массив каждый раз
 * ломал бы `===`-мемоизацию у всех подписчиков очереди.
 */
export function splitCompleted<T extends Timed>(
  jobs: readonly T[] | undefined,
  now: number,
): { done: T[]; pending: readonly T[] } {
  if (!jobs || jobs.length === 0) return { done: [], pending: jobs ?? [] };

  let done: T[] | null = null;
  for (const job of jobs) {
    if (isComplete(job, now)) {
      if (!done) done = [];
      done.push(job);
    }
  }
  if (!done) return { done: [], pending: jobs };

  return { done, pending: jobs.filter((job) => !isComplete(job, now)) };
}

/** Создать работу. `durationMs` ниже нуля обнуляется: мгновенная готовность лучше вечной. */
export function createJob(params: {
  id: string;
  kind: JobKind;
  target: string;
  durationMs: number;
  now: number;
}): Job {
  return {
    id: params.id,
    kind: params.kind,
    target: params.target,
    startedAt: params.now,
    duration: Math.max(0, params.durationMs),
  };
}

/**
 * Человекочитаемый остаток: «12с», «1м 05с», «2ч 03м».
 * Один формат на все очереди — иначе в каждой панели он свой.
 */
export function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  if (total < 60) return `${total}с`;

  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  if (minutes < 60) return `${minutes}м ${String(seconds).padStart(2, '0')}с`;

  const hours = Math.floor(minutes / 60);
  return `${hours}ч ${String(minutes % 60).padStart(2, '0')}м`;
}
