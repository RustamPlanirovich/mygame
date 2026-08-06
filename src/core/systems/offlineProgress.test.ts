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
