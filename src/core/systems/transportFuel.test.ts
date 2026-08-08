/**
 * Топливо перевозок (bigplan.md, пункт 45).
 *
 * Главное здесь — «всё или ничего» и порядок источников. Частичная оплата означала бы
 * сожжённое топливо без доставленного груза, а порядок «резерв → жидкое топливо → бензин»
 * — единственная причина, по которой на карте без нефти караван вообще может выехать.
 */

import { describe, expect, it } from 'vitest';
import { payTransportFuel, totalTransportFuel, type TransportFuelSources } from './transportFuel';
import { D } from '../math/format';

const sources = (reserve: number, liquidFuel: number, gasoline: number): TransportFuelSources => ({
  reserve: D(reserve),
  liquidFuel: D(liquidFuel),
  gasoline: D(gasoline),
});

describe('топливо перевозок', () => {
  it('складывает все три источника', () => {
    expect(totalTransportFuel(sources(10, 5, 2)).toNumber()).toBe(17);
  });

  it('нулевая стоимость ничего не списывает', () => {
    const before = sources(10, 0, 0);
    const payment = payTransportFuel(before, D(0));
    expect(payment.paid).toBe(true);
    expect(payment.next).toBe(before);
  });

  it('тратит сначала резерв', () => {
    const payment = payTransportFuel(sources(10, 100, 100), D(4));
    expect(payment.paid).toBe(true);
    expect(payment.next.reserve.toNumber()).toBe(6);
    expect(payment.next.liquidFuel.toNumber()).toBe(100);
    expect(payment.next.gasoline.toNumber()).toBe(100);
  });

  it('переливается в жидкое топливо, когда резерв кончился', () => {
    const payment = payTransportFuel(sources(3, 10, 10), D(8));
    expect(payment.paid).toBe(true);
    expect(payment.next.reserve.toNumber()).toBe(0);
    expect(payment.next.liquidFuel.toNumber()).toBe(5);
    expect(payment.next.gasoline.toNumber()).toBe(10);
  });

  it('добирает бензином последним', () => {
    const payment = payTransportFuel(sources(1, 2, 10), D(6));
    expect(payment.paid).toBe(true);
    expect(payment.next.reserve.toNumber()).toBe(0);
    expect(payment.next.liquidFuel.toNumber()).toBe(0);
    expect(payment.next.gasoline.toNumber()).toBe(7);
    expect(payment.spent.gasoline.toNumber()).toBe(3);
  });

  it('не хватило — не списывает НИЧЕГО', () => {
    const before = sources(1, 1, 1);
    const payment = payTransportFuel(before, D(10));
    expect(payment.paid).toBe(false);
    expect(payment.next).toBe(before);
    expect(payment.spent.reserve.toNumber()).toBe(0);
    expect(payment.spent.liquidFuel.toNumber()).toBe(0);
    expect(payment.spent.gasoline.toNumber()).toBe(0);
  });

  it('ровно впритык — платит и обнуляет всё', () => {
    const payment = payTransportFuel(sources(2, 3, 5), D(10));
    expect(payment.paid).toBe(true);
    expect(totalTransportFuel(payment.next).toNumber()).toBe(0);
  });

  it('одного резерва достаточно: карта без нефти не тупик', () => {
    const payment = payTransportFuel(sources(500, 0, 0), D(120));
    expect(payment.paid).toBe(true);
    expect(payment.next.reserve.toNumber()).toBe(380);
  });
});
