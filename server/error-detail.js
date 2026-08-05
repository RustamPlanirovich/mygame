/**
 * Читаемое описание ошибки для логов.
 *
 * ЗАЧЕМ ЭТО ЕСТЬ
 * --------------
 * По всему серверу ошибки логировались как `e?.message ?? e` или `e.message`. Когда
 * Postgres обрывает соединение, node-postgres бросает ошибку с ПУСТЫМ `message`, но с
 * заполненными `code`/`severity`, а неудачное подключение прилетает `AggregateError`,
 * у которого весь смысл лежит в `errors[]`, а `message` пуст.
 *
 * В результате падение базы выглядело в логе так:
 *     [market] зачистка не удалась:
 *     [market-sim] step failed:
 * — 280 строк подряд, ни одного слова о причине. Отладка по такому логу невозможна.
 *
 * Эта функция не возвращает пустую строку никогда.
 */

/** Поля драйверов (pg, undici), которые несут смысл, когда message пуст. */
const DETAIL_KEYS = ['code', 'errno', 'syscall', 'severity', 'detail', 'hint', 'constraint', 'table'];

export function describeError(e, { stack = false } = {}) {
  if (e === null || e === undefined) return 'неизвестная ошибка (пустое значение)';
  if (typeof e === 'string') return e || 'неизвестная ошибка (пустая строка)';
  if (typeof e !== 'object') return String(e);

  const parts = [];
  const message = typeof e.message === 'string' ? e.message.trim() : '';
  if (message) parts.push(message);

  // Имя класса добавляем только когда без него строка была бы бессодержательной,
  // чтобы не превращать обычные логи в «Error: Error: ...».
  const name = typeof e.name === 'string' ? e.name : '';
  if (!message && name) parts.push(name);

  const details = [];
  for (const key of DETAIL_KEYS) {
    const v = e[key];
    if (v !== undefined && v !== null && v !== '') details.push(`${key}=${v}`);
  }
  if (details.length) parts.push(`(${details.join(' ')})`);

  // AggregateError: сам message пуст, причина в errors[]. Именно так выглядит неудачное
  // подключение к БД, когда испробованы все адреса из DNS.
  if (Array.isArray(e.errors) && e.errors.length) {
    const inner = e.errors.slice(0, 3).map((x) => describeError(x)).join('; ');
    parts.push(`причины: ${inner}${e.errors.length > 3 ? ` (+${e.errors.length - 3})` : ''}`);
  } else if (e.cause !== undefined && e.cause !== null) {
    parts.push(`причина: ${describeError(e.cause)}`);
  }

  if (stack && typeof e.stack === 'string') {
    // Только первые кадры: полный стек в цикле раз в минуту забивает лог.
    parts.push('\n' + e.stack.split('\n').slice(1, 4).join('\n'));
  }

  const out = parts.join(' ').trim();
  return out || `нечитаемая ошибка (${Object.prototype.toString.call(e)})`;
}
