/**
 * Разбор полей «сколько отправить» на вкладке Логистика.
 *
 * Вынесено из панели, потому что именно здесь раньше терялся груз, и это единственная
 * часть отправки каравана, которую можно проверить тестами (компоненты не тестируются).
 */

import type Decimal from 'break_eternity.js';
import type { ResourceState, ResourceType } from '../gameTypes';
import { D } from '../../utils/bigNumber';

/**
 * Строка из поля ввода → Decimal.
 *
 * Количество держим СТРОКОЙ, а не number: у развитой базы запас легко уходит за 1e21,
 * React рисует такое число как «1e+21», а прежний `parseInt` обрывался на «e» и давал 1 —
 * игрок выставлял максимум, а караван увозил единицу. Заодно `parseInt` отбрасывал дробную
 * часть, поэтому ресурс с запасом меньше единицы отправить было нельзя вообще.
 *
 * Пустая строка, мусор, минус и NaN дают 0: невалидный Decimal в грузе ломал бы вычитание
 * со склада уже внутри стора.
 */
export function parseCargoAmount(text: string | undefined): Decimal {
  const normalized = (text ?? '').trim().replace(',', '.').replace(/\s/g, '');
  if (!normalized) return D(0);
  try {
    const value = D(normalized);
    if (value.isNan() || !value.isFinite() || value.lt(0)) return D(0);
    return value;
  } catch {
    return D(0);
  }
}

/**
 * Поля ввода + склад источника → список того, что реально уедет.
 *
 * Количество обрезается по остатку на складе ИСТОЧНИКА (главная база или платформа),
 * поэтому отправить больше, чем есть, нельзя — стору не приходится отказывать молча.
 */
export function planCargo(
  input: Record<string, string>,
  stock: Partial<Record<ResourceType, ResourceState>>
): Array<[ResourceType, Decimal]> {
  const entries: Array<[ResourceType, Decimal]> = [];
  for (const [resType, text] of Object.entries(input)) {
    const wanted = parseCargoAmount(text);
    if (wanted.lte(0)) continue;
    const available = stock[resType as ResourceType]?.amount ?? D(0);
    const amount = wanted.gt(available) ? available : wanted;
    if (amount.gt(0)) entries.push([resType as ResourceType, amount]);
  }
  return entries;
}
