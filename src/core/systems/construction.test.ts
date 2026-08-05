/**
 * Время постройки и улучшения (bigplan.md, пункты 18–19).
 *
 * Главное, что тут закреплено: базовое здание строится «10–12 секунд», как и просили, время
 * растёт вместе со сложностью, но не уходит в минуты, а работы считаются по абсолютному
 * времени — чтобы стройка достраивалась после сворачивания вкладки и за оффлайн.
 */

import { describe, expect, it } from 'vitest';
import Decimal from 'break_eternity.js';
import type { Building } from '../gameTypes';
import {
  CONSTRUCTION_BALANCE,
  buildDurationSeconds,
  collectCompletedJobs,
  effectiveDisabledTiles,
  hasActiveJobs,
  isJobComplete,
  jobProgress,
  jobRemainingMs,
  learningMultiplier,
  upgradeDurationSeconds,
  type TileJob,
} from './construction';

const D = (v: number) => new Decimal(v);

function building(overrides: Partial<Building> = {}): Building {
  return {
    id: 'test',
    name: 'Тест',
    description: '',
    baseCost: { energy: D(100) },
    costFactor: 1.15,
    production: {},
    count: 0,
    ...overrides,
  } as Building;
}

/** Настоящее T1-здание из каталога: Авто-Майнер v1. */
const minerMk1 = building({
  id: 'miner_mk1',
  baseCost: { energy: D(100) },
  creditCost: D(250),
});

describe('buildDurationSeconds', () => {
  it('базовое здание строится 10–12 секунд', () => {
    const seconds = buildDurationSeconds(minerMk1);
    expect(seconds).toBeGreaterThanOrEqual(10);
    expect(seconds).toBeLessThanOrEqual(12);
  });

  it('самое дешёвое здание всё равно не мгновенное', () => {
    const cheap = building({ baseCost: { energy: D(5) } });
    expect(buildDurationSeconds(cheap)).toBeGreaterThanOrEqual(
      CONSTRUCTION_BALANCE.MIN_BUILD_SECONDS,
    );
  });

  it('сложное здание строится дольше простого', () => {
    const complex = building({
      baseCost: {
        steel: D(15000),
        computer: D(300),
        dark_matter: D(500),
        titanium_alloy: D(100),
      },
    });
    expect(buildDurationSeconds(complex)).toBeGreaterThan(buildDurationSeconds(minerMk1));
  });

  it('несколько ресурсов в стоимости дают больше времени, чем один такого же объёма', () => {
    const single = building({ baseCost: { steel: D(400) } });
    const multi = building({
      baseCost: { steel: D(100), plastic: D(100), glass: D(100), copper: D(100) },
    });
    expect(buildDurationSeconds(multi)).toBeGreaterThan(buildDurationSeconds(single));
  });

  it('никогда не уходит в минуты — это idle-игра', () => {
    const absurd = building({
      baseCost: { steel: D(1e12), computer: D(1e12), dark_matter: D(1e12), antimatter: D(1e12) },
    });
    expect(buildDurationSeconds(absurd)).toBeLessThanOrEqual(
      CONSTRUCTION_BALANCE.MAX_BUILD_SECONDS,
    );
  });

  it('кривая обучения ускоряет застройку, но не бесконечно', () => {
    const first = buildDurationSeconds(minerMk1, 0);
    const tenth = buildDurationSeconds(minerMk1, 10);
    const hundredth = buildDurationSeconds(minerMk1, 100);

    expect(tenth).toBeLessThan(first);
    expect(hundredth).toBeLessThanOrEqual(tenth);
    expect(hundredth).toBeGreaterThanOrEqual(first * CONSTRUCTION_BALANCE.MAX_LEARNING_DISCOUNT - 0.1);
  });

  it('внешнее ускорение работает, а некорректное значение игнорируется', () => {
    const normal = buildDurationSeconds(minerMk1, 0, 1);
    expect(buildDurationSeconds(minerMk1, 0, 0.5)).toBeLessThan(normal);
    expect(buildDurationSeconds(minerMk1, 0, 0)).toBe(normal);
    expect(buildDurationSeconds(minerMk1, 0, -5)).toBe(normal);
  });

  it('здание без стоимости не ломает расчёт', () => {
    expect(buildDurationSeconds(building({ baseCost: {}, creditCost: undefined }))).toBeGreaterThan(0);
  });
});

describe('learningMultiplier', () => {
  it('не превышает 1 и не опускается ниже потолка скидки', () => {
    expect(learningMultiplier(0)).toBe(1);
    expect(learningMultiplier(-5)).toBe(1);
    expect(learningMultiplier(1000)).toBe(CONSTRUCTION_BALANCE.MAX_LEARNING_DISCOUNT);
  });
});

describe('upgradeDurationSeconds', () => {
  it('улучшение быстрее постройки с нуля', () => {
    expect(upgradeDurationSeconds(minerMk1, 1)).toBeLessThan(buildDurationSeconds(minerMk1, 0, 1));
  });

  it('каждый следующий уровень дольше', () => {
    expect(upgradeDurationSeconds(minerMk1, 10)).toBeGreaterThan(upgradeDurationSeconds(minerMk1, 1));
  });

  it('кривая обучения не применяется к улучшениям', () => {
    // Аргумента placedCount у upgrade нет — уровень 1 всегда даёт одно и то же время.
    expect(upgradeDurationSeconds(minerMk1, 1)).toBe(upgradeDurationSeconds(minerMk1, 1));
  });

  it('на очень высоком уровне ограничено сверху', () => {
    expect(upgradeDurationSeconds(minerMk1, 500)).toBeLessThanOrEqual(
      CONSTRUCTION_BALANCE.MAX_UPGRADE_SECONDS,
    );
  });

  it('нулевой и отрицательный уровень считаются первым', () => {
    expect(upgradeDurationSeconds(minerMk1, 0)).toBe(upgradeDurationSeconds(minerMk1, 1));
    expect(upgradeDurationSeconds(minerMk1, -3)).toBe(upgradeDurationSeconds(minerMk1, 1));
  });
});

describe('прогресс работы', () => {
  const job: TileJob = { kind: 'build', buildingId: 'miner_mk1', startedAt: 1000, duration: 10_000 };

  it('считается по абсолютному времени — вкладка в фоне не мешает', () => {
    expect(jobProgress(job, 1000)).toBe(0);
    expect(jobProgress(job, 6000)).toBeCloseTo(0.5);
    expect(jobProgress(job, 11_000)).toBe(1);
    // Ключевой случай: игрок свернул окно на час — работа готова, а не «замерла».
    expect(jobProgress(job, 1000 + 3_600_000)).toBe(1);
  });

  it('не уходит в минус, если системные часы отъехали назад', () => {
    expect(jobProgress(job, 0)).toBe(0);
  });

  it('нулевая длительность считается готовой', () => {
    expect(jobProgress({ ...job, duration: 0 }, 1000)).toBe(1);
  });

  it('остаток и признак завершения согласованы с прогрессом', () => {
    expect(jobRemainingMs(job, 6000)).toBe(5000);
    expect(jobRemainingMs(job, 999_999)).toBe(0);
    expect(isJobComplete(job, 10_999)).toBe(false);
    expect(isJobComplete(job, 11_000)).toBe(true);
  });
});

describe('collectCompletedJobs', () => {
  const jobs = {
    '1,1': { kind: 'build', buildingId: 'a', startedAt: 0, duration: 1000 } as TileJob,
    '2,2': { kind: 'build', buildingId: 'b', startedAt: 0, duration: 5000 } as TileJob,
  };

  it('возвращает только готовые', () => {
    expect(collectCompletedJobs(jobs, 2000)).toEqual(['1,1']);
    expect(collectCompletedJobs(jobs, 6000).sort()).toEqual(['1,1', '2,2']);
  });

  it('на пустой очереди не аллоцирует лишнего и не падает', () => {
    expect(collectCompletedJobs(undefined, 1)).toEqual([]);
    expect(collectCompletedJobs({}, 1)).toEqual([]);
  });

  it('оффлайн достраивает всё разом', () => {
    expect(collectCompletedJobs(jobs, Date.now()).length).toBe(2);
  });
});

describe('effectiveDisabledTiles', () => {
  it('без работ возвращает ТУ ЖЕ ссылку — иначе кэш ставок в тике сбрасывается 20 раз в секунду', () => {
    const disabled = { '3,3': true };
    expect(effectiveDisabledTiles(disabled, undefined)).toBe(disabled);
    expect(effectiveDisabledTiles(disabled, {})).toBe(disabled);
  });

  it('строящаяся клетка не производит', () => {
    const jobs = { '1,1': { kind: 'build', buildingId: 'a', startedAt: 0, duration: 1000 } as TileJob };
    const result = effectiveDisabledTiles({ '3,3': true }, jobs);
    expect(result['1,1']).toBe(true);
    expect(result['3,3']).toBe(true);
  });

  it('не мутирует исходный tileDisabled', () => {
    const disabled: Record<string, boolean> = {};
    const jobs = { '1,1': { kind: 'build', buildingId: 'a', startedAt: 0, duration: 1000 } as TileJob };
    effectiveDisabledTiles(disabled, jobs);
    expect(disabled['1,1']).toBeUndefined();
  });

  it('переносит отсутствующий tileDisabled без падения', () => {
    expect(effectiveDisabledTiles(undefined, undefined)).toEqual({});
  });
});

describe('hasActiveJobs', () => {
  it('различает пустую и непустую очередь', () => {
    expect(hasActiveJobs(undefined)).toBe(false);
    expect(hasActiveJobs({})).toBe(false);
    expect(hasActiveJobs({ '1,1': { kind: 'build', buildingId: 'a', startedAt: 0, duration: 1 } })).toBe(true);
  });
});
