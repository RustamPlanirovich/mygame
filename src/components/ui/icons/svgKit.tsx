import type { ReactNode } from 'react';

/* ==========================================================================
   Shared drawing kit for the futuristic icon set.

   Every glyph is authored on a 24×24 grid and inherits stroke presentation
   from <GameIcon>: currentColor, 1.6 stroke, round caps/joins, no fill.
   Two colour slots are available so the set reads as duotone instead of flat:

     currentColor  — the line work (set from the glyph's `a` colour)
     var(--gi-2)   — the accent used for fills and highlights (glyph's `b`)

   Keep glyphs geometric: chamfered corners, hex frames, thin scan ticks.
   ========================================================================== */

/** Accent wash — the translucent body fill under the line work. */
export const F = { fill: 'var(--gi-2)', opacity: 0.24, stroke: 'none' } as const;
/** Solid accent — small details that should pop (pupils, cores, sparks). */
export const S = { fill: 'var(--gi-2)', stroke: 'none' } as const;
/** Line-coloured solid fill — for tiny marks that must stay legible. */
export const L = { fill: 'currentColor', stroke: 'none' } as const;

/** Isometric hexagon, the recurring "core/module" frame of the set. */
export const HEX = 'M12 2.7 20 7.15v9.7L12 21.3 4 16.85v-9.7z';
/** Chamfered card — a rectangle with the top-right corner cut. */
export const CARD = 'M4.5 4h11L19.5 8v12h-15z';

export type GlyphDef = {
  /** Line colour. */
  a: string;
  /** Accent colour used by {@link F}/{@link S}. */
  b: string;
  /** The artwork. */
  d: ReactNode;
};

/* Palette — mirrors the app tokens in tailwind.config.js so icons sit inside
   the same harmony as the rest of the UI instead of introducing new hues. */
export const P = {
  mint: '#4ff0b4',
  mintDeep: '#0c9a6a',
  azure: '#6cc6ff',
  azureDeep: '#1177cf',
  cyan: '#63e6e6',
  cyanDeep: '#128f96',
  gold: '#ffd070',
  goldDeep: '#d9992a',
  amber: '#ffab5e',
  amberDeep: '#d2691f',
  rose: '#ff8a9e',
  roseDeep: '#e2374f',
  violet: '#b9a2ff',
  violetDeep: '#7654e0',
  magenta: '#f58ce0',
  magentaDeep: '#c14bab',
  ink: '#9aa6bd',
  inkDeep: '#4d586e',
  steel: '#cfd8e8',
  steelDeep: '#7f8ca6',
  lime: '#c6f06a',
  limeDeep: '#7fae1c',
} as const;
