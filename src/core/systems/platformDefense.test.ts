import { describe, expect, it } from 'vitest';
import { D } from '../math/format';
import type { Building } from '../gameTypes';
import {
  PLATFORM_BASE_SHIELD_REGEN,
  computePlatformDefense,
  computePlatformThreat,
  platformDefenseDps,
  type PlatformThreatInput,
} from './platformDefense';

const NOW = 1_000_000;

/** Минимальный каталог: только те поля, которые читает модуль. */
const catalog = (): Map<string, Building> =>
  new Map(
    [
      { id: 'defense_turret_mk1', combat: { dps: D(25), energyPerSecond: D(8) } },
      { id: 'defense_turret_mk2', combat: { dps: D(60), energyPerSecond: D(15) } },
      {
        id: 'shield_generator_mk1',
        defense: { shieldMaxHp: D(500), shieldRegenPerSecond: D(10), energyPerSecond: D(20) },
      },
      { id: 'radar_station_mk1' },
      { id: 'turret_mk1', combat: { dps: D(12), energyPerSecond: D(4) } },
      { id: 'iron_mine' },
    ].map((b) => [b.id, b as unknown as Building]),
  );

const defense = (tiles: Record<string, string>, over: Partial<Parameters<typeof computePlatformDefense>[0]> = {}) =>
  computePlatformDefense({ tiles, buildingsById: catalog(), ...over });

describe('computePlatformDefense', () => {
  it('пустая платформа: стволов нет, щит регенерирует базовым темпом', () => {
    const d = defense({});
    expect(d.turretCount).toBe(0);
    expect(d.turretDps.toNumber()).toBe(0);
    expect(d.shieldRegenPerSecond.toNumber()).toBe(PLATFORM_BASE_SHIELD_REGEN);
  });

  it('DPS берётся из каталога, а Mk.II не «считается за две Mk.I»', () => {
    const d = defense({ '0,0': 'defense_turret_mk1', '1,0': 'defense_turret_mk2' });
    expect(d.turretCount).toBe(2);
    expect(d.turretDps.toNumber()).toBe(85);
  });

  it('турель главной базы платформу не защищает', () => {
    const d = defense({ '0,0': 'turret_mk1', '1,0': 'iron_mine' });
    expect(d.turretCount).toBe(0);
    expect(d.turretDps.toNumber()).toBe(0);
  });

  it('строящаяся и выключенная турели в бою не участвуют', () => {
    const tiles = { '0,0': 'defense_turret_mk1', '1,0': 'defense_turret_mk1', '2,0': 'defense_turret_mk1' };
    const d = defense(tiles, {
      tileJobs: { '0,0': { kind: 'build' } },
      tileDisabled: { '1,0': true },
    });
    expect(d.turretCount).toBe(1);
    expect(d.turretDps.toNumber()).toBe(25);
  });

  it('генератор щита прибавляет реген к базовому, радар расширяет зону', () => {
    const d = defense({ '0,0': 'shield_generator_mk1', '1,0': 'radar_station_mk1' });
    expect(d.shieldCount).toBe(1);
    expect(d.shieldRegenPerSecond.toNumber()).toBe(PLATFORM_BASE_SHIELD_REGEN + 10);
    expect(d.radarCount).toBe(1);
    expect(d.radarRange).toBe(2);
  });
});

describe('platformDefenseDps', () => {
  it('обесточенные турели не стреляют, а приписанные корабли — стреляют', () => {
    const d = defense({ '0,0': 'defense_turret_mk1', '1,0': 'defense_turret_mk2' });
    expect(platformDefenseDps(d, 0).toNumber()).toBe(0);
    expect(platformDefenseDps(d, 0, D(40)).toNumber()).toBe(40);
  });

  it('дефицит энергии режет урон турелей пропорционально', () => {
    const d = defense({ '0,0': 'defense_turret_mk1' });
    expect(platformDefenseDps(d, 0.5).toNumber()).toBe(12.5);
    expect(platformDefenseDps(d, 1).toNumber()).toBe(25);
  });

  it('эффективность за пределами 0..1 не ломает урон', () => {
    const d = defense({ '0,0': 'defense_turret_mk1' });
    expect(platformDefenseDps(d, 5).toNumber()).toBe(25);
    expect(platformDefenseDps(d, Number.NaN).toNumber()).toBe(0);
  });
});

const threat = (over: Partial<PlatformThreatInput> = {}): PlatformThreatInput => ({
  hp: D(1000),
  maxHp: D(1000),
  armor: D(200),
  shieldHp: D(500),
  enemies: [],
  defenseDps: D(0),
  now: NOW,
  ...over,
});

describe('computePlatformThreat', () => {
  it('без врагов — тишина и срок следующей волны', () => {
    const t = computePlatformThreat(threat({ nextWaveAt: NOW + 42_000 }));
    expect(t.level).toBe('calm');
    expect(t.underAttack).toBe(false);
    expect(t.secondsToDestruction).toBeNull();
    expect(t.secondsToNextWave).toBe(42);
  });

  it('запас прочности = щит + броня×2 + корпус', () => {
    const t = computePlatformThreat(threat({ enemies: [{ hp: D(100), dps: D(20) }] }));
    // 500 щита + 200 брони, гасящей 50% (значит 400 урона) + 1000 корпуса.
    expect(t.effectiveHp.toNumber()).toBe(1900);
    expect(t.secondsToDestruction).toBeCloseTo(95);
  });

  it('без обороны платформа обречена, срок считается по текущему урону', () => {
    const t = computePlatformThreat(
      threat({ hp: D(100), armor: D(0), shieldHp: D(0), enemies: [{ hp: D(50), dps: D(10) }] }),
    );
    expect(t.level).toBe('undefended');
    expect(t.incomingDps.toNumber()).toBe(10);
    expect(t.secondsToDestruction).toBeCloseTo(10);
    expect(t.secondsToClear).toBeNull();
  });

  it('оборона держит, если добьёт волну раньше, чем платформа развалится', () => {
    const t = computePlatformThreat(
      threat({ enemies: [{ hp: D(100), dps: D(20) }], defenseDps: D(50) }),
    );
    expect(t.level).toBe('holding');
    expect(t.secondsToClear).toBeCloseTo(2);
  });

  it('оборона не справляется — это «losing», а не «держит»', () => {
    const t = computePlatformThreat(
      threat({
        hp: D(50),
        armor: D(0),
        shieldHp: D(0),
        enemies: [{ hp: D(10_000), dps: D(100) }],
        defenseDps: D(1),
      }),
    );
    expect(t.level).toBe('losing');
    expect(t.secondsToDestruction).toBeCloseTo(0.5);
  });

  it('добитые враги не стреляют и не считаются целями', () => {
    const t = computePlatformThreat(
      threat({ enemies: [{ hp: D(0), dps: D(999) }], defenseDps: D(10) }),
    );
    expect(t.enemies).toBe(0);
    expect(t.incomingDps.toNumber()).toBe(0);
    expect(t.level).toBe('calm');
  });

  it('у врага без dps в сейве урон считается дефолтным', () => {
    const t = computePlatformThreat(threat({ enemies: [{ hp: D(10) }] }));
    expect(t.incomingDps.toNumber()).toBe(10);
  });

  it('уничтоженная платформа — destroyed, а не «беззащитна»', () => {
    const t = computePlatformThreat(
      threat({ hp: D(0), enemies: [{ hp: D(10), dps: D(5) }] }),
    );
    expect(t.level).toBe('destroyed');
    expect(t.underAttack).toBe(false);
    expect(t.hullRatio).toBe(0);
  });
});
