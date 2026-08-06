/**
 * Офлайн-добыча: начисление за время отсутствия.
 *
 * Проверяется именно чистая функция — она единственная решает, сколько игрок получит,
 * и ошибка здесь либо дарит склад целиком, либо молча съедает ночь работы базы.
 */

import { describe, expect, it } from 'vitest';
import { D } from '../math/format';
import type { ResourceState, ResourceType } from '../gameTypes';
import {
  OFFLINE_EFFICIENCY,
  OFFLINE_MAX_SECONDS,
  computeOfflineMining,
} from './offlineProgress';

const NOW = 1_700_000_000_000;

/** Минимальный набор ресурсов: функция ходит только по переданным ключам. */
function makeResources(
  spec: Partial<Record<ResourceType, { amount?: number; max?: number; production?: number }>>,
): Record<ResourceType, ResourceState> {
  const out: Record<string, ResourceState> = {};
  for (const [key, v] of Object.entries(spec)) {
    out[key] = {
      amount: D(v?.amount ?? 0),
      max: D(v?.max ?? 1_000_000),
      production: D(v?.production ?? 0),
    };
  }
  return out as Record<ResourceType, ResourceState>;
}

describe('computeOfflineMining', () => {
  it('начисляет 75% от чистой ставки за время отсутствия', () => {
    const report = computeOfflineMining({
      resources: makeResources({ ore: { production: 2 } }),
      savedAt: NOW - 3600 * 1000,
      now: NOW,
    });

    expect(report).not.toBeNull();
    expect(report!.efficiency).toBe(OFFLINE_EFFICIENCY);
    expect(report!.creditedSeconds).toBe(3600);
    // 2/с × 3600 с × 0.75
    expect(report!.gains[0].resource).toBe('ore');
    expect(report!.gains[0].amount.toNumber()).toBeCloseTo(5400, 6);
  });

  it('обрезает отсутствие потолком, а не платит за месяц', () => {
    const report = computeOfflineMining({
      resources: makeResources({ ore: { production: 1 } }),
      savedAt: NOW - 30 * 24 * 3600 * 1000,
      now: NOW,
    });

    expect(report!.creditedSeconds).toBe(OFFLINE_MAX_SECONDS);
    expect(report!.elapsedSeconds).toBe(30 * 24 * 3600);
    expect(report!.gains[0].amount.toNumber()).toBeCloseTo(OFFLINE_MAX_SECONDS * OFFLINE_EFFICIENCY, 6);
  });

  it('не начисляет больше свободного места на складе и помечает это', () => {
    const report = computeOfflineMining({
      resources: makeResources({ ore: { production: 10, amount: 900, max: 1000 } }),
      savedAt: NOW - 3600 * 1000,
      now: NOW,
    });

    // Наработали бы 27 000, но влезает только 100 — окно обязано показать правду.
    expect(report!.gains[0].amount.toNumber()).toBe(100);
    expect(report!.gains[0].capped).toBe(true);
    expect(report!.anyCapped).toBe(true);
  });

  it('полный склад из отчёта выпадает', () => {
    const report = computeOfflineMining({
      resources: makeResources({ ore: { production: 10, amount: 1000, max: 1000 } }),
      savedAt: NOW - 3600 * 1000,
      now: NOW,
    });

    expect(report).toBeNull();
  });

  it('отрицательная чистая ставка ничего не списывает', () => {
    // Отсутствие не должно съедать накопленное: иначе выход из игры — штраф.
    const report = computeOfflineMining({
      resources: makeResources({ ore: { production: -5, amount: 500 }, steel: { production: 1 } }),
      savedAt: NOW - 3600 * 1000,
      now: NOW,
    });

    expect(report!.gains.map((g) => g.resource)).toEqual(['steel']);
  });

  it('мусор офлайн не копится', () => {
    const report = computeOfflineMining({
      resources: makeResources({ waste: { production: 5 }, radioactive_waste: { production: 5 } }),
      savedAt: NOW - 3600 * 1000,
      now: NOW,
    });

    expect(report).toBeNull();
  });

  it('короткое отсутствие (перезагрузка страницы) окна не показывает', () => {
    const report = computeOfflineMining({
      resources: makeResources({ ore: { production: 10 } }),
      savedAt: NOW - 20 * 1000,
      now: NOW,
    });

    expect(report).toBeNull();
  });

  it('часы игрока в прошлом — не долг и не начисление', () => {
    const report = computeOfflineMining({
      resources: makeResources({ ore: { production: 10 } }),
      savedAt: NOW + 60 * 60 * 1000,
      now: NOW,
    });

    expect(report).toBeNull();
  });

  it('битый savedAt не роняет загрузку', () => {
    expect(
      computeOfflineMining({
        resources: makeResources({ ore: { production: 10 } }),
        savedAt: 0,
        now: NOW,
      }),
    ).toBeNull();
    expect(
      computeOfflineMining({
        resources: makeResources({ ore: { production: 10 } }),
        savedAt: Number.NaN,
        now: NOW,
      }),
    ).toBeNull();
  });

  it('сортирует начисления по убыванию — крупное сверху', () => {
    const report = computeOfflineMining({
      resources: makeResources({
        ore: { production: 1 },
        steel: { production: 7 },
        ice: { production: 3 },
      }),
      savedAt: NOW - 3600 * 1000,
      now: NOW,
    });

    expect(report!.gains.map((g) => g.resource)).toEqual(['steel', 'ice', 'ore']);
  });
});

/**
 * Демон «Ночная смена»: платная надбавка к офлайну.
 *
 * Главное свойство, которое здесь и проверяется: смена НИКОГДА не оставляет игрока беднее,
 * чем без неё. Она берёт плату только из той энергии, которую сама же и наработала, поэтому
 * слабая энергетика получает частичную надбавку, а не долг.
 */
describe('computeOfflineMining + Ночная смена', () => {
  const HOUR = 3600;
  const nightShift = { rentPerSecond: 12, boostedEfficiency: 0.95 };

  it('при достаточной энергии поднимает эффективность до 95% и удерживает аренду', () => {
    const report = computeOfflineMining({
      resources: makeResources({
        // 100 ⚡/с при аренде 12 ⚡/с — ночь оплачена с запасом.
        energy: { production: 100, max: 1e9 },
        ore: { production: 2 },
      }),
      savedAt: NOW - HOUR * 1000,
      now: NOW,
      nightShift,
    });

    expect(report!.efficiency).toBeCloseTo(0.95, 6);
    expect(report!.nightShift!.paidShare).toBe(1);
    expect(report!.nightShift!.energyFee.toNumber()).toBeCloseTo(12 * HOUR, 6);

    // Руды больше, чем без демона: 0.95 против 0.75.
    const ore = report!.gains.find((g) => g.resource === 'ore')!;
    expect(ore.amount.toNumber()).toBeCloseTo(2 * HOUR * 0.95, 6);

    // Энергия начислена за вычетом аренды.
    const energy = report!.gains.find((g) => g.resource === 'energy')!;
    expect(energy.amount.toNumber()).toBeCloseTo(100 * HOUR * 0.95 - 12 * HOUR, 6);
  });

  it('слабая энергетика получает надбавку частично, а не в долг', () => {
    const report = computeOfflineMining({
      resources: makeResources({
        // 6 ⚡/с × 0.75 = 4.5 из нужных 12 — оплачено 37.5% смены.
        energy: { production: 6, max: 1e9 },
        ore: { production: 2 },
      }),
      savedAt: NOW - HOUR * 1000,
      now: NOW,
      nightShift,
    });

    expect(report!.nightShift!.paidShare).toBeCloseTo(0.375, 6);
    expect(report!.efficiency).toBeCloseTo(OFFLINE_EFFICIENCY + 0.2 * 0.375, 6);

    // Энергии всё равно начислено не меньше нуля: аренда не превышает выработку.
    const energy = report!.gains.find((g) => g.resource === 'energy');
    expect(energy === undefined || energy.amount.gte(0)).toBe(true);

    // И руды не меньше, чем без демона.
    const ore = report!.gains.find((g) => g.resource === 'ore')!;
    expect(ore.amount.toNumber()).toBeGreaterThan(2 * HOUR * OFFLINE_EFFICIENCY);
  });

  it('база без чистого прироста энергии не получает надбавку вовсе', () => {
    const report = computeOfflineMining({
      resources: makeResources({ energy: { production: 0 }, ore: { production: 2 } }),
      savedAt: NOW - HOUR * 1000,
      now: NOW,
      nightShift,
    });

    expect(report!.efficiency).toBe(OFFLINE_EFFICIENCY);
    expect(report!.nightShift!.paidShare).toBe(0);
    expect(report!.nightShift!.energyFee.toNumber()).toBe(0);
  });

  it('полное энергохранилище закрывает лазейку «смена бесплатно»', () => {
    const report = computeOfflineMining({
      // Платить нечем: энергия за ночь всё равно не поместится на склад.
      resources: makeResources({
        energy: { production: 1000, amount: 500, max: 500 },
        ore: { production: 2 },
      }),
      savedAt: NOW - HOUR * 1000,
      now: NOW,
      nightShift,
    });

    expect(report!.efficiency).toBe(OFFLINE_EFFICIENCY);
    expect(report!.nightShift!.paidShare).toBe(0);
  });

  it('без демона отчёт остаётся прежним и не содержит его блока', () => {
    const report = computeOfflineMining({
      resources: makeResources({ energy: { production: 100 }, ore: { production: 2 } }),
      savedAt: NOW - HOUR * 1000,
      now: NOW,
    });

    expect(report!.efficiency).toBe(OFFLINE_EFFICIENCY);
    expect(report!.nightShift).toBeUndefined();
  });
});
