import { useEffect, useMemo, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import { THEME_COLORS, hexToCss } from '../../core/constants/themeColors';
import { useGameStore, getBasePos } from '../../features/gameStore';
import { useUiStore } from '../../features/uiStore';
import {
  BUILDING_EMOJI,
  DEPOSIT_EMOJI,
  getBuildingEmoji,
  getDepositEmoji,
} from '../../core/constants/buildingEmoji';
import type { Building } from '../../core/gameTypes';
import { getMapDefinition } from '../../core/constants/maps';
import type { GridType } from '../../core/gameTypes.maps';
import { ProximityWarningModal } from './ProximityWarningModal';
import { checkBuildingPlacement } from '../../hooks/useProximityWarnings';
// Радиусы разворачиваются в poweredTiles/activeLogisticsHubs один раз в useMemo ниже,
// поэтому пер-тайловые isInRadius / isBuildingPowered / isInLogisticsZone здесь не нужны.
import { getPowerSources } from '../../utils/powerGridHelpers';
import { calculateLogisticsEfficiency } from '../../utils/logisticsHelpers';
import { getCurrentEvolution } from '../../core/constants/buildingEvolutions';
import { jobProgress } from '../../core/systems/construction';
import { playSfx } from '../../core/audio/sfx';
import { setActiveGridGeometry } from '../../core/math/hexGeometry';
import { gameEvents, GAME_EVENTS } from '../../utils/gameEvents';
import { GameIcon } from '../ui/icons';
import { getIconTexture, preloadIconTextures } from '../ui/icons/pixiIcon';

// Hexagonal grid constants (flat-top hexagons)
const HEX_SIZE = 28; // Radius of hexagon
const HEX_WIDTH = Math.sqrt(3) * HEX_SIZE; // Width between parallel sides
const HEX_HEIGHT = 2 * HEX_SIZE; // Height from top to bottom
const HEX_HORIZ = HEX_WIDTH; // Horizontal spacing between column centers
const HEX_VERT = HEX_SIZE * 1.5; // Vertical spacing between row centers

// Grid display mode - динамический, берётся из текущей карты.
// ВАЖНО: схема карт (core/gameTypes.maps.ts -> GridType) допускает ТОЛЬКО 'square' | 'hex',
// и ни одна из карт в core/constants/maps.ts не объявляет ничего другого.
// Раньше здесь был третий режим 'isometric': недостижимая ветка, которую TypeScript
// и помечал ошибкой TS2367 на сравнении `currentGridMode === 'isometric'`.
// Мёртвый режим удалён — тип теперь честно совпадает с тем, что реально бывает в данных.
type GridMode = GridType;

// Legacy constants for square mode compatibility
const CELL = 48; // Увеличен для лучшей видимости, как в Industry Idle
const GAP = 1;   // Уменьшен зазор для более плотной сетки

const ZOOM_MIN = 0.3;
const ZOOM_MAX = 4.0;

const DRAG_THRESHOLD_PX = 4;

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

// ─── Конвертеры координат ──────────────────────────────────────────────────
// Чистые функции уровня модуля: режим сетки приходит АРГУМЕНТОМ, поэтому они
// физически не могут замкнуться на устаревшем режиме.
function gridToPixelIn(mode: GridMode, x: number, y: number): { px: number; py: number } {
  if (mode === 'hex') {
    // Hexagonal grid (flat-top hexagons). Odd columns are shifted down by HEX_VERT.
    const offsetY = (x % 2 === 1) ? HEX_VERT : 0;
    return {
      px: x * HEX_HORIZ,
      py: y * HEX_VERT * 2 + offsetY,
    };
  }
  return {
    px: GAP + x * (CELL + GAP),
    py: GAP + y * (CELL + GAP),
  };
}

function pixelToGridIn(mode: GridMode, px: number, py: number): { x: number; y: number } {
  if (mode === 'hex') {
    // Approximate hexagonal conversion
    const col = Math.round(px / HEX_HORIZ);
    const offsetY = (col % 2 === 1) ? HEX_VERT : 0;
    const row = Math.round((py - offsetY) / (HEX_VERT * 2));
    return { x: col, y: row };
  }
  return {
    x: Math.floor((px - GAP) / (CELL + GAP)),
    y: Math.floor((py - GAP) / (CELL + GAP)),
  };
}

function worldSizeIn(mode: GridMode, width: number, height: number): { w: number; h: number } {
  if (mode === 'hex') {
    return {
      w: (width + 1) * HEX_HORIZ + HEX_WIDTH,
      h: (height + 1) * HEX_VERT * 2 + HEX_HEIGHT,
    };
  }
  return {
    w: width * (CELL + GAP) + GAP,
    h: height * (CELL + GAP) + GAP,
  };
}

export function FactoryGrid() {
  // Получаем тип сетки из текущей карты
  const currentMapId = useGameStore((s) => s.maps.currentMapId);
  const currentGridMode: GridMode = useMemo(() => {
    if (!currentMapId) return 'square';
    const mapDef = getMapDefinition(currentMapId);
    return mapDef?.gridType ?? 'square';
  }, [currentMapId]);
  
  // Состояние для модального окна предупреждений
  const [pendingPlacement, setPendingPlacement] = useState<{
    x: number;
    y: number;
    buildingId: string;
  } | null>(null);
  
  // КРИТИЧНО: Подписываемся только на нужные части стейта, чтобы избежать лишних ререндеров
  // Если активна платформа - используем её сетку, иначе главную базу
  const grid = useGameStore((s) => {
    const activePlatform = s.galaxies.activePlatformId 
      ? s.galaxies.platforms.find(p => p.id === s.galaxies.activePlatformId) 
      : null;
    const platformGrid = activePlatform ? activePlatform.grid : null;
    const mainGrid = s.grid;
    const activeGrid = platformGrid || mainGrid;
    
    return {
      tiles: activeGrid.tiles,
      deposits: activeGrid.deposits,
      selected: activeGrid.selected,
      selectedBuildId: activeGrid.selectedBuildId,
      highlightedBuildingId: (mainGrid as any).highlightedBuildingId,
      buffers: activeGrid.buffers,
      tileEvolutionLevels: (mainGrid as any).tileEvolutionLevels || {},
      tileDisabled: (mainGrid as any).tileDisabled || {},
      // Незавершённые стройки/улучшения: берём из АКТИВНОЙ сетки — на платформе своя очередь.
      tileJobs: (activeGrid as any).tileJobs || {},
      width: activeGrid.width,
      height: activeGrid.height,
    };
  }, (a, b) => {
    // Shallow compare для оптимизации
    return a.tiles === b.tiles &&
           a.deposits === b.deposits &&
           a.selected === b.selected &&
           a.selectedBuildId === b.selectedBuildId &&
           a.highlightedBuildingId === b.highlightedBuildingId &&
           a.buffers === b.buffers &&
           a.tileEvolutionLevels === b.tileEvolutionLevels &&
           a.tileDisabled === b.tileDisabled &&
           a.tileJobs === b.tileJobs &&
           a.width === b.width &&
           a.height === b.height;
  });
  const combat = useGameStore((s) => s.combat);
  const buildings = useGameStore((s) => s.buildings);
  // Массовое выделение (bigplan.md, пункты 10 и 28) — UI-состояние, не попадает в сейв.
  const selectedTiles = useUiStore((s) => s.selectedTiles);
  const selectTile = useGameStore((s) => s.selectTile);
  const selectBuild = useGameStore((s) => s.selectBuild);
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
  // Иконки на канвасе — спрайты из общего набора, тоже пулятся между кадрами
  const iconPoolRef = useRef<PIXI.Sprite[]>([]);

  // Растеризуем весь набор иконок сетки заранее, иначе они проявлялись бы
  // по одной по мере первого появления клетки в кадре.
  useEffect(() => {
    void preloadIconTextures([
      ...Object.values(BUILDING_EMOJI),
      ...Object.values(DEPOSIT_EMOJI),
      '⚡',
      '⚠',
      '⭐',
      '⏸️',
      '📦',
      '🏠',
    ]);
  }, []);

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

  /*
   * ВЫДЕЛЕНИЕ РАМКОЙ (bigplan.md, пункты 10 и 28).
   *
   * Держим в ref, а не в state: рамка обновляется на каждое движение мыши, и прогон через
   * React-рендер на 60 Гц ради прямоугольника — лишняя работа. В стор уходит только
   * итоговый набор клеток на pointerup.
   *
   * Мировые координаты (а не экранные): иначе рамка «поедет», если во время протяжки
   * изменится зум или камера.
   */
  const boxRef = useRef({
    active: false,
    /** Дополнять существующее выделение (Shift), а не заменять его. */
    additive: false,
    startWorldX: 0,
    startWorldY: 0,
    curWorldX: 0,
    curWorldY: 0,
  });

  // ─── ЗАЩИТА ОТ УСТАРЕВШЕГО РЕЖИМА СЕТКИ ────────────────────────────────────
  // Bootstrap-эффект Pixi имеет deps [] и навсегда захватывает функции ПЕРВОГО
  // рендера (handlePrimaryClick, fitCamera, обработчик GO_TO_BASE). А <FactoryGrid/>
  // рендерится в App.tsx без key, поэтому смена карты компонент не перемонтирует.
  // Раньше конвертеры замыкались на `currentGridMode`, и после перехода
  // square -> hex клики продолжали считаться по квадратной математике,
  // то есть попадали не в ту клетку.
  //
  // Теперь режим живёт в ref'е, который переписывается на КАЖДОМ рендере, а сами
  // конвертеры читают его в МОМЕНТ ВЫЗОВА. Захваченное замыкание может быть сколь
  // угодно старым — значение оно всё равно возьмёт актуальное. Устареть больше нечему:
  // единственный источник режима — этот ref, и в нём нет копии, живущей дольше рендера.
  const gridModeRef = useRef<GridMode>(currentGridMode);
  gridModeRef.current = currentGridMode;

  /*
   * Единственная гарантия, что РЕНДЕР и ЛОГИКА не разойдутся по геометрии
   * (bigplan.md, пункты 21, 31).
   *
   * Стор ставит геометрию в startMap и при загрузке сейва, но точек входа на карту больше
   * (selectMap, отладочные переходы), и разойтись они могут незаметно: игрок видит гексы, а
   * бонусы соседства считаются по квадратам. Здесь мы синхронизируем её с тем же значением,
   * по которому реально рисуется сетка, — рассогласование становится невозможным.
   */
  useEffect(() => {
    setActiveGridGeometry(currentGridMode === 'hex' ? 'hex' : 'square');
  }, [currentGridMode]);

  // Convert grid coordinates to pixel coordinates based on the CURRENT mode
  const gridToPixel = (x: number, y: number) => gridToPixelIn(gridModeRef.current, x, y);

  // Convert pixel coordinates to grid coordinates based on the CURRENT mode
  const pixelToGrid = (px: number, py: number) => pixelToGridIn(gridModeRef.current, px, py);

  const worldSize = useMemo(
    () => worldSizeIn(currentGridMode, grid.width, grid.height),
    [grid.width, grid.height, currentGridMode],
  );

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

  // MEMOIZATION: Only recalculate when tiles change, not on every tick (buffers update)
  const { allBuildingsWithCoords, activeLogisticsHubs, powerSources, poweredTiles } = useMemo(() => {
    const buildingsWithCoords: Building[] = [];
    const logisticsHubs: Array<{x: number, y: number, radius: number}> = [];
    
    // Optimization: avoid Object.entries allocation
    for (const key in grid.tiles) {
      const buildingId = grid.tiles[key];
      
      // Fast numeric parse (assuming format "x,y")
      const commaIdx = key.indexOf(',');
      if (commaIdx === -1) continue;
      
      // Manual substring or just fast split. 
      // Substring is faster than split+map(Number)
      const x = +key.substring(0, commaIdx);
      const y = +key.substring(commaIdx + 1);
      
      const building = buildingsById[buildingId];
      if (building) {
          const bWC = {
            ...building,
            coord: { x, y }
          };
          buildingsWithCoords.push(bWC);

          if (bWC.logisticsRadius && bWC.logisticsRadius > 0) {
              logisticsHubs.push({ x, y, radius: bWC.logisticsRadius });
          }
      }
    }

    // Pre-calculate powered tiles map (O(1) lookup in render loop)
    const sources = getPowerSources(buildingsWithCoords);
    const poweredSet = new Set<string>();
    
    for (const { building, radius } of sources) {
       if (!building.coord) continue;
       const { x: cx, y: cy } = building.coord;
       
       // Add all tiles in radius to set
       for (let dy = -radius; dy <= radius; dy++) {
         const ay = Math.abs(dy);
         const y = cy + dy;
         for (let dx = -radius; dx <= radius; dx++) {
            const ax = Math.abs(dx);
            if (ax + ay <= radius) {
                poweredSet.add(`${cx + dx},${y}`);
            }
         }
       }
    }

    return { 
        allBuildingsWithCoords: buildingsWithCoords, 
        activeLogisticsHubs: logisticsHubs,
        powerSources: sources,
        poweredTiles: poweredSet
    };
  }, [grid.tiles, buildingsById]);

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

      // Космический фон со звездами
      const stars = new PIXI.Graphics();
      for (let i = 0; i < 200; i++) {
        const x = Math.random() * (worldSize.w * 2);
        const y = Math.random() * (worldSize.h * 2);
        const size = Math.random() * 1.5 + 0.5;
        const brightness = Math.random() * 0.6 + 0.4;
        const color = Math.random() > 0.8 ? THEME_COLORS.cyberBlue : THEME_COLORS.cyberText;
        stars.circle(x, y, size).fill({ color, alpha: brightness });
      }
      world.addChild(stars);

      const g = new PIXI.Graphics();
      graphicsRef.current = g;
      world.addChild(g);

      const textLayer = new PIXI.Container();
      textLayerRef.current = textLayer;
      world.addChild(textLayer);

      /*
       * Отдельный слой для рамки выделения. Она обновляется на каждый кадр протяжки, и рисовать
       * её в общем `g` значило бы перерисовывать вместе с ней всю карту 60 раз в секунду.
       */
      const boxLayer = new PIXI.Graphics();
      world.addChild(boxLayer);

      const drawSelectionBox = () => {
        boxLayer.clear();
        const box = boxRef.current;
        if (!box.active) return;

        const x = Math.min(box.startWorldX, box.curWorldX);
        const y = Math.min(box.startWorldY, box.curWorldY);
        const w = Math.abs(box.curWorldX - box.startWorldX);
        const h = Math.abs(box.curWorldY - box.startWorldY);
        if (w < 1 && h < 1) return;

        boxLayer
          .rect(x, y, w, h)
          .fill({ color: THEME_COLORS.cyberYellow, alpha: 0.08 })
          .stroke({ color: THEME_COLORS.cyberYellow, width: 1.5, alpha: 0.9 });
      };

      app.ticker.add(drawSelectionBox);

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

      /**
       * Клетки со зданиями внутри текущей рамки.
       *
       * Идём по ЗАНЯТЫМ клеткам (grid.tiles), а не по прямоугольнику сетки: рамкой на
       * отдалённой камере можно накрыть десятки тысяч клеток, а зданий там единицы.
       */
      const tilesInBox = (): string[] => {
        const box = boxRef.current;
        const minX = Math.min(box.startWorldX, box.curWorldX);
        const maxX = Math.max(box.startWorldX, box.curWorldX);
        const minY = Math.min(box.startWorldY, box.curWorldY);
        const maxY = Math.max(box.startWorldY, box.curWorldY);

        const s = useGameStore.getState();
        const g = s.galaxies.activePlatformId
          ? s.galaxies.platforms.find((p) => p.id === s.galaxies.activePlatformId)?.grid || s.grid
          : s.grid;

        const baseKey = `${getBasePos(g).x},${getBasePos(g).y}`;
        const out: string[] = [];

        for (const key of Object.keys(g.tiles)) {
          if (key === baseKey) continue; // ядро базы снести нельзя, выделять его незачем
          const comma = key.indexOf(',');
          const gx = Number(key.slice(0, comma));
          const gy = Number(key.slice(comma + 1));
          if (!Number.isFinite(gx) || !Number.isFinite(gy)) continue;

          // Центр клетки — попадание по центру предсказуемее, чем по любому касанию рамкой.
          const p = gridToPixel(gx, gy);
          const cx = currentGridMode === 'hex' ? p.px : p.px + CELL / 2;
          const cy = currentGridMode === 'hex' ? p.py : p.py + CELL / 2;

          if (cx >= minX && cx <= maxX && cy >= minY && cy <= maxY) out.push(key);
        }

        return out;
      };

      const handlePrimaryClick = (sx: number, sy: number) => {
        const wp = screenToWorld(sx, sy);
        const s = useGameStore.getState();
        
        // Получаем актуальный grid из store (не из замыкания!)
        const currentGrid = s.galaxies.activePlatformId 
          ? s.galaxies.platforms.find(p => p.id === s.galaxies.activePlatformId)?.grid || s.grid
          : s.grid;

        const gridPos = pixelToGrid(wp.x, wp.y);
        const x = clamp(gridPos.x, 0, currentGrid.width - 1);
        const y = clamp(gridPos.y, 0, currentGrid.height - 1);

        const pos = { x, y };

        // Звук клика по клетке (bigplan.md, пункт 16).
        playSfx('click');

        selectTile(pos);
        
        // Auto-select building when clicking on deposit (if no building selected)
        if (!currentGrid.selectedBuildId && currentGrid.deposits) {
          const key = `${x},${y}`;
          const depositType = currentGrid.deposits[key];
          if (depositType) {
            // Find the first building that requires this deposit
            const matchingBuilding = s.buildings.find(b => {
              const requiredDeposit = (() => {
                if (b.id === 'miner_mk1') return 'ore';
                if (b.id === 'ice_extractor_mk1') return 'ice';
                if (b.id === 'carbon_harvester_mk1') return 'carbon';
                if (b.id === 'gas_well_mk1') return 'natural_gas';
                if (b.id === 'oil_well_mk1') return 'oil';
                if (b.id === 'sand_quarry_mk1') return 'sand';
                if (b.id === 'uranium_mine_mk1') return 'uranium';
                if (b.id === 'chrome_mine_mk1') return 'chrome';
                if (b.id === 'titanium_mine_mk1') return 'titanium';
                if (b.id === 'copper_mine_mk1') return 'copper';
                return null;
              })();
              return requiredDeposit === depositType;
            });
            
            if (matchingBuilding) {
              selectBuild(matchingBuilding.id);
              return; // Don't try to place building immediately
            }
          }
        }

        if (currentGrid.selectedBuildId) {
          // Найдем здание по ID
          const building = s.buildings.find(b => b.id === currentGrid.selectedBuildId);
          if (!building) {
            placeSelectedBuildAt(pos);
            return;
          }

          // Проверяем правила близости (на платформах пропускаем проверку энергопокрытия)
          const isOnPlatform = !!s.galaxies.activePlatformId;
          const check = checkBuildingPlacement(x, y, building, s.buildings, currentGrid.tiles, isOnPlatform);
          
          // Если нет предупреждений или качество хорошее - строим сразу
          if (check.warnings.length === 0 || 
              (check.quality === 'optimal' || check.quality === 'good')) {
            placeSelectedBuildAt(pos);
          } else {
            // Показываем модальное окно с предупреждениями
            setPendingPlacement({ x, y, buildingId: currentGrid.selectedBuildId });
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

        /*
         * Alt+drag — рамка выделения. Alt, а не просто drag: левое перетаскивание уже занято
         * панорамированием (viewport.md), и отбирать его нельзя. Shift дополняет выделение.
         */
        if ((e as any).button === 0 && e.altKey) {
          const wp = screenToWorld(sx, sy);
          boxRef.current.active = true;
          boxRef.current.additive = e.shiftKey;
          boxRef.current.startWorldX = wp.x;
          boxRef.current.startWorldY = wp.y;
          boxRef.current.curWorldX = wp.x;
          boxRef.current.curWorldY = wp.y;
          panRef.current.candidate = false;
          panRef.current.active = false;
          useUiStore.getState().setBoxSelecting(true);
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
        // Завершение рамки выделения: считаем попавшие клетки и кладём в UI-стор.
        if (boxRef.current.active) {
          boxRef.current.active = false;
          (app.canvas as any).releasePointerCapture?.(e.pointerId);
          useUiStore.getState().setBoxSelecting(false);

          const keys = tilesInBox();
          const ui = useUiStore.getState();
          if (boxRef.current.additive) ui.addSelectedTiles(keys);
          else ui.setSelectedTiles(keys);
          return;
        }

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

          /*
           * Shift+клик — добавить/убрать одну клетку в выделении, не трогая режим постройки.
           * Обычный клик по карте при непустом выделении его сбрасывает: иначе выделение
           * «залипает» и следующее массовое действие сработает не по тем клеткам.
           */
          if (e.shiftKey) {
            const wp = screenToWorld(sx, sy);
            const gp = pixelToGrid(wp.x, wp.y);
            const s = useGameStore.getState();
            const g = s.galaxies.activePlatformId
              ? s.galaxies.platforms.find((p) => p.id === s.galaxies.activePlatformId)?.grid || s.grid
              : s.grid;
            const gx = clamp(gp.x, 0, g.width - 1);
            const gy = clamp(gp.y, 0, g.height - 1);
            const key = `${gx},${gy}`;
            // Пустую клетку выделять нечего — массовые действия работают по зданиям.
            if (g.tiles[key]) useUiStore.getState().toggleSelectedTile(key);
            return;
          }

          if (useUiStore.getState().selectedTiles.length > 0) {
            useUiStore.getState().clearSelectedTiles();
          }

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

        // Протяжка рамки: только обновляем ref, отрисовка идёт в тикере Pixi.
        if (boxRef.current.active) {
          const wp = screenToWorld(sx, sy);
          boxRef.current.curWorldX = wp.x;
          boxRef.current.curWorldY = wp.y;
          return;
        }

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

      // Подписка на событие перехода к базе
      const unsubscribeGoToBase = gameEvents.on(GAME_EVENTS.GO_TO_BASE, () => {
        const cam = camRef.current;
        const r = app.renderer;
        const vw = r.width;
        const vh = r.height;
        const currentGrid = useGameStore.getState().grid;
        
        // Вычисляем позицию базы в пиксельных координатах
        const basePos = getBasePos(currentGrid);
        const basePixel = gridToPixel(basePos.x, basePos.y);
        
        // Центрируем камеру на базе
        const baseCenterX = basePixel.px + CELL / 2;
        const baseCenterY = basePixel.py + CELL / 2;
        
        // Устанавливаем удобный zoom
        cam.zoom = clamp(1.2, ZOOM_MIN, ZOOM_MAX);
        
        // Позиционируем камеру так чтобы база была в центре экрана
        cam.x = vw / 2 - baseCenterX * cam.zoom;
        cam.y = vh / 2 - baseCenterY * cam.zoom;
        cam.interacted = true;
        
        updateCameraClampRef.current?.();
        saveCameraThrottled(cam.x, cam.y, cam.zoom);
      });

      // Добавляем отписку в cleanup
      const originalCleanup = cleanupRef.current;
      cleanupRef.current = () => {
        originalCleanup?.();
        unsubscribeGoToBase();
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
    g.rect(0, 0, worldSize.w, worldSize.h).fill({ color: THEME_COLORS.cyberDark, alpha: 1.0 });

    // Draw hexagon helper
    const drawHexagon = (g: PIXI.Graphics, cx: number, cy: number, radius: number) => {
      const points: number[] = [];
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 6; // Start from flat top
        points.push(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
      }
      g.poly(points);
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

    // ПУЛ ИКОНОК: спрайты из набора GameIcon, растеризованные один раз.
    const iconPool = iconPoolRef.current;
    let iconPoolIndex = 0;

    /**
     * Возвращает спрайт с иконкой по её ключу (эмодзи из данных здания).
     * null, если текстура ещё не растеризована — кадром позже она появится.
     */
    const getIconFromPool = (icon: string, size: number): PIXI.Sprite | null => {
      const texture = getIconTexture(icon);
      if (!texture) return null;
      let sp: PIXI.Sprite;
      if (iconPoolIndex < iconPool.length) {
        sp = iconPool[iconPoolIndex];
        sp.texture = texture;
        sp.visible = true;
        if (textLayer && sp.parent !== textLayer) textLayer.addChild(sp);
      } else {
        sp = new PIXI.Sprite(texture);
        iconPool.push(sp);
        if (textLayer) textLayer.addChild(sp);
      }
      sp.anchor.set(0.5, 0.5);
      sp.width = size;
      sp.height = size;
      sp.alpha = 1;
      // Textures rasterise white so the tint is the only thing colouring them;
      // the default is the map foreground, matching the reference's buildings.
      sp.tint = THEME_COLORS.cyberText;
      sp.rotation = 0;
      iconPoolIndex++;
      return sp;
    };

    // Cells - рисуем только видимые
    const basePos = getBasePos(grid);

    // OPTIMIZATION: Prepare styles outside loop to avoid repeated object access 
    const isSquare = currentGridMode === 'square';
    const isHex = currentGridMode === 'hex';
    const cellHalf = CELL / 2;

    // Low zoom optimization flags
    const isZoomVeryLow = cam.zoom < 0.5;
    const buildingAlphaBoost = isZoomVeryLow ? 0.5 : 0.35;
    const lowZoomStrokeAlpha = 0.9;
    
    // Кэшируем цвета чтобы не обращаться к THEME_COLORS в цикле
    const COLOR_BASE_FILL = THEME_COLORS.cyberGreen;
    const COLOR_HIGHLIGHT_FILL = THEME_COLORS.cyberYellow;
    const COLOR_BUILDING_FILL = THEME_COLORS.cyberBlue;
    const COLOR_DEFAULT_FILL = THEME_COLORS.cyberDark;
    
    // Отдельной COLOR_BASE_STROKE нет: у базы обводка совпадает с обычной (cyberGray).
    const COLOR_HIGHLIGHT_STROKE = THEME_COLORS.cyberYellow;
    const COLOR_BUILDING_STROKE = THEME_COLORS.cyberBlue;
    const COLOR_DEFAULT_STROKE = THEME_COLORS.cyberGray;

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const k = `${x},${y}`;
        // Access directly for speed (avoid Boolean wrap if possible in hot loop)
        const buildingId = grid.tiles[k];
        const hasBuilding = !!buildingId;
        const { px, py } = gridToPixel(x, y);

        const isBase = x === basePos.x && y === basePos.y;
        
        // THEME_COLORS объявлен `as const`, поэтому без аннотации fill/strokeColor
        // сузились бы до литерала значения по умолчанию и любая перекраска ниже не типилась бы.
        let fill: number = COLOR_DEFAULT_FILL;
        let alpha = 0.4;
        let strokeColor: number = COLOR_DEFAULT_STROKE;
        let strokeAlpha = 0.6;
        let strokeWidth = 1;

        if (isBase) {
             fill = COLOR_BASE_FILL;
             alpha = 0.3;
        } else if (hasBuilding) {
             const isHighlighted = grid.highlightedBuildingId && buildingId === grid.highlightedBuildingId;
             if (isHighlighted) {
                 fill = COLOR_HIGHLIGHT_FILL;
                 alpha = 0.6;
                 strokeColor = COLOR_HIGHLIGHT_STROKE;
                 strokeAlpha = 1.0;
                 strokeWidth = 3;
             } else {
                 fill = COLOR_BUILDING_FILL;
                 alpha = buildingAlphaBoost;
                 if (isZoomVeryLow) {
                     strokeColor = COLOR_BUILDING_STROKE;
                     strokeAlpha = lowZoomStrokeAlpha;
                     strokeWidth = 2;
                 }
             }
        }
        
        // Draw Fill
        if (isHex) {
          drawHexagon(g, px, py, HEX_SIZE);
          g.fill({ color: fill, alpha });
        } else {
          g.roundRect(px, py, CELL, CELL, 2).fill({ color: fill, alpha });
        }

        // Draw Stroke (Conditional)
        const shouldDrawStroke = showText || (hasBuilding && isZoomVeryLow);
        if (shouldDrawStroke) {
           const finalAlpha = strokeAlpha * (showText ? 0.5 : 1);
           if (isHex) {
             drawHexagon(g, px, py, HEX_SIZE);
             g.stroke({ color: strokeColor, width: strokeWidth, alpha: finalAlpha });
           } else {
             g.roundRect(px, py, CELL, CELL, 2).stroke({ color: strokeColor, width: strokeWidth, alpha: finalAlpha });
           }
        }

        // --- OPTIMIZATION: Merged Power Overlay & Warnings ---
        if (showText && cam.zoom > 0.5) {
             const isPowered = poweredTiles.has(k);
             
             // 1. Green overlay for powered tiles
             if (isPowered) {
                  // Only draw if square for now for optimization
                  if (typeof g.rect === 'function') { 
                      g.rect(px, py, CELL, CELL).fill({ color: THEME_COLORS.cyberGreen, alpha: 0.08 });
                  }
             }
             
             // 2. Logic for buildings (Source icons, Warnings)
             if (hasBuilding) {
                  const bRef = buildingsById[buildingId];
                  if (bRef) {
                      const isSource = bRef.powerGridRadius && bRef.powerGridRadius > 0;
                      
                      // Source Icon (Lightning)
                      if (isSource && showDetailedText && textLayer) {
                          const centerX = isHex ? px : px + cellHalf;
                          const centerY = isHex ? py : py + cellHalf;
                          const powerIcon = getIconFromPool('⚡', 18);
                          if (powerIcon) {
                            powerIcon.x = centerX;
                            powerIcon.y = centerY - CELL / 4;
                            powerIcon.alpha = 0.75;
                          }
                      }
                      
                      // Warning Frame (Red) - Unpowered
                      if (!isSource && !isPowered) {
                           const pulse = (Math.sin(Date.now() / 500) * 0.2) + 0.6;
                           if (isSquare) {
                               g.roundRect(px + 2, py + 2, CELL - 4, CELL - 4, 2)
                                .stroke({ color: THEME_COLORS.cyberRed, width: 2, alpha: pulse });
                           }
                           
                           // Warning Icon
                           if (showDetailedText && textLayer) {
                               const warningIcon = getIconFromPool('⚠', 14);
                               if (warningIcon) {
                                 warningIcon.x = px + 11;
                                 warningIcon.y = py + 11;
                               }
                            }
                      }
                  }
             }
        }


        if (textLayer && showText) {
          if (isBase) {
            const centerX = isHex ? px : px + cellHalf;
            const centerY = isHex ? py : py + cellHalf;
            const t = getIconFromPool('🏠', isHex ? HEX_SIZE : CELL * 0.62);
            if (t) {
              t.x = centerX;
              t.y = centerY;
            }
          } else if (hasBuilding) {
            const evolutionLevel = grid.tileEvolutionLevels?.[k] || 0;
            // Optimization: Only compute if needed
            const currentEvolution = evolutionLevel > 0 ? getCurrentEvolution(buildingId, evolutionLevel) : null;
            
            // Используем visualUpgrade emoji если есть эволюция, иначе базовую эмодзи здания
            const emoji = currentEvolution?.visualUpgrade || getBuildingEmoji(buildingId);
            
            // Проверяем, отключено ли здание вручную
            const isDisabled = grid.tileDisabled?.[k] || false;

            /*
             * Стройка/улучшение в процессе (bigplan.md, пункты 18–19). Здание уже стоит на
             * клетке и оплачено, но не работает — показываем это явно, иначе игрок решит,
             * что постройка сломалась.
             */
            const job = grid.tileJobs?.[k];

            const centerX = currentGridMode === 'hex' ? px : px + CELL / 2;
            const centerY = currentGridMode === 'hex' ? py : py + CELL / 2;
            const t = getIconFromPool(emoji, currentGridMode === 'hex' ? HEX_SIZE : CELL * 0.6);
            if (t) {
              t.x = centerX;
              t.y = centerY - (isDisabled ? 6 : 0);
              // Отключённое здание гасим и красим в красный, как раньше делал стиль текста.
              if (isDisabled) {
                t.tint = THEME_COLORS.cyberRed;
                t.alpha = 0.7;
              }
              // Недостроенное — полупрозрачное: видно, что это ещё «стройка», а не здание.
              if (job) {
                t.alpha = 0.45;
              }
            }

            if (job) {
              // Дуга заполнения по прогрессу: считается от абсолютного времени, поэтому
              // не «замирает», если вкладка была свёрнута.
              const progress = jobProgress(job, Date.now());
              const radius = currentGridMode === 'hex' ? HEX_SIZE * 0.78 : CELL / 2 - 3;
              const startAngle = -Math.PI / 2;
              const endAngle = startAngle + Math.PI * 2 * progress;
              const color = job.kind === 'build' ? THEME_COLORS.cyberBlue : THEME_COLORS.cyberYellow;

              // Фоновое кольцо
              g.moveTo(centerX + radius, centerY);
              g.arc(centerX, centerY, radius, 0, Math.PI * 2)
                .stroke({ color, width: 1, alpha: 0.2 });

              if (progress > 0) {
                g.moveTo(
                  centerX + Math.cos(startAngle) * radius,
                  centerY + Math.sin(startAngle) * radius,
                );
                g.arc(centerX, centerY, radius, startAngle, endAngle)
                  .stroke({ color, width: 2.5, alpha: 0.95 });
              }
            }

            // КРУГОВОЙ ИНДИКАТОР ЗАГРУЗКИ для работающих зданий
            // Здание работает если не отключено вручную и не находится в стройке
            if (!isDisabled && !job && showDetailedText) {
              const bRef = buildingsById[buildingId];
              // Показываем индикатор только для зданий с производством или потреблением
              if (bRef && (bRef.production || bRef.consumption)) {
                const time = Date.now() / 1000;
                const rotationSpeed = 0.1; // Полный оборот за 10 секунд (медленнее)
                const startAngle = (time * rotationSpeed * Math.PI * 2) % (Math.PI * 2);
                const arcLength = Math.PI * 0.5; // Длина дуги (90 градусов)
                const endAngle = startAngle + arcLength;
                
                const indicatorRadius = currentGridMode === 'hex' ? HEX_SIZE * 0.7 : CELL / 2 - 4;
                const cx = centerX;
                const cy = centerY;
                
                // Рисуем вращающуюся дугу вокруг иконки здания (начинаем новый путь для каждой дуги)
                // Основная дуга - более тусклый цвет
                const mainStartX = cx + Math.cos(startAngle) * indicatorRadius;
                const mainStartY = cy + Math.sin(startAngle) * indicatorRadius;
                g.moveTo(mainStartX, mainStartY);
                g.arc(cx, cy, indicatorRadius, startAngle, endAngle)
                  .stroke({ color: THEME_COLORS.cyberGreen, width: 1.5, alpha: 0.35 });
                
                // Дополнительная полупрозрачная дуга для эффекта "хвоста"
                const tailAngle = startAngle - arcLength * 0.5;
                const tailStartX = cx + Math.cos(tailAngle) * indicatorRadius;
                const tailStartY = cy + Math.sin(tailAngle) * indicatorRadius;
                g.moveTo(tailStartX, tailStartY);
                g.arc(cx, cy, indicatorRadius, tailAngle, startAngle)
                  .stroke({ color: THEME_COLORS.cyberGreen, width: 1.5, alpha: 0.15 });
              }
            }
            
            // Добавляем звездочку для эволюционированных зданий
            if (evolutionLevel > 0 && showDetailedText) {
              const star = getIconFromPool('⭐', 13);
              if (star) {
                star.x = centerX + (currentGridMode === 'hex' ? 12 : 18);
                star.y = centerY - 8;
              }
            }

            // Иконка паузы когда здание отключено
            if (isDisabled && showDetailedText) {
              const pauseIcon = getIconFromPool('⏸️', 13);
              if (pauseIcon) {
                pauseIcon.x = centerX - (currentGridMode === 'hex' ? 10 : 15);
                pauseIcon.y = centerY - 6;
              }
            }
          } else {
            // Показываем месторождения только при детальном зуме (>0.7) чтобы не нагружать при отдалении
            const dep = grid.deposits?.[k];
            if (dep && showDetailedText) {
              const centerX = currentGridMode === 'hex' ? px : px + CELL / 2;
              const centerY = currentGridMode === 'hex' ? py : py + CELL / 2;
              const t = getIconFromPool(getDepositEmoji(dep), currentGridMode === 'hex' ? HEX_SIZE * 0.8 : CELL * 0.5);
              if (t) {
                t.alpha = 0.5;
                t.x = centerX;
                t.y = centerY;
              }
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

    // То же для пула иконок.
    for (let i = iconPoolIndex; i < iconPool.length; i++) {
      if (iconPool[i].visible) {
        iconPool[i].visible = false;
      }
    }



    // ФАЗА 8.3: ВИЗУАЛИЗАЦИЯ ЛОГИСТИЧЕСКОЙ СЕТИ
    // Отображаем зоны покрытия логистики (склады и логистические центры)
    if (showText && cam.zoom > 0.6) {
      // Use memoized list
      const logisticsHubs = activeLogisticsHubs;
      
      // OPTIMIZATION: Grid Painting approach to avoid overdraw
      const coveredTiles = new Set<string>();

      // Рисуем зоны покрытия логистической сети
      for (const { x: cx, y: cy, radius } of logisticsHubs) {
        
        // Рисуем только видимые клетки для оптимизации
        const rangeMinX = Math.max(minX, cx - radius);
        const rangeMaxX = Math.min(maxX, cx + radius);
        const rangeMinY = Math.max(minY, cy - radius);
        const rangeMaxY = Math.min(maxY, cy + radius);
        
        // Если источник не пересекает видимую область - пропускаем
        if (rangeMinX > rangeMaxX || rangeMinY > rangeMaxY) continue;

        // Заполняем Set
        for (let x = rangeMinX; x <= rangeMaxX; x++) {
          for (let y = rangeMinY; y <= rangeMaxY; y++) {
             const dist = Math.abs(x - cx) + Math.abs(y - cy);
             if (dist <= radius) {
                coveredTiles.add(`${x},${y}`);
             }
          }
        }

        /*
        // Рисуем контур радиуса логистики (lines are cheap)
        const centerPixel = gridToPixel(cx, cy);
        const centerX = centerPixel.px + CELL / 2;
        const centerY = centerPixel.py + CELL / 2;
        
        g.setStrokeStyle({ color: THEME_COLORS.cyberBlue, width: 1.5, alpha: 0.25 })
         .moveTo(centerX, centerY - radius * (CELL + GAP))
         .lineTo(centerX + radius * (CELL + GAP), centerY)
         .lineTo(centerX, centerY + radius * (CELL + GAP))
         .lineTo(centerX - radius * (CELL + GAP), centerY)
         .closePath()
         .stroke();
         */

        // Иконка логистического узла
        const centerPixel = gridToPixel(cx, cy);
        const centerX = centerPixel.px + CELL / 2;
        const centerY = centerPixel.py + CELL / 2;

        if (showDetailedText && textLayer) {
          const logisticsIcon = getIconFromPool('📦', 18);
          if (logisticsIcon) {
            logisticsIcon.x = centerX;
            logisticsIcon.y = centerY - CELL / 4;
            logisticsIcon.alpha = 0.75;
          }
        }
      }
      
      // Batch draw active logistics tiles
      for (const key of coveredTiles) {
         const [x, y] = key.split(',').map(Number);
         const { px, py } = gridToPixel(x, y);
         g.rect(px, py, CELL, CELL).fill({ color: THEME_COLORS.cyberBlue, alpha: 0.06 });
      }

      // Подсвечиваем здания с логистическим штрафом оранжевой рамкой
      // ВАЖНО: Добывающие здания (привязаны к месторождениям) НЕ получают штраф
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const k = `${x},${y}`;
          const buildingId = grid.tiles[k];
          if (!buildingId) continue;

          const building = buildingsById[buildingId];
          if (!building) continue;

          // Пропускаем логистические узлы
          if (building.logisticsRadius && building.logisticsRadius > 0) continue;

          // Проверяем логистическую эффективность (передаём buildingId для добывающих зданий)
          const logisticsEfficiency = calculateLogisticsEfficiency(
            { x, y },
            basePos,
            activeLogisticsHubs,
            buildingId // ID здания для проверки добывающих
          );
          
          if (logisticsEfficiency < 1.0 && showDetailedText) {
            const { px, py } = gridToPixel(x, y);
            const penalty = Math.round((1 - logisticsEfficiency) * 100);
            
            // Оранжевая рамка для зданий с штрафом
            g.roundRect(px + 1, py + 1, CELL - 2, CELL - 2, 2)
             .stroke({ color: THEME_COLORS.cyberYellow, width: 1.5, alpha: 0.5 });

            // Текст со штрафом
            if (textLayer) {
              const penaltyText = getTextFromPool(`-${penalty}%`, TEXT_STYLES.missing);
              penaltyText.anchor.set(1, 0);
              penaltyText.x = px + CELL - 4;
              penaltyText.y = py + 4;
              penaltyText.style.fill = THEME_COLORS.cyberYellow;
            }
          }
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
      if (isHex) {
        drawHexagon(g, selPos.px, selPos.py, HEX_SIZE + 2);
        g.stroke({ color: THEME_COLORS.cyberGreen, width: 2.5, alpha: 0.9 });
      } else {
        g.roundRect(selPos.px - 1, selPos.py - 1, CELL + 2, CELL + 2, 6).stroke({ color: THEME_COLORS.cyberGreen, width: 2, alpha: 0.9 });
      }
    }

    /*
     * Массовое выделение (bigplan.md, пункты 10 и 28). Рисуем ПОСЛЕ одиночного выделения,
     * чтобы жёлтая рамка выделенных клеток была видна поверх зелёной рамки активной клетки.
     */
    if (selectedTiles.length > 0) {
      for (const key of selectedTiles) {
        const comma = key.indexOf(',');
        const gx = Number(key.slice(0, comma));
        const gy = Number(key.slice(comma + 1));
        if (!Number.isFinite(gx) || !Number.isFinite(gy)) continue;

        const p = gridToPixel(gx, gy);
        if (isHex) {
          drawHexagon(g, p.px, p.py, HEX_SIZE + 1);
          g.stroke({ color: THEME_COLORS.cyberYellow, width: 2, alpha: 0.95 });
        } else {
          g.roundRect(p.px - 1, p.py - 1, CELL + 2, CELL + 2, 6)
            .fill({ color: THEME_COLORS.cyberYellow, alpha: 0.12 })
            .stroke({ color: THEME_COLORS.cyberYellow, width: 2, alpha: 0.95 });
        }
      }
    }
  }, [
      grid.tiles,
      grid.deposits,
      grid.selected,
      grid.buffers,
      grid.width,
      grid.height,
      grid.tileDisabled,
      // Дуга прогресса стройки должна появляться и исчезать сразу, не дожидаясь смены буферов.
      grid.tileJobs,
      // Подсветка выделенных клеток должна появляться сразу после протяжки рамки.
      selectedTiles,
      combat.enemies.length,
      worldSize,
      buildingsById,
      // Added new dependencies from top-level useMemo
      allBuildingsWithCoords,
      activeLogisticsHubs,
      powerSources,
      currentGridMode
  ]);

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

    // Use platform grid if on platform, otherwise main grid
    const isOnPlatform = !!state.galaxies.activePlatformId;
    const activePlatformData = state.galaxies.activePlatformId
      ? state.galaxies.platforms.find(p => p.id === state.galaxies.activePlatformId)
      : null;
    const currentTiles = activePlatformData?.grid.tiles || state.grid.tiles;

    // Skip power check on platforms
    const check = checkBuildingPlacement(
      pendingPlacement.x,
      pendingPlacement.y,
      building,
      state.buildings,
      currentTiles,
      isOnPlatform
    );

    return {
      building,
      check,
    };
  }, [pendingPlacement]);

  // Реактивно получаем данные активной платформы для UI
  const activePlatform = useGameStore((s) => 
    s.galaxies.activePlatformId 
      ? s.galaxies.platforms.find(p => p.id === s.galaxies.activePlatformId) 
      : null
  );

  return (
    <div className="h-full w-full relative" style={{ background: hexToCss(THEME_COLORS.cyberBlack) }}>
      <div ref={containerRef} className="w-full h-full" />
      
      {/* Platform indicator */}
      {activePlatform && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10">
          <div className="glass rounded-md border border-info/30 px-4 py-2 shadow-elev-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl"><GameIcon icon="🛰️" /></span>
              <div>
                <div className="text-sm font-bold text-white">{activePlatform.name}</div>
                <div className="text-xs text-cyan-300">Управление платформой</div>
              </div>
              <button
                onClick={() => useGameStore.getState().setActivePlatform(null)}
                className="ml-2 bg-cyan-600 hover:bg-cyan-700 text-white text-xs px-3 py-1 rounded transition-all"
              >
                <GameIcon icon="←" /> На базу
              </button>
            </div>
          </div>
        </div>
      )}
      
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
