/**
 * Общие константы оформления графиков.
 *
 * Раньше каждый график создавал `contentStyle`, `labelStyle` и `margin` заново на
 * каждый рендер. Recharts сравнивает такие пропсы по ссылке, поэтому новый объект
 * заставлял его пересобирать тултип и ось даже когда данные не менялись. Держим их
 * модульными константами — ссылка стабильна на всё время жизни приложения.
 */

/*
 * Поля были {right: 30, left: 20} — расчёт на широкий экран. Графики живут в боковой
 * панели шириной ~400px, и 50 пикселей пустых полей забирали там седьмую часть ширины:
 * подписи оси Y («1.26M») налезали на саму область графика.
 */
export const CHART_MARGIN = { top: 4, right: 8, left: 0, bottom: 0 } as const;

/** Размер подписей осей. 12px в узкой панели давали слипшиеся деления. */
export const AXIS_FONT_SIZE = 10;

/** Ширина колонки под подписи оси Y: хватает на «1.26M», но не съедает полграфика. */
export const Y_AXIS_WIDTH = 46;

export const TOOLTIP_CONTENT_STYLE = {
  backgroundColor: '#2d2f3a',
  border: '1px solid #3d3f4e',
  borderRadius: '5px',
  color: '#cbcdd8',
} as const;

export const TOOLTIP_LABEL_STYLE = { color: '#a6aabd' } as const;

export const AXIS_STROKE = '#7f849f';
export const GRID_STROKE = '#3d3f4e';

export const DEFAULT_SERIES_COLOR = '#3ee07f';

/**
 * Палитра по умолчанию для круговых диаграмм — набор Dracula, тот же, что и во
 * всём остальном тёмном оформлении. Оттенки идут через колесо, а не по яркости,
 * поэтому соседние сектора различимы даже когда их десять.
 */
export const DEFAULT_PIE_COLORS = [
  '#3ee07f', // green
  '#8be9fd', // cyan
  '#ffb86c', // orange
  '#ff5555', // red
  '#bd93f9', // purple
  '#f1fa8c', // yellow
  '#ff79c6', // pink
  '#a1e245', // lime
  '#3dc5de', // teal
  '#a370ef', // indigo
];

/**
 * `useId()` возвращает строку вида `:r3:`; двоеточия ломают `url(#...)` в некоторых
 * движках, поэтому чистим их перед использованием в качестве id градиента.
 */
export function svgSafeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, '');
}
