/**
 * ПРИМЕНЕНИЕ АДМИНСКОЙ ВЫДАЧИ К СОСТОЯНИЮ В ПАМЯТИ (bigplan.md, пункты 9 и 24)
 *
 * Сервер патчит сохранение в БД, но у запущенного игрока состояние живёт в памяти, и его
 * автосохранение раз в 30 секунд перезаписывало патч — ровно это и означало «при выдаче ресурсы
 * не сохраняются». Теперь сервер досылает дельту через realtime-канал, а клиент прибавляет её
 * к текущему состоянию.
 *
 * ПОЧЕМУ ДЕЛЬТА, А НЕ ПЕРЕЗАГРУЗКА СЕЙВА
 * Перезагрузка стоила бы игроку всего прогресса с последнего автосохранения. Дельта не теряет
 * ничего: она прибавляется к тому, что уже есть, и уходит в следующее автосохранение.
 *
 * Формат ключей приходит с сервера как есть: `currency.credits`, `resources.ore`
 * (см. applyGrantToSaveData в server/admin.js).
 */

import type { ResourceType } from '../gameTypes';

export type GrantDeltas = Record<string, string>;

export interface ParsedGrant {
  /** Валюты: только известные поля currency. */
  currency: Partial<Record<'credits' | 'researchPoints' | 'influence', string>>;
  /** Ресурсы: прибавляются в базовый буфер, он же источник правды при загрузке. */
  resources: Partial<Record<ResourceType, string>>;
  /** Ключи, которые не удалось разобрать — чтобы не молчать о расхождении с сервером. */
  unknown: string[];
}

const CURRENCY_FIELDS = new Set(['credits', 'researchPoints', 'influence']);

/**
 * Разобрать плоский словарь `{'currency.credits': '500', 'resources.ore': '100'}`.
 *
 * Чистая функция: разбор — единственное место, где формат сервера превращается во что-то
 * применимое, и именно его надо проверять тестом, а не поведение стора.
 */
export function parseGrantDeltas(deltas: GrantDeltas | null | undefined): ParsedGrant {
  const result: ParsedGrant = { currency: {}, resources: {}, unknown: [] };
  if (!deltas || typeof deltas !== 'object') return result;

  for (const [field, rawValue] of Object.entries(deltas)) {
    if (typeof rawValue !== 'string' || rawValue.length === 0) {
      result.unknown.push(field);
      continue;
    }

    const dot = field.indexOf('.');
    if (dot === -1) {
      result.unknown.push(field);
      continue;
    }

    const scope = field.slice(0, dot);
    const key = field.slice(dot + 1);

    if (scope === 'currency') {
      if (!CURRENCY_FIELDS.has(key)) {
        result.unknown.push(field);
        continue;
      }
      result.currency[key as keyof ParsedGrant['currency']] = rawValue;
    } else if (scope === 'resources') {
      result.resources[key as ResourceType] = rawValue;
    } else {
      result.unknown.push(field);
    }
  }

  return result;
}

/** Есть ли что применять. */
export function isEmptyGrant(parsed: ParsedGrant): boolean {
  return (
    Object.keys(parsed.currency).length === 0 && Object.keys(parsed.resources).length === 0
  );
}

/**
 * Человекочитаемое описание выдачи для уведомления.
 * Игрок должен понимать, что именно ему начислили, а не видеть «состояние обновлено».
 */
export function describeGrant(
  parsed: ParsedGrant,
  resourceName: (id: string) => string,
): string {
  const parts: string[] = [];

  const currencyLabels: Record<string, string> = {
    credits: 'кредиты',
    researchPoints: 'очки исследований',
    influence: 'влияние',
  };
  for (const [key, value] of Object.entries(parsed.currency)) {
    if (!value) continue;
    parts.push(`${currencyLabels[key] ?? key}: ${value}`);
  }
  for (const [key, value] of Object.entries(parsed.resources)) {
    if (!value) continue;
    parts.push(`${resourceName(key)}: ${value}`);
  }

  return parts.join(', ');
}
