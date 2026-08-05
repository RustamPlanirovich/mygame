/**
 * «Идеальный район» (bigplan.md, пункт 11).
 *
 * Достижение «Перфекционист» было недостижимо: в achievementsHelpers на его месте стоял
 * `return false`, а понятия «идеальный район» в коде не существовало. Здесь закреплено
 * определение: район идеален, когда его бонус упёрся в потолок для своего типа.
 */

import { describe, expect, it } from 'vitest';
import { DISTRICT_MAX_MULTIPLIER, isDistrictMaxed, type District } from './districts';

function district(overrides: Partial<District>): District {
  return {
    type: 'research',
    buildings: [],
    centerX: 0,
    centerY: 0,
    radius: 2,
    bonus: 1,
    description: '',
    ...overrides,
  };
}

describe('isDistrictMaxed', () => {
  it('район на потолке считается идеальным', () => {
    expect(isDistrictMaxed(district({ type: 'research', bonus: DISTRICT_MAX_MULTIPLIER.research }))).toBe(true);
    expect(isDistrictMaxed(district({ type: 'energy', bonus: DISTRICT_MAX_MULTIPLIER.energy }))).toBe(true);
  });

  it('район ниже потолка — нет', () => {
    expect(isDistrictMaxed(district({ type: 'research', bonus: 1.5 }))).toBe(false);
    expect(isDistrictMaxed(district({ type: 'space', bonus: 1.0 }))).toBe(false);
  });

  it('устойчив к погрешности умножения', () => {
    // bonus считается как 1 + 0.08 * n, поэтому точного равенства 1.8 ждать нельзя.
    const almost = DISTRICT_MAX_MULTIPLIER.research - 1e-12;
    expect(isDistrictMaxed(district({ type: 'research', bonus: almost }))).toBe(true);
  });

  it('потолок задан для каждого типа района', () => {
    const types: District['type'][] = [
      'electronics', 'military', 'space', 'research', 'energy', 'production', 'mining',
    ];
    for (const type of types) {
      expect(DISTRICT_MAX_MULTIPLIER[type]).toBeGreaterThan(1);
    }
  });
});
