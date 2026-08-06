/**
 * Остаток по заявке в уведомлении о новом ордере (bigplan.md, пункт 17).
 *
 * Плашка «кто-то покупает ваш материал» показывает цифру, по которой игрок решает, идти ли
 * на биржу. Показывать исходный объём нельзя: часть заявки может уйти встречным ордерам
 * прямо при постановке, и обещание «покупает 100» по заявке со свободными 10 — вранье.
 *
 * Считаем в bigint-юнитах: объёмы доходят до 1e18, и Number потерял бы точность ровно там,
 * где игрок сверяет цифру с книгой ордеров.
 */

import { describe, expect, it } from 'vitest';
import { remainingQuantityText } from './market.js';

describe('remainingQuantityText', () => {
  it('вычитает исполненное из объёма заявки', () => {
    expect(remainingQuantityText('100', '30')).toBe('70');
  });

  it('нетронутая заявка отдаёт весь объём', () => {
    expect(remainingQuantityText('100', '0')).toBe('100');
  });

  it('держит дробную часть без потери знаков', () => {
    expect(remainingQuantityText('10.5', '0.25')).toBe('10.25');
  });

  it('не теряет точность на объёмах, которые не помещаются в double', () => {
    // 2^53 + 1: Number округлил бы до 9007199254740992 и вернул 1 вместо 2.
    expect(remainingQuantityText('9007199254740993', '9007199254740991')).toBe('2');
  });

  it('никогда не уходит в минус: полностью исполненная заявка — это 0', () => {
    expect(remainingQuantityText('100', '100')).toBe('0');
    expect(remainingQuantityText('100', '150')).toBe('0');
  });

  it('на отсутствующем quantity_filled считает заявку неисполненной', () => {
    expect(remainingQuantityText('100', null)).toBe('100');
    expect(remainingQuantityText('100', undefined)).toBe('100');
  });

  it('на неразборчивом вводе возвращает исходный объём, а не падает', () => {
    // Постановка ордера уже закоммичена — ронять её из-за уведомления нельзя.
    expect(remainingQuantityText('100', 'abc')).toBe('100');
    expect(remainingQuantityText(undefined, '10')).toBe(undefined);
  });
});
