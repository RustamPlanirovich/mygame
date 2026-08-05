/**
 * Aggregated effects of the player's active policies.
 *
 * WHY THIS EXISTS
 * ---------------
 * `POLICIES` was imported by gameStore in exactly two places: to validate activation, and to
 * drain `influenceUpkeep` every tick. `policy.effects` was never read anywhere in the codebase.
 * So all 41 policies charged an activation cost AND a continuous influence upkeep, while
 * exactly one of them (`eco_friendly`, hardcoded by id) had any gameplay effect at all. Every
 * declared multiplier — production, research, energy, building cost, trade prices, credits —
 * was dead data. CurrencyPanel even displayed policy bonuses in its tooltip that could not
 * exist.
 *
 * This module turns the declared effects into one bundle the tick can apply next to the
 * artifact / ascension / repeatable-research multipliers it already composes.
 *
 * HONEST SCOPE
 * ------------
 * `buildingTypeMultipliers` and `specialEffect` are per-policy bespoke behaviour (things like
 * "gas plants also produce gasoline" or "auto-stop unprofitable buildings"). They are collected
 * here so callers can act on them and so it is visible which ones are still unhandled, but this
 * module does NOT invent semantics for them. `unhandledSpecialEffects` names exactly what is
 * still inert — see POLICY_EFFECT_COVERAGE below.
 */

import Decimal from 'break_eternity.js';
import { POLICIES } from '../constants/policies';
import type { PolicyId } from '../gameTypes';
import { D } from '../math/format';

export interface PolicyEffects {
  /** Global production multiplier (1 = neutral). Multiplied into the tick's effective dt. */
  production: number;
  /** Energy production multiplier (1 = neutral). */
  energyProduction: number;
  /** Energy consumption multiplier (1 = neutral). >1 means policies cost more power. */
  energyConsumption: number;
  /** Building purchase cost multiplier (1 = neutral). */
  buildingCost: number;
  /** Research point gain multiplier (1 = neutral). */
  research: number;
  /** Market price multiplier (1 = neutral). */
  tradePrice: number;
  /** Flat credits per second granted by policies. */
  creditsPerSecond: Decimal;
  /** Per-building-id production multipliers, merged multiplicatively across policies. */
  buildingTypeMultipliers: Record<string, number>;
  /** Every `specialEffect` string on an active policy. */
  specialEffects: Set<string>;
  /** The subset of the above that nothing in the game currently acts on. */
  unhandledSpecialEffects: string[];
  /** Числовые последствия спецэффектов — единственный источник их смысла для тика. */
  specials: PolicySpecials;
}

/**
 * Special effects that some part of the game genuinely honours.
 * Keep this in sync with the code that reads `specialEffects`; anything not listed here is
 * reported through `unhandledSpecialEffects` so it cannot quietly look implemented.
 *
 * Каждая строка ниже читается либо через `derivePolicySpecials` (числовые ручки),
 * либо по имени в конкретном шаге тика — место указано в комментарии.
 */
export const HANDLED_SPECIAL_EFFECTS = new Set<string>([
  // --- числовые ручки, см. derivePolicySpecials ---
  'reduces_consumption_20',
  'quality_penalty_10',
  'production_speed_15',
  'game_speed_20',
  'recycle_10_percent',
  'robots_boost_production',
  'energy_storage_double',
  'reduce_energy_loss',
  'export_bonus_30',
  'intergalactic_trade_discount',
  'damage_boost_50',
  'defense_double',
  'reduce_demon_attacks',
  'reduce_random_events',
  'random_research_bonus',
  'divine_machine_all_bonus',
  // --- флаги, читаются по имени в шаге тика ---
  'auto_stop_unprofitable',
  'gas_power_produces_gasoline',
  'auto_recycle_waste',
  'random_tech_unlock',
  'unlock_megastructures',
  'planet_bonus_resources',
  // --- чистые множители по id здания, раскрыты в buildingTypeMultipliers ---
  'double_silicon_production',
  'power_plants_boost_50',
  'nuclear_boost_200',
  'solar_boost_50',
  'bitcoin_farm_double',
  'quantum_computer_double',
  'military_production_50',
]);

/**
 * Числовые последствия активных спецэффектов.
 *
 * Смысл каждого эффекта задаётся ровно здесь, один раз, и потребляется тиком. Раньше эти
 * строки были просто маркерами в данных: игрок платил влияние, а в коде не было ни одного
 * читателя. Значения взяты из описаний политик (они на русском и содержат конкретные числа).
 */
export interface PolicySpecials {
  /** Множитель расхода входных ресурсов зданиями. <1 — экономия. */
  consumption: number;
  /** Доля израсходованного, возвращаемая обратно (0…0.9). */
  recycleRate: number;
  /** Множитель к эффективному dt производства (скорость цепочек и «скорость игры»). */
  productionSpeed: number;
  /** Прибавка к производству за каждого произведённого робота (доля, напр. 0.05). */
  robotBonusPerUnit: number;
  /** Множитель ёмкости энергохранилищ. */
  energyStorage: number;
  /**
   * Насколько смягчается просадка при нехватке энергии: 0 — без изменений, 0.5 — половина
   * недостачи прощается. Буквальных «потерь при передаче» в игре нет (сеть бинарная:
   * здание либо запитано, либо нет), поэтому `reduce_energy_loss` применён к единственной
   * настоящей потере энергии — дефициту, который режет всё производство.
   */
  energyDeficitRelief: number;
  /** Множитель кредитов от продажи ресурсов. */
  sellCredits: number;
  /** Множитель стоимости межгалактической торговли. <1 — дешевле. */
  interTradeCost: number;
  /** Множитель урона игрока по врагам. */
  damage: number;
  /** Множитель прочности и урона защитных сооружений. */
  defense: number;
  /** Множитель интервала между волнами. >1 — нападения реже. */
  waveInterval: number;
  /** Множитель частоты случайных событий. <1 — события реже. */
  eventFrequency: number;
  /** Шанс в секунду получить разовый бонус к исследованиям. */
  researchBonusChancePerSecond: number;
  /** Шанс в секунду открыть случайную доступную технологию бесплатно. */
  freeTechChancePerSecond: number;
  /** Множитель влияния в секунду. */
  influence: number;
}

export const NEUTRAL_POLICY_SPECIALS: PolicySpecials = {
  consumption: 1,
  recycleRate: 0,
  productionSpeed: 1,
  robotBonusPerUnit: 0,
  energyStorage: 1,
  energyDeficitRelief: 0,
  sellCredits: 1,
  interTradeCost: 1,
  damage: 1,
  defense: 1,
  waveInterval: 1,
  eventFrequency: 1,
  researchBonusChancePerSecond: 0,
  freeTechChancePerSecond: 0,
  influence: 1,
};

/**
 * Множители производства, раскрываемые из спецэффектов по id здания.
 *
 * Держим их здесь, а не в policies.ts, потому что это привязка к конкретным зданиям
 * каталога: если здание переименуют, ломаться должно в одном месте.
 */
const SPECIAL_BUILDING_MULTIPLIERS: Record<string, Record<string, number>> = {
  /*
   * Политика называет ресурс «кремний», но такого ResourceType в игре нет: `silicon` живёт
   * единственной строкой в таблице подписей RESOURCE_NAMES_RU и ничем не производится.
   * Настоящая кремниевая цепочка — sand -> semiconductors -> integrated_circuit, и сама
   * политика требует технологию `semiconductors`. Поэтому удваиваем завод полупроводников.
   */
  double_silicon_production: { semiconductor_factory_mk1: 2 },
  solar_boost_50: { solar_panel_mk1: 1.5 },
  bitcoin_farm_double: { bitcoin_farm_mk1: 2, mining_rig_mk1: 2 },
  quantum_computer_double: { quantum_lab_mk1: 2, quantum_lab_mk2: 2, supercomputer_lab_mk1: 2 },
  nuclear_boost_200: { nuclear_power_plant: 3 },
  power_plants_boost_50: {
    generator_mk1: 1.5,
    solar_panel_mk1: 1.5,
    gas_power_plant_mk1: 1.5,
    fuel_power_plant_mk1: 1.5,
    nuclear_power_plant: 1.5,
  },
  military_production_50: {
    weapon_factory_mk1: 1.5,
    artillery_factory_mk1: 1.5,
    radar_factory_mk1: 1.5,
    nuclear_bomb_factory_mk1: 1.5,
  },
};

/** Спецэффекты, снижающие военное производство (обратная сторона мирного курса). */
const MILITARY_BUILDINGS = [
  'weapon_factory_mk1',
  'artillery_factory_mk1',
  'radar_factory_mk1',
  'nuclear_bomb_factory_mk1',
];

export function derivePolicySpecials(specialEffects: ReadonlySet<string>): PolicySpecials {
  if (specialEffects.size === 0) return NEUTRAL_POLICY_SPECIALS;
  const s = { ...NEUTRAL_POLICY_SPECIALS };
  const has = (k: string) => specialEffects.has(k);

  // «-20% расход ресурсов». Обратная сторона (-10% скорости) уже объявлена
  // productionMultiplier у самой политики, здесь её дублировать нельзя.
  if (has('reduces_consumption_20')) s.consumption *= 0.8;
  // «-10% эффективности» при +20% производства: та же выработка обходится дороже по входам.
  // Как второй множитель на выпуск это просто гасило бы заявленный бонус до +8%.
  if (has('quality_penalty_10')) s.consumption *= 1.1;

  if (has('production_speed_15')) s.productionSpeed *= 1.15;
  if (has('game_speed_20')) s.productionSpeed *= 1.2;

  if (has('recycle_10_percent')) s.recycleRate = Math.min(0.9, s.recycleRate + 0.1);
  if (has('robots_boost_production')) s.robotBonusPerUnit += 0.05;
  if (has('energy_storage_double')) s.energyStorage *= 2;
  if (has('reduce_energy_loss')) s.energyDeficitRelief = Math.max(s.energyDeficitRelief, 0.5);

  if (has('export_bonus_30')) s.sellCredits *= 1.3;
  if (has('intergalactic_trade_discount')) s.interTradeCost *= 0.75;

  if (has('damage_boost_50')) s.damage *= 1.5;
  if (has('defense_double')) s.defense *= 2;
  if (has('reduce_demon_attacks')) s.waveInterval *= 2;
  if (has('reduce_random_events')) s.eventFrequency *= 0.5;

  if (has('random_research_bonus')) s.researchBonusChancePerSecond += 1 / 120;
  if (has('random_tech_unlock')) s.freeTechChancePerSecond += 1 / 600;

  // Финальная политика: небольшая прибавка к тому, что не покрыто её обычными множителями.
  if (has('divine_machine_all_bonus')) {
    s.sellCredits *= 1.1;
    s.influence *= 1.1;
  }

  return s;
}

/**
 * Человеческие подписи спецэффектов для интерфейса.
 *
 * Панель политик выводила игроку сырой идентификатор (`gas_power_produces_gasoline`).
 * Пока эффекты были мертвы, это хотя бы не вводило в заблуждение; теперь они работают,
 * и подпись должна читаться.
 */
export const SPECIAL_EFFECT_LABELS_RU: Record<string, string> = {
  reduces_consumption_20: 'Расход входных ресурсов −20%',
  quality_penalty_10: 'Входных ресурсов требуется на 10% больше',
  production_speed_15: 'Производственные цепочки быстрее на 15%',
  game_speed_20: 'Производство идёт на 20% быстрее',
  recycle_10_percent: '10% израсходованных материалов возвращается',
  robots_boost_production: 'Каждый робот: +5% к производству',
  energy_storage_double: 'Ёмкость энергохранилищ ×2',
  reduce_energy_loss: 'Просадка при нехватке энергии вдвое мягче',
  export_bonus_30: 'Продажа ресурсов приносит на 30% больше кредитов',
  intergalactic_trade_discount: 'Межгалактическая торговля дешевле на 25%',
  damage_boost_50: 'Урон по врагам +50%',
  defense_double: 'Прочность и урон защиты ×2',
  reduce_demon_attacks: 'Волны вдвое реже, военное производство −30%',
  reduce_random_events: 'Случайные события вдвое реже',
  random_research_bonus: 'Периодические бонусы к исследованиям',
  random_tech_unlock: 'Шанс открыть случайную технологию бесплатно',
  divine_machine_all_bonus: 'Небольшая прибавка к доходу и влиянию',
  auto_stop_unprofitable: 'Убыточные производства останавливаются сами',
  gas_power_produces_gasoline: 'Газовые станции дают бензин побочным продуктом',
  auto_recycle_waste: 'Мусор перерабатывается вдвое быстрее',
  unlock_megastructures: 'Открывает мегаструктуры без исследования',
  planet_bonus_resources: 'Новые платформы стартуют с запасом ресурсов',
  double_silicon_production: 'Завод полупроводников ×2',
  power_plants_boost_50: 'Электростанции +50% выработки',
  nuclear_boost_200: 'Атомные станции ×3 выработки',
  solar_boost_50: 'Солнечные панели +50% выработки',
  bitcoin_farm_double: 'Биткоин-фермы ×2',
  quantum_computer_double: 'Квантовые лаборатории ×2',
  military_production_50: 'Военное производство +50%',
};

/** Множители по id здания: объявленные в политике плюс раскрытые из спецэффектов. */
export function specialBuildingMultipliers(
  specialEffects: ReadonlySet<string>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const effect of specialEffects) {
    const table = SPECIAL_BUILDING_MULTIPLIERS[effect];
    if (!table) continue;
    for (const [id, mult] of Object.entries(table)) out[id] = (out[id] ?? 1) * mult;
  }
  // Мирное сосуществование: реже нападают, но военка просаживается на 30%.
  if (specialEffects.has('reduce_demon_attacks')) {
    for (const id of MILITARY_BUILDINGS) out[id] = (out[id] ?? 1) * 0.7;
  }
  return out;
}

export const NEUTRAL_POLICY_EFFECTS: PolicyEffects = {
  production: 1,
  energyProduction: 1,
  energyConsumption: 1,
  buildingCost: 1,
  research: 1,
  tradePrice: 1,
  creditsPerSecond: D(0),
  buildingTypeMultipliers: {},
  specialEffects: new Set(),
  unhandledSpecialEffects: [],
  specials: NEUTRAL_POLICY_SPECIALS,
};

/** Multipliers compose multiplicatively: two +30% policies give ×1.69, not ×1.6. */
export function aggregatePolicyEffects(activePolicies: readonly PolicyId[]): PolicyEffects {
  if (!activePolicies || activePolicies.length === 0) return NEUTRAL_POLICY_EFFECTS;

  const out: PolicyEffects = {
    production: 1,
    energyProduction: 1,
    energyConsumption: 1,
    buildingCost: 1,
    research: 1,
    tradePrice: 1,
    creditsPerSecond: D(0),
    buildingTypeMultipliers: {},
    specialEffects: new Set<string>(),
    unhandledSpecialEffects: [],
    specials: NEUTRAL_POLICY_SPECIALS,
  };

  for (const id of activePolicies) {
    const policy = POLICIES[id];
    if (!policy?.effects) continue;
    const e = policy.effects;

    // `Number.isFinite` guards against an authored `undefined`/NaN silently zeroing production.
    if (Number.isFinite(e.productionMultiplier)) out.production *= e.productionMultiplier as number;
    if (Number.isFinite(e.energyProductionMultiplier)) out.energyProduction *= e.energyProductionMultiplier as number;
    if (Number.isFinite(e.energyConsumptionMultiplier)) out.energyConsumption *= e.energyConsumptionMultiplier as number;
    if (Number.isFinite(e.buildingCostMultiplier)) out.buildingCost *= e.buildingCostMultiplier as number;
    if (Number.isFinite(e.researchMultiplier)) out.research *= e.researchMultiplier as number;
    if (Number.isFinite(e.tradePriceMultiplier)) out.tradePrice *= e.tradePriceMultiplier as number;

    if (e.creditsPerSecond) out.creditsPerSecond = out.creditsPerSecond.add(D(e.creditsPerSecond));

    if (e.buildingTypeMultipliers) {
      for (const [buildingId, mult] of Object.entries(e.buildingTypeMultipliers)) {
        if (!Number.isFinite(mult)) continue;
        out.buildingTypeMultipliers[buildingId] = (out.buildingTypeMultipliers[buildingId] ?? 1) * mult;
      }
    }

    if (e.specialEffect) out.specialEffects.add(e.specialEffect);
  }

  out.unhandledSpecialEffects = [...out.specialEffects].filter((x) => !HANDLED_SPECIAL_EFFECTS.has(x));
  out.specials = derivePolicySpecials(out.specialEffects);

  // Множители по зданиям, раскрытые из спецэффектов, домножаются поверх объявленных в политике.
  for (const [buildingId, mult] of Object.entries(specialBuildingMultipliers(out.specialEffects))) {
    out.buildingTypeMultipliers[buildingId] = (out.buildingTypeMultipliers[buildingId] ?? 1) * mult;
  }

  // A multiplier of 0 or a negative one would stall or invert production; clamp defensively
  // rather than trust authored data.
  out.production = clampMult(out.production);
  out.energyProduction = clampMult(out.energyProduction);
  out.energyConsumption = clampMult(out.energyConsumption);
  out.buildingCost = clampMult(out.buildingCost);
  out.research = clampMult(out.research);
  out.tradePrice = clampMult(out.tradePrice);

  return out;
}

const clampMult = (v: number): number => (Number.isFinite(v) && v > 0 ? Math.min(v, 1e6) : 1);

/**
 * Which declared effect keys the game acts on. Used by the Politics UI so the player is not
 * promised a bonus that does nothing — and so this stays honest as coverage changes.
 */
export const POLICY_EFFECT_COVERAGE = {
  applied: [
    'productionMultiplier',
    'energyProductionMultiplier',
    'energyConsumptionMultiplier',
    'buildingCostMultiplier',
    'researchMultiplier',
    'tradePriceMultiplier',
    'creditsPerSecond',
    'buildingTypeMultipliers',
    'specialEffect',
  ],
  /*
   * Пусто по замыслу: если какой-то specialEffect снова окажется без читателя, он не попадёт
   * в HANDLED_SPECIAL_EFFECTS и всплывёт в unhandledSpecialEffects — UI покажет это игроку.
   * Раньше здесь числился applied: 'buildingTypeMultipliers', хотя это поле не читалось нигде
   * в проекте; список обещал игроку то, чего не было.
   */
  notApplied: [] as string[],
} as const;
