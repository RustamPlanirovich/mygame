/**
 * gameSave.ts — THE single owner of save serialization / deserialization.
 *
 * Why this module exists
 * ----------------------
 * The save payload used to be hand-written in four places (gameStore.saveGame,
 * gameStore.saveGameManual, gameStore.overwriteSave, syncHelpers.getGameSaveData) and
 * hand-read in two more (gameStore.loadGame, gameStore.loadGameFromSave). Every new
 * feature needed six coordinated edits, so in practice it got none: ten whole progression
 * slices (fleet, megastructures, endgame, prestige, ascension, repeatableResearch,
 * proceduralGalaxies, artifacts, retention, signalInterception) were never written at all.
 *
 * The other half of the bug class was asymmetry. break_eternity's
 * `Decimal.prototype.toJSON()` returns `this.toString()`, so JSON.stringify NEVER throws on
 * an un-encoded Decimal — it silently emits a string. A raw passthrough therefore produces
 * valid-looking JSON that degrades typed Decimals into strings, and the failure only shows
 * up much later as `x.sub is not a function`.
 *
 * The rules here, which must never be broken:
 *   1. Every Decimal is written with `encD` / read with `decD`. Never `.toString()` inline,
 *      never a bare spread of a Decimal-bearing object.
 *   2. Encoder and decoder for a slice live next to each other, so an asymmetry is visible
 *      in a single screenful.
 *   3. `deserializeGame` is TOTAL: every slice has a fallback to the corresponding INITIAL_*
 *      value. A missing, truncated or corrupt save can never write `undefined` into the store
 *      and can never throw.
 *   4. The payload contains no `undefined` and no Decimal instances — optional Decimals are
 *      encoded as `string | null`.
 *
 * Module-cycle contract
 * ---------------------
 * This module imports the INITIAL_* baselines from gameStore (which owns them) while
 * gameStore imports the codecs from here. That is a deliberate ES-module cycle. It is safe
 * because NOTHING in this module's top-level body dereferences a gameStore binding — the
 * baselines are only read inside function bodies, long after both modules have finished
 * evaluating. Do not introduce a module-level `const X = INITIAL_FOO` here.
 */

import type Decimal from 'break_eternity.js';
import { D } from '../core/math/format.ts';
import { normalizeNanoAllocation } from '../core/constants/nanoSwarm';
import { POLICIES } from '../core/constants/policies';
import type {
  AegisState,
  AscensionState,
  Artifact,
  ArtifactEffect,
  ArtifactState,
  AscensionRequirements,
  Building,
  Caravan,
  CaravanUpgrades,
  CombatState,
  Contract,
  CurrencyState,
  DemonId,
  DemonsState,
  DepositType,
  EndgameState,
  EndingId,
  Enemy,
  ExpeditionState,
  FleetState,
  GalaxiesState,
  GalaxyId,
  GameEnding,
  GameState,
  GridCoord,
  GridState,
  IntergalacticLogisticsState,
  MarketEvent,
  MarketState,
  MegastructureId,
  MegastructuresState,
  MetaState,
  NanoSwarmState,
  Notification,
  PlatformCombatState,
  PlatformEnemy,
  PlayerStats,
  PoliticsState,
  PollutionState,
  PrestigeState,
  PrestigeUpgradeId,
  ProceduralGalaxy,
  ProceduralGalaxyState,
  ProductionMatrixState,
  QuantumNetState,
  RandomEvent,
  RandomEventsState,
  RepeatableResearchId,
  RepeatableResearchState,
  ResearchState,
  ResourceState,
  ResourceType,
  RetentionState,
  Ship,
  ShipModuleId,
  ShipState,
  ShipType,
  SignalInterceptionState,
  SpacePlatform,
  StarChartState,
  TechnologyId,
  TradeResourceType,
  TradingOrder,
  UpgradeId,
} from '../core/gameTypes';
import type { CultureState } from '../core/gameTypes.culture';
import type { ActiveMapState } from '../core/gameTypes.maps';
import type { QuestState } from '../core/gameTypes.tutorial';
import type { TileBuildingSettings } from '../core/gameTypes.buildings';
import {
  BUILDINGS_WITH_PROXIMITY,
  DEFAULT_GRID,
  INITIAL_AEGIS,
  INITIAL_ARTIFACTS,
  INITIAL_ASCENSION,
  INITIAL_COMBAT,
  INITIAL_CULTURE,
  INITIAL_CURRENCY,
  INITIAL_DEMONS,
  INITIAL_EXPEDITION,
  INITIAL_FLEET,
  INITIAL_GALAXIES,
  INITIAL_INTERGALACTIC_LOGISTICS,
  INITIAL_MAPS,
  INITIAL_MARKET,
  INITIAL_POLITICS,
  INITIAL_POLLUTION,
  INITIAL_PRESTIGE,
  INITIAL_PROCEDURAL_GALAXIES,
  INITIAL_PRODUCTION_MATRIX,
  INITIAL_QUANTUM_NET,
  INITIAL_QUESTS,
  INITIAL_RANDOM_EVENTS,
  INITIAL_RESEARCH,
  INITIAL_RESOURCES,
  INITIAL_RETENTION,
  INITIAL_SHIP,
  INITIAL_SIGNAL_INTERCEPTION,
  INITIAL_STAR_CHART,
  TRADEABLE,
} from './gameStore';
import { INITIAL_NANO_SWARM } from '../core/constants/nanoSwarm';

// ============================================================================
// Version
// ============================================================================

/**
 * Current save schema version.
 *
 * v0 = "no `saveVersion` field" = every save written before this module existed.
 * v1 = first versioned schema: adds the ten previously-unpersisted slices, the
 *      per-tile settings layer, market contracts/orders, galaxy notifications and
 *      the energy telemetry; canonicalises the platform `shieldMaxHp` key.
 */
export const SAVE_VERSION = 1;

// ============================================================================
// SECTION 1 — primitive + Decimal codecs (symmetric by construction)
// ============================================================================

/** Serialized form of a required Decimal. */
type DecStr = string;
/** Serialized form of an optional Decimal (`null` === absent). */
type DecStrOpt = string | null;

type AnyRec = Record<string, any>;

const isRec = (v: unknown): v is AnyRec =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Coerce anything to a plain record so `.x` reads are always safe. */
const rec = (v: unknown): AnyRec => (isRec(v) ? v : {});

const num = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;

const int = (v: unknown, fallback: number): number => Math.trunc(num(v, fallback));

const nonNegInt = (v: unknown, fallback: number): number => Math.max(0, int(v, fallback));

const bool = (v: unknown, fallback: boolean): boolean =>
  typeof v === 'boolean' ? v : fallback;

const str = (v: unknown, fallback: string): string => (typeof v === 'string' ? v : fallback);

const strOrNull = (v: unknown): string | null => (typeof v === 'string' ? v : null);

/** Clamp a 0..1 fraction. */
const frac01 = (v: unknown, fallback: number): number => {
  const n = num(v, fallback);
  return n < 0 ? 0 : n > 1 ? 1 : n;
};

/**
 * ENCODE a required Decimal. Never emits `undefined`, `null` or `NaN`.
 * The inverse is `decD`.
 */
export const encD = (v: Decimal | number | string | null | undefined): DecStr => {
  if (v === null || v === undefined) return '0';
  try {
    const d = D(v as any);
    if (!d || d.isNan()) return '0';
    return d.toString();
  } catch {
    return '0';
  }
};

/**
 * ENCODE an optional Decimal. `null` means "the field was absent".
 * The inverse is `decDOpt`.
 */
export const encDOpt = (v: Decimal | number | string | null | undefined): DecStrOpt =>
  v === null || v === undefined ? null : encD(v);

/**
 * DECODE a required Decimal. Always returns a real Decimal instance; falls back for
 * null / undefined / '' / NaN / garbage.
 * The inverse is `encD`.
 */
export const decD = (v: unknown, fallback: Decimal | number | string = 0): Decimal => {
  if (v === null || v === undefined || v === '') return D(fallback as any);
  try {
    const d = D(v as any);
    if (!d || typeof d.isNan !== 'function' || d.isNan()) return D(fallback as any);
    return d;
  } catch {
    return D(fallback as any);
  }
};

/**
 * DECODE an optional Decimal: `undefined` iff the field was absent.
 * The inverse is `encDOpt`.
 */
export const decDOpt = (v: unknown): Decimal | undefined => {
  if (v === null || v === undefined || v === '') return undefined;
  const d = decD(v, NaN as unknown as number);
  return d.isNan() ? undefined : d;
};

/**
 * ENCODE a `Partial<Record<K, Decimal>>` map (resource costs, cargo, rewards, ...).
 * The inverse is `decRecord`.
 */
export const encRecord = <K extends string>(
  src: Partial<Record<K, Decimal>> | undefined | null,
): Record<string, DecStr> => {
  const out: Record<string, DecStr> = {};
  if (!isRec(src)) return out;
  for (const [k, v] of Object.entries(src)) {
    if (v === undefined || v === null) continue;
    out[k] = encD(v as Decimal);
  }
  return out;
};

/**
 * DECODE a `Partial<Record<K, Decimal>>` map.
 * The inverse is `encRecord`.
 */
export const decRecord = <K extends string>(raw: unknown): Partial<Record<K, Decimal>> => {
  const out: Partial<Record<K, Decimal>> = {};
  if (!isRec(raw)) return out;
  for (const [k, v] of Object.entries(raw)) {
    if (v === undefined || v === null) continue;
    out[k as K] = decD(v);
  }
  return out;
};

/** ENCODE a plain numeric map. The inverse is `decNumRecord`. */
export const encNumRecord = <K extends string>(
  src: Partial<Record<K, number>> | undefined | null,
): Record<string, number> => {
  const out: Record<string, number> = {};
  if (!isRec(src)) return out;
  for (const [k, v] of Object.entries(src)) {
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
  }
  return out;
};

/** DECODE a plain numeric map. The inverse is `encNumRecord`. */
export const decNumRecord = <K extends string>(raw: unknown): Partial<Record<K, number>> => {
  const out: Partial<Record<K, number>> = {};
  if (!isRec(raw)) return out;
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'number' && Number.isFinite(v)) out[k as K] = v;
  }
  return out;
};

/** ENCODE a boolean map. The inverse is `decBoolRecord`. */
export const encBoolRecord = <K extends string>(
  src: Partial<Record<K, boolean>> | undefined | null,
): Record<string, boolean> => {
  const out: Record<string, boolean> = {};
  if (!isRec(src)) return out;
  for (const [k, v] of Object.entries(src)) {
    if (typeof v === 'boolean') out[k] = v;
  }
  return out;
};

/** DECODE a boolean map. The inverse is `encBoolRecord`. */
export const decBoolRecord = <K extends string>(raw: unknown): Partial<Record<K, boolean>> => {
  const out: Partial<Record<K, boolean>> = {};
  if (!isRec(raw)) return out;
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'boolean') out[k as K] = v;
  }
  return out;
};

/** ENCODE an array element-wise. The inverse is `decArray`. */
export const encArray = <T, U>(src: readonly T[] | undefined | null, f: (item: T) => U): U[] =>
  Array.isArray(src) ? src.map(f) : [];

/** DECODE an array element-wise; a non-array becomes `[]`. The inverse is `encArray`. */
export const decArray = <U>(raw: unknown, f: (item: AnyRec) => U): U[] =>
  Array.isArray(raw) ? raw.map((item) => f(rec(item))) : [];

/**
 * Deep-copy data that is already JSON-safe (no Decimals anywhere), dropping anything
 * JSON cannot represent. Used for opaque blobs so that neither the payload nor the
 * decoded state ever aliases the other side.
 */
const cloneJson = <T>(value: T, fallback: T): T => {
  if (value === undefined || value === null) return fallback;
  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch {
    return fallback;
  }
};

/** Pick a value from a string-literal whitelist. */
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;

const makeId = (prefix: string): string =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

// ============================================================================
// SECTION 2 — per-slice codecs
// ============================================================================

// ---------------------------------------------------------------- resources --

interface SavedResource {
  amount: DecStr;
  max: DecStr;
  production: DecStr;
}

const encResources = (
  src: Record<ResourceType, ResourceState>,
): Record<string, SavedResource> => {
  const out: Record<string, SavedResource> = {};
  for (const [k, v] of Object.entries(rec(src))) {
    out[k] = {
      amount: encD(v?.amount),
      max: encD(v?.max),
      production: encD(v?.production),
    };
  }
  return out;
};

/**
 * Always returns a record containing EVERY ResourceType key (recomputeCaps and
 * syncResourcesFromBase iterate the key set, so a partial record would silently
 * drop resources).
 */
const decResources = (raw: unknown): Record<ResourceType, ResourceState> => {
  const out = {} as Record<ResourceType, ResourceState>;
  const saved = rec(raw);
  for (const key of Object.keys(INITIAL_RESOURCES) as ResourceType[]) {
    const base = (INITIAL_RESOURCES as Record<ResourceType, ResourceState>)[key];
    const s = saved[key];
    out[key] = isRec(s)
      ? {
          amount: decD(s.amount, 0).max(D(0)),
          max: decD(s.max, base.max),
          production: decD(s.production, 0),
        }
      : { amount: D(0), max: base.max, production: D(0) };
  }
  return out;
};

// ---------------------------------------------------------------- buildings --

interface SavedBuildingCount {
  id: string;
  count: number;
}

/**
 * The building catalog lives in code, so only per-building counts are persisted.
 * Per-tile level / evolution live in `grid.tileLevels` / `grid.tileEvolutionLevels`.
 */
const encBuildingCounts = (src: Building[]): SavedBuildingCount[] =>
  encArray(src, (b) => ({ id: String(b.id), count: nonNegInt(b.count, 0) }));

/** Rehydrates from the CATALOG (definitions win); unknown saved ids are dropped. */
const decBuildings = (raw: unknown): Building[] => {
  const counts = new Map<string, number>();
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      const e = rec(entry);
      if (typeof e.id === 'string') counts.set(e.id, nonNegInt(e.count, 0));
    }
  }
  return BUILDINGS_WITH_PROXIMITY.map((b) => ({ ...b, count: counts.get(b.id) ?? 0 }));
};

/**
 * Full symmetric Building codec — used for platform buildings, which (unlike the main
 * base) are not re-derived from the catalog and therefore must carry their Decimals.
 */
interface SavedBuilding {
  id: string;
  name: string;
  description: string;
  baseCost: Record<string, DecStr>;
  creditCost: DecStrOpt;
  costFactor: number;
  production: Record<string, DecStr>;
  consumption: Record<string, DecStr> | null;
  energyConsumption: DecStrOpt;
  productionMultipliers: Record<string, DecStr> | null;
  powerGridRadius: number | null;
  logisticsRadius: number | null;
  combat: { dps: DecStr; energyPerSecond: DecStr } | null;
  defense: {
    shieldMaxHp: DecStr;
    shieldRegenPerSecond: DecStr;
    energyPerSecond: DecStr;
  } | null;
  count: number;
  level: number | null;
  evolutionLevel: number | null;
  coord: { x: number; y: number } | null;
  proximityMultiplier: number | null;
}

const encBuilding = (b: Building): SavedBuilding => ({
  id: String(b.id),
  name: str(b.name, ''),
  description: str(b.description, ''),
  baseCost: encRecord<ResourceType>(b.baseCost),
  creditCost: encDOpt(b.creditCost),
  costFactor: num(b.costFactor, 1.15),
  production: encRecord<ResourceType>(b.production),
  consumption: b.consumption ? encRecord<ResourceType>(b.consumption) : null,
  energyConsumption: encDOpt(b.energyConsumption),
  productionMultipliers: b.productionMultipliers
    ? encRecord<ResourceType>(b.productionMultipliers)
    : null,
  powerGridRadius: typeof b.powerGridRadius === 'number' ? b.powerGridRadius : null,
  logisticsRadius: typeof b.logisticsRadius === 'number' ? b.logisticsRadius : null,
  combat: b.combat
    ? { dps: encD(b.combat.dps), energyPerSecond: encD(b.combat.energyPerSecond) }
    : null,
  defense: b.defense
    ? {
        shieldMaxHp: encD(b.defense.shieldMaxHp),
        shieldRegenPerSecond: encD(b.defense.shieldRegenPerSecond),
        energyPerSecond: encD(b.defense.energyPerSecond),
      }
    : null,
  count: nonNegInt(b.count, 0),
  level: typeof b.level === 'number' ? b.level : null,
  evolutionLevel: typeof b.evolutionLevel === 'number' ? b.evolutionLevel : null,
  coord: b.coord ? { x: num(b.coord.x, 0), y: num(b.coord.y, 0) } : null,
  proximityMultiplier:
    typeof b.proximityMultiplier === 'number' ? b.proximityMultiplier : null,
});

const decBuilding = (raw: AnyRec): Building => {
  const combat = rec(raw.combat);
  const defense = rec(raw.defense);
  const coord = rec(raw.coord);
  const out: Building = {
    id: str(raw.id, 'unknown'),
    name: str(raw.name, ''),
    description: str(raw.description, ''),
    baseCost: decRecord<ResourceType>(raw.baseCost),
    costFactor: num(raw.costFactor, 1.15),
    production: decRecord<ResourceType>(raw.production),
    count: nonNegInt(raw.count, 0),
  };
  const creditCost = decDOpt(raw.creditCost);
  if (creditCost) out.creditCost = creditCost;
  if (isRec(raw.consumption)) out.consumption = decRecord<ResourceType>(raw.consumption);
  const energyConsumption = decDOpt(raw.energyConsumption);
  if (energyConsumption) out.energyConsumption = energyConsumption;
  if (isRec(raw.productionMultipliers)) {
    out.productionMultipliers = decRecord<ResourceType>(raw.productionMultipliers);
  }
  if (typeof raw.powerGridRadius === 'number') out.powerGridRadius = raw.powerGridRadius;
  if (typeof raw.logisticsRadius === 'number') out.logisticsRadius = raw.logisticsRadius;
  if (isRec(raw.combat)) {
    out.combat = { dps: decD(combat.dps), energyPerSecond: decD(combat.energyPerSecond) };
  }
  if (isRec(raw.defense)) {
    out.defense = {
      shieldMaxHp: decD(defense.shieldMaxHp),
      shieldRegenPerSecond: decD(defense.shieldRegenPerSecond),
      energyPerSecond: decD(defense.energyPerSecond),
    };
  }
  if (typeof raw.level === 'number') out.level = raw.level;
  if (typeof raw.evolutionLevel === 'number') out.evolutionLevel = raw.evolutionLevel;
  if (isRec(raw.coord)) out.coord = { x: num(coord.x, 0), y: num(coord.y, 0) };
  if (typeof raw.proximityMultiplier === 'number') {
    out.proximityMultiplier = raw.proximityMultiplier;
  }
  return out;
};

// ----------------------------------------------------------------- currency --

interface SavedCurrency {
  credits: DecStr;
  researchPoints: DecStr;
  influence: DecStr;
}

const encCurrency = (src: CurrencyState): SavedCurrency => ({
  credits: encD(src.credits),
  researchPoints: encD(src.researchPoints),
  influence: encD(src.influence),
});

const decCurrency = (raw: unknown): CurrencyState => {
  const r = rec(raw);
  return {
    credits: decD(r.credits, INITIAL_CURRENCY.credits).max(D(0)),
    researchPoints: decD(r.researchPoints, 0).max(D(0)),
    influence: decD(r.influence, 0).max(D(0)),
  };
};

// --------------------------------------------------------------------- meta --

interface SavedMeta {
  qubits: DecStr;
  lifetimeEnergyProduced: DecStr;
  blueprints: DecStr;
}

const encMeta = (src: MetaState): SavedMeta => ({
  qubits: encD(src.qubits),
  lifetimeEnergyProduced: encD(src.lifetimeEnergyProduced),
  blueprints: encD(src.blueprints),
});

const decMeta = (raw: unknown): MetaState => {
  const r = rec(raw);
  return {
    qubits: decD(r.qubits, 0).max(D(0)),
    lifetimeEnergyProduced: decD(r.lifetimeEnergyProduced, 0).max(D(0)),
    blueprints: decD(r.blueprints, 0).max(D(0)),
  };
};

// ------------------------------------------------------------------- market --

interface SavedContract {
  id: string;
  title: string;
  description: string;
  requirements: Record<string, DecStr>;
  rewards: { credits: DecStrOpt; researchPoints: DecStrOpt; influence: DecStrOpt };
  speedBonus: { credits: DecStrOpt; researchPoints: DecStrOpt; influence: DecStrOpt } | null;
  expiresAt: number;
  acceptedAt: number;
  tier: Contract['tier'];
}

const CONTRACT_TIERS = ['easy', 'medium', 'hard', 'epic'] as const;

const encContract = (c: Contract): SavedContract => ({
  id: str(c.id, makeId('contract')),
  title: str(c.title, ''),
  description: str(c.description, ''),
  requirements: encRecord<ResourceType>(c.requirements),
  rewards: {
    credits: encDOpt(c.rewards?.credits),
    researchPoints: encDOpt(c.rewards?.researchPoints),
    influence: encDOpt(c.rewards?.influence),
  },
  speedBonus: c.speedBonus
    ? {
        credits: encDOpt(c.speedBonus.credits),
        researchPoints: encDOpt(c.speedBonus.researchPoints),
        influence: encDOpt(c.speedBonus.influence),
      }
    : null,
  expiresAt: num(c.expiresAt, 0),
  acceptedAt: num(c.acceptedAt, 0),
  tier: oneOf(c.tier, CONTRACT_TIERS, 'easy'),
});

const decContract = (raw: AnyRec): Contract => {
  const rewards = rec(raw.rewards);
  const out: Contract = {
    id: str(raw.id, makeId('contract')),
    title: str(raw.title, ''),
    description: str(raw.description, ''),
    requirements: decRecord<ResourceType>(raw.requirements),
    rewards: {},
    expiresAt: num(raw.expiresAt, 0),
    acceptedAt: num(raw.acceptedAt, 0),
    tier: oneOf(raw.tier, CONTRACT_TIERS, 'easy'),
  };
  const rc = decDOpt(rewards.credits);
  const rr = decDOpt(rewards.researchPoints);
  const ri = decDOpt(rewards.influence);
  if (rc) out.rewards.credits = rc;
  if (rr) out.rewards.researchPoints = rr;
  if (ri) out.rewards.influence = ri;
  if (isRec(raw.speedBonus)) {
    const sb = rec(raw.speedBonus);
    const bonus: NonNullable<Contract['speedBonus']> = {};
    const bc = decDOpt(sb.credits);
    const br = decDOpt(sb.researchPoints);
    const bi = decDOpt(sb.influence);
    if (bc) bonus.credits = bc;
    if (br) bonus.researchPoints = br;
    if (bi) bonus.influence = bi;
    out.speedBonus = bonus;
  }
  return out;
};

interface SavedTradingOrder {
  id: string;
  resource: string;
  type: 'buy' | 'sell';
  targetPrice: DecStr;
  amount: DecStr;
  collateral: DecStr;
  placedAt: number;
  expiresAt: number;
}

const encTradingOrder = (o: TradingOrder): SavedTradingOrder => ({
  id: str(o.id, makeId('order')),
  resource: String(o.resource),
  type: o.type === 'sell' ? 'sell' : 'buy',
  targetPrice: encD(o.targetPrice),
  amount: encD(o.amount),
  collateral: encD(o.collateral),
  placedAt: num(o.placedAt, 0),
  expiresAt: num(o.expiresAt, 0),
});

const decTradingOrder = (raw: AnyRec): TradingOrder => ({
  id: str(raw.id, makeId('order')),
  resource: str(raw.resource, 'ore') as TradeResourceType,
  type: raw.type === 'sell' ? 'sell' : 'buy',
  targetPrice: decD(raw.targetPrice, 0),
  amount: decD(raw.amount, 0),
  collateral: decD(raw.collateral, 0),
  placedAt: num(raw.placedAt, 0),
  expiresAt: num(raw.expiresAt, 0),
});

type SavedPricePoint = { t: number; price: DecStr };

interface SavedMarket {
  prices: Record<string, DecStr>;
  event: MarketEvent;
  nextUpdateAt: number;
  history: Record<string, SavedPricePoint[]>;
  contracts: SavedContract[];
  orders: SavedTradingOrder[];
}

const encMarket = (src: MarketState): SavedMarket => {
  const history: Record<string, SavedPricePoint[]> = {};
  for (const [k, points] of Object.entries(rec(src.history))) {
    if (!Array.isArray(points)) continue;
    history[k] = points
      .filter((p) => isRec(p) && Number.isFinite(Number(p.t)))
      .map((p) => ({ t: Number(p.t), price: encD(p.price) }));
  }
  return {
    prices: encRecord<TradeResourceType>(src.prices),
    event: cloneJson(src.event, INITIAL_MARKET.event),
    nextUpdateAt: num(src.nextUpdateAt, 0),
    history,
    contracts: encArray(src.contracts, encContract),
    orders: encArray(src.orders, encTradingOrder),
  };
};

const decMarket = (raw: unknown): MarketState => {
  const r = rec(raw);

  // Prices: start from the live defaults so a tradeable added after the save was
  // written can never be `undefined` (updateMarketPrices iterates all of TRADEABLE).
  const prices = { ...INITIAL_MARKET.prices } as Record<TradeResourceType, Decimal>;
  for (const [k, v] of Object.entries(rec(r.prices))) {
    if ((TRADEABLE as readonly string[]).includes(k)) {
      prices[k as TradeResourceType] = decD(v, prices[k as TradeResourceType]);
    }
  }

  const history = {} as Record<TradeResourceType, Array<{ t: number; price: string }>>;
  const savedHistory = rec(r.history);
  for (const res of TRADEABLE) {
    const points = savedHistory[res];
    if (Array.isArray(points)) {
      history[res] = points
        .map((p) => ({ t: Number(rec(p).t), price: encD(rec(p).price) }))
        .filter((p) => Number.isFinite(p.t));
    } else {
      history[res] = cloneJson(INITIAL_MARKET.history?.[res], []) ?? [];
    }
  }

  return {
    prices,
    event: isRec(r.event)
      ? cloneJson(r.event as MarketEvent, INITIAL_MARKET.event)
      : cloneJson(INITIAL_MARKET.event, INITIAL_MARKET.event),
    nextUpdateAt: num(r.nextUpdateAt, INITIAL_MARKET.nextUpdateAt),
    history,
    contracts: decArray(r.contracts, decContract),
    orders: decArray(r.orders, decTradingOrder),
  };
};

// ------------------------------------------------------------------- combat --

const ENEMY_TYPES = ['scout', 'brute', 'swarmer'] as const;

interface SavedEnemy {
  id: string;
  type: Enemy['type'];
  hp: DecStr;
  maxHp: DecStr;
  distance: number;
  speed: number;
}

const encEnemy = (e: Enemy): SavedEnemy => ({
  id: str(e.id, makeId('enemy')),
  type: oneOf(e.type, ENEMY_TYPES, 'scout'),
  hp: encD(e.hp),
  maxHp: encD(e.maxHp),
  distance: num(e.distance, 1),
  speed: num(e.speed, 0.08),
});

const decEnemy = (raw: AnyRec): Enemy => ({
  id: str(raw.id, makeId('enemy')),
  type: oneOf(raw.type, ENEMY_TYPES, 'scout'),
  hp: decD(raw.hp, 1),
  maxHp: decD(raw.maxHp, decD(raw.hp, 1)).max(D(1)),
  distance: num(raw.distance, 1),
  speed: num(raw.speed, 0.08),
});

interface SavedCombat {
  baseMaxHp: DecStr;
  baseHp: DecStr;
  shieldMaxHp: DecStr;
  shieldHp: DecStr;
  enemies: SavedEnemy[];
  nextWaveAt: number;
  waveEndsAt: number;
  nextSpawnAt: number;
  lastDamageAt: number;
  baseRegenPerSecond: DecStr;
  defenseEnergyNeedPerSecond: DecStr;
  defenseEnergyUsedPerSecond: DecStr;
  defenseFireRatio: DecStr;
  baseDamageTakenPerSecond: DecStr;
  shieldEnergyNeedPerSecond: DecStr;
  shieldEnergyUsedPerSecond: DecStr;
  shieldRegenPerSecond: DecStr;
  shieldAbsorbedPerSecond: DecStr;
  enemyPressurePerSecond: DecStr;
  enemyPressurePotentialPerSecond: DecStr;
}

const encCombat = (src: CombatState): SavedCombat => ({
  baseMaxHp: encD(src.baseMaxHp),
  baseHp: encD(src.baseHp),
  shieldMaxHp: encD(src.shieldMaxHp),
  shieldHp: encD(src.shieldHp),
  enemies: encArray(src.enemies, encEnemy),
  nextWaveAt: num(src.nextWaveAt, 0),
  waveEndsAt: num(src.waveEndsAt, 0),
  nextSpawnAt: num(src.nextSpawnAt, 0),
  lastDamageAt: num(src.lastDamageAt, 0),
  baseRegenPerSecond: encD(src.baseRegenPerSecond),
  defenseEnergyNeedPerSecond: encD(src.defenseEnergyNeedPerSecond),
  defenseEnergyUsedPerSecond: encD(src.defenseEnergyUsedPerSecond),
  defenseFireRatio: encD(src.defenseFireRatio),
  baseDamageTakenPerSecond: encD(src.baseDamageTakenPerSecond),
  shieldEnergyNeedPerSecond: encD(src.shieldEnergyNeedPerSecond),
  shieldEnergyUsedPerSecond: encD(src.shieldEnergyUsedPerSecond),
  shieldRegenPerSecond: encD(src.shieldRegenPerSecond),
  shieldAbsorbedPerSecond: encD(src.shieldAbsorbedPerSecond),
  enemyPressurePerSecond: encD(src.enemyPressurePerSecond),
  enemyPressurePotentialPerSecond: encD(src.enemyPressurePotentialPerSecond),
});

const decCombat = (raw: unknown): CombatState => {
  const r = rec(raw);
  return {
    baseMaxHp: decD(r.baseMaxHp, INITIAL_COMBAT.baseMaxHp).max(D(1)),
    baseHp: decD(r.baseHp, INITIAL_COMBAT.baseHp).max(D(0)),
    shieldMaxHp: decD(r.shieldMaxHp, INITIAL_COMBAT.shieldMaxHp).max(D(0)),
    shieldHp: decD(r.shieldHp, INITIAL_COMBAT.shieldHp).max(D(0)),
    enemies: decArray(r.enemies, decEnemy),
    nextWaveAt: num(r.nextWaveAt, INITIAL_COMBAT.nextWaveAt),
    waveEndsAt: num(r.waveEndsAt, 0),
    nextSpawnAt: num(r.nextSpawnAt, 0),
    lastDamageAt: num(r.lastDamageAt, 0),
    baseRegenPerSecond: decD(r.baseRegenPerSecond, 0),
    defenseEnergyNeedPerSecond: decD(r.defenseEnergyNeedPerSecond, 0),
    defenseEnergyUsedPerSecond: decD(r.defenseEnergyUsedPerSecond, 0),
    defenseFireRatio: decD(r.defenseFireRatio, 0),
    baseDamageTakenPerSecond: decD(r.baseDamageTakenPerSecond, 0),
    shieldEnergyNeedPerSecond: decD(r.shieldEnergyNeedPerSecond, 0),
    shieldEnergyUsedPerSecond: decD(r.shieldEnergyUsedPerSecond, 0),
    shieldRegenPerSecond: decD(r.shieldRegenPerSecond, 0),
    shieldAbsorbedPerSecond: decD(r.shieldAbsorbedPerSecond, 0),
    enemyPressurePerSecond: decD(r.enemyPressurePerSecond, 0),
    enemyPressurePotentialPerSecond: decD(r.enemyPressurePotentialPerSecond, 0),
  };
};

// --------------------------------------------------------------------- grid --

/**
 * `grid` carries no live Decimal instances by design — buffers, transport amounts and
 * tileSettings all store stringified decimals in the type itself. That discipline is why
 * grid never suffered the string-vs-Decimal bug, and it is the model the rest of this
 * module copies. Everything here is therefore validated rather than converted.
 */
interface SavedGrid {
  width: number;
  height: number;
  selected: { x: number; y: number } | null;
  tiles: Record<string, string>;
  tileLevels: Record<string, number>;
  tileEvolutionLevels: Record<string, number>;
  tileDisabled: Record<string, boolean>;
  /*
   * Незавершённые постройки/улучшения (bigplan.md, пункты 18–19). Хранятся вместе с гридом,
   * иначе перезагрузка страницы съедала бы уже оплаченную стройку: клетка занята, ресурсы
   * списаны, а работы нет — здание навсегда осталось бы неработающим.
   */
  tileJobs: Record<string, SavedTileJob>;
  deposits: Record<string, string>;
  buffers: Record<string, Record<string, DecStr>>;
  activeTransports: Array<{
    from: { x: number; y: number };
    to: { x: number; y: number };
    resource: string;
    amount: DecStr;
  }>;
  lastDtSeconds: number;
  selectedBuildId: string | null;
  highlightedBuildingId: string | null;
  marketPolicy: Record<string, Record<string, { import?: boolean; export?: boolean }>>;
  tileSettings: Record<string, TileBuildingSettings>;
  cameraX: number | null;
  cameraY: number | null;
  cameraZoom: number | null;
}

/*
 * Работа на клетке в сейве. Время — абсолютное (startedAt + duration), поэтому загрузка сейва
 * автоматически достраивает всё, что успело завершиться за оффлайн: первый же тик увидит, что
 * now >= startedAt + duration. Никакой отдельной оффлайн-логики для стройки не требуется.
 */
interface SavedTileJob {
  kind: 'build' | 'upgrade';
  buildingId: string;
  startedAt: number;
  duration: number;
  targetLevel: number | null;
  paidCost: Record<string, DecStr>;
  paidCredits: DecStr | null;
}

const encTileJobs = (src: GridState['tileJobs']): Record<string, SavedTileJob> => {
  const out: Record<string, SavedTileJob> = {};
  for (const [tileKey, job] of Object.entries(rec(src))) {
    if (!isRec(job)) continue;
    const j = job as NonNullable<GridState['tileJobs']>[string];
    const paidCost: Record<string, DecStr> = {};
    for (const [res, val] of Object.entries(rec(j.paidCost))) {
      if (val === undefined || val === null) continue;
      paidCost[res] = encD(val as string);
    }
    out[tileKey] = {
      kind: j.kind === 'upgrade' ? 'upgrade' : 'build',
      buildingId: String(j.buildingId ?? ''),
      startedAt: num(j.startedAt, 0),
      duration: num(j.duration, 0),
      targetLevel: typeof j.targetLevel === 'number' ? j.targetLevel : null,
      paidCost,
      paidCredits: j.paidCredits ? encD(j.paidCredits) : null,
    };
  }
  return out;
};

const decTileJobs = (raw: unknown): NonNullable<GridState['tileJobs']> => {
  const out: NonNullable<GridState['tileJobs']> = {};
  for (const [tileKey, job] of Object.entries(rec(raw))) {
    if (!isRec(job)) continue;
    const j = job as AnyRec;
    const buildingId = str(j.buildingId, '');
    // Работа без здания или без длительности неприменима — молча выбрасываем, а не
    // оставляем клетку навсегда «в стройке».
    if (!buildingId) continue;
    const duration = num(j.duration, 0);
    if (duration <= 0) continue;

    const paidCost: Partial<Record<ResourceType, string>> = {};
    for (const [res, val] of Object.entries(rec(j.paidCost))) {
      if (val === undefined || val === null) continue;
      paidCost[res as ResourceType] = encD(val as string);
    }

    out[tileKey] = {
      kind: j.kind === 'upgrade' ? 'upgrade' : 'build',
      buildingId,
      startedAt: num(j.startedAt, 0),
      duration,
      ...(typeof j.targetLevel === 'number' ? { targetLevel: j.targetLevel } : {}),
      paidCost,
      ...(j.paidCredits ? { paidCredits: encD(j.paidCredits) } : {}),
    };
  }
  return out;
};

const encBuffers = (
  src: Record<string, Partial<Record<ResourceType, string>>> | undefined,
): Record<string, Record<string, DecStr>> => {
  const out: Record<string, Record<string, DecStr>> = {};
  for (const [tileKey, row] of Object.entries(rec(src))) {
    const nextRow: Record<string, DecStr> = {};
    for (const [res, val] of Object.entries(rec(row))) {
      if (val === undefined || val === null) continue;
      nextRow[res] = encD(val as string);
    }
    out[tileKey] = nextRow;
  }
  return out;
};

const decBuffers = (
  raw: unknown,
): Record<string, Partial<Record<ResourceType, string>>> => {
  const out: Record<string, Partial<Record<ResourceType, string>>> = {};
  for (const [tileKey, row] of Object.entries(rec(raw))) {
    if (!isRec(row)) continue;
    const nextRow: Partial<Record<ResourceType, string>> = {};
    for (const [res, val] of Object.entries(row)) {
      if (val === undefined || val === null) continue;
      nextRow[res as ResourceType] = encD(val as string);
    }
    out[tileKey] = nextRow;
  }
  return out;
};

const encMarketPolicy = (
  src: GridState['marketPolicy'],
): SavedGrid['marketPolicy'] => {
  const out: SavedGrid['marketPolicy'] = {};
  for (const [tileKey, tileVal] of Object.entries(rec(src))) {
    if (!isRec(tileVal)) continue;
    const next: Record<string, { import?: boolean; export?: boolean }> = {};
    for (const res of TRADEABLE) {
      const v = (tileVal as AnyRec)[res];
      if (!isRec(v)) continue;
      const imp = v.import === true;
      const exp = v.export === true;
      if (imp || exp) {
        next[res] = { ...(imp ? { import: true } : {}), ...(exp ? { export: true } : {}) };
      }
    }
    if (Object.keys(next).length > 0) out[tileKey] = next;
  }
  return out;
};

const decMarketPolicy = (raw: unknown): NonNullable<GridState['marketPolicy']> =>
  encMarketPolicy(raw as GridState['marketPolicy']) as NonNullable<GridState['marketPolicy']>;

const encGrid = (src: GridState): SavedGrid => ({
  width: nonNegInt(src.width, DEFAULT_GRID.width),
  height: nonNegInt(src.height, DEFAULT_GRID.height),
  selected: src.selected ? { x: num(src.selected.x, 0), y: num(src.selected.y, 0) } : null,
  tiles: cloneJson(src.tiles, {}),
  tileLevels: encNumRecord(src.tileLevels),
  tileEvolutionLevels: encNumRecord(src.tileEvolutionLevels),
  tileDisabled: encBoolRecord(src.tileDisabled),
  tileJobs: encTileJobs(src.tileJobs),
  deposits: cloneJson(src.deposits as Record<string, string>, {}),
  buffers: encBuffers(src.buffers),
  activeTransports: encArray(src.activeTransports, (t) => ({
    from: { x: num(t.from?.x, 0), y: num(t.from?.y, 0) },
    to: { x: num(t.to?.x, 0), y: num(t.to?.y, 0) },
    resource: String(t.resource),
    amount: encD(t.amount),
  })),
  lastDtSeconds: num(src.lastDtSeconds, 0),
  selectedBuildId: strOrNull(src.selectedBuildId),
  highlightedBuildingId: strOrNull(src.highlightedBuildingId),
  marketPolicy: encMarketPolicy(src.marketPolicy),
  tileSettings: cloneJson(src.tileSettings ?? {}, {}),
  cameraX: typeof src.cameraX === 'number' ? src.cameraX : null,
  cameraY: typeof src.cameraY === 'number' ? src.cameraY : null,
  cameraZoom: typeof src.cameraZoom === 'number' ? src.cameraZoom : null,
});

const decGrid = (raw: unknown, base: GridState): GridState => {
  const r = rec(raw);
  const selected = rec(r.selected);
  const out: GridState = {
    width: nonNegInt(r.width, base.width),
    height: nonNegInt(r.height, base.height),
    selected:
      isRec(r.selected) &&
      typeof selected.x === 'number' &&
      typeof selected.y === 'number'
        ? { x: selected.x, y: selected.y }
        : null,
    tiles: isRec(r.tiles) ? cloneJson(r.tiles as Record<string, string>, {}) : { ...base.tiles },
    tileLevels: decNumRecord<string>(r.tileLevels) as Record<string, number>,
    tileEvolutionLevels: decNumRecord<string>(r.tileEvolutionLevels) as Record<string, number>,
    tileDisabled: decBoolRecord<string>(r.tileDisabled) as Record<string, boolean>,
    tileJobs: decTileJobs(r.tileJobs),
    deposits: isRec(r.deposits)
      ? (cloneJson(r.deposits as Record<string, DepositType>, {}) as Record<string, DepositType>)
      : { ...(base.deposits ?? {}) },
    buffers: isRec(r.buffers) ? decBuffers(r.buffers) : decBuffers(base.buffers),
    activeTransports: decArray(r.activeTransports, (t) => ({
      from: { x: num(rec(t.from).x, 0), y: num(rec(t.from).y, 0) },
      to: { x: num(rec(t.to).x, 0), y: num(rec(t.to).y, 0) },
      resource: str(t.resource, 'ore') as ResourceType,
      amount: encD(t.amount),
    })),
    lastDtSeconds: num(r.lastDtSeconds, 0),
    selectedBuildId: strOrNull(r.selectedBuildId),
    highlightedBuildingId: strOrNull(r.highlightedBuildingId),
    marketPolicy: decMarketPolicy(r.marketPolicy),
    // Phase-5 per-building configuration: modes, priorities, auto-sell rules,
    // storage limits, conditions and stats. Previously present in the payload but
    // dropped by BOTH loaders, which silently reset every building to 'normal'.
    tileSettings: isRec(r.tileSettings)
      ? cloneJson(r.tileSettings as Record<string, TileBuildingSettings>, {})
      : {},
    cameraX: typeof r.cameraX === 'number' ? r.cameraX : base.cameraX,
    cameraY: typeof r.cameraY === 'number' ? r.cameraY : base.cameraY,
    cameraZoom: typeof r.cameraZoom === 'number' ? r.cameraZoom : base.cameraZoom,
  };
  return out;
};

// ----------------------------------------------------------------- research --

interface SavedResearch {
  levels: Record<string, number>;
  technologies: Record<string, boolean>;
}

const encResearch = (src: ResearchState): SavedResearch => ({
  levels: encNumRecord<UpgradeId>(src.levels),
  technologies: encBoolRecord<TechnologyId>(src.technologies),
});

const decResearch = (raw: unknown): ResearchState => {
  const r = rec(raw);
  return {
    levels: {
      ...INITIAL_RESEARCH.levels,
      ...(decNumRecord<UpgradeId>(r.levels) as Record<UpgradeId, number>),
    },
    technologies: {
      ...INITIAL_RESEARCH.technologies,
      ...(decBoolRecord<TechnologyId>(r.technologies) as Record<TechnologyId, boolean>),
    },
  };
};

// ------------------------------------------------------------------- demons --

interface SavedDemons {
  active: Record<string, boolean>;
  rentPaid: Record<string, boolean>;
  oracleRecommendationId: string | null;
  oracleRecommendationRoiSeconds: number | null;
  brokerExcludeFromAutoSell: Record<string, boolean>;
}

const encDemons = (src: DemonsState): SavedDemons => ({
  active: encBoolRecord<DemonId>(src.active),
  rentPaid: encBoolRecord<DemonId>(src.rentPaid),
  oracleRecommendationId: strOrNull(src.oracleRecommendationId),
  oracleRecommendationRoiSeconds:
    typeof src.oracleRecommendationRoiSeconds === 'number'
      ? src.oracleRecommendationRoiSeconds
      : null,
  brokerExcludeFromAutoSell: encBoolRecord<TradeResourceType>(src.brokerExcludeFromAutoSell),
});

const decDemons = (raw: unknown): DemonsState => {
  const r = rec(raw);
  return {
    active: { ...INITIAL_DEMONS.active, ...decBoolRecord<DemonId>(r.active) },
    rentPaid: { ...INITIAL_DEMONS.rentPaid, ...decBoolRecord<DemonId>(r.rentPaid) },
    oracleRecommendationId: strOrNull(r.oracleRecommendationId),
    oracleRecommendationRoiSeconds:
      typeof r.oracleRecommendationRoiSeconds === 'number'
        ? r.oracleRecommendationRoiSeconds
        : null,
    brokerExcludeFromAutoSell: decBoolRecord<TradeResourceType>(
      r.brokerExcludeFromAutoSell,
    ) as Record<TradeResourceType, boolean>,
  };
};

// ---------------------------------------------------------------- expedition --

interface SavedExpedition {
  active: boolean;
  kind: 'recon';
  endsAt: number;
  reward: Record<string, string> | null;
  lastReport: string | null;
  anomaly: boolean;
}

const encExpedition = (src: ExpeditionState): SavedExpedition => ({
  active: bool(src.active, false),
  kind: 'recon',
  endsAt: num(src.endsAt, 0),
  // `reward` is already a map of stringified decimals in the type itself.
  reward: src.reward ? cloneJson(src.reward as Record<string, string>, {}) : null,
  lastReport: strOrNull(src.lastReport),
  anomaly: bool(src.anomaly, false),
});

const decExpedition = (raw: unknown): ExpeditionState => {
  const r = rec(raw);
  return {
    active: bool(r.active, INITIAL_EXPEDITION.active),
    kind: 'recon',
    endsAt: num(r.endsAt, 0),
    reward: isRec(r.reward)
      ? (cloneJson(r.reward, {}) as Partial<Record<TradeResourceType, string>>)
      : null,
    lastReport: strOrNull(r.lastReport),
    anomaly: bool(r.anomaly, false),
  };
};

// ----------------------------------------------------------------- nanoSwarm --

interface SavedNanoSwarm {
  total: number;
  allocation: { attack: number; repair: number; boost: number };
}

const encNanoSwarm = (src: NanoSwarmState): SavedNanoSwarm => ({
  total: nonNegInt(src.total, 0),
  allocation: {
    attack: num(src.allocation?.attack, 0),
    repair: num(src.allocation?.repair, 0),
    boost: num(src.allocation?.boost, 0),
  },
});

const decNanoSwarm = (raw: unknown): NanoSwarmState => {
  const r = rec(raw);
  const a = rec(r.allocation);
  return {
    total: Math.max(0, num(r.total, INITIAL_NANO_SWARM.total)),
    allocation: normalizeNanoAllocation({
      attack: num(a.attack, INITIAL_NANO_SWARM.allocation.attack),
      repair: num(a.repair, INITIAL_NANO_SWARM.allocation.repair),
      boost: num(a.boost, INITIAL_NANO_SWARM.allocation.boost),
    }),
  };
};

// --------------------------------------------------------------------- ship --

interface SavedShip {
  installed: Record<string, string>;
  unlocked: Record<string, boolean>;
}

const encShip = (src: ShipState): SavedShip => ({
  installed: {
    hull: String(src.installed?.hull ?? INITIAL_SHIP.installed.hull),
    engine: String(src.installed?.engine ?? INITIAL_SHIP.installed.engine),
    cargo: String(src.installed?.cargo ?? INITIAL_SHIP.installed.cargo),
  },
  unlocked: encBoolRecord<ShipModuleId>(src.unlocked),
});

const decShip = (raw: unknown): ShipState => {
  const r = rec(raw);
  const installed = rec(r.installed);
  return {
    installed: {
      hull: str(installed.hull, INITIAL_SHIP.installed.hull) as ShipModuleId,
      engine: str(installed.engine, INITIAL_SHIP.installed.engine) as ShipModuleId,
      cargo: str(installed.cargo, INITIAL_SHIP.installed.cargo) as ShipModuleId,
    },
    // Merge over the defaults so a module id added after the save was written is
    // `false`, never `undefined`.
    unlocked: {
      ...INITIAL_SHIP.unlocked,
      ...decBoolRecord<ShipModuleId>(r.unlocked),
    },
  };
};

// ------------------------------------------- flat numeric-level upgrade trees --

const encLevels = <K extends string>(levels: Record<K, number>): Record<string, number> =>
  encNumRecord(levels);

const decLevels = <K extends string>(
  raw: unknown,
  defaults: Record<K, number>,
): Record<K, number> => {
  const parsed = decNumRecord<K>(rec(raw).levels);
  const out = { ...defaults };
  for (const key of Object.keys(defaults) as K[]) {
    const v = parsed[key];
    out[key] = typeof v === 'number' ? Math.max(0, v) : defaults[key];
  }
  return out;
};

const encStarChart = (src: StarChartState) => ({ levels: encLevels(src.levels) });
const decStarChart = (raw: unknown): StarChartState => ({
  levels: decLevels(raw, INITIAL_STAR_CHART.levels),
});

const encAegis = (src: AegisState) => ({ levels: encLevels(src.levels) });
const decAegis = (raw: unknown): AegisState => ({
  levels: decLevels(raw, INITIAL_AEGIS.levels),
});

const encProductionMatrix = (src: ProductionMatrixState) => ({ levels: encLevels(src.levels) });
const decProductionMatrix = (raw: unknown): ProductionMatrixState => ({
  levels: decLevels(raw, INITIAL_PRODUCTION_MATRIX.levels),
});

const encQuantumNet = (src: QuantumNetState) => ({
  levels: encLevels(src.levels),
  preservedBuildingId: strOrNull(src.preservedBuildingId),
});
const decQuantumNet = (raw: unknown): QuantumNetState => ({
  levels: decLevels(raw, INITIAL_QUANTUM_NET.levels),
  preservedBuildingId: strOrNull(rec(raw).preservedBuildingId),
});

// ----------------------------------------------------------------- politics --

const encPolitics = (src: PoliticsState) => ({
  activePolicies: encArray(src.activePolicies, (p) => String(p)),
  maxActivePolicies: int(src.maxActivePolicies, INITIAL_POLITICS.maxActivePolicies),
  lastActivated: encNumRecord(src.lastActivated),
});

const decPolitics = (raw: unknown): PoliticsState => {
  const r = rec(raw);
  return {
    /*
     * Отсеиваем политики, которых больше нет в каталоге. Четыре из них были удалены
     * (колонии, скорость постройки кораблей, ускорение открытия галактик) — без фильтра
     * старое сохранение вернуло бы id, для которого POLICIES[id] === undefined: агрегатор
     * такой id молча пропустит, но UI попытался бы отрисовать несуществующую политику,
     * а слот в лимите активных остался бы занятым навсегда.
     */
    activePolicies: Array.isArray(r.activePolicies)
      ? (r.activePolicies.filter(
          (p: unknown) => typeof p === 'string' && p in POLICIES,
        ) as PoliticsState['activePolicies'])
      : [],
    maxActivePolicies: int(r.maxActivePolicies, INITIAL_POLITICS.maxActivePolicies),
    lastActivated: decNumRecord(r.lastActivated),
  };
};

// ----------------------------------------------------------------- galaxies --

interface SavedPlatformEnemy {
  id: string;
  type: string;
  level: number;
  name: string;
  maxHp: DecStr;
  hp: DecStr;
  distance: number;
  speed: number;
  damageType: PlatformEnemy['damageType'];
  dps: DecStr;
  armor: DecStr;
  shieldPierce: number;
  armorPierce: number;
  isBoss: boolean;
  loot: { credits: number; resources: Record<string, number> } | null;
}

const DAMAGE_TYPES = ['physical', 'energy', 'mixed'] as const;

const encPlatformEnemy = (e: PlatformEnemy): SavedPlatformEnemy => ({
  id: str(e.id, makeId('penemy')),
  type: String(e.type),
  level: int(e.level, 1),
  name: str(e.name, ''),
  maxHp: encD(e.maxHp),
  hp: encD(e.hp),
  distance: num(e.distance, 1),
  speed: num(e.speed, 0.08),
  damageType: oneOf(e.damageType, DAMAGE_TYPES, 'physical'),
  dps: encD(e.dps),
  armor: encD(e.armor),
  shieldPierce: frac01(e.shieldPierce, 0),
  armorPierce: frac01(e.armorPierce, 0),
  isBoss: bool(e.isBoss, false),
  // `loot` is declared with plain numbers, and both consumers keep the Decimal on the
  // left of the operation, so numbers are what must round-trip here.
  loot: e.loot
    ? { credits: num(e.loot.credits, 0), resources: encNumRecord(e.loot.resources) }
    : null,
});

const decPlatformEnemy = (raw: AnyRec): PlatformEnemy => {
  const out: PlatformEnemy = {
    id: str(raw.id, makeId('penemy')),
    type: str(raw.type, 'drone'),
    level: int(raw.level, 1),
    name: str(raw.name, ''),
    maxHp: decD(raw.maxHp, 100),
    hp: decD(raw.hp, 100),
    distance: num(raw.distance, 1),
    speed: num(raw.speed, 0.08),
    damageType: oneOf(raw.damageType, DAMAGE_TYPES, 'physical'),
    dps: decD(raw.dps, 10),
    armor: decD(raw.armor, 0),
    shieldPierce: frac01(raw.shieldPierce, 0),
    armorPierce: frac01(raw.armorPierce, 0),
    isBoss: bool(raw.isBoss, false),
  };
  if (isRec(raw.loot)) {
    const loot = rec(raw.loot);
    out.loot = {
      credits: num(loot.credits, 0),
      resources: encNumRecord(loot.resources),
    };
  }
  return out;
};

interface SavedPlatformCombat {
  underAttack: boolean;
  waveEndsAt: number;
  nextWaveAt: number;
  enemies: SavedPlatformEnemy[];
  damagePerSecond: DecStr;
  shieldRegenPerSecond: DecStr;
  turretCount: number;
  radarCount: number;
  radarRange: number;
}

const encPlatformCombat = (src: PlatformCombatState): SavedPlatformCombat => ({
  underAttack: bool(src.underAttack, false),
  waveEndsAt: num(src.waveEndsAt, 0),
  nextWaveAt: num(src.nextWaveAt, 0),
  enemies: encArray(src.enemies, encPlatformEnemy),
  damagePerSecond: encD(src.damagePerSecond),
  shieldRegenPerSecond: encD(src.shieldRegenPerSecond),
  turretCount: nonNegInt(src.turretCount, 0),
  radarCount: nonNegInt(src.radarCount, 0),
  radarRange: num(src.radarRange, 1),
});

const decPlatformCombat = (raw: unknown): PlatformCombatState => {
  const r = rec(raw);
  return {
    underAttack: bool(r.underAttack, false),
    waveEndsAt: num(r.waveEndsAt, 0),
    nextWaveAt: num(r.nextWaveAt, 0),
    enemies: decArray(r.enemies, decPlatformEnemy),
    // Both loaders used to spread `...p.combat`, leaving these two as strings.
    // processPlatformCombat calls `.mul(dt)` on shieldRegenPerSecond.
    damagePerSecond: decD(r.damagePerSecond, 0),
    shieldRegenPerSecond: decD(r.shieldRegenPerSecond, 5),
    turretCount: nonNegInt(r.turretCount, 0),
    radarCount: nonNegInt(r.radarCount, 0),
    radarRange: num(r.radarRange, 1),
  };
};

interface SavedPlatform {
  id: string;
  galaxyId: string;
  name: string;
  grid: SavedGrid;
  buildings: SavedBuilding[];
  resources: Record<string, SavedResource>;
  maxHp: DecStr;
  hp: DecStr;
  armor: DecStr;
  maxArmor: DecStr;
  shieldMaxHp: DecStr;
  shieldHp: DecStr;
  shieldRegenRate: DecStr;
  upgrades: { defense: number; mining: number; storage: number };
  combat: SavedPlatformCombat;
}

const encPlatform = (p: SpacePlatform): SavedPlatform => ({
  id: str(p.id, makeId('platform')),
  galaxyId: String(p.galaxyId),
  name: str(p.name, ''),
  grid: encGrid(p.grid),
  buildings: encArray(p.buildings, encBuilding),
  resources: encResources(p.resources),
  maxHp: encD(p.maxHp),
  hp: encD(p.hp),
  armor: encD(p.armor),
  maxArmor: encD(p.maxArmor),
  shieldMaxHp: encD(p.shieldMaxHp),
  shieldHp: encD(p.shieldHp),
  shieldRegenRate: encD(p.shieldRegenRate),
  upgrades: {
    defense: nonNegInt(p.upgrades?.defense, 0),
    mining: nonNegInt(p.upgrades?.mining, 0),
    storage: nonNegInt(p.upgrades?.storage, 0),
  },
  combat: encPlatformCombat(p.combat),
});

const decPlatform = (raw: AnyRec): SpacePlatform => {
  const upgrades = rec(raw.upgrades);
  const platformGridBase: GridState = {
    width: 10,
    height: 10,
    selected: null,
    tiles: {},
    buffers: { base: {} },
    lastDtSeconds: 0,
    selectedBuildId: null,
  };
  return {
    id: str(raw.id, makeId('platform')),
    galaxyId: str(raw.galaxyId, INITIAL_GALAXIES.currentGalaxyId) as GalaxyId,
    name: str(raw.name, ''),
    grid: decGrid(raw.grid, platformGridBase),
    buildings: decArray(raw.buildings, decBuilding),
    resources: decResources(raw.resources),
    maxHp: decD(raw.maxHp, 1000),
    hp: decD(raw.hp, 1000),
    armor: decD(raw.armor, 0),
    maxArmor: decD(raw.maxArmor, 0),
    // v0 saves also carry a phantom `maxShieldHp` grafted on by the old loaders;
    // migrateSave folds it into the real `shieldMaxHp` key.
    shieldMaxHp: decD(raw.shieldMaxHp, 0),
    shieldHp: decD(raw.shieldHp, 0),
    shieldRegenRate: decD(raw.shieldRegenRate, 5),
    upgrades: {
      defense: nonNegInt(upgrades.defense, 0),
      mining: nonNegInt(upgrades.mining, 0),
      storage: nonNegInt(upgrades.storage, 0),
    },
    combat: decPlatformCombat(raw.combat),
  };
};

const NOTIFICATION_TYPES = ['attack', 'warning', 'success', 'info'] as const;

const encNotification = (n: Notification) => ({
  id: str(n.id, makeId('notif')),
  type: oneOf(n.type, NOTIFICATION_TYPES, 'info'),
  title: str(n.title, ''),
  message: str(n.message, ''),
  timestamp: num(n.timestamp, 0),
  platformId: strOrNull(n.platformId),
  read: bool(n.read, false),
});

const decNotification = (raw: AnyRec): Notification => {
  const out: Notification = {
    id: str(raw.id, makeId('notif')),
    type: oneOf(raw.type, NOTIFICATION_TYPES, 'info'),
    title: str(raw.title, ''),
    message: str(raw.message, ''),
    timestamp: num(raw.timestamp, 0),
    read: bool(raw.read, false),
  };
  const platformId = strOrNull(raw.platformId);
  if (platformId) out.platformId = platformId;
  return out;
};

interface SavedGalaxies {
  currentGalaxyId: string;
  unlockedGalaxies: string[];
  platforms: SavedPlatform[];
  autoTransportEnabled: boolean;
  fuelReserve: DecStr;
  notifications: ReturnType<typeof encNotification>[];
  activePlatformId: string | null;
}

const encGalaxies = (src: GalaxiesState): SavedGalaxies => ({
  currentGalaxyId: String(src.currentGalaxyId),
  unlockedGalaxies: encArray(src.unlockedGalaxies, (g) => String(g)),
  platforms: encArray(src.platforms, encPlatform),
  autoTransportEnabled: bool(src.autoTransportEnabled, false),
  fuelReserve: encD(src.fuelReserve),
  notifications: encArray(src.notifications, encNotification),
  activePlatformId: strOrNull(src.activePlatformId),
});

const decGalaxies = (raw: unknown): GalaxiesState => {
  const r = rec(raw);
  const out: GalaxiesState = {
    currentGalaxyId: str(r.currentGalaxyId, INITIAL_GALAXIES.currentGalaxyId) as GalaxyId,
    unlockedGalaxies: Array.isArray(r.unlockedGalaxies)
      ? (r.unlockedGalaxies.filter((g: unknown) => typeof g === 'string') as GalaxyId[])
      : [...INITIAL_GALAXIES.unlockedGalaxies],
    platforms: decArray(r.platforms, decPlatform),
    autoTransportEnabled: bool(r.autoTransportEnabled, INITIAL_GALAXIES.autoTransportEnabled),
    // Serialized as a string; loadGameFromSave never converted it, so the tick did
    // string arithmetic on `fuelReserve.gte(...)` every frame.
    fuelReserve: decD(r.fuelReserve, INITIAL_GALAXIES.fuelReserve),
    notifications: decArray(r.notifications, decNotification),
  };
  if (out.unlockedGalaxies.length === 0) {
    out.unlockedGalaxies = [...INITIAL_GALAXIES.unlockedGalaxies];
  }
  const activePlatformId = strOrNull(r.activePlatformId);
  if (activePlatformId) out.activePlatformId = activePlatformId;
  return out;
};

// -------------------------------------------------------------------- fleet --

const SHIP_TYPES = ['fighter', 'corvette', 'cruiser', 'dreadnought', 'flagship'] as const;
const SHIP_STATUSES = ['idle', 'defending', 'attacking', 'damaged', 'repairing'] as const;

interface SavedShipUnit {
  id: string;
  type: ShipType;
  name: string;
  level: number;
  maxHp: DecStr;
  hp: DecStr;
  dps: DecStr;
  armor: DecStr;
  speed: number;
  assignedTo: string | null;
  status: Ship['status'];
  experience: number;
  upgradeLevel: number;
}

const encShipUnit = (s: Ship): SavedShipUnit => ({
  id: str(s.id, makeId('ship')),
  type: oneOf(s.type, SHIP_TYPES, 'fighter'),
  name: str(s.name, ''),
  level: Math.max(1, int(s.level, 1)),
  maxHp: encD(s.maxHp),
  hp: encD(s.hp),
  dps: encD(s.dps),
  armor: encD(s.armor),
  speed: num(s.speed, 0),
  assignedTo: strOrNull(s.assignedTo),
  status: oneOf(s.status, SHIP_STATUSES, 'idle'),
  experience: nonNegInt(s.experience, 0),
  upgradeLevel: nonNegInt(s.upgradeLevel, 0),
});

const decShipUnit = (raw: AnyRec): Ship => {
  const out: Ship = {
    id: str(raw.id, makeId('ship')),
    type: oneOf(raw.type, SHIP_TYPES, 'fighter'),
    name: str(raw.name, ''),
    level: Math.max(1, int(raw.level, 1)),
    maxHp: decD(raw.maxHp, 100),
    hp: decD(raw.hp, 100),
    dps: decD(raw.dps, 1),
    armor: decD(raw.armor, 0),
    speed: num(raw.speed, 0),
    status: oneOf(raw.status, SHIP_STATUSES, 'idle'),
    experience: nonNegInt(raw.experience, 0),
    upgradeLevel: nonNegInt(raw.upgradeLevel, 0),
  };
  const assignedTo = strOrNull(raw.assignedTo);
  if (assignedTo) out.assignedTo = assignedTo;
  return out;
};

interface SavedFleet {
  ships: SavedShipUnit[];
  autoDefend: boolean;
  productionQueue: Array<{ shipType: ShipType; progress: number; timeRemaining: number }>;
}

const encFleet = (src: FleetState): SavedFleet => ({
  ships: encArray(src.ships, encShipUnit),
  autoDefend: bool(src.autoDefend, INITIAL_FLEET.autoDefend),
  productionQueue: encArray(src.productionQueue, (q) => ({
    shipType: oneOf(q.shipType, SHIP_TYPES, 'fighter'),
    progress: frac01(q.progress, 0),
    timeRemaining: Math.max(0, num(q.timeRemaining, 0)),
  })),
});

const decFleet = (raw: unknown): FleetState => {
  const r = rec(raw);
  return {
    ships: decArray(r.ships, decShipUnit),
    autoDefend: bool(r.autoDefend, INITIAL_FLEET.autoDefend),
    productionQueue: decArray(r.productionQueue, (q) => ({
      shipType: oneOf(q.shipType, SHIP_TYPES, 'fighter'),
      progress: frac01(q.progress, 0),
      timeRemaining: Math.max(0, num(q.timeRemaining, 0)),
    })),
  };
};

// ---------------------------------------------------------------- pollution --

interface SavedPollution {
  wasteAmount: DecStr;
  radioactiveWasteAmount: DecStr;
  efficiencyMultiplier: number;
  pollutionZones: Array<{ x: number; y: number; radius: number; intensity: number }>;
}

const encPollution = (src: PollutionState): SavedPollution => ({
  wasteAmount: encD(src.wasteAmount),
  radioactiveWasteAmount: encD(src.radioactiveWasteAmount),
  efficiencyMultiplier: num(src.efficiencyMultiplier, 1),
  pollutionZones: encArray(src.pollutionZones, (z) => ({
    x: num(z.x, 0),
    y: num(z.y, 0),
    radius: num(z.radius, 0),
    intensity: frac01(z.intensity, 0),
  })),
});

const decPollution = (raw: unknown): PollutionState => {
  const r = rec(raw);
  return {
    wasteAmount: decD(r.wasteAmount, 0),
    radioactiveWasteAmount: decD(r.radioactiveWasteAmount, 0),
    efficiencyMultiplier: num(r.efficiencyMultiplier, INITIAL_POLLUTION.efficiencyMultiplier),
    pollutionZones: decArray(r.pollutionZones, (z) => ({
      x: num(z.x, 0),
      y: num(z.y, 0),
      radius: num(z.radius, 0),
      intensity: frac01(z.intensity, 0),
    })),
  };
};

// --------------------------------------------------- intergalacticLogistics --

const CARAVAN_STATUSES = [
  'idle',
  'traveling',
  'under_attack',
  'delivered',
  'destroyed',
] as const;

interface SavedCaravan {
  id: string;
  fromId: string;
  toId: string;
  fromGalaxyId: string;
  toGalaxyId: string;
  cargo: Record<string, DecStr>;
  status: Caravan['status'];
  progress: number;
  departureTime: number;
  arrivalTime: number;
  fuelCost: DecStr;
  fuelPaid: DecStr;
  riskLevel: number;
  defense: DecStr;
  underAttackBy: SavedPlatformEnemy[];
  escortShips: string[];
}

const encCaravan = (c: Caravan): SavedCaravan => ({
  id: str(c.id, makeId('caravan')),
  fromId: str(c.fromId, 'main_base'),
  toId: str(c.toId, 'main_base'),
  fromGalaxyId: String(c.fromGalaxyId),
  toGalaxyId: String(c.toGalaxyId),
  cargo: encRecord<ResourceType>(c.cargo),
  status: oneOf(c.status, CARAVAN_STATUSES, 'idle'),
  progress: frac01(c.progress, 0),
  departureTime: num(c.departureTime, 0),
  arrivalTime: num(c.arrivalTime, 0),
  fuelCost: encD(c.fuelCost),
  fuelPaid: encD(c.fuelPaid),
  riskLevel: frac01(c.riskLevel, 0),
  defense: encD(c.defense),
  underAttackBy: encArray(c.underAttackBy, encPlatformEnemy),
  escortShips: encArray(c.escortShips, (s) => String(s)),
});

const decCaravan = (raw: AnyRec): Caravan => ({
  id: str(raw.id, makeId('caravan')),
  fromId: str(raw.fromId, 'main_base'),
  toId: str(raw.toId, 'main_base'),
  fromGalaxyId: str(raw.fromGalaxyId, INITIAL_GALAXIES.currentGalaxyId) as GalaxyId,
  toGalaxyId: str(raw.toGalaxyId, INITIAL_GALAXIES.currentGalaxyId) as GalaxyId,
  cargo: decRecord<ResourceType>(raw.cargo),
  status: oneOf(raw.status, CARAVAN_STATUSES, 'idle'),
  progress: frac01(raw.progress, 0),
  departureTime: num(raw.departureTime, 0),
  arrivalTime: num(raw.arrivalTime, 0),
  fuelCost: decD(raw.fuelCost, 0),
  fuelPaid: decD(raw.fuelPaid, 0),
  riskLevel: frac01(raw.riskLevel, 0),
  defense: decD(raw.defense, 10),
  underAttackBy: decArray(raw.underAttackBy, decPlatformEnemy),
  escortShips: Array.isArray(raw.escortShips)
    ? raw.escortShips.filter((s: unknown) => typeof s === 'string')
    : [],
});

interface SavedIntergalacticLogistics {
  caravans: SavedCaravan[];
  upgrades: CaravanUpgrades;
  autoSendToMainBase: boolean;
  autoRoutes: Array<{
    id: string;
    fromId: string;
    toId: string;
    resource: string;
    triggerAmount: DecStr;
    sendAmount: DecStr;
    enabled: boolean;
  }>;
}

const encIntergalacticLogistics = (
  src: IntergalacticLogisticsState,
): SavedIntergalacticLogistics => ({
  caravans: encArray(src.caravans, encCaravan),
  upgrades: {
    speed: nonNegInt(src.upgrades?.speed, 0),
    capacity: nonNegInt(src.upgrades?.capacity, 0),
    defense: nonNegInt(src.upgrades?.defense, 0),
  },
  autoSendToMainBase: bool(src.autoSendToMainBase, false),
  autoRoutes: encArray(src.autoRoutes, (r) => ({
    id: str(r.id, makeId('route')),
    fromId: str(r.fromId, 'main_base'),
    toId: str(r.toId, 'main_base'),
    resource: String(r.resource),
    triggerAmount: encD(r.triggerAmount),
    sendAmount: encD(r.sendAmount),
    enabled: bool(r.enabled, true),
  })),
});

const decIntergalacticLogistics = (raw: unknown): IntergalacticLogisticsState => {
  const r = rec(raw);
  const upgrades = rec(r.upgrades);
  return {
    caravans: decArray(r.caravans, decCaravan),
    upgrades: {
      speed: nonNegInt(upgrades.speed, INITIAL_INTERGALACTIC_LOGISTICS.upgrades.speed),
      capacity: nonNegInt(upgrades.capacity, INITIAL_INTERGALACTIC_LOGISTICS.upgrades.capacity),
      defense: nonNegInt(upgrades.defense, INITIAL_INTERGALACTIC_LOGISTICS.upgrades.defense),
    },
    autoSendToMainBase: bool(
      r.autoSendToMainBase,
      INITIAL_INTERGALACTIC_LOGISTICS.autoSendToMainBase,
    ),
    autoRoutes: decArray(r.autoRoutes, (route) => ({
      id: str(route.id, makeId('route')),
      fromId: str(route.fromId, 'main_base'),
      toId: str(route.toId, 'main_base'),
      resource: str(route.resource, 'ore') as ResourceType,
      triggerAmount: decD(route.triggerAmount, 0),
      sendAmount: decD(route.sendAmount, 0),
      enabled: bool(route.enabled, true),
    })),
  };
};

// -------------------------------------------------------------- randomEvents --

const EVENT_STATUSES = ['pending', 'active', 'resolved', 'expired'] as const;

const encRandomEvent = (e: RandomEvent) => ({
  id: str(e.id, makeId('event')),
  type: String(e.type),
  title: str(e.title, ''),
  description: str(e.description, ''),
  icon: str(e.icon, ''),
  timestamp: num(e.timestamp, 0),
  status: oneOf(e.status, EVENT_STATUSES, 'pending'),
  expiresAt: typeof e.expiresAt === 'number' ? e.expiresAt : null,
  choices: cloneJson(e.choices ?? [], []),
  effects: e.effects
    ? {
        buildingDamage: cloneJson(e.effects.buildingDamage ?? null, null),
        resourceGain: encRecord<ResourceType>(e.effects.resourceGain),
        resourceLoss: encRecord<ResourceType>(e.effects.resourceLoss),
        researchPointsGain: encDOpt(e.effects.researchPointsGain),
        energyLoss: encDOpt(e.effects.energyLoss),
        productionMultiplier: cloneJson(e.effects.productionMultiplier ?? null, null),
        unlockRandomTechnology: bool(e.effects.unlockRandomTechnology, false),
      }
    : null,
});

const decRandomEvent = (raw: AnyRec): RandomEvent => {
  const out: RandomEvent = {
    id: str(raw.id, makeId('event')),
    type: str(raw.type, 'cosmic_anomaly') as RandomEvent['type'],
    title: str(raw.title, ''),
    description: str(raw.description, ''),
    icon: str(raw.icon, ''),
    timestamp: num(raw.timestamp, 0),
    status: oneOf(raw.status, EVENT_STATUSES, 'pending'),
  };
  if (typeof raw.expiresAt === 'number') out.expiresAt = raw.expiresAt;
  if (Array.isArray(raw.choices) && raw.choices.length > 0) {
    out.choices = cloneJson(raw.choices, []) as RandomEvent['choices'];
  }
  if (isRec(raw.effects)) {
    const fx = rec(raw.effects);
    const effects: NonNullable<RandomEvent['effects']> = {};
    if (isRec(fx.buildingDamage)) {
      // Built field by field rather than deep-cloned: `damagePercent` is required, and a
      // truncated save that omits it would otherwise produce an object the event resolver
      // dereferences as a number.
      const bd = rec(fx.buildingDamage);
      effects.buildingDamage = { damagePercent: num(bd.damagePercent, 0) };
      if (Array.isArray(bd.targetCoords)) {
        effects.buildingDamage.targetCoords = cloneJson(bd.targetCoords as GridCoord[], []);
      }
      if (Array.isArray(bd.affectedBuildings)) {
        effects.buildingDamage.affectedBuildings = (bd.affectedBuildings as unknown[]).map((b) =>
          str(b, ''),
        );
      }
    }
    if (isRec(fx.resourceGain)) effects.resourceGain = decRecord<ResourceType>(fx.resourceGain);
    if (isRec(fx.resourceLoss)) effects.resourceLoss = decRecord<ResourceType>(fx.resourceLoss);
    const rp = decDOpt(fx.researchPointsGain);
    if (rp) effects.researchPointsGain = rp;
    const el = decDOpt(fx.energyLoss);
    if (el) effects.energyLoss = el;
    if (isRec(fx.productionMultiplier)) {
      // Same reasoning as buildingDamage: `duration` and `multiplier` are required, and a
      // multiplier of undefined would silently zero out production.
      const pm = rec(fx.productionMultiplier);
      effects.productionMultiplier = {
        duration: num(pm.duration, 0),
        multiplier: num(pm.multiplier, 1),
      };
      if (Array.isArray(pm.affectedResources)) {
        effects.productionMultiplier.affectedResources = (
          pm.affectedResources as unknown[]
        ).map((r) => str(r, '') as ResourceType);
      }
    }
    if (fx.unlockRandomTechnology === true) effects.unlockRandomTechnology = true;
    out.effects = effects;
  }
  return out;
};

const encRandomEvents = (src: RandomEventsState) => ({
  activeEvents: encArray(src.activeEvents, encRandomEvent),
  eventHistory: encArray(src.eventHistory, (h) => ({
    type: String(h.type),
    timestamp: num(h.timestamp, 0),
    title: str(h.title, ''),
  })),
  nextEventAt: num(src.nextEventAt, 0),
  eventsEnabled: bool(src.eventsEnabled, true),
  eventFrequencyMultiplier: num(src.eventFrequencyMultiplier, 1),
});

const decRandomEvents = (raw: unknown): RandomEventsState => {
  const r = rec(raw);
  return {
    activeEvents: decArray(r.activeEvents, decRandomEvent),
    eventHistory: decArray(r.eventHistory, (h) => ({
      type: str(h.type, 'cosmic_anomaly') as RandomEvent['type'],
      timestamp: num(h.timestamp, 0),
      title: str(h.title, ''),
    })),
    nextEventAt: num(r.nextEventAt, INITIAL_RANDOM_EVENTS.nextEventAt),
    eventsEnabled: bool(r.eventsEnabled, INITIAL_RANDOM_EVENTS.eventsEnabled),
    eventFrequencyMultiplier: num(
      r.eventFrequencyMultiplier,
      INITIAL_RANDOM_EVENTS.eventFrequencyMultiplier,
    ),
  };
};

// -------------------------------------------------------------- achievements --

const encAchievements = (src: GameState['achievements']) => ({
  unlocked: encNumRecord(src.unlocked),
  recentlyUnlocked: encArray(src.recentlyUnlocked, (a) => ({
    achievementId: String(a.achievementId),
    unlockedAt: num(a.unlockedAt, 0),
  })),
});

const decAchievements = (raw: unknown): GameState['achievements'] => {
  const r = rec(raw);
  return {
    unlocked: decNumRecord<string>(r.unlocked) as Record<string, number>,
    recentlyUnlocked: decArray(r.recentlyUnlocked, (a) => ({
      achievementId: str(a.achievementId, ''),
      unlockedAt: num(a.unlockedAt, 0),
    })),
  };
};

// ------------------------------------------------------------ megastructures --

const encMegastructures = (src: MegastructuresState) => {
  const built: Record<string, { completedAt: number; buildProgress: number; active: boolean }> = {};
  for (const [k, v] of Object.entries(rec(src.built))) {
    if (!isRec(v)) continue;
    built[k] = {
      completedAt: num(v.completedAt, 0),
      buildProgress: num(v.buildProgress, 0),
      active: bool(v.active, false),
    };
  }
  return {
    built,
    constructionQueue: encArray(src.constructionQueue, (q) => ({
      megastructureId: String(q.megastructureId),
      startedAt: num(q.startedAt, 0),
      progress: num(q.progress, 0),
    })),
  };
};

const decMegastructures = (raw: unknown): MegastructuresState => {
  const r = rec(raw);
  const built: MegastructuresState['built'] = {};
  for (const [k, v] of Object.entries(rec(r.built))) {
    if (!isRec(v)) continue;
    built[k as MegastructureId] = {
      completedAt: num(v.completedAt, 0),
      buildProgress: num(v.buildProgress, 0),
      active: bool(v.active, false),
    };
  }
  return {
    built,
    constructionQueue: decArray(r.constructionQueue, (q) => ({
      megastructureId: str(q.megastructureId, 'dyson_sphere') as MegastructureId,
      startedAt: num(q.startedAt, 0),
      progress: num(q.progress, 0),
    })),
  };
};

// ------------------------------------------------------------------ endgame --

const encGameEnding = (e: GameEnding) => ({
  id: String(e.id),
  name: str(e.name, ''),
  description: str(e.description, ''),
  requirements: cloneJson(e.requirements ?? {}, {}),
  unlocked: bool(e.unlocked, false),
  achievedAt: typeof e.achievedAt === 'number' ? e.achievedAt : null,
  rewards: cloneJson(e.rewards ?? null, null),
});

const decGameEnding = (raw: AnyRec, id: EndingId): GameEnding => {
  const out: GameEnding = {
    id: (typeof raw.id === 'string' ? raw.id : id) as EndingId,
    name: str(raw.name, ''),
    description: str(raw.description, ''),
    requirements: isRec(raw.requirements)
      ? cloneJson(raw.requirements as GameEnding['requirements'], {})
      : {},
    unlocked: bool(raw.unlocked, false),
  };
  if (typeof raw.achievedAt === 'number') out.achievedAt = raw.achievedAt;
  if (isRec(raw.rewards)) {
    out.rewards = cloneJson(raw.rewards as GameEnding['rewards'], {});
  }
  return out;
};

const encEndgame = (src: EndgameState) => {
  const endings: Record<string, ReturnType<typeof encGameEnding>> = {};
  for (const [k, v] of Object.entries(rec(src.endings))) {
    if (isRec(v)) endings[k] = encGameEnding(v as GameEnding);
  }
  return {
    endings,
    currentEndingProgress: encNumRecord(src.currentEndingProgress),
    victoryAchieved: bool(src.victoryAchieved, false),
    victoryEndingId: strOrNull(src.victoryEndingId),
  };
};

const decEndgame = (raw: unknown): EndgameState => {
  const r = rec(raw);
  const endings: EndgameState['endings'] = {};
  for (const [k, v] of Object.entries(rec(r.endings))) {
    if (isRec(v)) endings[k as EndingId] = decGameEnding(v, k as EndingId);
  }
  const out: EndgameState = {
    endings,
    currentEndingProgress: decNumRecord<EndingId>(r.currentEndingProgress),
    victoryAchieved: bool(r.victoryAchieved, false),
  };
  const victoryEndingId = strOrNull(r.victoryEndingId);
  if (victoryEndingId) out.victoryEndingId = victoryEndingId as EndingId;
  return out;
};

// ----------------------------------------------------------------- prestige --

interface SavedPrestige {
  lifetimeQuantumPoints: number;
  availableQuantumPoints: number;
  prestigeCount: number;
  upgrades: Record<string, number>;
  stats: {
    totalPlaytime: number;
    totalCreditsEarned: DecStr;
    totalResearchPoints: DecStr;
    maxBuildingsBuilt: number;
    endingsAchieved: string[];
  };
  fastModeEnabled: boolean;
}

const encPrestige = (src: PrestigeState): SavedPrestige => ({
  lifetimeQuantumPoints: num(src.lifetimeQuantumPoints, 0),
  availableQuantumPoints: num(src.availableQuantumPoints, 0),
  prestigeCount: nonNegInt(src.prestigeCount, 0),
  upgrades: encNumRecord<PrestigeUpgradeId>(src.upgrades),
  stats: {
    totalPlaytime: num(src.stats?.totalPlaytime, 0),
    totalCreditsEarned: encD(src.stats?.totalCreditsEarned),
    totalResearchPoints: encD(src.stats?.totalResearchPoints),
    maxBuildingsBuilt: nonNegInt(src.stats?.maxBuildingsBuilt, 0),
    endingsAchieved: encArray(src.stats?.endingsAchieved, (e) => String(e)),
  },
  fastModeEnabled: bool(src.fastModeEnabled, false),
});

const decPrestige = (raw: unknown): PrestigeState => {
  const r = rec(raw);
  const stats = rec(r.stats);
  return {
    lifetimeQuantumPoints: Math.max(0, num(r.lifetimeQuantumPoints, 0)),
    availableQuantumPoints: Math.max(0, num(r.availableQuantumPoints, 0)),
    prestigeCount: nonNegInt(r.prestigeCount, 0),
    upgrades: decNumRecord<PrestigeUpgradeId>(r.upgrades),
    stats: {
      totalPlaytime: Math.max(0, num(stats.totalPlaytime, 0)),
      totalCreditsEarned: decD(stats.totalCreditsEarned, 0),
      totalResearchPoints: decD(stats.totalResearchPoints, 0),
      maxBuildingsBuilt: nonNegInt(stats.maxBuildingsBuilt, 0),
      endingsAchieved: Array.isArray(stats.endingsAchieved)
        ? (stats.endingsAchieved.filter((e: unknown) => typeof e === 'string') as EndingId[])
        : [],
    },
    fastModeEnabled: bool(r.fastModeEnabled, INITIAL_PRESTIGE.fastModeEnabled),
  };
};

// ---------------------------------------------------------------- ascension --

const encAscension = (src: AscensionState) => ({
  ascensionCount: nonNegInt(src.ascensionCount, 0),
  ascensionPoints: num(src.ascensionPoints, 0),
  lifetimeAscensionPoints: num(src.lifetimeAscensionPoints, 0),
  requirements: {
    minPrestigeCount: num(src.requirements?.minPrestigeCount, 10),
    minQuantumPoints: num(src.requirements?.minQuantumPoints, 1_000_000),
    allMegastructures: bool(src.requirements?.allMegastructures, true),
  },
  multipliers: {
    qpGain: num(src.multipliers?.qpGain, 1),
    globalProduction: num(src.multipliers?.globalProduction, 1),
    researchSpeed: num(src.multipliers?.researchSpeed, 1),
    startingCredits: num(src.multipliers?.startingCredits, 0),
  },
  unlocks: {
    infiniteResearch: bool(src.unlocks?.infiniteResearch, false),
    buildingEvolution: bool(src.unlocks?.buildingEvolution, false),
    proceduralGalaxies: bool(src.unlocks?.proceduralGalaxies, false),
  },
  stats: {
    totalAscensionTime: num(src.stats?.totalAscensionTime, 0),
    fastestAscension: num(src.stats?.fastestAscension, 0),
    totalQuantumPointsEarned: num(src.stats?.totalQuantumPointsEarned, 0),
  },
});

const decAscension = (raw: unknown): AscensionState => {
  const r = rec(raw);
  const req = rec(r.requirements);
  const mul = rec(r.multipliers);
  const unl = rec(r.unlocks);
  const stats = rec(r.stats);
  const defaults = INITIAL_ASCENSION;
  return {
    ascensionCount: nonNegInt(r.ascensionCount, 0),
    ascensionPoints: Math.max(0, num(r.ascensionPoints, 0)),
    lifetimeAscensionPoints: Math.max(0, num(r.lifetimeAscensionPoints, 0)),
    requirements: {
      minPrestigeCount: num(req.minPrestigeCount, defaults.requirements.minPrestigeCount),
      minQuantumPoints: num(req.minQuantumPoints, defaults.requirements.minQuantumPoints),
      allMegastructures: bool(req.allMegastructures, defaults.requirements.allMegastructures),
    } satisfies AscensionRequirements,
    multipliers: {
      qpGain: num(mul.qpGain, defaults.multipliers.qpGain),
      globalProduction: num(mul.globalProduction, defaults.multipliers.globalProduction),
      researchSpeed: num(mul.researchSpeed, defaults.multipliers.researchSpeed),
      startingCredits: num(mul.startingCredits, defaults.multipliers.startingCredits),
    },
    // These three are the feature gates for infinite research, building evolution
    // and procedural galaxies. Losing them re-locked three whole systems.
    unlocks: {
      infiniteResearch: bool(unl.infiniteResearch, defaults.unlocks.infiniteResearch),
      buildingEvolution: bool(unl.buildingEvolution, defaults.unlocks.buildingEvolution),
      proceduralGalaxies: bool(unl.proceduralGalaxies, defaults.unlocks.proceduralGalaxies),
    },
    stats: {
      totalAscensionTime: num(stats.totalAscensionTime, 0),
      fastestAscension: num(stats.fastestAscension, 0),
      totalQuantumPointsEarned: num(stats.totalQuantumPointsEarned, 0),
    },
  };
};

// ------------------------------------------------------- repeatableResearch --

const encRepeatableResearch = (src: RepeatableResearchState) => {
  const stats: Record<
    string,
    { totalLevels: number; highestLevel: number; totalSpent: Record<string, number> }
  > = {};
  for (const [k, v] of Object.entries(rec(src.stats))) {
    if (!isRec(v)) continue;
    stats[k] = {
      totalLevels: nonNegInt(v.totalLevels, 0),
      highestLevel: nonNegInt(v.highestLevel, 0),
      totalSpent: encNumRecord(v.totalSpent),
    };
  }
  return {
    researches: encNumRecord<RepeatableResearchId>(src.researches),
    totalLevelsThisAscension: nonNegInt(src.totalLevelsThisAscension, 0),
    stats,
    history: encArray(src.history, (h) => ({
      ascensionNumber: nonNegInt(h.ascensionNumber, 0),
      timestamp: num(h.timestamp, 0),
      researches: encNumRecord<RepeatableResearchId>(h.researches),
      totalLevels: nonNegInt(h.totalLevels, 0),
    })),
  };
};

const decRepeatableResearch = (raw: unknown): RepeatableResearchState => {
  const r = rec(raw);
  const stats: RepeatableResearchState['stats'] = {};
  for (const [k, v] of Object.entries(rec(r.stats))) {
    if (!isRec(v)) continue;
    stats[k as RepeatableResearchId] = {
      totalLevels: nonNegInt(v.totalLevels, 0),
      highestLevel: nonNegInt(v.highestLevel, 0),
      totalSpent: decNumRecord<string>(v.totalSpent) as Record<string, number>,
    };
  }
  return {
    researches: decNumRecord<RepeatableResearchId>(r.researches),
    totalLevelsThisAscension: nonNegInt(r.totalLevelsThisAscension, 0),
    stats,
    history: decArray(r.history, (h) => ({
      ascensionNumber: nonNegInt(h.ascensionNumber, 0),
      timestamp: num(h.timestamp, 0),
      researches: decNumRecord<RepeatableResearchId>(h.researches),
      totalLevels: nonNegInt(h.totalLevels, 0),
    })),
  };
};

// ------------------------------------------------------- proceduralGalaxies --

const SPECIAL_FEATURES = ['black_hole', 'nebula', 'quasar', 'ruins'] as const;

const encProceduralGalaxy = (g: ProceduralGalaxy) => ({
  seed: num(g.seed, 0),
  galaxyNumber: int(g.galaxyNumber, 0),
  generated: {
    name: str(g.generated?.name, ''),
    resourceModifiers: encNumRecord<ResourceType>(g.generated?.resourceModifiers),
    difficulty: num(g.generated?.difficulty, 1),
    specialFeature: g.generated?.specialFeature
      ? oneOf(g.generated.specialFeature, SPECIAL_FEATURES, 'nebula')
      : null,
  },
  discovered: bool(g.discovered, false),
  completed: bool(g.completed, false),
  rewards: {
    uniqueBonus: strOrNull(g.rewards?.uniqueBonus),
    artifactId: strOrNull(g.rewards?.artifactId),
  },
});

const decProceduralGalaxy = (raw: AnyRec): ProceduralGalaxy => {
  const gen = rec(raw.generated);
  const rewards = rec(raw.rewards);
  const out: ProceduralGalaxy = {
    seed: num(raw.seed, 0),
    galaxyNumber: int(raw.galaxyNumber, 0),
    generated: {
      name: str(gen.name, ''),
      resourceModifiers: decNumRecord<ResourceType>(gen.resourceModifiers),
      difficulty: num(gen.difficulty, 1),
      specialFeature:
        typeof gen.specialFeature === 'string'
          ? oneOf(gen.specialFeature, SPECIAL_FEATURES, 'nebula')
          : null,
    },
    discovered: bool(raw.discovered, false),
    completed: bool(raw.completed, false),
    rewards: {},
  };
  const uniqueBonus = strOrNull(rewards.uniqueBonus);
  const artifactId = strOrNull(rewards.artifactId);
  if (uniqueBonus) out.rewards.uniqueBonus = uniqueBonus;
  if (artifactId) out.rewards.artifactId = artifactId;
  return out;
};

const encProceduralGalaxies = (src: ProceduralGalaxyState) => ({
  galaxies: encArray(src.galaxies, encProceduralGalaxy),
  currentSeed: num(src.currentSeed, 0),
  totalDiscovered: nonNegInt(src.totalDiscovered, 0),
});

const decProceduralGalaxies = (raw: unknown): ProceduralGalaxyState => {
  const r = rec(raw);
  return {
    galaxies: decArray(r.galaxies, decProceduralGalaxy),
    currentSeed: num(r.currentSeed, INITIAL_PROCEDURAL_GALAXIES.currentSeed),
    totalDiscovered: nonNegInt(r.totalDiscovered, 0),
  };
};

// ---------------------------------------------------------------- artifacts --

const ARTIFACT_RARITIES = ['common', 'rare', 'epic', 'legendary', 'mythic'] as const;
const ARTIFACT_SOURCES = ['galaxy', 'boss', 'event', 'achievement', 'ascension'] as const;

const encArtifactEffect = (e: ArtifactEffect) => ({
  stat: String(e.stat),
  value: num(e.value, 0),
  isPercentage: bool(e.isPercentage, true),
  affectsResource: strOrNull(e.affectsResource),
});

const decArtifactEffect = (raw: AnyRec): ArtifactEffect => {
  const out: ArtifactEffect = {
    stat: str(raw.stat, 'globalProduction') as ArtifactEffect['stat'],
    value: num(raw.value, 0),
    isPercentage: bool(raw.isPercentage, true),
  };
  const affectsResource = strOrNull(raw.affectsResource);
  if (affectsResource) out.affectsResource = affectsResource as ResourceType;
  return out;
};

const encArtifact = (a: Artifact) => ({
  id: str(a.id, makeId('artifact')),
  name: str(a.name, ''),
  description: strOrNull(a.description),
  rarity: oneOf(a.rarity, ARTIFACT_RARITIES, 'common'),
  effects: encArray(a.effects, encArtifactEffect),
  level: nonNegInt(a.level, 0),
  maxLevel: nonNegInt(a.maxLevel, 10),
  source: oneOf(a.source, ARTIFACT_SOURCES, 'galaxy'),
  discoveredAt: num(a.discoveredAt, 0),
  slotsRequired: Math.max(1, int(a.slotsRequired, 1)),
});

const decArtifact = (raw: AnyRec): Artifact => {
  const out: Artifact = {
    id: str(raw.id, makeId('artifact')),
    name: str(raw.name, ''),
    rarity: oneOf(raw.rarity, ARTIFACT_RARITIES, 'common'),
    effects: decArray(raw.effects, decArtifactEffect),
    level: nonNegInt(raw.level, 0),
    maxLevel: nonNegInt(raw.maxLevel, 10),
    source: oneOf(raw.source, ARTIFACT_SOURCES, 'galaxy'),
    discoveredAt: num(raw.discoveredAt, 0),
    slotsRequired: Math.max(1, int(raw.slotsRequired, 1)),
  };
  const description = strOrNull(raw.description);
  if (description) out.description = description;
  return out;
};

const encArtifacts = (src: ArtifactState) => ({
  discovered: encArray(src.discovered, encArtifact),
  equipped: encArray(src.equipped, (id) => String(id)),
  maxSlots: nonNegInt(src.maxSlots, INITIAL_ARTIFACTS.maxSlots),
  usedSlots: nonNegInt(src.usedSlots, 0),
  totalFound: nonNegInt(src.totalFound, 0),
  totalUpgraded: nonNegInt(src.totalUpgraded, 0),
});

const decArtifacts = (raw: unknown): ArtifactState => {
  const r = rec(raw);
  const discovered = decArray(r.discovered, decArtifact);
  const knownIds = new Set(discovered.map((a) => a.id));
  const equipped = Array.isArray(r.equipped)
    ? (r.equipped.filter(
        (id: unknown) => typeof id === 'string' && knownIds.has(id),
      ) as string[])
    : [];
  return {
    discovered,
    equipped,
    maxSlots: nonNegInt(r.maxSlots, INITIAL_ARTIFACTS.maxSlots),
    usedSlots: nonNegInt(r.usedSlots, 0),
    totalFound: nonNegInt(r.totalFound, discovered.length),
    totalUpgraded: nonNegInt(r.totalUpgraded, 0),
  };
};

// ---------------------------------------------------------------- playerStats --

interface SavedPlayerStats {
  totalPlayTime: number;
  sessionsCount: number;
  currentSessionStart: number;
  lifetimeResourcesProduced: Record<string, DecStr>;
  lifetimeResourcesSpent: Record<string, DecStr>;
  lifetimeCreditsEarned: DecStr;
  lifetimeCreditsSpent: DecStr;
  contractsCompleted: number;
  /*
   * Кумулятивные счётчики событий (bigplan.md, пункты 11 и 26). Без них достижения за боссов,
   * отбитые волны, караваны и редкие события были недостижимы: игра не считала эти величины,
   * а вывести их из состояния постфактум невозможно. Обязаны сохраняться — иначе счётчик
   * сбрасывался бы каждой перезагрузкой, и «убей 10 боссов» никогда не закрылось бы.
   */
  enemiesKilled: number;
  bossKills: number;
  attacksDefended: number;
  caravansDelivered: number;
  rareEventRewards: number;
  chainReactionsSurvived: number;
  uniquePoliciesActivated: string[];
}

const encPlayerStats = (src: PlayerStats): SavedPlayerStats => ({
  totalPlayTime: Math.max(0, num(src.totalPlayTime, 0)),
  sessionsCount: nonNegInt(src.sessionsCount, 0),
  currentSessionStart: num(src.currentSessionStart, 0),
  // Declared `Partial<Record<ResourceType, Decimal>>` but previously written raw and
  // read raw, so the values round-tripped as strings while the type said Decimal.
  lifetimeResourcesProduced: encRecord<ResourceType>(src.lifetimeResourcesProduced),
  lifetimeResourcesSpent: encRecord<ResourceType>(src.lifetimeResourcesSpent),
  lifetimeCreditsEarned: encD(src.lifetimeCreditsEarned),
  lifetimeCreditsSpent: encD(src.lifetimeCreditsSpent),
  contractsCompleted: nonNegInt(src.contractsCompleted, 0),
  enemiesKilled: nonNegInt(src.enemiesKilled, 0),
  bossKills: nonNegInt(src.bossKills, 0),
  attacksDefended: nonNegInt(src.attacksDefended, 0),
  caravansDelivered: nonNegInt(src.caravansDelivered, 0),
  rareEventRewards: nonNegInt(src.rareEventRewards, 0),
  chainReactionsSurvived: nonNegInt(src.chainReactionsSurvived, 0),
  uniquePoliciesActivated: encArray(src.uniquePoliciesActivated, (p) => String(p)),
});

const decPlayerStats = (raw: unknown): PlayerStats => {
  const r = rec(raw);
  return {
    totalPlayTime: Math.max(0, num(r.totalPlayTime, 0)),
    sessionsCount: nonNegInt(r.sessionsCount, 0),
    currentSessionStart: num(r.currentSessionStart, 0),
    lifetimeResourcesProduced: decRecord<ResourceType>(r.lifetimeResourcesProduced),
    lifetimeResourcesSpent: decRecord<ResourceType>(r.lifetimeResourcesSpent),
    lifetimeCreditsEarned: decD(r.lifetimeCreditsEarned, 0),
    lifetimeCreditsSpent: decD(r.lifetimeCreditsSpent, 0),
    // Отсутствует в старых сейвах -> 0, а не undefined (иначе Math.floor(undefined/5) = NaN).
    contractsCompleted: nonNegInt(r.contractsCompleted, 0),
    // Те же правила для счётчиков событий: старый сейв даёт 0, а не undefined.
    enemiesKilled: nonNegInt(r.enemiesKilled, 0),
    bossKills: nonNegInt(r.bossKills, 0),
    attacksDefended: nonNegInt(r.attacksDefended, 0),
    caravansDelivered: nonNegInt(r.caravansDelivered, 0),
    rareEventRewards: nonNegInt(r.rareEventRewards, 0),
    chainReactionsSurvived: nonNegInt(r.chainReactionsSurvived, 0),
    uniquePoliciesActivated: decArray(r.uniquePoliciesActivated, (p) => String(p)),
  };
};

// ---------------------------------------------------------------- retention --

const encRetention = (src: RetentionState) => ({
  dailyLogin: {
    currentStreak: nonNegInt(src.dailyLogin?.currentStreak, 0),
    longestStreak: nonNegInt(src.dailyLogin?.longestStreak, 0),
    lastLoginDate: str(src.dailyLogin?.lastLoginDate, ''),
    totalLogins: nonNegInt(src.dailyLogin?.totalLogins, 0),
    currentDay: Math.max(1, int(src.dailyLogin?.currentDay, 1)),
    rewards: encArray(src.dailyLogin?.rewards, (d) => ({
      day: Math.max(1, int(d.day, 1)),
      claimed: bool(d.claimed, false),
      rewards: {
        credits: encDOpt(d.rewards?.credits),
        researchPoints: encDOpt(d.rewards?.researchPoints),
        influence: encDOpt(d.rewards?.influence),
        resources: encRecord<ResourceType>(d.rewards?.resources),
        artifact: strOrNull(d.rewards?.artifact),
      },
    })),
  },
  timeBasedRewards: {
    lastCollectionTime: num(src.timeBasedRewards?.lastCollectionTime, 0),
    collectionInterval: num(src.timeBasedRewards?.collectionInterval, 4 * 60 * 60 * 1000),
    maxStoredContainers: nonNegInt(src.timeBasedRewards?.maxStoredContainers, 2),
    containers: encArray(src.timeBasedRewards?.containers, (c) => ({
      id: str(c.id, makeId('container')),
      name: str(c.name, ''),
      availableAt: num(c.availableAt, 0),
      collected: bool(c.collected, false),
      rewards: {
        credits: encDOpt(c.rewards?.credits),
        researchPoints: encDOpt(c.rewards?.researchPoints),
        resources: encRecord<ResourceType>(c.rewards?.resources),
      },
    })),
  },
  stats: encPlayerStats(src.stats),
});

const decRetention = (raw: unknown): RetentionState => {
  const r = rec(raw);
  const daily = rec(r.dailyLogin);
  const timed = rec(r.timeBasedRewards);
  const defaults = INITIAL_RETENTION;
  return {
    dailyLogin: {
      currentStreak: nonNegInt(daily.currentStreak, 0),
      longestStreak: nonNegInt(daily.longestStreak, 0),
      // Resetting this to '' made claimDailyReward grantable again on every reload.
      lastLoginDate: str(daily.lastLoginDate, ''),
      totalLogins: nonNegInt(daily.totalLogins, 0),
      currentDay: Math.max(1, int(daily.currentDay, 1)),
      rewards: decArray(daily.rewards, (d) => {
        const rw = rec(d.rewards);
        const rewards: RetentionState['dailyLogin']['rewards'][number]['rewards'] = {};
        const credits = decDOpt(rw.credits);
        const researchPoints = decDOpt(rw.researchPoints);
        const influence = decDOpt(rw.influence);
        const artifact = strOrNull(rw.artifact);
        if (credits) rewards.credits = credits;
        if (researchPoints) rewards.researchPoints = researchPoints;
        if (influence) rewards.influence = influence;
        if (isRec(rw.resources)) rewards.resources = decRecord<ResourceType>(rw.resources);
        if (artifact) rewards.artifact = artifact;
        return {
          day: Math.max(1, int(d.day, 1)),
          claimed: bool(d.claimed, false),
          rewards,
        };
      }),
    },
    timeBasedRewards: {
      lastCollectionTime: num(
        timed.lastCollectionTime,
        defaults.timeBasedRewards.lastCollectionTime,
      ),
      collectionInterval: num(
        timed.collectionInterval,
        defaults.timeBasedRewards.collectionInterval,
      ),
      maxStoredContainers: nonNegInt(
        timed.maxStoredContainers,
        defaults.timeBasedRewards.maxStoredContainers,
      ),
      containers: decArray(timed.containers, (c) => {
        const rw = rec(c.rewards);
        const rewards: RetentionState['timeBasedRewards']['containers'][number]['rewards'] = {};
        const credits = decDOpt(rw.credits);
        const researchPoints = decDOpt(rw.researchPoints);
        if (credits) rewards.credits = credits;
        if (researchPoints) rewards.researchPoints = researchPoints;
        if (isRec(rw.resources)) rewards.resources = decRecord<ResourceType>(rw.resources);
        return {
          id: str(c.id, makeId('container')),
          name: str(c.name, ''),
          availableAt: num(c.availableAt, 0),
          collected: bool(c.collected, false),
          rewards,
        };
      }),
    },
    stats: decPlayerStats(r.stats),
  };
};

// ------------------------------------------------------- signalInterception --

const SIGNAL_TYPES = [
  'resource_cache',
  'production_boost',
  'research_burst',
  'energy_surge',
  'lucky_find',
  'time_warp',
  'golden_comet',
] as const;

const REWARD_TYPES = ['resources', 'boost', 'instant'] as const;

const encSignalInterception = (src: SignalInterceptionState) => ({
  activeSignal: src.activeSignal
    ? {
        id: str(src.activeSignal.id, makeId('signal')),
        type: oneOf(src.activeSignal.type, SIGNAL_TYPES, 'resource_cache'),
        position: {
          x: num(src.activeSignal.position?.x, 0.5),
          y: num(src.activeSignal.position?.y, 0.5),
        },
        spawnedAt: num(src.activeSignal.spawnedAt, 0),
        expiresAt: num(src.activeSignal.expiresAt, 0),
        duration: num(src.activeSignal.duration, 0),
        claimed: bool(src.activeSignal.claimed, false),
        reward: {
          type: oneOf(src.activeSignal.reward?.type, REWARD_TYPES, 'resources'),
          resources: encRecord<ResourceType>(src.activeSignal.reward?.resources),
          credits: encDOpt(src.activeSignal.reward?.credits),
          researchPoints: encDOpt(src.activeSignal.reward?.researchPoints),
          darkMatter: encDOpt(src.activeSignal.reward?.darkMatter),
          productionMultiplier:
            typeof src.activeSignal.reward?.productionMultiplier === 'number'
              ? src.activeSignal.reward.productionMultiplier
              : null,
          boostDuration:
            typeof src.activeSignal.reward?.boostDuration === 'number'
              ? src.activeSignal.reward.boostDuration
              : null,
          artifact: strOrNull(src.activeSignal.reward?.artifact),
        },
      }
    : null,
  activeBoosts: encArray(src.activeBoosts, (b) => ({
    id: str(b.id, makeId('boost')),
    type: str(b.type, 'production'),
    startedAt: num(b.startedAt, 0),
    expiresAt: num(b.expiresAt, 0),
    multiplier: num(b.multiplier, 1),
    affectedResources: encArray(b.affectedResources, (r) => String(r)),
  })),
  nextSignalAt: num(src.nextSignalAt, 0),
  totalSignalsCaught: nonNegInt(src.totalSignalsCaught, 0),
  totalSignalsMissed: nonNegInt(src.totalSignalsMissed, 0),
  signalFrequency: num(src.signalFrequency, 3.5),
  signalsEnabled: bool(src.signalsEnabled, true),
});

const decSignalInterception = (raw: unknown): SignalInterceptionState => {
  const r = rec(raw);
  const defaults = INITIAL_SIGNAL_INTERCEPTION;
  let activeSignal: SignalInterceptionState['activeSignal'] = null;
  if (isRec(r.activeSignal)) {
    const s = rec(r.activeSignal);
    const pos = rec(s.position);
    const rw = rec(s.reward);
    const reward: SignalInterceptionState['activeBoosts'] extends never
      ? never
      : NonNullable<SignalInterceptionState['activeSignal']>['reward'] = {
      type: oneOf(rw.type, REWARD_TYPES, 'resources'),
    };
    if (isRec(rw.resources)) reward.resources = decRecord<ResourceType>(rw.resources);
    const credits = decDOpt(rw.credits);
    const researchPoints = decDOpt(rw.researchPoints);
    const darkMatter = decDOpt(rw.darkMatter);
    if (credits) reward.credits = credits;
    if (researchPoints) reward.researchPoints = researchPoints;
    if (darkMatter) reward.darkMatter = darkMatter;
    if (typeof rw.productionMultiplier === 'number') {
      reward.productionMultiplier = rw.productionMultiplier;
    }
    if (typeof rw.boostDuration === 'number') reward.boostDuration = rw.boostDuration;
    const artifact = strOrNull(rw.artifact);
    if (artifact) reward.artifact = artifact;

    activeSignal = {
      id: str(s.id, makeId('signal')),
      type: oneOf(s.type, SIGNAL_TYPES, 'resource_cache'),
      position: { x: num(pos.x, 0.5), y: num(pos.y, 0.5) },
      spawnedAt: num(s.spawnedAt, 0),
      expiresAt: num(s.expiresAt, 0),
      duration: num(s.duration, 0),
      reward,
      claimed: bool(s.claimed, false),
    };
  }
  return {
    activeSignal,
    activeBoosts: decArray(r.activeBoosts, (b) => {
      const boost: SignalInterceptionState['activeBoosts'][number] = {
        id: str(b.id, makeId('boost')),
        type: str(b.type, 'production'),
        startedAt: num(b.startedAt, 0),
        expiresAt: num(b.expiresAt, 0),
        multiplier: num(b.multiplier, 1),
      };
      if (Array.isArray(b.affectedResources) && b.affectedResources.length > 0) {
        boost.affectedResources = b.affectedResources.filter(
          (x: unknown) => typeof x === 'string',
        ) as ResourceType[];
      }
      return boost;
    }),
    nextSignalAt: num(r.nextSignalAt, defaults.nextSignalAt),
    totalSignalsCaught: nonNegInt(r.totalSignalsCaught, 0),
    totalSignalsMissed: nonNegInt(r.totalSignalsMissed, 0),
    signalFrequency: num(r.signalFrequency, defaults.signalFrequency),
    signalsEnabled: bool(r.signalsEnabled, defaults.signalsEnabled),
  };
};

// ------------------------------------------------------------------- quests --

const encQuests = (src: QuestState) => ({
  activeQuests: cloneJson(src.activeQuests ?? [], []),
  completedQuests: encArray(src.completedQuests, (q) => String(q)),
});

const decQuests = (raw: unknown): QuestState => {
  const r = rec(raw);
  if (!Array.isArray(r.activeQuests) && !Array.isArray(r.completedQuests)) {
    // No quest data at all (fresh or pre-quest save) -> seed the starter chain.
    return {
      activeQuests: cloneJson(INITIAL_QUESTS.activeQuests, []),
      completedQuests: [],
    };
  }
  return {
    activeQuests: Array.isArray(r.activeQuests)
      ? cloneJson(r.activeQuests as QuestState['activeQuests'], [])
      : [],
    completedQuests: Array.isArray(r.completedQuests)
      ? r.completedQuests.filter((q: unknown) => typeof q === 'string')
      : [],
  };
};

// --------------------------------------------------------------------- maps --

const encMaps = (src: ActiveMapState) => cloneJson(src, INITIAL_MAPS);

const decMaps = (raw: unknown): ActiveMapState => {
  const r = rec(raw);
  return {
    currentMapId: (strOrNull(r.currentMapId) ?? INITIAL_MAPS.currentMapId) as ActiveMapState['currentMapId'],
    unlockedMaps: Array.isArray(r.unlockedMaps) && r.unlockedMaps.length > 0
      ? cloneJson(r.unlockedMaps as ActiveMapState['unlockedMaps'], [])
      : cloneJson(INITIAL_MAPS.unlockedMaps, []),
    mapProgress: isRec(r.mapProgress)
      ? cloneJson(r.mapProgress as ActiveMapState['mapProgress'], {})
      : {},
    activeMapData: isRec(r.activeMapData)
      ? cloneJson(r.activeMapData as ActiveMapState['activeMapData'], null)
      : null,
    mapSeed: num(r.mapSeed, INITIAL_MAPS.mapSeed),
    currentEvent: strOrNull(r.currentEvent),
    eventHistory: Array.isArray(r.eventHistory)
      ? r.eventHistory.filter((e: unknown) => typeof e === 'string')
      : [],
  };
};

// ------------------------------------------------------------------ culture --

interface SavedCulture {
  science: DecStr;
  culture: DecStr;
  currentLevel: number;
  cultureProgress: DecStr;
  sciencePerSecond: DecStr;
  culturePerSecond: DecStr;
  totalScienceProduced: DecStr;
  totalCultureProduced: DecStr;
  happiness: CultureState['happiness'];
  unlockedCultureBuildings: string[];
  aggregatedEffects: CultureState['aggregatedEffects'];
}

const encCulture = (src: CultureState): SavedCulture => ({
  science: encD(src.science),
  culture: encD(src.culture),
  currentLevel: Math.max(1, int(src.currentLevel, 1)),
  cultureProgress: encD(src.cultureProgress),
  sciencePerSecond: encD(src.sciencePerSecond),
  culturePerSecond: encD(src.culturePerSecond),
  totalScienceProduced: encD(src.totalScienceProduced),
  totalCultureProduced: encD(src.totalCultureProduced),
  happiness: cloneJson(src.happiness, INITIAL_CULTURE.happiness),
  unlockedCultureBuildings: encArray(src.unlockedCultureBuildings, (b) => String(b)),
  aggregatedEffects: cloneJson(src.aggregatedEffects, INITIAL_CULTURE.aggregatedEffects),
});

const decCulture = (raw: unknown): CultureState => {
  const r = rec(raw);
  return {
    science: decD(r.science, 0),
    culture: decD(r.culture, 0),
    currentLevel: Math.max(1, int(r.currentLevel, 1)),
    cultureProgress: decD(r.cultureProgress, 0),
    // Per-second rates are recomputed by the tick; restored so the very first paint
    // after a load is not a zero flash.
    sciencePerSecond: decD(r.sciencePerSecond, 0),
    culturePerSecond: decD(r.culturePerSecond, 0),
    totalScienceProduced: decD(r.totalScienceProduced, 0),
    totalCultureProduced: decD(r.totalCultureProduced, 0),
    happiness: isRec(r.happiness)
      ? cloneJson(r.happiness as CultureState['happiness'], INITIAL_CULTURE.happiness)
      : cloneJson(INITIAL_CULTURE.happiness, INITIAL_CULTURE.happiness),
    unlockedCultureBuildings: Array.isArray(r.unlockedCultureBuildings)
      ? r.unlockedCultureBuildings.filter((b: unknown) => typeof b === 'string')
      : [],
    aggregatedEffects: isRec(r.aggregatedEffects)
      ? cloneJson(
          r.aggregatedEffects as CultureState['aggregatedEffects'],
          INITIAL_CULTURE.aggregatedEffects,
        )
      : cloneJson(INITIAL_CULTURE.aggregatedEffects, INITIAL_CULTURE.aggregatedEffects),
  };
};

// ============================================================================
// SECTION 3 — the payload type + serializeGame
// ============================================================================

export interface GameSaveV1 {
  saveVersion: number;
  savedAt: number;

  resources: Record<string, SavedResource>;
  buildings: SavedBuildingCount[];
  currency: SavedCurrency;
  market: SavedMarket;
  combat: SavedCombat;
  grid: SavedGrid;
  research: SavedResearch;
  demons: SavedDemons;
  meta: SavedMeta;
  expedition: SavedExpedition;
  nanoSwarm: SavedNanoSwarm;
  ship: SavedShip;
  starChart: ReturnType<typeof encStarChart>;
  aegis: ReturnType<typeof encAegis>;
  productionMatrix: ReturnType<typeof encProductionMatrix>;
  quantumNet: ReturnType<typeof encQuantumNet>;
  politics: ReturnType<typeof encPolitics>;
  galaxies: SavedGalaxies;
  fleet: SavedFleet;
  pollution: SavedPollution;
  intergalacticLogistics: SavedIntergalacticLogistics;
  randomEvents: ReturnType<typeof encRandomEvents>;
  achievements: ReturnType<typeof encAchievements>;
  megastructures: ReturnType<typeof encMegastructures>;
  endgame: ReturnType<typeof encEndgame>;
  prestige: SavedPrestige;
  ascension: ReturnType<typeof encAscension>;
  repeatableResearch: ReturnType<typeof encRepeatableResearch>;
  proceduralGalaxies: ReturnType<typeof encProceduralGalaxies>;
  artifacts: ReturnType<typeof encArtifacts>;
  retention: ReturnType<typeof encRetention>;
  signalInterception: ReturnType<typeof encSignalInterception>;
  quests: ReturnType<typeof encQuests>;
  maps: ActiveMapState;
  culture: SavedCulture;
  lastTick: number;
  stats: SavedPlayerStats;
  energy: { production: DecStr; consumption: DecStr; efficiency: number };
}

/**
 * THE serializer. Covers every progression-bearing slice of GameState.
 * The result is plain JSON: no Decimal instances, no `undefined`, no functions.
 */
export function serializeGame(state: GameState): GameSaveV1 {
  const now = Date.now();
  return {
    saveVersion: SAVE_VERSION,
    savedAt: now,

    resources: encResources(state.resources),
    buildings: encBuildingCounts(state.buildings),
    currency: encCurrency(state.currency),
    market: encMarket(state.market),
    combat: encCombat(state.combat),
    grid: encGrid(state.grid),
    research: encResearch(state.research),
    demons: encDemons(state.demons),
    meta: encMeta(state.meta),
    expedition: encExpedition(state.expedition),
    nanoSwarm: encNanoSwarm(state.nanoSwarm),
    ship: encShip(state.ship),
    starChart: encStarChart(state.starChart),
    aegis: encAegis(state.aegis),
    productionMatrix: encProductionMatrix(state.productionMatrix),
    quantumNet: encQuantumNet(state.quantumNet),
    politics: encPolitics(state.politics),
    galaxies: encGalaxies(state.galaxies),
    fleet: encFleet(state.fleet),
    pollution: encPollution(state.pollution),
    intergalacticLogistics: encIntergalacticLogistics(state.intergalacticLogistics),
    randomEvents: encRandomEvents(state.randomEvents),
    achievements: encAchievements(state.achievements),
    megastructures: encMegastructures(state.megastructures),
    endgame: encEndgame(state.endgame),
    prestige: encPrestige(state.prestige),
    ascension: encAscension(state.ascension),
    repeatableResearch: encRepeatableResearch(state.repeatableResearch),
    proceduralGalaxies: encProceduralGalaxies(state.proceduralGalaxies),
    artifacts: encArtifacts(state.artifacts),
    retention: encRetention(state.retention),
    signalInterception: encSignalInterception(state.signalInterception),
    quests: encQuests(state.quests),
    maps: encMaps(state.maps),
    culture: encCulture(state.culture),
    lastTick: num(state.lastTick, now),
    stats: {
      ...encPlayerStats(state.stats),
      // Fold the live session into totalPlayTime, exactly as the old serializers did.
      totalPlayTime:
        Math.max(0, num(state.stats?.totalPlayTime, 0)) +
        Math.max(0, Math.floor((now - num(state.stats?.currentSessionStart, now)) / 1000)),
    },
    energy: {
      production: encD(state.energyProduction),
      consumption: encD(state.energyConsumption),
      efficiency: num(state.energyEfficiency, 1),
    },
  };
}

// ============================================================================
// SECTION 4 — migrateSave
// ============================================================================

type MigrationStep = (save: AnyRec) => AnyRec;

/**
 * v0 -> v1.
 *
 * v0 is "any save written before this module existed": no `saveVersion` field, and
 * missing every slice the old serializers forgot. Nothing it DOES contain is dropped
 * here — the missing slices are filled from INITIAL_* by `deserializeGame`, which is
 * total. The only structural repair needed is the platform shield key: both old
 * loaders converted a field that does not exist (`maxShieldHp`) and left the real
 * `shieldMaxHp` as a raw string, so every loaded platform carried a phantom
 * `maxShieldHp: Decimal(0)`.
 */
const migrateV0toV1: MigrationStep = (save) => {
  const next: AnyRec = { ...save };

  const galaxies = rec(next.galaxies);
  if (Array.isArray(galaxies.platforms)) {
    next.galaxies = {
      ...galaxies,
      platforms: galaxies.platforms.map((p: unknown) => {
        const platform = { ...rec(p) };
        const canonical =
          platform.shieldMaxHp !== undefined && platform.shieldMaxHp !== null
            ? platform.shieldMaxHp
            : platform.maxShieldHp;
        platform.shieldMaxHp = canonical ?? 0;
        delete platform.maxShieldHp;
        return platform;
      }),
    };
  }

  next.saveVersion = 1;
  return next;
};

/** version -> step that upgrades it to version+1. */
const MIGRATIONS: Record<number, MigrationStep> = {
  0: migrateV0toV1,
};

/**
 * Bring any save payload up to SAVE_VERSION. Never throws: unusable input becomes an
 * empty save, which `deserializeGame` turns into a fully playable INITIAL state.
 */
export function migrateSave(raw: any): AnyRec {
  let save: AnyRec = isRec(raw) ? { ...raw } : {};

  let version = typeof save.saveVersion === 'number' && Number.isFinite(save.saveVersion)
    ? Math.trunc(save.saveVersion)
    : 0;

  // A save from the future: leave the payload alone. Every decoder is defensive, so
  // known fields still load and unknown ones are ignored.
  if (version > SAVE_VERSION) return save;

  let guard = 0;
  while (version < SAVE_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) {
      // No path forward: stamp the version and let the total decoder do its job.
      save.saveVersion = SAVE_VERSION;
      break;
    }
    try {
      save = step(save);
    } catch (e) {
      console.warn(`[gameSave] migration v${version} failed, continuing defensively`, e);
      save.saveVersion = version + 1;
    }
    const nextVersion = typeof save.saveVersion === 'number' ? Math.trunc(save.saveVersion) : version + 1;
    version = Math.max(nextVersion, version + 1);
    if (++guard > 64) break;
  }

  return save;
}

// ============================================================================
// SECTION 5 — deserializeGame
// ============================================================================

/**
 * THE deserializer. TOTAL by construction: every slice has an INITIAL_* fallback, no
 * field can come back `undefined`, and a null / empty / truncated / hostile payload
 * yields a fully playable state instead of throwing.
 *
 * `resources.max`, building counts and grid geometry are recomputed by the store after
 * this returns (recomputeCaps / counts-from-tiles / ensureGridSize) — this function's
 * job is purely to turn bytes back into correctly typed values.
 */
export function deserializeGame(raw: unknown): Partial<GameState> {
  const save = rec(raw);

  return {
    resources: decResources(save.resources),
    buildings: decBuildings(save.buildings),
    currency: decCurrency(save.currency),
    market: decMarket(save.market),
    combat: decCombat(save.combat),
    grid: decGrid(save.grid, DEFAULT_GRID as unknown as GridState),
    research: decResearch(save.research),
    demons: decDemons(save.demons),
    meta: decMeta(save.meta),
    expedition: decExpedition(save.expedition),
    nanoSwarm: decNanoSwarm(save.nanoSwarm),
    ship: decShip(save.ship),
    starChart: decStarChart(save.starChart),
    aegis: decAegis(save.aegis),
    productionMatrix: decProductionMatrix(save.productionMatrix),
    quantumNet: decQuantumNet(save.quantumNet),
    politics: decPolitics(save.politics),
    galaxies: decGalaxies(save.galaxies),
    fleet: decFleet(save.fleet),
    pollution: decPollution(save.pollution),
    intergalacticLogistics: decIntergalacticLogistics(save.intergalacticLogistics),
    randomEvents: decRandomEvents(save.randomEvents),
    achievements: decAchievements(save.achievements),
    megastructures: decMegastructures(save.megastructures),
    endgame: decEndgame(save.endgame),
    prestige: decPrestige(save.prestige),
    ascension: decAscension(save.ascension),
    repeatableResearch: decRepeatableResearch(save.repeatableResearch),
    proceduralGalaxies: decProceduralGalaxies(save.proceduralGalaxies),
    artifacts: decArtifacts(save.artifacts),
    retention: decRetention(save.retention),
    signalInterception: decSignalInterception(save.signalInterception),
    quests: decQuests(save.quests),
    maps: decMaps(save.maps),
    culture: decCulture(save.culture),
    lastTick: num(save.lastTick, Date.now()),
    stats: decPlayerStats(save.stats),
    energyProduction: decD(rec(save.energy).production, 0),
    energyConsumption: decD(rec(save.energy).consumption, 0),
    energyEfficiency: num(rec(save.energy).efficiency, 1),
  };
}

/**
 * Convenience wrapper: migrate + deserialize in one call. This is what the store uses,
 * so the two steps can never be applied in the wrong order or one of them skipped.
 */
export function loadSavePayload(raw: unknown): Partial<GameState> {
  try {
    return deserializeGame(migrateSave(raw));
  } catch (e) {
    // Belt and braces: a decoder bug must never brick a player's game.
    console.error('[gameSave] deserialization failed, falling back to a clean state', e);
    return deserializeGame({});
  }
}
