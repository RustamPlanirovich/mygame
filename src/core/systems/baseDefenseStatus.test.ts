import { describe, expect, it } from 'vitest';
import { D } from '../math/format';
import {
  BASE_SHIELD_ID,
  BASE_TURRET_ID,
  computeBaseDefenseStatus,
  type BaseDefenseCombatInput,
} from './baseDefenseStatus';

const NOW = 1_000_000;

const combat = (over: Partial<BaseDefenseCombatInput> = {}): BaseDefenseCombatInput => ({
  baseHp: D(100),
  baseMaxHp: D(100),
  shieldHp: D(0),
  shieldMaxHp: D(0),
  enemies: [],
  waveEndsAt: 0,
  defenseFireRatio: D(0),
  baseDamageTakenPerSecond: D(0),
  ...over,
});

const wave = { waveEndsAt: NOW + 30_000 };

describe('computeBaseDefenseStatus', () => {
  it('без волны и без врагов тревоги нет', () => {
    const s = computeBaseDefenseStatus(combat(), [], NOW);
    expect(s.alarm).toBe(false);
    expect(s.level).toBe('calm');
  });

  it('волна без турелей и щитов — база беззащитна', () => {
    const s = computeBaseDefenseStatus(combat(wave), [], NOW);
    expect(s.alarm).toBe(true);
    expect(s.level).toBe('undefended');
  });

  it('тревога держится между спавнами, пока идёт волна', () => {
    const s = computeBaseDefenseStatus(combat(wave), [{ id: BASE_TURRET_ID, count: 2 }], NOW);
    expect(s.enemies).toBe(0);
    expect(s.alarm).toBe(true);
    // Целей нет — это не «молчат от нехватки энергии».
    expect(s.firing).toBe(false);
    expect(s.turretsStarved).toBe(false);
    expect(s.level).toBe('defended');
  });

  it('турели стреляют, когда есть цели и хватает энергии', () => {
    const s = computeBaseDefenseStatus(
      combat({ ...wave, enemies: [{}], defenseFireRatio: D(1) }),
      [{ id: BASE_TURRET_ID, count: 3 }],
      NOW,
    );
    expect(s.firing).toBe(true);
    expect(s.level).toBe('defended');
  });

  it('нулевая доля залпа при живых врагах — турели молчат без энергии', () => {
    const s = computeBaseDefenseStatus(
      combat({ ...wave, enemies: [{}], defenseFireRatio: D(0) }),
      [{ id: BASE_TURRET_ID, count: 3 }],
      NOW,
    );
    expect(s.turretsStarved).toBe(true);
    expect(s.firing).toBe(false);
    expect(s.level).toBe('strained');
  });

  it('пробитый щит — тоже «оборона есть, но не работает»', () => {
    const s = computeBaseDefenseStatus(
      combat({ ...wave, shieldHp: D(0), shieldMaxHp: D(70) }),
      [{ id: BASE_SHIELD_ID, count: 2 }],
      NOW,
    );
    expect(s.shieldDown).toBe(true);
    expect(s.shieldRatio).toBe(0);
    expect(s.level).toBe('strained');
  });

  it('заряженный щит считается долей от максимума', () => {
    const s = computeBaseDefenseStatus(
      combat({ ...wave, shieldHp: D(35), shieldMaxHp: D(70) }),
      [{ id: BASE_SHIELD_ID, count: 2 }],
      NOW,
    );
    expect(s.shieldRatio).toBeCloseTo(0.5);
    expect(s.shieldDown).toBe(false);
    expect(s.level).toBe('defended');
  });

  it('на мирной карте тревоги нет даже с назначенной волной', () => {
    const s = computeBaseDefenseStatus(combat(wave), [], NOW, true);
    expect(s.alarm).toBe(false);
    expect(s.level).toBe('calm');
    expect(s.secondsLeft).toBe(0);
  });

  it('уничтоженная база — offline, а не «беззащитна»', () => {
    const s = computeBaseDefenseStatus(combat({ ...wave, baseHp: D(0) }), [], NOW);
    expect(s.level).toBe('offline');
    expect(s.alarm).toBe(false);
  });

  it('платформенные турели базу не защищают', () => {
    const s = computeBaseDefenseStatus(
      combat(wave),
      [{ id: 'defense_turret_mk1', count: 10 }, { id: 'shield_generator_mk1', count: 4 }],
      NOW,
    );
    expect(s.turretCount).toBe(0);
    expect(s.shieldCount).toBe(0);
    expect(s.level).toBe('undefended');
  });

  it('секунды до конца волны округляются вверх', () => {
    const s = computeBaseDefenseStatus(combat({ waveEndsAt: NOW + 4_200 }), [], NOW);
    expect(s.secondsLeft).toBe(5);
  });
});
