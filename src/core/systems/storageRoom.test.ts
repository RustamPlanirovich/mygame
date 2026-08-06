/**
 * Замечание «на складе не хватит места» для форм покупки.
 *
 * Проверяется в первую очередь то, ради чего расчёт и вынесли из компонентов: свободное
 * место не уходит в минус, а текст замечания честно называет судьбу излишка — урежется
 * покупка, сгорит на тике или останется в сейфе.
 */

import { describe, expect, it } from 'vitest';
import Decimal from 'break_eternity.js';
import { checkStorageRoom, storageRoomNotice } from './storageRoom';

const D = (v: number | string) => new Decimal(v);

describe('checkStorageRoom', () => {
  it('считает свободное место как вместимость минус остаток', () => {
    const check = checkStorageRoom(D(30), D(70), D(100));
    expect(check.room.toNumber()).toBe(30);
    expect(check.fits.toNumber()).toBe(30);
    expect(check.overflow.toNumber()).toBe(0);
    expect(check.isOverflowing).toBe(false);
    expect(check.isFull).toBe(false);
  });

  it('делит запрошенное на «влезет» и «не влезет»', () => {
    const check = checkStorageRoom(D(100), D(90), D(100));
    expect(check.fits.toNumber()).toBe(10);
    expect(check.overflow.toNumber()).toBe(90);
    expect(check.isOverflowing).toBe(true);
    expect(check.isFull).toBe(false);
  });

  it('полный склад: места ноль, не влезает ничего', () => {
    const check = checkStorageRoom(D(5), D(100), D(100));
    expect(check.room.toNumber()).toBe(0);
    expect(check.fits.toNumber()).toBe(0);
    expect(check.overflow.toNumber()).toBe(5);
    expect(check.isFull).toBe(true);
  });

  /*
   * Буфер бывает больше вместимости: снос склада уменьшил cap, а тик ещё не прогнал
   * clampBaseBufferToCaps. Отрицательное «свободное место» показало бы игроку минус
   * и сделало бы fits отрицательным.
   */
  it('не уходит в минус, когда на складе больше вместимости', () => {
    const check = checkStorageRoom(D(10), D(150), D(100));
    expect(check.room.toNumber()).toBe(0);
    expect(check.isFull).toBe(true);
    expect(check.overflow.toNumber()).toBe(10);
  });

  it('нулевой и отрицательный запрос не считаются переполнением', () => {
    expect(checkStorageRoom(D(0), D(100), D(100)).isOverflowing).toBe(false);
    expect(checkStorageRoom(D(-5), D(0), D(100)).want.toNumber()).toBe(0);
  });

  it('переваривает строки и числа, а не только Decimal', () => {
    const check = checkStorageRoom('100', 90, '100');
    expect(check.overflow.toNumber()).toBe(90);
  });
});

describe('storageRoomNotice', () => {
  it('молчит, когда всё помещается', () => {
    expect(storageRoomNotice(checkStorageRoom(D(10), D(0), D(100)), 'Руда', 'clamp')).toBeNull();
  });

  it('clamp: обещает урезанную покупку, а не потерю', () => {
    const notice = storageRoomNotice(checkStorageRoom(D(100), D(90), D(100)), 'Руда', 'clamp');
    expect(notice?.title).toContain('Руда');
    expect(notice?.text).toContain('купится только');
    expect(notice?.text).not.toContain('пропад');
  });

  it('burn: прямо говорит, что излишек пропадёт, а платить придётся за всё', () => {
    const notice = storageRoomNotice(checkStorageRoom(D(100), D(90), D(100)), 'Сталь', 'burn');
    expect(notice?.text).toContain('пропадут');
    expect(notice?.text).toContain('весь объём');
  });

  it('stuck: излишек не теряется, а ждёт в сейфе', () => {
    const notice = storageRoomNotice(checkStorageRoom(D(100), D(90), D(100)), 'Лёд', 'stuck');
    expect(notice?.text).toContain('сейфе');
    expect(notice?.text).not.toContain('пропад');
  });

  it('полный склад получает свой заголовок', () => {
    const full = checkStorageRoom(D(1), D(100), D(100));
    expect(storageRoomNotice(full, 'Руда', 'clamp')?.title).toBe('Склад «Руда» заполнен');
    expect(storageRoomNotice(full, 'Руда', 'burn')?.title).toBe('Склад «Руда» заполнен');
  });

  it('подставляет подпись ресурса, а не его id', () => {
    const notice = storageRoomNotice(checkStorageRoom(D(100), D(90), D(100)), 'Природный газ', 'burn');
    expect(notice?.title).toContain('Природный газ');
    expect(notice?.title).not.toContain('natural_gas');
  });
});
