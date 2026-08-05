import * as PIXI from 'pixi.js';
import { isValidElement, type ReactNode } from 'react';
import { resolveGlyph } from './GameIcon';

/* ==========================================================================
   The factory grid draws on a PixiJS canvas, so it cannot mount <GameIcon>.
   Rather than keep a second copy of the artwork, the glyphs (plain React
   elements over intrinsic SVG tags) are serialised back to SVG markup and
   rasterised once into a texture cache.
   ========================================================================== */

/** Rasterisation size. Tiles draw at ~24-32px, so 96 stays crisp when zoomed. */
const RASTER = 96;

const camelToKebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

const escapeAttr = (v: string) => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

/** Serialises a glyph's React element tree into SVG markup. */
function serialize(node: ReactNode, a: string, b: string): string {
  if (node == null || node === false || node === true) return '';
  if (Array.isArray(node)) return node.map((n) => serialize(n, a, b)).join('');
  if (!isValidElement(node)) return '';

  const props = node.props as Record<string, unknown>;
  const children = serialize(props.children as ReactNode, a, b);

  // Fragments and anything non-intrinsic contribute only their children.
  if (typeof node.type !== 'string') return children;

  const attrs: string[] = [];
  for (const [key, raw] of Object.entries(props)) {
    if (key === 'children' || raw == null) continue;
    let value = String(raw);
    // Data-URI SVG has no CSS cascade, so the duotone slots are baked in.
    value = value.replace(/currentColor/g, a).replace(/var\(--gi-2\)/g, b);
    attrs.push(`${camelToKebab(key)}="${escapeAttr(value)}"`);
  }

  const open = `<${node.type}${attrs.length ? ' ' + attrs.join(' ') : ''}`;
  return children ? `${open}>${children}</${node.type}>` : `${open}/>`;
}

/** Full standalone SVG document for one icon. */
export function glyphToSvg(icon: string): string | null {
  const resolved = resolveGlyph(icon);
  if (!resolved) return null;
  const { def, a, b } = resolved;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${RASTER}" height="${RASTER}" ` +
    `fill="none" stroke="${a}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">` +
    serialize(def.d, a, b) +
    '</svg>'
  );
}

const textures = new Map<string, PIXI.Texture>();
const inFlight = new Map<string, Promise<PIXI.Texture | null>>();

async function rasterize(icon: string): Promise<PIXI.Texture | null> {
  const svg = glyphToSvg(icon);
  if (!svg) return null;
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  try {
    await img.decode();
  } catch {
    // Safari occasionally rejects decode() for SVG; fall back to onload.
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error('icon raster failed'));
    }).catch(() => undefined);
    if (!img.complete) return null;
  }
  const texture = PIXI.Texture.from(img);
  textures.set(icon, texture);
  return texture;
}

/**
 * Returns the texture for an icon, or `undefined` on the first call while the
 * raster is still decoding. Callers simply skip drawing for that frame; the
 * grid redraws continuously, so the icon appears a frame or two later.
 */
export function getIconTexture(icon: string | undefined | null): PIXI.Texture | undefined {
  if (!icon) return undefined;
  const hit = textures.get(icon);
  if (hit) return hit;
  if (!inFlight.has(icon)) {
    inFlight.set(
      icon,
      rasterize(icon).catch(() => null),
    );
  }
  return undefined;
}

/** Warms the cache so icons never pop in mid-scroll. */
export function preloadIconTextures(icons: readonly string[]): Promise<void> {
  const unique = [...new Set(icons.filter(Boolean))];
  return Promise.all(
    unique.map((icon) => {
      if (textures.has(icon)) return null;
      const existing = inFlight.get(icon);
      if (existing) return existing;
      const p = rasterize(icon).catch(() => null);
      inFlight.set(icon, p);
      return p;
    }),
  ).then(() => undefined);
}
