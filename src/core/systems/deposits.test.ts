import { describe, it, expect } from 'vitest';
import {
  DEFAULT_DEPOSIT_COVERAGE,
  EXTRACTABLE_DEPOSITS,
  RUIN_REFUND_MAX,
  RUIN_REFUND_MIN,
  STARTER_DEPOSITS,
  depositLeft,
  depositRatio,
  drainDeposit,
  ensureReserves,
  generateDepositField,
  isDepositExhausted,
  isTileRuined,
  rollReserve,
  rollRuinRefundRate,
  type DepositReserves,
} from './deposits';
import type { DepositType } from '../gameTypes';
import { gridDistance, gridNeighbors } from '../math/hexGeometry';

/** Детерминированный ГПСЧ: тесты про распределение не должны мигать через раз. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Ставки добытчиков первого уровня из каталога зданий. */
const RATES: Record<string, number> = {
  ore: 0.6,
  ice: 0.4,
  carbon: 0.3,
  natural_gas: 0.5,
  oil: 0.35,
  sand: 0.6,
  uranium: 0.18,
  chrome: 0.22,
  titanium: 0.2,
  copper: 0.25,
};
const rateOf = (d: DepositType) => RATES[d] ?? 0.3;

const field = (seed: number, over: Partial<Parameters<typeof generateDepositField>[0]> = {}) =>
  generateDepositField({
    width: 18,
    height: 18,
    base: { x: 9, y: 9 },
    geometry: 'hex',
    ratePerSecond: rateOf,
    rng: mulberry32(seed),
    ...over,
  });

describe('generateDepositField: сколько клеток занято', () => {
  it('держит покрытие около заданного, а не половину карты', () => {
    // Старый генератор бросал независимый шанс на каждую клетку, и сумма шансов давала
    // ~51% занятых клеток. Это ровно то, что чинится.
    for (const seed of [1, 7, 42, 1337]) {
      const { deposits } = field(seed);
      const share = Object.keys(deposits).length / (18 * 18);
      expect(share).toBeGreaterThan(DEFAULT_DEPOSIT_COVERAGE - 0.04);
      expect(share).toBeLessThan(DEFAULT_DEPOSIT_COVERAGE + 0.04);
    }
  });

  it('слушается coverage', () => {
    const sparse = field(3, { coverage: 0.05 });
    const dense = field(3, { coverage: 0.3 });
    expect(Object.keys(sparse.deposits).length).toBeLessThan(Object.keys(dense.deposits).length);
  });

  it('у каждой клетки есть запас, и он равен объявленному объёму', () => {
    const { deposits, reserves } = field(11);
    for (const key of Object.keys(deposits)) {
      expect(reserves[key]).toBeDefined();
      expect(depositLeft(reserves, key)).toBeGreaterThan(0);
      expect(depositRatio(reserves, key)).toBe(1);
    }
  });
});

describe('generateDepositField: как они разложены', () => {
  it('кладёт жилами, а не солью с перцем', () => {
    const { deposits } = field(5);
    const keys = Object.keys(deposits);
    const withSameNeighbour = keys.filter((key) => {
      const [x, y] = key.split(',').map(Number);
      return gridNeighbors('hex', x, y).some((n) => deposits[`${n.x},${n.y}`] === deposits[key]);
    });
    // При равномерном шуме с покрытием 14% соседа того же типа имело бы меньшинство клеток.
    expect(withSameNeighbour.length / keys.length).toBeGreaterThan(0.6);
  });

  it('не занимает базу и клетки вплотную к ней', () => {
    const { deposits } = field(9);
    for (const key of Object.keys(deposits)) {
      const [x, y] = key.split(',').map(Number);
      expect(gridDistance('hex', x, y, 9, 9)).toBeGreaterThanOrEqual(2);
    }
  });

  it('гарантирует стартовое сырьё рядом с базой', () => {
    for (const seed of [2, 13, 77, 512]) {
      const { deposits } = field(seed);
      for (const starter of STARTER_DEPOSITS) {
        const near = Object.entries(deposits).some(([key, type]) => {
          if (type !== starter) return false;
          const [x, y] = key.split(',').map(Number);
          return gridDistance('hex', x, y, 9, 9) <= 6;
        });
        expect(near, `${starter} рядом с базой, seed=${seed}`).toBe(true);
      }
    }
  });

  it('даёт хотя бы одну жилу каждому доступному типу', () => {
    const { deposits } = field(21);
    const present = new Set(Object.values(deposits));
    for (const type of EXTRACTABLE_DEPOSITS) {
      expect(present.has(type), `на карте есть ${type}`).toBe(true);
    }
  });

  it('редкие типы встречаются реже базовых', () => {
    // Суммируем по нескольким картам: на одной 18×18 разброс слишком велик для такого утверждения.
    const count: Record<string, number> = {};
    for (let seed = 0; seed < 12; seed++) {
      for (const type of Object.values(field(seed + 100).deposits)) {
        count[type] = (count[type] ?? 0) + 1;
      }
    }
    expect(count.ore).toBeGreaterThan(count.uranium);
    expect(count.ore).toBeGreaterThan(count.titanium);
    expect(count.ice).toBeGreaterThan(count.chrome);
  });

  it('уважает уже занятые клетки и границы области при расширении сетки', () => {
    const taken = new Set(['10,3', '11,3']);
    const { deposits } = generateDepositField({
      width: 20,
      height: 20,
      base: { x: 9, y: 9 },
      geometry: 'square',
      ratePerSecond: rateOf,
      rng: mulberry32(4),
      taken: (key) => taken.has(key),
      area: { x0: 18, y0: 0, x1: 20, y1: 20 },
    });
    for (const key of Object.keys(deposits)) {
      const [x] = key.split(',').map(Number);
      expect(x).toBeGreaterThanOrEqual(18);
      expect(taken.has(key)).toBe(false);
    }
  });

  it('не зацикливается, когда ставить некуда', () => {
    const { deposits } = generateDepositField({
      width: 6,
      height: 6,
      base: { x: 3, y: 3 },
      geometry: 'square',
      ratePerSecond: rateOf,
      rng: mulberry32(8),
      coverage: 0.9,
      taken: () => true,
    });
    expect(Object.keys(deposits)).toHaveLength(0);
  });
});

describe('rollReserve', () => {
  const half = () => 0.5;

  it('считает запас от ставки добычи: медленный ресурс не даёт «вечную» клетку', () => {
    const ore = rollReserve('ore', 0.6, half);
    const uranium = rollReserve('uranium', 0.18, half);
    // Часы у урана меньше, а ставка втрое ниже — значит и абсолютный запас заметно меньше.
    expect(ore).toBeGreaterThan(uranium);
    // Но по ВРЕМЕНИ жизни разрыв не в разы: в этом и смысл пересчёта через ставку.
    expect(ore / 0.6 / uranium / (1 / 0.18)).toBeLessThan(3);
  });

  it('масштабируется модификаторами богатства карты', () => {
    const normal = rollReserve('ore', 0.6, half);
    const rich = rollReserve('ore', 0.6, half, 1.5);
    const poor = rollReserve('ore', 0.6, half, 0.7);
    expect(rich).toBe(Math.round(normal * 1.5));
    expect(poor).toBe(Math.round(normal * 0.7));
  });

  it('никогда не рождает клетку сразу выработанной', () => {
    expect(rollReserve('ore', 0, half)).toBeGreaterThan(0);
    expect(rollReserve('ore', 0.6, half, 0)).toBeGreaterThan(0);
  });
});

describe('drainDeposit', () => {
  const make = (left: number, total = left): DepositReserves => ({
    '1,1': { left: String(left), total: String(total) },
  });

  it('списывает добытое', () => {
    const reserves = make(100);
    const { taken, exhausted } = drainDeposit(reserves, '1,1', 30);
    expect(taken).toBe(30);
    expect(exhausted).toBe(false);
    expect(depositLeft(reserves, '1,1')).toBe(70);
  });

  it('последний тик забирает остаток, а не уходит в минус', () => {
    const reserves = make(10);
    const { taken, exhausted } = drainDeposit(reserves, '1,1', 40);
    expect(taken).toBe(10);
    expect(exhausted).toBe(true);
    expect(depositLeft(reserves, '1,1')).toBe(0);
  });

  it('сообщает «кончилось» ровно один раз', () => {
    const reserves = make(5);
    expect(drainDeposit(reserves, '1,1', 5).exhausted).toBe(true);
    // Второй заход по той же клетке уже ничего не даёт и повторного уведомления не вызовет.
    const again = drainDeposit(reserves, '1,1', 5);
    expect(again.taken).toBe(0);
    expect(again.exhausted).toBe(false);
  });

  it('клетку без записи о запасе не режет: это старый сейв, а не пустая жила', () => {
    const reserves: DepositReserves = {};
    expect(drainDeposit(reserves, '2,2', 7).taken).toBe(7);
    expect(reserves['2,2']).toBeUndefined();
  });
});

describe('выработанность и разрушение', () => {
  it('выработанной считается только клетка с нулевым запасом', () => {
    const reserves: DepositReserves = {
      '0,0': { left: '0', total: '100' },
      '1,0': { left: '5', total: '100' },
    };
    expect(isDepositExhausted(reserves, '0,0')).toBe(true);
    expect(isDepositExhausted(reserves, '1,0')).toBe(false);
    // Клетка без записи — старый сейв: объявлять её выработанной нельзя.
    expect(isDepositExhausted(reserves, '9,9')).toBe(false);
  });

  it('разрушается только добывающее здание', () => {
    const reserves: DepositReserves = { '0,0': { left: '0', total: '100' } };
    expect(isTileRuined('ore', reserves, '0,0')).toBe(true);
    // Фабрике месторождение не нужно — выработанная жила под ней ничего не значит.
    expect(isTileRuined(null, reserves, '0,0')).toBe(false);
  });

  it('доля остатка считается от первоначального объёма', () => {
    const reserves: DepositReserves = { '0,0': { left: '25', total: '100' } };
    expect(depositRatio(reserves, '0,0')).toBe(0.25);
  });
});

describe('ensureReserves', () => {
  it('досоздаёт запасы для сейвов, сделанных до истощения', () => {
    const deposits: Record<string, DepositType> = { '1,1': 'ore', '2,2': 'ice' };
    const out = ensureReserves(deposits, undefined, rateOf, mulberry32(1));
    expect(Object.keys(out)).toHaveLength(2);
    expect(depositLeft(out, '1,1')).toBeGreaterThan(0);
    expect(depositRatio(out, '2,2')).toBe(1);
  });

  it('не трогает уже известные запасы', () => {
    const deposits: Record<string, DepositType> = { '1,1': 'ore', '2,2': 'ice' };
    const existing: DepositReserves = { '1,1': { left: '3', total: '100' } };
    const out = ensureReserves(deposits, existing, rateOf, mulberry32(1));
    expect(out['1,1']).toEqual({ left: '3', total: '100' });
    expect(depositLeft(out, '2,2')).toBeGreaterThan(0);
  });

  it('возвращает исходную ссылку, когда добавлять нечего', () => {
    const deposits: Record<string, DepositType> = { '1,1': 'ore' };
    const existing: DepositReserves = { '1,1': { left: '3', total: '100' } };
    expect(ensureReserves(deposits, existing, rateOf, mulberry32(1))).toBe(existing);
  });
});

describe('rollRuinRefundRate', () => {
  it('всегда попадает в объявленные 25–50%', () => {
    for (const roll of [0, 0.25, 0.5, 0.75, 1]) {
      const rate = rollRuinRefundRate(roll);
      expect(rate).toBeGreaterThanOrEqual(RUIN_REFUND_MIN);
      expect(rate).toBeLessThanOrEqual(RUIN_REFUND_MAX);
    }
    expect(rollRuinRefundRate(0)).toBe(RUIN_REFUND_MIN);
    expect(rollRuinRefundRate(1)).toBe(RUIN_REFUND_MAX);
  });
});
