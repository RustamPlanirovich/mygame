import type Decimal from 'break_eternity.js';

export type ResourceType = 
  | 'energy' 
  | 'ore' 
  | 'ice' 
  | 'carbon' 
  | 'steel' 
  | 'dark_matter'
  // Фаза 2: Базовые новые ресурсы
  | 'natural_gas'
  | 'oil'
  | 'gasoline'
  | 'plastic'
  | 'glass'
  | 'chemicals'
  | 'sand'
  // Фаза 2.3: Металлические ресурсы
  | 'uranium'
  | 'chrome'
  | 'titanium'
  // Фаза 2.4-2.5: Продвинутые ресурсы
  | 'copper'
  | 'semiconductors'
  | 'dynamite'
  | 'fiber'
  // Фаза 2.6: Сложные производственные ресурсы
  | 'integrated_circuit'
  | 'battery'
  | 'engine'
  | 'display'
  | 'computer'
  | 'liquid_fuel'
  | 'chrome_alloy'
  | 'titanium_alloy'
  | 'enriched_uranium'
  // Фаза 2.7: Военные ресурсы
  | 'weapon'
  | 'artillery'
  | 'radar'
  | 'nuclear_bomb'
  // Фаза 2.8: Космические ресурсы
  | 'jet_engine'
  | 'satellite'
  | 'rocket'
  | 'spaceship'
  | 'console'
  | 'space_station'
  // Фаза 2.9: Специальные ресурсы
  | 'robot'
  // Фаза 8.1: Экология
  | 'waste'
  | 'radioactive_waste';

// Explicit trade list (avoid automatically trading late-game / special resources).
export type TradeResourceType = 
  | 'ore' 
  | 'ice' 
  | 'carbon' 
  | 'steel'
  | 'natural_gas'
  | 'oil'
  | 'gasoline'
  | 'plastic'
  | 'glass'
  | 'sand'
  // Фаза 2.3: Металлические ресурсы
  | 'uranium'
  | 'chrome'
  | 'titanium'
  // Фаза 2.4-2.5: Продвинутые ресурсы
  | 'copper'
  | 'semiconductors'
  | 'dynamite'
  | 'fiber'
  // Фаза 2.6: Сложные производственные ресурсы
  | 'integrated_circuit'
  | 'battery'
  | 'engine'
  | 'display'
  | 'computer'
  | 'liquid_fuel'
  | 'chrome_alloy'
  | 'titanium_alloy'
  | 'enriched_uranium'
  // Фаза 2.7: Военные ресурсы
  | 'weapon'
  | 'artillery'
  | 'radar'
  | 'nuclear_bomb'
  // Фаза 2.8: Космические ресурсы
  | 'jet_engine'
  | 'satellite'
  | 'rocket'
  | 'spaceship'
  | 'console'
  | 'space_station'
  // Фаза 2.9: Специальные ресурсы
  | 'robot';

export type UpgradeId =
  | 'kernel_speed'
  | 'logistics_bandwidth'
  | 'storage_caps'
  | 'trade_margin'
  | 'combat_protocols'
  | 'sector_expansion';

export interface ResearchState {
  levels: Record<UpgradeId, number>;
  technologies: Record<TechnologyId, boolean>; // Unlocked technologies
}

// Technology IDs organized by era
export type TechnologyId = 
  // Era 1: Восстановление (Recovery)
  | 'basic_mining'           // 0 RP (starting)
  | 'simple_power'           // 100 RP
  | 'basic_processing'       // 200 RP
  | 'solar_panels'           // 500 RP
  // Era 2: Индустриализация (Industrialization)
  | 'gas_exploration'        // 1000 RP
  | 'oil_drilling'           // 1500 RP
  | 'advanced_processing'    // 2000 RP
  | 'plastics_glass'         // 3000 RP
  | 'semiconductors'         // 5000 RP
  | 'gas_power'              // 4000 RP
  // Era 3: Электроника (Electronics)
  | 'microchips'             // 8000 RP
  | 'computers'              // 12000 RP
  | 'displays'               // 10000 RP
  | 'robotics'               // 15000 RP
  | 'automation'             // 20000 RP
  // Era 4: Военная промышленность (Military Industry)
  | 'advanced_weapons'       // 25000 RP
  | 'artillery'              // 30000 RP
  | 'defense_systems'        // 35000 RP
  | 'radar_tech'             // 28000 RP
  | 'nuclear_physics'        // 40000 RP
  | 'nuclear_power'          // 50000 RP
  | 'advanced_defense'       // 55000 RP
  // Era 5: Космическая эра (Space Era)
  | 'rocket_science'         // 60000 RP
  | 'satellites'             // 70000 RP
  | 'spaceships'             // 100000 RP
  | 'interplanetary'         // 120000 RP
  | 'first_colony'           // 150000 RP
  // Era 6: Галактическая экспансия (Galactic Expansion)
  | 'intergalactic_gates'    // 200000 RP
  | 'space_stations'         // 250000 RP
  | 'quantum_tech'           // 300000 RP
  | 'advanced_colonies'      // 350000 RP
  | 'galactic_fleet'         // 500000 RP
  // Era 7: Доминация (Domination)
  | 'megastructures'         // 600000 RP
  | 'time_control'           // 800000 RP
  | 'quantum_teleport'       // 1000000 RP
  | 'ai_restoration'         // 1500000 RP
  | 'galactic_rule'          // 2000000 RP;

export interface Technology {
  id: TechnologyId;
  name: string;
  description: string;
  era: number;
  cost: number; // Research points required
  prerequisites: TechnologyId[]; // Technologies that must be unlocked first
  unlocks: {
    buildings?: BuildingType[];
    resources?: ResourceType[];
    special?: string[]; // Special unlocks (мегаструктуры, концовки, и т.д.)
  };
}

export type DemonId = 'smart_broker' | 'overclocker' | 'oracle';

export type NanoSwarmChannel = 'attack' | 'repair' | 'boost';

// Policy system types
export type PolicyCategory = 'production' | 'energy' | 'economic' | 'science' | 'military' | 'space' | 'special';

export type PolicyId = 
  // Production policies
  | 'overtime'
  | 'production_efficiency'
  | 'gas_synthesis'
  | 'double_silicon'
  | 'smart_production'
  | 'waste_recycling'
  | 'robotization'
  | 'mass_production'
  | 'industrial_revolution'
  | 'chain_optimization'
  // Energy policies
  | 'energy_saving'
  | 'energy_priority'
  | 'backup_energy'
  | 'atomic_boost'
  | 'solar_grid'
  | 'energy_independence'
  // Economic policies
  | 'free_market'
  | 'export_economy'
  | 'tax_benefits'
  | 'bitcoin_boom'
  | 'credit_program'
  | 'investments'
  | 'trade_routes'
  // Science policies
  | 'scientific_breakthrough'
  | 'quantum_computing'
  | 'experimental_science'
  | 'academic_freedom'
  // Military policies
  | 'military_economy'
  | 'defense_reinforcement'
  | 'aggressive_expansion'
  | 'peaceful_coexistence'
  // Space policies
  | 'galaxy_exploration'
  | 'colonial_expansion'
  | 'space_fleet'
  | 'terraforming'
  // Special policies
  | 'eco_friendly'
  | 'innovations'
  | 'megaprojects'
  | 'time_accelerator'
  | 'quantum_stability'
  | 'divine_machine';

export interface Policy {
  id: PolicyId;
  name: string;
  description: string;
  category: PolicyCategory;
  influenceCost: number; // Cost to activate
  influenceUpkeep: number; // Cost per second to keep active
  prerequisites?: TechnologyId[]; // Technologies required to unlock
  effects: {
    // Multipliers (1.0 = no change, 1.3 = +30%, 0.7 = -30%)
    productionMultiplier?: number;
    energyConsumptionMultiplier?: number;
    energyProductionMultiplier?: number;
    buildingCostMultiplier?: number;
    researchMultiplier?: number;
    tradePriceMultiplier?: number;
    // Specific building type multipliers
    buildingTypeMultipliers?: Record<BuildingType, number>;
    // Credits per second bonus
    creditsPerSecond?: Decimal;
    // Other special effects
    specialEffect?: string;
  };
  risks?: string[]; // Potential negative effects
}

export interface PoliticsState {
  activePolicies: PolicyId[];
  maxActivePolicies: number; // How many policies can be active at once
  // Track when each policy was last activated (for cooldowns if needed)
  lastActivated?: Partial<Record<PolicyId, number>>;
}

export interface NanoSwarmState {
  // Total pool of nanobots the player can distribute.
  total: number;
  // Fractions 0..1 that sum to 1.
  allocation: Record<NanoSwarmChannel, number>;
}

export interface DemonsState {
  active: Record<DemonId, boolean>;
  // Telemetry: whether rent was successfully paid on the last tick.
  rentPaid: Record<DemonId, boolean>;
  oracleRecommendationId: string | null;
  oracleRecommendationRoiSeconds: number | null;
  // Smart-Broker: какие ресурсы НЕ продавать автоматически
  brokerExcludeFromAutoSell: Record<TradeResourceType, boolean>;
}

export interface CurrencyState {
  credits: Decimal;
  researchPoints: Decimal;
  influence: Decimal;
}

export interface MetaState {
  qubits: Decimal;
  lifetimeEnergyProduced: Decimal;
  // Soft currency from expeditions, used for Production Matrix upgrades.
  blueprints: Decimal;
}

export type ProductionMatrixUpgradeId = 'cold_fusion' | 'molecular_stability' | 'auto_sort';

export interface ProductionMatrixState {
  levels: Record<ProductionMatrixUpgradeId, number>;
}

export type QuantumNetUpgradeId = 'chrono_shift' | 'memory_preservation';

export interface QuantumNetState {
  levels: Record<QuantumNetUpgradeId, number>;
  // Used by Memory Preservation.
  preservedBuildingId: string | null;
}

export interface ExpeditionState {
  active: boolean;
  kind: 'recon';
  endsAt: number;
  // Reward stored as stringified decimals for save compatibility.
  reward: Partial<Record<TradeResourceType, string>> | null;
  lastReport: string | null;
  // Optional metadata for reports.
  anomaly?: boolean;
}

export type StarChartUpgradeId = 'subspace' | 'anomaly';

export interface StarChartState {
  levels: Record<StarChartUpgradeId, number>;
}

export type AegisUpgradeId = 'smart_targeting' | 'encryption' | 'shield_boost' | 'turret_overdrive' | 'auto_repair';

export interface AegisState {
  levels: Record<AegisUpgradeId, number>;
}

export type ShipSlot = 'hull' | 'engine' | 'cargo';

export type ShipModuleId =
  | 'hull_mk1'
  | 'hull_mk2'
  | 'engine_mk1'
  | 'engine_mk2'
  | 'cargo_mk1'
  | 'cargo_mk2';

export interface ShipState {
  installed: Record<ShipSlot, ShipModuleId>;
  // Unlocked modules can be installed.
  unlocked: Record<ShipModuleId, boolean>;
}

export interface ResourceState {
  amount: Decimal;
  max: Decimal;
  production: Decimal;
}

export type BuildingType = string;

export interface GridCoord {
  x: number;
  y: number;
}

export interface ProximityRule {
  type: 'bonus' | 'penalty' | 'required' | 'incompatible';
  targetBuildingType?: BuildingType | BuildingType[];
  targetCategory?: 'mining' | 'energy' | 'production' | 'military' | 'research' | 'space' | 'storage';
  radius: number;
  multiplier: number;
  minCount?: number;
  maxCount?: number;
  description: string;
}

export interface Building {
  id: string;
  name: string;
  description: string;
  baseCost: Partial<Record<ResourceType, Decimal>>;
  creditCost?: Decimal; // Cost in credits (if not specified, uses baseCost for backward compatibility)
  costFactor: number;
  production: Partial<Record<ResourceType, Decimal>>;
  consumption?: Partial<Record<ResourceType, Decimal>>;
  energyConsumption?: Decimal; // Passive energy consumption per second (always active)
  productionMultipliers?: Partial<Record<ResourceType, Decimal>>; // Used as max storage bonus for resources
  powerGridRadius?: number; // Radius of power grid coverage (for power plants and substations)
  logisticsRadius?: number; // Radius of logistics coverage (for warehouses and logistics centers)
  combat?: {
    dps: Decimal;
    energyPerSecond: Decimal;
  };
  defense?: {
    // Adds base shield capacity.
    shieldMaxHp: Decimal;
    // Regeneration rate while wave is active (if energy is available).
    shieldRegenPerSecond: Decimal;
    // Energy cost while regenerating the shield.
    energyPerSecond: Decimal;
  };
  count: number;
  level?: number; // Building level (1-500), affects production/consumption
  evolutionLevel?: number; // Evolution tier (0 = no evolution, 1 = first tier, etc.)
  coord?: GridCoord; // Координаты здания на сетке
  proximityRules?: ProximityRule[]; // Правила близости для здания
  proximityMultiplier?: number; // Текущий множитель от близости
}

export interface Enemy {
  id: string;
  type: 'scout' | 'brute' | 'swarmer';
  maxHp: Decimal;
  hp: Decimal;
  // 1.0 = spawned far away, 0.0 = reached the base
  distance: number;
  // Distance units per second (from 1.0 to 0.0)
  speed: number;
}

export interface CombatState {
  baseMaxHp: Decimal;
  baseHp: Decimal;

  shieldMaxHp: Decimal;
  shieldHp: Decimal;

  enemies: Enemy[];
  nextWaveAt: number;
  waveEndsAt: number;
  nextSpawnAt: number;

  // Base regen tracking
  lastDamageAt: number; // Timestamp когда база последний раз получила урон
  baseRegenPerSecond: Decimal; // Текущая скорость регенерации базы

  // Telemetry for UX: helps explain why defense is weak or base is losing HP.
  defenseEnergyNeedPerSecond: Decimal;
  defenseEnergyUsedPerSecond: Decimal;
  // 0..1, how much of potential defense output is currently realized (energy-limited).
  defenseFireRatio: Decimal;
  // Base HP loss rate caused by enemy impacts.
  baseDamageTakenPerSecond: Decimal;

  // Shield telemetry (UX)
  shieldEnergyNeedPerSecond: Decimal;
  shieldEnergyUsedPerSecond: Decimal;
  shieldRegenPerSecond: Decimal;
  shieldAbsorbedPerSecond: Decimal;

  // Enemy pressure telemetry (UX)
  enemyPressurePerSecond: Decimal;
  enemyPressurePotentialPerSecond: Decimal;
}

export interface MarketEvent {
  id: 'none' | 'war' | 'deficit' | 'oversupply' | 'normal' | 'surplus' | 'boom' | 'crisis';
  name: string;
  // 1.0 = no change. Applied to all resource prices.
  multiplier: number;
  affected?: TradeResourceType;
}

export interface MarketState {
  prices: Record<TradeResourceType, Decimal>;
  event: MarketEvent;
  nextUpdateAt: number;
  // Optional telemetry for UI (chart). Stored as stringified decimals for save compatibility.
  history?: Record<TradeResourceType, Array<{ t: number; price: string }>>;
  // Active contracts available for the player
  contracts?: Contract[];
  // Trading orders (buy/sell orders placed by player)
  orders?: TradingOrder[];
}

export interface ContractResourceAnalysis {
  resource: ResourceType;
  needed: Decimal; // Сколько всего нужно
  current: Decimal; // Сколько сейчас есть
  remaining: Decimal; // Сколько ещё нужно
  production: Decimal; // Производство в секунду
  etaSeconds: number; // Секунд до готовности
  willComplete: boolean; // Успеет ли к дедлайну
  isBottleneck: boolean; // Это узкое место?
}

export interface ContractAnalysis {
  perResource: ContractResourceAnalysis[];
  overallStatus: 'on_track' | 'at_risk' | 'will_fail' | 'ready';
  criticalResource: ResourceType | null; // Самый проблемный ресурс
  suggestion: string; // Подсказка игроку
  timeToComplete: number; // Секунд до полного выполнения
  speedBonus: boolean; // Получит ли бонус за скорость
}

export interface Contract {
  id: string;
  title: string;
  description: string;
  // Resources required to complete
  requirements: Partial<Record<ResourceType, Decimal>>;
  // Rewards for completion
  rewards: {
    credits?: Decimal;
    researchPoints?: Decimal;
    influence?: Decimal;
  };
  // Speed bonus (awarded if completed in less than half the time)
  speedBonus?: {
    credits?: Decimal;
    researchPoints?: Decimal;
    influence?: Decimal;
  };
  // Expiration timestamp
  expiresAt: number;
  // When contract was accepted
  acceptedAt: number;
  // Difficulty tier (affects rewards)
  tier: 'easy' | 'medium' | 'hard' | 'epic';
  // Analysis data (computed dynamically)
  analysis?: ContractAnalysis;
}

export interface TradingOrder {
  id: string;
  resource: TradeResourceType;
  type: 'buy' | 'sell';
  // Target price at which order executes
  targetPrice: Decimal;
  // Amount to trade
  amount: Decimal;
  // Collateral locked (for buy orders it's credits, for sell orders it's resources)
  collateral: Decimal;
  // When order was placed
  placedAt: number;
  // When order expires
  expiresAt: number;
}

export interface GridCoord {
  x: number;
  y: number;
}

export interface GridLink {
  from: GridCoord;
  to: GridCoord;
  resource: ResourceType;
  enabled?: boolean;
}

export type DepositType = 
  | 'ore' 
  | 'ice' 
  | 'carbon' 
  // Фаза 2: Новые месторождения
  | 'natural_gas' 
  | 'oil' 
  | 'sand'
  // Фаза 2.3: Металлические месторождения
  | 'uranium'
  | 'chrome'
  | 'titanium'
  // Фаза 2.4: Медные месторождения
  | 'copper';

// Фаза 6: Система галактик
export type GalaxyId = 
  | 'galaxy_1_nebula_beginning' // Туманность Начала (стартовая)
  | 'galaxy_2_gas_giants'        // Газовые Гиганты
  | 'galaxy_3_crystal_belts'     // Кристальные Пояса
  | 'galaxy_4_uranium_depths'    // Урановые Недра
  | 'galaxy_5_metal_asteroids'   // Металлические Астероиды
  | 'galaxy_6_energy_nebula'     // Туманность Энергии
  | 'galaxy_7_ancient_ruins';    // Древние Руины

export type GalaxyDangerLevel = 'very_low' | 'low' | 'medium' | 'high' | 'very_high' | 'extreme';

export interface Galaxy {
  id: GalaxyId;
  name: string;
  description: string;
  dangerLevel: GalaxyDangerLevel;
  // Bonus multipliers for certain resource types
  resourceBonuses?: Partial<Record<ResourceType, number>>;
  // Enemies that spawn in this galaxy (now uses EnemyType from enemies.ts)
  enemyTypes?: string[]; // Array of EnemyType
  enemyLevelRange?: [number, number]; // Min and max enemy level
  bossChance?: number; // Chance of boss spawn (0-1)
  // Technology requirement to unlock
  unlockRequirement?: TechnologyId;
  // Available deposit types in this galaxy
  availableDeposits: DepositType[];
  // Visual theme
  theme?: {
    backgroundColor?: string;
    tileColor?: string;
  };
}

export interface PlatformCombatState {
  // Current attack wave on this platform
  underAttack: boolean;
  waveEndsAt: number; // timestamp
  nextWaveAt: number; // timestamp
  enemies: PlatformEnemy[];
  // Damage tracking
  damagePerSecond: Decimal;
  shieldRegenPerSecond: Decimal;
  // Defense systems
  turretCount: number;
  radarCount: number;
  radarRange: number; // Multiplier for turret range
}

export interface PlatformEnemy {
  id: string;
  type: string; // EnemyType from enemies.ts
  level: number; // Enemy level 1-20
  name: string; // Display name
  maxHp: Decimal;
  hp: Decimal;
  distance: number; // 0-1 (1 = far, 0 = contact)
  speed: number;
  damageType: 'physical' | 'energy' | 'mixed'; // Damage type
  dps: Decimal; // Base DPS
  armor: Decimal;
  shieldPierce: number; // 0-1
  armorPierce: number; // 0-1
  isBoss: boolean;
  // Loot on death
  loot?: {
    credits: number;
    resources: Record<string, number>;
  };
}

export interface SpacePlatform {
  id: string;
  galaxyId: GalaxyId;
  name: string;
  // Grid state for this platform
  grid: GridState;
  // Buildings on this platform
  buildings: Building[];
  // Resources stored on this platform
  resources: Record<ResourceType, ResourceState>;
  // Defense stats
  maxHp: Decimal;
  hp: Decimal;
  armor: Decimal;         // Reduces physical damage
  maxArmor: Decimal;
  shieldMaxHp: Decimal;
  shieldHp: Decimal;
  shieldRegenRate: Decimal; // Shield regen per second
  // Platform upgrades
  upgrades?: {
    defense?: number;    // Defense level (increases HP, shield, armor)
    mining?: number;     // Mining efficiency boost
    storage?: number;    // Storage capacity boost
  };
  // Combat state
  combat: PlatformCombatState;
}

export type ShipType = 'fighter' | 'corvette' | 'cruiser' | 'dreadnought' | 'flagship';

export interface Ship {
  id: string;
  type: ShipType;
  name: string;
  level: number; // 1-10
  // Combat stats
  maxHp: Decimal;
  hp: Decimal;
  dps: Decimal; // Damage per second
  armor: Decimal;
  speed: number; // Movement speed (0-1)
  // Assignment
  assignedTo?: string; // Platform ID or 'main_base'
  status: 'idle' | 'defending' | 'attacking' | 'damaged' | 'repairing';
  // Experience and upgrades
  experience: number;
  upgradeLevel: number; // Additional upgrade level beyond base level
}

export interface FleetState {
  ships: Ship[];
  // Auto-assign ships to platforms under attack?
  autoDefend: boolean;
  // Ship production queue
  productionQueue: Array<{
    shipType: ShipType;
    progress: number; // 0-1
    timeRemaining: number; // milliseconds
  }>;
}

export interface PollutionState {
  // Total waste accumulated
  wasteAmount: Decimal;
  // Total radioactive waste accumulated
  radioactiveWasteAmount: Decimal;
  // Efficiency penalty from pollution (0-1, where 1 = no penalty)
  efficiencyMultiplier: number;
  // Visualize pollution zones on map
  pollutionZones: Array<{
    x: number;
    y: number;
    radius: number;
    intensity: number; // 0-1
  }>;
}

export interface Notification {
  id: string;
  type: 'attack' | 'warning' | 'success' | 'info';
  title: string;
  message: string;
  timestamp: number;
  platformId?: string; // For platform-related notifications
  read: boolean;
}

export interface GalaxiesState {
  // Currently active galaxy
  currentGalaxyId: GalaxyId;
  // Unlocked galaxies
  unlockedGalaxies: GalaxyId[];
  // Space platforms in each galaxy
  platforms: SpacePlatform[];
  // Auto-transport resources to main station?
  autoTransportEnabled: boolean;
  // Fuel resources for transport
  fuelReserve: Decimal;
  // Notifications
  notifications: Notification[];
  // Currently active platform for management (optional)
  activePlatformId?: string;
}

export interface GridState {
  width: number;
  height: number;
  selected: GridCoord | null;
  // key = "x,y"; value = buildingId
  tiles: Record<string, string>;
  // key = "x,y"; value = building level (1-500) [Фаза 8.5]
  tileLevels?: Record<string, number>;
  // key = "x,y"; value = evolution level (0-3) [Phase 4: Building Evolution]
  tileEvolutionLevels?: Record<string, number>;
  // key = "x,y"; value = disabled state (true = building is disabled) [Phase 11: Building Management]
  tileDisabled?: Record<string, boolean>;
  // key = "x,y"; value = deposit type (where extraction buildings can be placed)
  deposits?: Record<string, DepositType>;
  // key = "x,y" (and special key "base"); values are stringified decimals
  buffers: Record<string, Partial<Record<ResourceType, string>>>;
  // Active transports for visualization (auto-logistics)
  activeTransports?: Array<{
    from: { x: number; y: number };
    to: { x: number; y: number };
    resource: ResourceType;
    amount: string; // stringified decimal
  }>;
  // last simulation dt in seconds (for UI diagnostics)
  lastDtSeconds: number;
  selectedBuildId: string | null;
  // ID здания для подсветки на карте (когда пользователь выбирает тип здания)
  highlightedBuildingId?: string | null;

  // Per-tile market policies for trade resources (fallback behavior).
  // key = "x,y"; value = per-resource toggles.
  marketPolicy?: Record<string, Partial<Record<TradeResourceType, { import?: boolean; export?: boolean }>>>;
  
  // Camera persistence
  cameraX?: number;
  cameraY?: number;
  cameraZoom?: number;
}

// Фаза 8.6: Система случайных событий
export type RandomEventType =
  | 'meteor_shower'           // Метеоритный дождь
  | 'scientific_breakthrough' // Научный прорыв
  | 'pirate_raid'            // Пиратский рейд
  | 'cosmic_anomaly'         // Космическая аномалия
  | 'chain_reaction'         // Цепная реакция
  | 'synergy_discovery'      // Синергетическое открытие
  | 'power_surge'            // Скачок энергии (позитивный)
  | 'power_outage'           // Перегрузка сети (блэкаут)
  | 'resource_cache'         // Найден тайник с ресурсами
  | 'solar_flare';           // Солнечная вспышка

export interface RandomEvent {
  id: string;
  type: RandomEventType;
  title: string;
  description: string;
  icon: string;
  timestamp: number;
  // Эффекты события
  effects?: {
    // Урон зданиям
    buildingDamage?: {
      targetCoords?: GridCoord[]; // Конкретные координаты или случайные
      damagePercent: number; // Процент урона (для будущей системы HP зданий)
      affectedBuildings?: string[]; // ID пострадавших зданий
    };
    // Бонус к ресурсам
    resourceGain?: Partial<Record<ResourceType, Decimal>>;
    // Бонус к очкам исследований
    researchPointsGain?: Decimal;
    // Временный множитель производства
    productionMultiplier?: {
      duration: number; // миллисекунды
      multiplier: number;
      affectedResources?: ResourceType[];
    };
    // Потеря энергии
    energyLoss?: Decimal;
    // Потеря ресурсов
    resourceLoss?: Partial<Record<ResourceType, Decimal>>;
    // Разблокировка случайной технологии
    unlockRandomTechnology?: boolean;
  };
  // Выбор игрока (если есть)
  choices?: Array<{
    id: string;
    label: string;
    description: string;
    outcome: string; // ID эффекта
  }>;
  // Статус события
  status: 'pending' | 'active' | 'resolved' | 'expired';
  // Когда событие истечет (для активных эффектов)
  expiresAt?: number;
}

export interface RandomEventsState {
  // Активные события
  activeEvents: RandomEvent[];
  // История событий (последние 20)
  eventHistory: Array<{
    type: RandomEventType;
    timestamp: number;
    title: string;
  }>;
  // Следующее событие
  nextEventAt: number;
  // Настройки
  eventsEnabled: boolean;
  eventFrequencyMultiplier: number; // 1.0 = normal, 2.0 = twice as often
}

// ============================================================================
// Daily Rewards & Retention Systems (infinitely.md - Retention Mechanics)
// ============================================================================

export interface DailyReward {
  day: number;                      // День (1-7)
  rewards: {
    credits?: Decimal;
    researchPoints?: Decimal;
    influence?: Decimal;
    resources?: Partial<Record<ResourceType, Decimal>>;
    artifact?: string;              // ID артефакта (для особых дней)
  };
  claimed: boolean;
}

export interface DailyLoginState {
  currentStreak: number;            // Текущая серия дней подряд
  longestStreak: number;            // Рекорд серии
  lastLoginDate: string;            // ISO date string (YYYY-MM-DD)
  totalLogins: number;              // Всего входов
  rewards: DailyReward[];           // Календарь наград на 7 дней
  currentDay: number;               // Текущий день в цикле (1-7)
}

export interface TimeBasedReward {
  id: string;
  name: string;
  availableAt: number;              // Timestamp когда можно собрать
  rewards: {
    credits?: Decimal;
    researchPoints?: Decimal;
    resources?: Partial<Record<ResourceType, Decimal>>;
  };
  collected: boolean;
}

export interface TimeBasedRewardsState {
  containers: TimeBasedReward[];   // Доступные контейнеры
  lastCollectionTime: number;       // Когда последний раз собирали
  collectionInterval: number;       // Интервал в мс (4 часа = 14400000)
  maxStoredContainers: number;      // Максимум контейнеров (2-3)
}

export interface PlayerStats {
  totalPlayTime: number;            // Секунд всего
  sessionsCount: number;            // Количество сессий
  currentSessionStart: number;      // Timestamp начала текущей сессии
  lifetimeResourcesProduced: Partial<Record<ResourceType, Decimal>>;
  lifetimeResourcesSpent: Partial<Record<ResourceType, Decimal>>;
  lifetimeCreditsEarned: Decimal;
  lifetimeCreditsSpent: Decimal;
}

export interface RetentionState {
  dailyLogin: DailyLoginState;
  timeBasedRewards: TimeBasedRewardsState;
  stats: PlayerStats;
}

// ============================================================================
// Signal Interception System (infinitely.md - Active Play Bonuses)
// ============================================================================

export type SignalType = 
  | 'resource_cache'       // Куча ресурсов
  | 'production_boost'     // Буст производства x7 на 30 сек
  | 'research_burst'       // Мгновенные RP
  | 'energy_surge'         // Временная бесплатная энергия
  | 'lucky_find'           // Случайный редкий предмет
  | 'time_warp'            // Ускорение времени x2 на 60 сек
  | 'golden_comet';        // Редкий сигнал с мега-наградами

export interface SignalReward {
  type: 'resources' | 'boost' | 'instant';
  // Ресурсы
  resources?: Partial<Record<ResourceType, Decimal>>;
  credits?: Decimal;
  researchPoints?: Decimal;
  // Бусты
  productionMultiplier?: number;
  boostDuration?: number;           // В миллисекундах
  // Другие награды
  artifact?: string;                // ID артефакта
  darkMatter?: Decimal;
}

export interface ActiveSignal {
  id: string;
  type: SignalType;
  position: {
    x: number;                      // Координата X на карте (0-1)
    y: number;                      // Координата Y на карте (0-1)
  };
  spawnedAt: number;                // Timestamp появления
  expiresAt: number;                // Timestamp исчезновения
  duration: number;                 // Длительность в миллисекундах
  reward: SignalReward;
  claimed: boolean;
}

export interface ActiveBoost {
  id: string;
  type: string;                     // Тип буста
  startedAt: number;
  expiresAt: number;
  multiplier: number;
  affectedResources?: ResourceType[]; // Если пусто - все ресурсы
}

export interface SignalInterceptionState {
  activeSignal: ActiveSignal | null;
  activeBoosts: ActiveBoost[];
  nextSignalAt: number;             // Timestamp следующего сигнала
  totalSignalsCaught: number;
  totalSignalsMissed: number;
  signalFrequency: number;          // Базовая частота в минутах (2-5)
  signalsEnabled: boolean;
}

// ============================================================================
// Production Chains System (infinitely.md - Factorio-lite mechanics)
// ============================================================================

export interface ProductionNode {
  resource: ResourceType;
  production: Decimal;              // Производство в секунду
  consumption: Decimal;             // Потребление в секунду
  balance: Decimal;                 // Баланс (production - consumption)
  producers: string[];              // ID зданий-производителей
  consumers: string[];              // ID зданий-потребителей
  efficiency: number;               // 0-1, насколько эффективно используется
}

export interface ProductionChain {
  startResource: ResourceType;
  endResource: ResourceType;
  nodes: ProductionNode[];
  bottleneck: ResourceType | null;  // Узкое место в цепи
  efficiency: number;               // 0-1, общая эффективность цепи
}

export interface ProductionChainAnalysis {
  chains: ProductionChain[];
  bottlenecks: ResourceType[];
  suggestions: string[];            // Рекомендации по улучшению
  efficiency: number;               // Общая эффективность производства
}

export interface GameState {
  resources: Record<ResourceType, ResourceState>;
  buildings: Building[];
  currency: CurrencyState;
  market: MarketState;
  combat: CombatState;
  grid: GridState;
  research: ResearchState;
  demons: DemonsState;
  meta: MetaState;
  expedition: ExpeditionState;
  nanoSwarm: NanoSwarmState;
  ship: ShipState;
  starChart: StarChartState;
  aegis: AegisState;
  productionMatrix: ProductionMatrixState;
  quantumNet: QuantumNetState;
  politics: PoliticsState; // New: Politics system
  galaxies: GalaxiesState; // New: Galaxy system
  fleet: FleetState; // New: Fleet system
  pollution: PollutionState; // New: Pollution system
  intergalacticLogistics: IntergalacticLogisticsState; // New: Intergalactic logistics
  randomEvents: RandomEventsState; // New: Random events system
  achievements: AchievementsState; // New: Achievements system (Фаза 8.7)
  megastructures: MegastructuresState; // New: Megastructures system (Фаза 9)
  endgame: EndgameState; // New: Endgame and endings system (Фаза 9)
  prestige: PrestigeState; // New: Prestige system (Фаза 9.3)
  ascension: AscensionState; // New: Ascension system (Phase 2 - infinitely.md)
  repeatableResearch: RepeatableResearchState; // New: Repeatable research (Phase 3 - infinitely.md)
  proceduralGalaxies: ProceduralGalaxyState; // New: Procedural galaxies (Phase 5 - infinitely.md)
  artifacts: ArtifactState; // New: Artifacts system (Phase 6 - infinitely.md)
  retention: RetentionState; // New: Daily rewards & retention mechanics (infinitely.md)
  signalInterception: SignalInterceptionState; // New: Active play bonuses (infinitely.md)
  quests: import('./gameTypes.tutorial').QuestState; // New: Quests system
  lastTick: number;
  
  // Energy balance telemetry
  energyProduction: Decimal; // Total energy produced per second
  energyConsumption: Decimal; // Total energy consumed per second (passive + active)
  energyEfficiency: number; // 0-1, how much of potential production is realized
  
  // Actions
  addResource: (type: ResourceType, amount: Decimal | number) => void;
  buyBuilding: (buildingId: string) => void;
  sellResource: (type: TradeResourceType, amount: Decimal | number) => void;
  buyResource: (type: TradeResourceType, amount: Decimal | number) => void;
  completeContract: (contractId: string) => void;
  generateContract: () => void;
  placeTradingOrder: (resource: TradeResourceType, type: 'buy' | 'sell', targetPrice: Decimal, amount: Decimal) => void;
  cancelTradingOrder: (orderId: string) => void;
  tick: (dt: number) => void;
  loadGame: () => Promise<void>;
  saveGame: () => Promise<void>;
  saveGameManual: (saveName: string) => Promise<{ ok: boolean; save?: any; error?: string }>;
  getSavesList: () => Promise<{ ok: boolean; saves?: any[]; error?: string }>;
  loadGameFromSave: (saveId: number) => Promise<{ ok: boolean; error?: string }>;
  deleteSave: (saveId: number) => Promise<{ ok: boolean; error?: string }>;
  selectTile: (pos: GridCoord | null) => void;
  setCameraPosition: (x: number, y: number, zoom: number) => void;
  expandGrid: (minWidth: number, minHeight: number) => void;
  selectBuild: (buildingId: string | null) => void;
  setHighlightedBuilding: (buildingId: string | null) => void;
  placeSelectedBuildAt: (pos: GridCoord) => void;
  removeBuildingAt: (pos: GridCoord) => void;

  setTileMarketPolicy: (tileKey: string, resource: TradeResourceType, patch: { import?: boolean; export?: boolean }) => void;
  buyUpgrade: (id: UpgradeId) => void;
  researchTechnology: (id: TechnologyId) => void;
  toggleDemon: (id: DemonId) => void;
  toggleBrokerAutoSell: (resource: TradeResourceType) => void;
  setNanoSwarmAllocation: (channel: NanoSwarmChannel, pct: number) => void;
  selectShipModule: (slot: ShipSlot, moduleId: ShipModuleId) => void;
  unlockShipModule: (moduleId: ShipModuleId) => void;
  buyStarChartUpgrade: (id: StarChartUpgradeId) => void;
  buyAegisUpgrade: (id: AegisUpgradeId) => void;
  buyProductionMatrixUpgrade: (id: ProductionMatrixUpgradeId) => void;
  buyQuantumNetUpgrade: (id: QuantumNetUpgradeId) => void;
  setQuantumNetPreservedBuildingId: (buildingId: string | null) => void;
  emergencyRepairBase: () => boolean; // Returns true if repair was successful
  activatePolicy: (id: PolicyId) => void;
  deactivatePolicy: (id: PolicyId) => void;
  prestigeReset: () => void;
  startExpedition: () => void;
  resetGame: () => void;
  startNewGame: () => Promise<{ ok: boolean; error?: string }>;
  // Galaxy system actions
  switchGalaxy: (galaxyId: GalaxyId) => void;
  unlockGalaxy: (galaxyId: GalaxyId) => void;
  createPlatform: (galaxyId: GalaxyId, name: string) => void;
  upgradePlatform: (platformId: string, upgradeType: 'defense' | 'mining' | 'storage') => void;
  removePlatform: (platformId: string) => void;
  toggleAutoTransport: () => void;
  buyFuel: (amount: number) => void;
  setActivePlatform: (platformId: string | null) => void;
  // Fleet system actions
  buildShip: (shipType: ShipType) => void;
  upgradeShip: (shipId: string) => void;
  assignShip: (shipId: string, targetId: string) => void;
  repairShip: (shipId: string) => void;
  scrapShip: (shipId: string) => void;
  toggleAutoDefend: () => void;
  // Platform combat and repair
  spawnPlatformEnemy: (platformId: string) => void;
  processPlatformCombat: (platformId: string, dt: number) => void;
  updatePlatformDefenses: (platformId: string) => void;
  repairPlatform: (platformId: string, repairType: 'hull' | 'armor' | 'shield' | 'all') => void;
  // Notifications
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markNotificationRead: (notificationId: string) => void;
  clearNotifications: () => void;
  // Intergalactic logistics
  sendCaravan: (fromId: string, toId: string, resources: Partial<Record<ResourceType, Decimal>>) => void;
  upgradeCaravanSystem: (upgradeType: 'speed' | 'capacity' | 'defense') => void;
  // Building level system (Фаза 8.5)
  upgradeBuildingAt: (coord: GridCoord) => void;
  downgradeBuildingAt: (coord: GridCoord) => void;
  maxUpgradeBuildingAt: (coord: GridCoord) => void;
  upgradeBuildingById: (buildingId: string, instanceId: string) => void;
  downgradeBuildingById: (buildingId: string, instanceId: string) => void;
  // Random events system (Фаза 8.6)
  resolveEvent: (eventId: string, choiceId?: string) => void;
  dismissEvent: (eventId: string) => void;
  toggleRandomEvents: () => void;
  // Achievements system (Фаза 8.7)
  unlockAchievement: (achievementId: string) => void;
  // Megastructures system (Фаза 9)
  startMegastructure: (megastructureId: MegastructureId) => void;
  toggleMegastructure: (megastructureId: MegastructureId, active: boolean) => void;
  // Endgame system (Фаза 9)
  checkEndingRequirements: (endingId: EndingId) => void;
  achieveEnding: (endingId: EndingId) => void;
  // Prestige system (Фаза 9.3)
  calculatePrestigeGain: () => number;
  performPrestige: () => void;
  buyPrestigeUpgrade: (upgradeId: PrestigeUpgradeId) => void;
  toggleFastMode: () => void;
  // Ascension system (Phase 2 - infinitely.md)
  checkAscensionRequirements: () => boolean;
  calculateAscensionGain: () => number;
  performAscension: () => void;
  // Repeatable research system (Phase 3 - infinitely.md)
  researchRepeatable: (researchId: RepeatableResearchId) => void;
  // Building evolution system (Phase 4 - infinitely.md)
  evolveBuildingAt: (coord: GridCoord) => void;
  // Procedural galaxies (Phase 5 - infinitely.md)
  generateProceduralGalaxy: () => void;
  exploreProceduralGalaxy: (galaxyNumber: number) => void;
  // Artifact system (Phase 6 - infinitely.md)
  equipArtifact: (artifactId: string) => void;
  unequipArtifact: (artifactId: string) => void;
  upgradeArtifact: (artifactId: string) => void;
  // Daily rewards & retention (infinitely.md - Retention Mechanics)
  claimDailyReward: (day: number) => void;
  collectTimeBasedReward: (rewardId: string) => void;
  checkAndUpdateDailyLogin: () => void;
  // Signal Interception (infinitely.md - Active Play Bonuses)
  spawnNewSignal: () => void;
  claimSignal: (signalId: string) => void;
  updateSignals: () => void;
  toggleSignals: (enabled: boolean) => void;
  // Quest system
  updateQuestProgress: (questId: string, amount: number) => void;
  claimQuestReward: (questId: string) => void;
  activateQuest: (questId: string) => void;
}

// Фаза 8.7: Система достижений
export type AchievementCategory = 
  | 'construction'    // Building and construction
  | 'production'      // Resource production
  | 'research'        // Technology research
  | 'combat'          // Combat and defense
  | 'exploration'     // Galaxy exploration
  | 'economy'         // Economic achievements
  | 'special';        // Special/hidden achievements

export interface Achievement {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  icon: string; // Emoji icon
  // Requirements to unlock
  requirement: {
    type: 'building_count' | 'resource_amount' | 'technology_count' | 'galaxy_count' 
         | 'ship_count' | 'combat_wins' | 'synergy_buildings' | 'zero_waste'
         | 'energy_production' | 'credits_earned' | 'special';
    target: number; // Target value to reach
    specificBuilding?: BuildingType; // For building-specific achievements
    specificResource?: ResourceType; // For resource-specific achievements
    specificGalaxy?: GalaxyId; // For galaxy-specific achievements
    customCheck?: string; // For complex custom checks
  };
  // Rewards
  reward?: {
    credits?: Decimal;
    researchPoints?: Decimal;
    influence?: Decimal;
    specialBonus?: string; // Description of special bonus
  };
  // Is this achievement hidden until unlocked?
  hidden?: boolean;
}

export interface AchievementsState {
  // Unlocked achievement IDs with unlock timestamp
  unlocked: Record<string, number>;
  // Notification queue for recently unlocked achievements
  recentlyUnlocked: Array<{
    achievementId: string;
    unlockedAt: number;
  }>;
}

// Фаза 8.4: Межгалактическая логистика
export type CaravanStatus = 'idle' | 'traveling' | 'under_attack' | 'delivered' | 'destroyed';

export interface Caravan {
  id: string;
  // Source and destination (platform IDs or 'main_base')
  fromId: string;
  toId: string;
  fromGalaxyId: GalaxyId;
  toGalaxyId: GalaxyId;
  // Cargo
  cargo: Partial<Record<ResourceType, Decimal>>;
  // Status
  status: CaravanStatus;
  // Travel progress (0-1)
  progress: number;
  // Arrival timestamp
  departureTime: number;
  arrivalTime: number;
  // Fuel consumption
  fuelCost: Decimal; // Cost in liquid_fuel or gasoline
  fuelPaid: Decimal; // Already paid fuel
  // Attack risk and defense
  riskLevel: number; // 0-1 (based on galaxy danger)
  defense: Decimal; // Defense rating (based on upgrades and escorts)
  underAttackBy?: PlatformEnemy[]; // Enemies attacking this caravan
  // Escort ships
  escortShips?: string[]; // Ship IDs escorting this caravan
}

export interface CaravanUpgrades {
  speed: number; // Speed upgrade level (reduces travel time)
  capacity: number; // Capacity upgrade level (increases cargo limit)
  defense: number; // Defense upgrade level (reduces attack risk)
}

export interface IntergalacticLogisticsState {
  // Active caravans
  caravans: Caravan[];
  // Upgrades
  upgrades: CaravanUpgrades;
  // Auto-send resources to main base when platform storage is full?
  autoSendToMainBase: boolean;
  // Auto-send specific resources between platforms?
  autoRoutes: Array<{
    id: string;
    fromId: string;
    toId: string;
    resource: ResourceType;
    triggerAmount: Decimal; // Send when this amount accumulates
    sendAmount: Decimal; // How much to send
    enabled: boolean;
  }>;
}

// Фаза 9: Мегаструктуры и Эндгейм
export type MegastructureId = 
  | 'dyson_sphere'
  | 'ring_world'
  | 'dimensional_gate'
  | 'quantum_supercomputer';

export interface Megastructure {
  id: MegastructureId;
  name: string;
  description: string;
  icon: string;
  // Build requirements
  buildCost: {
    credits: Decimal;
    researchPoints: Decimal;
    influence: Decimal;
    resources: Partial<Record<ResourceType, Decimal>>;
  };
  // Build progress (0-100%)
  buildTime: number; // seconds to complete
  requiredTechnology: TechnologyId;
  // Effects
  effects: {
    energyProduction?: Decimal; // Energy per second
    productionBonus?: number; // Global production multiplier (e.g., 1.5 = +50%)
    researchBonus?: number; // Research points multiplier
    influenceBonus?: number; // Influence per second
    platformCapacity?: number; // Additional platform slots
    special?: string; // Special effect description
  };
  // UI
  category: 'production' | 'science' | 'military' | 'special';
}

export interface MegastructuresState {
  // Built megastructures
  built: Partial<Record<MegastructureId, {
    completedAt: number; // timestamp
    buildProgress: number; // 0-100
    active: boolean;
  }>>;
  // Construction queue
  constructionQueue: Array<{
    megastructureId: MegastructureId;
    startedAt: number;
    progress: number; // 0-100
  }>;
}

// Концовки игры
export type EndingId = 
  | 'galactic_emperor'
  | 'digital_god'
  | 'liberator'
  | 'rebirth_cycle';

export interface GameEnding {
  id: EndingId;
  name: string;
  description: string;
  requirements: {
    galaxiesControlled?: number;
    megastructuresBuilt?: MegastructureId[];
    civilizationsHelped?: number;
    specialCondition?: string;
  };
  unlocked: boolean;
  achievedAt?: number; // timestamp
  rewards?: {
    prestigePoints?: number;
    permanentBonuses?: string[];
  };
}

export interface EndgameState {
  // Unlocked endings
  endings: Partial<Record<EndingId, GameEnding>>;
  // Current ending progress
  currentEndingProgress: Partial<Record<EndingId, number>>; // 0-100
  // Victory achieved?
  victoryAchieved: boolean;
  victoryEndingId?: EndingId;
}

// Фаза 9.3: Престиж-система
export type PrestigeUpgradeId =
  | 'quantum_starter' // Starting bonuses
  | 'quantum_production' // Production multiplier
  | 'quantum_research' // Research speed
  | 'quantum_energy' // Energy efficiency
  | 'quantum_credits' // Starting credits
  | 'quantum_influence' // Starting influence
  | 'quantum_buildings' // Building cost reduction
  | 'quantum_tech_unlock' // Unlock Era 1-3 technologies
  | 'quantum_auto_policies' // Auto-activate best policies
  | 'quantum_fast_mode' // 2x game speed
  | 'quantum_resource_retention' // Keep 10% of resources
  | 'quantum_mega_boost' // Megastructures build 50% faster
  | 'quantum_perfect_efficiency' // No energy loss
  | 'quantum_transcendence' // Ultimate upgrade
  | 'imperial_legacy' // From Galactic Emperor ending
  | 'divine_machine' // From Digital God ending
  | 'enlightened_one' // From Liberator ending
  | 'time_loop_master'; // From Rebirth Cycle ending

export interface PrestigeUpgrade {
  id: PrestigeUpgradeId;
  name: string;
  description: string;
  icon: string;
  // Cost in Quantum Points
  cost: number;
  // Maximum level (1 = one-time purchase)
  maxLevel: number;
  // Prerequisites (other upgrades that must be purchased first)
  prerequisites: PrestigeUpgradeId[];
  // Effects
  effects: {
    productionMultiplier?: number; // Multiplier per level
    researchMultiplier?: number;
    energyEfficiency?: number; // % reduction in consumption
    startingCredits?: Decimal;
    startingInfluence?: Decimal;
    buildingCostReduction?: number; // % reduction
    gameSpeedMultiplier?: number;
    resourceRetention?: number; // % of resources kept on prestige
    special?: string; // Special effect description
  };
  // Tier (for UI organization)
  tier: 1 | 2 | 3 | 4;
  // Category
  category: 'economy' | 'production' | 'research' | 'special' | 'ending';
}

export interface PrestigeState {
  // Total lifetime quantum points earned
  lifetimeQuantumPoints: number;
  // Available quantum points to spend
  availableQuantumPoints: number;
  // Number of times prestiged
  prestigeCount: number;
  // Purchased upgrades and their levels
  upgrades: Partial<Record<PrestigeUpgradeId, number>>;
  // Statistics from previous runs
  stats: {
    totalPlaytime: number; // seconds
    totalCreditsEarned: Decimal;
    totalResearchPoints: Decimal;
    maxBuildingsBuilt: number;
    endingsAchieved: EndingId[];
  };
  // Fast mode enabled?
  fastModeEnabled: boolean;
}

// ============================================================================
// Ascension System (Phase 2 - Second Layer of Prestige)
// ============================================================================

export interface AscensionRequirements {
  minPrestigeCount: number;      // Minimum number of prestiges required
  minQuantumPoints: number;       // Minimum QP earned in total
  allMegastructures: boolean;     // All megastructures must be built
}

export interface AscensionMultipliers {
  qpGain: number;                 // Multiplier to Quantum Point gain
  globalProduction: number;       // Multiplier to all resource production
  researchSpeed: number;          // Multiplier to research speed
  startingCredits: number;        // Starting credits after prestige
}

export interface AscensionUnlocks {
  infiniteResearch: boolean;      // Unlock repeatable research
  buildingEvolution: boolean;     // Unlock building evolution system
  proceduralGalaxies: boolean;    // Unlock procedural galaxy generation
}

export interface AscensionState {
  // Total number of ascensions
  ascensionCount: number;
  
  // Ascension Points (AP) - currency for ascension upgrades
  ascensionPoints: number;
  
  // Lifetime AP earned (never decreases)
  lifetimeAscensionPoints: number;
  
  // Requirements to perform next ascension
  requirements: AscensionRequirements;
  
  // Permanent multipliers (increase with each ascension)
  multipliers: AscensionMultipliers;
  
  // Features unlocked through ascension
  unlocks: AscensionUnlocks;
  
  // Statistics
  stats: {
    totalAscensionTime: number;      // Total time across all ascensions (seconds)
    fastestAscension: number;         // Fastest time to ascension (seconds)
    totalQuantumPointsEarned: number; // Total QP earned across all ascensions
  };
}

// ============================================================================
// Repeatable Research (Unlocked after first Ascension)
// ============================================================================

export type RepeatableResearchId = 
  | 'automation_efficiency'
  | 'quantum_computing'
  | 'matter_compression'
  | 'energy_optimization'
  | 'neural_networks'
  | 'dark_matter_manipulation';

export interface RepeatableResearch {
  id: RepeatableResearchId;
  name: string;
  description: string;
  icon?: string;                    // Icon emoji
  currentLevel: number;             // Infinite level
  maxLevelPerAscension: number;     // Cap per ascension (e.g., 100)
  
  baseCost: Record<string, number>; // Base resource costs
  costScaling: number;              // Cost multiplier per level (e.g., 1.5)
  
  effect: {
    type: 'production' | 'efficiency' | 'speed' | 'capacity';
    valuePerLevel: number;          // Bonus per level (e.g., 0.02 = +2%)
  };
  
  // Convenience properties (from effect)
  effectType?: 'percentage' | 'multiplier';
  valuePerLevel?: number;
}

export interface RepeatableResearchState {
  researches: Partial<Record<RepeatableResearchId, number>>; // level per research
  totalLevelsThisAscension: number; // Track total levels gained this run
  // Statistics for each research
  stats: Partial<Record<RepeatableResearchId, {
    totalLevels: number;           // Total levels purchased all-time
    highestLevel: number;          // Highest level ever reached
    totalSpent: Record<string, number>; // Total resources spent
  }>>;
  // History of previous ascension runs
  history: Array<{
    ascensionNumber: number;
    timestamp: number;
    researches: Partial<Record<RepeatableResearchId, number>>;
    totalLevels: number;
  }>;
}

// ============================================================================
// Building Evolution (Unlocked after Ascension)
// ============================================================================

export interface BuildingEvolutionTier {
  level: number;                    // Required building level (e.g., 100, 250, 500)
  name: string;                     // Evolution name (e.g., 'Orbital Solar Array')
  nameRu?: string;                  // Russian name
  description?: string;             // Description of evolution
  multiplier: number;               // Production multiplier (e.g., 2, 5, 10)
  cost?: {                          // Evolution cost
    credits?: Decimal;
    quantum_points?: Decimal;
  };
  newAbilities?: string[];          // Optional new abilities
  visualUpgrade?: string;           // Icon/visual indicator
}

export interface BuildingEvolution {
  baseBuilding: BuildingType;       // Original building type
  evolutionLevel: number;           // Current evolution tier (0, 1, 2, 3...)
  evolutions: BuildingEvolutionTier[]; // Available evolution tiers
}

// ============================================================================
// Procedural Galaxies (Unlocked after Ascension)
// ============================================================================

export type SpecialGalaxyFeature = 'black_hole' | 'nebula' | 'quasar' | 'ruins' | null;

export interface ProceduralGalaxy {
  seed: number;                     // For deterministic generation
  galaxyNumber: number;             // Galaxy index (8, 9, 10...)
  
  generated: {
    name: string;                   // Generated galaxy name
    resourceModifiers: Partial<Record<ResourceType, number>>; // Resource efficiency modifiers
    difficulty: number;             // Difficulty multiplier
    specialFeature: SpecialGalaxyFeature; // Unique feature
  };
  
  discovered: boolean;              // Has player discovered this galaxy?
  completed: boolean;               // Has player completed this galaxy?
  
  rewards: {
    uniqueBonus?: string;           // Permanent bonus description
    artifactId?: string;            // Artifact reward (if any)
  };
}

export interface ProceduralGalaxyState {
  galaxies: ProceduralGalaxy[];     // Generated galaxies
  currentSeed: number;              // Current generation seed
  totalDiscovered: number;          // Total galaxies discovered
}

// ============================================================================
// Artifacts System (Phase 6 - infinitely.md)
// ============================================================================

export type ArtifactRarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';

export type ArtifactSource = 'galaxy' | 'boss' | 'event' | 'achievement' | 'ascension';

export type ArtifactEffectType = 
  | 'globalProduction'
  | 'resourceProduction'
  | 'researchSpeed'
  | 'buildingEfficiency'
  | 'expeditionSuccess'
  | 'combatPower'
  | 'energyCapacity'
  | 'prestigeGain'
  | 'ascensionPoints'
  | 'galaxyUnlockCost';

export interface ArtifactEffect {
  stat: ArtifactEffectType;
  value: number;                    // Base value (percentage)
  isPercentage: boolean;
  affectsResource?: ResourceType;   // For resourceProduction effects
}

export interface Artifact {
  id: string;
  name: string;
  description?: string;
  rarity: ArtifactRarity;
  
  effects: ArtifactEffect[];
  
  level: number;                    // Upgrade level (0-10)
  maxLevel: number;                 // Max upgrade level
  
  source: ArtifactSource;           // How it was obtained
  discoveredAt: number;             // Timestamp
  
  slotsRequired: number;            // How many slots it takes (1-3)
}

export interface ArtifactRarityConfig {
  color: string;                    // UI color
  effectRange: [number, number];   // Min-max effect value
  slots: number;                    // Slots required
  dropRate: number;                 // Drop chance percentage
  baseCost: number;                 // Base upgrade cost
}

export interface ArtifactState {
  discovered: Artifact[];           // All discovered artifacts
  equipped: string[];               // IDs of equipped artifacts
  maxSlots: number;                 // Total available slots (increases with ascension)
  usedSlots: number;                // Currently used slots
  
  // Stats
  totalFound: number;
  totalUpgraded: number;
}
