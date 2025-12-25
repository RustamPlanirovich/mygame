import { D } from '../math/format';
import type { ShipType } from '../gameTypes';
import type Decimal from 'break_eternity.js';

export interface ShipDefinition {
  type: ShipType;
  name: string;
  description: string;
  icon: string;
  // Base stats at level 1
  baseHp: Decimal;
  baseDps: Decimal;
  baseArmor: Decimal;
  baseSpeed: number;
  // Build cost
  buildTime: number; // milliseconds
  buildCost: {
    credits: Decimal;
    steel?: Decimal;
    titanium_alloy?: Decimal;
    computer?: Decimal;
    weapon?: Decimal;
    jet_engine?: Decimal;
    spaceship?: Decimal;
  };
  // Upgrade cost multiplier per level
  upgradeCostMultiplier: number;
  // Stats growth per level
  hpPerLevel: Decimal;
  dpsPerLevel: Decimal;
  armorPerLevel: Decimal;
}

export const SHIP_DEFINITIONS: Record<ShipType, ShipDefinition> = {
  fighter: {
    type: 'fighter',
    name: 'Истребитель',
    description: 'Быстрый и маневренный корабль. Слабая броня, но высокая скорость.',
    icon: '🛸',
    baseHp: D(100),
    baseDps: D(15),
    baseArmor: D(10),
    baseSpeed: 0.85,
    buildTime: 30000, // 30 seconds
    buildCost: {
      credits: D(5000),
      steel: D(100),
      weapon: D(5),
      jet_engine: D(2),
    },
    upgradeCostMultiplier: 1.5,
    hpPerLevel: D(20),
    dpsPerLevel: D(3),
    armorPerLevel: D(2),
  },
  corvette: {
    type: 'corvette',
    name: 'Корвет',
    description: 'Средний корабль. Баланс между скоростью и огневой мощью.',
    icon: '🚀',
    baseHp: D(250),
    baseDps: D(35),
    baseArmor: D(30),
    baseSpeed: 0.65,
    buildTime: 60000, // 60 seconds
    buildCost: {
      credits: D(12000),
      steel: D(250),
      titanium_alloy: D(50),
      weapon: D(15),
      computer: D(10),
      jet_engine: D(5),
    },
    upgradeCostMultiplier: 1.6,
    hpPerLevel: D(50),
    dpsPerLevel: D(7),
    armorPerLevel: D(6),
  },
  cruiser: {
    type: 'cruiser',
    name: 'Крейсер',
    description: 'Тяжелый боевой корабль с мощным вооружением.',
    icon: '🛡️',
    baseHp: D(600),
    baseDps: D(80),
    baseArmor: D(70),
    baseSpeed: 0.45,
    buildTime: 120000, // 2 minutes
    buildCost: {
      credits: D(30000),
      steel: D(500),
      titanium_alloy: D(150),
      weapon: D(40),
      computer: D(30),
      spaceship: D(1),
    },
    upgradeCostMultiplier: 1.7,
    hpPerLevel: D(120),
    dpsPerLevel: D(16),
    armorPerLevel: D(14),
  },
  dreadnought: {
    type: 'dreadnought',
    name: 'Дредноут',
    description: 'Массивный военный корабль. Огромная огневая мощь, но медленный.',
    icon: '⚔️',
    baseHp: D(1500),
    baseDps: D(200),
    baseArmor: D(180),
    baseSpeed: 0.25,
    buildTime: 300000, // 5 minutes
    buildCost: {
      credits: D(80000),
      steel: D(1200),
      titanium_alloy: D(400),
      weapon: D(100),
      computer: D(80),
      spaceship: D(3),
    },
    upgradeCostMultiplier: 1.8,
    hpPerLevel: D(300),
    dpsPerLevel: D(40),
    armorPerLevel: D(36),
  },
  flagship: {
    type: 'flagship',
    name: 'Флагман',
    description: 'Уникальный командный корабль. Усиливает весь флот.',
    icon: '👑',
    baseHp: D(3000),
    baseDps: D(150),
    baseArmor: D(250),
    baseSpeed: 0.35,
    buildTime: 600000, // 10 minutes
    buildCost: {
      credits: D(200000),
      steel: D(2000),
      titanium_alloy: D(800),
      weapon: D(150),
      computer: D(200),
      spaceship: D(10),
    },
    upgradeCostMultiplier: 2.0,
    hpPerLevel: D(600),
    dpsPerLevel: D(30),
    armorPerLevel: D(50),
  },
};

// Calculate ship stats at a given level
export function calculateShipStats(type: ShipType, level: number, upgradeLevel: number = 0) {
  const def = SHIP_DEFINITIONS[type];
  const totalLevel = level + upgradeLevel;
  
  return {
    maxHp: def.baseHp.add(def.hpPerLevel.mul(totalLevel - 1)),
    dps: def.baseDps.add(def.dpsPerLevel.mul(totalLevel - 1)),
    armor: def.baseArmor.add(def.armorPerLevel.mul(totalLevel - 1)),
    speed: def.baseSpeed,
  };
}

// Calculate upgrade cost for a ship
export function calculateShipUpgradeCost(type: ShipType, currentUpgradeLevel: number) {
  const def = SHIP_DEFINITIONS[type];
  const baseCost = def.buildCost;
  const multiplier = Math.pow(def.upgradeCostMultiplier, currentUpgradeLevel);
  
  const cost: any = {};
  for (const [resource, amount] of Object.entries(baseCost)) {
    cost[resource] = (amount as Decimal).mul(multiplier * 0.5); // Upgrades cost 50% of base * multiplier
  }
  
  return cost;
}

// Experience required for next level
export function getExperienceForLevel(level: number): number {
  return Math.floor(100 * Math.pow(1.5, level - 1));
}

// Ship name generator
const SHIP_PREFIXES = ['HMS', 'USS', 'ISS', 'FSS', 'CSS'];
const SHIP_NAMES = [
  'Valiant', 'Resolute', 'Defiant', 'Intrepid', 'Vengeance',
  'Thunder', 'Lightning', 'Tempest', 'Storm', 'Hurricane',
  'Phoenix', 'Dragon', 'Griffin', 'Pegasus', 'Cerberus',
  'Titan', 'Atlas', 'Hercules', 'Achilles', 'Odysseus',
  'Nova', 'Pulsar', 'Quasar', 'Nebula', 'Galaxy',
  'Victory', 'Glory', 'Honor', 'Justice', 'Freedom',
  'Sentinel', 'Guardian', 'Protector', 'Defender', 'Warden',
  'Excalibur', 'Mjolnir', 'Aegis', 'Trident', 'Spear',
];

export function generateShipName(): string {
  const prefix = SHIP_PREFIXES[Math.floor(Math.random() * SHIP_PREFIXES.length)];
  const name = SHIP_NAMES[Math.floor(Math.random() * SHIP_NAMES.length)];
  const number = Math.floor(Math.random() * 999) + 1;
  return `${prefix} ${name}-${number}`;
}
