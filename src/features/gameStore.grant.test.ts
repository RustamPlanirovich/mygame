/**
 * Применение админской выдачи к состоянию в памяти (bigplan.md, пункт 9).
 *
 * Сервер патчит сохранение в БД, но у запущенного игрока состояние живёт в памяти, и его
 * автосохранение перезаписывало патч — ровно это и означало «при выдаче ресурсы не сохраняются».
 * Здесь проверяется, что дельта прибавляется к памяти и что ресурсы идут в БАЗОВЫЙ БУФЕР:
 * при загрузке syncResourcesFromBase перетирает resources[*].amount значением из буфера,
 * поэтому патчить только resources бессмысленно.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { useGameStore } from './gameStore';
import { D } from '../core/math/format';

let counter = 0;
/** Уникальный id: applyAdminGrant дедуплицирует по нему, и повтор в другом тесте не применился бы. */
const nextGrantId = () => `test-grant-${++counter}`;

beforeEach(() => {
  useGameStore.getState().resetGame();
});

describe('applyAdminGrant: валюты', () => {
  it('прибавляет кредиты к текущему балансу', () => {
    const before = useGameStore.getState().currency.credits;
    const ok = useGameStore.getState().applyAdminGrant(nextGrantId(), {
      'currency.credits': '500',
    });

    expect(ok).toBe(true);
    expect(useGameStore.getState().currency.credits.sub(before).toNumber()).toBe(500);
  });

  it('отрицательная дельта списывает, но не уводит в минус', () => {
    useGameStore.getState().applyAdminGrant(nextGrantId(), { 'currency.credits': '-999999999' });
    expect(useGameStore.getState().currency.credits.gte(0)).toBe(true);
  });

  it('начисляет все три валюты за один вызов', () => {
    const before = useGameStore.getState().currency;
    useGameStore.getState().applyAdminGrant(nextGrantId(), {
      'currency.credits': '10',
      'currency.researchPoints': '20',
      'currency.influence': '30',
    });

    const after = useGameStore.getState().currency;
    expect(after.credits.sub(before.credits).toNumber()).toBe(10);
    expect(after.researchPoints.sub(before.researchPoints).toNumber()).toBe(20);
    expect(after.influence.sub(before.influence).toNumber()).toBe(30);
  });
});

describe('applyAdminGrant: ресурсы', () => {
  it('прибавляет в базовый буфер, а не только в resources', () => {
    const beforeBuffer = D(useGameStore.getState().grid.buffers.base?.ore ?? '0');

    useGameStore.getState().applyAdminGrant(nextGrantId(), { 'resources.ore': '50' });

    const state = useGameStore.getState();
    const afterBuffer = D(state.grid.buffers.base?.ore ?? '0');
    expect(afterBuffer.sub(beforeBuffer).toNumber()).toBe(50);
    // resources согласован с буфером — иначе UI и загрузка расходятся.
    expect(state.resources.ore.amount.toString()).toBe(afterBuffer.toString());
  });

  it('обрезает по вместимости склада', () => {
    const max = useGameStore.getState().resources.ore.max;
    useGameStore.getState().applyAdminGrant(nextGrantId(), { 'resources.ore': '1e12' });

    const state = useGameStore.getState();
    expect(state.resources.ore.amount.lte(max)).toBe(true);
    expect(D(state.grid.buffers.base?.ore ?? '0').lte(max)).toBe(true);
  });

  it('неизвестный ресурс игнорирует без падения', () => {
    const ok = useGameStore.getState().applyAdminGrant(nextGrantId(), {
      'resources.нет_такого': '100',
    });
    // Разобрать удалось, но применить нечего — состояние осталось валидным.
    expect(ok).toBe(true);
    expect(() => useGameStore.getState().tick(0.05)).not.toThrow();
  });
});

describe('applyAdminGrant: дедупликация и пустые случаи', () => {
  it('одна и та же выдача применяется РОВНО один раз', () => {
    const grantId = nextGrantId();
    const before = useGameStore.getState().currency.credits;

    expect(useGameStore.getState().applyAdminGrant(grantId, { 'currency.credits': '100' })).toBe(true);
    /*
     * Второй вызов с тем же id — это не гипотеза: событие приходит во ВСЕ вкладки игрока,
     * и без дедупликации каждая начислила бы себе по разу.
     */
    expect(useGameStore.getState().applyAdminGrant(grantId, { 'currency.credits': '100' })).toBe(false);

    expect(useGameStore.getState().currency.credits.sub(before).toNumber()).toBe(100);
  });

  it('пустая выдача не трогает состояние', () => {
    const before = useGameStore.getState().currency;
    expect(useGameStore.getState().applyAdminGrant(nextGrantId(), {})).toBe(false);
    expect(useGameStore.getState().currency).toBe(before);
  });

  it('выдача только из неизвестных полей не трогает состояние', () => {
    const before = useGameStore.getState().currency;
    expect(
      useGameStore.getState().applyAdminGrant(nextGrantId(), { 'buildings.miner_mk1': '1' }),
    ).toBe(false);
    expect(useGameStore.getState().currency).toBe(before);
  });
});
