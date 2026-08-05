import { memo, type CSSProperties, type ReactNode } from 'react';
import { GLYPH_ALIASES, GLYPH_PATHS } from './glyphs';
import { EMOJI_GLYPH, NAMED_GLYPH } from './emojiMap';

export { GLYPH_PATHS as GLYPHS };

/* Variation selectors and keycap/ZWJ joiners are noise for lookup: the data
   files write '⛏️' and '⛏' interchangeably. */
const stripVariation = (s: string) => s.replace(/[︎️]/g, '');

export type Resolved = { d: string; color?: string } | null;

/* Resolution walks four tables and runs for every character IconText scans, so
   the answer is memoised. The tables are static — the cache can never go stale. */
const cache = new Map<string, Resolved>();

function lookup(raw: string): Resolved {
  const key = stripVariation(raw).trim();
  if (!key) return null;

  // Whole-string match first so multi-codepoint emoji (🏴‍☠️) win over their
  // leading codepoint.
  const entry =
    EMOJI_GLYPH[key] ??
    EMOJI_GLYPH[[...key][0] ?? ''] ??
    NAMED_GLYPH[key] ??
    (GLYPH_ALIASES[key] || (GLYPH_PATHS[key] ? key : undefined));
  if (!entry) return null;

  const name = typeof entry === 'string' ? entry : entry.g;
  const d = GLYPH_PATHS[GLYPH_ALIASES[name] ?? name];
  if (!d) return null;

  return typeof entry === 'string' ? { d } : { d, color: entry.c };
}

function resolve(raw: string): Resolved {
  const hit = cache.get(raw);
  if (hit !== undefined) return hit;
  const found = lookup(raw);
  cache.set(raw, found);
  return found;
}

/** True when the string can be drawn by the icon set. */
export const hasGlyph = (raw: string) => resolve(raw) !== null;

/** Glyph lookup for non-React consumers (the PixiJS canvas). */
export const resolveGlyph = resolve;

export interface GameIconProps {
  /** An emoji from the game data, a semantic name, or a Material Icons name. */
  icon: string | undefined | null;
  /** Rendered box in px. Defaults to 1.15em so it tracks the surrounding text. */
  size?: number | string;
  className?: string;
  style?: CSSProperties;
  /** @deprecated The flat set has no halo; kept so old call sites still compile. */
  glow?: boolean;
  /** Drops a glyph's fixed colour so it inherits the parent's `color`. */
  mono?: boolean;
  title?: string;
  /** Shown when the string has no glyph (defaults to the string itself). */
  fallback?: ReactNode;
  /** Only for icons nested inside an SVG scene (the hex grid): placement in user units. */
  x?: number;
  y?: number;
}

/**
 * Renders one icon from the Material Icons set — the same family Industry Idle
 * uses, so the whole UI reads as a single flat, dark, solid-silhouette system.
 *
 * Glyphs are painted with `fill: currentColor`, i.e. they take the colour of
 * whatever they sit in. The handful of marks whose colour *is* the information
 * (status dots, ✅/❌, ▲/▼) carry a fixed colour from the palette; `mono` drops
 * it so those can still sit inside a coloured button or a hover state.
 */
export const GameIcon = memo(function GameIcon({
  icon,
  size,
  className = '',
  style,
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

  const box = size ?? '1.15em';

  return (
    <svg
      viewBox="0 0 24 24"
      x={x}
      y={y}
      width={box}
      height={box}
      className={`game-icon ${className}`}
      style={mono || !resolved.color ? style : { color: resolved.color, ...style }}
      fill="currentColor"
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      <path d={resolved.d} />
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
