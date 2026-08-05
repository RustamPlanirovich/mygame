import { D, formatNumber } from '../../../core/math/format';
import type { LabeledDataPoint } from '../../../core/gameTypes.analytics';

/**
 * Дайджест распределения «по картинке».
 *
 * Запасы ресурсов растут на КАЖДОМ игровом тике, поэтому подписка на сами значения
 * будила бы круговую диаграмму 20 раз в секунду. Но на экране видно только
 * отформатированное число в легенде и долю сектора, а они меняются в разы реже.
 *
 * Строка-дайджест содержит ровно то, что видит игрок: подпись, цвет, отформатированное
 * значение и долю с точностью 0.1 п.п. (тоньше сектор всё равно не отрисовать), плюс
 * отформатированную сумму в центре бублика. Строки сравниваются по значению, поэтому
 * подписка на дайджест — обычный `useGameStore(selector)` без устаревшей equalityFn:
 * компонент просыпается тогда и только тогда, когда поменялся бы хоть один пиксель.
 */
export function distributionSignature(entries: LabeledDataPoint[]): string {
  let total = 0;
  const values: number[] = [];
  for (const entry of entries) {
    const value = D(entry.value).toNumber();
    values.push(value);
    total += value;
  }

  let signature = formatNumber(D(total));
  for (let i = 0; i < entries.length; i++) {
    // Доля в десятых долях процента: 1000 шагов на всю окружность.
    const share = total > 0 ? Math.round((values[i] / total) * 1000) : 0;
    signature += `|${entries[i].label}:${entries[i].color ?? ''}:${formatNumber(D(values[i]))}:${share}`;
  }
  return signature;
}
