# Daily Rewards System - Документация реализации

## Обзор

Система Daily Rewards (Ежедневные награды) — это механика удержания игроков, которая награждает за регулярные входы в игру. Система включает два основных компонента:

1. **Календарь ежедневных входов** — награды за каждый день входа подряд (стрик)
2. **Контейнеры с наградами по времени** — награды каждые 4 часа активной игры

## Архитектура

### Типы данных (gameTypes.ts)

```typescript
export interface DailyLoginState {
  currentDay: number;           // Текущий день стрика (1-7, циклично)
  lastLogin: number;            // Timestamp последнего входа
  streak: number;               // Текущая длина стрика
  longestStreak: number;        // Рекорд длины стрика
  totalLogins: number;          // Общее количество входов
  rewards: DailyReward[];       // Массив наград на 7 дней
}

export interface DailyReward {
  day: number;                  // День (1-7)
  claimed: boolean;             // Получена ли награда
  rewards: RewardItem[];        // Список наград
}

export interface RewardItem {
  resource: ResourceType;       // Тип ресурса
  amount: Decimal;              // Количество
}

export interface TimeBasedRewardsState {
  containers: RewardContainer[]; // Активные контейнеры
  lastCheck: number;             // Timestamp последней проверки
  totalClaimed: number;          // Всего собрано контейнеров
}

export interface RewardContainer {
  id: string;                    // Уникальный ID
  unlockedAt: number;            // Когда контейнер разблокирован
  rewards: RewardItem[];         // Содержимое контейнера
  claimed: boolean;              // Собран ли
}

export interface PlayerStats {
  totalPlayTime: number;         // Общее время игры в мс
  sessionsCount: number;         // Количество сессий
  lastSessionStart: number;      // Начало текущей сессии
}

export interface RetentionState {
  dailyLogin: DailyLoginState;
  timeBasedRewards: TimeBasedRewardsState;
  playerStats: PlayerStats;
}
```

### Helper Functions (dailyRewardsHelpers.ts)

#### generateDailyRewardsCalendar()
```typescript
export function generateDailyRewardsCalendar(): DailyReward[]
```

Генерирует календарь наград на 7 дней. Награды растут с каждым днём:
- День 1-3: базовые ресурсы (ore, ice, carbon)
- День 4-6: улучшенные ресурсы (steel, energy, robots)
- День 7: большая награда (темная материя + все ресурсы)

**Формулы наград:**
```typescript
// Базовые ресурсы (дни 1-3)
amount = baseAmount * (1.5 ^ day)

// Улучшенные ресурсы (дни 4-6)
amount = baseAmount * (2 ^ day)

// День 7 (мега-награда)
darkMatter = 50
allResources = baseAmount * 10
```

#### updateDailyLogin()
```typescript
export function updateDailyLogin(
  current: DailyLoginState,
  now: number
): DailyLoginState
```

Обновляет состояние ежедневного входа:
1. Проверяет, прошло ли достаточно времени с последнего входа (20+ часов)
2. Если да — проверяет непрерывность стрика
3. Если стрик сломан (пропущен день) — сбрасывает на день 1
4. Если стрик продолжается — переходит к следующему дню
5. Генерирует новые награды для нового цикла

**Логика проверки стрика:**
```typescript
const timeSinceLogin = now - current.lastLogin;
const isNextDay = timeSinceLogin > 20 * 60 * 60 * 1000;      // > 20 часов
const isContinuous = timeSinceLogin < 48 * 60 * 60 * 1000;    // < 48 часов

if (isNextDay) {
  if (isContinuous) {
    // Стрик продолжается
    newDay = (currentDay % 7) + 1;
    streak++;
  } else {
    // Стрик сломан
    newDay = 1;
    streak = 1;
  }
}
```

#### canClaimDailyReward()
```typescript
export function canClaimDailyReward(
  state: DailyLoginState,
  day: number
): boolean
```

Проверяет, можно ли забрать награду за конкретный день:
- День совпадает с текущим днём стрика
- Награда ещё не получена
- С последнего входа прошло достаточно времени

#### checkStreakContinuity()
```typescript
export function checkStreakContinuity(
  lastLogin: number,
  now: number
): boolean
```

Проверяет непрерывность стрика. Стрик не прерывается, если:
- С последнего входа прошло < 48 часов
- Это позволяет пропустить один день без потери прогресса

#### updateTimeBasedRewards()
```typescript
export function updateTimeBasedRewards(
  current: TimeBasedRewardsState,
  now: number
): TimeBasedRewardsState
```

Обновляет контейнеры с наградами по времени:
1. Проверяет, прошло ли 4 часа с последней проверки
2. Если да — создаёт новый контейнер с наградами
3. Максимум 3 активных контейнера одновременно
4. Старые контейнеры заменяются новыми

**Формула наград:**
```typescript
// Базовая награда зависит от количества собранных контейнеров
multiplier = 1 + (totalClaimed * 0.1);  // +10% за каждый собранный

rewards = {
  ore: 500 * multiplier,
  ice: 300 * multiplier,
  carbon: 200 * multiplier,
  steel: 100 * multiplier
}
```

#### formatTimeRemaining()
```typescript
export function formatTimeRemaining(ms: number): string
```

Форматирует время до следующего контейнера:
- "Через 3ч 45м"
- "Через 45м"
- "Через 5м"
- "Готово!"

### GameStore Methods

#### claimDailyReward()
```typescript
claimDailyReward: (day: number) => void
```

Забирает ежедневную награду:
1. Проверяет, можно ли забрать награду (через canClaimDailyReward)
2. Добавляет ресурсы в инвентарь
3. Помечает награду как полученную
4. Обновляет статистику

#### collectTimeBasedReward()
```typescript
collectTimeBasedReward: (containerId: string) => void
```

Собирает контейнер с наградой:
1. Находит контейнер по ID
2. Проверяет, что он не собран
3. Добавляет награды в инвентарь
4. Помечает контейнер как собранный
5. Увеличивает счётчик собранных контейнеров

#### checkAndUpdateDailyLogin()
```typescript
checkAndUpdateDailyLogin: () => void
```

Проверяет и обновляет состояние при входе:
1. Вызывается при загрузке игры (App.tsx)
2. Обновляет dailyLogin через updateDailyLogin()
3. Обновляет timeBasedRewards через updateTimeBasedRewards()
4. Увеличивает счётчик сессий
5. Обновляет время начала сессии

**Вызывается автоматически в App.tsx:**
```typescript
useEffect(() => {
  const loadGameState = async () => {
    await loadGame();
    checkAndUpdateDailyLogin(); // <-- здесь
  };
  loadGameState();
}, []);
```

## UI Components

### DailyRewardsPanel.tsx

Главная панель с наградами, содержит два раздела:

#### Календарь (7 дней)
```typescript
- Отображает награды на 7 дней вперёд
- Подсвечивает текущий день
- Показывает полученные награды (затемнённые)
- Кликабельные карточки для получения награды
- Отображение стрика с иконкой огня 🔥
```

**Визуальные состояния карточки:**
- Текущий день: зелёная рамка, увеличенный масштаб
- Полученная награда: затемнённая, галочка ✓
- Доступная для получения: hover-эффект, можно кликнуть
- Недоступная: серая рамка

#### Контейнеры по времени
```typescript
- Максимум 3 контейнера одновременно
- Каждый контейнер открывается через 4 часа
- Таймер до следующего контейнера
- Кнопка "Собрать" для каждого контейнера
- Список наград в каждом контейнере
```

**Визуальные состояния контейнера:**
- Доступен: пульсирующая зелёная кнопка
- Собран: затемнённый, галочка ✓
- Заблокирован: серая иконка замка

#### Статистика
```typescript
- Текущий стрик
- Рекорд стрика
- Всего входов
- Собрано контейнеров
```

### Интеграция в SidePanelTabs.tsx

Панель добавлена в навигацию:
```typescript
{
  id: 'rewards',
  label: 'Награды',
  icon: CalendarDays,
  Node: <DailyRewardsPanel />
}
```

Доступна через меню боковой панели.

## Формулы и Баланс

### Ежедневные награды

| День | Ресурсы | Множитель |
|------|---------|-----------|
| 1 | ore: 1000 | 1.5x |
| 2 | ice: 1000 | 1.5²x |
| 3 | carbon: 1000 | 1.5³x |
| 4 | steel: 500 | 2⁴x |
| 5 | energy: 1000 | 2⁵x |
| 6 | robots: 100 | 2⁶x |
| 7 | dark matter: 50 + все ресурсы | 10x |

### Контейнеры по времени

**Базовые награды:**
```typescript
ore: 500
ice: 300
carbon: 200
steel: 100
```

**Прогрессия:**
- +10% за каждый собранный контейнер
- После 10 контейнеров: 2x награды
- После 50 контейнеров: 6x награды
- После 100 контейнеров: 11x награды

### Временные интервалы

| Событие | Интервал | Цель |
|---------|----------|------|
| Обновление дня | 20+ часов | Награда за вход раз в день |
| Сброс стрика | 48+ часов | Можно пропустить 1 день |
| Новый контейнер | 4 часа | Награда за активную игру |
| Макс. контейнеров | 3 | Не копить слишком много |

## Примеры использования

### Получение ежедневной награды
```typescript
// В компоненте
const { claimDailyReward, retention } = useGameStore();

// Проверка доступности
const canClaim = canClaimDailyReward(retention.dailyLogin, 3); // день 3

// Получение награды
if (canClaim) {
  claimDailyReward(3);
}
```

### Сбор контейнера
```typescript
// В компоненте
const { collectTimeBasedReward, retention } = useGameStore();

// Найти доступный контейнер
const container = retention.timeBasedRewards.containers
  .find(c => !c.claimed);

if (container) {
  collectTimeBasedReward(container.id);
}
```

### Отображение времени до награды
```typescript
import { formatTimeRemaining } from '../../utils/dailyRewardsHelpers';

const { retention } = useGameStore();
const now = Date.now();
const nextContainerTime = retention.timeBasedRewards.lastCheck + (4 * 60 * 60 * 1000);
const timeLeft = nextContainerTime - now;

return (
  <div>
    До следующего: {formatTimeRemaining(timeLeft)}
  </div>
);
```

## Тестирование

### Тестовые команды для консоли

```typescript
// Симуляция входа через 24 часа
useGameStore.getState().set((state) => ({
  retention: {
    ...state.retention,
    dailyLogin: {
      ...state.retention.dailyLogin,
      lastLogin: Date.now() - 25 * 60 * 60 * 1000 // 25 часов назад
    }
  }
}));
useGameStore.getState().checkAndUpdateDailyLogin();

// Симуляция сломанного стрика (вход через 3 дня)
useGameStore.getState().set((state) => ({
  retention: {
    ...state.retention,
    dailyLogin: {
      ...state.retention.dailyLogin,
      lastLogin: Date.now() - 72 * 60 * 60 * 1000 // 72 часа назад
    }
  }
}));
useGameStore.getState().checkAndUpdateDailyLogin();

// Создание нового контейнера (через 4+ часа)
useGameStore.getState().set((state) => ({
  retention: {
    ...state.retention,
    timeBasedRewards: {
      ...state.retention.timeBasedRewards,
      lastCheck: Date.now() - 4.5 * 60 * 60 * 1000 // 4.5 часа назад
    }
  }
}));
useGameStore.getState().checkAndUpdateDailyLogin();

// Получить все награды (читерский режим)
const { claimDailyReward, retention } = useGameStore.getState();
retention.dailyLogin.rewards.forEach((reward, i) => {
  if (!reward.claimed) {
    claimDailyReward(i + 1);
  }
});
```

## Будущие улучшения

### Возможные расширения системы:

1. **Месячные награды** — бонус за 30 дней подряд
2. **Еженедельные задания** — дополнительные награды за выполнение целей
3. **Премиум контейнеры** — редкие контейнеры с уникальными наградами
4. **Система лотереи** — шанс выиграть большую награду
5. **Сезонные события** — особые награды в праздники
6. **Реферальная система** — награды за приглашение друзей
7. **Достижения за стрики** — особые ачивки за длинные стрики

### Балансировка:

- Мониторить средний стрик игроков
- Корректировать награды на основе прогресса
- Добавить бусты для возвращающихся игроков
- Протестировать формулы на большой выборке

## Связанные файлы

- `src/core/gameTypes.ts` — определения типов
- `src/utils/dailyRewardsHelpers.ts` — логика системы
- `src/features/gameStore.ts` — методы хранилища
- `src/components/game/DailyRewardsPanel.tsx` — UI компонент
- `src/components/game/SidePanelTabs.tsx` — интеграция в навигацию
- `src/App.tsx` — инициализация при загрузке

## Changelog

### v1.0.0 (Initial Implementation)
- ✅ Календарь ежедневных наград (7 дней)
- ✅ Система стриков с сохранением рекорда
- ✅ Контейнеры по времени (каждые 4 часа)
- ✅ Прогрессия наград с ростом
- ✅ UI с календарём и контейнерами
- ✅ Интеграция в боковую панель
- ✅ Автоматическая проверка при входе
- ✅ Статистика (стрики, входы, контейнеры)
