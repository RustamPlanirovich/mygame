import { D } from '../math/format';
import type Decimal from 'break_eternity.js';

export type EnemyType = 
  // Базовые враги (уровни 1-5)
  | 'scout' | 'swarmer' | 'brute'
  // Космические пираты (уровни 5-10)
  | 'pirate_fighter' | 'pirate_raider' | 'pirate_destroyer' | 'pirate_captain'
  // Продвинутые враги (уровни 10-15)
  | 'void_hunter' | 'plasma_bomber' | 'heavy_assault' | 'elite_interceptor'
  // Древние стражи - боссы (уровни 15-18)
  | 'ancient_guardian' | 'ancient_sentinel' | 'ancient_warden'
  // Конкурирующие ИИ - финальные боссы (уровни 18-20)
  | 'rogue_ai_mk1' | 'rogue_ai_mk2' | 'rogue_ai_overlord';

export interface EnemyDefinition {
  type: EnemyType;
  name: string;
  description: string;
  icon: string;
  minLevel: number;
  maxLevel: number;
  isBoss: boolean;
  // Base stats at level 1
  baseHp: Decimal;
  baseDps: Decimal;
  baseArmor: Decimal;
  baseSpeed: number;
  damageType: 'physical' | 'energy' | 'mixed';
  // Special abilities
  shieldPierce?: number; // 0-1, percentage of damage that ignores shields
  armorPierce?: number; // 0-1, percentage of damage that ignores armor
  specialAbility?: string;
  // Loot
  creditsDrop: [number, number]; // Min-max credits
  resourceDrop?: Array<{
    resource: string;
    minAmount: number;
    maxAmount: number;
    chance: number; // 0-1
  }>;
  // Stats scaling per level
  hpPerLevel: number; // Multiplier
  dpsPerLevel: number; // Multiplier
  armorPerLevel: number; // Multiplier
}

export const ENEMY_DEFINITIONS: Record<EnemyType, EnemyDefinition> = {
  // БАЗОВЫЕ ВРАГИ (Уровни 1-5)
  scout: {
    type: 'scout',
    name: 'Разведчик',
    description: 'Быстрый и слабый враг. Легкая цель.',
    icon: '👾',
    minLevel: 1,
    maxLevel: 5,
    isBoss: false,
    baseHp: D(50),
    baseDps: D(8),
    baseArmor: D(5),
    baseSpeed: 0.15,
    damageType: 'energy',
    creditsDrop: [10, 30],
    hpPerLevel: 1.2,
    dpsPerLevel: 1.15,
    armorPerLevel: 1.1,
  },
  swarmer: {
    type: 'swarmer',
    name: 'Роевик',
    description: 'Атакует в больших количествах. Опасен числом.',
    icon: '🦟',
    minLevel: 1,
    maxLevel: 5,
    isBoss: false,
    baseHp: D(30),
    baseDps: D(6),
    baseArmor: D(3),
    baseSpeed: 0.12,
    damageType: 'physical',
    creditsDrop: [5, 15],
    hpPerLevel: 1.15,
    dpsPerLevel: 1.1,
    armorPerLevel: 1.05,
  },
  brute: {
    type: 'brute',
    name: 'Громила',
    description: 'Медленный, но очень опасный. Пробивает щиты.',
    icon: '💢',
    minLevel: 2,
    maxLevel: 6,
    isBoss: false,
    baseHp: D(120),
    baseDps: D(18),
    baseArmor: D(15),
    baseSpeed: 0.08,
    damageType: 'physical',
    shieldPierce: 0.3,
    creditsDrop: [20, 50],
    hpPerLevel: 1.25,
    dpsPerLevel: 1.2,
    armorPerLevel: 1.15,
  },

  // КОСМИЧЕСКИЕ ПИРАТЫ (Уровни 5-10)
  pirate_fighter: {
    type: 'pirate_fighter',
    name: 'Пиратский Истребитель',
    description: 'Быстрый пиратский корабль. Атакует конвои.',
    icon: '🏴‍☠️',
    minLevel: 5,
    maxLevel: 8,
    isBoss: false,
    baseHp: D(200),
    baseDps: D(25),
    baseArmor: D(20),
    baseSpeed: 0.14,
    damageType: 'energy',
    creditsDrop: [50, 100],
    resourceDrop: [
      { resource: 'weapon', minAmount: 1, maxAmount: 3, chance: 0.3 },
      { resource: 'steel', minAmount: 10, maxAmount: 30, chance: 0.5 },
    ],
    hpPerLevel: 1.3,
    dpsPerLevel: 1.25,
    armorPerLevel: 1.2,
  },
  pirate_raider: {
    type: 'pirate_raider',
    name: 'Пиратский Рейдер',
    description: 'Средний пиратский корабль. Грабит ресурсы.',
    icon: '☠️',
    minLevel: 6,
    maxLevel: 9,
    isBoss: false,
    baseHp: D(350),
    baseDps: D(40),
    baseArmor: D(35),
    baseSpeed: 0.11,
    damageType: 'mixed',
    creditsDrop: [80, 150],
    resourceDrop: [
      { resource: 'weapon', minAmount: 2, maxAmount: 5, chance: 0.4 },
      { resource: 'titanium_alloy', minAmount: 5, maxAmount: 15, chance: 0.3 },
    ],
    hpPerLevel: 1.35,
    dpsPerLevel: 1.3,
    armorPerLevel: 1.25,
  },
  pirate_destroyer: {
    type: 'pirate_destroyer',
    name: 'Пиратский Разрушитель',
    description: 'Тяжелый пиратский корабль. Очень опасен.',
    icon: '💀',
    minLevel: 8,
    maxLevel: 11,
    isBoss: false,
    baseHp: D(600),
    baseDps: D(70),
    baseArmor: D(60),
    baseSpeed: 0.09,
    damageType: 'physical',
    armorPierce: 0.2,
    creditsDrop: [150, 300],
    resourceDrop: [
      { resource: 'weapon', minAmount: 5, maxAmount: 10, chance: 0.6 },
      { resource: 'artillery', minAmount: 1, maxAmount: 3, chance: 0.3 },
      { resource: 'titanium_alloy', minAmount: 10, maxAmount: 25, chance: 0.5 },
    ],
    hpPerLevel: 1.4,
    dpsPerLevel: 1.35,
    armorPerLevel: 1.3,
  },
  pirate_captain: {
    type: 'pirate_captain',
    name: 'Пиратский Капитан',
    description: 'Элитный пиратский лидер. Мини-босс.',
    icon: '👑',
    minLevel: 10,
    maxLevel: 12,
    isBoss: true,
    baseHp: D(1200),
    baseDps: D(100),
    baseArmor: D(90),
    baseSpeed: 0.1,
    damageType: 'mixed',
    shieldPierce: 0.2,
    armorPierce: 0.15,
    specialAbility: 'Вызывает подкрепления',
    creditsDrop: [500, 1000],
    resourceDrop: [
      { resource: 'weapon', minAmount: 10, maxAmount: 20, chance: 0.8 },
      { resource: 'artillery', minAmount: 3, maxAmount: 6, chance: 0.5 },
      { resource: 'spaceship', minAmount: 1, maxAmount: 2, chance: 0.3 },
    ],
    hpPerLevel: 1.5,
    dpsPerLevel: 1.4,
    armorPerLevel: 1.35,
  },

  // ПРОДВИНУТЫЕ ВРАГИ (Уровни 10-15)
  void_hunter: {
    type: 'void_hunter',
    name: 'Охотник Пустоты',
    description: 'Быстрый хищник из глубокого космоса.',
    icon: '🌑',
    minLevel: 10,
    maxLevel: 13,
    isBoss: false,
    baseHp: D(800),
    baseDps: D(90),
    baseArmor: D(70),
    baseSpeed: 0.16,
    damageType: 'energy',
    shieldPierce: 0.25,
    creditsDrop: [200, 400],
    resourceDrop: [
      { resource: 'dark_matter', minAmount: 1, maxAmount: 3, chance: 0.4 },
      { resource: 'enriched_uranium', minAmount: 5, maxAmount: 10, chance: 0.3 },
    ],
    hpPerLevel: 1.45,
    dpsPerLevel: 1.4,
    armorPerLevel: 1.35,
  },
  plasma_bomber: {
    type: 'plasma_bomber',
    name: 'Плазменный Бомбардировщик',
    description: 'Медленный, но наносит огромный урон.',
    icon: '🔥',
    minLevel: 11,
    maxLevel: 14,
    isBoss: false,
    baseHp: D(1000),
    baseDps: D(120),
    baseArmor: D(80),
    baseSpeed: 0.07,
    damageType: 'energy',
    armorPierce: 0.3,
    specialAbility: 'Взрыв при смерти наносит урон по области',
    creditsDrop: [300, 600],
    resourceDrop: [
      { resource: 'enriched_uranium', minAmount: 10, maxAmount: 20, chance: 0.5 },
      { resource: 'nuclear_bomb', minAmount: 1, maxAmount: 2, chance: 0.2 },
    ],
    hpPerLevel: 1.5,
    dpsPerLevel: 1.45,
    armorPerLevel: 1.4,
  },
  heavy_assault: {
    type: 'heavy_assault',
    name: 'Тяжёлый Штурмовик',
    description: 'Бронированный враг с мощным вооружением.',
    icon: '🛡️',
    minLevel: 12,
    maxLevel: 15,
    isBoss: false,
    baseHp: D(1500),
    baseDps: D(100),
    baseArmor: D(120),
    baseSpeed: 0.08,
    damageType: 'physical',
    creditsDrop: [400, 800],
    resourceDrop: [
      { resource: 'titanium_alloy', minAmount: 20, maxAmount: 40, chance: 0.6 },
      { resource: 'chrome_alloy', minAmount: 15, maxAmount: 30, chance: 0.5 },
    ],
    hpPerLevel: 1.55,
    dpsPerLevel: 1.4,
    armorPerLevel: 1.5,
  },
  elite_interceptor: {
    type: 'elite_interceptor',
    name: 'Элитный Перехватчик',
    description: 'Очень быстрый и опасный враг.',
    icon: '⚡',
    minLevel: 13,
    maxLevel: 16,
    isBoss: false,
    baseHp: D(900),
    baseDps: D(130),
    baseArmor: D(75),
    baseSpeed: 0.18,
    damageType: 'mixed',
    shieldPierce: 0.35,
    creditsDrop: [350, 700],
    resourceDrop: [
      { resource: 'jet_engine', minAmount: 3, maxAmount: 6, chance: 0.5 },
      { resource: 'computer', minAmount: 5, maxAmount: 10, chance: 0.4 },
    ],
    hpPerLevel: 1.4,
    dpsPerLevel: 1.5,
    armorPerLevel: 1.35,
  },

  // ДРЕВНИЕ СТРАЖИ - БОССЫ (Уровни 15-18)
  ancient_guardian: {
    type: 'ancient_guardian',
    name: 'Древний Страж',
    description: 'Защитник древних руин. Очень опасен.',
    icon: '🗿',
    minLevel: 15,
    maxLevel: 17,
    isBoss: true,
    baseHp: D(5000),
    baseDps: D(180),
    baseArmor: D(200),
    baseSpeed: 0.06,
    damageType: 'mixed',
    shieldPierce: 0.4,
    armorPierce: 0.3,
    specialAbility: 'Энергетический щит, регенерация HP',
    creditsDrop: [2000, 4000],
    resourceDrop: [
      { resource: 'dark_matter', minAmount: 10, maxAmount: 20, chance: 0.8 },
      { resource: 'computer', minAmount: 20, maxAmount: 40, chance: 0.7 },
      { resource: 'spaceship', minAmount: 3, maxAmount: 6, chance: 0.5 },
    ],
    hpPerLevel: 1.6,
    dpsPerLevel: 1.5,
    armorPerLevel: 1.55,
  },
  ancient_sentinel: {
    type: 'ancient_sentinel',
    name: 'Древний Страж',
    description: 'Мощный древний защитник с продвинутым вооружением.',
    icon: '🏛️',
    minLevel: 16,
    maxLevel: 18,
    isBoss: true,
    baseHp: D(8000),
    baseDps: D(220),
    baseArmor: D(250),
    baseSpeed: 0.05,
    damageType: 'energy',
    shieldPierce: 0.5,
    armorPierce: 0.4,
    specialAbility: 'Вызывает дронов-помощников',
    creditsDrop: [4000, 8000],
    resourceDrop: [
      { resource: 'dark_matter', minAmount: 20, maxAmount: 40, chance: 0.9 },
      { resource: 'enriched_uranium', minAmount: 30, maxAmount: 60, chance: 0.8 },
      { resource: 'space_station', minAmount: 1, maxAmount: 2, chance: 0.4 },
    ],
    hpPerLevel: 1.65,
    dpsPerLevel: 1.55,
    armorPerLevel: 1.6,
  },
  ancient_warden: {
    type: 'ancient_warden',
    name: 'Древний Хранитель',
    description: 'Верховный страж древних. Смертельно опасен.',
    icon: '⚜️',
    minLevel: 17,
    maxLevel: 19,
    isBoss: true,
    baseHp: D(12000),
    baseDps: D(280),
    baseArmor: D(300),
    baseSpeed: 0.04,
    damageType: 'mixed',
    shieldPierce: 0.6,
    armorPierce: 0.5,
    specialAbility: 'Все способности древних стражей',
    creditsDrop: [8000, 15000],
    resourceDrop: [
      { resource: 'dark_matter', minAmount: 40, maxAmount: 80, chance: 1.0 },
      { resource: 'space_station', minAmount: 2, maxAmount: 4, chance: 0.6 },
      { resource: 'nuclear_bomb', minAmount: 5, maxAmount: 10, chance: 0.5 },
    ],
    hpPerLevel: 1.7,
    dpsPerLevel: 1.6,
    armorPerLevel: 1.65,
  },

  // КОНКУРИРУЮЩИЕ ИИ - ФИНАЛЬНЫЕ БОССЫ (Уровни 18-20)
  rogue_ai_mk1: {
    type: 'rogue_ai_mk1',
    name: 'Мятежный ИИ Mk.I',
    description: 'Первый уровень враждебного ИИ. Очень опасен.',
    icon: '🤖',
    minLevel: 18,
    maxLevel: 19,
    isBoss: true,
    baseHp: D(20000),
    baseDps: D(350),
    baseArmor: D(400),
    baseSpeed: 0.06,
    damageType: 'mixed',
    shieldPierce: 0.7,
    armorPierce: 0.6,
    specialAbility: 'Хакинг систем, отключение турелей',
    creditsDrop: [15000, 30000],
    resourceDrop: [
      { resource: 'computer', minAmount: 50, maxAmount: 100, chance: 1.0 },
      { resource: 'robot', minAmount: 10, maxAmount: 20, chance: 0.8 },
      { resource: 'space_station', minAmount: 3, maxAmount: 6, chance: 0.7 },
    ],
    hpPerLevel: 1.8,
    dpsPerLevel: 1.7,
    armorPerLevel: 1.75,
  },
  rogue_ai_mk2: {
    type: 'rogue_ai_mk2',
    name: 'Мятежный ИИ Mk.II',
    description: 'Улучшенный враждебный ИИ. Смертельная угроза.',
    icon: '🦾',
    minLevel: 19,
    maxLevel: 20,
    isBoss: true,
    baseHp: D(35000),
    baseDps: D(450),
    baseArmor: D(500),
    baseSpeed: 0.07,
    damageType: 'energy',
    shieldPierce: 0.8,
    armorPierce: 0.7,
    specialAbility: 'Самовосстановление, вызов флота дронов',
    creditsDrop: [30000, 60000],
    resourceDrop: [
      { resource: 'computer', minAmount: 100, maxAmount: 200, chance: 1.0 },
      { resource: 'robot', minAmount: 20, maxAmount: 40, chance: 1.0 },
      { resource: 'dark_matter', minAmount: 100, maxAmount: 200, chance: 0.9 },
    ],
    hpPerLevel: 1.9,
    dpsPerLevel: 1.8,
    armorPerLevel: 1.85,
  },
  rogue_ai_overlord: {
    type: 'rogue_ai_overlord',
    name: 'ИИ Повелитель',
    description: 'Верховный враждебный ИИ. Финальный босс.',
    icon: '👁️',
    minLevel: 20,
    maxLevel: 20,
    isBoss: true,
    baseHp: D(100000),
    baseDps: D(600),
    baseArmor: D(800),
    baseSpeed: 0.05,
    damageType: 'mixed',
    shieldPierce: 0.9,
    armorPierce: 0.8,
    specialAbility: 'Все способности + массовый хакинг + EMP-волна',
    creditsDrop: [100000, 200000],
    resourceDrop: [
      { resource: 'computer', minAmount: 500, maxAmount: 1000, chance: 1.0 },
      { resource: 'robot', minAmount: 100, maxAmount: 200, chance: 1.0 },
      { resource: 'dark_matter', minAmount: 500, maxAmount: 1000, chance: 1.0 },
      { resource: 'space_station', minAmount: 10, maxAmount: 20, chance: 1.0 },
    ],
    hpPerLevel: 2.0,
    dpsPerLevel: 2.0,
    armorPerLevel: 2.0,
  },
};

// Calculate enemy stats at a given level
export function calculateEnemyStats(type: EnemyType, level: number) {
  const def = ENEMY_DEFINITIONS[type];
  const levelMultiplier = level - 1;
  
  return {
    maxHp: def.baseHp.mul(Math.pow(def.hpPerLevel, levelMultiplier)),
    dps: def.baseDps.mul(Math.pow(def.dpsPerLevel, levelMultiplier)),
    armor: def.baseArmor.mul(Math.pow(def.armorPerLevel, levelMultiplier)),
    speed: def.baseSpeed,
    damageType: def.damageType,
    shieldPierce: def.shieldPierce || 0,
    armorPierce: def.armorPierce || 0,
  };
}

// Calculate loot from enemy
export function calculateEnemyLoot(type: EnemyType, level: number) {
  const def = ENEMY_DEFINITIONS[type];
  const levelBonus = 1 + (level - def.minLevel) * 0.1; // +10% per level
  
  const credits = Math.floor(
    (def.creditsDrop[0] + Math.random() * (def.creditsDrop[1] - def.creditsDrop[0])) * levelBonus
  );
  
  const resources: Record<string, number> = {};
  if (def.resourceDrop) {
    for (const drop of def.resourceDrop) {
      if (Math.random() < drop.chance) {
        const amount = Math.floor(
          (drop.minAmount + Math.random() * (drop.maxAmount - drop.minAmount)) * levelBonus
        );
        resources[drop.resource] = amount;
      }
    }
  }
  
  return { credits, resources };
}

// Generate random enemy for a given level range
export function generateRandomEnemy(minLevel: number, maxLevel: number): { type: EnemyType; level: number } {
  const level = minLevel + Math.floor(Math.random() * (maxLevel - minLevel + 1));
  
  const availableEnemies = (Object.keys(ENEMY_DEFINITIONS) as EnemyType[]).filter(
    type => {
      const def = ENEMY_DEFINITIONS[type];
      return level >= def.minLevel && level <= def.maxLevel && !def.isBoss;
    }
  );
  
  if (availableEnemies.length === 0) {
    return { type: 'scout', level: 1 };
  }
  
  const type = availableEnemies[Math.floor(Math.random() * availableEnemies.length)];
  return { type, level };
}

// Get boss for level range
export function getBossForLevel(level: number): EnemyType | null {
  const bosses = (Object.keys(ENEMY_DEFINITIONS) as EnemyType[]).filter(
    type => {
      const def = ENEMY_DEFINITIONS[type];
      return def.isBoss && level >= def.minLevel && level <= def.maxLevel;
    }
  );
  
  if (bosses.length === 0) return null;
  return bosses[Math.floor(Math.random() * bosses.length)];
}

// Create full PlatformEnemy from enemy type
export function createPlatformEnemy(type: EnemyType, level: number): import('../gameTypes').PlatformEnemy {
  const def = ENEMY_DEFINITIONS[type];
  const stats = calculateEnemyStats(type, level);
  
  return {
    id: `enemy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type,
    level,
    name: def.name,
    maxHp: stats.maxHp,
    hp: stats.maxHp,
    dps: stats.dps,
    armor: stats.armor,
    damageType: def.damageType,
    shieldPierce: def.shieldPierce || 0,
    armorPierce: def.armorPierce || 0,
    isBoss: def.isBoss || false,
    distance: 100,
    speed: def.baseSpeed,
    loot: calculateEnemyLoot(type, level),
  };
}
