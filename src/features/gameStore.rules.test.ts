/**
 * ПРАВИЛА АВТОМАТИЗАЦИИ НА ЖИВОМ СТОРЕ (bigplan 42).
 *
 * Логику правил проверяет core/systems/buildingRules.test.ts. Здесь — что стор их применяет
 * туда, куда смотрит ОСТАЛЬНОЙ интерфейс.
 *
 * Главный разбираемый дефект: «здание остановлено» жило в двух местах. Тумблер в панели
 * настроек писал `tileSettings.enabled`, кнопка «ОТКЛЮЧИТЬ» в инспекторе — `grid.tileDisabled`,
 * и каждая не видела другую; карта, массовое выделение и энергобаланс читали только второй.
 * Правило, выключившее здание, поэтому не меняло кнопку. Теперь флаг ОДИН.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { useGameStore } from './gameStore';
import type { BuildingRule } from '../core/systems/buildingRules';

const TILE = '3,4';
/** Реальный отключаемый добытчик из DISABLEABLE_BUILDINGS. */
const MINER = 'miner_mk1';

/**
 * Клетка с добытчиком и пустыми настройками — минимум, на котором работают правила.
 * Здание берём НАСТОЯЩЕЕ и отключаемое: правила уважают тот же `isBuildingDisableable`,
 * что и кнопка в инспекторе (см. отдельный тест ниже).
 */
function placeMine(rules: BuildingRule[]) {
  useGameStore.setState((s) => ({
    grid: {
      ...s.grid,
      tiles: { ...s.grid.tiles, [TILE]: MINER },
      tileDisabled: {},
      tileSettings: {
        ...s.grid.tileSettings,
        [TILE]: {
          tileKey: TILE,
          buildingId: MINER,
          mode: 'normal',
          health: 100,
          inputPriorities: {},
          outputPriority: 3,
          storageLimits: [],
          autoSell: [],
          rules,
          stats: {
            totalProduced: '0',
            totalConsumed: '0',
            uptime: 100,
            efficiency: 100,
            lastActiveAt: 0,
            createdAt: 0,
          },
        },
      },
    },
  }));
}

/** Правило «если руды на складе больше порога». */
function oreRule(over: Partial<BuildingRule> & { id: string }): BuildingRule {
  return {
    enabled: true,
    match: 'all',
    triggers: [{ id: `${over.id}_t0`, metric: 'resource_fill', resource: 'ore', op: 'gt', value: 50 }],
    action: { type: 'disable' },
    ...over,
  };
}

/** Заполняет склад руды до доли от вместимости, чтобы блок «заполненность» сработал. */
function setOreFill(fraction: number) {
  useGameStore.setState((s) => ({
    resources: {
      ...s.resources,
      ore: { ...s.resources.ore, amount: s.resources.ore.max.mul(fraction) },
    },
  }));
}

const disabled = () => useGameStore.getState().grid.tileDisabled?.[TILE] ?? false;
const settings = () => useGameStore.getState().grid.tileSettings?.[TILE];

beforeEach(() => {
  useGameStore.getState().resetGame();
});

describe('один флаг остановки', () => {
  it('тумблер настроек пишет туда же, откуда читает кнопка инспектора', () => {
    placeMine([]);
    useGameStore.getState().setBuildingEnabled(TILE, false);
    expect(disabled()).toBe(true);

    useGameStore.getState().setBuildingEnabled(TILE, true);
    expect(disabled()).toBe(false);
  });

  it('включённое здание не оставляет записи `false` в сейве', () => {
    // Хранить ложь для каждой когда-либо выключенной клетки — мусор в сохранении.
    placeMine([]);
    useGameStore.getState().setBuildingEnabled(TILE, false);
    useGameStore.getState().setBuildingEnabled(TILE, true);
    expect(TILE in (useGameStore.getState().grid.tileDisabled ?? {})).toBe(false);
  });

  it('кнопка инспектора и тумблер настроек видят друг друга', () => {
    placeMine([]);
    useGameStore.getState().toggleBuildingDisabled({ x: 3, y: 4 });
    expect(disabled()).toBe(true);

    // Раньше здесь состояния расходились: панель показывала «работает» у остановленного здания.
    useGameStore.getState().setBuildingEnabled(TILE, true);
    expect(disabled()).toBe(false);
  });
});

describe('правила меняют то, что видит игрок', () => {
  it('сработавшее правило останавливает здание через тот же флаг', () => {
    placeMine([oreRule({ id: 'r1' })]);
    setOreFill(0.9);

    useGameStore.getState().applyBuildingRules();
    expect(disabled()).toBe(true);
  });

  it('не сработавшее правило ничего не трогает', () => {
    placeMine([oreRule({ id: 'r1' })]);
    setOreFill(0.1);

    useGameStore.getState().applyBuildingRules();
    expect(disabled()).toBe(false);
  });

  it('парное правило возвращает здание в работу', () => {
    placeMine([
      oreRule({ id: 'stop' }),
      oreRule({
        id: 'start',
        triggers: [{ id: 'start_t0', metric: 'resource_fill', resource: 'ore', op: 'lt', value: 20 }],
        action: { type: 'enable' },
      }),
    ]);

    setOreFill(0.9);
    useGameStore.getState().applyBuildingRules();
    expect(disabled()).toBe(true);

    setOreFill(0.05);
    useGameStore.getState().applyBuildingRules();
    expect(disabled()).toBe(false);
  });

  it('правило переключает режим работы', () => {
    placeMine([oreRule({ id: 'r1', action: { type: 'switch_mode', mode: 'economy' } })]);
    setOreFill(0.9);

    useGameStore.getState().applyBuildingRules();
    expect(settings()?.mode).toBe('economy');
  });

  it('правило включает авто-продажу на вкладке «Авто-продажа»', () => {
    placeMine([
      oreRule({ id: 'r1', action: { type: 'auto_sell_on', resource: 'ore', threshold: 60 } }),
    ]);
    setOreFill(0.9);

    useGameStore.getState().applyBuildingRules();
    expect(settings()?.autoSell).toEqual([
      { enabled: true, resource: 'ore', threshold: 60, keepAmount: '0' },
    ]);
  });

  it('выключенное правило не срабатывает', () => {
    placeMine([oreRule({ id: 'r1', enabled: false })]);
    setOreFill(0.9);

    useGameStore.getState().applyBuildingRules();
    expect(disabled()).toBe(false);
  });
});

describe('ссылки на состояние', () => {
  it('без изменений не пересоздаются ни tileSettings, ни tileDisabled', () => {
    /*
     * Кэш ставок производства сравнивает обе ссылки, и новый объект на каждую секундную
     * проверку сбрасывал бы пересчёт всей базы.
     */
    placeMine([oreRule({ id: 'r1' })]);
    setOreFill(0.1);

    const before = useGameStore.getState().grid;
    useGameStore.getState().applyBuildingRules();
    const after = useGameStore.getState().grid;

    expect(after.tileSettings).toBe(before.tileSettings);
    expect(after.tileDisabled).toBe(before.tileDisabled);
  });

  it('повторная проверка при уже применённом правиле тоже не меняет ссылок', () => {
    placeMine([oreRule({ id: 'r1' })]);
    setOreFill(0.9);

    useGameStore.getState().applyBuildingRules();
    const settled = useGameStore.getState().grid;
    useGameStore.getState().applyBuildingRules();

    expect(useGameStore.getState().grid.tileDisabled).toBe(settled.tileDisabled);
  });

  it('клетка без правил не считается вовсе', () => {
    placeMine([]);
    const before = useGameStore.getState().grid;
    useGameStore.getState().applyBuildingRules();
    expect(useGameStore.getState().grid).toBe(before);
  });
});

describe('здания, которые отключать нельзя', () => {
  it('правило не останавливает то, чего не останавливает кнопка', () => {
    /*
     * У неотключаемых зданий кнопки «ОТКЛЮЧИТЬ» нет вовсе, и остановленное правилом здание
     * игрок не смог бы вернуть в работу руками.
     */
    placeMine([oreRule({ id: 'r1' })]);
    useGameStore.setState((s) => ({
      grid: { ...s.grid, tiles: { ...s.grid.tiles, [TILE]: 'base' } },
    }));
    setOreFill(0.9);

    useGameStore.getState().applyBuildingRules();
    expect(disabled()).toBe(false);
  });
});

describe('редактирование правил', () => {
  it('upsert добавляет новое и заменяет существующее по id', () => {
    placeMine([]);
    useGameStore.getState().upsertBuildingRule(TILE, oreRule({ id: 'r1' }));
    expect(settings()?.rules).toHaveLength(1);

    useGameStore.getState().upsertBuildingRule(TILE, oreRule({ id: 'r1', name: 'Моё' }));
    expect(settings()?.rules).toHaveLength(1);
    expect(settings()?.rules?.[0].name).toBe('Моё');

    useGameStore.getState().upsertBuildingRule(TILE, oreRule({ id: 'r2' }));
    expect(settings()?.rules).toHaveLength(2);
  });

  it('удаление правила не оставляет его исполняться', () => {
    placeMine([oreRule({ id: 'r1' })]);
    useGameStore.getState().removeBuildingRule(TILE, 'r1');
    setOreFill(0.9);

    useGameStore.getState().applyBuildingRules();
    expect(disabled()).toBe(false);
  });
});
