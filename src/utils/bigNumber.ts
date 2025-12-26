import Decimal from 'break_eternity.js';

/**
 * Утилиты для работы с бесконечно большими числами
 * Используется break_eternity.js для поддержки чисел до e1e308
 */

// Константы форматирования
const SUFFIXES = [
  '', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc',
  'UDc', 'DDc', 'TDc', 'QaDc', 'QiDc', 'SxDc', 'SpDc', 'OcDc', 'NoDc', 'Vg',
];

/**
 * Создает Decimal из различных типов
 */
export function D(value: number | string | Decimal): Decimal {
  if (value instanceof Decimal) return value;
  return new Decimal(value);
}

/**
 * Форматирует большое число для отображения
 * @param value - Число для форматирования
 * @param decimals - Количество знаков после запятой (по умолчанию 2)
 * @returns Отформатированная строка (например, "1.23M", "4.56B")
 */
export function formatBigNumber(value: number | Decimal, decimals: number = 2): string {
  const num = D(value);
  
  // Отрицательные числа
  if (num.lt(0)) {
    return '-' + formatBigNumber(num.abs(), decimals);
  }
  
  // Маленькие числа (меньше 1000)
  if (num.lt(1000)) {
    return num.toFixed(num.lt(10) ? decimals : (num.lt(100) ? 1 : 0));
  }
  
  // Получаем степень (log10) как число
  const exponent = num.log10().toNumber();
  
  // Стандартные суффиксы (до e63)
  if (exponent < 63) {
    const tier = Math.floor(exponent / 3);
    const suffix = SUFFIXES[tier];
    const mantissa = num.div(Decimal.pow(10, tier * 3));
    return mantissa.toFixed(decimals) + suffix;
  }
  
  // Научная нотация для очень больших чисел
  if (exponent < 1000) {
    const mantissa = num.div(Decimal.pow(10, Math.floor(exponent)));
    return mantissa.toFixed(decimals) + 'e' + Math.floor(exponent);
  }
  
  // Компактная научная нотация для экстремально больших чисел
  return num.toExponential(decimals);
}

/**
 * Форматирует число с полным представлением (без суффиксов)
 * Полезно для точных значений в tooltip
 */
export function formatExact(value: number | Decimal): string {
  const num = D(value);
  
  if (num.lt(1e6)) {
    return num.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  
  return num.toExponential(2);
}

/**
 * Форматирует число как процент
 */
export function formatPercent(value: number | Decimal, decimals: number = 1): string {
  const num = D(value).mul(100);
  return num.toFixed(decimals) + '%';
}

/**
 * Форматирует множитель (например, "x2.5", "x100K")
 */
export function formatMultiplier(value: number | Decimal, decimals: number = 2): string {
  const num = D(value);
  
  if (num.lt(10)) {
    return 'x' + num.toFixed(decimals);
  }
  
  return 'x' + formatBigNumber(num, decimals);
}

/**
 * Форматирует производство в секунду
 */
export function formatRate(value: number | Decimal, decimals: number = 2): string {
  return formatBigNumber(value, decimals) + '/s';
}

/**
 * Форматирует время
 * @param seconds - Количество секунд
 * @returns Отформатированное время (например, "2h 15m", "45s")
 */
export function formatTime(seconds: number): string {
  if (seconds < 60) {
    return Math.floor(seconds) + 's';
  }
  
  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`;
  }
  
  if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
}

/**
 * Проверяет, может ли игрок позволить себе стоимость
 */
export function canAfford(current: Decimal, cost: Decimal): boolean {
  return current.gte(cost);
}

/**
 * Вычисляет процент прогресса к цели
 */
export function progressPercent(current: Decimal, target: Decimal): number {
  if (target.lte(0)) return 100;
  return Math.min(100, current.div(target).mul(100).toNumber());
}

/**
 * Интерполирует между двумя значениями Decimal
 */
export function lerp(a: Decimal, b: Decimal, t: number): Decimal {
  return a.mul(1 - t).add(b.mul(t));
}

/**
 * Возвращает максимальное значение
 */
export function max(...values: Decimal[]): Decimal {
  return values.reduce((a, b) => a.gt(b) ? a : b);
}

/**
 * Возвращает минимальное значение
 */
export function min(...values: Decimal[]): Decimal {
  return values.reduce((a, b) => a.lt(b) ? a : b);
}

/**
 * Клампит значение между min и max
 */
export function clamp(value: Decimal, minVal: Decimal, maxVal: Decimal): Decimal {
  return max(minVal, min(value, maxVal));
}

/**
 * Парсит отформатированную строку обратно в Decimal
 */
export function parseFormattedNumber(str: string): Decimal {
  // Удаляем пробелы и запятые
  str = str.replace(/[,\s]/g, '');
  
  // Научная нотация
  if (str.includes('e')) {
    return D(str);
  }
  
  // Поиск суффикса
  for (let i = SUFFIXES.length - 1; i > 0; i--) {
    const suffix = SUFFIXES[i];
    if (str.endsWith(suffix)) {
      const num = parseFloat(str.slice(0, -suffix.length));
      return D(num).mul(Decimal.pow(10, i * 3));
    }
  }
  
  // Обычное число
  return D(str);
}

/**
 * Конвертирует Decimal в обычный number (с потерей точности для больших чисел)
 * Используйте только когда необходимо!
 */
export function toNumber(value: Decimal): number {
  return value.toNumber();
}

/**
 * Безопасное сложение, возвращает Decimal
 */
export function add(a: number | Decimal, b: number | Decimal): Decimal {
  return D(a).add(D(b));
}

/**
 * Безопасное вычитание, возвращает Decimal
 */
export function sub(a: number | Decimal, b: number | Decimal): Decimal {
  return D(a).sub(D(b));
}

/**
 * Безопасное умножение, возвращает Decimal
 */
export function mul(a: number | Decimal, b: number | Decimal): Decimal {
  return D(a).mul(D(b));
}

/**
 * Безопасное деление, возвращает Decimal
 */
export function div(a: number | Decimal, b: number | Decimal): Decimal {
  return D(a).div(D(b));
}

/**
 * Возведение в степень
 */
export function pow(base: number | Decimal, exponent: number | Decimal): Decimal {
  return D(base).pow(D(exponent));
}

/**
 * Логарифм по основанию 10
 */
export function log10(value: number | Decimal): Decimal {
  return D(value).log10();
}

/**
 * Корень квадратный
 */
export function sqrt(value: number | Decimal): Decimal {
  return D(value).sqrt();
}
