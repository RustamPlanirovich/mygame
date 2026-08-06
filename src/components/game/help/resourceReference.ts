/**
 * СПРАВОЧНИК РЕСУРСОВ — «кто это производит и кому это нужно», выведенное из каталога.
 *
 * Это ровно тот вопрос, на который в игре раньше нельзя было получить ответ: панель цепочек
 * рисует граф для ВЫБРАННОЙ клетки, а «кто вообще делает волокно» приходилось искать
 * перебором по списку строительства. Здесь связи считаются один раз обходом каталога.
 *
 * Как и справочник зданий, модуль чистый: базовые лимиты и каталог приходят параметрами,
 * поэтому он не зависит от стора и проверяется тестом.
 */

import type Decimal from 'break_eternity.js';
import type { Building, ResourceType } from '../../../core/gameTypes';
import { D } from '../../../core/math/format';
import { RESOURCE_LABEL } from '../../../core/constants/labels';
import { BASE_RESOURCE_PRICES, TRADEABLE_RESOURCES } from '../../../core/constants/market';
import { resourceIcon } from '../../../core/i18n/label';

/**
 * Группы ресурсов. Порядок повторяет порядок появления в игре, а не алфавит: справочником
 * пользуются, чтобы понять «что дальше», и сырьё обязано стоять раньше трансцендентного.
 */
export type ResourceGroupId =
  | 'raw'
  | 'basic'
  | 'metals'
  | 'components'
  | 'military'
  | 'space'
  | 'consumer'
  | 'culture'
  | 'digital'
  | 'medicine'
  | 'exotic'
  | 'waste';

export interface ResourceGroup {
  id: ResourceGroupId;
  title: string;
  hint: string;
}

export const RESOURCE_GROUPS: readonly ResourceGroup[] = [
  { id: 'raw', title: 'Сырьё', hint: 'Добывается из месторождений' },
  { id: 'basic', title: 'Базовая переработка', hint: 'Первые уровни цепочек' },
  { id: 'metals', title: 'Металлы и сплавы', hint: 'Прочность и космические конструкции' },
  { id: 'components', title: 'Компоненты', hint: 'Электроника и механика' },
  { id: 'military', title: 'Военные', hint: 'Оборона и вооружение' },
  { id: 'space', title: 'Космические', hint: 'Корабли, станции, спутники' },
  { id: 'consumer', title: 'Развлечения', hint: 'Контент и устройства для колоний' },
  { id: 'culture', title: 'Культура', hint: 'Искусство и ремёсла' },
  { id: 'digital', title: 'Цифровые сервисы', hint: 'Сети, облака, ИИ' },
  { id: 'medicine', title: 'Медицина и биотех', hint: 'Здоровье колонистов' },
  { id: 'exotic', title: 'Экзотика и трансцендентность', hint: 'Поздняя игра' },
  { id: 'waste', title: 'Отходы', hint: 'Побочный продукт производства' },
] as const;

/**
 * Явная таблица групп: ресурсов ~90, и вывести группу из данных нельзя — «волокно» и «оружие»
 * ничем в паспорте не отличаются. Ресурс, которого здесь нет, попадает в 'exotic', и это
 * заметно глазом при первом же открытии справочника — то есть пропуск не молчит.
 */
const RESOURCE_GROUP_OF: Readonly<Partial<Record<ResourceType, ResourceGroupId>>> = {
  ore: 'raw',
  ice: 'raw',
  carbon: 'raw',
  sand: 'raw',
  natural_gas: 'raw',
  oil: 'raw',
  uranium: 'raw',
  chrome: 'raw',
  titanium: 'raw',
  copper: 'raw',

  energy: 'basic',
  steel: 'basic',
  gasoline: 'basic',
  plastic: 'basic',
  glass: 'basic',
  chemicals: 'basic',
  liquid_fuel: 'basic',
  fiber: 'basic',
  dynamite: 'basic',

  chrome_alloy: 'metals',
  titanium_alloy: 'metals',
  enriched_uranium: 'metals',

  semiconductors: 'components',
  integrated_circuit: 'components',
  battery: 'components',
  engine: 'components',
  display: 'components',
  computer: 'components',
  robot: 'components',

  weapon: 'military',
  artillery: 'military',
  radar: 'military',
  nuclear_bomb: 'military',

  jet_engine: 'space',
  satellite: 'space',
  rocket: 'space',
  spaceship: 'space',
  console: 'space',
  space_station: 'space',

  music_album: 'consumer',
  movie: 'consumer',
  video_game: 'consumer',
  streaming_service: 'consumer',
  vr_headset: 'consumer',
  ar_glasses: 'consumer',
  gaming_console: 'consumer',
  smart_tv: 'consumer',

  artwork: 'culture',
  sculpture: 'culture',
  literature: 'culture',
  architecture: 'culture',
  fashion: 'culture',
  jewelry: 'culture',

  social_network: 'digital',
  messaging_app: 'digital',
  search_engine: 'digital',
  cloud_service: 'digital',
  ai_assistant: 'digital',
  cryptocurrency: 'digital',

  medicine: 'medicine',
  vaccine: 'medicine',
  bioimplant: 'medicine',
  gene_therapy: 'medicine',
  cryonics: 'medicine',

  dark_matter: 'exotic',
  orbital_habitat: 'exotic',
  dyson_component: 'exotic',
  warp_core: 'exotic',
  quantum_computer: 'exotic',
  antimatter: 'exotic',
  singularity_core: 'exotic',
  time_crystal: 'exotic',
  dimensional_rift: 'exotic',
  omega_matter: 'exotic',
  ascension_essence: 'exotic',

  waste: 'waste',
  radioactive_waste: 'waste',
};

export interface ResourceLink {
  buildingId: string;
  buildingName: string;
  /** Ставка за секунду на первом уровне (для производства/потребления) или объём (для стоимости). */
  amount: Decimal;
}

export interface ResourceFacts {
  id: ResourceType;
  label: string;
  icon: string;
  group: ResourceGroupId;

  /** Базовая вместимость склада без построек и апгрейдов. */
  baseCap: Decimal | null;
  /** Базовая рыночная цена, ₡ за единицу. null — ресурс вне рынка. */
  price: Decimal | null;
  tradeable: boolean;

  /** Кто производит этот ресурс. */
  producedBy: ResourceLink[];
  /** Кто потребляет его как вход. */
  consumedBy: ResourceLink[];
  /** В чьей стоимости постройки он участвует. */
  usedInCostOf: ResourceLink[];

  /** Суммарная ставка выпуска по одной копии каждого производителя, ед./с. */
  totalProduction: Decimal;
  /** То же для потребления. */
  totalConsumption: Decimal;

  search: string;
}

const ZERO = D(0);

export interface ResourceReferenceInput {
  buildings: readonly Building[];
  /** Базовые лимиты складов (BASE_RESOURCE_MAX из gameStore). */
  baseCaps: Partial<Record<ResourceType, Decimal>>;
}

export function buildResourceReference(input: ResourceReferenceInput): ResourceFacts[] {
  const { buildings, baseCaps } = input;
  const tradeable = new Set<string>(TRADEABLE_RESOURCES);

  const byResource = new Map<ResourceType, ResourceFacts>();

  const ensure = (resource: ResourceType): ResourceFacts => {
    const existing = byResource.get(resource);
    if (existing) return existing;
    const price = BASE_RESOURCE_PRICES[resource];
    const cap = baseCaps[resource];
    const fresh: ResourceFacts = {
      id: resource,
      label: RESOURCE_LABEL[resource] ?? resource,
      icon: resourceIcon(resource),
      group: RESOURCE_GROUP_OF[resource] ?? 'exotic',
      baseCap: cap ? D(cap) : null,
      price: price ? D(price) : null,
      tradeable: tradeable.has(resource),
      producedBy: [],
      consumedBy: [],
      usedInCostOf: [],
      totalProduction: ZERO,
      totalConsumption: ZERO,
      search: '',
    };
    byResource.set(resource, fresh);
    return fresh;
  };

  // Все ресурсы, у которых есть базовый лимит, должны попасть в справочник даже если их никто
  // не производит: «его негде взять» — это тоже ответ, и он полезнее пустой строки.
  for (const resource of Object.keys(baseCaps) as ResourceType[]) ensure(resource);

  for (const b of buildings) {
    for (const [resource, amount] of Object.entries(b.production ?? {}) as Array<
      [ResourceType, Decimal | undefined]
    >) {
      if (!amount) continue;
      const value = D(amount);
      if (value.lte(0)) continue;
      const facts = ensure(resource);
      facts.producedBy.push({ buildingId: b.id, buildingName: b.name, amount: value });
      facts.totalProduction = facts.totalProduction.add(value);
    }

    for (const [resource, amount] of Object.entries(b.consumption ?? {}) as Array<
      [ResourceType, Decimal | undefined]
    >) {
      if (!amount) continue;
      const value = D(amount);
      if (value.lte(0)) continue;
      const facts = ensure(resource);
      facts.consumedBy.push({ buildingId: b.id, buildingName: b.name, amount: value });
      facts.totalConsumption = facts.totalConsumption.add(value);
    }

    // Пассивный расход энергии — тоже потребление, и без него энергия выглядела бы почти
    // никому не нужной: `consumption.energy` объявлен лишь у части зданий.
    if (b.energyConsumption) {
      const value = D(b.energyConsumption);
      if (value.gt(0)) {
        const facts = ensure('energy');
        facts.consumedBy.push({ buildingId: b.id, buildingName: b.name, amount: value });
        facts.totalConsumption = facts.totalConsumption.add(value);
      }
    }

    for (const [resource, amount] of Object.entries(b.baseCost ?? {}) as Array<
      [ResourceType, Decimal | undefined]
    >) {
      if (!amount) continue;
      const value = D(amount);
      if (value.lte(0)) continue;
      ensure(resource).usedInCostOf.push({ buildingId: b.id, buildingName: b.name, amount: value });
    }
  }

  const list = [...byResource.values()];

  for (const facts of list) {
    // Внутри каждого списка — по убыванию ставки: первым идёт самый весомый источник/потребитель.
    facts.producedBy.sort((a, b) => b.amount.cmp(a.amount));
    facts.consumedBy.sort((a, b) => b.amount.cmp(a.amount));
    facts.usedInCostOf.sort((a, b) => b.amount.cmp(a.amount));
    facts.search = [
      facts.label,
      facts.id,
      ...facts.producedBy.map((l) => l.buildingName),
      ...facts.consumedBy.map((l) => l.buildingName),
    ]
      .join(' ')
      .toLowerCase();
  }

  const groupOrder = new Map(RESOURCE_GROUPS.map((g, i) => [g.id, i]));
  return list.sort((a, b) => {
    const orderA = groupOrder.get(a.group) ?? 999;
    const orderB = groupOrder.get(b.group) ?? 999;
    if (orderA !== orderB) return orderA - orderB;
    return a.label.localeCompare(b.label, 'ru');
  });
}

/** Разбивка по группам в порядке RESOURCE_GROUPS. Пустые группы отбрасываются. */
export function groupResources(
  facts: readonly ResourceFacts[],
): Array<{ group: ResourceGroup; items: ResourceFacts[] }> {
  return RESOURCE_GROUPS.map((group) => ({
    group,
    items: facts.filter((f) => f.group === group.id),
  })).filter((entry) => entry.items.length > 0);
}
