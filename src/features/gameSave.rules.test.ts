/**
 * Перенос сейва на правила автоматизации, v1 → v2 (bigplan 42).
 *
 * Старые `tileSettings.conditions` из «Фазы 5» никогда не исполнялись, но игрок их набирал
 * руками — пустая вкладка после обновления читалась бы как потеря прогресса. Здесь
 * проверяется, что условия доезжают до `rules` и что миграция остаётся тотальной: сейв
 * это внешние данные, в нём может лежать что угодно, а `migrateSave` не имеет права бросить.
 */

import { describe, expect, it } from 'vitest';
import { SAVE_VERSION, loadSavePayload, migrateSave } from './gameSave';
import { evaluateTileRules, type BuildingRule } from '../core/systems/buildingRules';

/** Сейв как изменяемый объект: тесты про совместимость правят payload руками. */
type MutableSave = {
  saveVersion?: number;
  grid: {
    width?: number;
    height?: number;
    tiles?: Record<string, string>;
    buffers?: Record<string, unknown>;
    tileDisabled?: Record<string, boolean>;
    tileSettings: Record<string, TileSettingsPayload>;
  };
};

/** Настройки клетки в СЫРОМ виде: часть полей ещё старая, часть уже новая. */
type TileSettingsPayload = {
  tileKey?: string;
  buildingId?: string;
  mode?: string;
  health?: number;
  inputPriorities?: Record<string, number>;
  outputPriority?: number;
  storageLimits?: unknown[];
  autoSell?: unknown[];
  enabled?: boolean;
  conditions?: unknown;
  rules?: BuildingRule[];
};

const legacySave = (conditions: unknown): MutableSave => ({
  saveVersion: 1,
  grid: {
    width: 10,
    height: 10,
    tiles: { '1,1': 'mine' },
    buffers: {},
    tileSettings: {
      '1,1': {
        tileKey: '1,1',
        buildingId: 'mine',
        mode: 'normal',
        enabled: true,
        health: 100,
        inputPriorities: {},
        outputPriority: 3,
        storageLimits: [],
        autoSell: [],
        conditions,
      },
    },
  },
});

const settingsOf = (save: { grid?: unknown }): TileSettingsPayload =>
  (save.grid as MutableSave['grid']).tileSettings['1,1'];

const disabledOf = (save: { grid?: unknown }): Record<string, boolean> =>
  (save.grid as MutableSave['grid']).tileDisabled ?? {};

describe('миграция условий в правила', () => {
  it('условие переезжает в правило, старое поле исчезает', () => {
    const out = migrateSave(legacySave([
      { id: 'c1', type: 'resource_below', resource: 'ore', value: 20, action: 'disable', enabled: true },
    ]));

    expect(out.saveVersion).toBe(SAVE_VERSION);
    const settings = settingsOf(out);
    expect(settings.conditions).toBeUndefined();
    expect(settings.rules).toHaveLength(1);
    expect(settings.rules![0].triggers[0]).toMatchObject({
      metric: 'resource_fill',
      resource: 'ore',
      op: 'lt',
      value: 20,
    });
  });

  it('перенесённое правило реально работает', () => {
    // Ради этого всё и затевалось: до миграции условие лежало мёртвым грузом.
    const out = migrateSave(legacySave([
      { id: 'c1', type: 'resource_below', resource: 'ore', value: 20, action: 'disable', enabled: true },
    ]));

    const outcome = evaluateTileRules(
      '1,1',
      settingsOf(out).rules!,
      { disabled: false, mode: 'normal', autoSell: [] },
      {
        resources: { ore: { amount: 50, max: 1000, production: 0 } },
        prices: {},
        energyProduction: 0,
        energyConsumption: 0,
        credits: 0,
        pollutionPenalty: 0,
        happiness: 100,
      },
      { health: 100, depositLeftPercent: null },
      undefined,
    );

    expect(outcome.changed).toBe(true);
    expect(outcome.next.disabled).toBe(true);
  });

  it('выключенное старой панелью здание остаётся выключенным', () => {
    /*
     * «Здание остановлено» жило в двух местах: тумблер панели писал tileSettings.enabled,
     * кнопка инспектора — grid.tileDisabled. Теперь флаг один, и старое значение обязано
     * переехать: иначе выключенные здания молча запустились бы после обновления.
     */
    const save = legacySave([]);
    save.grid.tileSettings['1,1'].enabled = false;

    const out = migrateSave(save);
    expect(disabledOf(out)['1,1']).toBe(true);
    expect(settingsOf(out).enabled).toBeUndefined();
  });

  it('работающее здание не оставляет записи в tileDisabled', () => {
    // enabled: true — это «ничего особенного», и мусорить им в сейве незачем.
    const out = migrateSave(legacySave([]));
    expect('1,1' in disabledOf(out)).toBe(false);
  });

  it('уже выключенная клетка не переворачивается обратно', () => {
    const save = legacySave([]);
    save.grid.tileDisabled = { '1,1': true };
    save.grid.tileSettings['1,1'].enabled = true;

    expect(disabledOf(migrateSave(save))['1,1']).toBe(true);
  });

  it('пустой список условий даёт пустой список правил, а не отсутствующее поле', () => {
    const settings = settingsOf(migrateSave(legacySave([])));
    expect(settings.rules).toEqual([]);
    expect(settings.conditions).toBeUndefined();
  });

  it('мусор в условиях не роняет миграцию', () => {
    for (const junk of [undefined, null, 'nope', 42, [null, {}, { type: 'time_of_day', value: 5 }]]) {
      const settings = settingsOf(migrateSave(legacySave(junk)));
      expect(settings.rules).toEqual([]);
    }
  });

  it('уже перенесённые правила не переписываются', () => {
    const save = legacySave([
      { id: 'c1', type: 'resource_below', resource: 'ore', value: 20, action: 'disable', enabled: true },
    ]);
    save.grid.tileSettings['1,1'].rules = [];

    const settings = settingsOf(migrateSave(save));
    expect(settings.rules).toEqual([]);
  });

  it('сейв без настроек клеток проходит миграцию без изменений', () => {
    const out = migrateSave({ saveVersion: 1, grid: { width: 5, height: 5, tiles: {}, buffers: {} } });
    expect(out.saveVersion).toBe(SAVE_VERSION);
    expect(out.grid).toBeDefined();
  });

  it('сейв v0 доезжает до текущей версии через обе ступени', () => {
    const save = legacySave([
      { id: 'c1', type: 'energy_available', value: 80, action: 'enable', enabled: true },
    ]);
    delete save.saveVersion;

    const settings = settingsOf(migrateSave(save));
    expect(settings.rules![0].triggers[0]).toMatchObject({ metric: 'energy_coverage', op: 'gt', value: 80 });
  });

  it('правила переживают полную загрузку сейва', () => {
    const state = loadSavePayload(legacySave([
      { id: 'c1', type: 'resource_above', resource: 'ore', value: 90, action: 'disable', enabled: true },
    ]));

    const settings = state.grid?.tileSettings?.['1,1'];
    expect(settings?.rules).toHaveLength(1);
    expect(settings?.conditions).toBeUndefined();
  });
});
