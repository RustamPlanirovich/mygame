/**
 * ПОДСКАЗКА ЦЕПОЧКИ ДЛЯ СПИСКА ПРОИЗВОДСТВА (bigplan.md, пункт 37)
 *
 * Игрок формулирует задачу так: «мне нужен процессор — какое здание его делает, и что нужно
 * этому зданию». Руками это разворачивается в 5-10 пунктов, и половина забывается: чтобы
 * поставить плавильню, нужны не только руда с углеродом на вход, но и здания, которые их добывают.
 *
 * Модуль ЧИСТЫЙ и ничего не знает ни про стор, ни про UI: на входе каталог зданий (тот же
 * `state.buildings`), на выходе — плоский список пунктов от сырья к цели. Клиент показывает его
 * с галочками, а добавляет только то, что игрок оставил отмеченным.
 *
 * Тесты — planChain.test.ts.
 */

import type { Building, ResourceType, TechnologyId } from '../gameTypes';
import { isBuildingUnlocked } from '../constants/technologies';

/** Цель списка: либо ресурс, который нужно получить, либо конкретное здание. */
export interface ChainTarget {
  kind: 'resource' | 'building';
  refId: string;
}

export interface ChainSuggestion {
  /** В списке это будет пункт-здание: строят именно здания. */
  kind: 'building';
  refId: string;
  /** Название здания из каталога — подписи в JSX берём отсюда, а не из id. */
  label: string;
  /** Сколько таких зданий уже стоит: подсказка «это у тебя есть» и причина не отмечать пункт. */
  built: number;
  /** 0 — само целевое здание, 1 — то, что нужно ему, и так далее вглубь. */
  depth: number;
  /** Ресурс, из-за которого здание попало в список (для подписи «даёт сталь»). */
  producesFor: string | null;
  /** Здание закрыто технологией — построить его нельзя, пока не исследовано. */
  locked: boolean;
}

export interface ChainOptions {
  /** Разблокированные технологии из `state.research.technologies`. */
  unlockedTech?: Record<TechnologyId, boolean>;
  /** Насколько глубоко разворачивать цепочку. */
  maxDepth?: number;
  /** Ограничение на размер результата — панель 400px шириной, а bulk-запрос тоже не бесконечный. */
  maxItems?: number;
}

const DEFAULT_MAX_DEPTH = 5;
const DEFAULT_MAX_ITEMS = 40;

/**
 * Энергию из цепочки исключаем.
 *
 * Её потребляет и стоит почти каждое здание, поэтому «нужен генератор» приписывалось бы к
 * каждому уровню и вытесняло полезные пункты. Энергобаланс — отдельный раздел игры со своим
 * экраном, и подсказка списка его не заменит.
 */
const IGNORED_RESOURCES = new Set<string>(['energy']);

/** Производит ли здание этот ресурс (а не просто упоминает его в множителях склада). */
function producesResource(building: Building, resource: string): boolean {
  const amount = building.production?.[resource as ResourceType];
  return Boolean(amount && amount.gt(0));
}

/**
 * Что нужно зданию: и постоянный вход (`consumption` — то, из чего оно делает продукт), и
 * материалы на постройку (`baseCost`). Для чек-листа это одно и то же: без обоих здание
 * не заработает.
 */
export function buildingInputs(building: Building): string[] {
  const out: string[] = [];
  const push = (resource: string) => {
    if (IGNORED_RESOURCES.has(resource)) return;
    if (!out.includes(resource)) out.push(resource);
  };

  for (const [resource, amount] of Object.entries(building.consumption ?? {})) {
    if (amount && amount.gt(0)) push(resource);
  }
  for (const [resource, amount] of Object.entries(building.baseCost ?? {})) {
    if (amount && amount.gt(0)) push(resource);
  }
  return out;
}

/** Все здания, производящие ресурс. Порядок — как в каталоге. */
export function producersOf(resource: string, buildings: Building[]): Building[] {
  if (IGNORED_RESOURCES.has(resource)) return [];
  return buildings.filter((b) => producesResource(b, resource));
}

/**
 * Какое из производящих зданий предложить.
 *
 * Ресурс обычно делают несколько тиров (v1/v2/v3), и вываливать все — значит утопить подсказку.
 * Порядок предпочтения: разблокированное → уже построенное (значит, игрок пользуется именно этим
 * тиром) → более дешёвое. Сортировка полная и детерминированная: одинаковый ввод даёт одинаковый
 * список, иначе подсказка «прыгала» бы между открытиями панели.
 */
export function pickProducer(
  resource: string,
  buildings: Building[],
  unlockedTech?: Record<TechnologyId, boolean>,
): Building | null {
  const producers = producersOf(resource, buildings);
  if (producers.length === 0) return null;

  const unlocked = (b: Building) => (unlockedTech ? isBuildingUnlocked(b.id, unlockedTech) : true);

  return producers.slice().sort((a, b) => {
    const byUnlocked = Number(unlocked(b)) - Number(unlocked(a));
    if (byUnlocked !== 0) return byUnlocked;

    const byBuilt = Number(b.count > 0) - Number(a.count > 0);
    if (byBuilt !== 0) return byBuilt;

    const costA = a.creditCost ? a.creditCost.toNumber() : Number.POSITIVE_INFINITY;
    const costB = b.creditCost ? b.creditCost.toNumber() : Number.POSITIVE_INFINITY;
    if (costA !== costB) return costA - costB;

    return a.id.localeCompare(b.id);
  })[0];
}

/**
 * Развернуть цель в список пунктов «что построить».
 *
 * Обход в ширину вниз по входам с двумя защитами:
 *   - посещённые ресурсы и здания не разворачиваются повторно. Циклы здесь настоящие: сталь
 *     нужна для зданий, которые сами стоят в цепочке стали, и наивный обход не завершился бы;
 *   - maxDepth/maxItems — потолок на случай новых длинных цепочек в данных.
 *
 * Порядок результата — от самого глубокого к цели: чек-лист выполняется снизу вверх (сначала
 * добыча, потом переработка), и именно в этом порядке пункты попадают в список.
 */
export function suggestChain(
  target: ChainTarget,
  buildings: Building[],
  options: ChainOptions = {},
): ChainSuggestion[] {
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
  const maxItems = options.maxItems ?? DEFAULT_MAX_ITEMS;
  const { unlockedTech } = options;

  const byId = new Map(buildings.map((b) => [b.id, b]));
  const seenResources = new Set<string>();
  const seenBuildings = new Set<string>();
  const found: ChainSuggestion[] = [];
  /** Очередь «ресурс, который надо чем-то производить» + глубина. */
  const queue: Array<{ resource: string; depth: number }> = [];

  const add = (building: Building, depth: number, producesFor: string | null) => {
    if (seenBuildings.has(building.id) || found.length >= maxItems) return;
    seenBuildings.add(building.id);
    found.push({
      kind: 'building',
      refId: building.id,
      label: building.name,
      built: building.count,
      depth,
      producesFor,
      locked: unlockedTech ? !isBuildingUnlocked(building.id, unlockedTech) : false,
    });
    if (depth >= maxDepth) return;
    for (const input of buildingInputs(building)) {
      if (!seenResources.has(input)) queue.push({ resource: input, depth: depth + 1 });
    }
  };

  if (target.kind === 'building') {
    const building = byId.get(target.refId);
    if (!building) return [];
    add(building, 0, null);
  } else {
    if (IGNORED_RESOURCES.has(target.refId)) return [];
    queue.push({ resource: target.refId, depth: 0 });
  }

  while (queue.length > 0 && found.length < maxItems) {
    const { resource, depth } = queue.shift()!;
    if (seenResources.has(resource) || depth > maxDepth) continue;
    seenResources.add(resource);

    const producer = pickProducer(resource, buildings, unlockedTech);
    // Ресурс без производителя — это либо сырьё с месторождений, либо покупка на бирже.
    // Пункта «построить» для него нет, и выдумывать его нельзя.
    if (!producer) continue;

    add(producer, depth, resource);
  }

  // Стабильная сортировка: глубже — раньше, внутри уровня сохраняется порядок обхода.
  return found
    .map((item, index) => ({ item, index }))
    .sort((a, b) => b.item.depth - a.item.depth || a.index - b.index)
    .map(({ item }) => item);
}
