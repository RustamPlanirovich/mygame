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

/**
 * Сколько ЕЩЁ влезет в склад приёмника по одному ресурсу.
 *
 * `null` — лимита нет: при разгрузке (`gameStore.tick`, доставка каравана) клампа не
 * происходит, если `max <= 0`.
 *
 * Отсутствие ключа — это НЕ «безлимит»: разгрузка кладёт ресурс только в уже существующую
 * ячейку склада, иначе весь груз этого вида молча пропадает. Поэтому здесь 0.
 */
export function destinationRoom(
  stock: Partial<Record<ResourceType, ResourceState>>,
  resType: ResourceType
): Decimal | null {
  const target = stock[resType];
  if (!target) return D(0);
  if (!target.max.gt(0)) return null;
  return target.max.sub(target.amount).max(D(0));
}

/** Строка груза после сверки со складом приёмника. */
export interface CargoFit {
  resType: ResourceType;
  /** Уедет со склада источника. */
  amount: Decimal;
  /** Ляжет на склад приёмника. */
  fits: Decimal;
  /** Пропадёт при разгрузке: склад приёмника полон. */
  excess: Decimal;
}

/**
 * Груз + склад ПРИЁМНИКА → что доедет, а что сгорит при разгрузке.
 *
 * Груз сверх вместимости получателя исчезает (см. разгрузку каравана в `tick`), причём
 * топливо за него уже списано. Панель обязана показать это ДО отправки, а не оповещением
 * «потеряно при разгрузке» через три минуты.
 *
 * `destStock === null` — пункт назначения ещё не выбран: считаем, что влезает всё,
 * ограничение появится вместе с выбором.
 */
export function fitCargoToDestination(
  entries: Array<[ResourceType, Decimal]>,
  destStock: Partial<Record<ResourceType, ResourceState>> | null
): CargoFit[] {
  return entries.map(([resType, amount]) => {
    const room = destStock ? destinationRoom(destStock, resType) : null;
    if (room === null) return { resType, amount, fits: amount, excess: D(0) };
    const fits = amount.min(room);
    return { resType, amount, fits, excess: amount.sub(fits) };
  });
}
