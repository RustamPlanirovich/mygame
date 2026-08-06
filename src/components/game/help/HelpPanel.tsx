/**
 * РАЗДЕЛ «СПРАВКА».
 *
 * Работает в двух местах одним и тем же компонентом: как боковая панель (`HelpPanel`) и как
 * модалка на F1 (`HelpModal`). Раньше это были два разных куска разметки с разными вкладками, и
 * вкладка «Здания и Ресурсы» в модалке фильтровала статьи по категории «Космос» — то есть
 * справочника зданий там не было вообще, а три статьи про космос дублировались.
 *
 * УСТРОЙСТВО. Слева оглавление по разделам с поиском, справа — либо статья, либо живой
 * справочник (здания / ресурсы / технологии / политики), который считается из игровых данных.
 * На узкой ширине (боковая панель ~400px) оглавление и содержимое переключаются, а не
 * сжимаются: две колонки по 200px нечитаемы.
 */

import React, { useDeferredValue, useMemo, useState } from 'react';
import { ArrowLeft, Book, Search, X } from 'lucide-react';
import { Modal, EmptyState } from '../../ui';
import { GameIcon, IconText } from '../../ui/icons';
import { HelpMarkup } from './HelpArticle';
import { HELP_ENTRIES } from './articles';
import { HELP_SECTIONS, isReference, searchableText, type HelpEntry } from './helpTypes';
import { BuildingBrowser } from './BuildingBrowser';
import { ResourceBrowser } from './ResourceBrowser';
import { TechBrowser } from './TechBrowser';
import { PolicyBrowser } from './PolicyBrowser';

/** Точка входа по умолчанию: с неё начинается любая партия. */
const DEFAULT_ENTRY_ID = 'quickstart';

function useFilteredEntries(query: string): { entries: readonly HelpEntry[]; searching: boolean } {
  const deferred = useDeferredValue(query);
  return useMemo(() => {
    const needle = deferred.trim().toLowerCase();
    if (!needle) return { entries: HELP_ENTRIES, searching: false };
    return {
      entries: HELP_ENTRIES.filter((entry) => searchableText(entry).includes(needle)),
      searching: true,
    };
  }, [deferred]);
}

const ReferenceView: React.FC<{ kind: 'buildings' | 'resources' | 'technologies' | 'policies' }> = ({
  kind,
}) => {
  switch (kind) {
    case 'buildings':
      return <BuildingBrowser />;
    case 'resources':
      return <ResourceBrowser />;
    case 'technologies':
      return <TechBrowser />;
    case 'policies':
      return <PolicyBrowser />;
  }
};

const EntryBody: React.FC<{ entry: HelpEntry }> = ({ entry }) => (
  <div className="space-y-4">
    <header className="space-y-1">
      <h3 className="text-lg font-semibold text-content-primary">
        <IconText>{entry.title}</IconText>
      </h3>
      <p className="text-xs text-content-faint">
        <IconText>{entry.summary}</IconText>
      </p>
    </header>

    {isReference(entry) ? <ReferenceView kind={entry.kind} /> : <HelpMarkup source={entry.body} />}
  </div>
);

/**
 * Строка оглавления.
 *
 * Модульный компонент, а не вложенный в Contents: объявленный внутри, он пересоздавался бы на
 * каждом рендере, и React размонтировал бы весь список на каждое нажатие клавиши в поиске.
 */
const ContentsItem: React.FC<{
  entry: HelpEntry;
  active: boolean;
  onPick: (id: string) => void;
}> = ({ entry, active, onPick }) => (
  <button
    type="button"
    onClick={() => onPick(entry.id)}
    className={`w-full border-l-2 px-3 py-1.5 text-left text-xs transition-colors ${
      active
        ? 'border-accent bg-accent/10 text-accent'
        : 'border-transparent text-content-secondary hover:bg-white/5'
    }`}
  >
    <span className="block truncate font-medium">
      <IconText>{entry.title}</IconText>
    </span>
    <span className="block truncate text-3xs text-content-faint">
      <IconText>{entry.summary}</IconText>
    </span>
  </button>
);

/**
 * Оглавление. Показывает разделы в порядке HELP_SECTIONS; при активном поиске сворачивается в
 * плоский список найденного, потому что группировка десяти результатов по семи разделам не
 * помогает, а мешает.
 */
const Contents: React.FC<{
  entries: readonly HelpEntry[];
  searching: boolean;
  activeId: string;
  onPick: (id: string) => void;
}> = ({ entries, searching, activeId, onPick }) => {
  if (entries.length === 0) {
    return (
      <div className="p-4">
        <EmptyState
          icon={<Search size={20} />}
          title="Ничего не нашлось"
          hint="Поиск идёт по заголовкам и полному тексту статей"
        />
      </div>
    );
  }

  if (searching) {
    return (
      <div className="py-1">
        <div className="px-3 py-1 text-3xs font-bold uppercase tracking-wider text-content-faint">
          Найдено: {entries.length}
        </div>
        {entries.map((entry) => (
          <ContentsItem
            key={entry.id}
            entry={entry}
            active={entry.id === activeId}
            onPick={onPick}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="py-1">
      {HELP_SECTIONS.map((section) => {
        const items = entries.filter((entry) => entry.section === section.id);
        if (items.length === 0) return null;
        return (
          <div key={section.id} className="mb-2">
            <div className="flex items-center gap-1.5 px-3 py-1">
              <GameIcon icon={section.icon} size={12} className="text-accent" />
              <span className="text-3xs font-bold uppercase tracking-wider text-content-secondary">
                {section.title}
              </span>
              <span className="ml-auto font-mono text-3xs text-content-faint">{items.length}</span>
            </div>
            {items.map((entry) => (
              <ContentsItem
                key={entry.id}
                entry={entry}
                active={entry.id === activeId}
                onPick={onPick}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
};

/**
 * Сама справка без обёртки.
 *
 * ПОЧЕМУ РЕЖИМ — ПРОП, А НЕ МЕДИАЗАПРОС. Тот же компонент живёт и в модалке на весь экран, и в
 * боковой панели шириной ~400px. Медиазапрос `lg:` смотрит на ВЬЮПОРТ, а не на контейнер:
 * на десктопе 1920px он сработал бы и внутри боковой панели, разложив там две колонки — 288px
 * оглавления и ~110px на статью. Контейнерных запросов в проекте нет, поэтому режим задаёт
 * вызывающий, который единственный знает, сколько места он даёт.
 */
export const HelpBrowser: React.FC<{ layout?: 'split' | 'stacked' }> = ({ layout = 'split' }) => {
  const [query, setQuery] = useState('');
  const [activeId, setActiveId] = useState<string>(DEFAULT_ENTRY_ID);
  /** Только для 'stacked': что показано сейчас — оглавление или статья. */
  const [showContents, setShowContents] = useState(false);

  const { entries, searching } = useFilteredEntries(query);
  const active = useMemo(
    () => HELP_ENTRIES.find((entry) => entry.id === activeId) ?? HELP_ENTRIES[0],
    [activeId],
  );

  const pick = (id: string) => {
    setActiveId(id);
    setShowContents(false);
  };

  const stacked = layout === 'stacked';

  /*
   * Классы `display` собраны в одну строку на состояние, а не дописаны поверх базовых:
   * `flex` и `hidden` живут в одном слое Tailwind, и порядок в атрибуте на исход не влияет.
   *
   * 'stacked' — всегда одна колонка, переключаемая состоянием.
   * 'split' — две колонки от `lg` и одна колонка ниже: модалка растянута на весь вьюпорт, и
   * там медиазапрос как раз уместен — на телефоне 375px две колонки не поместятся.
   */
  const asideClass = stacked
    ? `w-full ${showContents ? 'flex' : 'hidden'}`
    : `w-full lg:w-72 lg:shrink-0 ${showContents ? 'flex' : 'hidden lg:flex'}`;
  const bodyClass = stacked
    ? showContents
      ? 'hidden'
      : 'flex'
    : showContents
      ? 'hidden lg:flex'
      : 'flex';

  return (
    <div className="flex h-full min-h-0 w-full">
      <aside
        className={`min-h-0 flex-col border-r border-edge-subtle bg-surface-base/40 ${asideClass}`}
      >
        <div className="shrink-0 border-b border-edge-subtle p-2">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-content-faint"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск по всей справке…"
              className="w-full rounded border border-edge bg-surface-base py-1.5 pl-8 pr-7 text-xs text-content-primary placeholder-content-faint focus:border-accent focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Очистить поиск"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-content-faint hover:text-content-primary"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <Contents entries={entries} searching={searching} activeId={activeId} onPick={pick} />
        </div>
      </aside>

      <section className={`min-h-0 min-w-0 flex-1 flex-col ${bodyClass}`}>
        {/* Кнопка нужна только там, где колонка одна: в 'split' — ниже `lg`. */}
        <button
          type="button"
          onClick={() => setShowContents(true)}
          className={`shrink-0 items-center gap-1.5 border-b border-edge-subtle px-3 py-2 text-xs text-content-secondary hover:bg-white/5 ${
            stacked ? 'flex' : 'flex lg:hidden'
          }`}
        >
          <ArrowLeft size={13} />
          Оглавление и поиск
        </button>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {active ? (
            <div className="mx-auto max-w-3xl">
              <EntryBody entry={active} />
            </div>
          ) : (
            <EmptyState icon={<Book size={22} />} title="Выберите тему слева" />
          )}
        </div>
      </section>
    </div>
  );
};

/** Модалка на F1 и на кнопку в интерфейсе. */
export const HelpModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({
  isOpen,
  onClose,
}) => (
  <Modal open={isOpen} onClose={onClose} title="Справка" icon={<Book size={18} />} size="full">
    <div className="h-full min-h-0">
      <HelpBrowser layout="split" />
    </div>
  </Modal>
);

/**
 * Раздел боковой панели. Панель узкая (~400px), поэтому здесь одна колонка с переключателем.
 */
export const HelpPanel: React.FC = () => (
  <div className="h-full min-h-0">
    <HelpBrowser layout="stacked" />
  </div>
);
