# Signal Interception System - Документация реализации

## Обзор

Signal Interception (Перехват Сигналов) — это система активных бонусов для удержания игроков, аналог Golden Cookie из Cookie Clicker. Сигналы появляются случайным образом на карте каждые 2-5 минут, и игрок должен кликнуть на них в течение 15 секунд, чтобы получить награду.

## Архитектура

### Типы данных (gameTypes.ts)

```typescript
export type SignalType = 
  | 'resource_cache'       // Куча ресурсов (5 мин производства)
  | 'production_boost'     // Буст производства x7 на 30 сек
  | 'research_burst'       // Мгновенные RP (30 минут)
  | 'energy_surge'         // Бесплатная энергия на 1 мин
  | 'lucky_find'           // Случайные ресурсы + кредиты
  | 'time_warp'            // Ускорение времени x2 на 60 сек
  | 'golden_comet';        // Редкий сигнал с мега-наградами (5% шанс)

export interface SignalReward {
  type: 'resources' | 'boost' | 'instant';
  resources?: Partial<Record<ResourceType, Decimal>>;
  credits?: Decimal;
  researchPoints?: Decimal;
  productionMultiplier?: number;
  boostDuration?: number;
  artifact?: string;
  darkMatter?: Decimal;
}

export interface ActiveSignal {
  id: string;
  type: SignalType;
  position: { x: number; y: number };  // 0-1 координаты на карте
  spawnedAt: number;
  expiresAt: number;
  duration: number;                     // 15 секунд
  reward: SignalReward;
  claimed: boolean;
}

export interface ActiveBoost {
  id: string;
  type: string;
  startedAt: number;
  expiresAt: number;
  multiplier: number;
  affectedResources?: ResourceType[];
}

export interface SignalInterceptionState {
  activeSignal: ActiveSignal | null;
  activeBoosts: ActiveBoost[];
  nextSignalAt: number;
  totalSignalsCaught: number;
  totalSignalsMissed: number;
  signalFrequency: number;              // 3.5 минут в среднем
  signalsEnabled: boolean;
}
```

### Helper Functions (signalHelpers.ts)

#### generateRandomSignalType()
```typescript
export function generateRandomSignalType(): SignalType
```

Генерирует случайный тип сигнала на основе весов:
- `resource_cache`: 30% — куча ресурсов
- `production_boost`: 25% — буст производства
- `research_burst`: 20% — мгновенные RP
- `energy_surge`: 15% — бесплатная энергия
- `lucky_find`: 8% — редкий предмет
- `time_warp`: 2% — ускорение времени
- `golden_comet`: 5% — золотая комета (проверяется отдельно)

#### generateSignalReward()
```typescript
export function generateSignalReward(
  type: SignalType,
  currentProduction: Partial<Record<ResourceType, Decimal>>
): SignalReward
```

Генерирует награду в зависимости от типа сигнала:

**resource_cache:**
```typescript
resources = currentProduction × 5 минут
```

**production_boost:**
```typescript
multiplier = 7x
duration = 30 секунд
```

**research_burst:**
```typescript
researchPoints = 30 RP (30 минут исследований)
```

**energy_surge:**
```typescript
Бесплатная энергия на 1 минуту (множитель 1, энергия не расходуется)
```

**lucky_find:**
```typescript
resources = {
  ore: 5000,
  ice: 3000,
  carbon: 2000,
  steel: 1000
}
credits = 10000
```

**time_warp:**
```typescript
multiplier = 2x
duration = 60 секунд
```

**golden_comet:**
```typescript
resources = currentProduction × 30 минут
credits = 100000
researchPoints = 100
darkMatter = 10
```

#### spawnSignal()
```typescript
export function spawnSignal(
  currentProduction: Partial<Record<ResourceType, Decimal>>
): ActiveSignal
```

Создаёт новый сигнал:
1. Выбирает случайный тип через `generateRandomSignalType()`
2. Генерирует случайную позицию на карте (20%-80% от ширины/высоты)
3. Устанавливает время жизни 15 секунд
4. Генерирует награду через `generateSignalReward()`

#### calculateNextSignalTime()
```typescript
export function calculateNextSignalTime(
  frequencyMultiplier: number = 1
): number
```

Рассчитывает время появления следующего сигнала:
```typescript
baseInterval = random(2 минуты, 5 минут)
finalInterval = baseInterval / frequencyMultiplier
return Date.now() + finalInterval
```

#### shouldSpawnSignal()
```typescript
export function shouldSpawnSignal(state: SignalInterceptionState): boolean
```

Проверяет, нужно ли создать новый сигнал:
- Сигналы включены (`signalsEnabled === true`)
- Нет активного сигнала (`activeSignal === null`)
- Время следующего сигнала наступило (`Date.now() >= nextSignalAt`)

#### createBoostFromReward()
```typescript
export function createBoostFromReward(signal: ActiveSignal): ActiveBoost | null
```

Создаёт активный буст из награды сигнала:
- Применяется только к наградам типа `boost`
- Буст активен от `startedAt` до `expiresAt`
- Может влиять на все ресурсы или на конкретные (`affectedResources`)

#### applyBoostMultipliers()
```typescript
export function applyBoostMultipliers(
  baseProduction: Decimal,
  boosts: ActiveBoost[],
  resource?: ResourceType
): Decimal
```

Применяет множители всех активных бустов к производству:
```typescript
finalMultiplier = 1
for (boost in boosts) {
  if (boost affects resource or all resources) {
    finalMultiplier *= boost.multiplier
  }
}
return baseProduction × finalMultiplier
```

### GameStore Methods

#### spawnNewSignal()
```typescript
spawnNewSignal: () => void
```

Обрабатывает спавн нового сигнала:
1. Проверяет через `shouldSpawnSignal()`, нужно ли создать сигнал
2. Получает текущее производство ресурсов
3. Создаёт новый сигнал через `spawnSignal()`
4. Рассчитывает время следующего сигнала
5. Обновляет состояние `signalInterception`

**Вызывается:** в игровом цикле (`useOptimizedGameLoop.ts`) каждый кадр

#### claimSignal()
```typescript
claimSignal: (signalId: string) => void
```

Обрабатывает клик по сигналу:
1. Проверяет, существует ли сигнал и не истёк ли он
2. Если истёк — увеличивает счётчик пропущенных сигналов
3. Если не истёк:
   - Добавляет мгновенные награды (ресурсы, кредиты, RP, темная материя)
   - Создаёт активный буст для наград типа `boost`
   - Помечает сигнал как собранный (`claimed = true`)
   - Увеличивает счётчик перехваченных сигналов
   - Через 1 секунду удаляет сигнал
4. Показывает уведомление с результатом

#### updateSignals()
```typescript
updateSignals: () => void
```

Обновляет состояние сигналов:
1. Удаляет истёкшие бусты через `removeExpiredBoosts()`
2. Проверяет активный сигнал на истечение
3. Если сигнал истёк и не был собран — удаляет его и увеличивает счётчик пропущенных

**Вызывается:** в игровом цикле каждый кадр

#### toggleSignals()
```typescript
toggleSignals: (enabled: boolean) => void
```

Включает/выключает систему сигналов.

## UI Components

### SignalOverlay.tsx

Главный компонент для отображения сигналов на карте и активных бустов.

#### Отображение сигнала

**Позиция:**
- Абсолютная позиция на карте через CSS `fixed`
- Координаты: `left: ${x * 100}%`, `top: ${y * 100}%`
- Центрируется через `transform: translate(-50%, -50%)`

**Визуальные элементы:**
1. **Пульсирующий круг** — `animate-ping` для привлечения внимания
2. **Основной сигнал** — круглая кнопка с иконкой и таймером
3. **Прогресс-бар** — показывает оставшееся время
4. **Подсказка** — название и описание награды

**Цветовая индикация:**
- `resource_cache`: зелёный (#4ade80)
- `production_boost`: янтарный (#fbbf24)
- `research_burst`: синий (#60a5fa)
- `energy_surge`: фиолетовый (#a78bfa)
- `lucky_find`: розовый (#f472b6)
- `time_warp`: голубой (#38bdf8)
- `golden_comet`: золотой (#fbbf24)

**Анимации:**
- `animate-pulse` — пульсация основного сигнала
- `hover:scale-110` — увеличение при наведении
- Таймер обновляется каждые 100мс для плавности

#### Индикаторы бустов

**Позиция:** правый верхний угол (`top-20 right-4`)

**Отображение:**
- Название буста (например, "Буст производства")
- Множитель (например, "x7")
- Оставшееся время (например, "25с")
- Прогресс-бар

**Анимации:**
- `animate-slide-in-right` — появление справа
- Плавное уменьшение прогресс-бара

#### SignalStats Component

Компонент статистики для панели настроек.

**Отображаемые метрики:**
- Перехвачено сигналов
- Пропущено сигналов
- Процент перехвата
- Кнопка вкл/выкл системы сигналов
- Подсказка о механике

**Интеграция:** в `SettingsPanel.tsx`, вкладка "Gameplay"

## Интеграция в игру

### App.tsx
```typescript
import { SignalOverlay } from './components/game/SignalOverlay';

// В рендере:
<SignalOverlay />
```

Компонент добавлен в корневой компонент после `EventNotificationToast`.

### useOptimizedGameLoop.ts
```typescript
// В игровом цикле:
const signalState = useGameStore.getState();
signalState.spawnNewSignal();
signalState.updateSignals();
```

Методы вызываются каждый кадр в главном игровом цикле.

### SettingsPanel.tsx
```typescript
import { SignalStats } from './SignalOverlay';

// В секции Gameplay:
<SignalStats />
```

Компонент статистики добавлен в панель настроек.

## Формулы и Баланс

### Частота появления

**Базовый интервал:**
```typescript
min = 2 минуты
max = 5 минут
average = 3.5 минуты
```

**Формула:**
```typescript
interval = random(120000, 300000) / frequencyMultiplier
```

### Награды

| Тип сигнала | Награда | Базовое значение |
|------------|---------|------------------|
| resource_cache | Ресурсы | 5 мин производства |
| production_boost | Буст | x7 на 30 сек |
| research_burst | RP | 30 RP |
| energy_surge | Энергия | Бесплатно на 1 мин |
| lucky_find | Ресурсы + кредиты | 5k ore + 10k credits |
| time_warp | Буст | x2 на 60 сек |
| golden_comet | Всё | 30 мин производства + 100k credits + 100 RP + 10 DM |

### Вероятности

| Тип | Вес | Шанс |
|-----|-----|------|
| resource_cache | 30 | 30% |
| production_boost | 25 | 25% |
| research_burst | 20 | 20% |
| energy_surge | 15 | 15% |
| lucky_find | 8 | 8% |
| time_warp | 2 | 2% |
| golden_comet | - | 5% (проверяется отдельно) |

### Время жизни сигнала

```typescript
SIGNAL_DURATION = 15 секунд
```

Игрок должен успеть кликнуть на сигнал в течение 15 секунд, иначе сигнал исчезает.

## Примеры использования

### Получение активного сигнала
```typescript
const signalInterception = useGameStore(state => state.signalInterception);
const activeSignal = signalInterception.activeSignal;

if (activeSignal) {
  console.log(`Сигнал: ${activeSignal.type}`);
  console.log(`Осталось: ${activeSignal.expiresAt - Date.now()}мс`);
}
```

### Клик по сигналу
```typescript
const claimSignal = useGameStore(state => state.claimSignal);

const handleClick = () => {
  if (activeSignal) {
    claimSignal(activeSignal.id);
  }
};
```

### Проверка активных бустов
```typescript
const activeBoosts = useGameStore(state => state.signalInterception.activeBoosts);

const totalMultiplier = activeBoosts.reduce((mult, boost) => 
  mult * boost.multiplier, 1
);
console.log(`Текущий множитель: x${totalMultiplier}`);
```

### Отключение сигналов
```typescript
const toggleSignals = useGameStore(state => state.toggleSignals);

// Выключить сигналы
toggleSignals(false);

// Включить обратно
toggleSignals(true);
```

## Тестирование

### Тестовые команды для консоли

```typescript
// Форсировать спавн сигнала сейчас
useGameStore.getState().set((state) => ({
  signalInterception: {
    ...state.signalInterception,
    nextSignalAt: Date.now() - 1000
  }
}));
useGameStore.getState().spawnNewSignal();

// Увеличить частоту сигналов (каждую минуту)
useGameStore.getState().set((state) => ({
  signalInterception: {
    ...state.signalInterception,
    signalFrequency: 10
  }
}));

// Создать golden comet вручную
const { spawnSignal } = require('./utils/signalHelpers');
const production = {
  ore: useGameStore.getState().resources.ore.perSecond,
  ice: useGameStore.getState().resources.ice.perSecond,
};
const signal = spawnSignal(production);
signal.type = 'golden_comet';
signal.reward = generateSignalReward('golden_comet', production);
useGameStore.getState().set((state) => ({
  signalInterception: {
    ...state.signalInterception,
    activeSignal: signal
  }
}));

// Добавить буст x10 на 5 минут
useGameStore.getState().set((state) => ({
  signalInterception: {
    ...state.signalInterception,
    activeBoosts: [
      ...state.signalInterception.activeBoosts,
      {
        id: 'test_boost',
        type: 'Тестовый буст',
        startedAt: Date.now(),
        expiresAt: Date.now() + 5 * 60 * 1000,
        multiplier: 10,
      }
    ]
  }
}));
```

## Будущие улучшения

### Возможные расширения:

1. **Множественные сигналы** — несколько сигналов одновременно
2. **Комбо-система** — бонус за серию перехваченных сигналов подряд
3. **Редкие сигналы** — особые события с уникальными наградами
4. **Сигналы-загадки** — нужно решить головоломку для получения награды
5. **Апгрейды сигналов** — улучшение частоты и наград за достижения
6. **Предсказание сигналов** — подсказки о типе следующего сигнала
7. **Сигналы-ловушки** — негативные эффекты при неправильном клике

### Балансировка:

- Мониторить процент перехвата игроками
- Корректировать частоту на основе среднего времени игры
- Добавить масштабирование наград в зависимости от прогресса
- Протестировать влияние на экономику

## Связанные файлы

- `src/core/gameTypes.ts` — определения типов
- `src/utils/signalHelpers.ts` — логика системы (400+ строк)
- `src/features/gameStore.ts` — методы хранилища
- `src/components/game/SignalOverlay.tsx` — UI компонент (250+ строк)
- `src/components/game/SettingsPanel.tsx` — интеграция статистики
- `src/hooks/useOptimizedGameLoop.ts` — вызов методов в игровом цикле
- `src/App.tsx` — рендер компонента

## Changelog

### v1.0.0 (Initial Implementation)
- ✅ 7 типов сигналов с разными наградами
- ✅ Система бустов с множителями
- ✅ Визуальная индикация на карте
- ✅ Таймеры и прогресс-бары
- ✅ Статистика перехватов
- ✅ Интеграция в игровой цикл
- ✅ Настройки (вкл/выкл)
- ✅ Золотая комета (редкий сигнал)
