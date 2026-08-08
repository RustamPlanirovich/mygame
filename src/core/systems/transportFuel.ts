/**
 * ТОПЛИВО ПЕРЕВОЗОК — одно правило для караванов и авто-транспорта (bigplan.md, пункт 45).
 *
 * ЧТО БЫЛО СЛОМАНО. В игре жили ДВА несовместимых топлива:
 *
 *   1. `galaxies.fuelReserve` — абстрактный резерв, покупается за кредиты (`buyFuel`),
 *      тратился ТОЛЬКО на авто-транспортировку «платформа → база»;
 *   2. ресурсы `liquid_fuel` / `gasoline` со склада базы — тратились ТОЛЬКО караванами
 *      (`sendCaravan`).
 *
 * Второе — тупик, из которого игрок не выбирается в одиночной игре. Жидкое топливо и бензин
 * делаются из НЕФТИ, а нефть добывается только с жилы `oil`. На «Бесплодной Луне» жил всего
 * три (ore, sand, titanium), локальный спот-рынок торгует четырьмя базовыми ресурсами, а
 * глобальная биржа — это другие игроки, которых может не быть. Итог: платформа построена,
 * ресурсы на ней лежат, а увезти их нечем и купить топливо не у кого.
 *
 * КАК СТАЛО. Топливо перевозок ровно одно и складывается из трёх источников; списывается в
 * фиксированном порядке:
 *
 *   резерв → жидкое топливо → бензин
 *
 * Резерв идёт первым осознанно: он куплен именно под перевозки, тогда как жидкое топливо и
 * бензин — производственное сырьё (ракетные заводы, флот), и жечь его молча первым нечестно.
 * Резерв же всегда можно докупить за кредиты — поэтому тупика больше нет ни на одной карте.
 *
 * Модуль чистый: он ничего не знает ни о сторе, ни о том, кто платит — караван или
 * авто-транспорт. Возвращает новый набор остатков, а вызывающий код раскладывает их обратно
 * по своим местам (`galaxies.fuelReserve` и буфер базы).
 */

import type Decimal from 'break_eternity.js';
import { D } from '../math/format';

/** Остатки всех трёх источников топлива. */
export interface TransportFuelSources {
  /** `galaxies.fuelReserve` — покупается за кредиты. */
  reserve: Decimal;
  /** Ресурс `liquid_fuel` на складе главной базы. */
  liquidFuel: Decimal;
  /** Ресурс `gasoline` на складе главной базы. */
  gasoline: Decimal;
}

export interface TransportFuelPayment {
  /** Хватило ли топлива. При `false` остатки возвращаются НЕТРОНУТЫМИ. */
  paid: boolean;
  /** Остатки после списания (или исходные, если не хватило). */
  next: TransportFuelSources;
  /** Сколько списано с каждого источника — нужно, чтобы разложить обратно по состоянию. */
  spent: TransportFuelSources;
}

const ZERO = D(0);

const zeroSources = (): TransportFuelSources => ({
  reserve: ZERO,
  liquidFuel: ZERO,
  gasoline: ZERO,
});

/** Сколько топлива доступно всего. Ровно это число показывает UI. */
export function totalTransportFuel(sources: TransportFuelSources): Decimal {
  return sources.reserve.add(sources.liquidFuel).add(sources.gasoline);
}

/**
 * Списать `cost` топлива в порядке резерв → жидкое топливо → бензин.
 *
 * Всё-или-ничего: частично оплаченная перевозка означала бы сожжённое топливо без
 * доставленного груза, а это ровно тот класс молчаливых потерь, из-за которого в проекте
 * запрещены вложенные `set()`.
 */
export function payTransportFuel(
  sources: TransportFuelSources,
  cost: Decimal,
): TransportFuelPayment {
  if (cost.lte(0)) {
    return { paid: true, next: sources, spent: zeroSources() };
  }

  if (totalTransportFuel(sources).lt(cost)) {
    return { paid: false, next: sources, spent: zeroSources() };
  }

  let remaining = cost;
  const spent = zeroSources();
  const next: TransportFuelSources = { ...sources };

  const take = (key: keyof TransportFuelSources) => {
    if (remaining.lte(0)) return;
    const taken = next[key].min(remaining).max(ZERO);
    if (taken.lte(0)) return;
    next[key] = next[key].sub(taken);
    spent[key] = taken;
    remaining = remaining.sub(taken);
  };

  take('reserve');
  take('liquidFuel');
  take('gasoline');

  return { paid: true, next, spent };
}
