/**
 * МОСТ «ИГРОВОЕ СОСТОЯНИЕ <-> СЕЙФ БИРЖИ»
 *
 * Внутри биржи всё серверное и сходится по журналу (server/market-vault.js).
 * Единственная точка доверия — граница: пополнение сейфа сервер принимает НА СЛОВО,
 * поэтому списание из игрового состояния обязан выполнить клиент, и обязан
 * выполнить его РОВНО ОДИН РАЗ. Весь этот файл — про эту границу.
 *
 * ПОРЯДОК ОПЕРАЦИЙ ВЫБРАН ПО АСИММЕТРИИ РИСКА.
 * Дубликат товара — эксплойт (им ломают экономику), потеря — досадная ошибка,
 * которую видно и можно возместить. Поэтому:
 *
 *   ПОПОЛНЕНИЕ:  списать у себя -> сохранить игру -> POST /deposit
 *     Если бы сначала шёл POST, падение клиента между POST и списанием давало бы
 *     ресурс И в сейфе, И в игре. При выбранном порядке потерянный POST означает
 *     потерю ресурса, а не удвоение; на явный отказ сервера (ok:false — значит
 *     точно не применено) списание откатывается, на сетевой сбой выполняется
 *     сверка с сейфом.
 *
 *   ВЫВОД:       POST /withdraw (сервер уже списал из сейфа) -> начислить себе
 *                -> отметить локально -> сохранить -> POST /confirm
 *     Незавершённые выводы видны в GET /api/market/vault/pending, поэтому упавший
 *     клиент дочислит их при следующем запуске, а не потеряет. От повторного
 *     начисления при таком восстановлении защищает локальная отметка (ниже):
 *     сервер сам по себе различить «клиент уже начислил» и «ещё нет» не может.
 */

import { useGameStore } from './gameStore';
import { D } from '../core/math/format';
import { VAULT_CREDITS, MARKET_CONSTANTS } from '../core/gameTypes.market';
import type { VaultResource } from '../core/gameTypes.market';
import type { ResourceType } from '../core/gameTypes';
import { getUserId } from '../utils/settingsApi';

type Dec = ReturnType<typeof D>;

/** Максимум знаков после запятой, которые принимает сервер. */
const MAX_DP = MARKET_CONSTANTS.VAULT_MAX_DECIMALS;

/** Потолок на одну операцию (совпадает с MAX_OPERATION_UNITS на сервере). */
const MAX_OPERATION = MARKET_CONSTANTS.VAULT_MAX_OPERATION;

const MAX_OPERATION_TEXT = '1000000000000000';

/** Наименьшая различимая величина при MAX_DP знаках. */
const EPSILON_TEXT = '0.000001';

// ============================================================================
// РАЗБОР И НОРМАЛИЗАЦИЯ СУММ
// ============================================================================

/**
 * Строка пользователя -> каноничная десятичная строка для сервера.
 *
 * Сервер принимает только простую десятичную запись (regexp, до 6 знаков после
 * запятой) и режет всё больше 1e15 за операцию. Экспоненциальная форма
 * ('1e+21', которую охотно выдаёт Decimal.toString() на больших числах) была бы
 * отвергнута как INVALID_AMOUNT — поэтому нормализация живёт здесь, а не в UI.
 *
 * Возвращает null и код ошибки, чтобы форма показала внятный текст ДО запроса.
 */
export function parseAmountInput(raw: string): { amount: string } | { error: string } {
  const text = String(raw ?? '').trim().replace(',', '.').replace(/\s/g, '');
  if (!text) return { error: 'Укажите количество.' };
  if (!/^\d+(\.\d+)?$/.test(text)) {
    return { error: 'Только положительное число, без пробелов и знака экспоненты.' };
  }

  const dot = text.indexOf('.');
  if (dot >= 0 && text.length - dot - 1 > MAX_DP) {
    return { error: `Не больше ${MAX_DP} знаков после запятой.` };
  }

  const value = D(text);
  if (value.lte(0)) return { error: 'Количество должно быть больше нуля.' };
  if (value.gt(MAX_OPERATION)) {
    return { error: `За одну операцию — не больше ${MAX_OPERATION_TEXT} (1e15).` };
  }

  // Убираем ведущие нули и хвостовые нули дробной части: сервер сравнивает
  // строки как NUMERIC, но в журнале приятнее видеть каноничный вид.
  const normalized = text
    .replace(/^0+(?=\d)/, '')
    .replace(/(\.\d*?)0+$/, '$1')
    .replace(/\.$/, '');
  return { amount: normalized };
}

/**
 * Величина из игрового состояния -> максимальная сумма, которую можно внести:
 * округление ВНИЗ до MAX_DP знаков и обрезка по потолку операции.
 *
 * Округление вниз обязательно: округление вверх дало бы сумму больше той, что
 * реально лежит у игрока, и собственная проверка списания её бы отвергла.
 */
export function floorToDepositable(value: Dec): string {
  if (value.lte(0)) return '0';
  const capped = value.gt(MAX_OPERATION) ? D(MAX_OPERATION_TEXT) : value;

  // toFixed на Decimal округляет, поэтому результат проверяется и при
  // необходимости уменьшается на одну единицу последнего разряда.
  let candidate = capped.toFixed(MAX_DP);
  if (D(candidate).gt(capped)) {
    candidate = D(candidate).sub(D(EPSILON_TEXT)).toFixed(MAX_DP);
  }
  const parsed = parseAmountInput(candidate);
  return 'amount' in parsed ? parsed.amount : '0';
}

// ============================================================================
// ЧТЕНИЕ ИГРОВОГО СОСТОЯНИЯ
// ============================================================================

/**
 * Сколько игрок реально держит.
 *
 * Ресурсы читаются из grid.buffers.base — это источник истины;
 * resources[r].amount пересчитывается из буфера каждый тик и обрезан по складу,
 * поэтому опираться на него нельзя.
 */
export function readHeld(resource: VaultResource): Dec {
  const state = useGameStore.getState();
  if (resource === VAULT_CREDITS) return D(state.currency.credits);
  const base = state.grid?.buffers?.base;
  const raw = base ? base[resource as ResourceType] : undefined;
  return D(raw ?? '0');
}

/** Существует ли такой ресурс в игровом состоянии (иначе начислять некуда). */
export function isKnownGameResource(resource: VaultResource): boolean {
  if (resource === VAULT_CREDITS) return true;
  return !!useGameStore.getState().resources[resource as ResourceType];
}

// ============================================================================
// ИЗМЕНЕНИЕ ИГРОВОГО СОСТОЯНИЯ
// ============================================================================

/**
 * Пересчёт производного resources[r].amount из буфера — ровно как это делает
 * тик игры и src/hooks/useMarketTransactions.ts.
 *
 * Трогается только изменённый ресурс: пересчёт всей карты обнулил бы те
 * ресурсы, которых почему-то нет в буфере.
 */
function syncDerivedAmount(
  state: ReturnType<typeof useGameStore.getState>,
  base: Partial<Record<ResourceType, string>>,
  resource: ResourceType,
) {
  const entry = state.resources[resource];
  if (!entry) return state.resources;
  const amount = D(base[resource] ?? '0').min(entry.max).max(D(0));
  return { ...state.resources, [resource]: { ...entry, amount } };
}

/**
 * Списать из игрового состояния. Проверка и списание — в одном setState,
 * поэтому между «хватает» и «списали» ничего вклиниться не может.
 *
 * @returns false, если у игрока столько нет (тогда ничего не изменено).
 */
export function debitGameState(resource: VaultResource, amount: string): boolean {
  const want = D(amount);
  if (want.lte(0)) return false;

  let applied = false;
  useGameStore.setState((state) => {
    if (resource === VAULT_CREDITS) {
      if (D(state.currency.credits).lt(want)) return {};
      applied = true;
      return { currency: { ...state.currency, credits: D(state.currency.credits).sub(want) } };
    }

    const key = resource as ResourceType;
    if (!state.resources[key]) return {};
    const buffers = { ...state.grid.buffers };
    const base = { ...(buffers.base ?? {}) };
    const have = D(base[key] ?? '0');
    if (have.lt(want)) return {};

    base[key] = have.sub(want).toString();
    buffers.base = base;
    applied = true;
    return {
      resources: syncDerivedAmount(state, base, key),
      grid: { ...state.grid, buffers },
    };
  });

  return applied;
}

/** Начислить в игровое состояние (вывод из сейфа, откат неудачного пополнения). */
export function creditGameState(resource: VaultResource, amount: string): boolean {
  const delta = D(amount);
  if (delta.lte(0)) return false;

  let applied = false;
  useGameStore.setState((state) => {
    if (resource === VAULT_CREDITS) {
      applied = true;
      return { currency: { ...state.currency, credits: D(state.currency.credits).add(delta) } };
    }

    const key = resource as ResourceType;
    if (!state.resources[key]) return {};
    const buffers = { ...state.grid.buffers };
    const base = { ...(buffers.base ?? {}) };
    base[key] = D(base[key] ?? '0').add(delta).toString();
    buffers.base = base;
    applied = true;
    return {
      resources: syncDerivedAmount(state, base, key),
      grid: { ...state.grid, buffers },
    };
  });

  return applied;
}

/**
 * Сохранить игру на сервер.
 *
 * Возвращает true только при подтверждённой записи. Ни один инвариант на этом
 * значении не держится — оно нужно, чтобы предупредить игрока, что начисление
 * пока живёт только в памяти вкладки.
 */
export async function persistGameState(): Promise<boolean> {
  const saveGame = useGameStore.getState().saveGame;
  if (typeof saveGame !== 'function') return false;
  try {
    // Тип объявлен как Promise<void>, но на деле gameStore возвращает {ok, error}.
    const result = (await saveGame()) as unknown as { ok?: boolean } | void;
    return !!result && (result as { ok?: boolean }).ok === true;
  } catch (e) {
    console.warn('[vault] не удалось сохранить игру после операции с сейфом', e);
    return false;
  }
}

// ============================================================================
// ЛОКАЛЬНАЯ ОТМЕТКА «ВЫВОД УЖЕ НАЧИСЛЕН»
//
// Сервер знает только «pending / applied». Между «начислил себе» и «позвал
// /confirm» клиент может умереть, и тогда при следующем запуске он увидит тот же
// pending-вывод. Начислить второй раз — это ровно то удвоение, от которого весь
// сейф и защищает, поэтому факт начисления фиксируется локально, синхронно и
// СРАЗУ после мутации состояния (localStorage пишется без await, вклиниться
// нечему).
//
// Ограничение честно названо: отметка живёт в браузере. Если игрок откроет игру
// на другом устройстве с незавершённым выводом, тот вывод будет начислен там
// заново. Save-слот один, побеждает последняя запись, так что дубль не
// закрепится, — но полностью закрыть это можно только серверным игровым
// состоянием, что вне объёма задачи.
// ============================================================================

const LEDGER_PREFIX = 'market.vaultWithdrawals.v1';
const LEDGER_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const LEDGER_MAX_ENTRIES = 300;

function ledgerKey(): string {
  return `${LEDGER_PREFIX}.${getUserId() ?? 'anon'}`;
}

function readLedger(): Record<string, number> {
  try {
    const raw = localStorage.getItem(ledgerKey());
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, number>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeLedger(ledger: Record<string, number>): void {
  try {
    const cutoff = Date.now() - LEDGER_TTL_MS;
    let entries = Object.entries(ledger).filter(([, ts]) => ts >= cutoff);
    if (entries.length > LEDGER_MAX_ENTRIES) {
      entries = entries.sort((a, b) => b[1] - a[1]).slice(0, LEDGER_MAX_ENTRIES);
    }
    localStorage.setItem(ledgerKey(), JSON.stringify(Object.fromEntries(entries)));
  } catch (e) {
    // Переполнен localStorage или приватный режим. Хуже, чем ничего, но
    // молча удваивать начисление нельзя — предупреждаем.
    console.error('[vault] не удалось запомнить начисленный вывод', e);
  }
}

/** Уже начисляли этот вывод в игровое состояние? */
export function isWithdrawalCredited(withdrawalId: string): boolean {
  return Object.prototype.hasOwnProperty.call(readLedger(), withdrawalId);
}

/** Запомнить, что вывод начислен. Вызывается сразу после creditGameState. */
export function markWithdrawalCredited(withdrawalId: string): void {
  const ledger = readLedger();
  ledger[withdrawalId] = Date.now();
  writeLedger(ledger);
}
