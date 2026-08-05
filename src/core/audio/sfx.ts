/**
 * ЗВУКИ ИНТЕРФЕЙСА (bigplan.md, пункты 16, 35)
 *
 * Синтез, а не файлы: ассетов в проекте нет, а короткий клик синтезируется тремя узлами и
 * весит ноль байт. Для щелчка по клетке это ещё и точнее — можно менять высоту тона под
 * событие (постройка выше, снос ниже, ошибка диссонансом), не заводя пять файлов.
 *
 * ПОЧЕМУ БЕЗ ПУЛА ОБЪЕКТОВ
 * Пул нужен был бы для `new Audio()`, где каждый экземпляр — тяжёлый элемент. Узлы Web Audio
 * одноразовые и дешёвые: браузер сам освобождает их после `stop()`. Вместо пула здесь стоит
 * защита от спама — минимальный интервал между одинаковыми звуками.
 */

import { audioBus } from './AudioBus';

export type SfxName = 'click' | 'place' | 'remove' | 'error' | 'complete';

/**
 * Параметры каждого звука. Частоты подобраны так, чтобы события различались на слух, но
 * оставались в мягком диапазоне: игрок слышит их сотни раз за сессию.
 */
const SFX: Record<SfxName, { freq: number; endFreq: number; duration: number; type: OscillatorType; gain: number }> = {
  // Нейтральный короткий щелчок по клетке.
  click: { freq: 660, endFreq: 620, duration: 0.05, type: 'triangle', gain: 0.14 },
  // Постройка: восходящий тон — «получилось».
  place: { freq: 520, endFreq: 780, duration: 0.11, type: 'triangle', gain: 0.18 },
  // Снос: нисходящий.
  remove: { freq: 420, endFreq: 260, duration: 0.13, type: 'sine', gain: 0.16 },
  // Ошибка: низкий короткий, без «музыкальности».
  error: { freq: 200, endFreq: 150, duration: 0.16, type: 'sawtooth', gain: 0.1 },
  // Завершение работы (стройка, улучшение).
  complete: { freq: 700, endFreq: 1050, duration: 0.16, type: 'sine', gain: 0.16 },
};

/**
 * Минимальный интервал между повторами ОДНОГО звука.
 * Массовые действия (снос выделения, серия кликов) иначе дали бы неприятный треск.
 */
const MIN_REPEAT_MS = 45;

const lastPlayedAt = new Map<SfxName, number>();

/**
 * Проиграть звук интерфейса.
 *
 * Безопасен к вызову до первого жеста пользователя: пока контекст не разблокирован, звук просто
 * не играется и ничего не ломается (см. AudioBus.bindUnlock).
 */
export function playSfx(name: SfxName): void {
  const now = Date.now();
  const last = lastPlayedAt.get(name) ?? 0;
  if (now - last < MIN_REPEAT_MS) return;
  lastPlayedAt.set(name, now);

  // Не await: звук интерфейса не должен задерживать обработчик клика.
  void emit(name);
}

async function emit(name: SfxName): Promise<void> {
  if (!(await audioBus.resume())) return;

  const ctx = audioBus.context;
  const destination = audioBus.destinationFor('sfx');
  if (!ctx || !destination) return;

  const config = SFX[name];
  const t0 = ctx.currentTime;
  const t1 = t0 + config.duration;

  const osc = ctx.createOscillator();
  osc.type = config.type;
  osc.frequency.setValueAtTime(config.freq, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, config.endFreq), t1);

  /*
   * Огибающая обязательна: тон, включённый и выключенный «в лоб», даёт щелчок на разрыве
   * волны — он громче самого звука. Атака 5 мс, дальше экспоненциальный спад в почти нуль
   * (в ровный нуль exponentialRamp не умеет).
   */
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, t0);
  env.gain.linearRampToValueAtTime(config.gain, t0 + 0.005);
  env.gain.exponentialRampToValueAtTime(0.0001, t1);

  osc.connect(env);
  env.connect(destination);

  osc.start(t0);
  osc.stop(t1 + 0.02);
}

/** Сбросить антиспам-таймеры (нужно тестам). */
export function resetSfxThrottle(): void {
  lastPlayedAt.clear();
}

/** Только для тестов: конфигурация звуков. */
export const __sfxConfig = SFX;
export const __minRepeatMs = MIN_REPEAT_MS;
