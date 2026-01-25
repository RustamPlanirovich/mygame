# Оптимизация производительности игры

## Проблема
Игра испытывала проблемы с производительностью:
- FPS падал до 30-42 (вместо целевых 60)
- requestAnimationFrame обработчик занимал 80ms+
- Консоль была заполнена предупреждениями о низком FPS

## Причины

### 1. Частые вызовы Signal Interception методов
**Проблема:** `spawnNewSignal()` и `updateSignals()` вызывались **каждый кадр** (60 раз в секунду)

**Решение:** Добавлен throttling - вызов только раз в 0.5 секунды
```typescript
signalCheckRef.current += dt;
if (signalCheckRef.current >= 0.5) {
  const signalState = useGameStore.getState();
  signalState.spawnNewSignal();
  signalState.updateSignals();
  signalCheckRef.current = 0;
}
```

### 2. Частая проверка достижений
**Проблема:** Достижения проверялись каждые 2 секунды, что создавало нагрузку

**Решение:** Увеличен интервал проверки до 5 секунд
```typescript
if (achievementCheckRef.current >= 5) {
  const state = useGameStore.getState();
  checkAchievements(state);
  achievementCheckRef.current = 0;
}
```

### 3. Избыточное логирование FPS
**Проблема:** Консоль засорялась сообщениями о низком FPS при каждом падении ниже 48 FPS

**Решение:** Логирование только критических случаев (FPS < 30)
```typescript
if (fpsRef.current < 30 && time - (lastFpsUpdateRef.current - 3000) >= 3000) {
  console.warn(`[GameLoop] Low FPS: ${fpsRef.current}`);
}
```

### 4. Пересчет proximity multipliers каждый тик
**Проблема:** `updateAllProximityMultipliers()` - тяжелая функция, вызывалась каждый кадр даже когда сетка не изменялась

**Решение:** Добавлено кэширование результатов
```typescript
// Кэш для proximity вычислений
let proximityCache: {
  tilesHash: string;
  result: Building[];
} | null = null;

export function updateAllProximityMultipliers(
  buildings: Building[],
  tiles: Record<string, string>
): Building[] {
  // Проверяем кэш
  const tilesHash = createTilesHash(tiles);
  if (proximityCache && proximityCache.tilesHash === tilesHash) {
    return proximityCache.result;
  }
  // ... вычисления ...
  proximityCache = { tilesHash, result: updatedBuildings };
  return updatedBuildings;
}
```

## Результаты
- Сокращение вызовов Signal Interception с 60/сек до 2/сек (в 30 раз)
- Сокращение проверок достижений с 0.5/сек до 0.2/сек (в 2.5 раза)
- Кэширование proximity расчетов при неизменной сетке
- Уменьшение логирования в консоль

## Дополнительные рекомендации

### Если производительность всё ещё низкая:

1. **Уменьшить частоту обновления tick**
   - Изменить `targetFPS` с 60 до 30 для менее мощных устройств

2. **Оптимизировать tick функцию**
   - Профилировать с помощью Chrome DevTools Performance
   - Найти самые тяжелые циклы `forEach` по зданиям
   - Рассмотреть use Workers для тяжелых вычислений

3. **Batch обновления React**
   - Использовать `startTransition` для некритичных обновлений UI
   - Мемоизировать компоненты с помощью `React.memo()`

4. **Виртуализация списков**
   - Для больших списков зданий/ресурсов использовать react-window

5. **Debounce UI обновлений**
   - Не обновлять отображение ресурсов каждый кадр
   - Использовать throttle для обновления UI (например, раз в 100ms)
