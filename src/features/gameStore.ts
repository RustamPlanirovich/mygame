import { create } from 'zustand';
import type Decimal from 'break_eternity.js';
import type {
  AegisState,
  Building,
  CombatState,
  DemonId,
  DemonsState,
  DepositType,
  Enemy,
  ExpeditionState,
  GameState,
  GridCoord,
  MarketEvent,
  MetaState,
  NanoSwarmChannel,
  NanoSwarmState,
  ProductionMatrixState,
  ProductionMatrixUpgradeId,
  QuantumNetState,
  QuantumNetUpgradeId,
  ResearchState,
  ResourceType,
  ShipModuleId,
  ShipState,
  StarChartState,
  TradeResourceType,
} from '../core/gameTypes';
import { D } from '../core/math/format.ts';
import {
  DEMON_DEFS,
  UPGRADE_DEFS,
  computeCapsMultiplier,
  computeCombatMultiplier,
  computeSpeedMultiplier,
  computeTradeMultiplier,
  upgradeCost,
} from '../core/constants/progression';
import {
  INITIAL_NANO_SWARM,
  computeNanoAttackDpsPerSecond,
  computeNanoBoostMultiplier,
  computeNanoRepairHpPerSecond,
  nanoClamp01,
  normalizeNanoAllocation,
} from '../core/constants/nanoSwarm';
import {
  SHIP_MODULE_DEFS,
  computeShipExpeditionDurationMs,
  computeShipRewardMultiplier,
  computeShipSteelBonusChance,
} from '../core/constants/ship';
import {
  STAR_CHART_UPGRADE_DEFS,
  computeStarChartAnomalyChance,
  computeStarChartAnomalySteelBonus,
  computeStarChartDurationMultiplier,
  starChartUpgradeCost,
} from '../core/constants/starChart';
import {
  AEGIS_UPGRADE_DEFS,
  aegisUpgradeCost,
  computeAegisInterferenceMultiplier,
  computeAegisSmartTargetingEnabled,
} from '../core/constants/aegis';
import {
  PRODUCTION_MATRIX_UPGRADE_DEFS,
  computeColdFusionEnergyMultiplier,
  computeMolecularStabilityDoubleChance,
  computeAutoSortEnabled,
  computeAutoSortStartRatio,
  computeAutoSortTargetRatio,
  productionMatrixUpgradeCost,
} from '../core/constants/productionMatrix';
import {
  QUANTUM_NET_UPGRADE_DEFS,
  computeChronoShiftStartingBonus,
  computeMemoryPreservationEnabled,
  quantumNetUpgradeCost,
} from '../core/constants/quantumNet';

const MARKET_UPDATE_SECONDS = 30;

const WAVE_INTERVAL_SECONDS = 60;
const WAVE_DURATION_SECONDS = 18;
const SPAWN_INTERVAL_SECONDS = 1.8;
const BASE_MAX_HP = D(100);
const ENEMY_IMPACT_DAMAGE = D(12);

const ENEMY_TRAITS: Record<Enemy['type'], { dps: Decimal; contactRange: number; shieldPierce: number }> = {
  // Быстрый, но не слишком опасный.
  scout: { dps: D(0.9), contactRange: 0.20, shieldPierce: 0 },
  // Мелочь, давит числом: раньше входит в контакт, но слабее.
  swarmer: { dps: D(0.6), contactRange: 0.28, shieldPierce: 0 },
  // Медленный, но опасный: часть урона проходит сквозь щит.
  brute: { dps: D(1.6), contactRange: 0.22, shieldPierce: 0.30 },
};

const enemyDamageFactor = (distance: number, contactRange: number) => {
  // 0 when far, ramps to 1 when very close.
  const f = (contactRange - distance) / contactRange;
  return Math.max(0, Math.min(1, f));
};

const makeEnemyId = () => `g_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const rollEnemyType = (): Enemy['type'] => {
  const r = Math.random();
  if (r < 0.6) return 'scout';
  if (r < 0.85) return 'swarmer';
  return 'brute';
};

const createEnemy = (): Enemy => {
  const type = rollEnemyType();
  // Keep stats modest for MVP.
  const maxHp = type === 'brute' ? D(34) : type === 'swarmer' ? D(12) : D(18);
  return {
    id: makeEnemyId(),
    type,
    maxHp,
    hp: maxHp,
    distance: 1,
    speed: (type === 'scout' ? 0.10 : type === 'swarmer' ? 0.085 : 0.06) + Math.random() * 0.03,
  };
};

const INITIAL_RESEARCH: ResearchState = {
  levels: {
    kernel_speed: 0,
    logistics_bandwidth: 0,
    storage_caps: 0,
    trade_margin: 0,
    combat_protocols: 0,
    sector_expansion: 0,
  },
};

const INITIAL_DEMONS: DemonsState = {
  active: {
    smart_broker: false,
    overclocker: false,
    oracle: false,
  },
  rentPaid: {
    smart_broker: false,
    overclocker: false,
    oracle: false,
  },
  oracleRecommendationId: null,
  oracleRecommendationRoiSeconds: null,
};

const INITIAL_META: MetaState = {
  qubits: D(0),
  lifetimeEnergyProduced: D(0),
  blueprints: D(0),
};

const INITIAL_EXPEDITION: ExpeditionState = {
  active: false,
  kind: 'recon',
  endsAt: 0,
  reward: null,
  lastReport: null,
  anomaly: false,
};

const INITIAL_SHIP: ShipState = {
  installed: {
    hull: 'hull_mk1',
    engine: 'engine_mk1',
    cargo: 'cargo_mk1',
  },
  unlocked: {
    hull_mk1: true,
    hull_mk2: false,
    engine_mk1: true,
    engine_mk2: false,
    cargo_mk1: true,
    cargo_mk2: false,
  },
};

const INITIAL_STAR_CHART: StarChartState = {
  levels: {
    subspace: 0,
    anomaly: 0,
  },
};

const INITIAL_AEGIS: AegisState = {
  levels: {
    smart_targeting: 0,
    encryption: 0,
  },
};

const INITIAL_PRODUCTION_MATRIX: ProductionMatrixState = {
  levels: {
    cold_fusion: 0,
    molecular_stability: 0,
    auto_sort: 0,
  },
};

const INITIAL_QUANTUM_NET: QuantumNetState = {
  levels: {
    chrono_shift: 0,
    memory_preservation: 0,
  },
  preservedBuildingId: null,
};

const pickMaxHpEnemyIndex = (enemies: Enemy[]) => {
  if (enemies.length === 0) return -1;
  let best = 0;
  for (let i = 1; i < enemies.length; i++) {
    if (enemies[i].hp.gt(enemies[best].hp)) best = i;
  }
  return best;
};


const INITIAL_BUILDINGS: Building[] = [
  {
    id: 'generator_mk1',
    name: 'Аварийный Генератор',
    description: "Старый, но надежный генератор. Вырабатывает мало энергии.",
    baseCost: { energy: D(5) },
    costFactor: 1.15,
    production: { energy: D(1) },
    count: 0
  },
  {
    id: 'battery_mk1',
    name: 'Малый Конденсатор',
    description: "Увеличивает лимит хранения энергии.",
    baseCost: { energy: D(50) },
    costFactor: 1.15,
    production: {},
    productionMultipliers: { energy: D(50) }, // Adds 50 to max energy
    count: 0
  },
  {
    id: 'miner_mk1',
    name: 'Авто-Майнер v1',
    description: "Автоматический бур для добычи железной руды.",
    baseCost: { energy: D(100) },
    costFactor: 1.15,
    production: { ore: D(0.5) },
    count: 0
  },
  {
    id: 'ice_extractor_mk1',
    name: 'Экстрактор Льда v1',
    description: "Собирает водяной лед из фрагментов астероидов.",
    baseCost: { energy: D(120) },
    costFactor: 1.15,
    production: { ice: D(0.35) },
    count: 0
  },
  {
    id: 'carbon_harvester_mk1',
    name: 'Сборщик Углерода v1',
    description: "Извлекает углерод из пылевых облаков и шлама.",
    baseCost: { energy: D(140) },
    costFactor: 1.15,
    production: { carbon: D(0.25) },
    count: 0
  },
  {
    id: 'warehouse_mk1',
    name: 'Складской Модуль',
    description: "Увеличивает вместимость складов для сырья и сплавов.",
    baseCost: { energy: D(250), ore: D(25) },
    costFactor: 1.15,
    production: {},
    productionMultipliers: { ore: D(500), ice: D(500), carbon: D(500), steel: D(200) },
    count: 0
  },
  {
    id: 'steel_smelter_mk1',
    name: 'Плавильня: Сталь',
    description: "Переработка: Железная руда + Углерод -> Сталь.",
    baseCost: { energy: D(400), ore: D(120), carbon: D(60) },
    costFactor: 1.15,
    consumption: { energy: D(1.2), ore: D(0.8), carbon: D(0.4) },
    production: { steel: D(0.4) },
    count: 0
  },
  {
    id: 'turret_mk1',
    name: 'Турель Mk.I',
    description: 'Автоматическая турель. Стреляет по Глитчам и потребляет энергию во время боя.',
    baseCost: { energy: D(550), steel: D(12) },
    costFactor: 1.18,
    production: {},
    combat: { dps: D(3.0), energyPerSecond: D(0.9) },
    count: 0
  },
  {
    id: 'shield_mk1',
    name: 'Щитовой Модуль Mk.I',
    description: 'Поднимает щит базы. Во время волны регенерирует щит за ⚡ и сначала поглощает урон.',
    baseCost: { energy: D(650), steel: D(18) },
    costFactor: 1.18,
    production: {},
    defense: { shieldMaxHp: D(35), shieldRegenPerSecond: D(1.4), energyPerSecond: D(1.1) },
    count: 0
  },
  {
    id: 'dark_matter_condenser_mk1',
    name: 'Конденсатор Тёмной Материи Mk.I',
    description: 'Экзотическая установка. Конденсирует Тёмную Материю из энергии и углерода.',
    baseCost: { energy: D(1500), steel: D(40) },
    costFactor: 1.20,
    consumption: { energy: D(3.2), carbon: D(0.8) },
    production: { dark_matter: D(0.02) },
    count: 0
  }
];

const INITIAL_RESOURCES = {
  energy: { amount: D(50), max: D(100), production: D(0) },
  ore: { amount: D(0), max: D(1000), production: D(0) },
  ice: { amount: D(0), max: D(800), production: D(0) },
  carbon: { amount: D(0), max: D(800), production: D(0) },
  steel: { amount: D(0), max: D(300), production: D(0) },
  dark_matter: { amount: D(0), max: D(50), production: D(0) }
};

const BASE_RESOURCE_MAX: Record<ResourceType, Decimal> = {
  energy: INITIAL_RESOURCES.energy.max,
  ore: INITIAL_RESOURCES.ore.max,
  ice: INITIAL_RESOURCES.ice.max,
  carbon: INITIAL_RESOURCES.carbon.max,
  steel: INITIAL_RESOURCES.steel.max,
  dark_matter: INITIAL_RESOURCES.dark_matter.max,
};

const recomputeCaps = (resources: typeof INITIAL_RESOURCES, buildings: Building[], capsMultiplier: Decimal = D(1)) => {
  const next = { ...resources };

  const caps: Record<ResourceType, Decimal> = {
    energy: BASE_RESOURCE_MAX.energy,
    ore: BASE_RESOURCE_MAX.ore,
    ice: BASE_RESOURCE_MAX.ice,
    carbon: BASE_RESOURCE_MAX.carbon,
    steel: BASE_RESOURCE_MAX.steel,
    dark_matter: BASE_RESOURCE_MAX.dark_matter,
  };

  for (const b of buildings) {
    if (b.count <= 0) continue;
    if (!b.productionMultipliers) continue;
    for (const [resType, amount] of Object.entries(b.productionMultipliers)) {
      const rType = resType as ResourceType;
      if (!caps[rType]) continue;
      caps[rType] = caps[rType].add(D(amount).mul(b.count));
    }
  }

  for (const rType of Object.keys(next) as ResourceType[]) {
    caps[rType] = caps[rType].mul(capsMultiplier);
    next[rType] = {
      ...next[rType],
      max: caps[rType],
      amount: next[rType].amount.min(caps[rType]).max(D(0)),
    };
  }

  return next;
};

// Функция для получения позиции базы - теперь это центр карты (должна быть до generateDeposits)
export const getBasePos = (grid: { width: number; height: number }): GridCoord => ({
  x: Math.floor(grid.width / 2),
  y: Math.floor(grid.height / 2),
});

const generateDeposits = (width: number, height: number) => {
  const deposits: Record<string, DepositType> = {};

  // Simple random scatter. Keep base tile clear.
  const oreChance = 0.10;
  const iceChance = 0.08;
  const carbonChance = 0.07;

  const basePos = getBasePos({ width, height });

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Пропускаем базу (центр карты)
      if (x === basePos.x && y === basePos.y) continue;
      const roll = Math.random();
      if (roll < oreChance) deposits[`${x},${y}`] = 'ore';
      else if (roll < oreChance + iceChance) deposits[`${x},${y}`] = 'ice';
      else if (roll < oreChance + iceChance + carbonChance) deposits[`${x},${y}`] = 'carbon';
    }
  }

  return deposits;
};

const requiredDepositForBuilding = (buildingId: string): DepositType | null => {
  if (buildingId === 'miner_mk1') return 'ore';
  if (buildingId === 'ice_extractor_mk1') return 'ice';
  if (buildingId === 'carbon_harvester_mk1') return 'carbon';
  return null;
};

const BASE_GRID_SIZE = 18;
const SECTOR_EXPAND_STEP = 2;

const desiredGridSizeForResearch = (levels: ResearchState['levels']) => {
  const l = Math.max(0, levels.sector_expansion ?? 0);
  return {
    width: BASE_GRID_SIZE + l * SECTOR_EXPAND_STEP,
    height: BASE_GRID_SIZE + l * SECTOR_EXPAND_STEP,
  };
};

const scatterDepositsInto = (
  deposits: Record<string, DepositType>,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  baseX: number,
  baseY: number,
) => {
  // Simple random scatter. Keep base tile clear.
  const oreChance = 0.10;
  const iceChance = 0.08;
  const carbonChance = 0.07;

  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (x === baseX && y === baseY) continue;
      const k = `${x},${y}`;
      if (deposits[k]) continue;
      const roll = Math.random();
      if (roll < oreChance) deposits[k] = 'ore';
      else if (roll < oreChance + iceChance) deposits[k] = 'ice';
      else if (roll < oreChance + iceChance + carbonChance) deposits[k] = 'carbon';
    }
  }
};

const ensureGridSize = (
  grid: typeof DEFAULT_GRID,
  targetWidth: number,
  targetHeight: number,
) => {
  const nextW = Math.max(grid.width, Math.max(BASE_GRID_SIZE, Math.floor(targetWidth)));
  const nextH = Math.max(grid.height, Math.max(BASE_GRID_SIZE, Math.floor(targetHeight)));
  if (nextW === grid.width && nextH === grid.height) return grid;

  const deposits: Record<string, DepositType> = { ...(grid.deposits ?? {}) };
  const baseX = nextW - 1;
  const baseY = nextH - 1;

  // New columns for existing rows.
  if (nextW > grid.width) {
    scatterDepositsInto(deposits, grid.width, 0, nextW, grid.height, baseX, baseY);
  }
  // New rows for full width (including new columns).
  if (nextH > grid.height) {
    scatterDepositsInto(deposits, 0, grid.height, nextW, nextH, baseX, baseY);
  }

  // Safety: base must never have a deposit.
  delete deposits[`${baseX},${baseY}`];

  // If the selection fell out of bounds somehow, clear it.
  const selected = grid.selected && (grid.selected.x >= nextW || grid.selected.y >= nextH) ? null : grid.selected;

  return {
    ...grid,
    width: nextW,
    height: nextH,
    selected,
    deposits,
  };
};

const DEFAULT_GRID = {
  width: BASE_GRID_SIZE,
  height: BASE_GRID_SIZE,
  selected: null as GridCoord | null,
  tiles: {} as Record<string, string>,
  deposits: generateDeposits(BASE_GRID_SIZE, BASE_GRID_SIZE),
  buffers: {
    base: {
      energy: INITIAL_RESOURCES.energy.amount.toString(),
      ore: INITIAL_RESOURCES.ore.amount.toString(),
      ice: INITIAL_RESOURCES.ice.amount.toString(),
      carbon: INITIAL_RESOURCES.carbon.amount.toString(),
      steel: INITIAL_RESOURCES.steel.amount.toString(),
      dark_matter: INITIAL_RESOURCES.dark_matter.amount.toString(),
    },
  } as Record<string, Partial<Record<ResourceType, string>>>,
  activeTransports: [] as Array<{
    from: { x: number; y: number };
    to: { x: number; y: number };
    resource: ResourceType;
    amount: string;
  }>,
  lastDtSeconds: 0,
  selectedBuildId: null as string | null,
  marketPolicy: {} as Record<string, Partial<Record<TradeResourceType, { import?: boolean; export?: boolean }>>>,
};

const keyOf = (pos: GridCoord) => `${pos.x},${pos.y}`;

const isBasePos = (grid: { width: number; height: number }, pos: GridCoord) => {
  const base = getBasePos(grid);
  return pos.x === base.x && pos.y === base.y;
};

const parseKey = (k: string): GridCoord | null => {
  const [xs, ys] = k.split(',');
  const x = Number(xs);
  const y = Number(ys);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
};

const getBuf = (buffers: Record<string, Partial<Record<ResourceType, string>>>, key: string, res: ResourceType) => {
  const raw = buffers[key]?.[res];
  return raw == null ? D(0) : D(raw);
};

const setBuf = (buffers: Record<string, Partial<Record<ResourceType, string>>>, key: string, res: ResourceType, val: Decimal) => {
  const next = { ...buffers };
  const row = { ...(next[key] ?? {}) };
  row[res] = val.max(D(0)).toString();
  next[key] = row;
  return next;
};

const syncResourcesFromBase = (resources: typeof INITIAL_RESOURCES, buffers: Record<string, Partial<Record<ResourceType, string>>>) => {
  const base = buffers.base ?? {};
  const next = { ...resources };
  for (const r of Object.keys(next) as ResourceType[]) {
    const amt = base[r] != null ? D(base[r]!) : D(0);
    // Важно: сохраняем production, max и другие поля, обновляем только amount
    next[r] = { ...next[r], amount: amt.min(next[r].max).max(D(0)) };
  }
  return next;
};

const clampBaseBufferToCaps = (
  buffers: Record<string, Partial<Record<ResourceType, string>>>,
  resources: typeof INITIAL_RESOURCES,
) => {
  const baseKey = 'base';
  let next = { ...buffers };
  if (!next[baseKey]) next[baseKey] = {};

  for (const r of Object.keys(resources) as ResourceType[]) {
    const cap = resources[r].max;
    const cur = getBuf(next, baseKey, r);
    if (cur.gt(cap)) {
      next = setBuf(next, baseKey, r, cap);
    }
  }

  return next;
};

const canAffordFromBase = (
  buffers: Record<string, Partial<Record<ResourceType, string>>>,
  cost: Partial<Record<ResourceType, Decimal>>,
) => {
  for (const [res, amt] of Object.entries(cost)) {
    const r = res as ResourceType;
    if (getBuf(buffers, 'base', r).lt(D(amt))) return false;
  }
  return true;
};

const spendCostFromBase = (
  buffers: Record<string, Partial<Record<ResourceType, string>>>,
  cost: Partial<Record<ResourceType, Decimal>>,
) => {
  let next = buffers;
  for (const [res, amt] of Object.entries(cost)) {
    const r = res as ResourceType;
    const cur = getBuf(next, 'base', r);
    next = setBuf(next, 'base', r, cur.sub(D(amt)).max(D(0)));
  }
  return next;
};

const INITIAL_MARKET_EVENT: MarketEvent = {
  id: 'none',
  name: 'Стабильность',
  multiplier: 1,
};

const INITIAL_MARKET = {
  prices: {
    ore: D(1.2),
    ice: D(1.1),
    carbon: D(1.5),
    steel: D(6.5),
  },
  event: INITIAL_MARKET_EVENT,
  nextUpdateAt: Date.now() + MARKET_UPDATE_SECONDS * 1000,
  history: {
    ore: [{ t: Date.now(), price: D(1.2).toString() }],
    ice: [{ t: Date.now(), price: D(1.1).toString() }],
    carbon: [{ t: Date.now(), price: D(1.5).toString() }],
    steel: [{ t: Date.now(), price: D(6.5).toString() }],
  } as Record<TradeResourceType, Array<{ t: number; price: string }>>,
};

const MARKET_HISTORY_MAX_POINTS = 180;

const pushMarketHistory = (
  prev: Record<TradeResourceType, Array<{ t: number; price: string }>> | undefined,
  prices: Record<TradeResourceType, Decimal>,
  now: number,
) => {
  const next: Record<TradeResourceType, Array<{ t: number; price: string }>> = {
    ore: [...(prev?.ore ?? [])],
    ice: [...(prev?.ice ?? [])],
    carbon: [...(prev?.carbon ?? [])],
    steel: [...(prev?.steel ?? [])],
  };

  for (const r of TRADEABLE) {
    next[r].push({ t: now, price: prices[r].toString() });
    if (next[r].length > MARKET_HISTORY_MAX_POINTS) {
      next[r] = next[r].slice(next[r].length - MARKET_HISTORY_MAX_POINTS);
    }
  }
  return next;
};

const INITIAL_COMBAT: CombatState = {
  baseMaxHp: BASE_MAX_HP,
  baseHp: BASE_MAX_HP,

  shieldMaxHp: D(0),
  shieldHp: D(0),

  enemies: [],
  nextWaveAt: Date.now() + WAVE_INTERVAL_SECONDS * 1000,
  waveEndsAt: 0,
  nextSpawnAt: 0,
  defenseEnergyNeedPerSecond: D(0),
  defenseEnergyUsedPerSecond: D(0),
  defenseFireRatio: D(0),
  baseDamageTakenPerSecond: D(0),

  shieldEnergyNeedPerSecond: D(0),
  shieldEnergyUsedPerSecond: D(0),
  shieldRegenPerSecond: D(0),
  shieldAbsorbedPerSecond: D(0),

  enemyPressurePerSecond: D(0),
  enemyPressurePotentialPerSecond: D(0),
};

const TRADEABLE: TradeResourceType[] = ['ore', 'ice', 'carbon', 'steel'];

const clampPrice = (p: Decimal) => {
  const min = D(0.05);
  const max = D(999999);
  return p.max(min).min(max);
};

const randomInRange = (min: number, max: number) => min + Math.random() * (max - min);

const rollEvent = (): MarketEvent => {
  const roll = Math.random();
  if (roll < 0.80) return { id: 'none', name: 'Стабильность', multiplier: 1 };

  const affected = TRADEABLE[Math.floor(Math.random() * TRADEABLE.length)];
  const eventRoll = Math.random();

  if (eventRoll < 0.34) {
    // War: typically pumps steel
    return { id: 'war', name: 'Война', multiplier: randomInRange(1.8, 3.0), affected: 'steel' };
  }

  if (eventRoll < 0.67) {
    return { id: 'deficit', name: 'Дефицит', multiplier: randomInRange(1.5, 3.0), affected };
  }

  return { id: 'oversupply', name: 'Переизбыток', multiplier: randomInRange(0.35, 0.7), affected };
};

const updateMarketPrices = (prevPrices: Record<TradeResourceType, Decimal>, event: MarketEvent) => {
  const next: Record<TradeResourceType, Decimal> = { ...prevPrices };

  for (const res of TRADEABLE) {
    const drift = randomInRange(0.85, 1.15);
    next[res] = clampPrice(prevPrices[res].mul(drift));
  }

  if (event.id !== 'none' && event.affected) {
    next[event.affected] = clampPrice(next[event.affected].mul(event.multiplier));
  }

  return next;
};

export const useGameStore = create<GameState>((set, get) => ({
  resources: syncResourcesFromBase(INITIAL_RESOURCES, DEFAULT_GRID.buffers),
  buildings: INITIAL_BUILDINGS,
  market: INITIAL_MARKET,
  combat: INITIAL_COMBAT,
  grid: DEFAULT_GRID,
  research: INITIAL_RESEARCH,
  demons: INITIAL_DEMONS,
  meta: INITIAL_META,
  expedition: INITIAL_EXPEDITION,
  nanoSwarm: INITIAL_NANO_SWARM,
  ship: INITIAL_SHIP,
  starChart: INITIAL_STAR_CHART,
  aegis: INITIAL_AEGIS,
  productionMatrix: INITIAL_PRODUCTION_MATRIX,
  quantumNet: INITIAL_QUANTUM_NET,
  lastTick: Date.now(),

  addResource: (type, amount) => {
    set((state) => {
      const res = state.resources[type];
      const delta = D(amount);
      const cur = getBuf(state.grid.buffers, 'base', type);
      const cappedNext = cur.add(delta).min(res.max);
      const nextBuffers = setBuf(state.grid.buffers, 'base', type, cappedNext);
      const newAmount = cappedNext;
      return {
        grid: { ...state.grid, buffers: nextBuffers },
        resources: {
          ...state.resources,
          [type]: { ...res, amount: newAmount }
        },
      };
    });
  },

  buyBuilding: (buildingId) => {
    set((state) => {
      const buildingIndex = state.buildings.findIndex(b => b.id === buildingId);
      if (buildingIndex === -1) return state;

      const building = state.buildings[buildingIndex];
      const cost = calculateCost(building);

      // Check affordability
      for (const [resType, amount] of Object.entries(cost)) {
        const rType = resType as ResourceType;
        const needed = D(amount);
        if (!state.resources[rType] || state.resources[rType].amount.lt(needed)) return state;
      }

      // Pay cost
      const newResources = { ...state.resources };
      for (const [resType, amount] of Object.entries(cost)) {
        const rType = resType as ResourceType;
        if (!newResources[rType]) continue;
        newResources[rType] = {
          ...newResources[rType],
          amount: newResources[rType].amount.sub(amount).max(D(0))
        };
      }

      // Update building count
      const newBuildings = [...state.buildings];
      newBuildings[buildingIndex] = {
        ...building,
        count: building.count + 1
      };

      const capsMult = computeCapsMultiplier(state.research.levels, state.meta.qubits);
      const capped = recomputeCaps(newResources, newBuildings, capsMult);
      return { resources: capped, buildings: newBuildings };
    });
  },

  selectTile: (pos) => {
    set((state) => {
      // Link system removed - now just select tile
      return { grid: { ...state.grid, selected: pos } };
    });
  },

  setCameraPosition: (x, y, zoom) => {
    set((state) => ({
      grid: { ...state.grid, cameraX: x, cameraY: y, cameraZoom: zoom },
    }));
  },

  expandGrid: (minWidth, minHeight) => {
    set((state) => {
      const desired = {
        width: Math.max(state.grid.width, minWidth),
        height: Math.max(state.grid.height, minHeight),
      };
      
      // Если сетка уже достаточно большая, ничего не делаем
      if (desired.width <= state.grid.width && desired.height <= state.grid.height) {
        return state;
      }
      
      // Используем ensureGridSize для расширения
      const grid = ensureGridSize(state.grid as any, desired.width, desired.height) as any;
      
      return { grid };
    });
  },

  selectBuild: (buildingId) => {
    set((state) => ({ grid: { ...state.grid, selectedBuildId: buildingId, focusedLink: null } }));
  },

  placeSelectedBuildAt: (pos) => {
    set((state) => {
      const buildId = state.grid.selectedBuildId;
      if (!buildId) return state;

      // base tile is reserved
      if (isBasePos(state.grid, pos)) return state;

      if (pos.x < 0 || pos.y < 0 || pos.x >= state.grid.width || pos.y >= state.grid.height) return state;

      const k = keyOf(pos);
      if (state.grid.tiles[k]) return state;

      const requiredDeposit = requiredDepositForBuilding(buildId);
      if (requiredDeposit) {
        const deposits = state.grid.deposits ?? {};
        if (deposits[k] !== requiredDeposit) return state;
      }

      const buildingIndex = state.buildings.findIndex((b) => b.id === buildId);
      if (buildingIndex === -1) return state;

      const building = state.buildings[buildingIndex];
      const cost = calculateCost(building);

      for (const [resType, amount] of Object.entries(cost)) {
        const rType = resType as ResourceType;
        const needed = D(amount);
        if (!state.resources[rType] || state.resources[rType].amount.lt(needed)) return state;
      }

      const newResources = { ...state.resources };
      let buffers = state.grid.buffers;
      for (const [resType, amount] of Object.entries(cost)) {
        const rType = resType as ResourceType;
        if (!newResources[rType]) continue;
        // Spend from base buffer
        const cur = getBuf(buffers, 'base', rType);
        const next = cur.sub(amount).max(D(0));
        buffers = setBuf(buffers, 'base', rType, next);
        newResources[rType] = { ...newResources[rType], amount: next };
      }

      const newBuildings = [...state.buildings];
      newBuildings[buildingIndex] = { ...building, count: building.count + 1 };

      const capsMult = computeCapsMultiplier(state.research.levels, state.meta.qubits);
      const capped = recomputeCaps(newResources, newBuildings, capsMult);

      // init tile buffer
      let nextBuffers = buffers;
      if (!nextBuffers[k]) nextBuffers = { ...nextBuffers, [k]: {} };

      return {
        resources: capped,
        buildings: newBuildings,
        grid: {
          ...state.grid,
          buffers: nextBuffers,
          tiles: { ...state.grid.tiles, [k]: buildId },
          selected: pos,
          selectedBuildId: null, // Сбрасываем режим строительства после установки
        },
      };
    });
  },

  removeBuildingAt: (pos) => {
    set((state) => {
      const k = keyOf(pos);
      const buildId = state.grid.tiles[k];
      if (!buildId) return state;

      const buildingIndex = state.buildings.findIndex((b) => b.id === buildId);
      if (buildingIndex === -1) return state;

      const nextTiles = { ...state.grid.tiles };
      delete nextTiles[k];

      const newBuildings = [...state.buildings];
      const b = newBuildings[buildingIndex];
      newBuildings[buildingIndex] = { ...b, count: Math.max(0, b.count - 1) };

      // Возвращаем 75% стоимости здания при сносе
      const building = state.buildings[buildingIndex];
      const cost = calculateCost(building);
      const refundRate = 0.75; // 75% возврат
      
      let newResources = { ...state.resources };
      let buffers = state.grid.buffers;
      
      for (const [resType, amount] of Object.entries(cost)) {
        const rType = resType as ResourceType;
        const refund = D(amount).mul(refundRate);
        if (newResources[rType]) {
          const cur = getBuf(buffers, 'base', rType);
          const next = cur.add(refund);
          buffers = setBuf(buffers, 'base', rType, next);
          newResources[rType] = { ...newResources[rType], amount: next };
        }
      }

      const capsMult = computeCapsMultiplier(state.research.levels, state.meta.qubits);
      const capped = recomputeCaps(newResources, newBuildings, capsMult);

      // keep buffer record (so resources can remain, but it's ok). Optional cleanup later.

      return {
        grid: { ...state.grid, tiles: nextTiles, buffers },
        buildings: newBuildings,
        resources: capped,
      };
    });
  },

  setTileMarketPolicy: (tileKey, resource, patch) => {
    set((state) => {
      const prev = state.grid.marketPolicy ?? {};
      const prevTile = prev[tileKey] ?? {};
      const prevRes = prevTile[resource] ?? {};
      const nextTile = { ...prevTile, [resource]: { ...prevRes, ...patch } };
      return { grid: { ...state.grid, marketPolicy: { ...prev, [tileKey]: nextTile } } };
    });
  },

  sellResource: (type, amount) => {
    set((state) => {
      const sellAmount = D(amount);
      const res = state.resources[type];
      if (!res || res.amount.lte(0)) return state;

      const actual = res.amount.min(sellAmount);
      if (actual.lte(0)) return state;

      const price = state.market.prices[type];
      const tradeMult = computeTradeMultiplier(state.research.levels);
      const earned = price.mul(actual).mul(D(tradeMult));

      const nextResources = { ...state.resources };
      // remove from base buffer
      let nextBuffers = state.grid.buffers;
      const cur = getBuf(nextBuffers, 'base', type);
      nextBuffers = setBuf(nextBuffers, 'base', type, cur.sub(actual).max(D(0)));
      nextResources[type] = { ...res, amount: res.amount.sub(actual) };
      // Add energy (respect cap)
      const curE = getBuf(nextBuffers, 'base', 'energy');
      const nextE = curE.add(earned).min(nextResources.energy.max);
      nextBuffers = setBuf(nextBuffers, 'base', 'energy', nextE);
      nextResources.energy = { ...nextResources.energy, amount: nextE };

      return { resources: nextResources, grid: { ...state.grid, buffers: nextBuffers } };
    });
  },

  buyResource: (type, amount) => {
    set((state) => {
      const buyAmount = D(amount);
      if (buyAmount.lte(0)) return state;

      const res = state.resources[type];
      if (!res) return state;

      const price = state.market.prices[type];
      const tradeMult = computeTradeMultiplier(state.research.levels);
      const unitCost = price.div(D(tradeMult)).max(D(0));

      let buffers = state.grid.buffers;
      const curE = getBuf(buffers, 'base', 'energy');
      if (curE.lte(0)) return state;

      // Respect cap of the purchased resource in base.
      const curR = getBuf(buffers, 'base', type);
      const capR = state.resources[type].max;
      const room = capR.sub(curR).max(D(0));
      if (room.lte(0)) return state;

      const desired = buyAmount.min(room);
      const desiredCost = unitCost.mul(desired);
      if (desiredCost.lte(0)) return state;

      // Clamp to affordable amount.
      const affordable = curE.div(unitCost).max(D(0));
      const actual = desired.min(affordable);
      if (actual.lte(0)) return state;

      const cost = unitCost.mul(actual);
      buffers = setBuf(buffers, 'base', 'energy', curE.sub(cost).max(D(0)));
      buffers = setBuf(buffers, 'base', type, curR.add(actual));

      const nextResources = syncResourcesFromBase({ ...state.resources }, buffers);
      return { resources: nextResources, grid: { ...state.grid, buffers } };
    });
  },

  buyUpgrade: (id) => {
    set((state) => {
      const curLevel = state.research.levels[id] ?? 0;
      const def = UPGRADE_DEFS[id];
      if (curLevel >= def.maxLevel) return state;

      const cost = upgradeCost(id, curLevel);
      if (!canAffordFromBase(state.grid.buffers, cost)) return state;

      let buffers = spendCostFromBase(state.grid.buffers, cost);

      const levels = { ...state.research.levels, [id]: curLevel + 1 };
      let grid = { ...state.grid, buffers };
      if (id === 'sector_expansion') {
        const desired = desiredGridSizeForResearch(levels);
        grid = ensureGridSize(grid as any, desired.width, desired.height) as any;
      }
      const capsMult = computeCapsMultiplier(levels, state.meta.qubits);

      let resources = syncResourcesFromBase({ ...state.resources }, grid.buffers);
      resources = recomputeCaps(resources, state.buildings, capsMult);
      buffers = clampBaseBufferToCaps(grid.buffers, resources);
      resources = syncResourcesFromBase(resources, buffers);
      grid = { ...grid, buffers };

      return {
        research: { levels },
        resources,
        grid,
      };
    });
  },

  toggleDemon: (id) => {
    set((state) => ({
      demons: {
        ...state.demons,
        active: { ...state.demons.active, [id]: !state.demons.active[id] },
      },
    }));
  },

  setNanoSwarmAllocation: (channel, pct) => {
    set((state) => {
      const value = nanoClamp01(pct);
      const prev = state.nanoSwarm.allocation;
      const otherChannels: NanoSwarmChannel[] = (['attack', 'repair', 'boost'] as NanoSwarmChannel[]).filter((c) => c !== channel);
      const remaining = 1 - value;
      const otherSum = (prev[otherChannels[0]] ?? 0) + (prev[otherChannels[1]] ?? 0);

      let nextOther0 = 0;
      let nextOther1 = 0;
      if (remaining <= 0) {
        nextOther0 = 0;
        nextOther1 = 0;
      } else if (otherSum <= 0) {
        nextOther0 = remaining / 2;
        nextOther1 = remaining / 2;
      } else {
        nextOther0 = remaining * ((prev[otherChannels[0]] ?? 0) / otherSum);
        nextOther1 = remaining * ((prev[otherChannels[1]] ?? 0) / otherSum);
      }

      const nextAlloc = normalizeNanoAllocation({
        ...prev,
        [channel]: value,
        [otherChannels[0]]: nextOther0,
        [otherChannels[1]]: nextOther1,
      } as Record<NanoSwarmChannel, number>);

      return {
        nanoSwarm: {
          ...state.nanoSwarm,
          allocation: nextAlloc,
        },
      };
    });
  },

  selectShipModule: (slot, moduleId) => {
    set((state) => {
      const def = SHIP_MODULE_DEFS[moduleId as ShipModuleId];
      if (!def) return state;
      if (def.slot !== slot) return state;
      if (!state.ship.unlocked[moduleId]) return state;
      return {
        ship: {
          ...state.ship,
          installed: {
            ...state.ship.installed,
            [slot]: moduleId,
          },
        },
      };
    });
  },

  unlockShipModule: (moduleId) => {
    set((state) => {
      if (state.ship.unlocked[moduleId]) return state;
      const def = SHIP_MODULE_DEFS[moduleId as ShipModuleId];
      if (!def) return state;
      const cost = def.cost;
      if (!canAffordFromBase(state.grid.buffers, cost)) return state;

      let buffers = spendCostFromBase(state.grid.buffers, cost);
      let resources = syncResourcesFromBase({ ...state.resources }, buffers);
      const capsMult = computeCapsMultiplier(state.research.levels, state.meta.qubits);
      resources = recomputeCaps(resources, state.buildings, capsMult);
      buffers = clampBaseBufferToCaps(buffers, resources);
      resources = syncResourcesFromBase(resources, buffers);

      return {
        resources,
        grid: { ...state.grid, buffers },
        ship: {
          ...state.ship,
          unlocked: {
            ...state.ship.unlocked,
            [moduleId]: true,
          },
        },
      };
    });
  },

  buyStarChartUpgrade: (id) => {
    set((state) => {
      const def = STAR_CHART_UPGRADE_DEFS[id];
      const curLevel = state.starChart.levels[id] ?? 0;
      if (curLevel >= def.maxLevel) return state;

      const cost = starChartUpgradeCost(id, curLevel);
      if (!canAffordFromBase(state.grid.buffers, cost)) return state;

      let buffers = spendCostFromBase(state.grid.buffers, cost);

      let resources = syncResourcesFromBase({ ...state.resources }, buffers);
      const capsMult = computeCapsMultiplier(state.research.levels, state.meta.qubits);
      resources = recomputeCaps(resources, state.buildings, capsMult);
      buffers = clampBaseBufferToCaps(buffers, resources);
      resources = syncResourcesFromBase(resources, buffers);

      return {
        resources,
        grid: { ...state.grid, buffers },
        starChart: {
          levels: {
            ...state.starChart.levels,
            [id]: curLevel + 1,
          },
        },
      };
    });
  },

  buyAegisUpgrade: (id) => {
    set((state) => {
      const def = AEGIS_UPGRADE_DEFS[id];
      const curLevel = state.aegis.levels[id] ?? 0;
      if (curLevel >= def.maxLevel) return state;

      const cost = aegisUpgradeCost(id, curLevel);
      if (!canAffordFromBase(state.grid.buffers, cost)) return state;

      let buffers = spendCostFromBase(state.grid.buffers, cost);

      let resources = syncResourcesFromBase({ ...state.resources }, buffers);
      const capsMult = computeCapsMultiplier(state.research.levels, state.meta.qubits);
      resources = recomputeCaps(resources, state.buildings, capsMult);
      buffers = clampBaseBufferToCaps(buffers, resources);
      resources = syncResourcesFromBase(resources, buffers);

      return {
        resources,
        grid: { ...state.grid, buffers },
        aegis: {
          levels: {
            ...state.aegis.levels,
            [id]: curLevel + 1,
          },
        },
      };
    });
  },

  buyProductionMatrixUpgrade: (id: ProductionMatrixUpgradeId) => {
    set((state) => {
      const def = PRODUCTION_MATRIX_UPGRADE_DEFS[id];
      const curLevel = state.productionMatrix.levels[id] ?? 0;
      if (curLevel >= def.maxLevel) return state;

      const cost = productionMatrixUpgradeCost(id, curLevel);
      if (state.meta.blueprints.lt(D(cost))) return state;

      return {
        meta: { ...state.meta, blueprints: state.meta.blueprints.sub(D(cost)) },
        productionMatrix: {
          levels: {
            ...state.productionMatrix.levels,
            [id]: curLevel + 1,
          },
        },
      };
    });
  },

  buyQuantumNetUpgrade: (id: QuantumNetUpgradeId) => {
    set((state) => {
      const def = QUANTUM_NET_UPGRADE_DEFS[id];
      const curLevel = state.quantumNet.levels[id] ?? 0;
      if (curLevel >= def.maxLevel) return state;

      const cost = quantumNetUpgradeCost(id, curLevel);
      if (state.meta.qubits.lt(D(cost))) return state;

      return {
        meta: { ...state.meta, qubits: state.meta.qubits.sub(D(cost)).max(D(0)) },
        quantumNet: {
          ...state.quantumNet,
          levels: {
            ...state.quantumNet.levels,
            [id]: curLevel + 1,
          },
        },
      };
    });
  },

  setQuantumNetPreservedBuildingId: (buildingId: string | null) => {
    set((state) => ({
      quantumNet: { ...state.quantumNet, preservedBuildingId: buildingId },
    }));
  },

  prestigeReset: () => {
    set((state) => {
      const life = Number(state.meta.lifetimeEnergyProduced.toString());
      const gain = Number.isFinite(life) && life > 0 ? Math.floor(Math.log10(life + 1)) : 0;
      if (gain <= 0) return state;

      const now = Date.now();
      const nextMeta: MetaState = {
        qubits: state.meta.qubits.add(D(gain)),
        lifetimeEnergyProduced: D(0),
        blueprints: D(0),
      };

      const nextMarket = { ...INITIAL_MARKET, nextUpdateAt: now + MARKET_UPDATE_SECONDS * 1000 };
      const nextCombat: CombatState = {
        ...INITIAL_COMBAT,
        nextWaveAt: now + WAVE_INTERVAL_SECONDS * 1000,
        waveEndsAt: 0,
        nextSpawnAt: 0,
      };

      const chronoLevel = state.quantumNet.levels.chrono_shift ?? 0;
      const bonus = computeChronoShiftStartingBonus(chronoLevel);

      const memoryEnabled = computeMemoryPreservationEnabled(state.quantumNet.levels.memory_preservation ?? 0);
      const preserveId = memoryEnabled ? state.quantumNet.preservedBuildingId : null;

      const nextTiles: Record<string, string> = {};
      if (preserveId) {
        const hadIt = Object.values(state.grid.tiles ?? {}).some((v) => v === preserveId);
        if (hadIt) nextTiles['0,0'] = preserveId;
      }

      const nextGrid = {
        ...DEFAULT_GRID,
        tiles: nextTiles,
        buffers: {
          base: {
            energy: D(INITIAL_RESOURCES.energy.amount).add(D(bonus.energy)).toString(),
            ore: D(INITIAL_RESOURCES.ore.amount).add(D(bonus.ore)).toString(),
            ice: D(INITIAL_RESOURCES.ice.amount).add(D(bonus.ice)).toString(),
            carbon: D(INITIAL_RESOURCES.carbon.amount).add(D(bonus.carbon)).toString(),
            steel: D(INITIAL_RESOURCES.steel.amount).add(D(bonus.steel)).toString(),
            dark_matter: INITIAL_RESOURCES.dark_matter.amount.toString(),
          },
        },
      };

      const nextBuildings = INITIAL_BUILDINGS.map((b) => {
        if (preserveId && nextTiles['0,0'] === preserveId && b.id === preserveId) return { ...b, count: 1 };
        return b;
      });

      const capsMult = computeCapsMultiplier(state.research.levels, nextMeta.qubits);
      let resources = recomputeCaps({ ...INITIAL_RESOURCES }, nextBuildings, capsMult);
      let buffers = clampBaseBufferToCaps(nextGrid.buffers, resources);
      resources = syncResourcesFromBase(resources, buffers);

      return {
        resources,
        buildings: nextBuildings,
        market: nextMarket,
        combat: nextCombat,
        grid: { ...nextGrid, buffers },
        research: state.research,
        demons: { ...state.demons, oracleRecommendationId: null, oracleRecommendationRoiSeconds: null },
        meta: nextMeta,
        expedition: { ...INITIAL_EXPEDITION },
        nanoSwarm: INITIAL_NANO_SWARM,
        ship: INITIAL_SHIP,
        starChart: INITIAL_STAR_CHART,
        aegis: INITIAL_AEGIS,
        productionMatrix: INITIAL_PRODUCTION_MATRIX,
        quantumNet: state.quantumNet,
        lastTick: now,
      };
    });
  },

  startExpedition: () => {
    set((state) => {
      if (state.expedition.active) return state;
      const cost: Partial<Record<ResourceType, Decimal>> = { energy: D(180), steel: D(8) };
      if (!canAffordFromBase(state.grid.buffers, cost)) return state;

      let buffers = spendCostFromBase(state.grid.buffers, cost);
      let resources = syncResourcesFromBase({ ...state.resources }, buffers);
      const capsMult = computeCapsMultiplier(state.research.levels, state.meta.qubits);
      resources = recomputeCaps(resources, state.buildings, capsMult);
      buffers = clampBaseBufferToCaps(buffers, resources);
      resources = syncResourcesFromBase(resources, buffers);

      const now = Date.now();
      const shipDurationMs = computeShipExpeditionDurationMs(state.ship.installed);
      const durationMult = computeStarChartDurationMultiplier(state.starChart.levels.subspace ?? 0);
      const durationMs = Math.max(5_000, Math.round(shipDurationMs * durationMult));
      const endsAt = now + durationMs;

      const rewardMult = computeShipRewardMultiplier(state.ship.installed);
      const steelChance = computeShipSteelBonusChance(state.ship.installed);

      const anomalyChance = computeStarChartAnomalyChance(state.starChart.levels.anomaly ?? 0);
      const anomaly = Math.random() < anomalyChance;

      const reward: Partial<Record<TradeResourceType, string>> = {
        ore: D(30 + Math.random() * 30).mul(D(rewardMult)).toString(),
        ice: D(20 + Math.random() * 25).mul(D(rewardMult)).toString(),
        carbon: D(15 + Math.random() * 25).mul(D(rewardMult)).toString(),
      };
      if (Math.random() < steelChance) {
        reward.steel = D(2 + Math.random() * 4).mul(D(rewardMult)).toString();
      }

      if (anomaly) {
        const bonus = D(1.5 + Math.random() * 2.5)
          .mul(D(rewardMult))
          .mul(computeStarChartAnomalySteelBonus(state.starChart.levels.anomaly ?? 0));
        const cur = reward.steel ? D(reward.steel) : D(0);
        reward.steel = cur.add(bonus).toString();
      }

      return {
        resources,
        grid: { ...state.grid, buffers },
        expedition: {
          active: true,
          kind: 'recon',
          endsAt,
          reward,
          lastReport: null,
          anomaly,
        },
      };
    });
  },

  tick: (dt) => {
    set((state) => {
      const now = Date.now();

      const waveActiveEconomy = state.combat.waveEndsAt > now;
      const smartTargeting = computeAegisSmartTargetingEnabled(state.aegis.levels);
      const interferenceMult = computeAegisInterferenceMultiplier(
        state.combat.enemies.length,
        state.aegis.levels.encryption ?? 0,
        waveActiveEconomy,
      );

      const levels = state.research.levels;
      const tradeMult = computeTradeMultiplier(levels);
      const capsMult = computeCapsMultiplier(levels, state.meta.qubits);
      const combatMult = computeCombatMultiplier(levels, state.meta.qubits);

      // caps first
      let newResources = recomputeCaps({ ...state.resources }, state.buildings, capsMult);

      const baseKey = 'base';

      // Buffers
      let buffers = { ...state.grid.buffers };

      // Ensure base buffer exists
      if (!buffers[baseKey]) buffers[baseKey] = {};

      // Meta
      let lifetimeEnergyProduced = state.meta.lifetimeEnergyProduced;
      let blueprints = state.meta.blueprints;

      // Demons: pay rent upfront from base energy (otherwise demon is effectively OFF this tick)
      const demonsPaid: Record<DemonId, boolean> = { ...state.demons.active };
      for (const id of Object.keys(state.demons.active) as DemonId[]) {
        if (!state.demons.active[id]) {
          demonsPaid[id] = false;
          continue;
        }
        const need = DEMON_DEFS[id].energyPerSecond.mul(dt);
        const have = getBuf(buffers, baseKey, 'energy');
        if (need.lte(0) || have.lt(need)) {
          demonsPaid[id] = false;
          continue;
        }
        buffers = setBuf(buffers, baseKey, 'energy', have.sub(need));
        demonsPaid[id] = true;
      }

      const speedMult = computeSpeedMultiplier(levels, state.meta.qubits, demonsPaid.overclocker);
      const boostMult = computeNanoBoostMultiplier(state.nanoSwarm.allocation.boost ?? 0);
      const dtFacilities = dt * speedMult * boostMult * interferenceMult;

      const coldFusionMult = computeColdFusionEnergyMultiplier(state.productionMatrix.levels.cold_fusion ?? 0);
      const doubleChance = computeMolecularStabilityDoubleChance(state.productionMatrix.levels.molecular_stability ?? 0);
      const autoSortLevel = state.productionMatrix.levels.auto_sort ?? 0;
      const autoSortEnabled = computeAutoSortEnabled(autoSortLevel);
      const autoSortStartRatio = computeAutoSortStartRatio(autoSortLevel);
      const autoSortTargetRatio = computeAutoSortTargetRatio(autoSortLevel);

      // Reset production rates for display
      for (const key in newResources) {
        // Важно: создаем новый объект чтобы Zustand заметил изменение
        newResources[key as ResourceType] = { ...newResources[key as ResourceType], production: D(0) };
      }

      const baseBefore: Record<ResourceType, Decimal> = {
        energy: getBuf(buffers, baseKey, 'energy'),
        ore: getBuf(buffers, baseKey, 'ore'),
        ice: getBuf(buffers, baseKey, 'ice'),
        carbon: getBuf(buffers, baseKey, 'carbon'),
        steel: getBuf(buffers, baseKey, 'steel'),
        dark_matter: getBuf(buffers, baseKey, 'dark_matter'),
      };

      // АВТОМАТИЧЕСКАЯ ЛОГИСТИКА: Находим ближайшие источники для каждого потребителя
      // Структура для хранения активных транспортов (для визуализации)
      const activeTransports: Array<{
        from: { x: number; y: number };
        to: { x: number; y: number };
        resource: ResourceType;
        amount: Decimal;
      }> = [];

      // Функция поиска ВСЕХ источников ресурса (отсортированных по расстоянию)
      const findAllSources = (
        targetX: number,
        targetY: number,
        resource: ResourceType,
        exclude?: string
      ): Array<{ x: number; y: number; key: string; dist: number }> => {
        const sources: Array<{ x: number; y: number; key: string; dist: number }> = [];

        // Проверяем базу
        const baseAvailable = getBuf(buffers, baseKey, resource);
        if (baseAvailable.gt(0)) {
          const basePos = getBasePos(state.grid);
          const baseDist = Math.abs(basePos.x - targetX) + Math.abs(basePos.y - targetY);
          sources.push({ x: basePos.x, y: basePos.y, key: baseKey, dist: baseDist });
        }

        // Проверяем все здания-производители
        for (const [k, buildingId] of Object.entries(state.grid.tiles)) {
          if (k === exclude) continue;
          
          const building = state.buildings.find((b) => b.id === buildingId);
          if (!building?.production?.[resource]) continue;

          const pos = parseKey(k);
          if (!pos) continue;

          const available = getBuf(buffers, k, resource);
          if (available.lte(0)) continue;

          const dist = Math.abs(pos.x - targetX) + Math.abs(pos.y - targetY);
          sources.push({ ...pos, key: k, dist });
        }

        // Сортируем по расстоянию (ближайшие первые)
        return sources.sort((a, b) => a.dist - b.dist);
      };

      // Produce/consume into local tile buffers
      state.buildings.forEach((b) => {
        if (b.count <= 0) return;

        // Find all placed instances of this building
        const placedKeys: string[] = [];
        for (const [k, v] of Object.entries(state.grid.tiles)) {
          if (v === b.id) placedKeys.push(k);
        }
        if (placedKeys.length === 0) return;

        for (const tileKey of placedKeys) {
          if (!buffers[tileKey]) buffers[tileKey] = {};

          const tilePos = parseKey(tileKey);
          if (!tilePos) continue;

          const tilePolicy = state.grid.marketPolicy?.[tileKey];

          // Market Policy (import): try to top-up missing inputs from the market (tradeable only)
          if (tilePolicy && b.consumption) {
            for (const [resType, perSecond] of Object.entries(b.consumption)) {
              const rType = resType as ResourceType;
              if (rType === 'energy') continue;
              if (!(TRADEABLE as string[]).includes(rType)) continue;

              const p = (tilePolicy as any)[rType] as { import?: boolean; export?: boolean } | undefined;
              if (!p?.import) continue;

              const need = D(perSecond).mul(dtFacilities);
              if (need.lte(0)) continue;

              const available = getBuf(buffers, tileKey, rType);
              if (available.gte(need)) continue;

              const missing = need.sub(available).max(D(0));
              if (missing.lte(0)) continue;

              const price = state.market.prices[rType as TradeResourceType];
              const unitCost = price.div(D(tradeMult)).max(D(0));
              if (unitCost.lte(0)) continue;

              const curE = getBuf(buffers, baseKey, 'energy');
              if (curE.lte(0)) continue;

              const desired = missing.min(D(12).mul(dt));
              const affordable = curE.div(unitCost).max(D(0));
              const actual = desired.min(affordable);
              if (actual.lte(0)) continue;

              const cost = unitCost.mul(actual);
              buffers = setBuf(buffers, baseKey, 'energy', curE.sub(cost).max(D(0)));
              const curLocal = getBuf(buffers, tileKey, rType);
              buffers = setBuf(buffers, tileKey, rType, curLocal.add(actual));
            }
          }

          // АВТОМАТИЧЕСКАЯ ДОСТАВКА: Собираем ресурсы от ВСЕХ доступных источников
          if (b.consumption) {
            // Проверяем - не переполнены ли выходные ресурсы. Если да - не доставляем входные
            let outputsBlocked = false;
            if (b.production) {
              for (const [prodResType] of Object.entries(b.production)) {
                const pType = prodResType as ResourceType;
                if (newResources[pType]) {
                  const baseCap = newResources[pType].max;
                  if (baseCap.gt(0)) {
                    const baseAmount = getBuf(buffers, baseKey, pType);
                    const localAmount = getBuf(buffers, tileKey, pType);
                    const productionRate = D(b.production[pType] || 0);
                    const maxLocalBuffer = productionRate.mul(20);
                    
                    // Если выход переполнен - не доставляем входы
                    if (localAmount.gte(maxLocalBuffer) || baseAmount.gte(baseCap.mul(0.98))) {
                      outputsBlocked = true;
                      break;
                    }
                  }
                }
              }
            }
            
            if (!outputsBlocked) {
              for (const [resType, perSecond] of Object.entries(b.consumption)) {
              const rType = resType as ResourceType;
              if (rType === 'energy') continue; // Энергия всегда доступна с базы
              
              const need = D(perSecond).mul(dtFacilities);
              if (need.lte(0)) continue;

              let currentAvailable = getBuf(buffers, tileKey, rType);
              // Держим буфер на 5 секунд работы вместо одного тика
              const targetBuffer = D(perSecond).mul(5);
              let shortfall = targetBuffer.sub(currentAvailable).max(D(0));
              
              if (shortfall.gt(0)) {
                // Ищем ВСЕ источники, отсортированные по расстоянию
                const sources = findAllSources(tilePos.x, tilePos.y, rType, tileKey);
                
                // Собираем ресурсы от каждого источника пока не наберём нужное количество
                for (const source of sources) {
                  if (shortfall.lte(0)) break;
                  
                  const sourceAvailable = getBuf(buffers, source.key, rType);
                  const toTransfer = sourceAvailable.min(shortfall);
                  
                  if (toTransfer.gt(0)) {
                    buffers = setBuf(buffers, source.key, rType, sourceAvailable.sub(toTransfer));
                    currentAvailable = getBuf(buffers, tileKey, rType);
                    buffers = setBuf(buffers, tileKey, rType, currentAvailable.add(toTransfer));
                    shortfall = shortfall.sub(toTransfer);
                    
                    activeTransports.push({
                      from: { x: source.x, y: source.y },
                      to: { x: tilePos.x, y: tilePos.y },
                      resource: rType,
                      amount: toTransfer,
                    });
                  }
                }
              }
            }
            }
          }

          // Determine how much we can run given inputs.
          let ratio = D(1);
          if (b.consumption) {
            for (const [resType, perSecond] of Object.entries(b.consumption)) {
              const rType = resType as ResourceType;
              const perSecondAdj = rType === 'energy' ? D(perSecond).mul(D(coldFusionMult)) : D(perSecond);
              const need = perSecondAdj.mul(dtFacilities);
              if (need.lte(0)) continue;

              // Energy consumption comes from base buffer
              const available = rType === 'energy' ? getBuf(buffers, baseKey, 'energy') : getBuf(buffers, tileKey, rType);
              if (available.lte(0)) {
                ratio = D(0);
                break;
              }
              ratio = ratio.min(available.div(need));
            }
            ratio = ratio.max(D(0)).min(D(1));
          }

          if (b.consumption && ratio.gt(0)) {
            for (const [resType, perSecond] of Object.entries(b.consumption)) {
              const rType = resType as ResourceType;
              const perSecondAdj = rType === 'energy' ? D(perSecond).mul(D(coldFusionMult)) : D(perSecond);
              const consume = perSecondAdj.mul(dtFacilities).mul(ratio);

              if (rType === 'energy') {
                const cur = getBuf(buffers, baseKey, 'energy');
                buffers = setBuf(buffers, baseKey, 'energy', cur.sub(consume));
              } else {
                const localCur = getBuf(buffers, tileKey, rType);
                buffers = setBuf(buffers, tileKey, rType, localCur.sub(consume));
              }
            }
          }

          if (ratio.gt(0)) {
            for (const [resType, perSecond] of Object.entries(b.production)) {
              const rType = resType as ResourceType;
              
              // Проверяем переполнение с гистерезисом: останавливаем при 98%, возобновляем при <90%
              if (newResources[rType]) {
                const baseCap = newResources[rType].max;
                if (baseCap.gt(0)) {
                  const baseAmount = getBuf(buffers, baseKey, rType);
                  const localAmount = getBuf(buffers, tileKey, rType);
                  
                  // Если уже есть локальный буфер >20 сек - не производим (переполнение)
                  const productionRate = D(perSecond);
                  const maxLocalBuffer = productionRate.mul(20);
                  if (localAmount.gte(maxLocalBuffer)) {
                    continue;
                  }
                  
                  // Если база заполнена >98% - не производим
                  if (baseAmount.gte(baseCap.mul(0.98))) {
                    continue;
                  }
                }
              }
              
              let produced = D(perSecond).mul(dtFacilities).mul(ratio);
              if (rType !== 'energy' && produced.gt(0) && doubleChance > 0 && Math.random() < doubleChance) {
                produced = produced.mul(2);
              }
              
              // ВСЕ ресурсы производятся в локальный буфер здания
              // Автоматическая логистика доставит их туда, где они нужны
              const cur = getBuf(buffers, tileKey, rType);
              buffers = setBuf(buffers, tileKey, rType, cur.add(produced));

              if (rType === 'energy' && produced.gt(0)) {
                lifetimeEnergyProduced = lifetimeEnergyProduced.add(produced);
              }
            }
          }

          // Market Policy (export): auto-sell surplus from this tile (tradeable only)
          if (tilePolicy) {
            // Проверяем что энергия не переполнена
            const energyCap = newResources.energy.max;
            const energyHave = getBuf(buffers, baseKey, 'energy');
            const energyThreshold = energyCap.mul(D('0.85')); // Не продаем если энергия >85%
            
            if (energyHave.lt(energyThreshold)) {
              for (const r of TRADEABLE) {
                const p = (tilePolicy as any)[r] as { import?: boolean; export?: boolean } | undefined;
                if (!p?.export) continue;

                const have = getBuf(buffers, tileKey, r);
                if (have.lte(0)) continue;

                // Keep a small working buffer if this building consumes the resource.
                const keep = b.consumption && (b.consumption as any)[r]
                  ? D((b.consumption as any)[r]).mul(dtFacilities).mul(D(2))
                  : D(0);

                const sellable = have.sub(keep).max(D(0));
                if (sellable.lte(0)) continue;

                const sellAmt = sellable.min(D(12).mul(dt));
                if (sellAmt.lte(0)) continue;

                const price = state.market.prices[r];
                const earned = price.mul(sellAmt).mul(D(tradeMult));

                // Проверяем что заработанная энергия поместится
                const curE = getBuf(buffers, baseKey, 'energy');
                const futureE = curE.add(earned);
                if (futureE.gt(energyCap)) {
                  // Продаем только столько, сколько поместится
                  const room = energyCap.sub(curE).max(D(0));
                  if (room.lte(0)) break; // Нет места - прекращаем продажу
                  const affordableSell = room.div(price.mul(D(tradeMult))).max(D(0));
                  const actualSell = sellAmt.min(affordableSell);
                  if (actualSell.lte(0)) continue;
                  
                  const actualEarned = price.mul(actualSell).mul(D(tradeMult));
                  buffers = setBuf(buffers, tileKey, r, have.sub(actualSell).max(D(0)));
                  buffers = setBuf(buffers, baseKey, 'energy', curE.add(actualEarned));
                } else {
                  buffers = setBuf(buffers, tileKey, r, have.sub(sellAmt).max(D(0)));
                  buffers = setBuf(buffers, baseKey, 'energy', curE.add(earned));
                }
              }
            }
          }
        }
      });

      // Автоматическая отправка ВСЕХ произведённых ресурсов на базу
      // Отправляем излишки, оставляя 10 секунд для локальной доставки соседним зданиям
      for (const [tileKey, buildingId] of Object.entries(state.grid.tiles)) {
        if (tileKey === 'base') continue;
        
        const building = state.buildings.find((b) => b.id === buildingId);
        if (!building?.production) continue;
        
        // Проходим по всем производимым ресурсам здания
        for (const [rType, prodRate] of Object.entries(building.production)) {
          const resourceType = rType as ResourceType;
          const localAmount = getBuf(buffers, tileKey, resourceType);
          if (localAmount.lte(0)) continue;
          
          // Оставляем буфер на 10 секунд производства для соседних потребителей
          const keepAmount = D(prodRate).mul(10);
          const toTransfer = localAmount.sub(keepAmount).max(D(0));
          
          if (toTransfer.gt(0)) {
            buffers = setBuf(buffers, tileKey, resourceType, localAmount.sub(toTransfer));
            const baseAmount = getBuf(buffers, baseKey, resourceType);
            buffers = setBuf(buffers, baseKey, resourceType, baseAmount.add(toTransfer));
          }
        }
      }

      // Clamp base buffer to caps to avoid hidden overflow.
      buffers = clampBaseBufferToCaps(buffers, newResources);

      // Sync global resources from base buffer (and clamp by caps)
      newResources = syncResourcesFromBase(newResources, buffers);

      // Production Matrix: Auto-Sort (delete cheap resources to prevent clogging)
      if (autoSortEnabled) {
        for (const r of ['ore', 'ice', 'carbon'] as const) {
          const cap = newResources[r].max;
          if (cap.lte(0)) continue;
          const cur = getBuf(buffers, baseKey, r);
          if (cur.lte(0)) continue;
          const ratio = cur.div(cap).toNumber();
          if (!Number.isFinite(ratio)) continue;
          if (ratio >= autoSortStartRatio) {
            const target = cap.mul(D(autoSortTargetRatio));
            if (cur.gt(target)) {
              buffers = setBuf(buffers, baseKey, r, target);
            }
          }
        }

        // Re-sync after deletion.
        newResources = syncResourcesFromBase(newResources, buffers);
      }

      // Market update
      let nextMarket = state.market;
      if (now >= state.market.nextUpdateAt) {
        const event = rollEvent();
        const prices = updateMarketPrices(state.market.prices, event);
        const history = pushMarketHistory(state.market.history, prices, now);
        nextMarket = {
          ...state.market,
          prices,
          event,
          nextUpdateAt: now + MARKET_UPDATE_SECONDS * 1000,
          history,
        };
      }

      // Smart-Broker: auto-sell surplus (only if rent was paid)
      if (demonsPaid.smart_broker) {
        // Проверяем что энергия не переполнена (оставляем место для прибыли)
        const energyCap = newResources.energy.max;
        const energyHave = getBuf(buffers, baseKey, 'energy');
        const energyThreshold = energyCap.mul(D('0.85')); // Не продаем если энергия >85%
        
        if (energyHave.lt(energyThreshold)) {
          const threshold = D('0.90');
          for (const t of TRADEABLE) {
            const cap = newResources[t].max;
            const have = getBuf(buffers, baseKey, t);
            const limit = cap.mul(threshold);
            if (have.lte(limit)) continue;

            const excess = have.sub(limit);
            const sellAmt = excess.min(D(12).mul(dt));
            if (sellAmt.lte(0)) continue;

            const price = nextMarket.prices[t];
            const earned = price.mul(sellAmt).mul(D(tradeMult));

            // Проверяем что заработанная энергия поместится
            const curE = getBuf(buffers, baseKey, 'energy');
            const futureE = curE.add(earned);
            if (futureE.gt(energyCap)) {
              // Продаем только столько, сколько поместится
              const room = energyCap.sub(curE).max(D(0));
              if (room.lte(0)) break; // Нет места - прекращаем продажу
              const affordableSell = room.div(price.mul(D(tradeMult))).max(D(0));
              const actualSell = sellAmt.min(affordableSell);
              if (actualSell.lte(0)) continue;
              
              const actualEarned = price.mul(actualSell).mul(D(tradeMult));
              buffers = setBuf(buffers, baseKey, t, have.sub(actualSell).max(D(0)));
              buffers = setBuf(buffers, baseKey, 'energy', curE.add(actualEarned));
            } else {
              buffers = setBuf(buffers, baseKey, t, have.sub(sellAmt).max(D(0)));
              buffers = setBuf(buffers, baseKey, 'energy', curE.add(earned));
            }
          }
        }

        buffers = clampBaseBufferToCaps(buffers, newResources);
        newResources = syncResourcesFromBase(newResources, buffers);
      }

      // Demons: tick telemetry
      let nextDemons: DemonsState = { ...state.demons, rentPaid: demonsPaid };

      // Oracle: ROI hint (only if rent was paid)
      if (demonsPaid.oracle) {
        let bestId: string | null = null;
        let bestRoi = Number.POSITIVE_INFINITY;

        for (const b of state.buildings) {
          const cost = calculateCost(b);
          let costEnergyEq = 0;
          for (const [res, amt] of Object.entries(cost)) {
            if (res === 'energy') {
              costEnergyEq += Number(D(amt).toString());
              continue;
            }
            // Проверяем что ресурс торгуемый
            if (!TRADEABLE.includes(res as TradeResourceType)) continue;
            const r = res as TradeResourceType;
            const price = nextMarket.prices[r];
            if (!price) continue;
            costEnergyEq += Number(price.mul(D(amt)).toString());
          }

          let valuePerSec = 0;
          for (const [res, perSec] of Object.entries(b.production ?? {})) {
            const r = res as ResourceType;
            if (r === 'energy') {
              valuePerSec += Number(D(perSec).toString());
            } else if (TRADEABLE.includes(r as TradeResourceType)) {
              const price = nextMarket.prices[r as TradeResourceType];
              if (price) valuePerSec += Number(price.mul(D(perSec)).toString());
            }
          }
          for (const [res, perSec] of Object.entries(b.consumption ?? {})) {
            const r = res as ResourceType;
            if (r === 'energy') {
              valuePerSec -= Number(D(perSec).toString());
            } else if (TRADEABLE.includes(r as TradeResourceType)) {
              const price = nextMarket.prices[r as TradeResourceType];
              if (price) valuePerSec -= Number(price.mul(D(perSec)).toString());
            }
          }

          if (!(valuePerSec > 0) || !(costEnergyEq > 0)) continue;
          const roi = costEnergyEq / valuePerSec;
          if (roi < bestRoi) {
            bestRoi = roi;
            bestId = b.id;
          }
        }

        nextDemons = {
          ...nextDemons,
          oracleRecommendationId: bestId,
          oracleRecommendationRoiSeconds: Number.isFinite(bestRoi) ? bestRoi : null,
        };
      } else if (state.demons.oracleRecommendationId || state.demons.oracleRecommendationRoiSeconds) {
        nextDemons = { ...nextDemons, oracleRecommendationId: null, oracleRecommendationRoiSeconds: null };
      }

      // Combat update (Phase 3)
      let nextCombat: CombatState = state.combat;
      if (state.combat.baseHp.gt(0)) {
        let baseHp = state.combat.baseHp;
        let enemies = state.combat.enemies.map((e) => ({ ...e }));
        let nextWaveAt = state.combat.nextWaveAt;
        let waveEndsAt = state.combat.waveEndsAt;
        let nextSpawnAt = state.combat.nextSpawnAt;

        let defenseEnergyNeedPerSecond = D(0);
        let defenseEnergyUsedPerSecond = D(0);
        let defenseFireRatio = D(0);
        let baseDamageTaken = D(0);

        const shieldBuilding = state.buildings.find((b) => b.id === 'shield_mk1');
        const shieldCount = shieldBuilding?.count ?? 0;
        const shieldDef = shieldBuilding?.defense;

        const shieldMaxHp = shieldDef ? shieldDef.shieldMaxHp.mul(shieldCount) : D(0);
        let shieldHp = state.combat.shieldHp.min(shieldMaxHp).max(D(0));
        let shieldAbsorbed = D(0);
        let shieldEnergyNeedPerSecond = D(0);
        let shieldEnergyUsedPerSecond = D(0);
        let shieldRegenPerSecond = D(0);

        let enemyPressurePerSecond = D(0);
        let enemyPressurePotentialPerSecond = D(0);

        // Start a new wave
        if (now >= nextWaveAt && enemies.length === 0) {
          waveEndsAt = now + WAVE_DURATION_SECONDS * 1000;
          nextSpawnAt = now;
          nextWaveAt = now + WAVE_INTERVAL_SECONDS * 1000;
        }

        const waveActive = waveEndsAt > now;

        // Shield regen (only during active wave to create an energy conflict)
        if (waveActive && shieldCount > 0 && shieldDef && shieldMaxHp.gt(0) && shieldHp.lt(shieldMaxHp) && dt > 0) {
          shieldEnergyNeedPerSecond = shieldDef.energyPerSecond.mul(shieldCount);
          const energyNeed = shieldEnergyNeedPerSecond.mul(dt);
          let ratio = D(1);
          if (energyNeed.gt(0)) {
            const available = getBuf(buffers, baseKey, 'energy');
            if (available.lte(0)) {
              ratio = D(0);
            } else {
              ratio = available.div(energyNeed).min(D(1)).max(D(0));
            }
          }

          if (ratio.gt(0)) {
            const energyConsumed = energyNeed.mul(ratio);
            const cur = getBuf(buffers, baseKey, 'energy');
            buffers = setBuf(buffers, baseKey, 'energy', cur.sub(energyConsumed));
            newResources.energy.amount = getBuf(buffers, baseKey, 'energy').min(newResources.energy.max);

            const regen = shieldDef.shieldRegenPerSecond.mul(combatMult).mul(shieldCount).mul(dt).mul(ratio);
            shieldHp = shieldHp.add(regen).min(shieldMaxHp);

            shieldEnergyUsedPerSecond = shieldEnergyNeedPerSecond.mul(ratio);
            shieldRegenPerSecond = dt > 0 ? regen.div(dt) : D(0);
          }
        }

        // Nano-swarm repair (works whenever shield exists; no energy cost)
        if (shieldMaxHp.gt(0) && shieldHp.lt(shieldMaxHp) && dt > 0) {
          const perSec = computeNanoRepairHpPerSecond(
            state.nanoSwarm.total,
            state.nanoSwarm.allocation.repair ?? 0,
            combatMult,
          );
          const regen = perSec.mul(dt);
          if (regen.gt(0)) {
            shieldHp = shieldHp.add(regen).min(shieldMaxHp);
            shieldRegenPerSecond = shieldRegenPerSecond.add(perSec);
          }
        }

        // Spawn enemies during active wave
        if (waveEndsAt > now) {
          while (now >= nextSpawnAt && enemies.length < 40) {
            enemies.push(createEnemy());
            nextSpawnAt += SPAWN_INTERVAL_SECONDS * 1000;
            if (nextSpawnAt > waveEndsAt) break;
          }
        }

        // Move enemies towards base; impact deals damage
        if (enemies.length > 0) {
          const moved: Enemy[] = [];
          for (const enemy of enemies) {
            const distance = enemy.distance - enemy.speed * dt;
            if (distance <= 0) {
              let dmg = ENEMY_IMPACT_DAMAGE;
              if (shieldHp.gt(0)) {
                const absorbed = shieldHp.min(dmg);
                shieldHp = shieldHp.sub(absorbed).max(D(0));
                shieldAbsorbed = shieldAbsorbed.add(absorbed);
                dmg = dmg.sub(absorbed);
              }
              if (dmg.gt(0)) {
                baseHp = baseHp.sub(dmg).max(D(0));
                baseDamageTaken = baseDamageTaken.add(dmg);
              }
              continue;
            }
            moved.push({ ...enemy, distance });
          }
          enemies = moved;
        }

        // Turrets fire if enemies exist (energy is only consumed while firing)
        const turret = state.buildings.find((b) => b.id === 'turret_mk1');
        const turretCount = turret?.count ?? 0;
        const turretCombat = turret?.combat;

        if (turretCount > 0 && turretCombat && enemies.length > 0 && baseHp.gt(0)) {
          defenseEnergyNeedPerSecond = turretCombat.energyPerSecond.mul(turretCount);
          const energyNeed = turretCombat.energyPerSecond.mul(turretCount).mul(dt);
          let ratio = D(1);
          if (energyNeed.gt(0)) {
            const available = getBuf(buffers, baseKey, 'energy');
            if (available.lte(0)) {
              ratio = D(0);
            } else {
              ratio = available.div(energyNeed).min(D(1)).max(D(0));
            }
          }

          defenseFireRatio = ratio;
          defenseEnergyUsedPerSecond = defenseEnergyNeedPerSecond.mul(ratio);

          if (ratio.gt(0)) {
            const energyConsumed = energyNeed.mul(ratio);
            const cur = getBuf(buffers, baseKey, 'energy');
            buffers = setBuf(buffers, baseKey, 'energy', cur.sub(energyConsumed));
            newResources.energy.amount = getBuf(buffers, baseKey, 'energy').min(newResources.energy.max);

            let damage = turretCombat.dps.mul(combatMult).mul(turretCount).mul(dt).mul(ratio);
            const nextEnemies: Enemy[] = enemies.map((e) => ({ ...e }));

            while (damage.gt(0) && nextEnemies.length > 0) {
              const idx = smartTargeting ? pickMaxHpEnemyIndex(nextEnemies) : 0;
              if (idx < 0) break;
              const target = nextEnemies[idx];
              const remaining = target.hp.sub(damage);
              if (remaining.lte(0)) {
                damage = remaining.abs();
                nextEnemies.splice(idx, 1);
                continue;
              }
              nextEnemies[idx] = { ...target, hp: remaining };
              damage = D(0);
            }

            enemies = nextEnemies;
          }
        }

        // Nano-swarm attack (free DPS, scaled by combat multiplier)
        if (enemies.length > 0 && baseHp.gt(0) && dt > 0) {
          let damage = computeNanoAttackDpsPerSecond(
            state.nanoSwarm.total,
            state.nanoSwarm.allocation.attack ?? 0,
            combatMult,
          ).mul(dt);
          if (damage.gt(0)) {
            const nextEnemies: Enemy[] = enemies.map((e) => ({ ...e }));
            while (damage.gt(0) && nextEnemies.length > 0) {
              const idx = smartTargeting ? pickMaxHpEnemyIndex(nextEnemies) : 0;
              if (idx < 0) break;
              const target = nextEnemies[idx];
              const remaining = target.hp.sub(damage);
              if (remaining.lte(0)) {
                damage = remaining.abs();
                nextEnemies.splice(idx, 1);
                continue;
              }
              nextEnemies[idx] = { ...target, hp: remaining };
              damage = D(0);
            }
            enemies = nextEnemies;
          }
        }

        // Continuous enemy pressure (creates a real "holding" use-case for shields)
        if (enemies.length > 0 && baseHp.gt(0) && dt > 0) {
          let dmgTotal = D(0);
          for (const enemy of enemies) {
            const traits = ENEMY_TRAITS[enemy.type];
            const factor = enemyDamageFactor(enemy.distance, traits.contactRange);
            if (factor <= 0) continue;

            const raw = traits.dps.mul(dt).mul(D(factor));
            const pierce = raw.mul(D(traits.shieldPierce)).min(raw).max(D(0));
            const toShield = raw.sub(pierce).max(D(0));

            if (toShield.gt(0)) {
              dmgTotal = dmgTotal.add(toShield);
            }
            if (pierce.gt(0)) {
              baseHp = baseHp.sub(pierce).max(D(0));
              baseDamageTaken = baseDamageTaken.add(pierce);
            }
          }

          if (dmgTotal.gt(0)) {
            let dmg = dmgTotal;
            if (shieldHp.gt(0)) {
              const absorbed = shieldHp.min(dmg);
              shieldHp = shieldHp.sub(absorbed).max(D(0));
              shieldAbsorbed = shieldAbsorbed.add(absorbed);
              dmg = dmg.sub(absorbed);
            }
            if (dmg.gt(0)) {
              baseHp = baseHp.sub(dmg).max(D(0));
              baseDamageTaken = baseDamageTaken.add(dmg);
            }
          }
        }

        // Pressure telemetry (computed after turrets so it matches current alive enemies)
        if (enemies.length > 0) {
          for (const enemy of enemies) {
            const traits = ENEMY_TRAITS[enemy.type];
            const f = enemyDamageFactor(enemy.distance, traits.contactRange);
            if (f > 0) {
              enemyPressurePerSecond = enemyPressurePerSecond.add(traits.dps.mul(D(f)));
            }
            enemyPressurePotentialPerSecond = enemyPressurePotentialPerSecond.add(traits.dps);
          }
        }

        nextCombat = {
          ...state.combat,
          baseHp,
          shieldMaxHp,
          shieldHp,
          enemies,
          nextWaveAt,
          waveEndsAt,
          nextSpawnAt,
          defenseEnergyNeedPerSecond,
          defenseEnergyUsedPerSecond,
          defenseFireRatio,
          baseDamageTakenPerSecond: dt > 0 ? baseDamageTaken.div(dt) : D(0),

          shieldEnergyNeedPerSecond,
          shieldEnergyUsedPerSecond,
          shieldRegenPerSecond,
          shieldAbsorbedPerSecond: dt > 0 ? shieldAbsorbed.div(dt) : D(0),

          enemyPressurePerSecond,
          enemyPressurePotentialPerSecond,
        };
      }

      // Expeditions completion
      let nextExpedition = state.expedition;
      if (state.expedition.active && now >= state.expedition.endsAt && state.expedition.reward) {
        const parts: string[] = [];
        for (const [k, v] of Object.entries(state.expedition.reward)) {
          const r = k as TradeResourceType;
          const amt = D(v);
          if (amt.lte(0)) continue;
          const cur = getBuf(buffers, baseKey, r);
          buffers = setBuf(buffers, baseKey, r, cur.add(amt));
          parts.push(`${r}: +${amt.toString()}`);
        }

        const bp = 1
          + (state.expedition.anomaly ? 1 : 0)
          + (state.expedition.reward.steel ? 1 : 0)
          + (Math.random() < 0.25 ? 1 : 0);
        if (bp > 0) {
          blueprints = blueprints.add(D(bp));
          parts.push(`чертежи: +${bp}`);
        }

        nextExpedition = {
          ...state.expedition,
          active: false,
          endsAt: 0,
          reward: null,
          anomaly: false,
          lastReport: parts.length > 0
            ? `Экспедиция завершена${state.expedition.anomaly ? ' · Аномалия' : ''} · Добыча: ${parts.join(', ')}`
            : 'Экспедиция завершена · Добыча: нет',
        };
      }

      // Clamp after expedition rewards
      buffers = clampBaseBufferToCaps(buffers, newResources);

      // Sync global resources again (combat may have changed base buffers)
      newResources = syncResourcesFromBase(newResources, buffers);

      // Production display = change in base buffer per second (approx, includes combat drain)
      if (dt > 0) {
        for (const r of Object.keys(newResources) as ResourceType[]) {
          const after = getBuf(buffers, baseKey, r);
          const delta = after.sub(baseBefore[r]);
          // Важно: создаем новый объект чтобы Zustand заметил изменение
          newResources[r] = { ...newResources[r], production: delta.div(dt) };
        }
      }

      return {
        resources: newResources,
        market: nextMarket,
        combat: nextCombat,
        grid: { 
          ...state.grid, 
          buffers, 
          activeTransports: activeTransports.map(t => ({
            ...t,
            amount: t.amount.toString(),
          })),
          lastDtSeconds: dt 
        },
        demons: nextDemons,
        meta: { ...state.meta, lifetimeEnergyProduced, blueprints },
        expedition: nextExpedition,
        nanoSwarm: state.nanoSwarm,
        productionMatrix: state.productionMatrix,
        quantumNet: state.quantumNet,
        lastTick: now,
      };
    });
  },

  saveGame: async () => {
    const state = get();
    const save = {
      resources: Object.fromEntries(Object.entries(state.resources).map(([k, v]) => [k, { amount: v.amount.toString(), max: v.max.toString() }])),
      buildings: state.buildings.map(b => ({ id: b.id, count: b.count })),
      market: {
        prices: Object.fromEntries(Object.entries(state.market.prices).map(([k, v]) => [k, v.toString()])),
        event: state.market.event,
        nextUpdateAt: state.market.nextUpdateAt,
        history: state.market.history,
      },
      combat: {
        baseHp: state.combat.baseHp.toString(),
        baseMaxHp: state.combat.baseMaxHp.toString(),
        shieldHp: state.combat.shieldHp.toString(),
        shieldMaxHp: state.combat.shieldMaxHp.toString(),
        nextWaveAt: state.combat.nextWaveAt,
        waveEndsAt: state.combat.waveEndsAt,
        nextSpawnAt: state.combat.nextSpawnAt,
        enemies: state.combat.enemies.map((e) => ({
          id: e.id,
          type: e.type,
          hp: e.hp.toString(),
          maxHp: e.maxHp.toString(),
          distance: e.distance,
          speed: e.speed,
        })),
      },
      research: state.research,
      demons: {
        active: state.demons.active,
      },
      meta: {
        qubits: state.meta.qubits.toString(),
        lifetimeEnergyProduced: state.meta.lifetimeEnergyProduced.toString(),
        blueprints: state.meta.blueprints.toString(),
      },
      expedition: state.expedition,
      nanoSwarm: state.nanoSwarm,
      ship: state.ship,
      starChart: state.starChart,
      aegis: state.aegis,
      productionMatrix: state.productionMatrix,
      quantumNet: state.quantumNet,
      grid: state.grid,
      lastTick: state.lastTick,
    };

    try {
      await fetch('/api/save', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(save),
      });
    } catch (e) {
      console.warn('Save failed', e);
    }
  },

  loadGame: async () => {
    let save: any;
    try {
      const res = await fetch('/api/save');
      if (!res.ok) return;
      const payload = await res.json();
      if (!payload?.ok) return;
      save = payload.data;
    } catch (e) {
      console.warn('Load failed', e);
      return;
    }

    try {
      set((state) => {
        const loadedResearch: ResearchState = save.research && save.research.levels
          ? {
              levels: {
                ...INITIAL_RESEARCH.levels,
                ...save.research.levels,
              },
            }
          : state.research;

        const loadedDemons: DemonsState = save.demons && save.demons.active
          ? {
              ...state.demons,
              active: {
                ...state.demons.active,
                ...save.demons.active,
              },
              rentPaid: {
                smart_broker: false,
                overclocker: false,
                oracle: false,
              },
              oracleRecommendationId: null,
              oracleRecommendationRoiSeconds: null,
            }
          : state.demons;

        const loadedMeta: MetaState = save.meta
          ? {
              qubits: D(save.meta.qubits ?? 0).max(D(0)),
              lifetimeEnergyProduced: D(save.meta.lifetimeEnergyProduced ?? 0).max(D(0)),
              blueprints: D(save.meta.blueprints ?? 0).max(D(0)),
            }
          : state.meta;

        const loadedProductionMatrix: ProductionMatrixState = save.productionMatrix && typeof save.productionMatrix === 'object'
          ? {
              levels: {
                cold_fusion: typeof save.productionMatrix.levels?.cold_fusion === 'number'
                  ? Math.max(0, save.productionMatrix.levels.cold_fusion)
                  : state.productionMatrix.levels.cold_fusion,
                molecular_stability: typeof save.productionMatrix.levels?.molecular_stability === 'number'
                  ? Math.max(0, save.productionMatrix.levels.molecular_stability)
                  : state.productionMatrix.levels.molecular_stability,
                auto_sort: typeof save.productionMatrix.levels?.auto_sort === 'number'
                  ? Math.max(0, save.productionMatrix.levels.auto_sort)
                  : state.productionMatrix.levels.auto_sort,
              },
            }
          : state.productionMatrix;

        const loadedQuantumNet: QuantumNetState = save.quantumNet && typeof save.quantumNet === 'object'
          ? {
              levels: {
                chrono_shift: typeof save.quantumNet.levels?.chrono_shift === 'number'
                  ? Math.max(0, save.quantumNet.levels.chrono_shift)
                  : state.quantumNet.levels.chrono_shift,
                memory_preservation: typeof save.quantumNet.levels?.memory_preservation === 'number'
                  ? Math.max(0, save.quantumNet.levels.memory_preservation)
                  : state.quantumNet.levels.memory_preservation,
              },
              preservedBuildingId: typeof save.quantumNet.preservedBuildingId === 'string' ? save.quantumNet.preservedBuildingId : null,
            }
          : state.quantumNet;

        const loadedExpedition: ExpeditionState = save.expedition && typeof save.expedition === 'object'
          ? {
              active: Boolean(save.expedition.active),
              kind: 'recon',
              endsAt: typeof save.expedition.endsAt === 'number' ? save.expedition.endsAt : 0,
              reward: save.expedition.reward && typeof save.expedition.reward === 'object' ? save.expedition.reward : null,
              lastReport: typeof save.expedition.lastReport === 'string' ? save.expedition.lastReport : null,
              anomaly: Boolean(save.expedition.anomaly),
            }
          : state.expedition;

        const loadedNanoSwarm: NanoSwarmState = save.nanoSwarm && typeof save.nanoSwarm === 'object'
          ? {
              total: typeof save.nanoSwarm.total === 'number' ? Math.max(0, save.nanoSwarm.total) : state.nanoSwarm.total,
              allocation: normalizeNanoAllocation({
                attack: typeof save.nanoSwarm.allocation?.attack === 'number' ? save.nanoSwarm.allocation.attack : state.nanoSwarm.allocation.attack,
                repair: typeof save.nanoSwarm.allocation?.repair === 'number' ? save.nanoSwarm.allocation.repair : state.nanoSwarm.allocation.repair,
                boost: typeof save.nanoSwarm.allocation?.boost === 'number' ? save.nanoSwarm.allocation.boost : state.nanoSwarm.allocation.boost,
              }),
            }
          : state.nanoSwarm;

        const loadedShip: ShipState = save.ship && typeof save.ship === 'object'
          ? {
              installed: {
                hull: (save.ship.installed?.hull as ShipModuleId) ?? state.ship.installed.hull,
                engine: (save.ship.installed?.engine as ShipModuleId) ?? state.ship.installed.engine,
                cargo: (save.ship.installed?.cargo as ShipModuleId) ?? state.ship.installed.cargo,
              },
              unlocked: {
                ...state.ship.unlocked,
                ...(save.ship.unlocked ?? {}),
              },
            }
          : state.ship;

        const loadedStarChart: StarChartState = save.starChart && typeof save.starChart === 'object'
          ? {
              levels: {
                subspace: typeof save.starChart.levels?.subspace === 'number' ? Math.max(0, save.starChart.levels.subspace) : state.starChart.levels.subspace,
                anomaly: typeof save.starChart.levels?.anomaly === 'number' ? Math.max(0, save.starChart.levels.anomaly) : state.starChart.levels.anomaly,
              },
            }
          : state.starChart;

        const loadedAegis: AegisState = save.aegis && typeof save.aegis === 'object'
          ? {
              levels: {
                smart_targeting: typeof save.aegis.levels?.smart_targeting === 'number' ? Math.max(0, save.aegis.levels.smart_targeting) : state.aegis.levels.smart_targeting,
                encryption: typeof save.aegis.levels?.encryption === 'number' ? Math.max(0, save.aegis.levels.encryption) : state.aegis.levels.encryption,
              },
            }
          : state.aegis;

        let newResources = { ...state.resources };
        for (const [k, v] of Object.entries(save.resources as Record<string, any>)) {
           if (newResources[k as ResourceType]) {
             newResources[k as ResourceType].amount = D(v.amount);
             newResources[k as ResourceType].max = D(v.max);
           }
        }

        let newBuildings = state.buildings.map(b => {
          const savedB = (save.buildings as any[]).find((sb: any) => sb.id === b.id);
          return savedB ? { ...b, count: savedB.count } : b;
        });

        let market = state.market;
        if (save.market && save.market.prices) {
          const loadedPrices: Record<TradeResourceType, Decimal> = { ...market.prices };
          for (const [k, v] of Object.entries(save.market.prices as Record<string, string>)) {
            if ((TRADEABLE as string[]).includes(k)) {
              loadedPrices[k as TradeResourceType] = D(v);
            }
          }

          const rawHistory = save.market.history as any;
          const loadedHistory: Record<TradeResourceType, Array<{ t: number; price: string }>> | undefined = rawHistory
            ? {
                ore: Array.isArray(rawHistory.ore)
                  ? rawHistory.ore
                      .map((p: any) => ({ t: Number(p?.t), price: String(p?.price) }))
                      .filter((p: any) => Number.isFinite(p.t) && typeof p.price === 'string')
                  : (market.history?.ore ?? []),
                ice: Array.isArray(rawHistory.ice)
                  ? rawHistory.ice
                      .map((p: any) => ({ t: Number(p?.t), price: String(p?.price) }))
                      .filter((p: any) => Number.isFinite(p.t) && typeof p.price === 'string')
                  : (market.history?.ice ?? []),
                carbon: Array.isArray(rawHistory.carbon)
                  ? rawHistory.carbon
                      .map((p: any) => ({ t: Number(p?.t), price: String(p?.price) }))
                      .filter((p: any) => Number.isFinite(p.t) && typeof p.price === 'string')
                  : (market.history?.carbon ?? []),
                steel: Array.isArray(rawHistory.steel)
                  ? rawHistory.steel
                      .map((p: any) => ({ t: Number(p?.t), price: String(p?.price) }))
                      .filter((p: any) => Number.isFinite(p.t) && typeof p.price === 'string')
                  : (market.history?.steel ?? []),
              }
            : undefined;

          market = {
            prices: loadedPrices,
            event: (save.market.event as MarketEvent) ?? market.event,
            nextUpdateAt: typeof save.market.nextUpdateAt === 'number' ? save.market.nextUpdateAt : market.nextUpdateAt,
            history: loadedHistory ?? market.history,
          };
        }

        let combat = state.combat;
        if (save.combat) {
          const loadedEnemies: Enemy[] = Array.isArray(save.combat.enemies)
            ? (save.combat.enemies as any[]).map((e: any) => ({
                id: typeof e.id === 'string' ? e.id : makeEnemyId(),
                type: (e.type === 'scout' || e.type === 'brute' || e.type === 'swarmer') ? e.type : 'scout',
                hp: D(e.hp ?? 1),
                maxHp: D(e.maxHp ?? e.hp ?? 1),
                distance: typeof e.distance === 'number' ? e.distance : 1,
                speed: typeof e.speed === 'number' ? e.speed : 0.08,
              }))
            : [];

          combat = {
            ...combat,
            baseHp: D(save.combat.baseHp ?? combat.baseHp.toString()).max(D(0)),
            baseMaxHp: D(save.combat.baseMaxHp ?? combat.baseMaxHp.toString()).max(D(1)),
            shieldHp: D(save.combat.shieldHp ?? combat.shieldHp.toString()).max(D(0)),
            shieldMaxHp: D(save.combat.shieldMaxHp ?? combat.shieldMaxHp.toString()).max(D(0)),
            nextWaveAt: typeof save.combat.nextWaveAt === 'number' ? save.combat.nextWaveAt : combat.nextWaveAt,
            waveEndsAt: typeof save.combat.waveEndsAt === 'number' ? save.combat.waveEndsAt : combat.waveEndsAt,
            nextSpawnAt: typeof save.combat.nextSpawnAt === 'number' ? save.combat.nextSpawnAt : combat.nextSpawnAt,
            enemies: loadedEnemies,
          };
        }

        const grid = save.grid && typeof save.grid === 'object'
          ? {
              ...state.grid,
              width: typeof save.grid.width === 'number' ? save.grid.width : state.grid.width,
              height: typeof save.grid.height === 'number' ? save.grid.height : state.grid.height,
              selected: save.grid.selected && typeof save.grid.selected.x === 'number' && typeof save.grid.selected.y === 'number'
                ? { x: save.grid.selected.x, y: save.grid.selected.y }
                : null,
              tiles: save.grid.tiles && typeof save.grid.tiles === 'object' ? save.grid.tiles : state.grid.tiles,
              deposits: save.grid.deposits && typeof save.grid.deposits === 'object' ? save.grid.deposits : state.grid.deposits,
              buffers: save.grid.buffers && typeof save.grid.buffers === 'object' ? save.grid.buffers : state.grid.buffers,
              activeTransports: [], // Reset transports on load
              lastDtSeconds: typeof save.grid.lastDtSeconds === 'number' ? save.grid.lastDtSeconds : 0,
              marketPolicy: save.grid.marketPolicy && typeof save.grid.marketPolicy === 'object'
                ? Object.fromEntries(
                    Object.entries(save.grid.marketPolicy as Record<string, any>)
                      .map(([tileKey, tileVal]) => {
                        if (!tileVal || typeof tileVal !== 'object') return [tileKey, null];
                        const next: Partial<Record<TradeResourceType, { import?: boolean; export?: boolean }>> = {};
                        for (const r of TRADEABLE) {
                          const v = (tileVal as any)[r];
                          if (!v || typeof v !== 'object') continue;
                          const imp = v.import === true;
                          const exp = v.export === true;
                          if (imp || exp) next[r] = { ...(imp ? { import: true } : {}), ...(exp ? { export: true } : {}) };
                        }
                        return [tileKey, Object.keys(next).length > 0 ? next : null];
                      })
                      .filter(([, v]) => Boolean(v)) as Array<[string, any]>
                  )
                : (state.grid.marketPolicy ?? {}),
              selectedBuildId: typeof save.grid.selectedBuildId === 'string' ? save.grid.selectedBuildId : null,
              cameraX: typeof save.grid.cameraX === 'number' ? save.grid.cameraX : state.grid.cameraX,
              cameraY: typeof save.grid.cameraY === 'number' ? save.grid.cameraY : state.grid.cameraY,
              cameraZoom: typeof save.grid.cameraZoom === 'number' ? save.grid.cameraZoom : state.grid.cameraZoom,
            }
          : state.grid;

        // Если есть размещение на сетке — считаем count от нее (источник истины)
        const tileCounts = new Map<string, number>();
        for (const v of Object.values(grid.tiles ?? {})) {
          if (typeof v === 'string') {
            tileCounts.set(v, (tileCounts.get(v) ?? 0) + 1);
          }
        }
        if (tileCounts.size > 0) {
          newBuildings = newBuildings.map((b) => ({ ...b, count: tileCounts.get(b.id) ?? 0 }));
        }

        const capsMult = computeCapsMultiplier(loadedResearch.levels, loadedMeta.qubits);
        newResources = recomputeCaps(newResources, newBuildings, capsMult);
        let nextBuffers = grid.buffers ?? state.grid.buffers;
        nextBuffers = clampBaseBufferToCaps(nextBuffers, newResources);
        newResources = syncResourcesFromBase(newResources, nextBuffers);

        const deposits: Record<string, DepositType> = grid.deposits && typeof grid.deposits === 'object'
          ? (grid.deposits as Record<string, DepositType>)
          : generateDeposits(grid.width, grid.height);

        // Apply sector expansion (never shrink existing saves).
        const desired = desiredGridSizeForResearch(loadedResearch.levels);
        const expanded = ensureGridSize({ ...grid, deposits, buffers: nextBuffers } as any, desired.width, desired.height) as any;
        const nextGrid = { ...expanded, buffers: nextBuffers };

        return {
          resources: newResources,
          buildings: newBuildings,
          market,
          combat,
          grid: nextGrid,
          research: loadedResearch,
          demons: loadedDemons,
          meta: loadedMeta,
          expedition: loadedExpedition,
          nanoSwarm: loadedNanoSwarm,
          ship: loadedShip,
          starChart: loadedStarChart,
          aegis: loadedAegis,
          productionMatrix: loadedProductionMatrix,
          quantumNet: loadedQuantumNet,
          lastTick: Date.now(),
        };
      });
    } catch (e) {
      console.error("Failed to load save", e);
    }
  },

  resetGame: () => {
    const now = Date.now();
    const capsMult = computeCapsMultiplier(INITIAL_RESEARCH.levels, INITIAL_META.qubits);
    let resources = recomputeCaps({ ...INITIAL_RESOURCES }, INITIAL_BUILDINGS, capsMult);
    let buffers = clampBaseBufferToCaps(DEFAULT_GRID.buffers, resources);
    resources = syncResourcesFromBase(resources, buffers);

    set({
      resources,
      buildings: INITIAL_BUILDINGS,
      market: { ...INITIAL_MARKET, nextUpdateAt: now + MARKET_UPDATE_SECONDS * 1000 },
      combat: {
        ...INITIAL_COMBAT,
        baseHp: BASE_MAX_HP,
        baseMaxHp: BASE_MAX_HP,
        enemies: [],
        nextWaveAt: now + WAVE_INTERVAL_SECONDS * 1000,
        waveEndsAt: 0,
        nextSpawnAt: 0,
      },
      grid: { ...DEFAULT_GRID, deposits: generateDeposits(DEFAULT_GRID.width, DEFAULT_GRID.height), buffers },
      research: INITIAL_RESEARCH,
      demons: INITIAL_DEMONS,
      meta: INITIAL_META,
      expedition: INITIAL_EXPEDITION,
      nanoSwarm: INITIAL_NANO_SWARM,
      ship: INITIAL_SHIP,
      starChart: INITIAL_STAR_CHART,
      aegis: INITIAL_AEGIS,
      productionMatrix: INITIAL_PRODUCTION_MATRIX,
      quantumNet: INITIAL_QUANTUM_NET,
      lastTick: now,
    });
  }
}));

export const calculateCost = (building: Building): Partial<Record<ResourceType, Decimal>> => {
  const cost: Record<string, Decimal> = {};
  for (const [res, amount] of Object.entries(building.baseCost)) {
    cost[res] = D(amount).mul(Math.pow(building.costFactor, building.count));
  }
  return cost as Partial<Record<ResourceType, Decimal>>;
};
