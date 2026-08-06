/**
 * Размер сетки переживает перезагрузку страницы.
 *
 * ЧТО БЫЛО СЛОМАНО
 * Игрок жаловался: «после сохранения большой карты и перезагрузки видна не вся карта, а если
 * купить „Сектор: Расширение“ — карта открывается полностью, как должна быть».
 *
 * Причина — не в сохранении: и serializeGame, и оба загрузчика писали и читали grid.width
 * правильно. Сразу ПОСЛЕ восстановления loadGame/loadGameFromSave безусловно присваивали
 * сетке размеры карты (`width = mapDef.gridDimensions.width`). Но сетка законно растёт выше
 * размеров карты: buyUpgrade('sector_expansion') зовёт ensureGridSize на 18 + 2×уровень и на
 * карту не смотрит. Сохранённые 24×24 обрезались обратно до 16×16, а следующая покупка
 * исследования снова растила сетку до 18 + 2×уровень — отсюда и «исследование чинит карту».
 *
 * Здесь проверяется обе половины: что исследование действительно уводит сетку за размеры
 * карты (иначе тест ниже ничего не значит) и что синхронизация с картой её больше не режет.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { gridSizeForLoadedMap, useGameStore } from './gameStore';
import { MAP_DEFINITIONS, getMapDefinition } from '../core/constants/maps';

/** Стартовая квадратная карта: с неё начинается игра, на ней и ловился баг. */
const SQUARE_MAP = MAP_DEFINITIONS.find((m) => m.gridType === 'square')!;

beforeEach(() => {
  useGameStore.getState().resetGame();
});

describe('gridSizeForLoadedMap', () => {
  it('НЕ сжимает сетку, которая больше карты', () => {
    // Регрессия: ровно этот случай терял клетки после перезагрузки страницы.
    expect(gridSizeForLoadedMap({ width: 24, height: 24 }, { width: 16, height: 16 })).toEqual({
      width: 24,
      height: 24,
    });
  });

  it('расширяет сетку меньше карты до размеров карты', () => {
    // Ради этого синхронизация и существует: сейв со старой маленькой сеткой
    // должен получить всю площадь карты.
    expect(gridSizeForLoadedMap({ width: 12, height: 12 }, { width: 20, height: 20 })).toEqual({
      width: 20,
      height: 20,
    });
  });

  it('считает стороны независимо', () => {
    expect(gridSizeForLoadedMap({ width: 30, height: 10 }, { width: 16, height: 16 })).toEqual({
      width: 30,
      height: 16,
    });
  });

  it('совпадающие размеры оставляет как есть', () => {
    const same = gridSizeForLoadedMap({ width: 16, height: 16 }, { width: 16, height: 16 });
    expect(same).toEqual({ width: 16, height: 16 });
  });
});

describe('«Сектор: Расширение» и загрузка сейва', () => {
  /**
   * Кладёт в базовый буфер заведомо достаточно ресурсов на ОДНУ покупку.
   * Вызывать перед каждой: buyUpgrade в конце обрезает базовый буфер по вместимости
   * складов (clampBaseBufferToCaps), поэтому «залить один раз на всё» не работает.
   */
  const fundBase = () => {
    useGameStore.setState((s) => ({
      grid: {
        ...s.grid,
        buffers: {
          ...s.grid.buffers,
          base: { ...s.grid.buffers.base, energy: '1e12', steel: '1e12' },
        },
      },
    }));
  };

  it('исследование растит сетку ВЫШЕ размеров карты', () => {
    useGameStore.getState().startMap(SQUARE_MAP.id as never);
    const mapSize = getMapDefinition(SQUARE_MAP.id)!.gridDimensions;
    expect(useGameStore.getState().grid.width).toBe(mapSize.width);

    for (let i = 0; i < 3; i++) {
      fundBase();
      useGameStore.getState().buyUpgrade('sector_expansion');
    }

    const grown = useGameStore.getState().grid.width;
    expect(useGameStore.getState().research.levels.sector_expansion).toBe(3);
    // 18 (BASE_GRID_SIZE) + 2 за уровень — и это больше карты, иначе баг был бы незаметен.
    expect(grown).toBe(24);
    expect(grown).toBeGreaterThan(mapSize.width);
  });

  it('синхронизация с картой сохраняет выращенную сетку', () => {
    useGameStore.getState().startMap(SQUARE_MAP.id as never);
    for (let i = 0; i < 3; i++) {
      fundBase();
      useGameStore.getState().buyUpgrade('sector_expansion');
    }

    const grid = useGameStore.getState().grid;
    const mapSize = getMapDefinition(SQUARE_MAP.id)!.gridDimensions;

    // То, что делают loadGame и loadGameFromSave сразу после восстановления сейва.
    expect(gridSizeForLoadedMap(grid, mapSize)).toEqual({
      width: grid.width,
      height: grid.height,
    });
  });
});
