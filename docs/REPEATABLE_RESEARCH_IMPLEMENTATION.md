# 🔬 Повторяемые Исследования - Детальный План Реализации

> **Статус:** ✅ ЗАВЕРШЕНО (26 декабря 2024)
> **Связь:** Phase 3 из infinitely.md
> **Приоритет:** Средний (после завершения Ascension Phase 2)
> **Оценка времени:** 2-3 дня
> **Фактическое время:** ~1 день

---

## ✅ РЕАЛИЗАЦИЯ ЗАВЕРШЕНА

Все компоненты Phase 3 успешно реализованы и интегрированы:

### Выполненные Задачи:
- ✅ Типы и структуры данных (gameTypes.ts)
- ✅ Константы исследований (repeatableResearch.ts)
- ✅ UI компоненты (RepeatableResearchList, RepeatableResearchItem)
- ✅ Интеграция в ResearchPanel
- ✅ Логика покупки (researchRepeatable)
- ✅ Интеграция бонусов в игровой цикл
- ✅ Сброс при Ascension с сохранением истории
- ✅ Вспомогательные функции (repeatableResearchHelpers.ts)
- ✅ Статистика и отслеживание

### Применяемые Бонусы:
- ✅ productionMultiplier - к общему производству
- ✅ researchSpeedMultiplier - к скорости исследований  
- ✅ qpGainMultiplier - к получению Quantum Points
- ✅ energyEfficiency - снижение потребления энергии
- ✅ exoticResourcesMultiplier - к производству экзотики
- ✅ automationSpeed - к автоматическим процессам

---

## 📋 Краткое Описание

Повторяемые исследования — это бесконечно улучшаемые технологии, которые разблокируются после **первого Ascension**. В отличие от обычных исследований из дерева технологий (которые покупаются один раз), повторяемые можно прокачивать до бесконечности, но с ограничением уровня за одно прохождение.

### Ключевые Особенности:
- ✅ Разблокируются после 1-го Ascension
- ✅ Можно улучшать бесконечно
- ✅ Лимит уровня за прохождение: 100 + (ascensionCount × 25)
- ✅ Стоимость растет экспоненциально: ×1.5 за уровень
- ✅ Уровни сбрасываются при каждом Ascension (для реиграбельности)
- ✅ История и статистика сохраняются

---

## 🎯 Список Повторяемых Исследований

### 1. **Automation Efficiency** (Эффективность Автоматизации)
```typescript
{
  id: 'automation_efficiency',
  name: 'Эффективность Автоматизации',
  icon: '⚡',
  description: 'Увеличивает скорость автоматических покупок зданий',
  baseCost: {
    credits: 1_000_000,
  },
  costScaling: 1.5,
  effectType: 'percentage',
  valuePerLevel: 0.02, // +2% за уровень
}
```

### 2. **Quantum Computing** (Квантовые Вычисления)
```typescript
{
  id: 'quantum_computing',
  name: 'Квантовые Вычисления',
  icon: '💎',
  description: 'Увеличивает получение Quantum Points при престиже',
  baseCost: {
    quantumPoints: 500_000,
  },
  costScaling: 1.5,
  effectType: 'percentage',
  valuePerLevel: 0.03, // +3% за уровень
}
```

### 3. **Matter Compression** (Сжатие Материи)
```typescript
{
  id: 'matter_compression',
  name: 'Сжатие Материи',
  icon: '🗜️',
  description: 'Увеличивает производство всех базовых ресурсов',
  baseCost: {
    iron: 10_000_000,
    copper: 5_000_000,
    silicon: 1_000_000,
  },
  costScaling: 1.5,
  effectType: 'percentage',
  valuePerLevel: 0.01, // +1% за уровень
}
```

### 4. **Energy Optimization** (Оптимизация Энергии)
```typescript
{
  id: 'energy_optimization',
  name: 'Оптимизация Энергии',
  icon: '⚙️',
  description: 'Снижает потребление энергии всеми зданиями',
  baseCost: {
    energy: 50_000_000,
  },
  costScaling: 1.5,
  effectType: 'percentage',
  valuePerLevel: 0.01, // +1% снижение за уровень
}
```

### 5. **Neural Networks** (Нейронные Сети)
```typescript
{
  id: 'neural_networks',
  name: 'Нейронные Сети',
  icon: '🧠',
  description: 'Увеличивает скорость обычных исследований из дерева',
  baseCost: {
    data: 100_000,
    credits: 1_000_000,
  },
  costScaling: 1.5,
  effectType: 'percentage',
  valuePerLevel: 0.02, // +2% за уровень
}
```

### 6. **Dark Matter Manipulation** (Манипуляция Темной Материей)
```typescript
{
  id: 'dark_matter_manipulation',
  name: 'Манипуляция Темной Материей',
  icon: '🌌',
  description: 'Увеличивает производство экзотических ресурсов',
  baseCost: {
    darkMatter: 10_000,
    antimatter: 1_000_000,
  },
  costScaling: 1.5,
  effectType: 'percentage',
  valuePerLevel: 0.015, // +1.5% за уровень
}
```

---

## 📐 Формулы и Расчеты

### Стоимость Уровня
```typescript
function calculateRepeatableCost(
  baseCost: Record<string, number>,
  currentLevel: number
): Record<string, number> {
  const scaling = 1.5;
  const result: Record<string, number> = {};
  
  for (const [resourceId, baseAmount] of Object.entries(baseCost)) {
    result[resourceId] = Math.floor(baseAmount * Math.pow(scaling, currentLevel));
  }
  
  return result;
}
```

**Примеры стоимости (Automation Efficiency):**
- Уровень 1: 1M Credits
- Уровень 10: 57.67M Credits
- Уровень 25: 1.88B Credits
- Уровень 50: 637.62B Credits
- Уровень 100: 405.88Q Credits (квадриллионы)

### Эффект от Уровня
```typescript
function calculateRepeatableEffect(
  valuePerLevel: number,
  currentLevel: number
): number {
  return 1 + (valuePerLevel * currentLevel);
}
```

**Примеры эффекта (Automation Efficiency, +2%/lvl):**
- Уровень 0: 1.0× (нет бонуса)
- Уровень 25: 1.5× (+50%)
- Уровень 50: 2.0× (удвоение, +100%)
- Уровень 100: 3.0× (утроение, +200%)

### Максимальный Уровень за Прохождение
```typescript
function getMaxLevelPerAscension(ascensionCount: number): number {
  return 100 + (ascensionCount * 25);
}
```

**Примеры:**
- 0 ascensions: исследования недоступны
- 1 ascension: макс 125 уровень
- 2 ascensions: макс 150 уровень
- 5 ascensions: макс 225 уровень
- 10 ascensions: макс 350 уровень

---

## 🛠️ Реализация: Шаг за Шагом

### Шаг 1: UI Компонент (ResearchPanel.tsx)

#### Добавить вкладку "Повторяемые"

```typescript
// src/components/game/ResearchPanel.tsx

const ResearchPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'tree' | 'repeatable'>('tree');
  const game = useGameStore();
  
  const showRepeatable = game.ascension.unlocks.infiniteResearch;
  
  return (
    <div className="research-panel">
      <div className="tabs">
        <button 
          className={activeTab === 'tree' ? 'active' : ''}
          onClick={() => setActiveTab('tree')}
        >
          🌳 Дерево Технологий
        </button>
        
        <button 
          className={activeTab === 'repeatable' ? 'active' : ''}
          onClick={() => setActiveTab('repeatable')}
          disabled={!showRepeatable}
        >
          🔬 Повторяемые
          {!showRepeatable && ' 🔒'}
        </button>
      </div>
      
      {activeTab === 'tree' && <TechTree />}
      
      {activeTab === 'repeatable' && (
        showRepeatable ? (
          <RepeatableResearchList />
        ) : (
          <div className="locked-message">
            <p>🔒 Повторяемые исследования разблокируются после первого Вознесения</p>
          </div>
        )
      )}
    </div>
  );
};
```

#### Создать компонент RepeatableResearchList

```typescript
// src/components/game/RepeatableResearchList.tsx

import { REPEATABLE_RESEARCHES } from '../../core/constants/repeatableResearch';

const RepeatableResearchList: React.FC = () => {
  const game = useGameStore();
  const maxLevel = getMaxLevelPerAscension(game.ascension.count);
  
  return (
    <div className="repeatable-research-list">
      <div className="header">
        <h3>🔬 Повторяемые Исследования</h3>
        <p className="description">
          Бесконечно улучшаемые технологии. Максимум {maxLevel} уровня за прохождение.
        </p>
      </div>
      
      <div className="research-grid">
        {REPEATABLE_RESEARCHES.map(research => {
          const currentLevel = game.repeatableResearch[research.id] || 0;
          const canAfford = checkCanAffordRepeatable(game, research, currentLevel);
          
          return (
            <RepeatableResearchItem
              key={research.id}
              research={research}
              currentLevel={currentLevel}
              maxLevel={maxLevel}
              canAfford={canAfford}
              onResearch={() => game.researchRepeatable(research.id)}
            />
          );
        })}
      </div>
    </div>
  );
};
```

#### Создать компонент RepeatableResearchItem

```typescript
// src/components/game/RepeatableResearchItem.tsx

interface RepeatableResearchItemProps {
  research: RepeatableResearch;
  currentLevel: number;
  maxLevel: number;
  canAfford: boolean;
  onResearch: () => void;
}

const RepeatableResearchItem: React.FC<RepeatableResearchItemProps> = ({
  research,
  currentLevel,
  maxLevel,
  canAfford,
  onResearch,
}) => {
  const nextCost = calculateRepeatableCost(research.baseCost, currentLevel);
  const currentEffect = calculateRepeatableEffect(research.valuePerLevel, currentLevel);
  const nextEffect = calculateRepeatableEffect(research.valuePerLevel, currentLevel + 1);
  const effectDelta = nextEffect - currentEffect;
  
  const isMaxLevel = currentLevel >= maxLevel;
  const progress = (currentLevel / maxLevel) * 100;
  
  return (
    <div className={`repeatable-item ${canAfford ? 'available' : 'locked'} ${isMaxLevel ? 'max-level' : ''}`}>
      {/* Заголовок */}
      <div className="header">
        <span className="icon">{research.icon}</span>
        <div className="title-section">
          <h4 className="name">{research.name}</h4>
          <span className="level">Уровень {currentLevel} / {maxLevel}</span>
        </div>
      </div>
      
      {/* Прогресс-бар */}
      <div className="progress-bar">
        <div className="fill" style={{ width: `${progress}%` }} />
      </div>
      
      {/* Описание */}
      <p className="description">{research.description}</p>
      
      {/* Эффекты */}
      <div className="effects">
        <div className="current-effect">
          <span className="label">Текущий бонус:</span>
          <span className="value">{formatEffectValue(currentEffect, research.effectType)}</span>
        </div>
        
        {!isMaxLevel && (
          <div className="next-effect">
            <span className="label">Следующий уровень:</span>
            <span className="value">
              +{formatEffectValue(effectDelta, research.effectType)}
              {' '}
              <span className="total">(всего {formatEffectValue(nextEffect, research.effectType)})</span>
            </span>
          </div>
        )}
      </div>
      
      {/* Стоимость */}
      {!isMaxLevel && (
        <div className="cost-section">
          <span className="cost-label">Стоимость:</span>
          <ResourceCostDisplay cost={nextCost} />
        </div>
      )}
      
      {/* Кнопка */}
      <button
        className="research-button"
        disabled={!canAfford || isMaxLevel}
        onClick={onResearch}
      >
        {isMaxLevel ? '✅ Макс. уровень' : canAfford ? 'Исследовать' : '❌ Недостаточно ресурсов'}
      </button>
      
      {/* Статистика (если есть) */}
      {currentLevel > 0 && (
        <div className="stats">
          <small>Всего улучшено: {currentLevel} раз</small>
        </div>
      )}
    </div>
  );
};
```

#### Хелпер для форматирования эффектов

```typescript
// src/utils/formatHelpers.ts

function formatEffectValue(value: number, type: 'percentage' | 'multiplier'): string {
  if (type === 'percentage') {
    const percent = (value - 1) * 100;
    return `+${percent.toFixed(1)}%`;
  }
  
  if (type === 'multiplier') {
    return `×${value.toFixed(2)}`;
  }
  
  return value.toString();
}
```

---

### Шаг 2: Логика в GameStore

#### Обновить метод researchRepeatable

```typescript
// src/features/gameStore.ts

researchRepeatable: (researchId: string) => {
  const state = get();
  
  // 1. Проверка разблокировки
  if (!state.ascension.unlocks.infiniteResearch) {
    console.warn('Repeatable research not unlocked yet');
    return false;
  }
  
  // 2. Найти исследование
  const research = REPEATABLE_RESEARCHES.find(r => r.id === researchId);
  if (!research) {
    console.error('Unknown repeatable research:', researchId);
    return false;
  }
  
  // 3. Получить текущий уровень
  const currentLevel = state.repeatableResearch[researchId] || 0;
  const maxLevel = getMaxLevelPerAscension(state.ascension.count);
  
  // 4. Проверка максимального уровня
  if (currentLevel >= maxLevel) {
    console.log('Max level reached for', researchId);
    return false;
  }
  
  // 5. Расчет стоимости
  const cost = calculateRepeatableCost(research.baseCost, currentLevel);
  
  // 6. Проверка ресурсов
  for (const [resourceId, amount] of Object.entries(cost)) {
    const resource = state.resources[resourceId];
    
    if (!resource) {
      console.error('Unknown resource:', resourceId);
      return false;
    }
    
    if (resource.amount < amount) {
      console.log('Not enough', resourceId, ':', resource.amount, '<', amount);
      return false;
    }
  }
  
  // 7. Списание ресурсов
  for (const [resourceId, amount] of Object.entries(cost)) {
    state.resources[resourceId].amount -= amount;
  }
  
  // 8. Увеличение уровня
  const newLevel = currentLevel + 1;
  set(produce((draft) => {
    draft.repeatableResearch[researchId] = newLevel;
  }));
  
  // 9. Обновление статистики
  updateRepeatableResearchStats(state, researchId, newLevel, cost);
  
  // 10. Уведомление
  state.addEventNotification?.({
    type: 'research',
    message: `${research.name} улучшено до уровня ${newLevel}!`,
    icon: research.icon,
  });
  
  // 11. Проверка достижений
  state.checkAchievements?.();
  
  return true;
},
```

#### Хелпер для обновления статистики

```typescript
function updateRepeatableResearchStats(
  state: GameState,
  researchId: string,
  newLevel: number,
  cost: Record<string, number>
): void {
  const stats = state.repeatableResearchStats || {};
  const researchStats = stats[researchId] || {
    totalLevels: 0,
    highestLevel: 0,
    totalSpent: {},
  };
  
  // Обновить счетчики
  researchStats.totalLevels += 1;
  researchStats.highestLevel = Math.max(researchStats.highestLevel, newLevel);
  
  // Обновить траты
  for (const [resourceId, amount] of Object.entries(cost)) {
    researchStats.totalSpent[resourceId] = 
      (researchStats.totalSpent[resourceId] || 0) + amount;
  }
  
  // Сохранить
  useGameStore.setState({
    repeatableResearchStats: {
      ...stats,
      [researchId]: researchStats,
    },
  });
}
```

---

### Шаг 3: Интеграция Бонусов в Game Loop

#### Создать хелпер для расчета бонусов

```typescript
// src/utils/repeatableResearchHelpers.ts

export interface RepeatableBonuses {
  productionMultiplier: number;       // Matter Compression
  researchSpeedMultiplier: number;    // Neural Networks
  energyEfficiency: number;           // Energy Optimization (1 - меньше потребление)
  qpGainMultiplier: number;          // Quantum Computing
  automationSpeed: number;            // Automation Efficiency
  exoticResourcesMultiplier: number; // Dark Matter Manipulation
}

export function getTotalRepeatableBonuses(
  repeatableResearch: Record<string, number>
): RepeatableBonuses {
  const bonuses: RepeatableBonuses = {
    productionMultiplier: 1.0,
    researchSpeedMultiplier: 1.0,
    energyEfficiency: 1.0,
    qpGainMultiplier: 1.0,
    automationSpeed: 1.0,
    exoticResourcesMultiplier: 1.0,
  };
  
  // Matter Compression: +1% к производству базовых ресурсов за уровень
  const matterLevel = repeatableResearch['matter_compression'] || 0;
  bonuses.productionMultiplier += matterLevel * 0.01;
  
  // Neural Networks: +2% к скорости исследований за уровень
  const neuralLevel = repeatableResearch['neural_networks'] || 0;
  bonuses.researchSpeedMultiplier += neuralLevel * 0.02;
  
  // Energy Optimization: +1% снижение потребления за уровень
  const energyLevel = repeatableResearch['energy_optimization'] || 0;
  bonuses.energyEfficiency = 1 - (energyLevel * 0.01);
  
  // Quantum Computing: +3% к QP за уровень
  const quantumLevel = repeatableResearch['quantum_computing'] || 0;
  bonuses.qpGainMultiplier += quantumLevel * 0.03;
  
  // Automation Efficiency: +2% к скорости автопокупок за уровень
  const automationLevel = repeatableResearch['automation_efficiency'] || 0;
  bonuses.automationSpeed += automationLevel * 0.02;
  
  // Dark Matter Manipulation: +1.5% к производству экзотики за уровень
  const darkMatterLevel = repeatableResearch['dark_matter_manipulation'] || 0;
  bonuses.exoticResourcesMultiplier += darkMatterLevel * 0.015;
  
  return bonuses;
}

// Проверка является ли ресурс базовым
export function isBasicResource(resourceId: string): boolean {
  return ['iron', 'copper', 'silicon', 'titanium', 'crystal'].includes(resourceId);
}

// Проверка является ли ресурс экзотическим
export function isExoticResource(resourceId: string): boolean {
  return ['darkMatter', 'antimatter', 'exotic matter', 'strange_quarks'].includes(resourceId);
}
```

#### Применить в Production Loop

```typescript
// src/core/loop/productionLoop.ts

import { getTotalRepeatableBonuses, isBasicResource, isExoticResource } from '../../utils/repeatableResearchHelpers';

export function calculateProduction(state: GameState, deltaTime: number): void {
  // Получить бонусы от повторяемых исследований
  const repeatableBonuses = getTotalRepeatableBonuses(state.repeatableResearch || {});
  
  // Применить к производству ресурсов
  for (const resource of Object.values(state.resources)) {
    let multiplier = 1.0;
    
    // Базовые ресурсы получают бонус от Matter Compression
    if (isBasicResource(resource.id)) {
      multiplier *= repeatableBonuses.productionMultiplier;
    }
    
    // Экзотические ресурсы получают бонус от Dark Matter Manipulation
    if (isExoticResource(resource.id)) {
      multiplier *= repeatableBonuses.exoticResourcesMultiplier;
    }
    
    // Применить множитель
    resource.production *= multiplier;
  }
  
  // Применить к энергопотреблению
  if (state.powerGrid) {
    state.powerGrid.totalConsumption *= repeatableBonuses.energyEfficiency;
  }
  
  // ... остальная логика production loop ...
}
```

#### Применить в Research Loop

```typescript
// src/core/loop/researchLoop.ts (если существует)

export function updateResearch(state: GameState, deltaTime: number): void {
  const repeatableBonuses = getTotalRepeatableBonuses(state.repeatableResearch || {});
  
  // Применить бонус к скорости исследований
  for (const research of Object.values(state.technologies)) {
    if (research.inProgress) {
      research.progress += 
        research.progressSpeed * 
        repeatableBonuses.researchSpeedMultiplier * 
        deltaTime;
    }
  }
  
  // ... остальная логика ...
}
```

#### Применить в Prestige (Quantum Points)

```typescript
// В методе calculatePrestigeGain или подобном

calculatePrestigeGain: () => {
  const state = get();
  
  // Базовый расчет QP (существующая формула)
  let baseQP = calculateBaseQP(state);
  
  // Применить множитель от Ascension
  baseQP *= state.ascension.multipliers.qpGain;
  
  // Применить бонус от Quantum Computing (повторяемое исследование)
  const repeatableBonuses = getTotalRepeatableBonuses(state.repeatableResearch || {});
  baseQP *= repeatableBonuses.qpGainMultiplier;
  
  return Math.floor(baseQP);
},
```

---

### Шаг 4: Сброс при Ascension

#### Обновить performAscension()

```typescript
// src/features/gameStore.ts

performAscension: () => {
  const state = get();
  
  // ... существующий код проверок и расчета AP ...
  
  // Сохранить текущее состояние повторяемых исследований в историю
  const repeatableHistory = state.repeatableResearchHistory || [];
  const currentRun: RepeatableResearchRunHistory = {
    ascensionNumber: state.ascension.count,
    timestamp: Date.now(),
    researches: { ...state.repeatableResearch },
    totalLevels: Object.values(state.repeatableResearch || {}).reduce(
      (sum, level) => sum + level,
      0
    ),
    stats: { ...state.repeatableResearchStats },
  };
  
  repeatableHistory.push(currentRun);
  
  // Сбросить уровни повторяемых исследований
  set({
    repeatableResearch: {}, // Все обнуляем
    repeatableResearchHistory: repeatableHistory,
  });
  
  // Уведомление
  state.addEventNotification?.({
    type: 'ascension',
    message: `Вознесение завершено! Повторяемые исследования сброшены.`,
  });
  
  // ... остальной код performAscension ...
},
```

#### Добавить типы для истории

```typescript
// src/core/gameTypes.ts

interface RepeatableResearchRunHistory {
  ascensionNumber: number;
  timestamp: number;
  researches: Record<string, number>;
  totalLevels: number;
  stats: Record<string, RepeatableResearchStats>;
}

interface RepeatableResearchStats {
  totalLevels: number;        // Всего уровней куплено
  highestLevel: number;       // Максимальный достигнутый уровень
  totalSpent: Record<string, number>; // Сколько ресурсов потрачено
}
```

---

### Шаг 5: Достижения

#### Добавить новые достижения

```typescript
// src/core/constants/achievements.ts

// Группа достижений для повторяемых исследований
const REPEATABLE_RESEARCH_ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_repeatable',
    name: 'Первые Шаги Бесконечности',
    description: 'Купите первый уровень любого повторяемого исследования',
    condition: (state) => {
      const totalLevels = Object.values(state.repeatableResearch || {}).reduce(
        (sum, level) => sum + level,
        0
      );
      return totalLevels >= 1;
    },
    reward: {
      type: 'credits',
      amount: 100_000,
    },
    icon: '🔬',
    category: 'research',
  },
  
  {
    id: 'repeatable_level_25',
    name: 'Продвинутый Исследователь',
    description: 'Достигните 25 уровня в любом повторяемом исследовании',
    condition: (state) => {
      return Object.values(state.repeatableResearch || {}).some(level => level >= 25);
    },
    reward: {
      type: 'qp',
      amount: 1000,
    },
    icon: '📚',
    category: 'research',
  },
  
  {
    id: 'repeatable_level_50',
    name: 'Мастер Исследований',
    description: 'Достигните 50 уровня в любом повторяемом исследовании',
    condition: (state) => {
      return Object.values(state.repeatableResearch || {}).some(level => level >= 50);
    },
    reward: {
      type: 'qp',
      amount: 5000,
    },
    icon: '🎓',
    category: 'research',
  },
  
  {
    id: 'century_researcher',
    name: 'Исследователь Века',
    description: 'Достигните 100 уровня в любом повторяемом исследовании',
    condition: (state) => {
      return Object.values(state.repeatableResearch || {}).some(level => level >= 100);
    },
    reward: {
      type: 'qp',
      amount: 10_000,
    },
    icon: '💯',
    category: 'research',
  },
  
  {
    id: 'research_addict',
    name: 'Фанат Исследований',
    description: 'Достигните 50+ уровня во ВСЕХ повторяемых исследованиях',
    condition: (state) => {
      const researches = Object.values(state.repeatableResearch || {});
      return researches.length === 6 && researches.every(level => level >= 50);
    },
    reward: {
      type: 'multiplier',
      target: 'research_speed',
      amount: 1.1,
    },
    icon: '🧠',
    category: 'research',
  },
  
  {
    id: 'infinite_mind_500',
    name: 'Бесконечный Разум',
    description: 'Суммарно 500+ уровней повторяемых исследований',
    condition: (state) => {
      const totalLevels = Object.values(state.repeatableResearch || {}).reduce(
        (sum, level) => sum + level,
        0
      );
      return totalLevels >= 500;
    },
    reward: {
      type: 'ascension_points',
      amount: 50,
    },
    icon: '♾️',
    category: 'research',
  },
  
  {
    id: 'infinite_mind_1000',
    name: 'Трансцендентальный Разум',
    description: 'Суммарно 1000+ уровней повторяемых исследований',
    condition: (state) => {
      const totalLevels = Object.values(state.repeatableResearch || {}).reduce(
        (sum, level) => sum + level,
        0
      );
      return totalLevels >= 1000;
    },
    reward: {
      type: 'ascension_points',
      amount: 100,
    },
    icon: '✨',
    category: 'research',
  },
];

// Добавить в основной массив ACHIEVEMENTS
export const ACHIEVEMENTS = [
  ...EXISTING_ACHIEVEMENTS,
  ...REPEATABLE_RESEARCH_ACHIEVEMENTS,
];
```

---

### Шаг 6: Миграция Сохранений

```typescript
// src/utils/saveMigration.ts

function migrateSaveV2toV3(save: SaveV2): SaveV3 {
  return {
    ...save,
    saveVersion: 3,
    
    // Добавить поля для повторяемых исследований
    repeatableResearch: save.repeatableResearch || {},
    repeatableResearchStats: save.repeatableResearchStats || {},
    repeatableResearchHistory: save.repeatableResearchHistory || [],
  };
}
```

---

### Шаг 7: Балансировка и Тестирование

#### Тестовая Команда (для dev режима)

```typescript
// Добавить в window для тестирования

if (import.meta.env.DEV) {
  window.testRepeatableResearch = () => {
    const game = useGameStore.getState();
    
    // Разблокировать повторяемые исследования
    game.ascension.count = 1;
    game.ascension.unlocks.infiniteResearch = true;
    
    // Дать много ресурсов
    game.resources.credits.amount = 1e15;
    game.resources.iron.amount = 1e15;
    game.resources.copper.amount = 1e15;
    game.resources.silicon.amount = 1e15;
    game.resources.energy.amount = 1e15;
    game.resources.data.amount = 1e12;
    game.resources.darkMatter.amount = 1e10;
    game.resources.antimatter.amount = 1e12;
    game.resources.quantumPoints.amount = 1e10;
    
    console.log('✅ Repeatable Research test mode enabled!');
    console.log('- Ascension unlocked');
    console.log('- Resources maxed out');
    console.log('- You can now test repeatable research');
  };
}
```

#### Чеклист Тестирования

**UI Тесты:**
- [ ] Вкладка "Повторяемые" скрыта до первого Ascension
- [ ] Вкладка показывается после первого Ascension
- [ ] Все 6 исследований отображаются корректно
- [ ] Текущий уровень / макс уровень отображается
- [ ] Стоимость следующего уровня корректна
- [ ] Эффект (текущий и следующий) отображается
- [ ] Прогресс-бар работает
- [ ] Кнопка "Исследовать" disabled когда не хватает ресурсов
- [ ] Кнопка "Исследовать" disabled когда достигнут макс уровень

**Логика Тесты:**
- [ ] Можно купить исследование если хватает ресурсов
- [ ] Нельзя купить если не хватает ресурсов
- [ ] Нельзя превысить maxLevelPerAscension
- [ ] Ресурсы списываются корректно
- [ ] Уровень увеличивается
- [ ] Уведомление показывается

**Game Loop Тесты:**
- [ ] Бонус Matter Compression применяется к базовым ресурсам
- [ ] Бонус Dark Matter Manipulation применяется к экзотике
- [ ] Бонус Energy Optimization снижает энергопотребление
- [ ] Бонус Neural Networks ускоряет обычные исследования
- [ ] Бонус Quantum Computing увеличивает получение QP
- [ ] Бонус Automation Efficiency ускоряет автопокупки (если реализовано)

**Ascension Тесты:**
- [ ] При Ascension уровни сбрасываются
- [ ] История сохраняется в repeatableResearchHistory
- [ ] Статистика сохраняется
- [ ] После Ascension можно снова качать с нуля

**Достижения Тесты:**
- [ ] "Первые Шаги Бесконечности" срабатывает при первой покупке
- [ ] "Исследователь Века" срабатывает при 100 уровне
- [ ] "Фанат Исследований" срабатывает когда все на 50+
- [ ] "Бесконечный Разум" срабатывает при 500+ суммарных уровнях

#### Балансировочные Параметры

**Если игра слишком легкая:**
- Увеличить costScaling с 1.5 до 1.6 или 1.7
- Уменьшить valuePerLevel
- Уменьшить базовый maxLevelPerAscension

**Если игра слишком сложная:**
- Уменьшить costScaling до 1.4
- Увеличить valuePerLevel
- Увеличить базовый maxLevelPerAscension

**Целевые метрики:**
- Первые 10 уровней: 1-5 минут
- 10-25 уровней: 10-20 минут
- 25-50 уровней: 30-60 минут
- 50-75 уровней: 1-2 часа
- 75-100 уровней: 2-4 часа

---

## 📈 Примерное Время Реализации

| Задача | Оценка времени |
|--------|---------------|
| UI компоненты (ResearchPanel, RepeatableResearchList, Item) | 4-6 часов |
| Логика GameStore (researchRepeatable, статистика) | 2-3 часа |
| Интеграция бонусов в game loop | 2-3 часа |
| Сброс при Ascension | 1 час |
| Достижения | 1 час |
| Тестирование | 2-3 часа |
| Балансировка и фикс багов | 2-4 часа |
| **Итого** | **14-20 часов (2-3 дня)** |

---

## ✅ Критерии Завершения

Phase 3 считается завершенной когда:

1. ✅ UI вкладка "Повторяемые" работает
2. ✅ Все 6 исследований можно покупать
3. ✅ Бонусы применяются в игре
4. ✅ Сброс при Ascension работает
5. ✅ Достижения срабатывают
6. ✅ Нет критических багов
7. ✅ Балансировка приемлема для тестирования

---

## 🔗 Связанные Файлы

### Создать новые:
- `src/core/constants/repeatableResearch.ts` (уже создан)
- `src/components/game/RepeatableResearchList.tsx`
- `src/components/game/RepeatableResearchItem.tsx`
- `src/utils/repeatableResearchHelpers.ts`
- `docs/REPEATABLE_RESEARCH_IMPLEMENTATION.md` (этот файл)

### Изменить существующие:
- `src/components/game/ResearchPanel.tsx` (добавить вкладку)
- `src/features/gameStore.ts` (улучшить researchRepeatable)
- `src/core/loop/productionLoop.ts` (применить бонусы)
- `src/core/constants/achievements.ts` (добавить достижения)
- `src/core/gameTypes.ts` (добавить типы истории)

---

## 📝 Заметки

- Повторяемые исследования должны ощущаться **значимыми**, но не **обязательными**
- Игрок должен **выбирать** какие качать, а не качать все сразу
- **Реиграбельность** — ключевая особенность: сброс при Ascension создает новый цикл
- **Синергия** с другими системами: бонусы дополняют, а не заменяют другие механики

---

**Последнее обновление:** 25 декабря 2025
**Статус:** Готов к началу реализации после завершения Phase 2 (Ascension)
