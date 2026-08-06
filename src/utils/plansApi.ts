/**
 * API списков производства (bigplan.md, пункт 37).
 *
 * Единственное место, где snake_case из БД превращается в camelCase: сервер отдаёт строки
 * таблицы почти как есть, и если маппинг растащить по компонентам, половина полей рано или
 * поздно начнёт читаться под двумя именами.
 *
 * Ошибки не бросаем, а возвращаем `{ ok: false, error }` — как в settingsApi: список это
 * вспомогательный инструмент, и пропавшая сеть не должна ронять панель.
 */

import { getAuthHeaders } from './settingsApi';

const API_URL = import.meta.env.VITE_API_URL || '';

export type PlanItemKind = 'building' | 'resource' | 'note';

export interface PlanItem {
  id: number;
  kind: PlanItemKind;
  /** id здания или ресурса; у заметки — null. */
  refId: string | null;
  /** Свободный комментарий (у заметки это и есть содержимое пункта). */
  text: string | null;
  /** Сколько построить / сколько накопить. null — просто «сделать». */
  targetCount: number | null;
  done: boolean;
  doneAt: string | null;
  pinned: boolean;
  sortOrder: number;
}

export interface ProductionPlan {
  id: number;
  slotId: number | null;
  title: string;
  goalKind: 'building' | 'resource' | null;
  goalRef: string | null;
  pinned: boolean;
  archived: boolean;
  sortOrder: number;
  items: PlanItem[];
}

/** Черновик пункта — то, что уходит на сервер при добавлении. */
export interface PlanItemDraft {
  kind: PlanItemKind;
  refId?: string | null;
  text?: string | null;
  targetCount?: number | null;
  pinned?: boolean;
}

export interface PlanItemPatch {
  done?: boolean;
  pinned?: boolean;
  text?: string | null;
  targetCount?: number | null;
}

interface ApiResult<T> {
  ok: boolean;
  error?: string;
  data?: T;
}

/** Понятный текст вместо кода ошибки сервера. */
export function humanizePlansError(code: string | undefined): string {
  switch (code) {
    case 'INVALID_TITLE':
      return 'Название списка пустое';
    case 'INVALID_ITEM':
      return 'Пункт нечем показать: выберите здание/ресурс или напишите текст';
    case 'TOO_MANY_PLANS':
      return 'Слишком много списков — удалите или сдайте в архив ненужные';
    case 'TOO_MANY_ITEMS':
      return 'В списке слишком много пунктов';
    case 'PLAN_NOT_FOUND':
    case 'ITEM_NOT_FOUND':
      return 'Список или пункт уже удалён — обновите панель';
    case 'SLOT_NOT_FOUND':
      return 'Слот сохранения не найден — перезагрузите страницу';
    case 'NOT_AUTHENTICATED':
      return 'Сессия истекла, войдите заново';
    case 'CONNECTION_ERROR':
      return 'Нет связи с сервером';
    default:
      return code ? `Ошибка: ${code}` : 'Не удалось сохранить изменения';
  }
}

async function request<T>(
  path: string,
  init: RequestInit,
  pick: (data: Record<string, unknown>) => T,
): Promise<ApiResult<T>> {
  try {
    const response = await fetch(`${API_URL}${path}`, { headers: getAuthHeaders(), ...init });
    const data = await response.json().catch(() => ({ ok: false, error: 'INVALID_JSON' }));
    if (!response.ok || !data.ok) {
      return { ok: false, error: String(data.error ?? `HTTP_${response.status}`) };
    }
    return { ok: true, data: pick(data) };
  } catch (e) {
    console.warn(`[plans] ${path}:`, e);
    return { ok: false, error: 'CONNECTION_ERROR' };
  }
}

export function fetchPlans(slotId: number | null): Promise<ApiResult<ProductionPlan[]>> {
  const query = slotId !== null ? `?slotId=${encodeURIComponent(slotId)}` : '';
  return request(`/api/plans${query}`, { method: 'GET' }, (data) => (data.plans ?? []) as ProductionPlan[]);
}

export function createPlan(input: {
  title: string;
  slotId: number | null;
  goalKind?: 'building' | 'resource' | null;
  goalRef?: string | null;
}): Promise<ApiResult<ProductionPlan>> {
  return request(
    '/api/plans',
    { method: 'POST', body: JSON.stringify(input) },
    (data) => data.plan as ProductionPlan,
  );
}

export function updatePlan(
  planId: number,
  patch: { title?: string; pinned?: boolean; archived?: boolean },
): Promise<ApiResult<ProductionPlan>> {
  return request(
    `/api/plans/${planId}`,
    { method: 'PATCH', body: JSON.stringify(patch) },
    (data) => data.plan as ProductionPlan,
  );
}

export function deletePlan(planId: number): Promise<ApiResult<null>> {
  return request(`/api/plans/${planId}`, { method: 'DELETE' }, () => null);
}

/**
 * Добавление пунктов. Всегда массивом — «добавить всю цепочку» обязано быть одним запросом,
 * иначе на медленной сети список наполняется по одному пункту.
 */
export function addPlanItems(planId: number, items: PlanItemDraft[]): Promise<ApiResult<PlanItem[]>> {
  return request(
    `/api/plans/${planId}/items`,
    { method: 'POST', body: JSON.stringify({ items }) },
    (data) => (data.items ?? []) as PlanItem[],
  );
}

export function updatePlanItem(itemId: number, patch: PlanItemPatch): Promise<ApiResult<PlanItem>> {
  return request(
    `/api/plans/items/${itemId}`,
    { method: 'PATCH', body: JSON.stringify(patch) },
    (data) => data.item as PlanItem,
  );
}

export function deletePlanItem(itemId: number): Promise<ApiResult<null>> {
  return request(`/api/plans/items/${itemId}`, { method: 'DELETE' }, () => null);
}
