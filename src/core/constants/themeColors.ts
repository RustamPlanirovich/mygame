/**
 * Canvas palette.
 *
 * The Pixi map cannot read CSS custom properties, so the values from
 * src/index.css are mirrored here as 0xRRGGBB. Keep the two in sync: the map is
 * the largest surface in the game and any drift between it and the panels reads
 * immediately as a bug.
 *
 * Colours follow the Industry Idle dark themes — a Dracula background with the
 * map drawn in a near-white "building" colour over a muted grid, and states
 * limited to green / red / orange.
 */
export const THEME_COLORS = {
  /** Page backdrop behind the map. */
  cyberBlack: 0x1e1f28,
  /** The map surface itself — Dracula's #282a36. */
  cyberDark: 0x282a36,
  /** Grid lines and inert strokes — Industry Idle's own Dracula grid colour. */
  cyberGray: 0x4f515c,

  cyberGreen: 0x3ee07f,
  cyberBlue: 0x8be9fd,
  cyberRed: 0xff5555,
  cyberYellow: 0xffb86c,
  /** Foreground: buildings, labels, anything that must stay readable. */
  cyberText: 0xf8f8f2,

  /** Panel surface, for popovers drawn on the canvas. */
  surface: 0x2d2f3a,
  /** Selection / focus. */
  selected: 0x8be9fd,
  purple: 0xbd93f9,
  orange: 0xf39c12,
  brown: 0xa1785a,
} as const;

/** `0x282a36` → `#282a36`, for the DOM side of a canvas component. */
export const hexToCss = (hex: number) => `#${hex.toString(16).padStart(6, '0')}`;
