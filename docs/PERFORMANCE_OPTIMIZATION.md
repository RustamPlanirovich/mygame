# Оптимизация производительности игры

## Проблема
Игра испытывала проблемы с производительностью:
- FPS падал до 21-30 (вместо целевых 60-120)
- requestAnimationFrame обработчик занимал 73ms+
- Консоль была заполнена предупреждениями о низком FPS

## Причины и решения

### 1. Разделение логики и рендеринга (КРИТИЧЕСКОЕ)
**Проблема:** tick() вызывался 60 раз в секунду, хотя игровая логика не требует такой частоты

**Решение:** Логика обновляется max 30 раз/сек, RAF работает на полной скорости
```typescript
const LOGIC_FPS = Math.min(targetFPS, 30);
const logicFrameTime = 1000 / LOGIC_FPS;

// Максимум 2 обновления за кадр (вместо 5)
const maxUpdates = 2;
```

### 2. O(N*M) циклы в tick() заменены на O(N)
**Проблема:** Каждый forEach по buildingsWithProximity делал Object.entries().filter() внутри

**Решение:** Используем pre-built tilesByBuildingId Map:
```typescript
// БЫЛО: O(Buildings * Tiles) каждый тик
buildingsWithProximity.forEach((b) => {
  const placedKeys = Object.entries(state.grid.tiles)
    .filter(([_, id]) => id === b.id)
    .map(([key]) => key);
});

// СТАЛО: O(Buildings) - map уже построен
for (const b of buildingsWithProximity) {
  const placedKeys = tilesByBuildingId.get(b.id);
}
```

### 3. Кэширование productionRates
**Проблема:** Пересчёт O(Tiles * Resources) каждый тик даже когда сетка не менялась

**Решение:** Кэш с проверкой по ссылке:
```typescript
const needsRecalc = 
  productionRatesCache.tilesRef !== state.grid.tiles ||
  productionRatesCache.tileLevelsRef !== state.grid.tileLevels ||
  !productionRatesCache.rates;

if (needsRecalc) {
  // Полный пересчёт
} else {
  productionRates = productionRatesCache.rates!;
}
```

### 4. for...in вместо Object.entries()
**Проблема:** Object.entries() создаёт новый массив каждый раз

**Решение:** for...in быстрее и не аллоцирует:
```typescript
// БЫЛО
for (const [key, value] of Object.entries(obj)) {}

// СТАЛО  
for (const key in obj) {
  const value = obj[key];
}
```

### 5. Реже проверяем достижения и сигналы
```typescript
// Достижения: раз в 10 сек (было 5)
if (achievementCheckRef.current >= 10) {
  queueMicrotask(() => checkAchievements(state));
}

// Сигналы: раз в 1 сек (было 0.5)
if (signalCheckRef.current >= 1) {
  signalState.spawnNewSignal();
}
```

### 6. Уменьшено логирование
- Логируем только при FPS < 30
- Не чаще раза в 5 секунд

## Ожидаемые результаты
- **tick() время:** 73ms → ~15-25ms
- **FPS:** 21-30 → 60-120
- **Логика:** 60 тиков/сек → 30 тиков/сек (достаточно для idle-игры)

## Дополнительные рекомендации

### Для достижения 120 FPS:
1. **Уменьшить LOGIC_FPS до 20** для слабых устройств
2. **Web Worker для tick()** - вынести всю логику в отдельный поток
3. **Виртуализация UI** - react-window для списков
4. **useDeferredValue** для некритичных обновлений
