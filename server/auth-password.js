/**
 * Хеширование паролей на scrypt (node:crypto, без внешних зависимостей).
 *
 * Формат хранения:  scrypt$<N>$<r>$<p>$<saltHex>$<hashHex>
 *
 * Совместимость: раньше пароли хранились в открытом виде. verifyPassword() умеет
 * проверять и такие значения, возвращая needsUpgrade: true — вызывающий код
 * прозрачно перезаписывает строку хешем при первом успешном входе.
 */
import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(crypto.scrypt);

export const HASH_PREFIX = 'scrypt$';

/** Текущие параметры KDF. ~16 МБ памяти и ~50-80 мс на проверку. */
export const SCRYPT_PARAMS = Object.freeze({ N: 16384, r: 8, p: 1, keylen: 64, saltBytes: 16 });

/** Разумные границы для параметров, прочитанных из БД (защита от подобранного значения). */
const MAX_N = 1 << 20;
const MAX_R = 32;
const MAX_P = 16;
const MAX_KEYLEN = 256;

/**
 * Аварийный выключатель: LEGACY_PLAINTEXT_PASSWORDS=1 продолжает писать пароли открытым текстом.
 * Только для отладки/миграции — на проде включать нельзя.
 */
export const LEGACY_PLAINTEXT_PASSWORDS = process.env.LEGACY_PLAINTEXT_PASSWORDS === '1';

let legacyWarningShown = false;

/** Громко предупреждаем на старте, если включён режим открытых паролей. */
export function warnIfLegacyPasswordMode() {
  if (!LEGACY_PLAINTEXT_PASSWORDS) return false;
  if (!legacyWarningShown) {
    legacyWarningShown = true;
    console.warn('='.repeat(78));
    console.warn('[auth] ВНИМАНИЕ: LEGACY_PLAINTEXT_PASSWORDS=1 — пароли сохраняются В ОТКРЫТОМ ВИДЕ.');
    console.warn('[auth] Это небезопасно, особенно при наличии администраторских аккаунтов.');
    console.warn('[auth] Уберите переменную окружения, чтобы включить scrypt-хеширование.');
    console.warn('='.repeat(78));
  }
  return true;
}

/** Значение уже является хешем? */
export function isPasswordHashed(stored) {
  return typeof stored === 'string' && stored.startsWith(HASH_PREFIX);
}

function scryptMaxmem(N, r) {
  // node по умолчанию ограничивает 32 МБ; даём запас (128 * N * r байт + 8 МБ).
  return 128 * N * r + 8 * 1024 * 1024;
}

/**
 * Всегда возвращает scrypt-хеш, независимо от LEGACY_PLAINTEXT_PASSWORDS.
 * @param {string} plain
 * @returns {Promise<string>} scrypt$N$r$p$salt$hash
 */
export async function hashPassword(plain) {
  if (typeof plain !== 'string' || plain.length === 0) {
    throw new Error('PASSWORD_REQUIRED');
  }
  const { N, r, p, keylen, saltBytes } = SCRYPT_PARAMS;
  const salt = crypto.randomBytes(saltBytes);
  const hash = await scryptAsync(plain, salt, keylen, { N, r, p, maxmem: scryptMaxmem(N, r) });
  return `${HASH_PREFIX}${N}$${r}$${p}$${salt.toString('hex')}$${hash.toString('hex')}`;
}

/**
 * То, что нужно положить в колонку users.password.
 * Учитывает аварийный режим открытых паролей.
 * @param {string} plain
 * @returns {Promise<string>}
 */
export async function encodePasswordForStorage(plain) {
  if (typeof plain !== 'string' || plain.length === 0) {
    throw new Error('PASSWORD_REQUIRED');
  }
  if (LEGACY_PLAINTEXT_PASSWORDS) {
    warnIfLegacyPasswordMode();
    return plain;
  }
  return hashPassword(plain);
}

/** Сравнение строк за постоянное время (через хеши фиксированной длины). */
function constantTimeEqualString(a, b) {
  const ha = crypto.createHash('sha256').update(String(a), 'utf8').digest();
  const hb = crypto.createHash('sha256').update(String(b), 'utf8').digest();
  return crypto.timingSafeEqual(ha, hb);
}

/**
 * Проверка пароля.
 * @param {string} plain пароль из запроса
 * @param {string} stored значение из users.password
 * @returns {Promise<{ ok: boolean, needsUpgrade: boolean, malformed?: boolean }>}
 *   needsUpgrade === true означает, что в БД лежит устаревшее (открытое) значение
 *   и его следует перезаписать через encodePasswordForStorage().
 */
export async function verifyPassword(plain, stored) {
  if (typeof plain !== 'string' || plain.length === 0) return { ok: false, needsUpgrade: false };
  if (typeof stored !== 'string' || stored.length === 0) return { ok: false, needsUpgrade: false };

  if (!isPasswordHashed(stored)) {
    // Наследие: пароль в открытом виде.
    return { ok: constantTimeEqualString(plain, stored), needsUpgrade: true };
  }

  const parts = stored.split('$');
  // ['scrypt', N, r, p, saltHex, hashHex]
  if (parts.length !== 6) return { ok: false, needsUpgrade: false, malformed: true };

  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const saltHex = parts[4];
  const hashHex = parts[5];

  const validParams =
    Number.isInteger(N) && N >= 2 && N <= MAX_N && (N & (N - 1)) === 0 &&
    Number.isInteger(r) && r >= 1 && r <= MAX_R &&
    Number.isInteger(p) && p >= 1 && p <= MAX_P &&
    /^[0-9a-f]+$/i.test(saltHex) && saltHex.length % 2 === 0 &&
    /^[0-9a-f]+$/i.test(hashHex) && hashHex.length % 2 === 0;

  if (!validParams) return { ok: false, needsUpgrade: false, malformed: true };

  const expected = Buffer.from(hashHex, 'hex');
  const salt = Buffer.from(saltHex, 'hex');
  if (expected.length === 0 || expected.length > MAX_KEYLEN || salt.length === 0) {
    return { ok: false, needsUpgrade: false, malformed: true };
  }

  try {
    const actual = await scryptAsync(plain, salt, expected.length, {
      N, r, p, maxmem: scryptMaxmem(N, r),
    });
    return { ok: crypto.timingSafeEqual(actual, expected), needsUpgrade: false };
  } catch {
    return { ok: false, needsUpgrade: false, malformed: true };
  }
}

let dummyStoredHashPromise = null;

/**
 * Хеш от случайного пароля. Нужен, чтобы вход по несуществующему e-mail занимал
 * столько же времени, сколько вход по существующему (защита от перебора адресов).
 * @returns {Promise<string>}
 */
export function getDummyStoredHash() {
  if (!dummyStoredHashPromise) {
    dummyStoredHashPromise = hashPassword(crypto.randomBytes(32).toString('hex')).catch((e) => {
      dummyStoredHashPromise = null;
      throw e;
    });
  }
  return dummyStoredHashPromise;
}
