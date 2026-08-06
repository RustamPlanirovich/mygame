/**
 * ОФЛАЙН-ДОБЫЧА — сколько база наработала, пока игрока не было в сети.
 *
 * ЗАЧЕМ. Игра идёт только пока открыта вкладка: тик живёт в rAF-цикле
 * (`useOptimizedGameLoop`), и закрытая страница означала полностью остановленную базу.
 * Для idle-игры это худший из возможных сигналов — «уходить нельзя». Теперь отсутствие
 * тоже приносит ресурсы, но с эффективностью ниже 100%, чтобы живая игра оставалась
 * выгоднее офлайна.
 *
 * ПОЧЕМУ СТАВКА, А НЕ ДОГОНЯЮЩИЕ ТИКИ. Прогнать 8 часов настоящими тиками нельзя: это
 * 576 000 шагов, каждый со сканом сетки, логистикой, боем и рынком. Вместо этого берём
 * УЖЕ ПОСЧИТАННУЮ чистую ставку `resources[*].production` (выпуск минус потребление за
 * секунду), которую тик кладёт в состояние и которая уезжает в сейв. Это та же цифра,
 * что игрок видит в панели ресурсов, поэтому начисление сходится с обещанием интерфейса.
 *
 * ЧТО НАМЕРЕННО НЕ ДЕЛАЕТСЯ ОФЛАЙН: бой, стройка, рынок, загрязнение, культура. Ставка
 * берётся замороженной на момент выхода — база офлайн не деградирует и не растёт.
 */

import type Decimal from 'break_eternity.js';
import { D } from '../math/format';
import type { ResourceState, ResourceType } from '../gameTypes';

/** Доля от онлайн-выработки, которая начисляется за время отсутствия. */
export const OFFLINE_EFFICIENCY = 0.75;

/**
 * Потолок зачтённого отсутствия. Без него возвращение через месяц забивало бы все склады
 * до предела одним нажатием и обесценивало бы всю раннюю игру.
 */
export const OFFLINE_MAX_SECONDS = 12 * 60 * 60;

/**
 * Ниже этого порога окно не показывается. Перезагрузка страницы и переход между слотами
 * тоже проходят через загрузку сейва, и модалка «вы заработали 3 единицы руды» на каждый
 * F5 была бы шумом.
 */
export const OFFLINE_MIN_SECONDS = 60;

/**
 * Мусор офлайн не копится. Он не «добыча», а побочный продукт, который игрок разгребает
 * переработкой; начислять его за отсутствие значило бы встречать вернувшегося игрока
 * забитыми складами вместо награды.
 */
const OFFLINE_EXCLUDED: ReadonlySet<string> = new Set(['waste', 'radioactive_waste']);

export interface OfflineMiningGain {
  resource: ResourceType;
  /** Сколько реально начислится — уже с учётом эффективности и свободного места. */
  amount: Decimal;
  /** true — упёрлись в вместимость склада, часть добычи потеряна. */
  capped: boolean;
}

/** Что демон «Ночная смена» сделал за это отсутствие. */
export interface NightShiftReport {
  /** Эффективность, до которой он дотянул (базовая, если оплатить не удалось совсем). */
  efficiency: number;
  /** Сколько ⚡ он забрал из офлайн-выработки. */
  energyFee: Decimal;
  /** Доля оплаченной смены 0..1: 1 — ночь оплачена целиком. */
  paidShare: number;
}

export interface OfflineMiningReport {
  /** Момент, от которого считали (savedAt сейва), мс. */
  since: number;
  /** Сколько игрока реально не было, секунды. */
  elapsedSeconds: number;
  /** Сколько времени зачли — не больше OFFLINE_MAX_SECONDS, секунды. */
  creditedSeconds: number;
  /** Применённая доля от онлайн-выработки (0..1). */
  efficiency: number;
  /** Хотя бы один ресурс уткнулся в потолок склада. */
  anyCapped: boolean;
  /** Начисления, по убыванию количества. Пустого отчёта не бывает — вместо него null. */
  gains: OfflineMiningGain[];
  /** Демон «Ночная смена», если он был включён на момент выхода. */
  nightShift?: NightShiftReport;
}

export interface OfflineMiningInput {
  resources: Record<ResourceType, ResourceState>;
  /** Время записи сейва, мс (savedAt). */
  savedAt: number;
  /** Текущее время, мс. Передаётся снаружи, чтобы функция оставалась чистой. */
  now: number;
  efficiency?: number;
  maxSeconds?: number;
  minSeconds?: number;
  /**
   * Демон «Ночная смена» был включён на момент выхода. Поднимает эффективность до
   * `boostedEfficiency`, но берёт `rentPerSecond` ⚡ за каждую секунду отсутствия.
   */
  nightShift?: {
    rentPerSecond: number;
    boostedEfficiency: number;
  };
}

/**
 * Посчитать офлайн-добычу. Возвращает null, если начислять нечего: слишком короткое
 * отсутствие, битые времена, нулевые ставки или все склады полны.
 *
 * Ограничение по вместимости применяется ЗДЕСЬ, а не только при выдаче: игрок должен
 * видеть в окне ту сумму, которую действительно получит, иначе «+10k руды» превратится
 * в +200 и будет прочитано как потеря прогресса.
 */
export function computeOfflineMining(input: OfflineMiningInput): OfflineMiningReport | null {
  const { resources, savedAt, now } = input;
  const baseEfficiency = input.efficiency ?? OFFLINE_EFFICIENCY;
  const maxSeconds = input.maxSeconds ?? OFFLINE_MAX_SECONDS;
  const minSeconds = input.minSeconds ?? OFFLINE_MIN_SECONDS;

  if (!Number.isFinite(savedAt) || !Number.isFinite(now) || savedAt <= 0) return null;

  // Часы игрока могут отстать от серверных — отрицательное отсутствие это не «долг».
  const elapsedSeconds = Math.floor((now - savedAt) / 1000);
  if (elapsedSeconds < minSeconds) return null;

  const creditedSeconds = Math.min(elapsedSeconds, maxSeconds);
  if (creditedSeconds <= 0 || baseEfficiency <= 0) return null;

  /*
   * ДЕМОН «НОЧНАЯ СМЕНА». Поднимает эффективность отсутствия, но платит за себя энергией —
   * и платит ИЗ ОФЛАЙН-ВЫРАБОТКИ, а не из накопленного за игру запаса.
   *
   * Так сделано намеренно: списание из хранилища встречало бы вернувшегося игрока пустой
   * энергосетью и вставшей базой, то есть демон наказывал бы за то, что им пользуются. А из
   * заработанного за ночь он не может взять больше, чем ночь принесла, — значит смена
   * никогда не оставляет игрока БЕДНЕЕ, чем без неё.
   *
   * Оплата частичная: слабая база (мало чистой ⚡/с) вытягивает не 95%, а сколько сумела —
   * эффективность растёт от базовой пропорционально оплаченной доле. Полный бонус — только
   * там, где энергетика реально с запасом.
   */
  let efficiency = baseEfficiency;
  let nightShift: NightShiftReport | undefined;
  if (input.nightShift && input.nightShift.rentPerSecond > 0) {
    const boosted = Math.max(baseEfficiency, input.nightShift.boostedEfficiency);
    const energyRate = resources.energy?.production;
    /*
     * Заработанное считаем с оглядкой на свободное место в хранилище: выйти из игры с
     * полным энергохранилищем и получить смену бесплатно нельзя — платить будет нечем,
     * потому что энергия за ночь всё равно никуда не поместится.
     */
    const energyRoom = resources.energy ? resources.energy.max.sub(resources.energy.amount) : D(0);
    const earnedAtBase =
      energyRate && energyRate.gt(0) && energyRoom.gt(0)
        ? energyRate.mul(creditedSeconds).mul(baseEfficiency).min(energyRoom)
        : D(0);
    const fullFee = D(input.nightShift.rentPerSecond).mul(creditedSeconds);

    const paidShare =
      fullFee.gt(0) && earnedAtBase.gt(0)
        ? Math.min(1, Math.max(0, earnedAtBase.div(fullFee).toNumber()))
        : 0;

    efficiency = baseEfficiency + (boosted - baseEfficiency) * paidShare;
    nightShift = { efficiency, energyFee: fullFee.mul(paidShare), paidShare };
  }

  const factor = D(creditedSeconds).mul(efficiency);
  const gains: OfflineMiningGain[] = [];
  let anyCapped = false;

  for (const key of Object.keys(resources) as ResourceType[]) {
    if (OFFLINE_EXCLUDED.has(key)) continue;

    const res = resources[key];
    if (!res) continue;

    // Отрицательная чистая ставка (потребление больше выпуска) офлайн не списывается:
    // отсутствие не должно съедать накопленное, иначе выход из игры становится штрафом.
    const rate = res.production;
    if (!rate || rate.lte(0)) continue;

    const room = res.max.sub(res.amount);
    if (room.lte(0)) continue;

    let raw = rate.mul(factor);
    // Аренда «Ночной смены» удерживается прямо из наработанной за ночь энергии (см. выше).
    if (key === 'energy' && nightShift) raw = raw.sub(nightShift.energyFee).max(D(0));
    if (raw.lte(0)) continue;

    const capped = raw.gt(room);
    if (capped) anyCapped = true;

    gains.push({ resource: key, amount: capped ? room : raw, capped });
  }

  if (gains.length === 0) return null;

  gains.sort((a, b) => b.amount.cmp(a.amount));

  return { since: savedAt, elapsedSeconds, creditedSeconds, efficiency, anyCapped, gains, nightShift };
}
