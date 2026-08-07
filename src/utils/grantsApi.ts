/**
 * ОЧЕРЕДЬ АДМИНСКИХ ВЫДАЧ — СТОРОНА ИГРОКА (bigplan.md, пункт 9)
 *
 * ЗАЧЕМ ОЧЕРЕДЬ, А НЕ ПАТЧ СЕЙВА НА СЕРВЕРЕ
 * Патч сохранения в БД не переживал игрока с открытой вкладкой: сервер поднимал revision,
 * автосохранение упиралось в 409 SAVE_OUTDATED, а обработчик конфликта по правилу «активная
 * вкладка выигрывает» ПОВТОРЯЛ свою запись поверх патча — и начисление исчезало. Админка при
 * этом показывала «выдано». Теперь сервер кладёт начисление отдельной строкой (player_grants),
 * а клиент забирает его сам и прибавляет к состоянию в памяти: перезаписывать нечего.
 *
 * ПОЧЕМУ ЭТО НЕ ЗАВИСИТ ОТ REALTIME-КАНАЛА
 * Событие `admin.grant.pending` — только подсказка «загляни в очередь». Не дошло (закрытая
 * вкладка, разрыв, другой воркер в кластере) — начисление никуда не делось и будет забрано при
 * следующей загрузке. Именно поэтому вопрос «в сети ли игрок» перестал влиять на корректность.
 */

import { getAuthHeaders } from './settingsApi';

export interface PendingGrant {
  grantId: string;
  /** null — начисление не привязано к партии и применимо к любому слоту. */
  slotId: number | null;
  /** Плоские дельты вида `{'currency.credits': '500'}` — формат core/systems/adminGrant.ts. */
  deltas: Record<string, string>;
  createdAt: number;
}

/** Что именно применилось: уходит в ack и остаётся в журнале рядом с выдачей. */
export interface GrantApplyReport {
  applied: string[];
  skipped?: string[];
}

export async function fetchPendingGrants(): Promise<PendingGrant[]> {
  const response = await fetch('/api/grants/pending', { headers: getAuthHeaders() });
  if (!response.ok) return [];
  const body = await response.json().catch(() => null);
  return Array.isArray(body?.grants) ? (body.grants as PendingGrant[]) : [];
}

/**
 * Подтвердить применение. Возвращает id, которые сервер реально закрыл: вторая вкладка,
 * забравшая ту же очередь, получит пустой список — начисление достаётся ровно одной.
 */
export async function ackGrants(
  grantIds: string[],
  saveId: number | null,
  report?: GrantApplyReport,
): Promise<string[]> {
  if (grantIds.length === 0) return [];
  const response = await fetch('/api/grants/ack', {
    method: 'POST',
    headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ grantIds, saveId, report }),
  });
  if (!response.ok) return [];
  const body = await response.json().catch(() => null);
  return Array.isArray(body?.acked) ? (body.acked as string[]) : [];
}
