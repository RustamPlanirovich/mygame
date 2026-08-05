import { Fragment, memo, type CSSProperties, type ReactNode } from 'react';
import { CORE_GLYPHS } from './glyphs.core';
import { WORLD_GLYPHS } from './glyphs.world';
import { UI_GLYPHS } from './glyphs.ui';
import { EMOJI_GLYPH, NAMED_GLYPH } from './emojiMap';
import type { GlyphDef } from './svgKit';

export const GLYPHS: Record<string, GlyphDef> = {
  ...CORE_GLYPHS,
  ...WORLD_GLYPHS,
  ...UI_GLYPHS,
};

/* Variation selectors and skin-tone/ZWJ joiners are noise for lookup: the data
   files write '⛏️' and '⛏' interchangeably. */
const stripVariation = (s: string) => s.replace(/[︎️]/g, '');

export type Resolved = { def: GlyphDef; a: string; b: string } | null;

const resolve = (raw: string): Resolved => {
  const key = stripVariation(raw).trim();
  if (!key) return null;

  // Whole-string match first so multi-codepoint emoji (🏴‍☠️) win over their
  // leading codepoint.
  const entry =
    EMOJI_GLYPH[key] ??
    EMOJI_GLYPH[[...key][0] ?? ''] ??
    NAMED_GLYPH[key] ??
    (GLYPHS[key] ? key : undefined);
  if (!entry) return null;

  if (typeof entry === 'string') {
    const def = GLYPHS[entry];
    return def ? { def, a: def.a, b: def.b } : null;
  }
  const def = GLYPHS[entry.g];
  return def ? { def, a: entry.a, b: entry.b } : null;
};

/** True when the string can be drawn by the icon set. */
export const hasGlyph = (raw: string) => resolve(raw) !== null;

/** Glyph lookup for non-React consumers (the PixiJS canvas). */
export const resolveGlyph = resolve;

export interface GameIconProps {
  /** An emoji from the game data, a semantic name, or a glyph id. */
  icon: string | undefined | null;
  /** Rendered box in px. Defaults to 1.15em so it tracks the surrounding text. */
  size?: number | string;
  className?: string;
  style?: CSSProperties;
  /** Adds a soft coloured halo — for hero/heading icons. */
  glow?: boolean;
  /** Drops the built-in colours and inherits the parent's `color`. */
  mono?: boolean;
  title?: string;
  /** Shown when the string has no glyph (defaults to the string itself). */
  fallback?: ReactNode;
  /** Only for icons nested inside an SVG scene (the hex grid): placement in user units. */
  x?: number;
  y?: number;
}

/**
 * Renders one icon from the futuristic set.
 *
 * Icons are duotone: the line work uses the glyph's `a` colour via
 * `currentColor`, and fills use `b` through the `--gi-2` custom property. In
 * `mono` mode both collapse onto the inherited text colour so the icon can sit
 * inside a coloured button or a hover state without fighting it.
 */
export const GameIcon = memo(function GameIcon({
  icon,
  size,
  className = '',
  style,
  glow = false,
  mono = false,
  title,
  fallback,
  x,
  y,
}: GameIconProps) {
  const resolved = icon ? resolve(icon) : null;

  if (!resolved) {
    // Unmapped strings (plain text badges like 'v2', 'T6') still need to show.
    return <>{fallback ?? icon ?? null}</>;
  }

  const { def, a, b } = resolved;
  const box = size ?? '1.15em';

  return (
    <svg
      viewBox="0 0 24 24"
      x={x}
      y={y}
      width={box}
      height={box}
      className={`game-icon${glow ? ' game-icon--glow' : ''} ${className}`}
      style={
        {
          color: mono ? undefined : a,
          '--gi-2': mono ? 'currentColor' : b,
          ...style,
        } as CSSProperties
      }
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      <Fragment>{def.d}</Fragment>
    </svg>
  );
});

/**
 * Splits a string that mixes emoji and words, drawing the emoji parts with the
 * icon set. Lets runtime-built strings (notifications, tooltips, log lines)
 * pick up the new art without rewriting every message.
 */
export function IconText({
  children,
  size,
  className = '',
}: {
  children: string | false | undefined | null;
  size?: number | string;
  className?: string;
}) {
  if (!children) return null;
  const parts = [...children];
  const out: ReactNode[] = [];
  let buffer = '';

  const flush = () => {
    if (buffer) {
      out.push(buffer);
      buffer = '';
    }
  };

  for (let i = 0; i < parts.length; i += 1) {
    // Take the whole grapheme: base codepoint plus any variation selector,
    // keycap or ZWJ-joined follower, so '🏴‍☠️' stays one icon rather than two.
    let seq = parts[i] ?? '';
    for (;;) {
      const next = parts[i + 1];
      if (next === '︎' || next === '️' || next === '⃣') {
        seq += next;
        i += 1;
        continue;
      }
      if (next === '‍' && parts[i + 2]) {
        seq += next + parts[i + 2];
        i += 2;
        continue;
      }
      break;
    }
    if (hasGlyph(seq)) {
      flush();
      out.push(
        <GameIcon key={`gi-${i}`} icon={seq} size={size} className="inline-block align-[-0.15em]" />,
      );
    } else {
      buffer += seq;
    }
  }
  flush();

  return <span className={className}>{out}</span>;
}
