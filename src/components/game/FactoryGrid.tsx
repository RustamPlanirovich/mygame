import { useEffect, useMemo, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import { THEME_COLORS } from '../../core/constants/themeColors';
import { useGameStore } from '../../features/gameStore';
import { getBuildingEmoji, getDepositEmoji } from '../../core/constants/buildingEmoji';
import { formatNumber, D } from '../../core/math/format';
import type { Building, ResourceType } from '../../core/gameTypes';

// Hexagonal grid constants (flat-top hexagons)
const HEX_SIZE = 28; // Radius of hexagon
const HEX_WIDTH = Math.sqrt(3) * HEX_SIZE; // Width between parallel sides
const HEX_HEIGHT = 2 * HEX_SIZE; // Height from top to bottom
const HEX_HORIZ = HEX_WIDTH; // Horizontal spacing between column centers
const HEX_VERT = HEX_SIZE * 1.5; // Vertical spacing between row centers

// Isometric projection constants
const ISO_TILE_WIDTH = 64;
const ISO_TILE_HEIGHT = 32;

// Grid display mode
type GridMode = 'square' | 'hex' | 'isometric';
const GRID_MODE: GridMode = 'square'; // Квадратная сетка

// Legacy constants for square mode compatibility
const CELL = 48; // Увеличен для лучшей видимости, как в Industry Idle
const GAP = 1;   // Уменьшен зазор для более плотной сетки

const ZOOM_MIN = 0.3;
const ZOOM_MAX = 4.0;

const DRAG_THRESHOLD_PX = 4;

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
  const setCameraPosition = useGameStore((s) => s.setCameraPosition);

  const [hoveredLinkKey, setHoveredLinkKey] = useState<string | null>(null);
  const hoveredLinkKeyRef = useRef<string | null>(null);
  
  // Для оптимизации рендеринга
  const [renderTrigger, setRenderTrigger] = useState(0);
  const renderTimeoutRef = useRef<number | null>(null);
  const forceRender = useRef(() => {
    if (renderTimeoutRef.current) {
      clearTimeout(renderTimeoutRef.current);
    }
    renderTimeoutRef.current = window.setTimeout(() => {
      setRenderTrigger(prev => prev + 1);
    }, 16); // Примерно 60 FPS
  });

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

  // Convert grid coordinates to pixel coordinates based on mode
  const gridToPixel = (x: number, y: number): { px: number; py: number } => {
    if (GRID_MODE === 'square') {
      return {
        px: GAP + x * (CELL + GAP),
        py: GAP + y * (CELL + GAP),
      };
    } else if (GRID_MODE === 'hex') {
      // Hexagonal grid (flat-top hexagons)
      // Odd columns are shifted down by HEX_VERT
      const offsetY = (x % 2 === 1) ? HEX_VERT : 0;
      return {
        px: x * HEX_HORIZ,
        py: y * HEX_VERT * 2 + offsetY,
      };
    } else {
      // Isometric projection
      return {
        px: (x - y) * (ISO_TILE_WIDTH / 2),
        py: (x + y) * (ISO_TILE_HEIGHT / 2),
      };
    }
  };

  // Convert pixel coordinates to grid coordinates
  const pixelToGrid = (px: number, py: number): { x: number; y: number } => {
    if (GRID_MODE === 'square') {
      return {
        x: Math.floor((px - GAP) / (CELL + GAP)),
        y: Math.floor((py - GAP) / (CELL + GAP)),
      };
    } else if (GRID_MODE === 'hex') {
      // Approximate hexagonal conversion
      const col = Math.round(px / HEX_HORIZ);
      const offsetY = (col % 2 === 1) ? HEX_VERT : 0;
      const row = Math.round((py - offsetY) / (HEX_VERT * 2));
      return { x: col, y: row };
    } else {
      // Isometric to grid
      const isoX = px / (ISO_TILE_WIDTH / 2);
      const isoY = py / (ISO_TILE_HEIGHT / 2);
      const x = Math.round((isoX + isoY) / 2);
      const y = Math.round((isoY - isoX) / 2);
      return { x, y };
    }
  };

  const worldSize = useMemo(() => {
    if (GRID_MODE === 'square') {
      const w = grid.width * (CELL + GAP) + GAP;
      const h = grid.height * (CELL + GAP) + GAP;
      return { w, h };
    } else if (GRID_MODE === 'hex') {
      const w = (grid.width + 1) * HEX_HORIZ + HEX_WIDTH;
      const h = (grid.height + 1) * HEX_VERT * 2 + HEX_HEIGHT;
      return { w, h };
    } else {
      // Isometric
      const w = (grid.width + grid.height) * (ISO_TILE_WIDTH / 2) + ISO_TILE_WIDTH;
      const h = (grid.width + grid.height) * (ISO_TILE_HEIGHT / 2) + ISO_TILE_HEIGHT * 2;
      return { w, h };
    }
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
        backgroundColor: 0x000510,
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

      // Космический фон со звездами
      const stars = new PIXI.Graphics();
      for (let i = 0; i < 200; i++) {
        const x = Math.random() * (worldSize.w * 2);
        const y = Math.random() * (worldSize.h * 2);
        const size = Math.random() * 1.5 + 0.5;
        const brightness = Math.random() * 0.6 + 0.4;
        const color = Math.random() > 0.8 ? 0x6ba3ff : 0xffffff;
        stars.circle(x, y, size).fill({ color, alpha: brightness });
      }
      world.addChild(stars);

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

        const gridPos = pixelToGrid(wp.x, wp.y);
        const x = clamp(gridPos.x, 0, s.grid.width - 1);
        const y = clamp(gridPos.y, 0, s.grid.height - 1);

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

        // Используем cover вместо contain - заполняем все пространство
        const fit = Math.max(vw / ws.w, vh / ws.h) * 0.98;
        cam.zoom = clamp(fit, ZOOM_MIN, ZOOM_MAX);
        cam.x = Math.floor((vw - ws.w * cam.zoom) / 2);
        cam.y = Math.floor((vh - ws.h * cam.zoom) / 2);
        updateCameraClamp();
      };

      updateCameraClampRef.current = updateCameraClamp;
      fitCameraRef.current = fitCamera;

      // Загружаем сохраненную позицию камеры из БД
      const savedCam = useGameStore.getState().grid;
      if (typeof savedCam.cameraX === 'number' && typeof savedCam.cameraY === 'number' && typeof savedCam.cameraZoom === 'number') {
        camRef.current.zoom = clamp(savedCam.cameraZoom, ZOOM_MIN, ZOOM_MAX);
        camRef.current.x = savedCam.cameraX;
        camRef.current.y = savedCam.cameraY;
        camRef.current.interacted = true;
        updateCameraClamp();
      } else {
        fitCamera();
      }

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
          const fromPos = gridToPixel(link.from.x, link.from.y);
          const toPos = gridToPixel(link.to.x, link.to.y);
          const ax = fromPos.px;
          const ay = fromPos.py;
          const bx = toPos.px;
          const by = toPos.py;
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
          // Сохраняем позицию камеры в БД
          setCameraPosition(camRef.current.x, camRef.current.y, camRef.current.zoom);
          forceRender.current();
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
        
        // Оптимизация: не проверяем hover при панорамировании или если линков слишком много
        if (panRef.current.candidate || links.length > 200) {
          return;
        }

        const wp = screenToWorld(sx, sy);

        let bestKey: string | null = null;
        let bestDist = Infinity;
        for (const link of links) {
          const fromPos = gridToPixel(link.from.x, link.from.y);
          const toPos = gridToPixel(link.to.x, link.to.y);
          const ax = fromPos.px;
          const ay = fromPos.py;
          const bx = toPos.px;
          const by = toPos.py;
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
        // Сохраняем позицию камеры в БД
        setCameraPosition(cam.x, cam.y, cam.zoom);
        forceRender.current();
        
        // Автоматически расширяем сетку при отдалении
        const s = useGameStore.getState();
        const r = app.renderer;
        const vw = r.width;
        const vh = r.height;
        
        // Вычисляем сколько клеток видно в viewport при текущем зуме с запасом
        const visibleCellsX = Math.ceil(vw / (cam.zoom * (CELL + GAP))) + 4;
        const visibleCellsY = Math.ceil(vh / (cam.zoom * (CELL + GAP))) + 4;
        
        // Расширяем сетку если нужно
        const minGridSize = Math.max(visibleCellsX, visibleCellsY);
        if (s.grid.width < minGridSize || s.grid.height < minGridSize) {
          s.expandGrid(minGridSize, minGridSize);
        }
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

    // Grid background - темнее, как в Industry Idle
    g.rect(0, 0, worldSize.w, worldSize.h).fill({ color: 0x0a0e1a, alpha: 1.0 });

    // Draw hexagon helper
    const drawHexagon = (g: PIXI.Graphics, cx: number, cy: number, radius: number) => {
      const points: number[] = [];
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 6; // Start from flat top
        points.push(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
      }
      g.poly(points);
    };

    // Draw isometric tile helper
    const drawIsoTile = (g: PIXI.Graphics, x: number, y: number, width: number, height: number) => {
      // Diamond shape for isometric tile
      g.poly([
        x, y - height / 2,           // top
        x + width / 2, y,            // right
        x, y + height / 2,           // bottom
        x - width / 2, y,            // left
      ]);
    };

    // Оптимизация: вычисляем видимую область (culling)
    const cam = camRef.current;
    const renderer = app.renderer;
    const viewportW = renderer.width;
    const viewportH = renderer.height;
    
    // Мировые координаты видимой области
    const worldLeft = -cam.x / cam.zoom;
    const worldTop = -cam.y / cam.zoom;
    const worldRight = worldLeft + viewportW / cam.zoom;
    const worldBottom = worldTop + viewportH / cam.zoom;
    
    // Диапазон видимых клеток с небольшим запасом
    const cellSize = CELL + GAP;
    const minX = Math.max(0, Math.floor((worldLeft - GAP) / cellSize) - 1);
    const maxX = Math.min(grid.width - 1, Math.ceil((worldRight - GAP) / cellSize) + 1);
    const minY = Math.max(0, Math.floor((worldTop - GAP) / cellSize) - 1);
    const maxY = Math.min(grid.height - 1, Math.ceil((worldBottom - GAP) / cellSize) + 1);
    
    // Показывать текст только при достаточном зуме, с гистерезисом для избежания мигания
    const showText = cam.zoom > 0.4;
    const showDetailedText = cam.zoom > 0.7;

    // Cells - рисуем только видимые
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const k = `${x},${y}`;
        const hasBuilding = Boolean(grid.tiles[k]);
        const { px, py } = gridToPixel(x, y);

        const isBase = x === grid.width - 1 && y === grid.height - 1;
        const fill = isBase
          ? THEME_COLORS.cyberGreen
          : hasBuilding
            ? THEME_COLORS.cyberBlue
            : THEME_COLORS.cyberDark;
        const alpha = isBase ? 0.3 : hasBuilding ? 0.35 : 0.4;

        // Draw tile based on mode
        if (GRID_MODE === 'square') {
          g.roundRect(px, py, CELL, CELL, 2).fill({ color: fill, alpha });
        } else if (GRID_MODE === 'hex') {
          drawHexagon(g, px, py, HEX_SIZE);
          g.fill({ color: fill, alpha });
        } else {
          // Isometric
          drawIsoTile(g, px, py, ISO_TILE_WIDTH, ISO_TILE_HEIGHT);
          g.fill({ color: fill, alpha });
        }

        // Highlight: if this building needs inputs but local buffer is empty for any required resource.
        let strokeColor: number = THEME_COLORS.cyberGray;
        let strokeAlpha: number = 0.6;
        const missingResources: ResourceType[] = [];
        
        // Оптимизация: пропускаем детальную проверку ресурсов при сильном отдалении
        if (!isBase && hasBuilding && showDetailedText) {
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

        // Draw stroke - при сильном отдалении упрощаем или пропускаем
        if (showText) {
          if (GRID_MODE === 'square') {
            g.roundRect(px, py, CELL, CELL, 2).stroke({ color: strokeColor, width: 1, alpha: strokeAlpha * 0.5 });
          } else if (GRID_MODE === 'hex') {
            drawHexagon(g, px, py, HEX_SIZE);
            g.stroke({ color: strokeColor, width: 1, alpha: strokeAlpha * 0.6 });
          } else {
            drawIsoTile(g, px, py, ISO_TILE_WIDTH, ISO_TILE_HEIGHT);
            g.stroke({ color: strokeColor, width: 1.5, alpha: strokeAlpha });
          }
        }

        if (textLayer && showText) {
          const textOffsetY = GRID_MODE === 'isometric' ? -8 : 0;
          
          if (isBase) {
            const t = new PIXI.Text({
              text: '🏠',
              style: {
                fill: THEME_COLORS.cyberGreen,
                fontSize: GRID_MODE === 'hex' ? 24 : 20,
                fontWeight: '700',
              },
            });
            t.anchor.set(0.5, 0.5);
            const centerX = GRID_MODE === 'hex' ? px : px + CELL / 2;
            const centerY = GRID_MODE === 'hex' ? py : py + CELL / 2;
            t.x = centerX;
            t.y = centerY + textOffsetY;
            textLayer.addChild(t);
          } else if (hasBuilding) {
            const emoji = getBuildingEmoji(grid.tiles[k]);
            const isBlocked = missingResources.length > 0;
            
            const t = new PIXI.Text({
              text: emoji,
              style: {
                fill: isBlocked ? THEME_COLORS.cyberRed : THEME_COLORS.cyberText,
                fontSize: GRID_MODE === 'hex' ? 18 : 24,
                fontWeight: '700',
              },
            });
            t.anchor.set(0.5, 0.5);
            const centerX = GRID_MODE === 'hex' ? px : px + CELL / 2;
            const centerY = GRID_MODE === 'hex' ? py : py + CELL / 2;
            t.x = centerX;
            t.y = centerY + textOffsetY - (isBlocked ? 6 : 0);
            textLayer.addChild(t);

            // Warning icon когда заблокировано
            if (isBlocked && showDetailedText) {
              const warning = new PIXI.Text({
                text: '⚠',
                style: {
                  fill: THEME_COLORS.cyberRed,
                  fontSize: GRID_MODE === 'hex' ? 9 : 12,
                  fontWeight: '700',
                },
              });
              warning.anchor.set(0.5, 0.5);
              const centerX = GRID_MODE === 'hex' ? px : px + CELL / 2;
              const centerY = GRID_MODE === 'hex' ? py : py + CELL / 2;
              warning.x = centerX - (GRID_MODE === 'hex' ? 10 : 15);
              warning.y = centerY + textOffsetY - 6;
              textLayer.addChild(warning);
            }

            if (missingResources.length > 0 && showDetailedText) {
              const label = missingResources
                .slice(0, 3)
                .map((r) => RESOURCE_SHORT[r] ?? r.toUpperCase())
                .join(',');
              const miss = new PIXI.Text({
                text: `НЕТ: ${label}`,
                style: {
                  fill: THEME_COLORS.cyberRed,
                  fontSize: GRID_MODE === 'hex' ? 7 : 9,
                  fontWeight: '700',
                },
              });
              miss.anchor.set(0.5, 0.5);
              const centerX = GRID_MODE === 'hex' ? px : px + CELL / 2;
              const centerY = GRID_MODE === 'hex' ? py : py + CELL / 2;
              miss.x = centerX;
              miss.y = centerY + textOffsetY + 10;
              textLayer.addChild(miss);
            }
          } else {
            // Показываем месторождения только при большом зуме и когда нет зданий
            const dep = grid.deposits?.[k];
            if (dep && showText) {
              const t = new PIXI.Text({
                text: getDepositEmoji(dep),
                style: {
                  fill: THEME_COLORS.cyberText,
                  fontSize: GRID_MODE === 'hex' ? 14 : 16,
                  fontWeight: '700',
                },
              });
              t.alpha = 0.4;
              t.anchor.set(0.5, 0.5);
              const centerX = GRID_MODE === 'hex' ? px : px + CELL / 2;
              const centerY = GRID_MODE === 'hex' ? py : py + CELL / 2;
              t.x = centerX;
              t.y = centerY + textOffsetY;
              textLayer.addChild(t);
            }
          }
        }
      }
    }

    // Links - рисуем только если хотя бы одна из клеток видна
    if (grid.links.length > 0) {
      for (const link of grid.links) {
        // Culling для линков - проверяем видимость
        const isFromVisible = link.from.x >= minX && link.from.x <= maxX && 
                              link.from.y >= minY && link.from.y <= maxY;
        const isToVisible = link.to.x >= minX && link.to.x <= maxX && 
                            link.to.y >= minY && link.to.y <= maxY;
        
        if (!isFromVisible && !isToVisible) continue;
        
        const fromPos = gridToPixel(link.from.x, link.from.y);
        const toPos = gridToPixel(link.to.x, link.to.y);
        const fromX = fromPos.px;
        const fromY = fromPos.py;
        const toX = toPos.px;
        const toY = toPos.py;

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
        const lineAlpha = (isFocused ? 1.0 : isHovered ? 0.9 : 0.6) * disabledMult;
        const lineWidth = isFocused ? 3.5 : isHovered ? 3 : 2;
        const arrowAlpha = (isFocused ? 1.0 : isHovered ? 0.95 : 0.7) * disabledMult;

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
          const arrowSize = 8;
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
          
          // Анимированная частица вдоль линка (только для активных линков)
          if (!disabled && showText && len > 20) {
            const moved = grid.linkMoved?.[key];
            const movedAmt = moved ? D(moved) : D(0);
            
            if (movedAmt.gt(0)) {
              // Позиция частицы - анимация циклическая
              const time = Date.now() / 1000;
              const speed = 0.5; // Скорость движения частицы
              const progress = (time * speed) % 1;
              
              const particleX = fromX + (toX - fromX) * progress;
              const particleY = fromY + (toY - fromY) * progress;
              
              // Рисуем частицу
              g.circle(particleX, particleY, 3).fill({ color, alpha: 0.9 });
              
              // Текст с количеством (только при детальном зуме)
              if (showDetailedText && textLayer) {
                const flowText = new PIXI.Text({
                  text: formatNumber(movedAmt),
                  style: {
                    fill: color,
                    fontSize: 8,
                    fontWeight: '600',
                  },
                });
                flowText.anchor.set(0.5, 0.5);
                flowText.x = particleX;
                flowText.y = particleY - 8;
                textLayer.addChild(flowText);
              }
            }
          }
        }
      }
    }

    // Base marker (target)
    const basePos = gridToPixel(grid.width - 1, grid.height - 1);
    g.circle(basePos.px + CELL / 2, basePos.py + CELL / 2, 8).fill({ color: THEME_COLORS.cyberGreen, alpha: 0.8 });

    // Linking highlight
    if (grid.linking) {
      const linkPos = gridToPixel(grid.linking.anchor.x, grid.linking.anchor.y);
      if (GRID_MODE === 'square') {
        g.roundRect(linkPos.px - 1, linkPos.py - 1, CELL + 2, CELL + 2, 6).stroke({ color: THEME_COLORS.cyberBlue, width: 2, alpha: 0.9 });
      } else if (GRID_MODE === 'hex') {
        drawHexagon(g, linkPos.px, linkPos.py, HEX_SIZE + 2);
        g.stroke({ color: THEME_COLORS.cyberBlue, width: 2.5, alpha: 0.9 });
      } else {
        drawIsoTile(g, linkPos.px, linkPos.py, ISO_TILE_WIDTH + 4, ISO_TILE_HEIGHT + 2);
        g.stroke({ color: THEME_COLORS.cyberBlue, width: 2, alpha: 0.9 });
      }
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
      const basePos = gridToPixel(grid.width - 1, grid.height - 1);
      g.moveTo(GAP, basePos.py).lineTo(worldSize.w - GAP, basePos.py).stroke({ color: THEME_COLORS.cyberGray, width: 1, alpha: 0.25 });
    }

    if (grid.selected) {
      const selPos = gridToPixel(grid.selected.x, grid.selected.y);
      if (GRID_MODE === 'square') {
        g.roundRect(selPos.px - 1, selPos.py - 1, CELL + 2, CELL + 2, 6).stroke({ color: THEME_COLORS.cyberGreen, width: 2, alpha: 0.9 });
      } else if (GRID_MODE === 'hex') {
        drawHexagon(g, selPos.px, selPos.py, HEX_SIZE + 2);
        g.stroke({ color: THEME_COLORS.cyberGreen, width: 2.5, alpha: 0.9 });
      } else {
        drawIsoTile(g, selPos.px, selPos.py, ISO_TILE_WIDTH + 4, ISO_TILE_HEIGHT + 2);
        g.stroke({ color: THEME_COLORS.cyberGreen, width: 2, alpha: 0.9 });
      }
    }
  }, [grid, combat.enemies, hoveredLinkKey, worldSize, buildingsById, renderTrigger]);

  return (
    <div className="h-full w-full" style={{ background: 'radial-gradient(ellipse at center, #001020 0%, #000510 70%, #000208 100%)' }}>
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
