# Фаза 5: Продвинутые настройки фабрик

## Обзор

Фаза 5 добавляет систему тонкой настройки зданий, позволяющую игрокам оптимизировать производство через:

- **Режимы работы** - разные профили производства/потребления
- **Приоритеты** - распределение ресурсов при нехватке
- **Авто-продажа** - автоматическая продажа излишков
- **Условия** - автоматизация управления зданиями

## Файловая структура

```
src/
├── core/
│   └── gameTypes.buildings.ts   # Типы и константы для настроек зданий
├── utils/
│   └── priorityAllocator.ts     # Алгоритмы распределения ресурсов
├── features/
│   └── gameStore.ts             # Экшены и интеграция в tick
└── components/
    └── game/
        ├── TileInspector.tsx    # Кнопка "Настройки"
        └── building/
            └── BuildingSettingsPanel.tsx  # UI панель настроек
```

## Режимы работы (BuildingMode)

| Режим | Производство | Потребление | Энергия | Здоровье/час | Описание |
|-------|-------------|-------------|---------|--------------|----------|
| `normal` | 100% | 100% | 100% | 0% | Стандартный режим |
| `overclock` | 150% | 200% | 130% | -10% | Максимальная производительность, быстрый износ |
| `economy` | 70% | 50% | 60% | +5% | Экономия ресурсов, восстановление здоровья |
| `idle` | 0% | 10% | 10% | 0% | Минимальное потребление, без производства |
| `maintenance` | 0% | 0% | 0% | -1% | Ремонт здания (требует кредитов) |

## Приоритеты ресурсов

Шкала 1-5:
- **1** - Критический (получает ресурсы первым)
- **2** - Высокий
- **3** - Нормальный (по умолчанию)
- **4** - Низкий
- **5** - Минимальный (получает остатки)

### Алгоритмы распределения

1. **Strict Priority** (`allocateResource`) - строгое распределение по приоритету
2. **Weighted Fair** (`allocateResourceWeighted`) - справедливое взвешенное распределение

## Использование

### Открытие панели настроек

1. Выбрать здание на карте
2. Нажать кнопку "⚙️ НАСТРОЙКИ" в инспекторе тайла

### Вкладки панели

1. **Режим** - выбор режима работы, включение/отключение
2. **Приоритеты** - настройка приоритетов входа/выхода
3. **Авто-продажа** - настройка автоматической продажи
4. **Условия** - (планируется) условная логика

### Пресеты

- **Максимум** - overclock + высокий приоритет
- **Экономия** - economy + нормальный приоритет
- **Минимум** - idle + низкий приоритет

## API

### Экшены gameStore

```typescript
// Получить настройки здания
getTileSettings(tileKey: string): TileBuildingSettings | null

// Обновить настройки
updateTileSettings(tileKey: string, updates: Partial<TileBuildingSettings>): void

// Установить режим
setBuildingMode(tileKey: string, mode: BuildingMode): void

// Включить/отключить
setBuildingEnabled(tileKey: string, enabled: boolean): void

// Приоритеты
setInputPriority(tileKey: string, resource: ResourceType, priority: ResourcePriority): void
setOutputPriority(tileKey: string, priority: ResourcePriority): void

// Авто-продажа
updateAutoSell(tileKey: string, config: AutoSellConfig): void
removeAutoSell(tileKey: string, resource: ResourceType): void

// Условия
addBuildingCondition(tileKey: string, condition: BuildingCondition): void
removeBuildingCondition(tileKey: string, conditionId: string): void

// Массовые операции
setBuildingModeForAll(buildingId: string, mode: BuildingMode): void
repairBuilding(tileKey: string): void
repairAllBuildings(): void
```

### Структуры данных

```typescript
interface TileBuildingSettings {
  tileKey: string;
  buildingId: string;
  mode: BuildingMode;
  enabled: boolean;
  inputPriorities: Record<string, ResourcePriority>;
  outputPriority: ResourcePriority;
  autoSell: AutoSellConfig[];
  storageLimits: StorageLimit[];
  conditions: BuildingCondition[];
  health: number;
  lastRepairTime: number;
}
```

## Интеграция в игровой цикл

Множители режима применяются в функции `tick`:

1. Проверяется `tileDisabled` (старая система)
2. Проверяется `tileSettings.enabled` (новая система)
3. Получаются множители из `BUILDING_MODES[mode]`
4. Применяются к:
   - Производству (`productionMult`)
   - Потреблению (`consumptionMult`)
   - Энергии (`energyMult`)

## Кэширование

Production rates кэшируются и пересчитываются при изменении:
- `tileSettings`
- `tileDisabled`
- `tileLevels`
- `tileEvolutionLevels`

## Планы развития

- [ ] Система здоровья зданий и ремонт
- [ ] Условная автоматизация (if/then)
- [ ] Групповые настройки по типу здания
- [ ] Визуализация режима на карте
- [ ] Статистика производительности по режимам
