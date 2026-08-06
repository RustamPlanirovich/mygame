/**
 * Правила автоматизации зданий (bigplan 42).
 *
 * Проверяется ровно то, чего не было у старых «условий»: что правило действительно
 * СРАБАТЫВАЕТ и меняет состояние клетки. Плюс три места, где легко получить тихую ложь:
 * недонастроенный блок (нет ресурса), деление на ноль в покрытии энергии и сохранение
 * ссылки на настройки, когда ничего не изменилось.
 */

import { describe, expect, it } from 'vitest';
import {
  RULE_TEMPLATES,
  availableActions,
  availableTemplates,
  describeRule,
  evaluateRule,
  evaluateTileRules,
  evaluateTrigger,
  migrateLegacyConditions,
  readMetric,
  rulesControlling,
  rulesOf,
  validateRule,
  type BuildingRule,
  type RuleReadings,
  type RuleTileReadings,
  type RuleTileSubject,
  type RuleTrigger,
} from './buildingRules';

function readings(patch: Partial<RuleReadings> = {}): RuleReadings {
  return {
    resources: {
      ore: { amount: 500, max: 1000, production: 5 },
      steel: { amount: 10, max: 1000, production: -2 },
      energy: { amount: 0, max: 0, production: 0 },
    },
    prices: { ore: 15, steel: 40 },
    energyProduction: 120,
    energyConsumption: 100,
    credits: 5000,
    pollutionPenalty: 10,
    happiness: 60,
    ...patch,
  };
}

function tile(patch: Partial<RuleTileReadings> = {}): RuleTileReadings {
  return { health: 100, depositLeftPercent: 50, ...patch };
}

function subject(patch: Partial<RuleTileSubject> = {}): RuleTileSubject {
  return { disabled: false, mode: 'normal', autoSell: [], ...patch };
}

function trigger(patch: Partial<RuleTrigger> = {}): RuleTrigger {
  return { id: 't1', metric: 'resource_fill', resource: 'ore', op: 'gt', value: 40, ...patch };
}

function rule(patch: Partial<BuildingRule> = {}): BuildingRule {
  return {
    id: 'r1',
    enabled: true,
    match: 'all',
    triggers: [trigger()],
    action: { type: 'disable' },
    ...patch,
  };
}

describe('чтение метрик', () => {
  it('заполненность склада считается от вместимости', () => {
    expect(readMetric(trigger({ metric: 'resource_fill' }), readings(), tile())).toBe(50);
  });

  it('нулевая вместимость даёт null, а не ноль', () => {
    // Ноль означал бы «склад пуст», и правило «заполненность меньше 10%» срабатывало бы
    // на ресурсе, склада под который вообще нет.
    const t = trigger({ metric: 'resource_fill', resource: 'energy' });
    expect(readMetric(t, readings(), tile())).toBeNull();
    expect(evaluateTrigger({ ...t, op: 'lt', value: 10 }, readings(), tile())).toBe(false);
  });

  it('невыбранный ресурс не читается и блок не срабатывает', () => {
    const t = trigger({ resource: undefined, op: 'lt', value: 999 });
    expect(readMetric(t, readings(), tile())).toBeNull();
    expect(evaluateTrigger(t, readings(), tile())).toBe(false);
  });

  it('покрытие энергии не делится на ноль', () => {
    const t = trigger({ metric: 'energy_coverage', resource: undefined, op: 'lt', value: 100 });
    const idle = readings({ energyConsumption: 0, energyProduction: 0 });
    expect(readMetric(t, idle, tile())).toBe(100);
    expect(evaluateTrigger(t, idle, tile())).toBe(false);

    const surplus = readings({ energyConsumption: 0, energyProduction: 50 });
    expect(readMetric(t, surplus, tile())).toBe(999);
  });

  it('баланс энергосети — производство минус потребление', () => {
    const t = trigger({ metric: 'energy_balance', resource: undefined, op: 'lt', value: 0 });
    expect(readMetric(t, readings(), tile())).toBe(20);
    expect(evaluateTrigger(t, readings({ energyProduction: 80 }), tile())).toBe(true);
  });

  it('остаток жилы без месторождения не срабатывает', () => {
    const t = trigger({ metric: 'deposit_left', resource: undefined, op: 'lt', value: 15 });
    expect(evaluateTrigger(t, readings(), tile({ depositLeftPercent: null }))).toBe(false);
    expect(evaluateTrigger(t, readings(), tile({ depositLeftPercent: 10 }))).toBe(true);
  });

  it('цена берётся с биржи, неторгуемый ресурс не читается', () => {
    const t = trigger({ metric: 'market_price', resource: 'ore', op: 'gt', value: 10 });
    expect(evaluateTrigger(t, readings(), tile())).toBe(true);
    expect(evaluateTrigger({ ...t, resource: 'energy' }, readings(), tile())).toBe(false);
  });
});

describe('объединение блоков', () => {
  it('«все» требует каждого блока, «любое» — хотя бы одного', () => {
    const triggers = [
      trigger({ id: 'a', op: 'gt', value: 40 }),   // истина: 50 > 40
      trigger({ id: 'b', op: 'gt', value: 90 }),   // ложь
    ];
    expect(evaluateRule(rule({ match: 'all', triggers }), readings(), tile())).toBe(false);
    expect(evaluateRule(rule({ match: 'any', triggers }), readings(), tile())).toBe(true);
  });

  it('правило без блоков не срабатывает никогда', () => {
    // «Все условия из пустого списка» формально истинны — но недописанное правило не
    // должно втихую выключить здание.
    expect(evaluateRule(rule({ triggers: [] }), readings(), tile())).toBe(false);
  });

  it('выключенное правило не срабатывает', () => {
    expect(evaluateRule(rule({ enabled: false }), readings(), tile())).toBe(false);
  });
});

describe('применение действий', () => {
  it('выключает здание, пока условие истинно', () => {
    const out = evaluateTileRules('1,1', [rule()], subject(), readings(), tile(), undefined);
    expect(out.changed).toBe(true);
    expect(out.next.disabled).toBe(true);
  });

  it('не откатывает действие, когда условие перестало выполняться', () => {
    // Семантика «пока истинно»: обратное действие игрок задаёт вторым правилом.
    const off = subject({ disabled: true });
    const out = evaluateTileRules('1,1', [rule()], off, readings({
      resources: { ore: { amount: 0, max: 1000, production: 0 } },
    }), tile(), undefined);
    expect(out.changed).toBe(false);
    expect(out.next.disabled).toBe(true);
  });

  it('переключает режим работы', () => {
    const r = rule({ action: { type: 'switch_mode', mode: 'economy' } });
    const out = evaluateTileRules('1,1', [r], subject(), readings(), tile(), undefined);
    expect(out.next.mode).toBe('economy');
  });

  it('несуществующий режим игнорируется', () => {
    const r = rule({ action: { type: 'switch_mode', mode: 'turbo' as never } });
    const out = evaluateTileRules('1,1', [r], subject(), readings(), tile(), undefined);
    expect(out.changed).toBe(false);
    expect(out.next.mode).toBe('normal');
  });

  it('нижнее правило переписывает верхнее', () => {
    const rules = [
      rule({ id: 'a', action: { type: 'disable' } }),
      rule({ id: 'b', action: { type: 'enable' } }),
    ];
    expect(evaluateTileRules('1,1', rules, subject({ disabled: true }), readings(), tile(), undefined).next.disabled).toBe(false);
    expect(evaluateTileRules('1,1', [...rules].reverse(), subject(), readings(), tile(), undefined).next.disabled).toBe(true);
  });

  it('включает авто-продажу с порогом и не трогает keepAmount', () => {
    const r = rule({ action: { type: 'auto_sell_on', resource: 'ore', threshold: 60 } });
    const start = subject({
      autoSell: [{ enabled: false, resource: 'ore', threshold: 80, keepAmount: '250' }],
    });
    const out = evaluateTileRules('1,1', [r], start, readings(), tile(), undefined);
    expect(out.changed).toBe(true);
    expect(out.next.autoSell[0]).toEqual({
      enabled: true,
      resource: 'ore',
      threshold: 60,
      keepAmount: '250',
    });
  });

  it('выключать нечего, если записи об авто-продаже нет', () => {
    const r = rule({ action: { type: 'auto_sell_off', resource: 'ore' } });
    const out = evaluateTileRules('1,1', [r], subject(), readings(), tile(), undefined);
    expect(out.changed).toBe(false);
    expect(out.next.autoSell).toEqual([]);
  });

  it('порог авто-продажи зажимается в 0..100', () => {
    const r = rule({ action: { type: 'auto_sell_on', resource: 'ore', threshold: 500 } });
    const out = evaluateTileRules('1,1', [r], subject(), readings(), tile(), undefined);
    expect(out.next.autoSell[0].threshold).toBe(100);
  });
});

describe('сохранение ссылки на настройки', () => {
  it('без изменений возвращается ТОТ ЖЕ объект', () => {
    // Стор сравнивает tileSettings по ссылке для кэша ставок производства: новый объект
    // каждую секунду сбрасывал бы кэш на всей базе.
    const start = subject({ disabled: true });
    const out = evaluateTileRules('1,1', [rule()], start, readings(), tile(), undefined);
    expect(out.next).toBe(start);
  });

  it('пустой список правил ничего не считает', () => {
    const start = subject();
    expect(evaluateTileRules('1,1', [], start, readings(), tile(), undefined).next).toBe(start);
    expect(evaluateTileRules('1,1', undefined, start, readings(), tile(), undefined).next).toBe(start);
  });
});

describe('уведомления', () => {
  const notifyRule = rule({ action: { type: 'notify', message: 'Склад полон' } });

  it('срабатывают по фронту, а не каждую проверку', () => {
    const first = evaluateTileRules('2,3', [notifyRule], subject(), readings(), tile(), undefined);
    expect(first.notices).toEqual([{ ruleId: 'r1', tileKey: '2,3', message: 'Склад полон' }]);

    const second = evaluateTileRules('2,3', [notifyRule], subject(), readings(), tile(), first.fired);
    expect(second.notices).toEqual([]);
  });

  it('после разрыва условия уведомляют снова', () => {
    const quiet = readings({ resources: { ore: { amount: 0, max: 1000, production: 0 } } });
    const on = evaluateTileRules('2,3', [notifyRule], subject(), readings(), tile(), undefined);
    const off = evaluateTileRules('2,3', [notifyRule], subject(), quiet, tile(), on.fired);
    expect(off.fired.r1).toBe(false);

    const again = evaluateTileRules('2,3', [notifyRule], subject(), readings(), tile(), off.fired);
    expect(again.notices).toHaveLength(1);
  });

  it('без своего текста берут описание правила', () => {
    const r = rule({ action: { type: 'notify' } });
    const out = evaluateTileRules('2,3', [r], subject(), readings(), tile(), undefined);
    expect(out.notices[0].message).toBe(describeRule(r));
  });

  it('уведомление не меняет состояние здания', () => {
    const start = subject();
    const out = evaluateTileRules('2,3', [notifyRule], start, readings(), tile(), undefined);
    expect(out.changed).toBe(false);
    expect(out.next).toBe(start);
  });
});

describe('перенос старых условий', () => {
  it('resource_above становится порогом заполненности склада', () => {
    const rules = migrateLegacyConditions([
      { id: 'c1', type: 'resource_above', resource: 'ore', value: 80, action: 'disable', enabled: true },
    ]);
    expect(rules).toHaveLength(1);
    expect(rules[0].triggers[0]).toMatchObject({ metric: 'resource_fill', resource: 'ore', op: 'gt', value: 80 });
    expect(rules[0].action).toEqual({ type: 'disable' });
  });

  it('resource_below переворачивает сравнение', () => {
    const rules = migrateLegacyConditions([
      { id: 'c1', type: 'resource_below', resource: 'ore', value: 20, action: 'enable', enabled: true },
    ]);
    expect(rules[0].triggers[0]).toMatchObject({ op: 'lt', value: 20 });
  });

  it('energy_available становится покрытием энергии', () => {
    const rules = migrateLegacyConditions([
      { id: 'c1', type: 'energy_available', value: 80, action: 'enable', enabled: true },
    ]);
    expect(rules[0].triggers[0]).toMatchObject({ metric: 'energy_coverage', op: 'gt', value: 80 });
  });

  it('time_of_day выбрасывается: источника данных в игре нет', () => {
    expect(migrateLegacyConditions([
      { id: 'c1', type: 'time_of_day', value: 12, action: 'enable', enabled: true },
    ])).toEqual([]);
  });

  it('мусор не роняет перенос', () => {
    expect(migrateLegacyConditions(undefined)).toEqual([]);
    expect(migrateLegacyConditions('nope')).toEqual([]);
    expect(migrateLegacyConditions([null, 42, {}, { type: 'resource_above' }])).toEqual([]);
  });

  it('switch_mode без режима отбрасывается', () => {
    expect(migrateLegacyConditions([
      { id: 'c1', type: 'energy_available', value: 80, action: 'switch_mode', enabled: true },
    ])).toEqual([]);
  });

  it('перенесённые правила действительно исполняются', () => {
    // Смысл всей затеи: старое условие не просто переехало, а начало работать.
    const rules = migrateLegacyConditions([
      { id: 'c1', type: 'resource_above', resource: 'ore', value: 40, action: 'disable', enabled: true },
    ]);
    const out = evaluateTileRules('1,1', rules, subject(), readings(), tile(), undefined);
    expect(out.next.disabled).toBe(true);
  });
});

describe('rulesOf', () => {
  it('пустой список правил не воскрешает старые условия', () => {
    const legacy = [{ id: 'c1', type: 'resource_above', resource: 'ore', value: 40, action: 'disable', enabled: true }];
    expect(rulesOf({ rules: [], conditions: legacy })).toEqual([]);
    expect(rulesOf({ conditions: legacy })).toHaveLength(1);
    expect(rulesOf(undefined)).toEqual([]);
  });
});

describe('проверка правила', () => {
  it('исправное правило без замечаний', () => {
    expect(validateRule(rule())).toEqual([]);
  });

  it('ловит невыбранный ресурс, пустые блоки и режим', () => {
    expect(validateRule(rule({ triggers: [] }))).toHaveLength(1);
    expect(validateRule(rule({ triggers: [trigger({ resource: undefined })] }))).toHaveLength(1);
    expect(validateRule(rule({ action: { type: 'switch_mode' } }))).toHaveLength(1);
    expect(validateRule(rule({ action: { type: 'auto_sell_on' } }))).toHaveLength(1);
  });

  it('ловит нечисловой порог', () => {
    expect(validateRule(rule({ triggers: [trigger({ value: NaN })] }))).toHaveLength(1);
  });
});

describe('готовые сценарии', () => {
  it('собранные шаблоны проходят собственную проверку', () => {
    const ctx = { produced: 'ore' as const, consumed: 'energy' as const, tradeableProduced: 'ore' as const };
    for (const template of RULE_TEMPLATES) {
      const built = template.build(ctx, 'seed');
      expect(built, template.id).not.toBeNull();
      expect(validateRule(built!), template.id).toEqual([]);
    }
  });

  it('шаблоны, требующие ресурса, не предлагаются зданию без него', () => {
    const list = availableTemplates({});
    expect(list.length).toBeGreaterThan(0);
    expect(list.every(t => t.build({}, 'seed') !== null)).toBe(true);
    expect(list.length).toBeLessThan(RULE_TEMPLATES.length);
  });

  it('id блоков внутри правила уникальны', () => {
    const built = RULE_TEMPLATES.find(t => t.id === 'stop_on_starvation')!.build({ consumed: 'energy' }, 'seed')!;
    const ids = built.triggers.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('описание', () => {
  it('в текст попадает подпись ресурса, а не сырой id', () => {
    const text = describeRule(rule({ name: undefined }));
    expect(text).toContain('Руда');
    expect(text).not.toContain('ore');
  });

  it('своё имя правила важнее собранного описания', () => {
    expect(describeRule(rule({ name: 'Моё правило' }))).toBe('Моё правило');
  });
});

describe('кто управляет ручным переключателем', () => {
  const power = rule({ id: 'p', action: { type: 'disable' } });
  const mode = rule({ id: 'm', action: { type: 'switch_mode', mode: 'economy' } });
  const sellOre = rule({ id: 's1', action: { type: 'auto_sell_on', resource: 'ore', threshold: 50 } });
  const sellSteel = rule({ id: 's2', action: { type: 'auto_sell_off', resource: 'steel' } });
  const all = [power, mode, sellOre, sellSteel];

  it('различает остановку, режим и авто-продажу', () => {
    expect(rulesControlling(all, 'power').map(r => r.id)).toEqual(['p']);
    expect(rulesControlling(all, 'mode').map(r => r.id)).toEqual(['m']);
    expect(rulesControlling(all, 'autoSell').map(r => r.id)).toEqual(['s1', 's2']);
  });

  it('авто-продажа считается по конкретному ресурсу', () => {
    // Продажа стали не должна помечать тумблер руды: игрок решил бы, что тот сломан.
    expect(rulesControlling(all, 'autoSell', 'ore').map(r => r.id)).toEqual(['s1']);
    expect(rulesControlling(all, 'autoSell', 'steel').map(r => r.id)).toEqual(['s2']);
    expect(rulesControlling(all, 'autoSell', 'ice')).toEqual([]);
  });

  it('выключенные правила ничем не распоряжаются', () => {
    // Они ничего не перещёлкнут, и запирать из-за них ручное управление значило бы врать.
    expect(rulesControlling([{ ...power, enabled: false }], 'power')).toEqual([]);
  });

  it('пустой список правил безопасен', () => {
    expect(rulesControlling(undefined, 'power')).toEqual([]);
    expect(rulesControlling([], 'power')).toEqual([]);
  });
});

describe('здания, которые нельзя останавливать', () => {
  it('действия включения и выключения не предлагаются', () => {
    const ids = availableActions(false).map(a => a.id);
    expect(ids).not.toContain('enable');
    expect(ids).not.toContain('disable');
    expect(ids).toContain('notify');
    expect(availableActions(true).map(a => a.id)).toContain('disable');
  });

  it('уже собранное правило остановки помечается замечанием', () => {
    // Молча не срабатывающее правило — та же обманка, что и старая вкладка «Условия».
    expect(validateRule(rule({ action: { type: 'disable' } }), false)).toHaveLength(1);
    expect(validateRule(rule({ action: { type: 'notify' } }), false)).toEqual([]);
  });
});
