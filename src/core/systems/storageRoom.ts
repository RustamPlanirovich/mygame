/**
 * «ВЛЕЗЕТ ЛИ ПОКУПКА НА СКЛАД» — ОДНА ПРОВЕРКА НА ВСЕ ФОРМЫ ПОКУПКИ.
 *
 * Материал в игре покупают в четырёх местах, и ни одно из них раньше не говорило про
 * склад ни слова:
 *
 *   • спот-рынок (MarketPanel) — buyResource МОЛЧА урезал покупку до свободного места,
 *     а на полном складе просто гасил кнопку «Купить» без объяснения причины;
 *   • локальная биржа (TradingPanel) — исполнение ордера кладёт в base-буфер весь объём
 *     целиком, залог при этом уже списан;
 *   • глобальная биржа (OrderForm) — купленное падает в сейф биржи, у которого потолка
 *     нет, но забрать его в игру можно только в пределах склада;
 *   • вывод из сейфа (VaultPanel) — начисляет в base-буфер весь запрошенный объём.
 *
 * Почему излишек не «полежит и дождётся»: тик прогоняет base-буфер через
 * clampBaseBufferToCaps, и всё сверх вместимости ИСЧЕЗАЕТ на ближайшем шаге. То есть
 * кредиты списаны, а товара нет — и понять это постфактум по цифрам склада невозможно.
 *
 * Поэтому расчёт «сколько влезет» и текст замечания живут здесь, в чистом слое: формам
 * остаётся только показать результат. Единый расчёт заодно чинит расхождение — раньше
 * каждая форма считала свободное место по-своему (или не считала вовсе).
 */

import type Decimal from 'break_eternity.js';
import { D, formatNumber } from '../math/format';

/** Всё, что D() умеет превратить в Decimal. */
type DecimalInput = Decimal | number | string;

export interface StorageRoomCheck {
  /** Свободное место на складе. Никогда не отрицательное. */
  room: Decimal;
  /** Сколько игрок хочет получить. */
  want: Decimal;
  /** Сколько из этого реально поместится. */
  fits: Decimal;
  /** Сколько НЕ поместится. Ноль, если места хватает. */
  overflow: Decimal;
  /** Склад забит: не влезет ни единицы. */
  isFull: boolean;
  /** Хотя бы часть не влезет — ради этого флага всё и считается. */
  isOverflowing: boolean;
}

/**
 * Что случится с тем, что не влезло. От этого зависит и текст, и серьёзность замечания.
 *
 * 'clamp' — форма урежет покупку сама (спот-рынок): за лишнее не заплатят, потери нет.
 * 'burn'  — излишек начислится в буфер и сгорит на ближайшем тике (ордер локальной
 *           биржи, вывод из сейфа): заплачено за всё, получено сколько влезло.
 * 'stuck' — товар останется лежать там, где он есть (сейф глобальной биржи): не
 *           пропадёт, но и в игру его не забрать, пока не появится место.
 */
export type OverflowOutcome = 'clamp' | 'burn' | 'stuck';

/** Текст замечания: заголовок отдельно от пояснения — так его показывают все панели. */
export interface StorageRoomNotice {
  title: string;
  text: string;
}

/**
 * @param want  сколько игрок хочет купить/забрать
 * @param held  сколько уже лежит на складе (правильнее брать из grid.buffers.base:
 *              resources[r].amount уже обрезан по вместимости)
 * @param cap   вместимость склада по этому ресурсу (resources[r].max)
 */
export function checkStorageRoom(
  want: DecimalInput,
  held: DecimalInput,
  cap: DecimalInput,
): StorageRoomCheck {
  const wanted = D(want).max(D(0));
  // Буфер может оказаться БОЛЬШЕ вместимости (её только что уменьшил снос склада, а тик
  // ещё не обрезал), поэтому свободное место зажимаем снизу нулём, а не доверяем вычитанию.
  const room = D(cap).sub(D(held)).max(D(0));
  const fits = wanted.min(room);
  const overflow = wanted.sub(fits).max(D(0));

  return {
    room,
    want: wanted,
    fits,
    overflow,
    isFull: room.lte(0),
    isOverflowing: overflow.gt(0),
  };
}

/**
 * Замечание для формы покупки или null, если всё помещается.
 *
 * @param label человекочитаемое название ресурса — сырой id в UI не попадает
 *              (см. соглашение о подписях в CLAUDE.md)
 */
export function storageRoomNotice(
  check: StorageRoomCheck,
  label: string,
  outcome: OverflowOutcome,
): StorageRoomNotice | null {
  if (!check.isOverflowing) return null;

  const want = formatNumber(check.want);
  const room = formatNumber(check.room);
  const fits = formatNumber(check.fits);
  const overflow = formatNumber(check.overflow);

  if (check.isFull) {
    const title = `Склад «${label}» заполнен`;
    switch (outcome) {
      case 'clamp':
        return { title, text: 'Свободного места нет — покупка не пройдёт. Постройте склад или освободите место.' };
      case 'burn':
        return {
          title,
          text: `Свободного места нет: все ${want} пропадут на ближайшем тике, а заплатить придётся за весь объём.`,
        };
      case 'stuck':
        return {
          title,
          text: 'Свободного места нет: купленное осядет в сейфе биржи, забрать его в игру будет некуда.',
        };
    }
  }

  const title = `На складе «${label}» мало места`;
  switch (outcome) {
    case 'clamp':
      return { title, text: `Свободно ${room} — купится только ${fits} из ${want}.` };
    case 'burn':
      return {
        title,
        text: `Свободно ${room} — ${overflow} из ${want} не поместятся и пропадут, а заплатить придётся за весь объём.`,
      };
    case 'stuck':
      return {
        title,
        text: `Свободно ${room} — забрать в игру получится только столько, оставшиеся ${overflow} будут ждать в сейфе.`,
      };
  }
}
