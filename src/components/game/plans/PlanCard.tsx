/**
 * Один список производства (bigplan.md, пункт 37).
 *
 * Карточка свёрнута по умолчанию и показывает только заголовок и прогресс: у игрока обычно
 * несколько списков, и развернуть все — значит потерять обзор в панели шириной 400px.
 * Развёрнутость держим локально, а не в сейве: это состояние одного открытия панели.
 */

import { useState } from 'react';
import { Archive, ChevronDown, ChevronRight, Pencil, Pin, Trash2, Undo2 } from 'lucide-react';
import type { PlanItemDraft, PlanItemPatch, ProductionPlan } from '../../../utils/plansApi';
import { planProgress } from '../../../features/plansStore';
import { AddItemForm } from './AddItemForm';
import { ChainSuggest } from './ChainSuggest';
import { PlanItemRow } from './PlanItemRow';

interface PlanCardProps {
  plan: ProductionPlan;
  /** Только что созданный список разворачиваем сам: игрок пришёл его заполнять, а не смотреть. */
  defaultExpanded?: boolean;
  onRename: (title: string) => void;
  onTogglePinned: (pinned: boolean) => void;
  onToggleArchived: (archived: boolean) => void;
  onRemove: () => void;
  onAddItems: (drafts: PlanItemDraft[]) => Promise<boolean>;
  onPatchItem: (itemId: number, patch: PlanItemPatch) => void;
  onRemoveItem: (itemId: number) => void;
}

export function PlanCard({
  plan,
  defaultExpanded = false,
  onRename,
  onTogglePinned,
  onToggleArchived,
  onRemove,
  onAddItems,
  onPatchItem,
  onRemoveItem,
}: PlanCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [renaming, setRenaming] = useState(false);
  const [draftTitle, setDraftTitle] = useState(plan.title);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const { done, total } = planProgress(plan);
  const ratio = total > 0 ? done / total : 0;
  const complete = total > 0 && done === total;

  const commitRename = () => {
    const title = draftTitle.trim();
    setRenaming(false);
    if (title.length > 0 && title !== plan.title) onRename(title);
    else setDraftTitle(plan.title);
  };

  return (
    <div
      className="rounded-md border"
      style={{
        borderColor: complete ? 'rgb(62 224 127 / 0.35)' : 'var(--edge)',
        background: 'var(--surface-2)',
      }}
    >
      <div className="flex items-center gap-1 px-1.5 py-1.5">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="icon-btn h-6 w-6 shrink-0"
          title={expanded ? 'Свернуть' : 'Развернуть'}
          aria-label={expanded ? 'Свернуть' : 'Развернуть'}
        >
          {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </button>

        <div className="min-w-0 flex-1">
          {renaming ? (
            <input
              type="text"
              autoFocus
              value={draftTitle}
              maxLength={120}
              onChange={(e) => setDraftTitle(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename();
                if (e.key === 'Escape') {
                  setDraftTitle(plan.title);
                  setRenaming(false);
                }
              }}
              className="w-full rounded px-1.5 py-1 text-xs"
            />
          ) : (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="block w-full text-left"
            >
              <span className="block truncate text-xs font-semibold text-content-primary">
                {plan.title}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="font-mono text-3xs tabular-nums text-content-faint">
                  {done}/{total}
                </span>
                <span className="meter h-1 min-w-0 flex-1">
                  <span
                    className="meter-fill block h-full"
                    style={{
                      width: `${Math.round(ratio * 100)}%`,
                      background: complete ? 'var(--accent)' : 'var(--info)',
                    }}
                  />
                </span>
              </span>
            </button>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={() => onTogglePinned(!plan.pinned)}
            title={plan.pinned ? 'Открепить список' : 'Закрепить список сверху'}
            aria-label={plan.pinned ? 'Открепить список' : 'Закрепить список сверху'}
            className="icon-btn h-6 w-6"
            style={{ color: plan.pinned ? 'var(--warning)' : undefined }}
          >
            <Pin size={12} />
          </button>
          <button
            type="button"
            onClick={() => {
              setDraftTitle(plan.title);
              setRenaming(true);
            }}
            title="Переименовать"
            aria-label="Переименовать"
            className="icon-btn h-6 w-6"
          >
            <Pencil size={12} />
          </button>
          <button
            type="button"
            onClick={() => onToggleArchived(!plan.archived)}
            title={plan.archived ? 'Вернуть из архива' : 'В архив'}
            aria-label={plan.archived ? 'Вернуть из архива' : 'В архив'}
            className="icon-btn h-6 w-6"
          >
            {plan.archived ? <Undo2 size={12} /> : <Archive size={12} />}
          </button>
          {/* Удаление списка — в два клика: вместе с ним уходят все пункты и заметки. */}
          <button
            type="button"
            onClick={() => (confirmRemove ? onRemove() : setConfirmRemove(true))}
            onBlur={() => setConfirmRemove(false)}
            title={confirmRemove ? 'Нажмите ещё раз, чтобы удалить список' : 'Удалить список'}
            aria-label="Удалить список"
            className="icon-btn h-6 w-6"
            style={{ color: confirmRemove ? 'var(--danger)' : undefined }}
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="space-y-1.5 border-t px-1.5 py-1.5" style={{ borderColor: 'var(--edge)' }}>
          {plan.items.length === 0 ? (
            <p className="px-1 text-3xs text-content-faint">
              Список пуст. Добавьте здание, ресурс или заметку — или попросите подсказать цепочку.
            </p>
          ) : (
            <div className="space-y-1">
              {plan.items.map((item) => (
                <PlanItemRow
                  key={item.id}
                  item={item}
                  onToggleDone={(value) => onPatchItem(item.id, { done: value })}
                  onTogglePinned={(value) => onPatchItem(item.id, { pinned: value })}
                  onRemove={() => onRemoveItem(item.id)}
                />
              ))}
            </div>
          )}

          <ChainSuggest
            goalKind={plan.goalKind}
            goalRef={plan.goalRef}
            autoOpen={plan.items.length === 0}
            onAdd={onAddItems}
          />
          <AddItemForm onAdd={(draft) => onAddItems([draft])} />
        </div>
      )}
    </div>
  );
}
