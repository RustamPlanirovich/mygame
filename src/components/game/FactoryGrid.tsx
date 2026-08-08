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
import { PlatformBanner } from './PlatformBanner';
import { checkBuildingPlacement } from '../../hooks/useProximityWarnings';
// Радиусы разворачиваются в poweredTiles/activeLogisticsHubs один раз в useMemo ниже,
// поэтому пер-тайловые isInRadius / isBuildingPowered / isInLogisticsZone здесь не нужны.
import { getPowerSources } from '../../utils/powerGridHelpers';
import { calculateLogisticsEfficiency } from '../../utils/logisticsHelpers';
import { getCurrentEvolution } from '../../core/constants/buildingEvolutions';
import { jobProgress } from '../../core/systems/construction';
import { playSfx } from '../../core/audio/sfx';
import { setActiveGridGeometry, gridDistance } from '../../core/math/hexGeometry';
import {
  CELL,
  GAP,
  HEX_SIZE,
  cellCenterIn,
  cellStepIn,
  hexPolygonPoints,
  pixelToCellIn,
  worldSizeIn,
} from '../../core/math/hexLayout';
import { clampCamera } from '../../core/math/cameraClamp';
import {
  depositRatio,
  isDepositExhausted,
  isTileRuined,
  requiredDepositForBuilding,
} from '../../core/systems/deposits';
import {
  BASE_SHIELD_ID,
  BASE_TURRET_ID,
  computeBaseDefenseStatus,
  countBaseDefense,
} from '../../core/systems/baseDefenseStatus';
import { gameEvents, GAME_EVENTS } from '../../utils/gameEvents';
import { getIconTexture, preloadIconTextures } from '../ui/icons/pixiIcon';

// Grid display mode - динамический, берётся из текущей карты.
// ВАЖНО: схема карт (core/gameTypes.maps.ts -> GridType) допускает ТОЛЬКО 'square' | 'hex',
// и ни одна из карт в core/constants/maps.ts не объявляет ничего другого.
// Раньше здесь был третий режим 'isometric': недостижимая ветка, которую TypeScript
// и помечал ошибкой TS2367 на сравнении `currentGridMode === 'isometric'`.
// Мёртвый режим удалён — тип теперь честно совпадает с тем, что реально бывает в данных.
type GridMode = GridType;

const ZOOM_MIN = 0.3;
const ZOOM_MAX = 4.0;

const DRAG_THRESHOLD_PX = 4;

/*
 * Трещины на здании, под которым выработалась жила (bigplan 38). Имя Material-иконки, а не
 * эмодзи: в наборе игры нет эмодзи с трещинами, зато `broken_image` — это ровно расколотая
 * плита, и она читается на клетке даже 24 пикселями.
 */
const RUIN_ICON = 'broken_image';

/*
 * Стабильная «пустая карта уровней» для селектора. Литерал `|| {}` каждый раз возвращал бы НОВЫЙ
 * объект, сравнение по ссылке в компараторе ниже всегда давало бы «изменилось», и сетка
 * перерисовывалась бы на каждый тик — а у свежесозданной платформы tileLevels ещё нет.
 */
const EMPTY_TILE_LEVELS: Record<string, number> = {};

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
  /*
   * Уровень здания в правом нижнем углу клетки. Два стиля вместо перекраски одного:
   * `style.fill = …` мутирует ОБЩИЙ объект стиля и дёргает 'update' у всех текстов на нём
   * (так уже сделано со штрафом логистики), а бейдж уровня рисуется у каждого здания сразу.
   * Первый уровень — приглушённый белый, улучшенное здание — зелёный, как «Ур. N» в инспекторе:
   * так апгрейды видны по карте, без клика по каждой клетке.
   */
  level: new PIXI.TextStyle({
    fill: THEME_COLORS.cyberText,
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Arial, sans-serif',
  }),
  levelUpgraded: new PIXI.TextStyle({
    fill: THEME_COLORS.cyberGreen,
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Arial, sans-serif',
  }),
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

// ─── Конвертеры координат ──────────────────────────────────────────────────
// Сама математика раскладки живёт в core/math/hexLayout.ts: её проверяют тесты, и она обратна
// offset <-> cube из hexGeometry.ts, по которым считается соседство. Здесь остаются только
// обёртки, читающие АКТУАЛЬНЫЙ режим сетки в момент вызова.

export function FactoryGrid() {
  // Получаем тип сетки из текущей карты
  const currentMapId = useGameStore((s) => s.maps.currentMapId);
  const currentGridMode: GridMode = useMemo(() => {
    if (!currentMapId) return 'square';
    const mapDef = getMapDefinition(currentMapId);
    return mapDef?.gridType ?? 'square';
  }, [currentMapId]);
  // На мирных картах волн не бывает — боевую индикацию там рисовать не по чему (bigplan 39).
  const isPeacefulMap = useMemo(() => {
    if (!currentMapId) return false;
    return getMapDefinition(currentMapId)?.modifiers?.includes('peaceful') ?? false;
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
      // Остатки жил (bigplan 38): по ним рисуются трещины и выцветание выработанных клеток.
      depositReserves: activeGrid.depositReserves,
      selected: activeGrid.selected,
      selectedBuildId: activeGrid.selectedBuildId,
      highlightedBuildingId: (mainGrid as any).highlightedBuildingId,
      buffers: activeGrid.buffers,
      tileEvolutionLevels: (mainGrid as any).tileEvolutionLevels || {},
      tileDisabled: (mainGrid as any).tileDisabled || {},
      // Незавершённые стройки/улучшения: берём из АКТИВНОЙ сетки — на платформе своя очередь.
      tileJobs: (activeGrid as any).tileJobs || {},
      /*
       * Уровни зданий (Фаза 8.5) — из АКТИВНОЙ сетки: у платформы свои уровни
       * (см. upgradeBuildingAt), и уровни главной базы на её клетках означали бы чужие числа.
       */
      tileLevels: (activeGrid as any).tileLevels || EMPTY_TILE_LEVELS,
      width: activeGrid.width,
      height: activeGrid.height,
    };
  }, (a, b) => {
    // Shallow compare для оптимизации
    return a.tiles === b.tiles &&
           a.deposits === b.deposits &&
           a.depositReserves === b.depositReserves &&
           a.selected === b.selected &&
           a.selectedBuildId === b.selectedBuildId &&
           a.highlightedBuildingId === b.highlightedBuildingId &&
           a.buffers === b.buffers &&
           a.tileEvolutionLevels === b.tileEvolutionLevels &&
           a.tileDisabled === b.tileDisabled &&
           a.tileJobs === b.tileJobs &&
           a.tileLevels === b.tileLevels &&
           a.width === b.width &&
           a.height === b.height;
  });
  const combat = useGameStore((s) => s.combat);
  const buildings = useGameStore((s) => s.buildings);
  /*
   * Турели и щиты считаются по клеткам ГЛАВНОЙ сетки, а не по счётчику каталога: тот растёт
   * и от построек на орбитальных платформах (см. baseDefenseStatus.countBaseDefense).
   * Подписки раздельные, а не одна на countBaseDefense: селектор возвращал бы новый массив
   * при каждом изменении стора и перерисовывал бы всю сетку 20 раз в секунду.
   */
  const baseTiles = useGameStore((s) => s.grid.tiles);
  const baseTileDisabled = useGameStore((s) => s.grid.tileDisabled);
  const baseTileJobs = useGameStore((s) => s.grid.tileJobs);
  const baseDefenseCounts = useMemo(
    () => countBaseDefense(baseTiles, baseTileDisabled, baseTileJobs),
    [baseTiles, baseTileDisabled, baseTileJobs],
  );
  /*
   * Боевая индикация (bigplan 39) относится к ГЛАВНОЙ базе: state.combat описывает только её,
   * у платформ бой считается отдельно (galaxies.platforms[].combat). Когда открыта платформа,
   * подсветку турелей и щитов гасим — иначе она врала бы про чужую сетку.
   */
  const activePlatformId = useGameStore((s) => s.galaxies.activePlatformId);
  /*
   * Ключ перерисовки на время боя.
   *
   * Пульсация рамок и бегущие дуги прицела живут только за счёт того, что сцена
   * перерисовывается каждым тиком. Но подписать эффект прямо на объект `combat` нельзя: тик
   * пересобирает его 20 раз в секунду ВСЕГДА, и спокойная база начала бы перерисовывать всю
   * сетку без единой причины. Поэтому ключ меняется только пока идёт тревога, а в тишине это
   * стабильный ноль — ровно одна перерисовка на завершении волны, чтобы погасить индикаторы.
   */
  const combatRedrawKey = useMemo(() => {
    const now = Date.now();
    const alarm = combat.baseHp.gt(0) && (combat.enemies.length > 0 || combat.waveEndsAt > now);
    return alarm ? now : 0;
  }, [combat]);
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
  /*
   * Слой бейджей поверх слоя иконок: уровень здания рисуется в правом нижнем углу клетки, а
   * иконка занимает почти всю клетку. Внутри одного контейнера порядок вывода — это порядок
   * добавления детей, то есть порядок СОЗДАНИЯ объектов пула, и слоты пула достаются разным
   * клеткам по мере движения камеры: цифра то оказывалась бы над иконкой, то под ней.
   */
  const badgeLayerRef = useRef<PIXI.Container | null>(null);
  // Подложки бейджей: одна Graphics на всю сетку, первый ребёнок слоя — всегда под цифрами.
  const badgeGfxRef = useRef<PIXI.Graphics | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const initializedRef = useRef(false);

  // ПУЛ ТЕКСТОВЫХ ОБЪЕКТОВ - храним между кадрами
  const textPoolRef = useRef<PIXI.Text[]>([]);
  // Иконки на канвасе — спрайты из общего набора, тоже пулятся между кадрами
  const iconPoolRef = useRef<PIXI.Sprite[]>([]);
  // Отдельный пул для бейджей уровня: они живут в своём слое (см. badgeLayerRef).
  const badgePoolRef = useRef<PIXI.Text[]>([]);

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
      // Трещины на здании с выработанной жилой (bigplan 38).
      RUIN_ICON,
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
   * Стор ставит геометрию в startMap и при загрузке сейва, но разойтись они могут незаметно:
   * игрок видит гексы, а бонусы соседства считаются по квадратам. Здесь мы синхронизируем её
   * с тем же значением, по которому реально рисуется сетка, — рассогласование становится
   * невозможным.
   */
  useEffect(() => {
    setActiveGridGeometry(currentGridMode === 'hex' ? 'hex' : 'square');
  }, [currentGridMode]);

  // ЦЕНТР клетки в мировых пикселях — в обеих геометриях. Всё, что рисуется на клетке
  // (иконка, дуга, рамка), позиционируется от центра; прямоугольник квадратной клетки
  // смещается на половину стороны там, где рисуется.
  const cellCenter = (x: number, y: number) => cellCenterIn(gridModeRef.current, x, y);

  // Convert pixel coordinates to grid coordinates based on the CURRENT mode
  const pixelToGrid = (px: number, py: number) => pixelToCellIn(gridModeRef.current, px, py);

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

    /*
     * Покрытие считается ТЕМ ЖЕ правилом, что и в powerGridHelpers.isInRadius: расстояние
     * в шагах по геометрии карты. Здесь стоял манхэттен (|dx| + |dy| <= radius), из-за чего
     * подсветка была ромбом и не совпадала с клетками, которые реально получают энергию.
     * Геометрия берётся из режима сетки явным аргументом, а не из модульного состояния:
     * этот useMemo считается во время рендера, а setActiveGridGeometry отрабатывает в эффекте
     * ПОСЛЕ него — на первом кадре после смены карты значение было бы от предыдущей карты.
     */
    for (const { building, radius } of sources) {
       if (!building.coord) continue;
       const { x: cx, y: cy } = building.coord;

       // Клетка в N шагах не может отличаться по столбцу или строке больше чем на N —
       // в обеих геометриях. Поэтому квадрат (2N+1)² надёжно накрывает область поиска.
       for (let dy = -radius; dy <= radius; dy++) {
         const y = cy + dy;
         for (let dx = -radius; dx <= radius; dx++) {
            const x = cx + dx;
            if (gridDistance(currentGridMode, cx, cy, x, y) <= radius) {
                poweredSet.add(`${x},${y}`);
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
  }, [grid.tiles, buildingsById, currentGridMode]);

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

      // Бейджи уровня — своим слоем над иконками, см. badgeLayerRef.
      const badgeLayer = new PIXI.Container();
      badgeLayerRef.current = badgeLayer;
      world.addChild(badgeLayer);

      const badgeGfx = new PIXI.Graphics();
      badgeGfxRef.current = badgeGfx;
      badgeLayer.addChild(badgeGfx);

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
          const { px, py } = cellCenter(gx, gy);

          if (px >= minX && px <= maxX && py >= minY && py <= maxY) out.push(key);
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
          // На выработанной жиле подсказывать шахту незачем: поставить её туда нельзя.
          if (depositType && !isDepositExhausted(currentGrid.depositReserves, key)) {
            // Find the first building that requires this deposit
            const matchingBuilding = s.buildings.find(
              (b) => requiredDepositForBuilding(b.id) === depositType,
            );

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

      /*
       * Свободное панорамирование: камера прижимается не к краям сетки, а только к правилу
       * «сетка не уезжает из кадра целиком» — вся математика и разбор прежнего поведения
       * лежат в core/math/cameraClamp.ts (там же тесты).
       */
      const updateCameraClamp = () => {
        const cam = camRef.current;
        const r = app.renderer;

        const ws = worldSizeRef.current;
        const next = clampCamera(
          cam.x,
          cam.y,
          { w: r.width, h: r.height },
          { w: ws.w * cam.zoom, h: ws.h * cam.zoom },
        );
        cam.x = next.x;
        cam.y = next.y;

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
        const { px: baseCenterX, py: baseCenterY } = cellCenter(basePos.x, basePos.y);

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
        const { px: baseCenterX, py: baseCenterY } = cellCenter(basePos.x, basePos.y);

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
      badgeLayerRef.current = null;
      badgeGfxRef.current = null;
      worldRef.current = null;
      /*
       * Пулы обнуляем вместе со сценой: app.destroy(children) уже уничтожил сами объекты, и
       * попытка переиспользовать их после пересоздания канваса (StrictMode, смена карты)
       * кончилась бы addChild уничтоженного текста.
       */
      textPoolRef.current = [];
      iconPoolRef.current = [];
      badgePoolRef.current = [];
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
    const badgeLayer = badgeLayerRef.current;
    const badgeGfx = badgeGfxRef.current;
    if (!app || !g) return;

    // Apply camera transform
    const world = worldRef.current;
    if (world) {
      world.position.set(camRef.current.x, camRef.current.y);
      world.scale.set(camRef.current.zoom);
    }

    g.clear();
    badgeGfx?.clear();

    // НЕ удаляем детей - пул текстов управляется через visible

    const isHex = currentGridMode === 'hex';

    // Grid background - темнее, как в Industry Idle
    g.rect(0, 0, worldSize.w, worldSize.h).fill({ color: THEME_COLORS.cyberDark, alpha: 1.0 });

    /*
     * Контур клетки текущей геометрии вокруг её центра. Единственное место, где форма клетки
     * превращается в путь: раньше каждый вызывающий сам решал, гекс это или прямоугольник, и
     * половина мест (подсветка энергосети, зона логистики, рамка штрафа) знала только про
     * прямоугольник — на hex-картах поверх сот рисовались квадраты 48×48.
     *
     * `inset` — насколько контур ужать внутрь клетки (для рамок поверх заливки),
     * `corner` — скругление углов квадратной клетки (у гекса углов нет).
     */
    const traceCell = (g: PIXI.Graphics, cx: number, cy: number, inset = 0, corner = 2) => {
      if (isHex) {
        g.poly(hexPolygonPoints(cx, cy, HEX_SIZE - inset));
      } else {
        const half = CELL / 2 - inset;
        g.roundRect(cx - half, cy - half, half * 2, half * 2, corner);
      }
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
    
    // Диапазон видимых клеток с запасом +10 клеток для оптимизации.
    // Шаг сетки зависит от геометрии: у гексов столбцы стоят плотнее строк, и по квадратному
    // шагу правый край карты обрезался бы (столбцов в тех же пикселях больше).
    const { colStep, rowStep } = cellStepIn(currentGridMode);
    const bufferCells = 10; // Запас клеток для плавного рендеринга
    const minX = Math.max(0, Math.floor(worldLeft / colStep) - bufferCells);
    const maxX = Math.min(grid.width - 1, Math.ceil(worldRight / colStep) + bufferCells);
    const minY = Math.max(0, Math.floor(worldTop / rowStep) - bufferCells);
    const maxY = Math.min(grid.height - 1, Math.ceil(worldBottom / rowStep) + bufferCells);
    
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
        /*
         * Стиль присваиваем ТОЛЬКО при смене: сеттер `style` в pixi 8 всегда вызывает
         * onViewUpdate(), то есть помечает текст грязным и заставляет пересчитать его текстуру.
         * Пока в пуле было два-три текста, это не замечалось, но бейдж уровня есть у каждого
         * здания, а сетка перерисовывается до 20 раз в секунду.
         */
        if (t.style !== style) t.style = style;
        t.visible = true;
        // Прозрачность сбрасываем: слот мог достаться от вызывающего, который её приглушал.
        t.alpha = 1;
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

    /*
     * ПУЛ БЕЙДЖЕЙ УРОВНЯ. Отдельный от textPool, потому что живёт в другом слое (badgeLayer),
     * и заодно не делит слоты со штрафом логистики: тот двигает anchor и перекрашивает стиль.
     */
    const badgePool = badgePoolRef.current;
    let badgePoolIndex = 0;

    const getBadgeFromPool = (text: string, style: PIXI.TextStyle): PIXI.Text | null => {
      if (!badgeLayer) return null;
      let t: PIXI.Text;
      if (badgePoolIndex < badgePool.length) {
        t = badgePool[badgePoolIndex];
        t.text = text;
        // Стиль — только при смене: сеттер в pixi 8 всегда помечает текст грязным.
        if (t.style !== style) t.style = style;
        t.visible = true;
        if (t.parent !== badgeLayer) badgeLayer.addChild(t);
      } else {
        t = new PIXI.Text({ text, style });
        // Правый нижний угол клетки: привязка ставится один раз, все бейджи её не меняют.
        t.anchor.set(1, 1);
        badgePool.push(t);
        badgeLayer.addChild(t);
      }
      badgePoolIndex++;
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
    // Радиус, в который вписана иконка клетки: у гекса он меньше стороны квадрата.
    const iconSpan = isHex ? HEX_SIZE : CELL;

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

    /*
     * БОЕВАЯ ИНДИКАЦИЯ (bigplan 39).
     *
     * До этого волна выглядела так: где-то по краю карты ползут точки-враги, база молча теряет
     * HP, а турели и щиты на сетке ничем не отличаются от обычных зданий. Понять, работает ли
     * оборона вообще, можно было только открыв раздел «Оборона».
     *
     * Состояние считаем ОДИН раз до цикла по клеткам: источник у него общий на всю сетку
     * (`state.combat`), а Decimal-арифметика на каждой клетке при 20 Гц — лишняя работа.
     * Правила («что считается беззащитной базой») живут в core/systems/baseDefenseStatus.ts,
     * чтобы карта и плашка тревоги не разошлись в трактовке.
     */
    const nowMs = Date.now();
    const defense = computeBaseDefenseStatus(combat, baseDefenseCounts, nowMs, isPeacefulMap);
    // На платформе рисуется чужая сетка, а combat описывает только главную базу.
    const defenseAlarm = defense.alarm && !activePlatformId;
    const shieldRatio = defense.shieldRatio;
    const baseTakingDamage = defense.takingDamage;
    // Общий пульс тревоги: одна фаза на все индикаторы, иначе рамки мигают вразнобой и рябят.
    const alarmPulse = defenseAlarm ? 0.55 + Math.sin(nowMs / 220) * 0.35 : 0;

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const k = `${x},${y}`;
        // Access directly for speed (avoid Boolean wrap if possible in hot loop)
        const buildingId = grid.tiles[k];
        const hasBuilding = !!buildingId;
        // px, py — ЦЕНТР клетки в обеих геометриях.
        const { px, py } = cellCenter(x, y);

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
        traceCell(g, px, py);
        g.fill({ color: fill, alpha });

        // Draw Stroke (Conditional)
        const shouldDrawStroke = showText || (hasBuilding && isZoomVeryLow);
        if (shouldDrawStroke) {
           const finalAlpha = strokeAlpha * (showText ? 0.5 : 1);
           traceCell(g, px, py);
           g.stroke({ color: strokeColor, width: strokeWidth, alpha: finalAlpha });
        }

        // --- OPTIMIZATION: Merged Power Overlay & Warnings ---
        if (showText && cam.zoom > 0.5) {
             const isPowered = poweredTiles.has(k);
             
             // 1. Green overlay for powered tiles
             if (isPowered) {
                  traceCell(g, px, py);
                  g.fill({ color: THEME_COLORS.cyberGreen, alpha: 0.08 });
             }

             // 2. Logic for buildings (Source icons, Warnings)
             if (hasBuilding) {
                  const bRef = buildingsById[buildingId];
                  if (bRef) {
                      const isSource = bRef.powerGridRadius && bRef.powerGridRadius > 0;

                      // Source Icon (Lightning)
                      if (isSource && showDetailedText && textLayer) {
                          const powerIcon = getIconFromPool('⚡', 18);
                          if (powerIcon) {
                            powerIcon.x = px;
                            powerIcon.y = py - iconSpan / 4;
                            powerIcon.alpha = 0.75;
                          }
                      }

                      // Warning Frame (Red) - Unpowered
                      if (!isSource && !isPowered) {
                           const pulse = (Math.sin(Date.now() / 500) * 0.2) + 0.6;
                           traceCell(g, px, py, 2);
                           g.stroke({ color: THEME_COLORS.cyberRed, width: 2, alpha: pulse });

                           // Warning Icon — в левом верхнем углу клетки, но внутри её формы.
                           if (showDetailedText && textLayer) {
                               const warningIcon = getIconFromPool('⚠', 14);
                               if (warningIcon) {
                                 warningIcon.x = px - iconSpan / 4;
                                 warningIcon.y = py - iconSpan / 4;
                               }
                            }
                      }
                  }
             }
        }


        if (textLayer && showText) {
          if (isBase) {
            const t = getIconFromPool('🏠', isHex ? HEX_SIZE : CELL * 0.62);
            if (t) {
              t.x = px;
              t.y = py;
              /*
               * Красный дом + пульсирующая рамка, пока по базе действительно идёт урон
               * (bigplan 39). Раньше единственным следом попадания была просевшая полоса HP
               * в разделе «Оборона» — на карте не менялось вообще ничего.
               */
              if (defenseAlarm && baseTakingDamage) {
                t.tint = THEME_COLORS.cyberRed;
              }
            }

            if (defenseAlarm) {
              const color = baseTakingDamage ? THEME_COLORS.cyberRed : THEME_COLORS.cyberYellow;
              traceCell(g, px, py, -2, 6);
              g.stroke({
                color,
                width: baseTakingDamage ? 3.5 : 2,
                alpha: 0.4 + alarmPulse * 0.55,
              });
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

            /*
             * Здание на выработанной жиле РАЗРУШЕНО (bigplan 38): оно ничего не добывает и
             * годится только на снос. Гасим иконку и кладём поверх трещины — иначе вставшая
             * шахта выглядит точно так же, как работающая, и игрок ищет причину в энергосети.
             */
            const isRuined = isTileRuined(
              requiredDepositForBuilding(buildingId),
              grid.depositReserves,
              k,
            );

            const centerX = px;
            const centerY = py;
            const t = getIconFromPool(emoji, isHex ? HEX_SIZE : CELL * 0.6);
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
              if (isRuined) {
                t.tint = THEME_COLORS.cyberGray;
                t.alpha = 0.35;
              }
            }

            if (isRuined) {
              // Рамка руины и трещины поверх иконки. Пульсации нет намеренно: это не авария,
              // требующая реакции сейчас, а состояние — оно должно быть заметным, но спокойным.
              traceCell(g, px, py, 2);
              g.stroke({ color: THEME_COLORS.cyberRed, width: 2, alpha: 0.55 });

              if (showDetailedText) {
                const crack = getIconFromPool(RUIN_ICON, isHex ? HEX_SIZE * 0.9 : CELL * 0.55);
                if (crack) {
                  crack.x = centerX;
                  crack.y = centerY;
                  crack.tint = THEME_COLORS.cyberRed;
                  crack.alpha = 0.85;
                }
              }
            }

            /*
             * ТУРЕЛИ И ЩИТЫ ВО ВРЕМЯ АТАКИ (bigplan 39).
             *
             * Рисуем только пока идёт волна и только у построенных и включённых сооружений:
             * недостроенная турель и турель на паузе в бою не участвуют, и подсветка на них
             * означала бы обратное. Индикатор различает ТРИ состояния, потому что игроку нужно
             * разное действие в каждом: работает (ничего), нет энергии (чинить энергосеть),
             * щит пробит (уходить в оборону/чинить базу).
             */
            if (defenseAlarm && !isDisabled && !job && !isRuined) {
              /*
               * Радиус больше, чем у зелёного «кольца загрузки» (0.7): у турели и щита
               * `production: {}` — пустой, но truthy, поэтому кольцо загрузки им тоже рисуется.
               * Разводим их по радиусам, иначе две дуги идут по одному следу и сливаются.
               */
              const ringRadius = isHex ? HEX_SIZE * 0.85 : CELL / 2 - 1;

              if (buildingId === BASE_TURRET_ID) {
                /*
                 * Красный цвет оставлен ровно на один случай — «энергии на залп не хватило».
                 * Турель, у которой просто ещё нет целей (между спавнами карта пустеет),
                 * красной быть не должна: это не авария, и лечить её нечем.
                 */
                const color = defense.turretsStarved ? THEME_COLORS.cyberRed : THEME_COLORS.cyberYellow;

                traceCell(g, px, py);
                g.fill({ color, alpha: 0.12 + alarmPulse * 0.12 });
                traceCell(g, px, py, 1);
                g.stroke({ color, width: 2.5, alpha: 0.45 + alarmPulse * 0.5 });

                if (defense.firing) {
                  /*
                   * Прицельная рамка: две дуги, бегущие по кругу навстречу друг другу. Именно
                   * ДВИЖЕНИЕ отличает стреляющую турель от просто подсвеченной клетки —
                   * статичную рамку глаз принимает за очередное предупреждение.
                   */
                  const spin = (nowMs / 320) % (Math.PI * 2);
                  const arc = Math.PI * 0.35;
                  for (const dir of [0, Math.PI]) {
                    const a0 = spin + dir;
                    g.moveTo(px + Math.cos(a0) * ringRadius, py + Math.sin(a0) * ringRadius);
                    g.arc(px, py, ringRadius, a0, a0 + arc)
                      .stroke({ color: THEME_COLORS.cyberYellow, width: 3, alpha: 0.95 });
                  }
                } else if (defense.turretsStarved && showDetailedText) {
                  // Молния = «цели есть, а стрелять нечем»: причина в энергосети, не в обороне.
                  const icon = getIconFromPool('⚡', 14);
                  if (icon) {
                    // Левый нижний угол: правый верхний уже занят звездой эволюции и
                    // процентом логистического штрафа, левый верхний — значком «нет питания».
                    icon.x = centerX - iconSpan / 4;
                    icon.y = centerY + iconSpan / 4;
                    icon.tint = THEME_COLORS.cyberRed;
                    icon.alpha = 0.9;
                  }
                }
              } else if (buildingId === BASE_SHIELD_ID) {
                const broken = shieldRatio <= 0;
                const color = broken ? THEME_COLORS.cyberRed : THEME_COLORS.cyberBlue;

                traceCell(g, px, py);
                g.fill({ color, alpha: 0.10 + alarmPulse * 0.10 });
                traceCell(g, px, py, 1);
                g.stroke({ color, width: 2, alpha: 0.4 + alarmPulse * 0.45 });

                if (!broken) {
                  /*
                   * Дуга по кругу клетки = ЗАРЯД щита базы. Щит один на всю базу, поэтому все
                   * модули показывают одно и то же число — так и задумано: это состояние базы,
                   * а не отдельного здания, и увидеть его нужно с любого края карты.
                   */
                  const start = -Math.PI / 2;
                  g.moveTo(px + Math.cos(start) * ringRadius, py + Math.sin(start) * ringRadius);
                  g.arc(px, py, ringRadius, start, start + Math.PI * 2 * shieldRatio)
                    .stroke({ color: THEME_COLORS.cyberBlue, width: 3, alpha: 0.95 });
                } else if (showDetailedText) {
                  const icon = getIconFromPool('⚠', 14);
                  if (icon) {
                    icon.x = centerX - iconSpan / 4;
                    icon.y = centerY + iconSpan / 4;
                    icon.tint = THEME_COLORS.cyberRed;
                    icon.alpha = 0.9;
                  }
                }
              }
            }

            if (job) {
              // Дуга заполнения по прогрессу: считается от абсолютного времени, поэтому
              // не «замирает», если вкладка была свёрнута.
              const progress = jobProgress(job, Date.now());
              const radius = isHex ? HEX_SIZE * 0.78 : CELL / 2 - 3;
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
                
                const indicatorRadius = isHex ? HEX_SIZE * 0.7 : CELL / 2 - 4;
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
                star.x = centerX + (isHex ? 12 : 18);
                star.y = centerY - 8;
              }
            }

            // Иконка паузы когда здание отключено
            if (isDisabled && showDetailedText) {
              const pauseIcon = getIconFromPool('⏸️', 13);
              if (pauseIcon) {
                pauseIcon.x = centerX - (isHex ? 10 : 15);
                pauseIcon.y = centerY - 6;
              }
            }

            /*
             * УРОВЕНЬ ЗДАНИЯ В ПРАВОМ НИЖНЕМ УГЛУ КЛЕТКИ.
             *
             * Уровень (Фаза 8.5) множит и производство, и потребление, но до этого его было
             * видно только в инспекторе одной выделенной клетки: по карте нельзя было понять,
             * где ряд шахт первого уровня, а где уже прокачанные. Показываем у ВСЕХ зданий,
             * включая первый уровень, — иначе пустой угол читается как «бейдж не нарисовался».
             *
             * Правый нижний угол — единственный свободный: сверху справа звезда эволюции и
             * процент логистического штрафа, сверху слева значок «нет питания», снизу слева
             * молния голодной турели.
             *
             * Тёмная подложка обязательна: цифра ложится на иконку здания, и без неё белое
             * на белом (например, на ⚙️ или 🏭) не читается. И подложка, и цифра идут в
             * badgeLayer — поверх слоя иконок, иначе непрозрачный угол иконки съедал бы бейдж.
             */
            if (showDetailedText && badgeGfx) {
              const level: number = grid.tileLevels?.[k] || 1;
              const label = String(level);

              // Правый нижний угол ВНУТРИ формы клетки: у гекса низ уже верхнего края,
              // поэтому бейдж прижимаем ближе к центру, иначе он вылезает за соту.
              const badgeRight = centerX + (isHex ? HEX_SIZE * 0.62 : CELL / 2 - 3);
              const badgeBottom = centerY + (isHex ? HEX_SIZE * 0.6 : CELL / 2 - 2);

              // Ширина по числу цифр: уровень доходит до 500, и на трёхзначном фиксированная
              // подложка обрезала бы цифру.
              const badgeW = 7 * label.length + 6;
              const badgeH = 13;
              // Приглушаем ровно так же, как саму иконку: у стройки, руины и паузы бейдж не
              // должен быть ярче здания, к которому он относится.
              const badgeAlpha = isRuined ? 0.4 : job ? 0.55 : isDisabled ? 0.7 : 1;

              badgeGfx.roundRect(badgeRight - badgeW, badgeBottom - badgeH, badgeW, badgeH, 3)
                .fill({ color: THEME_COLORS.cyberBlack, alpha: 0.75 * badgeAlpha });

              const levelText = getBadgeFromPool(
                label,
                level > 1 ? TEXT_STYLES.levelUpgraded : TEXT_STYLES.level,
              );
              if (levelText) {
                levelText.x = badgeRight - 3;
                // +1: у строки снизу остаётся место под выносные элементы, которых у цифр нет,
                // и без сдвига число смотрится приподнятым над подложкой.
                levelText.y = badgeBottom + 1;
                levelText.alpha = badgeAlpha;
              }
            }
          } else {
            // Показываем месторождения только при детальном зуме (>0.7) чтобы не нагружать при отдалении
            const dep = grid.deposits?.[k];
            if (dep && showDetailedText) {
              /*
               * Насыщенность иконки — это остаток жилы (bigplan 38). Полная жила видна как
               * раньше, выработанная показывается трещинами: на неё нельзя ставить шахту, и
               * узнать об этом до клика игрок должен по самой карте.
               */
              const exhausted = isDepositExhausted(grid.depositReserves, k);
              const left = depositRatio(grid.depositReserves, k);
              const t = getIconFromPool(
                exhausted ? RUIN_ICON : getDepositEmoji(dep),
                isHex ? HEX_SIZE * 0.8 : CELL * 0.5,
              );
              if (t) {
                t.alpha = exhausted ? 0.3 : 0.25 + left * 0.35;
                t.x = px;
                t.y = py;
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

    // То же для пула бейджей уровня.
    for (let i = badgePoolIndex; i < badgePool.length; i++) {
      if (badgePool[i].visible) {
        badgePool[i].visible = false;
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

        // Заполняем Set. Расстояние — в шагах по геометрии карты, тем же правилом, что и
        // в logisticsHelpers: раньше здесь стоял манхэттен, и нарисованная зона покрытия
        // не совпадала с той, по которой считается штраф.
        for (let x = rangeMinX; x <= rangeMaxX; x++) {
          for (let y = rangeMinY; y <= rangeMaxY; y++) {
             if (gridDistance(currentGridMode, cx, cy, x, y) <= radius) {
                coveredTiles.add(`${x},${y}`);
             }
          }
        }

        // Иконка логистического узла
        if (showDetailedText && textLayer) {
          const hubCenter = cellCenter(cx, cy);
          const logisticsIcon = getIconFromPool('📦', 18);
          if (logisticsIcon) {
            logisticsIcon.x = hubCenter.px;
            logisticsIcon.y = hubCenter.py - iconSpan / 4;
            logisticsIcon.alpha = 0.75;
          }
        }
      }
      
      // Batch draw active logistics tiles
      for (const key of coveredTiles) {
         const [x, y] = key.split(',').map(Number);
         const { px, py } = cellCenter(x, y);
         traceCell(g, px, py);
         g.fill({ color: THEME_COLORS.cyberBlue, alpha: 0.06 });
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
            const { px, py } = cellCenter(x, y);
            const penalty = Math.round((1 - logisticsEfficiency) * 100);

            // Оранжевая рамка для зданий с штрафом
            traceCell(g, px, py, 1);
            g.stroke({ color: THEME_COLORS.cyberYellow, width: 1.5, alpha: 0.5 });

            // Текст со штрафом — в правом верхнем углу клетки, внутри её формы.
            if (textLayer) {
              const penaltyText = getTextFromPool(`-${penalty}%`, TEXT_STYLES.missing);
              penaltyText.anchor.set(1, 0);
              penaltyText.x = px + iconSpan / 2 - 4;
              penaltyText.y = py - iconSpan / 2 + 4;
              penaltyText.style.fill = THEME_COLORS.cyberYellow;
            }
          }
        }
      }
    }



    // Base marker (target) - центр карты
    const baseMarkerPos = getBasePos(grid);
    const baseMarkerCenter = cellCenter(baseMarkerPos.x, baseMarkerPos.y);
    g.circle(baseMarkerCenter.px, baseMarkerCenter.py, 8).fill({ color: THEME_COLORS.cyberGreen, alpha: 0.8 });

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
      const baseLineY = cellCenter(baseLinePos.x, baseLinePos.y).py;
      g.moveTo(GAP, baseLineY).lineTo(worldSize.w - GAP, baseLineY).stroke({ color: THEME_COLORS.cyberGray, width: 1, alpha: 0.25 });
    }

    if (grid.selected) {
      const selPos = cellCenter(grid.selected.x, grid.selected.y);
      // Отрицательный inset — рамка чуть ШИРЕ клетки, чтобы не сливаться с её обводкой.
      traceCell(g, selPos.px, selPos.py, -2, 6);
      g.stroke({ color: THEME_COLORS.cyberGreen, width: isHex ? 2.5 : 2, alpha: 0.9 });
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

        const p = cellCenter(gx, gy);
        traceCell(g, p.px, p.py, -1, 6);
        g.fill({ color: THEME_COLORS.cyberYellow, alpha: 0.12 });
        g.stroke({ color: THEME_COLORS.cyberYellow, width: 2, alpha: 0.95 });
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
      // Бейдж уровня: после улучшения число должно смениться сразу, а не со следующим тиком.
      grid.tileLevels,
      // Подсветка выделенных клеток должна появляться сразу после протяжки рамки.
      selectedTiles,
      /*
       * Не сам combat, а ключ тревоги (bigplan 39): он меняется каждым тиком, пока идёт бой,
       * и замирает в тишине. Так пульсация обороны, заряд щита и краснота базы обновляются
       * покадрово во время волны, но спокойная база сетку не перерисовывает.
       */
      combatRedrawKey,
      combat.enemies.length,
      // Индикация обороны относится только к базе: на платформе её не рисуем.
      activePlatformId,
      // Число турелей и щитов на сетке базы — от него зависит, что показывать.
      baseDefenseCounts,
      isPeacefulMap,
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

  return (
    <div className="h-full w-full relative" style={{ background: hexToCss(THEME_COLORS.cyberBlack) }}>
      <div ref={containerRef} className="w-full h-full" />
      
      {/*
        Плашка платформы (имя, кнопка «На базу» и срок до разрушения) живёт отдельным
        компонентом: платформа пересобирается каждым тиком, и подписка на неё здесь
        перерисовывала бы всю сцену 20 раз в секунду.
      */}
      <PlatformBanner />

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
