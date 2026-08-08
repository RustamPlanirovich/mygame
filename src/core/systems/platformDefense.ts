/**
 * ОБОРОНА ОРБИТАЛЬНОЙ ПЛАТФОРМЫ (bigplan.md, пункт 46).
 *
 * ЧТО БЫЛО СЛОМАНО. Оборона базы и оборона платформы были склеены не тем концом.
 *
 *   • Бой базы считал турели и щиты по СЧЁТЧИКУ КАТАЛОГА (`state.buildings[].count`), а этот
 *     счётчик растёт и когда здание ставят на платформу: турель, стоящая на орбите в другой
 *     галактике, стреляла по волне у главной базы и тратила её энергию. Платформа при этом
 *     оставалась в космосе без единого ствола.
 *   • Оборона самой платформы жила в `platform.combat.turretCount`, который заполняло
 *     действие `updatePlatformDefenses` — а его никто никогда не вызывал. Считало оно
 *     `platform.buildings`, куда постройка на платформе тоже ничего не пишет. То есть
 *     `turretCount` был вечным нулём: «Защитная Турель» на платформе не стреляла никогда,
 *     а панель платформ честно показывала «Турели: 0» рядом с построенными турелями.
 *
 * КАК СТАЛО. Считаем от СЕТКИ, а не от глобального счётчика: обороняет только то, что
 * реально стоит на этой платформе. Ровно тем же способом теперь считается и оборона базы
 * (`baseDefenseStatus.countBaseDefense`) — одно правило на обе стороны.
 *
 * ХАРАКТЕРИСТИКИ БЕРУТСЯ ИЗ КАТАЛОГА (`combat.dps`, `defense.shieldRegenPerSecond`), а не из
 * магических чисел в тике: там стояло «10 DPS за турель», из-за чего Mk.II приходилось
 * подпирать костылём «считается за две». Каталог уже описывает 25 и 60 DPS — этому и верим.
 *
 * УРОВЕНЬ КЛЕТКИ НА БОЙ НЕ ВЛИЯЕТ: на базе турель тоже стреляет паспортным DPS независимо от
 * уровня. Одно правило на две сетки дороже, чем лишний множитель.
 */

import type Decimal from 'break_eternity.js';
import { D } from '../math/format';
import type { Building } from '../gameTypes';

/** Турели платформы. Обычная `turret_mk1` — здание БАЗЫ, платформу оно не защищает. */
export const PLATFORM_TURRET_IDS = ['defense_turret_mk1', 'defense_turret_mk2'] as const;
export const PLATFORM_SHIELD_IDS = ['shield_generator_mk1', 'shield_generator_mk2'] as const;
export const PLATFORM_RADAR_IDS = ['radar_station_mk1'] as const;

/**
 * Щит платформы восстанавливается и без генераторов — так было до вынесения правил сюда,
 * и снимать этот запас «заодно» значит менять баланс молча.
 */
export const PLATFORM_BASE_SHIELD_REGEN = 5;

/** Радар расширяет зону турелей. Число историческое: до этого им же кормилась панель. */
export const PLATFORM_RADAR_RANGE = 2;

/**
 * Броня гасит 50% урона, но списывается со своего запаса (см. боевой блок тика). Значит по
 * корпусу броня «стоит» вдвое больше очков, чем в ней написано.
 */
export const PLATFORM_ARMOR_ABSORB = 0.5;

/** Урон врага, у которого в сейве не оказалось dps, — тот же дефолт, что и в тике. */
const ENEMY_FALLBACK_DPS = 10;

export interface PlatformDefenseInput {
  /** Клетки платформы: `"x,y"` → id здания. */
  tiles: Record<string, string>;
  /** Идущие работы: строящаяся турель не стреляет — как и на базе. */
  tileJobs?: Record<string, unknown>;
  /** Выключенные вручную клетки. */
  tileDisabled?: Record<string, boolean>;
  /** Каталог зданий по id (общий для базы и платформ). */
  buildingsById: Map<string, Building>;
}

export interface PlatformDefenseLoadout {
  /** Сколько турелей реально стоит на платформе (Mk.I и Mk.II — каждая по одной). */
  turretCount: number;
  /** Суммарный DPS турелей платформы. */
  turretDps: Decimal;
  radarCount: number;
  /** Множитель дальности турелей: 1 без радара. */
  radarRange: number;
  shieldCount: number;
  /** Регенерация щита в секунду: базовые 5 + вклад генераторов. */
  shieldRegenPerSecond: Decimal;
}

const ZERO = D(0);

export function emptyPlatformDefense(): PlatformDefenseLoadout {
  return {
    turretCount: 0,
    turretDps: ZERO,
    radarCount: 0,
    radarRange: 1,
    shieldCount: 0,
    shieldRegenPerSecond: D(PLATFORM_BASE_SHIELD_REGEN),
  };
}

const isTurret = (id: string) => (PLATFORM_TURRET_IDS as readonly string[]).includes(id);
const isShield = (id: string) => (PLATFORM_SHIELD_IDS as readonly string[]).includes(id);
const isRadar = (id: string) => (PLATFORM_RADAR_IDS as readonly string[]).includes(id);

/** Что из построенного на платформе реально участвует в бою. */
export function computePlatformDefense(input: PlatformDefenseInput): PlatformDefenseLoadout {
  const { tiles, tileJobs, tileDisabled, buildingsById } = input;
  const out = emptyPlatformDefense();

  for (const key in tiles) {
    const id = tiles[key];
    // Недостроенная и выключенная турель в бою не участвует: подсветка на сетке обещает
    // ровно это, и расхождение между картинкой и симуляцией дороже пары стволов.
    if (tileJobs?.[key]) continue;
    if (tileDisabled?.[key]) continue;

    if (isTurret(id)) {
      out.turretCount++;
      const dps = buildingsById.get(id)?.combat?.dps;
      if (dps) out.turretDps = out.turretDps.add(dps);
      continue;
    }

    if (isShield(id)) {
      out.shieldCount++;
      const regen = buildingsById.get(id)?.defense?.shieldRegenPerSecond;
      if (regen) out.shieldRegenPerSecond = out.shieldRegenPerSecond.add(regen);
      continue;
    }

    if (isRadar(id)) {
      out.radarCount++;
      out.radarRange = PLATFORM_RADAR_RANGE;
    }
  }

  return out;
}

/**
 * Суммарный урон обороны платформы в секунду.
 *
 * ТУРЕЛИ ЖИВУТ НА ЭНЕРГИИ ПЛАТФОРМЫ, КОРАБЛИ — НЕТ. Расход турелей и щитов в энергобалансе
 * платформы уже учитывается (`computeEnergyBalance(waveActive)`), но до сих пор ни на что не
 * влиял: турель без единого ватта стреляла бы в полную силу. На базе правило ровно обратное —
 * «нет энергии, турели молчат», и расхождение между двумя сетками игроку объяснить нечем.
 * Приписанный флот от платформенной энергосети не зависит: у кораблей свои реакторы.
 */
export function platformDefenseDps(
  loadout: PlatformDefenseLoadout,
  energyEfficiency: number,
  shipDps: Decimal = ZERO,
): Decimal {
  const ratio = Number.isFinite(energyEfficiency) ? Math.max(0, Math.min(1, energyEfficiency)) : 0;
  return loadout.turretDps.mul(ratio).add(shipDps);
}

/** Насколько всё плохо у платформы прямо сейчас. */
export type PlatformThreatLevel =
  /** Корпус на нуле — платформа уничтожена. */
  | 'destroyed'
  /** Врагов нет. */
  | 'calm'
  /** Враги есть, а стрелять нечем: платформа умрёт наверняка. */
  | 'undefended'
  /** Оборона стреляет, но не успевает: платформа теряет корпус быстрее, чем чистит волну. */
  | 'losing'
  /** Оборона успевает добить волну раньше, чем платформа развалится. */
  | 'holding';

export interface PlatformThreatInput {
  hp: Decimal;
  maxHp: Decimal;
  armor: Decimal;
  shieldHp: Decimal;
  /** Враги у платформы: нужны только запас HP и урон. */
  enemies: readonly { hp: Decimal; dps?: Decimal }[];
  /** Суммарный DPS обороны: турели платформы + приписанные корабли. */
  defenseDps: Decimal;
  /** Когда придёт следующая волна (timestamp). */
  nextWaveAt?: number;
  now: number;
}

export interface PlatformThreat {
  level: PlatformThreatLevel;
  underAttack: boolean;
  enemies: number;
  /** Урон врагов в секунду. */
  incomingDps: Decimal;
  defenseDps: Decimal;
  /** Сколько урона платформа выдержит: щит + броня×2 + корпус. */
  effectiveHp: Decimal;
  /** Корпус, 0..1. */
  hullRatio: number;
  /**
   * Секунд до разрушения при ТЕКУЩЕМ уроне; null — если урона нет.
   *
   * Оценка сознательно пессимистичная: враги, которых добивает оборона, перестают стрелять,
   * поэтому реально платформа проживёт дольше. Занижать срок безопаснее, чем завышать: игрок
   * должен успеть прислать флот, а не узнать, что «на самом деле было меньше».
   */
  secondsToDestruction: number | null;
  /** Секунд до зачистки волны обороной; null — если оборона не стреляет. */
  secondsToClear: number | null;
  /** Секунд до следующей волны; 0 — если волна уже идёт или срок неизвестен. */
  secondsToNextWave: number;
}

const toSeconds = (amount: Decimal, perSecond: Decimal): number | null => {
  if (perSecond.lte(0)) return null;
  const v = Number(amount.div(perSecond).toString());
  if (!Number.isFinite(v)) return null;
  return Math.max(0, v);
};

export function computePlatformThreat(input: PlatformThreatInput): PlatformThreat {
  const { hp, maxHp, armor, shieldHp, enemies, defenseDps, nextWaveAt, now } = input;

  // Мёртвых врагов тик не считает ни в уроне, ни в целях — здесь то же самое.
  const alive = enemies.filter((e) => e.hp.gt(0));

  let incomingDps = ZERO;
  let enemyHp = ZERO;
  for (const e of alive) {
    incomingDps = incomingDps.add(e.dps ?? D(ENEMY_FALLBACK_DPS));
    enemyHp = enemyHp.add(e.hp);
  }

  const effectiveHp = shieldHp
    .max(ZERO)
    .add(armor.max(ZERO).div(PLATFORM_ARMOR_ABSORB))
    .add(hp.max(ZERO));

  const secondsToDestruction = toSeconds(effectiveHp, incomingDps);
  const secondsToClear = toSeconds(enemyHp, defenseDps);

  const hullRatio = maxHp.gt(0)
    ? Math.max(0, Math.min(1, Number(hp.div(maxHp).toString()) || 0))
    : 0;

  const holds =
    secondsToClear !== null &&
    (secondsToDestruction === null || secondsToClear < secondsToDestruction);

  let level: PlatformThreatLevel;
  if (hp.lte(0)) level = 'destroyed';
  else if (alive.length === 0 || incomingDps.lte(0)) level = 'calm';
  else if (defenseDps.lte(0)) level = 'undefended';
  else if (holds) level = 'holding';
  else level = 'losing';

  return {
    level,
    underAttack: alive.length > 0 && hp.gt(0),
    enemies: alive.length,
    incomingDps,
    defenseDps,
    effectiveHp,
    hullRatio,
    secondsToDestruction,
    secondsToClear,
    secondsToNextWave:
      alive.length === 0 && nextWaveAt && nextWaveAt > now
        ? Math.ceil((nextWaveAt - now) / 1000)
        : 0,
  };
}
