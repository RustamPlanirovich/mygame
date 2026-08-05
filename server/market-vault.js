/**
 * server/market-vault.js — БИРЖЕВОЙ СЕЙФ (exchange vault)
 * ============================================================================
 *
 * ЗАЧЕМ ЭТО СУЩЕСТВУЕТ
 * --------------------
 * Экономика игры client-authoritative: сервер не хранит ресурсы и кредиты игрока,
 * он получает целые save-блобы через PUT /api/saves. Переписывать всю экономику на
 * сервер — отдельный проект. Поэтому граница доверия сжата до ОДНОЙ операции:
 *
 *     POST /api/market/vault/deposit — клиент УТВЕРЖДАЕТ, что списал у себя ресурс.
 *
 * Это единственное место, где сервер верит клиенту на слово (см. комментарий у
 * маршрута). Всё, что происходит ВНУТРИ сейфа, доказуемо сохраняется:
 *   - ордер нельзя выставить без покрытия (эскроу списывается при постановке);
 *   - ордер нельзя исполнить дважды (row-locks + журнал);
 *   - из сейфа нельзя вынести больше, чем внесли + заработали;
 *   - «создала ли биржа деньги?» — вопрос, на который отвечает market_vault_ledger:
 *     SUM(delta) по игроку/ресурсу ВСЕГДА равен available + locked.
 *
 * ПОЧЕМУ КРЕДИТЫ — ПСЕВДОРЕСУРС '__credits__', А НЕ ОТДЕЛЬНАЯ КОЛОНКА/ТАБЛИЦА
 * --------------------------------------------------------------------------
 * Эскроу кредитов (ордер на покупку) и эскроу ресурса (ордер на продажу) — это
 * ОДНА И ТА ЖЕ операция available -> locked. Отдельная таблица кредитов
 * раздвоила бы: (1) код блокировки строк, (2) порядок взятия локов (а значит и
 * доказательство отсутствия дедлоков), (3) схему журнала. Один kv-стор
 * (player_id, resource) -> {available, locked} даёт один инвариант, один
 * FOR UPDATE-порядок и один журнал на всё. Цена — псевдо-id, который валидируется
 * в одном месте (VAULT_RESOURCES).
 *
 * ТОЧНОСТЬ ЧИСЕЛ
 * --------------
 * Никакого parseFloat на балансах. Все балансы — NUMERIC в SQL; в JS числа живут
 * как BigInt-«юниты» с фиксированной шкалой 12 знаков (см. toUnits/fromUnits) и
 * используются только для сравнений и вычисления сумм, которые затем передаются
 * в SQL строкой и складываются самим NUMERIC. Ввод клиента квантуется до 6 знаков.
 *
 * ПРОТОКОЛ БЛОКИРОВОК (доказательство отсутствия дедлоков)
 * -------------------------------------------------------
 * 1. acquireMarketLock() — advisory-лок на всю биржу, берётся ПЕРВЫМ (до любых
 *    row-локов) каждой операцией, которая двигает балансы ДВУХ игроков:
 *    постановка/сведение ордера, приём прямого предложения, служебная зачистка.
 *    Почему глобальный, а не по ресурсу: кредиты общие для всех 52 рынков, поэтому
 *    два сведения по разным ресурсам всё равно конкурируют за одни и те же строки
 *    кредитов. Шардировать можно только вместе с шардированием кредитов.
 *    Постановка ордера — редкое действие человека (плюс кулдаун), а лок держится
 *    единицы миллисекунд, так что на 100 игроков это не узкое место.
 * 2. lockVaultRows() — строки сейфа всегда блокируются в порядке возрастания
 *    (player_id, resource). Второй рубеж защиты: пути, которые НЕ берут advisory-лок
 *    (deposit/withdraw), всё равно не могут ни потерять запись, ни закольцеваться.
 * 3. Строки ордеров/предложений — FOR UPDATE (SKIP LOCKED для встречных ордеров,
 *    см. market.js). Третий рубеж: админские маршруты правят market_orders напрямую.
 *
 * СВЯЗЬ С КЛИЕНТОМ
 * ----------------
 * Сейф — не игровое состояние. Обратная передача идёт через market_withdrawals:
 * withdraw списывает из сейфа и создаёт строку 'pending', клиент начисляет себе
 * ресурс и подтверждает (confirm). Если клиент упал между этим — строка остаётся
 * и видна в GET /api/market/vault/pending, товар не теряется.
 */

import { RESOURCE_UNIVERSE } from './market-sim/universe.js';

// ============================================================================
// КОНСТАНТЫ
// ============================================================================

/** Псевдо-ресурс для кредитов внутри сейфа. */
export const VAULT_CREDITS = '__credits__';

/** Что вообще может лежать в сейфе. */
const VAULT_RESOURCES = new Set([...RESOURCE_UNIVERSE, VAULT_CREDITS]);

/** Ключ advisory-лока биржи ('MARK' в hex). */
const MARKET_LOCK_KEY = 0x4d41524b;

/** Сколько ждём лок, прежде чем сказать клиенту «биржа занята». */
const LOCK_TIMEOUT_MS = 5000;

/** Внутренняя шкала: 12 знаков после запятой. */
const DEC_SCALE = 12;
const SCALE_UNIT = 10n ** 12n;

/** Шкала денежного округления комиссий: 6 знаков. */
const FEE_SCALE_UNIT = 10n ** 6n;

/** Клиентский ввод квантуется до 6 знаков — больше бирже не нужно. */
export const INPUT_MAX_DP = 6;

/** Потолок на одну операцию: защита от 1e30, которая раздует NUMERIC. */
const MAX_OPERATION_UNITS = 10n ** 15n * SCALE_UNIT;

const VAULT_CONSTANTS = {
  MAX_ACTIVE_OFFERS: 50,
  DEFAULT_OFFER_HOURS: 24,
  MAX_OFFER_HOURS: 168,
  MIN_OFFER_HOURS: 1,
  DEPOSIT_BURST: 30,
  DEPOSIT_REFILL_PER_SEC: 1,
};

// ============================================================================
// ТОЧНАЯ ДЕСЯТИЧНАЯ АРИФМЕТИКА (BigInt, шкала 12)
// ============================================================================

/**
 * Строка/число -> BigInt-юниты (x * 10^12). null, если значение не число,
 * не десятичная запись или в нём больше maxDp знаков после запятой.
 *
 * JSON-число клиента квантуется через toFixed(6): дальше в системе оно живёт
 * уже как точное десятичное значение, и float-артефакты не размножаются.
 */
export function toUnits(raw, maxDp = DEC_SCALE) {
  let text;
  if (typeof raw === 'bigint') {
    text = raw.toString();
  } else if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return null;
    text = raw.toFixed(Math.min(maxDp, INPUT_MAX_DP));
  } else if (typeof raw === 'string') {
    text = raw.trim();
  } else {
    return null;
  }

  const m = /^(-?)(\d{1,24})(?:\.(\d+))?$/.exec(text);
  if (!m) return null;
  const frac = m[3] ?? '';
  if (frac.length > maxDp) return null;
  const padded = (frac + '0'.repeat(DEC_SCALE)).slice(0, DEC_SCALE);
  const units = BigInt(m[2]) * SCALE_UNIT + BigInt(padded);
  return m[1] === '-' ? -units : units;
}

/** BigInt-юниты -> каноничная десятичная строка (для передачи в SQL). */
export function fromUnits(units) {
  const neg = units < 0n;
  const abs = neg ? -units : units;
  const int = abs / SCALE_UNIT;
  const frac = (abs % SCALE_UNIT).toString().padStart(DEC_SCALE, '0').replace(/0+$/, '');
  return `${neg ? '-' : ''}${int}${frac ? `.${frac}` : ''}`;
}

/**
 * Значение из БД -> юниты. Всё, что пишет этот модуль, укладывается в 12 знаков
 * (произведение двух шестизначных). Если БД вернула больше — усекаем и ругаемся
 * в лог: такие значения могли появиться только от постороннего писателя.
 */
export function dbUnits(text) {
  if (text === null || text === undefined) return 0n;
  const exact = toUnits(text, DEC_SCALE);
  if (exact !== null) return exact;
  const loose = toUnits(String(text).replace(/(\.\d{12})\d+$/, '$1'), DEC_SCALE);
  if (loose === null) {
    throw new Error(`VAULT_BAD_NUMERIC: ${String(text).slice(0, 40)}`);
  }
  console.warn(`[vault] значение из БД усечено до 12 знаков: ${String(text).slice(0, 40)}`);
  return loose;
}

/**
 * Точное произведение двух величин шкалы 12.
 * Точно, пока у сомножителей не больше 6 знаков каждый (ровно наш случай:
 * количество и цена валидируются как <= 6 знаков), т.к. итог влезает в 12 знаков.
 */
export function mulUnits(a, b) {
  return (a * b) / SCALE_UNIT;
}

/** Усечение до 6 знаков (для неотрицательных величин). */
function trunc6(units) {
  return units - (units % FEE_SCALE_UNIT);
}

/** Округление ВВЕРХ до 6 знаков (для неотрицательных величин). */
function ceil6(units) {
  const r = units % FEE_SCALE_UNIT;
  return r === 0n ? units : units + (FEE_SCALE_UNIT - r);
}

/**
 * Комиссия с оборота.
 *
 * mode='trunc' — так считается ФАКТИЧЕСКАЯ комиссия при исполнении;
 * mode='ceil'  — так считается РЕЗЕРВ комиссии при постановке ордера.
 *
 * Из trunc <= exact <= ceil следует, что суммы фактических комиссий по частичным
 * исполнениям НИКОГДА не превысят зарезервированную сумму: эскроу не может уйти
 * в минус из-за округлений (иначе CHECK(locked>=0) валил бы всю сделку).
 */
export function feeUnits(grossUnits, percentUnits, mode = 'trunc') {
  if (grossUnits <= 0n || percentUnits <= 0n) return 0n;
  const num = grossUnits * percentUnits;
  const den = SCALE_UNIT * 100n;
  let q = num / den;
  if (mode === 'ceil') {
    if (num % den !== 0n) q += 1n;
    return ceil6(q);
  }
  return trunc6(q);
}

/** Валидация количества/цены из тела запроса: > 0, <= 6 знаков, не астрономическое. */
export function readPositiveAmount(raw) {
  const units = toUnits(raw, INPUT_MAX_DP);
  if (units === null || units <= 0n || units > MAX_OPERATION_UNITS) return null;
  return units;
}

export function isVaultResource(resource) {
  return typeof resource === 'string' && VAULT_RESOURCES.has(resource);
}

export function isTradeableResource(resource) {
  return typeof resource === 'string' && resource !== VAULT_CREDITS && VAULT_RESOURCES.has(resource);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(v) {
  return typeof v === 'string' && UUID_RE.test(v);
}

// ============================================================================
// ТРАНЗАКЦИИ И ЛОКИ
// ============================================================================

/** Открыть транзакцию с ограничением ожидания локов. */
export async function beginTx(pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL lock_timeout = '${LOCK_TIMEOUT_MS}ms'`);
    return client;
  } catch (e) {
    client.release();
    throw e;
  }
}

/**
 * Advisory-лок биржи. Берётся ПЕРВЫМ, до любых row-локов (иначе advisory-лок и
 * row-локи могут закольцеваться, и Postgres убьёт одну из транзакций по 40P01).
 */
export async function acquireMarketLock(client) {
  await client.query('SELECT pg_advisory_xact_lock($1::bigint)', [MARKET_LOCK_KEY]);
}

/** Ошибка «не дождались лока» / «запрос отменён по таймауту». */
export function isBusyError(e) {
  return e?.code === '55P03' || e?.code === '57014' || e?.code === '40P01';
}

/**
 * Соединение из пула получить не удалось (пул исчерпан) либо сервер БД отказал
 * в подключении. Это ПЕРЕГРУЗКА, а не внутренняя ошибка: отвечаем 503, чтобы
 * клиент повторил, а не показывал «внутренняя ошибка».
 *
 * pg-pool при исчерпании кидает обычный Error без .code, поэтому приходится
 * смотреть на текст; 53300 — too_many_connections со стороны Postgres.
 */
/**
 * Код нарушенного инварианта из текста ошибки — и ТОЛЬКО код.
 *
 * Движок кидает ошибки вида
 *   'VAULT_LOCKED_MISMATCH seller=123 oil locked=10 need=100'
 * Раньше в ответ уходил ВЕСЬ этот текст в поле error: клиент видел код, но
 * заодно и внутренние id с балансами контрагента. Теперь наружу идёт только
 * префикс-код (по нему отличают явный отказ инварианта от «просто 500»), а
 * полный текст остаётся в логе сервера.
 */
const INVARIANT_CODE_RE = /^(VAULT_[A-Z0-9_]+|ESCROW_[A-Z0-9_]+|MARKET_[A-Z0-9_]+)/;
export function invariantCode(e) {
  const m = INVARIANT_CODE_RE.exec(String(e?.message ?? ''));
  return m ? m[1] : null;
}

export function isUnavailableError(e) {
  if (e?.code === '53300' || e?.code === '57P03' || e?.code === 'ECONNREFUSED') return true;
  const msg = String(e?.message ?? '');
  return /timeout exceeded when trying to connect|Connection terminated due to connection timeout|called end on pool more than once|pool after calling end/i.test(msg);
}

const vkey = (playerId, resource) => `${playerId}|${resource}`;

/**
 * Создать (если нужно) и заблокировать строки сейфа В ДЕТЕРМИНИРОВАННОМ ПОРЯДКЕ
 * (player_id ASC, resource ASC). Возвращает Map ключ -> {availableU, lockedU}.
 *
 * Единый порядок для ВСЕХ путей — это и есть доказательство отсутствия дедлоков
 * на строках сейфа: цикл ожиданий невозможен, если все берут локи в одном порядке.
 */
export async function lockVaultRows(client, keys) {
  const uniq = new Map();
  for (const k of keys) {
    const playerId = Number(k.playerId);
    if (!Number.isInteger(playerId)) throw new Error('VAULT_BAD_PLAYER_ID');
    if (!isVaultResource(k.resource)) throw new Error(`VAULT_BAD_RESOURCE: ${k.resource}`);
    uniq.set(vkey(playerId, k.resource), { playerId, resource: k.resource });
  }
  const sorted = [...uniq.values()].sort(
    (a, b) => a.playerId - b.playerId || (a.resource < b.resource ? -1 : a.resource > b.resource ? 1 : 0)
  );
  if (sorted.length === 0) return new Map();

  const ids = sorted.map((k) => k.playerId);
  const resources = sorted.map((k) => k.resource);

  // ON CONFLICT DO NOTHING — конкурентные вставки безопасны; ORDER BY сохраняет
  // тот же порядок и на этапе создания строк.
  await client.query(
    `INSERT INTO market_vault (player_id, resource)
     SELECT p, r FROM (
       SELECT p, r FROM unnest($1::int[], $2::text[]) AS t(p, r) ORDER BY p, r
     ) s
     ON CONFLICT (player_id, resource) DO NOTHING`,
    [ids, resources]
  );

  const rows = await client.query(
    `SELECT player_id, resource, available::text AS available, locked::text AS locked
       FROM market_vault
      WHERE (player_id, resource) IN (SELECT p, r FROM unnest($1::int[], $2::text[]) AS t(p, r))
      ORDER BY player_id, resource
      FOR UPDATE`,
    [ids, resources]
  );

  const out = new Map();
  for (const r of rows.rows) {
    out.set(vkey(r.player_id, r.resource), {
      playerId: r.player_id,
      resource: r.resource,
      availableU: dbUnits(r.available),
      lockedU: dbUnits(r.locked),
    });
  }
  return out;
}

export function vaultBalance(locked, playerId, resource) {
  return locked.get(vkey(playerId, resource)) ?? { availableU: 0n, lockedU: 0n };
}

// ============================================================================
// ДВИЖЕНИЯ ПО СЕЙФУ + ЖУРНАЛ
// ============================================================================

/**
 * Одно движение по сейфу + строка журнала, одним round-trip.
 *
 * delta в журнале — изменение ПОЛНОГО баланса (available + locked):
 *   - deposit/withdraw/сделка: delta != 0 (ценность вошла в сейф или вышла);
 *   - блокировка/разблокировка эскроу: delta = 0 (ценность лишь переехала из
 *     кармана в карман внутри сейфа).
 * balance_after — полный баланс ПОСЛЕ движения.
 * Отсюда главный инвариант, который проверяет ревьюер:
 *     SUM(ledger.delta) по (player_id, resource) == available + locked.
 *
 * Строка сейфа должна быть уже заблокирована через lockVaultRows().
 */
export async function moveVault(client, { playerId, resource, availableDelta = 0n, lockedDelta = 0n, reason, refId = null }) {
  if (!reason) throw new Error('VAULT_REASON_REQUIRED');
  /*
   * trim_scale() — не косметика: NUMERIC сохраняет максимальную шкалу операндов,
   * поэтому 0 + 3.3333333 - 3.3333333 хранится как '0.0000000' и уезжает клиенту
   * в таком виде. Нормализуем на записи, чтобы во всей системе была ровно одна
   * каноничная запись каждого значения (PG 13+, как и gen_random_uuid() выше).
   */
  const res = await client.query(
    `WITH upd AS (
       UPDATE market_vault
          SET available = trim_scale(available + $3::numeric),
              locked    = trim_scale(locked    + $4::numeric),
              updated_at = NOW()
        WHERE player_id = $1 AND resource = $2
        RETURNING available, locked
     ), led AS (
       INSERT INTO market_vault_ledger (player_id, resource, delta, reason, ref_id, balance_after)
       SELECT $1, $2, trim_scale($3::numeric + $4::numeric), $5, $6, trim_scale(upd.available + upd.locked)
         FROM upd
       RETURNING id
     )
     SELECT upd.available::text AS available, upd.locked::text AS locked, led.id AS ledger_id
       FROM upd, led`,
    [playerId, resource, fromUnits(availableDelta), fromUnits(lockedDelta), reason, refId]
  );
  if (res.rowCount === 0) throw new Error(`VAULT_ROW_MISSING: ${playerId}/${resource}`);
  return {
    availableU: dbUnits(res.rows[0].available),
    lockedU: dbUnits(res.rows[0].locked),
    ledgerId: res.rows[0].ledger_id,
  };
}

/** Пополнение сейфа (available += amount). */
export const vaultCredit = (client, playerId, resource, amountU, reason, refId) =>
  moveVault(client, { playerId, resource, availableDelta: amountU, reason, refId });

/** Вывод из сейфа (available -= amount). */
export const vaultDebit = (client, playerId, resource, amountU, reason, refId) =>
  moveVault(client, { playerId, resource, availableDelta: -amountU, reason, refId });

/** Эскроу: available -> locked (полный баланс не меняется). */
export const vaultLock = (client, playerId, resource, amountU, reason, refId) =>
  moveVault(client, { playerId, resource, availableDelta: -amountU, lockedDelta: amountU, reason, refId });

/** Возврат эскроу: locked -> available (полный баланс не меняется). */
export const vaultUnlock = (client, playerId, resource, amountU, reason, refId) =>
  moveVault(client, { playerId, resource, availableDelta: amountU, lockedDelta: -amountU, reason, refId });

/** Списание ИЗ ЭСКРОУ вовне (locked -= amount): товар/деньги ушли контрагенту. */
export const vaultSpendLocked = (client, playerId, resource, amountU, reason, refId) =>
  moveVault(client, { playerId, resource, lockedDelta: -amountU, reason, refId });

// ============================================================================
// СХЕМА
// ============================================================================

/**
 * Таблицы сейфа. Только CREATE TABLE IF NOT EXISTS / ALTER ... IF NOT EXISTS:
 * .sql-файлы в этом проекте применяются руками и на практике не применялись.
 */
export async function initVaultTables(pool) {
  // Кошелёк игрока. Единственное, чем может торговать биржа.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS market_vault (
      player_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      resource VARCHAR(50) NOT NULL,
      available NUMERIC NOT NULL DEFAULT 0 CHECK (available >= 0),
      locked NUMERIC NOT NULL DEFAULT 0 CHECK (locked >= 0),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (player_id, resource)
    );
  `);

  /*
   * Журнал. player_id СОЗНАТЕЛЬНО без внешнего ключа: журнал append-only и должен
   * пережить удаление игрока админкой (там же, где живёт admin_audit_log с той же
   * мотивацией). Иначе «создала ли биржа деньги» перестало бы быть проверяемым
   * после первого же удаления аккаунта.
   */
  await pool.query(`
    CREATE TABLE IF NOT EXISTS market_vault_ledger (
      id BIGSERIAL PRIMARY KEY,
      player_id INTEGER NOT NULL,
      resource VARCHAR(50) NOT NULL,
      delta NUMERIC NOT NULL,
      reason TEXT NOT NULL,
      ref_id TEXT,
      balance_after NUMERIC NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_vault_ledger_player ON market_vault_ledger(player_id, id DESC);`
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_vault_ledger_resource ON market_vault_ledger(resource, id DESC);`
  );
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_vault_ledger_ref ON market_vault_ledger(ref_id);`);

  // Передача ценностей обратно клиенту. 'pending' -> 'applied'.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS market_withdrawals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      player_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      resource VARCHAR(50) NOT NULL,
      amount NUMERIC NOT NULL CHECK (amount > 0),
      status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'applied')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      applied_at TIMESTAMPTZ
    );
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_withdrawals_player_status ON market_withdrawals(player_id, status);`
  );

  // Прямые сделки между игроками: продажа за кредиты И барт ресурс-на-ресурс.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS market_direct_offers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      seller_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      buyer_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      offer_resource VARCHAR(50) NOT NULL,
      offer_amount NUMERIC NOT NULL CHECK (offer_amount > 0),
      want_credits NUMERIC,
      want_resource VARCHAR(50),
      want_amount NUMERIC,
      status VARCHAR(20) NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'accepted', 'cancelled', 'expired', 'declined')),
      message TEXT,
      fee_percent NUMERIC NOT NULL DEFAULT 0,
      escrow_amount NUMERIC NOT NULL DEFAULT 0 CHECK (escrow_amount >= 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      accepted_at TIMESTAMPTZ,
      CONSTRAINT market_direct_offers_want_leg CHECK (
        (want_credits IS NOT NULL AND want_resource IS NULL AND want_amount IS NULL AND want_credits > 0)
        OR (want_credits IS NULL AND want_resource IS NOT NULL AND want_amount IS NOT NULL AND want_amount > 0)
      )
    );
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_direct_offers_open ON market_direct_offers(status, expires_at);`
  );
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_direct_offers_seller ON market_direct_offers(seller_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_direct_offers_buyer ON market_direct_offers(buyer_id);`);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_direct_offers_resource ON market_direct_offers(offer_resource, status);`
  );
}

// ============================================================================
// RATE LIMIT (без новых зависимостей)
// ============================================================================

function createTokenBucketLimiter({ capacity, refillPerSecond, name, message }) {
  const buckets = new Map();
  const timer = setInterval(() => {
    const cutoff = Date.now() - 10 * 60 * 1000;
    for (const [key, bucket] of buckets) {
      if (bucket.updatedAt < cutoff) buckets.delete(key);
    }
  }, 5 * 60 * 1000);
  if (typeof timer.unref === 'function') timer.unref();

  return function limiter(req, res, next) {
    const key = String(req.userId ?? req.ip ?? 'anonymous');
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { tokens: capacity, updatedAt: now };
      buckets.set(key, bucket);
    }
    bucket.tokens = Math.min(capacity, bucket.tokens + ((now - bucket.updatedAt) / 1000) * refillPerSecond);
    bucket.updatedAt = now;

    if (bucket.tokens < 1) {
      const retryAfter = Math.max(1, Math.ceil((1 - bucket.tokens) / refillPerSecond));
      res.setHeader('Retry-After', String(retryAfter));
      console.warn(`[vault] rate limit (${name}) для ключа ${key}`);
      res.status(429).json({ ok: false, error: 'RATE_LIMITED', message, retryAfter });
      return;
    }
    bucket.tokens -= 1;
    next();
  };
}

// ============================================================================
// ХЕЛПЕРЫ ОТВЕТОВ
// ============================================================================

function fail(res, status, error, message, extra = {}) {
  res.status(status).json({ ok: false, error, message, ...extra });
}

function serverError(res, e, where) {
  // Перегрузка (лок не дождались / пул исчерпан) — это 503 с кодом, по которому
  // клиент понимает «повтори», а НЕ 500 и уж точно не HTML со стеком.
  if (isBusyError(e) || isUnavailableError(e)) {
    fail(res, 503, 'MARKET_BUSY', 'Биржа занята, попробуйте ещё раз через секунду.');
    return;
  }
  // Наружу — только код инварианта (если он есть); подробности с id и суммами
  // остаются в логе сервера.
  console.error(`[vault] ${where}:`, e);
  fail(res, 500, invariantCode(e) ?? 'INTERNAL', 'Внутренняя ошибка биржи.');
}

async function rollback(client) {
  try {
    await client.query('ROLLBACK');
  } catch {
    /* соединение уже могло умереть */
  }
}

/** Комиссия игрока (та же лестница, что в market.js) — как строка процентов. */
async function feePercentUnitsFor(client, playerId) {
  const r = await client.query(
    'SELECT total_volume::text AS total_volume, guild_id FROM traders WHERE player_id = $1',
    [playerId]
  );
  const volumeU = r.rows[0] ? dbUnits(r.rows[0].total_volume) : 0n;
  const hasGuild = !!r.rows[0]?.guild_id;
  if (volumeU >= 1_000_000n * SCALE_UNIT) return toUnits('1', 2);
  if (hasGuild) return toUnits('1.5', 2);
  return toUnits('2', 2);
}

/**
 * Строка предложения для клиента.
 *
 * PII: НИКАКИХ users.email. Раньше оба GET-маршрута отдавали
 * `s.email AS seller_name, b.email AS buyer_name`, а buyer_id задаёт сам
 * атакующий (POST /api/market/offers {buyerId}). Значит любой авторизованный
 * игрок мог адресовать предложение id=N, тут же прочитать своё же
 * /offers/mine -> outgoing и получить ПОЛНЫЙ email владельца id=N — включая
 * аккаунты, которые никогда не торговали, и админов. Отмена возвращает эскроу,
 * так что перебор всей таблицы users стоил ноль. Эмпирически из одного
 * аккаунта с 0.000001 ore выгружались все 16 адресов тестовой базы.
 *
 * Теперь: имя продавца — только локальная часть адреса (split_part(email,'@',1)),
 * отрезанная В SQL, чтобы полный адрес вообще не покидал процесс; buyerName
 * не возвращается НИКОГДА — продавцу для управления своим предложением личность
 * получателя не нужна, а получателю своя личность не нужна тем более.
 */
const offerRow = (row, meId) => ({
  id: row.id,
  sellerId: String(row.seller_id),
  sellerName: row.seller_name ?? null,
  buyerId: row.buyer_id === null ? null : String(row.buyer_id),
  isPublic: row.buyer_id === null,
  isMine: meId !== undefined && row.seller_id === meId,
  offerResource: row.offer_resource,
  offerAmount: row.offer_amount,
  wantCredits: row.want_credits,
  wantResource: row.want_resource,
  wantAmount: row.want_amount,
  kind: row.want_credits !== null ? 'sale' : 'barter',
  status: row.status,
  message: row.message,
  feePercent: row.fee_percent,
  createdAt: new Date(row.created_at).getTime(),
  expiresAt: new Date(row.expires_at).getTime(),
  acceptedAt: row.accepted_at ? new Date(row.accepted_at).getTime() : null,
});

// ============================================================================
// СЛУЖЕБНОЕ: ИСТЕЧЕНИЕ ПРЯМЫХ ПРЕДЛОЖЕНИЙ
// ============================================================================

/**
 * Помечает истёкшие предложения и ВОЗВРАЩАЕТ эскроу продавцу.
 *
 * Второй SQL специально не привязан к первому: он подбирает эскроу у ЛЮБОГО
 * неактивного предложения. Значит любой путь, который закрыл предложение и не
 * знал про сейф, будет исправлен здесь, а не заморозит товар навсегда.
 */
export async function expireDirectOffers(pool) {
  let client = null;
  try {
    client = await beginTx(pool);
    await acquireMarketLock(client);

    const expired = await client.query(
      `UPDATE market_direct_offers
          SET status = 'expired'
        WHERE status = 'open' AND expires_at <= NOW()
        RETURNING id`
    );

    const stray = await client.query(
      `SELECT id, seller_id, offer_resource, escrow_amount::text AS escrow_amount
         FROM market_direct_offers
        WHERE status <> 'open' AND escrow_amount > 0
        ORDER BY seller_id, offer_resource
        FOR UPDATE`
    );

    let refunded = 0;
    if (stray.rowCount > 0) {
      await lockVaultRows(
        client,
        stray.rows.map((r) => ({ playerId: r.seller_id, resource: r.offer_resource }))
      );
      for (const row of stray.rows) {
        const amountU = dbUnits(row.escrow_amount);
        await client.query('UPDATE market_direct_offers SET escrow_amount = 0 WHERE id = $1', [row.id]);
        await vaultUnlock(client, row.seller_id, row.offer_resource, amountU, 'offer_escrow_release', row.id);
        refunded += 1;
      }
    }

    await client.query('COMMIT');
    return { expiredCount: expired.rowCount, refundedCount: refunded };
  } catch (e) {
    if (client) await rollback(client);
    throw e;
  } finally {
    if (client) client.release();
  }
}

// ============================================================================
// МАРШРУТЫ
// ============================================================================

export function createVaultRoutes(app, pool, authMiddleware) {
  const depositLimiter = createTokenBucketLimiter({
    capacity: VAULT_CONSTANTS.DEPOSIT_BURST,
    refillPerSecond: VAULT_CONSTANTS.DEPOSIT_REFILL_PER_SEC,
    name: 'vault-deposit',
    message: 'Слишком много операций с сейфом подряд. Подождите немного.',
  });

  // --------------------------------------------------------------------------
  // СЕЙФ
  // --------------------------------------------------------------------------

  /** GET /api/market/vault — все ненулевые балансы игрока. */
  app.get('/api/market/vault', authMiddleware, async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT resource, trim_scale(available)::text AS available, trim_scale(locked)::text AS locked,
                trim_scale(available + locked)::text AS total, updated_at
           FROM market_vault
          WHERE player_id = $1 AND (available > 0 OR locked > 0)
          ORDER BY resource`,
        [req.userId]
      );

      const balances = result.rows.map((r) => ({
        resource: r.resource,
        available: r.available,
        locked: r.locked,
        total: r.total,
        updatedAt: new Date(r.updated_at).getTime(),
      }));
      const credits = balances.find((b) => b.resource === VAULT_CREDITS) ?? {
        resource: VAULT_CREDITS,
        available: '0',
        locked: '0',
        total: '0',
        updatedAt: 0,
      };

      res.json({
        ok: true,
        creditsKey: VAULT_CREDITS,
        credits,
        balances,
        resources: balances.filter((b) => b.resource !== VAULT_CREDITS),
      });
    } catch (e) {
      serverError(res, e, 'GET /api/market/vault');
    }
  });

  /**
   * GET /api/market/vault/pending — незавершённые выводы.
   * Клиент, упавший между withdraw и confirm, восстанавливается отсюда:
   * ценность уже списана из сейфа, но ещё не начислена в игровое состояние.
   */
  app.get('/api/market/vault/pending', authMiddleware, async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT id, resource, amount::text AS amount, created_at
           FROM market_withdrawals
          WHERE player_id = $1 AND status = 'pending'
          ORDER BY created_at ASC`,
        [req.userId]
      );
      res.json({
        ok: true,
        withdrawals: result.rows.map((r) => ({
          id: r.id,
          resource: r.resource,
          amount: r.amount,
          createdAt: new Date(r.created_at).getTime(),
        })),
      });
    } catch (e) {
      serverError(res, e, 'GET /api/market/vault/pending');
    }
  });

  /** GET /api/market/vault/ledger — журнал движений игрока (аудит для UI). */
  app.get('/api/market/vault/ledger', authMiddleware, async (req, res) => {
    try {
      const limit = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || 100));
      const resource = typeof req.query.resource === 'string' ? req.query.resource : null;
      const result = await pool.query(
        `SELECT id, resource, trim_scale(delta)::text AS delta, reason, ref_id,
                trim_scale(balance_after)::text AS balance_after, created_at
           FROM market_vault_ledger
          WHERE player_id = $1 AND ($2::text IS NULL OR resource = $2)
          ORDER BY id DESC
          LIMIT $3`,
        [req.userId, resource, limit]
      );
      res.json({
        ok: true,
        entries: result.rows.map((r) => ({
          id: String(r.id),
          resource: r.resource,
          delta: r.delta,
          reason: r.reason,
          refId: r.ref_id,
          balanceAfter: r.balance_after,
          createdAt: new Date(r.created_at).getTime(),
        })),
      });
    } catch (e) {
      serverError(res, e, 'GET /api/market/vault/ledger');
    }
  });

  /**
   * POST /api/market/vault/deposit {resource, amount}
   *
   * ЕДИНСТВЕННОЕ МЕСТО, ГДЕ СЕРВЕР ВЕРИТ КЛИЕНТУ НА СЛОВО.
   * Клиент утверждает, что уже списал этот ресурс/кредиты у себя в состоянии
   * (экономика игры остаётся client-authoritative — переписывать её целиком вне
   * объёма задачи). Что сделано, чтобы это не превратилось в дыру:
   *   - операция ограничена по частоте (token bucket) и по размеру;
   *   - каждое пополнение пишет строку в market_vault_ledger с reason='deposit',
   *     поэтому «сколько игрок внёс» — точная величина, а не догадка;
   *   - ВСЁ остальное внутри биржи из этой величины уже не может создать ничего
   *     из воздуха: ордер без покрытия отклоняется, сделка не может исполниться
   *     дважды, вывести можно только внесённое плюс заработанное.
   * Античит на депозиты — отдельная задача (сверка с save-блобом), и она честно
   * невозможна, пока состояние игрока живёт у клиента.
   */
  app.post('/api/market/vault/deposit', authMiddleware, depositLimiter, async (req, res) => {
    const { resource, amount } = req.body ?? {};
    if (!isVaultResource(resource)) {
      fail(res, 400, 'INVALID_RESOURCE', 'Неизвестный ресурс для сейфа биржи.');
      return;
    }
    const amountU = readPositiveAmount(amount);
    if (amountU === null) {
      fail(res, 400, 'INVALID_AMOUNT', 'Некорректная сумма пополнения (до 6 знаков после запятой).');
      return;
    }

    // beginTx() внутри try: исчерпание пула не должно улетать в дефолтный
    // обработчик Express (он отдаёт HTML со стеком и абсолютными путями).
    let client = null;
    try {
      client = await beginTx(pool);
      await lockVaultRows(client, [{ playerId: req.userId, resource }]);
      const after = await vaultCredit(client, req.userId, resource, amountU, 'deposit', null);
      await client.query('COMMIT');
      res.json({
        ok: true,
        resource,
        amount: fromUnits(amountU),
        balance: { available: fromUnits(after.availableU), locked: fromUnits(after.lockedU) },
      });
    } catch (e) {
      if (client) await rollback(client);
      serverError(res, e, 'POST /api/market/vault/deposit');
    } finally {
      if (client) client.release();
    }
  });

  /**
   * POST /api/market/vault/withdraw {resource, amount}
   *
   * Одна транзакция: лочим строку сейфа FOR UPDATE, проверяем available,
   * уменьшаем, создаём market_withdrawals(status='pending'). Ценность в этот
   * момент уже НЕ в сейфе — она «в полёте» к клиенту, и её нельзя потратить
   * дважды. Клиент начисляет себе и вызывает /confirm.
   */
  app.post('/api/market/vault/withdraw', authMiddleware, depositLimiter, async (req, res) => {
    const { resource, amount } = req.body ?? {};
    if (!isVaultResource(resource)) {
      fail(res, 400, 'INVALID_RESOURCE', 'Неизвестный ресурс для сейфа биржи.');
      return;
    }
    const amountU = readPositiveAmount(amount);
    if (amountU === null) {
      fail(res, 400, 'INVALID_AMOUNT', 'Некорректная сумма вывода (до 6 знаков после запятой).');
      return;
    }

    let client = null;
    try {
      client = await beginTx(pool);
      const locked = await lockVaultRows(client, [{ playerId: req.userId, resource }]);
      const bal = vaultBalance(locked, req.userId, resource);
      if (bal.availableU < amountU) {
        await rollback(client);
        fail(res, 400, 'INSUFFICIENT_VAULT_BALANCE', 'В сейфе биржи недостаточно средств для вывода.', {
          resource,
          required: fromUnits(amountU),
          available: fromUnits(bal.availableU),
        });
        return;
      }

      const wd = await client.query(
        `INSERT INTO market_withdrawals (player_id, resource, amount)
         VALUES ($1, $2, $3::numeric)
         RETURNING id, created_at`,
        [req.userId, resource, fromUnits(amountU)]
      );
      const withdrawalId = wd.rows[0].id;
      const after = await vaultDebit(client, req.userId, resource, amountU, 'withdraw', withdrawalId);
      await client.query('COMMIT');

      res.json({
        ok: true,
        withdrawal: {
          id: withdrawalId,
          resource,
          amount: fromUnits(amountU),
          status: 'pending',
          createdAt: new Date(wd.rows[0].created_at).getTime(),
        },
        balance: { available: fromUnits(after.availableU), locked: fromUnits(after.lockedU) },
      });
    } catch (e) {
      if (client) await rollback(client);
      serverError(res, e, 'POST /api/market/vault/withdraw');
    } finally {
      if (client) client.release();
    }
  });

  /**
   * POST /api/market/vault/withdraw/:id/confirm
   * Охраняемый переход pending -> applied. Идемпотентно: повторный вызов не
   * начисляет ничего второй раз и возвращает alreadyApplied=true.
   */
  app.post('/api/market/vault/withdraw/:id/confirm', authMiddleware, async (req, res) => {
    const { id } = req.params;
    if (!isUuid(id)) {
      fail(res, 400, 'INVALID_ID', 'Некорректный идентификатор вывода.');
      return;
    }
    try {
      const upd = await pool.query(
        `UPDATE market_withdrawals
            SET status = 'applied', applied_at = NOW()
          WHERE id = $1 AND player_id = $2 AND status = 'pending'
          RETURNING id, resource, amount::text AS amount, applied_at`,
        [id, req.userId]
      );
      if (upd.rowCount === 1) {
        res.json({
          ok: true,
          alreadyApplied: false,
          withdrawal: {
            id: upd.rows[0].id,
            resource: upd.rows[0].resource,
            amount: upd.rows[0].amount,
            status: 'applied',
            appliedAt: new Date(upd.rows[0].applied_at).getTime(),
          },
        });
        return;
      }

      const existing = await pool.query(
        `SELECT id, resource, amount::text AS amount, status, applied_at
           FROM market_withdrawals WHERE id = $1 AND player_id = $2`,
        [id, req.userId]
      );
      if (existing.rowCount === 0) {
        fail(res, 404, 'WITHDRAWAL_NOT_FOUND', 'Вывод не найден.');
        return;
      }
      res.json({
        ok: true,
        alreadyApplied: true,
        withdrawal: {
          id: existing.rows[0].id,
          resource: existing.rows[0].resource,
          amount: existing.rows[0].amount,
          status: existing.rows[0].status,
          appliedAt: existing.rows[0].applied_at ? new Date(existing.rows[0].applied_at).getTime() : null,
        },
      });
    } catch (e) {
      serverError(res, e, 'POST /api/market/vault/withdraw/:id/confirm');
    }
  });

  // --------------------------------------------------------------------------
  // ПРЯМЫЕ ПРЕДЛОЖЕНИЯ (продажа за кредиты и барт ресурс-на-ресурс)
  //
  // Литеральные пути регистрируются ДО параметризованных: Express разбирает
  // маршруты в порядке регистрации, и /api/market/offers/mine, попав после
  // /api/market/offers/:id/..., был бы съеден как id='mine'.
  // --------------------------------------------------------------------------

  /** GET /api/market/offers/mine — мои исходящие и адресованные мне. */
  app.get('/api/market/offers/mine', authMiddleware, async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT o.id, o.seller_id, o.buyer_id, o.offer_resource, o.offer_amount::text AS offer_amount,
                o.want_credits::text AS want_credits, o.want_resource, o.want_amount::text AS want_amount,
                o.status, o.message, o.fee_percent::text AS fee_percent,
                o.created_at, o.expires_at, o.accepted_at,
                split_part(s.email, '@', 1) AS seller_name
           FROM market_direct_offers o
           JOIN users s ON s.id = o.seller_id
          WHERE o.seller_id = $1 OR o.buyer_id = $1
          ORDER BY o.created_at DESC
          LIMIT 200`,
        [req.userId]
      );
      const rows = result.rows.map((r) => offerRow(r, req.userId));
      res.json({
        ok: true,
        outgoing: rows.filter((r) => r.sellerId === String(req.userId)),
        incoming: rows.filter((r) => r.buyerId === String(req.userId)),
      });
    } catch (e) {
      serverError(res, e, 'GET /api/market/offers/mine');
    }
  });

  /** GET /api/market/offers — открытые публичные + адресованные мне. */
  app.get('/api/market/offers', authMiddleware, async (req, res) => {
    try {
      const resource = typeof req.query.resource === 'string' ? req.query.resource : null;
      const result = await pool.query(
        `SELECT o.id, o.seller_id, o.buyer_id, o.offer_resource, o.offer_amount::text AS offer_amount,
                o.want_credits::text AS want_credits, o.want_resource, o.want_amount::text AS want_amount,
                o.status, o.message, o.fee_percent::text AS fee_percent,
                o.created_at, o.expires_at, o.accepted_at,
                split_part(s.email, '@', 1) AS seller_name
           FROM market_direct_offers o
           JOIN users s ON s.id = o.seller_id
          WHERE o.status = 'open' AND o.expires_at > NOW()
            AND (o.buyer_id IS NULL OR o.buyer_id = $1)
            AND ($2::text IS NULL OR o.offer_resource = $2)
          ORDER BY o.created_at DESC
          LIMIT 200`,
        [req.userId, resource]
      );
      res.json({ ok: true, offers: result.rows.map((r) => offerRow(r, req.userId)) });
    } catch (e) {
      serverError(res, e, 'GET /api/market/offers');
    }
  });

  /**
   * POST /api/market/offers — создать предложение. Эскроу СРАЗУ:
   * предложенный ресурс уходит available -> locked, поэтому «продам то, чего нет»
   * невозможно и здесь.
   */
  app.post('/api/market/offers', authMiddleware, depositLimiter, async (req, res) => {
    const {
      offerResource,
      offerAmount,
      wantCredits,
      wantResource,
      wantAmount,
      buyerId,
      message,
      durationHours,
    } = req.body ?? {};

    if (!isTradeableResource(offerResource)) {
      fail(res, 400, 'INVALID_RESOURCE', 'Неизвестный ресурс предложения.');
      return;
    }
    const offerU = readPositiveAmount(offerAmount);
    if (offerU === null) {
      fail(res, 400, 'INVALID_AMOUNT', 'Некорректное количество в предложении.');
      return;
    }

    const wantsCredits = wantCredits !== undefined && wantCredits !== null && wantCredits !== '';
    const wantsResource = wantResource !== undefined && wantResource !== null && wantResource !== '';
    if (wantsCredits === wantsResource) {
      fail(res, 400, 'INVALID_WANT_LEG', 'Укажите ровно одно: цену в кредитах ИЛИ ресурс для обмена.');
      return;
    }

    let wantCreditsU = null;
    let wantAmountU = null;
    if (wantsCredits) {
      wantCreditsU = readPositiveAmount(wantCredits);
      if (wantCreditsU === null) {
        fail(res, 400, 'INVALID_AMOUNT', 'Некорректная цена в кредитах.');
        return;
      }
    } else {
      if (!isTradeableResource(wantResource)) {
        fail(res, 400, 'INVALID_RESOURCE', 'Неизвестный ресурс для обмена.');
        return;
      }
      if (wantResource === offerResource) {
        fail(res, 400, 'SAME_RESOURCE', 'Обмен ресурса на самого себя не имеет смысла.');
        return;
      }
      wantAmountU = readPositiveAmount(wantAmount);
      if (wantAmountU === null) {
        fail(res, 400, 'INVALID_AMOUNT', 'Некорректное количество ресурса для обмена.');
        return;
      }
    }

    let targetBuyerId = null;
    if (buyerId !== undefined && buyerId !== null && buyerId !== '') {
      targetBuyerId = Number(buyerId);
      if (!Number.isInteger(targetBuyerId) || targetBuyerId <= 0) {
        fail(res, 400, 'INVALID_BUYER', 'Некорректный получатель предложения.');
        return;
      }
      if (targetBuyerId === req.userId) {
        fail(res, 400, 'SELF_OFFER', 'Нельзя адресовать предложение самому себе.');
        return;
      }
    }

    const hours = durationHours === undefined || durationHours === null ? VAULT_CONSTANTS.DEFAULT_OFFER_HOURS : Number(durationHours);
    if (!Number.isFinite(hours) || hours < VAULT_CONSTANTS.MIN_OFFER_HOURS || hours > VAULT_CONSTANTS.MAX_OFFER_HOURS) {
      fail(res, 400, 'INVALID_DURATION', `Срок предложения — от ${VAULT_CONSTANTS.MIN_OFFER_HOURS} до ${VAULT_CONSTANTS.MAX_OFFER_HOURS} часов.`);
      return;
    }

    const text = typeof message === 'string' ? message.slice(0, 500) : null;

    let client = null;
    try {
      client = await beginTx(pool);
      if (targetBuyerId !== null) {
        const exists = await client.query('SELECT 1 FROM users WHERE id = $1', [targetBuyerId]);
        if (exists.rowCount === 0) {
          await rollback(client);
          fail(res, 404, 'BUYER_NOT_FOUND', 'Получатель предложения не найден.');
          return;
        }
      }

      const active = await client.query(
        `SELECT COUNT(*)::int AS n FROM market_direct_offers WHERE seller_id = $1 AND status = 'open'`,
        [req.userId]
      );
      if (active.rows[0].n >= VAULT_CONSTANTS.MAX_ACTIVE_OFFERS) {
        await rollback(client);
        fail(res, 400, 'MAX_OFFERS_REACHED', `Одновременно можно держать не более ${VAULT_CONSTANTS.MAX_ACTIVE_OFFERS} предложений.`);
        return;
      }

      const locked = await lockVaultRows(client, [{ playerId: req.userId, resource: offerResource }]);
      const bal = vaultBalance(locked, req.userId, offerResource);
      if (bal.availableU < offerU) {
        await rollback(client);
        fail(res, 400, 'INSUFFICIENT_VAULT_BALANCE', 'В сейфе биржи недостаточно ресурса для этого предложения.', {
          resource: offerResource,
          required: fromUnits(offerU),
          available: fromUnits(bal.availableU),
        });
        return;
      }

      const feePctU = await feePercentUnitsFor(client, req.userId);
      const inserted = await client.query(
        `INSERT INTO market_direct_offers
           (seller_id, buyer_id, offer_resource, offer_amount, want_credits, want_resource, want_amount,
            message, fee_percent, escrow_amount, expires_at)
         VALUES ($1, $2, $3, $4::numeric, $5::numeric, $6, $7::numeric, $8, $9::numeric, $4::numeric,
                 NOW() + ($10 || ' hours')::interval)
         RETURNING id, created_at, expires_at`,
        [
          req.userId,
          targetBuyerId,
          offerResource,
          fromUnits(offerU),
          wantCreditsU === null ? null : fromUnits(wantCreditsU),
          wantsResource ? wantResource : null,
          wantAmountU === null ? null : fromUnits(wantAmountU),
          text,
          fromUnits(feePctU),
          String(hours),
        ]
      );
      const offerId = inserted.rows[0].id;
      await vaultLock(client, req.userId, offerResource, offerU, 'offer_escrow_lock', offerId);
      await client.query('COMMIT');

      res.json({
        ok: true,
        offer: {
          id: offerId,
          sellerId: String(req.userId),
          buyerId: targetBuyerId === null ? null : String(targetBuyerId),
          isPublic: targetBuyerId === null,
          offerResource,
          offerAmount: fromUnits(offerU),
          wantCredits: wantCreditsU === null ? null : fromUnits(wantCreditsU),
          wantResource: wantsResource ? wantResource : null,
          wantAmount: wantAmountU === null ? null : fromUnits(wantAmountU),
          kind: wantsCredits ? 'sale' : 'barter',
          status: 'open',
          message: text,
          feePercent: fromUnits(feePctU),
          createdAt: new Date(inserted.rows[0].created_at).getTime(),
          expiresAt: new Date(inserted.rows[0].expires_at).getTime(),
        },
      });
    } catch (e) {
      if (client) await rollback(client);
      serverError(res, e, 'POST /api/market/offers');
    } finally {
      if (client) client.release();
    }
  });

  /**
   * POST /api/market/offers/:id/accept — атомарный обмен.
   *
   * Плата за прямую продажу: комиссию платит ПРОДАВЕЦ с кредитной ноги
   * (покупатель платит ровно объявленную цену), барт комиссией не облагается —
   * в барте нет однозначной единицы, в которой её брать. Комиссия сжигается,
   * как и на бирже: журнал это доказывает (см. market.js, «МОДЕЛЬ КОМИССИИ»).
   */
  app.post('/api/market/offers/:id/accept', authMiddleware, async (req, res) => {
    const { id } = req.params;
    if (!isUuid(id)) {
      fail(res, 400, 'INVALID_ID', 'Некорректный идентификатор предложения.');
      return;
    }

    let client = null;
    try {
      client = await beginTx(pool);
      // Advisory-лок ПЕРВЫМ: дальше пойдут строки предложения и сейфа.
      await acquireMarketLock(client);

      // Плейн FOR UPDATE (не SKIP LOCKED): клиент спросил про КОНКРЕТНОЕ
      // предложение — честнее подождать и сказать правду, чем притвориться,
      // что его нет.
      const offerRes = await client.query(
        `SELECT id, seller_id, buyer_id, offer_resource, offer_amount::text AS offer_amount,
                want_credits::text AS want_credits, want_resource, want_amount::text AS want_amount,
                status, fee_percent::text AS fee_percent, escrow_amount::text AS escrow_amount,
                (expires_at <= NOW()) AS is_expired
           FROM market_direct_offers
          WHERE id = $1
          FOR UPDATE`,
        [id]
      );
      if (offerRes.rowCount === 0) {
        await rollback(client);
        fail(res, 404, 'OFFER_NOT_FOUND', 'Предложение не найдено.');
        return;
      }
      const offer = offerRes.rows[0];
      const buyerId = req.userId;

      if (offer.seller_id === buyerId) {
        await rollback(client);
        fail(res, 400, 'SELF_ACCEPT', 'Нельзя принять собственное предложение.');
        return;
      }
      /*
       * Статус проверяется РАНЬШЕ адресата специально. Публичное предложение при
       * приёме получает buyer_id = принявший, поэтому проигравший в гонке двух
       * одновременных accept иначе получил бы «адресовано другому» вместо честного
       * «уже не активно» — и заодно узнал бы, кто его увёл.
       */
      if (offer.status !== 'open') {
        await rollback(client);
        fail(res, 409, 'OFFER_NOT_OPEN', 'Предложение больше не активно.', { status: offer.status });
        return;
      }
      if (offer.buyer_id !== null && offer.buyer_id !== buyerId) {
        await rollback(client);
        fail(res, 403, 'OFFER_NOT_FOR_YOU', 'Это предложение адресовано другому игроку.');
        return;
      }
      if (offer.is_expired) {
        // Истекло, но зачистка ещё не дошла: закрываем и возвращаем эскроу здесь же.
        const escrowU = dbUnits(offer.escrow_amount);
        await client.query(
          `UPDATE market_direct_offers SET status = 'expired', escrow_amount = 0 WHERE id = $1`,
          [id]
        );
        if (escrowU > 0n) {
          await lockVaultRows(client, [{ playerId: offer.seller_id, resource: offer.offer_resource }]);
          await vaultUnlock(client, offer.seller_id, offer.offer_resource, escrowU, 'offer_escrow_release', id);
        }
        await client.query('COMMIT');
        fail(res, 409, 'OFFER_EXPIRED', 'Срок предложения истёк.');
        return;
      }

      const offerU = dbUnits(offer.offer_amount);
      const escrowU = dbUnits(offer.escrow_amount);
      if (escrowU < offerU) {
        await rollback(client);
        fail(res, 409, 'OFFER_NOT_BACKED', 'Предложение не обеспечено ресурсом в сейфе.');
        return;
      }

      const isSale = offer.want_credits !== null;
      const payResource = isSale ? VAULT_CREDITS : offer.want_resource;
      const payU = isSale ? dbUnits(offer.want_credits) : dbUnits(offer.want_amount);

      // Все строки сейфа — одним отсортированным locking-запросом.
      const locked = await lockVaultRows(client, [
        { playerId: offer.seller_id, resource: offer.offer_resource },
        { playerId: buyerId, resource: offer.offer_resource },
        { playerId: buyerId, resource: payResource },
        { playerId: offer.seller_id, resource: payResource },
      ]);

      const buyerPay = vaultBalance(locked, buyerId, payResource);
      if (buyerPay.availableU < payU) {
        await rollback(client);
        fail(res, 400, 'INSUFFICIENT_VAULT_BALANCE', 'В сейфе биржи недостаточно средств, чтобы принять предложение.', {
          resource: payResource,
          required: fromUnits(payU),
          available: fromUnits(buyerPay.availableU),
        });
        return;
      }

      const sellerHas = vaultBalance(locked, offer.seller_id, offer.offer_resource);
      if (sellerHas.lockedU < offerU) {
        await rollback(client);
        fail(res, 409, 'OFFER_NOT_BACKED', 'Эскроу предложения не совпадает с сейфом продавца.');
        return;
      }

      const feeU = isSale ? feeUnits(payU, dbUnits(offer.fee_percent), 'trunc') : 0n;

      await client.query(
        `UPDATE market_direct_offers
            SET status = 'accepted', accepted_at = NOW(), escrow_amount = 0,
                buyer_id = COALESCE(buyer_id, $2)
          WHERE id = $1`,
        [id, buyerId]
      );

      // Нога товара: из эскроу продавца -> в доступное покупателю.
      await vaultSpendLocked(client, offer.seller_id, offer.offer_resource, offerU, 'offer_give_resource', id);
      await vaultCredit(client, buyerId, offer.offer_resource, offerU, 'offer_take_resource', id);

      // Нога оплаты: кредиты (продажа) или второй ресурс (барт).
      await vaultDebit(client, buyerId, payResource, payU, isSale ? 'offer_pay_credits' : 'offer_pay_resource', id);
      await vaultCredit(client, offer.seller_id, payResource, payU, isSale ? 'offer_recv_credits' : 'offer_recv_resource', id);
      if (feeU > 0n) {
        await vaultDebit(client, offer.seller_id, payResource, feeU, 'offer_fee', id);
      }

      await client.query('COMMIT');
      res.json({
        ok: true,
        offer: {
          id,
          status: 'accepted',
          sellerId: String(offer.seller_id),
          buyerId: String(buyerId),
          offerResource: offer.offer_resource,
          offerAmount: fromUnits(offerU),
          payResource,
          payAmount: fromUnits(payU),
          fee: fromUnits(feeU),
          kind: isSale ? 'sale' : 'barter',
        },
      });
    } catch (e) {
      if (client) await rollback(client);
      serverError(res, e, 'POST /api/market/offers/:id/accept');
    } finally {
      if (client) client.release();
    }
  });

  /** POST /api/market/offers/:id/decline — отказ адресата, эскроу возвращается. */
  app.post('/api/market/offers/:id/decline', authMiddleware, async (req, res) => {
    const { id } = req.params;
    if (!isUuid(id)) {
      fail(res, 400, 'INVALID_ID', 'Некорректный идентификатор предложения.');
      return;
    }

    let client = null;
    try {
      client = await beginTx(pool);
      await acquireMarketLock(client);
      const offerRes = await client.query(
        `SELECT id, seller_id, buyer_id, offer_resource, escrow_amount::text AS escrow_amount, status
           FROM market_direct_offers WHERE id = $1 FOR UPDATE`,
        [id]
      );
      if (offerRes.rowCount === 0) {
        await rollback(client);
        fail(res, 404, 'OFFER_NOT_FOUND', 'Предложение не найдено.');
        return;
      }
      const offer = offerRes.rows[0];
      if (offer.buyer_id !== req.userId) {
        await rollback(client);
        fail(res, 403, 'OFFER_NOT_FOR_YOU', 'Отклонить можно только предложение, адресованное вам.');
        return;
      }
      if (offer.status !== 'open') {
        await rollback(client);
        fail(res, 409, 'OFFER_NOT_OPEN', 'Предложение больше не активно.', { status: offer.status });
        return;
      }

      const escrowU = dbUnits(offer.escrow_amount);
      await client.query(
        `UPDATE market_direct_offers SET status = 'declined', escrow_amount = 0 WHERE id = $1`,
        [id]
      );
      if (escrowU > 0n) {
        await lockVaultRows(client, [{ playerId: offer.seller_id, resource: offer.offer_resource }]);
        await vaultUnlock(client, offer.seller_id, offer.offer_resource, escrowU, 'offer_escrow_release', id);
      }
      await client.query('COMMIT');
      res.json({ ok: true, offer: { id, status: 'declined', refunded: fromUnits(escrowU) } });
    } catch (e) {
      if (client) await rollback(client);
      serverError(res, e, 'POST /api/market/offers/:id/decline');
    } finally {
      if (client) client.release();
    }
  });

  /** DELETE /api/market/offers/:id — отмена продавцом, эскроу возвращается. */
  app.delete('/api/market/offers/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    if (!isUuid(id)) {
      fail(res, 400, 'INVALID_ID', 'Некорректный идентификатор предложения.');
      return;
    }

    let client = null;
    try {
      client = await beginTx(pool);
      await acquireMarketLock(client);
      const offerRes = await client.query(
        `SELECT id, seller_id, offer_resource, escrow_amount::text AS escrow_amount, status
           FROM market_direct_offers WHERE id = $1 FOR UPDATE`,
        [id]
      );
      if (offerRes.rowCount === 0) {
        await rollback(client);
        fail(res, 404, 'OFFER_NOT_FOUND', 'Предложение не найдено.');
        return;
      }
      const offer = offerRes.rows[0];
      if (offer.seller_id !== req.userId) {
        await rollback(client);
        fail(res, 403, 'NOT_YOUR_OFFER', 'Это не ваше предложение.');
        return;
      }
      if (offer.status !== 'open') {
        await rollback(client);
        fail(res, 409, 'OFFER_NOT_OPEN', 'Предложение больше не активно.', { status: offer.status });
        return;
      }

      const escrowU = dbUnits(offer.escrow_amount);
      await client.query(
        `UPDATE market_direct_offers SET status = 'cancelled', escrow_amount = 0 WHERE id = $1`,
        [id]
      );
      if (escrowU > 0n) {
        await lockVaultRows(client, [{ playerId: offer.seller_id, resource: offer.offer_resource }]);
        await vaultUnlock(client, offer.seller_id, offer.offer_resource, escrowU, 'offer_escrow_release', id);
      }
      await client.query('COMMIT');
      res.json({ ok: true, offer: { id, status: 'cancelled', refunded: fromUnits(escrowU) } });
    } catch (e) {
      if (client) await rollback(client);
      serverError(res, e, 'DELETE /api/market/offers/:id');
    } finally {
      if (client) client.release();
    }
  });
}

export { VAULT_CONSTANTS };
