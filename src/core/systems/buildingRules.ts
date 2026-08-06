/**
 * ПРАВИЛА АВТОМАТИЗАЦИИ ЗДАНИЙ
 *
 * Заменяет вкладку «Условия» из «Фазы 5», которая была обманкой: условия складывались в
 * `tileSettings.conditions`, доезжали до сейва — и НИКТО их не читал. Во всём тике не было
 * ни одной проверки; редактора тоже не было, кнопка «+ Добавить условие» всегда вставляла
 * один и тот же захардкоженный «энергия > 80% → включить». Игрок настраивал автоматизацию,
 * которой не существовало.
 *
 * Здесь — единственное место, где живёт и смысл правил, и их вычисление. Модуль ЧИСТЫЙ:
 * на вход снимок показаний, на выход список эффектов. Стор только читает состояние в
 * `RuleReadings` и применяет эффекты — так правила можно проверить тестами без сетки,
 * рынка и рендера.
 *
 * СЕМАНТИКА — СОСТОЯНИЕ, А НЕ СОБЫТИЕ. Правило действует, ПОКА условие истинно, и ничего
 * не откатывает, когда оно перестало быть истинным. Иначе пришлось бы помнить «что было до
 * срабатывания» и разбираться, чей откат главнее, когда правил несколько. Пары правил
 * («мало руды → выключить», «много руды → включить») игрок пишет сам, и это читается
 * однозначно. Исключение — «Уведомить»: оно срабатывает по ФРОНТУ (ложь → истина), иначе
 * при частоте раз в секунду тост дублировался бы бесконечно.
 *
 * ПОРЯДОК ВАЖЕН: правила применяются сверху вниз, последнее сработавшее переписывает
 * предыдущее. Это делает конфликт двух истинных правил предсказуемым вместо «как повезёт».
 */

import type { ResourceType } from '../gameTypes';
import type { AutoSellConfig, BuildingMode } from '../gameTypes.buildings';
import { BUILDING_MODES } from '../gameTypes.buildings';
import { resourceLabel } from '../i18n/label';

// ═══════════════════════════════════════════════════════════════
// МЕТРИКИ (блоки-триггеры)
// ═══════════════════════════════════════════════════════════════

/**
 * Что именно читает блок-условие.
 *
 * Список намеренно ограничен теми величинами, у которых В ИГРЕ ЕСТЬ ИСТОЧНИК ДАННЫХ.
 * «Время суток» из старой модели выброшено (игрового времени суток нет), «простой здания»
 * не заведён: `TileBuildingSettings.stats` тик не обновляет, и триггер по uptime всегда
 * читал бы единицу, записанную при создании клетки, — вторая обманка вместо первой.
 */
export type RuleMetric =
  // Ресурсы и склад
  | 'resource_amount'
  | 'resource_fill'
  | 'resource_rate'
  // Энергия и финансы
  | 'energy_balance'
  | 'energy_coverage'
  | 'credits'
  // Рынок
  | 'market_price'
  // Состояние базы и здания
  | 'building_health'
  | 'deposit_left'
  | 'pollution_penalty'
  | 'happiness';

/** Группа метрики — по ней сгруппирован выпадающий список в редакторе. */
export type RuleMetricGroup = 'resources' | 'energy' | 'market' | 'base';

export const RULE_GROUP_LABEL: Record<RuleMetricGroup, string> = {
  resources: 'Ресурсы и склад',
  energy: 'Энергия и финансы',
  market: 'Рынок',
  base: 'База и здание',
};

export interface RuleMetricMeta {
  id: RuleMetric;
  group: RuleMetricGroup;
  label: string;
  /** Нужен ли выбор ресурса рядом с метрикой. */
  needsResource: boolean;
  /** Ресурс выбирается только из торгуемых на бирже. */
  tradeableOnly?: boolean;
  /** Подпись к числу в редакторе: «%», «/с», «₡» или пусто. */
  unit: string;
  /** Что означает значение — показывается подсказкой под блоком. */
  hint: string;
  /** Значение нового блока: осмысленное, чтобы правило работало сразу после добавления. */
  defaultValue: number;
}

export const RULE_METRICS: Record<RuleMetric, RuleMetricMeta> = {
  resource_amount: {
    id: 'resource_amount',
    group: 'resources',
    label: 'Запас ресурса',
    needsResource: true,
    unit: 'ед.',
    hint: 'Сколько ресурса лежит на складах базы.',
    defaultValue: 1000,
  },
  resource_fill: {
    id: 'resource_fill',
    group: 'resources',
    label: 'Заполненность склада',
    needsResource: true,
    unit: '%',
    hint: 'Запас в процентах от вместимости складов по этому ресурсу.',
    defaultValue: 80,
  },
  resource_rate: {
    id: 'resource_rate',
    group: 'resources',
    label: 'Чистая добыча',
    needsResource: true,
    unit: '/с',
    hint: 'Выпуск минус потребление за секунду. Отрицательное значение — ресурс проедается.',
    defaultValue: 0,
  },
  energy_balance: {
    id: 'energy_balance',
    group: 'energy',
    label: 'Баланс энергосети',
    needsResource: false,
    unit: 'ед./с',
    hint: 'Производство минус потребление. Ниже нуля — дефицит.',
    defaultValue: 0,
  },
  energy_coverage: {
    id: 'energy_coverage',
    group: 'energy',
    label: 'Покрытие энергии',
    needsResource: false,
    unit: '%',
    hint: 'Сколько процентов потребления покрывает выработка. 100% — впритык.',
    defaultValue: 100,
  },
  credits: {
    id: 'credits',
    group: 'energy',
    label: 'Кредиты',
    needsResource: false,
    unit: '₡',
    hint: 'Текущий баланс кредитов.',
    defaultValue: 10000,
  },
  market_price: {
    id: 'market_price',
    group: 'market',
    label: 'Цена на бирже',
    needsResource: true,
    tradeableOnly: true,
    unit: '₡',
    hint: 'Текущая биржевая цена ресурса за единицу.',
    defaultValue: 10,
  },
  building_health: {
    id: 'building_health',
    group: 'base',
    label: 'Здоровье здания',
    needsResource: false,
    unit: '%',
    hint: 'Износ именно этого здания. Разгон изнашивает, экономия чинит.',
    defaultValue: 50,
  },
  deposit_left: {
    id: 'deposit_left',
    group: 'base',
    label: 'Остаток жилы',
    needsResource: false,
    unit: '%',
    hint: 'Сколько осталось в месторождении под зданием. Без жилы блок не срабатывает.',
    defaultValue: 20,
  },
  pollution_penalty: {
    id: 'pollution_penalty',
    group: 'base',
    label: 'Штраф загрязнения',
    needsResource: false,
    unit: '%',
    hint: 'Насколько загрязнение режет производство по всей базе.',
    defaultValue: 20,
  },
  happiness: {
    id: 'happiness',
    group: 'base',
    label: 'Счастье населения',
    needsResource: false,
    unit: '%',
    hint: 'Текущий уровень счастья: 0 — бунт, 100 — праздник.',
    defaultValue: 40,
  },
};

/** Метрики в порядке показа в редакторе — сгруппированы, внутри группы в порядке объявления. */
export const RULE_METRIC_GROUPS: Array<{ group: RuleMetricGroup; metrics: RuleMetricMeta[] }> = (
  ['resources', 'energy', 'market', 'base'] as RuleMetricGroup[]
).map((group) => ({
  group,
  metrics: Object.values(RULE_METRICS).filter((m) => m.group === group),
}));

// ═══════════════════════════════════════════════════════════════
// БЛОКИ И ПРАВИЛА
// ═══════════════════════════════════════════════════════════════

/** Сравнение. Только «больше»/«меньше»: точное равенство для дробных ставок бесполезно. */
export type RuleComparator = 'gt' | 'lt';

export const COMPARATOR_LABEL: Record<RuleComparator, string> = {
  gt: 'больше',
  lt: 'меньше',
};

export const COMPARATOR_SIGN: Record<RuleComparator, string> = {
  gt: '>',
  lt: '<',
};

/** Один блок-условие. */
export interface RuleTrigger {
  id: string;
  metric: RuleMetric;
  /** Для метрик с needsResource. */
  resource?: ResourceType;
  op: RuleComparator;
  value: number;
}

export type RuleActionType =
  | 'enable'
  | 'disable'
  | 'switch_mode'
  | 'auto_sell_on'
  | 'auto_sell_off'
  | 'notify';

export interface RuleActionMeta {
  id: RuleActionType;
  label: string;
  emoji: string;
  /** Нужен выбор режима работы. */
  needsMode: boolean;
  /** Нужен выбор ресурса. */
  needsResource: boolean;
  /** Нужен порог авто-продажи. */
  needsThreshold: boolean;
  hint: string;
}

export const RULE_ACTIONS: Record<RuleActionType, RuleActionMeta> = {
  enable: {
    id: 'enable',
    label: 'Включить здание',
    emoji: '▶️',
    needsMode: false,
    needsResource: false,
    needsThreshold: false,
    hint: 'Здание начинает производить и потреблять.',
  },
  disable: {
    id: 'disable',
    label: 'Выключить здание',
    emoji: '⏸️',
    needsMode: false,
    needsResource: false,
    needsThreshold: false,
    hint: 'Здание перестаёт работать и потреблять ресурсы.',
  },
  switch_mode: {
    id: 'switch_mode',
    label: 'Сменить режим',
    emoji: '⚙️',
    needsMode: true,
    needsResource: false,
    needsThreshold: false,
    hint: 'Переключить на разгон, экономию или другой режим.',
  },
  auto_sell_on: {
    id: 'auto_sell_on',
    label: 'Включить авто-продажу',
    emoji: '💰',
    needsMode: false,
    needsResource: true,
    needsThreshold: true,
    hint: 'Включает авто-продажу ресурса и задаёт порог заполнения склада.',
  },
  auto_sell_off: {
    id: 'auto_sell_off',
    label: 'Выключить авто-продажу',
    emoji: '🚫',
    needsMode: false,
    needsResource: true,
    needsThreshold: false,
    hint: 'Перестать продавать ресурс автоматически.',
  },
  notify: {
    id: 'notify',
    label: 'Уведомить игрока',
    emoji: '🔔',
    needsMode: false,
    needsResource: false,
    needsThreshold: false,
    hint: 'Показывает уведомление один раз при срабатывании, поведение здания не меняет.',
  },
};

export interface RuleAction {
  type: RuleActionType;
  /** Для switch_mode. */
  mode?: BuildingMode;
  /** Для auto_sell_on / auto_sell_off. */
  resource?: ResourceType;
  /** Для auto_sell_on, % заполнения склада. */
  threshold?: number;
  /** Для notify. Пусто — текст соберётся из описания правила. */
  message?: string;
}

/** Как объединяются блоки внутри правила. */
export type RuleMatch = 'all' | 'any';

export const MATCH_LABEL: Record<RuleMatch, string> = {
  all: 'Все условия (И)',
  any: 'Любое условие (ИЛИ)',
};

export interface BuildingRule {
  id: string;
  /** Своё имя правила. Пусто — в списке покажется собранное описание. */
  name?: string;
  enabled: boolean;
  match: RuleMatch;
  triggers: RuleTrigger[];
  action: RuleAction;
}

// ═══════════════════════════════════════════════════════════════
// ПОКАЗАНИЯ
// ═══════════════════════════════════════════════════════════════

/**
 * Снимок общебазовых величин. Числа, а не Decimal: пороги игрок задаёт обычным числом, а
 * `Decimal.toNumber()` на запредельных значениях даёт Infinity — сравнение «больше/меньше»
 * при этом остаётся верным, теряется только точность, которая в пороге и не нужна.
 */
export interface RuleReadings {
  resources: Partial<Record<ResourceType, { amount: number; max: number; production: number }>>;
  energyProduction: number;
  energyConsumption: number;
  credits: number;
  prices: Partial<Record<ResourceType, number>>;
  /** Штраф загрязнения в процентах: 0 — чисто, 100 — производство встало. */
  pollutionPenalty: number;
  /** Счастье 0..100. */
  happiness: number;
}

/** Показания, относящиеся к конкретной клетке. */
export interface RuleTileReadings {
  health: number;
  /** Остаток жилы в процентах. null — жилы под клеткой нет, блок не срабатывает. */
  depositLeftPercent: number | null;
}

/**
 * Прочитать метрику. `null` — «прочитать нечем» (ресурс не выбран, жилы нет): такой блок
 * считается НЕ выполненным, а не выполненным с нулём. Ноль здесь означал бы «пусто», и
 * правило «запас меньше 100» срабатывало бы на каждом недонастроенном блоке.
 */
export function readMetric(
  trigger: RuleTrigger,
  readings: RuleReadings,
  tile: RuleTileReadings,
): number | null {
  const meta = RULE_METRICS[trigger.metric];
  if (!meta) return null;
  if (meta.needsResource && !trigger.resource) return null;

  switch (trigger.metric) {
    case 'resource_amount':
      return readings.resources[trigger.resource!]?.amount ?? 0;

    case 'resource_fill': {
      const res = readings.resources[trigger.resource!];
      if (!res || !(res.max > 0)) return null;
      return (res.amount / res.max) * 100;
    }

    case 'resource_rate':
      return readings.resources[trigger.resource!]?.production ?? 0;

    case 'energy_balance':
      return readings.energyProduction - readings.energyConsumption;

    case 'energy_coverage': {
      // Нулевое потребление — это не «нет покрытия», а «покрывать нечего»: без потолка
      // деление дало бы Infinity, и «покрытие меньше 100%» молча стало бы ложью навсегда.
      if (!(readings.energyConsumption > 0)) return readings.energyProduction > 0 ? 999 : 100;
      return (readings.energyProduction / readings.energyConsumption) * 100;
    }

    case 'credits':
      return readings.credits;

    case 'market_price':
      return readings.prices[trigger.resource!] ?? null;

    case 'building_health':
      return tile.health;

    case 'deposit_left':
      return tile.depositLeftPercent;

    case 'pollution_penalty':
      return readings.pollutionPenalty;

    case 'happiness':
      return readings.happiness;

    default:
      return null;
  }
}

/** Выполнен ли один блок. */
export function evaluateTrigger(
  trigger: RuleTrigger,
  readings: RuleReadings,
  tile: RuleTileReadings,
): boolean {
  const current = readMetric(trigger, readings, tile);
  if (current === null || !Number.isFinite(trigger.value)) return false;
  return trigger.op === 'gt' ? current > trigger.value : current < trigger.value;
}

/**
 * Выполнено ли правило целиком.
 *
 * Правило БЕЗ блоков не срабатывает никогда, хотя «все условия из пустого списка» формально
 * истинны: недописанное правило не должно втихую выключить здание.
 */
export function evaluateRule(
  rule: BuildingRule,
  readings: RuleReadings,
  tile: RuleTileReadings,
): boolean {
  if (!rule.enabled) return false;
  if (!rule.triggers || rule.triggers.length === 0) return false;

  return rule.match === 'any'
    ? rule.triggers.some((t) => evaluateTrigger(t, readings, tile))
    : rule.triggers.every((t) => evaluateTrigger(t, readings, tile));
}

// ═══════════════════════════════════════════════════════════════
// ЭФФЕКТЫ
// ═══════════════════════════════════════════════════════════════

/**
 * Состояние клетки, которое правила читают и меняют.
 *
 * `disabled` — то же самое `grid.tileDisabled`, что переключает кнопка «ОТКЛЮЧИТЬ» в
 * инспекторе и что читают карта, массовое выделение и энергобаланс. Отдельного «включено»
 * в настройках здания больше нет: два флага расходились, и правило, выключившее здание,
 * не меняло кнопку.
 */
export interface RuleTileSubject {
  disabled: boolean;
  mode: BuildingMode;
  autoSell: AutoSellConfig[];
}

export interface RuleNotice {
  ruleId: string;
  tileKey: string;
  message: string;
}

export interface RuleTileOutcome {
  /** Новое состояние клетки. ТОТ ЖЕ объект, если ничего не изменилось. */
  next: RuleTileSubject;
  changed: boolean;
  /** Уведомления, накопленные по фронту срабатывания. */
  notices: RuleNotice[];
  /** Какие правила сейчас истинны — вход следующего вызова, чтобы ловить фронт. */
  fired: Record<string, boolean>;
}

/**
 * Прогнать правила одной клетки.
 *
 * `prevFired` — какие правила были истинны в прошлый раз; нужен ТОЛЬКО для «Уведомить».
 * Хранить его в сейве незачем: после перезагрузки повторное уведомление безобидно, а лишнее
 * поле в сохранении — это второй источник правды, который однажды разойдётся с правилами.
 *
 * Возвращает тот же объект состояния, если ни одно правило ничего не поменяло: стор кладёт
 * `tileSettings` в кэш ставок производства по ССЫЛКЕ (`tileSettingsRef`), и новый объект
 * каждую секунду сбрасывал бы этот кэш на всей базе.
 */
export function evaluateTileRules(
  tileKey: string,
  rules: BuildingRule[] | undefined,
  subject: RuleTileSubject,
  readings: RuleReadings,
  tile: RuleTileReadings,
  prevFired: Record<string, boolean> | undefined,
): RuleTileOutcome {
  const fired: Record<string, boolean> = {};
  const notices: RuleNotice[] = [];

  if (!rules || rules.length === 0) {
    return { next: subject, changed: false, notices, fired };
  }

  let disabled = subject.disabled;
  let mode = subject.mode;
  let autoSell = subject.autoSell;
  let autoSellChanged = false;

  for (const rule of rules) {
    const active = evaluateRule(rule, readings, tile);
    if (rule.enabled) fired[rule.id] = active;
    if (!active) continue;

    const action = rule.action;
    switch (action.type) {
      case 'enable':
        disabled = false;
        break;

      case 'disable':
        disabled = true;
        break;

      case 'switch_mode':
        if (action.mode && BUILDING_MODES[action.mode]) mode = action.mode;
        break;

      case 'auto_sell_on':
      case 'auto_sell_off': {
        const resource = action.resource;
        if (!resource) break;
        const wantEnabled = action.type === 'auto_sell_on';
        const threshold = wantEnabled ? clampThreshold(action.threshold) : undefined;
        const idx = autoSell.findIndex((c) => c.resource === resource);
        const current = idx >= 0 ? autoSell[idx] : undefined;

        const alreadyRight =
          current &&
          current.enabled === wantEnabled &&
          (threshold === undefined || current.threshold === threshold);
        if (alreadyRight) break;
        // Выключать нечего, если записи об этом ресурсе вообще нет.
        if (!current && !wantEnabled) break;

        const nextConfig: AutoSellConfig = {
          ...(current ?? { resource, threshold: threshold ?? 80, keepAmount: '0' }),
          enabled: wantEnabled,
          resource,
          ...(threshold !== undefined ? { threshold } : {}),
        };

        const copy = autoSellChanged ? autoSell : [...autoSell];
        if (idx >= 0) copy[idx] = nextConfig;
        else copy.push(nextConfig);
        autoSell = copy;
        autoSellChanged = true;
        break;
      }

      case 'notify': {
        // Только по фронту: при проверке раз в секунду постоянно истинное правило иначе
        // выдавало бы тост каждую секунду и забило бы весь список уведомлений.
        if (prevFired?.[rule.id]) break;
        notices.push({
          ruleId: rule.id,
          tileKey,
          message: action.message?.trim() || describeRule(rule),
        });
        break;
      }
    }
  }

  const changed = disabled !== subject.disabled || mode !== subject.mode || autoSellChanged;
  return {
    next: changed ? { disabled, mode, autoSell } : subject,
    changed,
    notices,
    fired,
  };
}

/**
 * Каким ручным переключателем распоряжаются правила.
 *
 * Нужно интерфейсу: переключатель, который правило перещёлкнет обратно через секунду, обязан
 * сказать об этом ЗАРАНЕЕ. Молча возвращающийся тумблер читается как неработающая кнопка.
 */
export type RuleControlKind = 'power' | 'mode' | 'autoSell';

const CONTROL_ACTIONS: Record<RuleControlKind, RuleActionType[]> = {
  power: ['enable', 'disable'],
  mode: ['switch_mode'],
  autoSell: ['auto_sell_on', 'auto_sell_off'],
};

/**
 * Включённые правила, управляющие этим переключателем. Для `autoSell` — только те, что
 * трогают указанный ресурс: продажа стали не должна блокировать тумблер руды.
 *
 * Выключенные правила не считаются: они ничего не перещёлкнут, и запирать из-за них ручное
 * управление значило бы врать.
 */
/**
 * Действия, доступные зданию.
 *
 * У неотключаемых зданий (`isBuildingDisableable === false`) кнопки «ОТКЛЮЧИТЬ» нет, и
 * остановленное правилом здание игрок не смог бы вернуть руками — стор такие правила и не
 * применяет. Предлагать их в редакторе значило бы снова дать собрать правило, которое молча
 * не работает: ровно та обманка, ради устранения которой всё это и затевалось.
 */
export function availableActions(canDisable: boolean): RuleActionMeta[] {
  const all = Object.values(RULE_ACTIONS);
  return canDisable ? all : all.filter((a) => a.id !== 'enable' && a.id !== 'disable');
}

export function rulesControlling(
  rules: BuildingRule[] | undefined,
  kind: RuleControlKind,
  resource?: ResourceType,
): BuildingRule[] {
  if (!rules || rules.length === 0) return [];
  const wanted = CONTROL_ACTIONS[kind];

  return rules.filter((rule) => {
    if (!rule.enabled) return false;
    if (!wanted.includes(rule.action?.type)) return false;
    if (kind === 'autoSell' && resource) return rule.action.resource === resource;
    return true;
  });
}

function clampThreshold(value: number | undefined): number {
  if (!Number.isFinite(value)) return 80;
  return Math.max(0, Math.min(100, Math.round(value as number)));
}

// ═══════════════════════════════════════════════════════════════
// ОПИСАНИЕ ДЛЯ ИНТЕРФЕЙСА
// ═══════════════════════════════════════════════════════════════

/** «Заполненность склада (Руда) > 80%». Сырой id ресурса сюда не попадает никогда. */
export function describeTrigger(trigger: RuleTrigger): string {
  const meta = RULE_METRICS[trigger.metric];
  if (!meta) return 'Неизвестное условие';

  const subject = meta.needsResource
    ? `${meta.label} (${trigger.resource ? resourceLabel(trigger.resource) : 'ресурс не выбран'})`
    : meta.label;

  return `${subject} ${COMPARATOR_SIGN[trigger.op]} ${formatTriggerValue(trigger.value)}${meta.unit}`;
}

function formatTriggerValue(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export function describeAction(action: RuleAction): string {
  const meta = RULE_ACTIONS[action.type];
  if (!meta) return 'Неизвестное действие';

  switch (action.type) {
    case 'switch_mode':
      return action.mode
        ? `Режим: ${BUILDING_MODES[action.mode]?.name ?? action.mode}`
        : 'Сменить режим (режим не выбран)';
    case 'auto_sell_on':
      return action.resource
        ? `Продавать ${resourceLabel(action.resource)} при ${clampThreshold(action.threshold)}%`
        : 'Включить авто-продажу (ресурс не выбран)';
    case 'auto_sell_off':
      return action.resource
        ? `Не продавать ${resourceLabel(action.resource)}`
        : 'Выключить авто-продажу (ресурс не выбран)';
    default:
      return meta.label;
  }
}

/** Полное описание правила одной строкой — заголовок карточки и текст уведомления. */
export function describeRule(rule: BuildingRule): string {
  if (rule.name?.trim()) return rule.name.trim();
  if (!rule.triggers || rule.triggers.length === 0) return 'Правило без условий';

  const joiner = rule.match === 'any' ? ' ИЛИ ' : ' И ';
  const when = rule.triggers.map(describeTrigger).join(joiner);
  return `Если ${when} → ${describeAction(rule.action)}`;
}

/**
 * Чего правилу не хватает, чтобы работать. Пустой массив — правило исправно.
 * Показывается в редакторе: молча не срабатывающее правило игрок принял бы за поломку.
 *
 * `canDisable` — умеет ли игра вообще останавливать это здание. По умолчанию `true`, чтобы
 * проверку можно было звать там, где здание неизвестно.
 */
export function validateRule(rule: BuildingRule, canDisable = true): string[] {
  const problems: string[] = [];

  if (!rule.triggers || rule.triggers.length === 0) {
    problems.push('Нет ни одного условия — правило никогда не сработает.');
  }

  for (const trigger of rule.triggers ?? []) {
    const meta = RULE_METRICS[trigger.metric];
    if (!meta) {
      problems.push('Неизвестное условие.');
      continue;
    }
    if (meta.needsResource && !trigger.resource) {
      problems.push(`«${meta.label}»: не выбран ресурс.`);
    }
    if (!Number.isFinite(trigger.value)) {
      problems.push(`«${meta.label}»: не задано значение.`);
    }
  }

  const actionMeta = RULE_ACTIONS[rule.action?.type];
  if (!actionMeta) {
    problems.push('Не выбрано действие.');
  } else if (canDisable === false && (rule.action.type === 'enable' || rule.action.type === 'disable')) {
    problems.push('Это здание нельзя останавливать — действие не сработает.');
  } else {
    if (actionMeta.needsMode && !rule.action.mode) problems.push('Не выбран режим работы.');
    if (actionMeta.needsResource && !rule.action.resource) problems.push('Не выбран ресурс для авто-продажи.');
  }

  return problems;
}

// ═══════════════════════════════════════════════════════════════
// ГОТОВЫЕ СЦЕНАРИИ
// ═══════════════════════════════════════════════════════════════

/**
 * Что известно о здании, к которому применяют шаблон. Шаблон, которому нужен ресурс,
 * подставляет ресурс самого здания: «продавать сталь при высокой цене» на шахте — бессмыслица.
 */
export interface RuleTemplateContext {
  /** Первый производимый ресурс. */
  produced?: ResourceType;
  /** Первый потребляемый ресурс. */
  consumed?: ResourceType;
  /** Первый производимый ресурс, который торгуется на бирже. */
  tradeableProduced?: ResourceType;
}

export interface RuleTemplate {
  id: string;
  name: string;
  emoji: string;
  description: string;
  /** `null` — шаблон не подходит зданию (нужен ресурс, которого у него нет). */
  build: (ctx: RuleTemplateContext, idSeed: string) => BuildingRule | null;
}

function makeRule(
  idSeed: string,
  name: string,
  match: RuleMatch,
  triggers: Array<Omit<RuleTrigger, 'id'>>,
  action: RuleAction,
): BuildingRule {
  return {
    id: `rule_${idSeed}`,
    name,
    enabled: true,
    match,
    triggers: triggers.map((t, i) => ({ ...t, id: `rule_${idSeed}_t${i}` })),
    action,
  };
}

/**
 * Заготовки под типовые сценарии. Нужны не для экономии кликов, а как ОБРАЗЦЫ: чистый
 * конструктор из пустого списка не подсказывает, что вообще имеет смысл автоматизировать,
 * и вкладка снова читалась бы как декоративная.
 */
export const RULE_TEMPLATES: RuleTemplate[] = [
  {
    id: 'save_energy',
    name: 'Беречь энергию',
    emoji: '🔌',
    description: 'Выключает здание, когда выработка перестаёт покрывать потребление базы.',
    build: (_ctx, seed) =>
      makeRule(seed, 'Беречь энергию', 'all', [{ metric: 'energy_coverage', op: 'lt', value: 100 }], {
        type: 'disable',
      }),
  },
  {
    id: 'resume_on_energy',
    name: 'Вернуть при запасе энергии',
    emoji: '🔋',
    description: 'Пара к «Беречь энергию»: включает обратно, когда появился запас.',
    build: (_ctx, seed) =>
      makeRule(seed, 'Вернуть при запасе энергии', 'all', [{ metric: 'energy_coverage', op: 'gt', value: 120 }], {
        type: 'enable',
      }),
  },
  {
    id: 'overclock_on_surplus',
    name: 'Разгон на избытке',
    emoji: '⚡',
    description: 'Переводит в разгон, пока энергии заметно больше, чем нужно базе.',
    build: (_ctx, seed) =>
      makeRule(seed, 'Разгон на избытке', 'all', [{ metric: 'energy_coverage', op: 'gt', value: 160 }], {
        type: 'switch_mode',
        mode: 'overclock',
      }),
  },
  {
    id: 'economy_on_deficit',
    name: 'Экономия при дефиците',
    emoji: '💰',
    description: 'Переводит в экономию, когда энергосеть уходит в минус.',
    build: (_ctx, seed) =>
      makeRule(seed, 'Экономия при дефиците', 'all', [{ metric: 'energy_balance', op: 'lt', value: 0 }], {
        type: 'switch_mode',
        mode: 'economy',
      }),
  },
  {
    id: 'stop_on_full',
    name: 'Стоп на полном складе',
    emoji: '📦',
    description: 'Выключает здание, когда его продукцию больше некуда девать.',
    build: (ctx, seed) =>
      ctx.produced
        ? makeRule(seed, 'Стоп на полном складе', 'all', [
            { metric: 'resource_fill', resource: ctx.produced, op: 'gt', value: 95 },
          ], { type: 'disable' })
        : null,
  },
  {
    id: 'resume_on_space',
    name: 'Пуск при свободном складе',
    emoji: '📥',
    description: 'Пара к «Стоп на полном складе»: включает обратно, когда место освободилось.',
    build: (ctx, seed) =>
      ctx.produced
        ? makeRule(seed, 'Пуск при свободном складе', 'all', [
            { metric: 'resource_fill', resource: ctx.produced, op: 'lt', value: 80 },
          ], { type: 'enable' })
        : null,
  },
  {
    id: 'stop_on_starvation',
    name: 'Не проедать сырьё',
    emoji: '🥀',
    description: 'Выключает здание, когда его сырьё уходит в минус по всей базе.',
    build: (ctx, seed) =>
      ctx.consumed
        ? makeRule(seed, 'Не проедать сырьё', 'any', [
            { metric: 'resource_rate', resource: ctx.consumed, op: 'lt', value: 0 },
            { metric: 'resource_fill', resource: ctx.consumed, op: 'lt', value: 5 },
          ], { type: 'disable' })
        : null,
  },
  {
    id: 'sell_on_peak',
    name: 'Продавать на пике цены',
    emoji: '📈',
    description: 'Включает авто-продажу, когда биржевая цена поднялась выше порога.',
    build: (ctx, seed) =>
      ctx.tradeableProduced
        ? makeRule(seed, 'Продавать на пике цены', 'all', [
            { metric: 'market_price', resource: ctx.tradeableProduced, op: 'gt', value: 20 },
          ], { type: 'auto_sell_on', resource: ctx.tradeableProduced, threshold: 50 })
        : null,
  },
  {
    id: 'hold_on_dip',
    name: 'Придержать в просадку',
    emoji: '📉',
    description: 'Пара к «Продавать на пике»: перестаёт продавать, пока цена низкая.',
    build: (ctx, seed) =>
      ctx.tradeableProduced
        ? makeRule(seed, 'Придержать в просадку', 'all', [
            { metric: 'market_price', resource: ctx.tradeableProduced, op: 'lt', value: 12 },
          ], { type: 'auto_sell_off', resource: ctx.tradeableProduced })
        : null,
  },
  {
    id: 'stop_on_wear',
    name: 'Стоп при износе',
    emoji: '🔧',
    description: 'Выключает здание до ремонта, когда здоровье упало ниже трети.',
    build: (_ctx, seed) =>
      makeRule(seed, 'Стоп при износе', 'all', [{ metric: 'building_health', op: 'lt', value: 30 }], {
        type: 'disable',
      }),
  },
  {
    id: 'warn_deposit',
    name: 'Предупредить о выработке жилы',
    emoji: '⛏️',
    description: 'Одно уведомление, когда месторождение под зданием подходит к концу.',
    build: (_ctx, seed) =>
      makeRule(seed, 'Жила заканчивается', 'all', [{ metric: 'deposit_left', op: 'lt', value: 15 }], {
        type: 'notify',
        message: 'Жила под зданием почти выработана — пора переносить добычу.',
      }),
  },
  {
    id: 'ease_on_pollution',
    name: 'Сбавить при загрязнении',
    emoji: '☣️',
    description: 'Переводит в экономию, когда загрязнение начинает резать производство.',
    build: (_ctx, seed) =>
      makeRule(seed, 'Сбавить при загрязнении', 'any', [
        { metric: 'pollution_penalty', op: 'gt', value: 25 },
        { metric: 'happiness', op: 'lt', value: 25 },
      ], { type: 'switch_mode', mode: 'economy' }),
  },
];

/** Шаблоны, применимые к зданию: неприменимые не показываются, а не падают в ошибку. */
export function availableTemplates(ctx: RuleTemplateContext): RuleTemplate[] {
  return RULE_TEMPLATES.filter((t) => t.build(ctx, 'probe') !== null);
}

// ═══════════════════════════════════════════════════════════════
// СТАРЫЕ УСЛОВИЯ
// ═══════════════════════════════════════════════════════════════

/**
 * Перенос `tileSettings.conditions` из «Фазы 5» в правила.
 *
 * Старые условия НИКОГДА не исполнялись, поэтому перенос ничего не ломает по балансу — но
 * выбросить их молча нельзя: игрок их набирал руками и увидел бы пустую вкладку как потерю.
 * `time_of_day` отбрасывается: игрового времени суток в игре нет, и переносить условие,
 * которое опять не сможет сработать, значит воспроизвести ровно ту же обманку.
 */
/**
 * Правила клетки с ленивым переносом старых условий. Единственный способ читать правила:
 * и стор, и редактор обязаны видеть одно и то же, иначе список в панели разойдётся с тем,
 * что реально исполняется.
 *
 * Пустой массив `rules` — тоже ответ: игрок удалил последнее правило, и старые условия из
 * сейва не должны воскреснуть.
 */
export function rulesOf(
  settings: { rules?: BuildingRule[]; conditions?: unknown } | undefined,
): BuildingRule[] {
  if (!settings) return [];
  if (settings.rules) return settings.rules;
  return migrateLegacyConditions(settings.conditions);
}

export function migrateLegacyConditions(raw: unknown): BuildingRule[] {
  if (!Array.isArray(raw)) return [];

  const rules: BuildingRule[] = [];
  for (let i = 0; i < raw.length; i++) {
    const cond = raw[i] as Record<string, unknown> | null;
    if (!cond || typeof cond !== 'object') continue;

    const type = String(cond.type ?? '');
    const value = Number(cond.value);
    if (!Number.isFinite(value)) continue;

    let metric: RuleMetric | null = null;
    let op: RuleComparator = 'gt';
    if (type === 'resource_above') {
      metric = 'resource_fill';
      op = 'gt';
    } else if (type === 'resource_below') {
      metric = 'resource_fill';
      op = 'lt';
    } else if (type === 'energy_available') {
      metric = 'energy_coverage';
      op = 'gt';
    }
    if (!metric) continue;

    const resource = typeof cond.resource === 'string' ? (cond.resource as ResourceType) : undefined;
    if (RULE_METRICS[metric].needsResource && !resource) continue;

    const rawAction = String(cond.action ?? '');
    const actionType: RuleActionType =
      rawAction === 'disable' ? 'disable' : rawAction === 'switch_mode' ? 'switch_mode' : 'enable';
    const mode = cond.targetMode as BuildingMode | undefined;
    if (actionType === 'switch_mode' && (!mode || !BUILDING_MODES[mode])) continue;

    const id = typeof cond.id === 'string' && cond.id ? cond.id : `legacy_${i}`;
    const migrated: RuleTrigger = { id: `${id}_t0`, metric, op, value };
    if (resource) migrated.resource = resource;

    rules.push({
      id,
      enabled: cond.enabled !== false,
      match: 'all',
      triggers: [migrated],
      action: actionType === 'switch_mode' ? { type: actionType, mode } : { type: actionType },
    });
  }

  return rules;
}
