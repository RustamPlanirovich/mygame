# 🔄 Концепция "Условно Бесконечной" Игры

> **🎉 ПРОЕКТ ЗАВЕРШЕН! Все 6 фаз реализованы!**  
> **См. полный отчет:** [INFINITELY_COMPLETE.md](docs/INFINITELY_COMPLETE.md)  
> **Связь:** Расширяет механики из PLANGLOBAL.md  
> **Цель:** ✅ Достигнута - игра теперь бесконечная!

---

## 📊 Анализ Текущего Состояния

### ✅ Что УЖЕ Реализовано (из PLANGLOBAL.md)

| Механика | Статус | Примечание |
|----------|--------|------------|
| Престиж-система | ✅ Базовая | Quantum Points, 18 улучшений в 4 тирах |
| Дерево исследований | ✅ Полное | 7 эр, полностью разблокировано |
| Галактики | ✅ 7 галактик | Фиксированные, не процедурные |
| Мегаструктуры | ✅ 4 шт | Сфера Дайсона, Кольцо мира и др. |
| Достижения | ✅ 50+ | Работает, награды выдаются |
| Контракты | ✅ Базовые | В MarketPanel |
| Случайные события | ✅ Работает | 10+ типов событий |
| Уровни зданий | ✅ До 500 | Экспоненциальная стоимость |
| Политики | ✅ 33 шт | 6 категорий |
| Флот и бои | ✅ Работает | Корабли, враги, боссы |
| Офлайн-прогресс | ✅ Базовый | Накопление ресурсов |

### ⚠️ Ограничения Текущей Системы
- **Конечный контент:** 7 галактик, 4 концовки — после этого нечего делать
- **Линейный престиж:** Только 1 уровень престижа с 18 улучшениями
- **Фиксированные числа:** Нет поддержки чисел больше Number.MAX_SAFE_INTEGER
- **Статичные галактики:** Всегда одинаковые, нет реиграбельности

---

## 🎯 Что Нужно Добавить для "Бесконечности"

### 📌 Критически Важное (Must Have)

#### 1. 🔢 Система Больших Чисел
**Статус:** ✅ **ПОЛНОСТЬЮ РЕАЛИЗОВАНО** (25 декабря 2024)
**Приоритет:** ✅ Завершено (база для всего остального)

```typescript
// Интегрировать break_eternity.js
import Decimal from 'break_eternity.js';

// Обновить все ресурсы для поддержки Decimal
interface ResourceState {
  amount: Decimal;           // Вместо number
  production: Decimal;
  multiplier: Decimal;
}
```

**Изменения в существующем коде:**
- [x] ✅ Заменить `number` на `Decimal` в `gameStore.ts` для ресурсов
- [x] ✅ Создать хелперы форматирования `formatBigNumber()`
- [x] ✅ Обновить UI компоненты (`ResourcePanel`, `CurrencyPanel`)
- [x] ✅ Обновить расчёты в game loop
- [x] ✅ Создать полную документацию (`docs/BIG_NUMBERS.md`)
- [x] ✅ Создать тестовый файл с примерами (`utils/bigNumber.test.ts`)

**Реализовано:**
- 📦 Библиотека `break_eternity.js` v2.1.3
- 🔧 Полный набор хелперов в `utils/bigNumber.ts`:
  - `formatBigNumber()` - основное форматирование
  - `formatExact()` - точные значения
  - `formatPercent()` - проценты
  - `formatMultiplier()` - множители
  - `formatRate()` - производство/сек
  - `formatTime()` - форматирование времени
- 🎨 Единая точка входа в `core/math/format.ts`
- 📊 Все UI компоненты используют форматирование
- ⚡ Все расчеты в game loop работают с Decimal
- 📚 Полная документация с примерами
- 🧪 Тестовый файл для проверки

**Диапазон поддерживаемых чисел:** До **e1e308** (невообразимо огромные числа)

**См. также:**
- 📄 [Полная документация](docs/BIG_NUMBERS.md)
- 🧪 [Тесты и примеры](src/utils/bigNumber.test.ts)

---

#### 2. 🔄 Расширение Престиж-Системы (Ascension)
**Статус:** ✅ **ПОЛНОСТЬЮ РЕАЛИЗОВАНО** (25 декабря 2024)
**Приоритет:** ✅ Завершено

**Текущая система (сохранена):**
- Quantum Points (QP)
- 18 улучшений в 4 тирах
- Бонусы к производству, исследованиям

**Реализовано 2-й уровень — Ascension:**
```typescript
interface AscensionState {
  ascensionCount: number;           // Сколько раз вознёсся
  ascensionPoints: number;          // Очки вознесения (AP)
  lifetimeAscensionPoints: number;  // Всего AP за все время
  
  // Требования для Ascension
  requirements: {
    minPrestigeCount: 10;           // Минимум 10 престижей
    minQP: 1_000_000;               // Минимум 1M QP
    allMegastructures: true;        // Все мегаструктуры построены
  };
  
  // Бонусы Ascension (постоянные)
  multipliers: {
    qpGain: number;                 // +50% за каждое вознесение
    globalProduction: number;       // +10% ко всему производству
    researchSpeed: number;          // +20% к скорости исследований
    startingCredits: number;        // Начальные кредиты
  };
  
  // Разблокировки после Ascension
  unlocks: {
    infiniteResearch: boolean;      // Повторяемые исследования (1+ ascension)
    buildingEvolution: boolean;     // Эволюция зданий (2+ ascensions)
    proceduralGalaxies: boolean;    // Случайные галактики (3+ ascensions)
  };
  
  // Статистика
  stats: {
    totalAscensionTime: number;
    fastestAscension: number;
    totalQuantumPointsEarned: number;
  };
}
```

**Реализованные файлы:**
- ✅ `src/core/constants/ascension.ts` - константы, формулы, валидация
- ✅ `src/features/gameStore.ts` - методы `performAscension()`, `checkAscensionRequirements()`, `calculateAscensionGain()`
- ✅ `src/core/gameTypes.ts` - интерфейс `AscensionState` расширен
- ✅ `src/components/game/PrestigePanel.tsx` - добавлена вкладка "Вознесение" с UI

**Формула AP:**
```typescript
// AP = floor(log10(totalQP)) × ascensionCount
// Например: при 1M QP и первом вознесении = floor(log10(1000000)) × 1 = 6 AP
```

**Множители:**
- QP Gain: x(1 + ascensionCount × 0.5)
- Production: x(1 + ascensionCount × 0.1)
- Research: x(1 + ascensionCount × 0.2)

---

#### 3. 🔬 Повторяемые Исследования
**Статус:** ✅ **ПОЛНОСТЬЮ РЕАЛИЗОВАНО** (Phase 3 - 26 декабря 2024)
**Приоритет:** ✅ Завершено

```typescript
// Добавить в technologies.ts
interface RepeatableResearch {
  id: string;
  name: string;
  currentLevel: number;            // Бесконечный уровень
  maxLevelPerAscension: number;    // Лимит 100 за одно прохождение
  
  baseCost: Map<string, number>;
  costScaling: 1.5;                // cost * 1.5^level
  
  effect: {
    type: 'production' | 'efficiency' | 'speed';
    valuePerLevel: number;         // +2% за уровень
  };
}

const REPEATABLE_RESEARCHES: RepeatableResearch[] = [
  { id: 'automation_efficiency', name: 'Эффективность Автоматизации', valuePerLevel: 0.02 },
  { id: 'quantum_computing', name: 'Квантовые Вычисления', valuePerLevel: 0.03 },
  { id: 'matter_compression', name: 'Сжатие Материи', valuePerLevel: 0.01 },
  { id: 'energy_optimization', name: 'Оптимизация Энергии', valuePerLevel: 0.01 },
];
```

**Реализовано:**
- [x] ✅ `RepeatableResearch` типы в `gameTypes.ts`
- [x] ✅ 6 повторяемых исследований в `constants/repeatableResearch.ts`
- [x] ✅ Хелперы расчета в `utils/repeatableResearchHelpers.ts`
- [x] ✅ UI компоненты `RepeatableResearchItem.tsx`, `RepeatableResearchList.tsx`
- [x] ✅ Интеграция в `ResearchPanel.tsx` с новой вкладкой "Повторяемые"
- [x] ✅ Метод `researchRepeatable()` в gameStore с проверками
- [x] ✅ 7 достижений для повторяемых исследований
- [x] ✅ Сохранение истории при Ascension
- [x] ✅ Тестовые команды для дебага

**Исследования:**
1. **Automation Efficiency** - ускорение автоматизации (+2%/ур)
2. **Quantum Computing** - бонус к QP (+3%/ур)
3. **Matter Compression** - производство базовых ресурсов (+1%/ур)
4. **Energy Optimization** - эффективность энергии (+1%/ур)
5. **Neural Networks** - скорость исследований (+2%/ур)
6. **Dark Matter Manipulation** - экзотические ресурсы (+5%/ур)

**Документация:** `docs/REPEATABLE_RESEARCH_IMPLEMENTATION.md`

---

#### 4. 🏗️ Эволюция Зданий
**Статус:** ✅ **ПОЛНОСТЬЮ РЕАЛИЗОВАНО** (Phase 4 - 26 декабря 2024)
**Приоритет:** ✅ Завершено

**Концепция:** При достижении уровня 100/250/500 здание можно "эволюционировать" за Quantum Points и Credits.

```typescript
interface BuildingEvolution {
  baseBuilding: string;            // 'solar_panel_mk1'
  evolutionLevel: number;          // 0, 1, 2, 3...
  
  evolutions: Array<{
    level: number;                 // Требуемый уровень здания (100, 250, 500)
    name: string;                  // 'Dyson Swarm Element'
    nameRu: string;                // 'Элемент Роя Дайсона'
    multiplier: number;            // x2, x5, x10
    cost: {
      credits: Decimal;            // Стоимость в кредитах
      quantum_points: Decimal;     // Стоимость в QP
    };
    description?: string;          // Описание эволюции
    visualUpgrade: string;         // Новая иконка/emoji
  }>;
}

const BUILDING_EVOLUTIONS: Record<string, BuildingEvolutionConfig> = {
  'solar_panel': {
    buildingType: 'solar_panel_mk1',
    tiers: [
      { level: 100, name: 'Orbital Solar Array', nameRu: 'Орбитальная Солнечная Батарея', 
        multiplier: 2, cost: { credits: new Decimal(5e5), quantum_points: new Decimal(50) } },
      { level: 250, name: 'Dyson Swarm Element', nameRu: 'Элемент Роя Дайсона',
        multiplier: 5, cost: { credits: new Decimal(5e7), quantum_points: new Decimal(500) } },
      { level: 500, name: 'Star Lifter', nameRu: 'Звездный Подъёмник',
        multiplier: 10, cost: { credits: new Decimal(5e10), quantum_points: new Decimal(5000) } },
    ]
  },
  // ... 14 типов зданий всего
};
```

**Реализовано:**
- [x] ✅ `constants/buildingEvolutions.ts` - 14 типов зданий × 3 эволюции (42 эволюции)
  * Энергия: solar_panel, reactor
  * Добыча: iron_mine, copper_mine, silicon_mine, titanium_mine
  * Производство: factory, refinery
  * Специальные: lab, warehouse, turret, shield_generator, trading_post
- [x] ✅ `TileInspector.tsx` - полный UI с:
  * Прогресс-баром до следующей эволюции
  * Показ текущей эволюции с множителем
  * Кнопка эволюции (с проверкой unlock, уровня, стоимости)
  * Красивый градиентный дизайн
- [x] ✅ `FactoryGrid.tsx` - визуальные индикаторы:
  * Замена emoji здания на visualUpgrade при эволюции
  * Звездочка ⭐ для эволюционированных зданий
- [x] ✅ `gameTypes.ts` - расширены типы:
  * `BuildingEvolutionTier` с полем `cost`
  * `tileEvolutionLevels` в GridState
- [x] ✅ `gameStore.ts` - метод `evolveBuildingAt()` с полной логикой:
  * Проверка unlock (ascension.unlocks.buildingEvolution)
  * Проверка уровня здания
  * Проверка и списание стоимости (credits + QP)
  * Обновление evolutionLevel
  * Добавление в eventLog
  * Статистика эволюций
- [x] ✅ Интеграция в game loop - множители применяются к производству через `getEvolutionMultiplier()`
- [x] ✅ Хелперы в `buildingEvolutions.ts`:
  * `getNextEvolution()` - следующая доступная эволюция
  * `getCurrentEvolution()` - текущая эволюция
  * `getEvolutionMultiplier()` - множитель производства
  * `canEvolve()` - проверка возможности эволюции
  * `getEvolutionProgress()` - прогресс до следующей

**Эволюции:**
1. **Tier 1 (Уровень 100)**: ×2 множитель - Стоимость ~500k Credits + ~50 QP
2. **Tier 2 (Уровень 250)**: ×5 множитель - Стоимость ~50M Credits + ~500 QP
3. **Tier 3 (Уровень 500)**: ×10 множитель - Стоимость ~50B Credits + ~5000 QP

**Разблокировка:** Требуется 2+ Ascension (ascension.unlocks.buildingEvolution)

**Примеры эволюций:**
- **Solar Panel**: Orbital Solar Array → Dyson Swarm Element → Star Lifter
- **Reactor**: Fusion Reactor → Antimatter Reactor → Zero Point Reactor
- **Iron Mine**: Deep Core Excavator → Planetary Extractor → Star Mining Station
- **Factory**: Mega Factory → Automated Complex → Molecular Assembler

---

### 📌 Желательное (Should Have)

#### 5. 🌌 Процедурные Галактики
**Статус:** ✅ **ПОЛНОСТЬЮ РЕАЛИЗОВАНО** (Phase 5 - 26 декабря 2024)
**Приоритет:** ✅ Завершено

**Концепция:** После 7 базовых галактик игрок может генерировать бесконечные процедурные галактики с уникальными свойствами.
  return {
    seed,
    galaxyNumber,
    generated: {
      name: generateGalaxyName(rng),
      resourceModifiers: generateResourceModifiers(rng),
      difficulty: 1 + galaxyNumber * 0.1,
      specialFeature: rollSpecialFeature(rng),
    },
    // ...
  };
}
```

**Реализовано:**
- [x] ✅ Установлена библиотека `seedrandom` для детерминистичной генерации
- [x] ✅ Создан генератор галактик `utils/galaxyGenerator.ts`:
  - Генерация имён из префиксов и суффиксов
  - Генерация модификаторов ресурсов (6 групп ресурсов)
  - Генерация специальных особенностей (черные дыры, туманности, квазары, руины)
  - Расчёт сложности (растёт экспоненциально)
  - Генерация наград (уникальные бонусы, артефакты)
- [x] ✅ Типы `ProceduralGalaxy` и `ProceduralGalaxyState` уже были в `gameTypes.ts`
- [x] ✅ Добавлены методы в `gameStore.ts`:
  - `generateProceduralGalaxy()` - генерирует новую галактику
  - `exploreProceduralGalaxy()` - исследует галактику
- [x] ✅ UI компонент расширен в `GalaxyMap.tsx`:
  - Новый раздел "Процедурные Галактики"
  - Отображение сгенерированных галактик
  - Кнопка генерации новой галактики
  - Кнопка исследования галактики
  - Визуализация специальных особенностей с цветами
  - Отображение модификаторов ресурсов
  - Отображение наград и артефактов
- [x] ✅ Добавлено 9 достижений для процедурных галактик:
  - `first_procedural` - Первая процедурная галактика
  - `galaxy_explorer` - 5 галактик
  - `galaxy_master` - 10 галактик
  - `black_hole_survivor` - Галактика с черной дырой
  - `nebula_dancer` - Галактика с туманностью
  - `quasar_seeker` - Галактика с квазаром
  - `ancient_ruins` - Галактика с руинами
  - `deep_space_veteran` - 25 галактик (скрытое)
  - `infinity_explorer` - 50 галактик (скрытое)

**Особенности генератора:**
- Детерминистичная генерация на основе seed
- 20 префиксов и 20 суффиксов имён (400 комбинаций)
- 24 греческих букв для альтернативных имён
- 6 групп ресурсов с разными бонусами/штрафами
- 4 типа специальных особенностей
- Сложность растёт с номером галактики
- Стоимость открытия: 1,000,000 × 1.5^(n-8) кредитов

**Разблокировка:**
- Требуется 3+ вознесений (Ascension)
- Проверка в `ascension.unlocks.proceduralGalaxies`

**Хелперы:**
- `getSpecialFeatureDescription()` - описание особенности
- `getSpecialFeatureColor()` - цвет для UI
- `canDiscoverProceduralGalaxy()` - проверка разблокировки
- `getDiscoveryCost()` - стоимость открытия галактики

---

#### 6. 🎁 Система Артефактов
**Статус:** ✅ **ПОЛНОСТЬЮ РЕАЛИЗОВАНО** (Phase 6 - 26 декабря 2024)
**Приоритет:** ✅ Завершено

**Концепция:** Артефакты - это мощные предметы с уникальными бонусами, которые можно находить, экипировать и улучшать. Они выпадают из процедурных галактик, достижений и вознесений.

**Реализовано:**
- [x] ✅ Система 5 редкостей (common, rare, epic, legendary, mythic)
- [x] ✅ 10 типов эффектов артефактов
- [x] ✅ Система слотов (2-10 слотов, растёт с вознесениями)
- [x] ✅ Генерация артефактов из галактик (5-20% шанс)
- [x] ✅ Система улучшения артефактов (1-10 уровень, +20% эффект за уровень)
- [x] ✅ UI компонент `ArtifactsPanel.tsx` с инвентарём и экипировкой
- [x] ✅ Интеграция множителей в game loop
- [x] ✅ 11 шаблонов артефактов с уникальными названиями

**Типы эффектов:**
- `globalProduction` — +5-200% ко всему производству
- `researchSpeed` — +5-200% к скорости исследований
- `buildingEfficiency` — +5-200% к эффективности зданий
- `expeditionSuccess` — +5-200% к успеху экспедиций
- `combatPower` — +5-200% к боевой мощи флота
- `energyCapacity` — +5-200% к максимальной энергии
- `prestigeGain` — +5-200% к получению QP
- `ascensionPoints` — +5-200% к получению AP
- `galaxyUnlockCost` — -5-200% к стоимости открытия галактик
- `resourceProduction` — +5-200% к производству конкретного ресурса

**Система редкости:**
```typescript
const RARITY_CONFIGS = {
  common: {
    color: '#9CA3AF',      // Серый
    effectRange: [5, 15],  // 5-15% эффект
    slots: 1,              // Занимает 1 слот
    dropRate: 45,          // 45% шанс
  },
  rare: {
    color: '#3B82F6',      // Синий
    effectRange: [15, 30],
    slots: 1,
    dropRate: 30,          // 30% шанс
  },
  epic: {
    color: '#8B5CF6',      // Фиолетовый
    effectRange: [30, 50],
    slots: 2,
    dropRate: 15,          // 15% шанс
  },
  legendary: {
    color: '#F59E0B',      // Оранжевый
    effectRange: [50, 100],
    slots: 2,
    dropRate: 8,           // 8% шанс
  },
  mythic: {
    color: '#EF4444',      // Красный
    effectRange: [100, 200],
    slots: 3,
    dropRate: 2,           // 2% шанс
  },
};
```

**Источники получения:**
1. **Galaxy Exploration** — при открытии процедурных галактик
   - Шанс: 5-10% за галактику
   - Редкость зависит от номера галактики
2. **Boss Defeats** — после победы над боссами (будущая фича)
   - Гарантированный drop редких+
3. **Events** — случайные события
   - Специальные уникальные артефакты
4. **Achievements** — награда за достижения
   - Легендарные артефакты за сложные достижения
5. **Ascension Milestones** — за определенное количество AP
   - Мифические артефакты за большие вехи

**Система улучшения:**
```typescript
interface ArtifactUpgrade {
  level: number;
  cost: {
    credits: Decimal;
    qp?: Decimal;         // Для epic+
    ap?: Decimal;         // Для mythic
  };
  effectMultiplier: number; // 1.2x на уровень
}

// Формула стоимости
const upgradeCost = (artifact: Artifact) => {
  const baseCost = RARITY_CONFIGS[artifact.rarity].baseCost;
  const costMultiplier = 1.5;
  return baseCost * Math.pow(costMultiplier, artifact.level);
};
```

**Ограничения экипировки:**
- Начально: 2 слота (можно экипировать 2 артефакта)
- +1 слот за каждые 5 Ascension
- Максимум: 10 слотов
- Epic/Legendary/Mythic занимают больше слотов
- Нельзя экипировать 2 одинаковых артефакта

**Интеграция с существующей системой:**
```typescript
// В gameStore.ts
interface GameState {
  // ... существующие поля
  artifacts: ArtifactState;
}

// Применение бонусов в game loop
const applyArtifactBonuses = (state: GameState) => {
  let multipliers = { /* базовые множители */ };
  
  state.artifacts.equipped.forEach(artifact => {
    artifact.effects.forEach(effect => {
      const effectValue = effect.value * (1 + artifact.level * 0.2);
      multipliers[effect.stat] = (multipliers[effect.stat] || 1) * 
        (1 + effectValue / 100);
    });
  });
  
  return multipliers;
};
```

**UI компонент:**
```typescript
// components/game/ArtifactsPanel.tsx
const ArtifactsPanel = () => {
  return (
    <div className="artifacts-panel">
      {/* Секция экипированных артефактов */}
      <div className="equipped-artifacts">
        <h3>Экипированные ({equipped.length}/{maxSlots})</h3>
        {equipped.map(artifact => (
          <ArtifactCard 
            artifact={artifact} 
            onUnequip={handleUnequip}
            onUpgrade={handleUpgrade}
          />
        ))}
      </div>
      
      {/* Инвентарь */}
      <div className="artifact-inventory">
        <h3>Инвентарь ({discovered.length})</h3>
        <div className="filter-tabs">
          {['all', 'common', 'rare', 'epic', 'legendary', 'mythic']
            .map(rarity => <Tab key={rarity} />)}
        </div>
        <div className="artifact-grid">
          {filteredArtifacts.map(artifact => (
            <ArtifactCard 
              artifact={artifact} 
              onEquip={handleEquip}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
```

**План реализации:**
1. Добавить типы в `core/gameTypes.ts`
2. Создать `utils/artifactHelpers.ts` с логикой генерации
3. Добавить состояние в `gameStore.ts`
4. Создать `ArtifactsPanel.tsx` компонент
5. Интегрировать получение артефактов в существующие системы:
   - Galaxy exploration
   - Achievements
   - Ascension milestones
6. Добавить множители в game loop
7. Создать систему сохранения/загрузки

**Балансировка:**
- Первый артефакт: при открытии 10-й галактики
- Слоты растут медленно, чтобы создать выбор
- Редкие артефакты — реальная награда за прогресс
- Улучшения дорогие, но значимые (+20% эффекта на уровень)

---

## 🛠️ План Реализации (с учётом существующего кода)

### 🔴 Phase 1: Большие Числа (2-3 дня)
**Приоритет:** Критический — без этого бесконечность невозможна

| Задача | Файлы для изменения | Сложность |
|--------|---------------------|-----------|
| Установить break_eternity.js | `package.json` | ⭐ |
| Создать утилиты форматирования | `utils/bigNumber.ts` (новый) | ⭐⭐ |
| Обновить типы ресурсов | `core/gameTypes.ts` | ⭐⭐⭐ |
| Обновить gameStore | `features/gameStore.ts` | ⭐⭐⭐⭐ |
| Обновить UI компоненты | `ResourcePanel.tsx`, `CurrencyPanel.tsx` | ⭐⭐ |
| Тестирование | — | ⭐⭐ |

**⚠️ Важно:** Это затронет МНОГО кода. Делать аккуратно, с тестами.

---

### 🟡 Phase 2: Ascension — 2-й уровень престижа (В ПРОЦЕССЕ)
**Статус:** 🟡 Частично реализовано (25.12.2025)
**Приоритет:** Высокий — расширение существующей системы

#### ✅ Выполненные задачи:
- [x] **Типы и структуры**
  - [x] Добавлен AscensionState в `core/gameTypes.ts`
  - [x] Добавлены AscensionRequirements, AscensionMultipliers, AscensionUnlocks
  - [x] Расширен GameState с ascension полем
- [x] **GameStore логика**
  - [x] INITIAL_ASCENSION состояние
  - [x] checkAscensionRequirements() метод
  - [x] calculateAscensionGain() метод
  - [x] performAscension() метод с полным сбросом
- [x] **UI компоненты**
  - [x] Добавлена вкладка "Вознесение" в PrestigePanel.tsx
  - [x] Отображение статистики AP (Ascension Points)
  - [x] Отображение множителей и разблокировок
  - [x] Отображение требований
  - [x] Кнопка вознесения
- [x] **Константы**
  - [x] Создан repeatableResearch.ts с 6 исследованиями

#### ❌ Оставшиеся задачи:
- [x] **Интеграция множителей в игровой цикл** ✅ (25.12.2025)
  - [x] Применить ascension.multipliers.globalProduction в game loop
  - [x] Применить ascension.multipliers.researchSpeed в game loop
  - [x] Применить ascension.multipliers.qpGain при расчете престижа
  - [x] Применить ascension.multipliers.startingCredits при престиже
- [x] **Проверка мегаструктур** ✅ (25.12.2025)
  - [x] Исправить проверку "Все мегаструктуры построены" в checkAscensionRequirements
- [ ] **Сохранение/Загрузка**
  - [ ] Добавить миграцию сохранений для новых полей
  - [ ] Тестировать сохранение/загрузку с Ascension данными
- [ ] **Балансировка**
  - [ ] Протестировать формулы AP получения
  - [ ] Настроить множители (сейчас +50% QP, +10% prod, +20% research)

**Совместимость:** ✅ Не ломает текущий престиж. Ascension — дополнительный слой поверх.

**Статус Phase 2:** 🟢 95% готово - осталось только тестирование и балансировка

---

### � Phase 3: Повторяемые Исследования (НЕ НАЧАТО)
**Статус:** ⏳ Ожидает начала
**Приоритет:** Средний — разблокируется после первого Ascension
**Оценка:** 2-3 дня

#### ✅ Подготовительные задачи (выполнено):
- [x] Создан `constants/repeatableResearch.ts` с 6 исследованиями
- [x] Добавлены типы RepeatableResearch в `gameTypes.ts`
- [x] Добавлено RepeatableResearchState в GameState

#### ❌ Основные задачи:
- [ ] **UI компоненты**
  - [ ] Создать вкладку "Повторяемые" в ResearchPanel.tsx
  - [ ] Показывать только если ascension.unlocks.infiniteResearch === true
  - [ ] Отображать текущий уровень / макс уровень за Ascension
  - [ ] Показывать стоимость следующего уровня
  - [ ] Показывать эффект за уровень и общий эффект
  - [ ] Кнопка "Исследовать" с проверкой доступности
- [ ] **Логика в gameStore**
  - [ ] Доработать researchRepeatable() метод
  - [ ] Проверка стоимости ресурсов
  - [ ] Проверка maxLevelPerAscension
  - [ ] Списание ресурсов при покупке
  - [ ] Уведомление о покупке
- [ ] **Интеграция в игровой цикл**
  - [ ] Применить бонусы от повторяемых исследований в calculateProduction()
  - [ ] Автоматизация (если есть исследование)
  - [ ] Расчет эффектов всех активных исследований
- [ ] **Сброс при Ascension**
  - [ ] При performAscension() обнулять текущие уровни до 0
  - [ ] Сохранять историю максимальных уровней (для статистики)
  - [ ] Показывать в UI сколько раз исследование было макс-левела
- [ ] **Формулы и балансировка**
  - [ ] Стоимость: baseCost × (1.5 ^ currentLevel)
  - [ ] Эффект: valuePerLevel × currentLevel
  - [ ] maxLevelPerAscension = 100 + (ascensionCount × 25) — растет с вознесениями
- [ ] **Статистика**
  - [ ] Отслеживать total research points потрачено
  - [ ] Отслеживать highest level достигнутый
  - [ ] Отслеживать total upgrades куплено
- [ ] **Тестирование**
  - [ ] Проверить покупку на разных уровнях
  - [ ] Проверить сброс при Ascension
  - [ ] Проверить применение бонусов
  - [ ] Проверить UI обновление

**Описание механики:**
Повторяемые исследования — это бесконечно улучшаемые технологии, которые разблокируются после первого Ascension. В отличие от обычных исследований из дерева (которые можно купить один раз), повторяемые можно прокачивать до бесконечности, но с ограничением по уровню за одно прохождение.

**Список повторяемых исследований:**
1. **Automation Efficiency** (Эффективность Автоматизации)
   - Базовая стоимость: 1M Credits
   - Эффект: +2% к скорости автопокупок зданий
   - Стоимость растет: ×1.5 за уровень

2. **Quantum Computing** (Квантовые Вычисления)
   - Базовая стоимость: 500K Quantum Points
   - Эффект: +3% к получению QP
   - Стоимость растет: ×1.5 за уровень

3. **Matter Compression** (Сжатие Материи)
   - Базовая стоимость: 10M Iron + 5M Copper + 1M Silicon
   - Эффект: +1% к производству всех базовых ресурсов
   - Стоимость растет: ×1.5 за уровень

4. **Energy Optimization** (Оптимизация Энергии)
   - Базовая стоимость: 50M Energy
   - Эффект: +1% снижение потребления энергии всеми зданиями
   - Стоимость растет: ×1.5 за уровень

5. **Neural Networks** (Нейронные Сети)
   - Базовая стоимость: 100K Data + 1M Credits
   - Эффект: +2% к скорости обычных исследований
   - Стоимость растет: ×1.5 за уровень

6. **Dark Matter Manipulation** (Манипуляция Темной Материей)
   - Базовая стоимость: 10K Dark Matter + 1M Antimatter
   - Эффект: +1.5% к производству экзотических ресурсов
   - Стоимость растет: ×1.5 за уровень

**Формула расчета стоимости:**
```typescript
function calculateRepeatableCost(base: ResourceCost, level: number): ResourceCost {
  const scaling = 1.5;
  return mapResourceCost(base, amount => amount * Math.pow(scaling, level));
}
```

**Формула расчета эффекта:**
```typescript
function calculateRepeatableEffect(valuePerLevel: number, currentLevel: number): number {
  return 1 + (valuePerLevel * currentLevel); // Мультипликативный бонус
}

// Пример: Automation Efficiency уровень 50
// Эффект = 1 + (0.02 × 50) = 1 + 1.0 = 2.0 (удвоенная скорость)
```

**Лимит уровня за прохождение:**
```typescript
function getMaxLevelPerAscension(ascensionCount: number): number {
  return 100 + (ascensionCount * 25);
}

// При 0 ascensions: недоступно
// При 1 ascension: макс 125 уровень
// При 2 ascensions: макс 150 уровень
// При 5 ascensions: макс 225 уровень
```

**Примерная стоимость прогрессии (Automation Efficiency):**
- Уровень 1: 1M Credits
- Уровень 10: 57.67M Credits
- Уровень 25: 1.88B Credits
- Уровень 50: 637.62B Credits
- Уровень 100: 405.88Q Credits (квадриллионы)

**UI макет:**
```
┌─────────────────────────────────────────────────┐
│ 🔬 Повторяемые Исследования                    │
├─────────────────────────────────────────────────┤
│                                                 │
│ [Automation Efficiency]    Уровень: 45 / 125   │
│ ⚡ +90% к скорости автопокупок                  │
│                                                 │
│ Следующий уровень: +2% (всего +92%)            │
│ Стоимость: 125.3B Credits                      │
│                                                 │
│ [Исследовать] ✓                                │
│                                                 │
├─────────────────────────────────────────────────┤
│                                                 │
│ [Quantum Computing]        Уровень: 30 / 125   │
│ 💎 +90% к получению Quantum Points             │
│                                                 │
│ Следующий уровень: +3% (всего +93%)            │
│ Стоимость: 637.6M QP                           │
│                                                 │
│ [Исследовать] ✓                                │
│                                                 │
├─────────────────────────────────────────────────┤
│ ... еще 4 исследования ...                     │
└─────────────────────────────────────────────────┘
```

**Интеграция с существующей системой:**
- Повторяемые исследования **НЕ сбрасывают** обычное дерево технологий
- Они **дополняют** бонусы от обычных исследований
- Доступны **только после** первого Ascension
- Уровни **обнуляются** при каждом новом Ascension (для реиграбельности)
- История **сохраняется** для статистики и достижений

**Достижения (новые):**
- "First Steps of Infinity" — Первое повторяемое исследование уровень 1
- "Century Researcher" — Любое повторяемое исследование уровень 100
- "Research Addict" — Все повторяемые исследования уровень 50+
- "Infinite Mind" — Суммарно 1000 уровней повторяемых исследований
- [ ] **Интеграция эффектов в game loop**
  - [ ] Получить бонусы через getTotalRepeatableBonuses()
  - [ ] Применить productionMultiplier к производству
  - [ ] Применить researchSpeedMultiplier к исследованиям
  - [ ] Применить capacityMultiplier к хранилищам
  - [ ] Применить efficiencyMultiplier к эффективности
- [ ] **Сброс при Ascension**
  - [ ] Уровни сбрасываются в performAscension() (уже есть)
  - [ ] Сохранить историю максимальных уровней (опционально)
- [ ] **Тестирование**
  - [ ] Проверить покупку исследований
  - [ ] Проверить применение бонусов
  - [ ] Проверить сброс при Ascension

**Совместимость:** ✅ Не затрагивает существующее дерево технологий (7 эр).

**📄 Детальный план реализации:** См. [docs/REPEATABLE_RESEARCH_IMPLEMENTATION.md](docs/REPEATABLE_RESEARCH_IMPLEMENTATION.md)

---

### � Phase 4: Эволюция Зданий (НЕ НАЧАТО)
**Статус:** ⏳ Ожидает начала
**Приоритет:** Средний — разблокируется после 2-го Ascension
**Оценка:** 3-4 дня

#### ✅ Подготовительные задачи (выполнено):
- [x] Добавлены типы BuildingEvolution в `gameTypes.ts`
- [x] Добавлен метод-заглушка evolveBuildingAt() в gameStore

#### ❌ Основные задачи:
- [ ] **Константы эволюций**
  - [ ] Создать `constants/buildingEvolutions.ts`
  - [ ] Определить эволюции для каждого типа зданий
    - [ ] Solar Panel → Orbital Array → Dyson Swarm → Star Lifter
    - [ ] Iron Mine → Deep Core → Planetary Extractor → Star Mining
    - [ ] Factory → Mega Factory → Automated Complex → Molecular Assembler
    - [ ] И т.д. для всех зданий (~20 зданий × 3 эволюции)
  - [ ] Задать множители (×2 на 100 lvl, ×5 на 250, ×10 на 500)
  - [ ] Добавить уникальные способности для некоторых эволюций
- [ ] **Расширение типов**
  - [ ] Добавить evolutionLevel: number в Building interface
  - [ ] Добавить evolutionTier: number для визуализации
- [ ] **Логика в gameStore**
  - [ ] Реализовать evolveBuildingAt() полностью
  - [ ] Проверка: здание достигло уровня 100/250/500
  - [ ] Проверка: ascension.unlocks.buildingEvolution === true
  - [ ] Проверка: следующая эволюция доступна
  - [ ] Применение эволюции (увеличить evolutionLevel)
  - [ ] Уведомление об эволюции
- [ ] **UI компоненты**
  - [ ] Обновить TileInspector.tsx
    - [ ] Показывать текущую эволюцию (если есть)
    - [ ] Показывать прогресс до следующей эволюции
    - [ ] Кнопка "Эволюционировать" (если доступно)
    - [ ] Показывать новые способности после эволюции
  - [ ] Обновить FactoryGrid.tsx
    - [ ] Визуальные индикаторы эволюции (звездочки, свечение)
    - [ ] Цветовая кодировка по уровню эволюции
    - [ ] Обновленные иконки (опционально)
- [ ] **Интеграция в game loop**
  - [ ] Применять множители эволюции к производству
  - [ ] getEvolutionMultiplier() функция
  - [ ] Учитывать в расчетах производства ресурсов
- [ ] **Сохранение/Загрузка**
  - [ ] Сохранять evolutionLevel для каждого здания
  - [ ] Миграция старых сохранений
- [ ] **Тестирование**
  - [ ] Проверить эволюцию зданий на разных уровнях
  - [ ] Проверить применение множителей
  - [ ] Проверить визуализацию

**Совместимость:** ✅ Расширяет систему уровней зданий (1-500). Эволюция на 100/250/500.

---

### � Phase 5: Процедурные Галактики (НЕ НАЧАТО)
**Статус:** ⏳ Ожидает начала
**Приоритет:** Низкий — разблокируется после 3-го Ascension
**Оценка:** 4-5 дней

#### ✅ Подготовительные задачи (выполнено):
- [x] Добавлены типы ProceduralGalaxy в `gameTypes.ts`
- [x] Добавлено ProceduralGalaxyState в GameState
- [x] Добавлены методы-заглушки в gameStore

#### ❌ Основные задачи:
- [ ] **Установка зависимостей**
  - [ ] Установить `seedrandom` пакет
  - [ ] Добавить типы @types/seedrandom
- [ ] **Генератор галактик**
  - [ ] Создать `utils/galaxyGenerator.ts`
  - [ ] Функция generateGalaxy(seed, galaxyNumber)
  - [ ] Генерация имен галактик (generateGalaxyName)
    - [ ] Префиксы: "Туманность", "Система", "Кластер"
    - [ ] Суффиксы: греческие буквы, номера, названия
  - [ ] Генерация модификаторов ресурсов
    - [ ] Случайные бонусы/штрафы к производству ресурсов
    - [ ] Диапазон: 0.5x - 2.0x для каждого ресурса
  - [ ] Генерация сложности (1.0 + galaxyNumber × 0.1)
  - [ ] Генерация специальных особенностей
    - [ ] Черная дыра (бонус к dark_matter)
    - [ ] Туманность (бонус к energy)
    - [ ] Квазар (бонус к research)
    - [ ] Руины (уникальный артефакт)
- [ ] **Логика в gameStore**
  - [ ] Реализовать generateProceduralGalaxy()
    - [ ] Проверка разблокировки
    - [ ] Использование текущего seed
    - [ ] Генерация новой галактики
    - [ ] Добавление в proceduralGalaxies.galaxies
    - [ ] Инкремент totalDiscovered
  - [ ] Реализовать exploreProceduralGalaxy()
    - [ ] Отметить галактику как discovered
    - [ ] Разблокировать доступ к галактике
    - [ ] Уведомление о награде
- [ ] **UI компоненты**
  - [ ] Обновить GalaxyMap.tsx
    - [ ] Показывать базовые 7 галактик
    - [ ] Показывать процедурные галактики 8+
    - [ ] Кнопка "Генерировать новую галактику"
    - [ ] Отображать модификаторы ресурсов
    - [ ] Отображать специальные особенности
    - [ ] Показывать сложность
  - [ ] Создать ProceduralGalaxyCard компонент
    - [ ] Название галактики
    - [ ] Seed (для отладки)
    - [ ] Модификаторы
    - [ ] Кнопка "Исследовать"
- [ ] **Процедурные враги**
  - [ ] Создать генератор врагов для процедурных галактик
  - [ ] Масштабирование HP/урона по сложности
  - [ ] Уникальные боссы для процедурных галактик
- [ ] **Награды**
  - [ ] Определить награды за прохождение
  - [ ] Уникальные бонусы (permanent)
  - [ ] Артефакты (если Phase 6 реализована)
- [ ] **Сохранение/Загрузка**
  - [ ] Сохранять список процедурных галактик
  - [ ] Сохранять seed для детерминизма
  - [ ] Миграция сохранений
- [ ] **Тестирование**
  - [ ] Проверить генерацию с одинаковым seed
  - [ ] Проверить разнообразие галактик
  - [ ] Проверить модификаторы ресурсов
  - [ ] Проверить прохождение и награды

**Совместимость:** ✅ Не затрагивает 7 базовых галактик. Добавляет галактики 8+.

---

### � Phase 6: Артефакты (НЕ НАЧАТО)
**Статус:** ⏳ Опциональная фича
**Приоритет:** Низкий — можно добавить позже
**Оценка:** 2-3 дня

#### ❌ Основные задачи:
- [ ] **Типы и константы**
  - [ ] Добавить Artifact types в `gameTypes.ts`
  - [ ] Добавить ArtifactState в GameState
  - [ ] Создать `constants/artifacts.ts`
    - [ ] Определить редкости (common, rare, epic, legendary, mythic)
    - [ ] Список возможных эффектов
    - [ ] Базовая коллекция артефактов (20-30 штук)
- [ ] **Генератор артефактов**
  - [ ] Функция generateArtifact(rarity, source)
  - [ ] Случайные эффекты в диапазоне
  - [ ] Привязка к источнику (boss, galaxy, event)
- [ ] **Логика в gameStore**
  - [ ] Метод addArtifact(artifact)
  - [ ] Метод equipArtifact(artifactId, slotIndex)
  - [ ] Метод unequipArtifact(slotIndex)
  - [ ] Метод upgradeArtifact(artifactId) - улучшение артефакта
  - [ ] Расчет общих бонусов от экипированных артефактов
- [ ] **UI компоненты**
  - [ ] Создать ArtifactsPanel.tsx
    - [ ] Список обнаруженных артефактов
    - [ ] Слоты экипировки (3-5 слотов)
    - [ ] Детали артефакта (эффекты, уровень)
    - [ ] Кнопки экипировать/снять
    - [ ] Кнопка улучшить
  - [ ] Компонент ArtifactCard
    - [ ] Иконка по редкости
    - [ ] Название
    - [ ] Список эффектов
    - [ ] Уровень артефакта
- [ ] **Дроп артефактов**
  - [ ] Добавить дроп от боссов в combatLoop.ts
  - [ ] Шанс дропа в зависимости от сложности
  - [ ] Дроп из процедурных галактик
  - [ ] Дроп из случайных событий
  - [ ] Награды за достижения
- [ ] **Интеграция эффектов**
  - [ ] Применять бонусы артефактов в game loop
  - [ ] Учитывать в расчетах производства
  - [ ] Учитывать в расчетах боя
- [ ] **Разблокировка слотов**
  - [ ] 3 слота изначально
  - [ ] +1 слот за каждые 2 Ascension (макс 5-7 слотов)
- [ ] **Сохранение/Загрузка**
  - [ ] Сохранять discovered артефакты
  - [ ] Сохранять equipped слоты
  - [ ] Миграция сохранений
- [ ] **Тестирование**
  - [ ] Проверить генерацию артефактов
  - [ ] Проверить дроп
  - [ ] Проверить экипировку
  - [ ] Проверить применение эффектов

**Примечание:** Эта фаза полностью опциональная и может быть реализована после Phase 3-5.

---

## 📋 Чеклист Совместимости с PLANGLOBAL.md

### ✅ Что УЖЕ Работает (НЕ ТРОГАТЬ)
- Престиж-система (Quantum Points, 18 улучшений) — **расширяем**, не переписываем
- 7 галактик — **сохраняем**, добавляем процедурные 8+
- 50+ достижений — добавляем новые для Ascension
- Контракты в MarketPanel — расширяем для "Factorio-lite"
- Система уровней зданий (1-500) — добавляем эволюцию на вехах
- Случайные события — добавляем новые типы

### ⚠️ Требуют Осторожной Модификации
- `gameTypes.ts` — добавлять новые поля с дефолтными значениями
- `gameStore.ts` — миграция сохранений обязательна
- `gameLoop.ts` — аккуратно добавлять новые расчёты

### 🔴 Критические Файлы (Высокий Риск)
- `features/gameStore.ts` — центр всей логики
- `core/loop/*.ts` — игровой цикл
- Сохранения — обязательна миграция

---

## 🔄 Миграция Сохранений

```typescript
// utils/saveMigration.ts
const SAVE_VERSION = 2; // Текущая версия: 1 (PLANGLOBAL), новая: 2

function migrateSave(save: any): GameState {
  const version = save.saveVersion || 1;
  
  if (version < 2) {
    save = migrateV1toV2(save);
  }
  
  return save;
}

function migrateV1toV2(save: SaveV1): SaveV2 {
  return {
    ...save,
    saveVersion: 2,
    
    // Новые поля Ascension
    ascension: {
      count: 0,
      points: 0,
      multipliers: { qpGain: 1, production: 1, research: 1 },
      unlocks: { infiniteResearch: false, evolution: false, procGalaxies: false },
    },
    
    // Повторяемые исследования
    repeatableResearch: {},
    
    // Артефакты
    artifacts: { discovered: [], equipped: [], slots: 3 },
    
    // Процедурные галактики (пустой массив — базовые 7 не трогаем)
    proceduralGalaxies: [],
  };
}
```

---

## 📊 Экономическая Модель "Бесконечности"

### Формулы (совместимые с текущей системой)

#### **Стоимость Зданий** (уже работает в PLANGLOBAL)
```
cost(level) = baseCost × (1.15 ^ level)
// Добавляем множитель Ascension:
cost(level) = baseCost × (1.15 ^ level) × (1 - ascensionDiscount)
ascensionDiscount = min(0.5, ascensionCount × 0.05) // Макс -50%
```

#### **Quantum Points** (уже работает)
```
QP = sqrt(credits) + sqrt(RP) + sqrt(influence) + megastructures×1000
// Добавляем множитель Ascension:
QP = baseQP × (1 + ascensionCount × 0.5) // +50% за каждое Ascension
```

#### **Ascension Points** (новое)
```
AP = floor(log10(totalQPEarned)) × ascensionCount
// Требования для Ascension:
- prestigeCount >= 10
- totalQP >= 1,000,000
- allMegastructures == true
```

#### **Время Progression**
```
Первый престиж: 30-60 минут (без изменений)
10-й престиж: ~3-4 часа
Первое Ascension: ~8-10 часов
Второе Ascension: ~5-6 часов (быстрее из-за бонусов)
Бесконечность: после 5+ Ascension игра становится "бесконечной"
```

---

## 🎯 Целевые Метрики (обновлённые)

### Progression Milestones
| Время | Этап | Что реализовано |
|-------|------|-----------------|
| 0-2 часа | Изучение базовых механик | ✅ PLANGLOBAL |
| 2-5 часов | Первый престиж | ✅ PLANGLOBAL |
| 5-10 часов | Освоение престиж-петли, все 4 концовки | ✅ PLANGLOBAL |
| 10-20 часов | **Ascension** (первое) | ❌ infinitely.md |
| 20-50 часов | Повторяемые исследования, эволюция | ❌ infinitely.md |
| 50-100 часов | Процедурные галактики, артефакты | ❌ infinitely.md |
| 100+ часов | Мета-оптимизация, Transcendence | ❌ infinitely.md (опционально) |

---

## 🎨 UX: Постепенное Раскрытие Механик

### До Первого Ascension (0-10 часов)
**Показываем:** Всё из PLANGLOBAL (7 галактик, 4 концовки, престиж)
**Скрываем:** Ascension, повторяемые исследования, эволюция, артефакты

### После Первого Ascension (10+ часов)
**Разблокируем постепенно:**
1. Повторяемые исследования (сразу)
2. Эволюция зданий (на 2-м Ascension)
3. Процедурные галактики (на 3-м Ascension)
4. Артефакты (на 5-м Ascension)

**Важно:** Не перегружать новичка. Показывать "???" на заблокированных вкладках.

---

## ⚙️ Механика "Логистического Планирования" (Factorio-lite)

### 📌 Статус: ✅ Базовая версия реализована (26 декабря 2024)
- ✅ **Контракты в ContractsPanel** — уже есть базовые
- ✅ **Анализ "Успею ли?"** — ✅ РЕАЛИЗОВАНО
- ✅ **Бонус за скорость** — ✅ РЕАЛИЗОВАНО
- ❌ **Цепочки производства** — планируется на будущее
- ❌ **Приоритеты распределения** — планируется на будущее

### ✅ Что реализовано (26 декабря 2024)

#### 1. Анализ контрактов с ETA
**Файлы:**
- `src/utils/contractHelpers.ts` - полный набор функций анализа
- `src/core/gameTypes.ts` - расширенные типы Contract, ContractAnalysis
- `src/features/gameStore.ts` - обновлённые generateContract() и completeContract()
- `src/components/game/ContractsPanel.tsx` - новый UI с анализом

**Функции:**
```typescript
// Основная функция анализа
analyzeContract(contract, state): ContractAnalysis

// Возвращает детальный анализ по каждому ресурсу:
interface ContractResourceAnalysis {
  resource: ResourceType;
  needed: Decimal;           // Сколько всего нужно
  current: Decimal;          // Сколько сейчас есть
  remaining: Decimal;        // Сколько ещё нужно
  production: Decimal;       // Производство в секунду
  etaSeconds: number;        // Секунд до готовности
  willComplete: boolean;     // Успеет ли к дедлайну
  isBottleneck: boolean;     // Это узкое место?
}

// Общий статус контракта
overallStatus: 'ready' | 'on_track' | 'at_risk' | 'will_fail'
```

#### 2. Бонус за скорость
- Если контракт выполнен менее чем за половину времени → **+50% награды**
- Отображается в UI с иконкой ⚡
- Автоматически начисляется при сдаче контракта

#### 3. Умные подсказки
Система автоматически генерирует подсказки:
- ✅ "Все ресурсы готовы! Можете сдать контракт прямо сейчас"
- 🟢 "Всё идёт по плану. Контракт будет выполнен вовремя"
- ⚠️ "Узкое место: Железо. Нужно увеличить производство на 25/сек"
- ❌ "Не успеете! Медь: нужно увеличить производство на 150%"

#### 4. Визуализация прогресса
- Прогресс-бары для каждого ресурса
- Цветовая индикация (зелёный = успеете, красный = не успеете)
- ETA (estimated time to arrival) для каждого ресурса
- Иконки статуса: ✅ 🟢 ⚠️ ❌

**Изменения:**
- [x] ✅ Расширить `ContractsPanel.tsx` с панелью анализа
- [x] ✅ Добавить расчёт ETA в реальном времени
- [x] ✅ Добавить бонус за скорость выполнения
- [x] ✅ Увеличены таймеры контрактов (3-7 минут в зависимости от сложности)
- [ ] Добавить сложные контракты (5+ ресурсов) после Ascension
- [ ] Добавить штрафы за провал контракта (опционально)

### Расширение Существующих Контрактов

**Текущие контракты (базовая версия):**
- ✅ Простые: "Доставить ресурсы → награды"
- ✅ Таймер с обратным отсчётом
- ✅ Анализ "Успею ли?" с ETA
- ✅ Бонус за скорость (+50% если быстро)

**Будущие улучшения (опционально):**
```typescript
// Расширяем существующий Contract interface
interface EnhancedContract extends Contract {
  // Дополнительные фичи (для будущих версий)
  penaltyForFailure?: {          // Штраф за провал
    credits?: Decimal;
    influence?: Decimal;
  };
  bonusForExcess?: number;       // +% за превышение нормы (сдал больше)
  chains?: string[];             // Цепочки контрактов (один открывает другой)
}
```

---

### 🎯 Концепция: "Галактические Контракты"

**Идея:** Периодически появляются контракты, требующие **определённое количество разных ресурсов** в **ограниченное время**. Игрок должен заранее планировать производство.

```typescript
interface GalacticContract {
  id: string;
  name: string;                    // "Срочная поставка для Колонии Альфа"
  
  // Требования (несколько ресурсов!)
  requirements: Array<{
    resource: string;              // 'iron', 'energy', 'circuits'
    amount: number;                // 50,000
    currentAmount: number;         // Сколько уже накопил
  }>;
  
  // Временные рамки
  timeLimit: number;               // 30 минут
  timeRemaining: number;
  
  // Награды растут с риском
  rewards: {
    baseReward: Reward;
    bonusForSpeed: Reward;         // +50% если сдал за половину времени
    bonusForExcess: Reward;        // +20% за каждые +10% сверх нормы
  };
  
  // Сложность
  difficulty: 'easy' | 'medium' | 'hard' | 'extreme';
  penaltyForFailure?: Penalty;     // Опционально: штраф за провал
}
```

---

### 📊 Как Это Работает

#### **1. Появление Контракта**
```
┌─────────────────────────────────────────────────┐
│  📋 НОВЫЙ КОНТРАКТ: "Экспедиция на Титан"       │
│                                                 │
│  Требуется доставить за 45 минут:               │
│  ├── ⛏️  Железо:     25,000  (у вас: 12,340)    │
│  ├── ⚡ Энергия:    100,000  (у вас: 89,000)    │
│  └── 🔧 Механизмы:   5,000  (у вас: 1,200)     │
│                                                 │
│  💰 Награда: 500 Prestige Points                │
│  🚀 Бонус за скорость: +250 PP (если < 22 мин)  │
│                                                 │
│  [ Принять ]  [ Отклонить (-50 PP) ]            │
└─────────────────────────────────────────────────┘
```

#### **2. Игрок Должен Просчитать**

**Вопросы которые должен задать игрок:**
- "У меня производство железа 500/мин. За 45 минут = 22,500. Мне нужно 25,000 - 12,340 = 12,660. Успею!"
- "Механизмов мало! Нужно срочно построить ещё заводов или перенаправить ресурсы"
- "Может отложить другие траты и копить на контракт?"

#### **3. Панель Планирования**

```typescript
interface ContractPlanner {
  contract: GalacticContract;
  
  analysis: {
    // Автоматический расчёт (подсказка игроку)
    perResource: Array<{
      resource: string;
      needed: number;              // Сколько ещё нужно
      currentProduction: number;   // Производство в минуту
      estimatedTime: number;       // Минут до готовности
      willComplete: boolean;       // Успеет или нет
      bottleneck: boolean;         // Это узкое место?
    }>;
    
    overallStatus: 'on_track' | 'at_risk' | 'will_fail';
    criticalResource: string;      // Какой ресурс проблемный
    suggestion: string;            // "Постройте ещё 3 завода механизмов"
  };
}
```

**UI Планирования:**
```
┌─────────────────────────────────────────────────┐
│  📊 АНАЛИЗ КОНТРАКТА              ⏱️ 34:21     │
├─────────────────────────────────────────────────┤
│  Ресурс      │ Нужно  │ Есть   │ Прод/мин │ ETA │
│  ──────────────────────────────────────────────│
│  ⛏️ Железо    │ 25,000 │ 18,200 │ 520/мин  │ 13м ✅│
│  ⚡ Энергия   │100,000 │ 95,000 │ 2,100/м  │ 2м  ✅│
│  🔧 Механизмы│  5,000 │  2,100 │ 45/мин   │ 64м ⚠️│
├─────────────────────────────────────────────────┤
│  ⚠️ ПРОБЛЕМА: Механизмы не успеют!              │
│  💡 Решение: Постройте +3 завода (нужно 85/мин) │
└─────────────────────────────────────────────────┘
```

---

### 🔄 Цепочки Производства (Упрощённые)

**Ключевая механика:** Некоторые ресурсы требуют ДРУГИХ ресурсов для производства.

```typescript
interface ProductionChain {
  output: string;                  // 'circuits'
  outputAmount: number;            // 10 единиц
  
  inputs: Array<{
    resource: string;              // 'copper', 'iron'
    amount: number;                // 5 меди, 2 железа
  }>;
  
  productionTime: number;          // 30 секунд
  
  // Визуализация цепочки
  chainVisualization: string;      
  // "5 Медь + 2 Железо → [Завод: 30с] → 10 Микросхем"
}
```

**Пример Цепочки:**
```
Уровень 1:   ⛏️ Руда ──────────────────────────────┐
                                                   │
Уровень 2:   🔩 Металл (5 руды → 1 металл)         │
                   │                               │
Уровень 3:   🔧 Механизмы (3 металла → 1 мех.)     │
                   │                               │
Уровень 4:   🤖 Дроны (2 мех. + 5 энергии → 1 дрон)│
                                                   │
             ⚡ Энергия ────────────────────────────┘
```

**Игрок должен понять:**
- Чтобы делать 10 дронов/мин, нужно 20 механизмов/мин
- Для 20 механизмов нужно 60 металла/мин
- Для 60 металла нужно 300 руды/мин
- И параллельно 50 энергии/мин

---

### 🎚️ Система "Приоритетов Распределения"

**Проблема:** Ресурсов может не хватать на всё. Что делать?

**Решение:** Игрок устанавливает приоритеты.

```typescript
interface ResourceAllocation {
  resource: string;
  totalProduction: number;         // 1000/мин
  
  allocations: Array<{
    target: string;                // 'Завод Механизмов #1'
    priority: 1 | 2 | 3 | 4 | 5;   // 1 = высший
    requestedAmount: number;       // Сколько хочет
    allocatedAmount: number;       // Сколько реально получит
    efficiency: number;            // 100% или меньше
  }>;
  
  // Режимы распределения
  mode: 'priority' | 'equal' | 'proportional';
}
```

**UI Распределения:**
```
┌─────────────────────────────────────────────────┐
│  ⚡ РАСПРЕДЕЛЕНИЕ ЭНЕРГИИ                        │
│  Производство: 10,000/мин  |  Спрос: 12,500/мин │
├─────────────────────────────────────────────────┤
│  Приоритет │ Здание              │ Нужно │ Дано │
│  ──────────────────────────────────────────────│
│  ⭐⭐⭐⭐⭐   │ Щиты (критично!)     │ 2,000 │ 2,000│
│  ⭐⭐⭐⭐     │ Завод Дронов        │ 3,000 │ 3,000│
│  ⭐⭐⭐       │ Исследования        │ 4,000 │ 4,000│
│  ⭐⭐         │ Фабрика Роботов     │ 2,000 │ 1,000│ ⚠️
│  ⭐           │ Освещение           │ 1,500 │    0 │ ❌
├─────────────────────────────────────────────────┤
│  💡 Совет: Постройте ещё 3 генератора           │
│  [ Авто-баланс ]  [ Ручной режим ]              │
└─────────────────────────────────────────────────┘
```

---

### ⏰ "Волны Спроса" (Временные Пики)

**Механика:** Иногда спрос на ресурсы резко возрастает.

```typescript
interface DemandWave {
  resource: string;
  normalDemand: number;            // 1000/мин обычно
  waveDemand: number;              // 3000/мин во время волны
  
  waveDuration: number;            // 5 минут
  waveInterval: number;            // Каждые 30 минут
  
  warning: {
    timeBeforeWave: number;        // Предупреждение за 5 минут
    message: string;               // "Через 5 минут — пик спроса на энергию!"
  };
  
  consequences: {
    ifMet: Reward;                 // Бонус за справление
    ifNotMet: Penalty;             // Здания замедляются
  };
}
```

**Игрок должен:**
1. Увидеть предупреждение "Пик спроса через 5 минут!"
2. Быстро перенаправить ресурсы или включить резервы
3. Пережить волну и получить бонус

---

### 🏭 "Режим Перегрузки" (Burst Mode)

**Механика:** Здания можно временно "разогнать" за счёт повышенного расхода.

```typescript
interface OverdriveMode {
  building: Building;
  
  normalProduction: number;        // 100/мин
  overdriveProduction: number;     // 250/мин (+150%)
  
  overdriveCost: {
    resource: string;              // 'energy'
    amount: number;                // ×3 расход энергии
  };
  
  overdriveDuration: number;       // Максимум 5 минут
  cooldownAfter: number;           // 10 минут кулдауна
  
  riskOfBreakdown: number;         // 5% шанс поломки
}
```

**Когда использовать:**
- Нужно срочно выполнить контракт
- Пик спроса — включить перегрузку на генераторах
- "Последний рывок" до престижа

---

### 📈 Пример Геймплея

**Ситуация:** Игрок принял сложный контракт.

```
09:00 - Принял контракт: нужно 50К железа, 30К меди, 10К микросхем за 1 час
09:02 - Смотрю анализ: железо ОК, медь ОК, микросхем не хватит (делаю 80/мин, нужно 120/мин)
09:05 - Строю 2 дополнительных завода микросхем
09:07 - Проблема: заводам нужна медь! Перераспределяю приоритет меди
09:10 - Теперь меди не хватает на экспорт. Ставлю экспорт на паузу
09:15 - Предупреждение: "Пик спроса энергии через 5 минут!"
09:16 - Включаю резервный генератор
09:20 - Пережил пик, получил бонус +500 ресурсов
09:45 - Контракт почти готов, но микросхем ещё 2000 не хватает
09:46 - Включаю "Перегрузку" на заводе микросхем (×2.5 производства)
09:52 - Контракт выполнен! За 8 минут до дедлайна = бонус за скорость!
```

---

### 🎮 Уровни Сложности Системы

#### **Для Казуалов (Easy Mode):**
- Контракты без жёстких дедлайнов
- Авто-подсказки "Постройте это"
- Нет штрафов за провал
- Можно отменить контракт

#### **Для Середнячков (Normal):**
- Дедлайны, но с запасом времени
- Подсказки есть, но менее подробные
- Небольшие штрафы за провал
- Один отказ бесплатно, дальше — штраф

#### **Для Хардкорщиков (Hard):**
- Жёсткие дедлайны
- Минимум подсказок
- Серьёзные штрафы за провал
- Бонусы за оптимальное выполнение

---

### 🛠️ Реализация

#### **Фаза 1: Базовые Контракты (2-3 дня)**
- [ ] Генерация простых контрактов (1-2 ресурса)
- [ ] Таймер и прогресс-бар выполнения
- [ ] Базовый UI контракта
- [ ] Награды за выполнение

#### **Фаза 2: Анализ и Планирование (2-3 дня)**
- [ ] Панель анализа "Успею ли?"
- [ ] Расчёт ETA для каждого ресурса
- [ ] Подсветка узких мест
- [ ] Подсказки решений

#### **Фаза 3: Цепочки и Приоритеты (3-4 дня)**
- [ ] Визуализация цепочек производства
- [ ] Система приоритетов распределения
- [ ] UI управления приоритетами
- [ ] Авто-баланс (опционально)

#### **Фаза 4: Продвинутые Механики (2-3 дня)**
- [ ] Волны спроса с предупреждениями
- [ ] Режим перегрузки зданий
- [ ] Сложные контракты (5+ ресурсов)
- [ ] Цепочные контракты (один за другим)

---

### 💡 Почему Это Работает

1. **Планирование:** Игрок чувствует себя умным, когда просчитал и успел
2. **Напряжение:** Таймер создаёт азарт без стресса (можно отказаться)
3. **Оптимизация:** Есть к чему стремиться (выполнить быстрее = больше бонус)
4. **Глубина:** Опытные игроки видят сложные цепочки, новички — простые контракты
5. **Engagement:** Нужно возвращаться проверить, как дела с контрактом

---
## � Скрытые Механики Вовлечения (Психология)

Эти механики работают на подсознательном уровне. Игрок чувствует, что ему **интересно** и **нужно** продолжать, но не осознаёт почему.

---

### 1. 🎰 Переменное Подкрепление (Variable Ratio Reinforcement)

**Принцип:** Награда приходит НЕПРЕДСКАЗУЕМО, но зависит от действий.

```typescript
// Вместо: "каждые 100 единиц ресурса = бонус"
// Делаем: "шанс 15% на бонус при каждой партии"

interface VariableReward {
  baseChance: 0.15;           // 15% базовый шанс
  streakBonus: number;        // После 5 неудач: +5% за каждую
  guaranteedAfter: 10;        // Гарантированно на 10-й попытке
}
```

**Применение в игре:**
- **Добыча ресурсов:** Шанс найти "Редкую жилу" (×10 ресурсов)
- **Исследования:** Случайный "Прорыв" (-50% времени)
- **Строительство:** Шанс "Идеальной постройки" (+20% эффективности навсегда)

**Почему работает:** Мозг выделяет больше дофамина при непредсказуемых наградах, чем при гарантированных.

---

### 2. 📊 Эффект Незавершённости (Zeigarnik Effect)

**Принцип:** Люди помнят и хотят завершить незаконченные задачи сильнее, чем начать новые.

**Применение:**
- **Прогресс-бары везде:** Здание 78% построено, исследование 92% завершено
- **"Почти готово":** Уведомление "До следующего уровня осталось 2 минуты!"
- **Коллекции:** "Собрано 8/10 артефактов этого сета"
- **Цепочки квестов:** Показывать следующий квест серым (видно, но недоступно)

```typescript
// Показываем, что "почти" достигнуто
function getMotivationalMessage(progress: number): string {
  if (progress >= 0.9) return "Почти готово! 🔥";
  if (progress >= 0.75) return "Уже больше половины пути!";
  if (progress >= 0.5) return "Отличный прогресс!";
  return null; // Не отвлекаем на раннем этапе
}
```

**Важно:** При выходе из игры показывать: "Ваша фабрика будет готова через 12 минут..."

---

### 3. 🏆 Эффект Наделённости (Endowment Effect)

**Принцип:** Люди ценят то, чем владеют, выше реальной стоимости.

**Применение:**
- **Кастомизация:** Дать назвать свои здания/базу/колонию
- **Уникальные предметы:** "Первая шахта" — особый значок, нельзя продать
- **История:** "Эта фабрика произвела 1,234,567 единиц за всё время"
- **"Твой" прогресс:** "Ты играешь 47 дней. Твоя империя уникальна."

```typescript
interface PersonalizedBuilding {
  customName?: string;         // "Шахта Эльдорадо"
  dateBuilt: Date;             // "Построено 15 дней назад"
  totalProduced: number;       // "Произвела: 1.2M"
  milestones: string[];        // "Первая шахта", "Выжила после престижа"
}
```

**Результат:** Игрок чувствует эмоциональную связь с игрой.

---

### 4. 🎯 Иллюзия Контроля (Illusion of Control)

**Принцип:** Люди вовлекаются сильнее, когда считают, что их решения имеют значение.

**Применение:**
- **Выбор специализации:** "Сделай свою галактику Энергетической ИЛИ Научной" (оба пути примерно равны, но игрок чувствует, что выбрал оптимально)
- **Разные стратегии:** Показывать, что "можно было сделать иначе"
- **Статистика решений:** "87% игроков сначала строят шахты. Ты выбрал фермы — необычный подход!"

```typescript
// Показываем "твой уникальный путь"
interface PlayStyle {
  dominantStrategy: 'aggressive' | 'balanced' | 'economic';
  uniqueDecisions: number;     // "Ты сделал 23 нестандартных выбора"
  comparedToOthers: string;    // "Быстрее 78% игроков на этом этапе"
}
```

---

### 5. ⏰ Commitment & Consistency (Последовательность)

**Принцип:** Начав что-то, люди склонны продолжать это делать.

**Применение:**
- **Streak системы:** "Играешь 7 дней подряд!" — страх потерять серию
- **Инвестиции времени:** Показывать "Всего наиграно: 12ч 34мин"
- **Вехи:** "Ты уже построил 500 зданий. До звания 'Архитектор' — ещё 100!"
- **Маленькие обязательства:** "Установи цель на сегодня" — игрок сам ставит, сам выполняет

```typescript
interface PlayerCommitment {
  currentStreak: number;       // Дней подряд
  longestStreak: number;       // Рекорд
  dailyGoal?: {
    type: string;
    target: number;
    progress: number;
    setByPlayer: true;         // Важно: игрок сам поставил!
  };
  totalPlayTime: number;
  milestonesReached: number;
}
```

---

### 6. 🔔 FOMO (Fear of Missing Out)

**Принцип:** Страх упустить что-то ценное — мощный мотиватор.

**Применение (ЭТИЧНО):**
- **Временные события:** "Комета пролетает раз в 2 часа — успей добыть редкий ресурс!"
- **Сезонные бонусы:** "Зимний ивент: +50% к энергии только сегодня"
- **Уходящие возможности:** "Торговец предлагает редкий артефакт. Улетит через 30 минут."

```typescript
interface TimeLimitedEvent {
  name: string;
  expiresAt: Date;
  reward: Reward;
  // Важно: не критично для прогресса, но приятно
  isCritical: false;           // Не блокирует прогресс
  willReturnLater: true;       // Вернётся потом (снижает токсичность)
}
```

**Важно:** События должны ВОЗВРАЩАТЬСЯ. Иначе игрок почувствует, что его "наказывают" за реальную жизнь.

---

### 7. 📈 Видимый Прогресс с "Неожиданными" Скачками

**Принцип:** Линейный прогресс скучен. Внезапные ускорения создают эйфорию.

**Применение:**
- **Hidden multipliers:** После N зданий внезапно открывается бонус
- **Combo системы:** "3 здания подряд за минуту = ×2 к следующему!"
- **"Критические удары":** Случайное ×5 к производству на секунду (с эффектами)

```typescript
interface ProgressBoost {
  trigger: 'buildings_combo' | 'time_played' | 'resources_milestone';
  
  // Эффект "вау"
  visualEffect: 'explosion' | 'rainbow' | 'lightning';
  soundEffect: 'success_fanfare';
  
  // Сам буст
  multiplier: number;
  duration: number;
  message: "COMBO! ×3 к производству!";
}
```

---

### 8. 🤝 Социальное Доказательство (без реального мультиплеера)

**Принцип:** Люди следуют за тем, что делают другие.

**Применение:**
- **Фейковая статистика:** "1,234 игрока сейчас онлайн" (можно генерировать)
- **Сравнение:** "Твоя база в топ-30% по эффективности"
- **"Другие делают так":** "Популярная стратегия: сначала энергия, потом наука"
- **Достижения других:** "Игрок 'CosmicMiner' только что достиг Вознесения!"

```typescript
// Генерируемые "социальные" сообщения
const socialProofMessages = [
  "🎉 Игрок достиг первого престижа!",
  "🏗️ Кто-то построил Сферу Дайсона!",
  "📊 Сейчас онлайн: {randomBetween(800, 2000)} игроков",
];
```

**Этика:** Если нет реальных игроков — можно генерировать правдоподобные данные. Это создаёт ощущение "живой" игры.

---

### 9. 🎁 Неожиданные Подарки (Surprise & Delight)

**Принцип:** Неожиданные награды создают сильнейшую эмоциональную связь.

**Применение:**
- **Random drops:** Иногда просто дарить ресурсы без причины
- **"Подарок от разработчиков":** Раз в неделю "Спасибо, что играешь!" + бонус
- **Пасхалки:** Скрытые награды за необычные действия
- **"Счастливый час":** Случайные периоды ×2 ко всему

```typescript
interface SurpriseGift {
  trigger: 'random' | 'milestone' | 'special_date';
  probability: 0.05;           // 5% при входе в игру
  
  rewards: Reward[];
  message: "Привет! Вот тебе подарок просто так 🎁";
  
  // Важно: не привязано к покупкам или действиям
  noStringsAttached: true;
}
```

---

### 10. 🧩 Мастерство и Оптимизация (Mastery Loop)

**Принцип:** Желание стать лучше — врождённое. Игра должна показывать, что "можно эффективнее".

**Применение:**
- **Efficiency ratings:** "Твоя база работает на 73% оптимально"
- **Подсказки оптимизации:** "Если переставить здание сюда — +15% к производству"
- **Глубокая статистика:** Графики, сравнения, анализ
- **"Секреты":** Механики, которые не объясняются, но умные игроки находят

```typescript
interface OptimizationHint {
  currentEfficiency: number;   // 73%
  potentialEfficiency: number; // 89%
  
  suggestions: Array<{
    action: string;            // "Переместить Шахту #3"
    impact: number;            // +5%
    difficulty: 'easy' | 'medium' | 'hard';
  }>;
  
  // Для хардкорщиков
  advancedMetrics: {
    productionPerSecond: number;
    
---

## 📝 История Изменений

### 26 декабря 2024 г.

#### ✅ Завершена система анализа контрактов (Contract Analysis)
**Новая фича из категории "Factorio-lite":**
- ✅ Анализ контрактов с ETA (время до готовности)
- ✅ Автоматическая проверка "Успею ли?"
- ✅ Умные подсказки для игрока
- ✅ Бонус за скорость (+50% наград за быстрое выполнение)
- ✅ Визуальные прогресс-бары для каждого ресурса
- ✅ Цветовая индикация статуса (готово/в процессе/риск/провал)
- ✅ Детальная информация по каждому ресурсу

**Файлы:**
- `src/utils/contractHelpers.ts` - функции анализа (200 строк)
- `src/core/gameTypes.ts` - типы ContractAnalysis, ContractResourceAnalysis
- `src/features/gameStore.ts` - обновлены generateContract() и completeContract()
- `src/components/game/ContractsPanel.tsx` - новый UI с анализом
- `docs/CONTRACT_ANALYSIS_IMPLEMENTATION.md` - полная документация

**Как это работает:**
1. Игрок получает контракт с несколькими ресурсами и таймером
2. Система автоматически рассчитывает ETA для каждого ресурса
3. Определяет узкие места и общий статус
4. Даёт умные подсказки ("постройте ещё 3 завода")
5. Если игрок выполняет быстро (< 50% времени) → бонус +50%

**Примеры подсказок:**
- ✅ "Все ресурсы готовы! Можете сдать контракт"
- 🟢 "Всё идёт по плану"  
- ⚠️ "Узкое место: Железо. Нужно +25/сек"
- ❌ "Не успеете! Медь: +150% к производству"

#### ✅ Завершена Phase 1: Система Больших Чисел
- Установлена библиотека break_eternity.js
- Созданы утилиты форматирования в utils/bigNumber.ts (formatBigNumber, formatExact, formatPercent и др.)
- Обновлен format.ts для использования новых утилит
- Все ресурсы уже используют Decimal - совместимость подтверждена

#### 🟡 Частично завершена Phase 2: Ascension
- Добавлены типы: AscensionState, AscensionRequirements, AscensionMultipliers, AscensionUnlocks
- Добавлены типы для повторяемых исследований и процедурных галактик
- Реализованы методы в gameStore: checkAscensionRequirements(), calculateAscensionGain(), performAscension()
- Добавлена вкладка "Вознесение" в PrestigePanel.tsx с полным UI
- Создан файл constants/repeatableResearch.ts с 6 повторяемыми исследованиями

#### ✅ Phase 3: Повторяемые исследования - РЕАЛИЗОВАНО
#### ✅ Phase 4: Эволюция зданий - РЕАЛИЗОВАНО  
#### ✅ Phase 5: Процедурные галактики - РЕАЛИЗОВАНО
#### ✅ Phase 6: Артефакты - РЕАЛИЗОВАНО
#### ✅ Contract Analysis System - РЕАЛИЗОВАНО
#### ✅ Daily Rewards System - РЕАЛИЗОВАНО
#### ✅ Signal Interception System - РЕАЛИЗОВАНО

**📊 Текущий статус infinitely.md:**
- ✅ Phase 1-6: Завершены (100%)
- ✅ Contract Analysis: Базовая версия реализована
- ✅ Daily Rewards: Реализованы (Календарь + Контейнеры)
- ✅ Signal Interception: Реализовано (Golden Cookie style)
- ✅ Production Chains: Реализовано (Factorio-style визуализация)
- ⏳ Приоритеты распределения: Планируется (0%)

**🎯 Следующие шаги:**
1. Resource Priority Distribution (опционально)
2. Тестирование и баланс всех систем

---

### 25 декабря 2025 г.
**✅ Завершена Phase 1: Система Больших Чисел**
- Установлена библиотека break_eternity.js
- Созданы утилиты форматирования в utils/bigNumber.ts (formatBigNumber, formatExact, formatPercent и др.)
- Обновлен format.ts для использования новых утилит
- Все ресурсы уже используют Decimal - совместимость подтверждена

**🟡 Частично завершена Phase 2: Ascension**
- Добавлены типы: AscensionState, AscensionRequirements, AscensionMultipliers, AscensionUnlocks
- Добавлены типы для повторяемых исследований и процедурных галактик
- Реализованы методы в gameStore: checkAscensionRequirements(), calculateAscensionGain(), performAscension()
- Добавлена вкладка "Вознесение" в PrestigePanel.tsx с полным UI
- Создан файл constants/repeatableResearch.ts с 6 повторяемыми исследованиями

**⏳ Осталось в Phase 2:**
- Интегрировать множители Ascension в игровой цикл
- Добавить проверку всех мегаструктур
- Реализовать миграцию сохранений
- Протестировать и настроить баланс

**📊 Текущий статус:**
- ✅ Phase 1: Завершена (100%)
- 🟡 Phase 2: В процессе (~70%)
- ⏳ Phase 3-6: Ожидают начала (0%)

**🎯 Следующие шаги:**
1. Завершить Phase 2 (интеграция множителей + баланс)
2. Начать Phase 3 (UI для повторяемых исследований)
3. Phase 4 (Эволюция зданий)
4. Phase 5 (Процедурные галактики)
5. Phase 6 (Артефакты - опционально)
    efficiencyPerBuilding: number;
    bottlenecks: string[];
  };
}
```

---

### 11. 🌅 Ритуалы и Привычки

**Принцип:** Привычки формируются через повторение в одно время.

**Применение:**
- **Утренний отчёт:** При первом входе за день — красивый summary ночного прогресса
- **"Вечерние дела":** Подсказка "Не забудь собрать награды перед сном!"
- **Недельный обзор:** Каждый понедельник — статистика за неделю
- **Предсказуемые события:** "Каждый день в 20:00 — бонусный час"

```typescript
interface DailyRituals {
  morningReport: {
    offlineEarnings: number;
    eventsHappened: Event[];
    todaysTip: string;
  };
  
  eveningReminder: {
    enabled: boolean;
    time: "20:00";
    message: "Собери ежедневные награды!";
  };
  
  weeklyRecap: {
    totalProgress: number;
    bestDay: string;
    achievements: Achievement[];
  };
}
```

---

### 12. 🔮 Тизеры Будущего Контента

**Принцип:** Любопытство — мощный мотиватор.

**Применение:**
- **Заблокированные иконки:** Видно, что есть, но недоступно (с подсказкой "Разблокируется после Вознесения")
- **Туманные превью:** "???" в списке исследований
- **Намёки в тексте:** "Говорят, за чёрной дырой есть что-то ещё..."
- **Достижения-спойлеры:** Показать название секретного достижения, но не условие

```typescript
interface ContentTeaser {
  category: 'building' | 'research' | 'feature';
  
  visibility: {
    showIcon: true;            // Видно силуэт
    showName: false;           // Имя скрыто
    showHint: true;            // "Требуется: ???"
  };
  
  unlockHint: "Достигни Престижа 5";
  mysteryLevel: 'low' | 'medium' | 'high';
}
```

---

## 📋 Чеклист Внедрения

### Быстро внедрить (1-2 дня):
- [ ] Прогресс-бары везде (Zeigarnik)
- [ ] Случайные бонусы к добыче (Variable Ratio)
- [ ] Streak counter (Commitment)
- [ ] "Всего наиграно" счётчик (Endowment)
- [ ] Заблокированные иконки будущего контента (Curiosity)

### Средняя сложность (3-5 дней):
- [ ] Combo-система для зданий
- [ ] Персонализация (имена зданий, история)
- [ ] Утренний отчёт офлайн-прогресса
- [ ] Временные события с таймером

### Требует бэкенда / сложнее:
- [ ] "Другие игроки" статистика
- [ ] Еженедельные рекапы
- [ ] Сложная аналитика оптимизации

---

## �🧩 Механики Удержания для Ранней Игры (Day 1-7)

Эти механики важны, чтобы игрок вообще дожил до "бесконечного" контента. Их можно внедрить сразу.

### 1. 📅 Ежедневный Календарь Наград (Daily Login)
- **Прогрессия:** Награда растет с каждым днем (День 1: Ресурсы → День 7: Редкий Артефакт/Премиум валюта).
- **Catch-up:** Если пропустил день, можно восстановить за небольшую плату (или просмотр рекламы, если будет).
- **Визуал:** Красивая анимация получения.

### 2. 📡 "Перехват Сигналов" (Active Play Bonus)
- **Аналог:** Golden Cookie из Cookie Clicker.
- **Механика:** Раз в 2-5 минут на карте появляется "Неизвестный сигнал" или "Пролетающая комета".
- **Действие:** Игрок должен успеть кликнуть за 10-15 секунд.
- **Награда:** Мгновенный буст производства (x7 на 30 сек) или куча ресурсов.
- **Зачем:** Заставляет игрока держать игру открытой и смотреть на экран.

### 3. 📦 "Поставки из Центра" (Time-based Rewards)
- **Механика:** Бесплатный контейнер каждые 4 часа.
- **Содержимое:** Ресурсы, немного валюты, шанс на простой артефакт.
- **Накопление:** Можно накопить до 2-х контейнеров (чтобы игрок мог спать и не терять награду).

### 4. 📜 "Бортовой Журнал" (Lore & Collectibles)
- **Механика:** При постройке зданий или исследованиях есть шанс найти "Обрывок данных".
- **Коллекционирование:** Сбор сета данных открывает кусочек лора и дает пассивный бонус (+1% к энергии).
- **Интрига:** История подается загадками, мотивируя искать дальше.

### 5. 🚀 "Программа Подготовки Пилота" (New Player Onboarding)
- **Аналог:** Battle Pass для новичков.
- **Длительность:** Первые 7 дней или первые 10 часов игры.
- **Задания:** "Построй 50 шахт", "Накопи 1М энергии".
- **Финальная награда:** Уникальный скин для базы или мощный стартовый артефакт, который останется после престижа.

---

## 💎 Монетизация (опционально)

Если планируется монетизация:
- **НЕТ Pay-to-Win**: никаких бустеров производства за деньги
- **Косметика**: темы оформления, визуальные эффекты
- **Convenience**: дополнительные слоты артефактов, пресеты
- **Remove Ads**: если будет реклама
- **Support Developer**: просто донат без бонусов

---

## 🚀 Приоритезация Фич

### 🔴 Must Have (для "бесконечности")
| # | Фича | Статус | Дни | Риск |
|---|------|--------|-----|------|
| 1 | Большие числа (break_eternity.js) | ✅ Готово | 2-3 | ✅ Реализовано |
| 2 | Ascension (2-й уровень престижа) | ✅ Готово | 3-4 | ✅ Реализовано |
| 3 | Повторяемые исследования | ✅ Готово | 2-3 | ✅ Реализовано |
| 4 | Эволюция зданий | ✅ Готово | 3-4 | ✅ Реализовано |
| 5 | Расширенные контракты (Factorio-lite) | ✅ Базовая версия | 1 | ✅ Реализовано |

### 🟡 Should Have — (после Must Have)
| # | Фича | Статус | Дни |
|---|------|--------|-----|
| 6 | Процедурные галактики | ✅ Готово | 4-5 |
| 7 | Система артефактов | ✅ Готово | 2-3 |
| 8 | Механики удержания (Daily Rewards) | ✅ Готово | 2-3 |
| 9 | Цепочки производства | ❌ Не начато | 3-4 |
| 10 | Приоритеты распределения | ❌ Не начато | 2-3 |

### 🟢 Nice to Have — когда-нибудь
| # | Фича | Примечание |
|---|------|------------|
| 11 | Волны спроса | Расширение контрактов |
| 12 | Режим перегрузки зданий | Расширение контрактов |
| 13 | Transcendence (3-й уровень) | После стабилизации Ascension |
| 14 | Временные линии | Очень сложно, низкий приоритет |
| 15 | Социальные фичи | Требует бэкенд |

---

## 📝 Заключение

### Что УЖЕ РАБОТАЕТ (PLANGLOBAL.md) — ~91% игры готово
- ✅ 7 галактик с уникальными ресурсами
- ✅ 4 концовки игры
- ✅ Престиж-система с 18 улучшениями
- ✅ 50+ достижений
- ✅ 33 политики
- ✅ Флот и боевая система
- ✅ Мегаструктуры
- ✅ Контракты (базовые)
- ✅ Случайные события

### Что ДОБАВЛЯЕТ infinitely.md
- ❌ Ascension (2-й уровень престижа) — продлевает игру с 10 до 50+ часов
- ❌ Повторяемые исследования — бесконечная прокачка
- ❌ Эволюция зданий — новая цель для уровней 100/250/500
- ❌ Процедурные галактики — бесконечный контент после 7 базовых
- ❌ Артефакты — коллекционирование и оптимизация
- ❌ Расширенные контракты — глубина геймплея

### Порядок Реализации (рекомендуемый)
```
1. Тестирование и релиз PLANGLOBAL (Фаза 11-12) ← СНАЧАЛА ЭТО
2. Большие числа ← база для бесконечности
3. Ascension ← главная фича infinitely.md
4. Повторяемые исследования + Эволюция ← быстрые победы
5. Расширенные контракты ← глубина
6. Процедурные галактики ← бесконечный контент
7. Артефакты и прочее ← полировка
```

**Общее время на infinitely.md:** ~25-30 дней работы

---

### 27 декабря 2025 г.
**✅ Реализована система Contract Analysis (Factorio-lite механики)**
- Создан файл utils/contractHelpers.ts с функциями анализа контрактов
- Добавлены типы ContractAnalysis, ContractResourceAnalysis в gameTypes.ts
- Обновлены методы generateContract() и completeContract() с speed bonus (+50%)
- Полностью переделан UI ContractsPanel.tsx с визуализацией ETA и прогресса
- Создана полная документация в docs/CONTRACT_ANALYSIS_IMPLEMENTATION.md

**✅ Реализована система Daily Rewards (механики удержания игроков)**
- Создан файл utils/dailyRewardsHelpers.ts с логикой календаря и контейнеров
- Добавлены типы: DailyLoginState, TimeBasedRewardsState, PlayerStats, RetentionState
- Реализовано в gameStore:
  - claimDailyReward() — получение ежедневной награды
  - collectTimeBasedReward() — сбор контейнера
  - checkAndUpdateDailyLogin() — проверка при входе (вызывается в App.tsx)
- Создан UI компонент DailyRewardsPanel.tsx:
  - Календарь на 7 дней с визуализацией стрика
  - Контейнеры по времени (каждые 4 часа, макс. 3)
  - Таймер до следующего контейнера
  - Статистика (стрики, входы, собрано контейнеров)
- Интегрирована в SidePanelTabs.tsx с иконкой CalendarDays
- Создана полная документация в docs/DAILY_REWARDS_IMPLEMENTATION.md

**Формулы Daily Rewards:**
- Ежедневные награды: множитель 1.5x дни 1-3, 2x дни 4-6, 10x день 7
- Контейнеры: базовые ресурсы + 10% за каждый собранный контейнер
- Стрик не прерывается при пропуске < 48 часов
- Новый контейнер каждые 4 часа активной игры

**📊 Текущий прогресс:**
- ✅ Все основные фичи infinitely.md реализованы (Phases 1-6)
- ✅ Contract Analysis с умным анализом и speed bonus
- ✅ Daily Rewards с календарём и контейнерами
- ⏳ Следующие фичи (опционально):
  - Active Play Bonuses (Signal Interception - Golden Cookie style)
  - Production Chains визуализация
  - Resource Priority Distribution
  - Demand Waves
  - Building Overdrive Mode

---

### 27 декабря 2025 г. (продолжение)
**✅ Реализована система Signal Interception (Active Play Bonuses)**
- Создан файл utils/signalHelpers.ts с полной логикой системы (400+ строк)
- Добавлены типы в gameTypes.ts:
  - SignalType (7 типов сигналов)
  - ActiveSignal, SignalReward, ActiveBoost
  - SignalInterceptionState
- Реализовано в gameStore:
  - spawnNewSignal() — создание нового сигнала
  - claimSignal() — перехват сигнала игроком
  - updateSignals() — обновление состояния (удаление истёкших)
  - toggleSignals() — вкл/выкл системы
- Создан UI компонент SignalOverlay.tsx (250+ строк):
  - Визуальное отображение сигнала на карте
  - Пульсирующая анимация для привлечения внимания
  - Таймер обратного отсчёта (15 секунд)
  - Индикаторы активных бустов в углу экрана
  - Компонент SignalStats для панели настроек
- Интеграция:
  - App.tsx — добавлен SignalOverlay компонент
  - useOptimizedGameLoop.ts — вызовы spawnNewSignal() и updateSignals()
  - SettingsPanel.tsx — добавлена статистика сигналов
- Создана полная документация в docs/SIGNAL_INTERCEPTION_IMPLEMENTATION.md

**7 типов сигналов:**
1. resource_cache (30%) — 5 минут производства
2. production_boost (25%) — x7 производство на 30 сек
3. research_burst (20%) — 30 RP мгновенно
4. energy_surge (15%) — бесплатная энергия на 1 мин
5. lucky_find (8%) — случайные ресурсы + кредиты
6. time_warp (2%) — x2 скорость на 60 сек
7. golden_comet (5%) — мега-награда (30 мин производства + 100k credits + 100 RP + 10 DM)

**Механика:**
- Сигналы появляются каждые 2-5 минут
- У игрока 15 секунд чтобы кликнуть на сигнал
- Случайная позиция на карте (20%-80% от размеров)
- Пульсирующая анимация для привлечения внимания
- Цветовая индикация типа сигнала
- Бусты отображаются в правом верхнем углу
- Статистика: перехвачено/пропущено сигналов

**📊 Итоговый прогресс:**
- ✅ Все Must Have фичи infinitely.md реализованы (100%)
- ✅ Все основные механики удержания готовы:
  - Daily Login Calendar с системой стриков
  - Time-based Rewards (контейнеры каждые 4 часа)
  - Signal Interception (Golden Cookie style)
- ✅ Contract Analysis с умным ETA и speed bonus
- ✅ Production Chains визуализация (Factorio-style)
- ⏳ Опциональные фичи для будущего:
  - Resource Priority Distribution
  - Demand Waves (временные спайки спроса)
  - Building Overdrive Mode

**✅ Реализована система Production Chains (Цепочки производства)**
- Создан файл utils/productionChainHelpers.ts с анализом цепочек (350+ строк)
- Добавлены типы: ProductionNode, ProductionChain, ProductionChainAnalysis
- Ключевые функции:
  - buildProductionGraph() — построение графа производства
  - findProductionChains() — поиск цепочек от базовых ресурсов
  - analyzeProductionChains() — полный анализ с рекомендациями
  - generateSuggestions() — AI-подобные советы по оптимизации
- Создан UI компонент ProductionChainVisualizer.tsx:
  - Визуализация цепочек с цветовой индикацией эффективности
  - Карточки узких мест (bottlenecks) с предупреждениями
  - График всех ресурсов с балансом
  - Связи между ресурсами (входы/выходы)
  - Умные рекомендации по улучшению
- Интеграция в SidePanelTabs.tsx как вкладка "Цепочки"

**Механика:**
- Автоматический анализ всех зданий и ресурсов
- Определение узких мест в производстве
- Расчёт эффективности каждой цепочки (0-100%)
- Цветовая индикация: зелёный (90%+), жёлтый (70-90%), оранжевый (50-70%), красный (<50%)
- Умные рекомендации на основе анализа графа

---

## 🎉 ИТОГОВЫЙ СТАТУС ПРОЕКТА

### ✅ ВСЕ 6 ФАЗ ПОЛНОСТЬЮ РЕАЛИЗОВАНЫ!

| Фаза | Название | Статус | Завершено |
|------|----------|--------|-----------|
| **Phase 1** | Big Numbers System | ✅ | 25.12.2024 |
| **Phase 2** | Ascension (2-уровневый престиж) | ✅ | 25.12.2024 |
| **Phase 3** | Repeatable Research | ✅ | 26.12.2024 |
| **Phase 4** | Building Evolution | ✅ | 26.12.2024 |
| **Phase 5** | Procedural Galaxies | ✅ | 26.12.2024 |
| **Phase 6** | Artifacts System | ✅ | 26.12.2024 |

### 📊 Достигнутые Цели

✅ **Бесконечный геймплей** - процедурные галактики дают бесконечный контент  
✅ **Повторяемость** - 6 повторяемых исследований с бесконечными уровнями  
✅ **Эволюция** - здания эволюционируют до ×10 множителя  
✅ **Коллекционирование** - артефакты 5 редкостей с уникальными эффектами  
✅ **Большие числа** - поддержка до e1e308  
✅ **Многослойный престиж** - Prestige → Ascension

### 📚 Документация

Полные спецификации в папке `/docs`:
- [INFINITELY_COMPLETE.md](docs/INFINITELY_COMPLETE.md) - **полный отчет о завершении**
- [BIG_NUMBERS.md](docs/BIG_NUMBERS.md)
- [ASCENSION.md](docs/ASCENSION.md)
- [REPEATABLE_RESEARCH_IMPLEMENTATION.md](docs/REPEATABLE_RESEARCH_IMPLEMENTATION.md)
- [BUILDING_EVOLUTION_IMPLEMENTATION.md](docs/BUILDING_EVOLUTION_IMPLEMENTATION.md)
- [PROCEDURAL_GALAXIES_IMPLEMENTATION.md](docs/PROCEDURAL_GALAXIES_IMPLEMENTATION.md)
- [ARTIFACTS_IMPLEMENTATION.md](docs/ARTIFACTS_IMPLEMENTATION.md)

### 🚀 Игра Готова к Бесконечной Игре!

**Цель достигнута:** Из игры на 8-10 часов создана игра с **бесконечным** контентом и прогрессией!

---


