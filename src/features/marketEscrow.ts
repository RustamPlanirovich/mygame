/**
 * Расчёт эскроу и форматирование величин сейфа — на клиенте.
 *
 * Зачем дублировать серверную формулу: сервер всё равно отклонит ордер без
 * покрытия (INSUFFICIENT_VAULT_BALANCE), но игрок не должен узнавать об этом
 * ПОСЛЕ нажатия кнопки. Здесь считается ровно то же, что в
 * server/market.js (раздел «МОДЕЛЬ КОМИССИИ»):
 *
 *   продажа: держим qty ресурса;
 *   покупка: держим qty * price + комиссию покупателя, комиссия округляется
 *            ВВЕРХ до 6 знаков — как резерв на сервере.
 *
 * Резерв считается вверх, а фактическая комиссия при исполнении — вниз, поэтому
 * сумма фактических комиссий по частичным исполнениям никогда не превысит
 * зарезервированное. Клиент повторяет округление вверх, чтобы не пропустить
 * ордер, который сервер отвергнет из-за нехватки одной копейки.
 *
 * Это ОЦЕНКА: арифметика break_eternity — не NUMERIC, и на огромных числах
 * возможно расхождение в последних разрядах. Авторитет — сервер.
 */

import { D } from '../core/math/format';
import { formatBigNumber } from '../utils/bigNumber';
import { VAULT_CREDITS } from '../core/gameTypes.market';
import type { OrderType, TradeResourceType, VaultResource } from '../core/gameTypes.market';

type Dec = ReturnType<typeof D>;

/** Шкала денежного округления: 6 знаков, как INPUT_MAX_DP на сервере. */
const SCALE = 1e6;

/** Округление вверх до 6 знаков. */
export function ceilToScale(value: Dec): Dec {
  return value.mul(SCALE).ceil().div(SCALE);
}

export interface EscrowRequirement {
  /** Что именно удерживается: ресурс (продажа) или кредиты (покупка). */
  resource: VaultResource;
  /** Сколько всего нужно свободного в сейфе. */
  required: Dec;
  /** Стоимость товара без комиссии. */
  goods: Dec;
  /** Комиссия покупателя (для продажи — 0, её берут из выручки). */
  fee: Dec;
}

/**
 * Сколько свободного должно быть в сейфе, чтобы ордер прошёл.
 *
 * feePercent — ставка в процентах (2 / 1.5 / 1), та же, что фиксируется в ордере.
 */
export function orderEscrowRequirement(
  type: OrderType,
  resource: TradeResourceType,
  quantity: string | number,
  pricePerUnit: string | number,
  feePercent: number,
): EscrowRequirement {
  const qty = D(quantity);

  if (type === 'sell') {
    // Продавец кладёт товар; комиссия удерживается из выручки при исполнении.
    return { resource, required: qty, goods: qty, fee: D(0) };
  }

  const goods = qty.mul(D(pricePerUnit));
  const fee = ceilToScale(goods.mul(D(feePercent)).div(100));
  return { resource: VAULT_CREDITS, required: goods.add(fee), goods, fee };
}

/**
 * Величина сейфа для показа.
 *
 * Балансы приходят точными десятичными СТРОКАМИ; parseFloat на них — та самая
 * привычка, из-за которой числа начинают «дрожать». Поэтому здесь Decimal и
 * общий для игры formatBigNumber (1.23K / 4.56M / 1.2e18).
 */
export function formatAmount(value: Dec | string | number, decimals = 2): string {
  return formatBigNumber(D(value), decimals);
}

/** Полное значение без сокращений — для подсказок и title. */
export function formatExactAmount(value: Dec | string | number): string {
  const decimal = D(value);
  // Хвост из шести нулей в подсказке не нужен, а вот дробная часть — нужна.
  const text = decimal.lt(1e15) ? decimal.toFixed(6) : decimal.toString();
  return text.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}

/** «через 3 ч 12 мин» / «истекло» — для ордеров и предложений. */
export function formatTimeLeft(timestamp: number, now = Date.now()): string {
  const ms = timestamp - now;
  if (ms <= 0) return 'истекло';
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч ${minutes % 60} мин`;
  const days = Math.floor(hours / 24);
  return `${days} д ${hours % 24} ч`;
}
