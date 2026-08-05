import {
  formatBigNumber as formatBigNumberUtil,
  formatExact,
  formatPercent,
  formatMultiplier,
  formatRate,
  formatTime,
  D as DecimalHelper
} from '../../utils/bigNumber';

// Re-export D helper для создания Decimal
export const D = DecimalHelper;

// Основная функция форматирования для UI
export const formatNumber = (num: any): string => {
  // Используем улучшенную функцию форматирования из bigNumber.ts
  return formatBigNumberUtil(num, 2);
};

// Дополнительные функции форматирования
export { 
  formatExact,      // Точное значение с запятыми (для tooltip)
  formatPercent,    // Формат процентов (50.5%)
  formatMultiplier, // Формат множителей (x2.5, x100K)
  formatRate,       // Формат производства (/с)
  formatTime        // Формат времени (2h 15m, 45s)
};
