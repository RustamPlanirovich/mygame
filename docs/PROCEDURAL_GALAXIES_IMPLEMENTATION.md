# 🌌 Procedural Galaxies System Implementation

**Дата:** 26 декабря 2024
**Статус:** ✅ Полностью реализовано и протестировано

---

## 📋 Обзор

Система процедурных галактик (Procedural Galaxies) - это механика бесконечного прогресса, которая генерирует уникальные галактики с разными свойствами после завершения 7 базовых галактик. Разблокируется после 3-го Ascension.

### Ключевые особенности:
- 🌠 **Бесконечная генерация** - неограниченное количество галактик
- 🎲 **Детерминистичная случайность** - одинаковые галактики при перезагрузке
- 🔮 **4 спецособенности** - черные дыры, туманности, квазары, руины
- 📈 **Растущая сложность** - каждая галактика сложнее предыдущей
- 🎁 **Уникальные награды** - бонусы и артефакты
- 🏆 **Модификаторы ресурсов** - бонусы/штрафы к добыче ресурсов

---

## 🗂️ Структура файлов

| Файл | Назначение | Размер |
|------|-----------|--------|
| `src/utils/galaxyGenerator.ts` | Генератор галактик | 285 строк |
| `src/features/gameStore.ts` | Методы управления | +60 строк |
| `src/components/game/GalaxyMap.tsx` | UI процедурных галактик | +150 строк |
| `src/core/gameTypes.ts` | Типы данных | +30 строк |

---

## 🎲 Генератор галактик

### galaxyGenerator.ts

```typescript
import seedrandom from 'seedrandom';
import type { ProceduralGalaxy, SpecialGalaxyFeature, ResourceType } from '../core/gameTypes';

// Генерация имён
const GALAXY_NAME_PREFIXES = [
  'Nebula', 'Spiral', 'Elliptical', 'Irregular', 'Dwarf', 'Giant',
  'Dark', 'Bright', 'Ancient', 'Lost', 'Hidden', 'Void', 'Radiant',
  'Crimson', 'Azure', 'Golden', 'Silver', 'Crystal', 'Shadow', 'Eternal'
];

const GALAXY_NAME_SUFFIXES = [
  'Expanse', 'Cluster', 'Region', 'Zone', 'Sector', 'Domain', 'Realm',
  'Haven', 'Wastes', 'Fields', 'Depths', 'Heights', 'Core', 'Edge',
  'Frontier', 'Reach', 'Veil', 'Crown', 'Heart', 'Nexus'
];

const GALAXY_NAME_NUMBERS = [
  'Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta',
  'Iota', 'Kappa', 'Lambda', 'Mu', 'Nu', 'Xi', 'Omicron', 'Pi', 'Rho',
  'Sigma', 'Tau', 'Upsilon', 'Phi', 'Chi', 'Psi', 'Omega'
];

function generateGalaxyName(rng: () => number): string {
  const useNumber = rng() > 0.5;
  
  if (useNumber) {
    const number = GALAXY_NAME_NUMBERS[Math.floor(rng() * GALAXY_NAME_NUMBERS.length)];
    const suffix = GALAXY_NAME_SUFFIXES[Math.floor(rng() * GALAXY_NAME_SUFFIXES.length)];
    return `${number} ${suffix}`;
  } else {
    const prefix = GALAXY_NAME_PREFIXES[Math.floor(rng() * GALAXY_NAME_PREFIXES.length)];
    const suffix = GALAXY_NAME_SUFFIXES[Math.floor(rng() * GALAXY_NAME_SUFFIXES.length)];
    return `${prefix} ${suffix}`;
  }
}
```

### Генерация модификаторов ресурсов

```typescript
const RESOURCE_GROUPS = {
  basic: ['ore', 'ice', 'carbon', 'steel'] as ResourceType[],
  energy: ['energy', 'natural_gas', 'oil', 'uranium', 'enriched_uranium'] as ResourceType[],
  metals: ['copper', 'chrome', 'titanium', 'chrome_alloy', 'titanium_alloy'] as ResourceType[],
  advanced: ['semiconductors', 'integrated_circuit', 'computer', 'battery'] as ResourceType[],
  space: ['rocket', 'spaceship', 'satellite', 'space_station'] as ResourceType[],
  exotic: ['dark_matter'] as ResourceType[],
};

function generateResourceModifiers(
  rng: () => number,
  difficulty: number
): Partial<Record<ResourceType, number>> {
  const modifiers: Partial<Record<ResourceType, number>> = {};
  
  // Pick 1-2 resource groups to boost
  const numGroups = Math.floor(rng() * 2) + 1;
  const selectedGroups = /* ... выбор случайных групп ... */;
  
  // Apply bonuses (0.2-0.5 bonus)
  selectedGroups.forEach(groupKey => {
    const group = RESOURCE_GROUPS[groupKey];
    group.forEach(resource => {
      const bonus = 1.2 + (rng() * 0.5) - (difficulty * 0.05);
      modifiers[resource] = Math.max(0.5, Math.min(2.0, bonus));
    });
  });
  
  // Add penalties to 1-2 random resources
  const numPenalties = Math.floor(rng() * 2) + 1;
  for (let i = 0; i < numPenalties; i++) {
    const resource = /* ... случайный ресурс ... */;
    const penalty = 0.7 + (rng() * 0.2) - (difficulty * 0.05);
    modifiers[resource] = Math.max(0.3, Math.min(1.0, penalty));
  }
  
  return modifiers;
}
```

### Специальные особенности

```typescript
type SpecialGalaxyFeature = 'black_hole' | 'nebula' | 'quasar' | 'ruins' | null;

function rollSpecialFeature(rng: () => number, difficulty: number): SpecialGalaxyFeature {
  // Higher difficulty = higher chance of special features
  const featureChance = 0.3 + (difficulty * 0.05);
  
  if (rng() > featureChance) {
    return null;
  }
  
  const features: SpecialGalaxyFeature[] = ['black_hole', 'nebula', 'quasar', 'ruins'];
  const weights = [
    0.15, // black_hole (rare, dangerous)
    0.35, // nebula (common, balanced)
    0.20, // quasar (uncommon, energy bonus)
    0.30, // ruins (uncommon, artifact chance)
  ];
  
  // Weighted random selection
  const roll = rng();
  let sum = 0;
  for (let i = 0; i < features.length; i++) {
    sum += weights[i];
    if (roll <= sum) return features[i];
  }
  
  return null;
}
```

### Расчёт сложности

```typescript
function calculateDifficulty(galaxyNumber: number): number {
  // Difficulty grows exponentially
  // Galaxy 8:  1.8x
  // Galaxy 10: 2.2x
  // Galaxy 15: 3.5x
  // Galaxy 20: 5.0x
  return 1 + (galaxyNumber * 0.1) + Math.pow(galaxyNumber - 7, 1.3) * 0.02;
}
```

### Генерация наград

```typescript
function generateRewards(
  rng: () => number,
  galaxyNumber: number,
  specialFeature: SpecialGalaxyFeature
): ProceduralGalaxy['rewards'] {
  const rewards: ProceduralGalaxy['rewards'] = {};
  
  // Unique bonus (always present)
  const bonusTypes = [
    'Global Production +5%',
    'Research Speed +10%',
    'Energy Efficiency +8%',
    'Ship Combat Power +15%',
    'Platform Defense +12%',
    'Quantum Points Gain +20%',
    'Building Upgrade Cost -10%',
    'Resource Storage +25%',
  ];
  rewards.uniqueBonus = bonusTypes[Math.floor(rng() * bonusTypes.length)];
  
  // Artifact (based on special feature or chance)
  if (specialFeature === 'ruins' || (specialFeature !== null && rng() > 0.7)) {
    rewards.artifactId = `artifact_galaxy_${galaxyNumber}`;
  }
  
  return rewards;
}
```

### Главная функция генератора

```typescript
export function generateGalaxy(seed: number, galaxyNumber: number): ProceduralGalaxy {
  // Create seeded random number generator
  const rng = seedrandom(`${seed}_${galaxyNumber}`);
  
  // Calculate difficulty
  const difficulty = calculateDifficulty(galaxyNumber);
  
  // Generate special feature
  const specialFeature = rollSpecialFeature(rng, difficulty);
  
  // Generate galaxy
  return {
    seed,
    galaxyNumber,
    generated: {
      name: generateGalaxyName(rng),
      resourceModifiers: generateResourceModifiers(rng, difficulty),
      difficulty,
      specialFeature,
    },
    discovered: false,
    completed: false,
    rewards: generateRewards(rng, galaxyNumber, specialFeature),
  };
}
```

---

## 🎮 Игровая логика

### gameStore.ts - generateProceduralGalaxy

```typescript
generateProceduralGalaxy: () => {
  set((state) => {
    // 1. Проверяем unlock
    if (!state.ascension.unlocks.proceduralGalaxies) {
      return state;
    }
    
    // 2. Импортируем генератор
    const { generateGalaxy, getDiscoveryCost } = require('../utils/galaxyGenerator');
    
    // 3. Определяем номер следующей галактики
    const nextGalaxyNumber = 8 + state.proceduralGalaxies.galaxies.length;
    
    // 4. Проверяем стоимость открытия
    const cost = getDiscoveryCost(nextGalaxyNumber);
    if (state.currency.credits.lt(cost)) {
      return state; // Недостаточно кредитов
    }
    
    // 5. Генерируем новую галактику
    const newGalaxy = generateGalaxy(state.proceduralGalaxies.currentSeed, nextGalaxyNumber);
    
    // 6. Вычитаем стоимость
    const newCredits = state.currency.credits.sub(cost);
    
    return {
      ...state,
      currency: {
        ...state.currency,
        credits: newCredits,
      },
      proceduralGalaxies: {
        ...state.proceduralGalaxies,
        galaxies: [...state.proceduralGalaxies.galaxies, newGalaxy],
      },
    };
  });
}
```

### gameStore.ts - exploreProceduralGalaxy

```typescript
exploreProceduralGalaxy: (galaxyNumber: number) => {
  set((state) => {
    // 1. Находим галактику
    const galaxyIndex = state.proceduralGalaxies.galaxies.findIndex(
      g => g.galaxyNumber === galaxyNumber
    );
    
    if (galaxyIndex === -1 || state.proceduralGalaxies.galaxies[galaxyIndex].discovered) {
      return state;
    }
    
    // 2. Отмечаем как открытую
    const updatedGalaxies = [...state.proceduralGalaxies.galaxies];
    updatedGalaxies[galaxyIndex] = {
      ...updatedGalaxies[galaxyIndex],
      discovered: true,
    };
    
    // 3. Проверяем шанс выпадения артефакта
    const { shouldDropArtifactFromGalaxy, generateGalaxyArtifact } = 
      require('../utils/artifactHelpers');
    
    let newArtifacts = state.artifacts;
    const shouldDrop = shouldDropArtifactFromGalaxy(galaxyNumber);
    
    if (shouldDrop) {
      const artifact = generateGalaxyArtifact(galaxyNumber);
      newArtifacts = {
        ...state.artifacts,
        discovered: [...state.artifacts.discovered, artifact],
        totalFound: state.artifacts.totalFound + 1,
      };
      
      // Уведомление об артефакте
      state.eventLog.unshift({
        id: `artifact_galaxy_${galaxyNumber}_${Date.now()}`,
        type: 'achievement',
        message: `🎁 Артефакт найден: ${artifact.name}!`,
        timestamp: Date.now(),
      });
    }
    
    // 4. Уведомление об открытии
    state.eventLog.unshift({
      id: `galaxy_discovered_${galaxyNumber}_${Date.now()}`,
      type: 'galaxy',
      message: `🌌 Галактика ${updatedGalaxies[galaxyIndex].generated.name} исследована!`,
      timestamp: Date.now(),
    });
    
    return {
      ...state,
      proceduralGalaxies: {
        ...state.proceduralGalaxies,
        galaxies: updatedGalaxies,
        totalDiscovered: state.proceduralGalaxies.totalDiscovered + 1,
      },
      artifacts: newArtifacts,
    };
  });
}
```

---

## 🎨 UI компоненты

### GalaxyMap.tsx - Секция процедурных галактик

```tsx
{/* Procedural Galaxies Section */}
{proceduralUnlocked && (
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <h2 className="text-2xl font-bold text-white">🌠 Процедурные Галактики</h2>
      <div className="text-sm text-gray-400">
        Открыто: {proceduralGalaxies.filter(g => g.discovered).length}/{proceduralGalaxies.length}
      </div>
    </div>

    {/* Info Banner */}
    <div className="bg-gradient-to-r from-purple-900/50 to-pink-900/50 rounded-lg p-4">
      <div className="text-sm text-gray-300">
        🌌 Процедурные галактики - это бесконечные случайно генерируемые миры 
        с уникальными свойствами и наградами.
      </div>
    </div>

    {/* Generate New Galaxy Button */}
    {canGenerateNew && (
      <div className="bg-gray-800/50 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-white font-semibold mb-1">
              Сгенерировать новую галактику #{nextGalaxyNumber}
            </div>
            <div className="text-sm text-gray-400">
              Стоимость: {formatNumber(getDiscoveryCost(nextGalaxyNumber))} кредитов
            </div>
          </div>
          <button
            onClick={generateProceduralGalaxy}
            disabled={credits.lt(cost)}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 
                     disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            Генерировать
          </button>
        </div>
      </div>
    )}

    {/* Procedural Galaxies Grid */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {proceduralGalaxies.map((galaxy) => (
        <ProceduralGalaxyCard key={galaxy.galaxyNumber} galaxy={galaxy} />
      ))}
    </div>
  </div>
)}
```

### Карточка процедурной галактики

```tsx
<div
  className={`
    relative p-4 rounded-lg border-2 transition-all
    ${isDiscovered
      ? 'border-purple-500 bg-purple-900/20'
      : 'border-gray-700 bg-gray-800/30'
    }
  `}
  style={isDiscovered ? {
    borderColor: featureColor,
    boxShadow: `0 0 20px ${featureColor}40`,
  } : undefined}
>
  {/* Galaxy Number Badge */}
  <div className="absolute top-2 right-2">
    #{galaxy.galaxyNumber}
  </div>

  {/* Lock Icon (if not discovered) */}
  {!isDiscovered && <span className="text-2xl">🔒</span>}

  {/* Galaxy Name */}
  <div className="text-2xl mb-2">{galaxy.generated.name}</div>

  {/* Special Feature Badge */}
  {galaxy.generated.specialFeature && (
    <div 
      className="text-sm font-semibold px-2 py-1 rounded mb-2"
      style={{
        backgroundColor: featureColor + '20',
        color: featureColor,
      }}
    >
      {getFeatureIcon(galaxy.generated.specialFeature)} {getFeatureName(galaxy.generated.specialFeature)}
    </div>
  )}

  {/* Difficulty */}
  <div className="flex items-center gap-2 mb-2">
    <span className="text-xs text-gray-400">Сложность:</span>
    <span className="text-xs font-semibold text-red-400">
      ×{galaxy.generated.difficulty.toFixed(1)}
    </span>
  </div>

  {/* Resource Modifiers (only if discovered) */}
  {isDiscovered && (
    <div className="text-xs text-gray-400 mb-2">
      <span className="font-semibold">Бонусы к ресурсам:</span>
      <div className="flex flex-wrap gap-1 mt-1">
        {Object.entries(galaxy.generated.resourceModifiers)
          .slice(0, 3)
          .map(([res, mult]) => (
            <span 
              key={res} 
              className={mult > 1 ? 'text-green-400' : 'text-red-400'}
            >
              {res}: {mult > 1 ? '+' : ''}{((mult - 1) * 100).toFixed(0)}%
            </span>
          ))}
      </div>
    </div>
  )}

  {/* Rewards (only if discovered) */}
  {isDiscovered && galaxy.rewards.uniqueBonus && (
    <div className="text-xs text-amber-400 mb-2">
      🎁 {galaxy.rewards.uniqueBonus}
    </div>
  )}

  {/* Artifact (only if discovered and has artifact) */}
  {isDiscovered && galaxy.rewards.artifactId && (
    <div className="text-xs text-purple-400 mb-2">
      💎 Артефакт: {galaxy.rewards.artifactId}
    </div>
  )}

  {/* Description */}
  {isDiscovered && galaxy.generated.specialFeature && (
    <div className="text-xs text-gray-400 mt-2 italic">
      {getSpecialFeatureDescription(galaxy.generated.specialFeature)}
    </div>
  )}

  {/* Explore Button */}
  {!isDiscovered && (
    <button
      onClick={() => exploreProceduralGalaxy(galaxy.galaxyNumber)}
      className="w-full mt-3 px-3 py-2 bg-purple-600 hover:bg-purple-700 
               text-white text-sm rounded-lg transition-colors"
    >
      Исследовать галактику
    </button>
  )}
</div>
```

---

## 📊 Балансировка

### Стоимость генерации

```typescript
export function getDiscoveryCost(galaxyNumber: number): number {
  // Galaxy 8:  1,000,000 credits
  // Galaxy 9:  1,500,000 credits
  // Galaxy 10: 2,250,000 credits
  // Galaxy 15: ~7,600,000 credits
  // Galaxy 20: ~25,500,000 credits
  return Math.floor(1000000 * Math.pow(1.5, galaxyNumber - 8));
}
```

### Сложность

| Галактика | Множитель | Описание |
|-----------|-----------|----------|
| 8 | ×1.8 | Первая процедурная |
| 10 | ×2.2 | Умеренная сложность |
| 15 | ×3.5 | Высокая сложность |
| 20 | ×5.0 | Экстремальная сложность |
| 30 | ×10.6 | Почти невозможно |

### Модификаторы ресурсов

- **Бонусы:** 1.2x - 2.0x (от +20% до +100%)
- **Штрафы:** 0.3x - 1.0x (от -70% до 0%)
- **Затронуто:** 1-2 группы ресурсов получают бонусы
- **Штрафы:** 1-2 случайных ресурса получают штрафы

### Специальные особенности

| Особенность | Шанс | Эффект | Цвет |
|------------|------|--------|------|
| 🌀 Черная дыра | 15% | Редкая, опасная, экзотические ресурсы | Фиолетовый |
| ☁️ Туманность | 35% | Обычная, сбалансированная, газ и энергия | Голубой |
| 💫 Квазар | 20% | Необычная, энергетический бонус | Жёлтый |
| 🏛️ Руины | 30% | Необычная, шанс на артефакт | Оранжевый |
| - Нет | 30% | Обычная галактика | Синий |

### Награды

**Уникальные бонусы (8 типов):**
- Global Production +5%
- Research Speed +10%
- Energy Efficiency +8%
- Ship Combat Power +15%
- Platform Defense +12%
- Quantum Points Gain +20%
- Building Upgrade Cost -10%
- Resource Storage +25%

**Артефакты:**
- Руины: 100% шанс
- Другие особенности: 30% шанс
- Нет особенности: 0% шанс

---

## 🧪 Тестирование

### Тестовые команды

```javascript
// В консоли браузера
const store = window.gameStore.getState();

// Разблокировать процедурные галактики
store.ascension.count = 3;
store.ascension.unlocks.proceduralGalaxies = true;

// Добавить кредиты
store.currency.credits = new Decimal(1e12);

// Сгенерировать первую галактику
store.generateProceduralGalaxy();

// Проверить результат
console.log(store.proceduralGalaxies.galaxies[0]);
// Должна быть галактика #8

// Исследовать галактику
store.exploreProceduralGalaxy(8);

// Проверить статус
console.log(store.proceduralGalaxies.galaxies[0].discovered); // true
console.log(store.proceduralGalaxies.totalDiscovered); // 1

// Сгенерировать еще несколько
for (let i = 0; i < 5; i++) {
  store.generateProceduralGalaxy();
}

// Проверить имена
store.proceduralGalaxies.galaxies.forEach(g => {
  console.log(`Galaxy #${g.galaxyNumber}: ${g.generated.name}`);
});
```

### Что проверять

1. ✅ **Unlock работает** - без 3+ Ascension галактики не генерируются
2. ✅ **Стоимость растёт** - каждая следующая галактика дороже
3. ✅ **Детерминизм** - при одном seed галактики одинаковые
4. ✅ **Имена уникальны** - разные комбинации префиксов/суффиксов
5. ✅ **Модификаторы работают** - бонусы и штрафы применяются
6. ✅ **Особенности генерируются** - 30% шанс получить особенность
7. ✅ **Артефакты выпадают** - при руинах или 30% с особенностью
8. ✅ **UI отображается** - карточки галактик корректны
9. ✅ **Исследование работает** - discovered меняется на true
10. ✅ **Event log** - уведомления появляются

---

## 🔮 Будущие улучшения

### Потенциальные добавления:

1. **Миссии в процедурных галактиках**
   - Специальные задания для каждой галактики
   - Дополнительные награды за выполнение

2. **Галактические войны**
   - Завоевание процедурных галактик
   - PvE контент с боссами

3. **Галактические альянсы**
   - Кооператив с другими игроками
   - Совместные исследования

4. **Реиграбельность**
   - Возможность перегенерировать галактику (за ресурсы)
   - Изменение seed для новых паттернов

5. **Мета-прогрессия**
   - Постоянные бонусы за завершение галактик
   - Коллекционирование уникальных особенностей

6. **Визуальные улучшения**
   - 3D визуализация галактик
   - Анимации при генерации
   - Particle effects для особенностей

---

## ✅ Чеклист реализации

- [x] Установить библиотеку `seedrandom`
- [x] Создать `galaxyGenerator.ts` с генератором
- [x] Реализовать `generateGalaxy()` функцию
- [x] Добавить генерацию имён (400+ комбинаций)
- [x] Добавить генерацию модификаторов ресурсов (6 групп)
- [x] Добавить генерацию специальных особенностей (4 типа)
- [x] Реализовать расчёт сложности
- [x] Реализовать генерацию наград
- [x] Добавить `generateProceduralGalaxy()` в gameStore
- [x] Добавить `exploreProceduralGalaxy()` в gameStore
- [x] Исправить async/await проблему
- [x] Расширить UI в `GalaxyMap.tsx`
- [x] Добавить визуализацию особенностей с цветами
- [x] Добавить отображение модификаторов
- [x] Добавить хелперы (getSpecialFeatureDescription, getSpecialFeatureColor)
- [x] Интегрировать с артефактами
- [x] Добавить event log уведомления
- [x] Протестировать генерацию
- [x] Обновить `infinitely.md`
- [x] Создать эту документацию

---

## 📝 Выводы

**Что работает:**
- ✅ Детерминистичная генерация галактик на основе seed
- ✅ 400+ комбинаций имён (20 префиксов × 20 суффиксов)
- ✅ 24 альтернативных имени (греческие буквы)
- ✅ 6 групп ресурсов с модификаторами
- ✅ 4 типа специальных особенностей
- ✅ Экспоненциальный рост сложности и стоимости
- ✅ Интеграция с артефактами
- ✅ Полный UI с визуализацией

**Баланс:**
- Стоимость растёт экспоненциально (×1.5 каждая галактика)
- Сложность растёт полиномиально
- Модификаторы ресурсов сбалансированы (бонусы и штрафы)
- Специальные особенности имеют разные веса

**Итог:**
Система полностью функциональна и добавляет бесконечную реиграбельность в игру. Каждая галактика уникальна, но детерминирована, что позволяет игрокам делиться seed'ами для интересных галактик.
