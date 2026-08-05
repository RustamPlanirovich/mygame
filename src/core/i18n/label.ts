/**
 * Единая точка получения человекочитаемой подписи по игровому id.
 *
 * Зачем отдельный модуль, если есть labels.ts: словарь RESOURCE_LABEL существовал давно, но
 * импортировали его только 8 файлов из ~50, а остальные печатали сырой id — либо как есть
 * (`{resource}`), либо через `resource.replace(/_/g, ' ')`, что даёт «integrated circuit»
 * вместо «Интегральная микросхема». Из-за этого вкладки «Аналитика», «Галактика», «Цепочки» и
 * выбор карты показывали английские идентификаторы.
 *
 * Правило: в JSX никогда не попадает сырой id. Только результат функций отсюда.
 * Проверяется скриптом `npm run lint:labels` (tools/check-raw-labels.mjs).
 */

import type {
  DepositType,
  Enemy,
  ResourceType,
  SpecialGalaxyFeature,
} from '../gameTypes';
import type { TechnologyId } from '../gameTypes';
import type { TradeResourceType } from '../gameTypes.market';
import { ENEMY_LABEL, RESOURCE_LABEL, RESOURCE_SHORT, TRADE_LABEL } from '../constants/labels';
import { TECHNOLOGIES } from '../constants/technologies';

const IS_DEV = import.meta.env?.DEV ?? false;

/**
 * Последний рубеж: id, для которого нет словарной статьи. В dev показываем это явно, чтобы
 * пропуск было видно при первом же открытии панели, а не через месяц в отчёте от игрока.
 * В прод-сборке отдаём хотя бы читаемый вид, а не `integrated_circuit`.
 */
function fallback(id: string, kind: string): string {
  if (IS_DEV) {
    console.warn(`[i18n] нет подписи для ${kind}: "${id}"`);
    return `⟨${id}⟩`;
  }
  return humanize(id);
}

/** snake_case → «Snake case». Только для неизвестных id — не для обхода словаря. */
export function humanize(id: string): string {
  const spaced = id.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Полное название ресурса: «Интегральная микросхема». */
export function resourceLabel(id: ResourceType | string): string {
  return RESOURCE_LABEL[id as ResourceType] ?? fallback(String(id), 'resource');
}

/**
 * Иконка/эмодзи ресурса (RESOURCE_SHORT). Это НЕ короткое название: для большинства
 * ресурсов там эмодзи, поэтому для графиков и легенд нужен resourceLabel, а не это.
 */
export function resourceIcon(id: ResourceType | string): string {
  return RESOURCE_SHORT[id as ResourceType] ?? '';
}

/** Название месторождения. DepositType ⊂ ResourceType, поэтому словарь тот же. */
export function depositLabel(id: DepositType | string): string {
  return resourceLabel(id);
}

/** Название торгуемого ресурса на бирже. */
export function tradeResourceLabel(id: TradeResourceType | string): string {
  return TRADE_LABEL[id as TradeResourceType] ?? resourceLabel(id);
}

/** Название типа противника. */
export function enemyLabel(type: Enemy['type'] | string): string {
  return ENEMY_LABEL[type as Enemy['type']] ?? fallback(String(type), 'enemy');
}

/** Название технологии по её id: «basic_mining» → «Базовая добыча». */
export function technologyLabel(id: TechnologyId | string): string {
  return TECHNOLOGIES[id as TechnologyId]?.name ?? fallback(String(id), 'technology');
}

const DANGER_LABEL: Record<string, string> = {
  very_low: 'Очень низкая',
  low: 'Низкая',
  medium: 'Средняя',
  high: 'Высокая',
  very_high: 'Очень высокая',
  extreme: 'Критическая',
};

/** Уровень опасности галактики. */
export function dangerLabel(level: string): string {
  return DANGER_LABEL[level] ?? fallback(level, 'dangerLevel');
}

// SpecialGalaxyFeature включает null, поэтому ключуем по string, а не по union.
const SPECIAL_FEATURE_LABEL: Record<string, string> = {
  black_hole: 'Чёрная дыра',
  nebula: 'Туманность',
  quasar: 'Квазар',
  ruins: 'Древние руины',
};

/** Особенность процедурной галактики. Для null (обычная галактика) — пустая строка. */
export function specialFeatureLabel(feature: SpecialGalaxyFeature | string): string {
  if (!feature) return '';
  return SPECIAL_FEATURE_LABEL[feature] ?? fallback(String(feature), 'specialFeature');
}

/*
 * Процедурные названия галактик генерировались из английских списков слов
 * («Crimson Expanse», «Alpha Nexus») и в этом виде попадали в сохранение. Списки переведены
 * (см. galaxyGenerator.ts), но в старых сейвах названия остались английскими, поэтому здесь
 * лежит обратный словарь: он переводит уже сохранённое название при отображении, слово за
 * словом, и не требует миграции сейвов.
 */
const GREEK_LETTERS = new Set([
  'Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta',
  'Iota', 'Kappa', 'Lambda', 'Mu', 'Nu', 'Xi', 'Omicron', 'Pi', 'Rho',
  'Sigma', 'Tau', 'Upsilon', 'Phi', 'Chi', 'Psi', 'Omega',
]);

const GENERATED_NAME_WORDS: Record<string, string> = {
  // Prefixes
  Nebula: 'Туманная', Spiral: 'Спиральная', Elliptical: 'Эллиптическая',
  Irregular: 'Неправильная', Dwarf: 'Карликовая', Giant: 'Гигантская',
  Dark: 'Тёмная', Bright: 'Яркая', Ancient: 'Древняя', Lost: 'Потерянная',
  Hidden: 'Скрытая', Void: 'Пустотная', Radiant: 'Сияющая', Crimson: 'Багровая',
  Azure: 'Лазурная', Golden: 'Золотая', Silver: 'Серебряная', Crystal: 'Кристальная',
  Shadow: 'Теневая', Eternal: 'Вечная',
  // Suffixes
  Expanse: 'Ширь', Cluster: 'Скопление', Region: 'Область', Zone: 'Зона',
  Sector: 'Сектор', Domain: 'Владение', Realm: 'Царство', Haven: 'Убежище',
  Wastes: 'Пустоши', Fields: 'Поля', Depths: 'Глубины', Heights: 'Высоты',
  Core: 'Ядро', Edge: 'Край', Frontier: 'Рубеж', Reach: 'Предел',
  Veil: 'Завеса', Crown: 'Венец', Heart: 'Сердце', Nexus: 'Узел',
  // Greek letters
  Alpha: 'Альфа', Beta: 'Бета', Gamma: 'Гамма', Delta: 'Дельта',
  Epsilon: 'Эпсилон', Zeta: 'Дзета', Eta: 'Эта', Theta: 'Тета',
  Iota: 'Йота', Kappa: 'Каппа', Lambda: 'Лямбда', Mu: 'Мю', Nu: 'Ню',
  Xi: 'Кси', Omicron: 'Омикрон', Pi: 'Пи', Rho: 'Ро', Sigma: 'Сигма',
  Tau: 'Тау', Upsilon: 'Ипсилон', Phi: 'Фи', Chi: 'Хи', Psi: 'Пси', Omega: 'Омега',
};

/**
 * Переводит сохранённое процедурное название галактики. Новые названия уже русские и
 * проходят через эту функцию без изменений.
 */
/*
 * Уникальные бонусы процедурных галактик тоже генерировались английскими строками и уходили
 * в сохранение. Список переведён в galaxyGenerator.ts; здесь — перевод уже сохранённых.
 */
const GALAXY_BONUS_RU: Record<string, string> = {
  'Global Production +5%': 'Общее производство +5%',
  'Research Speed +10%': 'Скорость исследований +10%',
  'Energy Efficiency +8%': 'Энергоэффективность +8%',
  'Ship Combat Power +15%': 'Боевая мощь кораблей +15%',
  'Platform Defense +12%': 'Защита платформ +12%',
  'Quantum Points Gain +20%': 'Прирост квантовых очков +20%',
  'Building Upgrade Cost -10%': 'Стоимость улучшений −10%',
  'Resource Storage +25%': 'Ёмкость складов +25%',
};

/** Переводит сохранённый уникальный бонус галактики. Русские значения проходят как есть. */
export function localizeGalaxyBonus(bonus: string): string {
  return GALAXY_BONUS_RU[bonus] ?? bonus;
}

export function localizeGeneratedName(name: string): string {
  if (!name) return name;
  // Быстрый выход: в названии нет латиницы — переводить нечего.
  if (!/[A-Za-z]/.test(name)) return name;

  const words = name.split(' ');

  // «Alpha Nexus» → «Узел Альфа»: в русском греческая буква идёт после существительного,
  // так же, как их теперь порождает generateGalaxyName.
  if (words.length === 2 && GREEK_LETTERS.has(words[0])) {
    words.reverse();
  }

  return words.map((word) => GENERATED_NAME_WORDS[word] ?? word).join(' ');
}
