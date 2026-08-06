import type Decimal from 'break_eternity.js';
import type { DemonId, ResourceType, UpgradeId } from '../gameTypes';
import { D } from '../math/format.ts';

export const UPGRADE_DEFS: Record<
  UpgradeId,
  {
    name: string;
    description: string;
    maxLevel: number;
    baseCost: Partial<Record<ResourceType, Decimal>>;
    costFactor: number;
  }
> = {
  kernel_speed: {
    name: 'Системное Ядро: Частота',
    description: 'Ускоряет работу всех зданий (производство/потребление).',
    maxLevel: 10,
    baseCost: { energy: D(250), steel: D(8) },
    costFactor: 1.55,
  },
  logistics_bandwidth: {
    name: 'Логистика: Пропускная',
    description: 'Увеличивает пропускную способность всех линий.',
    maxLevel: 10,
    baseCost: { energy: D(220), steel: D(10) },
    costFactor: 1.55,
  },
  storage_caps: {
    name: 'Склады: Контейнеры',
    description: 'Увеличивает множитель вместимости центральной БАЗЫ для всех ресурсов (работает со складскими модулями).',
    maxLevel: 10,
    baseCost: { energy: D(200), steel: D(12) },
    costFactor: 1.55,
  },
  trade_margin: {
    name: 'Биржа: Маржа',
    description: 'Продажа на бирже приносит больше ⚡.',
    maxLevel: 10,
    baseCost: { energy: D(180), steel: D(6) },
    costFactor: 1.55,
  },
  combat_protocols: {
    name: 'Протоколы Обороны',
    description: 'Усиляет турели и регенерацию щита.',
    maxLevel: 10,
    baseCost: { energy: D(260), steel: D(14) },
    costFactor: 1.55,
  },
  sector_expansion: {
    name: 'Сектор: Расширение',
    description: 'Увеличивает размер сетки фабрики (+2×2 клеток за уровень).',
    maxLevel: 8,
    baseCost: { energy: D(450), steel: D(40) },
    costFactor: 1.75,
  },
};

/**
 * ДЕМОНЫ — наёмная автоматизация за ⚡.
 *
 * ПРАВИЛО БАЛАНСА, ради которого здесь два вида цены. Демон, который делает за игрока
 * работу, обязан стоить дороже, чем эта работа делается руками, иначе он превращается в
 * «включил и забыл» и выключает целый слой игры. Поэтому:
 *
 *   - `energyPerSecond` — АРЕНДА: постоянная плата за то, что демон вообще подключён.
 *     Списывается в начале тика; не хватило — демон в этом тике не работает вообще
 *     (`rentPaid = false`), а не работает вполсилы.
 *   - `variableCost` — СДЕЛЬНАЯ часть: платится за каждую единицу сделанного (сожжённый
 *     мусор, сохранённая руда, докупленный вход). Именно она держит баланс: чем больше
 *     демон упрощает игру, тем больше он стоит, и на масштабе развитой базы сдельная
 *     часть всегда крупнее аренды. Числа — в DEMON_BALANCE ниже.
 *
 * Демон без сдельной части (`Oracle`) ничего не делает за игрока — он только показывает
 * цифру, поэтому там достаточно аренды.
 */
export const DEMON_DEFS: Record<
  DemonId,
  {
    name: string;
    description: string;
    energyPerSecond: Decimal;
    /** Подпись сдельной части для панели. undefined — платы за результат нет. */
    variableCost?: string;
  }
> = {
  smart_broker: {
    name: 'Smart-Broker',
    description: 'Автопродажа излишков: сначала за ⚡, потом за 💰 кредиты.',
    energyPerSecond: D(2.0),
  },
  overclocker: {
    name: 'Overclocker',
    description: 'Ускоряет заводы в 2 раза, но ест ⚡ каждую секунду.',
    energyPerSecond: D(6.0),
  },
  oracle: {
    name: 'Oracle',
    description: 'Подсказывает, какое здание выгоднее по окупаемости (ROI).',
    energyPerSecond: D(2.5),
  },
  supplier: {
    name: 'Снабженец',
    description:
      'Докупает на бирже недостающие входы для ВСЕХ заводов сразу — вручную это настраивается по клетке и ресурсу.',
    energyPerSecond: D(5.0),
    variableCost: 'закупка по цене ×1.75 к рынку (ручной импорт дешевле)',
  },
  scrubber: {
    name: 'Санитар',
    description: 'Жжёт мусор и радиоактивные отходы, снимая штраф к эффективности без переработчиков на карте.',
    energyPerSecond: D(1.5),
    variableCost: '0.25 ⚡ за мусор, 6 ⚡ за радиоактивные отходы',
  },
  geologist: {
    name: 'Геолог',
    description: 'Жила расходуется на 30% медленнее: добыча прежняя, месторождение живёт дольше.',
    energyPerSecond: D(4.0),
    variableCost: '2.5 рыночной цены за каждую сохранённую единицу',
  },
  archivist: {
    name: 'Архивариус',
    description:
      'Сливает энергию сверх 95% ёмкости (та, что и так теряется) в очки исследований по грабительскому курсу.',
    energyPerSecond: D(3.0),
    variableCost: '300 ⚡ за одно 🔬, не больше 3 🔬/с',
  },
  night_shift: {
    name: 'Ночная смена',
    description:
      'Пока вас нет, база работает на 95% вместо 75%. Аренду за ночь платит из наработанной офлайн энергии.',
    energyPerSecond: D(1.0),
    variableCost: '12 ⚡/с за всё время отсутствия — только из офлайн-выработки',
  },
};

/**
 * Сдельные тарифы демонов. Отдельная таблица, а не числа по месту вызова: цена — это и есть
 * весь баланс этих демонов, и она обязана быть видна одним взглядом.
 *
 * КАК ПОДБИРАЛОСЬ. Точка отсчёта — рыночная цена ресурса, а не «на глаз»: продажа даёт
 * price × tradeMult энергии за единицу, поэтому любая ставка ВЫШЕ price делает демона
 * заведомо невыгодным как источник ресурса и оставляет ему только ту роль, ради которой он
 * и заводится — снять ручную возню в обмен на энергию.
 */
export const DEMON_BALANCE = {
  /**
   * Наценка Снабженца к рыночной цене. Ручной импорт (marketPolicy на клетке) покупает по
   * price / tradeMult, то есть ДЕШЕВЛЕ рынка: настройка руками обязана оставаться выгоднее,
   * иначе панель торговых политик становится мёртвой.
   */
  SUPPLIER_PRICE_MARKUP: 1.75,
  /** Санитар: сколько отходов сгорает в секунду и по какой цене. */
  SCRUBBER_WASTE_PER_SECOND: 25,
  SCRUBBER_RADIOACTIVE_PER_SECOND: 2,
  SCRUBBER_ENERGY_PER_WASTE: 0.25,
  SCRUBBER_ENERGY_PER_RADIOACTIVE: 6,
  /** Геолог: какую долю расхода жилы он сберегает и во сколько цен обходится единица. */
  GEOLOGIST_SAVE_SHARE: 0.3,
  GEOLOGIST_PRICE_MULTIPLIER: 2.5,
  /** Архивариус: курс обмена и потолок. */
  ARCHIVIST_ENERGY_PER_RP: 300,
  ARCHIVIST_SURPLUS_THRESHOLD: 0.95,
  /**
   * Потолок конверсии. Без него поздняя энергетика (десятки тысяч ⚡/с в переполненном
   * хранилище) печатала бы науку быстрее любого числа лабораторий, то есть обнуляла бы
   * смысл строить их вообще.
   */
  ARCHIVIST_MAX_RP_PER_SECOND: 3,
  /** Ночная смена: эффективность офлайна при полной оплате и её ставка за секунду. */
  NIGHT_SHIFT_EFFICIENCY: 0.95,
  NIGHT_SHIFT_ENERGY_PER_SECOND: 12,
} as const;

export const upgradeCost = (id: UpgradeId, level: number) => {
  const def = UPGRADE_DEFS[id];
  const cost: Partial<Record<ResourceType, Decimal>> = {};
  for (const [res, base] of Object.entries(def.baseCost)) {
    cost[res as ResourceType] = D(base).mul(Math.pow(def.costFactor, level));
  }
  return cost;
};

export const computeTradeMultiplier = (levels: Record<UpgradeId, number>) => 1 + 0.05 * (levels.trade_margin ?? 0);

export const computeCapsMultiplier = (levels: Record<UpgradeId, number>, qubits: Decimal) => {
  const l = levels.storage_caps ?? 0;
  return D(1).add(D('0.10').mul(l)).add(D('0.02').mul(qubits));
};

export const computeSpeedMultiplier = (levels: Record<UpgradeId, number>, qubits: Decimal, overclockerActive: boolean) => {
  const l = levels.kernel_speed ?? 0;
  const base = 1 + 0.05 * l + 0.02 * Number(qubits.toString());
  return base * (overclockerActive ? 2 : 1);
};

export const computeBandwidth = (levels: Record<UpgradeId, number>) => {
  const l = levels.logistics_bandwidth ?? 0;
  return D(6).mul(D(1).add(D('0.25').mul(l)));
};

export const computeCombatMultiplier = (levels: Record<UpgradeId, number>, qubits: Decimal) => {
  const l = levels.combat_protocols ?? 0;
  return D(1).add(D('0.10').mul(l)).add(D('0.02').mul(qubits));
};
