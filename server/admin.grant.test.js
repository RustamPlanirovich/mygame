/**
 * applyGrantToSaveData — выдача ресурсов из админки (bigplan.md, пункт 9).
 *
 * Функция патчит JSON сохранения игрока. Тонкость, которую легко потерять при правках:
 * при загрузке игры `grid.buffers.base` ПЕРЕТИРАЕТ `resources[*].amount`, поэтому патчить
 * только `resources` бессмысленно — выдача исчезнет после первой же загрузки.
 */

import { describe, expect, it } from 'vitest';
import Decimal from 'break_eternity.js';
import { applyGrantToSaveData, buildGrantDeltas } from './admin.js';

const D = (v) => new Decimal(v);

/** Минимальный сейв нужной формы. */
function makeSave(overrides = {}) {
  return {
    currency: { credits: '1000', researchPoints: '50', influence: '10' },
    resources: {
      ore: { amount: '100', max: '5000' },
      steel: { amount: '0', max: '1000' },
    },
    grid: {
      buffers: {
        base: { ore: '100', steel: '0' },
      },
    },
    ...overrides,
  };
}

describe('applyGrantToSaveData: валюта', () => {
  it('прибавляет к currency и сообщает before/after', () => {
    const r = applyGrantToSaveData(makeSave(), { deltas: { credits: D(500) } });
    expect(r.error).toBeUndefined();
    expect(r.data.currency.credits).toBe('1500');
    expect(r.applied['currency.credits']).toMatchObject({ before: '1000', after: '1500' });
  });

  it('не уводит валюту в минус', () => {
    const r = applyGrantToSaveData(makeSave(), { deltas: { credits: D(-99999) } });
    expect(r.data.currency.credits).toBe('0');
  });

  it('не мутирует переданный сейв', () => {
    const save = makeSave();
    applyGrantToSaveData(save, { deltas: { credits: D(500) } });
    expect(save.currency.credits).toBe('1000');
  });
});

describe('applyGrantToSaveData: ресурсы', () => {
  it('патчит И grid.buffers.base, И resources — иначе выдача не выживет загрузку', () => {
    const r = applyGrantToSaveData(makeSave(), { resourceDeltas: { ore: D(400) } });
    expect(r.data.grid.buffers.base.ore).toBe('500');
    expect(r.data.resources.ore.amount).toBe('500');
  });

  it('обрезает по вместимости склада и говорит об этом', () => {
    const r = applyGrantToSaveData(makeSave(), { resourceDeltas: { steel: D(999999) } });
    expect(r.data.grid.buffers.base.steel).toBe('1000');
    expect(r.clamped).toContain('steel');
  });

  it('честно отказывается, если в сейве нет grid.buffers.base', () => {
    const save = makeSave({ grid: {} });
    const r = applyGrantToSaveData(save, { resourceDeltas: { ore: D(100) } });
    expect(Object.keys(r.applied)).toHaveLength(0);
    expect(r.skipped[0].reason).toContain('grid.buffers.base');
  });

  it('пропускает неизвестный ресурс, а не создаёт его', () => {
    const r = applyGrantToSaveData(makeSave(), { resourceDeltas: { нетакого: D(100) } });
    expect(r.skipped.some((s) => s.field === 'resources.нетакого')).toBe(true);
  });
});

describe('applyGrantToSaveData: битые данные', () => {
  it('на не-объекте возвращает ошибку, а не падает', () => {
    expect(applyGrantToSaveData(null, { deltas: { credits: D(1) } }).error).toBe('SAVE_SHAPE_UNRECOGNIZED');
    expect(applyGrantToSaveData('строка', {}).error).toBe('SAVE_SHAPE_UNRECOGNIZED');
  });

  it('нераспознанное значение попадает в skipped, остальное применяется', () => {
    const save = makeSave();
    save.currency.credits = { что: 'то' };
    const r = applyGrantToSaveData(save, {
      deltas: { credits: D(100), influence: D(5) },
      resourceDeltas: {},
    });
    expect(r.skipped.some((s) => s.field === 'currency.credits')).toBe(true);
    expect(r.data.currency.influence).toBe('15');
  });
});

/**
 * ОЧЕРЕДЬ ВЫДАЧ (player_grants) — формат дельт.
 *
 * Клиент применяет их той же функцией, что и события realtime-канала
 * (src/core/systems/adminGrant.ts), а она понимает ТОЛЬКО плоские ключи с точкой. Разъедься
 * формат — выдача из очереди тихо попадёт в `unknown` и не начислится.
 */
describe('buildGrantDeltas', () => {
  it('складывает валюты и ресурсы в плоский словарь с точкой', () => {
    expect(buildGrantDeltas({ credits: D(500), influence: D(-5) }, { ore: D(100) })).toEqual({
      'currency.credits': '500',
      'currency.influence': '-5',
      'resources.ore': '100',
    });
  });

  it('на пустом запросе даёт пустой словарь, а не мусор', () => {
    expect(buildGrantDeltas({}, {})).toEqual({});
  });

  it('величины остаются строками break_eternity, а не числами', () => {
    const out = buildGrantDeltas({ credits: D('1e100') }, {});
    expect(typeof out['currency.credits']).toBe('string');
    expect(out['currency.credits']).toBe(D('1e100').toString());
  });
});
