/**
 * Форматирование для админ-панели: даты, размеры, длительности и большие числа.
 *
 * Дата показывается одним правилом на всю панель: относительно — если меньше суток,
 * абсолютно — если больше; полный timestamp всегда уходит в title.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

function toDate(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** «5 мин», «3 ч», «2 дн» — без предлогов, чтобы годилось и для «назад», и для «через». */
function humanGap(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 45) return `${seconds} с`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} мин`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ч`;
  const days = Math.round(hours / 24);
  if (days < 45) return `${days} дн`;
  const months = Math.round(days / 30);
  if (months < 18) return `${months} мес`;
  return `${Math.round(days / 365)} г`;
}

/** Абсолютная дата: «04.08.2026, 19:05». */
export function formatAbsolute(value: string | number | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return '—';
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Полный timestamp для атрибута title. */
export function formatFull(value: string | number | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return 'нет данных';
  return `${date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })} (${date.toISOString()})`;
}

/**
 * Единый помощник для дат: относительно при возрасте < 24 ч, иначе абсолютно.
 * Полный timestamp берите из formatFull() и кладите в title.
 */
export function formatWhen(value: string | number | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return '—';
  const diff = Date.now() - date.getTime();
  if (Math.abs(diff) >= DAY_MS) return formatAbsolute(date);
  if (diff >= 0) return diff < 45_000 ? 'только что' : `${humanGap(diff)} назад`;
  return `через ${humanGap(-diff)}`;
}

/** Только относительная часть, без порога в сутки (для «истекает через …»). */
export function formatRelative(value: string | number | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return '—';
  const diff = Date.now() - date.getTime();
  if (diff >= 0) return diff < 45_000 ? 'только что' : `${humanGap(diff)} назад`;
  return `через ${humanGap(-diff)}`;
}

const BYTE_UNITS = ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ'] as const;

/** 11019043 → «10.5 МБ». */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) return '—';
  if (bytes < 1024) return `${Math.round(bytes)} Б`;
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < BYTE_UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${BYTE_UNITS[unit]}`;
}

/** 38400 → «10 ч 40 мин»; 0 → «0 мин». */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds < 0) {
    return '—';
  }
  const total = Math.floor(seconds);
  if (total < 60) return `${total} с`;

  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);

  if (days > 0) return hours > 0 ? `${days} д ${hours} ч` : `${days} д`;
  if (hours > 0) return minutes > 0 ? `${hours} ч ${minutes} мин` : `${hours} ч`;
  return `${minutes} мин`;
}

/** Целое с разрядами: 1234567 → «1 234 567». */
export function formatInt(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return Math.round(value).toLocaleString('ru-RU');
}

const SCALE: Array<[number, string]> = [
  [1e15, 'кв'],
  [1e12, 'трлн'],
  [1e9, 'млрд'],
  [1e6, 'млн'],
  [1e3, 'тыс.'],
];

/**
 * Десятичная строка из БД (numeric) или из break_eternity в читаемый вид.
 *
 * Значения вида 1e500 / 10^^5 / (10^)^7 1.5 в Number не влезают — такие строки
 * возвращаются как есть (обрезанными), полное значение показывайте в title.
 */
export function formatAmount(value: string | number | null | undefined, maxRawLength = 18): string {
  if (value === null || value === undefined || value === '') return '—';
  const raw = typeof value === 'number' ? String(value) : value.trim();
  if (raw === '') return '—';

  const num = Number(raw);
  if (!Number.isFinite(num)) {
    return raw.length > maxRawLength ? `${raw.slice(0, maxRawLength)}…` : raw;
  }

  const abs = Math.abs(num);
  if (abs >= 1e18) return num.toExponential(2).replace('e+', 'e');
  for (const [threshold, suffix] of SCALE) {
    if (abs >= threshold) {
      const scaled = num / threshold;
      return `${scaled.toFixed(scaled < 10 ? 2 : scaled < 100 ? 1 : 0)} ${suffix}`;
    }
  }
  if (Number.isInteger(num)) return num.toLocaleString('ru-RU');
  return num.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
}

/** Ставка «0.085» → «8.5%». */
export function formatRate(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const num = Number(value);
  if (!Number.isFinite(num)) return String(value);
  // В БД ставка хранится долей (0.085); значения > 1 уже в процентах.
  const percent = num > 1 ? num : num * 100;
  return `${percent.toFixed(percent < 10 ? 2 : 1)}%`;
}

/** Проценты, уже записанные числом: «25» → «25%». */
export function formatPercent(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const num = Number(value);
  if (!Number.isFinite(num)) return String(value);
  return `${num.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}%`;
}

/** Обрезает длинный текст, добавляя многоточие. */
export function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

/** Компактный uuid: «8c4365e4…7d85». */
export function shortId(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  const raw = String(value);
  if (raw.length <= 12) return raw;
  return `${raw.slice(0, 8)}…${raw.slice(-4)}`;
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'администратор',
  moderator: 'модератор',
  player: 'игрок',
};

export function roleLabel(role: string | null | undefined): string {
  if (!role) return '—';
  return ROLE_LABELS[role] ?? role;
}

const ACTION_LABELS: Record<string, string> = {
  'player.update': 'изменение игрока',
  'player.ban': 'блокировка',
  'player.unban': 'разблокировка',
  'player.logout_all': 'выход со всех устройств',
  'player.password_reset': 'сброс пароля',
  'player.grant': 'выдача ресурсов',
  'player.orders_cancel_all': 'отмена всех ордеров',
  'player.delete': 'удаление игрока',
  'announcement.create': 'создание объявления',
  'announcement.delete': 'удаление объявления',
  'maintenance.expire_orders': 'истечение ордеров',
  'maintenance.cleanup_sessions': 'уборка сессий',
  'maintenance.oracle_refresh': 'обновление оракула',
};

/** Список действий для фильтра журнала — совпадает с тем, что пишет сервер. */
export const AUDIT_ACTIONS: ReadonlyArray<{ value: string; label: string }> = Object.entries(
  ACTION_LABELS,
).map(([value, label]) => ({ value, label }));

export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

/** Безопасный JSON.stringify с обрезкой: журнал и сохранения бывают многомегабайтными. */
export function safeJson(value: unknown, maxChars = 20000): { text: string; truncated: boolean } {
  let text: string;
  try {
    text = JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    text = '[не удалось сериализовать значение]';
  }
  if (text.length <= maxChars) return { text, truncated: false };
  return { text: text.slice(0, maxChars), truncated: true };
}
