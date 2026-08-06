/**
 * СОСТОЯНИЕ ОБОРОНЫ БАЗЫ (bigplan 39).
 *
 * Одно место, которое отвечает на вопрос «что сейчас происходит с обороной» — и карта
 * (FactoryGrid), и плашка тревоги (BaseAttackOverlay), и любой будущий индикатор берут ответ
 * отсюда. Раньше такого ответа не было вообще: атака выражалась только в просевшей полосе HP
 * внутри раздела «Оборона», а турели и щиты на сетке ничем не отличались от прочих зданий.
 *
 * Функция чистая: на вход — срез боевого состояния и каталог зданий, на выход — числа и
 * перечисление. Это позволяет проверить тестами именно правила («нет турелей и нет щитов =
 * база беззащитна»), а не то, как они нарисованы.
 *
 * ВАЖНО: базу защищают ровно `turret_mk1` и `shield_mk1` — именно их считает боевой блок тика.
 * `defense_turret_*` и `shield_generator_*` из каталога относятся к орбитальным платформам и
 * в обороне базы не участвуют, поэтому и здесь не учитываются: иначе плашка обещала бы защиту,
 * которой в симуляции нет.
 */

import type Decimal from 'break_eternity.js';

export const BASE_TURRET_ID = 'turret_mk1';
export const BASE_SHIELD_ID = 'shield_mk1';

export type BaseDefenseLevel =
  /** База уничтожена — обороняться уже нечем. */
  | 'offline'
  /** Волны нет: тишина. */
  | 'calm'
  /** Идёт волна, но ни турелей, ни щитов не построено. */
  | 'undefended'
  /** Оборона есть, но не работает: турели без энергии либо щит пробит. */
  | 'strained'
  /** Оборона на месте и работает. */
  | 'defended';

export interface BaseDefenseStatus {
  /** Идёт волна или на карте есть враги. */
  alarm: boolean;
  level: BaseDefenseLevel;
  turretCount: number;
  shieldCount: number;
  /** Врагов на карте прямо сейчас (между спавнами их может не быть даже во время волны). */
  enemies: number;
  /** Турели реально ведут огонь (есть цели и хватило энергии). */
  firing: boolean;
  /** Турели есть, цели есть, а энергии на залп не хватило. */
  turretsStarved: boolean;
  /** Щитовые модули построены, но заряд щита на нуле. */
  shieldDown: boolean;
  /** Заряд щита, 0..1. */
  shieldRatio: number;
  /** HP базы, 0..1. */
  baseRatio: number;
  /** По базе идёт урон прямо сейчас. */
  takingDamage: boolean;
  /** Секунд до конца волны (0, если волны нет). */
  secondsLeft: number;
}

/** Только то, что нужно этой функции: полный CombatState тянуть незачем. */
export interface BaseDefenseCombatInput {
  baseHp: Decimal;
  baseMaxHp: Decimal;
  shieldHp: Decimal;
  shieldMaxHp: Decimal;
  enemies: unknown[];
  waveEndsAt: number;
  defenseFireRatio: Decimal;
  baseDamageTakenPerSecond: Decimal;
}

/** Только то, что нужно этой функции от каталога зданий. */
export interface BaseDefenseBuildingInput {
  id: string;
  count: number;
}

const ratio = (part: Decimal, whole: Decimal): number => {
  if (whole.lte(0)) return 0;
  const v = Number(part.div(whole).toString());
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
};

export function computeBaseDefenseStatus(
  combat: BaseDefenseCombatInput,
  buildings: readonly BaseDefenseBuildingInput[],
  now: number,
  /** Мирные карты (модификатор `peaceful`) волн не получают — тревоги там не бывает. */
  isPeacefulMap = false,
): BaseDefenseStatus {
  const turretCount = buildings.find((b) => b.id === BASE_TURRET_ID)?.count ?? 0;
  const shieldCount = buildings.find((b) => b.id === BASE_SHIELD_ID)?.count ?? 0;

  const enemies = combat.enemies.length;
  const waveActive = combat.waveEndsAt > now;
  const baseAlive = combat.baseHp.gt(0);

  // Тревога держится всю волну, а не только пока на карте есть враги: между спавнами карта
  // пустеет на секунды, и мигающая от этого плашка читалась бы как «всё кончилось».
  const alarm = baseAlive && !isPeacefulMap && (enemies > 0 || waveActive);

  const fireRatio = Math.max(0, Math.min(1, Number(combat.defenseFireRatio.toString())));
  const firing = alarm && turretCount > 0 && enemies > 0 && fireRatio > 0;
  const turretsStarved = alarm && turretCount > 0 && enemies > 0 && fireRatio <= 0;

  const shieldRatio = ratio(combat.shieldHp, combat.shieldMaxHp);
  const shieldDown = alarm && shieldCount > 0 && shieldRatio <= 0;

  let level: BaseDefenseLevel;
  if (!baseAlive) level = 'offline';
  else if (!alarm) level = 'calm';
  else if (turretCount === 0 && shieldCount === 0) level = 'undefended';
  else if (turretsStarved || shieldDown) level = 'strained';
  else level = 'defended';

  return {
    alarm,
    level,
    turretCount,
    shieldCount,
    enemies,
    firing,
    turretsStarved,
    shieldDown,
    shieldRatio,
    baseRatio: ratio(combat.baseHp, combat.baseMaxHp),
    takingDamage: combat.baseDamageTakenPerSecond.gt(0),
    secondsLeft: waveActive && !isPeacefulMap ? Math.ceil((combat.waveEndsAt - now) / 1000) : 0,
  };
}
