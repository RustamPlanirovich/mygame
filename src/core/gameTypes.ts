import type Decimal from 'break_eternity.js';

export type ResourceType = 'energy' | 'ore' | 'ice' | 'carbon' | 'steel' | 'dark_matter';

// Explicit trade list (avoid automatically trading late-game / special resources).
export type TradeResourceType = 'ore' | 'ice' | 'carbon' | 'steel';

export type UpgradeId =
  | 'kernel_speed'
  | 'logistics_bandwidth'
  | 'storage_caps'
  | 'trade_margin'
  | 'combat_protocols'
  | 'sector_expansion';

export interface ResearchState {
  levels: Record<UpgradeId, number>;
}

export type DemonId = 'smart_broker' | 'overclocker' | 'oracle';

export type NanoSwarmChannel = 'attack' | 'repair' | 'boost';

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

export type AegisUpgradeId = 'smart_targeting' | 'encryption';

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

export interface Building {
  id: string;
  name: string;
  description: string;
  baseCost: Partial<Record<ResourceType, Decimal>>;
  costFactor: number;
  production: Partial<Record<ResourceType, Decimal>>;
  consumption?: Partial<Record<ResourceType, Decimal>>;
  productionMultipliers?: Partial<Record<ResourceType, Decimal>>; // Used as max storage bonus for resources
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
  id: 'none' | 'war' | 'deficit' | 'oversupply';
  name: string;
  // 1.0 = no change. Applied to a single affected resource price.
  multiplier: number;
  affected?: TradeResourceType;
}

export interface MarketState {
  prices: Record<TradeResourceType, Decimal>;
  event: MarketEvent;
  nextUpdateAt: number;
  // Optional telemetry for UI (chart). Stored as stringified decimals for save compatibility.
  history?: Record<TradeResourceType, Array<{ t: number; price: string }>>;
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

export type DepositType = 'ore' | 'ice' | 'carbon';

export interface GridState {
  width: number;
  height: number;
  selected: GridCoord | null;
  // key = "x,y"; value = buildingId
  tiles: Record<string, string>;
  // key = "x,y"; value = deposit type (where extraction buildings can be placed)
  deposits?: Record<string, DepositType>;
  // key = "x,y" (and special key "base"); values are stringified decimals
  buffers: Record<string, Partial<Record<ResourceType, string>>>;
  links: GridLink[];
  focusedLink: GridLink | null;
  // key = "fromx,fromy->tox,toy:resource"; value = moved amount during last tick (stringified decimal)
  linkMoved: Record<string, string>;
  // last simulation dt in seconds (for UI diagnostics)
  lastDtSeconds: number;
  // Pending link creation mode.
  // export: anchor = source, click selects target.
  // import: anchor = target, click selects source.
  linking: { anchor: GridCoord; resource: ResourceType; mode: 'export' | 'import' } | null;
  selectedBuildId: string | null;

  // Per-tile market policies for trade resources (fallback behavior).
  // key = "x,y"; value = per-resource toggles.
  marketPolicy?: Record<string, Partial<Record<TradeResourceType, { import?: boolean; export?: boolean }>>>;
}

export interface GameState {
  resources: Record<ResourceType, ResourceState>;
  buildings: Building[];
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
  lastTick: number;
  
  // Actions
  addResource: (type: ResourceType, amount: Decimal | number) => void;
  buyBuilding: (buildingId: string) => void;
  sellResource: (type: TradeResourceType, amount: Decimal | number) => void;
  buyResource: (type: TradeResourceType, amount: Decimal | number) => void;
  tick: (dt: number) => void;
  loadGame: () => Promise<void>;
  saveGame: () => Promise<void>;
  selectTile: (pos: GridCoord | null) => void;
  selectBuild: (buildingId: string | null) => void;
  placeSelectedBuildAt: (pos: GridCoord) => void;
  removeBuildingAt: (pos: GridCoord) => void;
  startLink: (from: GridCoord, resource: ResourceType) => void;
  startLinkImport: (to: GridCoord, resource: ResourceType) => void;
  cancelLink: () => void;
  completeLink: (to: GridCoord) => void;
  toggleLinkEnabled: (from: GridCoord, to: GridCoord, resource: ResourceType) => void;
  removeLink: (from: GridCoord, to: GridCoord, resource: ResourceType) => void;
  focusLink: (link: GridLink | null) => void;

  setTileMarketPolicy: (tileKey: string, resource: TradeResourceType, patch: { import?: boolean; export?: boolean }) => void;
  buyUpgrade: (id: UpgradeId) => void;
  toggleDemon: (id: DemonId) => void;
  setNanoSwarmAllocation: (channel: NanoSwarmChannel, pct: number) => void;
  selectShipModule: (slot: ShipSlot, moduleId: ShipModuleId) => void;
  unlockShipModule: (moduleId: ShipModuleId) => void;
  buyStarChartUpgrade: (id: StarChartUpgradeId) => void;
  buyAegisUpgrade: (id: AegisUpgradeId) => void;
  buyProductionMatrixUpgrade: (id: ProductionMatrixUpgradeId) => void;
  buyQuantumNetUpgrade: (id: QuantumNetUpgradeId) => void;
  setQuantumNetPreservedBuildingId: (buildingId: string | null) => void;
  prestigeReset: () => void;
  startExpedition: () => void;
  resetGame: () => void;
}
