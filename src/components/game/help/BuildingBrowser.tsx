/**
 * СПРАВОЧНИК ЗДАНИЙ — интерфейс.
 *
 * Строки свёрнуты по умолчанию и раскрываются по клику. Причина практическая: зданий около
 * ста, и полный паспорт каждого одновременно — это и нечитаемо, и дорого по рендеру, а
 * виртуализации списков в проекте нет.
 */

import React, { useDeferredValue, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Search } from 'lucide-react';
import { BASE_RESOURCE_MAX, useGameStore } from '../../../features/gameStore';
import { formatNumber } from '../../../core/math/format';
import { depositLabel, resourceLabel } from '../../../core/i18n/label';
import { Badge, EmptyState } from '../../ui';
import { GameIcon, IconText } from '../../ui/icons';
import {
  BUILDING_GROUPS,
  buildBuildingReference,
  groupBuildings,
  type BuildingFacts,
  type BuildingGroupId,
  type RateEntry,
} from './buildingReference';

/** Строка «Руда 0.6/с · Углерод 0.4/с». */
function rateList(entries: readonly RateEntry[], suffix = '/с'): string {
  return entries
    .map((entry) => `${resourceLabel(entry.resource)} ${formatNumber(entry.amount)}${suffix}`)
    .join(' · ');
}

const StatRow: React.FC<{ label: string; value: React.ReactNode; tone?: string }> = ({
  label,
  value,
  tone = 'text-content-secondary',
}) => (
  <div className="flex gap-2 text-xs">
    <span className="w-40 shrink-0 text-content-faint">{label}</span>
    <span className={`min-w-0 flex-1 ${tone}`}>{value}</span>
  </div>
);

const BuildingCard: React.FC<{ facts: BuildingFacts }> = ({ facts }) => {
  const energyOut = facts.production.find((e) => e.resource === 'energy');
  const otherOut = facts.production.filter((e) => e.resource !== 'energy');

  return (
    <div className="space-y-2 border-t border-edge-subtle bg-surface-base/40 px-3 py-2.5">
      <p className="text-xs leading-relaxed text-content-muted">
        <IconText>{facts.description}</IconText>
      </p>

      <div className="space-y-1">
        <StatRow
          label="Стоимость"
          value={
            <>
              {facts.costResources.length > 0 && rateList(facts.costResources, '')}
              {facts.costResources.length > 0 && facts.costCredits ? ' + ' : ''}
              {facts.costCredits ? `${formatNumber(facts.costCredits)} ₡` : ''}
              {facts.costResources.length === 0 && !facts.costCredits ? 'бесплатно' : ''}
            </>
          }
        />
        <StatRow
          label="Рост цены за копию"
          value={`×${facts.costFactor.toFixed(2)} за каждую построенную`}
        />

        {facts.requiredDeposit && (
          <StatRow
            label="Требует месторождение"
            value={depositLabel(facts.requiredDeposit)}
            tone="text-warning"
          />
        )}

        {energyOut && (
          <StatRow
            label="Выработка энергии"
            value={`${formatNumber(energyOut.amount)} ⚡/с`}
            tone="text-accent"
          />
        )}
        {otherOut.length > 0 && (
          <StatRow label="Производит" value={rateList(otherOut)} tone="text-accent" />
        )}
        {facts.consumption.length > 0 && (
          <StatRow label="Потребляет" value={rateList(facts.consumption)} tone="text-warning" />
        )}
        {facts.passiveEnergy && (
          <StatRow
            label="Расход энергии (пассивный)"
            value={`${formatNumber(facts.passiveEnergy)} ⚡/с`}
            tone="text-warning"
          />
        )}
        {facts.activeEnergy && (
          <StatRow
            label="Расход энергии (активный)"
            value={`${formatNumber(facts.activeEnergy)} ⚡/с`}
            tone="text-warning"
          />
        )}

        {facts.researchPointsPerSecond !== null && (
          <StatRow
            label="Очки исследований"
            value={`${facts.researchPointsPerSecond} 🔬/с за поставленную копию`}
            tone="text-info"
          />
        )}
        {facts.influencePerSecond !== null && (
          <StatRow
            label="Влияние"
            value={`${facts.influencePerSecond} 👑/с за поставленную копию`}
            tone="text-info"
          />
        )}
        {facts.creditsPerSecond !== null && (
          <StatRow
            label="Кредиты"
            value={`${facts.creditsPerSecond} ₡/с за поставленную копию`}
            tone="text-info"
          />
        )}

        {facts.powerGridRadius !== null && (
          <StatRow label="Радиус энергосети" value={`${facts.powerGridRadius} клеток`} />
        )}
        {facts.logisticsRadius !== null && (
          <StatRow
            label="Логистическая зона"
            value={`${facts.logisticsRadius} клеток — внутри штрафа дальности нет`}
          />
        )}

        {facts.storageBonus.length > 0 && (
          <StatRow
            label="Вместимость базы за уровень"
            value={rateList(facts.storageBonus, '')}
          />
        )}

        {facts.combat && (
          <StatRow
            label="Огонь"
            value={`${formatNumber(facts.combat.dps)} DPS за ${formatNumber(
              facts.combat.energyPerSecond,
            )} ⚡/с (только во время волны)`}
            tone="text-danger"
          />
        )}
        {facts.defense && (
          <StatRow
            label="Щит"
            value={`+${formatNumber(facts.defense.shieldMaxHp)} HP, регенерация ${formatNumber(
              facts.defense.shieldRegenPerSecond,
            )} HP/с за ${formatNumber(facts.defense.energyPerSecond)} ⚡/с`}
            tone="text-info"
          />
        )}

        {facts.wastePerSecond > 0 && (
          <StatRow
            label="Мусора в секунду"
            value={`${facts.wastePerSecond.toFixed(4)} (1% выпуска)`}
            tone="text-warning"
          />
        )}
        {facts.radioactivePerSecond > 0 && (
          <StatRow
            label="Радиоактивных отходов"
            value={`${facts.radioactivePerSecond}/с — вчетверо больнее обычного мусора`}
            tone="text-danger"
          />
        )}

        {facts.marketMarginPerSecond !== null && (
          <StatRow
            label="Маржа по базовым ценам"
            value={`${facts.marketMarginPerSecond >= 0 ? '+' : ''}${facts.marketMarginPerSecond.toFixed(
              2,
            )} ₡/с на первом уровне`}
            tone={facts.marketMarginPerSecond >= 0 ? 'text-accent' : 'text-danger'}
          />
        )}

        <StatRow
          label="Открывает технология"
          value={facts.unlockTechName ? `${facts.unlockTechName} (${facts.eraName})` : 'доступно с начала партии'}
        />
        <StatRow
          label="Можно отключить"
          value={facts.canDisable ? 'да' : 'нет — критическая инфраструктура'}
        />
      </div>

      {facts.evolution.length > 0 && (
        <div className="rounded border border-edge-subtle">
          <div className="border-b border-edge-subtle bg-white/5 px-2 py-1 text-3xs font-bold uppercase tracking-wider text-content-faint">
            Эволюция (после 2-го вознесения)
          </div>
          <table className="w-full text-2xs">
            <tbody>
              {facts.evolution.map((tier) => (
                <tr key={tier.level} className="border-b border-edge-subtle/60 last:border-0">
                  <td className="px-2 py-1 font-mono text-content-faint">ур. {tier.level}</td>
                  <td className="px-2 py-1 text-content-primary">
                    <IconText>{tier.name}</IconText>
                  </td>
                  <td className="px-2 py-1 font-mono text-accent">×{tier.multiplier}</td>
                  <td className="px-2 py-1 text-right font-mono text-content-secondary">
                    {formatNumber(tier.credits)} ₡ + {formatNumber(tier.quantumPoints)} 💎
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

/** Одна строка списка: имя, короткая сводка, счётчик построенного. */
const BuildingRow: React.FC<{
  facts: BuildingFacts;
  placed: number;
  open: boolean;
  onToggle: () => void;
}> = ({ facts, placed, open, onToggle }) => {
  const summary = useMemo(() => {
    const parts: string[] = [];
    const energyOut = facts.production.find((e) => e.resource === 'energy');
    if (energyOut) parts.push(`+${formatNumber(energyOut.amount)} ⚡/с`);
    const other = facts.production.filter((e) => e.resource !== 'energy');
    if (other.length > 0) parts.push(rateList(other.slice(0, 2)));
    if (facts.combat) parts.push(`${formatNumber(facts.combat.dps)} DPS`);
    if (facts.defense) parts.push(`+${formatNumber(facts.defense.shieldMaxHp)} HP щита`);
    if (facts.researchPointsPerSecond) parts.push(`${facts.researchPointsPerSecond} 🔬/с`);
    if (facts.influencePerSecond) parts.push(`${facts.influencePerSecond} 👑/с`);
    if (facts.creditsPerSecond) parts.push(`${facts.creditsPerSecond} ₡/с`);
    if (parts.length === 0 && facts.logisticsRadius) parts.push(`зона ${facts.logisticsRadius}`);
    return parts.join(' · ');
  }, [facts]);

  return (
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
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-semibold text-content-primary">
            <IconText>{facts.name}</IconText>
          </span>
          {summary && (
            <span className="block truncate font-mono text-3xs text-content-faint">{summary}</span>
          )}
        </span>
        {facts.requiredDeposit && (
          <Badge tone="warning" className="shrink-0">
            {depositLabel(facts.requiredDeposit)}
          </Badge>
        )}
        {placed > 0 && (
          <span className="shrink-0 font-mono text-3xs text-accent">×{placed}</span>
        )}
      </button>
      {open && <BuildingCard facts={facts} />}
    </div>
  );
};

export const BuildingBrowser: React.FC = () => {
  const buildings = useGameStore((s) => s.buildings);
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<BuildingGroupId | 'all'>('all');
  const [openId, setOpenId] = useState<string | null>(null);

  const deferredQuery = useDeferredValue(query);

  const facts = useMemo(() => buildBuildingReference(buildings), [buildings]);
  const placedByBuilding = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of buildings) map.set(b.id, b.count);
    return map;
  }, [buildings]);

  const filtered = useMemo(() => {
    const needle = deferredQuery.trim().toLowerCase();
    return facts.filter((f) => {
      if (group !== 'all' && f.group !== group) return false;
      if (needle && !f.search.includes(needle)) return false;
      return true;
    });
  }, [facts, group, deferredQuery]);

  const grouped = useMemo(() => groupBuildings(filtered), [filtered]);

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
            placeholder="Найти здание, ресурс или технологию…"
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
          {BUILDING_GROUPS.map((g) => {
            const count = facts.filter((f) => f.group === g.id).length;
            if (count === 0) return null;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => setGroup(g.id)}
                title={g.hint}
                className={`flex items-center gap-1 rounded px-2 py-1 text-2xs transition-colors ${
                  group === g.id
                    ? 'bg-accent text-content-inverse font-semibold'
                    : 'bg-white/5 text-content-secondary hover:bg-white/10'
                }`}
              >
                <GameIcon icon={g.icon} size={11} />
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
          hint="Попробуйте другое слово или снимите фильтр категории"
        />
      ) : (
        <div className="space-y-3">
          {grouped.map(({ group: g, items }) => (
            <div key={g.id} className="overflow-hidden rounded border border-edge-subtle">
              <div className="flex items-center gap-2 border-b border-edge-subtle bg-white/5 px-3 py-1.5">
                <GameIcon icon={g.icon} size={13} className="text-accent" />
                <span className="text-2xs font-bold uppercase tracking-wider text-content-secondary">
                  {g.title}
                </span>
                <span className="text-3xs text-content-faint">{g.hint}</span>
                <span className="ml-auto font-mono text-3xs text-content-faint">{items.length}</span>
              </div>
              {items.map((f) => (
                <BuildingRow
                  key={f.id}
                  facts={f}
                  placed={placedByBuilding.get(f.id) ?? 0}
                  open={openId === f.id}
                  onToggle={() => setOpenId((prev) => (prev === f.id ? null : f.id))}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      <p className="text-3xs leading-relaxed text-content-faint">
        Все ставки — за секунду на здании первого уровня. Уровень умножает выпуск, потребление и
        расход энергии линейно. Базовая вместимость складов — {formatNumber(BASE_RESOURCE_MAX.ore)}{' '}
        {resourceLabel('ore').toLowerCase()} без построек.
      </p>
    </div>
  );
};
