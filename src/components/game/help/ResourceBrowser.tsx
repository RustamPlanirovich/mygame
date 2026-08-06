/**
 * СПРАВОЧНИК РЕСУРСОВ — интерфейс.
 *
 * Главная ценность здесь — колонки «производят» и «потребляют»: в самой игре ответа на вопрос
 * «кто вообще делает волокно» не было нигде, кроме перебора списка строительства.
 */

import React, { useDeferredValue, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Search } from 'lucide-react';
import { BASE_RESOURCE_MAX, useGameStore } from '../../../features/gameStore';
import { formatNumber } from '../../../core/math/format';
import { Badge, EmptyState } from '../../ui';
import { IconText } from '../../ui/icons';
import {
  RESOURCE_GROUPS,
  buildResourceReference,
  groupResources,
  type ResourceFacts,
  type ResourceGroupId,
  type ResourceLink,
} from './resourceReference';

const LinkList: React.FC<{ title: string; links: readonly ResourceLink[]; suffix: string }> = ({
  title,
  links,
  suffix,
}) => {
  if (links.length === 0) return null;
  return (
    <div>
      <div className="mb-1 text-3xs font-bold uppercase tracking-wider text-content-faint">
        {title}
      </div>
      <ul className="space-y-0.5">
        {links.map((link) => (
          <li key={link.buildingId} className="flex justify-between gap-2 text-2xs">
            <span className="min-w-0 truncate text-content-secondary">
              <IconText>{link.buildingName}</IconText>
            </span>
            <span className="shrink-0 font-mono text-content-faint">
              {formatNumber(link.amount)}
              {suffix}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

const ResourceCard: React.FC<{ facts: ResourceFacts }> = ({ facts }) => (
  <div className="space-y-2.5 border-t border-edge-subtle bg-surface-base/40 px-3 py-2.5">
    <div className="grid grid-cols-2 gap-2 text-2xs sm:grid-cols-4">
      <div>
        <div className="text-content-faint">Базовый лимит склада</div>
        <div className="font-mono text-content-primary">
          {facts.baseCap ? formatNumber(facts.baseCap) : '—'}
        </div>
      </div>
      <div>
        <div className="text-content-faint">Базовая цена</div>
        <div className="font-mono text-content-primary">
          {facts.price ? `${formatNumber(facts.price)} ₡` : 'вне рынка'}
        </div>
      </div>
      <div>
        <div className="text-content-faint">Суммарный выпуск</div>
        <div className="font-mono text-accent">{formatNumber(facts.totalProduction)}/с</div>
      </div>
      <div>
        <div className="text-content-faint">Суммарный расход</div>
        <div className="font-mono text-warning">{formatNumber(facts.totalConsumption)}/с</div>
      </div>
    </div>

    <div className="grid gap-3 sm:grid-cols-3">
      <LinkList title="Производят" links={facts.producedBy} suffix="/с" />
      <LinkList title="Потребляют" links={facts.consumedBy} suffix="/с" />
      <LinkList title="Нужен для постройки" links={facts.usedInCostOf} suffix="" />
    </div>

    {facts.producedBy.length === 0 && (
      <p className="text-2xs text-content-faint">
        Ни одно здание не производит этот ресурс — он приходит из рынка, событий, наград или
        экспедиций.
      </p>
    )}
  </div>
);

const ResourceRow: React.FC<{
  facts: ResourceFacts;
  stock: string | null;
  open: boolean;
  onToggle: () => void;
}> = ({ facts, stock, open, onToggle }) => (
  <div className="border-b border-edge-subtle/60 last:border-0">
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-white/5"
    >
      <span className="shrink-0 text-content-faint">
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </span>
      <span className="shrink-0">
        <IconText>{facts.icon}</IconText>
      </span>
      <span className="min-w-0 flex-1 truncate text-xs font-semibold text-content-primary">
        <IconText>{facts.label}</IconText>
      </span>
      <span className="shrink-0 font-mono text-3xs text-content-faint">
        {facts.producedBy.length}→ {facts.consumedBy.length}←
      </span>
      {facts.tradeable ? (
        <Badge tone="accent" className="shrink-0">
          {facts.price ? `${formatNumber(facts.price)} ₡` : 'торгуется'}
        </Badge>
      ) : (
        <Badge className="shrink-0">вне рынка</Badge>
      )}
      {stock && <span className="shrink-0 font-mono text-3xs text-info">{stock}</span>}
    </button>
    {open && <ResourceCard facts={facts} />}
  </div>
);

export const ResourceBrowser: React.FC = () => {
  const buildings = useGameStore((s) => s.buildings);
  const resources = useGameStore((s) => s.resources);
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<ResourceGroupId | 'all'>('all');
  const [openId, setOpenId] = useState<string | null>(null);

  const deferredQuery = useDeferredValue(query);

  const facts = useMemo(
    () => buildResourceReference({ buildings, baseCaps: BASE_RESOURCE_MAX }),
    [buildings],
  );

  const filtered = useMemo(() => {
    const needle = deferredQuery.trim().toLowerCase();
    return facts.filter((f) => {
      if (group !== 'all' && f.group !== group) return false;
      if (needle && !f.search.includes(needle)) return false;
      return true;
    });
  }, [facts, group, deferredQuery]);

  const grouped = useMemo(() => groupResources(filtered), [filtered]);

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="space-y-2">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-content-faint"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Найти ресурс или производителя…"
            className="w-full rounded border border-edge bg-surface-base py-1.5 pl-8 pr-2 text-xs text-content-primary placeholder-content-faint focus:border-accent focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setGroup('all')}
            className={`rounded px-2 py-1 text-2xs transition-colors ${
              group === 'all'
                ? 'bg-accent text-content-inverse font-semibold'
                : 'bg-white/5 text-content-secondary hover:bg-white/10'
            }`}
          >
            Все ({facts.length})
          </button>
          {RESOURCE_GROUPS.map((g) => {
            const count = facts.filter((f) => f.group === g.id).length;
            if (count === 0) return null;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => setGroup(g.id)}
                title={g.hint}
                className={`rounded px-2 py-1 text-2xs transition-colors ${
                  group === g.id
                    ? 'bg-accent text-content-inverse font-semibold'
                    : 'bg-white/5 text-content-secondary hover:bg-white/10'
                }`}
              >
                {g.title} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Search size={20} />}
          title="Ничего не нашлось"
          hint="Попробуйте другое слово или снимите фильтр группы"
        />
      ) : (
        <div className="space-y-3">
          {grouped.map(({ group: g, items }) => (
            <div key={g.id} className="overflow-hidden rounded border border-edge-subtle">
              <div className="flex items-center gap-2 border-b border-edge-subtle bg-white/5 px-3 py-1.5">
                <span className="text-2xs font-bold uppercase tracking-wider text-content-secondary">
                  {g.title}
                </span>
                <span className="text-3xs text-content-faint">{g.hint}</span>
                <span className="ml-auto font-mono text-3xs text-content-faint">{items.length}</span>
              </div>
              {items.map((f) => {
                const live = resources[f.id];
                return (
                  <ResourceRow
                    key={f.id}
                    facts={f}
                    stock={live && live.amount.gt(0) ? formatNumber(live.amount) : null}
                    open={openId === f.id}
                    onToggle={() => setOpenId((prev) => (prev === f.id ? null : f.id))}
                  />
                );
              })}
            </div>
          ))}
        </div>
      )}

      <p className="text-3xs leading-relaxed text-content-faint">
        Числа «N→ M←» в строке — сколько зданий ресурс производят и сколько потребляют. Ставки —
        за секунду на здании первого уровня. Синее число справа — ваш текущий запас.
      </p>
    </div>
  );
};
