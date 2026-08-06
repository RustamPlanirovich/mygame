/**
 * Списки производства: нормализация ввода (bigplan.md, пункт 37).
 *
 * Проверяем ровно то, что защищает БД и UI от мусора: пункт без ref_id нечем показать (в списке
 * появилась бы пустая строка, которую игрок не может ни понять, ни удалить осмысленно), а
 * bulk-запрос «добавить всю цепочку» не должен падать целиком из-за одного битого элемента.
 */

import { describe, expect, it } from 'vitest';
import {
  MAX_BULK_ITEMS,
  MAX_TEXT_LENGTH,
  MAX_TITLE_LENGTH,
  normalizeItemInput,
  normalizeItemsPayload,
  normalizeRef,
  normalizeSlotId,
  normalizeTitle,
} from './plans.js';

describe('normalizeTitle', () => {
  it('оставляет обычный заголовок без пробелов по краям', () => {
    expect(normalizeTitle('  Сделать компьютер  ')).toBe('Сделать компьютер');
  });

  it('вырезает управляющие символы', () => {
    expect(normalizeTitle('план\nна\tвечер')).toBe('план на вечер');
    expect(normalizeTitle('план\u0000конец')).toBe('план конец');
  });

  it('обрезает по длине, а не отклоняет — заголовок игрок уже написал', () => {
    expect(normalizeTitle('x'.repeat(MAX_TITLE_LENGTH + 50))).toHaveLength(MAX_TITLE_LENGTH);
  });

  it('пустое, пробельное и не-строку отклоняет', () => {
    expect(normalizeTitle('')).toBeNull();
    expect(normalizeTitle('   ')).toBeNull();
    expect(normalizeTitle(null)).toBeNull();
    expect(normalizeTitle(42)).toBeNull();
  });
});

describe('normalizeRef', () => {
  it('принимает игровые id', () => {
    expect(normalizeRef('steel_smelter_mk1')).toBe('steel_smelter_mk1');
    expect(normalizeRef(' ore ')).toBe('ore');
  });

  it('отклоняет всё, что на игровой id не похоже', () => {
    expect(normalizeRef('robert; DROP TABLE')).toBeNull();
    expect(normalizeRef('<script>')).toBeNull();
    expect(normalizeRef('')).toBeNull();
    expect(normalizeRef('x'.repeat(200))).toBeNull();
    expect(normalizeRef(undefined)).toBeNull();
  });
});

describe('normalizeSlotId', () => {
  it('обычный id слота проходит как есть, в том числе строкой из query', () => {
    expect(normalizeSlotId(12)).toBe(12);
    expect(normalizeSlotId('12')).toBe(12);
  });

  /*
   * Ради этого случая функция и появилась: Number(null) === 0, поэтому «план без слота» уходил
   * в БД со slot_id = 0, внешний ключ на game_slots падал, и создание списка отвечало INTERNAL.
   */
  it('«без слота» во всех видах даёт null, а не ноль', () => {
    expect(normalizeSlotId(null)).toBeNull();
    expect(normalizeSlotId(undefined)).toBeNull();
    expect(normalizeSlotId('')).toBeNull();
  });

  it('несуществующие в схеме значения отбрасывает: слоты — SERIAL, они всегда положительные', () => {
    expect(normalizeSlotId(0)).toBeNull();
    expect(normalizeSlotId(-5)).toBeNull();
    expect(normalizeSlotId(1.5)).toBeNull();
    expect(normalizeSlotId('слот')).toBeNull();
  });
});

describe('normalizeItemInput', () => {
  it('здание с целевым количеством', () => {
    expect(normalizeItemInput({ kind: 'building', refId: 'miner_mk1', targetCount: '3' })).toEqual({
      kind: 'building',
      refId: 'miner_mk1',
      text: null,
      targetCount: 3,
      pinned: false,
    });
  });

  it('ресурс с комментарием и закреплением', () => {
    expect(
      normalizeItemInput({ kind: 'resource', refId: 'steel', text: ' надо 200 ', pinned: true }),
    ).toEqual({
      kind: 'resource',
      refId: 'steel',
      text: 'надо 200',
      targetCount: null,
      pinned: true,
    });
  });

  it('заметка живёт текстом и ref_id не имеет', () => {
    expect(normalizeItemInput({ kind: 'note', refId: 'ore', text: 'не забыть про энергию' })).toEqual({
      kind: 'note',
      refId: null,
      text: 'не забыть про энергию',
      targetCount: null,
      pinned: false,
    });
  });

  it('в заметке перевод строки сохраняется — это блокнот, а не SSE', () => {
    expect(normalizeItemInput({ kind: 'note', text: 'первая\nвторая' })?.text).toBe('первая\nвторая');
  });

  it('здание или ресурс без ref_id отклоняет: такой пункт нечем показать', () => {
    expect(normalizeItemInput({ kind: 'building', text: 'что-то' })).toBeNull();
    expect(normalizeItemInput({ kind: 'resource', refId: '' })).toBeNull();
  });

  it('пустую заметку отклоняет', () => {
    expect(normalizeItemInput({ kind: 'note', text: '   ' })).toBeNull();
  });

  it('незнакомый вид пункта отклоняет — CHECK в схеме иначе уронил бы весь запрос', () => {
    expect(normalizeItemInput({ kind: 'technology', refId: 'basic_mining' })).toBeNull();
    expect(normalizeItemInput(null)).toBeNull();
    expect(normalizeItemInput('строка')).toBeNull();
  });

  it('нулевое и отрицательное целевое количество считает отсутствующим', () => {
    expect(normalizeItemInput({ kind: 'building', refId: 'miner_mk1', targetCount: 0 })?.targetCount).toBeNull();
    expect(normalizeItemInput({ kind: 'building', refId: 'miner_mk1', targetCount: -5 })?.targetCount).toBeNull();
    expect(normalizeItemInput({ kind: 'building', refId: 'miner_mk1', targetCount: 'нет' })?.targetCount).toBeNull();
  });

  it('дробное количество округляет вниз, огромное — прижимает к потолку int4', () => {
    expect(normalizeItemInput({ kind: 'building', refId: 'miner_mk1', targetCount: 2.9 })?.targetCount).toBe(2);
    expect(
      normalizeItemInput({ kind: 'building', refId: 'miner_mk1', targetCount: 1e15 })?.targetCount,
    ).toBe(1_000_000_000);
  });

  it('слишком длинный текст обрезает', () => {
    const item = normalizeItemInput({ kind: 'note', text: 'x'.repeat(MAX_TEXT_LENGTH + 100) });
    expect(item?.text).toHaveLength(MAX_TEXT_LENGTH);
  });

  it('понимает и snake_case из старого клиента', () => {
    expect(normalizeItemInput({ kind: 'building', ref_id: 'miner_mk1', target_count: 2 })).toMatchObject({
      refId: 'miner_mk1',
      targetCount: 2,
    });
  });
});

describe('normalizeItemsPayload', () => {
  it('одиночный пункт и массив обрабатываются одним кодом', () => {
    expect(normalizeItemsPayload({ kind: 'note', text: 'один' })).toHaveLength(1);
    expect(
      normalizeItemsPayload({ items: [{ kind: 'note', text: 'a' }, { kind: 'note', text: 'b' }] }),
    ).toHaveLength(2);
  });

  it('битый элемент выкидывает, остальные добавляет: цепочка не должна падать целиком', () => {
    const items = normalizeItemsPayload({
      items: [
        { kind: 'building', refId: 'miner_mk1' },
        { kind: 'building' },
        null,
        { kind: 'resource', refId: 'steel' },
      ],
    });
    expect(items.map((i) => i.refId)).toEqual(['miner_mk1', 'steel']);
  });

  it('сохраняет порядок присланных пунктов — от сырья к цели', () => {
    const items = normalizeItemsPayload({
      items: [
        { kind: 'building', refId: 'miner_mk1' },
        { kind: 'building', refId: 'steel_smelter_mk1' },
        { kind: 'building', refId: 'chip_fab_mk1' },
      ],
    });
    expect(items.map((i) => i.refId)).toEqual(['miner_mk1', 'steel_smelter_mk1', 'chip_fab_mk1']);
  });

  it('обрезает пачку по лимиту', () => {
    const raw = Array.from({ length: MAX_BULK_ITEMS + 20 }, (_, i) => ({
      kind: 'note',
      text: `пункт ${i}`,
    }));
    expect(normalizeItemsPayload({ items: raw })).toHaveLength(MAX_BULK_ITEMS);
  });

  it('пустое тело даёт пустой список, а не исключение', () => {
    expect(normalizeItemsPayload(undefined)).toEqual([]);
    expect(normalizeItemsPayload({})).toEqual([]);
  });
});
