/**
 * Icon colours.
 *
 * The set is monochrome by default — a Material glyph takes the `color` of
 * whatever it sits in, exactly like the icon font in Industry Idle. Only marks
 * whose *whole meaning* is the colour (the status dots, a red alert) carry a
 * fixed value, and those come from the flat-UI palette the reference game uses
 * for its own red/green/orange states.
 */
export const P = {
  green: '#2ecc71',
  red: '#e74c3c',
  orange: '#f39c12',
  yellow: '#f1c40f',
  blue: '#3aa1e0',
  cyan: '#3dc5de',
  violet: '#9b8cf0',
  magenta: '#e07bc4',
  white: '#e8e6e3',
  grey: '#8b8d84',
  dark: '#55574f',
} as const;

export type IconColor = (typeof P)[keyof typeof P];
