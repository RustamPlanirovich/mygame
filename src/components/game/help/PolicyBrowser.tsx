/**
 * СПРАВОЧНИК ПОЛИТИК — таблица из POLICIES с ценой, содержанием и разобранными эффектами.
 *
 * Эффекты хранятся множителями (1.3 = +30%), а игроку нужен знак и процент — поэтому здесь
 * они переводятся в человекочитаемые строки, а не печатаются как есть.
 */

import React, { useDeferredValue, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useGameStore } from '../../../features/gameStore';
import { POLICIES } from '../../../core/constants/policies';
import { technologyLabel } from '../../../core/i18n/label';
import { formatNumber } from '../../../core/math/format';
import { Badge, EmptyState } from '../../ui';
import { IconText } from '../../ui/icons';
import type { Policy, PolicyCategory } from '../../../core/gameTypes';

const CATEGORY_TITLE: Record<PolicyCategory, string> = {
  production: 'Производственные',
  energy: 'Энергетические',
  economic: 'Экономические',
  science: 'Научные',
  military: 'Военные',
  space: 'Космические',
  special: 'Специальные',
};

const CATEGORY_ORDER: PolicyCategory[] = [
  'production',
  'energy',
  'economic',
  'science',
  'military',
  'space',
  'special',
];

/** Множитель → «+30%» / «−20%». Знак важнее числа: 0.7 читается как «хорошо» по ошибке. */
function pct(multiplier: number): string {
  const delta = Math.round((multiplier - 1) * 100);
  return `${delta > 0 ? '+' : ''}${delta}%`;
}

interface EffectLine {
  text: string;
  good: boolean;
}

/**
 * Разбор эффектов в строки.
 *
 * Цвет считается отдельно для каждого поля, а не по знаку множителя: у расхода энергии и
 * стоимости строительства «меньше» — это хорошо, и общее правило «>1 зелёное» врало бы.
 */
function effectLines(policy: Policy): EffectLine[] {
  const out: EffectLine[] = [];
  const e = policy.effects;

  if (e.productionMultiplier !== undefined) {
    out.push({ text: `Производство ${pct(e.productionMultiplier)}`, good: e.productionMultiplier >= 1 });
  }
  if (e.energyConsumptionMultiplier !== undefined) {
    out.push({
      text: `Потребление энергии ${pct(e.energyConsumptionMultiplier)}`,
      good: e.energyConsumptionMultiplier <= 1,
    });
  }
  if (e.energyProductionMultiplier !== undefined) {
    out.push({
      text: `Выработка энергии ${pct(e.energyProductionMultiplier)}`,
      good: e.energyProductionMultiplier >= 1,
    });
  }
  if (e.buildingCostMultiplier !== undefined) {
    out.push({
      text: `Стоимость строительства ${pct(e.buildingCostMultiplier)}`,
      good: e.buildingCostMultiplier <= 1,
    });
  }
  if (e.researchMultiplier !== undefined) {
    out.push({ text: `Исследования ${pct(e.researchMultiplier)}`, good: e.researchMultiplier >= 1 });
  }
  if (e.tradePriceMultiplier !== undefined) {
    out.push({ text: `Торговые цены ${pct(e.tradePriceMultiplier)}`, good: e.tradePriceMultiplier >= 1 });
  }
  if (e.creditsPerSecond) {
    out.push({ text: `+${formatNumber(e.creditsPerSecond)} ₡/с`, good: true });
  }
  if (e.buildingTypeMultipliers) {
    for (const [buildingId, multiplier] of Object.entries(e.buildingTypeMultipliers)) {
      out.push({ text: `${buildingId}: ${pct(multiplier)}`, good: multiplier >= 1 });
    }
  }
  if (e.specialEffect) {
    out.push({ text: `Особый эффект: ${e.specialEffect}`, good: true });
  }

  return out;
}

export const PolicyBrowser: React.FC = () => {
  const active = useGameStore((s) => s.politics.activePolicies);
  const maxActive = useGameStore((s) => s.politics.maxActivePolicies);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);

  const rows = useMemo(
    () =>
      Object.values(POLICIES).map((policy) => ({
        policy,
        effects: effectLines(policy),
        search: `${policy.name} ${policy.id} ${policy.description}`.toLowerCase(),
      })),
    [],
  );

  const filtered = useMemo(() => {
    const needle = deferredQuery.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) => r.search.includes(needle));
  }, [rows, deferredQuery]);

  const byCategory = useMemo(
    () =>
      CATEGORY_ORDER.map((category) => ({
        category,
        items: filtered.filter((r) => r.policy.category === category),
      })).filter((entry) => entry.items.length > 0),
    [filtered],
  );

  const activeSet = useMemo(() => new Set<string>(active), [active]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-content-faint" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Найти политику…"
          className="w-full rounded border border-edge bg-surface-base py-1.5 pl-8 pr-2 text-xs text-content-primary placeholder-content-faint focus:border-accent focus:outline-none"
        />
      </div>

      <p className="text-3xs text-content-faint">
        Всего политик: {rows.length}. Активно {active.length} из {maxActive}. Содержание списывается
        каждую секунду; при нулевом влиянии все политики отключаются автоматически.
      </p>

      {filtered.length === 0 ? (
        <EmptyState icon={<Search size={20} />} title="Ничего не нашлось" hint="Попробуйте другое слово" />
      ) : (
        byCategory.map(({ category, items }) => (
          <div key={category} className="overflow-hidden rounded border border-edge-subtle">
            <div className="flex items-center gap-2 border-b border-edge-subtle bg-white/5 px-3 py-1.5">
              <span className="text-2xs font-bold uppercase tracking-wider text-content-secondary">
                {CATEGORY_TITLE[category]}
              </span>
              <span className="ml-auto font-mono text-3xs text-content-faint">{items.length}</span>
            </div>
            <div className="divide-y divide-edge-subtle/60">
              {items.map(({ policy, effects }) => (
                <div key={policy.id} className="px-3 py-2">
                  <div className="flex items-baseline gap-2">
                    <span
                      className={`text-xs font-semibold ${
                        activeSet.has(policy.id) ? 'text-accent' : 'text-content-primary'
                      }`}
                    >
                      <IconText>{policy.name}</IconText>
                    </span>
                    {activeSet.has(policy.id) && <Badge tone="accent">активна</Badge>}
                    <span className="ml-auto shrink-0 font-mono text-3xs text-content-faint">
                      {policy.influenceCost} 👑 · {policy.influenceUpkeep} 👑/с
                    </span>
                  </div>

                  <p className="mt-0.5 text-2xs text-content-muted">
                    <IconText>{policy.description}</IconText>
                  </p>

                  {effects.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {effects.map((line, n) => (
                        <span
                          key={n}
                          className={`rounded px-1.5 py-0.5 text-3xs ${
                            line.good ? 'bg-accent/12 text-accent' : 'bg-warning/12 text-warning'
                          }`}
                        >
                          {line.text}
                        </span>
                      ))}
                    </div>
                  )}

                  {policy.prerequisites && policy.prerequisites.length > 0 && (
                    <p className="mt-1 text-3xs text-content-faint">
                      Требует технологию: {policy.prerequisites.map((id) => technologyLabel(id)).join(', ')}
                    </p>
                  )}

                  {policy.risks && policy.risks.length > 0 && (
                    <p className="mt-0.5 text-3xs text-danger">Риски: {policy.risks.join('; ')}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
};
