import type { HelpArticle, HelpEntry, HelpReference } from '../helpTypes';
import { START_ARTICLES } from './start';
import { FACTORY_ARTICLES } from './factory';
import { ECONOMY_ARTICLES } from './economy';
import { PROGRESS_ARTICLES } from './progress';
import { SPACE_ARTICLES } from './space';
import { META_ARTICLES } from './meta';
import { LORE_ARTICLES } from './lore';

export const HELP_ARTICLES: readonly HelpArticle[] = [
  ...START_ARTICLES,
  ...FACTORY_ARTICLES,
  ...ECONOMY_ARTICLES,
  ...PROGRESS_ARTICLES,
  ...SPACE_ARTICLES,
  ...META_ARTICLES,
  ...LORE_ARTICLES,
];

/**
 * Живые справочники. Стоят перед статьями своего раздела, потому что именно за таблицей
 * зданий сюда приходят чаще всего.
 */
export const HELP_REFERENCES: readonly HelpReference[] = [
  {
    id: 'ref-buildings',
    section: 'reference',
    title: 'Все здания',
    summary: 'Полный каталог с точными ставками, стоимостью, радиусами и требованиями.',
    keywords: 'здания каталог таблица ставки стоимость производство потребление список',
    kind: 'buildings',
  },
  {
    id: 'ref-resources',
    section: 'reference',
    title: 'Все ресурсы',
    summary: 'Цена, вместимость, кто производит и кто потребляет каждый ресурс.',
    keywords: 'ресурсы таблица цена склад производители потребители список',
    kind: 'resources',
  },
  {
    id: 'ref-technologies',
    section: 'reference',
    title: 'Дерево технологий',
    summary: 'Все технологии по эрам: цена, предпосылки, что открывают.',
    keywords: 'технологии дерево эры цена предпосылки список',
    kind: 'technologies',
  },
  {
    id: 'ref-policies',
    section: 'reference',
    title: 'Все политики',
    summary: 'Стоимость, содержание и эффекты каждой политики по категориям.',
    keywords: 'политики таблица влияние содержание эффекты список',
    kind: 'policies',
  },
];

export const HELP_ENTRIES: readonly HelpEntry[] = [...HELP_REFERENCES, ...HELP_ARTICLES];
