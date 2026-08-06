/**
 * Запуск карты и геометрия сетки (bigplan.md, пункты 21, 31).
 *
 * ЗАЧЕМ ЭТОТ ФАЙЛ
 * Гексагональную сетку нельзя было увидеть в игре вообще. Не потому, что рендер не умел её
 * рисовать, а потому что до hex-карт нельзя было дойти: startMap проверял массив
 * maps.unlockedMaps, а тот пополняется единственным местом (completeMap), которое ниоткуда
 * не вызывается. Массив навсегда оставался стартовой парой КВАДРАТНЫХ карт, все четыре
 * гексагональные закрыты требованиями — и «Начать игру» на доступной карте не делало ничего.
 *
 * Здесь проверяется правило запуска и то, что вместе с картой переключается геометрия, по
 * которой считается соседство: разойтись им — значит рисовать соты, а играть по квадратам.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { useGameStore } from './gameStore';
import { MAP_DEFINITIONS, getMapDefinition } from '../core/constants/maps';
import { getActiveGridGeometry, setActiveGridGeometry } from '../core/math/hexGeometry';

/** Первая гексагональная карта в списке: она закрыта требованием технологии. */
const HEX_MAP = MAP_DEFINITIONS.find((m) => m.gridType === 'hex')!;
const SQUARE_MAP = MAP_DEFINITIONS.find((m) => m.gridType === 'square')!;

beforeEach(() => {
  useGameStore.getState().resetGame();
  setActiveGridGeometry('square');
});

/** Выполняет требование карты — ровно то, что показывает доступность на экране выбора. */
function satisfyRequirement(mapId: string) {
  const map = getMapDefinition(mapId)!;
  const req = map.unlockRequirement;

  if (req.type === 'technology' && req.technologyId) {
    useGameStore.setState((s) => ({
      research: {
        ...s.research,
        technologies: { ...s.research.technologies, [req.technologyId!]: true },
      },
    }));
  } else if (req.type === 'ascension') {
    useGameStore.setState((s) => ({
      ascension: { ...s.ascension, ascensionCount: req.ascensionLevel ?? 0 },
    }));
  } else if (req.type === 'playtime') {
    useGameStore.setState((s) => ({
      stats: { ...s.stats, totalPlayTime: (req.playtimeHours ?? 0) * 3600 },
    }));
  }
}

describe('startMap и разблокировка', () => {
  it('карта, требование которой выполнено, ЗАПУСКАЕТСЯ', () => {
    // Регрессия: раньше здесь ничего не происходило — карта не значилась в unlockedMaps.
    expect(useGameStore.getState().maps.unlockedMaps).not.toContain(HEX_MAP.id);

    satisfyRequirement(HEX_MAP.id);
    useGameStore.getState().startMap(HEX_MAP.id as any);

    const { maps, grid } = useGameStore.getState();
    expect(maps.currentMapId).toBe(HEX_MAP.id);
    expect(maps.activeMapData?.mapId).toBe(HEX_MAP.id);
    expect(grid.width).toBe(HEX_MAP.gridDimensions.width);
    expect(grid.height).toBe(HEX_MAP.gridDimensions.height);
  });

  it('карта с невыполненным требованием не запускается', () => {
    const before = useGameStore.getState().maps.currentMapId;
    useGameStore.getState().startMap(HEX_MAP.id as any);
    expect(useGameStore.getState().maps.currentMapId).toBe(before);
  });

  it('запущенная карта попадает в unlockedMaps — две системы сходятся', () => {
    satisfyRequirement(HEX_MAP.id);
    useGameStore.getState().startMap(HEX_MAP.id as any);
    expect(useGameStore.getState().maps.unlockedMaps).toContain(HEX_MAP.id);
  });
});

describe('геометрия следует за картой', () => {
  it('на hex-карте соседство считается по гексам, на квадратной — по квадратам', () => {
    satisfyRequirement(HEX_MAP.id);
    useGameStore.getState().startMap(HEX_MAP.id as any);
    expect(getActiveGridGeometry()).toBe('hex');

    useGameStore.getState().startMap(SQUARE_MAP.id as any);
    expect(getActiveGridGeometry()).toBe('square');
  });

  it('в игре есть и гексагональные, и квадратные карты', () => {
    // Если однажды все карты станут квадратными, гексагональный рендер станет мёртвым кодом,
    // и лучше узнать об этом здесь, чем спустя месяц.
    expect(MAP_DEFINITIONS.some((m) => m.gridType === 'hex')).toBe(true);
    expect(MAP_DEFINITIONS.some((m) => m.gridType === 'square')).toBe(true);
  });
});
