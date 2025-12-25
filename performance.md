# Оптимизация производительности

## Обзор

Фаза 10.4 содержит комплексные оптимизации производительности для обеспечения плавной работы игры даже с большим количеством зданий и активных процессов.

## Основные компоненты

### 1. Оптимизированный игровой цикл (useOptimizedGameLoop)

**Файл:** `/src/hooks/useOptimizedGameLoop.ts`

**Особенности:**
- Фиксированный временной шаг (fixed timestep) для предсказуемой физики
- Настраиваемый целевой FPS (30/60/120)
- Защита от "спирали смерти" при просадках производительности
- Автоматический мониторинг FPS с предупреждениями
- Отделение логики обновления от рендеринга

**Использование:**
```typescript
const { getFPS } = useOptimizedGameLoop(60); // 60 FPS
```

**Алгоритм:**
1. Накапливаем deltaTime между кадрами
2. Обновляем игру фиксированными шагами (frameTime)
3. Ограничиваем максимальное накопление времени
4. Отслеживаем FPS и предупреждаем о низкой производительности

### 2. Система кэширования (cache.ts)

**Файл:** `/src/utils/cache.ts`

**Компоненты:**

#### LRUCache
- Ограниченный размер (по умолчанию 100 элементов)
- Автоматическое вытеснение старых элементов
- O(1) операции get/set через Map

```typescript
const cache = new LRUCache<string, number>(50);
cache.set('key', value);
const result = cache.get('key');
```

#### Memoization
- Кэширование результатов функций
- TTL для автоматической инвалидации
- Поддержка сложных аргументов через JSON.stringify

```typescript
const expensiveCalc = memoize((x: number, y: number) => {
  // Тяжелые вычисления
  return x * y + Math.sqrt(x);
});

const withTTL = memoizeWithTTL(
  (id: string) => calculateBuildingBonus(id),
  5000 // 5 секунд TTL
);
```

#### BatchProcessor
- Накопление операций в батч
- Обработка пакетом через задержку
- Снижение нагрузки на render loop

```typescript
const processor = new BatchProcessor<number>(
  (batch) => console.log('Processing:', batch),
  100 // 100ms delay
);

processor.add(1);
processor.add(2);
// Обработается вместе через 100ms
```

#### DependencyCache
- Кэш с отслеживанием зависимостей
- Инвалидация всех зависимых значений

```typescript
const cache = new DependencyCache<string, number>();
cache.set('parent', 10);
cache.set('child', 20, ['parent']);

cache.invalidate('parent'); // Инвалидирует и 'child'
```

### 3. Performance Hooks (usePerformance.ts)

**Файл:** `/src/hooks/usePerformance.ts`

**Хуки:**

#### useMemoCompare
- Мемоизация с кастомным сравнением
- Избегает лишних пересчетов

```typescript
const value = useMemoCompare(
  () => expensiveCalc(data),
  [data],
  (prev, next) => _.isEqual(prev, next)
);
```

#### useThrottle
- Ограничение частоты вызовов
- Гарантирует вызов последнего значения

```typescript
const throttledValue = useThrottle(value, 500); // Макс раз в 500ms
```

#### useDebounce
- Задержка обновления до паузы
- Полезно для поиска, фильтров

```typescript
const debouncedSearch = useDebounce(searchQuery, 300);
```

#### useIntersectionObserver
- Отслеживание видимости элемента
- Lazy loading, виртуализация

```typescript
const [ref, isVisible] = useIntersectionObserver({
  threshold: 0.5,
  rootMargin: '100px'
});
```

#### usePerformanceMonitor
- Мониторинг рендеров компонента
- Консоль логирование каждые N рендеров

```typescript
usePerformanceMonitor('BuildingList', 10); // Лог каждые 10 рендеров
```

### 4. Web Workers (gameWorker.ts)

**Файл:** `/src/workers/gameWorker.ts`

**Типы вычислений:**

#### Proximity Bonuses
- Расчет бонусов от соседних зданий
- Проверка 3x3 окружения
- Возвращает Map с бонусами

#### Achievement Checking
- Проверка условий разблокировки
- Работа с большими числами (Decimal)
- Не блокирует UI

#### Production Calculations
- Расчет производственных цепочек
- Определение bottleneck'ов
- Оптимизация потоков ресурсов

#### Pathfinding (A*)
- Поиск пути для логистики
- Учет препятствий
- Эвристика Manhattan distance

**Использование:**
```typescript
const { sendRequest } = useGameWorker(2); // 2 воркера в пуле

const bonuses = await sendRequest('proximity', {
  buildings,
  tiles
});

const path = await sendRequest('pathfinding', {
  start: { x: 0, y: 0 },
  end: { x: 10, y: 10 },
  obstacles: [...],
  gridWidth: 50,
  gridHeight: 50
});
```

### 5. Специализированные Worker Hooks

**Файл:** `/src/hooks/useGameWorker.ts`

```typescript
// Proximity calculations
const { calculateProximity, isReady } = useProximityWorker();
const bonuses = await calculateProximity(buildings, tiles);

// Achievement checking
const { checkAchievements } = useAchievementWorker();
const unlocked = await checkAchievements({
  buildings,
  totalCredits: credits.toString(),
  totalResearchPoints: rp.toString(),
  technologiesUnlocked: techCount
});

// Production chains
const { calculateProduction } = useProductionWorker();
const { totalProduction, bottlenecks } = await calculateProduction({
  buildings,
  resources
});

// Pathfinding (с 2 воркерами для параллельности)
const { findPath } = usePathfindingWorker();
const path = await findPath({
  start, end, obstacles, gridWidth, gridHeight
});
```

## Настройки производительности

### Пользовательские настройки (SettingsPanel)

**Целевой FPS:**
- 30 FPS: Экономия батареи, слабые устройства
- 60 FPS: Рекомендуется, баланс качества/производительности
- 120 FPS: Высокая производительность, мощные устройства

**Качество графики:**
- Low: Минимум эффектов, максимум FPS
- Medium: Баланс
- High: Все эффекты, может снизить FPS на слабых устройствах

### Dev-инструменты

**FPS Monitor:**
- Нажмите F3 в dev режиме
- Показывает текущий FPS в левом верхнем углу
- Помогает отладить просадки производительности

**Performance Marks:**
```typescript
performance.mark('calculation-start');
// ... expensive operation
performance.mark('calculation-end');
performance.measure('calculation', 'calculation-start', 'calculation-end');
```

## Рекомендации по оптимизации

### Для разработчиков

1. **Избегайте лишних ререндеров:**
   - Используйте `useMemo` и `useCallback`
   - Подписывайтесь только на нужные части state
   - Добавляйте custom equality функции в селекторы Zustand

2. **Кэшируйте тяжелые вычисления:**
   - Расчеты proximity бонусов
   - Подсчет производства
   - Pathfinding
   - Сортировка и фильтрация больших списков

3. **Используйте Web Workers для:**
   - Проверки достижений
   - Расчета оптимальных маршрутов
   - Анализа производственных цепочек
   - Любых O(n²) или медленнее алгоритмов

4. **Throttle/Debounce события:**
   - Mouse move
   - Scroll
   - Resize
   - Search input

5. **Lazy loading:**
   - Большие списки зданий
   - Off-screen элементы сетки
   - Изображения и ассеты

### Для пользователей

1. **Если игра тормозит:**
   - Снизьте целевой FPS до 30
   - Переключите качество на Low
   - Отключите particle effects
   - Отключите animations
   - Уменьшите скорость игры

2. **Для максимальной производительности:**
   - Закройте ненужные вкладки браузера
   - Используйте Hardware Acceleration
   - Обновите драйверы видеокарты
   - Используйте Desktop приложение (если доступно)

## Метрики производительности

### Целевые показатели

- **60 FPS** на средних устройствах с 100+ зданиями
- **30 FPS** на слабых устройствах с 50+ зданиями
- **< 16ms** frame time для smooth gameplay
- **< 100ms** для UI interactions (click, hover)
- **< 5% CPU** idle (без активности пользователя)

### Что мониторить

- FPS (frames per second)
- Frame time (ms per frame)
- Memory usage
- Number of render calls
- State update frequency
- Worker response time

## Будущие улучшения

1. **Virtualization:**
   - Виртуализация больших списков (react-window)
   - Render только видимых тайлов на сетке

2. **Progressive Enhancement:**
   - Адаптивное снижение качества при просадках FPS
   - Автоматическое отключение эффектов

3. **GPU Acceleration:**
   - Перенос некоторых расчетов на GPU (WebGL shaders)
   - Offscreen canvas для фоновых элементов

4. **Advanced Caching:**
   - Service Worker для ассетов
   - IndexedDB для больших данных
   - Shared Workers для multi-tab sync

5. **Profiling:**
   - Автоматический profiling с отправкой на сервер
   - Heatmap узких мест производительности
   - A/B тесты оптимизаций
