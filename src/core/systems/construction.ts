/**
 * ВРЕМЯ ПОСТРОЙКИ И УЛУЧШЕНИЯ ЗДАНИЙ (bigplan.md, пункты 18–19).
 *
 * Раньше здания ставились и улучшались мгновенно. Здесь — единственный источник правды о том,
 * сколько это должно занимать, и одна очередь задач вместо третьей реализации таймеров
 * (в проекте уже были две: `megastructures.constructionQueue` и `buildTime` у кораблей).
 *
 * ПОЧЕМУ АБСОЛЮТНОЕ ВРЕМЯ, А НЕ НАКОПЛЕНИЕ ПРОГРЕССА
 * Задача хранит `startedAt` + `duration`, а не «сколько процентов набежало». Причина
 * практическая: игровой цикл крутится на requestAnimationFrame, который браузер глушит в
 * неактивной вкладке, а накопитель в тике ещё и обрезается по maxFrameTime. С накоплением
 * стройка замирала бы при сворачивании окна и «теряла» часть времени под нагрузкой.
 * С абсолютным временем стройка достраивается сама — в том числе за оффлайн, при загрузке сейва.
 *
 * ОТ ЧЕГО ЗАВИСИТ ВРЕМЯ
 * У зданий в каталоге нет поля tier, поэтому масштаб берём из того, что есть:
 *   1) суммарный объём baseCost — растёт от T1 к поздним зданиям на 3–4 порядка;
 *   2) число разных ресурсов в стоимости — сложность сборки (T1 — один ресурс, поздние — четыре);
 *   3) кривая обучения: чем больше зданий этого типа уже построено, тем быстрее следующее —
 *      иначе массовая застройка превращается в ожидание.
 * Диапазон осознанно узкий (секунды, не минуты): это idle-игра, а не градострой, и минутные
 * таймеры на каждое здание убивают темп.
 */

import type { Building, ResourceType } from '../gameTypes';

// ============================================================================
// ТИПЫ
// ============================================================================

export type TileJobKind = 'build' | 'upgrade';

/** Отложенная работа на клетке. Одна клетка — максимум одна работа. */
export interface TileJob {
  kind: TileJobKind;
  /** id здания: нужен для подписи в UI и для возврата стоимости при отмене. */
  buildingId: string;
  /** Date.now() на момент старта. */
  startedAt: number;
  /** Длительность в миллисекундах. */
  duration: number;
  /** Только для upgrade: уровень, который будет установлен по завершении. */
  targetLevel?: number;
  /** Что списали при старте — возвращается при отмене. Десятичные строки. */
  paidCost?: Partial<Record<ResourceType, string>>;
  /** Кредиты, списанные при старте (для upgrade). Десятичная строка. */
  paidCredits?: string;
}

export type TileJobs = Record<string, TileJob>;

// ============================================================================
// БАЛАНС
// ============================================================================

export const CONSTRUCTION_BALANCE = {
  /** Постоянная часть: столько занимает даже самое простое здание. */
  BASE_SECONDS: 5,
  /** Вклад объёма стоимости: секунд на каждый порядок величины. */
  SECONDS_PER_COST_DECADE: 3,
  /** Вклад сложности: секунд за каждый дополнительный тип ресурса в стоимости. */
  SECONDS_PER_EXTRA_RESOURCE: 2.5,
  /** Границы времени постройки. */
  MIN_BUILD_SECONDS: 5,
  MAX_BUILD_SECONDS: 60,
  /** Кривая обучения: −1.5% за каждое уже построенное здание этого типа… */
  LEARNING_PER_BUILDING: 0.015,
  /** …но не быстрее чем в два раза. */
  MAX_LEARNING_DISCOUNT: 0.5,
  /** Улучшение дешевле полной постройки. */
  UPGRADE_FACTOR: 0.6,
  /** Каждый следующий уровень чуть дольше предыдущего. */
  UPGRADE_PER_LEVEL: 0.12,
  MIN_UPGRADE_SECONDS: 4,
  MAX_UPGRADE_SECONDS: 120,
} as const;

// ============================================================================
// РАСЧЁТ ДЛИТЕЛЬНОСТИ
// ============================================================================

/**
 * Суммарный объём baseCost в «единицах» и число разных ресурсов.
 * Decimal здесь не нужен: стоимости зданий — обычные числа до ~1e5, а нам важен только порядок.
 */
function costProfile(building: Building): { total: number; distinct: number } {
  let total = 0;
  let distinct = 0;
  for (const amount of Object.values(building.baseCost)) {
    if (!amount) continue;
    const n = amount.toNumber();
    if (!Number.isFinite(n) || n <= 0) continue;
    total += n;
    distinct++;
  }
  if (building.creditCost) {
    // Кредиты не делают сборку сложнее, но объём учитываем — в другом масштабе.
    const c = building.creditCost.toNumber();
    if (Number.isFinite(c) && c > 0) total += c / 10;
  }
  return { total, distinct };
}

/**
 * Множитель кривой обучения по числу УЖЕ построенных зданий этого типа.
 * @param placedCount сколько таких зданий уже стоит (без учёта текущего)
 */
export function learningMultiplier(placedCount: number): number {
  const B = CONSTRUCTION_BALANCE;
  const raw = 1 - B.LEARNING_PER_BUILDING * Math.max(0, placedCount);
  return Math.max(B.MAX_LEARNING_DISCOUNT, raw);
}

/**
 * Сколько секунд строится здание.
 *
 * @param speedMultiplier внешнее ускорение (исследования, политики). 1 = без ускорения,
 *        0.5 = вдвое быстрее. Значения ≤ 0 игнорируются.
 */
export function buildDurationSeconds(
  building: Building,
  placedCount = 0,
  speedMultiplier = 1,
): number {
  const B = CONSTRUCTION_BALANCE;
  const { total, distinct } = costProfile(building);

  const volume = B.SECONDS_PER_COST_DECADE * Math.log10(Math.max(1, total));
  const complexity = B.SECONDS_PER_EXTRA_RESOURCE * Math.max(0, distinct - 1);

  let seconds = (B.BASE_SECONDS + volume + complexity) * learningMultiplier(placedCount);
  if (speedMultiplier > 0) seconds *= speedMultiplier;

  return clampSeconds(seconds, B.MIN_BUILD_SECONDS, B.MAX_BUILD_SECONDS);
}

/**
 * Сколько секунд занимает улучшение с `currentLevel` на `currentLevel + 1`.
 * Кривая обучения к улучшениям не применяется: она про повторяемость постройки.
 */
export function upgradeDurationSeconds(
  building: Building,
  currentLevel: number,
  speedMultiplier = 1,
): number {
  const B = CONSTRUCTION_BALANCE;
  const base = buildDurationSeconds(building, 0, 1);
  const level = Math.max(1, currentLevel);

  let seconds = base * B.UPGRADE_FACTOR * (1 + B.UPGRADE_PER_LEVEL * (level - 1));
  if (speedMultiplier > 0) seconds *= speedMultiplier;

  return clampSeconds(seconds, B.MIN_UPGRADE_SECONDS, B.MAX_UPGRADE_SECONDS);
}

function clampSeconds(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value * 10) / 10));
}

// ============================================================================
// СОСТОЯНИЕ ОЧЕРЕДИ
// ============================================================================

/** Доля выполнения от 0 до 1. */
export function jobProgress(job: TileJob, now: number): number {
  if (job.duration <= 0) return 1;
  const elapsed = now - job.startedAt;
  if (elapsed <= 0) return 0;
  return Math.min(1, elapsed / job.duration);
}

/** Сколько миллисекунд осталось (0, если уже готово). */
export function jobRemainingMs(job: TileJob, now: number): number {
  return Math.max(0, job.startedAt + job.duration - now);
}

export function isJobComplete(job: TileJob, now: number): boolean {
  return now >= job.startedAt + job.duration;
}

/**
 * Ключи клеток, у которых работа завершилась к моменту `now`.
 *
 * Возвращает массив (обычно пустой), а не новый объект: вызывается каждый тик, и лишние
 * аллокации здесь напрямую бьют по FPS.
 */
export function collectCompletedJobs(jobs: TileJobs | undefined, now: number): string[] {
  if (!jobs) return [];
  let done: string[] | null = null;
  for (const key in jobs) {
    if (isJobComplete(jobs[key], now)) {
      if (!done) done = [];
      done.push(key);
    }
  }
  return done ?? [];
}

/** Есть ли хоть одна незавершённая работа. */
export function hasActiveJobs(jobs: TileJobs | undefined): boolean {
  if (!jobs) return false;
  for (const _key in jobs) return true;
  return false;
}

/**
 * Клетки, которые сейчас строятся или улучшаются, — они не должны производить.
 *
 * Возвращает ТОТ ЖЕ объект `tileDisabled`, если работ нет. Это не микрооптимизация:
 * кэш ставок производства в тике инвалидируется по ссылке на tileDisabled
 * (`productionRatesCache.tileDisabledRef !== state.grid.tileDisabled`), и новый объект
 * на каждом тике сбрасывал бы кэш 20 раз в секунду.
 */
export function effectiveDisabledTiles(
  tileDisabled: Record<string, boolean> | undefined,
  jobs: TileJobs | undefined,
): Record<string, boolean> {
  const base = tileDisabled ?? {};
  if (!hasActiveJobs(jobs)) return base;

  const merged: Record<string, boolean> = { ...base };
  for (const key in jobs) merged[key] = true;
  return merged;
}
