import { create } from 'zustand';
import type Decimal from 'break_eternity.js';
import type {
  AegisState,
  Building,
  CombatState,
  Contract,
  CurrencyState,
  DemonId,
  DemonsState,
  DepositType,
  Enemy,
  ExpeditionState,
  GalaxiesState,
  GameState,
  GridCoord,
  IntergalacticLogisticsState,
  MarketEvent,
  MarketState,
  MetaState,
  NanoSwarmChannel,
  NanoSwarmState,
  PoliticsState,
  ProductionMatrixState,
  ProductionMatrixUpgradeId,
  QuantumNetState,
  QuantumNetUpgradeId,
  RandomEvent,
  RandomEventsState,
  ResearchState,
  ResourceType,
  ShipModuleId,
  ShipState,
  StarChartState,
  TradeResourceType,
  TradingOrder,
  MegastructureId,
  EndingId,
} from '../core/gameTypes';
import { D } from '../core/math/format.ts';
// NOTE: ./gameSave imports the INITIAL_* constants back from this module, so these two form
// an import cycle. It is safe because every cross-module reference happens inside a function
// body (serializeGame/loadSavePayload are called from actions; the INITIAL_* are read inside
// decoders), never at module-evaluation time — ESM live bindings are already initialised by
// the time either side runs.
import { serializeGame, loadSavePayload } from './gameSave';
// Финансы — отдельный store, поэтому их снимок добавляется к payload здесь, а не внутри
// serializeGame (который работает только с GameState).
import { serializeFinance, hydrateFinance } from './financeStore';
import { baseResearchPointsPerSecond, baseInfluencePerSecond } from '../core/production/currencyRates';
import { loadCurrentSaveIdFromServer, saveCurrentSaveIdToServer, getAuthHeaders, isAuthenticated } from '../utils/settingsApi';
import { isBuildingDisableable } from '../core/constants/buildingCategories';
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
  computeAegisShieldBoostMultiplier,
  computeAegisTurretOverdriveMultiplier,
  computeAegisAutoRepairPerSecond,
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
import { updateAllProximityMultipliers } from '../utils/proximityHelpers';
import { getProximityRulesForBuilding } from '../core/constants/proximityRules';
import { TECHNOLOGIES, canResearchTechnology } from '../core/constants/technologies';
import { getEvolutionMultiplier } from '../core/constants/buildingEvolutions';
import { POLICIES, canActivatePolicy } from '../core/constants/policies';
import { aggregatePolicyEffects } from '../core/production/policyEffects';
import { GALAXIES } from '../core/constants/galaxies';
import { SHIP_DEFINITIONS, calculateShipStats, calculateShipUpgradeCost, generateShipName } from '../core/constants/ships';
import { type EnemyType, ENEMY_DEFINITIONS, getBossForLevel, createPlatformEnemy } from '../core/constants/enemies';
import { calculateLogisticsEfficiency } from '../utils/logisticsHelpers';
import { EVENT_CONFIGS, EVENT_EFFECTS, BASE_EVENT_INTERVAL_MIN, BASE_EVENT_INTERVAL_MAX } from '../core/constants/randomEvents';
import { getAchievementById } from '../core/constants/achievements';
import { MEGASTRUCTURES, GAME_ENDINGS, canBuildMegastructure, getMegastructureRewards, checkEndingRequirements } from '../core/constants/megastructures';
import { PRESTIGE_UPGRADES, calculateQuantumPoints, canBuyPrestigeUpgrade, getTotalPrestigeBonuses } from '../core/constants/prestige';
import { calculateArtifactBonuses, calculateMaxSlots, calculateUsedSlots, shouldDropArtifactFromGalaxy, generateGalaxyArtifact } from '../utils/artifactHelpers';
import { STARTER_QUESTS } from '../core/constants/quests';
import { getTotalRepeatableBonuses, isExoticResource, getMaxLevelPerAscension, calculateRepeatableCost } from '../utils/repeatableResearchHelpers';
import { shouldSpawnSignal, spawnSignal, calculateNextSignalTime, removeExpiredBoosts, isSignalExpired, getSignalRewardDescription, createBoostFromReward } from '../utils/signalHelpers';
import { REPEATABLE_RESEARCHES } from '../core/constants/repeatableResearch';
import { BUILDING_EVOLUTIONS, getNextEvolution } from '../core/constants/buildingEvolutions';
import { generateGalaxy, getDiscoveryCost } from '../utils/galaxyGenerator';
import { generateMap } from '../utils/mapGenerator';
import { getMapDefinition } from '../core/constants/maps';
import { CULTURE_BUILDINGS, isCultureBuilding, aggregateCultureEffects } from '../core/constants/cultureBuildings';
import { getCultureLevel, getCultureProgress } from '../core/constants/cultureLevels';
import { calculateHappiness, calculateHappinessTrend, smoothHappinessTransition } from '../utils/happinessCalculator';
import type { PrestigeUpgradeId } from '../core/gameTypes';
import type { GeneratedMapData, MapId } from '../core/gameTypes.maps';
import type { Quest, QuestState } from '../core/gameTypes.tutorial';
import type { 
  TileBuildingSettings, 
  BuildingMode,
  ResourcePriority,
  AutoSellConfig,
  StorageLimit,
  BuildingCondition 
} from '../core/gameTypes.buildings';
import {
  BUILDING_MODES,
  createDefaultTileSettings,
} from '../core/gameTypes.buildings';

const MARKET_UPDATE_SECONDS = 30;

/*
 * Контракты — один из немногих повторяемых источников очков исследований на раннем этапе
 * (второй — квесты), поэтому они обязаны появляться сами. Интервал выбран по сроку жизни
 * самих контрактов: они живут 3–7 минут, так что при выдаче раз в 90 секунд у игрока
 * стабильно висит 2–4 штуки, но список не забивается мгновенно.
 */
const CONTRACT_SPAWN_INTERVAL_SECONDS = 90;
/** Потолок одновременно висящих контрактов: панель на большее не рассчитана. */
const MAX_ACTIVE_CONTRACTS = 5;

/*
 * Таймер выдачи живёт в модуле, а не в MarketState, по двум причинам: в срезе нет такого
 * поля (тип общий с сервером), и таймер НЕ должен переживать перезагрузку — иначе после
 * ночи офлайна накопился бы «долг» и контракты высыпались бы пачкой.
 * Значение всегда выставляется как now + интервал (не += ), поэтому серия догоняющих
 * шагов тика в одном кадре не может выдать больше одного контракта.
 */
let nextContractAt = 0;

/**
 * Единственная фабрика контрактов: и ручной generateContract, и автовыдача в тике идут
 * через неё. Раньше существовали две разошедшиеся копии — у той, что в тике, не было ни
 * speedBonus, ни acceptedAt, ни зависящего от сложности срока.
 */
function createContract(now: number): Contract {
  const tiers = ['easy', 'medium', 'hard', 'epic'] as const;
  const tier = tiers[Math.floor(Math.random() * tiers.length)];

  // Требования по ресурсам зависят от сложности
  const multipliers = { easy: 50, medium: 200, hard: 800, epic: 3000 };
  const mult = multipliers[tier];

  const resources: TradeResourceType[] = ['ore', 'ice', 'carbon', 'steel'];
  const reqCount = tier === 'easy' ? 1 : tier === 'medium' ? 2 : tier === 'hard' ? 3 : 4;
  // sort() перемешивает копию, а не сам массив-константу: иначе порядок утекал бы между вызовами.
  const selectedResources = [...resources].sort(() => Math.random() - 0.5).slice(0, reqCount);

  const requirements: Partial<Record<ResourceType, Decimal>> = {};
  selectedResources.forEach(res => {
    requirements[res] = D(mult * (0.5 + Math.random()));
  });

  const creditRewards = { easy: 100, medium: 500, hard: 2500, epic: 15000 };
  const rpRewards = { easy: 5, medium: 20, hard: 100, epic: 500 };
  const influenceRewards = { easy: 1, medium: 5, hard: 25, epic: 150 };

  // Срок жизни в миллисекундах: 3, 4, 5 и 7 минут
  const durations = { easy: 180000, medium: 240000, hard: 300000, epic: 420000 };

  return {
    id: `contract_${now}_${Math.random().toString(36).slice(2, 11)}`,
    title: `Контракт уровня ${tier === 'easy' ? 'Лёгкий' : tier === 'medium' ? 'Средний' : tier === 'hard' ? 'Сложный' : 'Эпический'}`,
    description: `Доставьте необходимые ресурсы`,
    requirements,
    rewards: {
      credits: D(creditRewards[tier]),
      researchPoints: D(rpRewards[tier]),
      influence: D(influenceRewards[tier]),
    },
    // Бонус за скорость: +50% наград, если уложиться в половину срока
    speedBonus: {
      credits: D(creditRewards[tier] * 0.5),
      researchPoints: D(rpRewards[tier] * 0.5),
      influence: D(influenceRewards[tier] * 0.5),
    },
    acceptedAt: now, // контракт считается принятым в момент выдачи
    expiresAt: now + durations[tier],
    tier,
  };
}

/**
 * Единственное место, где растёт прогресс квестов.
 *
 * Раньше эта пятистрочная выкладка была скопирована в каждый обработчик, и копий было
 * ровно три — на постройку, на исследование и на продажу. Из-за этого четыре квеста
 * (`explore`, `combat`, build+platform, build+ship) не имели обработчика вовсе: их некуда
 * было дописать, не продублировав код ещё раз.
 *
 * Награду выдаёт claimQuestReward: он требует isCompleted и переносит квест в
 * completedQuests, поэтому заплатить дважды за один квест нельзя, сколько бы раз сюда ни
 * пришло событие.
 *
 * Возвращает ИСХОДНЫЙ объект, если ничего не изменилось: quests — срез Zustand, и новая
 * ссылка на каждом тике перерисовывала бы список задач впустую.
 */
function advanceQuests(
  quests: QuestState,
  matches: (quest: Quest) => boolean,
  step = 1,
): QuestState {
  let changed = false;
  const activeQuests = quests.activeQuests.map((quest) => {
    if (quest.isCompleted || !matches(quest)) return quest;
    changed = true;
    const newAmount = (quest.currentAmount || 0) + step;
    // targetAmount не задан — квест одноразовый, засчитываем сразу.
    const isCompleted = quest.targetAmount ? newAmount >= quest.targetAmount : true;
    return { ...quest, currentAmount: newAmount, isCompleted };
  });
  return changed ? { ...quests, activeQuests } : quests;
}

const WAVE_INTERVAL_SECONDS = 60;
const WAVE_DURATION_SECONDS = 18;
const SPAWN_INTERVAL_SECONDS = 1.8;
const BASE_MAX_HP = D(100);
const ENEMY_IMPACT_DAMAGE = D(12);

// Base HP mechanics
const BASE_REGEN_PER_SECOND = D(0.5); // HP восстановление вне боя
const BASE_REGEN_COOLDOWN_SECONDS = 5; // Задержка после атаки перед регеном
const BASE_DAMAGE_PRODUCTION_PENALTY_MAX = 0.5; // Максимальный штраф производства (50%) при HP = 0
const EMERGENCY_REPAIR_COST_ENERGY = D(500); // Стоимость экстренного ремонта
const EMERGENCY_REPAIR_COST_STEEL = D(50);
const EMERGENCY_REPAIR_HP = D(50); // Сколько HP восстанавливает экстренный ремонт

// ОПТИМИЗАЦИЯ: Кэшированные Decimal константы (избегаем создания новых объектов каждый тик)
const D_ZERO = D(0);

// LOGISTICS CACHE: Persists between ticks to avoid O(N^2) calculations
// Stores pre-calculated sorted lists of sources for each consumer
let logisticsCache: {
  tilesCount: number; // Количество тайлов для быстрой проверки
  tilesKeys: string; // Сериализованные ключи для точной проверки (строится редко)
  routes: Record<string, Partial<Record<ResourceType, string[]>>>;
} = {
  tilesCount: 0,
  tilesKeys: '',
  routes: {}
};

/*
 * Множитель ёмкости энергохранилищ от политик (specials.energyStorage).
 *
 * Живёт модульной переменной, а не параметром recomputeCaps, потому что вызовов у неё 19
 * (постройка, продажа, апгрейд, загрузка сейва, тик...), и любой пропущенный вызов не просто
 * потерял бы бонус, а СРЕЗАЛ бы накопленную энергию: recomputeCaps в конце зажимает
 * amount по свежему max. Единое значение исключает такое расхождение между вызовами.
 */
let policyEnergyStorageMult = 1;

/** Обновляется из тика и из активации/деактивации политик, чтобы caps не отставали на тик. */
const setPolicyEnergyStorageMult = (mult: number) => {
  policyEnergyStorageMult = Number.isFinite(mult) && mult > 0 ? mult : 1;
};

// Вспомогательная функция для проверки изменений в tiles
function tilesChangedForLogistics(tiles: Record<string, string>): boolean {
  const count = Object.keys(tiles).length;
  // Быстрая проверка по количеству
  if (count !== logisticsCache.tilesCount) return true;
  // Если количество совпадает, проверяем ключи (дорого, но редко)
  const keys = Object.keys(tiles).sort().join(',');
  return keys !== logisticsCache.tilesKeys;
}

// PRODUCTION RATES CACHE: Пересчитываем только при изменении сетки/зданий
// Это экономит O(N*M) операций каждый тик где N=tiles, M=resources
let productionRatesCache: {
  tilesCount: number;
  tileLevelsRef: any;
  tileEvolutionLevelsRef: any;
  tileSettingsRef: any; // ФАЗА 5
  tileDisabledRef: any; // ФАЗА 5
  /*
   * Ссылка на activePolicies. В кэшированные ставки теперь вмешаны множители политик,
   * поэтому переключение политики обязано его сбрасывать — иначе игрок видел бы старые
   * цифры до ближайшей постройки. Сравниваем по ссылке: activatePolicy/deactivatePolicy
   * всегда создают новый массив, а мутации массива на месте в сторе нет.
   */
  activePoliciesRef: readonly string[] | null;
  buildingsCount: number;
  rates: Record<ResourceType, Decimal> | null;
  lastCalculatedAt: number;
} = {
  tilesCount: 0,
  tileLevelsRef: null,
  tileEvolutionLevelsRef: null,
  tileSettingsRef: null, // ФАЗА 5
  tileDisabledRef: null, // ФАЗА 5
  activePoliciesRef: null,
  buildingsCount: 0,
  rates: null,
  lastCalculatedAt: 0,
};

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
  technologies: {
    // Era 1: Starting technology
    basic_mining: true,
    simple_power: false,
    basic_processing: false,
    solar_panels: false,
    // Era 2
    gas_exploration: false,
    oil_drilling: false,
    advanced_processing: false,
    plastics_glass: false,
    semiconductors: false,
    gas_power: false,
    // Era 3
    microchips: false,
    computers: false,
    displays: false,
    robotics: false,
    automation: false,
    // Era 4
    advanced_weapons: false,
    artillery: false,
    defense_systems: false,
    radar_tech: false,
    nuclear_physics: false,
    nuclear_power: false,
    advanced_defense: false,
    // Era 5
    rocket_science: false,
    satellites: false,
    spaceships: false,
    interplanetary: false,
    first_colony: false,
    // Era 6
    intergalactic_gates: false,
    space_stations: false,
    quantum_tech: false,
    advanced_colonies: false,
    galactic_fleet: false,
    // Era 6: Развлечения и Культура - Фаза 3
    entertainment_industry: false,
    digital_media: false,
    cultural_renaissance: false,
    // Era 7
    megastructures: false,
    time_control: false,
    quantum_teleport: false,
    ai_restoration: false,
    galactic_rule: false,
    // Era 7: Социальные сети и Биотех - Фаза 3
    social_engineering: false,
    cloud_computing: false,
    biotechnology: false,
    genetic_engineering: false,
    // Era 8: Мегаструктуры - Фаза 3
    megastructure_engineering: false,
    warp_physics: false,
    antimatter_synthesis: false,
    // Era 9: Трансцендентность - Фаза 3
    singularity_science: false,
    transcendence: false,
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
  brokerExcludeFromAutoSell: {} as Record<TradeResourceType, boolean>,
};

const INITIAL_META: MetaState = {
  qubits: D(0),
  lifetimeEnergyProduced: D(0),
  blueprints: D(0),
};

const INITIAL_CURRENCY = {
  credits: D(1000),
  researchPoints: D(0),
  influence: D(0),
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
    shield_boost: 0,
    turret_overdrive: 0,
    auto_repair: 0,
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

const INITIAL_POLITICS: import('../core/gameTypes').PoliticsState = {
  activePolicies: [],
  maxActivePolicies: 3, // Start with 3 active policy slots
};

const INITIAL_GALAXIES: import('../core/gameTypes').GalaxiesState = {
  currentGalaxyId: 'galaxy_1_nebula_beginning',
  unlockedGalaxies: ['galaxy_1_nebula_beginning'],
  platforms: [],
  autoTransportEnabled: false,
  fuelReserve: D(1000), // Начальный запас топлива
  notifications: [],
};

const INITIAL_FLEET: import('../core/gameTypes').FleetState = {
  ships: [],
  autoDefend: true,
  productionQueue: [],
};

const INITIAL_POLLUTION: import('../core/gameTypes').PollutionState = {
  wasteAmount: D(0),
  radioactiveWasteAmount: D(0),
  efficiencyMultiplier: 1.0,
  pollutionZones: [],
};

const INITIAL_INTERGALACTIC_LOGISTICS: import('../core/gameTypes').IntergalacticLogisticsState = {
  caravans: [],
  upgrades: {
    speed: 0,
    capacity: 0,
    defense: 0,
  },
  autoSendToMainBase: false,
  autoRoutes: [],
};

const INITIAL_RANDOM_EVENTS: RandomEventsState = {
  activeEvents: [],
  eventHistory: [],
  nextEventAt: Date.now() + BASE_EVENT_INTERVAL_MIN,
  eventsEnabled: true,
  eventFrequencyMultiplier: 1.0,
};

const INITIAL_ACHIEVEMENTS: import('../core/gameTypes').AchievementsState = {
  unlocked: {},
  recentlyUnlocked: [],
};

const INITIAL_MEGASTRUCTURES: import('../core/gameTypes').MegastructuresState = {
  built: {},
  constructionQueue: [],
};

const INITIAL_ENDGAME: import('../core/gameTypes').EndgameState = {
  endings: {},
  currentEndingProgress: {},
  victoryAchieved: false,
};

const INITIAL_PRESTIGE: import('../core/gameTypes').PrestigeState = {
  lifetimeQuantumPoints: 0,
  availableQuantumPoints: 0,
  prestigeCount: 0,
  upgrades: {},
  stats: {
    totalPlaytime: 0,
    totalCreditsEarned: D(0),
    totalResearchPoints: D(0),
    maxBuildingsBuilt: 0,
    endingsAchieved: [],
  },
  fastModeEnabled: false,
};

// ============================================================================
// Ascension System - Initial State (infinitely.md Phase 2)
// ============================================================================
const INITIAL_ASCENSION: import('../core/gameTypes').AscensionState = {
  ascensionCount: 0,
  ascensionPoints: 0,
  lifetimeAscensionPoints: 0,
  requirements: {
    minPrestigeCount: 10,
    minQuantumPoints: 1_000_000,
    allMegastructures: true,
  },
  multipliers: {
    qpGain: 1.0,
    globalProduction: 1.0,
    researchSpeed: 1.0,
    startingCredits: 0,
  },
  unlocks: {
    infiniteResearch: false,
    buildingEvolution: false,
    proceduralGalaxies: false,
  },
  stats: {
    totalAscensionTime: 0,
    fastestAscension: 0,
    totalQuantumPointsEarned: 0,
  },
};

// ============================================================================
// Repeatable Research - Initial State (infinitely.md Phase 3)
// ============================================================================
const INITIAL_REPEATABLE_RESEARCH: import('../core/gameTypes').RepeatableResearchState = {
  researches: {},
  totalLevelsThisAscension: 0,
  stats: {},
  history: [],
};

// ============================================================================
// Procedural Galaxies - Initial State (infinitely.md Phase 5)
// ============================================================================
const INITIAL_PROCEDURAL_GALAXIES: import('../core/gameTypes').ProceduralGalaxyState = {
  galaxies: [],
  currentSeed: Date.now(),
  totalDiscovered: 0,
};

// ============================================================================
// Artifacts - Initial State (infinitely.md Phase 6)
// ============================================================================
const INITIAL_ARTIFACTS: import('../core/gameTypes').ArtifactState = {
  discovered: [],
  equipped: [],
  maxSlots: 2,
  usedSlots: 0,
  totalFound: 0,
  totalUpgraded: 0,
};

// Retention - Initial State (infinitely.md - Retention Mechanics)
// ============================================================================
const INITIAL_RETENTION: import('../core/gameTypes').RetentionState = {
  dailyLogin: {
    currentStreak: 0,
    longestStreak: 0,
    lastLoginDate: '',
    totalLogins: 0,
    rewards: [], // Will be generated on first load
    currentDay: 1,
  },
  timeBasedRewards: {
    containers: [],
    lastCollectionTime: Date.now(),
    collectionInterval: 4 * 60 * 60 * 1000, // 4 hours
    maxStoredContainers: 2,
  },
  stats: {
    totalPlayTime: 0,
    sessionsCount: 0,
    currentSessionStart: Date.now(),
    lifetimeResourcesProduced: {},
    lifetimeResourcesSpent: {},
    lifetimeCreditsEarned: D(0),
    lifetimeCreditsSpent: D(0),
    contractsCompleted: 0,
  },
};

// Signal Interception - Initial State (infinitely.md - Active Play Bonuses)
// Signal Interception - Initial State (infinitely.md - Active Play Bonuses)
// ============================================================================
const INITIAL_SIGNAL_INTERCEPTION: import('../core/gameTypes').SignalInterceptionState = {
  activeSignal: null,
  activeBoosts: [],
  nextSignalAt: Date.now() + (3 * 60 * 1000), // Первый сигнал через 3 минуты
  totalSignalsCaught: 0,
  totalSignalsMissed: 0,
  signalFrequency: 3.5, // Среднее между 2 и 5 минутами
  signalsEnabled: true,
};

// Maps - Initial State (Phase 4)
// ============================================================================
const INITIAL_MAPS: import('../core/gameTypes.maps').ActiveMapState = {
  currentMapId: 'map_training_ground',
  unlockedMaps: ['map_training_ground', 'map_barren_moon'],
  mapProgress: {},
  activeMapData: null,
  mapSeed: Date.now(),
  currentEvent: null,
  eventHistory: [],
};

// Culture - Initial State (Phase 7)
// ============================================================================
const INITIAL_CULTURE: import('../core/gameTypes.culture').CultureState = {
  science: D(0),
  culture: D(0),
  currentLevel: 1,
  cultureProgress: D(0),
  sciencePerSecond: D(0),
  culturePerSecond: D(0),
  totalScienceProduced: D(0),
  totalCultureProduced: D(0),
  happiness: {
    current: 50,
    factors: [],
    productivityMultiplier: 1.0,
    trend: 'stable',
    lastUpdated: Date.now(),
  },
  unlockedCultureBuildings: [],
  aggregatedEffects: {
    globalProductivity: 1.0,
    buildingDurability: 1.0,
    researchSpeed: 1.0,
    buildingCost: 1.0,
    tradePrices: 1.0,
    creditsPerSale: 1.0,
    pollutionReduction: 1.0,
  },
};

// Quests - Initial State
// ============================================================================
const INITIAL_QUESTS: import('../core/gameTypes.tutorial').QuestState = {
  activeQuests: [...STARTER_QUESTS],
  completedQuests: [],
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
    description: "Старый, но надежный генератор. Вырабатывает мало энергии. Радиус покрытия: 3 клетки.",
    baseCost: { energy: D(5) },
    creditCost: D(50),
    costFactor: 1.15,
    production: { energy: D(1) },
    powerGridRadius: 3,
    count: 0
  },
  {
    id: 'battery_mk1',
    name: 'Малый Конденсатор',
    description: "Увеличивает лимит хранения энергии.",
    baseCost: { energy: D(50) },
    creditCost: D(150),
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
    creditCost: D(250),
    costFactor: 1.15,
    production: { ore: D(0.6) },
    energyConsumption: D(1.8),
    count: 0
  },
  {
    id: 'ice_extractor_mk1',
    name: 'Экстрактор Льда v1',
    description: "Собирает водяной лед из фрагментов астероидов.",
    baseCost: { energy: D(120) },
    creditCost: D(280),
    costFactor: 1.15,
    production: { ice: D(0.4) },
    energyConsumption: D(1.8),
    count: 0
  },
  {
    id: 'carbon_harvester_mk1',
    name: 'Сборщик Углерода v1',
    description: "Извлекает углерод из пылевых облаков и шлама.",
    baseCost: { energy: D(140) },
    creditCost: D(320),
    costFactor: 1.15,
    production: { carbon: D(0.3) },
    energyConsumption: D(1.5),
    count: 0
  },
  {
    id: 'warehouse_mk1',
    name: 'Складской Модуль',
    description: 'Увеличивает вместимость центральной БАЗЫ для всех ресурсов за уровень (сырьё/переработка/космос/спец.). Улучшает логистику в радиусе 2 клеток.',
    baseCost: { energy: D(250), ore: D(25) },
    creditCost: D(500),
    costFactor: 1.15,
    production: {},
    productionMultipliers: { ore: D(500), ice: D(500), carbon: D(500), steel: D(200) },
    energyConsumption: D(0.5),
    logisticsRadius: 2,
    count: 0
  },
  {
    id: 'steel_smelter_mk1',
    name: 'Плавильня: Сталь',
    description: "Переработка: Железная руда + Углерод -> Сталь.",
    baseCost: { energy: D(400), ore: D(120), carbon: D(60) },
    creditCost: D(800),
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
    creditCost: D(1200),
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
    creditCost: D(1400),
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
    creditCost: D(3000),
    costFactor: 1.20,
    consumption: { energy: D(3.2), carbon: D(0.8) },
    production: { dark_matter: D(0.02) },
    count: 0
  },
  // Фаза 2: Новые добывающие здания
  {
    id: 'gas_well_mk1',
    name: 'Газовая Скважина v1',
    description: 'Добывает природный газ из подземных залежей.',
    baseCost: { energy: D(200), steel: D(15) },
    creditCost: D(500),
    costFactor: 1.15,
    production: { natural_gas: D(0.5) },
    energyConsumption: D(2.0),
    count: 0
  },
  {
    id: 'oil_well_mk1',
    name: 'Нефтяная Скважина v1',
    description: 'Добывает сырую нефть из месторождений.',
    baseCost: { energy: D(250), steel: D(20) },
    creditCost: D(600),
    costFactor: 1.15,
    production: { oil: D(0.35) },
    energyConsumption: D(2.2),
    count: 0
  },
  {
    id: 'sand_quarry_mk1',
    name: 'Карьер Песка v1',
    description: 'Добывает песок для производства стекла.',
    baseCost: { energy: D(150), steel: D(10) },
    creditCost: D(300),
    costFactor: 1.15,
    production: { sand: D(0.6) },
    energyConsumption: D(1.5),
    count: 0
  },
  // Фаза 2.2: Энергетические здания
  {
    id: 'solar_panel_mk1',
    name: 'Солнечная Панель v1',
    description: 'Экологичный источник энергии. Преобразует солнечный свет в электричество. Радиус покрытия: 5 клеток.',
    baseCost: { steel: D(20) },
    creditCost: D(400),
    costFactor: 1.15,
    production: { energy: D(3.5) },
    energyConsumption: D(0),
    powerGridRadius: 5,
    count: 0
  },
  {
    id: 'gas_power_plant_mk1',
    name: 'Газовая Электростанция v1',
    description: 'Сжигает природный газ для производства большого количества энергии. Радиус покрытия: 5 клеток.',
    baseCost: { steel: D(50), plastic: D(30) },
    creditCost: D(1000),
    costFactor: 1.15,
    consumption: { natural_gas: D(2) },
    production: { energy: D(18) },
    powerGridRadius: 5,
    count: 0
  },
  {
    id: 'fuel_power_plant_mk1',
    name: 'Бензиновая Электростанция v1',
    description: 'Работает на бензине. Высокая мощность при компактном размере. Радиус покрытия: 5 клеток.',
    baseCost: { steel: D(60), plastic: D(25) },
    creditCost: D(1200),
    costFactor: 1.15,
    consumption: { gasoline: D(1.5) },
    production: { energy: D(22) },
    powerGridRadius: 5,
    count: 0
  },
  {
    id: 'energy_storage_mk1',
    name: 'Энергохранилище v1',
    description: 'Продвинутое хранилище энергии. Значительно увеличивает лимит.',
    baseCost: { steel: D(80), plastic: D(40) },
    creditCost: D(1500),
    costFactor: 1.15,
    production: {},
    productionMultipliers: { energy: D(500) }, // Adds 500 to max energy
    energyConsumption: D(0.3),
    count: 0
  },
  // Фаза 2: Перерабатывающие здания
  {
    id: 'oil_refinery_mk1',
    name: 'Нефтеперерабатывающий Завод v1',
    description: 'Переработка: Нефть -> Бензин + Пластик.',
    baseCost: { energy: D(600), steel: D(50), glass: D(30) },
    creditCost: D(1800),
    costFactor: 1.15,
    consumption: { energy: D(2.0), oil: D(0.5) },
    production: { gasoline: D(0.35), plastic: D(0.2) },
    count: 0
  },
  {
    id: 'glass_factory_mk1',
    name: 'Стекольный Завод v1',
    description: 'Переработка: Песок -> Стекло.',
    baseCost: { energy: D(500), steel: D(30) },
    creditCost: D(1000),
    costFactor: 1.15,
    consumption: { energy: D(1.5), sand: D(0.8) },
    production: { glass: D(0.4) },
    count: 0
  },
  {
    id: 'chemical_plant_mk1',
    name: 'Химический Завод v1',
    description: 'Переработка: Нефть + Природный газ -> Химикаты.',
    baseCost: { energy: D(800), steel: D(60) },
    creditCost: D(2200),
    costFactor: 1.15,
    consumption: { energy: D(2.5), oil: D(0.3), natural_gas: D(0.4) },
    production: { chemicals: D(0.3) },
    count: 0
  },
  // Фаза 2.3: Металлические шахты
  {
    id: 'uranium_mine_mk1',
    name: 'Урановая Шахта v1',
    description: 'Добывает радиоактивный уран из месторождений. Требует особой осторожности.',
    baseCost: { steel: D(100), plastic: D(50) },
    creditCost: D(2000),
    costFactor: 1.15,
    production: { uranium: D(0.18) },
    energyConsumption: D(4.0),
    count: 0
  },
  {
    id: 'chrome_mine_mk1',
    name: 'Хромовая Шахта v1',
    description: 'Добывает хром — редкий металл для высокопрочных сплавов.',
    baseCost: { steel: D(80), plastic: D(40) },
    creditCost: D(1600),
    costFactor: 1.15,
    production: { chrome: D(0.22) },
    energyConsumption: D(3.5),
    count: 0
  },
  {
    id: 'titanium_mine_mk1',
    name: 'Титановая Шахта v1',
    description: 'Добывает титан — лёгкий и прочный металл для космических конструкций.',
    baseCost: { steel: D(90), plastic: D(45) },
    creditCost: D(1800),
    costFactor: 1.15,
    production: { titanium: D(0.2) },
    energyConsumption: D(3.8),
    count: 0
  },
  // Фаза 2.4: Перерабатывающие здания
  {
    id: 'copper_mine_mk1',
    name: 'Медный Рудник v1',
    description: 'Добывает медь — проводящий металл для электроники.',
    baseCost: { steel: D(60), ore: D(80) },
    creditCost: D(1300),
    costFactor: 1.13,
    production: { copper: D(0.25) },
    energyConsumption: D(3.0),
    count: 0
  },
  {
    id: 'gas_refinery_mk1',
    name: 'Газоперерабатывающий Завод v1',
    description: 'Перерабатывает природный газ в бензин.',
    baseCost: { steel: D(85), plastic: D(55), glass: D(40) },
    creditCost: D(1800),
    costFactor: 1.14,
    production: { gasoline: D(0.35) },
    consumption: { natural_gas: D(0.5) },
    energyConsumption: D(4.5),
    count: 0
  },
  {
    id: 'semiconductor_factory_mk1',
    name: 'Завод Полупроводников v1',
    description: 'Производит полупроводники из меди и песка — основа современной электроники.',
    baseCost: { steel: D(120), plastic: D(70), glass: D(60) },
    creditCost: D(3000),
    costFactor: 1.16,
    production: { semiconductors: D(0.15) },
    consumption: { copper: D(0.2), sand: D(0.3) },
    energyConsumption: D(5.5),
    count: 0
  },
  {
    id: 'dynamite_factory_mk1',
    name: 'Динамитная Фабрика v1',
    description: 'Производит динамит из химикатов — мощное взрывчатое вещество.',
    baseCost: { steel: D(95), plastic: D(50), glass: D(35) },
    creditCost: D(1900),
    costFactor: 1.13,
    production: { dynamite: D(0.15) },
    consumption: { chemicals: D(0.25) },
    energyConsumption: D(4.2),
    count: 0
  },
  {
    id: 'fiber_factory_mk1',
    name: 'Завод Волокон v1',
    description: 'Производит высокопрочное волокно из пластика для различных применений.',
    baseCost: { steel: D(75), plastic: D(80) },
    creditCost: D(1600),
    costFactor: 1.12,
    production: { fiber: D(0.18) },
    consumption: { plastic: D(0.28) },
    energyConsumption: D(3.8),
    count: 0
  },
  // Фаза 2.6: Сложные производственные здания
  {
    id: 'ic_factory_mk1',
    name: 'Завод Интегральных Микросхем v1',
    description: 'Производит интегральные микросхемы из полупроводников — основа современной электроники.',
    baseCost: { steel: D(150), plastic: D(90), glass: D(80) },
    creditCost: D(3500),
    costFactor: 1.18,
    production: { integrated_circuit: D(0.10) },
    consumption: { semiconductors: D(0.15), copper: D(0.12) },
    energyConsumption: D(7.0),
    count: 0
  },
  {
    id: 'battery_factory_mk1',
    name: 'Завод Аккумуляторов v1',
    description: 'Производит мощные аккумуляторы для хранения энергии.',
    baseCost: { steel: D(110), plastic: D(70), chemicals: D(60) },
    creditCost: D(2600),
    costFactor: 1.16,
    production: { battery: D(0.12) },
    consumption: { copper: D(0.18), chemicals: D(0.15) },
    energyConsumption: D(6.2),
    count: 0
  },
  {
    id: 'engine_factory_mk1',
    name: 'Завод Двигателей v1',
    description: 'Производит двигатели для различных механизмов.',
    baseCost: { steel: D(180), chrome: D(50), titanium: D(40) },
    creditCost: D(3800),
    costFactor: 1.19,
    production: { engine: D(0.06) },
    consumption: { steel: D(0.25), copper: D(0.15), fiber: D(0.12) },
    energyConsumption: D(8.5),
    count: 0
  },
  {
    id: 'display_factory_mk1',
    name: 'Завод Экранов v1',
    description: 'Производит дисплеи и экраны для различного оборудования.',
    baseCost: { steel: D(130), glass: D(100), plastic: D(80) },
    creditCost: D(2900),
    costFactor: 1.17,
    production: { display: D(0.12) },
    consumption: { glass: D(0.22), semiconductors: D(0.08) },
    energyConsumption: D(6.8),
    count: 0
  },
  {
    id: 'computer_factory_mk1',
    name: 'Компьютерная Фабрика v1',
    description: 'Собирает компьютеры из комплектующих — вершина технологий.',
    baseCost: { steel: D(200), plastic: D(120), glass: D(100) },
    creditCost: D(6000),
    costFactor: 1.22,
    production: { computer: D(0.06) },
    consumption: { integrated_circuit: D(0.12), display: D(0.08), battery: D(0.06) },
    energyConsumption: D(9.0),
    count: 0
  },
  {
    id: 'liquid_fuel_plant_mk1',
    name: 'Завод Жидкого Топлива v1',
    description: 'Производит высокооктановое жидкое топливо из нефти.',
    baseCost: { steel: D(140), plastic: D(80), glass: D(60) },
    creditCost: D(2800),
    costFactor: 1.15,
    production: { liquid_fuel: D(0.35) },
    consumption: { oil: D(0.4), chemicals: D(0.18) },
    energyConsumption: D(7.0),
    count: 0
  },
  {
    id: 'chrome_alloy_smelter_mk1',
    name: 'Плавильня Хромовых Сплавов v1',
    description: 'Производит прочные хромовые сплавы из хрома и стали.',
    baseCost: { steel: D(160), ore: D(120) },
    creditCost: D(3000),
    costFactor: 1.17,
    production: { chrome_alloy: D(0.14) },
    consumption: { chrome: D(0.2), steel: D(0.15) },
    energyConsumption: D(8.0),
    count: 0
  },
  {
    id: 'titanium_alloy_smelter_mk1',
    name: 'Плавильня Титановых Сплавов v1',
    description: 'Производит легкие и прочные титановые сплавы для космических конструкций.',
    baseCost: { steel: D(180), titanium: D(80) },
    creditCost: D(3500),
    costFactor: 1.18,
    production: { titanium_alloy: D(0.12) },
    consumption: { titanium: D(0.18), steel: D(0.15) },
    energyConsumption: D(8.5),
    count: 0
  },
  {
    id: 'uranium_enrichment_plant_mk1',
    name: 'Завод Обогащения Урана v1',
    description: 'Обогащает уран для ядерных реакторов — опасная, но необходимая технология.',
    baseCost: { steel: D(250), chrome: D(100), titanium: D(80) },
    creditCost: D(6000),
    costFactor: 1.25,
    production: { enriched_uranium: D(0.04) },
    consumption: { uranium: D(0.15), chemicals: D(0.2) },
    energyConsumption: D(12.0),
    count: 0
  },
  {
    /*
     * id БЕЗ суффикса `_mk1`, в отличие от остального каталога: и дерево технологий
     * (nuclear_power.unlocks.buildings), и достижение `nuclear_engineer` ищут ровно
     * `nuclear_power_plant`. Оба сравнивают строки точно, поэтому `_mk1` оставил бы
     * станцию без техгейта (isBuildingUnlocked не нашёл бы технологию и разрешил
     * постройку с нуля) и сделал бы достижение невыполнимым.
     */
    id: 'nuclear_power_plant',
    name: 'Атомная Электростанция',
    description: 'Реактор на обогащённом уране. Огромная выработка энергии ценой радиоактивных отходов. Радиус покрытия: 8 клеток.',
    baseCost: { steel: D(400), chrome_alloy: D(150), titanium: D(120), glass: D(80) },
    creditCost: D(25000),
    costFactor: 1.28,
    consumption: { enriched_uranium: D(0.03) },
    production: { energy: D(180) },
    powerGridRadius: 8,
    count: 0
  },
  // Фаза 2.7: Военные здания
  {
    id: 'weapon_factory_mk1',
    name: 'Оружейный Завод v1',
    description: 'Производит оружие для обороны — стрелковое вооружение и защитные системы.',
    baseCost: { steel: D(140), chrome: D(60), plastic: D(50) },
    creditCost: D(2800),
    costFactor: 1.17,
    production: { weapon: D(0.10) },
    consumption: { steel: D(0.2), chrome: D(0.12), dynamite: D(0.08) },
    energyConsumption: D(7.0),
    count: 0
  },
  {
    id: 'artillery_factory_mk1',
    name: 'Артиллерийский Завод v1',
    description: 'Производит тяжёлую артиллерию для обороны базы от массированных атак.',
    baseCost: { steel: D(200), chrome_alloy: D(80), titanium: D(60) },
    creditCost: D(4200),
    costFactor: 1.20,
    production: { artillery: D(0.06) },
    consumption: { steel: D(0.25), chrome_alloy: D(0.15), dynamite: D(0.12) },
    energyConsumption: D(9.0),
    count: 0
  },
  {
    id: 'radar_factory_mk1',
    name: 'Завод Радаров v1',
    description: 'Производит радарные системы для раннего обнаружения угроз.',
    baseCost: { steel: D(160), copper: D(100), semiconductors: D(70) },
    creditCost: D(3500),
    costFactor: 1.18,
    production: { radar: D(0.08) },
    consumption: { steel: D(0.18), copper: D(0.15), integrated_circuit: D(0.1) },
    energyConsumption: D(8.0),
    count: 0
  },
  {
    id: 'nuclear_bomb_factory_mk1',
    name: 'Завод Ядерных Бомб v1',
    description: 'Производит ядерное оружие — последний аргумент в экстремальных ситуациях.',
    baseCost: { steel: D(300), titanium_alloy: D(120), computer: D(50) },
    creditCost: D(10000),
    costFactor: 1.30,
    production: { nuclear_bomb: D(0.02) },
    consumption: { enriched_uranium: D(0.08), titanium_alloy: D(0.12), integrated_circuit: D(0.15) },
    energyConsumption: D(15.0),
    count: 0
  },
  // Фаза 2.8: Космические здания
  {
    id: 'jet_engine_factory_mk1',
    name: 'Завод Реактивных Двигателей v1',
    description: 'Производит мощные реактивные двигатели для космических кораблей.',
    baseCost: { steel: D(250), titanium_alloy: D(150), engine: D(80) },
    creditCost: D(7000),
    costFactor: 1.22,
    production: { jet_engine: D(0.06) },
    consumption: { titanium_alloy: D(0.2), engine: D(0.15), liquid_fuel: D(0.3) },
    energyConsumption: D(12.0),
    count: 0
  },
  {
    id: 'satellite_factory_mk1',
    name: 'Завод Спутников v1',
    description: 'Производит орбитальные спутники для связи и разведки.',
    baseCost: { steel: D(200), computer: D(60), battery: D(40) },
    creditCost: D(5500),
    costFactor: 1.20,
    production: { satellite: D(0.05) },
    consumption: { steel: D(0.15), computer: D(0.1), integrated_circuit: D(0.18) },
    energyConsumption: D(9.0),
    count: 0
  },
  {
    id: 'rocket_factory_mk1',
    name: 'Ракетный Завод v1',
    description: 'Производит ракеты-носители для космических запусков.',
    baseCost: { steel: D(300), titanium_alloy: D(180), liquid_fuel: D(200) },
    creditCost: D(8000),
    costFactor: 1.24,
    production: { rocket: D(0.04) },
    consumption: { steel: D(0.25), titanium_alloy: D(0.2), liquid_fuel: D(0.4) },
    energyConsumption: D(14.0),
    count: 0
  },
  {
    id: 'spaceship_factory_mk1',
    name: 'Завод Космических Кораблей v1',
    description: 'Производит звездолёты для дальних космических экспедиций.',
    baseCost: { steel: D(400), titanium_alloy: D(250), jet_engine: D(60), computer: D(80) },
    creditCost: D(10000),
    costFactor: 1.28,
    production: { spaceship: D(0.025) },
    consumption: { titanium_alloy: D(0.3), jet_engine: D(0.08), computer: D(0.12) },
    energyConsumption: D(18.0),
    count: 0
  },
  {
    id: 'console_factory_mk1',
    name: 'Консольный Завод v1',
    description: 'Производит управляющие консоли для космических систем.',
    baseCost: { steel: D(180), computer: D(70), display: D(50) },
    creditCost: D(5500),
    costFactor: 1.18,
    production: { console: D(0.06) },
    consumption: { computer: D(0.12), display: D(0.08), integrated_circuit: D(0.15) },
    energyConsumption: D(7.5),
    count: 0
  },
  {
    id: 'space_station_factory_mk1',
    name: 'Завод Космических Станций v1',
    description: 'Производит орбитальные станции — венец космических технологий.',
    baseCost: { steel: D(500), titanium_alloy: D(300), spaceship: D(40), console: D(60) },
    creditCost: D(15000),
    costFactor: 1.35,
    production: { space_station: D(0.015) },
    consumption: { steel: D(0.4), titanium_alloy: D(0.35), spaceship: D(0.05), console: D(0.08) },
    energyConsumption: D(25.0),
    count: 0
  },
  {
    id: 'space_colony_mk1',
    name: 'Космическая Колония v1',
    description: 'Самодостаточная колония в космосе. Производит множество ресурсов автономно.',
    baseCost: { steel: D(800), space_station: D(10), computer: D(150), battery: D(200) },
    creditCost: D(50000),
    costFactor: 1.40,
    production: { 
      energy: D(60), 
      steel: D(5), 
      computer: D(2),
      liquid_fuel: D(3),
      satellite: D(0.5)
    },
    consumption: { },
    energyConsumption: D(0),
    count: 0
  },
  // Фаза 2.9: Специальные здания
  {
    id: 'robot_factory_mk1',
    name: 'Завод Роботов v1',
    description: 'Производит автоматизированных роботов для ускорения производства.',
    baseCost: { steel: D(350), computer: D(120), engine: D(80), integrated_circuit: D(100) },
    creditCost: D(12000),
    costFactor: 1.25,
    production: { robot: D(0.03) },
    consumption: { steel: D(0.25), computer: D(0.15), engine: D(0.1), integrated_circuit: D(0.12) },
    energyConsumption: D(18.0),
    count: 0
  },
  {
    id: 'resource_accelerator_mk1',
    name: 'Ускоритель Ресурсов v1',
    description: 'Ускоряет добычу всех ресурсов в радиусе 2 клеток на 15%.',
    baseCost: { steel: D(500), computer: D(150), battery: D(120), robot: D(20) },
    creditCost: D(20000),
    costFactor: 1.30,
    production: { },
    consumption: { },
    energyConsumption: D(25.0),
    // Эффект близости будет реализован в Фазе 3
    count: 0
  },
  {
    id: 'recycler_mk1',
    name: 'Переработчик Мусора v1',
    description: 'Перерабатывает отходы производства, возвращая часть ресурсов.',
    baseCost: { steel: D(300), computer: D(80), robot: D(15) },
    creditCost: D(12000),
    costFactor: 1.22,
    production: { 
      ore: D(2.0),
      steel: D(1.0),
      plastic: D(0.5),
      copper: D(0.8)
    },
    consumption: { },
    energyConsumption: D(15.0),
    count: 0
  },
  {
    id: 'bitcoin_farm_mk1',
    name: 'Ферма Биткоинов v1',
    description: 'Майнит криптовалюту, конвертируя её в кредиты. Требует огромного количества энергии.',
    baseCost: { steel: D(600), computer: D(200), battery: D(150) },
    creditCost: D(25000),
    costFactor: 1.35,
    production: { },
    consumption: { },
    energyConsumption: D(80.0),
    // Особый эффект: генерирует кредиты напрямую (будет реализовано отдельно)
    count: 0
  },
  {
    id: 'advanced_warehouse_mk1',
    name: 'Продвинутое Хранилище v1',
    description: 'Значительно увеличивает вместимость центральной БАЗЫ для всех ресурсов за уровень. Улучшает логистику в радиусе 5 клеток.',
    baseCost: { steel: D(400), titanium_alloy: D(100), robot: D(25) },
    creditCost: D(18000),
    costFactor: 1.20,
    production: { },
    consumption: { },
    energyConsumption: D(8.0),
    logisticsRadius: 5,
    productionMultipliers: {
      ore: D(1000),
      ice: D(1000),
      carbon: D(1000),
      steel: D(500),
      natural_gas: D(800),
      oil: D(800),
      plastic: D(600),
      glass: D(600),
      copper: D(600),
      semiconductors: D(400),
      integrated_circuit: D(300),
      battery: D(350),
      computer: D(250),
      weapon: D(300),
      jet_engine: D(200),
      satellite: D(150),
      spaceship: D(100),
    },
    count: 0
  },
  {
    id: 'logistics_hub_mk1',
    name: 'Логистический Центр v1',
    description: 'Увеличивает эффективность транспортировки ресурсов в радиусе 10 клеток на 20%. Убирает штрафы дальности.',
    baseCost: { steel: D(450), computer: D(100), robot: D(30) },
    creditCost: D(15000),
    costFactor: 1.28,
    production: { },
    consumption: { },
    energyConsumption: D(25.0),
    logisticsRadius: 10,
    // Эффект близости будет реализован в Фазе 3
    count: 0
  },
  {
    id: 'power_substation_mk1',
    name: 'Подстанция v1',
    description: 'Расширяет энергосеть на 3 клетки. Снижает энергопотребление всех зданий в радиусе 2 клеток на 10%.',
    baseCost: { steel: D(350), copper: D(150), battery: D(100) },
    creditCost: D(16000),
    costFactor: 1.25,
    production: { },
    consumption: { },
    energyConsumption: D(5.0),
    powerGridRadius: 3,
    // Эффект близости будет реализован в Фазе 3
    count: 0
  },
  {
    id: 'cooling_system_mk1',
    name: 'Система Охлаждения v1',
    description: 'Повышает производительность энергетических зданий в радиусе 2 клеток на 15%.',
    baseCost: { steel: D(300), plastic: D(100), liquid_fuel: D(80) },
    creditCost: D(14000),
    costFactor: 1.24,
    production: { },
    consumption: { liquid_fuel: D(0.5) },
    energyConsumption: D(12.0),
    // Эффект близости будет реализован в Фазе 3
    count: 0
  },
  // Фаза 4: Исследовательские здания
  {
    id: 'research_center_mk1',
    name: 'Исследовательский Центр v1',
    description: 'Генерирует очки исследований (RP) для разблокировки новых технологий.',
    baseCost: { steel: D(200), computer: D(50), plastic: D(100) },
    creditCost: D(5000),
    costFactor: 1.22,
    production: { },
    consumption: { },
    energyConsumption: D(8.0),
    // Особый эффект: генерирует RP (будет реализовано отдельно)
    count: 0
  },
  {
    id: 'supercomputer_lab_mk1',
    name: 'Лаборатория Супер Компьютеров v1',
    description: 'Продвинутая лаборатория с мощными вычислительными системами. Генерирует больше RP.',
    baseCost: { steel: D(500), computer: D(200), battery: D(150), display: D(100) },
    creditCost: D(15000),
    costFactor: 1.25,
    production: { },
    consumption: { },
    energyConsumption: D(30.0),
    // Особый эффект: генерирует больше RP (будет реализовано отдельно)
    count: 0
  },
  {
    id: 'quantum_lab_mk1',
    name: 'Лаборатория Квантовых Компьютеров v1',
    description: 'Революционная квантовая лаборатория. Максимальное производство RP.',
    baseCost: { steel: D(1000), computer: D(500), enriched_uranium: D(200), titanium_alloy: D(300) },
    creditCost: D(50000),
    costFactor: 1.30,
    production: { },
    consumption: { enriched_uranium: D(0.5) },
    energyConsumption: D(80.0),
    // Особый эффект: генерирует максимальное количество RP (будет реализовано отдельно)
    count: 0
  },
  // Фаза 5: Политический центр
  {
    id: 'political_center_mk1',
    name: 'Политический Центр v1',
    description: 'Центр управления политиками. Генерирует влияние и позволяет активировать политики.',
    baseCost: { steel: D(300), computer: D(100), display: D(50), plastic: D(200) },
    creditCost: D(10000),
    costFactor: 1.25,
    production: { },
    consumption: { },
    energyConsumption: D(15.0),
    // Особый эффект: генерирует влияние (будет реализовано отдельно)
    count: 0
  },
  // Фаза 7: Оборонительные здания для платформ
  {
    id: 'defense_turret_mk1',
    name: 'Защитная Турель v1',
    description: 'Автоматическая турель для защиты платформы. Атакует вражеские корабли в радиусе действия.',
    baseCost: { steel: D(400), weapon: D(20), radar: D(5), integrated_circuit: D(30) },
    creditCost: D(8000),
    costFactor: 1.22,
    production: { },
    consumption: { },
    energyConsumption: D(12.0),
    combat: { dps: D(25.0), energyPerSecond: D(8.0) },
    count: 0
  },
  {
    id: 'defense_turret_mk2',
    name: 'Защитная Турель v2',
    description: 'Улучшенная турель с большей мощностью и дальностью стрельбы.',
    baseCost: { steel: D(800), weapon: D(50), artillery: D(15), computer: D(40) },
    creditCost: D(18000),
    costFactor: 1.25,
    production: { },
    consumption: { },
    energyConsumption: D(22.0),
    combat: { dps: D(60.0), energyPerSecond: D(15.0) },
    count: 0
  },
  {
    id: 'radar_station_mk1',
    name: 'Радарная Станция v1',
    description: 'Расширяет радиус действия турелей на 50%. Предупреждает о вражеских атаках заранее.',
    baseCost: { steel: D(600), radar: D(30), computer: D(60), display: D(40) },
    creditCost: D(12000),
    costFactor: 1.23,
    production: { },
    consumption: { },
    energyConsumption: D(18.0),
    // Эффект: увеличение дальности турелей будет реализован отдельно
    count: 0
  },
  {
    id: 'shield_generator_mk1',
    name: 'Щитовой Генератор v1',
    description: 'Создаёт энергетический щит для платформы. Блокирует энергетический урон и регенерирует.',
    baseCost: { steel: D(700), battery: D(100), integrated_circuit: D(80), enriched_uranium: D(20) },
    creditCost: D(15000),
    costFactor: 1.28,
    production: { },
    consumption: { },
    energyConsumption: D(25.0),
    defense: { shieldMaxHp: D(500), shieldRegenPerSecond: D(10.0), energyPerSecond: D(20.0) },
    count: 0
  },
  {
    id: 'shield_generator_mk2',
    name: 'Щитовой Генератор v2',
    description: 'Продвинутый щитовой генератор с большей мощностью и скоростью регенерации.',
    baseCost: { steel: D(1500), battery: D(250), computer: D(150), titanium_alloy: D(100) },
    creditCost: D(35000),
    costFactor: 1.32,
    production: { },
    consumption: { },
    energyConsumption: D(50.0),
    defense: { shieldMaxHp: D(1500), shieldRegenPerSecond: D(30.0), energyPerSecond: D(40.0) },
    count: 0
  },
  {
    id: 'armor_plating_mk1',
    name: 'Бронепластины v1',
    description: 'Дополнительное бронирование для платформы. Снижает физический урон на 30%.',
    baseCost: { steel: D(900), chrome_alloy: D(150), titanium_alloy: D(120) },
    creditCost: D(20000),
    costFactor: 1.30,
    production: { },
    consumption: { },
    energyConsumption: D(5.0),
    // Эффект: увеличение брони платформы будет реализован отдельно
    count: 0
  },
  // ============================================
  // ФАЗА 3: РАЗВЛЕЧЕНИЯ (Entertainment) - T6
  // ============================================
  {
    id: 'recording_studio_mk1',
    name: 'Студия Звукозаписи v1',
    description: 'Создаёт музыкальные альбомы для развлечения космических колонистов.',
    baseCost: { steel: D(400), computer: D(80), display: D(60) },
    creditCost: D(8000),
    costFactor: 1.22,
    production: { music_album: D(0.05) },
    consumption: { computer: D(0.05), display: D(0.03) },
    energyConsumption: D(12.0),
    count: 0
  },
  {
    id: 'film_studio_mk1',
    name: 'Киностудия v1',
    description: 'Производит кинофильмы — главное развлечение в далёких колониях.',
    baseCost: { steel: D(600), computer: D(120), display: D(100), fiber: D(50) },
    creditCost: D(15000),
    costFactor: 1.25,
    production: { movie: D(0.02) },
    consumption: { computer: D(0.1), display: D(0.08), fiber: D(0.05) },
    energyConsumption: D(25.0),
    count: 0
  },
  {
    id: 'game_studio_mk1',
    name: 'Игровая Студия v1',
    description: 'Разрабатывает видеоигры для виртуального досуга колонистов.',
    baseCost: { steel: D(500), computer: D(150), integrated_circuit: D(80), display: D(60) },
    creditCost: D(12000),
    costFactor: 1.24,
    production: { video_game: D(0.03) },
    consumption: { computer: D(0.12), integrated_circuit: D(0.06), display: D(0.04) },
    energyConsumption: D(20.0),
    count: 0
  },
  {
    id: 'streaming_center_mk1',
    name: 'Стриминговый Центр v1',
    description: 'Транслирует контент на все колонии галактики через спутниковую сеть.',
    baseCost: { steel: D(700), computer: D(200), satellite: D(30), fiber: D(80) },
    creditCost: D(25000),
    costFactor: 1.28,
    production: { streaming_service: D(0.01) },
    consumption: { computer: D(0.2), satellite: D(0.05), fiber: D(0.1) },
    energyConsumption: D(40.0),
    count: 0
  },
  {
    id: 'vr_factory_mk1',
    name: 'Завод VR-Гарнитур v1',
    description: 'Производит устройства виртуальной реальности для полного погружения.',
    baseCost: { steel: D(450), display: D(80), integrated_circuit: D(60), battery: D(40) },
    creditCost: D(10000),
    costFactor: 1.23,
    production: { vr_headset: D(0.04) },
    consumption: { display: D(0.06), integrated_circuit: D(0.04), battery: D(0.03) },
    energyConsumption: D(15.0),
    count: 0
  },
  {
    id: 'ar_factory_mk1',
    name: 'Завод AR-Очков v1',
    description: 'Производит очки дополненной реальности для работы и развлечений.',
    baseCost: { steel: D(400), display: D(60), integrated_circuit: D(50), glass: D(40) },
    creditCost: D(9000),
    costFactor: 1.22,
    production: { ar_glasses: D(0.05) },
    consumption: { display: D(0.04), integrated_circuit: D(0.03), glass: D(0.02) },
    energyConsumption: D(12.0),
    count: 0
  },
  {
    id: 'console_factory_mk2',
    name: 'Завод Игровых Консолей v1',
    description: 'Производит игровые консоли для домашнего развлечения.',
    baseCost: { steel: D(350), computer: D(80), display: D(40), plastic: D(60) },
    creditCost: D(7500),
    costFactor: 1.20,
    production: { gaming_console: D(0.06) },
    consumption: { computer: D(0.06), display: D(0.03), plastic: D(0.04) },
    energyConsumption: D(10.0),
    count: 0
  },
  {
    id: 'tv_factory_mk1',
    name: 'Завод Умных Телевизоров v1',
    description: 'Производит умные телевизоры со встроенным интерактивным интерфейсом.',
    baseCost: { steel: D(380), display: D(70), computer: D(50), plastic: D(50), glass: D(40) },
    creditCost: D(8500),
    costFactor: 1.21,
    production: { smart_tv: D(0.05) },
    consumption: { display: D(0.05), computer: D(0.03), plastic: D(0.03), glass: D(0.02) },
    energyConsumption: D(11.0),
    count: 0
  },
  // ============================================
  // ФАЗА 3: КУЛЬТУРА (Culture) - T6
  // ============================================
  {
    id: 'art_gallery_mk1',
    name: 'Художественная Галерея v1',
    description: 'Создаёт произведения искусства. Бонус +5% к производству глобально.',
    baseCost: { steel: D(300), plastic: D(100), glass: D(80) },
    creditCost: D(6000),
    costFactor: 1.20,
    production: { artwork: D(0.03) },
    consumption: { plastic: D(0.02), glass: D(0.015) },
    energyConsumption: D(8.0),
    count: 0
  },
  {
    id: 'sculptor_workshop_mk1',
    name: 'Мастерская Скульптора v1',
    description: 'Создаёт скульптуры из металлических сплавов. Бонус +10% к прочности зданий.',
    baseCost: { steel: D(400), chrome_alloy: D(80) },
    creditCost: D(7500),
    costFactor: 1.22,
    production: { sculpture: D(0.02) },
    consumption: { steel: D(0.1), chrome_alloy: D(0.04) },
    energyConsumption: D(10.0),
    count: 0
  },
  {
    id: 'publishing_house_mk1',
    name: 'Издательство v1',
    description: 'Публикует литературу для образования колонистов. Бонус +3% к скорости исследований.',
    baseCost: { steel: D(250), fiber: D(60), plastic: D(50) },
    creditCost: D(5000),
    costFactor: 1.18,
    production: { literature: D(0.04) },
    consumption: { fiber: D(0.03), plastic: D(0.02) },
    energyConsumption: D(6.0),
    count: 0
  },
  {
    id: 'architecture_bureau_mk1',
    name: 'Архитектурное Бюро v1',
    description: 'Проектирует здания будущего. Бонус -5% к стоимости строительства.',
    baseCost: { steel: D(350), computer: D(100), glass: D(60) },
    creditCost: D(8000),
    costFactor: 1.23,
    production: { architecture: D(0.02) },
    consumption: { computer: D(0.05), steel: D(0.02), glass: D(0.02) },
    energyConsumption: D(9.0),
    count: 0
  },
  {
    id: 'fashion_house_mk1',
    name: 'Дом Моды v1',
    description: 'Создаёт галактическую моду. Бонус +2% к торговым ценам.',
    baseCost: { steel: D(280), fiber: D(80), plastic: D(50), chemicals: D(40) },
    creditCost: D(6500),
    costFactor: 1.20,
    production: { fashion: D(0.03) },
    consumption: { fiber: D(0.04), plastic: D(0.02), chemicals: D(0.015) },
    energyConsumption: D(7.0),
    count: 0
  },
  {
    id: 'jewelry_workshop_mk1',
    name: 'Ювелирная Мастерская v1',
    description: 'Создаёт изысканные украшения из редких металлов. Бонус +1% к кредитам с продаж.',
    baseCost: { steel: D(320), chrome: D(60), titanium: D(50), glass: D(40) },
    creditCost: D(7000),
    costFactor: 1.21,
    production: { jewelry: D(0.025) },
    consumption: { chrome: D(0.02), titanium: D(0.015), glass: D(0.01) },
    energyConsumption: D(8.0),
    count: 0
  },
  // ============================================
  // ФАЗА 3: СОЦИАЛЬНЫЕ СЕТИ (Social Networks) - T7
  // ============================================
  {
    id: 'data_center_mk1',
    name: 'Дата-Центр v1',
    description: 'Управляет глобальными социальными сетями для всех колоний.',
    baseCost: { steel: D(800), computer: D(300), satellite: D(50), fiber: D(100) },
    creditCost: D(30000),
    costFactor: 1.30,
    production: { social_network: D(0.008) },
    consumption: { computer: D(0.3), satellite: D(0.06), fiber: D(0.1) },
    energyConsumption: D(60.0),
    count: 0
  },
  {
    id: 'comm_hub_mk1',
    name: 'Коммуникационный Хаб v1',
    description: 'Обеспечивает мгновенную связь между колониями через мессенджеры.',
    baseCost: { steel: D(600), computer: D(180), satellite: D(35), fiber: D(70) },
    creditCost: D(22000),
    costFactor: 1.27,
    production: { messaging_app: D(0.015) },
    consumption: { computer: D(0.15), satellite: D(0.04), fiber: D(0.08) },
    energyConsumption: D(40.0),
    count: 0
  },
  {
    id: 'search_cluster_mk1',
    name: 'Поисковый Кластер v1',
    description: 'Индексирует знания всей галактики для мгновенного поиска.',
    baseCost: { steel: D(1200), computer: D(500), satellite: D(80), fiber: D(150) },
    creditCost: D(50000),
    costFactor: 1.35,
    production: { search_engine: D(0.005) },
    consumption: { computer: D(0.5), satellite: D(0.1), fiber: D(0.15) },
    energyConsumption: D(100.0),
    count: 0
  },
  {
    id: 'cloud_farm_mk1',
    name: 'Облачная Ферма v1',
    description: 'Предоставляет облачные вычисления для всех колоний.',
    baseCost: { steel: D(900), computer: D(350), satellite: D(60), fiber: D(100) },
    creditCost: D(35000),
    costFactor: 1.30,
    production: { cloud_service: D(0.01) },
    consumption: { computer: D(0.35), satellite: D(0.07), fiber: D(0.1) },
    energyConsumption: D(70.0),
    count: 0
  },
  {
    id: 'ai_lab_mk1',
    name: 'Лаборатория ИИ v1',
    description: 'Разрабатывает ИИ-ассистентов для помощи колонистам.',
    baseCost: { steel: D(700), computer: D(250), robot: D(40), integrated_circuit: D(100) },
    creditCost: D(28000),
    costFactor: 1.28,
    production: { ai_assistant: D(0.012) },
    consumption: { computer: D(0.25), robot: D(0.05), integrated_circuit: D(0.08) },
    energyConsumption: D(55.0),
    count: 0
  },
  {
    id: 'mining_rig_mk1',
    name: 'Майнинг-Ферма v1',
    description: 'Добывает криптовалюту для межгалактических расчётов.',
    baseCost: { steel: D(800), computer: D(300), integrated_circuit: D(120) },
    creditCost: D(25000),
    costFactor: 1.32,
    production: { cryptocurrency: D(0.008) },
    consumption: { computer: D(0.2), integrated_circuit: D(0.08) },
    energyConsumption: D(120.0),
    count: 0
  },
  // ============================================
  // ФАЗА 3: МЕДИЦИНА И БИОТЕХ (Medicine & Biotech) - T7
  // ============================================
  {
    id: 'pharma_factory_mk1',
    name: 'Фармацевтический Завод v1',
    description: 'Производит медикаменты для лечения колонистов.',
    baseCost: { steel: D(500), chemicals: D(150), plastic: D(80), fiber: D(60) },
    creditCost: D(18000),
    costFactor: 1.25,
    production: { medicine: D(0.04) },
    consumption: { chemicals: D(0.08), plastic: D(0.03), fiber: D(0.02) },
    energyConsumption: D(25.0),
    count: 0
  },
  {
    id: 'biolab_mk1',
    name: 'Биолаборатория v1',
    description: 'Разрабатывает вакцины против космических вирусов.',
    baseCost: { steel: D(650), chemicals: D(200), medicine: D(50), robot: D(25) },
    creditCost: D(25000),
    costFactor: 1.28,
    production: { vaccine: D(0.02) },
    consumption: { chemicals: D(0.1), medicine: D(0.04), robot: D(0.02) },
    energyConsumption: D(35.0),
    count: 0
  },
  {
    id: 'implant_factory_mk1',
    name: 'Завод Имплантов v1',
    description: 'Создаёт биомеханические импланты для усиления колонистов.',
    baseCost: { steel: D(600), titanium_alloy: D(120), integrated_circuit: D(80), medicine: D(60) },
    creditCost: D(28000),
    costFactor: 1.30,
    production: { bioimplant: D(0.015) },
    consumption: { titanium_alloy: D(0.05), integrated_circuit: D(0.04), medicine: D(0.03) },
    energyConsumption: D(40.0),
    count: 0
  },
  {
    id: 'gene_lab_mk1',
    name: 'Генетическая Лаборатория v1',
    description: 'Разрабатывает генную терапию для лечения наследственных заболеваний.',
    baseCost: { steel: D(800), medicine: D(150), computer: D(200), robot: D(50) },
    creditCost: D(40000),
    costFactor: 1.33,
    production: { gene_therapy: D(0.008) },
    consumption: { medicine: D(0.08), computer: D(0.1), robot: D(0.03) },
    energyConsumption: D(50.0),
    count: 0
  },
  {
    id: 'cryo_facility_mk1',
    name: 'Криогенный Комплекс v1',
    description: 'Технология криоконсервации для длительных космических путешествий.',
    baseCost: { steel: D(700), medicine: D(100), chemicals: D(150), ice: D(200) },
    creditCost: D(35000),
    costFactor: 1.30,
    production: { cryonics: D(0.01) },
    consumption: { medicine: D(0.05), chemicals: D(0.08), ice: D(0.15) },
    energyConsumption: D(45.0),
    count: 0
  },
  // ============================================
  // ФАЗА 3: МЕГАСТРУКТУРЫ (Megastructures) - T8
  // ============================================
  {
    id: 'habitat_constructor_mk1',
    name: 'Конструктор Хабитатов v1',
    description: 'Строит гигантские орбитальные хабитаты для миллионов колонистов.',
    baseCost: { steel: D(2000), space_station: D(20), titanium_alloy: D(300), glass: D(200) },
    creditCost: D(100000),
    costFactor: 1.40,
    production: { orbital_habitat: D(0.003) },
    consumption: { space_station: D(0.02), titanium_alloy: D(0.15), glass: D(0.1) },
    energyConsumption: D(150.0),
    count: 0
  },
  {
    id: 'dyson_forge_mk1',
    name: 'Кузница Дайсона v1',
    description: 'Производит компоненты для Сферы Дайсона — величайшей мегаструктуры.',
    baseCost: { steel: D(3000), satellite: D(100), titanium_alloy: D(500) },
    creditCost: D(200000),
    costFactor: 1.45,
    production: { dyson_component: D(0.002) },
    consumption: { satellite: D(0.1), titanium_alloy: D(0.2) },
    energyConsumption: D(200.0),
    count: 0
  },
  {
    id: 'warp_assembly_mk1',
    name: 'Сборка Варп-Ядер v1',
    description: 'Создаёт варп-ядра для сверхсветовых перемещений.',
    baseCost: { steel: D(2500), enriched_uranium: D(100), dark_matter: D(50), computer: D(300) },
    creditCost: D(180000),
    costFactor: 1.42,
    production: { warp_core: D(0.002) },
    consumption: { enriched_uranium: D(0.05), dark_matter: D(0.02), computer: D(0.15) },
    energyConsumption: D(180.0),
    count: 0
  },
  {
    id: 'quantum_lab_mk2',
    name: 'Квантовая Лаборатория v2',
    description: 'Создаёт квантовые компьютеры — вершину вычислительных технологий.',
    baseCost: { steel: D(1800), computer: D(400), dark_matter: D(80), integrated_circuit: D(200) },
    creditCost: D(150000),
    costFactor: 1.38,
    production: { quantum_computer: D(0.003) },
    consumption: { computer: D(0.25), dark_matter: D(0.03), integrated_circuit: D(0.1) },
    energyConsumption: D(160.0),
    count: 0
  },
  {
    id: 'antimatter_reactor_mk1',
    name: 'Реактор Антиматерии v1',
    description: 'Синтезирует антиматерию — самый мощный источник энергии во вселенной.',
    baseCost: { steel: D(4000), enriched_uranium: D(200), dark_matter: D(100) },
    creditCost: D(300000),
    costFactor: 1.50,
    production: { antimatter: D(0.001) },
    consumption: { enriched_uranium: D(0.1), dark_matter: D(0.05) },
    energyConsumption: D(500.0),
    count: 0
  },
  // ============================================
  // ФАЗА 3: ТРАНСЦЕНДЕНТНОСТЬ (Transcendence) - T9
  // ============================================
  {
    id: 'singularity_chamber_mk1',
    name: 'Камера Сингулярности v1',
    description: 'Создаёт микроскопические чёрные дыры для генерации ядер сингулярности.',
    baseCost: { steel: D(6000), antimatter: D(30), dark_matter: D(200), quantum_computer: D(20) },
    creditCost: D(500000),
    costFactor: 1.55,
    production: { singularity_core: D(0.0005) },
    consumption: { antimatter: D(0.01), dark_matter: D(0.05), quantum_computer: D(0.005) },
    energyConsumption: D(800.0),
    count: 0
  },
  {
    id: 'temporal_forge_mk1',
    name: 'Темпоральная Кузница v1',
    description: 'Кристаллизует время в твёрдую форму. Позволяет манипулировать временем.',
    baseCost: { steel: D(5000), antimatter: D(25), quantum_computer: D(30) },
    creditCost: D(450000),
    costFactor: 1.52,
    production: { time_crystal: D(0.0003) },
    consumption: { antimatter: D(0.008), quantum_computer: D(0.008) },
    energyConsumption: D(700.0),
    count: 0
  },
  {
    id: 'rift_generator_mk1',
    name: 'Генератор Разрывов v1',
    description: 'Создаёт разрывы в пространстве-времени для путешествий между измерениями.',
    baseCost: { steel: D(8000), singularity_core: D(20), warp_core: D(15), time_crystal: D(10) },
    creditCost: D(800000),
    costFactor: 1.60,
    production: { dimensional_rift: D(0.0002) },
    consumption: { singularity_core: D(0.003), warp_core: D(0.002), time_crystal: D(0.001) },
    energyConsumption: D(1200.0),
    count: 0
  },
  {
    id: 'omega_synthesizer_mk1',
    name: 'Синтезатор Омеги v1',
    description: 'Синтезирует омега-материю — субстанцию за пределами обычной физики.',
    baseCost: { steel: D(10000), dimensional_rift: D(10), antimatter: D(50), dark_matter: D(300) },
    creditCost: D(1000000),
    costFactor: 1.65,
    production: { omega_matter: D(0.0001) },
    consumption: { dimensional_rift: D(0.001), antimatter: D(0.02), dark_matter: D(0.08) },
    energyConsumption: D(1500.0),
    count: 0
  },
  {
    id: 'ascension_altar_mk1',
    name: 'Алтарь Вознесения v1',
    description: 'Последний шаг к вознесению. Создаёт эссенцию вознесения для трансцендентности.',
    baseCost: { steel: D(15000), omega_matter: D(5), time_crystal: D(20), dark_matter: D(500) },
    creditCost: D(2000000),
    costFactor: 1.70,
    production: { ascension_essence: D(0.00005) },
    consumption: { omega_matter: D(0.0005), time_crystal: D(0.002), dark_matter: D(0.1) },
    energyConsumption: D(2000.0),
    count: 0
  }
];

// Инициализация правил близости для зданий
const initializeBuildingProximityRules = (buildings: Building[]): Building[] => {
  return buildings.map(building => {
    const rules = getProximityRulesForBuilding(building.name);
    if (rules) {
      return { ...building, proximityRules: rules };
    }
    return building;
  });
};

// Применяем правила близости к зданиям
const BUILDINGS_WITH_PROXIMITY = initializeBuildingProximityRules(INITIAL_BUILDINGS);

const INITIAL_RESOURCES = {
  energy: { amount: D(50), max: D(500), production: D(0) },
  ore: { amount: D(0), max: D(1000), production: D(0) },
  ice: { amount: D(0), max: D(800), production: D(0) },
  carbon: { amount: D(0), max: D(800), production: D(0) },
  steel: { amount: D(0), max: D(300), production: D(0) },
  dark_matter: { amount: D(0), max: D(50), production: D(0) },
  // Фаза 2: Базовые новые ресурсы
  natural_gas: { amount: D(0), max: D(500), production: D(0) },
  oil: { amount: D(0), max: D(500), production: D(0) },
  gasoline: { amount: D(0), max: D(300), production: D(0) },
  plastic: { amount: D(0), max: D(400), production: D(0) },
  glass: { amount: D(0), max: D(400), production: D(0) },
  chemicals: { amount: D(0), max: D(300), production: D(0) },
  sand: { amount: D(0), max: D(1000), production: D(0) },
  // Фаза 2.3: Металлические ресурсы
  uranium: { amount: D(0), max: D(200), production: D(0) },
  chrome: { amount: D(0), max: D(300), production: D(0) },
  titanium: { amount: D(0), max: D(300), production: D(0) },
  // Фаза 2.4-2.5: Продвинутые ресурсы
  copper: { amount: D(0), max: D(400), production: D(0) },
  semiconductors: { amount: D(0), max: D(200), production: D(0) },
  dynamite: { amount: D(0), max: D(150), production: D(0) },
  fiber: { amount: D(0), max: D(250), production: D(0) },
  // Фаза 2.6: Сложные производственные ресурсы
  integrated_circuit: { amount: D(0), max: D(150), production: D(0) },
  battery: { amount: D(0), max: D(180), production: D(0) },
  engine: { amount: D(0), max: D(120), production: D(0) },
  display: { amount: D(0), max: D(160), production: D(0) },
  computer: { amount: D(0), max: D(100), production: D(0) },
  liquid_fuel: { amount: D(0), max: D(350), production: D(0) },
  chrome_alloy: { amount: D(0), max: D(200), production: D(0) },
  titanium_alloy: { amount: D(0), max: D(200), production: D(0) },
  enriched_uranium: { amount: D(0), max: D(80), production: D(0) },
  // Фаза 2.7: Военные ресурсы
  weapon: { amount: D(0), max: D(150), production: D(0) },
  artillery: { amount: D(0), max: D(100), production: D(0) },
  radar: { amount: D(0), max: D(120), production: D(0) },
  nuclear_bomb: { amount: D(0), max: D(50), production: D(0) },
  // Фаза 2.8: Космические ресурсы
  jet_engine: { amount: D(0), max: D(80), production: D(0) },
  satellite: { amount: D(0), max: D(60), production: D(0) },
  rocket: { amount: D(0), max: D(50), production: D(0) },
  spaceship: { amount: D(0), max: D(40), production: D(0) },
  console: { amount: D(0), max: D(90), production: D(0) },
  space_station: { amount: D(0), max: D(20), production: D(0) },
  // Фаза 2.9: Специальные ресурсы
  robot: { amount: D(0), max: D(70), production: D(0) },
  // Фаза 8.1: Экология
  waste: { amount: D(0), max: D(10000), production: D(0) },
  radioactive_waste: { amount: D(0), max: D(5000), production: D(0) },
  // Фаза 3: T6 - Развлечения (Entertainment)
  music_album: { amount: D(0), max: D(100), production: D(0) },
  movie: { amount: D(0), max: D(60), production: D(0) },
  video_game: { amount: D(0), max: D(80), production: D(0) },
  streaming_service: { amount: D(0), max: D(30), production: D(0) },
  vr_headset: { amount: D(0), max: D(70), production: D(0) },
  ar_glasses: { amount: D(0), max: D(80), production: D(0) },
  gaming_console: { amount: D(0), max: D(90), production: D(0) },
  smart_tv: { amount: D(0), max: D(80), production: D(0) },
  // Фаза 3: T6 - Культура (Culture)
  artwork: { amount: D(0), max: D(50), production: D(0) },
  sculpture: { amount: D(0), max: D(40), production: D(0) },
  literature: { amount: D(0), max: D(80), production: D(0) },
  architecture: { amount: D(0), max: D(40), production: D(0) },
  fashion: { amount: D(0), max: D(60), production: D(0) },
  jewelry: { amount: D(0), max: D(50), production: D(0) },
  // Фаза 3: T7 - Социальные сети и коммуникации
  social_network: { amount: D(0), max: D(20), production: D(0) },
  messaging_app: { amount: D(0), max: D(30), production: D(0) },
  search_engine: { amount: D(0), max: D(15), production: D(0) },
  cloud_service: { amount: D(0), max: D(25), production: D(0) },
  ai_assistant: { amount: D(0), max: D(25), production: D(0) },
  cryptocurrency: { amount: D(0), max: D(20), production: D(0) },
  // Фаза 3: T7 - Медицина и биотех
  medicine: { amount: D(0), max: D(80), production: D(0) },
  vaccine: { amount: D(0), max: D(50), production: D(0) },
  bioimplant: { amount: D(0), max: D(40), production: D(0) },
  gene_therapy: { amount: D(0), max: D(25), production: D(0) },
  cryonics: { amount: D(0), max: D(30), production: D(0) },
  // Фаза 3: T8 - Мегаструктуры и инфраструктура
  orbital_habitat: { amount: D(0), max: D(15), production: D(0) },
  dyson_component: { amount: D(0), max: D(10), production: D(0) },
  warp_core: { amount: D(0), max: D(10), production: D(0) },
  quantum_computer: { amount: D(0), max: D(15), production: D(0) },
  antimatter: { amount: D(0), max: D(5), production: D(0) },
  // Фаза 3: T9 - Трансцендентные ресурсы
  singularity_core: { amount: D(0), max: D(3), production: D(0) },
  time_crystal: { amount: D(0), max: D(3), production: D(0) },
  dimensional_rift: { amount: D(0), max: D(2), production: D(0) },
  omega_matter: { amount: D(0), max: D(1), production: D(0) },
  ascension_essence: { amount: D(0), max: D(1), production: D(0) },
};

export const BASE_RESOURCE_MAX: Record<ResourceType, Decimal> = {
  energy: INITIAL_RESOURCES.energy.max,
  ore: INITIAL_RESOURCES.ore.max,
  ice: INITIAL_RESOURCES.ice.max,
  carbon: INITIAL_RESOURCES.carbon.max,
  steel: INITIAL_RESOURCES.steel.max,
  dark_matter: INITIAL_RESOURCES.dark_matter.max,
  // Фаза 2: Базовые новые ресурсы
  natural_gas: INITIAL_RESOURCES.natural_gas.max,
  oil: INITIAL_RESOURCES.oil.max,
  gasoline: INITIAL_RESOURCES.gasoline.max,
  plastic: INITIAL_RESOURCES.plastic.max,
  glass: INITIAL_RESOURCES.glass.max,
  chemicals: INITIAL_RESOURCES.chemicals.max,
  sand: INITIAL_RESOURCES.sand.max,
  // Фаза 2.3: Металлические ресурсы
  uranium: INITIAL_RESOURCES.uranium.max,
  chrome: INITIAL_RESOURCES.chrome.max,
  titanium: INITIAL_RESOURCES.titanium.max,
  // Фаза 2.4-2.5: Продвинутые ресурсы
  copper: INITIAL_RESOURCES.copper.max,
  semiconductors: INITIAL_RESOURCES.semiconductors.max,
  dynamite: INITIAL_RESOURCES.dynamite.max,
  fiber: INITIAL_RESOURCES.fiber.max,
  // Фаза 2.6: Сложные производственные ресурсы
  integrated_circuit: INITIAL_RESOURCES.integrated_circuit.max,
  battery: INITIAL_RESOURCES.battery.max,
  engine: INITIAL_RESOURCES.engine.max,
  display: INITIAL_RESOURCES.display.max,
  computer: INITIAL_RESOURCES.computer.max,
  liquid_fuel: INITIAL_RESOURCES.liquid_fuel.max,
  chrome_alloy: INITIAL_RESOURCES.chrome_alloy.max,
  titanium_alloy: INITIAL_RESOURCES.titanium_alloy.max,
  enriched_uranium: INITIAL_RESOURCES.enriched_uranium.max,
  // Фаза 2.7: Военные ресурсы
  weapon: INITIAL_RESOURCES.weapon.max,
  artillery: INITIAL_RESOURCES.artillery.max,
  radar: INITIAL_RESOURCES.radar.max,
  nuclear_bomb: INITIAL_RESOURCES.nuclear_bomb.max,
  // Фаза 2.8: Космические ресурсы
  jet_engine: INITIAL_RESOURCES.jet_engine.max,
  satellite: INITIAL_RESOURCES.satellite.max,
  rocket: INITIAL_RESOURCES.rocket.max,
  spaceship: INITIAL_RESOURCES.spaceship.max,
  console: INITIAL_RESOURCES.console.max,
  space_station: INITIAL_RESOURCES.space_station.max,
  // Фаза 2.9: Специальные ресурсы
  robot: INITIAL_RESOURCES.robot.max,
  // Фаза 8.1: Экология
  waste: INITIAL_RESOURCES.waste.max,
  radioactive_waste: INITIAL_RESOURCES.radioactive_waste.max,
  // Фаза 3: T6 - Развлечения (Entertainment)
  music_album: INITIAL_RESOURCES.music_album.max,
  movie: INITIAL_RESOURCES.movie.max,
  video_game: INITIAL_RESOURCES.video_game.max,
  streaming_service: INITIAL_RESOURCES.streaming_service.max,
  vr_headset: INITIAL_RESOURCES.vr_headset.max,
  ar_glasses: INITIAL_RESOURCES.ar_glasses.max,
  gaming_console: INITIAL_RESOURCES.gaming_console.max,
  smart_tv: INITIAL_RESOURCES.smart_tv.max,
  // Фаза 3: T6 - Культура (Culture)
  artwork: INITIAL_RESOURCES.artwork.max,
  sculpture: INITIAL_RESOURCES.sculpture.max,
  literature: INITIAL_RESOURCES.literature.max,
  architecture: INITIAL_RESOURCES.architecture.max,
  fashion: INITIAL_RESOURCES.fashion.max,
  jewelry: INITIAL_RESOURCES.jewelry.max,
  // Фаза 3: T7 - Социальные сети и коммуникации
  social_network: INITIAL_RESOURCES.social_network.max,
  messaging_app: INITIAL_RESOURCES.messaging_app.max,
  search_engine: INITIAL_RESOURCES.search_engine.max,
  cloud_service: INITIAL_RESOURCES.cloud_service.max,
  ai_assistant: INITIAL_RESOURCES.ai_assistant.max,
  cryptocurrency: INITIAL_RESOURCES.cryptocurrency.max,
  // Фаза 3: T7 - Медицина и биотех
  medicine: INITIAL_RESOURCES.medicine.max,
  vaccine: INITIAL_RESOURCES.vaccine.max,
  bioimplant: INITIAL_RESOURCES.bioimplant.max,
  gene_therapy: INITIAL_RESOURCES.gene_therapy.max,
  cryonics: INITIAL_RESOURCES.cryonics.max,
  // Фаза 3: T8 - Мегаструктуры и инфраструктура
  orbital_habitat: INITIAL_RESOURCES.orbital_habitat.max,
  dyson_component: INITIAL_RESOURCES.dyson_component.max,
  warp_core: INITIAL_RESOURCES.warp_core.max,
  quantum_computer: INITIAL_RESOURCES.quantum_computer.max,
  antimatter: INITIAL_RESOURCES.antimatter.max,
  // Фаза 3: T9 - Трансцендентные ресурсы
  singularity_core: INITIAL_RESOURCES.singularity_core.max,
  time_crystal: INITIAL_RESOURCES.time_crystal.max,
  dimensional_rift: INITIAL_RESOURCES.dimensional_rift.max,
  omega_matter: INITIAL_RESOURCES.omega_matter.max,
  ascension_essence: INITIAL_RESOURCES.ascension_essence.max,
};

export const expandWarehouseProductionMultipliers = (
  buildingId: string,
  productionMultipliers: Partial<Record<ResourceType, Decimal>> | undefined,
  baseCaps: Record<ResourceType, Decimal>
): Partial<Record<ResourceType, Decimal>> => {
  if (!productionMultipliers) return {};

  // Старый склад давал бонус только 4 ресурсам. Для остальных — автозаполнение,
  // чтобы вместимость росла для всех ресурсов (как задумано).
  const isWarehouse = buildingId === 'warehouse_mk1' || buildingId === 'advanced_warehouse_mk1';
  if (!isWarehouse) return productionMultipliers;

  const scale = buildingId === 'advanced_warehouse_mk1' ? D(1) : D('0.5');
  const next: Partial<Record<ResourceType, Decimal>> = { ...productionMultipliers };

  for (const r of Object.keys(baseCaps) as ResourceType[]) {
    // Энергию держим отдельно через конденсаторы/энергохранилища.
    if (r === 'energy') continue;
    if (next[r]) continue;
    next[r] = D(baseCaps[r]).mul(scale);
  }

  return next;
};

const recomputeCaps = (
  resources: typeof INITIAL_RESOURCES, 
  buildings: Building[], 
  capsMultiplier: Decimal = D(1),
  tileLevels: Record<string, number> = {},
  tilesOrMap: Record<string, string> | Map<string, string[]> = {}
) => {
  const next = { ...resources };

  // Всегда начинаем с базовых значений, чтобы избежать накопительного эффекта
  // Бонусы от зданий (складов, конденсаторов) добавляются ниже
  const caps: Record<ResourceType, Decimal> = { ...BASE_RESOURCE_MAX };

  // ФАЗА 8.5: Добавляем вместимость от зданий с учетом их уровней
  for (const b of buildings) {
    if (!b.productionMultipliers) continue;

    const effectiveMultipliers = expandWarehouseProductionMultipliers(b.id, b.productionMultipliers, BASE_RESOURCE_MAX);
    
    // Helper to add caps for a tile
    const addCap = (tileKey: string) => {
        const level = tileLevels[tileKey] || 1;
        // Добавляем вместимость: базовая_вместимость × уровень_здания
        for (const [resType, amount] of Object.entries(effectiveMultipliers)) {
          const rType = resType as ResourceType;
          if (!caps[rType]) continue;
          caps[rType] = caps[rType].add(D(amount).mul(level));
        }
    };

    if (tilesOrMap instanceof Map) {
        // FAST PATH: Use pre-computed map
        const keys = tilesOrMap.get(b.id);
        if (keys) {
            for (const tileKey of keys) {
                addCap(tileKey);
            }
        }
    } else {
        // SLOW PATH: Legacy iteration
        for (const [tileKey, buildingId] of Object.entries(tilesOrMap)) {
          if (buildingId === b.id) {
             addCap(tileKey);
          }
        }
    }
  }

  // Политики вида «удвоенные аккумуляторы» бьют только по энергии — остальные склады не их дело.
  if (policyEnergyStorageMult !== 1 && caps.energy) {
    caps.energy = caps.energy.mul(policyEnergyStorageMult);
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
  // Фаза 2: Новые месторождения (более редкие)
  const gasChance = 0.05;
  const oilChance = 0.04;
  const sandChance = 0.06;
  // Фаза 2.3: Металлические месторождения (редкие)
  const uraniumChance = 0.02;
  const chromeChance = 0.03;
  const titaniumChance = 0.025;
  // Фаза 2.4: Медные месторождения
  const copperChance = 0.04;

  const basePos = getBasePos({ width, height });

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Пропускаем базу (центр карты)
      if (x === basePos.x && y === basePos.y) continue;
      const roll = Math.random();
      if (roll < oreChance) deposits[`${x},${y}`] = 'ore';
      else if (roll < oreChance + iceChance) deposits[`${x},${y}`] = 'ice';
      else if (roll < oreChance + iceChance + carbonChance) deposits[`${x},${y}`] = 'carbon';
      // Фаза 2: Новые месторождения
      else if (roll < oreChance + iceChance + carbonChance + gasChance) deposits[`${x},${y}`] = 'natural_gas';
      else if (roll < oreChance + iceChance + carbonChance + gasChance + oilChance) deposits[`${x},${y}`] = 'oil';
      else if (roll < oreChance + iceChance + carbonChance + gasChance + oilChance + sandChance) deposits[`${x},${y}`] = 'sand';
      // Фаза 2.3: Металлические месторождения
      else if (roll < oreChance + iceChance + carbonChance + gasChance + oilChance + sandChance + uraniumChance) deposits[`${x},${y}`] = 'uranium';
      else if (roll < oreChance + iceChance + carbonChance + gasChance + oilChance + sandChance + uraniumChance + chromeChance) deposits[`${x},${y}`] = 'chrome';
      else if (roll < oreChance + iceChance + carbonChance + gasChance + oilChance + sandChance + uraniumChance + chromeChance + titaniumChance) deposits[`${x},${y}`] = 'titanium';
      // Фаза 2.4: Медные месторождения
      else if (roll < oreChance + iceChance + carbonChance + gasChance + oilChance + sandChance + uraniumChance + chromeChance + titaniumChance + copperChance) deposits[`${x},${y}`] = 'copper';
    }
  }

  return deposits;
};

const requiredDepositForBuilding = (buildingId: string): DepositType | null => {
  if (buildingId === 'miner_mk1') return 'ore';
  if (buildingId === 'ice_extractor_mk1') return 'ice';
  if (buildingId === 'carbon_harvester_mk1') return 'carbon';
  // Фаза 2: Новые добывающие здания
  if (buildingId === 'gas_well_mk1') return 'natural_gas';
  if (buildingId === 'oil_well_mk1') return 'oil';
  if (buildingId === 'sand_quarry_mk1') return 'sand';
  // Фаза 2.3: Металлические шахты
  if (buildingId === 'uranium_mine_mk1') return 'uranium';
  if (buildingId === 'chrome_mine_mk1') return 'chrome';
  if (buildingId === 'titanium_mine_mk1') return 'titanium';
  // Фаза 2.4: Медная шахта
  if (buildingId === 'copper_mine_mk1') return 'copper';
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
      // Фаза 2: Базовые новые ресурсы
      natural_gas: INITIAL_RESOURCES.natural_gas.amount.toString(),
      oil: INITIAL_RESOURCES.oil.amount.toString(),
      gasoline: INITIAL_RESOURCES.gasoline.amount.toString(),
      plastic: INITIAL_RESOURCES.plastic.amount.toString(),
      glass: INITIAL_RESOURCES.glass.amount.toString(),
      chemicals: INITIAL_RESOURCES.chemicals.amount.toString(),
      sand: INITIAL_RESOURCES.sand.amount.toString(),
      // Фаза 2.3: Металлические ресурсы
      uranium: INITIAL_RESOURCES.uranium.amount.toString(),
      chrome: INITIAL_RESOURCES.chrome.amount.toString(),
      titanium: INITIAL_RESOURCES.titanium.amount.toString(),
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
  highlightedBuildingId: null as string | null, // ID здания для подсветки на карте
  marketPolicy: {} as Record<string, Partial<Record<TradeResourceType, { import?: boolean; export?: boolean }>>>,
  tileLevels: {} as Record<string, number>,
  tileEvolutionLevels: {} as Record<string, number>,
  tileDisabled: {} as Record<string, boolean>,
  // Фаза 5: Продвинутые настройки зданий
  tileSettings: {} as Record<string, import('../core/gameTypes.buildings').TileBuildingSettings>,
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
  id: 'normal',
  name: 'Обычный рынок',
  multiplier: 1.0,
};

// Base prices from balance.md
const BASE_MARKET_PRICES: Record<TradeResourceType, Decimal> = {
  ore: D(2),
  ice: D(3),
  carbon: D(4),
  steel: D(15),
  // Фаза 2: Базовые новые ресурсы
  natural_gas: D(5),
  oil: D(6),
  gasoline: D(12),
  plastic: D(10),
  glass: D(8),
  sand: D(1),
  // Фаза 2.3: Металлические ресурсы
  uranium: D(50),
  chrome: D(25),
  titanium: D(30),
  // Фаза 2.4-2.5: Продвинутые ресурсы
  copper: D(8),
  semiconductors: D(35),
  dynamite: D(22),
  fiber: D(16),
  // Фаза 2.6: Сложные производственные ресурсы
  integrated_circuit: D(60),
  battery: D(45),
  engine: D(80),
  display: D(55),
  computer: D(120),
  liquid_fuel: D(18),
  chrome_alloy: D(40),
  titanium_alloy: D(50),
  enriched_uranium: D(150),
  // Фаза 2.7: Военные ресурсы
  weapon: D(70),
  artillery: D(100),
  radar: D(90),
  nuclear_bomb: D(500),
  // Фаза 2.8: Космические ресурсы
  jet_engine: D(200),
  satellite: D(300),
  rocket: D(250),
  spaceship: D(500),
  console: D(150),
  space_station: D(1000),
  // Фаза 2.9: Специальные ресурсы
  robot: D(180),
  // Фаза 3: Торгуемые T6-T7 ресурсы
  music_album: D(250),
  movie: D(450),
  video_game: D(350),
  vr_headset: D(280),
  ar_glasses: D(220),
  gaming_console: D(200),
  smart_tv: D(180),
  artwork: D(400),
  sculpture: D(350),
  literature: D(120),
  fashion: D(180),
  jewelry: D(500),
  medicine: D(150),
  vaccine: D(280),
  cryptocurrency: D(600),
};

const INITIAL_MARKET = {
  prices: BASE_MARKET_PRICES,
  event: INITIAL_MARKET_EVENT,
  nextUpdateAt: Date.now() + MARKET_UPDATE_SECONDS * 1000,
  history: {
    ore: [{ t: Date.now(), price: D(2).toString() }],
    ice: [{ t: Date.now(), price: D(3).toString() }],
    carbon: [{ t: Date.now(), price: D(4).toString() }],
    steel: [{ t: Date.now(), price: D(15).toString() }],
    // Фаза 2: Базовые новые ресурсы
    natural_gas: [{ t: Date.now(), price: D(5).toString() }],
    oil: [{ t: Date.now(), price: D(6).toString() }],
    gasoline: [{ t: Date.now(), price: D(12).toString() }],
    plastic: [{ t: Date.now(), price: D(10).toString() }],
    glass: [{ t: Date.now(), price: D(8).toString() }],
    sand: [{ t: Date.now(), price: D(1).toString() }],
    // Фаза 2.3: Металлические ресурсы
    uranium: [{ t: Date.now(), price: D(50).toString() }],
    chrome: [{ t: Date.now(), price: D(25).toString() }],
    titanium: [{ t: Date.now(), price: D(30).toString() }],
    // Фаза 2.4-2.5: Продвинутые ресурсы
    copper: [{ t: Date.now(), price: D(8).toString() }],
    semiconductors: [{ t: Date.now(), price: D(35).toString() }],
    dynamite: [{ t: Date.now(), price: D(22).toString() }],
    fiber: [{ t: Date.now(), price: D(16).toString() }],
    // Фаза 2.6: Сложные производственные ресурсы
    integrated_circuit: [{ t: Date.now(), price: D(60).toString() }],
    battery: [{ t: Date.now(), price: D(45).toString() }],
    engine: [{ t: Date.now(), price: D(80).toString() }],
    display: [{ t: Date.now(), price: D(55).toString() }],
    computer: [{ t: Date.now(), price: D(120).toString() }],
    liquid_fuel: [{ t: Date.now(), price: D(18).toString() }],
    chrome_alloy: [{ t: Date.now(), price: D(40).toString() }],
    titanium_alloy: [{ t: Date.now(), price: D(50).toString() }],
    enriched_uranium: [{ t: Date.now(), price: D(150).toString() }],
    // Фаза 2.7: Военные ресурсы
    weapon: [{ t: Date.now(), price: D(70).toString() }],
    artillery: [{ t: Date.now(), price: D(100).toString() }],
    radar: [{ t: Date.now(), price: D(90).toString() }],
    nuclear_bomb: [{ t: Date.now(), price: D(500).toString() }],
    // Фаза 2.8: Космические ресурсы
    jet_engine: [{ t: Date.now(), price: D(200).toString() }],
    satellite: [{ t: Date.now(), price: D(300).toString() }],
    rocket: [{ t: Date.now(), price: D(250).toString() }],
    spaceship: [{ t: Date.now(), price: D(500).toString() }],
    console: [{ t: Date.now(), price: D(150).toString() }],
    space_station: [{ t: Date.now(), price: D(1000).toString() }],
    // Фаза 2.9: Специальные ресурсы
    robot: [{ t: Date.now(), price: D(180).toString() }],
    // Фаза 3: Торгуемые T6-T7 ресурсы
    music_album: [{ t: Date.now(), price: D(250).toString() }],
    movie: [{ t: Date.now(), price: D(450).toString() }],
    video_game: [{ t: Date.now(), price: D(350).toString() }],
    vr_headset: [{ t: Date.now(), price: D(280).toString() }],
    ar_glasses: [{ t: Date.now(), price: D(220).toString() }],
    gaming_console: [{ t: Date.now(), price: D(200).toString() }],
    smart_tv: [{ t: Date.now(), price: D(180).toString() }],
    artwork: [{ t: Date.now(), price: D(400).toString() }],
    sculpture: [{ t: Date.now(), price: D(350).toString() }],
    literature: [{ t: Date.now(), price: D(120).toString() }],
    fashion: [{ t: Date.now(), price: D(180).toString() }],
    jewelry: [{ t: Date.now(), price: D(500).toString() }],
    medicine: [{ t: Date.now(), price: D(150).toString() }],
    vaccine: [{ t: Date.now(), price: D(280).toString() }],
    cryptocurrency: [{ t: Date.now(), price: D(600).toString() }],
  } as Record<TradeResourceType, Array<{ t: number; price: string }>>,
};

// Market events configuration
const MARKET_EVENTS: MarketEvent[] = [
  { id: 'normal', name: 'Обычный рынок', multiplier: 1.0 },
  { id: 'war', name: 'Военное время', multiplier: 1.5 },
  { id: 'deficit', name: 'Дефицит ресурсов', multiplier: 1.8 },
  { id: 'surplus', name: 'Перепроизводство', multiplier: 0.7 },
  { id: 'boom', name: 'Экономический бум', multiplier: 1.2 },
  { id: 'crisis', name: 'Экономический кризис', multiplier: 0.5 },
];

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
    // Фаза 2: Базовые новые ресурсы
    natural_gas: [...(prev?.natural_gas ?? [])],
    oil: [...(prev?.oil ?? [])],
    gasoline: [...(prev?.gasoline ?? [])],
    plastic: [...(prev?.plastic ?? [])],
    glass: [...(prev?.glass ?? [])],
    sand: [...(prev?.sand ?? [])],
    // Фаза 2.3: Металлические ресурсы
    uranium: [...(prev?.uranium ?? [])],
    chrome: [...(prev?.chrome ?? [])],
    titanium: [...(prev?.titanium ?? [])],
    // Фаза 2.4-2.5: Продвинутые ресурсы
    copper: [...(prev?.copper ?? [])],
    semiconductors: [...(prev?.semiconductors ?? [])],
    dynamite: [...(prev?.dynamite ?? [])],
    fiber: [...(prev?.fiber ?? [])],
    // Фаза 2.6: Сложные производственные ресурсы
    integrated_circuit: [...(prev?.integrated_circuit ?? [])],
    battery: [...(prev?.battery ?? [])],
    engine: [...(prev?.engine ?? [])],
    display: [...(prev?.display ?? [])],
    computer: [...(prev?.computer ?? [])],
    liquid_fuel: [...(prev?.liquid_fuel ?? [])],
    chrome_alloy: [...(prev?.chrome_alloy ?? [])],
    titanium_alloy: [...(prev?.titanium_alloy ?? [])],
    enriched_uranium: [...(prev?.enriched_uranium ?? [])],
    // Фаза 2.7: Военные ресурсы
    weapon: [...(prev?.weapon ?? [])],
    artillery: [...(prev?.artillery ?? [])],
    radar: [...(prev?.radar ?? [])],
    nuclear_bomb: [...(prev?.nuclear_bomb ?? [])],
    // Фаза 2.8: Космические ресурсы
    jet_engine: [...(prev?.jet_engine ?? [])],
    satellite: [...(prev?.satellite ?? [])],
    rocket: [...(prev?.rocket ?? [])],
    spaceship: [...(prev?.spaceship ?? [])],
    console: [...(prev?.console ?? [])],
    space_station: [...(prev?.space_station ?? [])],
    // Фаза 2.9: Специальные ресурсы
    robot: [...(prev?.robot ?? [])],
    // Фаза 3: Торгуемые T6-T7 ресурсы
    music_album: [...(prev?.music_album ?? [])],
    movie: [...(prev?.movie ?? [])],
    video_game: [...(prev?.video_game ?? [])],
    vr_headset: [...(prev?.vr_headset ?? [])],
    ar_glasses: [...(prev?.ar_glasses ?? [])],
    gaming_console: [...(prev?.gaming_console ?? [])],
    smart_tv: [...(prev?.smart_tv ?? [])],
    artwork: [...(prev?.artwork ?? [])],
    sculpture: [...(prev?.sculpture ?? [])],
    literature: [...(prev?.literature ?? [])],
    fashion: [...(prev?.fashion ?? [])],
    jewelry: [...(prev?.jewelry ?? [])],
    medicine: [...(prev?.medicine ?? [])],
    vaccine: [...(prev?.vaccine ?? [])],
    cryptocurrency: [...(prev?.cryptocurrency ?? [])],
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
  
  // Base regen tracking
  lastDamageAt: 0,
  baseRegenPerSecond: D(0),

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

const TRADEABLE: TradeResourceType[] = [
  'ore', 'ice', 'carbon', 'steel',
  'natural_gas', 'oil', 'gasoline', 'plastic', 'glass', 'sand',
  'uranium', 'chrome', 'titanium',
  'copper', 'semiconductors', 'dynamite', 'fiber',
  'integrated_circuit', 'battery', 'engine', 'display', 'computer',
  'liquid_fuel', 'chrome_alloy', 'titanium_alloy', 'enriched_uranium',
  'weapon', 'artillery', 'radar', 'nuclear_bomb',
  'jet_engine', 'satellite', 'rocket', 'spaceship', 'console', 'space_station',
  'robot',
  // Фаза 3: Торгуемые T6-T7 ресурсы
  'music_album', 'movie', 'video_game', 'vr_headset', 'ar_glasses',
  'gaming_console', 'smart_tv', 'artwork', 'sculpture', 'literature',
  'fashion', 'jewelry', 'medicine', 'vaccine', 'cryptocurrency'
];

const clampPrice = (p: Decimal) => {
  const min = D(0.05);
  const max = D(999999);
  return p.max(min).min(max);
};

const randomInRange = (min: number, max: number) => min + Math.random() * (max - min);

const rollEvent = (): MarketEvent => {
  const roll = Math.random();
  // 50% - normal, 50% - special event
  if (roll < 0.50) {
    return MARKET_EVENTS[0]; // normal
  }

  // Pick random special event
  const specialEvents = MARKET_EVENTS.slice(1);
  const eventIndex = Math.floor(Math.random() * specialEvents.length);
  return specialEvents[eventIndex];
};

const updateMarketPrices = (prevPrices: Record<TradeResourceType, Decimal>) => {
  const next: Record<TradeResourceType, Decimal> = { ...prevPrices };

  // Apply small volatility to prices (±5%)
  for (const res of TRADEABLE) {
    const volatility = randomInRange(0.95, 1.05);
    const basePrice = BASE_MARKET_PRICES[res];
    // Keep prices fluctuating around base price
    const newPrice = prevPrices[res].mul(volatility);
    // Gently pull prices back toward base price
    const pullToBase = newPrice.mul(0.9).add(basePrice.mul(0.1));
    next[res] = clampPrice(pullToBase);
  }

  return next;
};

export const useGameStore = create<GameState>((set, get) => ({
  resources: syncResourcesFromBase(INITIAL_RESOURCES, DEFAULT_GRID.buffers),
  buildings: BUILDINGS_WITH_PROXIMITY,
  currency: INITIAL_CURRENCY,
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
  politics: INITIAL_POLITICS,
  galaxies: INITIAL_GALAXIES,
  fleet: INITIAL_FLEET,
  pollution: INITIAL_POLLUTION,
  intergalacticLogistics: INITIAL_INTERGALACTIC_LOGISTICS,
  randomEvents: INITIAL_RANDOM_EVENTS,
  achievements: INITIAL_ACHIEVEMENTS,
  megastructures: INITIAL_MEGASTRUCTURES,
  endgame: INITIAL_ENDGAME,
  prestige: INITIAL_PRESTIGE,
  ascension: INITIAL_ASCENSION,
  repeatableResearch: INITIAL_REPEATABLE_RESEARCH,
  proceduralGalaxies: INITIAL_PROCEDURAL_GALAXIES,
  artifacts: INITIAL_ARTIFACTS,
  /*
   * Функция для списания кредитов.
   *
   * Эти четыре хелпера не объявлены в GameState, поэтому контекстной типизации у них нет и
   * параметр приходится аннотировать вручную — иначе он implicit any. Вызывают их
   * CheatPanel и SidePanelTabs, всегда обычным числом.
   */
  spendCredits: (amount: Decimal | number | string) => {
    set((state) => {
      const decAmount = D(amount);
      if (state.currency.credits.lt(decAmount)) return state;
      return {
        currency: {
          ...state.currency,
          credits: state.currency.credits.sub(decAmount).max(D(0)),
        },
      };
    });
  },
  retention: INITIAL_RETENTION,
  signalInterception: INITIAL_SIGNAL_INTERCEPTION,
  maps: INITIAL_MAPS,
  culture: INITIAL_CULTURE,
  quests: {
    activeQuests: [...STARTER_QUESTS],
    completedQuests: [],
  },
  lastTick: Date.now(),
  stats: {
    totalPlayTime: 0,
    sessionsCount: 1,
    currentSessionStart: Date.now(),
    lifetimeResourcesProduced: {},
    lifetimeResourcesSpent: {},
    lifetimeCreditsEarned: D(0),
    lifetimeCreditsSpent: D(0),
    contractsCompleted: 0,
  },
  
  // Energy balance telemetry
  energyProduction: D(0),
  energyConsumption: D(0),
  energyEfficiency: 1.0,

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

  addCredits: (amount: Decimal | number | string) => {
    set((state) => ({
      currency: {
        ...state.currency,
        credits: state.currency.credits.add(D(amount))
      }
    }));
  },

  addResearchPoints: (amount: Decimal | number | string) => {
    set((state) => ({
      currency: {
        ...state.currency,
        researchPoints: state.currency.researchPoints.add(D(amount))
      }
    }));
  },

  addInfluence: (amount: Decimal | number | string) => {
    set((state) => ({
      currency: {
        ...state.currency,
        influence: state.currency.influence.add(D(amount))
      }
    }));
  },

  buyBuilding: (buildingId) => {
    set((state) => {
      const buildingIndex = state.buildings.findIndex(b => b.id === buildingId);
      if (buildingIndex === -1) return state;

      const building = state.buildings[buildingIndex];
      const cost = calculateCost(building);

      // Check credit affordability if creditCost is specified
      if (building.creditCost) {
        const creditCostScaled = building.creditCost.mul(Math.pow(building.costFactor, building.count));
        if (state.currency.credits.lt(creditCostScaled)) return state;
      }

      // Check resource affordability
      for (const [resType, amount] of Object.entries(cost)) {
        const rType = resType as ResourceType;
        const needed = D(amount);
        if (!state.resources[rType] || state.resources[rType].amount.lt(needed)) return state;
      }

      // Pay credit cost
      let newCurrency = state.currency;
      if (building.creditCost) {
        const creditCostScaled = building.creditCost.mul(Math.pow(building.costFactor, building.count));
        newCurrency = {
          ...state.currency,
          credits: state.currency.credits.sub(creditCostScaled).max(D(0))
        };
      }

      // Pay resource cost
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
      const capped = recomputeCaps(newResources, newBuildings, capsMult, state.grid.tileLevels || {}, state.grid.tiles);
      return { resources: capped, buildings: newBuildings, currency: newCurrency };
    });
  },

  selectTile: (pos) => {
    set((state) => {
      const activePlatformId = state.galaxies.activePlatformId;
      
      if (activePlatformId) {
        // Update platform grid
        const platformIndex = state.galaxies.platforms.findIndex(p => p.id === activePlatformId);
        if (platformIndex === -1) return state;
        
        const updatedPlatforms = [...state.galaxies.platforms];
        updatedPlatforms[platformIndex] = {
          ...updatedPlatforms[platformIndex],
          grid: {
            ...updatedPlatforms[platformIndex].grid,
            selected: pos,
          },
        };
        
        return {
          galaxies: {
            ...state.galaxies,
            platforms: updatedPlatforms,
          },
        };
      }
      
      // Main base - Link system removed - now just select tile
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
      // Получаем максимальный размер от текущей карты
      const currentMapId = state.maps?.currentMapId;
      let maxWidth = 100; // fallback
      let maxHeight = 100;
      
      if (currentMapId) {
        const mapDef = getMapDefinition(currentMapId);
        if (mapDef) {
          maxWidth = mapDef.gridDimensions.width;
          maxHeight = mapDef.gridDimensions.height;
        }
      }
      
      // Ограничиваем расширение размером карты
      const desired = {
        width: Math.min(maxWidth, Math.max(state.grid.width, minWidth)),
        height: Math.min(maxHeight, Math.max(state.grid.height, minHeight)),
      };
      
      // Если сетка уже достаточно большая или достигла лимита, ничего не делаем
      if (desired.width <= state.grid.width && desired.height <= state.grid.height) {
        return state;
      }
      
      // Используем ensureGridSize для расширения
      const grid = ensureGridSize(state.grid as any, desired.width, desired.height) as any;
      
      return { grid };
    });
  },

  selectBuild: (buildingId) => {
    set((state) => {
      const activePlatformId = state.galaxies.activePlatformId;
      
      if (activePlatformId) {
        // Update platform grid
        const platformIndex = state.galaxies.platforms.findIndex(p => p.id === activePlatformId);
        if (platformIndex === -1) return state;
        
        const updatedPlatforms = [...state.galaxies.platforms];
        updatedPlatforms[platformIndex] = {
          ...updatedPlatforms[platformIndex],
          grid: {
            ...updatedPlatforms[platformIndex].grid,
            selectedBuildId: buildingId,
          },
        };
        
        return {
          galaxies: {
            ...state.galaxies,
            platforms: updatedPlatforms,
          },
        };
      }
      
      // Main base
      return { grid: { ...state.grid, selectedBuildId: buildingId, focusedLink: null } };
    });
  },

  setHighlightedBuilding: (buildingId) => {
    set((state) => ({ grid: { ...state.grid, highlightedBuildingId: buildingId } }));
  },

  placeSelectedBuildAt: (pos) => {
    set((state) => {
      const activePlatformId = state.galaxies.activePlatformId;
      
      // If on platform, build on platform grid
      if (activePlatformId) {
        const platformIndex = state.galaxies.platforms.findIndex(p => p.id === activePlatformId);
        if (platformIndex === -1) return state;
        
        const platform = state.galaxies.platforms[platformIndex];
        const buildId = platform.grid.selectedBuildId;
        if (!buildId) return state;

        const k = keyOf(pos);
        if (platform.grid.tiles[k]) return state;

        const requiredDeposit = requiredDepositForBuilding(buildId);
        if (requiredDeposit) {
          const deposits = platform.grid.deposits ?? {};
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

        // Создаём обновлённые tiles с новым зданием для платформы
        const nextPlatformTiles = {
          ...platform.grid.tiles,
          [k]: buildId,
        };

        const capsMult = computeCapsMultiplier(state.research.levels, state.meta.qubits);
        const capped = recomputeCaps(newResources, newBuildings, capsMult, state.grid.tileLevels || {}, nextPlatformTiles);

        // Place building on platform
        const updatedPlatforms = [...state.galaxies.platforms];
        updatedPlatforms[platformIndex] = {
          ...platform,
          grid: {
            ...platform.grid,
            tiles: nextPlatformTiles,
            selected: null,
            selectedBuildId: null,
          },
        };
        
        return {
          resources: capped,
          buildings: newBuildings,
          grid: {
            ...state.grid,
            buffers,
          },
          galaxies: {
            ...state.galaxies,
            platforms: updatedPlatforms,
          },
        };
      }
      
      // Main base logic
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

      // ФАЗА 8.5: Инициализируем уровень здания при постройке
      const tileLevels = state.grid.tileLevels || {};
      const nextTileLevels = { ...tileLevels, [k]: 1 };

      // Создаём обновлённые tiles с новым зданием
      const nextTiles = { ...state.grid.tiles, [k]: buildId };

      const capsMult = computeCapsMultiplier(state.research.levels, state.meta.qubits);
      const capped = recomputeCaps(newResources, newBuildings, capsMult, nextTileLevels, nextTiles);

      // init tile buffer
      let nextBuffers = buffers;
      if (!nextBuffers[k]) nextBuffers = { ...nextBuffers, [k]: {} };

      // Phase 4: Инициализируем эволюцию здания при постройке
      const tileEvolutionLevels = state.grid.tileEvolutionLevels || {};
      const nextTileEvolutionLevels = { ...tileEvolutionLevels, [k]: 0 };

      // Прогресс квестов на постройку конкретного здания и на постройку любого здания.
      const updatedQuests = advanceQuests(
        state.quests,
        (quest) => quest.type === 'build' && (quest.target === buildId || quest.target === 'any'),
      );

      return {
        resources: capped,
        buildings: newBuildings,
        quests: updatedQuests,
        grid: {
          ...state.grid,
          buffers: nextBuffers,
          tiles: nextTiles,
          tileLevels: nextTileLevels,
          tileEvolutionLevels: nextTileEvolutionLevels,
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

      // ФАЗА 8.5: Удаляем уровень здания при сносе
      const tileLevels = state.grid.tileLevels || {};
      const nextTileLevels = { ...tileLevels };
      delete nextTileLevels[k];

      // Phase 4: Удаляем эволюцию здания при сносе
      const tileEvolutionLevels = state.grid.tileEvolutionLevels || {};
      const nextTileEvolutionLevels = { ...tileEvolutionLevels };
      delete nextTileEvolutionLevels[k];

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
      const capped = recomputeCaps(newResources, newBuildings, capsMult, nextTileLevels, nextTiles);

      // keep buffer record (so resources can remain, but it's ok). Optional cleanup later.

      return {
        grid: { ...state.grid, tiles: nextTiles, tileLevels: nextTileLevels, tileEvolutionLevels: nextTileEvolutionLevels, buffers },
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

      // Calculate sell price using market event and active policies.
      // tradePriceMultiplier was declared on trade policies but never read anywhere.
      const price = state.market.prices[type];
      const eventMult = state.market.event?.multiplier ?? 1.0;
      const policyEffects = aggregatePolicyEffects(state.politics.activePolicies);
      const tradeMult = policyEffects.tradePrice;
      // sellCredits — отдельная ручка «экспортных» политик поверх цены рынка.
      const earned = price
        .mul(actual)
        .mul(D(eventMult))
        .mul(D(tradeMult))
        .mul(policyEffects.specials.sellCredits);

      const nextResources = { ...state.resources };
      // Remove from base buffer
      let nextBuffers = state.grid.buffers;
      const cur = getBuf(nextBuffers, 'base', type);
      nextBuffers = setBuf(nextBuffers, 'base', type, cur.sub(actual).max(D(0)));
      nextResources[type] = { ...res, amount: res.amount.sub(actual) };
      
      // Add credits (no cap for currency)
      const nextCurrency = {
        ...state.currency,
        credits: state.currency.credits.add(earned)
      };

      // Обновляем прогресс квестов на продажу ресурсов
      const updatedQuests = advanceQuests(
        state.quests,
        (quest) => quest.type === 'produce' && quest.target === 'market_sale',
      );

      return { 
        resources: nextResources, 
        grid: { ...state.grid, buffers: nextBuffers },
        currency: nextCurrency,
        quests: updatedQuests,
      };
    });
  },

  buyResource: (type, amount) => {
    set((state) => {
      const buyAmount = D(amount);
      if (buyAmount.lte(0)) return state;

      const res = state.resources[type];
      if (!res) return state;

      // Calculate buy price (30% markup).
      // The policy trade multiplier is applied as a DIVISOR here: a policy that improves trade
      // terms must make buying cheaper, not more expensive, or "better prices" would be a
      // downside on the purchase side.
      const price = state.market.prices[type];
      const eventMult = state.market.event?.multiplier ?? 1.0;
      const tradeMult = aggregatePolicyEffects(state.politics.activePolicies).tradePrice;
      const unitCost = price.mul(D(eventMult)).mul(D(1.3)).div(D(tradeMult)); // +30% markup for buying

      const currentCredits = state.currency.credits;
      if (currentCredits.lte(0)) return state;

      // Respect cap of the purchased resource in base
      let buffers = state.grid.buffers;
      const curR = getBuf(buffers, 'base', type);
      const capR = state.resources[type].max;
      const room = capR.sub(curR).max(D(0));
      if (room.lte(0)) return state;

      const desired = buyAmount.min(room);
      const desiredCost = unitCost.mul(desired);
      if (desiredCost.lte(0)) return state;

      // Clamp to affordable amount
      const affordable = currentCredits.div(unitCost).max(D(0));
      const actual = desired.min(affordable);
      if (actual.lte(0)) return state;

      const cost = unitCost.mul(actual);
      
      // Deduct credits and add resource
      const nextCurrency = {
        ...state.currency,
        credits: currentCredits.sub(cost).max(D(0))
      };
      
      buffers = setBuf(buffers, 'base', type, curR.add(actual));
      const nextResources = syncResourcesFromBase({ ...state.resources }, buffers);
      
      return { 
        resources: nextResources, 
        grid: { ...state.grid, buffers },
        currency: nextCurrency
      };
    });
  },

  // Generate a new random contract
  generateContract: () => {
    set((state) => {
      const current = state.market.contracts ?? [];
      // Потолок соблюдаем отказом, а не вытеснением: shift() удалял самый старый контракт,
      // над которым игрок мог уже работать, и вложенные в него ресурсы просто пропадали.
      if (current.length >= MAX_ACTIVE_CONTRACTS) return state;

      return {
        market: { ...state.market, contracts: [...current, createContract(Date.now())] },
      };
    });
  },

  // Complete a contract
  completeContract: (contractId: string) => {
    // Set inside set() and dispatched after it: calling addNotification from within a
    // Zustand updater is setState-during-setState.
    let queuedNotification: { type: 'success'; title: string; message: string } | null = null;

    set((state) => {
      const contracts = state.market.contracts ?? [];
      const contract = contracts.find(c => c.id === contractId);
      if (!contract) return state;
      
      // Check if player has required resources
      let buffers = state.grid.buffers;
      for (const [resType, amount] of Object.entries(contract.requirements)) {
        const rType = resType as ResourceType;
        const have = getBuf(buffers, 'base', rType);
        if (have.lt(amount)) return state; // Can't afford
      }
      
      // Deduct resources
      for (const [resType, amount] of Object.entries(contract.requirements)) {
        const rType = resType as ResourceType;
        const cur = getBuf(buffers, 'base', rType);
        buffers = setBuf(buffers, 'base', rType, cur.sub(amount).max(D(0)));
      }
      
      // Check if player gets speed bonus (completed in less than half the time)
      const now = Date.now();
      const totalTime = contract.expiresAt - contract.acceptedAt;
      const timeTaken = now - contract.acceptedAt;
      const earnedSpeedBonus = timeTaken < totalTime * 0.5 && contract.speedBonus;
      
      // Add base rewards
      let nextCurrency = {
        credits: state.currency.credits.add(contract.rewards.credits ?? D(0)),
        researchPoints: state.currency.researchPoints.add(contract.rewards.researchPoints ?? D(0)),
        influence: state.currency.influence.add(contract.rewards.influence ?? D(0)),
      };
      
      // Add speed bonus if earned
      if (earnedSpeedBonus && contract.speedBonus) {
        const bonus = contract.speedBonus;
        nextCurrency = {
          credits: nextCurrency.credits.add(bonus.credits ?? D(0)),
          researchPoints: nextCurrency.researchPoints.add(bonus.researchPoints ?? D(0)),
          influence: nextCurrency.influence.add(bonus.influence ?? D(0)),
        };

        // `state.eventLog` is not a GameState field — this used to spread `undefined`, which
        // threw and aborted the whole contract completion after the reward was computed but
        // before it was committed. The notification system is the real channel for this.
        queuedNotification = {
          type: 'success' as const,
          title: 'Бонус за скорость',
          message: `🚀 +${bonus.credits?.toFixed(0) ?? 0} кредитов за досрочную сдачу`,
        };

        return {
          resources: syncResourcesFromBase({ ...state.resources }, buffers),
          grid: { ...state.grid, buffers },
          currency: nextCurrency,
          market: { ...state.market, contracts: contracts.filter(c => c.id !== contractId) },
          stats: { ...state.stats, contractsCompleted: state.stats.contractsCompleted + 1 },
        };
      }
      
      // Remove completed contract
      const nextContracts = contracts.filter(c => c.id !== contractId);
      
      const nextResources = syncResourcesFromBase({ ...state.resources }, buffers);
      
      return {
        resources: nextResources,
        grid: { ...state.grid, buffers },
        currency: nextCurrency,
        market: { ...state.market, contracts: nextContracts },
        stats: { ...state.stats, contractsCompleted: state.stats.contractsCompleted + 1 },
      };
    });

    if (queuedNotification) get().addNotification(queuedNotification);
  },

  // Place a trading order (buy/sell at target price)
  placeTradingOrder: (resource: TradeResourceType, type: 'buy' | 'sell', targetPrice: Decimal, amount: Decimal) => {
    set((state) => {
      const amountDec = D(amount);
      const targetPriceDec = D(targetPrice);
      
      if (amountDec.lte(0) || targetPriceDec.lte(0)) return state;
      
      let collateral = D(0);
      let buffers = state.grid.buffers;
      let nextCurrency = { ...state.currency };
      
      if (type === 'buy') {
        // Lock credits as collateral
        collateral = targetPriceDec.mul(amountDec).mul(D(1.3)); // +30% markup
        if (nextCurrency.credits.lt(collateral)) return state;
        nextCurrency.credits = nextCurrency.credits.sub(collateral);
      } else {
        // Lock resources as collateral
        collateral = amountDec;
        const have = getBuf(buffers, 'base', resource);
        if (have.lt(collateral)) return state;
        buffers = setBuf(buffers, 'base', resource, have.sub(collateral));
      }
      
      const order: TradingOrder = {
        id: `order_${Date.now()}_${Math.random()}`,
        resource,
        type,
        targetPrice: targetPriceDec,
        amount: amountDec,
        collateral,
        placedAt: Date.now(),
        expiresAt: Date.now() + 300000, // 5 minutes
      };
      
      const orders = [...(state.market.orders ?? []), order];
      
      const nextResources = syncResourcesFromBase({ ...state.resources }, buffers);
      
      return {
        resources: nextResources,
        grid: { ...state.grid, buffers },
        currency: nextCurrency,
        market: { ...state.market, orders }
      };
    });
  },

  // Cancel a trading order
  cancelTradingOrder: (orderId: string) => {
    set((state) => {
      const orders = state.market.orders ?? [];
      const order = orders.find(o => o.id === orderId);
      if (!order) return state;
      
      // Return collateral
      let buffers = state.grid.buffers;
      let nextCurrency = { ...state.currency };
      
      if (order.type === 'buy') {
        nextCurrency.credits = nextCurrency.credits.add(order.collateral);
      } else {
        const cur = getBuf(buffers, 'base', order.resource);
        buffers = setBuf(buffers, 'base', order.resource, cur.add(order.collateral));
      }
      
      const nextOrders = orders.filter(o => o.id !== orderId);
      const nextResources = syncResourcesFromBase({ ...state.resources }, buffers);
      
      return {
        resources: nextResources,
        grid: { ...state.grid, buffers },
        currency: nextCurrency,
        market: { ...state.market, orders: nextOrders }
      };
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
      resources = recomputeCaps(resources, state.buildings, capsMult, state.grid.tileLevels || {}, state.grid.tiles);
      buffers = clampBaseBufferToCaps(grid.buffers, resources);
      resources = syncResourcesFromBase(resources, buffers);
      grid = { ...grid, buffers };

      return {
        research: { 
          levels,
          technologies: state.research.technologies 
        },
        resources,
        grid,
      };
    });
  },

  researchTechnology: (id) => {
    set((state) => {
      const tech = TECHNOLOGIES[id];
      
      // Check if can research
      if (!canResearchTechnology(id, state.research.technologies, state.currency.researchPoints.toNumber())) {
        return state;
      }
      
      // Deduct research points
      const newRP = state.currency.researchPoints.sub(tech.cost);
      
      // Unlock technology
      const technologies = { ...state.research.technologies, [id]: true };
      
      // Прогресс квестов на исследование конкретной технологии и на исследование любой.
      const updatedQuests = advanceQuests(
        state.quests,
        (quest) => quest.type === 'research' && (quest.target === id || quest.target === 'any'),
      );
      
      return {
        currency: {
          ...state.currency,
          researchPoints: newRP,
        },
        research: {
          ...state.research,
          technologies,
        },
        quests: updatedQuests,
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

  toggleBrokerAutoSell: (resource: TradeResourceType) => {
    set((state) => ({
      demons: {
        ...state.demons,
        brokerExcludeFromAutoSell: {
          ...state.demons.brokerExcludeFromAutoSell,
          [resource]: !state.demons.brokerExcludeFromAutoSell[resource],
        },
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
      resources = recomputeCaps(resources, state.buildings, capsMult, state.grid.tileLevels || {}, state.grid.tiles);
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
      resources = recomputeCaps(resources, state.buildings, capsMult, state.grid.tileLevels || {}, state.grid.tiles);
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
      resources = recomputeCaps(resources, state.buildings, capsMult, state.grid.tileLevels || {}, state.grid.tiles);
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

  emergencyRepairBase: () => {
    let success = false;
    set((state) => {
      // Can only repair if base HP is below max
      if (state.combat.baseHp.gte(state.combat.baseMaxHp)) {
        return state;
      }

      // Check if we can afford the repair
      const cost: Partial<Record<ResourceType, Decimal>> = {
        energy: EMERGENCY_REPAIR_COST_ENERGY,
        steel: EMERGENCY_REPAIR_COST_STEEL,
      };

      if (!canAffordFromBase(state.grid.buffers, cost)) {
        return state;
      }

      // Spend the resources
      let buffers = spendCostFromBase(state.grid.buffers, cost);

      // Repair the base
      const newBaseHp = state.combat.baseHp.add(EMERGENCY_REPAIR_HP).min(state.combat.baseMaxHp);

      let resources = syncResourcesFromBase({ ...state.resources }, buffers);
      const capsMult = computeCapsMultiplier(state.research.levels, state.meta.qubits);
      resources = recomputeCaps(resources, state.buildings, capsMult, state.grid.tileLevels || {}, state.grid.tiles);
      buffers = clampBaseBufferToCaps(buffers, resources);
      resources = syncResourcesFromBase(resources, buffers);

      success = true;
      return {
        resources,
        grid: { ...state.grid, buffers },
        combat: {
          ...state.combat,
          baseHp: newBaseHp,
        },
      };
    });
    return success;
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

  activatePolicy: (policyId: import('../core/gameTypes').PolicyId) => {
    set((state) => {
      const policy = POLICIES[policyId];
      
      if (!policy) return state;
      
      const check = canActivatePolicy(
        policyId,
        Number(state.currency.influence.toString()),
        state.research.technologies,
        state.politics.activePolicies,
        state.politics.maxActivePolicies
      );
      
      if (!check.can) {
        console.warn(`Cannot activate policy: ${check.reason}`);
        return state;
      }
      
      // Deduct influence cost
      const newInfluence = state.currency.influence.sub(D(policy.influenceCost)).max(D(0));

      const nextActive = [...state.politics.activePolicies, policyId];

      // Лимит энергии зависит от политик, поэтому его надо пересчитать сразу: иначе бонус
      // «удвоенных аккумуляторов» проявился бы только после следующей постройки/продажи.
      setPolicyEnergyStorageMult(aggregatePolicyEffects(nextActive).specials.energyStorage);
      const capsMult = computeCapsMultiplier(state.research.levels, state.meta.qubits);
      const resources = recomputeCaps(
        { ...state.resources },
        state.buildings,
        capsMult,
        state.grid.tileLevels || {},
        state.grid.tiles,
      );

      return {
        ...state,
        resources,
        currency: {
          ...state.currency,
          influence: newInfluence,
        },
        politics: {
          ...state.politics,
          activePolicies: nextActive,
          lastActivated: {
            ...(state.politics.lastActivated || {}),
            [policyId]: Date.now(),
          },
        },
      };
    });
  },

  deactivatePolicy: (policyId: import('../core/gameTypes').PolicyId) => {
    set((state) => {
      if (!state.politics.activePolicies.includes(policyId)) return state;

      const nextActive = state.politics.activePolicies.filter(id => id !== policyId);

      // Симметрично активации: снятие политики может УМЕНЬШИТЬ лимит энергии, и излишек
      // должен быть срезан здесь же, а не «висеть» над кэпом до ближайшей перестройки.
      setPolicyEnergyStorageMult(aggregatePolicyEffects(nextActive).specials.energyStorage);
      const capsMult = computeCapsMultiplier(state.research.levels, state.meta.qubits);
      const resources = recomputeCaps(
        { ...state.resources },
        state.buildings,
        capsMult,
        state.grid.tileLevels || {},
        state.grid.tiles,
      );

      return {
        resources,
        politics: {
          ...state.politics,
          activePolicies: nextActive,
        },
      };
    });
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

      const nextBuildings = BUILDINGS_WITH_PROXIMITY.map((b) => {
        if (preserveId && nextTiles['0,0'] === preserveId && b.id === preserveId) return { ...b, count: 1 };
        return b;
      });

      const capsMult = computeCapsMultiplier(state.research.levels, nextMeta.qubits);
      let resources = recomputeCaps({ ...INITIAL_RESOURCES }, nextBuildings, capsMult, {}, nextTiles);
      let buffers = clampBaseBufferToCaps(nextGrid.buffers, resources);
      resources = syncResourcesFromBase(resources, buffers);

      return {
        resources,
        buildings: nextBuildings,
        currency: { 
          credits: INITIAL_CURRENCY.credits, // Reset credits
          researchPoints: state.currency.researchPoints, // Keep research points
          influence: state.currency.influence, // Keep influence
        },
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
        politics: state.politics, // Keep politics state on prestige
        galaxies: state.galaxies, // Keep galaxies state on prestige
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
      resources = recomputeCaps(resources, state.buildings, capsMult, state.grid.tileLevels || {}, state.grid.tiles);
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

      const debugState = (state as any).debug as
        | {
            traceFlows?: boolean;
            lastFlow?: any;
          }
        | undefined;
      const traceFlows = !!debugState?.traceFlows;

      // Calculate artifact bonuses
      const artifactBonuses = calculateArtifactBonuses(
        state.artifacts.discovered,
        state.artifacts.equipped
      );
      
      // Calculate repeatable research bonuses
      const repeatableBonuses = getTotalRepeatableBonuses(state.repeatableResearch.researches);

      /*
       * Policy effects. Until now `policy.effects` was never read anywhere: all 41 policies
       * charged an activation cost and a per-second influence upkeep, and only `eco_friendly`
       * (hardcoded by id) did anything. Every declared multiplier was dead data.
       */
      const policyEffects = aggregatePolicyEffects(state.politics.activePolicies);

      // Страховка от рассинхрона: политика могла прийти из загрузки сейва, минуя activatePolicy.
      setPolicyEnergyStorageMult(policyEffects.specials.energyStorage);

      const waveActiveEconomy = state.combat.waveEndsAt > now;
      const smartTargeting = computeAegisSmartTargetingEnabled(state.aegis.levels);
      const interferenceMult = computeAegisInterferenceMultiplier(
        state.combat.enemies.length,
        state.aegis.levels.encryption ?? 0,
        waveActiveEconomy,
      );
      
      // Aegis multipliers
      const aegisShieldBoostMult = computeAegisShieldBoostMultiplier(state.aegis.levels.shield_boost ?? 0);
      const aegisTurretOverdriveMult = computeAegisTurretOverdriveMultiplier(state.aegis.levels.turret_overdrive ?? 0);
      const aegisAutoRepairPerSec = computeAegisAutoRepairPerSecond(state.aegis.levels.auto_repair ?? 0);

      // Base damage penalty: production decreases as base HP goes down
      // At 100% HP: no penalty (mult = 1.0)
      // At 0% HP: max penalty (mult = 1 - BASE_DAMAGE_PRODUCTION_PENALTY_MAX = 0.5)
      const baseHpRatio = state.combat.baseMaxHp.gt(0) 
        ? Math.max(0, Math.min(1, Number(state.combat.baseHp.div(state.combat.baseMaxHp).toString())))
        : 1;
      const baseDamageMult = 1 - (1 - baseHpRatio) * BASE_DAMAGE_PRODUCTION_PENALTY_MAX;

      const levels = state.research.levels;
      const tradeMult = computeTradeMultiplier(levels);
      const capsMult = computeCapsMultiplier(levels, state.meta.qubits);
      const combatMult = computeCombatMultiplier(levels, state.meta.qubits).mul(artifactBonuses.combatPower);

      // Update proximity multipliers for all buildings
      const buildingsWithProximity = updateAllProximityMultipliers(state.buildings, state.grid.tiles);

      // OPTIMIZATION: Prepare data structures once (Move BEFORE caps and energy calc)
      const buildingsMap = new Map(buildingsWithProximity.map(b => [b.id, b]));
      
      const tilesByBuildingId = new Map<string, string[]>();
      const activePowerSources: Array<{x: number, y: number, r: number}> = [];
      const activeLogisticsHubs: Array<{x: number, y: number, radius: number}> = [];
      
      const tiles = state.grid.tiles;
      const tileDisabled = state.grid.tileDisabled || {};

      // Unified Loop over tiles: O(Tiles) ~ 2500 iter (fast)
      // Avoids Object.entries() allocation
      for (const key in tiles) {
         const id = tiles[key];
         
         // 1. Build tilesByBuildingId
         let list = tilesByBuildingId.get(id);
         if (!list) {
             list = [];
             tilesByBuildingId.set(id, list);
         }
         list.push(key); // Just push key, simpler/faster than object

         // 2. Build active lists (Power/Logistics)
         const buildingDef = buildingsMap.get(id);
         if (buildingDef) {
             // Check if it's a special building that needs coordinate parsing
             const hasPower = buildingDef.powerGridRadius && buildingDef.powerGridRadius > 0;
             const hasLogistics = buildingDef.logisticsRadius && buildingDef.logisticsRadius > 0;

             if (hasPower || hasLogistics) {
                 const isDisabled = tileDisabled[key] || false;
                 if (!isDisabled) {
                     const pos = parseKey(key);
                     if (pos) {
                         if (hasPower) {
                            activePowerSources.push({x: pos.x, y: pos.y, r: buildingDef.powerGridRadius!});
                         }
                         if (hasLogistics) {
                            activeLogisticsHubs.push({x: pos.x, y: pos.y, radius: buildingDef.logisticsRadius!});
                         }
                     }
                 }
             }
         }
      }

      // Preparation for recomputeCaps (pass map)
      let newResources = recomputeCaps(
        { ...state.resources }, 
        buildingsWithProximity, 
        capsMult.mul(artifactBonuses.energyCapacity),
        state.grid.tileLevels || {},
        tilesByBuildingId // OPTIMIZATION: Pass the map instead of raw tiles
      );

      // Helper for fast power check with Spatial Map optimization
      // To avoid O(N*M) lookups, we fill a spatial bitmask initially.
      // Assuming grid is roughly 250x250 max. Using Set<number> for encoded coordinates.
      // Encoded key: y << 16 | x (Safe for coordinates up to 65535)
      const powerGridMap = new Set<number>();
      
      // Fill the power grid map O(Sources * Radius^2)
      // This is generally faster than N*M checks when M and N are large
      // Only do this if we have sources
      if (activePowerSources.length > 0) {
          const width = state.grid.width;
          const height = state.grid.height;
          
          for (const src of activePowerSources) {
             const r = src.r;
             // Only scan bounding box for this source
             const minX = Math.max(0, src.x - r);
             const maxX = Math.min(width - 1, src.x + r);
             const minY = Math.max(0, src.y - r);
             const maxY = Math.min(height - 1, src.y + r);
             
             for (let y = minY; y <= maxY; y++) {
                 for (let x = minX; x <= maxX; x++) {
                     const key = (y << 16) | x;
                     if (!powerGridMap.has(key)) {
                         // Manhattan distance check
                         if (Math.abs(x - src.x) + Math.abs(y - src.y) <= r) {
                             powerGridMap.add(key);
                         }
                     }
                 }
             }
          }
      }

      // Fast check using the pre-computed map O(1)
      const isPoweredFast = (x: number, y: number) => {
        return powerGridMap.has((y << 16) | x);
      };

      const baseKey = 'base';

      // Buffers (Optimized Mutable Access)
      let buffers = { ...state.grid.buffers };
      const touchedBufferKeys = new Set<string>();

      // ОПТИМИЗАЦИЯ: Кэш для parsed Decimals - избегаем повторного парсинга одного значения
      const decimalCache = new Map<string, Decimal>();
      
      // Shadow global helpers for performance (avoid object cloning)
      const getBuf = (bufs: Record<string, Partial<Record<ResourceType, string>>>, key: string, res: ResourceType) => {
         const raw = bufs[key]?.[res];
         if (raw == null) return D_ZERO;
         // ОПТИМИЗАЦИЯ: Кэшируем parsed Decimal
         let cached = decimalCache.get(raw);
         if (!cached) {
           cached = D(raw);
           decimalCache.set(raw, cached);
         }
         return cached;
      };

      const setBuf = (bufs: Record<string, Partial<Record<ResourceType, string>>>, key: string, res: ResourceType, val: Decimal) => {
         // bufs is assumed to be our local 'buffers' variable
         if (!touchedBufferKeys.has(key)) {
             bufs[key] = { ...(bufs[key] || {}) };
             touchedBufferKeys.add(key);
         }
         bufs[key][res] = val.max(D_ZERO).toString();
         return bufs; // maintain signature for chainability
      };

      // Track real energy flow for UI (per-tick amounts)
      // This includes ALL drains/sources that touch base energy.
      let energyProducedTick = D_ZERO;
      let energyConsumedTick = D_ZERO;

      // Optional diagnostics: break down energy drains by subsystem.
      let energyDrainDemonsTick = D_ZERO;
      let energyDrainMarketImportTick = D_ZERO;
      let energyDrainBuildingsLegacyTick = D_ZERO;
      let energyDrainBuildingsConsumptionTick = D_ZERO;
      let energyDrainCombatShieldTick = D_ZERO;
      let energyDrainCombatTurretsTick = D_ZERO;
      let autoSellCreditsEarned = D_ZERO; // Аккумулятор кредитов от autoSell

      const energyLegacyByBuilding: Record<string, Decimal> = {};
      const energyConsumptionByBuilding: Record<string, Decimal> = {};

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
        energyConsumedTick = energyConsumedTick.add(need);
        energyDrainDemonsTick = energyDrainDemonsTick.add(need);
        demonsPaid[id] = true;
      }

      const speedMult = computeSpeedMultiplier(levels, state.meta.qubits, demonsPaid.overclocker);
      const boostMult = computeNanoBoostMultiplier(state.nanoSwarm.allocation.boost ?? 0);
      
      // Apply ascension multipliers
      const ascensionProdMult = state.ascension.multipliers.globalProduction;
      const ascensionResearchMult = state.ascension.multipliers.researchSpeed;
      
      // Apply repeatable research bonuses
      const repeatableProdMult = repeatableBonuses.productionMultiplier;
      const repeatableExoticMult = repeatableBonuses.exoticResourcesMultiplier;
      
      /*
       * Спецэффекты политик. Разворачиваются один раз на тик: всё, что ниже читает `specials`
       * внутри цикла по тайлам, обязано брать уже готовые числа, а не пересобирать их.
       */
      const specials = policyEffects.specials;
      // Булевы флаги снимаем здесь же — внутри цикла по тайлам Set.has() был бы лишним.
      const gasPlantGasoline = policyEffects.specialEffects.has('gas_power_produces_gasoline');

      /*
       * «Роботы ускоряют производство»: каждый произведённый робот даёт +robotBonusPerUnit
       * к глобальному выпуску. Роботы копятся без потолка, поэтому бонус жёстко ограничен
       * +200% — иначе поздняя игра с фабриками роботов уходит в бесконечный самоусиливающийся
       * цикл (больше производства -> больше роботов -> больше производства).
       */
      let robotProdMult = 1;
      if (specials.robotBonusPerUnit > 0) {
        const robotCount = Number(getBuf(buffers, baseKey, 'robot').toString());
        if (Number.isFinite(robotCount) && robotCount > 0) {
          robotProdMult = 1 + Math.min(2, specials.robotBonusPerUnit * robotCount);
        }
      }

      const dtFacilities = dt * speedMult * boostMult * interferenceMult * baseDamageMult *
        artifactBonuses.globalProduction * artifactBonuses.buildingEfficiency *
        ascensionProdMult * repeatableProdMult * policyEffects.production *
        specials.productionSpeed * robotProdMult;

      /*
       * «Авто-стоп убыточных производств» (specialEffect auto_stop_unprofitable).
       *
       * Останов НЕ пишется в state.grid.tileDisabled и не трогает tileSettings.enabled: набор
       * пересобирается каждый тик, поэтому здание само оживает, как только рынок или цепочка
       * поставок меняются, а ручные переключатели игрока остаются его собственными.
       *
       * Считаем только по зданиям, которые (а) реально стоят на карте, (б) объявлены
       * отключаемыми (энергетику, склады и оборону останавливать нельзя — это каскадом
       * обесточило бы базу) и (в) вообще что-то потребляют. Такой фильтр оставляет единицы
       * зданий из сотни, поэтому цикл дешевле, чем аналогичный расчёт ROI у демона-оракула.
       */
      let autoStoppedBuildingIds: Set<string> | null = null;
      if (policyEffects.specialEffects.has('auto_stop_unprofitable')) {
        // Стоимость в «энергетическом эквиваленте»: энергия по номиналу, торгуемое — по цене.
        const valueOf = (res: string, perSec: Decimal | string | number): number => {
          if (res === 'energy') return Number(D(perSec).toString());
          const price = state.market.prices[res as TradeResourceType];
          return price ? Number(price.mul(D(perSec)).toString()) : 0;
        };

        for (const b of buildingsWithProximity) {
          if (b.count <= 0 || !b.consumption) continue;
          if (!tilesByBuildingId.has(b.id)) continue;
          if (!isBuildingDisableable(b.id)) continue;

          /*
           * Если хотя бы один выход не торгуется (тёмная материя, омега-материя, кристаллы
           * времени...), оценить здание нечем: по ценам оно выглядело бы как чистый убыток,
           * хотя производит самое ценное в игре. Такие не трогаем вообще.
           */
          let priceable = true;
          let net = 0;
          for (const [res, perSec] of Object.entries(b.production ?? {})) {
            if (res !== 'energy' && !state.market.prices[res as TradeResourceType]) {
              priceable = false;
              break;
            }
            net += valueOf(res, perSec);
          }
          if (!priceable) continue;

          for (const [res, perSec] of Object.entries(b.consumption)) net -= valueOf(res, perSec);
          if (b.energyConsumption) net -= Number(D(b.energyConsumption).toString());

          // Строго меньше нуля: здание в нуле не глушим — это не убыток, а ровный размен.
          if (net < 0) {
            if (!autoStoppedBuildingIds) autoStoppedBuildingIds = new Set<string>();
            autoStoppedBuildingIds.add(b.id);
          }
        }
      }

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
        // Фаза 2: Базовые новые ресурсы
        natural_gas: getBuf(buffers, baseKey, 'natural_gas'),
        oil: getBuf(buffers, baseKey, 'oil'),
        gasoline: getBuf(buffers, baseKey, 'gasoline'),
        plastic: getBuf(buffers, baseKey, 'plastic'),
        glass: getBuf(buffers, baseKey, 'glass'),
        chemicals: getBuf(buffers, baseKey, 'chemicals'),
        sand: getBuf(buffers, baseKey, 'sand'),
        // Фаза 2.3: Металлические ресурсы
        uranium: getBuf(buffers, baseKey, 'uranium'),
        chrome: getBuf(buffers, baseKey, 'chrome'),
        titanium: getBuf(buffers, baseKey, 'titanium'),
        // Фаза 2.4-2.5: Продвинутые ресурсы
        copper: getBuf(buffers, baseKey, 'copper'),
        semiconductors: getBuf(buffers, baseKey, 'semiconductors'),
        dynamite: getBuf(buffers, baseKey, 'dynamite'),
        fiber: getBuf(buffers, baseKey, 'fiber'),
        // Фаза 2.6: Сложные производственные ресурсы
        integrated_circuit: getBuf(buffers, baseKey, 'integrated_circuit'),
        battery: getBuf(buffers, baseKey, 'battery'),
        engine: getBuf(buffers, baseKey, 'engine'),
        display: getBuf(buffers, baseKey, 'display'),
        computer: getBuf(buffers, baseKey, 'computer'),
        liquid_fuel: getBuf(buffers, baseKey, 'liquid_fuel'),
        chrome_alloy: getBuf(buffers, baseKey, 'chrome_alloy'),
        titanium_alloy: getBuf(buffers, baseKey, 'titanium_alloy'),
        enriched_uranium: getBuf(buffers, baseKey, 'enriched_uranium'),
        // Фаза 2.7: Военные ресурсы
        weapon: getBuf(buffers, baseKey, 'weapon'),
        artillery: getBuf(buffers, baseKey, 'artillery'),
        radar: getBuf(buffers, baseKey, 'radar'),
        nuclear_bomb: getBuf(buffers, baseKey, 'nuclear_bomb'),
        // Фаза 2.8: Космические ресурсы
        jet_engine: getBuf(buffers, baseKey, 'jet_engine'),
        satellite: getBuf(buffers, baseKey, 'satellite'),
        rocket: getBuf(buffers, baseKey, 'rocket'),
        spaceship: getBuf(buffers, baseKey, 'spaceship'),
        console: getBuf(buffers, baseKey, 'console'),
        space_station: getBuf(buffers, baseKey, 'space_station'),
        // Фаза 2.9: Специальные ресурсы
        robot: getBuf(buffers, baseKey, 'robot'),
        // Фаза 8.1: Экология
        waste: getBuf(buffers, baseKey, 'waste'),
        radioactive_waste: getBuf(buffers, baseKey, 'radioactive_waste'),
        // Фаза 3: T6 Entertainment
        music_album: getBuf(buffers, baseKey, 'music_album'),
        movie: getBuf(buffers, baseKey, 'movie'),
        video_game: getBuf(buffers, baseKey, 'video_game'),
        streaming_service: getBuf(buffers, baseKey, 'streaming_service'),
        vr_headset: getBuf(buffers, baseKey, 'vr_headset'),
        ar_glasses: getBuf(buffers, baseKey, 'ar_glasses'),
        gaming_console: getBuf(buffers, baseKey, 'gaming_console'),
        smart_tv: getBuf(buffers, baseKey, 'smart_tv'),
        // Фаза 3: T6 Culture
        artwork: getBuf(buffers, baseKey, 'artwork'),
        sculpture: getBuf(buffers, baseKey, 'sculpture'),
        literature: getBuf(buffers, baseKey, 'literature'),
        architecture: getBuf(buffers, baseKey, 'architecture'),
        fashion: getBuf(buffers, baseKey, 'fashion'),
        jewelry: getBuf(buffers, baseKey, 'jewelry'),
        // Фаза 3: T7 Social
        social_network: getBuf(buffers, baseKey, 'social_network'),
        messaging_app: getBuf(buffers, baseKey, 'messaging_app'),
        search_engine: getBuf(buffers, baseKey, 'search_engine'),
        cloud_service: getBuf(buffers, baseKey, 'cloud_service'),
        ai_assistant: getBuf(buffers, baseKey, 'ai_assistant'),
        cryptocurrency: getBuf(buffers, baseKey, 'cryptocurrency'),
        // Фаза 3: T7 Medical
        medicine: getBuf(buffers, baseKey, 'medicine'),
        vaccine: getBuf(buffers, baseKey, 'vaccine'),
        bioimplant: getBuf(buffers, baseKey, 'bioimplant'),
        gene_therapy: getBuf(buffers, baseKey, 'gene_therapy'),
        cryonics: getBuf(buffers, baseKey, 'cryonics'),
        // Фаза 3: T8 Megastructures
        orbital_habitat: getBuf(buffers, baseKey, 'orbital_habitat'),
        dyson_component: getBuf(buffers, baseKey, 'dyson_component'),
        warp_core: getBuf(buffers, baseKey, 'warp_core'),
        quantum_computer: getBuf(buffers, baseKey, 'quantum_computer'),
        antimatter: getBuf(buffers, baseKey, 'antimatter'),
        // Фаза 3: T9 Transcendence
        singularity_core: getBuf(buffers, baseKey, 'singularity_core'),
        time_crystal: getBuf(buffers, baseKey, 'time_crystal'),
        dimensional_rift: getBuf(buffers, baseKey, 'dimensional_rift'),
        omega_matter: getBuf(buffers, baseKey, 'omega_matter'),
        ascension_essence: getBuf(buffers, baseKey, 'ascension_essence'),
      };

      // OPTIMIZATION: Rebuild Logistics Cache if grid changed
      // This turns O(N^2) per tick into O(N^2) only on build/destroy, and O(N) per tick
      // ВАЖНО: Zustand создаёт новые объекты при каждом set(), поэтому проверяем по содержимому
      if (tilesChangedForLogistics(state.grid.tiles)) {
          const tileKeys = Object.keys(state.grid.tiles);
          logisticsCache.tilesCount = tileKeys.length;
          logisticsCache.tilesKeys = tileKeys.sort().join(',');
          logisticsCache.routes = {};
          
          // 1. Index all producers by resource
          const producersByRes: Record<string, Array<{key: string, x: number, y: number}>> = {};
          const basePos = getBasePos(state.grid);
          
          // Always add base as potential source for all resources
          // (Actual availability checked at runtime)
          for (const res of Object.keys(state.resources)) {
              if (!producersByRes[res]) producersByRes[res] = [];
              producersByRes[res].push({ key: baseKey, x: basePos.x, y: basePos.y });
          }
          
          // Add all building producers
          for (const key in state.grid.tiles) {
              const id = state.grid.tiles[key];
              const b = buildingsMap.get(id);
              if (b?.production) {
                  const pos = parseKey(key);
                  if (pos) {
                      for (const res in b.production) {
                          if (!producersByRes[res]) producersByRes[res] = [];
                          producersByRes[res].push({ key, x: pos.x, y: pos.y });
                      }
                  }
              }
          }
          
          // 2. For each consumer, pre-calculate sorted list of sources
          for (const key in state.grid.tiles) {
              const id = state.grid.tiles[key];
              const b = buildingsMap.get(id);
              if (b?.consumption) {
                  const pos = parseKey(key);
                  if (pos) {
                      logisticsCache.routes[key] = {};
                      for (const res in b.consumption) {
                           if (res === 'energy') continue; // Energy is handled via power grid
                           
                           const potentialSources = producersByRes[res] || [];
                           
                           // Calculate distances and sort
                           const sorted = potentialSources
                               .filter(s => s.key !== key) // Don't consume from self
                               .map(s => ({
                                   key: s.key,
                                   dist: Math.abs(s.x - pos.x) + Math.abs(s.y - pos.y)
                               }))
                               .sort((a, b) => a.dist - b.dist)
                               .map(s => s.key); // Keep only keys
                           
                           logisticsCache.routes[key][res as ResourceType] = sorted;
                      }
                  }
              }
          }
      }

      // АВТОМАТИЧЕСКАЯ ЛОГИСТИКА: Находим ближайшие источники для каждого потребителя
      // Структура для хранения активных транспортов (для визуализации)
      const activeTransports: Array<{
        from: { x: number; y: number };
        to: { x: number; y: number };
        resource: ResourceType;
        amount: Decimal;
      }> = [];

      // ОПТИМИЗАЦИЯ: Calculate energy balance using pre-built tilesByBuildingId map
      // Это избавляет от O(Buildings * Tiles) в пользу O(Buildings + Tiles)
      let totalEnergyProduction = D_ZERO;
      let totalEnergyConsumption = D_ZERO;
      
      // tileDisabled уже объявлен выше
      const tileLevels = state.grid.tileLevels || {};
      const tileEvolutionLevels = state.grid.tileEvolutionLevels || {};
      
      for (const b of buildingsWithProximity) {
        if (b.count <= 0) continue;

        // Заглушенное политикой здание ничего не потребляет — не должно и висеть в итогах.
        if (autoStoppedBuildingIds?.has(b.id)) continue;

        // ОПТИМИЗАЦИЯ: Используем pre-built map вместо filter каждый раз
        const placedKeys = tilesByBuildingId.get(b.id);
        if (!placedKeys || placedKeys.length === 0) continue;

        // Тот же множитель по id здания, что применяется к выпуску ниже: иначе энергобаланс
        // считался бы по «непрокачанной» станции и резал бы производство мнимым дефицитом.
        const policyBuildingMult = policyEffects.buildingTypeMultipliers[b.id] ?? 1;

        // Суммируем с учётом уровней каждого здания
        for (const key of placedKeys) {
          // Пропускаем отключенные здания
          if (tileDisabled[key]) continue;
          const tileSett = state.grid.tileSettings?.[key];
          if (tileSett && !tileSett.enabled) continue;
          
          const buildingLevel = tileLevels[key] || 1;
          const evolutionLevel = tileEvolutionLevels[key] || 0;
          const evolutionMult = evolutionLevel > 0 ? getEvolutionMultiplier(b.id, evolutionLevel) : 1;
          
          // Energy production (с учётом уровня и эволюции)
          if (b.production?.energy) {
            totalEnergyProduction = totalEnergyProduction.add(
              D(b.production.energy).mul(buildingLevel).mul(evolutionMult).mul(policyBuildingMult)
            );
          }
          
          // Passive energy consumption (с учётом уровня)
          if (b.energyConsumption) {
            totalEnergyConsumption = totalEnergyConsumption.add(
              D(b.energyConsumption).mul(buildingLevel)
            );
          }
          
          // Active consumption (from consumption field, not energyConsumption)
          if (b.consumption?.energy) {
            totalEnergyConsumption = totalEnergyConsumption.add(
              D(b.consumption.energy).mul(buildingLevel)
            );
          }
        }
      }
      
      // Combat energy consumption
      if (waveActiveEconomy) {
        for (const b of buildingsWithProximity) {
          if (b.count <= 0) continue;
          
          const placedKeys = tilesByBuildingId.get(b.id);
          if (!placedKeys || placedKeys.length === 0) continue;
          
          // Считаем только активные (не отключенные) здания
          let activePlacedCount = 0;
          for (const key of placedKeys) {
            if (!tileDisabled[key]) {
              activePlacedCount++;
            }
          }
          
          if (activePlacedCount === 0) continue;
          
          if (b.combat?.energyPerSecond) {
            totalEnergyConsumption = totalEnergyConsumption.add(D(b.combat.energyPerSecond).mul(activePlacedCount));
          }
          if (b.defense?.energyPerSecond) {
            totalEnergyConsumption = totalEnergyConsumption.add(D(b.defense.energyPerSecond).mul(activePlacedCount));
          }
        }
      }
      
      // Apply Energy Optimization from repeatable research (reduces consumption)
      totalEnergyConsumption = totalEnergyConsumption.mul(repeatableBonuses.energyEfficiency);

      /*
       * Policy energy effects. Scaled once here, on the totals, rather than at each of the four
       * accumulation sites above — same insertion point the repeatable-research bonus uses, and
       * the only place where both totals are final but nothing has consumed them yet.
       * These were declared on policies like "Овертайм" (+30% production, +50% energy draw) but
       * never applied, so such a policy was a pure upside with no stated downside.
       */
      totalEnergyConsumption = totalEnergyConsumption.mul(policyEffects.energyConsumption);
      totalEnergyProduction = totalEnergyProduction.mul(policyEffects.energyProduction);

      /*
       * Тот же множитель расхода, что уходит в цикл по тайлам. Без него политика «-20% расхода»
       * реально снижала бы списание, но energyEfficiency ниже считался бы по нетронутым итогам —
       * то есть при дефиците игрок продолжал бы получать штраф, которого политика его лишает.
       */
      if (specials.consumption !== 1) {
        totalEnergyConsumption = totalEnergyConsumption.mul(specials.consumption);
      }

      // Calculate efficiency based on energy balance
      // НЕ вычитаем энергию здесь - это делается в цикле производства/потребления зданий
      let energyEfficiency = 1.0;
      
      if (totalEnergyConsumption.gt(totalEnergyProduction)) {
        // ДЕФИЦИТ: потребление > производства
        const energyDeficit = totalEnergyConsumption.sub(totalEnergyProduction);
        const energyDeficitForTick = energyDeficit.mul(dtFacilities);
        
        // Проверяем, есть ли запас энергии в базе для покрытия дефицита
        const availableEnergyInBase = getBuf(buffers, baseKey, 'energy');
        
        if (availableEnergyInBase.gte(energyDeficitForTick)) {
          // Достаточно запасов - работаем на 100%
          // Энергия будет вычтена в цикле зданий
          energyEfficiency = 1.0;
        } else if (availableEnergyInBase.gt(0)) {
          // Частично покрываем дефицит из запасов
          // Рассчитываем эффективность с учётом частичного покрытия
          const totalAvailable = totalEnergyProduction.mul(dtFacilities).add(availableEnergyInBase);
          const totalNeeded = totalEnergyConsumption.mul(dtFacilities);
          energyEfficiency = Number(totalAvailable.div(totalNeeded).toString());
          energyEfficiency = Math.max(0, Math.min(1, energyEfficiency));
        } else {
          // Запасов нет - работаем только на производстве
          if (totalEnergyProduction.gt(0)) {
            energyEfficiency = Number(totalEnergyProduction.div(totalEnergyConsumption).toString());
            energyEfficiency = Math.max(0, Math.min(1, energyEfficiency));
          } else {
            energyEfficiency = 0;
          }
        }
      } else {
        // ИЗЛИШЕК или БАЛАНС: производство >= потребления
        // Работаем на полную мощность
        energyEfficiency = 1.0;
      }

      /*
       * «Снижение потерь энергии» (specials.energyDeficitRelief). Единственная настоящая потеря
       * энергии в игре — просадка всего производства при дефиците (сеть бинарная: здание либо
       * запитано, либо нет). Прощаем указанную долю недостачи: relief=0.5 -> половина провала.
       */
      if (specials.energyDeficitRelief > 0 && energyEfficiency < 1) {
        energyEfficiency = energyEfficiency + (1 - energyEfficiency) * specials.energyDeficitRelief;
      }



      // Produce/consume into local tile buffers
      // ОПТИМИЗАЦИЯ: for...of вместо forEach (быстрее в V8)
      // Получаем позицию базы ОДИН раз за тик
      const basePosition = getBasePos(state.grid);
      
      for (const b of buildingsWithProximity) {
        if (b.count <= 0) continue;

        // Политика «авто-стоп убыточных»: здание не производит и не потребляет этот тик.
        if (autoStoppedBuildingIds?.has(b.id)) continue;

        // Find all placed instances of this building
        const placedKeys = tilesByBuildingId.get(b.id);
        if (!placedKeys || placedKeys.length === 0) continue;

        // Множитель производства по id здания из активных политик (ищем один раз на здание,
        // а не на каждый тайл — при сотне копий это разница в порядок вызовов).
        const policyBuildingMult = policyEffects.buildingTypeMultipliers[b.id] ?? 1;

        for (const tileKey of placedKeys) {
          if (!buffers[tileKey]) buffers[tileKey] = {};

          const tilePos = parseKey(tileKey);
          if (!tilePos) continue;

          // Фаза 8.2: Проверка энергопокрытия
          // Здания без энергопокрытия не работают (кроме источников энергии)
          const isPowerSource = b.powerGridRadius && b.powerGridRadius > 0;
          if (!isPowerSource) {
            const isPowered = isPoweredFast(tilePos.x, tilePos.y);
            
            // Если здание не в зоне покрытия - пропускаем его (не производит и не потребляет)
            if (!isPowered) {
              continue;
            }
          }

          // Фаза 11: Проверка disabled state
          // Отключенные здания не работают (не производят и не потребляют)
          // ОПТИМИЗАЦИЯ: используем уже извлечённый tileDisabled
          if (tileDisabled[tileKey]) {
            continue;
          }

          // ФАЗА 5: Получаем настройки здания и множители режима
          const tileSettings = state.grid.tileSettings?.[tileKey];
          const buildingMode = tileSettings?.mode || 'normal';
          const buildingEnabled = tileSettings?.enabled ?? true;
          
          // Если здание отключено через настройки - пропускаем
          if (!buildingEnabled) {
            continue;
          }
          
          // Получаем множители из режима работы.
          // Множитель расхода от политик вмешан прямо сюда (обычным умножением чисел): так он
          // попадает разом и в проверку доступности входов, и в само списание — если развести
          // их по разным местам, проверка и дебет разойдутся и буферы уйдут в минус.
          const modeConfig = BUILDING_MODES[buildingMode];
          const productionMult = modeConfig?.productionMultiplier ?? 1;
          const consumptionMult = (modeConfig?.consumptionMultiplier ?? 1) * specials.consumption;
          const energyMult = (modeConfig?.energyMultiplier ?? 1) * specials.consumption;

          // Если здание производственное, но его выходы уже заблокированы (переполнение),
          // то оно не должно тратить энергию/ресурсы «вхолостую».
          // ОПТИМИЗАЦИЯ: проверяем наличие production без Object.keys
          const hasProductionOutputs = !!b.production;
          if (hasProductionOutputs) {
            let canProduceAny = false;
            for (const outResType in b.production) {
              const outType = outResType as ResourceType;
              const outPerSecond = b.production[outType];
              if (!outPerSecond) continue;
              
              const perSec = D(outPerSecond);
              if (perSec.lte(0)) continue;

              // Если у ресурса нет caps в newResources (на всякий случай) — считаем что можно производить.
              if (!newResources[outType]) {
                canProduceAny = true;
                break;
              }

              const cap = newResources[outType].max;
              if (cap.gt(0)) {
                const baseAmount = getBuf(buffers, baseKey, outType);
                // Если база почти заполнена — этот выход блокируется
                if (baseAmount.gte(cap)) {
                  continue;
                }

                // Для энергии локальный буфер не используется
                if (outType !== 'energy') {
                  const localAmount = getBuf(buffers, tileKey, outType);
                  const maxLocalBuffer = perSec.mul(20);
                  if (localAmount.gte(maxLocalBuffer)) {
                    continue;
                  }
                }
              }

              canProduceAny = true;
              break;
            }

            if (!canProduceAny) {
              continue;
            }
          }

          const tilePolicy = state.grid.marketPolicy?.[tileKey];

          // Проверяем - не переполнены ли выходные ресурсы. Если да - здание фактически не работает,
          // и ему не нужно ни доставлять входы, ни покупать их на рынке.
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

                  if (localAmount.gte(maxLocalBuffer) || baseAmount.gte(baseCap)) {
                    outputsBlocked = true;
                    break;
                  }
                }
              }
            }
          }

          // Market Policy (import): try to top-up missing inputs from the market (tradeable only)
          if (tilePolicy && b.consumption && !outputsBlocked) {
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
              energyConsumedTick = energyConsumedTick.add(cost);
              energyDrainMarketImportTick = energyDrainMarketImportTick.add(cost);
              const curLocal = getBuf(buffers, tileKey, rType);
              buffers = setBuf(buffers, tileKey, rType, curLocal.add(actual));
            }
          }

          // АВТОМАТИЧЕСКАЯ ДОСТАВКА: Собираем ресурсы от ВСЕХ доступных источников
          if (b.consumption) {
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
                // Ищем источники используя кэшированные маршруты (O(1) access + O(K) iter)
                const sourceKeys = logisticsCache.routes[tileKey]?.[rType];
                
                if (sourceKeys) {
                    for (const sourceKey of sourceKeys) {
                      if (shortfall.lte(0)) break;
                      
                      const sourceAvailable = getBuf(buffers, sourceKey, rType);
                      // Skip empty sources (fast check)
                      if (sourceAvailable.lte(0)) continue; 
                      
                      const toTransfer = sourceAvailable.min(shortfall);
                      
                      if (toTransfer.gt(0)) {
                        // Mutates buffers directly via optimized setBuf shadow
                        const prevSource = getBuf(buffers, sourceKey, rType);
                        buffers = setBuf(buffers, sourceKey, rType, prevSource.sub(toTransfer));
                        const prevTarget = getBuf(buffers, tileKey, rType);
                        buffers = setBuf(buffers, tileKey, rType, prevTarget.add(toTransfer));
                        
                        shortfall = shortfall.sub(toTransfer);
                        
                        // Visualization (only needed if UI is open really, but cheap enough)
                        // Decoding positions from keys is slightly expensive, maybe optimize?
                        // For now keep it to maintain feature parity.
                        // Can optimize by checking if we really need to push to activeTransports
                        if (activeTransports.length < 50) { // Limit visualization count optimization
                            const sourcePos = sourceKey === baseKey ? getBasePos(state.grid) : parseKey(sourceKey);
                            if (sourcePos) {
                                activeTransports.push({
                                  from: { x: sourcePos.x, y: sourcePos.y },
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
            }
          }
          } // Close if (b.consumption)
           
          // Determine how much we can run given inputs.
          let ratio = D(1);
          
          // Проверяем что здания-добытчики стоят на правильном депозите
          const requiredDeposit = requiredDepositForBuilding(b.id);
          if (requiredDeposit) {
            const tileDeposit = state.grid.deposits?.[tileKey];
            if (tileDeposit !== requiredDeposit) {
              ratio = D(0); // Не производим если нет депозита
            }
          }
          
          if (b.consumption) {
            const buildingLevel = state.grid.tileLevels?.[tileKey] || 1; // ФАЗА 8.5: Получаем уровень из tileLevels
            for (const [resType, perSecond] of Object.entries(b.consumption)) {
              const rType = resType as ResourceType;
              const perSecondAdj = rType === 'energy' ? D(perSecond).mul(D(coldFusionMult)) : D(perSecond);
              // ФАЗА 5: Применяем множитель режима к потреблению
              const modeMult = rType === 'energy' ? energyMult : consumptionMult;
              const need = perSecondAdj.mul(dtFacilities).mul(buildingLevel).mul(modeMult); // Умножаем на уровень и режим

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

          // Проверка энергии для зданий со старой системой energyConsumption (ПОСЛЕ проверки всех входов)
          // Важно: иначе здания могли тратить энергию даже если не могут работать из-за отсутствия ресурсов.
          if (ratio.gt(0) && b.energyConsumption && D(b.energyConsumption).gt(0)) {
            const buildingLevel = state.grid.tileLevels?.[tileKey] || 1;
            // ФАЗА 5: Применяем множитель режима к энергопотреблению
            const energyNeed = D(b.energyConsumption).mul(D(coldFusionMult)).mul(dtFacilities).mul(buildingLevel).mul(energyMult);
            const availableEnergy = getBuf(buffers, baseKey, 'energy');

            if (availableEnergy.lte(0)) {
              ratio = D(0);
            } else if (energyNeed.gt(0)) {
              ratio = ratio.min(availableEnergy.div(energyNeed));
            }

            ratio = ratio.max(D(0)).min(D(1));
          }

          // Вычитаем энергию для зданий со старой системой energyConsumption
          if (ratio.gt(0) && b.energyConsumption && D(b.energyConsumption).gt(0)) {
            const buildingLevel = state.grid.tileLevels?.[tileKey] || 1;
            // ФАЗА 5: Применяем множитель режима к энергопотреблению
            const energyConsume = D(b.energyConsumption).mul(D(coldFusionMult)).mul(dtFacilities).mul(ratio).mul(buildingLevel).mul(energyMult);
            const cur = getBuf(buffers, baseKey, 'energy');
            buffers = setBuf(buffers, baseKey, 'energy', cur.sub(energyConsume));
            if (energyConsume.gt(0)) {
              energyConsumedTick = energyConsumedTick.add(energyConsume);
              energyDrainBuildingsLegacyTick = energyDrainBuildingsLegacyTick.add(energyConsume);
              energyLegacyByBuilding[b.id] = (energyLegacyByBuilding[b.id] ?? D(0)).add(energyConsume);
            }
          }

          if (b.consumption && ratio.gt(0)) {
            const buildingLevel = state.grid.tileLevels?.[tileKey] || 1; // ФАЗА 8.5: Получаем уровень из tileLevels
            for (const [resType, perSecond] of Object.entries(b.consumption)) {
              const rType = resType as ResourceType;
              const perSecondAdj = rType === 'energy' ? D(perSecond).mul(D(coldFusionMult)) : D(perSecond);
              // ФАЗА 5: Применяем множитель режима к потреблению
              const modeMult = rType === 'energy' ? energyMult : consumptionMult;
              const consume = perSecondAdj.mul(dtFacilities).mul(ratio).mul(buildingLevel).mul(modeMult); // Умножаем на уровень и режим

              if (rType === 'energy') {
                const cur = getBuf(buffers, baseKey, 'energy');
                buffers = setBuf(buffers, baseKey, 'energy', cur.sub(consume));
                if (consume.gt(0)) {
                  energyConsumedTick = energyConsumedTick.add(consume);
                  energyDrainBuildingsConsumptionTick = energyDrainBuildingsConsumptionTick.add(consume);
                  energyConsumptionByBuilding[b.id] = (energyConsumptionByBuilding[b.id] ?? D(0)).add(consume);
                }
              } else {
                /*
                 * Переработка (specials.recycleRate): часть сырья возвращается в тот же буфер.
                 * Списываем сразу нетто вместо «списать и вернуть» — результат тот же, но без
                 * второй записи в буфер на каждый вход каждого тайла. Энергию не возвращаем:
                 * она глобальна, и рециклинг там означал бы вечный двигатель.
                 */
                const net = specials.recycleRate > 0 ? consume.mul(1 - specials.recycleRate) : consume;
                const localCur = getBuf(buffers, tileKey, rType);
                buffers = setBuf(buffers, tileKey, rType, localCur.sub(net));
              }
            }
          }

          if (ratio.gt(0)) {
            for (const [resType, perSecond] of Object.entries(b.production)) {
              const rType = resType as ResourceType;
              
              // Проверяем переполнение: когда база (или локальный буфер) заполнены, производство не идёт
              if (newResources[rType]) {
                const baseCap = newResources[rType].max;
                if (baseCap.gt(0)) {
                  const baseAmount = getBuf(buffers, baseKey, rType);
                  
                  // Для энергии проверяем только базу (она глобальна)
                  if (rType === 'energy') {
                    // Если база заполнена - не производим
                    if (baseAmount.gte(baseCap)) {
                      continue;
                    }
                  } else {
                    // Для остальных ресурсов проверяем локальный буфер
                    const localAmount = getBuf(buffers, tileKey, rType);
                    
                    // Если уже есть локальный буфер >20 сек - не производим (переполнение)
                    const productionRate = D(perSecond);
                    const maxLocalBuffer = productionRate.mul(20);
                    if (localAmount.gte(maxLocalBuffer)) {
                      continue;
                    }
                    
                    // Если база заполнена - не производим
                    if (baseAmount.gte(baseCap)) {
                      continue;
                    }
                  }
                }
              }
              
              let produced = D(perSecond).mul(dtFacilities).mul(ratio);
              
              // ФАЗА 8.5: Применяем множитель уровня здания (линейный рост производства)
              const buildingLevel = state.grid.tileLevels?.[tileKey] || 1;
              produced = produced.mul(buildingLevel);
              
              // ФАЗА 5: Применяем множитель режима к производству
              produced = produced.mul(productionMult);

              // Политики, усиливающие конкретный тип здания (АЭС, солнечные панели, военка...).
              if (policyBuildingMult !== 1) {
                produced = produced.mul(policyBuildingMult);
              }

              // PHASE 4: Применяем множитель эволюции здания
              const evolutionLevel = state.grid.tileEvolutionLevels?.[tileKey] || 0;
              if (evolutionLevel > 0) {
                const evolutionMultiplier = getEvolutionMultiplier(b.id, evolutionLevel);
                produced = produced.mul(evolutionMultiplier);
              }
              
              // Apply energy efficiency reduction to non-energy production
              if (rType !== 'energy' && energyEfficiency < 1.0) {
                produced = produced.mul(energyEfficiency);
              }
              
              // Apply pollution penalty to all non-energy production (Фаза 8.1)
              if (rType !== 'energy' && state.pollution.efficiencyMultiplier < 1.0) {
                produced = produced.mul(state.pollution.efficiencyMultiplier);
              }
              
              // Apply proximity multiplier (if building has proximity rules)
              if (b.proximityMultiplier && b.proximityMultiplier !== 1) {
                produced = produced.mul(b.proximityMultiplier);
              }
              
              // Apply repeatable research bonus for exotic resources
              if (isExoticResource(rType)) {
                produced = produced.mul(repeatableExoticMult);
              }
              
              // Apply current galaxy resource bonuses
              const currentGalaxy = GALAXIES[state.galaxies.currentGalaxyId];
              if (currentGalaxy?.resourceBonuses && currentGalaxy.resourceBonuses[rType]) {
                produced = produced.mul(currentGalaxy.resourceBonuses[rType]);
              }
              
              // ФАЗА 8.3: Применяем логистический штраф за дальность
              // Здания далеко от базы/складов работают менее эффективно
              // ВАЖНО: Добывающие здания (привязаны к месторождениям) НЕ получают штраф
              if (rType !== 'energy') {
                const logisticsEfficiency = calculateLogisticsEfficiency(
                  tilePos,
                  basePosition,
                  activeLogisticsHubs,
                  b.id, // ID здания для проверки добывающих
                  artifactBonuses.logisticsPenaltyReduction // Бонус артефактов
                );
                if (logisticsEfficiency < 1.0) {
                  produced = produced.mul(logisticsEfficiency);
                }
              }
              
              if (rType !== 'energy' && produced.gt(0) && doubleChance > 0 && Math.random() < doubleChance) {
                produced = produced.mul(2);
              }
              
              // ЭНЕРГИЯ идёт напрямую в базовый буфер (она глобальна)
              // Остальные ресурсы производятся в локальный буфер здания
              if (rType === 'energy') {
                // Энергия сразу в базу
                const curBase = getBuf(buffers, baseKey, 'energy');
                buffers = setBuf(buffers, baseKey, 'energy', curBase.add(produced));

                if (produced.gt(0)) {
                  energyProducedTick = energyProducedTick.add(produced);
                }
                
                if (produced.gt(0)) {
                  lifetimeEnergyProduced = lifetimeEnergyProduced.add(produced);
                }
              } else {
                // Остальные ресурсы в локальный буфер здания
                // Автоматическая логистика доставит их туда, где они нужны
                const cur = getBuf(buffers, tileKey, rType);
                buffers = setBuf(buffers, tileKey, rType, cur.add(produced));
              }
            }

            /*
             * Флаг gas_power_produces_gasoline: газовая станция дополнительно даёт побочный
             * бензин. Выпуск привязан к её паспортному расходу газа (10%), а не к отдельной
             * константе, чтобы бонус масштабировался вместе со зданием и его уровнем.
             */
            if (gasPlantGasoline && b.id === 'gas_power_plant_mk1' && b.consumption?.natural_gas) {
              const buildingLevel = state.grid.tileLevels?.[tileKey] || 1;
              const byproduct = D(b.consumption.natural_gas)
                .mul(D('0.1'))
                .mul(dtFacilities)
                .mul(ratio)
                .mul(buildingLevel)
                .mul(productionMult);
              // Кладём сразу на базу: вывоз излишков с тайла идёт только по объявленному
              // production здания, а бензина там нет — в локальном буфере он бы залип навсегда.
              if (byproduct.gt(0)) {
                const cur = getBuf(buffers, baseKey, 'gasoline');
                const cap = newResources.gasoline?.max;
                if (!cap || cap.lte(0) || cur.lt(cap)) {
                  buffers = setBuf(buffers, baseKey, 'gasoline', cur.add(byproduct));
                }
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

          // ФАЗА 5: Обработка авто-продажи из настроек здания (tileSettings.autoSell)
          // Продаём ресурсы с БАЗЫ (baseKey) за кредиты
          if (tileSettings?.autoSell && tileSettings.autoSell.length > 0) {
            for (const autoSellConfig of tileSettings.autoSell) {
              if (!autoSellConfig.enabled) continue;
              
              const r = autoSellConfig.resource;
              // Проверяем что ресурс торгуемый
              if (!(TRADEABLE as string[]).includes(r)) continue;
              
              // Проверяем ресурсы на БАЗЕ, а не в буфере здания
              const have = getBuf(buffers, baseKey, r);
              if (have.lte(0)) continue;
              
              // Получаем cap для этого ресурса
              const resourceCap = newResources[r]?.max ?? D(0);
              if (resourceCap.lte(0)) continue;
              
              // Продаём только если заполнение > порога
              const fillPercent = have.div(resourceCap).mul(100);
              if (fillPercent.lt(autoSellConfig.threshold)) continue;
              
              // Оставляем keepAmount
              const keepAmount = D(autoSellConfig.keepAmount || '0');
              const sellable = have.sub(keepAmount).max(D(0));
              if (sellable.lte(0)) continue;
              
              // Проверяем минимальную цену если задана
              const price = state.market.prices[r as TradeResourceType];
              if (autoSellConfig.minPrice && price.lt(D(autoSellConfig.minPrice))) continue;
              
              const sellAmt = sellable.min(D(12).mul(dt));
              if (sellAmt.lte(0)) continue;
              
              // Продажа за КРЕДИТЫ (экспортные политики повышают выручку)
              const earned = price.mul(sellAmt).mul(D(tradeMult)).mul(specials.sellCredits);

              // Вычитаем ресурсы с базы
              buffers = setBuf(buffers, baseKey, r, have.sub(sellAmt).max(D(0)));
              
              // Накапливаем заработанные кредиты (добавим к nextCurrency позже)
              autoSellCreditsEarned = autoSellCreditsEarned.add(earned);
            }
          }
        }
      }

      // Автоматическая отправка ВСЕХ произведённых ресурсов на базу
      // Отправляем излишки, оставляя 10 секунд для локальной доставки соседним зданиям
      // ОПТИМИЗАЦИЯ: Используем for...in и buildingsMap вместо find()
      for (const tileKey in tiles) {
        if (tileKey === 'base') continue;
        
        const buildingId = tiles[tileKey];
        const building = buildingsMap.get(buildingId);
        if (!building?.production) continue;
        
        // Проходим по всем производимым ресурсам здания
        for (const rType in building.production) {
          const resourceType = rType as ResourceType;
          const prodRate = building.production[resourceType];
          if (!prodRate) continue;
          
          // Энергия уже добавляется напрямую в базу, пропускаем её здесь
          if (resourceType === 'energy') continue;
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
      const energyBeforeClamp = traceFlows ? getBuf(buffers, baseKey, 'energy') : null;
      buffers = clampBaseBufferToCaps(buffers, newResources);
      const energyAfterClamp = traceFlows ? getBuf(buffers, baseKey, 'energy') : null;
      const energyClampRemoved =
        traceFlows && energyBeforeClamp && energyAfterClamp
          ? energyBeforeClamp.sub(energyAfterClamp)
          : null;

      // Sync global resources from base buffer (and clamp by caps)
      newResources = syncResourcesFromBase(newResources, buffers);

      // ОПТИМИЗАЦИЯ: Calculate production rates только при изменении сетки
      // Используем count вместо ref для избежания ложных инвалидаций от Zustand
      const currentTilesCount = Object.keys(state.grid.tiles).length;
      const currentBuildingsCount = state.buildings.length;
      
      const needsProductionRatesRecalc =
        productionRatesCache.tilesCount !== currentTilesCount ||
        productionRatesCache.tileLevelsRef !== state.grid.tileLevels ||
        productionRatesCache.tileEvolutionLevelsRef !== state.grid.tileEvolutionLevels ||
        productionRatesCache.tileSettingsRef !== state.grid.tileSettings || // ФАЗА 5: инвалидация при изменении настроек
        productionRatesCache.tileDisabledRef !== state.grid.tileDisabled || // ФАЗА 5: инвалидация при отключении
        productionRatesCache.activePoliciesRef !== state.politics.activePolicies || // множители политик вмешаны в ставки
        productionRatesCache.buildingsCount !== currentBuildingsCount ||
        !productionRatesCache.rates;

      let productionRates: Record<ResourceType, Decimal>;
      
      if (needsProductionRatesRecalc) {
        // Полный пересчёт (только при изменении структуры)
        productionRates = {
          energy: D_ZERO, ore: D_ZERO, ice: D_ZERO, carbon: D_ZERO, steel: D_ZERO, dark_matter: D_ZERO,
          natural_gas: D_ZERO, oil: D_ZERO, gasoline: D_ZERO, plastic: D_ZERO, glass: D_ZERO, chemicals: D_ZERO, sand: D_ZERO,
          uranium: D_ZERO, chrome: D_ZERO, titanium: D_ZERO, copper: D_ZERO, semiconductors: D_ZERO, dynamite: D_ZERO, fiber: D_ZERO,
          integrated_circuit: D_ZERO, battery: D_ZERO, engine: D_ZERO, display: D_ZERO, computer: D_ZERO, liquid_fuel: D_ZERO,
          chrome_alloy: D_ZERO, titanium_alloy: D_ZERO, enriched_uranium: D_ZERO,
          weapon: D_ZERO, artillery: D_ZERO, radar: D_ZERO, nuclear_bomb: D_ZERO,
          jet_engine: D_ZERO, satellite: D_ZERO, rocket: D_ZERO, spaceship: D_ZERO, console: D_ZERO, space_station: D_ZERO,
          robot: D_ZERO, waste: D_ZERO, radioactive_waste: D_ZERO,
          // Фаза 3: T6 Entertainment
          music_album: D_ZERO, movie: D_ZERO, video_game: D_ZERO, streaming_service: D_ZERO,
          vr_headset: D_ZERO, ar_glasses: D_ZERO, gaming_console: D_ZERO, smart_tv: D_ZERO,
          // Фаза 3: T6 Culture
          artwork: D_ZERO, sculpture: D_ZERO, literature: D_ZERO, architecture: D_ZERO, fashion: D_ZERO, jewelry: D_ZERO,
          // Фаза 3: T7 Social
          social_network: D_ZERO, messaging_app: D_ZERO, search_engine: D_ZERO,
          cloud_service: D_ZERO, ai_assistant: D_ZERO, cryptocurrency: D_ZERO,
          // Фаза 3: T7 Medical
          medicine: D_ZERO, vaccine: D_ZERO, bioimplant: D_ZERO, gene_therapy: D_ZERO, cryonics: D_ZERO,
          // Фаза 3: T8 Megastructures
          orbital_habitat: D_ZERO, dyson_component: D_ZERO, warp_core: D_ZERO, quantum_computer: D_ZERO, antimatter: D_ZERO,
          // Фаза 3: T9 Transcendence
          singularity_core: D_ZERO, time_crystal: D_ZERO, dimensional_rift: D_ZERO, omega_matter: D_ZERO, ascension_essence: D_ZERO,
        };
        
        /*
         * Множители политик, которые тик реально применяет к выпуску и расходу. Раскрываем
         * их здесь, ДО циклов по тайлам: агрегатор уже посчитан один раз на тик (policyEffects),
         * а внутри обхода остаётся только чтение чисел и поиск по id здания.
         *
         * Без этого витрина расходилась с кассой: при активной политике «+30% производства»
         * панель ресурсов показывала базовую ставку, а в буфер капало на 30% больше.
         * Множители, не зависящие от политик (speedMult/boost/артефакты/вознесение), сюда
         * намеренно не тянем — это отдельная правка и другой набор ключей инвалидации.
         */
        const policyProdMult = policyEffects.production * specials.productionSpeed;
        const policyConsMult = specials.consumption;
        const policyBuildingMults = policyEffects.buildingTypeMultipliers;

        // ОПТИМИЗАЦИЯ: Используем buildingsMap вместо find() каждый раз
        // Суммируем производство со всех зданий на карте
        for (const tileKey in state.grid.tiles) {
          const buildingId = state.grid.tiles[tileKey];
          const building = buildingsMap.get(buildingId);
          if (!building?.production) continue;
          
          // ФАЗА 5: Проверяем disabled и enabled
          if (tileDisabled[tileKey]) continue;
          const tileSett = state.grid.tileSettings?.[tileKey];
          if (tileSett && !tileSett.enabled) continue;
          
          const buildingLevel = state.grid.tileLevels?.[tileKey] || 1;
          const evolutionLevel = state.grid.tileEvolutionLevels?.[tileKey] || 0;
          const evolutionMult = evolutionLevel > 0 ? getEvolutionMultiplier(buildingId, evolutionLevel) : 1;
          
          // ФАЗА 5: Получаем множитель режима
          const modeKey = tileSett?.mode || 'normal';
          const modeConf = BUILDING_MODES[modeKey];
          const prodModeMult = modeConf?.productionMultiplier ?? 1;

          // Тот же множитель по id здания, что тик применяет к выпуску (см. цикл производства).
          const policyMult = policyProdMult * (policyBuildingMults[buildingId] ?? 1);

          for (const resType in building.production) {
            const rType = resType as ResourceType;
            const baseRate = building.production[rType];
            if (!baseRate) continue;

            let rate = D(baseRate).mul(buildingLevel).mul(evolutionMult).mul(prodModeMult).mul(policyMult);

            // Применяем proximity множитель
            if (building.proximityMultiplier && building.proximityMultiplier !== 1) {
              rate = rate.mul(building.proximityMultiplier);
            }
            
            productionRates[rType] = productionRates[rType].add(rate);
          }
        }
        
        // Вычитаем потребление
        for (const tileKey in state.grid.tiles) {
          const buildingId = state.grid.tiles[tileKey];
          const building = buildingsMap.get(buildingId);
          if (!building?.consumption) continue;
          
          // ФАЗА 5: Проверяем disabled и enabled
          if (tileDisabled[tileKey]) continue;
          const tileSett = state.grid.tileSettings?.[tileKey];
          if (tileSett && !tileSett.enabled) continue;
          
          const buildingLevel = state.grid.tileLevels?.[tileKey] || 1;
          
          // ФАЗА 5: Получаем множитель режима
          const modeKey = tileSett?.mode || 'normal';
          const modeConf = BUILDING_MODES[modeKey];
          const consModeMult = modeConf?.consumptionMultiplier ?? 1;
          const energyModeMult = modeConf?.energyMultiplier ?? 1;
          
          for (const resType in building.consumption) {
            const rType = resType as ResourceType;
            const baseRate = building.consumption[rType];
            if (!baseRate) continue;
            
            // specials.consumption тик домешивает и в проверку доступности входов, и в само
            // списание — витрина обязана считать по той же ставке.
            const modeMult = (rType === 'energy' ? energyModeMult : consModeMult) * policyConsMult;
            const rate = D(baseRate).mul(buildingLevel).mul(modeMult);
            productionRates[rType] = productionRates[rType].sub(rate);
          }
        }
        
        // Сохраняем в кэш
        productionRatesCache = {
          tilesCount: currentTilesCount,
          tileLevelsRef: state.grid.tileLevels,
          tileEvolutionLevelsRef: state.grid.tileEvolutionLevels,
          tileSettingsRef: state.grid.tileSettings, // ФАЗА 5
          tileDisabledRef: state.grid.tileDisabled, // ФАЗА 5
          activePoliciesRef: state.politics.activePolicies,
          buildingsCount: currentBuildingsCount,
          rates: productionRates,
          lastCalculatedAt: now,
        };
      } else {
        // Используем кэшированные значения
        productionRates = productionRatesCache.rates!;
      }
      
      // Обновляем поле production в ресурсах
      for (const resourceType in newResources) {
        const rType = resourceType as ResourceType;
        newResources[rType] = {
          ...newResources[rType],
          production: productionRates[rType] || D(0),
        };
      }

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
        const prices = updateMarketPrices(state.market.prices);
        const history = pushMarketHistory(state.market.history, prices, now);
        
        // Выдача и протухание контрактов вынесены из обновления рынка в отдельный блок ниже:
        // они живут по своему таймеру, а не по 30-секундному тику цен.

        // Process trading orders
        let orders = state.market.orders ?? [];
        const executedOrders: string[] = [];
        let nextCurrency = state.currency;
        
        // Добавляем кредиты от autoSell зданий
        if (autoSellCreditsEarned.gt(0)) {
          nextCurrency = {
            ...nextCurrency,
            credits: nextCurrency.credits.add(autoSellCreditsEarned)
          };
        }
        
        for (const order of orders) {
          // Check if order expired
          if (order.expiresAt <= now) {
            executedOrders.push(order.id);
            // Return collateral
            if (order.type === 'buy') {
              nextCurrency = {
                ...nextCurrency,
                credits: nextCurrency.credits.add(order.collateral)
              };
            } else {
              const cur = getBuf(buffers, baseKey, order.resource);
              buffers = setBuf(buffers, baseKey, order.resource, cur.add(order.collateral));
            }
            continue;
          }
          
          // Check if target price reached
          const currentPrice = prices[order.resource];
          const eventMult = event?.multiplier ?? 1.0;
          const effectivePrice = currentPrice.mul(D(eventMult));
          
          if (order.type === 'buy' && effectivePrice.lte(order.targetPrice)) {
            // Execute buy order
            executedOrders.push(order.id);
            const cur = getBuf(buffers, baseKey, order.resource);
            buffers = setBuf(buffers, baseKey, order.resource, cur.add(order.amount));
            // Collateral was already locked, no need to return
          } else if (order.type === 'sell' && effectivePrice.gte(order.targetPrice)) {
            // Execute sell order
            executedOrders.push(order.id);
            const earned = order.targetPrice.mul(order.amount);
            nextCurrency = {
              ...nextCurrency,
              credits: nextCurrency.credits.add(earned)
            };
            // Resources were already locked, no need to return
          }
        }
        
        orders = orders.filter(o => !executedOrders.includes(o.id));
        
        nextMarket = {
          ...state.market,
          prices,
          event,
          nextUpdateAt: now + MARKET_UPDATE_SECONDS * 1000,
          history,
          orders,
        };
      }

      /*
       * Автовыдача контрактов.
       *
       * Раньше generateContract не вызывался ниоткуда, а в обновлении рынка жила его
       * урезанная копия (без speedBonus и с фиксированным сроком в 2 минуты). Теперь
       * источник один — createContract, — и он привязан к собственному таймеру.
       *
       * nextContractAt всегда переустанавливается в now + интервал (а не увеличивается на
       * интервал), поэтому серия догоняющих шагов тика в одном кадре и возвращение из
       * офлайна дадут ровно один контракт, а не пачку.
       *
       * Массив пересобираем только когда он реально меняется: market — срез Zustand, и
       * новый contracts каждый тик заставлял бы перерисовываться всю торговую панель.
       */
      const currentContracts = nextMarket.contracts ?? [];
      const hasExpired = currentContracts.some(c => c.expiresAt <= now);
      const spawnDue = now >= nextContractAt;
      if (hasExpired || spawnDue) {
        let contracts = hasExpired ? currentContracts.filter(c => c.expiresAt > now) : currentContracts;
        if (spawnDue) {
          nextContractAt = now + CONTRACT_SPAWN_INTERVAL_SECONDS * 1000;
          if (contracts.length < MAX_ACTIVE_CONTRACTS) {
            contracts = [...contracts, createContract(now)];
          }
        }
        if (contracts !== currentContracts) {
          nextMarket = { ...nextMarket, contracts };
        }
      }

      // Smart-Broker: auto-sell surplus (only if rent was paid)
      // Сначала заполняет энергию, потом продаёт за кредиты
      if (demonsPaid.smart_broker) {
        const energyCap = newResources.energy.max;
        const threshold = D('0.90');
        
        for (const t of TRADEABLE) {
          // Пропускаем если пользователь отключил автопродажу этого ресурса
          if (state.demons.brokerExcludeFromAutoSell[t]) continue;
          
          const cap = newResources[t].max;
          let have = getBuf(buffers, baseKey, t);
          const limit = cap.mul(threshold);
          if (have.lte(limit)) continue;

          const excess = have.sub(limit);
          let remainingSell = excess.min(D(12).mul(dt));
          if (remainingSell.lte(0)) continue;

          const price = nextMarket.prices[t];
          const curE = getBuf(buffers, baseKey, 'energy');
          const energyRoom = energyCap.sub(curE).max(D(0));

          // Фаза 1: Сначала заполняем энергию
          if (energyRoom.gt(0) && remainingSell.gt(0)) {
            const sellForEnergy = energyRoom.div(price.mul(D(tradeMult))).min(remainingSell).max(D(0));
            if (sellForEnergy.gt(0)) {
              const earnedEnergy = price.mul(sellForEnergy).mul(D(tradeMult));
              buffers = setBuf(buffers, baseKey, t, have.sub(sellForEnergy).max(D(0)));
              buffers = setBuf(buffers, baseKey, 'energy', curE.add(earnedEnergy));
              have = getBuf(buffers, baseKey, t);
              remainingSell = remainingSell.sub(sellForEnergy);
            }
          }

          // Фаза 2: Если энергия полная и остались излишки - продаём за кредиты.
          // Фаза 1 выше меняет ресурс на энергию, а не на кредиты, поэтому там sellCredits не к месту.
          if (remainingSell.gt(0)) {
            const earnedCredits = price.mul(remainingSell).mul(D(tradeMult)).mul(specials.sellCredits);
            buffers = setBuf(buffers, baseKey, t, have.sub(remainingSell).max(D(0)));
            // Накапливаем кредиты, добавим к nextCurrency позже
            autoSellCreditsEarned = autoSellCreditsEarned.add(earnedCredits);
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
      /*
       * Убитые за этот тик враги — и у базы, и на платформах. Считаем числом, а квесты
       * трогаем один раз в конце: обход activeQuests на каждом попадании при 20 Гц был бы
       * лишней работой на пустом месте (в большинстве тиков убийств просто нет).
       */
      let enemyKillsThisTick = 0;
      // Note: We now process combat even when baseHp <= 0 to handle regen
      {
        let baseHp = state.combat.baseHp;
        let enemies = state.combat.enemies.map((e) => ({ ...e }));
        let nextWaveAt = state.combat.nextWaveAt;
        let waveEndsAt = state.combat.waveEndsAt;
        let nextSpawnAt = state.combat.nextSpawnAt;
        let lastDamageAt = state.combat.lastDamageAt ?? 0;

        let defenseEnergyNeedPerSecond = D(0);
        let defenseEnergyUsedPerSecond = D(0);
        let defenseFireRatio = D(0);
        let baseDamageTaken = D(0);
        let baseRegenPerSecond = D(0);

        const shieldBuilding = state.buildings.find((b) => b.id === 'shield_mk1');
        const shieldCount = shieldBuilding?.count ?? 0;
        const shieldDef = shieldBuilding?.defense;

        // Оборонные политики поднимают потолок щита; текущий HP ниже зажимается по нему,
        // поэтому при снятии политики излишек щита срезается сам собой.
        const shieldMaxHp = shieldDef ? shieldDef.shieldMaxHp.mul(shieldCount).mul(specials.defense) : D(0);
        let shieldHp = state.combat.shieldHp.min(shieldMaxHp).max(D(0));
        let shieldAbsorbed = D(0);
        let shieldEnergyNeedPerSecond = D(0);
        let shieldEnergyUsedPerSecond = D(0);
        let shieldRegenPerSecond = D(0);

        let enemyPressurePerSecond = D(0);
        let enemyPressurePotentialPerSecond = D(0);
        
        // Проверяем модификатор peaceful текущей карты
        const currentMapDef = state.maps?.currentMapId ? getMapDefinition(state.maps.currentMapId) : null;
        const isPeacefulMap = currentMapDef?.modifiers?.includes('peaceful') ?? false;

        // Only process waves and combat if base is alive AND map is not peaceful
        if (baseHp.gt(0) && !isPeacefulMap) {
          // Start a new wave
          if (now >= nextWaveAt && enemies.length === 0) {
            waveEndsAt = now + WAVE_DURATION_SECONDS * 1000;
            nextSpawnAt = now;
            // waveInterval > 1 — нападения реже (пацифистские политики). Длительность самой
            // волны не трогаем: политика обещает более редкие атаки, а не более короткие.
            nextWaveAt = now + WAVE_INTERVAL_SECONDS * 1000 * specials.waveInterval;
          }
        }

        const waveActive = waveEndsAt > now && !isPeacefulMap;

        // Shield regen (only during active wave to create an energy conflict)
        if (baseHp.gt(0) && waveActive && shieldCount > 0 && shieldDef && shieldMaxHp.gt(0) && shieldHp.lt(shieldMaxHp) && dt > 0) {
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
            if (energyConsumed.gt(0)) {
              energyConsumedTick = energyConsumedTick.add(energyConsumed);
              energyDrainCombatShieldTick = energyDrainCombatShieldTick.add(energyConsumed);
            }
            newResources.energy.amount = getBuf(buffers, baseKey, 'energy').min(newResources.energy.max);

            // Apply Shield Boost multiplier to regen
            const regen = shieldDef.shieldRegenPerSecond.mul(combatMult).mul(aegisShieldBoostMult).mul(shieldCount).mul(dt).mul(ratio);
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

        // Spawn enemies during active wave (only if base is alive and not peaceful map)
        if (baseHp.gt(0) && waveActive) {
          while (now >= nextSpawnAt && enemies.length < 40) {
            enemies.push(createEnemy());
            nextSpawnAt += SPAWN_INTERVAL_SECONDS * 1000;
            if (nextSpawnAt > waveEndsAt) break;
          }
        }

        // Move enemies towards base; impact deals damage (only if base is alive)
        if (baseHp.gt(0) && enemies.length > 0) {
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
                lastDamageAt = now;
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
            if (energyConsumed.gt(0)) {
              energyConsumedTick = energyConsumedTick.add(energyConsumed);
              energyDrainCombatTurretsTick = energyDrainCombatTurretsTick.add(energyConsumed);
            }
            newResources.energy.amount = getBuf(buffers, baseKey, 'energy').min(newResources.energy.max);

            // Apply Turret Overdrive multiplier to damage.
            // Турели получают обе политические ручки: damage — как любое оружие игрока,
            // defense — как оборонительное сооружение.
            let damage = turretCombat.dps
              .mul(combatMult)
              .mul(aegisTurretOverdriveMult)
              .mul(turretCount)
              .mul(dt)
              .mul(ratio)
              .mul(specials.damage)
              .mul(specials.defense);
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

            // splice выше удаляет добитых — разница длин и есть число убитых турелями.
            enemyKillsThisTick += enemies.length - nextEnemies.length;
            enemies = nextEnemies;
          }
        }

        // Nano-swarm attack (free DPS, scaled by combat multiplier)
        if (enemies.length > 0 && baseHp.gt(0) && dt > 0) {
          let damage = computeNanoAttackDpsPerSecond(
            state.nanoSwarm.total,
            state.nanoSwarm.allocation.attack ?? 0,
            combatMult,
          ).mul(dt).mul(specials.damage); // Рой — тоже оружие игрока, попадает под damage.
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
            enemyKillsThisTick += enemies.length - nextEnemies.length;
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
              lastDamageAt = now;
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
              lastDamageAt = now;
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

        // Auto Repair (Aegis) - works even during combat
        const baseMaxHp = state.combat.baseMaxHp;
        if (aegisAutoRepairPerSec > 0 && baseHp.gt(0) && baseHp.lt(baseMaxHp) && dt > 0) {
          const autoRepairAmount = D(aegisAutoRepairPerSec).mul(dt);
          baseHp = baseHp.add(autoRepairAmount).min(baseMaxHp);
          baseRegenPerSecond = baseRegenPerSecond.add(aegisAutoRepairPerSec);
        }

        // Base HP regeneration when not in combat (after cooldown)
        const timeSinceLastDamage = now - lastDamageAt;
        const canRegen = enemies.length === 0 && 
                         !waveActive && 
                         timeSinceLastDamage >= BASE_REGEN_COOLDOWN_SECONDS * 1000 &&
                         baseHp.lt(baseMaxHp) &&
                         dt > 0;
        
        if (canRegen) {
          const regenAmount = BASE_REGEN_PER_SECOND.mul(dt);
          baseHp = baseHp.add(regenAmount).min(baseMaxHp);
          baseRegenPerSecond = baseRegenPerSecond.add(BASE_REGEN_PER_SECOND);
        }

        // Clear enemies when base is destroyed
        if (baseHp.lte(0) && enemies.length > 0) {
          enemies = [];
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
          lastDamageAt,
          baseRegenPerSecond,
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

      // Special buildings: Research centers and Bitcoin farm
      let nextCurrency = state.currency;
      
      // Добавляем кредиты от Smart-Broker автопродажи
      if (autoSellCreditsEarned.gt(0)) {
        nextCurrency = {
          ...nextCurrency,
          credits: nextCurrency.credits.add(autoSellCreditsEarned)
        };
      }
      
      // Research points generation. Rates live in ../core/production/currencyRates so that
      // CurrencyPanel shows the same number the tick actually produces (it used to read a
      // non-existent Building.production.researchPoints field and always displayed +0/с).
      const totalRPPerSec = baseResearchPointsPerSecond(state.grid.tiles);

      if (totalRPPerSec.gt(0)) {
        const rpGained = totalRPPerSec.mul(dt).mul(energyEfficiency)
          .mul(artifactBonuses.researchSpeed)
          .mul(ascensionResearchMult)
          .mul(repeatableBonuses.researchSpeedMultiplier) // Apply repeatable research speed bonus
          .mul(policyEffects.research); // Policy research multiplier (was declared but never applied)
        nextCurrency = {
          ...nextCurrency,
          researchPoints: nextCurrency.researchPoints.add(rpGained),
        };
      }
      
      // Bitcoin farm: generates credits
      const bitcoinFarmCount = Object.values(state.grid.tiles).filter(id => id === 'bitcoin_farm_mk1').length;
      if (bitcoinFarmCount > 0) {
        const creditsPerFarmPerSec = D(5.0); // 5 credits/sec per farm
        const creditsGained = creditsPerFarmPerSec.mul(bitcoinFarmCount).mul(dt).mul(energyEfficiency);
        nextCurrency = {
          ...nextCurrency,
          credits: nextCurrency.credits.add(creditsGained),
        };
      }
      
      // Flat credits/second granted by active policies (declared on several policies, never
      // applied before).
      if (policyEffects.creditsPerSecond.gt(0)) {
        nextCurrency = {
          ...nextCurrency,
          credits: nextCurrency.credits.add(policyEffects.creditsPerSecond.mul(dt)),
        };
      }

      // Political Center: generates influence (rates shared with the UI, see currencyRates).
      const totalInfluencePerSec = baseInfluencePerSecond(state.grid.tiles);
      if (totalInfluencePerSec.gt(0)) {
        // specials.influence — прибавка «идеологических» политик к притоку влияния.
        const influenceGained = totalInfluencePerSec.mul(dt).mul(energyEfficiency).mul(specials.influence);
        nextCurrency = {
          ...nextCurrency,
          influence: nextCurrency.influence.add(influenceGained),
        };
      }
      
      // Policy upkeep: deduct influence for active policies
      if (state.politics.activePolicies.length > 0) {
        let totalUpkeep = D(0);
        
        for (const policyId of state.politics.activePolicies) {
          const policy = POLICIES[policyId];
          if (policy && policy.influenceUpkeep) {
            totalUpkeep = totalUpkeep.add(D(policy.influenceUpkeep).mul(dt));
          }
        }
        
        if (totalUpkeep.gt(0)) {
          const newInfluence = nextCurrency.influence.sub(totalUpkeep).max(D(0));
          
          // If influence drops to 0, deactivate all policies
          if (newInfluence.lte(0)) {
            nextCurrency = {
              ...nextCurrency,
              influence: D(0),
            };
            // Note: we'll need to update politics state below
          } else {
            nextCurrency = {
              ...nextCurrency,
              influence: newInfluence,
            };
          }
        }
      }

      // Production display = change in base buffer per second (approx, includes combat drain)
      if (dt > 0) {
        for (const r of Object.keys(newResources) as ResourceType[]) {
          const after = getBuf(buffers, baseKey, r);
          const delta = after.sub(baseBefore[r]);
          // Важно: создаем новый объект чтобы Zustand заметил изменение
          newResources[r] = { ...newResources[r], production: delta.div(dt) };
        }
      }

      // Update platforms (autonomous mining and combat)
      const newNotifications: Array<Omit<import('../core/gameTypes').Notification, 'id' | 'timestamp' | 'read'>> = [];
      
      const updatedPlatforms = state.galaxies.platforms.map(platform => {
        let updatedPlatform = { ...platform };
        const galaxy = GALAXIES[platform.galaxyId];
        
        // Initialize platform resources if not present
        if (!updatedPlatform.resources || Object.keys(updatedPlatform.resources).length === 0) {
          updatedPlatform.resources = {} as Record<ResourceType, import('../core/gameTypes').ResourceState>;
          for (const r of Object.keys(newResources) as ResourceType[]) {
            updatedPlatform.resources[r] = {
              amount: D(0),
              max: D(1000 * (1 + (platform.upgrades?.storage || 0) * 0.5)), // Base 1000, +50% per storage upgrade
              production: D(0),
            };
          }
        }
        
        // Initialize combat if not present or incomplete
        if (!updatedPlatform.combat || !updatedPlatform.combat.shieldRegenPerSecond) {
          updatedPlatform.combat = {
            underAttack: updatedPlatform.combat?.underAttack || false,
            waveEndsAt: updatedPlatform.combat?.waveEndsAt || 0,
            nextWaveAt: updatedPlatform.combat?.nextWaveAt || (Date.now() + 120000),
            enemies: updatedPlatform.combat?.enemies || [],
            damagePerSecond: updatedPlatform.combat?.damagePerSecond || D(0),
            shieldRegenPerSecond: D(5),
            turretCount: updatedPlatform.combat?.turretCount || 0,
            radarCount: updatedPlatform.combat?.radarCount || 0,
            radarRange: updatedPlatform.combat?.radarRange || 1,
          };
        }
        
        // Process buildings on platform grid and produce resources
        const miningBonus = 1 + (platform.upgrades?.mining || 0) * 0.5; // +50% per mining upgrade
        
        for (const [tileKey, buildingId] of Object.entries(platform.grid.tiles)) {
          const building = state.buildings.find(b => b.id === buildingId);
          if (!building?.production) continue;
          
          // Check if building is on correct deposit
          const requiredDeposit = requiredDepositForBuilding(building.id);
          if (requiredDeposit) {
            const tileDeposit = platform.grid.deposits?.[tileKey];
            if (tileDeposit !== requiredDeposit) continue;
          }
          
          // Produce resources
          for (const [resType, perSecond] of Object.entries(building.production)) {
            const rType = resType as ResourceType;
            let produced = D(perSecond).mul(dt).mul(miningBonus);
            
            // Apply galaxy resource bonuses
            if (galaxy?.resourceBonuses && galaxy.resourceBonuses[rType]) {
              produced = produced.mul(galaxy.resourceBonuses[rType]);
            }
            
            // Add to platform resources (with cap check)
            const currentAmount = updatedPlatform.resources[rType]?.amount || D(0);
            const maxAmount = updatedPlatform.resources[rType]?.max || D(1000);
            
            if (currentAmount.lt(maxAmount)) {
              const actualProduced = produced.min(maxAmount.sub(currentAmount));
              updatedPlatform.resources[rType] = {
                ...updatedPlatform.resources[rType]!,
                amount: currentAmount.add(actualProduced),
                production: D(perSecond).mul(miningBonus),
              };
            }
          }
        }
        
        // Check if it's time to spawn new enemy
        if (galaxy && galaxy.enemyLevelRange && now >= platform.combat.nextWaveAt) {
          // Spawn a wave of enemies
          const numEnemies = Math.floor(Math.random() * 3) + 1; // 1-3 enemies
          const newEnemies = [...platform.combat.enemies];
          let hasBoss = false;
          
          for (let i = 0; i < numEnemies; i++) {
            const shouldSpawnBoss = Math.random() < (galaxy.bossChance || 0);
            const enemyLevel = Math.floor(Math.random() * (galaxy.enemyLevelRange[1] - galaxy.enemyLevelRange[0] + 1)) + galaxy.enemyLevelRange[0];
            
            let enemyType: string | null = null;
            
            if (shouldSpawnBoss) {
              enemyType = getBossForLevel(enemyLevel);
              if (enemyType) hasBoss = true;
            } else {
              const validEnemyTypes = galaxy.enemyTypes?.filter(type => ENEMY_DEFINITIONS[type as EnemyType]) || [];
              if (validEnemyTypes.length > 0) {
                enemyType = validEnemyTypes[Math.floor(Math.random() * validEnemyTypes.length)];
              }
            }
            
            if (enemyType) {
              const newEnemy = createPlatformEnemy(enemyType as EnemyType, enemyLevel);
              newEnemies.push(newEnemy);
            }
          }
          
          // Add notification about the attack
          if (newEnemies.length > platform.combat.enemies.length) {
            const enemyCount = newEnemies.length - platform.combat.enemies.length;
            const message = hasBoss 
              ? `⚠️ БОСС атакует платформу "${platform.name}"! Защищайтесь!`
              : `Обнаружено ${enemyCount} врагов у платформы "${platform.name}"`;
            
            nextCurrency = { ...nextCurrency }; // Will be updated below with notifications
            // Store notification to add later
            newNotifications.push({
              type: hasBoss ? 'warning' : 'attack',
              title: hasBoss ? '☠️ Босс атакует!' : '⚔️ Атака на платформу',
              message,
              platformId: platform.id,
            });
          }
          
          updatedPlatform = {
            ...updatedPlatform,
            combat: {
              ...updatedPlatform.combat,
              enemies: newEnemies,
              underAttack: true,
              // Та же политика «реже нападают» действует и на орбитальные платформы.
              nextWaveAt: now + 120000 * specials.waveInterval, // Next wave in 2 minutes
              shieldRegenPerSecond: updatedPlatform.combat.shieldRegenPerSecond || D(5),
              damagePerSecond: updatedPlatform.combat.damagePerSecond || D(0),
            },
          };
        }
        
        // Process combat if there are enemies
        if (updatedPlatform.combat.enemies.length > 0) {
          // Calculate platform defense
          const turretDamage = updatedPlatform.combat.turretCount * 10; // 10 DPS per turret
          const assignedShips = state.fleet.ships.filter(s => s.assignedTo === platform.id && s.status !== 'repairing');
          const shipDamage = assignedShips.reduce((total, ship) => {
            return total + ship.dps.toNumber();
          }, 0);
          
          const totalDefenseDPS = turretDamage + shipDamage;
          const damageDealt = D(totalDefenseDPS).mul(dt);
          
          // Calculate enemy damage to platform
          let totalEnemyDamage = D(0);
          const updatedEnemies = updatedPlatform.combat.enemies.map(enemy => {
            if (enemy.hp.lte(0)) return enemy;
            
            const enemyDPS = enemy.dps || D(10);
            totalEnemyDamage = totalEnemyDamage.add(enemyDPS.mul(dt));
            
            // Apply damage to enemy
            const enemyDamageTaken = damageDealt.div(updatedPlatform.combat.enemies.length); // Distribute damage
            return {
              ...enemy,
              hp: enemy.hp.sub(enemyDamageTaken).max(0),
            };
          });
          
          // Filter out dead enemies and grant loot
          const deadEnemies = updatedEnemies.filter(e => e.hp.lte(0));
          const aliveEnemies = updatedEnemies.filter(e => e.hp.gt(0));
          // Бой на платформе — такой же бой игрока: квест «уничтожьте врага» не должен
          // требовать, чтобы враг дошёл именно до базы.
          enemyKillsThisTick += deadEnemies.length;

          // Grant loot from dead enemies (will be added to currency below)
          deadEnemies.forEach(enemy => {
            if (enemy.loot) {
              nextCurrency = {
                ...nextCurrency,
                credits: nextCurrency.credits.add(enemy.loot.credits || D(0)),
              };
              
              if (enemy.loot.resources) {
                Object.entries(enemy.loot.resources).forEach(([resource, amount]) => {
                  const resType = resource as ResourceType;
                  if (newResources[resType]) {
                    newResources[resType] = {
                      ...newResources[resType],
                      amount: newResources[resType].amount.add(amount as any),
                    };
                  }
                });
              }
            }
          });
          
          // Apply damage to platform
          let newShieldHp = updatedPlatform.shieldHp;
          let newArmor = updatedPlatform.armor;
          let newHp = updatedPlatform.hp;
          
          let remainingDamage = totalEnemyDamage;
          
          // First, damage shields
          if (newShieldHp.gt(0)) {
            const effectiveDamage = remainingDamage.mul(1); // No reduction from shields
            if (effectiveDamage.gte(newShieldHp)) {
              remainingDamage = effectiveDamage.sub(newShieldHp);
              newShieldHp = D(0);
            } else {
              newShieldHp = newShieldHp.sub(effectiveDamage);
              remainingDamage = D(0);
            }
          }
          
          // Then, damage armor
          if (remainingDamage.gt(0) && newArmor.gt(0)) {
            const armorEffectiveness = 0.5; // Armor absorbs 50% of damage
            const effectiveDamage = remainingDamage.mul(armorEffectiveness);
            if (effectiveDamage.gte(newArmor)) {
              remainingDamage = remainingDamage.sub(newArmor.div(armorEffectiveness));
              newArmor = D(0);
            } else {
              newArmor = newArmor.sub(effectiveDamage);
              remainingDamage = D(0);
            }
          }
          
          // Finally, damage hull
          if (remainingDamage.gt(0)) {
            newHp = newHp.sub(remainingDamage).max(0);
          }
          
          updatedPlatform = {
            ...updatedPlatform,
            hp: newHp,
            armor: newArmor,
            shieldHp: newShieldHp,
            combat: {
              ...updatedPlatform.combat,
              enemies: aliveEnemies,
              underAttack: aliveEnemies.length > 0,
              damagePerSecond: totalEnemyDamage.div(dt > 0 ? dt : 1),
              shieldRegenPerSecond: updatedPlatform.combat.shieldRegenPerSecond || D(5),
            },
          };
          
          // Check if platform is destroyed
          if (newHp.lte(0)) {
            newNotifications.push({
              type: 'warning',
              title: '💥 Платформа уничтожена',
              message: `Платформа "${platform.name}" была уничтожена врагами!`,
              platformId: platform.id,
            });
            
            // Mark for removal
            updatedPlatform = {
              ...updatedPlatform,
              _destroyed: true,
            } as any;
          }
        } else {
          // No enemies, regenerate shields
          const regenRate = D(updatedPlatform.combat.shieldRegenPerSecond || 5);
          const newShieldHp = D(updatedPlatform.shieldHp).add(regenRate.mul(dt)).min(D(updatedPlatform.shieldMaxHp));
          
          updatedPlatform = {
            ...updatedPlatform,
            shieldHp: newShieldHp,
            combat: {
              ...updatedPlatform.combat,
              underAttack: false,
            },
          };
        }
        
        return updatedPlatform;
      });
      
      // Remove destroyed platforms
      const destroyedPlatformIds = updatedPlatforms.filter((p: any) => p._destroyed).map(p => p.id);
      const survivingPlatforms = updatedPlatforms.filter((p: any) => !p._destroyed);

      // Auto-transport resources from platforms to main station
      let nextGalaxies = { 
        ...state.galaxies,
        platforms: [...state.galaxies.platforms], // Create a new array copy for proper updates
        fuelReserve: D(state.galaxies.fuelReserve),
        // Clear active platform if it was destroyed
        activePlatformId: destroyedPlatformIds.includes(state.galaxies.activePlatformId || '') 
          ? undefined 
          : state.galaxies.activePlatformId,
      };
      
      const finalPlatforms = survivingPlatforms.map(platform => {
        let updatedPlatform = { ...platform };
        
        if (state.galaxies.autoTransportEnabled) {
          const transportCostPerPlatform = D(0.1); // 0.1 fuel per platform per second
          const transportCost = transportCostPerPlatform.mul(dt);
          
          if (state.galaxies.fuelReserve.gte(transportCost)) {
            // Transfer resources from platform to main base
            for (const r of Object.keys(newResources) as ResourceType[]) {
              const platformAmount = updatedPlatform.resources[r]?.amount || D(0);
              
              if (platformAmount.gt(0)) {
                // Transfer 10% of platform resources per second (capped by base capacity)
                const transferRate = platformAmount.mul(0.1).mul(dt);
                const baseAmount = getBuf(buffers, baseKey, r);
                const baseCap = newResources[r].max;
                
                // Only transfer if base has space
                if (baseCap.lte(0) || baseAmount.lt(baseCap)) {
                  const spaceAvailable = baseCap.gt(0) ? baseCap.sub(baseAmount).max(D(0)) : transferRate;
                  const actualTransfer = transferRate.min(spaceAvailable).min(platformAmount);
                  
                  if (actualTransfer.gt(0)) {
                    // Remove from platform
                    updatedPlatform.resources[r] = {
                      ...updatedPlatform.resources[r]!,
                      amount: platformAmount.sub(actualTransfer),
                    };
                    
                    // Add to base buffer
                    buffers = setBuf(buffers, baseKey, r, baseAmount.add(actualTransfer));
                  }
                }
              }
            }
            
            // Deduct fuel cost
            nextGalaxies = {
              ...nextGalaxies,
              fuelReserve: nextGalaxies.fuelReserve.sub(transportCost),
            };
          }
        }
        
        return updatedPlatform;
      });
      
      nextGalaxies = {
        ...nextGalaxies,
        platforms: finalPlatforms,
      };

      /*
       * Случайные научные удачи от политик. Оба шанса заданы «в секунду», поэтому
       * умножаются на dt — иначе при 20 Гц срабатывало бы в 20 раз чаще, чем обещано.
       */
      let nextResearchTechnologies: Record<string, boolean> | null = null;

      if (specials.researchBonusChancePerSecond > 0 &&
          Math.random() < specials.researchBonusChancePerSecond * dt) {
        // Разовый куш соразмерен текущему притоку RP, а не фиксированному числу: иначе он
        // либо ломает ранний баланс, либо к середине игры превращается в пыль.
        const lump = baseResearchPointsPerSecond(state.grid.tiles).mul(60).max(D(50));
        nextCurrency = {
          ...nextCurrency,
          researchPoints: nextCurrency.researchPoints.add(lump),
        };
        newNotifications.push({
          type: 'success',
          title: '🔬 Научный прорыв',
          message: `Исследователи наткнулись на неожиданный результат: +${lump.toFixed(0)} очков исследований.`,
        });
      }

      if (specials.freeTechChancePerSecond > 0 &&
          Math.random() < specials.freeTechChancePerSecond * dt) {
        // Кандидаты — только технологии с выполненными пререквизитами. Проверку по стоимости
        // обходим (в этом весь смысл «бесплатной» технологии), поэтому canResearchTechnology
        // зовём с бесконечными очками, а не дублируем его правила здесь.
        const candidates: string[] = [];
        for (const techId of Object.keys(TECHNOLOGIES)) {
          if (canResearchTechnology(techId as any, state.research.technologies, Number.POSITIVE_INFINITY)) {
            candidates.push(techId);
          }
        }
        if (candidates.length > 0) {
          const granted = candidates[Math.floor(Math.random() * candidates.length)];
          // Гранта в сторе нет: researchTechnology всегда списывает стоимость, поэтому
          // открываем технологию здесь, не трогая researchPoints.
          nextResearchTechnologies = { ...state.research.technologies, [granted]: true };
          newNotifications.push({
            type: 'success',
            title: '💡 Прорыв в лаборатории',
            message: `Технология «${TECHNOLOGIES[granted as keyof typeof TECHNOLOGIES]?.name ?? granted}» открыта бесплатно.`,
          });
        }
      }

      // Фаза 8.1: Pollution system
      let nextPollution = { 
        ...state.pollution,
        wasteAmount: D(state.pollution.wasteAmount),
        radioactiveWasteAmount: D(state.pollution.radioactiveWasteAmount),
      };
      
      // Generate waste from production buildings
      let wasteGenerated = D(0);
      let radioactiveWasteGenerated = D(0);
      
      /*
       * Раньше здесь по id проверялась политика `eco_friendly` — единственный спецэффект,
       * который вообще что-то делал, и делал это захардкоженной строкой внутри цикла по зданиям.
       * Теперь смотрим на объявленный флаг: политика, которая его объявляет, всё та же, но
       * gameStore больше не знает её имени, а проверка снята из тела цикла.
       */
      const autoRecycleWaste = policyEffects.specialEffects.has('auto_recycle_waste');

      buildingsWithProximity.forEach((b) => {
        if (b.count <= 0) return;

        const placedCount = Object.values(state.grid.tiles).filter((id) => id === b.id).length;
        if (placedCount === 0) return;

        // Different buildings generate different amounts of waste
        let wastePerBuilding = D(0);
        let radioactiveWastePerBuilding = D(0);

        // Production buildings generate waste (0.01 waste per production cycle)
        if (b.production && !b.id.includes('generator') && !b.id.includes('solar')) {
          const productionTotal = Object.values(b.production).reduce((sum, amount) => sum.add(amount), D(0));
          wastePerBuilding = productionTotal.mul(0.01).mul(dtFacilities);
        }
        
        // Nuclear buildings generate radioactive waste
        if (b.id.includes('nuclear') || b.id.includes('enriched_uranium')) {
          radioactiveWastePerBuilding = D(0.05).mul(dtFacilities).mul(placedCount);
        }
        
        // Автопереработка отходов: -50% к образованию мусора и радиоактивных отходов
        if (autoRecycleWaste) {
          wastePerBuilding = wastePerBuilding.mul(0.5);
          radioactiveWastePerBuilding = radioactiveWastePerBuilding.mul(0.5);
        }
        
        wasteGenerated = wasteGenerated.add(wastePerBuilding.mul(placedCount));
        radioactiveWasteGenerated = radioactiveWasteGenerated.add(radioactiveWastePerBuilding);
      });
      
      // Add generated waste to totals
      nextPollution.wasteAmount = nextPollution.wasteAmount.add(wasteGenerated);
      nextPollution.radioactiveWasteAmount = nextPollution.radioactiveWasteAmount.add(radioactiveWasteGenerated);
      
      // Waste Recycler buildings reduce waste
      // NOTE: Building id is `recycler_mk1` (not `waste_recycler`).
      const recyclerBuilding = buildingsWithProximity.find((b) => b.id === 'recycler_mk1');
      if (recyclerBuilding && recyclerBuilding.count > 0) {
        const baseRecyclerPower = D(2).mul(dtFacilities); // 2 waste per second per recycler

        // Find all placed recyclers and create pollution zones
        const pollutionZones: Array<{ x: number; y: number; radius: number; intensity: number }> = [];
        for (const [tileKey, buildingId] of Object.entries(state.grid.tiles)) {
          if (buildingId === 'recycler_mk1') {
            const pos = parseKey(tileKey);
            if (pos) {
              pollutionZones.push({
                x: pos.x,
                y: pos.y,
                radius: 3,
                intensity: 0.8, // 80% waste reduction in radius
              });

              const evolutionLevel = state.grid.tileEvolutionLevels?.[tileKey] || 0;
              const evolutionMult = evolutionLevel > 0 ? getEvolutionMultiplier(buildingId, evolutionLevel) : 1;
              const recyclerPower = baseRecyclerPower.mul(evolutionMult);

              // Recycle waste in the area
              nextPollution.wasteAmount = nextPollution.wasteAmount.sub(recyclerPower).max(D(0));
            }
          }
        }

        nextPollution.pollutionZones = pollutionZones;
      }
      
      // Calculate efficiency penalty from pollution
      // -5% efficiency per 1000 waste
      const wastePenalty = nextPollution.wasteAmount.div(1000).mul(0.05).toNumber();
      const radioactivePenalty = nextPollution.radioactiveWasteAmount.div(500).mul(0.1).toNumber();
      nextPollution.efficiencyMultiplier = Math.max(0.1, 1.0 - wastePenalty - radioactivePenalty);

      // Process intergalactic caravans
      const nextIntergalacticLogistics = { ...state.intergalacticLogistics };
      const updatedCaravans = [...nextIntergalacticLogistics.caravans];
      const caravansToRemove: string[] = [];
      
      for (let i = 0; i < updatedCaravans.length; i++) {
        const caravan = { ...updatedCaravans[i] };
        
        if (caravan.status === 'traveling') {
          // Update progress
          const elapsed = now - caravan.departureTime;
          const totalTime = caravan.arrivalTime - caravan.departureTime;
          caravan.progress = Math.min(1, elapsed / totalTime);
          
          // Check for random attacks
          if (Math.random() < caravan.riskLevel * dt * 0.1) { // 10% chance per second scaled by risk
            caravan.status = 'under_attack';
            caravan.underAttackBy = [
              createPlatformEnemy('pirate_raider', Math.floor(Math.random() * 10) + 5), // Random pirate level 5-15
            ];
            
            // Add notification
            newNotifications.push({
              type: 'attack',
              title: '🚨 Караван атакован!',
              message: `Караван ${caravan.id.slice(0, 8)} подвергся нападению пиратов!`,
            });
          }
          
          // Check if arrived
          if (now >= caravan.arrivalTime) {
            caravan.status = 'delivered';
            
            // Deliver cargo to destination
            if (caravan.toId === 'main_base') {
              // Add to main base resources
              Object.entries(caravan.cargo).forEach(([resType, amount]) => {
                if (amount) {
                  const resource = newResources[resType as import('../core/gameTypes').ResourceType];
                  if (resource) {
                    resource.amount = resource.amount.add(amount);
                  }
                }
              });
            } else {
              // Add to platform resources
              const platformIndex = nextGalaxies.platforms.findIndex(p => p.id === caravan.toId);
              if (platformIndex >= 0) {
                const platform = { ...nextGalaxies.platforms[platformIndex] };
                const updatedResources = { ...platform.resources };
                
                Object.entries(caravan.cargo).forEach(([resType, amount]) => {
                  if (amount) {
                    const resource = updatedResources[resType as import('../core/gameTypes').ResourceType];
                    if (resource) {
                      updatedResources[resType as import('../core/gameTypes').ResourceType] = {
                        ...resource,
                        amount: resource.amount.add(amount),
                      };
                    }
                  }
                });
                
                platform.resources = updatedResources;
                nextGalaxies.platforms[platformIndex] = platform;
              }
            }
            
            // Add success notification
            newNotifications.push({
              type: 'success',
              title: '✅ Караван доставлен',
              message: `Караван ${caravan.id.slice(0, 8)} успешно прибыл в пункт назначения!`,
            });
            
            // Mark for removal
            caravansToRemove.push(caravan.id);
          }
        } else if (caravan.status === 'under_attack' && caravan.underAttackBy) {
          // Process combat
          const totalEnemyDps = caravan.underAttackBy.reduce((sum, enemy) => sum.add(enemy.dps), D(0));
          const damage = totalEnemyDps.mul(dt);
          
          // Caravan takes damage (reduce defense)
          caravan.defense = caravan.defense.sub(damage).max(D(0));
          
          // If defense reaches zero, caravan is destroyed
          if (caravan.defense.lte(0)) {
            caravan.status = 'destroyed';
            
            // Add failure notification
            newNotifications.push({
              type: 'warning',
              title: '💥 Караван уничтожен!',
              message: `Караван ${caravan.id.slice(0, 8)} был уничтожен пиратами. Груз потерян.`,
            });
            
            // Mark for removal
            caravansToRemove.push(caravan.id);
          } else {
            // Caravan fights back
            const caravanDps = caravan.defense.mul(0.5); // 50% of defense rating as DPS
            caravan.underAttackBy = caravan.underAttackBy.filter(enemy => {
              const enemyDamage = caravanDps.mul(dt);
              enemy.hp = enemy.hp.sub(enemyDamage);
              return enemy.hp.gt(0);
            });
            
            // If all enemies defeated, continue traveling
            if (caravan.underAttackBy.length === 0) {
              caravan.status = 'traveling';
              delete caravan.underAttackBy;
              
              // Add notification
              newNotifications.push({
                type: 'success',
                title: '⚔️ Атака отбита',
                message: `Караван ${caravan.id.slice(0, 8)} успешно отбил атаку и продолжает путь!`,
              });
            }
          }
        }
        
        updatedCaravans[i] = caravan;
      }
      
      // Remove completed/destroyed caravans
      nextIntergalacticLogistics.caravans = updatedCaravans.filter(c => !caravansToRemove.includes(c.id));

      // =======================================
      // Фаза 8.6: Обработка случайных событий
      // =======================================
      
      let nextRandomEvents = { ...state.randomEvents };
      
      // Проверяем, пора ли генерировать новое событие
      if (nextRandomEvents.eventsEnabled && now >= nextRandomEvents.nextEventAt) {
        // Создаем временное состояние для проверки условий
        const tempState: GameState = {
          ...state,
          resources: newResources,
          grid: { ...state.grid, buffers },
          currency: nextCurrency,
          galaxies: nextGalaxies,
        };
        
        const newEvent = generateRandomEvent(tempState);
        
        // Вычисляем следующее время события
        const baseInterval = BASE_EVENT_INTERVAL_MIN + Math.random() * (BASE_EVENT_INTERVAL_MAX - BASE_EVENT_INTERVAL_MIN);
        /*
         * eventFrequencyMultiplier — ДЕЛИТЕЛЬ интервала (больше множитель — чаще события),
         * и specials.eventFrequency задан в тех же терминах частоты: 0.5 = «вдвое реже».
         * Поэтому его домножаем к делителю, а не к интервалу, иначе знак эффекта перевернётся.
         */
        const frequencyMult = nextRandomEvents.eventFrequencyMultiplier * specials.eventFrequency;
        const adjustedInterval = frequencyMult > 0
          ? baseInterval / frequencyMult
          : baseInterval;
        
        if (newEvent) {
          // Автоматически применяем эффекты события при его генерации
          const stateWithEffects = applyEventEffects(tempState, newEvent);
          
          // Копируем обновленные ресурсы и валюту
          newResources = { ...stateWithEffects.resources };
          buffers = stateWithEffects.grid.buffers;
          nextCurrency = { ...stateWithEffects.currency };
          
          nextRandomEvents = {
            ...nextRandomEvents,
            eventHistory: [
              {
                type: newEvent.type,
                timestamp: Date.now(),
                title: newEvent.title,
              },
              ...nextRandomEvents.eventHistory,
            ].slice(0, 20),
            nextEventAt: now + adjustedInterval,
          };
          
          // Добавляем уведомление о событии
          newNotifications.push({
            type: newEvent.type === 'pirate_raid' || newEvent.type === 'power_outage' || 
                  newEvent.type === 'solar_flare' || newEvent.type === 'chain_reaction' 
                  ? 'warning' : 'info',
            title: newEvent.title,
            message: newEvent.description,
          });
        } else {
          // Событие пропущено (не подходит условие), просто обновляем время
          nextRandomEvents = {
            ...nextRandomEvents,
            nextEventAt: now + adjustedInterval,
          };
        }
      }
      
      // Обрабатываем активные события с временными эффектами
      const updatedActiveEvents = nextRandomEvents.activeEvents.map(event => {
        if (event.expiresAt && now >= event.expiresAt) {
          return { ...event, status: 'expired' as const };
        }
        return event;
      }).filter(event => event.status !== 'expired');
      
      nextRandomEvents = {
        ...nextRandomEvents,
        activeEvents: updatedActiveEvents,
      };

      // =======================================
      // Фаза 9: Обработка строительства мегаструктур
      // =======================================
      
      let nextMegastructures = { ...state.megastructures };
      
      // Обработка строительства мегаструктур в очереди
      const updatedQueue = nextMegastructures.constructionQueue.map(construction => {
        const megastructure = MEGASTRUCTURES[construction.megastructureId];
        if (!megastructure) return construction;
        
        // Увеличение прогресса строительства (100% за buildTime секунд)
        const progressPerSecond = 100 / megastructure.buildTime;
        const newProgress = Math.min(100, construction.progress + progressPerSecond * dt);
        
        return {
          ...construction,
          progress: newProgress,
        };
      });
      
      // Проверяем завершенные постройки
      const completedMegastructures = updatedQueue.filter(c => c.progress >= 100);
      const remainingQueue = updatedQueue.filter(c => c.progress < 100);
      
      // Перемещаем завершенные мегаструктуры в список построенных
      let newBuiltMegastructures = { ...nextMegastructures.built };
      
      completedMegastructures.forEach(construction => {
        const megastructure = MEGASTRUCTURES[construction.megastructureId];
        if (megastructure) {
          newBuiltMegastructures[construction.megastructureId] = {
            completedAt: now,
            buildProgress: 100,
            active: true,
          };
          
          // Награды за постройку
          const rewards = getMegastructureRewards(construction.megastructureId);
          nextCurrency = {
            ...nextCurrency,
            credits: nextCurrency.credits.add(rewards.credits),
            researchPoints: nextCurrency.researchPoints.add(rewards.researchPoints),
            influence: nextCurrency.influence.add(rewards.influence),
          };
          
          // Уведомление о завершении
          newNotifications.push({
            type: 'success',
            title: `🎉 Мегаструктура построена!`,
            message: `${megastructure.name} завершена и активна!`,
          });
        }
      });
      
      nextMegastructures = {
        ...nextMegastructures,
        built: newBuiltMegastructures,
        constructionQueue: remainingQueue,
      };

      const debugLastFlow = traceFlows
        ? (() => {
            const basePos = getBasePos(state.grid);
            const fromBaseByRes: Record<string, Decimal> = {};
            const totalByRes: Record<string, Decimal> = {};
            const toByTile: Record<string, Decimal> = {};

            for (const t of activeTransports) {
              const r = t.resource;
              totalByRes[r] = (totalByRes[r] ?? D(0)).add(t.amount);

              const toKey = `${t.to.x},${t.to.y}`;
              toByTile[toKey] = (toByTile[toKey] ?? D(0)).add(t.amount);

              if (basePos && t.from.x === basePos.x && t.from.y === basePos.y) {
                fromBaseByRes[r] = (fromBaseByRes[r] ?? D(0)).add(t.amount);
              }
            }

            const drainsSum = energyDrainDemonsTick
              .add(energyDrainMarketImportTick)
              .add(energyDrainBuildingsLegacyTick)
              .add(energyDrainBuildingsConsumptionTick)
              .add(energyDrainCombatShieldTick)
              .add(energyDrainCombatTurretsTick);
            const otherDrain = energyConsumedTick.sub(drainsSum);

            const topLegacy = Object.entries(energyLegacyByBuilding)
              .sort((a, b) => Number(b[1].toString()) - Number(a[1].toString()))
              .slice(0, 10)
              .map(([id, amt]) => ({ buildingId: id, energy: amt.toString() }));

            const topConsumption = Object.entries(energyConsumptionByBuilding)
              .sort((a, b) => Number(b[1].toString()) - Number(a[1].toString()))
              .slice(0, 10)
              .map(([id, amt]) => ({ buildingId: id, energy: amt.toString() }));


            const topTo = Object.entries(toByTile)
              .sort((a, b) => {
                const av = Number(a[1].toString());
                const bv = Number(b[1].toString());
                return bv - av;
              })
              .slice(0, 8)
              .map(([tile, amt]) => ({ tile, amount: amt.toString() }));

            return {
              at: now,
              dtSeconds: dt,
              energy: {
                start: baseBefore.energy.toString(),
                end: getBuf(buffers, baseKey, 'energy').toString(),
                producedTick: energyProducedTick.toString(),
                consumedTick: energyConsumedTick.toString(),
                clampRemovedTick: energyClampRemoved ? energyClampRemoved.toString() : null,
                drains: {
                  demons: energyDrainDemonsTick.toString(),
                  marketImport: energyDrainMarketImportTick.toString(),
                  buildingsLegacy: energyDrainBuildingsLegacyTick.toString(),
                  buildingsConsumption: energyDrainBuildingsConsumptionTick.toString(),
                  combatShield: energyDrainCombatShieldTick.toString(),
                  combatTurrets: energyDrainCombatTurretsTick.toString(),
                  other: otherDrain.toString(),
                },
                topBuildings: {
                  legacy: topLegacy,
                  consumptionEnergy: topConsumption,
                },
                waveActive: state.combat.waveEndsAt > now,
                enemies: state.combat.enemies.length,
                demonsActive: Object.fromEntries(Object.entries(state.demons.active).filter(([, v]) => !!v)),
              },
              sim: {
                speedMult: String(speedMult),
                boostMult: String(boostMult),
                interferenceMult: String(interferenceMult),
                dtFacilities: String(dtFacilities),
                coldFusionMult: String(coldFusionMult),
              },
              transports: {
                count: activeTransports.length,
                totalByResource: Object.fromEntries(Object.entries(totalByRes).map(([k, v]) => [k, v.toString()])),
                fromBaseByResource: Object.fromEntries(
                  Object.entries(fromBaseByRes).map(([k, v]) => [k, v.toString()])
                ),
                topDestinations: topTo,
              },
            };
          })()
        : null;
      
      // Применяем эффекты активных мегаструктур
      Object.entries(nextMegastructures.built).forEach(([id, info]) => {
        if (!info.active) return;
        
        const megastructure = MEGASTRUCTURES[id as MegastructureId];
        if (!megastructure) return;
        
        // Энергия
        if (megastructure.effects.energyProduction) {
          totalEnergyProduction = totalEnergyProduction.add(megastructure.effects.energyProduction);
        }
        
        // Влияние
        if (megastructure.effects.influenceBonus) {
          nextCurrency = {
            ...nextCurrency,
            influence: nextCurrency.influence.add(D(megastructure.effects.influenceBonus).mul(dt)),
          };
        }
        
        // Бонус к производству применяется через multiplier (будет учтен в game loop)
        // Бонус к исследованиям применяется к начислению RP
      });

      // ========================================================================
      // CULTURE & SCIENCE SYSTEM (Phase 7)
      // ========================================================================
      let nextCulture = { ...state.culture };
      
      // Calculate culture production from culture buildings
      let cultureProducedTick = D_ZERO;
      let scienceProducedTick = D_ZERO;
      
      // Count culture buildings and calculate production
      const cultureBuildingCounts: Record<string, number> = {};
      for (const building of buildingsWithProximity) {
        if (isCultureBuilding(building.id)) {
          cultureBuildingCounts[building.id] = (cultureBuildingCounts[building.id] || 0) + building.count;
          
          const cultureDef = CULTURE_BUILDINGS[building.id as keyof typeof CULTURE_BUILDINGS];
          if (cultureDef) {
            // Apply happiness productivity multiplier and other bonuses
            const happinessMult = nextCulture.happiness.productivityMultiplier;
            
            cultureProducedTick = cultureProducedTick.add(
              cultureDef.culturePerSecond.mul(building.count).mul(dt).mul(happinessMult)
            );
            scienceProducedTick = scienceProducedTick.add(
              cultureDef.sciencePerSecond.mul(building.count).mul(dt).mul(happinessMult)
            );
          }
        }
      }
      
      // Update culture and science
      nextCulture.culture = nextCulture.culture.add(cultureProducedTick);
      nextCulture.science = nextCulture.science.add(scienceProducedTick);
      nextCulture.totalCultureProduced = nextCulture.totalCultureProduced.add(cultureProducedTick);
      nextCulture.totalScienceProduced = nextCulture.totalScienceProduced.add(scienceProducedTick);
      
      // Update production rates for display
      nextCulture.culturePerSecond = dt > 0 ? cultureProducedTick.div(dt) : D_ZERO;
      nextCulture.sciencePerSecond = dt > 0 ? scienceProducedTick.div(dt) : D_ZERO;
      
      // Check for culture level up
      const cultureLevelData = getCultureLevel(nextCulture.culture);
      if (cultureLevelData.level > nextCulture.currentLevel) {
        nextCulture.currentLevel = cultureLevelData.level;
        // TODO: Add notification for culture level up
      }
      nextCulture.cultureProgress = D(getCultureProgress(nextCulture.culture, nextCulture.currentLevel));
      
      // Calculate aggregated effects from culture buildings
      nextCulture.aggregatedEffects = aggregateCultureEffects(cultureBuildingCounts);
      
      // Calculate happiness
      // Calculate pollution level from waste amounts (0-100 scale)
      const pollutionLevel = nextPollution 
        ? Math.min(100, nextPollution.wasteAmount.add(nextPollution.radioactiveWasteAmount.mul(5)).toNumber() / 1000 * 100)
        : 0;
      
      const happinessInputs = {
        buildings: buildingsWithProximity,
        cultureLevel: nextCulture.currentLevel,
        pollutionLevel: pollutionLevel,
        cleanEnergyRatio: 0.5, // TODO: Calculate from actual energy sources
        credits: nextCurrency.credits,
        creditsPerSecond: D_ZERO, // TODO: Calculate actual credits/sec
        isInDebt: nextCurrency.credits.lt(0),
        isUnderAttack: nextCombat.enemies.length > 0,
        recentDamage: nextCombat.baseHp.lt(nextCombat.baseMaxHp.mul(0.9)),
        enemyCount: nextCombat.enemies.length,
        overclockActive: false, // TODO: Check overclock mode
        economyModeActive: false, // TODO: Check economy mode
        overclockBuildings: 0,
        totalBuildings: buildingsWithProximity.reduce((sum, b) => sum + b.count, 0),
        temporaryFactors: nextCulture.happiness.factors.filter((f: any) => f.temporary),
      };
      
      const calculatedHappiness = calculateHappiness(happinessInputs);
      const previousHappiness = nextCulture.happiness.current;
      const targetHappiness = calculatedHappiness.current;
      const smoothedHappiness = smoothHappinessTransition(previousHappiness, targetHappiness, dt);
      const trend = calculateHappinessTrend(previousHappiness, smoothedHappiness);
      
      nextCulture.happiness = {
        ...calculatedHappiness,
        current: smoothedHappiness,
        trend,
        lastUpdated: now,
      };
      
      // Update unlocked buildings based on culture level
      const unlockedBuildings: string[] = [];
      for (const [id, building] of Object.entries(CULTURE_BUILDINGS)) {
        const requiredLevel = (building as any).requiredCultureLevel || 1;
        if (nextCulture.currentLevel >= requiredLevel) {
          unlockedBuildings.push(id);
        }
      }
      nextCulture.unlockedCultureBuildings = unlockedBuildings;
      // ========================================================================
      // END CULTURE SYSTEM
      // ========================================================================

      /*
       * Слияние уведомлений — ОДИН раз и в самом конце тика, после всех производителей.
       *
       * Раньше слияние стояло в середине: всё, что пушилось после него (уведомления
       * случайных событий), молча терялось каждый тик. Караваны и мегаструктуры обходили
       * проблему иначе и хуже — писали push() прямо в nextGalaxies.notifications, то есть
       * в тиках без ранних уведомлений мутировали массив ПРЕДЫДУЩЕГО состояния (ссылка та
       * же), дописывали в конец списка, который UI считает «от новых к старым», и обходили
       * обрезку до 50, из-за чего список рос без предела.
       *
       * Теперь у уведомлений ровно один вход (newNotifications) и один выход (здесь), и
       * порядок кода внутри тика больше не может ничего потерять.
       */
      /*
       * Квесты типа 'combat'. Обработчика у них не было вовсе — quest_defeat_enemy (500 очков
       * исследований) не мог сдвинуться. Срез quests возвращаем только когда он реально
       * изменился: advanceQuests отдаёт исходную ссылку, если ничего не задето.
       */
      const nextQuests = enemyKillsThisTick > 0
        ? advanceQuests(
            state.quests,
            (quest) => quest.type === 'combat' && (quest.target === 'enemy' || quest.target === 'any'),
            enemyKillsThisTick,
          )
        : state.quests;

      if (newNotifications.length > 0) {
        const addedNotifications = newNotifications.map(notif => ({
          ...notif,
          id: `notif_${now}_${Math.random().toString(36).slice(2, 11)}`,
          timestamp: now,
          read: false,
        } as import('../core/gameTypes').Notification));

        nextGalaxies = {
          ...nextGalaxies,
          notifications: [...addedNotifications, ...nextGalaxies.notifications].slice(0, 50),
        };
      }

      return {
        resources: newResources,
        buildings: buildingsWithProximity,
        currency: nextCurrency,
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
        galaxies: nextGalaxies,
        pollution: nextPollution,
        intergalacticLogistics: nextIntergalacticLogistics,
        randomEvents: nextRandomEvents,
        megastructures: nextMegastructures,
        culture: nextCulture,
        // research возвращаем только когда политика выдала бесплатную технологию: иначе
        // каждый тик подменял бы объект и заставлял перерисовываться всё дерево технологий.
        ...(nextResearchTechnologies
          ? { research: { ...state.research, technologies: nextResearchTechnologies } }
          : {}),
        // Тот же приём для квестов — см. nextQuests выше.
        ...(nextQuests !== state.quests ? { quests: nextQuests } : {}),
        lastTick: now,
        // Use theoretical capacity so UI shows consistent values with analytics
        // (totalEnergyProduction/Consumption already include building levels and evolution)
        energyProduction: totalEnergyProduction,
        energyConsumption: totalEnergyConsumption,
        energyEfficiency,
        ...(traceFlows
          ? {
              debug: {
                ...(debugState ?? {}),
                traceFlows: true,
                lastFlow: debugLastFlow,
              },
            }
          : {}),
      };
    });
  },

  saveGame: async () => {
    const state = get();
    // Serialization lives in ./gameSave.ts. It used to be three byte-identical 155-line
    // object literals (saveGame / saveGameManual / overwriteSave), which is why ten
    // GameState slices — prestige, ascension, artifacts, repeatableResearch,
    // proceduralGalaxies, retention, signalInterception, megastructures, endgame, fleet —
    // were never persisted: adding a feature meant editing four places and nobody did.
    const save = { ...serializeGame(state), finance: serializeFinance() };

    try {
      if (!isAuthenticated()) {
        console.warn('No authenticated user found, skipping save');
        return;
      }
      
      const currentSaveId = await loadCurrentSaveIdFromServer();

      const response = await fetch('/api/saves', {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          saveType: 'auto',
          data: save,
          saveId: currentSaveId,
        }),
      });

      /*
       * The response used to be discarded entirely. That made autosave failure completely
       * invisible: a 413 (payload over the old 1mb express limit), a 401 (expired session),
       * or a 404 (save row deleted from another device) all looked exactly like success, and
       * the player kept playing for hours against a server that had stored nothing.
       */
      if (!response.ok) {
        let detail = `HTTP ${response.status}`;
        try {
          const body = await response.json();
          if (body?.error) detail = String(body.error);
        } catch {
          /* non-JSON error body — the status code is all we have */
        }

        console.error('[save] autosave rejected by server:', detail);

        const message =
          detail === 'PAYLOAD_TOO_LARGE'
            ? 'Сохранение слишком большое — прогресс не записан. Сообщите администратору.'
            : response.status === 401 || detail === 'INVALID_TOKEN'
              ? 'Сессия истекла — прогресс не сохраняется. Войдите заново.'
              : `Не удалось сохранить прогресс (${detail}).`;

        get().addNotification({ type: 'warning', title: 'Ошибка сохранения', message });
        return { ok: false as const, error: detail };
      }

      return { ok: true as const };
    } catch (e) {
      // Network-level failure (offline, server restarting). Worth surfacing too, but quietly:
      // a transient blip should not spam the player on every 30s tick.
      console.warn('[save] autosave failed', e);
      return { ok: false as const, error: String(e) };
    }
  },

  // Создать ручное сохранение с именем
  saveGameManual: async (saveName: string) => {
    const state = get();
    // Serialization lives in ./gameSave.ts. It used to be three byte-identical 155-line
    // object literals (saveGame / saveGameManual / overwriteSave), which is why ten
    // GameState slices — prestige, ascension, artifacts, repeatableResearch,
    // proceduralGalaxies, retention, signalInterception, megastructures, endgame, fleet —
    // were never persisted: adding a feature meant editing four places and nobody did.
    const save = { ...serializeGame(state), finance: serializeFinance() };

    // Логируем что сохраняем
    console.log('💾 Saving game manually:', {
      saveName,
      hasMaps: !!save.maps,
      currentMapId: save.maps?.currentMapId,
      unlockedMaps: save.maps?.unlockedMaps,
    });

    try {
      if (!isAuthenticated()) {
        throw new Error('NO_USER');
      }
      
      const response = await fetch('/api/saves', {
        method: 'PUT',
        headers: { 
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: saveName,
          saveType: 'manual',
          data: save,
        }),
      });

      const result = await response.json();
      console.log('💾 Save result:', result);
      if (!result.ok) {
        throw new Error(result.error);
      }

      // Обновляем текущее активное сохранение
      await saveCurrentSaveIdToServer(result.save.id);
      return { ok: true, save: result.save };
    } catch (e) {
      console.error('Manual save failed', e);
      return { ok: false, error: String(e) };
    }
  },

  // Получить список всех сохранений
  getSavesList: async () => {
    try {
      if (!isAuthenticated()) return { ok: false, error: 'NO_USER' };
      
      const response = await fetch('/api/saves', {
        headers: getAuthHeaders(),
      });

      const result = await response.json();
      return result;
    } catch (e) {
      console.error('Failed to get saves list', e);
      return { ok: false, error: String(e) };
    }
  },

  // Загрузить конкретное сохранение
  loadGameFromSave: async (saveId: number) => {
    console.log('🔄 Загрузка сохранения ID:', saveId);
    try {
      if (!isAuthenticated()) {
        console.error('❌ Пользователь не авторизован');
        return { ok: false, error: 'NO_USER' };
      }
      
      console.log('📡 Запрос к серверу...');
      const response = await fetch(`/api/saves/${saveId}`, {
        headers: getAuthHeaders(),
      });

      console.log('📦 Ответ получен, статус:', response.status);
      const result = await response.json();
      if (!result.ok) {
        console.error('❌ Ошибка от сервера:', result.error);
        return { ok: false, error: result.error };
      }

      console.log('✅ Данные получены, начинаем применение...');
      const save = result.save.data;
      
      // Применяем загруженное состояние (используем ту же логику что в loadGame)
      console.log('🔧 Начинаем set() для применения состояния...');
      set((state) => {
        /*
         * The ten slices below were never written by the old serializers and are
         * therefore also absent from the hand-written rehydration above: prestige
         * (Quantum Points + 18 upgrades), ascension, artifacts, repeatableResearch,
         * proceduralGalaxies, retention (daily rewards), signalInterception,
         * megastructures, endgame and fleet — i.e. the whole "infinite game" layer.
         *
         * They are restored through ./gameSave.ts, which is total: every slice falls
         * back to its INITIAL_* value, so an old save that predates them still loads.
         * The 26 slices above keep their existing, battle-tested code path untouched —
         * this merge is deliberately additive so restoring the lost progression cannot
         * regress what already worked.
         */
        const restored = loadSavePayload(save);
        // Финансы живут в отдельном store; без этого портфель, вклады и кредиты
        // терялись при каждом входе (clearAllUserData стирает finance-storage).
        hydrateFinance((save as { finance?: unknown }).finance);

        console.log('📝 Внутри set(), обрабатываем состояние...');
        const loadedResearch: ResearchState = save.research && save.research.levels
          ? {
              levels: {
                ...INITIAL_RESEARCH.levels,
                ...save.research.levels,
              },
              technologies: save.research.technologies
                ? {
                    ...INITIAL_RESEARCH.technologies,
                    ...save.research.technologies,
                  }
                : INITIAL_RESEARCH.technologies,
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
              brokerExcludeFromAutoSell: save.demons.brokerExcludeFromAutoSell ?? ({} as Record<TradeResourceType, boolean>),
            }
          : state.demons;

        const loadedGalaxies: GalaxiesState = save.galaxies
          ? {
              ...state.galaxies,
              ...save.galaxies,
              platforms: Array.isArray(save.galaxies.platforms)
                ? save.galaxies.platforms.map((p: any) => ({
                    ...p,
                    hp: D(p.hp ?? 100),
                    maxHp: D(p.maxHp ?? 100),
                    shieldHp: D(p.shieldHp ?? 0),
                    maxShieldHp: D(p.maxShieldHp ?? 0),
                    armor: D(p.armor ?? 0),
                    maxArmor: D(p.maxArmor ?? 0),
                    resources: p.resources
                      ? Object.fromEntries(
                          Object.entries(p.resources).map(([k, v]: [string, any]) => [
                            k,
                            { amount: D(v?.amount ?? 0), max: D(v?.max ?? 0) }
                          ])
                        )
                      : {},
                    combat: p.combat
                      ? {
                          ...p.combat,
                          enemies: Array.isArray(p.combat.enemies)
                            ? p.combat.enemies.map((e: any) => ({
                                ...e,
                                hp: D(e.hp ?? 0),
                                maxHp: D(e.maxHp ?? 0),
                                dps: D(e.dps ?? 0),
                                armor: D(e.armor ?? 0),
                                loot: e.loot
                                  ? {
                                      ...e.loot,
                                      credits: D(e.loot.credits ?? 0),
                                      resources: e.loot.resources
                                        ? Object.fromEntries(
                                            Object.entries(e.loot.resources).map(([k, v]) => [k, D(v as any)])
                                          )
                                        : undefined,
                                    }
                                  : undefined,
                              }))
                            : [],
                        }
                      : p.combat,
                  }))
                : state.galaxies.platforms,
            }
          : state.galaxies;

        const loadedMeta: MetaState = save.meta
          ? { 
              qubits: D(save.meta.qubits ?? '0'),
              blueprints: D(save.meta.blueprints ?? '0'),
              lifetimeEnergyProduced: D(save.meta.lifetimeEnergyProduced ?? '0'),
            }
          : state.meta;

        const loadedMarket: MarketState = save.market
          ? {
              ...state.market,
              prices: save.market.prices 
                ? Object.fromEntries(
                    Object.entries(save.market.prices).map(([k, v]) => [k, D(v as any)])
                  ) as Record<TradeResourceType, Decimal>
                : state.market.prices,
              event: save.market.event ?? state.market.event,
              nextUpdateAt: save.market.nextUpdateAt ?? state.market.nextUpdateAt,
              history: save.market.history ?? state.market.history,
            }
          : state.market;

        const loadedShip: ShipState = save.ship
          ? { ...state.ship, ...save.ship }
          : state.ship;

        const loadedCombat: CombatState = save.combat && typeof save.combat === 'object'
          ? {
              baseMaxHp: D(save.combat.baseMaxHp ?? state.combat.baseMaxHp),
              baseHp: D(save.combat.baseHp ?? state.combat.baseHp),
              shieldMaxHp: D(save.combat.shieldMaxHp ?? state.combat.shieldMaxHp),
              shieldHp: D(save.combat.shieldHp ?? state.combat.shieldHp),
              enemies: Array.isArray(save.combat.enemies) 
                ? save.combat.enemies.map((e: any) => ({
                    ...e,
                    hp: D(e.hp ?? 0),
                    maxHp: D(e.maxHp ?? 0),
                  }))
                : state.combat.enemies,
              nextWaveAt: typeof save.combat.nextWaveAt === 'number' ? save.combat.nextWaveAt : state.combat.nextWaveAt,
              waveEndsAt: typeof save.combat.waveEndsAt === 'number' ? save.combat.waveEndsAt : state.combat.waveEndsAt,
              nextSpawnAt: typeof save.combat.nextSpawnAt === 'number' ? save.combat.nextSpawnAt : state.combat.nextSpawnAt,
              lastDamageAt: typeof save.combat.lastDamageAt === 'number' ? save.combat.lastDamageAt : 0,
              baseRegenPerSecond: D(save.combat.baseRegenPerSecond ?? 0),
              defenseEnergyNeedPerSecond: D(save.combat.defenseEnergyNeedPerSecond ?? 0),
              defenseEnergyUsedPerSecond: D(save.combat.defenseEnergyUsedPerSecond ?? 0),
              defenseFireRatio: D(save.combat.defenseFireRatio ?? 0),
              baseDamageTakenPerSecond: D(save.combat.baseDamageTakenPerSecond ?? 0),
              shieldEnergyNeedPerSecond: D(save.combat.shieldEnergyNeedPerSecond ?? 0),
              shieldEnergyUsedPerSecond: D(save.combat.shieldEnergyUsedPerSecond ?? 0),
              shieldRegenPerSecond: D(save.combat.shieldRegenPerSecond ?? 0),
              shieldAbsorbedPerSecond: D(save.combat.shieldAbsorbedPerSecond ?? 0),
              enemyPressurePerSecond: D(save.combat.enemyPressurePerSecond ?? 0),
              enemyPressurePotentialPerSecond: D(save.combat.enemyPressurePotentialPerSecond ?? 0),
            }
          : state.combat;

        const loadedAegis: AegisState = save.aegis && typeof save.aegis === 'object'
          ? {
              levels: {
                smart_targeting: typeof save.aegis.levels?.smart_targeting === 'number'
                  ? Math.max(0, save.aegis.levels.smart_targeting)
                  : state.aegis.levels.smart_targeting,
                encryption: typeof save.aegis.levels?.encryption === 'number'
                  ? Math.max(0, save.aegis.levels.encryption)
                  : state.aegis.levels.encryption,
                shield_boost: typeof save.aegis.levels?.shield_boost === 'number'
                  ? Math.max(0, save.aegis.levels.shield_boost)
                  : state.aegis.levels.shield_boost,
                turret_overdrive: typeof save.aegis.levels?.turret_overdrive === 'number'
                  ? Math.max(0, save.aegis.levels.turret_overdrive)
                  : state.aegis.levels.turret_overdrive,
                auto_repair: typeof save.aegis.levels?.auto_repair === 'number'
                  ? Math.max(0, save.aegis.levels.auto_repair)
                  : state.aegis.levels.auto_repair,
              },
            }
          : state.aegis;

        const loadedStarChart: StarChartState = save.starChart && typeof save.starChart === 'object'
          ? {
              levels: {
                subspace: typeof save.starChart.levels?.subspace === 'number'
                  ? Math.max(0, save.starChart.levels.subspace)
                  : state.starChart.levels.subspace,
                anomaly: typeof save.starChart.levels?.anomaly === 'number'
                  ? Math.max(0, save.starChart.levels.anomaly)
                  : state.starChart.levels.anomaly,
              },
            }
          : state.starChart;

        const loadedPolitics: PoliticsState = save.politics && typeof save.politics === 'object'
          ? { ...state.politics, ...save.politics }
          : state.politics;

        const loadedQuantumNet: QuantumNetState = save.quantumNet
          ? { ...state.quantumNet, ...save.quantumNet }
          : state.quantumNet;

        const loadedExpedition: ExpeditionState = save.expedition
          ? { ...state.expedition, ...save.expedition }
          : state.expedition;

        const loadedRandomEvents: RandomEventsState = save.randomEvents
          ? { ...state.randomEvents, ...save.randomEvents }
          : state.randomEvents;

        const loadedProductionMatrix: ProductionMatrixState = save.productionMatrix
          ? { ...state.productionMatrix, ...save.productionMatrix }
          : state.productionMatrix;

        const loadedIntergalacticLogistics: IntergalacticLogisticsState = save.intergalacticLogistics
          ? { ...state.intergalacticLogistics, ...save.intergalacticLogistics }
          : state.intergalacticLogistics;

        let newResources = state.resources;
        if (save.resources) {
          for (const key of Object.keys(save.resources) as ResourceType[]) {
            const val = save.resources[key];
            if (val && typeof val === 'object' && 'amount' in val && 'max' in val) {
              newResources[key].amount = D(val.amount);
              newResources[key].max = D(val.max);
            }
          }
        }

        let newBuildings = state.buildings.map((b) => ({ ...b }));
        if (save.buildings && Array.isArray(save.buildings)) {
          newBuildings = save.buildings.map((sb: any) => {
            const existing = state.buildings.find((b2) => b2.id === sb.id);
            if (!existing) return sb;
            return { ...existing, count: sb.count ?? 0 };
          });
        }

        let newCurrency = { ...state.currency };
        if (save.currency) {
          newCurrency.credits = D(save.currency.credits ?? '0');
          newCurrency.influence = D(save.currency.influence ?? '0');
          newCurrency.researchPoints = D(save.currency.researchPoints ?? '0');
        }

        const grid = save.grid
          ? {
              ...state.grid,
              tiles: save.grid.tiles ?? {},
              tileLevels: save.grid.tileLevels ?? {},
              tileEvolutionLevels: save.grid.tileEvolutionLevels ?? {},
              tileDisabled: save.grid.tileDisabled ?? {},
              buffers: save.grid.buffers ?? state.grid.buffers,
              deposits: save.grid.deposits ?? state.grid.deposits,
              width: save.grid.width ?? state.grid.width,
              height: save.grid.height ?? state.grid.height,
              selected: save.grid.selected ?? null,
              selectedBuildId: save.grid.selectedBuildId ?? null,
              activeTransports: save.grid.activeTransports ?? [],
              focusedLink: save.grid.focusedLink ?? null,
              marketPolicy: save.grid.marketPolicy ?? {},
              lastDtSeconds: save.grid.lastDtSeconds ?? 0,
              cameraX: typeof save.grid.cameraX === 'number' ? save.grid.cameraX : state.grid.cameraX,
              cameraY: typeof save.grid.cameraY === 'number' ? save.grid.cameraY : state.grid.cameraY,
              cameraZoom: typeof save.grid.cameraZoom === 'number' ? save.grid.cameraZoom : state.grid.cameraZoom,
            }
          : state.grid;

        const tileCounts = new Map<string, number>();
        for (const v of Object.values(grid.tiles ?? {})) {
          if (typeof v === 'string') {
            tileCounts.set(v, (tileCounts.get(v) ?? 0) + 1);
          }
        }
        if (tileCounts.size > 0) {
          newBuildings = newBuildings.map((b) => ({ ...b, count: tileCounts.get(b.id) ?? 0 }));
        }

        // МИГРАЦИЯ: Добавляем отсутствующие tileLevels для зданий на карте
        if (grid.tiles && Object.keys(grid.tiles).length > 0) {
          if (!grid.tileLevels) {
            grid.tileLevels = {};
          }
          
          let migratedCount = 0;
          for (const tileKey of Object.keys(grid.tiles)) {
            if (!(tileKey in grid.tileLevels)) {
              grid.tileLevels[tileKey] = 1;
              migratedCount++;
            }
          }
          
          if (migratedCount > 0) {
            console.log('🔧 Миграция: инициализированы уровни для', migratedCount, 'зданий');
          }
          
          if (!grid.tileEvolutionLevels) {
            grid.tileEvolutionLevels = {};
          }
          for (const tileKey of Object.keys(grid.tiles)) {
            if (!(tileKey in grid.tileEvolutionLevels)) {
              grid.tileEvolutionLevels[tileKey] = 0;
            }
          }
        }

        console.log('📊 Загрузка: зданий на карте =', Object.keys(grid.tiles || {}).length, ', tileLevels =', Object.keys(grid.tileLevels || {}).length);

        const capsMult = computeCapsMultiplier(loadedResearch.levels, loadedMeta.qubits);
        newResources = recomputeCaps(newResources, newBuildings, capsMult, grid.tileLevels || {}, grid.tiles);
        let nextBuffers = grid.buffers ?? state.grid.buffers;
        nextBuffers = clampBaseBufferToCaps(nextBuffers, newResources);
        newResources = syncResourcesFromBase(newResources, nextBuffers);

        const deposits: Record<string, DepositType> = grid.deposits && typeof grid.deposits === 'object'
          ? (grid.deposits as Record<string, DepositType>)
          : generateDeposits(grid.width, grid.height);

        const desired = desiredGridSizeForResearch(loadedResearch.levels);
        /*
         * `deposits` обязан попасть в возвращаемый grid. Второй путь загрузки (loadSavePayload
         * ниже) так и делает, а здесь результат generateDeposits просто выбрасывался: сейв без
         * поля deposits — старый или созданный до его появления — грузился с пустой картой
         * месторождений, и добывающие здания было некуда ставить.
         */
        const expandedGrid =
          grid.width < desired.width || grid.height < desired.height
            ? {
                ...grid,
                deposits,
                width: Math.max(grid.width, desired.width),
                height: Math.max(grid.height, desired.height),
              }
            : { ...grid, deposits };

        console.log('✅ Состояние подготовлено, возвращаем новое состояние');
        return {
          ...state,
          research: loadedResearch,
          demons: loadedDemons,
          galaxies: loadedGalaxies,
          meta: loadedMeta,
          market: loadedMarket,
          ship: loadedShip,
          combat: loadedCombat,
          aegis: loadedAegis,
          starChart: loadedStarChart,
          politics: loadedPolitics,
          quantumNet: loadedQuantumNet,
          expedition: loadedExpedition,
          randomEvents: loadedRandomEvents,
          productionMatrix: loadedProductionMatrix,
          intergalacticLogistics: loadedIntergalacticLogistics,
          resources: newResources,
          buildings: newBuildings,
          currency: newCurrency,
          grid: expandedGrid,
          pollution: save.pollution ?? state.pollution,
          nanoSwarm: save.nanoSwarm ?? state.nanoSwarm,
          achievements: save.achievements && typeof save.achievements === 'object'
            ? {
                unlocked: typeof save.achievements.unlocked === 'object' ? save.achievements.unlocked : {},
                recentlyUnlocked: Array.isArray(save.achievements.recentlyUnlocked)
                  ? save.achievements.recentlyUnlocked
                  : [],
              }
            : INITIAL_ACHIEVEMENTS,
          culture: save.culture ? {
            science: D(save.culture.science ?? '0'),
            culture: D(save.culture.culture ?? '0'),
            currentLevel: typeof save.culture.currentLevel === 'number' ? save.culture.currentLevel : 1,
            cultureProgress: D(save.culture.cultureProgress ?? '0'),
            sciencePerSecond: D(0),
            culturePerSecond: D(0),
            totalScienceProduced: D(save.culture.totalScienceProduced ?? '0'),
            totalCultureProduced: D(save.culture.totalCultureProduced ?? '0'),
            happiness: save.culture.happiness ?? INITIAL_CULTURE.happiness,
            unlockedCultureBuildings: Array.isArray(save.culture.unlockedCultureBuildings) ? save.culture.unlockedCultureBuildings : [],
            aggregatedEffects: save.culture.aggregatedEffects ?? INITIAL_CULTURE.aggregatedEffects,
          } : INITIAL_CULTURE,
          maps: save.maps ? {
            currentMapId: save.maps.currentMapId ?? INITIAL_MAPS.currentMapId,
            unlockedMaps: Array.isArray(save.maps.unlockedMaps) ? save.maps.unlockedMaps : INITIAL_MAPS.unlockedMaps,
            mapProgress: save.maps.mapProgress ?? {},
            activeMapData: save.maps.activeMapData ?? null,
            mapSeed: typeof save.maps.mapSeed === 'number' ? save.maps.mapSeed : Date.now(),
            currentEvent: save.maps.currentEvent ?? null,
            eventHistory: Array.isArray(save.maps.eventHistory) ? save.maps.eventHistory : [],
          } : INITIAL_MAPS,
          stats: save.stats ? {
            totalPlayTime: typeof save.stats.totalPlayTime === 'number' ? save.stats.totalPlayTime : 0,
            sessionsCount: (typeof save.stats.sessionsCount === 'number' ? save.stats.sessionsCount : 0) + 1,
            currentSessionStart: Date.now(),
            lifetimeResourcesProduced: save.stats.lifetimeResourcesProduced ?? {},
            lifetimeResourcesSpent: save.stats.lifetimeResourcesSpent ?? {},
            lifetimeCreditsEarned: D(save.stats.lifetimeCreditsEarned ?? '0'),
            lifetimeCreditsSpent: D(save.stats.lifetimeCreditsSpent ?? '0'),
            contractsCompleted: typeof save.stats.contractsCompleted === 'number' ? save.stats.contractsCompleted : 0,
          } : {
            totalPlayTime: 0,
            sessionsCount: 1,
            currentSessionStart: Date.now(),
            lifetimeResourcesProduced: {},
            lifetimeResourcesSpent: {},
            lifetimeCreditsEarned: D(0),
            lifetimeCreditsSpent: D(0),
            contractsCompleted: 0,
          },

          // --- slices recovered via ./gameSave.ts (see note above) ---
          fleet: restored.fleet ?? state.fleet,
          megastructures: restored.megastructures ?? state.megastructures,
          endgame: restored.endgame ?? state.endgame,
          prestige: restored.prestige ?? state.prestige,
          ascension: restored.ascension ?? state.ascension,
          repeatableResearch: restored.repeatableResearch ?? state.repeatableResearch,
          proceduralGalaxies: restored.proceduralGalaxies ?? state.proceduralGalaxies,
          artifacts: restored.artifacts ?? state.artifacts,
          retention: restored.retention ?? state.retention,
          signalInterception: restored.signalInterception ?? state.signalInterception,
        };
      });
      
      console.log('✅ set() успешно выполнен');
      
      // После загрузки синхронизируем размеры grid с текущей картой
      const state = get();
      const currentMapId = state.maps.currentMapId;
      if (currentMapId) {
        const mapDef = getMapDefinition(currentMapId);
        if (mapDef) {
          const { width: mapWidth, height: mapHeight } = mapDef.gridDimensions;
          const currentGrid = state.grid;
          
          // Если размеры grid не соответствуют карте, обновляем их
          if (currentGrid.width !== mapWidth || currentGrid.height !== mapHeight) {
            console.log(`🔧 Синхронизация grid с картой: ${currentGrid.width}x${currentGrid.height} -> ${mapWidth}x${mapHeight}`);
            set((s) => ({
              grid: {
                ...s.grid,
                width: mapWidth,
                height: mapHeight,
              },
            }));
          }
        }
      }
      
      // Сохраняем ID текущего активного сохранения
      console.log('💾 Сохраняем ID активного сохранения...');
      await saveCurrentSaveIdToServer(saveId);

      console.log('🎉 Загрузка полностью завершена!');
      return { ok: true };
    } catch (e) {
      console.error('💥 КРИТИЧЕСКАЯ ОШИБКА при загрузке:', e);
      console.error('Stack trace:', (e as Error).stack);
      return { ok: false, error: String(e) };
    }
  },

  // Удалить сохранение
  deleteSave: async (saveId: number) => {
    try {
      if (!isAuthenticated()) return { ok: false, error: 'NO_USER' };
      
      const response = await fetch(`/api/saves/${saveId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      return await response.json();
    } catch (e) {
      console.error('Failed to delete save', e);
      return { ok: false, error: String(e) };
    }
  },

  // Перезаписать существующее сохранение
  overwriteSave: async (saveId: number, saveName: string) => {
    const state = get();
    // Serialization lives in ./gameSave.ts. It used to be three byte-identical 155-line
    // object literals (saveGame / saveGameManual / overwriteSave), which is why ten
    // GameState slices — prestige, ascension, artifacts, repeatableResearch,
    // proceduralGalaxies, retention, signalInterception, megastructures, endgame, fleet —
    // were never persisted: adding a feature meant editing four places and nobody did.
    const save = { ...serializeGame(state), finance: serializeFinance() };

    // Логируем перезапись сохранения
    console.log('💾 Overwriting save:', {
      saveId,
      saveName,
      hasMaps: !!save.maps,
      currentMapId: save.maps?.currentMapId,
    });

    try {
      if (!isAuthenticated()) {
        throw new Error('NO_USER');
      }
      
      const response = await fetch('/api/saves', {
        method: 'PUT',
        headers: { 
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: saveName,
          saveType: 'manual',
          data: save,
          saveId: saveId, // Передаем ID для перезаписи
        }),
      });

      const result = await response.json();
      if (!result.ok) {
        throw new Error(result.error);
      }

      return { ok: true, save: result.save };
    } catch (e) {
      console.error('Overwrite save failed', e);
      return { ok: false, error: String(e) };
    }
  },

  loadGame: async () => {
    let save: any;
    try {
      if (!isAuthenticated()) {
        console.warn('No user found, skipping load');
        return;
      }
      
      // Пытаемся загрузить последнее ручное сохранение
      const res = await fetch('/api/saves/latest/manual', {
        headers: getAuthHeaders(),
      });
      
      if (!res.ok) {
        // Если нет сохранений для слота - сбрасываем к начальному состоянию
        if (res.status === 404) {
          console.log('No saves for current slot, starting fresh game');
          get().resetGame();
          console.log('✅ resetGame() called, grid size:', get().grid.width, 'x', get().grid.height);
          return;
        }
        return;
      }
      
      const payload = await res.json();
      if (!payload?.ok) {
        // Если нет текущего слота или нет сохранений - сбрасываем
        if (payload?.error === 'NO_CURRENT_SLOT' || payload?.error === 'NO_SAVES_FOR_SLOT') {
          console.log('No current slot or saves, starting fresh game');
          get().resetGame();
        }
        return;
      }
      
      // Сохраняем slotId в localStorage для офлайн-трейдинга
      if (payload.slotId) {
        localStorage.setItem('currentSlotId', payload.slotId.toString());
        window.dispatchEvent(new CustomEvent('slotChanged', { detail: { slotId: payload.slotId } }));
        console.log('[loadGame] SlotId set:', payload.slotId);
      }
      
      save = payload.save.data;
      // Логируем загруженные maps данные для отладки
      console.log('📂 Loaded save info:', {
        saveId: payload.save.id,
        saveName: payload.save.name,
        saveType: payload.save.save_type,
        hasMaps: !!save.maps,
        currentMapId: save.maps?.currentMapId,
        unlockedMaps: save.maps?.unlockedMaps,
      });
      // Сохраняем ID текущего активного сохранения
      await saveCurrentSaveIdToServer(payload.save.id);
    } catch (e) {
      console.warn('Load failed', e);
      return;
    }

    try {
      set((state) => {
        /*
         * The ten slices below were never written by the old serializers and are
         * therefore also absent from the hand-written rehydration above: prestige
         * (Quantum Points + 18 upgrades), ascension, artifacts, repeatableResearch,
         * proceduralGalaxies, retention (daily rewards), signalInterception,
         * megastructures, endgame and fleet — i.e. the whole "infinite game" layer.
         *
         * They are restored through ./gameSave.ts, which is total: every slice falls
         * back to its INITIAL_* value, so an old save that predates them still loads.
         * The 26 slices above keep their existing, battle-tested code path untouched —
         * this merge is deliberately additive so restoring the lost progression cannot
         * regress what already worked.
         */
        const restored = loadSavePayload(save);
        // Финансы живут в отдельном store; без этого портфель, вклады и кредиты
        // терялись при каждом входе (clearAllUserData стирает finance-storage).
        hydrateFinance((save as { finance?: unknown }).finance);

        const loadedResearch: ResearchState = save.research && save.research.levels
          ? {
              levels: {
                ...INITIAL_RESEARCH.levels,
                ...save.research.levels,
              },
              technologies: save.research.technologies
                ? {
                    ...INITIAL_RESEARCH.technologies,
                    ...save.research.technologies,
                  }
                : INITIAL_RESEARCH.technologies,
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
              brokerExcludeFromAutoSell: save.demons.brokerExcludeFromAutoSell ?? ({} as Record<TradeResourceType, boolean>),
            }
          : state.demons;

        const loadedMeta: MetaState = save.meta
          ? {
              qubits: D(save.meta.qubits ?? 0).max(D(0)),
              lifetimeEnergyProduced: D(save.meta.lifetimeEnergyProduced ?? 0).max(D(0)),
              blueprints: D(save.meta.blueprints ?? 0).max(D(0)),
            }
          : state.meta;

        const loadedCurrency: CurrencyState = save.currency
          ? {
              credits: D(save.currency.credits ?? 1000).max(D(0)),
              researchPoints: D(save.currency.researchPoints ?? 0).max(D(0)),
              influence: D(save.currency.influence ?? 0).max(D(0)),
            }
          : state.currency;

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

        const loadedPolitics: import('../core/gameTypes').PoliticsState = save.politics && typeof save.politics === 'object'
          ? {
              activePolicies: Array.isArray(save.politics.activePolicies) ? save.politics.activePolicies : [],
              maxActivePolicies: typeof save.politics.maxActivePolicies === 'number' ? save.politics.maxActivePolicies : 3,
              lastActivated: save.politics.lastActivated && typeof save.politics.lastActivated === 'object' ? save.politics.lastActivated : {},
            }
          : state.politics;

        const loadedGalaxies: import('../core/gameTypes').GalaxiesState = save.galaxies && typeof save.galaxies === 'object'
          ? {
              currentGalaxyId: (save.galaxies.currentGalaxyId as import('../core/gameTypes').GalaxyId) ?? state.galaxies.currentGalaxyId,
              unlockedGalaxies: Array.isArray(save.galaxies.unlockedGalaxies) ? save.galaxies.unlockedGalaxies : state.galaxies.unlockedGalaxies,
              platforms: Array.isArray(save.galaxies.platforms) 
                ? save.galaxies.platforms.map((p: any) => ({
                    ...p,
                    hp: D(p.hp ?? 100),
                    maxHp: D(p.maxHp ?? 100),
                    shieldHp: D(p.shieldHp ?? 0),
                    maxShieldHp: D(p.maxShieldHp ?? 0),
                    armor: D(p.armor ?? 0),
                    maxArmor: D(p.maxArmor ?? 0),
                    resources: p.resources 
                      ? Object.fromEntries(
                          Object.entries(p.resources).map(([k, v]: [string, any]) => [
                            k,
                            { amount: D(v?.amount ?? 0), max: D(v?.max ?? 0) }
                          ])
                        )
                      : {},
                    combat: p.combat 
                      ? {
                          ...p.combat,
                          enemies: Array.isArray(p.combat.enemies)
                            ? p.combat.enemies.map((e: any) => ({
                                ...e,
                                hp: D(e.hp ?? 0),
                                maxHp: D(e.maxHp ?? 0),
                                dps: D(e.dps ?? 0),
                                armor: D(e.armor ?? 0),
                                loot: e.loot 
                                  ? {
                                      ...e.loot,
                                      credits: D(e.loot.credits ?? 0),
                                      resources: e.loot.resources
                                        ? Object.fromEntries(
                                            Object.entries(e.loot.resources).map(([k, v]) => [k, D(v as any)])
                                          )
                                        : undefined,
                                    }
                                  : undefined,
                              }))
                            : [],
                        }
                      : p.combat,
                  }))
                : state.galaxies.platforms,
              autoTransportEnabled: typeof save.galaxies.autoTransportEnabled === 'boolean' ? save.galaxies.autoTransportEnabled : state.galaxies.autoTransportEnabled,
              fuelReserve: D(save.galaxies.fuelReserve ?? state.galaxies.fuelReserve.toString()),
              notifications: Array.isArray(save.galaxies.notifications) ? save.galaxies.notifications : [],
            }
          : state.galaxies;

        const loadedPollution: import('../core/gameTypes').PollutionState = save.pollution && typeof save.pollution === 'object'
          ? {
              wasteAmount: D(save.pollution.wasteAmount ?? '0'),
              radioactiveWasteAmount: D(save.pollution.radioactiveWasteAmount ?? '0'),
              efficiencyMultiplier: typeof save.pollution.efficiencyMultiplier === 'number' ? save.pollution.efficiencyMultiplier : 1.0,
              pollutionZones: Array.isArray(save.pollution.pollutionZones) ? save.pollution.pollutionZones : [],
            }
          : INITIAL_POLLUTION;

        const loadedIntergalacticLogistics: import('../core/gameTypes').IntergalacticLogisticsState = save.intergalacticLogistics && typeof save.intergalacticLogistics === 'object'
          ? {
              caravans: Array.isArray(save.intergalacticLogistics.caravans)
                ? save.intergalacticLogistics.caravans.map((c: any) => ({
                    ...c,
                    cargo: Object.fromEntries(
                      Object.entries(c.cargo || {}).map(([k, v]) => [k, D(v as any)])
                    ),
                    fuelCost: D(c.fuelCost ?? '0'),
                    fuelPaid: D(c.fuelPaid ?? '0'),
                    defense: D(c.defense ?? '10'),
                    underAttackBy: Array.isArray(c.underAttackBy)
                      ? c.underAttackBy.map((e: any) => ({
                          ...e,
                          maxHp: D(e.maxHp ?? '100'),
                          hp: D(e.hp ?? '100'),
                          dps: D(e.dps ?? '10'),
                          armor: D(e.armor ?? '0'),
                        }))
                      : undefined,
                  }))
                : [],
              upgrades: save.intergalacticLogistics.upgrades && typeof save.intergalacticLogistics.upgrades === 'object'
                ? {
                    speed: typeof save.intergalacticLogistics.upgrades.speed === 'number' ? save.intergalacticLogistics.upgrades.speed : 0,
                    capacity: typeof save.intergalacticLogistics.upgrades.capacity === 'number' ? save.intergalacticLogistics.upgrades.capacity : 0,
                    defense: typeof save.intergalacticLogistics.upgrades.defense === 'number' ? save.intergalacticLogistics.upgrades.defense : 0,
                  }
                : INITIAL_INTERGALACTIC_LOGISTICS.upgrades,
              autoSendToMainBase: typeof save.intergalacticLogistics.autoSendToMainBase === 'boolean' ? save.intergalacticLogistics.autoSendToMainBase : false,
              autoRoutes: Array.isArray(save.intergalacticLogistics.autoRoutes)
                ? save.intergalacticLogistics.autoRoutes.map((r: any) => ({
                    ...r,
                    triggerAmount: D(r.triggerAmount ?? '0'),
                    sendAmount: D(r.sendAmount ?? '0'),
                  }))
                : [],
            }
          : INITIAL_INTERGALACTIC_LOGISTICS;

        const loadedRandomEvents: RandomEventsState = save.randomEvents && typeof save.randomEvents === 'object'
          ? {
              activeEvents: Array.isArray(save.randomEvents.activeEvents)
                ? save.randomEvents.activeEvents.map((e: any) => ({
                    ...e,
                    effects: e.effects && typeof e.effects === 'object'
                      ? {
                          ...e.effects,
                          resourceGain: e.effects.resourceGain && typeof e.effects.resourceGain === 'object'
                            ? Object.fromEntries(
                                Object.entries(e.effects.resourceGain).map(([k, v]) => [k, D(v as any)])
                              )
                            : undefined,
                          resourceLoss: e.effects.resourceLoss && typeof e.effects.resourceLoss === 'object'
                            ? Object.fromEntries(
                                Object.entries(e.effects.resourceLoss).map(([k, v]) => [k, D(v as any)])
                              )
                            : undefined,
                          researchPointsGain: e.effects.researchPointsGain ? D(e.effects.researchPointsGain) : undefined,
                          energyLoss: e.effects.energyLoss ? D(e.effects.energyLoss) : undefined,
                        }
                      : undefined,
                  }))
                : [],
              eventHistory: Array.isArray(save.randomEvents.eventHistory) ? save.randomEvents.eventHistory : [],
              nextEventAt: typeof save.randomEvents.nextEventAt === 'number' ? save.randomEvents.nextEventAt : Date.now() + BASE_EVENT_INTERVAL_MIN,
              eventsEnabled: typeof save.randomEvents.eventsEnabled === 'boolean' ? save.randomEvents.eventsEnabled : true,
              eventFrequencyMultiplier: typeof save.randomEvents.eventFrequencyMultiplier === 'number' ? save.randomEvents.eventFrequencyMultiplier : 1.0,
            }
          : INITIAL_RANDOM_EVENTS;

        const loadedAchievements: import('../core/gameTypes').AchievementsState = save.achievements && typeof save.achievements === 'object'
          ? {
              unlocked: typeof save.achievements.unlocked === 'object' ? save.achievements.unlocked : {},
              recentlyUnlocked: Array.isArray(save.achievements.recentlyUnlocked)
                ? save.achievements.recentlyUnlocked
                : [],
            }
          : INITIAL_ACHIEVEMENTS;

        const loadedQuests: import('../core/gameTypes.tutorial').QuestState = save.quests && typeof save.quests === 'object'
          ? {
              activeQuests: Array.isArray(save.quests.activeQuests) ? save.quests.activeQuests : [],
              completedQuests: Array.isArray(save.quests.completedQuests) ? save.quests.completedQuests : [],
            }
          : {
              // Если нет сохраненных квестов, инициализируем стартовые квесты
              activeQuests: [...STARTER_QUESTS],
              completedQuests: [],
            };

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
                shield_boost: typeof save.aegis.levels?.shield_boost === 'number' ? Math.max(0, save.aegis.levels.shield_boost) : state.aegis.levels.shield_boost,
                turret_overdrive: typeof save.aegis.levels?.turret_overdrive === 'number' ? Math.max(0, save.aegis.levels.turret_overdrive) : state.aegis.levels.turret_overdrive,
                auto_repair: typeof save.aegis.levels?.auto_repair === 'number' ? Math.max(0, save.aegis.levels.auto_repair) : state.aegis.levels.auto_repair,
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
                // Фаза 2: Базовые новые ресурсы
                natural_gas: Array.isArray(rawHistory.natural_gas)
                  ? rawHistory.natural_gas
                      .map((p: any) => ({ t: Number(p?.t), price: String(p?.price) }))
                      .filter((p: any) => Number.isFinite(p.t) && typeof p.price === 'string')
                  : (market.history?.natural_gas ?? []),
                oil: Array.isArray(rawHistory.oil)
                  ? rawHistory.oil
                      .map((p: any) => ({ t: Number(p?.t), price: String(p?.price) }))
                      .filter((p: any) => Number.isFinite(p.t) && typeof p.price === 'string')
                  : (market.history?.oil ?? []),
                gasoline: Array.isArray(rawHistory.gasoline)
                  ? rawHistory.gasoline
                      .map((p: any) => ({ t: Number(p?.t), price: String(p?.price) }))
                      .filter((p: any) => Number.isFinite(p.t) && typeof p.price === 'string')
                  : (market.history?.gasoline ?? []),
                plastic: Array.isArray(rawHistory.plastic)
                  ? rawHistory.plastic
                      .map((p: any) => ({ t: Number(p?.t), price: String(p?.price) }))
                      .filter((p: any) => Number.isFinite(p.t) && typeof p.price === 'string')
                  : (market.history?.plastic ?? []),
                glass: Array.isArray(rawHistory.glass)
                  ? rawHistory.glass
                      .map((p: any) => ({ t: Number(p?.t), price: String(p?.price) }))
                      .filter((p: any) => Number.isFinite(p.t) && typeof p.price === 'string')
                  : (market.history?.glass ?? []),
                sand: Array.isArray(rawHistory.sand)
                  ? rawHistory.sand
                      .map((p: any) => ({ t: Number(p?.t), price: String(p?.price) }))
                      .filter((p: any) => Number.isFinite(p.t) && typeof p.price === 'string')
                  : (market.history?.sand ?? []),
                // Фаза 2.3: Металлические ресурсы
                uranium: Array.isArray(rawHistory.uranium)
                  ? rawHistory.uranium
                      .map((p: any) => ({ t: Number(p?.t), price: String(p?.price) }))
                      .filter((p: any) => Number.isFinite(p.t) && typeof p.price === 'string')
                  : (market.history?.uranium ?? []),
                chrome: Array.isArray(rawHistory.chrome)
                  ? rawHistory.chrome
                      .map((p: any) => ({ t: Number(p?.t), price: String(p?.price) }))
                      .filter((p: any) => Number.isFinite(p.t) && typeof p.price === 'string')
                  : (market.history?.chrome ?? []),
                titanium: Array.isArray(rawHistory.titanium)
                  ? rawHistory.titanium
                      .map((p: any) => ({ t: Number(p?.t), price: String(p?.price) }))
                      .filter((p: any) => Number.isFinite(p.t) && typeof p.price === 'string')
                  : (market.history?.titanium ?? []),
                // Фаза 2.4-2.5: Продвинутые ресурсы
                copper: Array.isArray(rawHistory.copper)
                  ? rawHistory.copper
                      .map((p: any) => ({ t: Number(p?.t), price: String(p?.price) }))
                      .filter((p: any) => Number.isFinite(p.t) && typeof p.price === 'string')
                  : (market.history?.copper ?? []),
                semiconductors: Array.isArray(rawHistory.semiconductors)
                  ? rawHistory.semiconductors
                      .map((p: any) => ({ t: Number(p?.t), price: String(p?.price) }))
                      .filter((p: any) => Number.isFinite(p.t) && typeof p.price === 'string')
                  : (market.history?.semiconductors ?? []),
                dynamite: Array.isArray(rawHistory.dynamite)
                  ? rawHistory.dynamite
                      .map((p: any) => ({ t: Number(p?.t), price: String(p?.price) }))
                      .filter((p: any) => Number.isFinite(p.t) && typeof p.price === 'string')
                  : (market.history?.dynamite ?? []),
                fiber: Array.isArray(rawHistory.fiber)
                  ? rawHistory.fiber
                      .map((p: any) => ({ t: Number(p?.t), price: String(p?.price) }))
                      .filter((p: any) => Number.isFinite(p.t) && typeof p.price === 'string')
                  : (market.history?.fiber ?? []),
                // Фаза 2.6: Сложные производственные ресурсы
                integrated_circuit: Array.isArray(rawHistory.integrated_circuit)
                  ? rawHistory.integrated_circuit
                      .map((p: any) => ({ t: Number(p?.t), price: String(p?.price) }))
                      .filter((p: any) => Number.isFinite(p.t) && typeof p.price === 'string')
                  : (market.history?.integrated_circuit ?? []),
                battery: Array.isArray(rawHistory.battery)
                  ? rawHistory.battery
                      .map((p: any) => ({ t: Number(p?.t), price: String(p?.price) }))
                      .filter((p: any) => Number.isFinite(p.t) && typeof p.price === 'string')
                  : (market.history?.battery ?? []),
                engine: Array.isArray(rawHistory.engine)
                  ? rawHistory.engine
                      .map((p: any) => ({ t: Number(p?.t), price: String(p?.price) }))
                      .filter((p: any) => Number.isFinite(p.t) && typeof p.price === 'string')
                  : (market.history?.engine ?? []),
                display: Array.isArray(rawHistory.display)
                  ? rawHistory.display
                      .map((p: any) => ({ t: Number(p?.t), price: String(p?.price) }))
                      .filter((p: any) => Number.isFinite(p.t) && typeof p.price === 'string')
                  : (market.history?.display ?? []),
                computer: Array.isArray(rawHistory.computer)
                  ? rawHistory.computer
                      .map((p: any) => ({ t: Number(p?.t), price: String(p?.price) }))
                      .filter((p: any) => Number.isFinite(p.t) && typeof p.price === 'string')
                  : (market.history?.computer ?? []),
                liquid_fuel: Array.isArray(rawHistory.liquid_fuel)
                  ? rawHistory.liquid_fuel
                      .map((p: any) => ({ t: Number(p?.t), price: String(p?.price) }))
                      .filter((p: any) => Number.isFinite(p.t) && typeof p.price === 'string')
                  : (market.history?.liquid_fuel ?? []),
                chrome_alloy: Array.isArray(rawHistory.chrome_alloy)
                  ? rawHistory.chrome_alloy
                      .map((p: any) => ({ t: Number(p?.t), price: String(p?.price) }))
                      .filter((p: any) => Number.isFinite(p.t) && typeof p.price === 'string')
                  : (market.history?.chrome_alloy ?? []),
                titanium_alloy: Array.isArray(rawHistory.titanium_alloy)
                  ? rawHistory.titanium_alloy
                      .map((p: any) => ({ t: Number(p?.t), price: String(p?.price) }))
                      .filter((p: any) => Number.isFinite(p.t) && typeof p.price === 'string')
                  : (market.history?.titanium_alloy ?? []),
                enriched_uranium: Array.isArray(rawHistory.enriched_uranium)
                  ? rawHistory.enriched_uranium
                      .map((p: any) => ({ t: Number(p?.t), price: String(p?.price) }))
                      .filter((p: any) => Number.isFinite(p.t) && typeof p.price === 'string')
                  : (market.history?.enriched_uranium ?? []),
                // Фаза 2.7: Военные ресурсы
                weapon: Array.isArray(rawHistory.weapon)
                  ? rawHistory.weapon
                      .map((p: any) => ({ t: Number(p?.t), price: String(p?.price) }))
                      .filter((p: any) => Number.isFinite(p.t) && typeof p.price === 'string')
                  : (market.history?.weapon ?? []),
                artillery: Array.isArray(rawHistory.artillery)
                  ? rawHistory.artillery
                      .map((p: any) => ({ t: Number(p?.t), price: String(p?.price) }))
                      .filter((p: any) => Number.isFinite(p.t) && typeof p.price === 'string')
                  : (market.history?.artillery ?? []),
                radar: Array.isArray(rawHistory.radar)
                  ? rawHistory.radar
                      .map((p: any) => ({ t: Number(p?.t), price: String(p?.price) }))
                      .filter((p: any) => Number.isFinite(p.t) && typeof p.price === 'string')
                  : (market.history?.radar ?? []),
                nuclear_bomb: Array.isArray(rawHistory.nuclear_bomb)
                  ? rawHistory.nuclear_bomb
                      .map((p: any) => ({ t: Number(p?.t), price: String(p?.price) }))
                      .filter((p: any) => Number.isFinite(p.t) && typeof p.price === 'string')
                  : (market.history?.nuclear_bomb ?? []),
                // Фаза 2.8: Космические ресурсы
                jet_engine: Array.isArray(rawHistory.jet_engine)
                  ? rawHistory.jet_engine
                      .map((p: any) => ({ t: Number(p?.t), price: String(p?.price) }))
                      .filter((p: any) => Number.isFinite(p.t) && typeof p.price === 'string')
                  : (market.history?.jet_engine ?? []),
                satellite: Array.isArray(rawHistory.satellite)
                  ? rawHistory.satellite
                      .map((p: any) => ({ t: Number(p?.t), price: String(p?.price) }))
                      .filter((p: any) => Number.isFinite(p.t) && typeof p.price === 'string')
                  : (market.history?.satellite ?? []),
                rocket: Array.isArray(rawHistory.rocket)
                  ? rawHistory.rocket
                      .map((p: any) => ({ t: Number(p?.t), price: String(p?.price) }))
                      .filter((p: any) => Number.isFinite(p.t) && typeof p.price === 'string')
                  : (market.history?.rocket ?? []),
                spaceship: Array.isArray(rawHistory.spaceship)
                  ? rawHistory.spaceship
                      .map((p: any) => ({ t: Number(p?.t), price: String(p?.price) }))
                      .filter((p: any) => Number.isFinite(p.t) && typeof p.price === 'string')
                  : (market.history?.spaceship ?? []),
                console: Array.isArray(rawHistory.console)
                  ? rawHistory.console
                      .map((p: any) => ({ t: Number(p?.t), price: String(p?.price) }))
                      .filter((p: any) => Number.isFinite(p.t) && typeof p.price === 'string')
                  : (market.history?.console ?? []),
                space_station: Array.isArray(rawHistory.space_station)
                  ? rawHistory.space_station
                      .map((p: any) => ({ t: Number(p?.t), price: String(p?.price) }))
                      .filter((p: any) => Number.isFinite(p.t) && typeof p.price === 'string')
                  : (market.history?.space_station ?? []),
                // Фаза 2.9: Специальные ресурсы
                robot: Array.isArray(rawHistory.robot)
                  ? rawHistory.robot
                      .map((p: any) => ({ t: Number(p?.t), price: String(p?.price) }))
                      .filter((p: any) => Number.isFinite(p.t) && typeof p.price === 'string')
                  : (market.history?.robot ?? []),
                // Фаза 3: T6 Entertainment (торговые)
                music_album: Array.isArray(rawHistory.music_album)
                  ? rawHistory.music_album
                      .map((p: any) => ({ t: Number(p?.t), price: String(p?.price) }))
                      .filter((p: any) => Number.isFinite(p.t) && typeof p.price === 'string')
                  : (market.history?.music_album ?? []),
                movie: Array.isArray(rawHistory.movie)
                  ? rawHistory.movie
                      .map((p: any) => ({ t: Number(p?.t), price: String(p?.price) }))
                      .filter((p: any) => Number.isFinite(p.t) && typeof p.price === 'string')
                  : (market.history?.movie ?? []),
                video_game: Array.isArray(rawHistory.video_game)
                  ? rawHistory.video_game
                      .map((p: any) => ({ t: Number(p?.t), price: String(p?.price) }))
                      .filter((p: any) => Number.isFinite(p.t) && typeof p.price === 'string')
                  : (market.history?.video_game ?? []),
                vr_headset: Array.isArray(rawHistory.vr_headset)
                  ? rawHistory.vr_headset
                      .map((p: any) => ({ t: Number(p?.t), price: String(p?.price) }))
                      .filter((p: any) => Number.isFinite(p.t) && typeof p.price === 'string')
                  : (market.history?.vr_headset ?? []),
                ar_glasses: Array.isArray(rawHistory.ar_glasses)
                  ? rawHistory.ar_glasses
                      .map((p: any) => ({ t: Number(p?.t), price: String(p?.price) }))
                      .filter((p: any) => Number.isFinite(p.t) && typeof p.price === 'string')
                  : (market.history?.ar_glasses ?? []),
                gaming_console: Array.isArray(rawHistory.gaming_console)
                  ? rawHistory.gaming_console
                      .map((p: any) => ({ t: Number(p?.t), price: String(p?.price) }))
                      .filter((p: any) => Number.isFinite(p.t) && typeof p.price === 'string')
                  : (market.history?.gaming_console ?? []),
                smart_tv: Array.isArray(rawHistory.smart_tv)
                  ? rawHistory.smart_tv
                      .map((p: any) => ({ t: Number(p?.t), price: String(p?.price) }))
                      .filter((p: any) => Number.isFinite(p.t) && typeof p.price === 'string')
                  : (market.history?.smart_tv ?? []),
                // Фаза 3: T6 Culture (торговые)
                artwork: Array.isArray(rawHistory.artwork)
                  ? rawHistory.artwork
                      .map((p: any) => ({ t: Number(p?.t), price: String(p?.price) }))
                      .filter((p: any) => Number.isFinite(p.t) && typeof p.price === 'string')
                  : (market.history?.artwork ?? []),
                sculpture: Array.isArray(rawHistory.sculpture)
                  ? rawHistory.sculpture
                      .map((p: any) => ({ t: Number(p?.t), price: String(p?.price) }))
                      .filter((p: any) => Number.isFinite(p.t) && typeof p.price === 'string')
                  : (market.history?.sculpture ?? []),
                literature: Array.isArray(rawHistory.literature)
                  ? rawHistory.literature
                      .map((p: any) => ({ t: Number(p?.t), price: String(p?.price) }))
                      .filter((p: any) => Number.isFinite(p.t) && typeof p.price === 'string')
                  : (market.history?.literature ?? []),
                fashion: Array.isArray(rawHistory.fashion)
                  ? rawHistory.fashion
                      .map((p: any) => ({ t: Number(p?.t), price: String(p?.price) }))
                      .filter((p: any) => Number.isFinite(p.t) && typeof p.price === 'string')
                  : (market.history?.fashion ?? []),
                jewelry: Array.isArray(rawHistory.jewelry)
                  ? rawHistory.jewelry
                      .map((p: any) => ({ t: Number(p?.t), price: String(p?.price) }))
                      .filter((p: any) => Number.isFinite(p.t) && typeof p.price === 'string')
                  : (market.history?.jewelry ?? []),
                // Фаза 3: T7 Medical (торговые)
                medicine: Array.isArray(rawHistory.medicine)
                  ? rawHistory.medicine
                      .map((p: any) => ({ t: Number(p?.t), price: String(p?.price) }))
                      .filter((p: any) => Number.isFinite(p.t) && typeof p.price === 'string')
                  : (market.history?.medicine ?? []),
                vaccine: Array.isArray(rawHistory.vaccine)
                  ? rawHistory.vaccine
                      .map((p: any) => ({ t: Number(p?.t), price: String(p?.price) }))
                      .filter((p: any) => Number.isFinite(p.t) && typeof p.price === 'string')
                  : (market.history?.vaccine ?? []),
                // Фаза 3: T7 Social (торговый)
                cryptocurrency: Array.isArray(rawHistory.cryptocurrency)
                  ? rawHistory.cryptocurrency
                      .map((p: any) => ({ t: Number(p?.t), price: String(p?.price) }))
                      .filter((p: any) => Number.isFinite(p.t) && typeof p.price === 'string')
                  : (market.history?.cryptocurrency ?? []),
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
              tileLevels: save.grid.tileLevels && typeof save.grid.tileLevels === 'object' ? save.grid.tileLevels : (state.grid.tileLevels ?? {}),
              tileEvolutionLevels: save.grid.tileEvolutionLevels && typeof save.grid.tileEvolutionLevels === 'object' ? save.grid.tileEvolutionLevels : (state.grid.tileEvolutionLevels ?? {}),
              tileDisabled: save.grid.tileDisabled && typeof save.grid.tileDisabled === 'object' ? save.grid.tileDisabled : (state.grid.tileDisabled ?? {}),
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

        // МИГРАЦИЯ: Добавляем отсутствующие tileLevels для зданий на карте
        if (grid.tiles && Object.keys(grid.tiles).length > 0) {
          if (!grid.tileLevels) {
            grid.tileLevels = {};
          }
          
          let migratedCount = 0;
          for (const tileKey of Object.keys(grid.tiles)) {
            if (!(tileKey in grid.tileLevels)) {
              grid.tileLevels[tileKey] = 1;
              migratedCount++;
            }
          }
          
          if (migratedCount > 0) {
            console.log('🔧 Миграция: инициализированы уровни для', migratedCount, 'зданий');
          }
          
          // Также добавляем tileEvolutionLevels если их нет
          if (!grid.tileEvolutionLevels) {
            grid.tileEvolutionLevels = {};
          }
          for (const tileKey of Object.keys(grid.tiles)) {
            if (!(tileKey in grid.tileEvolutionLevels)) {
              grid.tileEvolutionLevels[tileKey] = 0;
            }
          }
        }

        console.log('📊 Загрузка: зданий на карте =', Object.keys(grid.tiles || {}).length, ', tileLevels =', Object.keys(grid.tileLevels || {}).length);

        const capsMult = computeCapsMultiplier(loadedResearch.levels, loadedMeta.qubits);
        newResources = recomputeCaps(newResources, newBuildings, capsMult, grid.tileLevels || {}, grid.tiles);
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
          currency: loadedCurrency,
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
          politics: loadedPolitics,
          galaxies: loadedGalaxies,
          pollution: loadedPollution,
          intergalacticLogistics: loadedIntergalacticLogistics,
          randomEvents: loadedRandomEvents,
          achievements: loadedAchievements,
          quests: loadedQuests,
          culture: save.culture ? {
            science: D(save.culture.science ?? '0'),
            culture: D(save.culture.culture ?? '0'),
            currentLevel: typeof save.culture.currentLevel === 'number' ? save.culture.currentLevel : 1,
            cultureProgress: D(save.culture.cultureProgress ?? '0'),
            sciencePerSecond: D(0),
            culturePerSecond: D(0),
            totalScienceProduced: D(save.culture.totalScienceProduced ?? '0'),
            totalCultureProduced: D(save.culture.totalCultureProduced ?? '0'),
            happiness: save.culture.happiness ?? INITIAL_CULTURE.happiness,
            unlockedCultureBuildings: Array.isArray(save.culture.unlockedCultureBuildings) ? save.culture.unlockedCultureBuildings : [],
            aggregatedEffects: save.culture.aggregatedEffects ?? INITIAL_CULTURE.aggregatedEffects,
          } : INITIAL_CULTURE,
          maps: save.maps ? {
            currentMapId: save.maps.currentMapId ?? INITIAL_MAPS.currentMapId,
            unlockedMaps: Array.isArray(save.maps.unlockedMaps) ? save.maps.unlockedMaps : INITIAL_MAPS.unlockedMaps,
            mapProgress: save.maps.mapProgress ?? {},
            activeMapData: save.maps.activeMapData ?? null,
            mapSeed: typeof save.maps.mapSeed === 'number' ? save.maps.mapSeed : Date.now(),
            currentEvent: save.maps.currentEvent ?? null,
            eventHistory: Array.isArray(save.maps.eventHistory) ? save.maps.eventHistory : [],
          } : INITIAL_MAPS,
          stats: save.stats ? {
            totalPlayTime: typeof save.stats.totalPlayTime === 'number' ? save.stats.totalPlayTime : 0,
            sessionsCount: (typeof save.stats.sessionsCount === 'number' ? save.stats.sessionsCount : 0) + 1,
            currentSessionStart: Date.now(), // Новая сессия начинается при загрузке
            lifetimeResourcesProduced: save.stats.lifetimeResourcesProduced ?? {},
            lifetimeResourcesSpent: save.stats.lifetimeResourcesSpent ?? {},
            lifetimeCreditsEarned: D(save.stats.lifetimeCreditsEarned ?? '0'),
            lifetimeCreditsSpent: D(save.stats.lifetimeCreditsSpent ?? '0'),
            contractsCompleted: typeof save.stats.contractsCompleted === 'number' ? save.stats.contractsCompleted : 0,
          } : {
            totalPlayTime: 0,
            sessionsCount: 1,
            currentSessionStart: Date.now(),
            lifetimeResourcesProduced: {},
            lifetimeResourcesSpent: {},
            lifetimeCreditsEarned: D(0),
            lifetimeCreditsSpent: D(0),
            contractsCompleted: 0,
          },
          lastTick: Date.now(),

          // --- slices recovered via ./gameSave.ts (see note above) ---
          fleet: restored.fleet ?? state.fleet,
          megastructures: restored.megastructures ?? state.megastructures,
          endgame: restored.endgame ?? state.endgame,
          prestige: restored.prestige ?? state.prestige,
          ascension: restored.ascension ?? state.ascension,
          repeatableResearch: restored.repeatableResearch ?? state.repeatableResearch,
          proceduralGalaxies: restored.proceduralGalaxies ?? state.proceduralGalaxies,
          artifacts: restored.artifacts ?? state.artifacts,
          retention: restored.retention ?? state.retention,
          signalInterception: restored.signalInterception ?? state.signalInterception,
        };
      });
      
      // После загрузки синхронизируем размеры grid с текущей картой
      const state = get();
      const currentMapId = state.maps.currentMapId;
      if (currentMapId) {
        const mapDef = getMapDefinition(currentMapId);
        if (mapDef) {
          const { width: mapWidth, height: mapHeight } = mapDef.gridDimensions;
          const currentGrid = state.grid;
          
          // Если размеры grid не соответствуют карте, обновляем их
          if (currentGrid.width !== mapWidth || currentGrid.height !== mapHeight) {
            console.log(`🔧 Синхронизация grid с картой: ${currentGrid.width}x${currentGrid.height} -> ${mapWidth}x${mapHeight}`);
            set((s) => ({
              grid: {
                ...s.grid,
                width: mapWidth,
                height: mapHeight,
              },
            }));
          }
        }
      }
      
      // Логируем загруженную карту
      console.log('🗺️ Loaded maps:', get().maps.currentMapId, 'Grid:', get().grid.width, 'x', get().grid.height);
    } catch (e) {
      console.error("Failed to load save", e);
    }
  },

  // Galaxy system methods
  switchGalaxy: (galaxyId: import('../core/gameTypes').GalaxyId) => {
    set((state) => {
      // Can only switch to unlocked galaxies
      if (!state.galaxies.unlockedGalaxies.includes(galaxyId)) {
        console.warn(`Galaxy ${galaxyId} is not unlocked yet`);
        return state;
      }
      
      return {
        galaxies: {
          ...state.galaxies,
          currentGalaxyId: galaxyId,
        },
      };
    });
  },

  unlockGalaxy: (galaxyId: import('../core/gameTypes').GalaxyId) => {
    set((state) => {
      if (state.galaxies.unlockedGalaxies.includes(galaxyId)) {
        return state; // Already unlocked
      }
      
      // TODO: Add cost requirements (e.g., influence, credits)

      /*
       * Единственное место, где галактика действительно открывается, — значит и единственная
       * точка для квестов типа 'explore'. Обработчика у них не было вовсе, и quest_unlock_galaxy
       * (1000 очков исследований) был недостижим. Ранний выход выше гарантирует, что повторный
       * вызов с той же галактикой сюда не дойдёт и прогресс не накрутится дважды.
       */
      return {
        galaxies: {
          ...state.galaxies,
          unlockedGalaxies: [...state.galaxies.unlockedGalaxies, galaxyId],
        },
        quests: advanceQuests(
          state.quests,
          (quest) => quest.type === 'explore' && (quest.target === galaxyId || quest.target === 'any'),
        ),
      };
    });
  },

  createPlatform: (galaxyId: import('../core/gameTypes').GalaxyId, name: string) => {
    set((state) => {
      if (!state.galaxies.unlockedGalaxies.includes(galaxyId)) {
        console.warn(`Cannot create platform in locked galaxy ${galaxyId}`);
        return state;
      }
      
      // Cost requirements
      const cost = {
        credits: D(50000),
        influence: D(1000),
      };
      
      if (state.currency.credits.lt(cost.credits) || state.currency.influence.lt(cost.influence)) {
        console.warn('Not enough resources to create platform');
        return state;
      }
      
      // Generate deposits based on galaxy's available deposits
      const galaxy = GALAXIES[galaxyId];
      const platformDeposits: Record<string, import('../core/gameTypes').DepositType> = {};
      
      // Generate random deposits from galaxy's available deposits
      for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 10; x++) {
          const key = `${x},${y}`;
          if (Math.random() < 0.15 && galaxy.availableDeposits) { // 15% chance
            const depositType = galaxy.availableDeposits[Math.floor(Math.random() * galaxy.availableDeposits.length)];
            platformDeposits[key] = depositType;
          }
        }
      }
      
      /*
       * Флаг planet_bonus_resources: новая платформа приезжает не пустой, а со стартовым
       * запасом базового сырья. Даём долю от лимита самой платформы, а не абсолютные числа —
       * тогда бонус автоматически растёт вместе с апгрейдами склада и не переполняет буфер.
       */
      const bonusStock = aggregatePolicyEffects(state.politics.activePolicies)
        .specialEffects.has('planet_bonus_resources');
      const STARTER_RESOURCES: ResourceType[] = ['ore', 'ice', 'carbon', 'steel', 'sand'];
      const starterFill = new Set<ResourceType>(bonusStock ? STARTER_RESOURCES : []);

      const newPlatform: import('../core/gameTypes').SpacePlatform = {
        id: `platform_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        galaxyId,
        name,
        grid: {
          width: 10,
          height: 10,
          selected: null,
          tiles: {},
          deposits: platformDeposits,
          buffers: { base: {} },
          lastDtSeconds: 0,
          selectedBuildId: null,
        },
        buildings: [],
        resources: Object.fromEntries(
          Object.entries(INITIAL_RESOURCES).map(([key, res]) => [
            key,
            {
              amount: starterFill.has(key as ResourceType) ? res.max.mul(D('0.25')) : D(0),
              max: res.max,
              production: D(0),
            }
          ])
        ) as Record<import('../core/gameTypes').ResourceType, import('../core/gameTypes').ResourceState>,
        maxHp: D(1000),
        hp: D(1000),
        armor: D(200),
        maxArmor: D(200),
        shieldMaxHp: D(500),
        shieldHp: D(500),
        shieldRegenRate: D(5),
        upgrades: {
          defense: 0,
          mining: 0,
          storage: 0,
        },
        combat: {
          underAttack: false,
          waveEndsAt: 0,
          nextWaveAt: Date.now() + 120000, // First wave in 2 minutes
          enemies: [],
          damagePerSecond: D(0),
          shieldRegenPerSecond: D(5),
          turretCount: 0,
          radarCount: 0,
          radarRange: 1,
        },
      };
      
      return {
        currency: {
          ...state.currency,
          credits: state.currency.credits.sub(cost.credits),
          influence: state.currency.influence.sub(cost.influence),
        },
        galaxies: {
          ...state.galaxies,
          platforms: [...state.galaxies.platforms, newPlatform],
        },
        /*
         * quest_build_platform объявлен как type: 'build', target: 'platform', но обработчик
         * постройки сравнивает target с id ЗДАНИЯ на сетке — платформа туда не попадает
         * никогда. Засчитываем её здесь, где платформа реально создаётся (и уже после списания
         * стоимости, чтобы неудачная попытка не двигала прогресс).
         */
        quests: advanceQuests(
          state.quests,
          (quest) => quest.type === 'build' && quest.target === 'platform',
        ),
      };
    });
  },

  upgradePlatform: (platformId: string, upgradeType: 'defense' | 'mining' | 'storage') => {
    set((state) => {
      const platformIndex = state.galaxies.platforms.findIndex(p => p.id === platformId);
      if (platformIndex === -1) {
        console.warn(`Platform ${platformId} not found`);
        return state;
      }
      
      const platform = state.galaxies.platforms[platformIndex];
      const currentLevel = platform.upgrades?.[upgradeType] || 0;
      
      // Calculate cost based on level
      const baseCosts: Record<string, number> = {
        defense: 10000,
        mining: 15000,
        storage: 8000,
      };
      const base = baseCosts[upgradeType] || 10000;
      const cost = D(Math.floor(base * Math.pow(1.5, currentLevel)));
      
      if (state.currency.credits.lt(cost)) {
        console.warn('Not enough credits to upgrade platform');
        return state;
      }
      
      const updatedPlatform = {
        ...platform,
        upgrades: {
          ...platform.upgrades,
          [upgradeType]: currentLevel + 1,
        },
      };
      
      // Update stats based on upgrade type
      if (upgradeType === 'defense') {
        updatedPlatform.maxHp = D(platform.maxHp).mul(1.5);
        updatedPlatform.hp = D(platform.hp).mul(1.5);
        updatedPlatform.maxArmor = D(platform.maxArmor).mul(1.4);
        updatedPlatform.armor = D(platform.armor).mul(1.4);
        updatedPlatform.shieldMaxHp = D(platform.shieldMaxHp).mul(1.5);
        updatedPlatform.shieldHp = D(platform.shieldHp).mul(1.5);
        updatedPlatform.shieldRegenRate = D(platform.shieldRegenRate || 0).mul(1.3);
      }
      
      const newPlatforms = [...state.galaxies.platforms];
      newPlatforms[platformIndex] = updatedPlatform;
      
      return {
        currency: {
          ...state.currency,
          credits: state.currency.credits.sub(cost),
        },
        galaxies: {
          ...state.galaxies,
          platforms: newPlatforms,
        },
      };
    });
  },

  removePlatform: (platformId: string) => {
    set((state) => {
      const platformExists = state.galaxies.platforms.some(p => p.id === platformId);
      if (!platformExists) {
        console.warn(`Platform ${platformId} not found`);
        return state;
      }
      
      return {
        galaxies: {
          ...state.galaxies,
          platforms: state.galaxies.platforms.filter(p => p.id !== platformId),
        },
      };
    });
  },

  toggleAutoTransport: () => {
    set((state) => ({
      galaxies: {
        ...state.galaxies,
        autoTransportEnabled: !state.galaxies.autoTransportEnabled,
      },
    }));
  },

  buyFuel: (amount: number) => {
    set((state) => {
      const cost = D(amount * 10); // 10 кредитов за единицу топлива
      if (state.currency.credits.lt(cost)) {
        return state;
      }
      
      return {
        currency: {
          ...state.currency,
          credits: state.currency.credits.sub(cost),
        },
        galaxies: {
          ...state.galaxies,
          fuelReserve: state.galaxies.fuelReserve.add(amount),
        },
      };
    });
  },

  setActivePlatform: (platformId: string | null) => {
    set((state) => {
      if (platformId === null) {
        // Switch back to main base
        return {
          galaxies: {
            ...state.galaxies,
            activePlatformId: undefined,
          },
        };
      }
      
      const platform = state.galaxies.platforms.find(p => p.id === platformId);
      if (!platform) {
        console.warn(`Platform ${platformId} not found`);
        return state;
      }
      
      return {
        galaxies: {
          ...state.galaxies,
          activePlatformId: platformId,
        },
      };
    });
  },

  // Fleet system actions
  buildShip: (shipType: import('../core/gameTypes').ShipType) => {
    set((state) => {
      const def = SHIP_DEFINITIONS[shipType];
      
      // Check if we can afford it
      const canAfford = Object.entries(def.buildCost).every(([resource, cost]) => {
        if (resource === 'credits') {
          return state.currency.credits.gte(cost as any);
        }
        return state.resources[resource as import('../core/gameTypes').ResourceType]?.amount.gte(cost as any) ?? false;
      });
      
      if (!canAfford) {
        console.warn(`Cannot afford to build ${shipType}`);
        return state;
      }
      
      // Deduct costs
      const newResources = { ...state.resources };
      let newCredits = state.currency.credits;
      
      for (const [resource, cost] of Object.entries(def.buildCost)) {
        if (resource === 'credits') {
          newCredits = newCredits.sub(cost as any);
        } else {
          const resType = resource as import('../core/gameTypes').ResourceType;
          newResources[resType] = {
            ...newResources[resType],
            amount: newResources[resType].amount.sub(cost as any),
          };
        }
      }
      
      // Create ship
      const stats = calculateShipStats(shipType, 1, 0);
      const newShip: import('../core/gameTypes').Ship = {
        id: `ship_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: shipType,
        name: generateShipName(),
        level: 1,
        maxHp: stats.maxHp,
        hp: stats.maxHp,
        dps: stats.dps,
        armor: stats.armor,
        speed: stats.speed,
        status: 'idle',
        experience: 0,
        upgradeLevel: 0,
      };
      
      return {
        resources: newResources,
        currency: {
          ...state.currency,
          credits: newCredits,
        },
        fleet: {
          ...state.fleet,
          ships: [...state.fleet.ships, newShip],
        },
        // Как и с платформой: quest_first_ship объявлен как build/'ship', но корабль не
        // ставится на сетку, поэтому обработчик постройки зданий его не видел.
        quests: advanceQuests(
          state.quests,
          (quest) => quest.type === 'build' && quest.target === 'ship',
        ),
      };
    });
  },

  upgradeShip: (shipId: string) => {
    set((state) => {
      const shipIndex = state.fleet.ships.findIndex(s => s.id === shipId);
      if (shipIndex === -1) return state;
      
      const ship = state.fleet.ships[shipIndex];
      const cost = calculateShipUpgradeCost(ship.type, ship.upgradeLevel);
      
      // Check if we can afford it
      const canAfford = Object.entries(cost).every(([resource, costAmount]) => {
        if (resource === 'credits') {
          return state.currency.credits.gte(costAmount as any);
        }
        return state.resources[resource as import('../core/gameTypes').ResourceType]?.amount.gte(costAmount as any) ?? false;
      });
      
      if (!canAfford) {
        console.warn(`Cannot afford to upgrade ship ${shipId}`);
        return state;
      }
      
      // Deduct costs
      const newResources = { ...state.resources };
      let newCredits = state.currency.credits;
      
      for (const [resource, costAmount] of Object.entries(cost)) {
        if (resource === 'credits') {
          newCredits = newCredits.sub(costAmount as any);
        } else {
          const resType = resource as import('../core/gameTypes').ResourceType;
          newResources[resType] = {
            ...newResources[resType],
            amount: newResources[resType].amount.sub(costAmount as any),
          };
        }
      }
      
      // Upgrade ship
      const newUpgradeLevel = ship.upgradeLevel + 1;
      const newStats = calculateShipStats(ship.type, ship.level, newUpgradeLevel);
      
      const updatedShip: import('../core/gameTypes').Ship = {
        ...ship,
        upgradeLevel: newUpgradeLevel,
        maxHp: newStats.maxHp,
        hp: ship.hp.mul(newStats.maxHp).div(ship.maxHp), // Scale current HP
        dps: newStats.dps,
        armor: newStats.armor,
      };
      
      const newShips = [...state.fleet.ships];
      newShips[shipIndex] = updatedShip;
      
      return {
        resources: newResources,
        currency: {
          ...state.currency,
          credits: newCredits,
        },
        fleet: {
          ...state.fleet,
          ships: newShips,
        },
      };
    });
  },

  assignShip: (shipId: string, targetId: string) => {
    set((state) => {
      const shipIndex = state.fleet.ships.findIndex(s => s.id === shipId);
      if (shipIndex === -1) return state;
      
      const updatedShip = {
        ...state.fleet.ships[shipIndex],
        assignedTo: targetId,
        status: 'defending' as const,
      };
      
      const newShips = [...state.fleet.ships];
      newShips[shipIndex] = updatedShip;
      
      return {
        fleet: {
          ...state.fleet,
          ships: newShips,
        },
      };
    });
  },

  repairShip: (shipId: string) => {
    set((state) => {
      const shipIndex = state.fleet.ships.findIndex(s => s.id === shipId);
      if (shipIndex === -1) return state;
      
      const ship = state.fleet.ships[shipIndex];
      
      // Repair cost: 20% of build cost
      const def = SHIP_DEFINITIONS[ship.type];
      const repairCost = Object.fromEntries(
        Object.entries(def.buildCost).map(([res, cost]) => [res, (cost as any).mul(0.2)])
      );
      
      // Check if we can afford it
      const canAfford = Object.entries(repairCost).every(([resource, cost]) => {
        if (resource === 'credits') {
          return state.currency.credits.gte(cost as any);
        }
        return state.resources[resource as import('../core/gameTypes').ResourceType]?.amount.gte(cost as any) ?? false;
      });
      
      if (!canAfford) {
        console.warn(`Cannot afford to repair ship ${shipId}`);
        return state;
      }
      
      // Deduct costs
      const newResources = { ...state.resources };
      let newCredits = state.currency.credits;
      
      for (const [resource, cost] of Object.entries(repairCost)) {
        if (resource === 'credits') {
          newCredits = newCredits.sub(cost as any);
        } else {
          const resType = resource as import('../core/gameTypes').ResourceType;
          newResources[resType] = {
            ...newResources[resType],
            amount: newResources[resType].amount.sub(cost as any),
          };
        }
      }
      
      // Repair ship to full HP
      const updatedShip = {
        ...ship,
        hp: ship.maxHp,
        status: 'idle' as const,
      };
      
      const newShips = [...state.fleet.ships];
      newShips[shipIndex] = updatedShip;
      
      return {
        resources: newResources,
        currency: {
          ...state.currency,
          credits: newCredits,
        },
        fleet: {
          ...state.fleet,
          ships: newShips,
        },
      };
    });
  },

  scrapShip: (shipId: string) => {
    set((state) => {
      const shipIndex = state.fleet.ships.findIndex(s => s.id === shipId);
      if (shipIndex === -1) return state;
      
      const ship = state.fleet.ships[shipIndex];
      
      // Get 30% of resources back
      const def = SHIP_DEFINITIONS[ship.type];
      const scrapReturn = Object.fromEntries(
        Object.entries(def.buildCost)
          .filter(([res]) => res !== 'credits')
          .map(([res, cost]) => [res, (cost as any).mul(0.3)])
      );
      
      const newResources = { ...state.resources };
      for (const [resource, amount] of Object.entries(scrapReturn)) {
        const resType = resource as import('../core/gameTypes').ResourceType;
        newResources[resType] = {
          ...newResources[resType],
          amount: newResources[resType].amount.add(amount as any),
        };
      }
      
      return {
        resources: newResources,
        fleet: {
          ...state.fleet,
          ships: state.fleet.ships.filter(s => s.id !== shipId),
        },
      };
    });
  },

  toggleAutoDefend: () => {
    set((state) => ({
      fleet: {
        ...state.fleet,
        autoDefend: !state.fleet.autoDefend,
      },
    }));
  },

  // Combat Functions
  spawnPlatformEnemy: (platformId: string) => {
    set((state) => {
      const platformIndex = state.galaxies.platforms.findIndex(p => p.id === platformId);
      if (platformIndex === -1) return state;
      
      const platform = state.galaxies.platforms[platformIndex];
      const galaxy = GALAXIES[platform.galaxyId];
      if (!galaxy || !galaxy.enemyLevelRange) return state;
      
      // Check if should spawn boss
      const shouldSpawnBoss = Math.random() < (galaxy.bossChance || 0);
      const enemyLevel = Math.floor(Math.random() * (galaxy.enemyLevelRange[1] - galaxy.enemyLevelRange[0] + 1)) + galaxy.enemyLevelRange[0];
      
      let enemyType: string | null = null;
      
      if (shouldSpawnBoss) {
        enemyType = getBossForLevel(enemyLevel);
      } else {
        const validEnemyTypes = galaxy.enemyTypes?.filter(type => ENEMY_DEFINITIONS[type as EnemyType]) || [];
        if (validEnemyTypes.length > 0) {
          enemyType = validEnemyTypes[Math.floor(Math.random() * validEnemyTypes.length)];
        }
      }
      
      if (!enemyType) return state;
      
      const newEnemy = createPlatformEnemy(enemyType as EnemyType, enemyLevel);
      
      const updatedPlatforms = [...state.galaxies.platforms];
      updatedPlatforms[platformIndex] = {
        ...platform,
        combat: {
          ...platform.combat,
          enemies: [...platform.combat.enemies, newEnemy],
          underAttack: true,
        },
      };
      
      return {
        galaxies: {
          ...state.galaxies,
          platforms: updatedPlatforms,
        },
      };
    });
  },

  processPlatformCombat: (platformId: string, dt: number) => {
    set((state) => {
      const platformIndex = state.galaxies.platforms.findIndex(p => p.id === platformId);
      if (platformIndex === -1) return state;
      
      const platform = state.galaxies.platforms[platformIndex];
      if (platform.combat.enemies.length === 0) {
        // No enemies, regenerate shields
        const newShieldHp = platform.shieldHp.add(platform.combat.shieldRegenPerSecond.mul(dt)).min(platform.shieldMaxHp);
        
        const updatedPlatforms = [...state.galaxies.platforms];
        updatedPlatforms[platformIndex] = {
          ...platform,
          shieldHp: newShieldHp,
          combat: {
            ...platform.combat,
            underAttack: false,
          },
        };
        
        return {
          galaxies: {
            ...state.galaxies,
            platforms: updatedPlatforms,
          },
        };
      }
      
      // Calculate platform defense
      const turretDamage = platform.combat.turretCount * 10; // 10 DPS per turret
      const assignedShips = state.fleet.ships.filter(s => s.assignedTo === platformId && s.status !== 'repairing');
      const shipDamage = assignedShips.reduce((total, ship) => {
        return total + ship.dps.toNumber();
      }, 0);
      
      const totalDefenseDPS = turretDamage + shipDamage;
      const damageDealt = D(totalDefenseDPS).mul(dt);
      
      // Calculate enemy damage to platform
      let totalEnemyDamage = D(0);
      const updatedEnemies = platform.combat.enemies.map(enemy => {
        if (enemy.hp.lte(0)) return enemy;
        
        const enemyDPS = enemy.dps || D(10);
        totalEnemyDamage = totalEnemyDamage.add(enemyDPS.mul(dt));
        
        // Apply damage to enemy
        const enemyDamageTaken = damageDealt.div(platform.combat.enemies.length); // Distribute damage
        return {
          ...enemy,
          hp: enemy.hp.sub(enemyDamageTaken).max(0),
        };
      });
      
      // Filter out dead enemies and grant loot
      const deadEnemies = updatedEnemies.filter(e => e.hp.lte(0));
      const aliveEnemies = updatedEnemies.filter(e => e.hp.gt(0));
      
      let newCurrency = { ...state.currency };
      let newResources = { ...state.resources };
      
      // Grant loot from dead enemies
      deadEnemies.forEach(enemy => {
        if (enemy.loot) {
          newCurrency.credits = newCurrency.credits.add(enemy.loot.credits || D(0));
          
          if (enemy.loot.resources) {
            Object.entries(enemy.loot.resources).forEach(([resource, amount]) => {
              const resType = resource as import('../core/gameTypes').ResourceType;
              if (newResources[resType]) {
                newResources[resType] = {
                  ...newResources[resType],
                  amount: newResources[resType].amount.add(amount as any),
                };
              }
            });
          }
        }
      });
      
      // Apply damage to platform
      let newShieldHp = platform.shieldHp;
      let newArmor = platform.armor;
      let newHp = platform.hp;
      
      let remainingDamage = totalEnemyDamage;
      
      // First, damage shields
      if (newShieldHp.gt(0)) {
        const effectiveDamage = remainingDamage.mul(1); // No reduction from shields
        if (effectiveDamage.gte(newShieldHp)) {
          remainingDamage = effectiveDamage.sub(newShieldHp);
          newShieldHp = D(0);
        } else {
          newShieldHp = newShieldHp.sub(effectiveDamage);
          remainingDamage = D(0);
        }
      }
      
      // Then, damage armor
      if (remainingDamage.gt(0) && newArmor.gt(0)) {
        const armorEffectiveness = 0.5; // Armor absorbs 50% of damage
        const effectiveDamage = remainingDamage.mul(armorEffectiveness);
        if (effectiveDamage.gte(newArmor)) {
          remainingDamage = remainingDamage.sub(newArmor.div(armorEffectiveness));
          newArmor = D(0);
        } else {
          newArmor = newArmor.sub(effectiveDamage);
          remainingDamage = D(0);
        }
      }
      
      // Finally, damage hull
      if (remainingDamage.gt(0)) {
        newHp = newHp.sub(remainingDamage).max(0);
      }
      
      const updatedPlatforms = [...state.galaxies.platforms];
      updatedPlatforms[platformIndex] = {
        ...platform,
        hp: newHp,
        armor: newArmor,
        shieldHp: newShieldHp,
        combat: {
          ...platform.combat,
          enemies: aliveEnemies,
          underAttack: aliveEnemies.length > 0,
          damagePerSecond: totalEnemyDamage.div(dt),
        },
      };
      
      return {
        currency: newCurrency,
        resources: newResources,
        galaxies: {
          ...state.galaxies,
          platforms: updatedPlatforms,
        },
      };
    });
  },

  updatePlatformDefenses: (platformId: string) => {
    set((state) => {
      const platformIndex = state.galaxies.platforms.findIndex(p => p.id === platformId);
      if (platformIndex === -1) return state;
      
      const platform = state.galaxies.platforms[platformIndex];
      
      // Count defense buildings on platform
      let turretCount = 0;
      let radarCount = 0;
      let maxRadarRange = 1;
      let totalShieldRegen = D(5); // Base regen
      
      platform.buildings.forEach(building => {
        if (building.id === 'defense_turret_mk1') {
          turretCount += building.count;
        } else if (building.id === 'defense_turret_mk2') {
          turretCount += building.count * 2; // Mk2 counts as 2
        } else if (building.id === 'radar_station_mk1') {
          radarCount += building.count;
          maxRadarRange = Math.max(maxRadarRange, 2);
        } else if (building.id === 'shield_generator_mk1') {
          totalShieldRegen = totalShieldRegen.add(D(10).mul(building.count));
        } else if (building.id === 'shield_generator_mk2') {
          totalShieldRegen = totalShieldRegen.add(D(25).mul(building.count));
        } else if (building.id === 'armor_plating_mk1') {
          // Armor handled elsewhere
        }
      });
      
      const updatedPlatforms = [...state.galaxies.platforms];
      updatedPlatforms[platformIndex] = {
        ...platform,
        combat: {
          ...platform.combat,
          turretCount,
          radarCount,
          radarRange: maxRadarRange,
          shieldRegenPerSecond: totalShieldRegen,
        },
      };
      
      return {
        galaxies: {
          ...state.galaxies,
          platforms: updatedPlatforms,
        },
      };
    });
  },

  repairPlatform: (platformId: string, repairType: 'hull' | 'armor' | 'shield' | 'all') => {
    set((state) => {
      const platformIndex = state.galaxies.platforms.findIndex(p => p.id === platformId);
      if (platformIndex === -1) return state;
      
      const platform = state.galaxies.platforms[platformIndex];
      
      // Ensure all values are Decimal
      const hp = D(platform.hp);
      const maxHp = D(platform.maxHp);
      const armor = D(platform.armor);
      const maxArmor = D(platform.maxArmor);
      const shieldHp = D(platform.shieldHp);
      const shieldMaxHp = D(platform.shieldMaxHp);
      
      // Calculate repair costs and amounts
      let totalCost = D(0);
      let newHp = hp;
      let newArmor = armor;
      let newShieldHp = shieldHp;
      
      if (repairType === 'hull' || repairType === 'all') {
        const hullDamage = maxHp.sub(hp);
        if (hullDamage.gt(0)) {
          const hullRepairCost = hullDamage.mul(10); // 10 credits per HP
          totalCost = totalCost.add(hullRepairCost);
          newHp = maxHp;
        }
      }
      
      if (repairType === 'armor' || repairType === 'all') {
        const armorDamage = maxArmor.sub(armor);
        if (armorDamage.gt(0)) {
          const armorRepairCost = armorDamage.mul(5); // 5 credits per armor point
          totalCost = totalCost.add(armorRepairCost);
          newArmor = maxArmor;
        }
      }
      
      if (repairType === 'shield' || repairType === 'all') {
        const shieldDamage = shieldMaxHp.sub(shieldHp);
        if (shieldDamage.gt(0)) {
          const shieldRepairCost = shieldDamage.mul(3); // 3 credits per shield HP
          totalCost = totalCost.add(shieldRepairCost);
          newShieldHp = shieldMaxHp;
        }
      }
      
      // Check if player has enough credits
      if (state.currency.credits.lt(totalCost)) {
        console.warn('Not enough credits to repair platform');
        return state;
      }
      
      const updatedPlatforms = [...state.galaxies.platforms];
      updatedPlatforms[platformIndex] = {
        ...platform,
        hp: newHp,
        armor: newArmor,
        shieldHp: newShieldHp,
      };
      
      return {
        currency: {
          ...state.currency,
          credits: state.currency.credits.sub(totalCost),
        },
        galaxies: {
          ...state.galaxies,
          platforms: updatedPlatforms,
        },
      };
    });
  },

  addNotification: (notification: Omit<import('../core/gameTypes').Notification, 'id' | 'timestamp' | 'read'>) => {
    set((state) => {
      const newNotification: import('../core/gameTypes').Notification = {
        ...notification,
        id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        read: false,
      };
      
      // Keep only last 50 notifications
      const notifications = [newNotification, ...state.galaxies.notifications].slice(0, 50);
      
      return {
        galaxies: {
          ...state.galaxies,
          notifications,
        },
      };
    });
  },

  markNotificationRead: (notificationId: string) => {
    set((state) => {
      const notifications = state.galaxies.notifications.map(n =>
        n.id === notificationId ? { ...n, read: true } : n
      );
      
      return {
        galaxies: {
          ...state.galaxies,
          notifications,
        },
      };
    });
  },

  clearNotifications: () => {
    set((state) => ({
      galaxies: {
        ...state.galaxies,
        notifications: [],
      },
    }));
  },

  // Intergalactic logistics actions
  sendCaravan: (fromId, toId, resources) => {
    set((state) => {
      const { intergalacticLogistics, galaxies } = state;
      
      // Determine source and destination galaxies
      let fromGalaxyId: import('../core/gameTypes').GalaxyId = 'galaxy_1_nebula_beginning';
      let toGalaxyId: import('../core/gameTypes').GalaxyId = 'galaxy_1_nebula_beginning';
      
      if (fromId !== 'main_base') {
        const platform = galaxies.platforms.find(p => p.id === fromId);
        if (platform) fromGalaxyId = platform.galaxyId;
      }
      
      if (toId !== 'main_base') {
        const platform = galaxies.platforms.find(p => p.id === toId);
        if (platform) toGalaxyId = platform.galaxyId;
      }
      
      // Calculate travel time based on distance and upgrades
      const baseTime = fromGalaxyId === toGalaxyId ? 30 : 180; // 30s same galaxy, 3min different
      const speedMultiplier = 1 / (1 + intergalacticLogistics.upgrades.speed * 0.2); // -20% per level
      const travelTime = baseTime * speedMultiplier;
      
      // Calculate fuel cost
      let totalCargo = D(0);
      Object.values(resources).forEach(amount => {
        if (amount) totalCargo = totalCargo.plus(amount);
      });
      // «Межгалактическая торговля дешевле на 25%» (trade_routes) удешевляет только
      // межгалактические рейсы: внутри одной галактики скидке нечего удешевлять.
      const isIntergalactic = fromGalaxyId !== toGalaxyId;
      const tradeRouteDiscount = isIntergalactic
        ? aggregatePolicyEffects(state.politics.activePolicies).specials.interTradeCost
        : 1;
      const fuelCost = totalCargo
        .mul(0.01)
        .mul(isIntergalactic ? 3 : 1)
        .mul(D(tradeRouteDiscount));
      
      // Check if we have enough fuel (liquid_fuel preferred, gasoline as backup)
      const liquidFuel = state.resources.liquid_fuel?.amount || D(0);
      const gasoline = state.resources.gasoline?.amount || D(0);
      const totalFuel = liquidFuel.plus(gasoline);
      
      if (totalFuel.lt(fuelCost)) {
        console.warn('Not enough fuel for caravan');
        return state;
      }
      
      // Check if source has enough resources BEFORE deducting
      if (fromId === 'main_base') {
        for (const [resType, amount] of Object.entries(resources)) {
          if (amount) {
            const available = state.resources[resType as import('../core/gameTypes').ResourceType]?.amount || D(0);
            if (available.lt(amount)) {
              console.warn(`Not enough ${resType} for caravan`);
              return state;
            }
          }
        }
      } else {
        const sourcePlatform = galaxies.platforms.find(p => p.id === fromId);
        if (!sourcePlatform) {
          console.warn('Source platform not found');
          return state;
        }
        for (const [resType, amount] of Object.entries(resources)) {
          if (amount) {
            const available = sourcePlatform.resources[resType as import('../core/gameTypes').ResourceType]?.amount || D(0);
            if (available.lt(amount)) {
              console.warn(`Not enough ${resType} on platform for caravan`);
              return state;
            }
          }
        }
      }
      
      // Deduct fuel
      let remainingFuelCost = fuelCost;
      let newResources = { ...state.resources };
      if (liquidFuel.gte(remainingFuelCost)) {
        newResources.liquid_fuel = {
          ...newResources.liquid_fuel!,
          amount: liquidFuel.minus(remainingFuelCost),
        };
      } else {
        newResources.liquid_fuel = {
          ...newResources.liquid_fuel!,
          amount: D(0),
        };
        remainingFuelCost = remainingFuelCost.minus(liquidFuel);
        newResources.gasoline = {
          ...newResources.gasoline!,
          amount: gasoline.minus(remainingFuelCost),
        };
      }
      
      // Create a copy of galaxies to avoid mutation
      const newGalaxies = { ...galaxies, platforms: [...galaxies.platforms] };
      
      // Deduct resources from source
      if (fromId === 'main_base') {
        Object.entries(resources).forEach(([resType, amount]) => {
          if (amount && newResources[resType as import('../core/gameTypes').ResourceType]) {
            newResources[resType as import('../core/gameTypes').ResourceType] = {
              ...newResources[resType as import('../core/gameTypes').ResourceType]!,
              amount: newResources[resType as import('../core/gameTypes').ResourceType]!.amount.minus(amount),
            };
          }
        });
      } else {
        // Deduct from platform
        const platformIndex = newGalaxies.platforms.findIndex(p => p.id === fromId);
        if (platformIndex >= 0) {
          const platform = { ...newGalaxies.platforms[platformIndex] };
          const updatedPlatformResources = { ...platform.resources };
          
          Object.entries(resources).forEach(([resType, amount]) => {
            if (amount && updatedPlatformResources[resType as import('../core/gameTypes').ResourceType]) {
              updatedPlatformResources[resType as import('../core/gameTypes').ResourceType] = {
                ...updatedPlatformResources[resType as import('../core/gameTypes').ResourceType]!,
                amount: updatedPlatformResources[resType as import('../core/gameTypes').ResourceType]!.amount.minus(amount),
              };
            }
          });
          
          platform.resources = updatedPlatformResources;
          newGalaxies.platforms[platformIndex] = platform;
        }
      }
      
      // Calculate risk level
      const fromGalaxy = Object.values(GALAXIES).find(g => g.id === fromGalaxyId);
      const toGalaxy = Object.values(GALAXIES).find(g => g.id === toGalaxyId);
      const dangerMap: Record<import('../core/gameTypes').GalaxyDangerLevel, number> = { very_low: 0.05, low: 0.1, medium: 0.2, high: 0.35, very_high: 0.5, extreme: 0.7 };
      const avgDanger = ((dangerMap[fromGalaxy?.dangerLevel || 'low'] || 0.1) + 
                         (dangerMap[toGalaxy?.dangerLevel || 'low'] || 0.1)) / 2;
      
      // Create new caravan
      const now = Date.now();
      const newCaravan: import('../core/gameTypes').Caravan = {
        id: `caravan_${now}_${Math.random().toString(36).substr(2, 9)}`,
        fromId,
        toId,
        fromGalaxyId,
        toGalaxyId,
        cargo: resources,
        status: 'traveling',
        progress: 0,
        departureTime: now,
        arrivalTime: now + travelTime * 1000,
        fuelCost,
        fuelPaid: fuelCost,
        riskLevel: avgDanger,
        defense: D(10 + intergalacticLogistics.upgrades.defense * 5),
      };
      
      return {
        ...state,
        resources: newResources,
        galaxies: newGalaxies,
        intergalacticLogistics: {
          ...intergalacticLogistics,
          caravans: [...intergalacticLogistics.caravans, newCaravan],
        },
      };
    });
  },

  upgradeCaravanSystem: (upgradeType) => {
    set((state) => {
      const { intergalacticLogistics, currency } = state;
      const currentLevel = intergalacticLogistics.upgrades[upgradeType];
      
      // Cost increases exponentially
      const baseCost = { speed: 1000, capacity: 800, defense: 1200 };
      const cost = D(baseCost[upgradeType]).mul(Math.pow(1.5, currentLevel));
      
      if (currency.credits.lt(cost)) {
        console.warn('Not enough credits for upgrade');
        return state;
      }
      
      return {
        ...state,
        currency: {
          ...currency,
          credits: currency.credits.minus(cost),
        },
        intergalacticLogistics: {
          ...intergalacticLogistics,
          upgrades: {
            ...intergalacticLogistics.upgrades,
            [upgradeType]: currentLevel + 1,
          },
        },
      };
    });
  },

  // Building level system (Фаза 8.5)
  upgradeBuildingAt: (coord) => {
    set((state) => {
      const tileKey = `${coord.x},${coord.y}`;
      const activePlatformId = state.galaxies.activePlatformId;
      
      console.log(`[upgradeBuildingAt] coord: ${tileKey}, activePlatformId: ${activePlatformId}`);
      
      // Get building from active platform or main grid
      let buildingId: string | undefined;
      let tileLevels: Record<string, number>;
      let isOnPlatform = false;
      let platformIndex = -1;
      
      if (activePlatformId) {
        platformIndex = state.galaxies.platforms.findIndex(p => p.id === activePlatformId);
        if (platformIndex !== -1) {
          const platform = state.galaxies.platforms[platformIndex];
          buildingId = platform.grid.tiles[tileKey];
          tileLevels = (platform.grid as any).tileLevels || {};
          isOnPlatform = true;
          console.log(`[upgradeBuildingAt] On platform, buildingId: ${buildingId}, tileLevels:`, tileLevels);
        } else {
          buildingId = state.grid.tiles[tileKey];
          tileLevels = state.grid.tileLevels || {};
        }
      } else {
        buildingId = state.grid.tiles[tileKey];
        tileLevels = state.grid.tileLevels || {};
      }
      
      if (!buildingId) {
        console.warn('No building at this location');
        return state;
      }
      
      // Get current level from tileLevels
      const currentLevel = tileLevels[tileKey] || 1;
      
      console.log(`[upgradeBuildingAt] currentLevel: ${currentLevel}`);
      
      if (currentLevel >= 500) {
        console.warn('Building is already at max level (500)');
        return state;
      }
      
      // Find the building definition
      const building = state.buildings.find(b => b.id === buildingId);
      if (!building) {
        console.warn('Building definition not found');
        return state;
      }
      
      // Calculate upgrade cost (exponential growth: cost * 1.15^level)
      const upgradeCost: Partial<Record<import('../core/gameTypes').ResourceType, import('break_eternity.js').default>> = {};
      let canAfford = true;
      
      Object.entries(building.baseCost).forEach(([resource, baseCost]) => {
        const cost = (baseCost as import('break_eternity.js').default).mul(Math.pow(1.15, currentLevel));
        upgradeCost[resource as import('../core/gameTypes').ResourceType] = cost;
        
        const available = state.resources[resource as import('../core/gameTypes').ResourceType]?.amount || D(0);
        if (available.lt(cost)) {
          canAfford = false;
        }
      });
      
      // Check credits if building has creditCost
      if (building.creditCost) {
        const creditCost = building.creditCost.mul(Math.pow(1.15, currentLevel));
        if (state.currency.credits.lt(creditCost)) {
          canAfford = false;
        }
      }
      
      if (!canAfford) {
        console.warn('Cannot afford building upgrade');
        return state;
      }
      
      // Deduct costs
      const newResources = { ...state.resources };
      Object.entries(upgradeCost).forEach(([resource, cost]) => {
        if (cost && newResources[resource as import('../core/gameTypes').ResourceType]) {
          newResources[resource as import('../core/gameTypes').ResourceType] = {
            ...newResources[resource as import('../core/gameTypes').ResourceType]!,
            amount: newResources[resource as import('../core/gameTypes').ResourceType]!.amount.minus(cost),
          };
        }
      });
      
      let newCredits = state.currency.credits;
      if (building.creditCost) {
        const creditCost = building.creditCost.mul(Math.pow(1.15, currentLevel));
        newCredits = newCredits.minus(creditCost);
      }
      
      // Upgrade the building level
      const newTileLevels = { ...tileLevels, [tileKey]: currentLevel + 1 };
      
      console.log(`[upgradeBuildingAt] Upgrading from ${currentLevel} to ${currentLevel + 1}, isOnPlatform: ${isOnPlatform}`);
      
      if (isOnPlatform && platformIndex !== -1) {
        // Update platform grid
        const updatedPlatforms = [...state.galaxies.platforms];
        updatedPlatforms[platformIndex] = {
          ...updatedPlatforms[platformIndex],
          grid: {
            ...updatedPlatforms[platformIndex].grid,
            tileLevels: newTileLevels,
          } as any,
        };
        
        console.log(`[upgradeBuildingAt] Platform upgraded, new tileLevels:`, newTileLevels);
        
        return {
          ...state,
          resources: newResources,
          currency: {
            ...state.currency,
            credits: newCredits,
          },
          galaxies: {
            ...state.galaxies,
            platforms: updatedPlatforms,
          },
        };
      }
      
      // ФАЗА 8.5: Обновляем grid и пересчитываем вместимость
      const updatedGrid = {
        ...state.grid,
        tileLevels: newTileLevels,
      };
      
      const capsMult = computeCapsMultiplier(state.research.levels, state.meta.qubits);
      const updatedResources = recomputeCaps(newResources, state.buildings, capsMult, newTileLevels, state.grid.tiles);
      
      return {
        ...state,
        resources: updatedResources,
        currency: {
          ...state.currency,
          credits: newCredits,
        },
        grid: updatedGrid,
      };
    });
  },

  downgradeBuildingAt: (coord) => {
    set((state) => {
      const tileKey = `${coord.x},${coord.y}`;
      const activePlatformId = state.galaxies.activePlatformId;
      
      // Get building from active platform or main grid
      let buildingId: string | undefined;
      let tileLevels: Record<string, number>;
      let isOnPlatform = false;
      let platformIndex = -1;
      
      if (activePlatformId) {
        platformIndex = state.galaxies.platforms.findIndex(p => p.id === activePlatformId);
        if (platformIndex !== -1) {
          const platform = state.galaxies.platforms[platformIndex];
          buildingId = platform.grid.tiles[tileKey];
          tileLevels = (platform.grid as any).tileLevels || {};
          isOnPlatform = true;
        } else {
          buildingId = state.grid.tiles[tileKey];
          tileLevels = state.grid.tileLevels || {};
        }
      } else {
        buildingId = state.grid.tiles[tileKey];
        tileLevels = state.grid.tileLevels || {};
      }
      
      if (!buildingId) {
        console.warn('No building at this location');
        return state;
      }
      
      // Get current level from tileLevels
      const currentLevel = tileLevels[tileKey] || 1;
      
      if (currentLevel <= 1) {
        console.warn('Building is already at level 1');
        return state;
      }
      
      // Find the building definition
      const building = state.buildings.find(b => b.id === buildingId);
      if (!building) {
        console.warn('Building definition not found');
        return state;
      }
      
      // Calculate refund (50% of previous upgrade cost)
      const previousLevel = currentLevel - 1;
      const refund: Partial<Record<import('../core/gameTypes').ResourceType, import('break_eternity.js').default>> = {};
      
      Object.entries(building.baseCost).forEach(([resource, baseCost]) => {
        const cost = (baseCost as import('break_eternity.js').default).mul(Math.pow(1.15, previousLevel));
        refund[resource as import('../core/gameTypes').ResourceType] = cost.mul(0.5); // 50% refund
      });
      
      // Refund resources
      const newResources = { ...state.resources };
      Object.entries(refund).forEach(([resource, amount]) => {
        if (amount && newResources[resource as import('../core/gameTypes').ResourceType]) {
          newResources[resource as import('../core/gameTypes').ResourceType] = {
            ...newResources[resource as import('../core/gameTypes').ResourceType]!,
            amount: newResources[resource as import('../core/gameTypes').ResourceType]!.amount.plus(amount),
          };
        }
      });
      
      let newCredits = state.currency.credits;
      if (building.creditCost) {
        const creditRefund = building.creditCost.mul(Math.pow(1.15, previousLevel)).mul(0.5);
        newCredits = newCredits.plus(creditRefund);
      }
      
      // Downgrade the building level
      const newTileLevels = { ...tileLevels, [tileKey]: currentLevel - 1 };
      
      if (isOnPlatform && platformIndex !== -1) {
        // Update platform grid
        const updatedPlatforms = [...state.galaxies.platforms];
        updatedPlatforms[platformIndex] = {
          ...updatedPlatforms[platformIndex],
          grid: {
            ...updatedPlatforms[platformIndex].grid,
            tileLevels: newTileLevels,
          } as any,
        };
        
        return {
          ...state,
          resources: newResources,
          currency: {
            ...state.currency,
            credits: newCredits,
          },
          galaxies: {
            ...state.galaxies,
            platforms: updatedPlatforms,
          },
        };
      }
      
      // ФАЗА 8.5: Обновляем grid и пересчитываем вместимость
      const updatedGrid = {
        ...state.grid,
        tileLevels: newTileLevels,
      };
      
      const capsMult = computeCapsMultiplier(state.research.levels, state.meta.qubits);
      const updatedResources = recomputeCaps(newResources, state.buildings, capsMult, newTileLevels, state.grid.tiles);
      
      return {
        ...state,
        resources: updatedResources,
        currency: {
          ...state.currency,
          credits: newCredits,
        },
        grid: updatedGrid,
      };
    });
  },

  upgradeBuildingById: (_buildingId, _instanceId) => {
    // For future implementation if needed (for buildings not on grid)
    console.warn('upgradeBuildingById not yet implemented');
  },

  downgradeBuildingById: (_buildingId, _instanceId) => {
    // For future implementation if needed (for buildings not on grid)
    console.warn('downgradeBuildingById not yet implemented');
  },

  // Максимальное улучшение здания
  maxUpgradeBuildingAt: (coord: import('../core/gameTypes').GridCoord) => {
    set((state) => {
      const tileKey = `${coord.x},${coord.y}`;
      const activePlatformId = state.galaxies.activePlatformId;
      
      // Get building from active platform or main grid
      let buildingId: string | undefined;
      let tileLevels: Record<string, number>;
      let isOnPlatform = false;
      let platformIndex = -1;
      
      if (activePlatformId) {
        platformIndex = state.galaxies.platforms.findIndex(p => p.id === activePlatformId);
        if (platformIndex !== -1) {
          const platform = state.galaxies.platforms[platformIndex];
          buildingId = platform.grid.tiles[tileKey];
          tileLevels = (platform.grid as any).tileLevels || {};
          isOnPlatform = true;
        } else {
          buildingId = state.grid.tiles[tileKey];
          tileLevels = state.grid.tileLevels || {};
        }
      } else {
        buildingId = state.grid.tiles[tileKey];
        tileLevels = state.grid.tileLevels || {};
      }
      
      if (!buildingId) {
        console.warn('No building at this location');
        return state;
      }
      
      let currentLevel = tileLevels[tileKey] || 1;
      
      if (currentLevel >= 500) {
        console.warn('Building is already at max level (500)');
        return state;
      }
      
      const building = state.buildings.find(b => b.id === buildingId);
      if (!building) {
        console.warn('Building definition not found');
        return state;
      }
      
      // Копируем текущие ресурсы для расчётов
      let availableResources = { ...state.resources };
      let availableCredits = state.currency.credits;
      let upgradesPerformed = 0;
      const maxUpgrades = 500 - currentLevel; // Максимально до уровня 500
      
      // Пытаемся улучшать пока хватает ресурсов
      for (let i = 0; i < maxUpgrades; i++) {
        const levelForCost = currentLevel + i;
        const costFactor = Math.pow(1.15, levelForCost);
        let canAfford = true;
        
        // Проверяем ресурсы
        for (const [resource, baseCost] of Object.entries(building.baseCost)) {
          const cost = (baseCost as import('break_eternity.js').default).mul(costFactor);
          const available = availableResources[resource as import('../core/gameTypes').ResourceType]?.amount || D(0);
          
          if (available.lt(cost)) {
            canAfford = false;
            break;
          }
        }
        
        // Проверяем кредиты
        if (canAfford && building.creditCost) {
          const creditCost = building.creditCost.mul(costFactor);
          if (availableCredits.lt(creditCost)) {
            canAfford = false;
          }
        }
        
        // Если не можем позволить, останавливаемся
        if (!canAfford) break;
        
        // Вычитаем ресурсы
        for (const [resource, baseCost] of Object.entries(building.baseCost)) {
          const cost = (baseCost as import('break_eternity.js').default).mul(costFactor);
          const resType = resource as import('../core/gameTypes').ResourceType;
          if (availableResources[resType]) {
            availableResources[resType] = {
              ...availableResources[resType]!,
              amount: availableResources[resType]!.amount.minus(cost),
            };
          }
        }
        
        if (building.creditCost) {
          const creditCost = building.creditCost.mul(costFactor);
          availableCredits = availableCredits.minus(creditCost);
        }
        
        upgradesPerformed++;
      }
      
      // Если не было улучшений, ничего не делаем
      if (upgradesPerformed === 0) {
        console.log('Cannot afford any upgrades');
        return state;
      }
      
      // Применяем улучшения
      const newLevel = currentLevel + upgradesPerformed;
      const newTileLevels = { ...tileLevels, [tileKey]: newLevel };
      
      console.log(`Upgraded building from level ${currentLevel} to ${newLevel} (${upgradesPerformed} upgrades)`);
      
      if (isOnPlatform && platformIndex !== -1) {
        // Update platform grid
        const updatedPlatforms = [...state.galaxies.platforms];
        updatedPlatforms[platformIndex] = {
          ...updatedPlatforms[platformIndex],
          grid: {
            ...updatedPlatforms[platformIndex].grid,
            tileLevels: newTileLevels,
          } as any,
        };
        
        return {
          ...state,
          resources: availableResources,
          currency: {
            ...state.currency,
            credits: availableCredits,
          },
          galaxies: {
            ...state.galaxies,
            platforms: updatedPlatforms,
          },
        };
      }
      
      const updatedGrid = {
        ...state.grid,
        tileLevels: newTileLevels,
      };
      
      const capsMult = computeCapsMultiplier(state.research.levels, state.meta.qubits);
      const updatedResources = recomputeCaps(availableResources, state.buildings, capsMult, newTileLevels, state.grid.tiles);
      
      return {
        ...state,
        resources: updatedResources,
        currency: {
          ...state.currency,
          credits: availableCredits,
        },
        grid: updatedGrid,
      };
    });
  },

  resetGame: () => {
    const now = Date.now();
    const capsMult = computeCapsMultiplier(INITIAL_RESEARCH.levels, INITIAL_META.qubits);
    let resources = recomputeCaps({ ...INITIAL_RESOURCES }, BUILDINGS_WITH_PROXIMITY, capsMult, {}, {});
    let buffers = clampBaseBufferToCaps(DEFAULT_GRID.buffers, resources);
    resources = syncResourcesFromBase(resources, buffers);

    // Создаём полностью новый grid с чистыми tiles
    const freshGrid = {
      ...DEFAULT_GRID,
      tiles: {} as Record<string, string>,
      deposits: generateDeposits(DEFAULT_GRID.width, DEFAULT_GRID.height),
      buffers,
      tileLevels: {} as Record<string, number>,
      tileEvolutionLevels: {} as Record<string, number>,
      tileDisabled: {} as Record<string, boolean>,
      activeTransports: [] as typeof DEFAULT_GRID.activeTransports,
      selected: null,
      selectedBuildId: null,
      highlightedBuildingId: null,
      marketPolicy: {} as typeof DEFAULT_GRID.marketPolicy,
    };

    set({
      resources,
      buildings: BUILDINGS_WITH_PROXIMITY,
      currency: INITIAL_CURRENCY,
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
      grid: freshGrid,
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
      politics: INITIAL_POLITICS,
      galaxies: INITIAL_GALAXIES,
      fleet: INITIAL_FLEET,
      pollution: INITIAL_POLLUTION,
      intergalacticLogistics: INITIAL_INTERGALACTIC_LOGISTICS,
      randomEvents: INITIAL_RANDOM_EVENTS,
      achievements: INITIAL_ACHIEVEMENTS,
      culture: INITIAL_CULTURE,
      maps: INITIAL_MAPS,
      quests: {
        activeQuests: [...STARTER_QUESTS],
        completedQuests: [],
      },
      lastTick: now,
    });
  },

  startNewGame: async () => {
    const state = get();
    
    // Сбрасываем состояние игры
    state.resetGame();
    
    // Сохраняем новую игру на сервер (очищаем текущий save id)
    try {
      await saveCurrentSaveIdToServer(null);
      
      // Очищаем localStorage
      localStorage.removeItem('gameState');
      localStorage.removeItem('currentSaveId');
      
      return { ok: true };
    } catch (error) {
      console.error('Ошибка при создании новой игры:', error);
      return { ok: false, error: 'Не удалось создать новую игру' };
    }
  },

  // =======================================
  // Фаза 8.6: Random Events System
  // =======================================
  
  resolveEvent: (eventId, _choiceId) => {
    set((state) => {
      const event = state.randomEvents.activeEvents.find(e => e.id === eventId);
      if (!event || event.status !== 'pending') return state;
      
      // Применяем эффекты события
      const updatedState = applyEventEffects(state, event);
      
      // Обновляем статус события
      const updatedEvents = state.randomEvents.activeEvents.map(e =>
        e.id === eventId ? { ...e, status: 'resolved' as const } : e
      );
      
      // Добавляем в историю
      const eventHistory = [
        {
          type: event.type,
          timestamp: Date.now(),
          title: event.title,
        },
        ...state.randomEvents.eventHistory,
      ].slice(0, 20); // Храним последние 20
      
      return {
        ...updatedState,
        randomEvents: {
          ...updatedState.randomEvents,
          activeEvents: updatedEvents.filter(e => e.status !== 'resolved'),
          eventHistory,
        },
      };
    });
  },
  
  dismissEvent: (eventId) => {
    set((state) => ({
      randomEvents: {
        ...state.randomEvents,
        activeEvents: state.randomEvents.activeEvents.filter(e => e.id !== eventId),
      },
    }));
  },
  
  toggleRandomEvents: () => {
    set((state) => ({
      randomEvents: {
        ...state.randomEvents,
        eventsEnabled: !state.randomEvents.eventsEnabled,
      },
    }));
  },

  // Фаза 8.7: Система достижений
  unlockAchievement: (achievementId: string) => {
    set((state) => {
      // Check if already unlocked
      if (state.achievements.unlocked[achievementId]) {
        return state;
      }

      const now = Date.now();
      const newUnlocked = {
        ...state.achievements.unlocked,
        [achievementId]: now,
      };

      const newRecentlyUnlocked = [
        ...state.achievements.recentlyUnlocked,
        { achievementId, unlockedAt: now },
      ];

      // Apply achievement rewards
      const achievement = getAchievementById(achievementId);
      let newCurrency = { ...state.currency };
      
      if (achievement?.reward) {
        if (achievement.reward.credits) {
          newCurrency.credits = newCurrency.credits.add(achievement.reward.credits);
        }
        if (achievement.reward.researchPoints) {
          newCurrency.researchPoints = newCurrency.researchPoints.add(achievement.reward.researchPoints);
        }
        if (achievement.reward.influence) {
          newCurrency.influence = newCurrency.influence.add(achievement.reward.influence);
        }
      }

      // Add notification
      const notifications: import('../core/gameTypes').Notification[] = [
        ...state.galaxies.notifications,
        {
          id: `achievement_${achievementId}_${now}`,
          type: 'success' as const,
          title: `🎉 ${achievement?.name || achievementId}`,
          message: `Достижение разблокировано!`,
          timestamp: now,
          read: false,
        },
      ];

      return {
        achievements: {
          ...state.achievements,
          unlocked: newUnlocked,
          recentlyUnlocked: newRecentlyUnlocked,
        },
        currency: newCurrency,
        galaxies: {
          ...state.galaxies,
          notifications,
        },
      };
    });
  },

  // === ФАЗА 9: МЕГАСТРУКТУРЫ И ЭНДГЕЙМ ===

  // Начать строительство мегаструктуры
  startMegastructure: (megastructureId: MegastructureId) => {
    set((state) => {
      const megastructure = MEGASTRUCTURES[megastructureId];
      if (!megastructure) return state;

      /*
       * Политика с флагом unlock_megastructures заменяет собой ТОЛЬКО техгейт: подсовываем
       * canBuildMegastructure карту технологий с закрытым требованием, а кредиты, RP, влияние
       * и ресурсы он по-прежнему проверяет по-настоящему. Сам state.research не трогаем —
       * технология остаётся неисследованной, доступ пропадает вместе с политикой.
       */
      const megaUnlockedByPolicy = aggregatePolicyEffects(state.politics.activePolicies)
        .specialEffects.has('unlock_megastructures');
      const technologies = megaUnlockedByPolicy
        ? { ...state.research.technologies, [megastructure.requiredTechnology]: true }
        : state.research.technologies;

      // Проверка возможности строительства
      const check = canBuildMegastructure(megastructureId, {
        credits: state.currency.credits,
        researchPoints: state.currency.researchPoints,
        influence: state.currency.influence,
        resources: state.resources,
        technologies,
        megastructures: state.megastructures,
      });

      if (!check.canBuild) {
        // Можно добавить уведомление о недостающих ресурсах
        return state;
      }

      // Оплата стоимости
      let newCurrency = {
        ...state.currency,
        credits: state.currency.credits.sub(megastructure.buildCost.credits),
        researchPoints: state.currency.researchPoints.sub(megastructure.buildCost.researchPoints),
        influence: state.currency.influence.sub(megastructure.buildCost.influence),
      };

      let newResources = { ...state.resources };
      let buffers = state.grid.buffers;

      for (const [resType, amount] of Object.entries(megastructure.buildCost.resources)) {
        const type = resType as ResourceType;
        const cur = getBuf(buffers, 'base', type);
        const next = cur.sub(amount).max(D(0));
        buffers = setBuf(buffers, 'base', type, next);
        newResources[type] = { ...newResources[type], amount: next };
      }

      // Добавить в очередь строительства
      const newQueue = [
        ...state.megastructures.constructionQueue,
        {
          megastructureId,
          startedAt: Date.now(),
          progress: 0,
        },
      ];

      // Уведомление
      const notifications: import('../core/gameTypes').Notification[] = [
        ...state.galaxies.notifications,
        {
          id: `megastructure_${megastructureId}_${Date.now()}`,
          type: 'info' as const,
          title: `🏗️ Начато строительство`,
          message: `${megastructure.name} - строительство началось!`,
          timestamp: Date.now(),
          read: false,
        },
      ];

      return {
        currency: newCurrency,
        resources: newResources,
        grid: { ...state.grid, buffers },
        megastructures: {
          ...state.megastructures,
          constructionQueue: newQueue,
        },
        galaxies: {
          ...state.galaxies,
          notifications,
        },
      };
    });
  },

  // Включить/выключить мегаструктуру
  toggleMegastructure: (megastructureId: MegastructureId, active: boolean) => {
    set((state) => {
      const built = state.megastructures.built[megastructureId];
      if (!built) return state;

      const newBuilt = {
        ...state.megastructures.built,
        [megastructureId]: {
          ...built,
          active,
        },
      };

      return {
        megastructures: {
          ...state.megastructures,
          built: newBuilt,
        },
      };
    });
  },

  // Проверить требования для концовки
  checkEndingRequirements: (endingId: EndingId) => {
    set((state) => {
      const result = checkEndingRequirements(endingId, {
        /*
         * These two were hardcoded `[]` and `0` with a TODO, which made two of the four endings
         * mathematically unreachable: `galaxiesControlled` counts `galaxies.filter(g => g.explored)`
         * (always 0 on an empty array) and `civilizationsHelped` is `floor(contracts / 5)`
         * (always 0). Unlocking a galaxy is what "controlling" it means in this game, and
         * completed contracts are now tracked in stats.
         */
        galaxies: state.galaxies.unlockedGalaxies.map((id) => ({ id, explored: true })),
        platforms: state.galaxies.platforms,
        ships: state.fleet.ships,
        megastructures: state.megastructures,
        contracts: state.stats.contractsCompleted,
        technologies: state.research.technologies,
        activePolicies: state.politics.activePolicies,
      });

      // Обновить прогресс концовки
      const newProgress = {
        ...state.endgame.currentEndingProgress,
        [endingId]: result.progress,
      };

      return {
        endgame: {
          ...state.endgame,
          currentEndingProgress: newProgress,
        },
      };
    });
  },

  // Достичь концовки
  achieveEnding: (endingId: EndingId) => {
    set((state) => {
      const endingData = GAME_ENDINGS[endingId];
      if (!endingData) return state;

      // Проверить, выполнены ли требования
      const result = checkEndingRequirements(endingId, {
        /*
         * These two were hardcoded `[]` and `0` with a TODO, which made two of the four endings
         * mathematically unreachable: `galaxiesControlled` counts `galaxies.filter(g => g.explored)`
         * (always 0 on an empty array) and `civilizationsHelped` is `floor(contracts / 5)`
         * (always 0). Unlocking a galaxy is what "controlling" it means in this game, and
         * completed contracts are now tracked in stats.
         */
        galaxies: state.galaxies.unlockedGalaxies.map((id) => ({ id, explored: true })),
        platforms: state.galaxies.platforms,
        ships: state.fleet.ships,
        megastructures: state.megastructures,
        contracts: state.stats.contractsCompleted,
        technologies: state.research.technologies,
        activePolicies: state.politics.activePolicies,
      });

      if (!result.met) {
        // Показать недостающие требования
        const notifications: import('../core/gameTypes').Notification[] = [
          ...state.galaxies.notifications,
          {
            id: `ending_requirements_${endingId}_${Date.now()}`,
            type: 'warning' as const,
            title: `Недостающие требования`,
            message: `${result.missingRequirements.join(', ')}`,
            timestamp: Date.now(),
            read: false,
          },
        ];

        return {
          galaxies: {
            ...state.galaxies,
            notifications,
          },
        };
      }

      // Разблокировать концовку
      const now = Date.now();
      const newEnding: import('../core/gameTypes').GameEnding = {
        ...endingData,
        unlocked: true,
        achievedAt: now,
      };

      const newEndings = {
        ...state.endgame.endings,
        [endingId]: newEnding,
      };

      // Уведомление о победе
      const notifications: import('../core/gameTypes').Notification[] = [
        ...state.galaxies.notifications,
        {
          id: `ending_achieved_${endingId}_${now}`,
          type: 'success' as const,
          title: `🎉 КОНЦОВКА ДОСТИГНУТА!`,
          message: `${endingData.name} - Вы достигли концовки игры!`,
          timestamp: now,
          read: false,
        },
      ];

      return {
        endgame: {
          ...state.endgame,
          endings: newEndings,
          victoryAchieved: true,
          victoryEndingId: endingId,
        },
        galaxies: {
          ...state.galaxies,
          notifications,
        },
      };
    });
  },

  // === ФАЗА 9.3: ПРЕСТИЖ-СИСТЕМА ===

  // Рассчитать сколько Quantum Points игрок получит при престиже
  calculatePrestigeGain: () => {
    const state = get();
    
    // Get artifact bonuses
    const artifactBonuses = calculateArtifactBonuses(
      state.artifacts.discovered,
      state.artifacts.equipped
    );
    
    // Get repeatable bonuses
    const repeatableBonuses = getTotalRepeatableBonuses(state.repeatableResearch.researches);
    
    // Подсчет построенных мегаструктур
    const megastructuresBuilt = Object.keys(state.megastructures.built).length;
    
    // Подсчет достигнутых концовок
    const endingsAchieved = Object.values(state.endgame.endings).filter(e => e.unlocked).length;
    
    const quantumPoints = calculateQuantumPoints({
      totalCreditsEarned: state.prestige.stats.totalCreditsEarned,
      researchPoints: state.currency.researchPoints,
      influence: state.currency.influence,
      megastructuresBuilt,
      endingsAchieved,
      prestigeCount: state.prestige.prestigeCount,
    });
    
    // Apply artifact prestige gain bonus, ascension qpGain multiplier, and repeatable QP bonus
    return Math.floor(quantumPoints * artifactBonuses.prestigeGain * 
      state.ascension.multipliers.qpGain * repeatableBonuses.qpGainMultiplier);
  },

  // Выполнить престиж (сброс прогресса с сохранением улучшений)
  performPrestige: () => {
    set((state) => {
      // Рассчитать получаемые Quantum Points
      const quantumGain = get().calculatePrestigeGain();
      
      if (quantumGain <= 0) {
        // Недостаточно прогресса для престижа
        return state;
      }

      // Сохраняем статистику
      const now = Date.now();
      const playTime = (now - state.lastTick) / 1000;
      const endingsAchieved = Object.values(state.endgame.endings)
        .filter(e => e.unlocked)
        .map(e => e.id);
      
      // Обновляем престиж-статистику
      const newPrestige: import('../core/gameTypes').PrestigeState = {
        ...state.prestige,
        lifetimeQuantumPoints: state.prestige.lifetimeQuantumPoints + quantumGain,
        availableQuantumPoints: state.prestige.availableQuantumPoints + quantumGain,
        prestigeCount: state.prestige.prestigeCount + 1,
        stats: {
          totalPlaytime: state.prestige.stats.totalPlaytime + playTime,
          totalCreditsEarned: state.prestige.stats.totalCreditsEarned.add(state.currency.credits),
          totalResearchPoints: state.prestige.stats.totalResearchPoints.add(state.currency.researchPoints),
          maxBuildingsBuilt: Math.max(
            state.prestige.stats.maxBuildingsBuilt,
            Object.keys(state.grid.tiles).length
          ),
          endingsAchieved: Array.from(new Set([...state.prestige.stats.endingsAchieved, ...endingsAchieved])),
        },
      };

      // Получаем бонусы престижа
      const bonuses = getTotalPrestigeBonuses(newPrestige);
      
      // Сохраняем ресурсы согласно resourceRetention
      const retainedResources: any = {};
      if (bonuses.resourceRetention > 0) {
        const retentionRate = bonuses.resourceRetention / 100;
        for (const [resType, resState] of Object.entries(state.resources)) {
          retainedResources[resType] = {
            ...resState,
            amount: resState.amount.mul(retentionRate),
          };
        }
      }

      // Сбрасываем игру к начальному состоянию, но сохраняем престиж
      const freshState = {
        ...INITIAL_RESOURCES,
        ...retainedResources, // Применяем сохраненные ресурсы
      };

      // Применяем стартовые бонусы (prestige + ascension)
      const startingCredits = INITIAL_CURRENCY.credits
        .add(bonuses.startingCredits)
        .add(state.ascension.multipliers.startingCredits);
      const startingInfluence = INITIAL_CURRENCY.influence.add(bonuses.startingInfluence);

      // Разблокируем технологии Эры 1-3 если куплено улучшение
      let unlockedTechs = { ...INITIAL_RESEARCH.technologies };
      if (newPrestige.upgrades['quantum_tech_unlock']) {
        // Автоматически разблокировать технологии Эры 1-3
        Object.values(TECHNOLOGIES).forEach(tech => {
          if (tech.era <= 3) {
            unlockedTechs[tech.id] = true;
          }
        });
      }

      // Уведомление о престиже
      const notifications: import('../core/gameTypes').Notification[] = [
        {
          id: `prestige_${now}`,
          type: 'success' as const,
          title: `✨ ПРЕСТИЖ!`,
          message: `Вы получили ${quantumGain} Quantum Points! Престиж #${newPrestige.prestigeCount}`,
          timestamp: now,
          read: false,
        },
      ];

      return {
        // Сброс основных систем
        resources: syncResourcesFromBase(freshState, DEFAULT_GRID.buffers),
        buildings: BUILDINGS_WITH_PROXIMITY.map(b => ({ ...b, count: 0 })),
        currency: {
          ...INITIAL_CURRENCY,
          credits: startingCredits,
          influence: startingInfluence,
        },
        market: INITIAL_MARKET,
        combat: INITIAL_COMBAT,
        grid: DEFAULT_GRID,
        research: {
          ...INITIAL_RESEARCH,
          technologies: unlockedTechs,
        },
        demons: INITIAL_DEMONS,
        meta: INITIAL_META,
        expedition: INITIAL_EXPEDITION,
        nanoSwarm: INITIAL_NANO_SWARM,
        ship: INITIAL_SHIP,
        starChart: INITIAL_STAR_CHART,
        aegis: INITIAL_AEGIS,
        productionMatrix: INITIAL_PRODUCTION_MATRIX,
        quantumNet: INITIAL_QUANTUM_NET,
        politics: INITIAL_POLITICS,
        galaxies: {
          ...INITIAL_GALAXIES,
          notifications,
        },
        fleet: INITIAL_FLEET,
        pollution: INITIAL_POLLUTION,
        intergalacticLogistics: INITIAL_INTERGALACTIC_LOGISTICS,
        randomEvents: INITIAL_RANDOM_EVENTS,
        achievements: INITIAL_ACHIEVEMENTS,
        megastructures: INITIAL_MEGASTRUCTURES,
        endgame: INITIAL_ENDGAME,
        
        // Сохраняем престиж
        prestige: newPrestige,
        lastTick: now,
        energyProduction: D(0),
        energyConsumption: D(0),
        energyEfficiency: 1.0,
      };
    });
  },

  // Купить улучшение престижа
  buyPrestigeUpgrade: (upgradeId: PrestigeUpgradeId) => {
    set((state) => {
      const check = canBuyPrestigeUpgrade(upgradeId, state.prestige);
      
      if (!check.canBuy) {
        // Можно добавить уведомление
        return state;
      }

      const upgrade = PRESTIGE_UPGRADES[upgradeId];
      const currentLevel = state.prestige.upgrades[upgradeId] || 0;
      const cost = upgrade.cost * (currentLevel + 1);

      // Проверка для улучшений за концовки.
      // Соответствия «улучшение -> конкретная концовка» в данных нет, поэтому условие такое,
      // каким было по факту: достаточно любой открытой концовки. Прежняя строка выводила из
      // upgradeId «нужную» концовку и никуда её не передавала — проверка была декорацией.
      if (upgrade.category === 'ending') {
        const hasEnding = Object.values(state.endgame.endings).some(e => e.unlocked);
        if (!hasEnding) {
          return state;
        }
      }

      const newUpgrades = {
        ...state.prestige.upgrades,
        [upgradeId]: currentLevel + 1,
      };

      return {
        prestige: {
          ...state.prestige,
          availableQuantumPoints: state.prestige.availableQuantumPoints - cost,
          upgrades: newUpgrades,
        },
      };
    });
  },

  // Переключить быстрый режим
  toggleFastMode: () => {
    set((state) => {
      // Проверяем, куплено ли улучшение
      if (!state.prestige.upgrades['quantum_fast_mode']) {
        return state;
      }

      return {
        prestige: {
          ...state.prestige,
          fastModeEnabled: !state.prestige.fastModeEnabled,
        },
      };
    });
  },

  // ============================================================================
  // Ascension System Methods (infinitely.md Phase 2)
  // ============================================================================

  // Проверить требования для Ascension
  checkAscensionRequirements: () => {
    const state = get();
    const { requirements } = state.ascension;
    
    // Проверяем минимальное количество престижей
    if (state.prestige.prestigeCount < requirements.minPrestigeCount) {
      return false;
    }
    
    // Проверяем минимальное количество QP
    if (state.prestige.lifetimeQuantumPoints < requirements.minQuantumPoints) {
      return false;
    }
    
    // Проверяем все мегаструктуры
    if (requirements.allMegastructures) {
      // Получаем количество доступных мегаструктур и построенных
      const totalMegastructures = Object.keys(MEGASTRUCTURES).length;
      const builtMegastructures = Object.keys(state.megastructures.built).length;
      
      if (builtMegastructures < totalMegastructures) {
        return false;
      }
    }
    
    return true;
  },

  // Рассчитать получаемые Ascension Points
  calculateAscensionGain: () => {
    const state = get();
    const totalQP = state.prestige.lifetimeQuantumPoints;
    
    // Get artifact bonuses
    const artifactBonuses = calculateArtifactBonuses(
      state.artifacts.discovered,
      state.artifacts.equipped
    );
    
    // AP = floor(log10(totalQP)) × ascensionCount
    // Минимум 1 AP за первое вознесение
    const baseAP = Math.max(1, Math.floor(Math.log10(totalQP)));
    const multiplier = state.ascension.ascensionCount + 1;
    
    // Apply artifact ascension points bonus
    return Math.floor(baseAP * multiplier * artifactBonuses.ascensionPoints);
  },

  // Выполнить Ascension
  performAscension: () => {
    set((state) => {
      // Проверяем требования
      if (!get().checkAscensionRequirements()) {
        return state;
      }
      
      const apGain = get().calculateAscensionGain();
      const now = Date.now();
      
      // Обновляем состояние Ascension
      const newAscensionCount = state.ascension.ascensionCount + 1;
      const newAscension: import('../core/gameTypes').AscensionState = {
        ...state.ascension,
        ascensionCount: newAscensionCount,
        ascensionPoints: state.ascension.ascensionPoints + apGain,
        lifetimeAscensionPoints: state.ascension.lifetimeAscensionPoints + apGain,
        
        // Обновляем множители (+50% QP gain, +10% production, +20% research per ascension)
        multipliers: {
          qpGain: 1 + (newAscensionCount * 0.5),
          globalProduction: 1 + (newAscensionCount * 0.1),
          researchSpeed: 1 + (newAscensionCount * 0.2),
          startingCredits: newAscensionCount * 10000,
        },
        
        // Разблокировки
        unlocks: {
          infiniteResearch: newAscensionCount >= 1,
          buildingEvolution: newAscensionCount >= 2,
          proceduralGalaxies: newAscensionCount >= 3,
        },
        
        stats: {
          totalAscensionTime: state.ascension.stats.totalAscensionTime + state.prestige.stats.totalPlaytime,
          fastestAscension: state.ascension.stats.fastestAscension === 0 
            ? state.prestige.stats.totalPlaytime
            : Math.min(state.ascension.stats.fastestAscension, state.prestige.stats.totalPlaytime),
          totalQuantumPointsEarned: state.ascension.stats.totalQuantumPointsEarned + state.prestige.lifetimeQuantumPoints,
        },
      };
      
      // Уведомление
      const notifications: import('../core/gameTypes').Notification[] = [
        {
          id: `ascension_${now}`,
          type: 'success' as const,
          title: `🌟 ВОЗНЕСЕНИЕ!`,
          message: `Вы вознеслись! Получено ${apGain} Ascension Points. Вознесение #${newAscensionCount}`,
          timestamp: now,
          read: false,
        },
      ];
      
      // Полный сброс к начальному состоянию, но сохраняем престиж и вознесение
      return {
        resources: syncResourcesFromBase(INITIAL_RESOURCES, DEFAULT_GRID.buffers),
        buildings: BUILDINGS_WITH_PROXIMITY.map(b => ({ ...b, count: 0 })),
        currency: INITIAL_CURRENCY,
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
        politics: INITIAL_POLITICS,
        galaxies: {
          ...INITIAL_GALAXIES,
          notifications,
        },
        fleet: INITIAL_FLEET,
        pollution: INITIAL_POLLUTION,
        intergalacticLogistics: INITIAL_INTERGALACTIC_LOGISTICS,
        randomEvents: INITIAL_RANDOM_EVENTS,
        achievements: INITIAL_ACHIEVEMENTS,
        megastructures: INITIAL_MEGASTRUCTURES,
        endgame: INITIAL_ENDGAME,
        
        // Сбрасываем престиж (но не Ascension!)
        prestige: INITIAL_PRESTIGE,
        
        // Сохраняем Ascension
        ascension: newAscension,
        
        // Сбрасываем повторяемые исследования, но сохраняем историю
        repeatableResearch: {
          researches: {},
          totalLevelsThisAscension: 0,
          stats: {},
          history: [
            ...state.repeatableResearch.history,
            {
              ascensionNumber: state.ascension.ascensionCount,
              timestamp: now,
              researches: { ...state.repeatableResearch.researches },
              totalLevels: Object.values(state.repeatableResearch.researches).reduce((sum, level) => sum + level, 0),
              stats: { ...state.repeatableResearch.stats },
            },
          ],
        },
        
        // Сохраняем процедурные галактики
        proceduralGalaxies: state.proceduralGalaxies,
        
        // Обновляем артефакты (увеличиваем слоты)
        artifacts: (() => {
          const newMaxSlots = calculateMaxSlots(newAscensionCount);
          const currentUsed = calculateUsedSlots(state.artifacts.discovered, state.artifacts.equipped);
          
          return {
            ...state.artifacts,
            maxSlots: newMaxSlots,
            usedSlots: currentUsed,
          };
        })(),
        
        lastTick: now,
        energyProduction: D(0),
        energyConsumption: D(0),
        energyEfficiency: 1.0,
      };
    });
  },

  // ============================================================================
  // Repeatable Research Methods (infinitely.md Phase 3)
  // ============================================================================

  researchRepeatable: (researchId: import('../core/gameTypes').RepeatableResearchId) => {
    const state = get();
    
    // 1. Проверка разблокировки
    if (!state.ascension.unlocks.infiniteResearch) {
      console.warn('Repeatable research not unlocked yet');
      return;
    }
    
    // 2. Найти исследование
    const research = REPEATABLE_RESEARCHES[researchId];
    if (!research) {
      console.error('Unknown repeatable research:', researchId);
      return;
    }
    
    // 3. Получить текущий уровень
    const currentLevel = state.repeatableResearch.researches[researchId] || 0;
    const maxLevel = getMaxLevelPerAscension(state.ascension.ascensionCount);
    
    // 4. Проверка максимального уровня
    if (currentLevel >= maxLevel) {
      console.log('Max level reached for', researchId);
      return;
    }
    
    // 5. Расчет стоимости
    const cost = calculateRepeatableCost(research.baseCost, currentLevel);
    
    // 6. Проверка ресурсов
    for (const [resourceId, amount] of Object.entries(cost)) {
      if (resourceId === 'credits') {
        if (state.currency.credits.lt(amount)) {
          console.log('Not enough credits');
          return;
        }
      } else if (resourceId === 'quantumPoints') {
        if (state.prestige.availableQuantumPoints < amount) {
          console.log('Not enough quantum points');
          return;
        }
      } else {
        const resource = state.resources[resourceId as import('../core/gameTypes').ResourceType];
        const bufferAmount = getBuf(state.grid.buffers, 'base', resourceId as import('../core/gameTypes').ResourceType);
        if (!resource || bufferAmount.lt(amount)) {
          console.log('Not enough', resourceId);
          return;
        }
      }
    }
    
    /*
     * 7-9. Списание ресурсов, повышение уровня и статистика.
     *
     * Раньше это был `set((draft) => { ...мутации...; })` без return. Без immer-мидлвари draft —
     * сам объект состояния, стрелка возвращала undefined, Zustand делал
     * Object.assign({}, state, undefined) — значения менялись «на месте», но идентичности
     * срезов оставались прежними, поэтому подписчики на state.repeatableResearch /
     * state.currency / state.resources не перерисовывались: игрок покупал уровень и не видел
     * его до следующего тика. Плюс addNotification вызывался как метод draft внутри set,
     * то есть setState во время setState.
     */
    const newLevel = currentLevel + 1;

    set((state) => {
      let nextCurrency = state.currency;
      let nextPrestige = state.prestige;
      let nextBuffers = state.grid.buffers;
      const nextResources = { ...state.resources };
      let resourcesTouched = false;

      for (const [resourceId, amount] of Object.entries(cost)) {
        if (resourceId === 'credits') {
          nextCurrency = { ...nextCurrency, credits: nextCurrency.credits.sub(amount) };
        } else if (resourceId === 'quantumPoints') {
          nextPrestige = {
            ...nextPrestige,
            availableQuantumPoints: nextPrestige.availableQuantumPoints - amount,
          };
        } else {
          const resType = resourceId as import('../core/gameTypes').ResourceType;
          const next = getBuf(nextBuffers, 'base', resType).sub(amount).max(D(0));
          nextBuffers = setBuf(nextBuffers, 'base', resType, next);
          nextResources[resType] = { ...nextResources[resType], amount: next };
          resourcesTouched = true;
        }
      }

      const prevStats = state.repeatableResearch.stats[researchId] ?? {
        totalLevels: 0,
        highestLevel: 0,
        totalSpent: {},
      };
      const totalSpent: Record<string, number> = { ...prevStats.totalSpent };
      for (const [resourceId, amount] of Object.entries(cost)) {
        totalSpent[resourceId] = (totalSpent[resourceId] ?? 0) + amount;
      }

      return {
        currency: nextCurrency,
        prestige: nextPrestige,
        grid: nextBuffers === state.grid.buffers ? state.grid : { ...state.grid, buffers: nextBuffers },
        resources: resourcesTouched ? nextResources : state.resources,
        repeatableResearch: {
          ...state.repeatableResearch,
          researches: { ...state.repeatableResearch.researches, [researchId]: newLevel },
          totalLevelsThisAscension: state.repeatableResearch.totalLevelsThisAscension + 1,
          stats: {
            ...state.repeatableResearch.stats,
            [researchId]: {
              totalLevels: prevStats.totalLevels + 1,
              highestLevel: Math.max(prevStats.highestLevel, newLevel),
              totalSpent,
            },
          },
        },
      };
    });

    // 10. Уведомление — после set(), а не внутри него.
    get().addNotification({
      type: 'success',
      title: '🔬 Исследование завершено',
      message: `${research.name} улучшено до уровня ${newLevel}!`,
    });
  },

  // ============================================================================
  // Building Evolution Methods (infinitely.md Phase 4)
  // ============================================================================

  evolveBuildingAt: (coord: GridCoord) => {
    const state = get();
    
    // 1. Проверяем, разблокирована ли эволюция зданий
    if (!state.ascension.unlocks.buildingEvolution) {
      console.warn('Building evolution not unlocked yet');
      return;
    }
    
    const k = keyOf(coord);

    /*
     * grid.tiles — это Record<string, string>: значение и есть id здания. Прежний код читал
     * его как объект тайла (`tile.type !== 'building'`, затем `tile.buildingId`): у строки
     * нет свойства `type`, поэтому условие срабатывало всегда и эволюция обрывалась здесь
     * же — функция не работала ни разу. Никакого «типа тайла» в модели нет; пустая клетка
     * просто отсутствует в словаре.
     */
    const buildingId = state.grid.tiles[k];

    if (!buildingId) {
      console.error('No building at this coordinate');
      return;
    }

    // 3. Получить определения эволюции
    const evolution = BUILDING_EVOLUTIONS[buildingId];
    
    if (!evolution) {
      console.log('No evolution available for this building');
      return;
    }
    
    // 4. Получить текущий уровень здания и уровень эволюции
    const buildingLevel = state.grid.tileLevels?.[k] || 1;
    const currentEvolutionLevel = state.grid.tileEvolutionLevels?.[k] || 0;
    
    // 5. Найти следующую доступную эволюцию
    const nextEvolution = getNextEvolution(buildingId, currentEvolutionLevel);
    
    if (!nextEvolution) {
      console.log('Max evolution tier reached');
      return;
    }
    
    // 6. Проверить достигнут ли требуемый уровень
    if (buildingLevel < nextEvolution.level) {
      console.log(`Building level ${buildingLevel} is below required ${nextEvolution.level}`);
      return;
    }
    
    // 7. Проверить стоимость эволюции (если она есть)
    if (nextEvolution.cost) {
      const { credits, quantum_points } = nextEvolution.cost;
      
      if (credits && state.currency.credits.lt(credits)) {
        console.log(`Not enough credits for evolution (need ${credits.toString()})`);
        return;
      }
      
      // Quantum Points живут в state.prestige.availableQuantumPoints (число), а не в
      // несуществующем state.quantumPoints (Decimal). Прежний код читал undefined.lt(...)
      // и падал с TypeError до списания — эволюция за QP была недоступна вообще.
      if (quantum_points && state.prestige.availableQuantumPoints < Number(quantum_points)) {
        console.log(`Not enough quantum points for evolution (need ${quantum_points.toString()})`);
        return;
      }
    }

    /*
     * 8. Применить эволюцию.
     *
     * Раньше здесь был `set((draft) => { ...мутации draft...; })` без return. В этом сторе нет
     * immer-мидлвари, поэтому draft — это сам живой объект состояния: стрелка возвращала
     * undefined, Zustand делал Object.assign({}, state, undefined), и идентичности вложенных
     * срезов не менялись — подписчики на state.grid / state.currency не перерисовывались.
     * Плюс draft.eventLog и draft.buildingEvolutionStats не существуют в GameState, так что
     * eventLog.unshift(...) бросал TypeError уже ПОСЛЕ списания кредитов.
     * Теперь это нормальное иммутабельное обновление, а событие уходит в существующую
     * систему уведомлений.
     */
    set((state) => {
      const cost = nextEvolution.cost;

      const nextCurrency = cost?.credits
        ? { ...state.currency, credits: state.currency.credits.sub(cost.credits) }
        : state.currency;

      const nextPrestige = cost?.quantum_points
        ? {
            ...state.prestige,
            availableQuantumPoints:
              state.prestige.availableQuantumPoints - Number(cost.quantum_points),
          }
        : state.prestige;

      const levels = { ...(state.grid.tileEvolutionLevels ?? {}) };
      levels[k] = (levels[k] ?? 0) + 1;

      return {
        currency: nextCurrency,
        prestige: nextPrestige,
        grid: { ...state.grid, tileEvolutionLevels: levels },
      };
    });

    get().addNotification({
      type: 'success',
      title: 'Эволюция здания',
      message: `🌟 ${nextEvolution.nameRu || nextEvolution.name}! Множитель ×${nextEvolution.multiplier}`,
    });

    console.log(`✨ Building evolved to: ${nextEvolution.name} (×${nextEvolution.multiplier})`);
  },

  // ============================================================================
  // Building Management Methods (Phase 11: Building Disable/Enable)
  // ============================================================================

  toggleBuildingDisabled: (coord: GridCoord) => {
    set((state) => {
      const k = keyOf(coord);
      const buildingId = state.grid.tiles[k];
      
      if (!buildingId) {
        console.warn('No building at this coordinate');
        return state;
      }
      
      // Проверяем, можно ли отключить это здание
      if (!isBuildingDisableable(buildingId)) {
        console.warn(`Building ${buildingId} cannot be disabled`);
        return state;
      }
      
      // Инициализируем tileDisabled если его нет
      const tileDisabled = { ...(state.grid.tileDisabled || {}) };
      
      // Переключаем состояние
      const currentState = tileDisabled[k] || false;
      tileDisabled[k] = !currentState;
      
      // Возвращаем обновленное состояние
      return {
        ...state,
        grid: {
          ...state.grid,
          tileDisabled,
        },
      };
    });
  },

  // ============================================================================
  // Procedural Galaxies Methods (infinitely.md Phase 5)
  // ============================================================================

  generateProceduralGalaxy: () => {
    set((state) => {
      // Проверяем, разблокированы ли процедурные галактики
      if (!state.ascension.unlocks.proceduralGalaxies) {
        return state;
      }
      
      // Определяем номер следующей галактики
      const nextGalaxyNumber = 8 + state.proceduralGalaxies.galaxies.length;
      
      // Проверяем стоимость открытия
      const cost = getDiscoveryCost(nextGalaxyNumber);
      if (state.currency.credits.lt(cost)) {
        return state; // Недостаточно кредитов
      }
      
      // Генерируем новую галактику
      const newGalaxy = generateGalaxy(state.proceduralGalaxies.currentSeed, nextGalaxyNumber);
      
      // Вычитаем стоимость
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
  },

  exploreProceduralGalaxy: (galaxyNumber: number) => {
    // Collected inside set() and dispatched after it — addNotification inside a Zustand
    // updater would be setState-during-setState.
    const queued: Array<{ type: 'success' | 'info'; title: string; message: string }> = [];

    set((state) => {
      // Находим галактику
      const galaxyIndex = state.proceduralGalaxies.galaxies.findIndex(
        g => g.galaxyNumber === galaxyNumber
      );
      
      if (galaxyIndex === -1 || state.proceduralGalaxies.galaxies[galaxyIndex].discovered) {
        return state; // Галактика не найдена или уже открыта
      }
      
      // Отмечаем галактику как открытую
      const updatedGalaxies = [...state.proceduralGalaxies.galaxies];
      updatedGalaxies[galaxyIndex] = {
        ...updatedGalaxies[galaxyIndex],
        discovered: true,
      };
      
      // Проверяем шанс выпадения артефакта
      let newArtifacts = state.artifacts;
      const shouldDrop = shouldDropArtifactFromGalaxy(galaxyNumber);
      
      if (shouldDrop) {
        const artifact = generateGalaxyArtifact(galaxyNumber);
        newArtifacts = {
          ...state.artifacts,
          discovered: [...state.artifacts.discovered, artifact],
          totalFound: state.artifacts.totalFound + 1,
        };
        
        // `state.eventLog` does not exist on GameState, so this threw a TypeError and the
        // whole galaxy-exploration update was abandoned mid-flight: the artifact was rolled
        // but neither it nor the galaxy discovery was ever committed.
        queued.push({
          type: 'success' as const,
          title: 'Артефакт найден',
          message: `🎁 Галактика ${galaxyNumber}: ${artifact.name}!`,
        });
      }
      
      queued.push({
        type: 'info' as const,
        title: 'Галактика исследована',
        message: `🌌 ${updatedGalaxies[galaxyIndex].generated.name}`,
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

    for (const n of queued) get().addNotification(n);
  },

  // ============================================================================
  // Artifact System Methods (infinitely.md Phase 6)
  // ============================================================================
  
  equipArtifact: (artifactId: string) => {
    set((state) => {
      const artifact = state.artifacts.discovered.find(a => a.id === artifactId);
      if (!artifact) return state;
      
      // Проверяем, не экипирован ли уже
      if (state.artifacts.equipped.includes(artifactId)) return state;
      
      // Проверяем доступность слотов
      import('../utils/artifactHelpers').then(({ calculateUsedSlots }) => {
        const currentUsed = calculateUsedSlots(state.artifacts.discovered, state.artifacts.equipped);
        if (currentUsed + artifact.slotsRequired > state.artifacts.maxSlots) {
          state.addNotification({
            // Здесь и ниже: 'error' в union'е Notification нет (attack/warning/success/info),
            // ближайший по смыслу уровень — 'warning'. Красный тост с 'error' живёт в другой
            // системе (utils/notifications), у неё свой набор типов.
            type: 'warning',
            title: 'Недостаточно слотов',
            message: `Артефакт требует ${artifact.slotsRequired} слотов, доступно ${state.artifacts.maxSlots - currentUsed}`,
          });
          return;
        }
        
        set({
          artifacts: {
            ...state.artifacts,
            equipped: [...state.artifacts.equipped, artifactId],
            usedSlots: currentUsed + artifact.slotsRequired,
          },
        });
      });
      
      return state;
    });
  },
  
  unequipArtifact: (artifactId: string) => {
    set((state) => {
      const artifact = state.artifacts.discovered.find(a => a.id === artifactId);
      if (!artifact) return state;
      
      import('../utils/artifactHelpers').then(({ calculateUsedSlots }) => {
        const newEquipped = state.artifacts.equipped.filter(id => id !== artifactId);
        const newUsed = calculateUsedSlots(state.artifacts.discovered, newEquipped);
        
        set({
          artifacts: {
            ...state.artifacts,
            equipped: newEquipped,
            usedSlots: newUsed,
          },
        });
      });
      
      return state;
    });
  },
  
  upgradeArtifact: (artifactId: string) => {
    set((state) => {
      const artifactIndex = state.artifacts.discovered.findIndex(a => a.id === artifactId);
      if (artifactIndex === -1) return state;
      
      const artifact = state.artifacts.discovered[artifactIndex];
      
      // Проверяем макс уровень
      if (artifact.level >= artifact.maxLevel) {
        state.addNotification({
          type: 'warning',
          title: 'Максимальный уровень',
          message: 'Артефакт достиг максимального уровня',
        });
        return state;
      }
      
      import('../utils/artifactHelpers').then(({ getUpgradeCost }) => {
        const cost = getUpgradeCost(artifact);
        
        // Проверяем стоимость
        if (state.currency.credits.lt(cost.credits)) {
          state.addNotification({
            type: 'warning',
            title: 'Недостаточно кредитов',
            message: `Требуется ${cost.credits.toFixed(0)} кредитов`,
          });
          return;
        }
        
        if (cost.qp && state.prestige.availableQuantumPoints < cost.qp.toNumber()) {
          state.addNotification({
            type: 'warning',
            title: 'Недостаточно QP',
            message: `Требуется ${cost.qp.toFixed(0)} квантовых очков`,
          });
          return;
        }
        
        if (cost.ap && state.ascension.ascensionPoints < cost.ap.toNumber()) {
          state.addNotification({
            type: 'warning',
            title: 'Недостаточно AP',
            message: `Требуется ${cost.ap.toFixed(0)} очков вознесения`,
          });
          return;
        }
        
        // Списываем ресурсы и улучшаем артефакт
        const updatedArtifacts = [...state.artifacts.discovered];
        updatedArtifacts[artifactIndex] = {
          ...artifact,
          level: artifact.level + 1,
        };
        
        set({
          currency: {
            ...state.currency,
            credits: state.currency.credits.sub(cost.credits),
          },
          prestige: cost.qp ? {
            ...state.prestige,
            availableQuantumPoints: state.prestige.availableQuantumPoints - cost.qp.toNumber(),
          } : state.prestige,
          ascension: cost.ap ? {
            ...state.ascension,
            ascensionPoints: state.ascension.ascensionPoints - cost.ap.toNumber(),
          } : state.ascension,
          artifacts: {
            ...state.artifacts,
            discovered: updatedArtifacts,
            totalUpgraded: state.artifacts.totalUpgraded + 1,
          },
        });
        
        state.addNotification({
          type: 'success',
          title: 'Артефакт улучшен',
          message: `${artifact.name} улучшен до уровня ${artifact.level + 1}`,
        });
      });
      
      return state;
    });
  },

  // ============================================================================
  // Daily Rewards & Retention Methods (infinitely.md - Retention Mechanics)
  // ============================================================================

  // Проверить и обновить daily login при загрузке
  checkAndUpdateDailyLogin: () => {
    set((state) => {
      import('../utils/dailyRewardsHelpers').then(({ 
        updateDailyLogin, 
        generateDailyRewardsCalendar,
        updateTimeBasedRewards
      }) => {
        let dailyLogin = state.retention.dailyLogin;
        
        // Первый вход - создаём календарь
        if (dailyLogin.rewards.length === 0) {
          dailyLogin = {
            ...dailyLogin,
            rewards: generateDailyRewardsCalendar(),
            lastLoginDate: '',
          };
        }
        
        // Обновляем daily login
        dailyLogin = updateDailyLogin(dailyLogin);
        
        // Обновляем time-based rewards
        const timeBasedRewards = updateTimeBasedRewards(
          state.retention.timeBasedRewards,
          Date.now()
        );
        
        // Обновляем статистику
        const stats = {
          ...state.retention.stats,
          sessionsCount: state.retention.stats.sessionsCount + 1,
          currentSessionStart: Date.now(),
        };
        
        set({
          retention: {
            dailyLogin,
            timeBasedRewards,
            stats,
          },
        });
      });
      
      return state;
    });
  },

  // Собрать награду за день
  claimDailyReward: (day: number) => {
    set((state) => {
      import('../utils/dailyRewardsHelpers').then(({ 
        canClaimDailyReward,
        claimDailyReward 
      }) => {
        if (!canClaimDailyReward(state.retention.dailyLogin, day)) {
          state.addNotification({
            type: 'warning',
            title: 'Недоступно',
            message: 'Эта награда уже собрана или ещё недоступна',
          });
          return;
        }
        
        const reward = state.retention.dailyLogin.rewards.find(r => r.day === day);
        if (!reward) return;
        
        // Начисляем награды
        let newCurrency = { ...state.currency };
        let newGrid = { ...state.grid };
        
        if (reward.rewards.credits) {
          newCurrency.credits = newCurrency.credits.add(reward.rewards.credits);
        }
        if (reward.rewards.researchPoints) {
          newCurrency.researchPoints = newCurrency.researchPoints.add(reward.rewards.researchPoints);
        }
        if (reward.rewards.influence) {
          newCurrency.influence = newCurrency.influence.add(reward.rewards.influence);
        }
        
        // Ресурсы
        if (reward.rewards.resources) {
          for (const [resType, amount] of Object.entries(reward.rewards.resources)) {
            const type = resType as ResourceType;
            const cur = getBuf(newGrid.buffers, 'base', type);
            const newAmount = cur.add(amount);
            newGrid = {
              ...newGrid,
              buffers: setBuf(newGrid.buffers, 'base', type, newAmount),
            };
          }
        }
        
        // Обновляем статус награды
        const updatedDailyLogin = claimDailyReward(state.retention.dailyLogin, day);
        
        set({
          currency: newCurrency,
          grid: newGrid,
          retention: {
            ...state.retention,
            dailyLogin: updatedDailyLogin,
          },
        });
        
        state.addNotification({
          type: 'success',
          title: `Награда за день ${day} получена!`,
          message: `🎁 Стрик: ${state.retention.dailyLogin.currentStreak} дней`,
        });
      });
      
      return state;
    });
  },

  // Собрать time-based reward
  collectTimeBasedReward: (rewardId: string) => {
    set((state) => {
      const reward = state.retention.timeBasedRewards.containers.find(r => r.id === rewardId);
      if (!reward || reward.collected) return state;
      
      // Начисляем награды
      let newCurrency = { ...state.currency };
      let newGrid = { ...state.grid };
      
      if (reward.rewards.credits) {
        newCurrency.credits = newCurrency.credits.add(reward.rewards.credits);
      }
      if (reward.rewards.researchPoints) {
        newCurrency.researchPoints = newCurrency.researchPoints.add(reward.rewards.researchPoints);
      }
      
      // Ресурсы
      if (reward.rewards.resources) {
        for (const [resType, amount] of Object.entries(reward.rewards.resources)) {
          const type = resType as ResourceType;
          const cur = getBuf(newGrid.buffers, 'base', type);
          const newAmount = cur.add(amount);
          newGrid = {
            ...newGrid,
            buffers: setBuf(newGrid.buffers, 'base', type, newAmount),
          };
        }
      }
      
      // Отмечаем как собранное
      const updatedContainers = state.retention.timeBasedRewards.containers.map(r =>
        r.id === rewardId ? { ...r, collected: true } : r
      );
      
      set({
        currency: newCurrency,
        grid: newGrid,
        retention: {
          ...state.retention,
          timeBasedRewards: {
            ...state.retention.timeBasedRewards,
            containers: updatedContainers,
          },
        },
      });
      
      state.addNotification({
        type: 'success',
        title: 'Контейнер получен!',
        message: '📦 Ресурсы добавлены',
      });
      
      return state;
    });
  },

  // ============================================================================
  // Signal Interception Methods (infinitely.md - Active Play Bonuses)
  // ============================================================================
  
  /**
   * Обрабатывает спавн нового сигнала
   */
  spawnNewSignal: () => {
    set((state) => {
      if (!shouldSpawnSignal(state.signalInterception)) {
        return state;
      }
      
      // Получаем текущее производство для расчёта наград
      const currentProduction: Partial<Record<ResourceType, Decimal>> = {};
      for (const [type, resState] of Object.entries(state.resources)) {
        // Поля perSecond у ResourceState нет — выработка за секунду лежит в `production`.
        // Прежний код клал сюда undefined, и награда за сигнал считалась от нулевого дохода.
        currentProduction[type as ResourceType] = resState.production;
      }
      
      const newSignal = spawnSignal(currentProduction);
      const nextTime = calculateNextSignalTime(state.signalInterception.signalFrequency);
      
      set({
        signalInterception: {
          ...state.signalInterception,
          activeSignal: newSignal,
          nextSignalAt: nextTime,
        },
      });
      
      return state;
    });
  },
  
  /**
   * Обрабатывает клик по сигналу
   */
  claimSignal: (signalId: string) => {
    set((state) => {
      const signal = state.signalInterception.activeSignal;
      
      if (!signal || signal.id !== signalId || signal.claimed) {
        return state;
      }
      
      // Проверяем, не истёк ли сигнал
      if (isSignalExpired(signal)) {
        // Сигнал истёк - не получаем награду
        set({
          signalInterception: {
            ...state.signalInterception,
            activeSignal: null,
            totalSignalsMissed: state.signalInterception.totalSignalsMissed + 1,
          },
        });
        
        state.addNotification({
          type: 'warning',
          title: 'Сигнал потерян!',
          message: 'Вы не успели перехватить сигнал 😢',
        });
        
        return state;
      }
      
      // Применяем награду
      const { reward } = signal;
      let newCurrency = { ...state.currency };
      let newGrid = { ...state.grid };
      let newBoosts = [...state.signalInterception.activeBoosts];
      
      // Мгновенные награды
      if (reward.type === 'resources' || reward.type === 'instant') {
        if (reward.credits) {
          newCurrency.credits = newCurrency.credits.add(reward.credits);
        }
        if (reward.researchPoints) {
          newCurrency.researchPoints = newCurrency.researchPoints.add(reward.researchPoints);
        }
        if (reward.darkMatter) {
          // Тёмная материя — ресурс (dark_matter в буфере базы), а не валюта: в CurrencyState
          // есть только credits/researchPoints/influence. Прежняя строка читала undefined и
          // роняла выдачу награды на .add() ещё до того, как сигнал закрывался.
          const cur = getBuf(newGrid.buffers, 'base', 'dark_matter');
          newGrid = {
            ...newGrid,
            buffers: setBuf(newGrid.buffers, 'base', 'dark_matter', cur.add(reward.darkMatter)),
          };
        }
        if (reward.resources) {
          for (const [resType, amount] of Object.entries(reward.resources)) {
            const type = resType as ResourceType;
            const cur = getBuf(newGrid.buffers, 'base', type);
            const newAmount = cur.add(amount);
            newGrid = {
              ...newGrid,
              buffers: setBuf(newGrid.buffers, 'base', type, newAmount),
            };
          }
        }
      }
      
      // Бусты
      if (reward.type === 'boost') {
        const boost = createBoostFromReward(signal);
        if (boost) {
          newBoosts.push(boost);
        }
      }
      
      // Обновляем состояние
      set({
        currency: newCurrency,
        grid: newGrid,
        signalInterception: {
          ...state.signalInterception,
          activeSignal: { ...signal, claimed: true },
          activeBoosts: newBoosts,
          totalSignalsCaught: state.signalInterception.totalSignalsCaught + 1,
        },
      });
      
      // Через небольшую задержку убираем сигнал
      setTimeout(() => {
        set((state) => ({
          signalInterception: {
            ...state.signalInterception,
            activeSignal: null,
          },
        }));
      }, 1000);
      
      state.addNotification({
        type: 'success',
        title: 'Сигнал перехвачен! 🎯',
        message: getSignalRewardDescription(reward),
      });
      
      return state;
    });
  },
  
  /**
   * Обновляет состояние сигналов (удаляет истёкшие бусты и сигналы)
   */
  updateSignals: () => {
    set((state) => {
      // Удаляем истёкшие бусты
      const activeBoosts = removeExpiredBoosts(state.signalInterception.activeBoosts);
      
      // Проверяем истёкший сигнал
      let activeSignal = state.signalInterception.activeSignal;
      let totalMissed = state.signalInterception.totalSignalsMissed;
      
      if (activeSignal && !activeSignal.claimed && isSignalExpired(activeSignal)) {
        // Сигнал истёк и не был собран
        activeSignal = null;
        totalMissed += 1;
      }
      
      set({
        signalInterception: {
          ...state.signalInterception,
          activeSignal,
          activeBoosts,
          totalSignalsMissed: totalMissed,
        },
      });
      
      return state;
    });
  },
  
  /**
   * Переключает систему сигналов
   */
  toggleSignals: (enabled: boolean) => {
    set((state) => ({
      signalInterception: {
        ...state.signalInterception,
        signalsEnabled: enabled,
      },
    }));
  },

  // =======================================
  // Quest System
  // =======================================
  
  updateQuestProgress: (questId: string, amount: number) => {
    set((state) => {
      const quest = state.quests.activeQuests.find(q => q.id === questId);
      if (!quest || quest.isCompleted) return state;
      
      const newCurrentAmount = (quest.currentAmount || 0) + amount;
      const isNowCompleted = quest.targetAmount ? newCurrentAmount >= quest.targetAmount : newCurrentAmount >= 1;
      
      return {
        quests: {
          ...state.quests,
          activeQuests: state.quests.activeQuests.map(q => 
            q.id === questId
              ? { ...q, currentAmount: newCurrentAmount, isCompleted: isNowCompleted }
              : q
          ),
        },
      };
    });
  },

  claimQuestReward: (questId: string) => {
    set((state) => {
      const quest = state.quests.activeQuests.find(q => q.id === questId);
      if (!quest || !quest.isCompleted) return state;
      
      // Выдаем награды
      let newState = { ...state };
      
      if (quest.reward.credits) {
        newState.currency = {
          ...newState.currency,
          credits: newState.currency.credits.add(D(quest.reward.credits)),
        };
      }
      
      if (quest.reward.researchPoints) {
        newState.currency = {
          ...newState.currency,
          researchPoints: newState.currency.researchPoints.add(D(quest.reward.researchPoints)),
        };
      }
      
      if (quest.reward.influence) {
        newState.currency = {
          ...newState.currency,
          influence: newState.currency.influence.add(D(quest.reward.influence)),
        };
      }
      
      if (quest.reward.resources) {
        for (const [resType, amount] of Object.entries(quest.reward.resources)) {
          const type = resType as ResourceType;
          const res = newState.resources[type];
          const cur = getBuf(newState.grid.buffers, 'base', type);
          const cappedNext = cur.add(D(amount)).min(res.max);
          const nextBuffers = setBuf(newState.grid.buffers, 'base', type, cappedNext);
          
          newState = {
            ...newState,
            grid: { ...newState.grid, buffers: nextBuffers },
            resources: {
              ...newState.resources,
              [type]: { ...res, amount: cappedNext },
            },
          };
        }
      }
      
      // Убираем квест из активных и добавляем в завершенные
      return {
        ...newState,
        quests: {
          activeQuests: newState.quests.activeQuests.filter(q => q.id !== questId),
          completedQuests: [...newState.quests.completedQuests, questId],
        },
      };
    });
  },

  activateQuest: (questId: string) => {
    set((state) => {
      const quest = state.quests.activeQuests.find(q => q.id === questId);
      if (!quest) return state;
      
      return {
        quests: {
          ...state.quests,
          activeQuests: state.quests.activeQuests.map(q =>
            q.id === questId ? { ...q, isActive: true } : q
          ),
        },
      };
    });
  },

  // Map system actions (Phase 4)
  selectMap: (mapId: MapId) => {
    set((state) => ({
      maps: {
        ...state.maps,
        currentMapId: mapId,
      },
    }));
  },

  startMap: (mapId: MapId) => {
    set((state) => {
      // Проверяем, разблокирована ли карта
      if (!state.maps.unlockedMaps.includes(mapId)) {
        return state;
      }
      
      const mapDef = getMapDefinition(mapId);
      if (!mapDef) return state;

      // Генерируем новый seed для карты
      const newSeed = Date.now();
      
      // Генерируем данные карты
      const mapData = generateMap(mapDef, newSeed);

      // Получаем размеры карты
      const { width, height } = mapDef.gridDimensions;

      // Генерируем депозиты для новой карты на основе доступных ресурсов
      const newDeposits: Record<string, DepositType> = {};
      const availableDeposits = mapDef.availableDeposits.filter(d => 
        ['ore', 'ice', 'carbon', 'natural_gas', 'oil', 'sand', 'uranium', 'chrome', 'titanium', 'copper'].includes(d)
      ) as DepositType[];
      
      // Базовая позиция в центре
      const baseX = Math.floor(width / 2);
      const baseY = Math.floor(height / 2);
      
      // Генерируем депозиты с учётом плотности карты
      const depositCount = Math.floor(width * height * mapDef.depositDensity);
      const seededRandom = (seed: number) => {
        const x = Math.sin(seed) * 10000;
        return x - Math.floor(x);
      };
      
      let seedCounter = newSeed;
      for (let i = 0; i < depositCount && availableDeposits.length > 0; i++) {
        const x = Math.floor(seededRandom(seedCounter++) * width);
        const y = Math.floor(seededRandom(seedCounter++) * height);
        const key = `${x},${y}`;
        
        // Не ставим депозит на базу
        if (x === baseX && y === baseY) continue;
        if (newDeposits[key]) continue;
        
        const depositIndex = Math.floor(seededRandom(seedCounter++) * availableDeposits.length);
        newDeposits[key] = availableDeposits[depositIndex];
      }

      // Сбрасываем ресурсы и устанавливаем только стартовые ресурсы карты
      const newResources = { ...state.resources };
      const newBuffers: typeof state.grid.buffers = { base: {} };
      
      // Сначала обнуляем все ресурсы
      for (const resType of Object.keys(newResources) as ResourceType[]) {
        if (newResources[resType]) {
          newResources[resType] = {
            ...newResources[resType],
            amount: D(0),
          };
        }
      }
      
      // Затем устанавливаем только стартовые ресурсы карты
      if (mapDef.startingResources) {
        for (const [resType, amount] of Object.entries(mapDef.startingResources)) {
          const type = resType as ResourceType;
          if (newResources[type]) {
            const startAmount = D(amount);
            // Если стартовое значение больше max, увеличиваем max
            const newMax = startAmount.gt(newResources[type].max) 
              ? startAmount 
              : newResources[type].max;
            
            newResources[type] = {
              ...newResources[type],
              amount: startAmount,
              max: newMax,
            };
            
            newBuffers.base![type] = startAmount.toString();
          }
        }
      }
      
      // Устанавливаем только стартовые кредиты карты (не добавляем к текущим)
      const newCurrency = {
        ...state.currency,
        credits: D(mapDef.startingCredits),
      };
      
      // Сбрасываем боевое состояние для новой карты
      const isPeaceful = mapDef.modifiers.includes('peaceful');
      const newCombat = {
        ...state.combat,
        enemies: [], // Убираем всех врагов
        waveEndsAt: 0,
        nextWaveAt: isPeaceful ? Date.now() + 999999999 : Date.now() + WAVE_INTERVAL_SECONDS * 1000,
      };

      /*
       * generateMap отдаёт «сырую» карту (GeneratedMap: тайлы, депозиты, позиция базы) — это
       * материал для сетки, а не запись о партии. В state.maps.activeMapData лежит
       * GeneratedMapData: чем игрок сейчас занят и с какими модификаторами. Раньше сюда клали
       * сырую карту целиком, и всё, что читает activeMapData (модификаторы, статистика,
       * события карты), получало undefined.
       */
      const activeMapData: GeneratedMapData = {
        mapId,
        startedAt: Date.now(),
        gridType: mapData.gridType,
        gridDimensions: { width, height },
        modifiers: mapDef.modifiers,
        activeEvents: [],
        discoveredArtifacts: [],
        stats: {
          buildingsPlaced: 0,
          resourcesProduced: 0,
          enemiesDefeated: 0,
          eventsTriggered: 0,
        },
      };

      return {
        maps: {
          ...state.maps,
          currentMapId: mapId,
          activeMapData,
          mapSeed: newSeed,
          currentEvent: null,
        },
        grid: {
          ...state.grid,
          width,
          height,
          deposits: newDeposits,
          tiles: {}, // Очищаем постройки для новой карты
          tileLevels: {},
          tileEvolutionLevels: {},
          tileDisabled: {},
          buffers: newBuffers,
        },
        resources: newResources,
        currency: newCurrency,
        combat: newCombat,
      };
    });
  },

  completeMap: () => {
    set((state) => {
      const { currentMapId, mapProgress } = state.maps;
      if (!currentMapId) return state;

      // Обновляем прогресс
      const progress = mapProgress[currentMapId] || { completions: 0, bestTime: null, discovered: true };
      
      // Следующая карта для разблокировки
      const mapOrder = ['map_training_ground', 'map_barren_moon', 'map_crystal_caves', 'map_volcanic_world', 'map_ice_giant', 'map_toxic_swamp', 'map_asteroid_belt', 'map_ancient_ruins'];
      const currentIndex = mapOrder.indexOf(currentMapId);
      const nextMapId = mapOrder[currentIndex + 1];

      return {
        maps: {
          ...state.maps,
          mapProgress: {
            ...mapProgress,
            [currentMapId]: {
              ...progress,
              completions: progress.completions + 1,
            },
          },
          unlockedMaps: nextMapId && !state.maps.unlockedMaps.includes(nextMapId as any)
            ? [...state.maps.unlockedMaps, nextMapId as import('../core/gameTypes.maps').MapId]
            : state.maps.unlockedMaps,
          activeMapData: null,
        },
      };
    });
  },

  abandonMap: () => {
    set((state) => ({
      maps: {
        ...state.maps,
        activeMapData: null,
        currentEvent: null,
      },
    }));
  },

  triggerMapEvent: () => {
    set((state) => {
      const { currentMapId, activeMapData } = state.maps;
      if (!currentMapId || !activeMapData) return state;

      const mapDef = getMapDefinition(currentMapId);
      
      if (!mapDef?.specialEvents?.length) return state;

      // Случайно выбираем событие
      const event = mapDef.specialEvents[Math.floor(Math.random() * mapDef.specialEvents.length)];

      return {
        maps: {
          ...state.maps,
          currentEvent: event.id,
          eventHistory: [...state.maps.eventHistory, event.id],
        },
      };
    });
  },

  // ═══════════════════════════════════════════════════════════════
  // ФАЗА 5: ПРОДВИНУТЫЕ НАСТРОЙКИ ЗДАНИЙ
  // ═══════════════════════════════════════════════════════════════

  /**
   * Получить или создать настройки для тайла
   */
  getTileSettings: (tileKey: string): TileBuildingSettings | null => {
    const state = get();
    const buildingId = state.grid.tiles[tileKey];
    if (!buildingId) return null;

    // grid.tileSettings опционален (появился в «Фазе 5»), у сейвов до неё его просто нет —
    // отсюда и здесь, и во всех сеттерах ниже обращение через ?. с откатом на дефолт.
    const existing = state.grid.tileSettings?.[tileKey];
    if (existing) return existing;

    // Создаём дефолтные настройки
    return createDefaultTileSettings(tileKey, buildingId);
  },

  /**
   * Обновить настройки тайла
   */
  updateTileSettings: (tileKey: string, updates: Partial<TileBuildingSettings>) => {
    set((state) => {
      const buildingId = state.grid.tiles[tileKey];
      if (!buildingId) return state;

      const existing = state.grid.tileSettings?.[tileKey] 
        ?? createDefaultTileSettings(tileKey, buildingId);

      return {
        grid: {
          ...state.grid,
          tileSettings: {
            ...state.grid.tileSettings,
            [tileKey]: {
              ...existing,
              ...updates,
            },
          },
        },
      };
    });
  },

  /**
   * Установить режим работы здания
   */
  setBuildingMode: (tileKey: string, mode: BuildingMode) => {
    const updateTileSettings = get().updateTileSettings;
    updateTileSettings(tileKey, { mode });
  },

  /**
   * Включить/выключить здание
   */
  setBuildingEnabled: (tileKey: string, enabled: boolean) => {
    const updateTileSettings = get().updateTileSettings;
    updateTileSettings(tileKey, { enabled });
    
    // Также обновляем старый tileDisabled для совместимости
    set((state) => ({
      grid: {
        ...state.grid,
        tileDisabled: {
          ...state.grid.tileDisabled,
          [tileKey]: !enabled,
        },
      },
    }));
  },

  /**
   * Установить приоритет входящего ресурса
   */
  setInputPriority: (tileKey: string, resource: ResourceType, priority: ResourcePriority) => {
    set((state) => {
      const buildingId = state.grid.tiles[tileKey];
      if (!buildingId) return state;

      const existing = state.grid.tileSettings?.[tileKey] 
        ?? createDefaultTileSettings(tileKey, buildingId);

      return {
        grid: {
          ...state.grid,
          tileSettings: {
            ...state.grid.tileSettings,
            [tileKey]: {
              ...existing,
              inputPriorities: {
                ...existing.inputPriorities,
                [resource]: priority,
              },
            },
          },
        },
      };
    });
  },

  /**
   * Установить приоритет выходящего ресурса
   */
  setOutputPriority: (tileKey: string, priority: ResourcePriority) => {
    const updateTileSettings = get().updateTileSettings;
    updateTileSettings(tileKey, { outputPriority: priority });
  },

  /**
   * Добавить/обновить конфигурацию авто-продажи
   */
  updateAutoSell: (tileKey: string, config: AutoSellConfig) => {
    set((state) => {
      const buildingId = state.grid.tiles[tileKey];
      if (!buildingId) return state;

      const existing = state.grid.tileSettings?.[tileKey] 
        ?? createDefaultTileSettings(tileKey, buildingId);

      // Ищем существующий конфиг для этого ресурса
      const autoSell = [...existing.autoSell];
      const idx = autoSell.findIndex(c => c.resource === config.resource);
      
      if (idx >= 0) {
        autoSell[idx] = config;
      } else {
        autoSell.push(config);
      }

      return {
        grid: {
          ...state.grid,
          tileSettings: {
            ...state.grid.tileSettings,
            [tileKey]: {
              ...existing,
              autoSell,
            },
          },
        },
      };
    });
  },

  /**
   * Удалить авто-продажу для ресурса
   */
  removeAutoSell: (tileKey: string, resource: ResourceType) => {
    set((state) => {
      const existing = state.grid.tileSettings?.[tileKey];
      if (!existing) return state;

      return {
        grid: {
          ...state.grid,
          tileSettings: {
            ...state.grid.tileSettings,
            [tileKey]: {
              ...existing,
              autoSell: existing.autoSell.filter(c => c.resource !== resource),
            },
          },
        },
      };
    });
  },

  /**
   * Добавить лимит хранения
   */
  addStorageLimit: (tileKey: string, limit: StorageLimit) => {
    set((state) => {
      const buildingId = state.grid.tiles[tileKey];
      if (!buildingId) return state;

      const existing = state.grid.tileSettings?.[tileKey] 
        ?? createDefaultTileSettings(tileKey, buildingId);

      const storageLimits = [...existing.storageLimits];
      const idx = storageLimits.findIndex(l => l.resource === limit.resource);
      
      if (idx >= 0) {
        storageLimits[idx] = limit;
      } else {
        storageLimits.push(limit);
      }

      return {
        grid: {
          ...state.grid,
          tileSettings: {
            ...state.grid.tileSettings,
            [tileKey]: {
              ...existing,
              storageLimits,
            },
          },
        },
      };
    });
  },

  /**
   * Удалить лимит хранения
   */
  removeStorageLimit: (tileKey: string, resource: ResourceType) => {
    set((state) => {
      const existing = state.grid.tileSettings?.[tileKey];
      if (!existing) return state;

      return {
        grid: {
          ...state.grid,
          tileSettings: {
            ...state.grid.tileSettings,
            [tileKey]: {
              ...existing,
              storageLimits: existing.storageLimits.filter(l => l.resource !== resource),
            },
          },
        },
      };
    });
  },

  /**
   * Добавить условие работы
   */
  addBuildingCondition: (tileKey: string, condition: BuildingCondition) => {
    set((state) => {
      const buildingId = state.grid.tiles[tileKey];
      if (!buildingId) return state;

      const existing = state.grid.tileSettings?.[tileKey] 
        ?? createDefaultTileSettings(tileKey, buildingId);

      return {
        grid: {
          ...state.grid,
          tileSettings: {
            ...state.grid.tileSettings,
            [tileKey]: {
              ...existing,
              conditions: [...existing.conditions, condition],
            },
          },
        },
      };
    });
  },

  /**
   * Удалить условие работы
   */
  removeBuildingCondition: (tileKey: string, conditionId: string) => {
    set((state) => {
      const existing = state.grid.tileSettings?.[tileKey];
      if (!existing) return state;

      return {
        grid: {
          ...state.grid,
          tileSettings: {
            ...state.grid.tileSettings,
            [tileKey]: {
              ...existing,
              conditions: existing.conditions.filter(c => c.id !== conditionId),
            },
          },
        },
      };
    });
  },

  /**
   * Массовое обновление режима для всех зданий одного типа
   */
  setBuildingModeForAll: (buildingId: string, mode: BuildingMode) => {
    set((state) => {
      const newSettings = { ...state.grid.tileSettings };
      
      for (const [tileKey, tileBuildingId] of Object.entries(state.grid.tiles)) {
        if (tileBuildingId === buildingId) {
          const existing = newSettings[tileKey] 
            ?? createDefaultTileSettings(tileKey, buildingId);
          newSettings[tileKey] = { ...existing, mode };
        }
      }

      return {
        grid: {
          ...state.grid,
          tileSettings: newSettings,
        },
      };
    });
  },

  /**
   * Ремонт здания (восстановление health)
   */
  repairBuilding: (tileKey: string) => {
    set((state) => {
      const existing = state.grid.tileSettings?.[tileKey];
      if (!existing) return state;

      // Стоимость ремонта = (100 - health) * 10 кредитов
      const repairCost = D((100 - existing.health) * 10);
      
      if (state.currency.credits.lt(repairCost)) {
        return state; // Недостаточно кредитов
      }

      return {
        currency: {
          ...state.currency,
          credits: state.currency.credits.sub(repairCost),
        },
        grid: {
          ...state.grid,
          tileSettings: {
            ...state.grid.tileSettings,
            [tileKey]: {
              ...existing,
              health: 100,
            },
          },
        },
      };
    });
  },

  /**
   * Ремонт всех зданий
   */
  repairAllBuildings: () => {
    set((state) => {
      let totalCost = D(0);
      const newSettings = { ...state.grid.tileSettings };
      
      for (const settings of Object.values(state.grid.tileSettings ?? {})) {
        if (settings.health < 100) {
          const cost = D((100 - settings.health) * 10);
          totalCost = totalCost.add(cost);
        }
      }

      if (state.currency.credits.lt(totalCost)) {
        return state; // Недостаточно кредитов
      }

      for (const [tileKey, settings] of Object.entries(newSettings)) {
        if (settings.health < 100) {
          newSettings[tileKey] = { ...settings, health: 100 };
        }
      }

      return {
        currency: {
          ...state.currency,
          credits: state.currency.credits.sub(totalCost),
        },
        grid: {
          ...state.grid,
          tileSettings: newSettings,
        },
      };
    });
  },
}));

// Вспомогательная функция для применения эффектов события
function applyEventEffects(state: GameState, event: RandomEvent): GameState {
  if (!event.effects) return state;
  
  let newState = { ...state };
  const effects = event.effects;
  
  // Бонус к ресурсам
  if (effects.resourceGain) {
    for (const [resType, amount] of Object.entries(effects.resourceGain)) {
      const type = resType as ResourceType;
      const res = newState.resources[type];
      const cur = getBuf(newState.grid.buffers, 'base', type);
      const cappedNext = cur.add(amount).min(res.max);
      const nextBuffers = setBuf(newState.grid.buffers, 'base', type, cappedNext);
      
      newState = {
        ...newState,
        grid: { ...newState.grid, buffers: nextBuffers },
        resources: {
          ...newState.resources,
          [type]: { ...res, amount: cappedNext },
        },
      };
    }
  }
  
  // Потеря ресурсов
  if (effects.resourceLoss) {
    for (const [resType, amount] of Object.entries(effects.resourceLoss)) {
      const type = resType as ResourceType;
      const res = newState.resources[type];
      const cur = getBuf(newState.grid.buffers, 'base', type);
      const newAmount = cur.sub(amount).max(D(0));
      const nextBuffers = setBuf(newState.grid.buffers, 'base', type, newAmount);
      
      newState = {
        ...newState,
        grid: { ...newState.grid, buffers: nextBuffers },
        resources: {
          ...newState.resources,
          [type]: { ...res, amount: newAmount },
        },
      };
    }
  }
  
  // Бонус к очкам исследований
  if (effects.researchPointsGain) {
    const newRp = newState.currency.researchPoints.add(effects.researchPointsGain);
    newState = {
      ...newState,
      currency: {
        ...newState.currency,
        researchPoints: newRp,
      },
    };
  }
  
  // Потеря энергии
  if (effects.energyLoss) {
    const cur = getBuf(newState.grid.buffers, 'base', 'energy');
    const newAmount = cur.sub(effects.energyLoss).max(D(0));
    const nextBuffers = setBuf(newState.grid.buffers, 'base', 'energy', newAmount);
    
    newState = {
      ...newState,
      grid: { ...newState.grid, buffers: nextBuffers },
      resources: {
        ...newState.resources,
        energy: { ...newState.resources.energy, amount: newAmount },
      },
    };
  }
  
  // Разблокировка случайной технологии
  if (effects.unlockRandomTechnology) {
    const availableTechs = Object.keys(TECHNOLOGIES).filter(
      techId => !newState.research.technologies[techId as import('../core/gameTypes').TechnologyId]
    );
    
    if (availableTechs.length > 0) {
      const randomTech = availableTechs[Math.floor(Math.random() * availableTechs.length)] as import('../core/gameTypes').TechnologyId;
      newState = {
        ...newState,
        research: {
          ...newState.research,
          technologies: { ...newState.research.technologies, [randomTech]: true },
        },
      };
      
      // Уведомление будет добавлено в resolveEvent через addNotification
    }
  }
  
  return newState;
}

// Счетчик для уникальности ID событий
let eventIdCounter = 0;

// Проверка условий для события
function canGenerateEvent(eventType: import('../core/gameTypes').RandomEventType, state: GameState): boolean {
  switch (eventType) {
    case 'pirate_raid':
      // Пиратский рейд только если есть платформы
      return state.galaxies.platforms.length > 0;
    case 'synergy_discovery':
      // Синергетическое открытие только если есть неисследованные технологии
      const unlockedCount = Object.values(state.research.technologies).filter(Boolean).length;
      const totalTechs = Object.keys(TECHNOLOGIES).length;
      return unlockedCount < totalTechs;
    case 'power_outage':
      // Перегрузка сети только если есть энергия
      const currentEnergy = getBuf(state.grid.buffers, 'base', 'energy');
      return currentEnergy.gt(0);
    case 'solar_flare':
      // Солнечная вспышка только если есть электроника
      const hasSemiconductors = getBuf(state.grid.buffers, 'base', 'semiconductors').gt(0);
      const hasComputers = getBuf(state.grid.buffers, 'base', 'computer').gt(0);
      const hasDisplays = getBuf(state.grid.buffers, 'base', 'display').gt(0);
      return hasSemiconductors || hasComputers || hasDisplays;
    default:
      return true;
  }
}

// Генератор случайных событий
function generateRandomEvent(state: GameState): RandomEvent | null {
  const now = Date.now();
  
  // Фильтруем события по условиям
  const availableEvents = Object.values(EVENT_CONFIGS).filter(cfg => canGenerateEvent(cfg.type, state));
  
  if (availableEvents.length === 0) {
    return null;
  }
  
  // Выбираем тип события на основе весов
  const totalWeight = availableEvents.reduce((sum, cfg) => sum + cfg.weight, 0);
  let random = Math.random() * totalWeight;
  let selectedConfig = availableEvents[0];
  
  for (const config of availableEvents) {
    random -= config.weight;
    if (random <= 0) {
      selectedConfig = config;
      break;
    }
  }
  
  // Используем счетчик для гарантии уникальности
  const eventId = `event_${now}_${(eventIdCounter++).toString(36)}_${Math.random().toString(36).substr(2, 6)}`;
  
  // Генерируем эффекты на основе типа события и текущего состояния
  const effects = generateEventEffects(selectedConfig.type, state);
  
  // Генерируем описание
  const description = formatEventDescription(selectedConfig, effects);
  
  return {
    id: eventId,
    type: selectedConfig.type,
    title: selectedConfig.title,
    description,
    icon: selectedConfig.icon,
    timestamp: now,
    effects,
    status: 'pending',
  };
}

// Генерация эффектов для события
function generateEventEffects(eventType: import('../core/gameTypes').RandomEventType, state: GameState): RandomEvent['effects'] {
  const config = EVENT_EFFECTS[eventType] as any;
  
  switch (eventType) {
    case 'meteor_shower': {
      const oreGain = D(Math.floor(Math.random() * (config.oreGain.max - config.oreGain.min + 1) + config.oreGain.min));
      const carbonGain = D(Math.floor(Math.random() * (config.carbonGain.max - config.carbonGain.min + 1) + config.carbonGain.min));
      return {
        resourceGain: {
          ore: oreGain,
          carbon: carbonGain,
        },
      };
    }
    
    case 'scientific_breakthrough': {
      const baseGain = Math.floor(Math.random() * (config.baserpGain.max - config.baserpGain.min + 1) + config.baserpGain.min);
      return {
        researchPointsGain: D(baseGain),
      };
    }
    
    case 'pirate_raid': {
      // Пиратский рейд наносит урон ресурсам на случайной платформе
      if (state.galaxies.platforms.length === 0) {
        return {};
      }
      /*
       * ВНИМАНИЕ: событие заявлено как «налёт на случайную платформу», но потери снимаются
       * с буфера БАЗЫ — resourceLoss применяется только к нему, адресации по платформе в
       * applyEventEffects нет. Выбор случайной платформы здесь раньше вычислялся и тут же
       * выбрасывался. Оставляю поведение как есть (это баланс, а не тип), но условие
       * «есть хотя бы одна платформа» сохраняю: без платформ налёта быть не должно.
       */
      // Пираты крадут 5-15% руды и меди
      const lossPercent = (Math.random() * 10 + 5) / 100;
      const oreCurrent = getBuf(state.grid.buffers, 'base', 'ore');
      const copperCurrent = getBuf(state.grid.buffers, 'base', 'copper');
      return {
        resourceLoss: {
          ore: oreCurrent.mul(lossPercent).floor(),
          copper: copperCurrent.mul(lossPercent).floor(),
        },
      };
    }
    
    case 'cosmic_anomaly': {
      // Случайный эффект
      const totalWeight = config.effects.reduce((sum: number, e: { weight: number }) => sum + e.weight, 0);
      let random = Math.random() * totalWeight;
      let selectedEffect = config.effects[0].type;
      
      for (const effect of config.effects) {
        random -= effect.weight;
        if (random <= 0) {
          selectedEffect = effect.type;
          break;
        }
      }
      
      switch (selectedEffect) {
        case 'resource_bonus':
          return {
            resourceGain: {
              ore: D(100),
              copper: D(80),
              steel: D(60),
            },
          };
        case 'resource_loss':
          return {
            resourceLoss: {
              ore: D(50),
              copper: D(40),
            },
          };
        case 'production_boost':
          return {
            productionMultiplier: {
              duration: 60000,
              multiplier: 1.5,
            },
          };
        case 'rp_bonus':
          return {
            researchPointsGain: D(200),
          };
        default:
          return {};
      }
    }
    
    case 'chain_reaction': {
      // Цепная реакция наносит урон производству энергии (теряется 10-20%)
      const energyCurrent = getBuf(state.grid.buffers, 'base', 'energy');
      const lossPercent = (Math.random() * 10 + 10) / 100;
      return {
        energyLoss: energyCurrent.mul(lossPercent).floor(),
      };
    }
    
    case 'synergy_discovery': {
      return {
        unlockRandomTechnology: true,
      };
    }
    
    case 'power_surge': {
      // Скачок энергии — добавляем бонус энергии вместо множителя
      const energyBonus = D(Math.floor(Math.random() * 500 + 200)); // 200-700 энергии
      return {
        resourceGain: {
          energy: energyBonus,
        },
      };
    }
    
    case 'power_outage': {
      const energyCurrent = getBuf(state.grid.buffers, 'base', 'energy');
      const energyLoss = energyCurrent.mul(0.3).floor().max(D(100)); // Теряем 30% или минимум 100
      return {
        energyLoss,
      };
    }
    
    case 'resource_cache': {
      const resources: Partial<Record<ResourceType, Decimal>> = {};
      const randomCount = Math.floor(Math.random() * 3) + 2; // 2-4 ресурса
      const shuffled = [...config.resourceTypes].sort(() => Math.random() - 0.5);
      
      for (let i = 0; i < randomCount && i < shuffled.length; i++) {
        const resType = shuffled[i] as ResourceType;
        const amount = Math.floor(Math.random() * (config.amountMultiplier.max - config.amountMultiplier.min + 1) + config.amountMultiplier.min);
        resources[resType] = D(amount);
      }
      
      return {
        resourceGain: resources,
      };
    }
    
    case 'solar_flare': {
      // Солнечная вспышка — теряем электронику (процент от текущих запасов)
      const lossPercent = (Math.random() * 10 + 5) / 100; // 5-15%
      const resourceLoss: Partial<Record<ResourceType, Decimal>> = {};
      
      const semiconductorsCurrent = getBuf(state.grid.buffers, 'base', 'semiconductors');
      const computerCurrent = getBuf(state.grid.buffers, 'base', 'computer');
      const displayCurrent = getBuf(state.grid.buffers, 'base', 'display');
      
      if (semiconductorsCurrent.gt(0)) {
        resourceLoss.semiconductors = semiconductorsCurrent.mul(lossPercent).floor();
      }
      if (computerCurrent.gt(0)) {
        resourceLoss.computer = computerCurrent.mul(lossPercent).floor();
      }
      if (displayCurrent.gt(0)) {
        resourceLoss.display = displayCurrent.mul(lossPercent).floor();
      }
      
      return { resourceLoss };
    }
    
    default:
      return {};
  }
}

// Названия ресурсов на русском
const RESOURCE_NAMES_RU: Record<string, string> = {
  ore: 'руды',
  copper: 'меди',
  steel: 'стали',
  carbon: 'углерода',
  titanium: 'титана',
  uranium: 'урана',
  energy: 'энергии',
  semiconductors: 'полупроводников',
  computer: 'компьютеров',
  display: 'дисплеев',
  silicon: 'кремния',
  glass: 'стекла',
  plastic: 'пластика',
  fuel: 'топлива',
  alloy: 'сплава',
};

// Форматирование описания события
function formatEventDescription(config: import('../core/constants/randomEvents').EventConfig, effects: RandomEvent['effects']): string {
  let description = config.descriptionTemplate;
  
  // Заменяем плейсхолдеры на реальные значения
  if (effects?.resourceGain) {
    const resources = Object.entries(effects.resourceGain)
      .map(([type, amount]) => `${amount?.toFixed(0)} ${RESOURCE_NAMES_RU[type] || type}`)
      .join(', ');
    description = description.replace('{resources}', resources);
    description = description.replace('{oreGain}', (effects.resourceGain as any).ore?.toFixed(0) || '0');
    description = description.replace('{carbonGain}', (effects.resourceGain as any).carbon?.toFixed(0) || '0');
  }
  
  if (effects?.resourceLoss) {
    const resources = Object.entries(effects.resourceLoss)
      .filter(([_, amount]) => amount && amount.gt(0))
      .map(([type, amount]) => `${amount?.toFixed(0)} ${RESOURCE_NAMES_RU[type] || type}`)
      .join(', ');
    description = description.replace('{resourcesLost}', resources || 'ресурсов');
  }
  
  if (effects?.researchPointsGain) {
    description = description.replace('{rpGain}', effects.researchPointsGain.toFixed(0));
  }
  
  if (effects?.energyLoss) {
    description = description.replace('{energyLoss}', effects.energyLoss.toFixed(0));
  }
  
  if (effects?.productionMultiplier) {
    const multiplierPercent = Math.round((effects.productionMultiplier.multiplier - 1) * 100);
    description = description.replace('{multiplier}', multiplierPercent.toString());
    description = description.replace('{duration}', (effects.productionMultiplier.duration / 1000).toString());
  }
  
  return description;
}

/**
 * Cost of the next copy of a building.
 *
 * `buildingCostMultiplier` is declared on several policies but was never read anywhere, so
 * policies advertising cheaper construction did nothing.
 *
 * The multiplier is read from the store by DEFAULT rather than passed in by each of the eight
 * call sites (five here, three in BuildingList). That is deliberate: if the displayed price and
 * the charged price could diverge, the bug would be worse than the missing feature — the player
 * would see one number and be billed another. Pass `costMultiplier` explicitly only in tests.
 */
export const calculateCost = (
  building: Building,
  costMultiplier?: number,
): Partial<Record<ResourceType, Decimal>> => {
  const policyMult =
    costMultiplier ??
    aggregatePolicyEffects(useGameStore.getState().politics.activePolicies).buildingCost;

  const cost: Record<string, Decimal> = {};
  for (const [res, amount] of Object.entries(building.baseCost)) {
    cost[res] = D(amount).mul(Math.pow(building.costFactor, building.count)).mul(D(policyMult));
  }
  return cost as Partial<Record<ResourceType, Decimal>>;
};

/**
 * Initial-state constants, re-exported for `./gameSave.ts`.
 *
 * The save deserializer has to be TOTAL: any slice that is missing or corrupt in a save
 * file must fall back to its initial value rather than writing `undefined` into the store
 * (which the tick loop would then dereference and crash on). That means gameSave needs
 * every INITIAL_* here, so they are exported in one block rather than by prefixing 35
 * separate declarations scattered over 2000 lines.
 */
export {
  BUILDINGS_WITH_PROXIMITY,
  DEFAULT_GRID,
  INITIAL_ACHIEVEMENTS,
  INITIAL_AEGIS,
  INITIAL_ARTIFACTS,
  INITIAL_ASCENSION,
  INITIAL_COMBAT,
  INITIAL_CULTURE,
  INITIAL_CURRENCY,
  INITIAL_DEMONS,
  INITIAL_ENDGAME,
  INITIAL_EXPEDITION,
  INITIAL_FLEET,
  INITIAL_GALAXIES,
  INITIAL_INTERGALACTIC_LOGISTICS,
  INITIAL_MAPS,
  INITIAL_MARKET,
  INITIAL_MEGASTRUCTURES,
  INITIAL_META,
  INITIAL_POLITICS,
  INITIAL_POLLUTION,
  INITIAL_PRESTIGE,
  INITIAL_PROCEDURAL_GALAXIES,
  INITIAL_PRODUCTION_MATRIX,
  INITIAL_QUANTUM_NET,
  INITIAL_QUESTS,
  INITIAL_RANDOM_EVENTS,
  INITIAL_REPEATABLE_RESEARCH,
  INITIAL_RESEARCH,
  INITIAL_RESOURCES,
  INITIAL_RETENTION,
  INITIAL_SHIP,
  INITIAL_SIGNAL_INTERCEPTION,
  INITIAL_STAR_CHART,
  TRADEABLE,
};
