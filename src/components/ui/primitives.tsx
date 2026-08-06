import { useId, useMemo, type ReactNode } from 'react';
import { Inbox } from 'lucide-react';
import { IconText } from './icons';

/**
 * Titles and labels are handed in as plain strings all over the app, and many
 * of them still carry an emoji from the data layer. Routing them through
 * IconText draws those with the icon set instead of the system emoji font.
 */
const withIcons = (v: ReactNode): ReactNode =>
  typeof v === 'string' ? <IconText>{v}</IconText> : v;
import { GameIcon } from './icons';

/* ==========================================================================
   Panel / Card
   ========================================================================== */

export function Panel({
  title,
  subtitle,
  icon,
  actions,
  className = '',
  bodyClassName = '',
  children,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <section className={`panel flex min-h-0 flex-col ${className}`}>
      {(title || actions) && (
        <header className="panel-header shrink-0">
          <div className="flex min-w-0 items-center gap-2">
            {icon && <span className="shrink-0 text-accent">{icon}</span>}
            <div className="min-w-0">
              {title && (
                <h3 className="truncate text-xs font-semibold uppercase tracking-wider text-content-secondary">
                  {withIcons(title)}
                </h3>
              )}
              {subtitle && (
                <p className="truncate text-3xs text-content-faint">{withIcons(subtitle)}</p>
              )}
            </div>
          </div>
          {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
        </header>
      )}
      <div className={`min-h-0 flex-1 p-3 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

/* ==========================================================================
   Segmented control / Tabs
   ========================================================================== */

export interface TabItem<T extends string> {
  id: T;
  label: ReactNode;
  icon?: ReactNode;
  /** Small count/indicator rendered after the label. */
  badge?: ReactNode;
  disabled?: boolean;
}

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  className = '',
  size = 'md',
  scroll = false,
}: {
  items: readonly TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
  size?: 'sm' | 'md';
  /**
   * Вкладки не делят ширину поровну, а занимают свою — ряд становится шире
   * контейнера и прокручивается. Нужно там, где вкладок больше пяти: в боковой
   * панели (~400px) `flex-1` ужимал их до 50px, а `.tab` не переносит текст —
   * подписи вылезали за кнопку и накладывались на соседние.
   */
  scroll?: boolean;
}) {
  return (
    <div role="tablist" className={`tabs ${scroll ? 'w-max min-w-full' : ''} ${className}`}>
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={item.disabled}
            onClick={() => onChange(item.id)}
            className={`tab flex items-center justify-center gap-1.5 ${
              active ? 'tab-active' : ''
            } ${size === 'sm' ? 'px-2 py-1 text-2xs' : ''} ${
              scroll ? 'flex-none' : ''
            } ${item.disabled ? 'cursor-not-allowed opacity-40' : ''}`}
          >
            {item.icon}
            <span className="truncate">{withIcons(item.label)}</span>
            {item.badge != null && (
              <span
                className={`rounded-full px-1.5 text-3xs font-bold tabular-nums ${
                  active ? 'bg-accent/20 text-accent' : 'bg-white/8 text-content-faint'
                }`}
              >
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ==========================================================================
   Stat readout
   ========================================================================== */

export function Stat({
  label,
  value,
  hint,
  tone = 'neutral',
  icon,
  align = 'left',
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'neutral' | 'accent' | 'info' | 'warning' | 'danger';
  icon?: ReactNode;
  align?: 'left' | 'right' | 'center';
}) {
  const toneClass = {
    neutral: 'text-content-primary',
    accent: 'text-accent',
    info: 'text-info',
    warning: 'text-warning',
    danger: 'text-danger',
  }[tone];

  const alignClass = { left: 'items-start text-left', right: 'items-end text-right', center: 'items-center text-center' }[align];

  /*
   * `truncate` на самом флекс-контейнере подписи не работает: у `display:flex`
   * не действует `text-overflow`, а текстовый ребёнок с `min-width:auto` не
   * сжимается и вылезает за границы. В узкой боковой панели (~400px) подписи
   * вроде «Энергопотребление» из-за этого налезали на соседнюю колонку.
   * Обрезаем ВНУТРЕННИЙ span, а контейнеру даём `min-w-0`.
   */
  return (
    <div className={`flex min-w-0 max-w-full flex-col gap-0.5 ${alignClass}`}>
      <span className="stat-label flex min-w-0 max-w-full items-center gap-1">
        {icon}
        <span className="min-w-0 truncate">{withIcons(label)}</span>
      </span>
      <span className={`max-w-full truncate font-mono text-sm font-semibold tabular-nums ${toneClass}`}>
        {value}
      </span>
      {hint != null && <span className="max-w-full truncate text-3xs text-content-faint">{hint}</span>}
    </div>
  );
}

/* ==========================================================================
   Badge
   ========================================================================== */

export function Badge({
  children,
  tone = 'neutral',
  className = '',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'accent' | 'info' | 'warning' | 'danger';
  className?: string;
}) {
  const cls = {
    neutral: 'badge',
    accent: 'badge badge-accent',
    info: 'badge badge-info',
    warning: 'badge badge-warning',
    danger: 'badge badge-danger',
  }[tone];
  return <span className={`${cls} ${className}`}>{withIcons(children)}</span>;
}

/* ==========================================================================
   Delta — a signed percentage/absolute change with the right colour and arrow
   ========================================================================== */

export function Delta({
  value,
  suffix = '%',
  digits = 2,
  showSign = true,
  className = '',
}: {
  value: number;
  suffix?: string;
  digits?: number;
  showSign?: boolean;
  className?: string;
}) {
  const safe = Number.isFinite(value) ? value : 0;
  const tone =
    safe > 0.0001 ? 'text-accent' : safe < -0.0001 ? 'text-danger' : 'text-content-faint';
  const arrow = safe > 0.0001 ? '▲' : safe < -0.0001 ? '▼' : '·';
  const sign = showSign && safe > 0 ? '+' : '';
  return (
    <span className={`inline-flex items-center gap-1 font-mono text-xs tabular-nums ${tone} ${className}`}>
      <span aria-hidden="true" className="text-3xs">
        {arrow}
      </span>
      {sign}
      {safe.toFixed(digits)}
      {suffix}
    </span>
  );
}

/* ==========================================================================
   Empty state
   ========================================================================== */

export function EmptyState({
  title,
  hint,
  icon,
  action,
}: {
  title: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="text-content-faint/60">{icon ?? <Inbox size={22} />}</span>
      <p className="text-xs font-medium text-content-muted">{withIcons(title)}</p>
      {hint && <p className="max-w-xs text-3xs leading-relaxed text-content-faint">{hint}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

/* ==========================================================================
   Skeleton
   ========================================================================== */

export function Skeleton({ className = 'h-4 w-full' }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

export function SkeletonRows({ rows = 5, className = '' }: { rows?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`} aria-busy="true">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-7 w-full" />
      ))}
    </div>
  );
}

/* ==========================================================================
   Meter
   ========================================================================== */

export function Meter({
  value,
  max = 1,
  tone = 'accent',
  className = '',
}: {
  value: number;
  max?: number;
  tone?: 'accent' | 'info' | 'warning' | 'danger';
  className?: string;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const bg = {
    accent: 'bg-accent',
    info: 'bg-info',
    warning: 'bg-warning',
    danger: 'bg-danger',
  }[tone];
  return (
    <div className={`meter ${className}`} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`meter-fill ${bg}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

/* ==========================================================================
   Sparkline — inline SVG, no chart library, no per-frame work
   ========================================================================== */

export function Sparkline({
  points,
  height = 40,
  tone,
  showArea = true,
  className = '',
}: {
  /** Y values, oldest first. */
  points: readonly number[];
  height?: number;
  /** Defaults to green when the series ends up, red when down. */
  tone?: 'accent' | 'danger' | 'info';
  showArea?: boolean;
  className?: string;
}) {
  const gradientId = useId();

  const geometry = useMemo(() => {
    const vals = points.filter((v) => Number.isFinite(v));
    if (vals.length < 2) return null;

    const min = Math.min(...vals);
    const max = Math.max(...vals);
    // A flat series would divide by zero; render it as a centred line instead.
    const span = max - min || 1;
    const W = 100;
    const H = 100;
    const pad = 6;

    const coords = vals.map((v, i) => {
      const x = (i / (vals.length - 1)) * W;
      const y = H - pad - ((v - min) / span) * (H - pad * 2);
      return [x, y] as const;
    });

    const line = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
    const area = `${line} L${W},${H} L0,${H} Z`;
    const rising = vals[vals.length - 1] >= vals[0];

    return { line, area, rising, last: coords[coords.length - 1] };
  }, [points]);

  if (!geometry) {
    return (
      <div
        className={`flex items-center justify-center text-3xs text-content-faint ${className}`}
        style={{ height }}
      >
        Недостаточно данных
      </div>
    );
  }

  const resolved = tone ?? (geometry.rising ? 'accent' : 'danger');
  const stroke = { accent: '#3ee07f', danger: '#ff5555', info: '#5ed8f2' }[resolved];

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className={`w-full overflow-visible ${className}`}
      style={{ height }}
      role="img"
      aria-label="График"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      {showArea && <path d={geometry.area} fill={`url(#${gradientId})`} />}
      <path
        d={geometry.line}
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={geometry.last[0]} cy={geometry.last[1]} r="2.5" fill={stroke} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/* ==========================================================================
   Field — label + control + error, so forms stop re-inventing this
   ========================================================================== */

export function Field({
  label,
  hint,
  error,
  children,
  className = '',
}: {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      {label && (
        <span className="flex items-baseline justify-between gap-2">
          <span className="text-2xs font-medium uppercase tracking-wider text-content-faint">
            {withIcons(label)}
          </span>
          {hint && <span className="text-3xs text-content-faint">{hint}</span>}
        </span>
      )}
      {children}
      {error && <span className="text-3xs text-danger">{error}</span>}
    </label>
  );
}

/* ==========================================================================
   Alert
   ========================================================================== */

export function Alert({
  tone = 'info',
  title,
  children,
  onDismiss,
}: {
  tone?: 'info' | 'warning' | 'danger' | 'accent';
  title?: ReactNode;
  children?: ReactNode;
  onDismiss?: () => void;
}) {
  const styles = {
    info: 'border-info/40 bg-info/10 text-info',
    warning: 'border-warning/40 bg-warning/10 text-warning',
    danger: 'border-danger/40 bg-danger/10 text-danger',
    accent: 'border-accent/40 bg-accent/10 text-accent',
  }[tone];

  return (
    <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${styles}`} role="alert">
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{withIcons(title)}</p>}
        {children && <div className="text-content-secondary">{withIcons(children)}</div>}
      </div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="icon-btn h-5 w-5 shrink-0" aria-label="Скрыть">
          <GameIcon icon="✕" />
        </button>
      )}
    </div>
  );
}
