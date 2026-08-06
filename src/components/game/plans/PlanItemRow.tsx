/**
 * Один пункт списка производства (bigplan.md, пункт 37).
 *
 * Пункт не просто текст с галочкой: если это здание или ресурс, рядом показывается ФАКТ из
 * игры — сколько таких зданий уже стоит и сколько ресурса на складе. Без этого игрок отмечал бы
 * пункты по памяти и всё равно шёл проверять на карте.
 *
 * Про подписки на gameStore: тик идёт 20 раз в секунду, поэтому селектор возвращает уже
 * ГОТОВУЮ СТРОКУ (formatNumber) и целый процент, а не Decimal. Zustand сравнивает результат
 * через Object.is: строка меняется только когда меняется то, что видно на экране, и строка
 * перерисовывается на порядки реже, чем идёт тик.
 */

import { useState } from 'react';
import { Check, Pin, Trash2, Hammer, Lock } from 'lucide-react';
import type { ResourceType } from '../../../core/gameTypes';
import type { PlanItem } from '../../../utils/plansApi';
import { useGameStore } from '../../../features/gameStore';
import { useUiStore } from '../../../features/uiStore';
import { resourceLabel } from '../../../core/i18n/label';
import { formatNumber } from '../../../core/math/format';
import { isBuildingUnlocked, getTechnologyForBuilding } from '../../../core/constants/technologies';
import { GameIcon } from '../../ui/icons';

interface PlanItemRowProps {
  item: PlanItem;
  onToggleDone: (done: boolean) => void;
  onTogglePinned: (pinned: boolean) => void;
  onRemove: () => void;
}

/** Прогресс пункта: «сколько уже есть» из игры против цели, если цель задана. */
interface Progress {
  /** Текст справа от названия: «2/5» или «450». */
  label: string;
  /** null — цели нет, полоску рисовать не по чему. */
  ratio: number | null;
}

function useBuildingProgress(refId: string | null, target: number | null): Progress | null {
  const built = useGameStore((s) => (refId ? (s.buildings.find((b) => b.id === refId)?.count ?? 0) : 0));
  if (!refId) return null;
  return {
    label: target ? `${built}/${target}` : `${built} шт.`,
    ratio: target ? Math.min(1, built / target) : null,
  };
}

function useResourceProgress(refId: string | null, target: number | null): Progress | null {
  // Строка, а не Decimal: см. комментарий в шапке файла.
  const amountLabel = useGameStore((s) => {
    if (!refId) return null;
    const res = s.resources[refId as ResourceType];
    return res ? formatNumber(res.amount) : null;
  });
  // Целый процент — вторая величина, которая меняется редко, а не 20 раз в секунду.
  const percent = useGameStore((s) => {
    if (!refId || !target) return null;
    const res = s.resources[refId as ResourceType];
    if (!res) return null;
    return Math.min(100, Math.round(res.amount.div(target).toNumber() * 100));
  });

  if (!refId || amountLabel === null) return null;
  return {
    label: target ? `${amountLabel}/${formatNumber(target)}` : amountLabel,
    ratio: percent === null ? null : percent / 100,
  };
}

export function PlanItemRow({ item, onToggleDone, onTogglePinned, onRemove }: PlanItemRowProps) {
  const [confirmRemove, setConfirmRemove] = useState(false);

  const buildingProgress = useBuildingProgress(item.kind === 'building' ? item.refId : null, item.targetCount);
  const resourceProgress = useResourceProgress(item.kind === 'resource' ? item.refId : null, item.targetCount);
  const progress = buildingProgress ?? resourceProgress;

  const buildingName = useGameStore((s) =>
    item.kind === 'building' && item.refId
      ? (s.buildings.find((b) => b.id === item.refId)?.name ?? null)
      : null,
  );
  const unlocked = useGameStore((s) =>
    item.kind === 'building' && item.refId ? isBuildingUnlocked(item.refId, s.research.technologies) : true,
  );
  const selectBuild = useGameStore((s) => s.selectBuild);
  const openSection = useUiStore((s) => s.open);

  /*
   * Название берём из каталога зданий и словаря ресурсов, а не из id: сырой id в интерфейс
   * не попадает (см. tools/check-raw-labels.mjs). Если здания с таким id больше нет —
   * показываем текст пункта, чтобы строка не стала пустой.
   */
  const title =
    item.kind === 'note'
      ? (item.text ?? '')
      : item.kind === 'building'
        ? (buildingName ?? item.text ?? 'Неизвестное здание')
        : resourceLabel(item.refId ?? '');

  const icon = item.kind === 'building' ? 'crane' : item.kind === 'resource' ? 'crate' : 'clipboard';

  /** Цель достигнута по факту, но галочка не поставлена — самая полезная подсказка в списке. */
  const readyButUnchecked = !item.done && progress?.ratio !== null && (progress?.ratio ?? 0) >= 1;

  const handleBuild = () => {
    if (!item.refId || !unlocked) return;
    selectBuild(item.refId);
    openSection('build');
  };

  return (
    <div
      className="rounded-md border px-2 py-1.5"
      style={{
        borderColor: readyButUnchecked ? 'rgb(62 224 127 / 0.35)' : 'var(--edge)',
        background: item.done ? 'var(--surface-2)' : 'var(--surface-3)',
        opacity: item.done ? 0.65 : 1,
      }}
    >
      <div className="flex items-start gap-2">
        {/* Галочка — главное действие строки, поэтому она первая и с нормальной областью нажатия. */}
        <button
          type="button"
          onClick={() => onToggleDone(!item.done)}
          title={item.done ? 'Снять отметку' : 'Отметить сделанным'}
          aria-label={item.done ? 'Снять отметку' : 'Отметить сделанным'}
          className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors"
          style={{
            borderColor: item.done ? 'var(--accent)' : 'var(--edge-strong)',
            background: item.done ? 'var(--accent)' : 'transparent',
            color: 'var(--ink-950)',
          }}
        >
          {item.done && <Check size={13} strokeWidth={3} />}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <GameIcon icon={icon} size={13} className="shrink-0 translate-y-0.5 text-info" mono />
            <span
              className={`min-w-0 flex-1 break-words text-xs ${item.done ? 'line-through' : ''}`}
              style={{ color: item.done ? 'var(--text-faint)' : 'var(--text-primary)', whiteSpace: 'pre-wrap' }}
            >
              {title}
            </span>
            {progress && (
              <span className="shrink-0 font-mono text-3xs tabular-nums text-content-faint">
                {progress.label}
              </span>
            )}
          </div>

          {/* Комментарий к пункту-зданию/ресурсу: у заметки текст уже в заголовке. */}
          {item.kind !== 'note' && item.text && (
            <p className="mt-0.5 whitespace-pre-wrap break-words text-3xs text-content-faint">{item.text}</p>
          )}

          {progress?.ratio !== null && progress?.ratio !== undefined && !item.done && (
            <div className="meter mt-1">
              <div
                className="meter-fill"
                style={{
                  width: `${Math.round(progress.ratio * 100)}%`,
                  background: progress.ratio >= 1 ? 'var(--accent)' : 'var(--info)',
                }}
              />
            </div>
          )}

          {readyButUnchecked && (
            <p className="mt-0.5 text-3xs text-accent">Цель уже достигнута — можно отметить</p>
          )}

          {item.kind === 'building' && !unlocked && (
            <p className="mt-0.5 flex items-center gap-1 text-3xs text-warning">
              <Lock size={9} />
              Нужна технология: {getTechnologyForBuilding(item.refId ?? '')?.name ?? '—'}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          {item.kind === 'building' && unlocked && !item.done && (
            <button
              type="button"
              onClick={handleBuild}
              title="Выбрать это здание в строительстве"
              aria-label="Выбрать это здание в строительстве"
              className="icon-btn h-6 w-6"
            >
              <Hammer size={12} />
            </button>
          )}
          <button
            type="button"
            onClick={() => onTogglePinned(!item.pinned)}
            title={item.pinned ? 'Открепить' : 'Закрепить сверху'}
            aria-label={item.pinned ? 'Открепить' : 'Закрепить сверху'}
            className="icon-btn h-6 w-6"
            style={{ color: item.pinned ? 'var(--warning)' : undefined }}
          >
            <Pin size={12} />
          </button>
          {/*
            Удаление в два клика: пункты стоят вплотную, и промах по крестику стирал бы
            записанное руками. Второй клик — подтверждение, само состояние локальное.
          */}
          <button
            type="button"
            onClick={() => (confirmRemove ? onRemove() : setConfirmRemove(true))}
            onBlur={() => setConfirmRemove(false)}
            title={confirmRemove ? 'Нажмите ещё раз, чтобы удалить' : 'Удалить пункт'}
            aria-label="Удалить пункт"
            className="icon-btn h-6 w-6"
            style={{ color: confirmRemove ? 'var(--danger)' : undefined }}
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}
