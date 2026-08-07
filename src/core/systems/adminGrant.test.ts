/**
 * Разбор админской выдачи (bigplan.md, пункт 9).
 *
 * Формат приходит с сервера плоским словарём `{'currency.credits': '500'}` — это единственное
 * место, где он превращается в применимое, поэтому проверяется именно он.
 */

import { describe, expect, it } from 'vitest';
import {
  describeGrant,
  isEmptyGrant,
  parseGrantDeltas,
  selectAckableGrants,
  selectGrantsForSlot,
} from './adminGrant';

describe('parseGrantDeltas', () => {
  it('разбирает валюты и ресурсы', () => {
    const parsed = parseGrantDeltas({
      'currency.credits': '500',
      'currency.researchPoints': '20',
      'resources.ore': '100',
      'resources.steel': '5',
    });

    expect(parsed.currency).toEqual({ credits: '500', researchPoints: '20' });
    expect(parsed.resources).toEqual({ ore: '100', steel: '5' });
    expect(parsed.unknown).toEqual([]);
  });

  it('принимает отрицательные дельты — админ может и отнять', () => {
    const parsed = parseGrantDeltas({ 'currency.credits': '-500' });
    expect(parsed.currency.credits).toBe('-500');
  });

  it('незнакомое поле валюты не применяет, а помечает', () => {
    // Иначе опечатка на сервере молча ничего не начислила бы, и расхождение нашлось бы поздно.
    const parsed = parseGrantDeltas({ 'currency.quantum': '10' });
    expect(parsed.currency).toEqual({});
    expect(parsed.unknown).toEqual(['currency.quantum']);
  });

  it('незнакомую область помечает', () => {
    const parsed = parseGrantDeltas({ 'buildings.miner_mk1': '1', 'ore': '5' });
    expect(parsed.unknown.sort()).toEqual(['buildings.miner_mk1', 'ore']);
  });

  it('не падает на мусоре', () => {
    expect(parseGrantDeltas(null).unknown).toEqual([]);
    expect(parseGrantDeltas(undefined).currency).toEqual({});
    expect(parseGrantDeltas({} as never).resources).toEqual({});
    expect(parseGrantDeltas({ 'currency.credits': '' } as never).unknown).toEqual([
      'currency.credits',
    ]);
    expect(parseGrantDeltas({ 'currency.credits': 5 } as never).unknown).toEqual([
      'currency.credits',
    ]);
  });

  it('ресурс с точкой в имени не ломает разбор', () => {
    // Разделяем по ПЕРВОЙ точке, поэтому область определяется однозначно.
    const parsed = parseGrantDeltas({ 'resources.dark_matter': '3' });
    expect(parsed.resources).toEqual({ dark_matter: '3' });
  });
});

describe('isEmptyGrant', () => {
  it('различает пустую и непустую выдачу', () => {
    expect(isEmptyGrant(parseGrantDeltas({}))).toBe(true);
    expect(isEmptyGrant(parseGrantDeltas({ 'buildings.x': '1' }))).toBe(true);
    expect(isEmptyGrant(parseGrantDeltas({ 'currency.credits': '1' }))).toBe(false);
    expect(isEmptyGrant(parseGrantDeltas({ 'resources.ore': '1' }))).toBe(false);
  });
});

describe('describeGrant', () => {
  it('перечисляет, что именно начислено — игрок должен это видеть', () => {
    const parsed = parseGrantDeltas({ 'currency.credits': '500', 'resources.ore': '100' });
    const text = describeGrant(parsed, (id) => (id === 'ore' ? 'Руда' : id));
    expect(text).toContain('кредиты: 500');
    expect(text).toContain('Руда: 100');
  });

  it('на пустой выдаче даёт пустую строку', () => {
    expect(describeGrant(parseGrantDeltas({}), (id) => id)).toBe('');
  });
});

/**
 * ОЧЕРЕДЬ ВЫДАЧ (server/admin.js, player_grants).
 *
 * Оба правила ниже защищают от вещей, которые уже ломались вживую: начисление, применённое не
 * в ту партию, и начисление, подтверждённое раньше записи в сейв (после перезагрузки его нет
 * ни в сохранении, ни в очереди — оно просто исчезает).
 */
describe('selectGrantsForSlot', () => {
  const grants = [
    { grantId: '1', slotId: 7 },
    { grantId: '2', slotId: null },
    { grantId: '3', slotId: 9 },
  ];

  it('берёт выдачи текущего слота и «безслотовые»', () => {
    expect(selectGrantsForSlot(grants, 7).map((g) => g.grantId)).toEqual(['1', '2']);
  });

  it('чужой слот не трогает — иначе ресурсы уедут не в ту партию', () => {
    expect(selectGrantsForSlot(grants, 9).map((g) => g.grantId)).toEqual(['2', '3']);
  });

  it('без текущего слота применимы только «безслотовые»', () => {
    expect(selectGrantsForSlot(grants, null).map((g) => g.grantId)).toEqual(['2']);
  });
});

describe('selectAckableGrants', () => {
  const grants = [{ grantId: '1' }, { grantId: '2' }, { grantId: '3' }];

  it('подтверждает только то, что доехало до сейва', () => {
    expect(selectAckableGrants(grants, new Set(['1', '3']))).toEqual(['1', '3']);
  });

  it('ничего не подтверждает, пока сохранения не было', () => {
    // Ровно этот случай терял выдачу: ack закрывает строку навсегда.
    expect(selectAckableGrants(grants, new Set())).toEqual([]);
  });
});
