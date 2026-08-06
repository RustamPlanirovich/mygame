/**
 * «ЧТО НУЖНО, ЧТОБЫ ЭТО СДЕЛАТЬ» — подсказка цепочки (bigplan.md, пункт 37).
 *
 * Ровно та задача, из которой вырос весь раздел: игрок хочет компьютер, а чтобы его собрать,
 * нужно здание, которому нужно другое здание, которому нужна руда. Руками это разворачивается
 * в десяток пунктов, и половина теряется.
 *
 * Расчёт — чистая функция core/plans/planChain.ts. Здесь только выбор цели, галочки и одна
 * отправка пачкой: предвыбраны пункты, которых у игрока ЕЩЁ НЕТ (уже построенное показываем,
 * но не отмечаем — иначе список сразу забивается тем, что и так стоит на карте).
 */

import { useMemo, useState } from 'react';
import { Lightbulb, Lock, Plus } from 'lucide-react';
import { suggestChain, type ChainSuggestion } from '../../../core/plans/planChain';
import { useGameStore } from '../../../features/gameStore';
import type { PlanItemDraft } from '../../../utils/plansApi';
import { resourceLabel } from '../../../core/i18n/label';
import { GameIcon } from '../../ui/icons';
import { RefPicker } from './RefPicker';

interface ChainSuggestProps {
  /** Цель списка, если она задана при создании — тогда подсказка сразу знает, что разворачивать. */
  goalKind: 'building' | 'resource' | null;
  goalRef: string | null;
  /**
   * Раскрыть сразу. Ставится для ПУСТОГО списка с целью: игрок только что сказал «хочу пластик»
   * и ждёт ответа «вот что для этого построить», а не ещё одной кнопки. В непустом списке
   * подсказка остаётся свёрнутой — там уже есть что читать.
   */
  autoOpen?: boolean;
  onAdd: (drafts: PlanItemDraft[]) => Promise<boolean>;
}

export function ChainSuggest({ goalKind, goalRef, autoOpen = false, onAdd }: ChainSuggestProps) {
  const [open, setOpen] = useState(autoOpen && Boolean(goalRef));
  const [kind, setKind] = useState<'building' | 'resource'>(goalKind ?? 'resource');
  const [refId, setRefId] = useState<string | null>(goalRef);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  /*
   * Каталог и технологии читаем через getState() в момент расчёта: подписка на s.buildings
   * означала бы пересчёт цепочки 20 раз в секунду вместе с тиком. Пересчитывается на смену
   * цели — этого достаточно, потому что дерево технологий за время открытой панели не меняется.
   */
  const suggestions = useMemo<ChainSuggestion[]>(() => {
    if (!open || !refId) return [];
    const state = useGameStore.getState();
    return suggestChain({ kind, refId }, state.buildings, {
      unlockedTech: state.research.technologies,
    });
  }, [open, kind, refId]);

  // Отмечено = всё предложенное, кроме того, что игрок снял, и кроме уже построенного.
  const isChecked = (s: ChainSuggestion) => !skipped.includes(s.refId) && s.built === 0;
  const checked = suggestions.filter(isChecked);

  const toggle = (id: string) => {
    setSkipped((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const addChecked = async () => {
    if (checked.length === 0 || busy) return;
    setBusy(true);
    const ok = await onAdd(
      checked.map((s) => ({
        kind: 'building' as const,
        refId: s.refId,
        // Зачем здание в цепочке — иначе через день пункт «Плавильня» не объяснит сам себя.
        text: s.producesFor ? `для ${resourceLabel(s.producesFor)}` : null,
        targetCount: null,
      })),
    );
    setBusy(false);
    if (ok) {
      setOpen(false);
      setSkipped([]);
    }
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn btn-ghost btn-xs btn-block">
        <Lightbulb size={12} />
        Подсказать цепочку
      </button>
    );
  }

  return (
    <div
      className="space-y-1.5 rounded-md border p-2"
      style={{ borderColor: 'rgb(255 184 108 / 0.3)', background: 'var(--surface-2)' }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 text-2xs font-semibold uppercase tracking-wider text-warning">
          <Lightbulb size={11} />
          Что нужно, чтобы это сделать
        </span>
        <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost btn-xs">
          Скрыть
        </button>
      </div>

      <div className="flex gap-1">
        {(['resource', 'building'] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => {
              setKind(option);
              setRefId(null);
              setSkipped([]);
            }}
            className="flex-1 rounded border px-1.5 py-1 text-3xs font-semibold transition-colors"
            style={{
              borderColor: kind === option ? 'var(--info)' : 'var(--edge)',
              background: kind === option ? 'rgb(94 216 242 / 0.14)' : 'var(--surface-3)',
              color: kind === option ? 'var(--info)' : 'var(--text-muted)',
            }}
          >
            {option === 'resource' ? 'Нужен ресурс' : 'Нужно здание'}
          </button>
        ))}
      </div>

      <RefPicker
        kind={kind}
        value={refId}
        onChange={(id) => {
          setRefId(id);
          setSkipped([]);
        }}
        placeholder={kind === 'resource' ? 'Что хочу получить…' : 'Что хочу построить…'}
      />

      {refId && suggestions.length === 0 && (
        <p className="text-3xs text-content-faint">
          Для этой цели цепочки нет: ресурс либо добывается с месторождений, либо покупается на бирже.
        </p>
      )}

      {suggestions.length > 0 && (
        <>
          <p className="text-3xs text-content-faint">
            Порядок сверху вниз — сначала сырьё, потом переработка. Уже построенное не отмечено.
          </p>
          <div className="max-h-56 space-y-0.5 overflow-y-auto">
            {suggestions.map((s) => (
              <label
                key={s.refId}
                className="flex cursor-pointer items-start gap-1.5 rounded px-1 py-1 transition-colors hover:bg-white/[0.05]"
              >
                <input
                  type="checkbox"
                  checked={isChecked(s)}
                  onChange={() => toggle(s.refId)}
                  className="mt-0.5 h-3.5 w-3.5 shrink-0"
                />
                <GameIcon icon="crane" size={12} className="shrink-0 translate-y-0.5 text-info" mono />
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-xs text-content-secondary">{s.label}</span>
                  <span className="block text-3xs text-content-faint">
                    {s.producesFor ? `даёт ${resourceLabel(s.producesFor)}` : 'цель списка'}
                    {s.built > 0 && ` · уже есть: ${s.built}`}
                    {s.locked && (
                      <span className="text-warning">
                        {' '}
                        <Lock size={8} className="inline" /> закрыто технологией
                      </span>
                    )}
                  </span>
                </span>
              </label>
            ))}
          </div>

          <button
            type="button"
            onClick={addChecked}
            disabled={checked.length === 0 || busy}
            className="btn btn-info btn-xs btn-block"
          >
            <Plus size={12} />
            {busy ? 'Добавляю…' : `Добавить отмеченные (${checked.length})`}
          </button>
        </>
      )}
    </div>
  );
}
