/**
 * Тесты системы больших чисел.
 *
 * Раньше в этом файле лежал скрипт из console.log без единого assert — и запустить его было
 * нечем: в package.json не было ни `test`, ни тест-раннера. То есть форматирование чисел,
 * от которого зависит весь интерфейс, не проверялось никак.
 */

import { describe, expect, it } from 'vitest';
import {
  D,
  canAfford,
  clamp,
  formatBigNumber,
  formatExact,
  formatMultiplier,
  formatPercent,
  formatRate,
  formatTime,
  parseFormattedNumber,
  progressPercent,
} from './bigNumber';

describe('formatBigNumber', () => {
  /*
   * Точность у чисел до 1000 плавающая: <10 — decimals знаков, <100 — один, дальше целое.
   * Комментарии в старой версии этого файла обещали `42 -> "42"`, а на деле выходит "42.0" —
   * ещё одна причина, почему console.log без assert'ов не документация.
   */
  it('печатает малые числа с плавающей точностью', () => {
    expect(formatBigNumber(5)).toBe('5.00');
    expect(formatBigNumber(42)).toBe('42.0');
    expect(formatBigNumber(100)).toBe('100');
  });

  it('сокращает тысячи и миллионы', () => {
    expect(formatBigNumber(1000)).toBe('1.00K');
    expect(formatBigNumber(1234)).toBe('1.23K');
    expect(formatBigNumber(50_000)).toBe('50.00K');
    expect(formatBigNumber(1_234_567)).toBe('1.23M');
  });

  /*
   * ИЗВЕСТНАЯ ОСОБЕННОСТЬ, а не проверка «так и надо»: 999.5 попадает в ветку «меньше 1000»
   * и печатается через toFixed(0), давая "1000" вместо "1.00K". На складах это выглядит как
   * ровное значение там, где его нет. Тест зафиксирован, чтобы правка поведения была
   * осознанной, а не случайной.
   */
  it('999.5 округляется до "1000" (не "1.00K")', () => {
    expect(formatBigNumber(999.5)).toBe('1000');
  });

  it('не печатает экспоненту там, где есть суффикс', () => {
    expect(formatBigNumber(D('1e21'))).not.toContain('e+');
  });

  it('работает на числах за пределами double', () => {
    // Ради этого в проект и взят break_eternity: обычный Number здесь даёт Infinity.
    expect(() => formatBigNumber(D('1e400'))).not.toThrow();
    expect(formatBigNumber(D('1e400'))).not.toBe('Infinity');
    expect(formatBigNumber(D('1e400'))).toContain('e400');
  });

  it('обрабатывает ноль и отрицательные значения', () => {
    expect(formatBigNumber(0)).toBe('0.00');
    expect(formatBigNumber(-1234)).toBe('-1.23K');
  });
});

describe('вспомогательное форматирование', () => {
  it('formatPercent умножает на 100 и добавляет знак', () => {
    expect(formatPercent(0.5)).toBe('50.0%');
  });

  it('formatMultiplier помечает множитель', () => {
    expect(formatMultiplier(2)).toBe('x2.00');
    expect(formatMultiplier(50_000)).toBe('x50.00K');
  });

  it('formatRate добавляет единицу времени', () => {
    expect(formatRate(10)).toBe('10.0/s');
    expect(formatRate(50_000)).toBe('50.00K/s');
  });

  it('formatExact не сокращает до миллиона', () => {
    expect(formatExact(1234)).toBe('1,234');
  });

  it('formatTime переводит секунды в человеческий вид', () => {
    expect(formatTime(30)).toBe('30s');
    expect(formatTime(90)).toBe('1m 30s');
    expect(formatTime(3600)).toBe('1h');
    expect(formatTime(90_000)).toBe('1d 1h');
  });
});

describe('сравнения и ограничения', () => {
  it('canAfford сравнивает Decimal, а не number', () => {
    expect(canAfford(D('1e400'), D('1e399'))).toBe(true);
    expect(canAfford(D('1e399'), D('1e400'))).toBe(false);
  });

  it('progressPercent зажат сверху и не делит на ноль', () => {
    expect(progressPercent(D(5), D(10))).toBeCloseTo(50);
    expect(progressPercent(D(20), D(10))).toBe(100);
    expect(Number.isFinite(progressPercent(D(5), D(0)))).toBe(true);
  });

  it('clamp зажимает в границы', () => {
    expect(clamp(D(5), D(0), D(10)).toNumber()).toBe(5);
    expect(clamp(D(-5), D(0), D(10)).toNumber()).toBe(0);
    expect(clamp(D(50), D(0), D(10)).toNumber()).toBe(10);
  });
});

describe('parseFormattedNumber', () => {
  it('разбирает обратно то, что напечатал formatBigNumber', () => {
    expect(parseFormattedNumber('1.23K').toNumber()).toBeCloseTo(1230);
    expect(parseFormattedNumber('50.00K').toNumber()).toBeCloseTo(50_000);
    expect(parseFormattedNumber('1.00M').toNumber()).toBeCloseTo(1_000_000);
  });

  it('понимает научную нотацию', () => {
    expect(parseFormattedNumber('1e6').toNumber()).toBe(1_000_000);
  });
});
