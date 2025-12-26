import { useEffect, useMemo, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import { THEME_COLORS } from '../../core/constants/themeColors';
import { useGameStore, getBasePos } from '../../features/gameStore';
import { getBuildingEmoji, getDepositEmoji } from '../../core/constants/buildingEmoji';
import { formatNumber, D } from '../../core/math/format';
import type { Building, ResourceType } from '../../core/gameTypes';
import { ProximityWarningModal } from './ProximityWarningModal';
import { checkBuildingPlacement } from '../../hooks/useProximityWarnings';
import { getPowerSources, isInRadius, isBuildingPowered } from '../../utils/powerGridHelpers';
import { getLogisticsHubs, isInLogisticsZone, calculateLogisticsEfficiency } from '../../utils/logisticsHelpers';
import { getCurrentEvolution } from '../../core/constants/buildingEvolutions';

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

// Кэшируем стили для текста чтобы не создавать новые объекты каждый кадр
const TEXT_STYLES = {
  base: new PIXI.TextStyle({
    fill: THEME_COLORS.cyberGreen,
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'Arial, sans-serif',
  }),
  building: new PIXI.TextStyle({
    fill: THEME_COLORS.cyberText,
    fontSize: 24,
    fontWeight: '700',
    fontFamily: 'Arial, sans-serif',
  }),
  buildingBlocked: new PIXI.TextStyle({
    fill: THEME_COLORS.cyberRed,
    fontSize: 24,
    fontWeight: '700',
    fontFamily: 'Arial, sans-serif',
  }),
  warning: new PIXI.TextStyle({
    fill: THEME_COLORS.cyberRed,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'Arial, sans-serif',
  }),
  deposit: new PIXI.TextStyle({
    fill: THEME_COLORS.cyberText,
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Arial, sans-serif',
  }),
  missing: new PIXI.TextStyle({
    fill: THEME_COLORS.cyberRed,
    fontSize: 9,
    fontWeight: '700',
    fontFamily: 'Arial, sans-serif',
  }),
  flow: new PIXI.TextStyle({
    fontSize: 8,
    fontWeight: '600',
    fontFamily: 'Arial, sans-serif',
  }),
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function FactoryGrid() {
  // Состояние для модального окна предупреждений
  const [pendingPlacement, setPendingPlacement] = useState<{
    x: number;
    y: number;
    buildingId: string;
  } | null>(null);

  // КРИТИЧНО: Подписываемся только на нужные части стейта, чтобы избежать лишних ререндеров
  const grid = useGameStore((s) => ({
    tiles: s.grid.tiles,
    deposits: s.grid.deposits,
    selected: s.grid.selected,
    selectedBuildId: s.grid.selectedBuildId,
    buffers: s.grid.buffers,
    activeTransports: s.grid.activeTransports,
    width: s.grid.width,
    height: s.grid.height,
  }), (a, b) => {
    // Shallow compare для оптимизации
    return a.tiles === b.tiles &&
           a.deposits === b.deposits &&
           a.selected === b.selected &&
           a.selectedBuildId === b.selectedBuildId &&
           a.buffers === b.buffers &&
           a.activeTransports === b.activeTransports &&
           a.width === b.width &&
           a.height === b.height;
  });
  const combat = useGameStore((s) => s.combat);
  const buildings = useGameStore((s) => s.buildings);
  const selectTile = useGameStore((s) => s.selectTile);
  const placeSelectedBuildAt = useGameStore((s) => s.placeSelectedBuildAt);
  const setCameraPosition = useGameStore((s) => s.setCameraPosition);
  
  // Throttle для обновления камеры в БД - не сохраняем каждый кадр
  const lastCameraSaveRef = useRef<number>(0);
  const saveCameraThrottled = (x: number, y: number, zoom: number) => {
    const now = Date.now();
    if (now - lastCameraSaveRef.current > 500) { // Сохраняем максимум раз в 500ms
      lastCameraSaveRef.current = now;
      setCameraPosition(x, y, zoom);
    }
  };

  const containerRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const worldRef = useRef<PIXI.Container | null>(null);
  const graphicsRef = useRef<PIXI.Graphics | null>(null);
  const textLayerRef = useRef<PIXI.Container | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const initializedRef = useRef(false);
  
  // ПУЛ ТЕКСТОВЫХ ОБЪЕКТОВ - храним между кадрами
  const textPoolRef = useRef<PIXI.Text[]>([]);

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

      const handlePrimaryClick = (sx: number, sy: number) => {
        const wp = screenToWorld(sx, sy);
        const s = useGameStore.getState();

        const gridPos = pixelToGrid(wp.x, wp.y);
        const x = clamp(gridPos.x, 0, s.grid.width - 1);
        const y = clamp(gridPos.y, 0, s.grid.height - 1);

        const pos = { x, y };
        selectTile(pos);

        if (s.grid.selectedBuildId) {
          // Найдем здание по ID
          const building = s.buildings.find(b => b.id === s.grid.selectedBuildId);
          if (!building) {
            placeSelectedBuildAt(pos);
            return;
          }

          // Проверяем правила близости
          const check = checkBuildingPlacement(x, y, building, s.buildings, s.grid.tiles);
          
          // Если нет предупреждений или качество хорошее - строим сразу
          if (check.warnings.length === 0 || 
              (check.quality === 'optimal' || check.quality === 'good')) {
            placeSelectedBuildAt(pos);
          } else {
            // Показываем модальное окно с предупреждениями
            setPendingPlacement({ x, y, buildingId: s.grid.selectedBuildId });
          }
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

        // Получаем текущий grid из store
        const currentGrid = useGameStore.getState().grid;
        
        // Вычисляем позицию базы в пиксельных координатах
        const basePos = getBasePos(currentGrid);
        const basePixel = gridToPixel(basePos.x, basePos.y);
        
        // Центрируем камеру на базе
        const baseCenterX = basePixel.px + CELL / 2;
        const baseCenterY = basePixel.py + CELL / 2;
        
        // Подбираем zoom чтобы база была в центре экрана
        const fit = Math.min(vw / ws.w, vh / ws.h) * 1.2; // Немного ближе для лучшего обзора
        cam.zoom = clamp(fit, ZOOM_MIN, ZOOM_MAX);
        
        // Позиционируем камеру так чтобы база была в центре экрана
        cam.x = vw / 2 - baseCenterX * cam.zoom;
        cam.y = vh / 2 - baseCenterY * cam.zoom;
        
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
          handlePrimaryClick(sx, sy);
        }
      };

      const onKeyDown = () => {
        // Key handling removed - no longer needed for link management
      };

      const onContextMenu = (e: MouseEvent) => {
        e.preventDefault();
        // Context menu functionality removed (no longer used for links)
      };

      const onPointerMove = (e: PointerEvent) => {
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
          // Сохраняем позицию камеры в БД (throttled)
          saveCameraThrottled(camRef.current.x, camRef.current.y, camRef.current.zoom);
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
        // Сохраняем позицию камеры в БД (throttled)
        saveCameraThrottled(cam.x, cam.y, cam.zoom);
        
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
        // No longer tracking link hover
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
          try {
            // Удаляем canvas вручную перед destroy
            if (app.canvas && app.canvas.parentNode) {
              app.canvas.parentNode.removeChild(app.canvas);
            }
            // Destroy без параметров или с одним объектом опций
            app.destroy(true, {
              children: true,
              texture: true,
              textureSource: true,
            });
          } catch (e) {
            console.warn('Error destroying PixiJS app:', e);
          }
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

    // НЕ удаляем детей - пул текстов управляется через visible

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
    
    // Диапазон видимых клеток с запасом +10 клеток для оптимизации
    const cellSize = CELL + GAP;
    const bufferCells = 10; // Запас клеток для плавного рендеринга
    const minX = Math.max(0, Math.floor((worldLeft - GAP) / cellSize) - bufferCells);
    const maxX = Math.min(grid.width - 1, Math.ceil((worldRight - GAP) / cellSize) + bufferCells);
    const minY = Math.max(0, Math.floor((worldTop - GAP) / cellSize) - bufferCells);
    const maxY = Math.min(grid.height - 1, Math.ceil((worldBottom - GAP) / cellSize) + bufferCells);
    
    // Показывать текст только при достаточном зуме
    const showText = cam.zoom > 0.4;
    const showDetailedText = cam.zoom > 0.7;
    
    // ПУЛ ТЕКСТОВЫХ ОБЪЕКТОВ: переиспользуем существующие объекты
    const textPool = textPoolRef.current;
    let textPoolIndex = 0;
    
    const getTextFromPool = (text: string, style: PIXI.TextStyle): PIXI.Text => {
      let t: PIXI.Text;
      if (textPoolIndex < textPool.length) {
        // Переиспользуем существующий объект
        t = textPool[textPoolIndex];
        t.text = text;
        t.style = style;
        t.visible = true;
        // Добавляем на слой если еще не добавлен
        if (textLayer && t.parent !== textLayer) {
          textLayer.addChild(t);
        }
      } else {
        // Создаем новый только если пул пуст
        t = new PIXI.Text({ text, style });
        textPool.push(t);
        if (textLayer) textLayer.addChild(t);
      }
      textPoolIndex++;
      return t;
    };

    // Cells - рисуем только видимые
    const basePos = getBasePos(grid);
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const k = `${x},${y}`;
        const hasBuilding = Boolean(grid.tiles[k]);
        const { px, py } = gridToPixel(x, y);

        const isBase = x === basePos.x && y === basePos.y;
        // При малом зуме делаем здания более яркими и контрастными
        const buildingAlphaBoost = cam.zoom < 0.5 ? 0.5 : 0.35;
        const fill = isBase
          ? THEME_COLORS.cyberGreen
          : hasBuilding
            ? THEME_COLORS.cyberBlue
            : THEME_COLORS.cyberDark;
        const alpha = isBase ? 0.3 : hasBuilding ? buildingAlphaBoost : 0.4;

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
        let strokeWidth = 1;
        const missingResources: ResourceType[] = [];
        
        // При малом зуме делаем обводку зданий толще и ярче для лучшей видимости
        if (hasBuilding && cam.zoom < 0.5) {
          strokeColor = THEME_COLORS.cyberBlue;
          strokeAlpha = 0.9;
          strokeWidth = 2;
        }
        
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
        if (showText || (hasBuilding && cam.zoom < 0.5)) {
          if (GRID_MODE === 'square') {
            g.roundRect(px, py, CELL, CELL, 2).stroke({ color: strokeColor, width: strokeWidth, alpha: strokeAlpha * (showText ? 0.5 : 1) });
          } else if (GRID_MODE === 'hex') {
            drawHexagon(g, px, py, HEX_SIZE);
            g.stroke({ color: strokeColor, width: strokeWidth, alpha: strokeAlpha * (showText ? 0.6 : 1) });
          } else {
            drawIsoTile(g, px, py, ISO_TILE_WIDTH, ISO_TILE_HEIGHT);
            g.stroke({ color: strokeColor, width: strokeWidth * 1.5, alpha: strokeAlpha });
          }
        }

        if (textLayer && showText) {
          const textOffsetY = GRID_MODE === 'isometric' ? -8 : 0;
          
          if (isBase) {
            const t = getTextFromPool('🏠', TEXT_STYLES.base);
            t.anchor.set(0.5, 0.5);
            const centerX = GRID_MODE === 'hex' ? px : px + CELL / 2;
            const centerY = GRID_MODE === 'hex' ? py : py + CELL / 2;
            t.x = centerX;
            t.y = centerY + textOffsetY;
          } else if (hasBuilding) {
            const buildingId = grid.tiles[k];
            const evolutionLevel = grid.tileEvolutionLevels?.[k] || 0;
            const currentEvolution = evolutionLevel > 0 ? getCurrentEvolution(buildingId, evolutionLevel) : null;
            
            // Используем visualUpgrade emoji если есть эволюция, иначе базовую эмодзи здания
            const emoji = currentEvolution?.visualUpgrade || getBuildingEmoji(buildingId);
            const isBlocked = missingResources.length > 0;
            
            const t = getTextFromPool(emoji, isBlocked ? TEXT_STYLES.buildingBlocked : TEXT_STYLES.building);
            t.anchor.set(0.5, 0.5);
            const centerX = GRID_MODE === 'hex' ? px : px + CELL / 2;
            const centerY = GRID_MODE === 'hex' ? py : py + CELL / 2;
            t.x = centerX;
            t.y = centerY + textOffsetY - (isBlocked ? 6 : 0);
            
            // Добавляем звездочку для эволюционированных зданий
            if (evolutionLevel > 0 && showDetailedText) {
              const star = getTextFromPool('⭐', TEXT_STYLES.warning);
              star.anchor.set(0.5, 0.5);
              star.x = centerX + (GRID_MODE === 'hex' ? 12 : 18);
              star.y = centerY + textOffsetY - 8;
            }

            // Warning icon когда заблокировано
            if (isBlocked && showDetailedText) {
              const warning = getTextFromPool('⚠', TEXT_STYLES.warning);
              warning.anchor.set(0.5, 0.5);
              warning.x = centerX - (GRID_MODE === 'hex' ? 10 : 15);
              warning.y = centerY + textOffsetY - 6;
            }

            if (missingResources.length > 0 && showDetailedText) {
              const label = missingResources
                .slice(0, 3)
                .map((r) => RESOURCE_SHORT[r] ?? r.toUpperCase())
                .join(',');
              const miss = getTextFromPool(`НЕТ: ${label}`, TEXT_STYLES.missing);
              miss.anchor.set(0.5, 0.5);
              miss.x = centerX;
              miss.y = centerY + textOffsetY + 10;
            }
          } else {
            // Показываем месторождения только при детальном зуме (>0.7) чтобы не нагружать при отдалении
            const dep = grid.deposits?.[k];
            if (dep && showDetailedText) {
              const t = getTextFromPool(getDepositEmoji(dep), TEXT_STYLES.deposit);
              t.alpha = 0.4;
              t.anchor.set(0.5, 0.5);
              const centerX = GRID_MODE === 'hex' ? px : px + CELL / 2;
              const centerY = GRID_MODE === 'hex' ? py : py + CELL / 2;
              t.x = centerX;
              t.y = centerY + textOffsetY;
            }
          }
        }
      }
    }
    
    // Скрываем неиспользуемые текстовые объекты из пула
    // Скрываем неиспользованные тексты из пула
    for (let i = textPoolIndex; i < textPool.length; i++) {
      if (textPool[i].visible) {
        textPool[i].visible = false;
      }
    }

    // Создаем список всех зданий с координатами (используется для энергосети и логистики)
    const allBuildingsWithCoords: Building[] = [];
    for (const [key, buildingId] of Object.entries(grid.tiles)) {
      const coords = key.split(',').map(Number);
      if (coords.length === 2) {
        const building = buildingsById[buildingId];
        if (building) {
          allBuildingsWithCoords.push({
            ...building,
            coord: { x: coords[0], y: coords[1] }
          });
        }
      }
    }

    // ФАЗА 8.2: ВИЗУАЛИЗАЦИЯ ЭНЕРГОСЕТИ
    // Отображаем зоны покрытия энергосети, если зум достаточный
    if (showText && cam.zoom > 0.5) {
      const powerSources = getPowerSources(allBuildingsWithCoords);

      // Рисуем зоны покрытия энергосети
      for (const { building, radius } of powerSources) {
        if (!building.coord) continue;

        const { x: cx, y: cy } = building.coord;

        // Рисуем только видимые клетки для оптимизации
        const rangeMinX = Math.max(minX, cx - radius);
        const rangeMaxX = Math.min(maxX, cx + radius);
        const rangeMinY = Math.max(minY, cy - radius);
        const rangeMaxY = Math.min(maxY, cy + radius);

        // Подсвечиваем покрытые клетки
        for (let x = rangeMinX; x <= rangeMaxX; x++) {
          for (let y = rangeMinY; y <= rangeMaxY; y++) {
            if (isInRadius(cx, cy, x, y, radius)) {
              const { px, py } = gridToPixel(x, y);
              g.rect(px, py, CELL, CELL).fill({ color: 0x22c55e, alpha: 0.08 });
            }
          }
        }

        // Рисуем контур радиуса (ромб для манхэттенского расстояния)
        const centerPixel = gridToPixel(cx, cy);
        const centerX = centerPixel.px + CELL / 2;
        const centerY = centerPixel.py + CELL / 2;
        
        g.setStrokeStyle({ color: 0x22c55e, width: 1.5, alpha: 0.3 })
         .moveTo(centerX, centerY - radius * (CELL + GAP))
         .lineTo(centerX + radius * (CELL + GAP), centerY)
         .lineTo(centerX, centerY + radius * (CELL + GAP))
         .lineTo(centerX - radius * (CELL + GAP), centerY)
         .closePath()
         .stroke();

        // Иконка источника энергии
        if (showDetailedText && textLayer) {
          const powerIcon = getTextFromPool('⚡', TEXT_STYLES.base);
          powerIcon.anchor.set(0.5, 0.5);
          powerIcon.x = centerX;
          powerIcon.y = centerY - CELL / 4;
          powerIcon.alpha = 0.7;
        }
      }

      // Подсвечиваем здания без энергопокрытия красной рамкой
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const k = `${x},${y}`;
          const buildingId = grid.tiles[k];
          if (!buildingId) continue;

          const building = buildingsById[buildingId];
          if (!building) continue;

          // Пропускаем источники энергии
          if (building.powerGridRadius && building.powerGridRadius > 0) continue;

          // Проверяем энергопокрытие
          const isPowered = isBuildingPowered({ x, y }, allBuildingsWithCoords);
          
          if (!isPowered) {
            const { px, py } = gridToPixel(x, y);
            // Красная пульсирующая рамка
            const pulse = Math.sin(Date.now() / 500) * 0.2 + 0.6;
            g.roundRect(px + 2, py + 2, CELL - 4, CELL - 4, 2)
             .stroke({ color: 0xef4444, width: 2, alpha: pulse });

            // Иконка предупреждения
            if (showDetailedText && textLayer) {
              const warningIcon = getTextFromPool('⚠', TEXT_STYLES.warning);
              warningIcon.anchor.set(0, 0);
              warningIcon.x = px + 4;
              warningIcon.y = py + 4;
              warningIcon.style.fill = 0xef4444;
            }
          }
        }
      }
    }

    // ФАЗА 8.3: ВИЗУАЛИЗАЦИЯ ЛОГИСТИЧЕСКОЙ СЕТИ
    // Отображаем зоны покрытия логистики (склады и логистические центры)
    if (showText && cam.zoom > 0.6) {
      const logisticsHubs = getLogisticsHubs(allBuildingsWithCoords);

      // Рисуем зоны покрытия логистической сети
      for (const { building, radius } of logisticsHubs) {
        if (!building.coord) continue;

        const { x: cx, y: cy } = building.coord;

        // Рисуем только видимые клетки для оптимизации
        const rangeMinX = Math.max(minX, cx - radius);
        const rangeMaxX = Math.min(maxX, cx + radius);
        const rangeMinY = Math.max(minY, cy - radius);
        const rangeMaxY = Math.min(maxY, cy + radius);

        // Подсвечиваем покрытые клетки (синий цвет для логистики)
        for (let x = rangeMinX; x <= rangeMaxX; x++) {
          for (let y = rangeMinY; y <= rangeMaxY; y++) {
            if (isInLogisticsZone(cx, cy, x, y, radius)) {
              const { px, py } = gridToPixel(x, y);
              g.rect(px, py, CELL, CELL).fill({ color: 0x3b82f6, alpha: 0.06 });
            }
          }
        }

        // Рисуем контур радиуса логистики
        const centerPixel = gridToPixel(cx, cy);
        const centerX = centerPixel.px + CELL / 2;
        const centerY = centerPixel.py + CELL / 2;
        
        g.setStrokeStyle({ color: 0x3b82f6, width: 1.5, alpha: 0.25 })
         .moveTo(centerX, centerY - radius * (CELL + GAP))
         .lineTo(centerX + radius * (CELL + GAP), centerY)
         .lineTo(centerX, centerY + radius * (CELL + GAP))
         .lineTo(centerX - radius * (CELL + GAP), centerY)
         .closePath()
         .stroke();

        // Иконка логистического узла
        if (showDetailedText && textLayer) {
          const logisticsIcon = getTextFromPool('📦', TEXT_STYLES.base);
          logisticsIcon.anchor.set(0.5, 0.5);
          logisticsIcon.x = centerX;
          logisticsIcon.y = centerY - CELL / 4;
          logisticsIcon.alpha = 0.7;
        }
      }

      // Подсвечиваем здания с логистическим штрафом оранжевой рамкой
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const k = `${x},${y}`;
          const buildingId = grid.tiles[k];
          if (!buildingId) continue;

          const building = buildingsById[buildingId];
          if (!building) continue;

          // Пропускаем логистические узлы
          if (building.logisticsRadius && building.logisticsRadius > 0) continue;

          // Проверяем логистическую эффективность
          const logisticsEfficiency = calculateLogisticsEfficiency(
            { x, y },
            basePos,
            allBuildingsWithCoords
          );
          
          if (logisticsEfficiency < 1.0 && showDetailedText) {
            const { px, py } = gridToPixel(x, y);
            const penalty = Math.round((1 - logisticsEfficiency) * 100);
            
            // Оранжевая рамка для зданий с штрафом
            g.roundRect(px + 1, py + 1, CELL - 2, CELL - 2, 2)
             .stroke({ color: 0xf59e0b, width: 1.5, alpha: 0.5 });

            // Текст со штрафом
            if (textLayer) {
              const penaltyText = getTextFromPool(`-${penalty}%`, TEXT_STYLES.missing);
              penaltyText.anchor.set(1, 0);
              penaltyText.x = px + CELL - 4;
              penaltyText.y = py + 4;
              penaltyText.style.fill = 0xf59e0b;
            }
          }
        }
      }
    }

    // АВТОМАТИЧЕСКАЯ ЛОГИСТИКА: Рисуем летящие частицы для активных транспортов
    if (grid.activeTransports && grid.activeTransports.length > 0 && showDetailedText) {
      for (const transport of grid.activeTransports) {
        const fromPos = gridToPixel(transport.from.x, transport.from.y);
        const toPos = gridToPixel(transport.to.x, transport.to.y);
        
        const fromX = fromPos.px + CELL / 2;
        const fromY = fromPos.py + CELL / 2;
        const toX = toPos.px + CELL / 2;
        const toY = toPos.py + CELL / 2;
        
        // Цвет частицы в зависимости от ресурса
        const color = transport.resource === 'energy'
          ? THEME_COLORS.cyberText
          : transport.resource === 'ore'
            ? THEME_COLORS.cyberGray
            : transport.resource === 'ice'
              ? THEME_COLORS.cyberBlue
              : transport.resource === 'carbon'
                ? THEME_COLORS.cyberRed
                : THEME_COLORS.cyberGreen;
        
        // Анимация движения частицы
        const time = Date.now() / 1000;
        const speed = 0.5; // Скорость 0.5 = 2 секунды на полный путь
        const progress = (time * speed) % 1;
        
        const particleX = fromX + (toX - fromX) * progress;
        const particleY = fromY + (toY - fromY) * progress;
        
        // Рисуем частицу с эффектом свечения
        g.circle(particleX, particleY, 5).fill({ color, alpha: 0.9 });
        g.circle(particleX, particleY, 3).fill({ color: 0xffffff, alpha: 0.7 });
        
        // Текст с количеством (только при высоком зуме)
        if (cam.zoom > 1.2 && textLayer) {
          const flowStyle = TEXT_STYLES.flow.clone();
          flowStyle.fill = color;
          const amount = typeof transport.amount === 'string' ? D(transport.amount) : transport.amount;
          const flowText = new PIXI.Text({
            text: formatNumber(amount),
            style: flowStyle,
          });
          flowText.anchor.set(0.5, 0.5);
          flowText.x = particleX;
          flowText.y = particleY - 10;
          textLayer.addChild(flowText);
        }
      }
    }

    // Base marker (target) - центр карты
    const baseMarkerPos = getBasePos(grid);
    const basePixelPos = gridToPixel(baseMarkerPos.x, baseMarkerPos.y);
    g.circle(basePixelPos.px + CELL / 2, basePixelPos.py + CELL / 2, 8).fill({ color: THEME_COLORS.cyberGreen, alpha: 0.8 });

    // Enemies (visual only) - показываем только при достаточном зуме и ограничиваем количество
    if (combat.enemies.length > 0 && showText) {
      const laneCount = Math.min(8, combat.enemies.length);
      // Сильно ограничиваем количество врагов при слабом зуме
      const maxEnemies = cam.zoom > 0.8 ? 16 : cam.zoom > 0.5 ? 8 : 4;
      const displayCount = Math.min(combat.enemies.length, maxEnemies);
      
      for (let i = 0; i < displayCount; i++) {
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
      const baseLinePos = getBasePos(grid);
      const baseLinePixel = gridToPixel(baseLinePos.x, baseLinePos.y);
      g.moveTo(GAP, baseLinePixel.py).lineTo(worldSize.w - GAP, baseLinePixel.py).stroke({ color: THEME_COLORS.cyberGray, width: 1, alpha: 0.25 });
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
  }, [grid.tiles, grid.deposits, grid.selected, grid.activeTransports, grid.buffers, grid.width, grid.height, combat.enemies.length, worldSize, buildingsById]);

  // Обработчики модального окна
  const handleConfirmPlacement = () => {
    if (pendingPlacement) {
      placeSelectedBuildAt({ x: pendingPlacement.x, y: pendingPlacement.y });
      setPendingPlacement(null);
    }
  };

  const handleCancelPlacement = () => {
    setPendingPlacement(null);
  };

  // Получаем данные для модального окна
  const modalData = useMemo(() => {
    if (!pendingPlacement) return null;

    const state = useGameStore.getState();
    const building = state.buildings.find(b => b.id === pendingPlacement.buildingId);
    if (!building) return null;

    const check = checkBuildingPlacement(
      pendingPlacement.x,
      pendingPlacement.y,
      building,
      state.buildings,
      state.grid.tiles
    );

    return {
      building,
      check,
    };
  }, [pendingPlacement]);

  return (
    <div className="h-full w-full" style={{ background: 'radial-gradient(ellipse at center, #001020 0%, #000510 70%, #000208 100%)' }}>
      <div ref={containerRef} className="w-full h-full" />
      
      {/* Модальное окно предупреждений */}
      {pendingPlacement && modalData && (
        <ProximityWarningModal
          warnings={modalData.check.warnings}
          multiplier={modalData.check.multiplier}
          quality={modalData.check.quality}
          buildingName={modalData.building.name}
          onConfirm={handleConfirmPlacement}
          onCancel={handleCancelPlacement}
        />
      )}
    </div>
  );
}
