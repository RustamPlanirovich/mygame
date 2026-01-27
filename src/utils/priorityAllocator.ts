/**
 * Система распределения ресурсов по приоритетам (Фаза 5)
 * 
 * При нехватке ресурсов здания с высоким приоритетом получают первыми.
 * Priority 5 → получает 100% доступного
 * Priority 1 → получает остатки
 */

import Decimal from 'break_eternity.js';
import { D } from '../core/math/format';
import type { ResourceType } from '../core/gameTypes';
import type { ResourcePriority, TileBuildingSettings } from '../core/gameTypes.buildings';

// ═══════════════════════════════════════════════════════════════
// ТИПЫ
// ═══════════════════════════════════════════════════════════════

/**
 * Запрос на ресурс от здания
 */
export interface ResourceRequest {
  tileKey: string;
  buildingId: string;
  resource: ResourceType;
  amount: Decimal;               // Сколько требуется
  priority: ResourcePriority;    // Приоритет запроса
}

/**
 * Результат распределения
 */
export interface AllocationResult {
  tileKey: string;
  buildingId: string;
  resource: ResourceType;
  requested: Decimal;            // Сколько запрошено
  allocated: Decimal;            // Сколько выделено
  fulfilled: number;             // % выполнения (0-100)
}

/**
 * Группа запросов по приоритету
 */
interface PriorityGroup {
  priority: ResourcePriority;
  requests: ResourceRequest[];
  totalRequested: Decimal;
}

// ═══════════════════════════════════════════════════════════════
// ОСНОВНОЙ АЛГОРИТМ
// ═══════════════════════════════════════════════════════════════

/**
 * Распределить доступный ресурс между зданиями по приоритетам
 * 
 * Алгоритм:
 * 1. Группируем запросы по приоритету
 * 2. Начиная с высшего приоритета (5), выделяем ресурсы
 * 3. Если ресурса достаточно - выделяем 100%
 * 4. Если недостаточно - распределяем пропорционально внутри группы
 * 5. Остаток переходит к следующему приоритету
 */
export function allocateResource(
  requests: ResourceRequest[],
  available: Decimal
): AllocationResult[] {
  if (requests.length === 0) return [];
  if (available.lte(0)) {
    // Нет ресурса - все получают 0
    return requests.map(req => ({
      tileKey: req.tileKey,
      buildingId: req.buildingId,
      resource: req.resource,
      requested: req.amount,
      allocated: D(0),
      fulfilled: 0,
    }));
  }

  // Группируем по приоритету
  const groups = groupByPriority(requests);
  
  // Сортируем группы по убыванию приоритета (5 → 1)
  groups.sort((a, b) => b.priority - a.priority);

  let remaining = available;
  const results: AllocationResult[] = [];

  for (const group of groups) {
    if (remaining.lte(0)) {
      // Ресурс закончился - остальные получают 0
      for (const req of group.requests) {
        results.push({
          tileKey: req.tileKey,
          buildingId: req.buildingId,
          resource: req.resource,
          requested: req.amount,
          allocated: D(0),
          fulfilled: 0,
        });
      }
      continue;
    }

    if (remaining.gte(group.totalRequested)) {
      // Ресурса достаточно для всей группы
      for (const req of group.requests) {
        results.push({
          tileKey: req.tileKey,
          buildingId: req.buildingId,
          resource: req.resource,
          requested: req.amount,
          allocated: req.amount,
          fulfilled: 100,
        });
      }
      remaining = remaining.sub(group.totalRequested);
    } else {
      // Ресурса недостаточно - распределяем пропорционально
      const ratio = remaining.div(group.totalRequested);
      for (const req of group.requests) {
        const allocated = req.amount.mul(ratio);
        const fulfilled = req.amount.gt(0) 
          ? allocated.div(req.amount).mul(100).toNumber() 
          : 0;
        results.push({
          tileKey: req.tileKey,
          buildingId: req.buildingId,
          resource: req.resource,
          requested: req.amount,
          allocated,
          fulfilled: Math.round(fulfilled),
        });
      }
      remaining = D(0);
    }
  }

  return results;
}

/**
 * Группировать запросы по приоритету
 */
function groupByPriority(requests: ResourceRequest[]): PriorityGroup[] {
  const groupMap = new Map<ResourcePriority, PriorityGroup>();

  for (const req of requests) {
    let group = groupMap.get(req.priority);
    if (!group) {
      group = {
        priority: req.priority,
        requests: [],
        totalRequested: D(0),
      };
      groupMap.set(req.priority, group);
    }
    group.requests.push(req);
    group.totalRequested = group.totalRequested.add(req.amount);
  }

  return Array.from(groupMap.values());
}

// ═══════════════════════════════════════════════════════════════
// ХЕЛПЕРЫ ДЛЯ СОЗДАНИЯ ЗАПРОСОВ
// ═══════════════════════════════════════════════════════════════

/**
 * Создать запрос на ресурс от здания
 */
export function createResourceRequest(
  tileKey: string,
  buildingId: string,
  resource: ResourceType,
  amount: Decimal,
  settings?: TileBuildingSettings
): ResourceRequest {
  // Получаем приоритет из настроек или используем дефолтный (3)
  const priority: ResourcePriority = settings?.inputPriorities?.[resource] ?? 3;
  
  return {
    tileKey,
    buildingId,
    resource,
    amount,
    priority,
  };
}

/**
 * Собрать все запросы на один ресурс от всех зданий
 */
export function collectResourceRequests(
  tiles: Record<string, string>,           // tileKey → buildingId
  resourceNeeds: Record<string, Decimal>,  // tileKey → amount needed
  resource: ResourceType,
  settingsMap: Record<string, TileBuildingSettings>
): ResourceRequest[] {
  const requests: ResourceRequest[] = [];

  for (const [tileKey, buildingId] of Object.entries(tiles)) {
    const need = resourceNeeds[tileKey];
    if (!need || need.lte(0)) continue;

    const settings = settingsMap[tileKey];
    requests.push(createResourceRequest(tileKey, buildingId, resource, need, settings));
  }

  return requests;
}

// ═══════════════════════════════════════════════════════════════
// РАСПРЕДЕЛЕНИЕ НЕСКОЛЬКИХ РЕСУРСОВ
// ═══════════════════════════════════════════════════════════════

/**
 * Распределить несколько ресурсов
 */
export function allocateMultipleResources(
  requestsByResource: Record<ResourceType, ResourceRequest[]>,
  availableResources: Record<ResourceType, Decimal>
): Record<ResourceType, AllocationResult[]> {
  const results: Record<ResourceType, AllocationResult[]> = {} as any;

  for (const [resource, requests] of Object.entries(requestsByResource)) {
    const resType = resource as ResourceType;
    const available = availableResources[resType] ?? D(0);
    results[resType] = allocateResource(requests, available);
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════
// WEIGHTED FAIR ALLOCATION (альтернативный алгоритм)
// ═══════════════════════════════════════════════════════════════

/**
 * Weighted Fair Queueing - взвешенное справедливое распределение
 * 
 * Каждый приоритет получает вес:
 * - Priority 5: weight 16
 * - Priority 4: weight 8
 * - Priority 3: weight 4
 * - Priority 2: weight 2
 * - Priority 1: weight 1
 * 
 * Ресурс распределяется пропорционально весам
 */
export function allocateResourceWeighted(
  requests: ResourceRequest[],
  available: Decimal
): AllocationResult[] {
  if (requests.length === 0) return [];

  const PRIORITY_WEIGHTS: Record<ResourcePriority, number> = {
    5: 16,
    4: 8,
    3: 4,
    2: 2,
    1: 1,
  };

  // Рассчитываем взвешенный запрос для каждого
  const weighted = requests.map(req => ({
    ...req,
    weight: PRIORITY_WEIGHTS[req.priority],
    weightedAmount: req.amount.mul(PRIORITY_WEIGHTS[req.priority]),
  }));

  const totalWeightedAmount = weighted.reduce(
    (sum, w) => sum.add(w.weightedAmount),
    D(0)
  );

  const totalRequested = requests.reduce(
    (sum, r) => sum.add(r.amount),
    D(0)
  );

  // Если достаточно для всех - выделяем полностью
  if (available.gte(totalRequested)) {
    return requests.map(req => ({
      tileKey: req.tileKey,
      buildingId: req.buildingId,
      resource: req.resource,
      requested: req.amount,
      allocated: req.amount,
      fulfilled: 100,
    }));
  }

  // Иначе распределяем по весам
  const results: AllocationResult[] = [];
  let remainingResource = available;

  // Сортируем по приоритету (высокий первый)
  weighted.sort((a, b) => b.priority - a.priority);

  for (const w of weighted) {
    if (remainingResource.lte(0)) {
      results.push({
        tileKey: w.tileKey,
        buildingId: w.buildingId,
        resource: w.resource,
        requested: w.amount,
        allocated: D(0),
        fulfilled: 0,
      });
      continue;
    }

    // Доля этого запроса от общего взвешенного
    const share = w.weightedAmount.div(totalWeightedAmount);
    // Сколько ресурса причитается
    let allocated = available.mul(share);
    // Но не больше чем запрошено
    allocated = allocated.min(w.amount);
    // И не больше чем осталось
    allocated = allocated.min(remainingResource);

    remainingResource = remainingResource.sub(allocated);

    const fulfilled = w.amount.gt(0)
      ? allocated.div(w.amount).mul(100).toNumber()
      : 0;

    results.push({
      tileKey: w.tileKey,
      buildingId: w.buildingId,
      resource: w.resource,
      requested: w.amount,
      allocated,
      fulfilled: Math.round(fulfilled),
    });
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════
// УТИЛИТЫ
// ═══════════════════════════════════════════════════════════════

/**
 * Проверить, все ли запросы выполнены полностью
 */
export function allRequestsFulfilled(results: AllocationResult[]): boolean {
  return results.every(r => r.fulfilled >= 100);
}

/**
 * Получить суммарный % выполнения
 */
export function getAverageFullfillment(results: AllocationResult[]): number {
  if (results.length === 0) return 100;
  const sum = results.reduce((acc, r) => acc + r.fulfilled, 0);
  return Math.round(sum / results.length);
}

/**
 * Получить список зданий с неполным выполнением
 */
export function getUnfulfilledBuildings(
  results: AllocationResult[]
): AllocationResult[] {
  return results.filter(r => r.fulfilled < 100);
}
