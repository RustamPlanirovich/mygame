/**
 * Мелкие общие элементы админ-панели: дата, бейджи роли и бана, сворачиваемые
 * секции, блок JSON с обрезкой и пагинация. Всё собрано здесь, чтобы разделы
 * не переизобретали одно и то же и выглядели одинаково.
 */

import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge } from '../ui';
import { formatBytes, formatFull, formatWhen, roleLabel, safeJson } from '../../utils/adminFormat';

/* ==========================================================================
   Дата и числа
   ========================================================================== */

/** Единый вид даты: относительно при возрасте < 24 ч, иначе абсолютно; полное — в title. */
export function When({
  value,
  className = '',
}: {
  value: string | number | Date | null | undefined;
  className?: string;
}) {
  return (
    <span
      className={`font-mono text-xs tabular-nums text-content-muted ${className}`}
      title={formatFull(value)}
    >
      {formatWhen(value)}
    </span>
  );
}

/** Числовое значение: моноширинный, табличные цифры, полное значение в title. */
export function Num({
  children,
  title,
  className = '',
}: {
  children: ReactNode;
  title?: string;
  className?: string;
}) {
  return (
    <span className={`font-mono tabular-nums ${className}`} title={title}>
      {children}
    </span>
  );
}

/* ==========================================================================
   Бейджи состояния
   ========================================================================== */

export function RoleBadge({ role }: { role: string | null | undefined }) {
  const tone = role === 'admin' ? 'danger' : role === 'moderator' ? 'info' : 'neutral';
  return <Badge tone={tone}>{roleLabel(role)}</Badge>;
}

export function BanBadge({
  isBanned,
  banPermanent,
  bannedUntil,
}: {
  isBanned: boolean;
  banPermanent: boolean;
  bannedUntil: string | null;
}) {
  if (!isBanned) return <Badge tone="neutral">активен</Badge>;
  if (banPermanent) return <Badge tone="danger">бан навсегда</Badge>;
  return (
    <Badge tone="warning">
      <span title={formatFull(bannedUntil)}>бан до {formatWhen(bannedUntil)}</span>
    </Badge>
  );
}

export function OnlineDot({
  online,
  lastActivityAt,
}: {
  online: boolean;
  lastActivityAt?: string | null;
}) {
  const label = online
    ? 'в сети'
    : lastActivityAt
      ? `не в сети, активность: ${formatFull(lastActivityAt)}`
      : 'не в сети';
  return (
    <span
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${
        online ? 'bg-accent shadow-glow-accent' : 'bg-edge-strong'
      }`}
      role="img"
      aria-label={label}
      title={label}
    />
  );
}

/* ==========================================================================
   Пара «поле — значение»
   ========================================================================== */

export function KeyValue({
  label,
  children,
  title,
}: {
  label: ReactNode;
  children: ReactNode;
  title?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="stat-label truncate">{label}</span>
      <span className="min-w-0 break-words text-xs text-content-secondary" title={title}>
        {children}
      </span>
    </div>
  );
}

/* ==========================================================================
   Сворачиваемая секция карточки игрока
   ========================================================================== */

export function Section({
  title,
  icon,
  count,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon?: ReactNode;
  count?: number;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="overflow-hidden rounded-lg border border-edge bg-surface-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 bg-surface-3 px-3 py-2 text-left transition-colors hover:bg-surface-4"
      >
        <span className="flex min-w-0 items-center gap-2">
          {icon && <span className="shrink-0 text-accent">{icon}</span>}
          <span className="truncate text-xs font-semibold uppercase tracking-wider text-content-secondary">
            {title}
          </span>
          {count !== undefined && (
            <span className="shrink-0 rounded-full bg-white/10 px-1.5 font-mono text-3xs font-bold tabular-nums text-content-faint">
              {count}
            </span>
          )}
        </span>
        <ChevronDown
          size={14}
          className={`shrink-0 text-content-faint transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      {open && <div className="p-3">{children}</div>}
    </section>
  );
}

/* ==========================================================================
   JSON-блок с обрезкой
   ========================================================================== */

/**
 * Сохранение может быть многомегабайтным, поэтому в DOM попадает не больше
 * maxChars символов — иначе один <pre> подвешивает вкладку.
 */
export function JsonBlock({
  value,
  maxChars = 20000,
  sizeBytes,
  className = '',
}: {
  value: unknown;
  maxChars?: number;
  sizeBytes?: number;
  className?: string;
}) {
  const { text, truncated } = safeJson(value, maxChars);
  return (
    <div className={`space-y-1 ${className}`}>
      <div className="flex flex-wrap items-center gap-2 text-3xs text-content-faint">
        {sizeBytes !== undefined && <span>размер: {formatBytes(sizeBytes)}</span>}
        <span>символов показано: {text.length.toLocaleString('ru-RU')}</span>
        {truncated && (
          <span className="text-warning">
            показано первые {maxChars.toLocaleString('ru-RU')} символов
          </span>
        )}
      </div>
      <pre className="max-h-72 overflow-auto rounded-md border border-edge bg-surface-base p-2 text-3xs leading-relaxed text-content-muted">
        {text}
      </pre>
    </div>
  );
}

/* ==========================================================================
   Пагинация
   ========================================================================== */

export function Pagination({
  offset,
  limit,
  total,
  onChange,
  busy = false,
  label = 'записей',
}: {
  offset: number;
  limit: number;
  total: number;
  onChange: (offset: number) => void;
  busy?: boolean;
  label?: string;
}) {
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + limit, total);
  const canPrev = offset > 0 && !busy;
  const canNext = offset + limit < total && !busy;

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="font-mono text-2xs tabular-nums text-content-faint">
        {from}–{to} из {total.toLocaleString('ru-RU')} {label}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="icon-btn"
          onClick={() => onChange(Math.max(0, offset - limit))}
          disabled={!canPrev}
          aria-label="Предыдущая страница"
          title="Предыдущая страница"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={() => onChange(offset + limit)}
          disabled={!canNext}
          aria-label="Следующая страница"
          title="Следующая страница"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
