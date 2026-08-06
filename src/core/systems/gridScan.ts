/**
 * СКАН СЕТКИ И ЭНЕРГОСЕТЬ — подсистема тика как чистая функция (bigplan.md, пункт 22).
 *
 * Один проход по клеткам, который тик делает в самом начале, чтобы дальше не искать
 * ничего линейно: кто где стоит, где источники энергии, где логистические хабы и какие
 * клетки запитаны.
 *
 * ЗАЧЕМ ВЫНОСИЛОСЬ. Внутри тика это было ~90 строк вперемешку с расчётом ёмкостей и
 * буферов, и в них жила СВОЯ, третья по счёту реализация «попадает ли клетка в радиус».
 * Она считала манхэттенское расстояние (`dx + dy`), тогда как
 * [powerGridHelpers](../../utils/powerGridHelpers.ts) и рисование сетки в FactoryGrid
 * ещё в прошлой итерации переведены на ШАГОВОЕ расстояние с учётом геометрии карты.
 *
 * Расхождение было не теоретическим. У генератора с радиусом 3 клетка (+2,+2) по шаговому
 * расстоянию отстоит на 2 — она подсвечена зелёным и игрок считает её запитанной; по
 * манхэттену это 4, то есть тик её НЕ запитывал, и здание молча не работало. На гексах
 * расхождение больше: там манхэттен по offset-координатам вообще не соответствует
 * соседству. Теперь метрика ровно одна — `activeGridDistance`, та же, что рисует сетку.
 *
 * ЗАЧЕМ SET<number>, А НЕ SET<string>. Ключ `y << 16 | x` — одно число вместо строки
 * `"x,y"`: заполнение идёт по всей площади радиусов на каждом тике, и строковые ключи
 * здесь заметны. Ограничение — координаты до 65535, что на порядки больше любой карты.
 */

import type { Building } from '../gameTypes';
import { activeGridDistance } from '../math/hexGeometry';

export interface GridScanInput {
  /** Клетки: `"x,y"` → id здания. */
  tiles: Record<string, string>;
  /** Каталог зданий по id — нужен для радиусов энергосети и логистики. */
  buildingsById: Map<string, Building>;
  /** Отключённые клетки (вручную + строящиеся): их радиусы не действуют. */
  tileDisabled: Record<string, boolean>;
  width: number;
  height: number;
}

export interface PowerSource {
  x: number;
  y: number;
  r: number;
}

export interface LogisticsHub {
  x: number;
  y: number;
  radius: number;
}

export interface GridScan {
  /** id здания → ключи клеток, где оно стоит. */
  tilesByBuildingId: Map<string, string[]>;
  activePowerSources: PowerSource[];
  activeLogisticsHubs: LogisticsHub[];
  /** Запитана ли клетка. O(1). */
  isPowered: (x: number, y: number) => boolean;
}

/** Разбор ключа клетки. Локальный, чтобы модуль не зависел от стора. */
function parseKey(key: string): { x: number; y: number } | null {
  const comma = key.indexOf(',');
  if (comma === -1) return null;
  const x = Number(key.slice(0, comma));
  const y = Number(key.slice(comma + 1));
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

const encode = (x: number, y: number) => (y << 16) | x;

/**
 * Построить карту запитанных клеток.
 *
 * Обходится ограничивающий прямоугольник каждого источника, а не вся сетка: на карте
 * 20×20 с тремя генераторами это десятки клеток вместо тысяч. По вертикали запас на
 * единицу больше — на гексах сдвиг нечётных столбцов утаскивает часть соседей на
 * полстроки вниз, и ровный прямоугольник ±r обрезал бы край зоны.
 */
function buildPowerMap(sources: readonly PowerSource[], width: number, height: number): Set<number> {
  const powered = new Set<number>();
  if (sources.length === 0) return powered;

  for (const src of sources) {
    const r = src.r;
    if (r <= 0) continue;

    const minX = Math.max(0, src.x - r);
    const maxX = Math.min(width - 1, src.x + r);
    const minY = Math.max(0, src.y - r - 1);
    const maxY = Math.min(height - 1, src.y + r + 1);

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const key = encode(x, y);
        if (powered.has(key)) continue;
        // Та же метрика, что рисует зону покрытия и что использует powerGridHelpers.
        if (activeGridDistance(src.x, src.y, x, y) <= r) powered.add(key);
      }
    }
  }

  return powered;
}

/**
 * Один проход по сетке: индекс клеток по зданиям, активные источники энергии и
 * логистические хабы, готовая карта покрытия.
 */
export function scanGrid(input: GridScanInput): GridScan {
  const { tiles, buildingsById, tileDisabled, width, height } = input;

  const tilesByBuildingId = new Map<string, string[]>();
  const activePowerSources: PowerSource[] = [];
  const activeLogisticsHubs: LogisticsHub[] = [];

  for (const key in tiles) {
    const id = tiles[key];

    let list = tilesByBuildingId.get(id);
    if (!list) {
      list = [];
      tilesByBuildingId.set(id, list);
    }
    list.push(key);

    const def = buildingsById.get(id);
    if (!def) continue;

    const hasPower = !!def.powerGridRadius && def.powerGridRadius > 0;
    const hasLogistics = !!def.logisticsRadius && def.logisticsRadius > 0;
    if (!hasPower && !hasLogistics) continue;

    // Отключённое (или ещё строящееся) здание не раздаёт ни энергию, ни логистику.
    if (tileDisabled[key]) continue;

    const pos = parseKey(key);
    if (!pos) continue;

    if (hasPower) activePowerSources.push({ x: pos.x, y: pos.y, r: def.powerGridRadius! });
    if (hasLogistics) activeLogisticsHubs.push({ x: pos.x, y: pos.y, radius: def.logisticsRadius! });
  }

  const powered = buildPowerMap(activePowerSources, width, height);

  return {
    tilesByBuildingId,
    activePowerSources,
    activeLogisticsHubs,
    isPowered: (x: number, y: number) => powered.has(encode(x, y)),
  };
}
