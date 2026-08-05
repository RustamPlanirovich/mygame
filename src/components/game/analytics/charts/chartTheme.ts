/**
 * Общие константы оформления графиков.
 *
 * Раньше каждый график создавал `contentStyle`, `labelStyle` и `margin` заново на
 * каждый рендер. Recharts сравнивает такие пропсы по ссылке, поэтому новый объект
 * заставлял его пересобирать тултип и ось даже когда данные не менялись. Держим их
 * модульными константами — ссылка стабильна на всё время жизни приложения.
 */

export const CHART_MARGIN = { top: 5, right: 30, left: 20, bottom: 5 } as const;

export const TOOLTIP_CONTENT_STYLE = {
  backgroundColor: '#1f2937',
  border: '1px solid #374151',
  borderRadius: '8px',
  color: '#e5e7eb',
} as const;

export const TOOLTIP_LABEL_STYLE = { color: '#9ca3af' } as const;

export const AXIS_STROKE = '#9ca3af';
export const GRID_STROKE = '#374151';

export const DEFAULT_SERIES_COLOR = '#22c55e';

/** Палитра по умолчанию для круговых диаграмм. */
export const DEFAULT_PIE_COLORS = [
  '#22c55e', // green
  '#3b82f6', // blue
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#84cc16', // lime
  '#f97316', // orange
  '#6366f1', // indigo
];

/**
 * `useId()` возвращает строку вида `:r3:`; двоеточия ломают `url(#...)` в некоторых
 * движках, поэтому чистим их перед использованием в качестве id градиента.
 */
export function svgSafeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, '');
}
