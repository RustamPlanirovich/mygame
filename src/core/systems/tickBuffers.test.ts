/**
 * Буферы ресурсов внутри тика (bigplan.md, пункт 22).
 *
 * Три инварианта, каждый из которых при нарушении портит состояние ТИХО:
 *   - исходный объект из стора не мутируется (иначе предыдущее состояние меняется задним
 *     числом, и подписчики видят «изменение», которого не было);
 *   - отрицательное значение кламается в ноль (иначе минус уезжает в сохранение и вылезает
 *     через несколько загрузок как отрицательный склад);
 *   - после замены объекта целиком владение сбрасывается (иначе запись идёт по месту в
 *     ЧУЖОЙ объект клетки).
 */

import { describe, expect, it } from 'vitest';
import { createBufferAccess, type BufferMap } from './tickBuffers';
import { D } from '../math/format';

describe('чтение', () => {
  it('отсутствующее значение — ноль, а не undefined', () => {
    const a = createBufferAccess();
    const buffers: BufferMap = {};
    expect(a.get(buffers, 'base', 'ore').toString()).toBe('0');
    expect(a.get(buffers, 'нет_клетки', 'ore').toString()).toBe('0');
  });

  it('строка разбирается в число', () => {
    const a = createBufferAccess();
    const buffers: BufferMap = { base: { ore: '1234.5' } };
    expect(a.get(buffers, 'base', 'ore').toString()).toBe('1234.5');
  });

  it('одинаковые строки разбираются один раз', () => {
    const a = createBufferAccess();
    const buffers: BufferMap = { base: { ore: '42' }, '1,1': { ore: '42' } };
    // Кэш по строке: два разных ключа с одинаковым значением дают ОДИН объект.
    expect(a.get(buffers, 'base', 'ore')).toBe(a.get(buffers, '1,1', 'ore'));
  });

  it('огромные значения не теряют точность', () => {
    const a = createBufferAccess();
    const huge = '1e400'; // далеко за double
    const buffers: BufferMap = { base: { ore: huge } };
    expect(a.get(buffers, 'base', 'ore').gt(D('1e399'))).toBe(true);
  });
});

describe('запись', () => {
  it('не мутирует исходный объект клетки', () => {
    const a = createBufferAccess();
    const original = { ore: '100' };
    const buffers: BufferMap = { base: original };

    a.set(buffers, 'base', 'ore', D(50));

    // В сторе осталось прежнее значение — иначе предыдущее состояние менялось бы
    // задним числом.
    expect(original.ore).toBe('100');
    expect(buffers.base!.ore).toBe('50');
  });

  it('копирует клетку ОДИН раз, а не на каждую запись', () => {
    const a = createBufferAccess();
    const buffers: BufferMap = { base: { ore: '0' } };

    a.set(buffers, 'base', 'ore', D(1));
    const afterFirst = buffers.base;
    a.set(buffers, 'base', 'ore', D(2));
    a.set(buffers, 'base', 'steel', D(3));

    expect(buffers.base).toBe(afterFirst);
  });

  it('отрицательное значение кламается в ноль', () => {
    const a = createBufferAccess();
    const buffers: BufferMap = { base: { ore: '10' } };
    a.set(buffers, 'base', 'ore', D(-5));
    expect(buffers.base!.ore).toBe('0');
  });

  it('создаёт клетку, которой не было', () => {
    const a = createBufferAccess();
    const buffers: BufferMap = {};
    a.set(buffers, '3,4', 'ore', D(7));
    expect(buffers['3,4']!.ore).toBe('7');
  });

  it('возвращает тот же объект — для цепочек вида buffers = set(buffers, ...)', () => {
    const a = createBufferAccess();
    const buffers: BufferMap = {};
    expect(a.set(buffers, 'base', 'ore', D(1))).toBe(buffers);
  });
});

describe('rebind', () => {
  it('после замены объекта запись снова копирует клетку', () => {
    const a = createBufferAccess();
    const first: BufferMap = { base: { ore: '1' } };
    a.set(first, 'base', 'ore', D(2)); // теперь base — наш

    /*
     * Тик заменяет объект буферов целиком (обрезка по складам, эффекты событий).
     * В новом объекте лежит ЧУЖАЯ клетка: без rebind запись пошла бы прямо в неё.
     */
    const foreign = { ore: '999' };
    const second: BufferMap = { base: foreign };
    a.rebind();
    a.set(second, 'base', 'ore', D(3));

    expect(foreign.ore).toBe('999');
    expect(second.base!.ore).toBe('3');
  });

  it('без rebind чужая клетка была бы испорчена — это и есть цена ошибки', () => {
    const a = createBufferAccess();
    const first: BufferMap = { base: { ore: '1' } };
    a.set(first, 'base', 'ore', D(2));

    const foreign = { ore: '999' };
    const second: BufferMap = { base: foreign };
    a.set(second, 'base', 'ore', D(3)); // rebind НЕ вызван

    // Тест фиксирует именно опасное поведение, чтобы было видно, зачем нужен rebind.
    expect(foreign.ore).toBe('3');
  });

  it('кэш разбора переживает rebind: строки те же', () => {
    const a = createBufferAccess();
    const buffers: BufferMap = { base: { ore: '42' } };
    const before = a.get(buffers, 'base', 'ore');
    a.rebind();
    expect(a.get(buffers, 'base', 'ore')).toBe(before);
  });
});
