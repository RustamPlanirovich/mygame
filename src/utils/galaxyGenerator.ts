import seedrandom from 'seedrandom';
import type { ProceduralGalaxy, SpecialGalaxyFeature, ResourceType } from '../core/gameTypes';

// ============================================================================
// Galaxy Name Generation
// ============================================================================

/*
 * Списки были английскими, и «Crimson Expanse» / «Alpha Nexus» уходили в сохранение — это и
 * есть английские названия во вкладке «Галактика». Порядок слов сохранён один в один, чтобы
 * генерация по тому же seed давала ту же позицию в списке: у уже открытых галактик название
 * останется на своём месте, просто по-русски. Прилагательные — в женском роде («галактика»).
 *
 * Для галактик, уже сохранённых с английским названием, есть localizeGeneratedName()
 * в core/i18n/label.ts — она переводит их при отображении, без миграции сейвов.
 */
const GALAXY_NAME_PREFIXES = [
  'Туманная', 'Спиральная', 'Эллиптическая', 'Неправильная', 'Карликовая', 'Гигантская',
  'Тёмная', 'Яркая', 'Древняя', 'Потерянная', 'Скрытая', 'Пустотная', 'Сияющая',
  'Багровая', 'Лазурная', 'Золотая', 'Серебряная', 'Кристальная', 'Теневая', 'Вечная'
];

const GALAXY_NAME_SUFFIXES = [
  'Ширь', 'Скопление', 'Область', 'Зона', 'Сектор', 'Владение', 'Царство',
  'Убежище', 'Пустоши', 'Поля', 'Глубины', 'Высоты', 'Ядро', 'Край',
  'Рубеж', 'Предел', 'Завеса', 'Венец', 'Сердце', 'Узел'
];

const GALAXY_NAME_NUMBERS = [
  'Альфа', 'Бета', 'Гамма', 'Дельта', 'Эпсилон', 'Дзета', 'Эта', 'Тета',
  'Йота', 'Каппа', 'Лямбда', 'Мю', 'Ню', 'Кси', 'Омикрон', 'Пи', 'Ро',
  'Сигма', 'Тау', 'Ипсилон', 'Фи', 'Хи', 'Пси', 'Омега'
];

function generateGalaxyName(rng: () => number): string {
  const useNumber = rng() > 0.5;

  if (useNumber) {
    const number = GALAXY_NAME_NUMBERS[Math.floor(rng() * GALAXY_NAME_NUMBERS.length)];
    const suffix = GALAXY_NAME_SUFFIXES[Math.floor(rng() * GALAXY_NAME_SUFFIXES.length)];
    // «Узел Сигма», а не «Сигма Узел»: греческая буква в русском идёт после существительного.
    return `${suffix} ${number}`;
  } else {
    const prefix = GALAXY_NAME_PREFIXES[Math.floor(rng() * GALAXY_NAME_PREFIXES.length)];
    const suffix = GALAXY_NAME_SUFFIXES[Math.floor(rng() * GALAXY_NAME_SUFFIXES.length)];
    return `${prefix} ${suffix}`;
  }
}

// ============================================================================
// Resource Modifier Generation
// ============================================================================

const RESOURCE_GROUPS = {
  basic: ['ore', 'ice', 'carbon', 'steel'] as ResourceType[],
  energy: ['energy', 'natural_gas', 'oil', 'uranium', 'enriched_uranium'] as ResourceType[],
  metals: ['copper', 'chrome', 'titanium', 'chrome_alloy', 'titanium_alloy'] as ResourceType[],
  advanced: ['semiconductors', 'integrated_circuit', 'computer', 'battery'] as ResourceType[],
  space: ['rocket', 'spaceship', 'satellite', 'space_station'] as ResourceType[],
  exotic: ['dark_matter'] as ResourceType[],
};

function generateResourceModifiers(rng: () => number, difficulty: number): Partial<Record<ResourceType, number>> {
  const modifiers: Partial<Record<ResourceType, number>> = {};
  
  // Pick 1-2 resource groups to boost
  const numGroups = Math.floor(rng() * 2) + 1;
  const groupKeys = Object.keys(RESOURCE_GROUPS) as (keyof typeof RESOURCE_GROUPS)[];
  const selectedGroups: (keyof typeof RESOURCE_GROUPS)[] = [];
  
  for (let i = 0; i < numGroups; i++) {
    const groupKey = groupKeys[Math.floor(rng() * groupKeys.length)];
    if (!selectedGroups.includes(groupKey)) {
      selectedGroups.push(groupKey);
    }
  }
  
  // Apply bonuses to selected groups
  selectedGroups.forEach(groupKey => {
    const group = RESOURCE_GROUPS[groupKey];
    group.forEach(resource => {
      // Bonus decreases with difficulty (harder = less bonus)
      const bonus = 1.2 + (rng() * 0.5) - (difficulty * 0.05);
      modifiers[resource] = Math.max(0.5, Math.min(2.0, bonus));
    });
  });
  
  // Add some penalty to 1-2 random resources
  const allResources = Object.values(RESOURCE_GROUPS).flat();
  const numPenalties = Math.floor(rng() * 2) + 1;
  for (let i = 0; i < numPenalties; i++) {
    const resource = allResources[Math.floor(rng() * allResources.length)];
    if (!modifiers[resource]) {
      const penalty = 0.7 + (rng() * 0.2) - (difficulty * 0.05);
      modifiers[resource] = Math.max(0.3, Math.min(1.0, penalty));
    }
  }
  
  return modifiers;
}

// ============================================================================
// Special Feature Generation
// ============================================================================

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
  
  const roll = rng();
  let sum = 0;
  for (let i = 0; i < features.length; i++) {
    sum += weights[i];
    if (roll <= sum) {
      return features[i];
    }
  }
  
  return null;
}

// ============================================================================
// Difficulty Calculation
// ============================================================================

function calculateDifficulty(galaxyNumber: number): number {
  // Difficulty grows exponentially
  // Galaxy 8: 1.8x
  // Galaxy 10: 2.2x
  // Galaxy 15: 3.5x
  // Galaxy 20: 5.0x
  return 1 + (galaxyNumber * 0.1) + Math.pow(galaxyNumber - 7, 1.3) * 0.02;
}

// ============================================================================
// Reward Generation
// ============================================================================

function generateRewards(
  rng: () => number,
  galaxyNumber: number,
  specialFeature: SpecialGalaxyFeature
): ProceduralGalaxy['rewards'] {
  const rewards: ProceduralGalaxy['rewards'] = {};
  
  /*
   * Список был английским, и эти строки попадали в сохранение как есть — отсюда
   * «Global Production +5%» во вкладке «Галактика». Порядок сохранён, чтобы генерация по тому
   * же seed давала тот же бонус. Уже сохранённые английские значения переводит
   * localizeGalaxyBonus() из core/i18n/label.ts.
   */
  const bonusTypes = [
    'Общее производство +5%',
    'Скорость исследований +10%',
    'Энергоэффективность +8%',
    'Боевая мощь кораблей +15%',
    'Защита платформ +12%',
    'Прирост квантовых очков +20%',
    'Стоимость улучшений −10%',
    'Ёмкость складов +25%',
  ];
  rewards.uniqueBonus = bonusTypes[Math.floor(rng() * bonusTypes.length)];
  
  // Artifact (based on special feature or chance)
  if (specialFeature === 'ruins' || (specialFeature !== null && rng() > 0.7)) {
    rewards.artifactId = `artifact_galaxy_${galaxyNumber}`;
  }
  
  return rewards;
}

// ============================================================================
// Main Generator Function
// ============================================================================

/**
 * Generates a procedural galaxy with deterministic seeded randomness
 * @param seed - Random seed for generation
 * @param galaxyNumber - Galaxy index (8, 9, 10...)
 * @returns Generated procedural galaxy
 */
export function generateGalaxy(seed: number, galaxyNumber: number): ProceduralGalaxy {
  // Create seeded random number generator
  const rng = seedrandom(`${seed}_${galaxyNumber}`);
  
  // Calculate difficulty (increases with galaxy number)
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

// ============================================================================
// Batch Generation
// ============================================================================

/**
 * Generates multiple procedural galaxies in sequence
 * @param seed - Base seed
 * @param startGalaxyNumber - Starting galaxy index
 * @param count - Number of galaxies to generate
 * @returns Array of generated galaxies
 */
export function generateGalaxies(
  seed: number,
  startGalaxyNumber: number,
  count: number
): ProceduralGalaxy[] {
  const galaxies: ProceduralGalaxy[] = [];
  
  for (let i = 0; i < count; i++) {
    galaxies.push(generateGalaxy(seed, startGalaxyNumber + i));
  }
  
  return galaxies;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get description for a special feature
 */
export function getSpecialFeatureDescription(feature: SpecialGalaxyFeature): string {
  switch (feature) {
    case 'black_hole':
      return 'Черная дыра в центре галактики. Повышенная опасность, но экзотические ресурсы.';
    case 'nebula':
      return 'Газовая туманность. Бонус к добыче газа и энергии.';
    case 'quasar':
      return 'Квазар излучает огромную энергию. Значительный бонус к энергопроизводству.';
    case 'ruins':
      return 'Древние руины цивилизации. Возможны уникальные артефакты.';
    default:
      return 'Обычная галактика без особых примечательностей.';
  }
}

/**
 * Get color/theme for a special feature
 */
export function getSpecialFeatureColor(feature: SpecialGalaxyFeature): string {
  switch (feature) {
    case 'black_hole':
      return '#8b00ff'; // Purple
    case 'nebula':
      return '#00ffff'; // Cyan
    case 'quasar':
      return '#ffff00'; // Yellow
    case 'ruins':
      return '#ff8c00'; // Orange
    default:
      return '#4a90e2'; // Blue (default)
  }
}

/**
 * Check if player meets requirements to discover a procedural galaxy
 */
export function canDiscoverProceduralGalaxy(ascensionCount: number): boolean {
  // Need at least 3 ascensions to unlock procedural galaxies
  return ascensionCount >= 3;
}

/**
 * Get cost to discover the next procedural galaxy
 */
export function getDiscoveryCost(galaxyNumber: number): number {
  // Cost grows exponentially
  return Math.floor(1000000 * Math.pow(1.5, galaxyNumber - 8));
}
