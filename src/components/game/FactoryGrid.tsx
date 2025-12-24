import { useEffect, useMemo, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import { THEME_COLORS } from '../../core/constants/themeColors';
import { useGameStore } from '../../features/gameStore';
import { getBuildingBadge } from '../../core/constants/buildingBadges';
import type { Building, DepositType, ResourceType } from '../../core/gameTypes';

const CELL = 40;
const GAP = 2;

const ZOOM_MIN = 1.0;
const ZOOM_MAX = 3.0;

const DRAG_THRESHOLD_PX = 4;

const DEPOSIT_LABEL: Record<DepositType, string> = {
  ore: 'Fe',
  ice: 'Ice',
  carbon: 'C',
};

const RESOURCE_SHORT: Partial<Record<ResourceType, string>> = {
  ore: 'РУД',
  ice: 'ЛЁД',
  carbon: 'УГЛ',
  energy: 'ЭН',
};

function distPointToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const abLen2 = abx * abx + aby * aby;
  if (abLen2 <= 0.000001) return Math.hypot(px - ax, py - ay);
  let t = (apx * abx + apy * aby) / abLen2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + abx * t;
  const cy = ay + aby * t;
  return Math.hypot(px - cx, py - cy);
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function FactoryGrid() {
  const grid = useGameStore((s) => s.grid);
  const combat = useGameStore((s) => s.combat);
  const buildings = useGameStore((s) => s.buildings);
  const selectTile = useGameStore((s) => s.selectTile);
  const placeSelectedBuildAt = useGameStore((s) => s.placeSelectedBuildAt);
  const focusLink = useGameStore((s) => s.focusLink);

  const [hoveredLinkKey, setHoveredLinkKey] = useState<string | null>(null);
  const hoveredLinkKeyRef = useRef<string | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const worldRef = useRef<PIXI.Container | null>(null);
  const graphicsRef = useRef<PIXI.Graphics | null>(null);
  const textLayerRef = useRef<PIXI.Container | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const initializedRef = useRef(false);

  const camRef = useRef({
    zoom: 1,
    x: 0,
    y: 0,
    interacted: false,
  });
  const worldSizeRef = useRef({ w: 0, h: 0 });
  const updateCameraClampRef = useRef<(() => void) | null>(null);
  const fitCameraRef = useRef<(() => void) | null>(null);
  const spaceRef = useRef(false);
  const panRef = useRef({
    active: false,
    candidate: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
  });

  const worldSize = useMemo(() => {
    const w = grid.width * (CELL + GAP) + GAP;
    const h = grid.height * (CELL + GAP) + GAP;
    return { w, h };
  }, [grid.width, grid.height]);

  useEffect(() => {
    worldSizeRef.current = worldSize;
    // If the grid size changes (e.g. expansion), refit only if the user hasn't interacted.
    if (!camRef.current.interacted) {
      fitCameraRef.current?.();
    } else {
      updateCameraClampRef.current?.();
    }
  }, [worldSize]);

  const buildingsById = useMemo(() => {
    const map: Record<string, Building> = {};
    for (const b of buildings) map[b.id] = b;
    return map;
  }, [buildings]);

  const linkKeyOf = (link: { from: { x: number; y: number }; to: { x: number; y: number }; resource: ResourceType }) => {
    return `${link.from.x},${link.from.y}->${link.to.x},${link.to.y}:${link.resource}`;
  };

  useEffect(() => {
    if (!containerRef.current) return;

    const app = new PIXI.Application();
    appRef.current = app;

    let destroyed = false;

    void (async () => {
      const rect = containerRef.current!.getBoundingClientRect();
      await app.init({
        width: Math.max(1, Math.floor(rect.width)),
        height: Math.max(1, Math.floor(rect.height)),
        backgroundColor: THEME_COLORS.cyberBlack,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });

      initializedRef.current = true;

      if (destroyed) {
        // React StrictMode can unmount before init completes.
        // Only destroy AFTER init, otherwise Pixi internals may be undefined and crash.
        app.destroy(
          { removeView: true },
          {
            children: true,
            texture: true,
            textureSource: true,
          },
        );
        return;
      }

      const containerEl = containerRef.current;
      if (!containerEl) {
        app.destroy(
          { removeView: true },
          {
            children: true,
            texture: true,
            textureSource: true,
          },
        );
        return;
      }

      containerEl.appendChild(app.canvas);

      const world = new PIXI.Container();
      worldRef.current = world;
      app.stage.addChild(world);

      const g = new PIXI.Graphics();
      graphicsRef.current = g;
      world.addChild(g);

      const textLayer = new PIXI.Container();
      textLayerRef.current = textLayer;
      world.addChild(textLayer);

      app.canvas.style.display = 'block';
      app.canvas.style.width = '100%';
      app.canvas.style.height = '100%';

      const screenToWorld = (sx: number, sy: number) => {
        const cam = camRef.current;
        return {
          x: (sx - cam.x) / cam.zoom,
          y: (sy - cam.y) / cam.zoom,
        };
      };

      const handlePrimaryClick = (sx: number, sy: number, shiftKey: boolean) => {
        const wp = screenToWorld(sx, sy);

        const s = useGameStore.getState();

        // Select hovered line:
        // - normal click works only when not building
        // - Shift+Click works even in build mode
        // - disabled while linking (click is reserved for selecting the link target)
        if (!s.grid.linking && (shiftKey || !s.grid.selectedBuildId)) {
          const hoveredKey = hoveredLinkKeyRef.current;
          if (hoveredKey) {
            const link = s.grid.links.find((l) => linkKeyOf(l) === hoveredKey);
            if (link) {
              focusLink(link);
              selectTile({ x: link.to.x, y: link.to.y });
              return;
            }
          }
        }

        const x = clamp(Math.floor((wp.x - GAP) / (CELL + GAP)), 0, s.grid.width - 1);
        const y = clamp(Math.floor((wp.y - GAP) / (CELL + GAP)), 0, s.grid.height - 1);

        const pos = { x, y };
        selectTile(pos);

        // While linking, clicks are reserved for selecting the link target.
        if (s.grid.linking) return;

        if (s.grid.selectedBuildId) {
          placeSelectedBuildAt(pos);
        }
      };

      const updateCameraClamp = () => {
        const cam = camRef.current;
        const r = app.renderer;
        const vw = r.width;
        const vh = r.height;

        const ws = worldSizeRef.current;
        const scaledW = ws.w * cam.zoom;
        const scaledH = ws.h * cam.zoom;

        // Clamp when content is larger; center when content is smaller.
        if (scaledW <= vw) {
          cam.x = Math.floor((vw - scaledW) / 2);
        } else {
          const minX = vw - scaledW;
          const maxX = 0;
          cam.x = clamp(cam.x, minX, maxX);
        }

        if (scaledH <= vh) {
          cam.y = Math.floor((vh - scaledH) / 2);
        } else {
          const minY = vh - scaledH;
          const maxY = 0;
          cam.y = clamp(cam.y, minY, maxY);
        }

        const world = worldRef.current;
        if (world) {
          world.position.set(cam.x, cam.y);
          world.scale.set(cam.zoom);
        }
      };

      const fitCamera = () => {
        const cam = camRef.current;
        if (cam.interacted) return;
        const r = app.renderer;
        const vw = r.width;
        const vh = r.height;
        const ws = worldSizeRef.current;
        if (!(ws.w > 0 && ws.h > 0 && vw > 0 && vh > 0)) return;

        // Fit (contain) with a small padding so content doesn't touch the edges.
        const fit = Math.min(vw / ws.w, vh / ws.h) * 0.98;
        cam.zoom = clamp(fit, ZOOM_MIN, ZOOM_MAX);
        cam.x = Math.floor((vw - ws.w * cam.zoom) / 2);
        cam.y = Math.floor((vh - ws.h * cam.zoom) / 2);
        updateCameraClamp();
      };

      updateCameraClampRef.current = updateCameraClamp;
      fitCameraRef.current = fitCamera;

      fitCamera();

      const onPointerDown = (e: PointerEvent) => {
        const rect = app.canvas.getBoundingClientRect();
        const sx = (e.clientX - rect.left) * (app.canvas.width / rect.width);
        const sy = (e.clientY - rect.top) * (app.canvas.height / rect.height);

        // Pan: Space+drag or middle mouse.
        if (spaceRef.current || (e as any).button === 1) {
          camRef.current.interacted = true;
          panRef.current.active = true;
          panRef.current.candidate = false;
          panRef.current.lastX = sx;
          panRef.current.lastY = sy;
          (app.canvas as any).setPointerCapture?.(e.pointerId);
          return;
        }

        // Default behavior (viewport.md): left button starts a drag candidate.
        // If movement exceeds a threshold, we pan; otherwise we treat it as a click on pointerup.
        if ((e as any).button === 0) {
          panRef.current.candidate = true;
          panRef.current.active = false;
          panRef.current.startX = sx;
          panRef.current.startY = sy;
          panRef.current.lastX = sx;
          panRef.current.lastY = sy;
          (app.canvas as any).setPointerCapture?.(e.pointerId);
        }
      };

      const onPointerUp = (e: PointerEvent) => {
        const wasActive = panRef.current.active;
        const wasCandidate = panRef.current.candidate;

        if (wasActive || wasCandidate) {
          panRef.current.active = false;
          panRef.current.candidate = false;
          (app.canvas as any).releasePointerCapture?.(e.pointerId);
        }

        // If it was just a click (candidate but not active drag), execute click logic now.
        if (wasCandidate && !wasActive) {
          const rect = app.canvas.getBoundingClientRect();
          const sx = (e.clientX - rect.left) * (app.canvas.width / rect.width);
          const sy = (e.clientY - rect.top) * (app.canvas.height / rect.height);
          handlePrimaryClick(sx, sy, e.shiftKey);
        }
      };

      const onKeyDown = (e: KeyboardEvent) => {
        const active = document.activeElement as HTMLElement | null;
        if (active) {
          const tag = active.tagName?.toLowerCase();
          const isTypingTarget = tag === 'input' || tag === 'textarea' || (active as any).isContentEditable;
          if (isTypingTarget) return;
        }

        if (e.key !== 'Delete' && e.key !== 'Backspace') return;

        const s = useGameStore.getState();
        const link = s.grid.focusedLink;
        if (!link) return;

        e.preventDefault();
        s.removeLink(link.from, link.to, link.resource);
        s.focusLink(null);
      };

      const onContextMenu = (e: MouseEvent) => {
        e.preventDefault();
        const rect = app.canvas.getBoundingClientRect();
        const sx = (e.clientX - rect.left) * (app.canvas.width / rect.width);
        const sy = (e.clientY - rect.top) * (app.canvas.height / rect.height);
        const wp = screenToWorld(sx, sy);

        const s = useGameStore.getState();
        const links = s.grid.links;
        if (links.length === 0) return;

        const hoveredKey = hoveredLinkKeyRef.current;
        if (hoveredKey) {
          const link = links.find((l) => linkKeyOf(l) === hoveredKey);
          if (link) {
            s.removeLink(link.from, link.to, link.resource);
            return;
          }
        }

        let bestIdx = -1;
        let bestDist = Infinity;
        for (let i = 0; i < links.length; i++) {
          const link = links[i];
          const ax = GAP + link.from.x * (CELL + GAP) + CELL / 2;
          const ay = GAP + link.from.y * (CELL + GAP) + CELL / 2;
          const bx = GAP + link.to.x * (CELL + GAP) + CELL / 2;
          const by = GAP + link.to.y * (CELL + GAP) + CELL / 2;
          const d = distPointToSegment(wp.x, wp.y, ax, ay, bx, by);
          if (d < bestDist) {
            bestDist = d;
            bestIdx = i;
          }
        }

        // threshold in screen pixels → convert to world units
        const threshold = 7 / camRef.current.zoom;
        if (bestIdx >= 0 && bestDist <= threshold) {
          const link = links[bestIdx];
          s.removeLink(link.from, link.to, link.resource);
        }
      };

      const onPointerMove = (e: PointerEvent) => {
        const s = useGameStore.getState();
        const links = s.grid.links;

        const rect = app.canvas.getBoundingClientRect();
        const sx = (e.clientX - rect.left) * (app.canvas.width / rect.width);
        const sy = (e.clientY - rect.top) * (app.canvas.height / rect.height);

        if (panRef.current.active) {
          const dx = sx - panRef.current.lastX;
          const dy = sy - panRef.current.lastY;
          camRef.current.x += dx;
          camRef.current.y += dy;
          panRef.current.lastX = sx;
          panRef.current.lastY = sy;
          updateCameraClamp();
          return;
        }

        if (panRef.current.candidate) {
          const dx = sx - panRef.current.startX;
          const dy = sy - panRef.current.startY;
          if (Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX) {
            camRef.current.interacted = true;
            panRef.current.active = true;
            panRef.current.lastX = sx;
            panRef.current.lastY = sy;
          }
          return;
        }

        if (links.length === 0) {
          if (hoveredLinkKeyRef.current !== null) {
            hoveredLinkKeyRef.current = null;
            setHoveredLinkKey(null);
          }
          return;
        }

        const wp = screenToWorld(sx, sy);

        let bestKey: string | null = null;
        let bestDist = Infinity;
        for (const link of links) {
          const ax = GAP + link.from.x * (CELL + GAP) + CELL / 2;
          const ay = GAP + link.from.y * (CELL + GAP) + CELL / 2;
          const bx = GAP + link.to.x * (CELL + GAP) + CELL / 2;
          const by = GAP + link.to.y * (CELL + GAP) + CELL / 2;
          const d = distPointToSegment(wp.x, wp.y, ax, ay, bx, by);
          if (d < bestDist) {
            bestDist = d;
            bestKey = linkKeyOf(link);
          }
        }

        const threshold = 8 / camRef.current.zoom;
        if (bestKey && bestDist <= threshold) {
          if (hoveredLinkKeyRef.current !== bestKey) {
            hoveredLinkKeyRef.current = bestKey;
            setHoveredLinkKey(bestKey);
          }
        } else {
          if (hoveredLinkKeyRef.current !== null) {
            hoveredLinkKeyRef.current = null;
            setHoveredLinkKey(null);
          }
        }
      };

      const onWheel = (e: WheelEvent) => {
        e.preventDefault();

        camRef.current.interacted = true;

        const rect = app.canvas.getBoundingClientRect();
        const sx = (e.clientX - rect.left) * (app.canvas.width / rect.width);
        const sy = (e.clientY - rect.top) * (app.canvas.height / rect.height);

        const cam = camRef.current;
        const before = screenToWorld(sx, sy);

        const dir = e.deltaY > 0 ? 1 : -1;
        const factor = dir > 0 ? 0.92 : 1.08;
        const nextZoom = clamp(cam.zoom * factor, ZOOM_MIN, ZOOM_MAX);
        if (Math.abs(nextZoom - cam.zoom) < 0.0001) return;

        cam.zoom = nextZoom;
        // Keep world point under cursor stable
        cam.x = sx - before.x * cam.zoom;
        cam.y = sy - before.y * cam.zoom;
        updateCameraClamp();
      };

      const onKeyDownLocal = (e: KeyboardEvent) => {
        if (e.key === ' ') spaceRef.current = true;
      };
      const onKeyUpLocal = (e: KeyboardEvent) => {
        if (e.key === ' ') spaceRef.current = false;
      };

      const ro = new ResizeObserver(() => {
        if (!containerRef.current) return;
        const r = containerRef.current.getBoundingClientRect();
        app.renderer.resize(Math.max(1, Math.floor(r.width)), Math.max(1, Math.floor(r.height)));
        if (!camRef.current.interacted) fitCamera();
        else updateCameraClamp();
      });
      ro.observe(containerEl);

      const onPointerLeave = () => {
        if (hoveredLinkKeyRef.current !== null) {
          hoveredLinkKeyRef.current = null;
          setHoveredLinkKey(null);
        }
      };

      app.canvas.addEventListener('pointerdown', onPointerDown);
      app.canvas.addEventListener('pointermove', onPointerMove);
      app.canvas.addEventListener('pointerup', onPointerUp);
      app.canvas.addEventListener('pointercancel', onPointerUp);
      app.canvas.addEventListener('pointerleave', onPointerLeave);
      app.canvas.addEventListener('contextmenu', onContextMenu);
      app.canvas.addEventListener('wheel', onWheel, { passive: false });
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keydown', onKeyDownLocal);
      window.addEventListener('keyup', onKeyUpLocal);

      cleanupRef.current = () => {
        app.canvas.removeEventListener('pointerdown', onPointerDown);
        app.canvas.removeEventListener('pointermove', onPointerMove);
        app.canvas.removeEventListener('pointerup', onPointerUp);
        app.canvas.removeEventListener('pointercancel', onPointerUp);
        app.canvas.removeEventListener('pointerleave', onPointerLeave);
        app.canvas.removeEventListener('contextmenu', onContextMenu);
        app.canvas.removeEventListener('wheel', onWheel as any);
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keydown', onKeyDownLocal);
        window.removeEventListener('keyup', onKeyUpLocal);
        ro.disconnect();
      };
    })();

    return () => {
      destroyed = true;
      const app = appRef.current;
      if (app) {
        cleanupRef.current?.();
        cleanupRef.current = null;

        // If init hasn't finished yet, it will self-destroy in the async init block.
        if (initializedRef.current) {
          app.destroy(
            { removeView: true },
            {
              children: true,
              texture: true,
              textureSource: true,
            },
          );
        }
      }
      appRef.current = null;
      graphicsRef.current = null;
      textLayerRef.current = null;
      worldRef.current = null;
      initializedRef.current = false;
      updateCameraClampRef.current = null;
      fitCameraRef.current = null;

      if (containerRef.current) {
        // In case canvas wasn't removed for any reason
        containerRef.current.innerHTML = '';
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const app = appRef.current;
    const g = graphicsRef.current;
    const textLayer = textLayerRef.current;
    if (!app || !g) return;

    // Apply camera transform
    const world = worldRef.current;
    if (world) {
      world.position.set(camRef.current.x, camRef.current.y);
      world.scale.set(camRef.current.zoom);
    }

    g.clear();

    if (textLayer) {
      const children = textLayer.removeChildren();
      for (const c of children) {
        c.destroy();
      }
    }

    // Grid background
    g.rect(0, 0, worldSize.w, worldSize.h).fill({ color: THEME_COLORS.cyberDark, alpha: 0.25 });

    // Cells
    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        const k = `${x},${y}`;
        const hasBuilding = Boolean(grid.tiles[k]);

        const px = GAP + x * (CELL + GAP);
        const py = GAP + y * (CELL + GAP);

        const isBase = x === grid.width - 1 && y === grid.height - 1;
        const fill = isBase
          ? THEME_COLORS.cyberGreen
          : hasBuilding
            ? THEME_COLORS.cyberBlue
            : THEME_COLORS.cyberGray;
        const alpha = isBase ? 0.22 : hasBuilding ? 0.25 : 0.12;

        g.roundRect(px, py, CELL, CELL, 4).fill({ color: fill, alpha });

        // Highlight: if this building needs inputs but local buffer is empty for any required resource.
        let strokeColor: number = THEME_COLORS.cyberGray;
        let strokeAlpha: number = 0.6;
        const missingResources: ResourceType[] = [];
        if (!isBase && hasBuilding) {
          const b = buildingsById[grid.tiles[k]];
          if (b?.consumption) {
            let missing = false;
            for (const [res, perSecond] of Object.entries(b.consumption)) {
              const r = res as ResourceType;
              if (r === 'energy') continue;
              if (!perSecond) continue;
              const raw = grid.buffers[k]?.[r];
              const have = raw ? Number(raw) : 0;
              if (!(have > 0)) {
                missing = true;
                if (!missingResources.includes(r)) missingResources.push(r);
              }
            }
            if (missing) {
              strokeColor = THEME_COLORS.cyberRed;
              strokeAlpha = 0.8;
            }
          }
        }

        g.roundRect(px, py, CELL, CELL, 4).stroke({ color: strokeColor, width: 1, alpha: strokeAlpha });

        if (textLayer) {
          if (isBase) {
            const t = new PIXI.Text({
              text: 'БАЗА',
              style: {
                fill: THEME_COLORS.cyberGreen,
                fontSize: 9,
                fontWeight: '700',
              },
            });
            t.anchor.set(0.5, 0.5);
            t.x = px + CELL / 2;
            t.y = py + CELL / 2;
            textLayer.addChild(t);
          } else if (hasBuilding) {
            const badge = getBuildingBadge(grid.tiles[k]);
            const t = new PIXI.Text({
              text: badge,
              style: {
                fill: THEME_COLORS.cyberText,
                fontSize: 10,
                fontWeight: '700',
              },
            });
            t.anchor.set(0.5, 0.5);
            t.x = px + CELL / 2;
            t.y = py + CELL / 2 - (missingResources.length > 0 ? 4 : 0);
            textLayer.addChild(t);

            if (missingResources.length > 0) {
              const label = missingResources
                .slice(0, 3)
                .map((r) => RESOURCE_SHORT[r] ?? r.toUpperCase())
                .join(',');
              const miss = new PIXI.Text({
                text: `НЕТ: ${label}`,
                style: {
                  fill: THEME_COLORS.cyberRed,
                  fontSize: 8,
                  fontWeight: '700',
                },
              });
              miss.anchor.set(0.5, 0.5);
              miss.x = px + CELL / 2;
              miss.y = py + CELL / 2 + 8;
              textLayer.addChild(miss);
            }
          } else {
            const dep = grid.deposits?.[k];
            if (dep) {
              const t = new PIXI.Text({
                text: DEPOSIT_LABEL[dep],
                style: {
                  fill: THEME_COLORS.cyberGray,
                  fontSize: 9,
                  fontWeight: '700',
                },
              });
              t.anchor.set(0.5, 0.5);
              t.x = px + CELL / 2;
              t.y = py + CELL / 2;
              textLayer.addChild(t);
            }
          }
        }
      }
    }

    // Links
    if (grid.links.length > 0) {
      for (const link of grid.links) {
        const fromX = GAP + link.from.x * (CELL + GAP) + CELL / 2;
        const fromY = GAP + link.from.y * (CELL + GAP) + CELL / 2;
        const toX = GAP + link.to.x * (CELL + GAP) + CELL / 2;
        const toY = GAP + link.to.y * (CELL + GAP) + CELL / 2;

        const color = link.resource === 'energy'
          ? THEME_COLORS.cyberText
          : link.resource === 'ore'
            ? THEME_COLORS.cyberGray
            : link.resource === 'ice'
              ? THEME_COLORS.cyberBlue
              : link.resource === 'carbon'
                ? THEME_COLORS.cyberRed
                : THEME_COLORS.cyberGreen;

        const key = linkKeyOf(link);
        const isHovered = hoveredLinkKey && key === hoveredLinkKey;
        const isFocused = Boolean(
          grid.focusedLink
          && grid.focusedLink.from.x === link.from.x
          && grid.focusedLink.from.y === link.from.y
          && grid.focusedLink.to.x === link.to.x
          && grid.focusedLink.to.y === link.to.y
          && grid.focusedLink.resource === link.resource
        );
        const disabled = link.enabled === false;
        const disabledMult = disabled ? 0.25 : 1;
        const lineAlpha = (isFocused ? 0.95 : isHovered ? 0.8 : 0.35) * disabledMult;
        const lineWidth = isFocused ? 4.5 : isHovered ? 3.5 : 2;
        const arrowAlpha = (isFocused ? 1.0 : isHovered ? 0.95 : 0.45) * disabledMult;

        g.moveTo(fromX, fromY)
          .lineTo(toX, toY)
          .stroke({ color, width: lineWidth, alpha: lineAlpha });

        // Arrow head (direction)
        const dx = toX - fromX;
        const dy = toY - fromY;
        const len = Math.hypot(dx, dy);
        if (len > 1) {
          const ux = dx / len;
          const uy = dy / len;
          const arrowSize = 7;
          const backX = toX - ux * arrowSize;
          const backY = toY - uy * arrowSize;
          const perpX = -uy;
          const perpY = ux;

          const leftX = backX + perpX * (arrowSize * 0.55);
          const leftY = backY + perpY * (arrowSize * 0.55);
          const rightX = backX - perpX * (arrowSize * 0.55);
          const rightY = backY - perpY * (arrowSize * 0.55);

          g.moveTo(leftX, leftY)
            .lineTo(toX, toY)
            .lineTo(rightX, rightY)
            .stroke({ color, width: lineWidth, alpha: arrowAlpha });
        }
      }
    }

    // Base marker (target)
    const baseX = GAP + (grid.width - 1) * (CELL + GAP) + CELL / 2;
    const baseY = GAP + (grid.height - 1) * (CELL + GAP) + CELL / 2;
    g.circle(baseX, baseY, 6).fill({ color: THEME_COLORS.cyberGreen, alpha: 0.7 });

    // Linking highlight
    if (grid.linking) {
      const px = GAP + grid.linking.anchor.x * (CELL + GAP);
      const py = GAP + grid.linking.anchor.y * (CELL + GAP);
      g.roundRect(px - 1, py - 1, CELL + 2, CELL + 2, 6).stroke({ color: THEME_COLORS.cyberBlue, width: 2, alpha: 0.9 });
    }

    // Enemies (visual only)
    if (combat.enemies.length > 0) {
      const laneCount = Math.min(8, combat.enemies.length);
      for (let i = 0; i < Math.min(combat.enemies.length, 16); i++) {
        const e = combat.enemies[i];
        const lane = i % laneCount;
        const t = Math.max(0, Math.min(1, e.distance));

        // distance: 1 -> far (left/top), 0 -> base
        const x = GAP + (1 - t) * (worldSize.w - 2 * GAP);
        const y = GAP + (lane + 0.5) * ((worldSize.h - 2 * GAP) / laneCount);

        const color = e.type === 'brute'
          ? THEME_COLORS.cyberRed
          : e.type === 'swarmer'
            ? THEME_COLORS.cyberBlue
            : THEME_COLORS.cyberText;

        const r = e.type === 'brute' ? 4.5 : e.type === 'swarmer' ? 3.5 : 3.0;
        g.circle(x, y, r).fill({ color, alpha: 0.85 });
      }

      // faint line to base
      g.moveTo(GAP, baseY).lineTo(worldSize.w - GAP, baseY).stroke({ color: THEME_COLORS.cyberGray, width: 1, alpha: 0.25 });
    }

    if (grid.selected) {
      const px = GAP + grid.selected.x * (CELL + GAP);
      const py = GAP + grid.selected.y * (CELL + GAP);
      g.roundRect(px - 1, py - 1, CELL + 2, CELL + 2, 6).stroke({ color: THEME_COLORS.cyberGreen, width: 2, alpha: 0.9 });
    }
  }, [buildingsById, combat.enemies, grid.buffers, grid.focusedLink, grid.height, grid.linking, grid.links, grid.selected, grid.tiles, grid.width, hoveredLinkKey, worldSize.h, worldSize.w]);

  return (
    <div className="h-full w-full p-4 md:border-r border-b md:border-b-0 border-cyber-gray bg-cyber-dark/50">
      <div className="cyber-panel h-full overflow-hidden flex flex-col">
        <div className="text-xs text-gray-500 mb-2 flex items-center justify-between shrink-0">
          <div>Сетка фабрики</div>
          <div>{grid.selectedBuildId ? 'Режим строительства: ВКЛ' : 'Режим строительства: ВЫКЛ'}</div>
        </div>
        <div className="text-[11px] text-gray-600 mb-2 shrink-0">
          Линии: наведи — подсветка · ПКМ — удалить · Shift+ЛКМ — выбрать · Delete — удалить выбранную
        </div>
        <div ref={containerRef} className="w-full flex-1 min-h-0" />
      </div>
    </div>
  );
}
