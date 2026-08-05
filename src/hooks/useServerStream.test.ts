/**
 * Фильтр уведомлений о заказах на бирже (bigplan.md, пункты 17, 24).
 *
 * Задание: «когда игрок выставляет заказ на материал, показать всем всплывающее сообщение
 * с предложением проверить и при наличии продать». Ключевое слово — «при наличии»: тост
 * без запаса на складе бесполезен, а на живой бирже заявок много, и без фильтра это была бы
 * стена уведомлений.
 *
 * Фильтрует КЛИЕНТ, а не сервер: инвентарь лежит в сейве игрока, сервер его не знает.
 */

import { describe, expect, it } from 'vitest';
import { shouldNotifyAboutOrder } from './useServerStream';
import type { MarketOrderPayload } from '../utils/serverStream';
import type { ResourceType } from '../core/gameTypes';

function order(overrides: Partial<MarketOrderPayload> = {}): MarketOrderPayload {
  return {
    id: '1',
    playerName: 'Сосед',
    type: 'buy',
    resource: 'steel',
    quantity: '100',
    pricePerUnit: '12',
    createdAt: Date.now(),
    ...overrides,
  };
}

/** Склад: сколько чего есть у игрока. */
const stockOf = (map: Partial<Record<ResourceType, number>>) => (r: ResourceType) => map[r] ?? 0;

describe('shouldNotifyAboutOrder', () => {
  it('показывает тост, когда кто-то покупает ресурс, который есть на складе', () => {
    expect(shouldNotifyAboutOrder(order({ type: 'buy' }), stockOf({ steel: 500 }))).toBe(true);
  });

  it('молчит, если этого ресурса на складе нет', () => {
    expect(shouldNotifyAboutOrder(order({ type: 'buy' }), stockOf({}))).toBe(false);
    expect(shouldNotifyAboutOrder(order({ type: 'buy' }), stockOf({ steel: 0 }))).toBe(false);
  });

  it('молчит на остатке меньше единицы — продавать нечего', () => {
    expect(shouldNotifyAboutOrder(order({ type: 'buy' }), stockOf({ steel: 0.4 }))).toBe(false);
  });

  it('молчит на заявках о ПРОДАЖЕ: там игроку нечего предложить', () => {
    // Задание про «продать при наличии», поэтому интересны только покупатели.
    expect(shouldNotifyAboutOrder(order({ type: 'sell' }), stockOf({ steel: 500 }))).toBe(false);
  });

  it('смотрит именно на тот ресурс, что в заявке', () => {
    const stock = stockOf({ steel: 500 });
    expect(shouldNotifyAboutOrder(order({ resource: 'steel' }), stock)).toBe(true);
    expect(shouldNotifyAboutOrder(order({ resource: 'titanium' }), stock)).toBe(false);
  });

  it('не падает на неизвестном ресурсе и на NaN в остатке', () => {
    expect(shouldNotifyAboutOrder(order({ resource: 'нет_такого' }), stockOf({}))).toBe(false);
    expect(shouldNotifyAboutOrder(order(), () => Number.NaN)).toBe(false);
    expect(shouldNotifyAboutOrder(order(), () => Number.POSITIVE_INFINITY)).toBe(false);
  });
});
