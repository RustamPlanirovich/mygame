/**
 * СПРАВКА: типы и оглавление.
 *
 * Раздел «Справка» был витриной из 17 статей, написанных задолго до текущего баланса, и
 * половина цифр в них уже не совпадала с кодом: у турели значился «Turret Mk1» без урона,
 * у Encryption — 10 уровней вместо 20, корабли стоили «100💰» вместо 5000₡ и шести
 * материалов. Хуже того, вкладка «Здания и Ресурсы» показывала статьи с категорией
 * «Космос» (фильтр `activeTab === 'buildings' && ['Космос'].includes(category)`), то есть
 * справочника зданий не существовало вовсе.
 *
 * Отсюда два решения, на которых держится вся эта папка:
 *
 *  1. ВСЁ ЧИСЛОВОЕ — ИЗ ЖИВЫХ ДАННЫХ. Справочники зданий, ресурсов, технологий и политик
 *     считаются из тех же констант, что читает тик (`buildingReference`, `resourceReference`).
 *     Правка баланса меняет справку сама; вручную переписанная таблица разошлась бы с игрой
 *     на первом же коммите — ровно так и вышло с прошлой версией.
 *
 *  2. ТЕКСТОВЫЕ СТАТЬИ ОПИСЫВАЮТ МЕХАНИКУ, А НЕ ЦИФРЫ. Где число всё-таки нужно (период
 *     волны, эффективность офлайна), рядом в статье стоит ссылка на константу, чтобы
 *     следующий редактор знал, где проверять.
 */

import type { ReactNode } from 'react';

/** Раздел оглавления. Порядок здесь — порядок в боковом списке. */
export type HelpSectionId =
  | 'start'
  | 'factory'
  | 'economy'
  | 'progress'
  | 'space'
  | 'meta'
  | 'reference'
  | 'lore';

export interface HelpSection {
  id: HelpSectionId;
  title: string;
  /** Ключ иконки из glyphs.ts (GameIcon). */
  icon: string;
  hint: string;
}

export const HELP_SECTIONS: readonly HelpSection[] = [
  { id: 'start', title: 'Начало', icon: 'play', hint: 'Первые шаги и устройство игры' },
  { id: 'factory', title: 'Фабрика', icon: 'crane', hint: 'База, энергия, здания, автоматизация' },
  { id: 'economy', title: 'Экономика', icon: 'market', hint: 'Валюты, рынок, биржа, финансы' },
  { id: 'progress', title: 'Развитие', icon: 'research', hint: 'Наука, культура, политика, престиж' },
  { id: 'space', title: 'Космос и бой', icon: 'rocket', hint: 'Оборона, галактики, платформы, флот' },
  { id: 'meta', title: 'Мета и сервис', icon: 'gear', hint: 'Карты, сейвы, мультиплеер, настройки' },
  { id: 'reference', title: 'Справочники', icon: 'clipboard', hint: 'Живые таблицы из данных игры' },
  { id: 'lore', title: 'История мира', icon: 'book', hint: 'Лор, фракции, концовки' },
] as const;

/**
 * Статья справки.
 *
 * `body` — разметка `helpMarkup` (см. HelpArticle.tsx). Не HTML: прошлая версия склеивала
 * статьи регулярками в `dangerouslySetInnerHTML`, и любая скобка в тексте могла сломать
 * вёрстку молча.
 */
export interface HelpArticle {
  id: string;
  section: HelpSectionId;
  title: string;
  /** Одна строка над текстом: о чём статья. */
  summary: string;
  /** Дополнительные слова для поиска — синонимы и английские названия механик. */
  keywords?: string;
  body: string;
}

/**
 * Живой справочник: вместо текста рисует таблицу из игровых данных.
 * Компонент подставляется в HelpPanel, поэтому здесь только описание записи.
 */
export interface HelpReference {
  id: string;
  section: 'reference';
  title: string;
  summary: string;
  keywords?: string;
  /** Что рисовать. Разбор — в HelpPanel. */
  kind: 'buildings' | 'resources' | 'technologies' | 'policies';
}

export type HelpEntry = HelpArticle | HelpReference;

export function isReference(entry: HelpEntry): entry is HelpReference {
  return (entry as HelpReference).kind !== undefined;
}

/** Текст, по которому ищет поиск. Для справочников — только заголовок и ключевые слова. */
export function searchableText(entry: HelpEntry): string {
  const base = `${entry.title} ${entry.summary} ${entry.keywords ?? ''}`;
  return isReference(entry) ? base.toLowerCase() : `${base} ${entry.body}`.toLowerCase();
}

/** Подсветка совпадения в заголовке списка. Возвращает готовые узлы. */
export type Highlighter = (text: string) => ReactNode;
