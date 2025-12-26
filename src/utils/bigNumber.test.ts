/**
 * Тесты и примеры использования системы больших чисел
 * 
 * Этот файл демонстрирует возможности break_eternity.js
 * и наших хелперов форматирования
 */

import { D, formatBigNumber, formatExact, formatPercent, formatMultiplier, formatRate } from './bigNumber';

// ============================================================================
// ПРИМЕРЫ РАБОТЫ С БОЛЬШИМИ ЧИСЛАМИ
// ============================================================================

console.log('=== Тесты системы больших чисел ===\n');

// 1. Обычные числа (до 1000)
console.log('1. Обычные числа:');
console.log(`  42 -> ${formatBigNumber(42)}`);              // "42"
console.log(`  999.5 -> ${formatBigNumber(999.5)}`);        // "999.50"
console.log(`  0.123 -> ${formatBigNumber(0.123)}`);        // "0.12"

// 2. Тысячи (K)
console.log('\n2. Тысячи (K):');
console.log(`  1,234 -> ${formatBigNumber(1234)}`);         // "1.23K"
console.log(`  50,000 -> ${formatBigNumber(50000)}`);       // "50.00K"
console.log(`  999,999 -> ${formatBigNumber(999999)}`);     // "1000.00K" or "1.00M"

// 3. Миллионы (M)
console.log('\n3. Миллионы (M):');
console.log(`  1,234,567 -> ${formatBigNumber(1234567)}`); // "1.23M"
console.log(`  500M -> ${formatBigNumber(500_000_000)}`);  // "500.00M"

// 4. Миллиарды (B) и больше
console.log('\n4. Миллиарды (B) и больше:');
console.log(`  1.5B -> ${formatBigNumber(1_500_000_000)}`);    // "1.50B"
console.log(`  10T -> ${formatBigNumber(10_000_000_000_000)}`); // "10.00T"

// 5. Очень большие числа (экстремальные значения)
console.log('\n5. Экстремально большие числа:');
const huge1 = D('1e100');  // Гугол
console.log(`  1e100 (Гугол) -> ${formatBigNumber(huge1)}`);

const huge2 = D('1e308');  // Близко к Number.MAX_VALUE
console.log(`  1e308 -> ${formatBigNumber(huge2)}`);

const huge3 = D('1e1000'); // За пределами Number
console.log(`  1e1000 -> ${formatBigNumber(huge3)}`);

const huge4 = D('1e100000'); // Невообразимо большое
console.log(`  1e100000 -> ${formatBigNumber(huge4)}`);

// 6. Математические операции
console.log('\n6. Математические операции:');
const a = D('1e100');
const b = D('2e100');
const sum = a.add(b);
console.log(`  1e100 + 2e100 = ${formatBigNumber(sum)}`);

const product = a.mul(b);
console.log(`  1e100 × 2e100 = ${formatBigNumber(product)}`);

const power = D(2).pow(1000);
console.log(`  2^1000 = ${formatBigNumber(power)}`);

// 7. Форматирование в различных стилях
console.log('\n7. Различные стили форматирования:');
const testNum = D('123456789.123');
console.log(`  Обычный: ${formatBigNumber(testNum)}`);
console.log(`  Точный:  ${formatExact(testNum)}`);
console.log(`  Скорость: ${formatRate(testNum)}`);
console.log(`  Множитель: ${formatMultiplier(testNum)}`);

const testPercent = D('0.752');
console.log(`  Процент: ${formatPercent(testPercent)}`); // "75.2%"

// ============================================================================
// ИГРОВЫЕ СЦЕНАРИИ
// ============================================================================

console.log('\n=== Игровые сценарии ===\n');

// Сценарий 1: Прогресс игрока
console.log('1. Ранняя игра (первые часы):');
let energy = D(100);
console.log(`  Энергия: ${formatBigNumber(energy)}`);
energy = energy.add(D(50).mul(10)); // +50/с × 10с
console.log(`  Через 10 секунд: ${formatBigNumber(energy)}`);

console.log('\n2. Средняя игра (несколько часов):');
energy = D(1_000_000);
console.log(`  Энергия: ${formatBigNumber(energy)}`); // "1.00M"
const production = D(10_000);
console.log(`  Производство: ${formatRate(production)}`); // "10.00K/s"

console.log('\n3. Поздняя игра (после престижа):');
energy = D('1e15');
console.log(`  Энергия: ${formatBigNumber(energy)}`); // "1.00Qa"
const multiplier = D(1000);
console.log(`  Множитель: ${formatMultiplier(multiplier)}`); // "x1.00K"

console.log('\n4. Бесконечная игра (после вознесения):');
energy = D('1e100');
console.log(`  Энергия: ${formatBigNumber(energy)}`);
const crazyProduction = D('1e50');
console.log(`  Производство: ${formatRate(crazyProduction)}`);

// Сценарий 2: Стоимость зданий
console.log('\n5. Эволюция стоимости зданий:');
let buildingCost = D(100);
const costFactor = 1.15;

for (let level = 1; level <= 10; level++) {
  console.log(`  Уровень ${level}: ${formatBigNumber(buildingCost)}`);
  buildingCost = buildingCost.mul(costFactor);
}

// Уровень 500 (экстремальный случай)
buildingCost = D(100).mul(D(costFactor).pow(500));
console.log(`  Уровень 500: ${formatBigNumber(buildingCost)}`);

// Уровень 10000 (бесконечная игра)
buildingCost = D(100).mul(D(costFactor).pow(10000));
console.log(`  Уровень 10000: ${formatBigNumber(buildingCost)}`);

// ============================================================================
// ПРОВЕРКА ГРАНИЧНЫХ СЛУЧАЕВ
// ============================================================================

console.log('\n=== Проверка граничных случаев ===\n');

// Отрицательные числа
console.log('1. Отрицательные числа:');
console.log(`  -100 -> ${formatBigNumber(-100)}`);
console.log(`  -1.5M -> ${formatBigNumber(-1_500_000)}`);

// Очень маленькие числа
console.log('\n2. Очень маленькие числа:');
console.log(`  0 -> ${formatBigNumber(0)}`);
console.log(`  0.001 -> ${formatBigNumber(0.001)}`);
console.log(`  0.0001 -> ${formatBigNumber(0.0001)}`);

// Number.MAX_SAFE_INTEGER
console.log('\n3. Предел стандартного Number:');
const maxSafe = Number.MAX_SAFE_INTEGER;
console.log(`  MAX_SAFE_INTEGER (${maxSafe}) -> ${formatBigNumber(maxSafe)}`);
const beyondSafe = D(maxSafe).mul(1000);
console.log(`  За пределами × 1000: ${formatBigNumber(beyondSafe)}`);

// Infinity
console.log('\n4. Бесконечность:');
const inf = D(Number.POSITIVE_INFINITY);
console.log(`  Infinity -> ${formatBigNumber(inf)}`);

// ============================================================================
// ПРОИЗВОДИТЕЛЬНОСТЬ
// ============================================================================

console.log('\n=== Тест производительности ===\n');

const iterations = 100_000;
console.log(`Выполняем ${iterations.toLocaleString()} операций...\n`);

// Тест 1: Создание Decimal
console.time('Создание Decimal');
for (let i = 0; i < iterations; i++) {
  D(Math.random() * 1000000);
}
console.timeEnd('Создание Decimal');

// Тест 2: Сложение
console.time('Сложение Decimal');
let result = D(0);
for (let i = 0; i < iterations; i++) {
  result = result.add(D(1));
}
console.timeEnd('Сложение Decimal');

// Тест 3: Умножение
console.time('Умножение Decimal');
result = D(1);
for (let i = 0; i < iterations / 1000; i++) { // Меньше итераций для умножения
  result = result.mul(D(1.001));
}
console.timeEnd('Умножение Decimal');

// Тест 4: Форматирование
console.time('Форматирование');
const testValue = D('1.23456789e50');
for (let i = 0; i < iterations / 10; i++) {
  formatBigNumber(testValue);
}
console.timeEnd('Форматирование');

console.log('\n=== Все тесты завершены ===');

// ============================================================================
// ЭКСПОРТ ДЛЯ ИСПОЛЬЗОВАНИЯ В КОНСОЛИ БРАУЗЕРА
// ============================================================================

// @ts-ignore - для использования в консоли браузера
if (typeof window !== 'undefined') {
  // @ts-ignore
  window.BigNumberTest = {
    D,
    formatBigNumber,
    formatExact,
    formatPercent,
    formatMultiplier,
    formatRate,
    // Примеры для тестирования
    examples: {
      small: D(42),
      medium: D('1e6'),
      large: D('1e15'),
      huge: D('1e100'),
      extreme: D('1e1000'),
    }
  };
  console.log('\n💡 Доступно в консоли: window.BigNumberTest');
  console.log('   Попробуйте: BigNumberTest.formatBigNumber(BigNumberTest.examples.huge)');
}
