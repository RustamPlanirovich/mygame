/**
 * МЕСТОРОЖДЕНИЯ: ГЕНЕРАЦИЯ ЖИЛАМИ И ИХ ИСТОЩЕНИЕ (bigplan.md, пункт 38).
 *
 * ЧТО БЫЛО. Депозиты рассыпались независимым броском на КАЖДУЮ клетку, и сумма шансов
 * десяти типов равнялась 0.515 — больше половины карты оказывалась месторождением.
 * Последствий два, и оба скучные: во-первых, «куда ставить шахту» переставало быть
 * вопросом (свободная клетка почти всегда рядом), во-вторых, соль-с-перцем не читается
 * глазом — карта выглядит однородным шумом, а не местностью с рудным районом и ледяным
 * полем. Плюс редкий уран встречался почти так же часто, как руда: 0.02 против 0.10 —
 * разница в пять раз там, где по смыслу нужны порядки.
 *
 * ЧТО СТАЛО. Клетки раздаются ПЯТНАМИ (жилами): выбирается центр, тип по весу редкости и
 * размер пятна, дальше пятно растёт случайным блужданием по соседям ТЕКУЩЕЙ геометрии
 * (гекс/квадрат — та же, по которой считаются соседство и энергосеть). Общая доля
 * занятых клеток задаётся одним числом `coverage`, а не суммой десяти независимых шансов,
 * которую никто не держал в уме.
 *
 * ИСТОЩЕНИЕ. У каждой клетки есть запас в единицах ресурса. Добывающее здание вычитает из
 * него ровно то, что произвело; когда запас кончился, здание считается РАЗРУШЕННЫМ
 * (состояние вычисляемое — см. isTileRuined, отдельного флага в сейве нет и рассинхрону
 * взяться неоткуда). Разрушенное не производит, а при сносе отдаёт долю всего вложенного.
 *
 * Запас задаётся не абсолютным числом, а ЧАСАМИ работы добытчика первого уровня: ставки у
 * зданий разные (руда 0.6/с, уран 0.18/с), и фиксированные «50 000 единиц» означали бы для
 * урана втрое более долгую клетку, чем для руды. Часы переводятся в единицы через ставку,
 * которую передаёт вызывающий, — каталог зданий живёт в gameStore, и тащить его сюда
 * значило бы завести цикл модулей.
 */

import type { DepositType } from '../gameTypes';
import { gridDistance, gridNeighbors, type GridGeometry } from '../math/hexGeometry';

/** Остаток и первоначальный объём клетки. Строки — как в буферах: в гриде нет живых Decimal. */
export interface DepositReserve {
  /** Сколько единиц ресурса ещё можно добыть. */
  left: string;
  /** Сколько было при генерации — нужно, чтобы показать «осталось 40%». */
  total: string;
}

export type DepositReserves = Record<string, DepositReserve>;

/** Профиль типа месторождения: частота, размер жилы и «на сколько её хватит». */
export interface DepositProfile {
  /** Вес при выборе типа для нового пятна. Редкое — маленький вес. */
  weight: number;
  /** Размер жилы в клетках. */
  patch: { min: number; max: number };
  /** Сколько часов клетка кормит добытчик ПЕРВОГО уровня. */
  hours: { min: number; max: number };
}

/**
 * Веса и размеры жил.
 *
 * Базовая тройка (руда/лёд/углерод) — крупные жилы и большой вес: с них начинается любая
 * цепочка, и «не нашёл руду» не должно быть возможным исходом генерации. Металлы и уран —
 * редкие точечные вкрапления: их ценность именно в том, что под них надо тянуть логистику,
 * а не строить рядом с базой.
 *
 * Часы посчитаны для первого уровня. Уровень умножает выпуск линейно, поэтому шахта 10-го
 * уровня съедает ту же жилу вдесятеро быстрее — это и есть цена разгона.
 */
export const DEPOSIT_PROFILES: Record<DepositType, DepositProfile> = {
  ore: { weight: 22, patch: { min: 4, max: 9 }, hours: { min: 24, max: 48 } },
  ice: { weight: 18, patch: { min: 3, max: 8 }, hours: { min: 24, max: 48 } },
  carbon: { weight: 16, patch: { min: 3, max: 8 }, hours: { min: 24, max: 48 } },
  sand: { weight: 12, patch: { min: 4, max: 9 }, hours: { min: 20, max: 40 } },
  natural_gas: { weight: 9, patch: { min: 2, max: 5 }, hours: { min: 18, max: 36 } },
  oil: { weight: 8, patch: { min: 2, max: 5 }, hours: { min: 18, max: 36 } },
  copper: { weight: 7, patch: { min: 2, max: 5 }, hours: { min: 18, max: 36 } },
  chrome: { weight: 4, patch: { min: 1, max: 3 }, hours: { min: 12, max: 24 } },
  titanium: { weight: 3, patch: { min: 1, max: 3 }, hours: { min: 12, max: 24 } },
  uranium: { weight: 2, patch: { min: 1, max: 3 }, hours: { min: 10, max: 20 } },
};

/** Типы, под которые в игре есть добывающее здание. Всё остальное на карту класть нельзя. */
export const EXTRACTABLE_DEPOSITS = Object.keys(DEPOSIT_PROFILES) as DepositType[];

/**
 * Какое месторождение нужно зданию под собой.
 *
 * Таблица жила в ТРЁХ местах сразу: в gameStore, в TileInspector и прямо в обработчике
 * клика FactoryGrid. Пока это влияло только на «можно ли поставить», расхождение было бы
 * незаметным; с истощением от неё зависит ещё и «разрушено ли здание», и три копии
 * гарантированно разошлись бы на первом же новом добытчике.
 */
export const BUILDING_DEPOSIT_REQUIREMENT: Record<string, DepositType> = {
  miner_mk1: 'ore',
  ice_extractor_mk1: 'ice',
  carbon_harvester_mk1: 'carbon',
  // Фаза 2: новые добывающие здания
  gas_well_mk1: 'natural_gas',
  oil_well_mk1: 'oil',
  sand_quarry_mk1: 'sand',
  // Фаза 2.3: металлические шахты
  uranium_mine_mk1: 'uranium',
  chrome_mine_mk1: 'chrome',
  titanium_mine_mk1: 'titanium',
  // Фаза 2.4: медная шахта
  copper_mine_mk1: 'copper',
};

/** Месторождение, нужное зданию, или null для всего остального. */
export function requiredDepositForBuilding(buildingId: string | undefined | null): DepositType | null {
  if (!buildingId) return null;
  return BUILDING_DEPOSIT_REQUIREMENT[buildingId] ?? null;
}

/**
 * Что обязано быть рядом с базой.
 *
 * Стартовая цепочка (майнер → плавильня) требует руды и углерода, а лёд нужен под первую
 * же переработку. Если генератор не гарантирует их поблизости, партия иногда начинается в
 * тупике: строить нечего, а до ближайшей жилы полкарты без энергосети.
 */
export const STARTER_DEPOSITS: DepositType[] = ['ore', 'ice', 'carbon'];

/** Доля клеток под месторождениями по умолчанию. Было ~0.51 суммой независимых бросков. */
export const DEFAULT_DEPOSIT_COVERAGE = 0.14;

/** В каком радиусе от базы гарантируются стартовые жилы. */
const STARTER_RADIUS = 5;

/** Ближе этого к базе месторождений не бывает: клетки вокруг ядра нужны под инфраструктуру. */
const MIN_DIST_FROM_BASE = 2;

/** Возврат за снос РАЗРУШЕННОГО здания — доля от всего вложенного, включая улучшения. */
export const RUIN_REFUND_MIN = 0.25;
export const RUIN_REFUND_MAX = 0.5;

/** Случайная доля возврата в [25%, 50%]. Бросок отдаётся снаружи, чтобы план сноса был чистым. */
export function rollRuinRefundRate(roll: number): number {
  const clamped = Math.max(0, Math.min(1, roll));
  return RUIN_REFUND_MIN + clamped * (RUIN_REFUND_MAX - RUIN_REFUND_MIN);
}

export interface GenerateDepositsInput {
  width: number;
  height: number;
  /** Клетка базы: на ней и вплотную к ней месторождений не бывает. */
  base: { x: number; y: number };
  /** Геометрия карты — по ней растут жилы, чтобы пятно было связным на экране. */
  geometry: GridGeometry;
  /** Какие типы вообще доступны на этой карте. По умолчанию — все добываемые. */
  types?: DepositType[];
  /** Доля клеток под месторождениями. */
  coverage?: number;
  /** Множитель запаса (модификаторы карты rich_deposits / poor_deposits). */
  richness?: number;
  /** Ставка добычи ресурса в секунду на первом уровне — из каталога зданий. */
  ratePerSecond: (deposit: DepositType) => number;
  /** Источник случайности. Тесты передают детерминированный. */
  rng?: () => number;
  /** Уже занятые клетки (например, при расширении сетки) — их не трогаем. */
  taken?: (key: string) => boolean;
  /** Прямоугольник, внутри которого разрешено ставить жилы. По умолчанию — вся карта. */
  area?: { x0: number; y0: number; x1: number; y1: number };
}

export interface GeneratedDeposits {
  deposits: Record<string, DepositType>;
  reserves: DepositReserves;
}

const keyOf = (x: number, y: number) => `${x},${y}`;

/** Целое в [min, max]. */
function randInt(rng: () => number, min: number, max: number): number {
  if (max <= min) return min;
  return min + Math.floor(rng() * (max - min + 1));
}

/** Число в [min, max). */
function randFloat(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

/** Выбор типа по весам профилей. */
function pickWeighted(rng: () => number, types: DepositType[]): DepositType {
  let total = 0;
  for (const t of types) total += DEPOSIT_PROFILES[t]?.weight ?? 1;
  let roll = rng() * total;
  for (const t of types) {
    roll -= DEPOSIT_PROFILES[t]?.weight ?? 1;
    if (roll <= 0) return t;
  }
  return types[types.length - 1];
}

/**
 * Запас одной клетки в единицах ресурса.
 *
 * Округляется до целого: остаток показывается игроку числом, и «41 999.7 руды» — шум.
 */
export function rollReserve(
  deposit: DepositType,
  ratePerSecond: number,
  rng: () => number,
  richness = 1,
): number {
  const profile = DEPOSIT_PROFILES[deposit];
  const hours = profile
    ? randFloat(rng, profile.hours.min, profile.hours.max)
    : randFloat(rng, 12, 24);
  // Ставка может прийти нулевой, если у типа нет добытчика: тогда запас всё равно должен
  // быть положительным, иначе клетка родится сразу выработанной.
  const rate = ratePerSecond > 0 ? ratePerSecond : 0.25;
  return Math.max(1, Math.round(rate * 3600 * hours * Math.max(0.05, richness)));
}

/**
 * Разложить месторождения жилами.
 *
 * Порядок важен: сначала гарантированные стартовые жилы у базы, потом добор до целевого
 * покрытия по весам. Иначе редкий бросок мог оставить старт без руды — а это не «сложная
 * карта», это испорченная партия.
 */
export function generateDepositField(input: GenerateDepositsInput): GeneratedDeposits {
  const {
    width,
    height,
    base,
    geometry,
    coverage = DEFAULT_DEPOSIT_COVERAGE,
    richness = 1,
    ratePerSecond,
    rng = Math.random,
    taken,
  } = input;

  const types = (input.types && input.types.length > 0 ? input.types : EXTRACTABLE_DEPOSITS).filter(
    (t) => DEPOSIT_PROFILES[t] !== undefined,
  );

  const deposits: Record<string, DepositType> = {};
  const reserves: DepositReserves = {};

  if (width <= 0 || height <= 0 || types.length === 0) return { deposits, reserves };

  const area = input.area ?? { x0: 0, y0: 0, x1: width, y1: height };
  const areaWidth = Math.max(0, area.x1 - area.x0);
  const areaHeight = Math.max(0, area.y1 - area.y0);
  const areaCells = areaWidth * areaHeight;
  if (areaCells <= 0) return { deposits, reserves };

  const budget = Math.round(areaCells * Math.max(0, Math.min(0.9, coverage)));
  if (budget <= 0) return { deposits, reserves };

  const inArea = (x: number, y: number) =>
    x >= area.x0 && x < area.x1 && y >= area.y0 && y < area.y1;

  const isFree = (x: number, y: number) => {
    if (!inArea(x, y)) return false;
    const key = keyOf(x, y);
    if (deposits[key]) return false;
    if (taken?.(key)) return false;
    // Расстояние — в шагах по геометрии карты, тем же правилом, что у энергосети.
    if (gridDistance(geometry, x, y, base.x, base.y) < MIN_DIST_FROM_BASE) return false;
    return true;
  };

  let placed = 0;
  const placedTypes = new Set<DepositType>();

  /** Положить одну жилу от центра (cx, cy). Возвращает, сколько клеток удалось занять. */
  const growPatch = (cx: number, cy: number, type: DepositType, limit: number): number => {
    const profile = DEPOSIT_PROFILES[type];
    const size = Math.min(limit, randInt(rng, profile.patch.min, profile.patch.max));
    if (size <= 0) return 0;

    const rate = ratePerSecond(type);
    const frontier: Array<{ x: number; y: number }> = [{ x: cx, y: cy }];
    let grown = 0;

    while (frontier.length > 0 && grown < size) {
      // Случайная клетка фронта, а не первая: обход в ширину дал бы аккуратные ромбы,
      // а жила должна выглядеть неровной.
      const idx = Math.floor(rng() * frontier.length);
      const cell = frontier.splice(idx, 1)[0];
      if (!isFree(cell.x, cell.y)) continue;

      const key = keyOf(cell.x, cell.y);
      deposits[key] = type;
      const total = rollReserve(type, rate, rng, richness);
      reserves[key] = { left: String(total), total: String(total) };
      grown += 1;

      for (const n of gridNeighbors(geometry, cell.x, cell.y)) {
        if (isFree(n.x, n.y)) frontier.push(n);
      }
    }

    if (grown > 0) placedTypes.add(type);
    placed += grown;
    return grown;
  };

  /** Случайная свободная клетка в заданном радиусе от точки. null, если таких нет. */
  const findFreeNear = (
    ox: number,
    oy: number,
    radius: number,
    attempts = 40,
  ): { x: number; y: number } | null => {
    for (let i = 0; i < attempts; i++) {
      const x = ox + randInt(rng, -radius, radius);
      const y = oy + randInt(rng, -radius, radius);
      if (isFree(x, y)) return { x, y };
    }
    return null;
  };

  /** Случайная свободная клетка где угодно в разрешённой области. */
  const findFreeAnywhere = (attempts = 48): { x: number; y: number } | null => {
    for (let i = 0; i < attempts; i++) {
      const x = randInt(rng, area.x0, area.x1 - 1);
      const y = randInt(rng, area.y0, area.y1 - 1);
      if (isFree(x, y)) return { x, y };
    }
    return null;
  };

  // 1. Гарантированные стартовые жилы у базы.
  for (const type of STARTER_DEPOSITS) {
    if (placed >= budget) break;
    if (!types.includes(type)) continue;
    const spot = findFreeNear(base.x, base.y, STARTER_RADIUS);
    if (!spot) continue;
    growPatch(spot.x, spot.y, type, budget - placed);
  }

  // 2. По одной жиле каждому доступному типу — иначе цепочка производства может оказаться
  //    без сырья вообще, и понять это игрок сможет только обойдя всю карту.
  for (const type of types) {
    if (placed >= budget) break;
    if (placedTypes.has(type)) continue;
    const spot = findFreeAnywhere(64);
    if (!spot) continue;
    growPatch(spot.x, spot.y, type, budget - placed);
  }

  // 3. Добор до целевого покрытия по весам редкости.
  //    Ограничение по числу попыток — страховка от карты, где свободных клеток уже нет
  //    (узкие острова asteroid_field): без него цикл крутился бы вечно.
  let attempts = 0;
  const maxAttempts = budget * 4 + 64;
  while (placed < budget && attempts < maxAttempts) {
    attempts += 1;
    const spot = findFreeAnywhere(16);
    if (!spot) continue;
    growPatch(spot.x, spot.y, pickWeighted(rng, types), budget - placed);
  }

  return { deposits, reserves };
}

/**
 * Досоздать запасы для депозитов, у которых их нет.
 *
 * Нужно ровно для сейвов, сделанных до появления истощения: там `deposits` есть, а
 * `depositReserves` нет, и без этого каждая старая шахта считалась бы выработанной с
 * первого же тика. Возвращает ИСХОДНУЮ ссылку, когда добавлять нечего, — чтобы загрузка
 * не создавала новый объект на ровном месте.
 */
export function ensureReserves(
  deposits: Record<string, DepositType> | undefined,
  reserves: DepositReserves | undefined,
  ratePerSecond: (deposit: DepositType) => number,
  rng: () => number = Math.random,
): DepositReserves {
  const current = reserves ?? {};
  if (!deposits) return current;

  let next: DepositReserves | null = null;
  for (const [key, type] of Object.entries(deposits)) {
    if (current[key]) continue;
    if (!next) next = { ...current };
    const total = rollReserve(type, ratePerSecond(type), rng);
    next[key] = { left: String(total), total: String(total) };
  }

  return next ?? current;
}

/** Остаток клетки. Неизвестная клетка — 0: месторождения там нет. */
export function depositLeft(reserves: DepositReserves | undefined, key: string): number {
  const entry = reserves?.[key];
  if (!entry) return 0;
  const left = Number(entry.left);
  return Number.isFinite(left) ? Math.max(0, left) : 0;
}

/** Первоначальный объём клетки. */
export function depositTotal(reserves: DepositReserves | undefined, key: string): number {
  const entry = reserves?.[key];
  if (!entry) return 0;
  const total = Number(entry.total);
  return Number.isFinite(total) && total > 0 ? total : 0;
}

/** Доля оставшегося, 0..1. Без записи о запасе — 1: старый сейв не должен выглядеть пустым. */
export function depositRatio(reserves: DepositReserves | undefined, key: string): number {
  const entry = reserves?.[key];
  if (!entry) return 1;
  const total = depositTotal(reserves, key);
  if (total <= 0) return 0;
  return Math.max(0, Math.min(1, depositLeft(reserves, key) / total));
}

/**
 * Выработана ли клетка.
 *
 * Клетка БЕЗ записи о запасе выработанной не считается: это либо старый сейв, либо клетка
 * без месторождения, и в обоих случаях «здание разрушено» было бы ложью.
 */
export function isDepositExhausted(reserves: DepositReserves | undefined, key: string): boolean {
  const entry = reserves?.[key];
  if (!entry) return false;
  return depositLeft(reserves, key) <= 0;
}

/**
 * Разрушено ли здание на клетке.
 *
 * Состояние ВЫЧИСЛЯЕМОЕ: отдельного флага в сейве нет, поэтому «здание разрушено» и «запас
 * кончился» не могут разойтись. Разрушенным считается только добытчик — фабрика на клетке
 * с выработанной жилой работает как раньше, ей месторождение не нужно.
 */
export function isTileRuined(
  requiredDeposit: DepositType | null,
  reserves: DepositReserves | undefined,
  key: string,
): boolean {
  if (!requiredDeposit) return false;
  return isDepositExhausted(reserves, key);
}

/**
 * Списать добытое из запаса.
 *
 * Возвращает, сколько реально удалось взять (последний тик забирает остаток, а не уходит в
 * минус), и признак «клетка только что кончилась» — по нему тик шлёт уведомление ровно один
 * раз. Мутирует переданный объект: тик идёт 20 раз в секунду, и копия карты запасов на
 * каждое списание была бы заметна.
 */
export function drainDeposit(
  reserves: DepositReserves,
  key: string,
  amount: number,
): { taken: number; exhausted: boolean } {
  const entry = reserves[key];
  if (!entry) return { taken: amount, exhausted: false };

  const left = depositLeft(reserves, key);
  if (left <= 0) return { taken: 0, exhausted: false };

  const taken = Math.min(left, Math.max(0, amount));
  const nextLeft = left - taken;
  reserves[key] = { left: String(nextLeft), total: entry.total };
  return { taken, exhausted: nextLeft <= 0 };
}
