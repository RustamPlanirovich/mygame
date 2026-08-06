/**
 * Очередь плашек «кто-то покупает ваш материал» (bigplan.md, пункт 17).
 *
 * Проверяем ровно то, из-за чего плашки превратились бы в помеху: дубли одной заявки
 * (поток переподключился, открыты две вкладки) и неограниченный рост стопки поверх карты.
 */

import { describe, expect, it } from 'vitest';
import { enqueueAlert, MAX_VISIBLE_ALERTS, type MarketOfferAlert } from './marketAlertStore';

function alert(id: string, overrides: Partial<MarketOfferAlert> = {}): MarketOfferAlert {
  return {
    id,
    playerName: 'Сосед',
    resource: 'steel',
    quantity: '100',
    pricePerUnit: '12',
    stock: 500,
    shownAt: 1_000,
    ...overrides,
  };
}

describe('enqueueAlert', () => {
  it('добавляет новую плашку в конец', () => {
    const list = enqueueAlert(enqueueAlert([], alert('a')), alert('b'));
    expect(list.map((a) => a.id)).toEqual(['a', 'b']);
  });

  it('не плодит дубли одной и той же заявки', () => {
    const list = enqueueAlert(enqueueAlert([], alert('a')), alert('a'));
    expect(list).toHaveLength(1);
  });

  it('обновляет данные повторной заявки, но оставляет её на месте', () => {
    const start = enqueueAlert(enqueueAlert([], alert('a')), alert('b'));
    // По ордеру 'a' часть уже разобрали — остаток пришёл меньше.
    const list = enqueueAlert(start, alert('a', { quantity: '40', shownAt: 9_000 }));

    expect(list.map((x) => x.id)).toEqual(['a', 'b']);
    expect(list[0].quantity).toBe('40');
    // Время показа сохраняем от первой плашки: иначе автозакрытие откладывалось бы бесконечно.
    expect(list[0].shownAt).toBe(1_000);
  });

  it('держит не больше MAX_VISIBLE_ALERTS, вытесняя самые старые', () => {
    const list = ['a', 'b', 'c', 'd', 'e'].reduce(
      (acc, id) => enqueueAlert(acc, alert(id)),
      [] as MarketOfferAlert[],
    );

    expect(list).toHaveLength(MAX_VISIBLE_ALERTS);
    expect(list.map((x) => x.id)).toEqual(['c', 'd', 'e']);
  });

  it('не мутирует исходный список', () => {
    const start = [alert('a')];
    enqueueAlert(start, alert('b'));
    expect(start.map((x) => x.id)).toEqual(['a']);
  });
});
