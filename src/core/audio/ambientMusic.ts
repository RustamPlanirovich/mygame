/**
 * ФОНОВАЯ МУЗЫКА (bigplan.md, пункты 15, 35)
 *
 * Задание: «фоновая спокойная музыка без слов».
 *
 * ПОЧЕМУ ГЕНЕРАТИВНАЯ, А НЕ ТРЕК ФАЙЛОМ
 * Аудиоассетов в проекте нет ни одного, и подходящего трека я взять не могу. Синтез решает
 * задачу по существу: без слов он по построению, «спокойный» задаётся выбором интервалов и
 * длительностей, зацикливания не слышно (нет точки склейки), в бандл добавляется ноль байт
 * вместо нескольких мегабайт, и не возникает вопроса лицензии.
 *
 * Если позже появятся настоящие треки, менять нужно только этот файл: наружу торчат ровно
 * `startAmbientMusic` / `stopAmbientMusic`, а громкость идёт через ту же шину.
 *
 * КАК ЭТО ЗВУЧИТ
 * Два слоя. Первый — непрерывный низкий гул из двух расстроенных осцилляторов: он даёт
 * ощущение «пространства» и не привлекает внимания. Второй — редкие мягкие ноты из
 * пентатоники: в пентатонике нет полутоновых столкновений, поэтому любая случайная
 * последовательность звучит консонантно, и музыка не «спотыкается».
 */

import { audioBus } from './AudioBus';

/**
 * Пентатоника от A2 (Гц). Именно она, а не мажор/минор: в пентатонике отсутствуют интервалы,
 * дающие резкие созвучия, поэтому случайный порядок нот всегда остаётся спокойным.
 */
const SCALE_HZ = [110.0, 123.47, 146.83, 164.81, 196.0, 220.0, 246.94, 293.66];

/** Пауза между нотами: большой разброс, чтобы не возникало ритма — ритм тянет внимание. */
const NOTE_GAP_MS = { min: 3200, max: 7000 };

/** Длительность ноты. Долгая атака и спад — иначе получается «пиликанье», а не подушка. */
const NOTE = { attack: 1.1, hold: 1.4, release: 2.6, gain: 0.06 };

/** Громкость непрерывного гула. Заметно тише нот: он должен быть на грани слышимости. */
const DRONE_GAIN = 0.035;

interface RunningMusic {
  droneOscillators: OscillatorNode[];
  droneGain: GainNode;
  timer: ReturnType<typeof setTimeout> | null;
  stopped: boolean;
}

let running: RunningMusic | null = null;

/** Играет ли музыка сейчас. */
export function isAmbientPlaying(): boolean {
  return running !== null && !running.stopped;
}

/**
 * Запустить фоновую музыку. Повторный вызов ничего не делает — обработчик настроек не обязан
 * знать, играет ли она уже.
 */
export async function startAmbientMusic(): Promise<boolean> {
  if (isAmbientPlaying()) return true;
  if (!(await audioBus.resume())) return false;

  const ctx = audioBus.context;
  const destination = audioBus.destinationFor('music');
  if (!ctx || !destination) return false;

  const droneGain = ctx.createGain();
  droneGain.gain.setValueAtTime(0, ctx.currentTime);
  // Медленное появление: резкий старт музыки в игре ощущается как ошибка.
  droneGain.gain.setTargetAtTime(DRONE_GAIN, ctx.currentTime, 2.5);

  /*
   * Фильтр низких частот на гуле: без него пила/треугольник дают верхние гармоники, от которых
   * фон становится «жужжащим» и утомляет через минуту.
   */
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.setValueAtTime(420, ctx.currentTime);
  lowpass.Q.setValueAtTime(0.7, ctx.currentTime);

  droneGain.connect(lowpass);
  lowpass.connect(destination);

  // Две слегка расстроенные волны вместо одной: биения между ними дают живое,
  // медленно «дышащее» звучание, которого не даёт одиночный осциллятор.
  const droneOscillators: OscillatorNode[] = [];
  for (const detune of [-4, 5]) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(SCALE_HZ[0] / 2, ctx.currentTime);
    osc.detune.setValueAtTime(detune, ctx.currentTime);
    osc.connect(droneGain);
    osc.start();
    droneOscillators.push(osc);
  }

  running = { droneOscillators, droneGain, timer: null, stopped: false };
  scheduleNextNote();
  return true;
}

/** Остановить музыку с коротким затуханием. */
export function stopAmbientMusic(): void {
  const current = running;
  if (!current || current.stopped) return;

  current.stopped = true;
  if (current.timer) clearTimeout(current.timer);

  const ctx = audioBus.context;
  if (ctx) {
    // Затухание, а не мгновенный стоп: обрыв волны слышен как щелчок.
    current.droneGain.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
    const stopAt = ctx.currentTime + 2;
    for (const osc of current.droneOscillators) {
      try {
        osc.stop(stopAt);
      } catch {
        /* уже остановлен */
      }
    }
  }

  running = null;
}

function scheduleNextNote(): void {
  const current = running;
  if (!current || current.stopped) return;

  const delay = NOTE_GAP_MS.min + Math.random() * (NOTE_GAP_MS.max - NOTE_GAP_MS.min);
  current.timer = setTimeout(() => {
    playNote();
    scheduleNextNote();
  }, delay);
}

function playNote(): void {
  const ctx = audioBus.context;
  const destination = audioBus.destinationFor('music');
  if (!ctx || !destination || !isAmbientPlaying()) return;

  const freq = SCALE_HZ[Math.floor(Math.random() * SCALE_HZ.length)];
  const t0 = ctx.currentTime;
  const t1 = t0 + NOTE.attack;
  const t2 = t1 + NOTE.hold;
  const t3 = t2 + NOTE.release;

  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, t0);

  const env = ctx.createGain();
  env.gain.setValueAtTime(0, t0);
  env.gain.linearRampToValueAtTime(NOTE.gain, t1);
  env.gain.setValueAtTime(NOTE.gain, t2);
  env.gain.exponentialRampToValueAtTime(0.0001, t3);

  osc.connect(env);
  env.connect(destination);

  osc.start(t0);
  osc.stop(t3 + 0.05);
}

/** Только для тестов: параметры генератора. */
export const __ambientConfig = { SCALE_HZ, NOTE_GAP_MS, NOTE, DRONE_GAIN };
