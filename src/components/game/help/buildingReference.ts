/**
 * СПРАВОЧНИК ЗДАНИЙ — вывод фактов из живых данных, а не переписанная от руки таблица.
 *
 * ЗАЧЕМ ИМЕННО ТАК. Прошлая справка описывала здания текстом («Турель Mk1 — стреляет по
 * врагам»), и к моменту переписывания в ней не совпадало почти ничего: у кораблей стояли цены
 * «100💰» вместо 5000₡ и шести материалов, у Encryption — 10 уровней вместо 20. Любая таблица,
 * поддерживаемая руками, расходится с балансом на первом же коммите. Здесь всё числовое
 * считается из тех же констант, что читает тик: правка баланса меняет справку сама.
 *
 * МОДУЛЬ ЧИСТЫЙ: на вход каталог зданий, на выход — производные факты. Никакого доступа к
 * стору, поэтому его можно проверить тестом без React и без сетки.
 */

import type Decimal from 'break_eternity.js';
import type { Building, ResourceType } from '../../../core/gameTypes';
import { D } from '../../../core/math/format';
import { BASE_RESOURCE_PRICES, TRADEABLE_RESOURCES } from '../../../core/constants/market';
import { getTechnologyForBuilding, ERA_NAMES } from '../../../core/constants/technologies';
import { requiredDepositForBuilding } from '../../../core/systems/deposits';
import { isBuildingDisableable } from '../../../core/constants/buildingCategories';
import { BUILDING_EVOLUTIONS } from '../../../core/constants/buildingEvolutions';
import { RP_PER_SECOND, INFLUENCE_PER_SECOND, CREDITS_PER_SECOND } from '../../../core/production/currencyRates';
import type { DepositType } from '../../../core/gameTypes';

// ─────────────────────────────────────────────────────────────────── категории

export type BuildingGroupId =
  | 'energy'
  | 'mining'
  | 'production'
  | 'research'
  | 'storage'
  | 'defense'
  | 'special';

export interface BuildingGroup {
  id: BuildingGroupId;
  title: string;
  icon: string;
  hint: string;
}

export const BUILDING_GROUPS: readonly BuildingGroup[] = [
  { id: 'energy', title: 'Энергетика', icon: 'energy', hint: 'Выработка энергии, сеть и ёмкость' },
  { id: 'mining', title: 'Добыча', icon: 'drill', hint: 'Требуют месторождение под собой' },
  { id: 'production', title: 'Переработка', icon: 'factory', hint: 'Превращают сырьё в материалы' },
  { id: 'research', title: 'Наука и политика', icon: 'research', hint: 'Очки исследований и влияние' },
  { id: 'storage', title: 'Склады и логистика', icon: 'warehouse', hint: 'Вместимость базы и зоны доставки' },
  { id: 'defense', title: 'Оборона', icon: 'shield', hint: 'Турели и щиты базы и платформ' },
  { id: 'special', title: 'Особые', icon: 'sparkle', hint: 'Уникальные эффекты' },
] as const;

/**
 * Здания, которые по данным попадают не в ту группу, куда попадают по смыслу.
 *
 * Категорию нельзя вывести из одного признака: Ферма Биткоинов вообще ничего не производит в
 * `production` (кредиты ей начисляет отдельная ставка), Ускоритель Ресурсов и Логистический
 * Центр — тоже пустые, а Космическая Колония производит пять ресурсов сразу, включая энергию,
 * и по первому же признаку уехала бы в «Энергетику».
 */
const GROUP_OVERRIDES: Readonly<Record<string, BuildingGroupId>> = {
  political_center_mk1: 'research',
  bitcoin_farm_mk1: 'special',
  mining_rig_mk1: 'special',
  resource_accelerator_mk1: 'special',
  cooling_system_mk1: 'special',
  recycler_mk1: 'special',
  space_colony_mk1: 'special',
  radar_station_mk1: 'defense',
  armor_plating_mk1: 'defense',
  logistics_hub_mk1: 'storage',
  power_substation_mk1: 'energy',
};

function detectGroup(b: Building): BuildingGroupId {
  const override = GROUP_OVERRIDES[b.id];
  if (override) return override;

  if (requiredDepositForBuilding(b.id)) return 'mining';
  if (b.combat || b.defense) return 'defense';
  if (RP_PER_SECOND[b.id] !== undefined || INFLUENCE_PER_SECOND[b.id] !== undefined) return 'research';

  const hasEnergyOutput = Boolean(b.production?.energy);
  const isEnergyStore = Boolean(b.productionMultipliers?.energy);
  if (hasEnergyOutput || isEnergyStore || b.powerGridRadius) return 'energy';

  if (b.logisticsRadius || b.productionMultipliers) return 'storage';

  return 'production';
}

// ────────────────────────────────────────────────────────────── производные факты

export interface RateEntry {
  resource: ResourceType;
  amount: Decimal;
}

export interface EvolutionTierInfo {
  level: number;
  name: string;
  multiplier: number;
  credits: Decimal;
  quantumPoints: Decimal;
}

export interface BuildingFacts {
  id: string;
  name: string;
  description: string;
  group: BuildingGroupId;

  /** Технология-гейт. null — здание доступно с начала партии. */
  unlockTechId: string | null;
  unlockTechName: string | null;
  /** Номер эры технологии-гейта; 0 для зданий без гейта — они идут первыми в сортировке. */
  era: number;
  eraName: string | null;

  /** Месторождение, обязательное под зданием. */
  requiredDeposit: DepositType | null;

  costResources: RateEntry[];
  costCredits: Decimal | null;
  costFactor: number;

  production: RateEntry[];
  consumption: RateEntry[];
  /** Пассивный расход энергии (`energyConsumption`), идёт всегда. */
  passiveEnergy: Decimal | null;
  /** Активный расход энергии из `consumption.energy`. */
  activeEnergy: Decimal | null;

  powerGridRadius: number | null;
  logisticsRadius: number | null;

  combat: { dps: Decimal; energyPerSecond: Decimal } | null;
  defense: { shieldMaxHp: Decimal; shieldRegenPerSecond: Decimal; energyPerSecond: Decimal } | null;

  /** Прибавка к вместимости базы за уровень (перечисленные в паспорте ресурсы). */
  storageBonus: RateEntry[];

  /** Фиксированные ставки валют за поставленную копию. */
  researchPointsPerSecond: number | null;
  influencePerSecond: number | null;
  creditsPerSecond: number | null;

  /** Мусора в секунду на первом уровне: 1% суммарного выпуска. */
  wastePerSecond: number;
  /** Радиоактивных отходов в секунду на первом уровне. */
  radioactivePerSecond: number;

  canDisable: boolean;
  evolution: EvolutionTierInfo[];

  /**
   * Рыночная стоимость выпуска минус стоимость входов, ₡/с на первом уровне.
   * null — что-то в цепочке не торгуется, и сравнение было бы бессмысленным.
   */
  marketMarginPerSecond: number | null;

  /** Всё, по чему ищет поиск справочника. */
  search: string;
}

const ZERO = D(0);

function toEntries(map: Partial<Record<ResourceType, Decimal>> | undefined, skip?: ResourceType): RateEntry[] {
  if (!map) return [];
  const out: RateEntry[] = [];
  for (const [resource, amount] of Object.entries(map) as Array<[ResourceType, Decimal | undefined]>) {
    if (!amount) continue;
    if (skip && resource === skip) continue;
    const value = D(amount);
    if (value.lte(0)) continue;
    out.push({ resource, amount: value });
  }
  return out;
}

/**
 * Мусор от здания за секунду на первом уровне.
 *
 * Формула повторяет `stepPollution`: 1% суммарного выпуска, но генераторы и солнечные панели
 * не мусорят вовсе. Держать её здесь копией — сознательно: справочник обязан показывать то же
 * число, которое считает тик, а тянуть сюда чистую функцию тика вместе с её входами
 * (сетка, уровни клеток) значило бы собирать полсостояния игры ради одной цифры.
 */
function wasteOf(b: Building): number {
  if (!b.production) return 0;
  if (b.id.includes('generator') || b.id.includes('solar')) return 0;
  let total = ZERO;
  for (const amount of Object.values(b.production)) {
    if (amount) total = total.add(D(amount));
  }
  return Number(total.mul(0.01).toString());
}

function radioactiveOf(b: Building): number {
  return b.id.includes('nuclear') || b.id.includes('enriched_uranium') ? 0.05 : 0;
}

/** Рыночная маржа выпуска: только если ВСЁ, что входит и выходит, торгуется. */
function marginOf(b: Building): number | null {
  const tradeable = new Set<string>(TRADEABLE_RESOURCES);
  let income = 0;
  let outgo = 0;

  for (const [resource, amount] of Object.entries(b.production ?? {}) as Array<[ResourceType, Decimal | undefined]>) {
    if (!amount) continue;
    // Энергия не торгуется, но и не «теряется»: её просто не учитываем в марже.
    if (resource === 'energy') continue;
    if (!tradeable.has(resource)) return null;
    const price = BASE_RESOURCE_PRICES[resource];
    if (!price) return null;
    income += Number(D(amount).mul(price).toString());
  }

  for (const [resource, amount] of Object.entries(b.consumption ?? {}) as Array<[ResourceType, Decimal | undefined]>) {
    if (!amount) continue;
    if (resource === 'energy') continue;
    if (!tradeable.has(resource)) return null;
    const price = BASE_RESOURCE_PRICES[resource];
    if (!price) return null;
    outgo += Number(D(amount).mul(price).toString());
  }

  if (income === 0 && outgo === 0) return null;
  return income - outgo;
}

function evolutionOf(buildingId: string): EvolutionTierInfo[] {
  for (const config of Object.values(BUILDING_EVOLUTIONS)) {
    if (config.buildingType !== buildingId) continue;
    return config.tiers.map((tier) => ({
      level: tier.level,
      name: tier.nameRu || tier.name,
      multiplier: tier.multiplier,
      credits: D(tier.cost?.credits ?? 0),
      quantumPoints: D(tier.cost?.quantum_points ?? 0),
    }));
  }
  return [];
}

/** Один паспорт здания. */
export function buildingFacts(b: Building): BuildingFacts {
  const tech = getTechnologyForBuilding(b.id);
  const deposit = requiredDepositForBuilding(b.id);
  const production = toEntries(b.production);
  const consumption = toEntries(b.consumption, 'energy');
  const storageBonus = toEntries(b.productionMultipliers);

  const passive = b.energyConsumption ? D(b.energyConsumption) : null;
  const active = b.consumption?.energy ? D(b.consumption.energy) : null;

  const facts: BuildingFacts = {
    id: b.id,
    name: b.name,
    description: b.description,
    group: detectGroup(b),

    unlockTechId: tech?.id ?? null,
    unlockTechName: tech?.name ?? null,
    era: tech?.era ?? 0,
    eraName: tech ? ERA_NAMES[tech.era] ?? null : null,

    requiredDeposit: deposit,

    costResources: toEntries(b.baseCost),
    costCredits: b.creditCost ? D(b.creditCost) : null,
    costFactor: b.costFactor,

    production,
    consumption,
    passiveEnergy: passive && passive.gt(0) ? passive : null,
    activeEnergy: active && active.gt(0) ? active : null,

    powerGridRadius: b.powerGridRadius ?? null,
    logisticsRadius: b.logisticsRadius ?? null,

    combat: b.combat ? { dps: D(b.combat.dps), energyPerSecond: D(b.combat.energyPerSecond) } : null,
    defense: b.defense
      ? {
          shieldMaxHp: D(b.defense.shieldMaxHp),
          shieldRegenPerSecond: D(b.defense.shieldRegenPerSecond),
          energyPerSecond: D(b.defense.energyPerSecond),
        }
      : null,

    storageBonus,

    researchPointsPerSecond: RP_PER_SECOND[b.id] ?? null,
    influencePerSecond: INFLUENCE_PER_SECOND[b.id] ?? null,
    creditsPerSecond: CREDITS_PER_SECOND[b.id] ?? null,

    wastePerSecond: wasteOf(b),
    radioactivePerSecond: radioactiveOf(b),

    canDisable: isBuildingDisableable(b.id),
    evolution: evolutionOf(b.id),

    marketMarginPerSecond: marginOf(b),

    search: '',
  };

  // Поиск идёт по id тоже: игрок мог увидеть его в логах или в чате.
  facts.search = [
    b.name,
    b.id,
    b.description,
    facts.unlockTechName ?? '',
    ...production.map((e) => e.resource),
    ...consumption.map((e) => e.resource),
  ]
    .join(' ')
    .toLowerCase();

  return facts;
}

/**
 * Весь каталог, отсортированный так, как его читают: сначала доступное с начала партии, дальше
 * по эрам, внутри эры — по стоимости в кредитах.
 */
export function buildBuildingReference(buildings: readonly Building[]): BuildingFacts[] {
  return buildings
    .map(buildingFacts)
    .sort((a, b) => {
      if (a.era !== b.era) return a.era - b.era;
      const costA = a.costCredits ? Number(a.costCredits.toString()) : 0;
      const costB = b.costCredits ? Number(b.costCredits.toString()) : 0;
      if (costA !== costB) return costA - costB;
      return a.name.localeCompare(b.name, 'ru');
    });
}

/** Разбивка по группам в порядке BUILDING_GROUPS. Пустые группы отбрасываются. */
export function groupBuildings(
  facts: readonly BuildingFacts[],
): Array<{ group: BuildingGroup; items: BuildingFacts[] }> {
  return BUILDING_GROUPS.map((group) => ({
    group,
    items: facts.filter((f) => f.group === group.id),
  })).filter((entry) => entry.items.length > 0);
}
