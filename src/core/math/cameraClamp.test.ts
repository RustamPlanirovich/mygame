import { describe, it, expect } from 'vitest';
import { clampCamera, KEEP_VISIBLE_PX } from './cameraClamp';

const VIEWPORT = { w: 1200, h: 800 };

/** Сколько пикселей мира реально попало в кадр по оси. */
const overlap = (pos: number, viewport: number, world: number) =>
  Math.min(pos + world, viewport) - Math.max(pos, 0);

describe('clampCamera', () => {
  it('не трогает камеру внутри допустимого диапазона', () => {
    const world = { w: 3000, h: 2000 };
    expect(clampCamera(-500, -300, VIEWPORT, world)).toEqual({ x: -500, y: -300 });
  });

  it('сетка мельче вьюпорта — камера НЕ центрируется, смещение сохраняется', () => {
    // Главный регресс: раньше при отдалении координаты перезаписывались центром и
    // перетаскивание не работало вообще.
    const world = { w: 400, h: 300 };
    expect(clampCamera(50, 20, VIEWPORT, world)).toEqual({ x: 50, y: 20 });
    expect(clampCamera(900, 600, VIEWPORT, world)).toEqual({ x: 900, y: 600 });
  });

  it('сетка крупнее вьюпорта — край можно отвести от края экрана', () => {
    // Раньше maxX был 0: левый край сетки прилипал к левому краю экрана.
    const world = { w: 3000, h: 2000 };
    expect(clampCamera(500, 400, VIEWPORT, world)).toEqual({ x: 500, y: 400 });
  });

  it('уехать из кадра целиком нельзя: остаётся KEEP_VISIBLE_PX с любой стороны', () => {
    const world = { w: 3000, h: 2000 };

    const far = clampCamera(99999, 99999, VIEWPORT, world);
    expect(far.x).toBe(VIEWPORT.w - KEEP_VISIBLE_PX);
    expect(far.y).toBe(VIEWPORT.h - KEEP_VISIBLE_PX);
    expect(overlap(far.x, VIEWPORT.w, world.w)).toBe(KEEP_VISIBLE_PX);

    const near = clampCamera(-99999, -99999, VIEWPORT, world);
    expect(near.x).toBe(KEEP_VISIBLE_PX - world.w);
    expect(near.y).toBe(KEEP_VISIBLE_PX - world.h);
    expect(overlap(near.x, VIEWPORT.w, world.w)).toBe(KEEP_VISIBLE_PX);
  });

  it('сетка меньше KEEP_VISIBLE_PX — диапазон не выворачивается наизнанку', () => {
    // min > max дал бы прыжок камеры; требуемое пересечение обрезается по размеру сетки.
    const world = { w: 20, h: 10 };

    const far = clampCamera(5000, 5000, VIEWPORT, world);
    expect(far.x).toBe(VIEWPORT.w - world.w);
    expect(far.y).toBe(VIEWPORT.h - world.h);
    expect(overlap(far.x, VIEWPORT.w, world.w)).toBe(world.w);

    const near = clampCamera(-5000, -5000, VIEWPORT, world);
    expect(near.x).toBe(0);
    expect(near.y).toBe(0);
    expect(overlap(near.x, VIEWPORT.w, world.w)).toBe(world.w);
  });

  it('вьюпорт нулевой (панель ещё не смерена) — конечные числа, а не NaN', () => {
    const r = clampCamera(10, 10, { w: 0, h: 0 }, { w: 3000, h: 2000 });
    expect(Number.isFinite(r.x)).toBe(true);
    expect(Number.isFinite(r.y)).toBe(true);
  });
});
