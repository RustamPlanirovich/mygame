import * as PIXI from 'pixi.js';
import { resolveGlyph } from './GameIcon';

/* ==========================================================================
   The factory grid draws on a PixiJS canvas, so it cannot mount <GameIcon>.
   Rather than keep a second copy of the artwork, the glyph path is wrapped in
   a standalone SVG document and rasterised once into a texture cache.

   Textures are rasterised WHITE so callers can recolour them with `sprite.tint`
   (a tint multiplies, so any baked-in colour would fight it).
   ========================================================================== */

/** Rasterisation size. Tiles draw at ~24-32px, so 96 stays crisp when zoomed. */
const RASTER = 96;

/** Full standalone SVG document for one icon, painted white. */
export function glyphToSvg(icon: string): string | null {
  const resolved = resolveGlyph(icon);
  if (!resolved) return null;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${RASTER}" height="${RASTER}" ` +
    `fill="#ffffff"><path d="${resolved.d}"/></svg>`
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
