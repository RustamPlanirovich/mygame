/**
 * РАЗДЕЛ «ПЛАНЫ»: списки того, что нужно построить, плюс заметки (bigplan.md, пункт 37).
 *
 * Зачем раздел: цепочки в игре длинные, а держать в голове «чтобы сделать компьютер, нужны
 * такие-то здания, а перед ними такие-то» невозможно. Игрок заводит список под цель, отмечает
 * сделанное и дописывает заметки; всё лежит в БД (server/plans.js), поэтому доступно с любого
 * устройства и не зависит от того, загрузился ли сейв.
 *
 * Прогресс по пунктам-зданиям и пунктам-ресурсам подтягивается из живого состояния игры —
 * см. PlanItemRow.
 */

import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { usePlansStore } from '../../../features/plansStore';
import type { PlanItemDraft, PlanItemPatch, ProductionPlan } from '../../../utils/plansApi';
import { getCurrentSlotId } from '../../../utils/settingsApi';
import { Alert, EmptyState, SkeletonRows } from '../../ui';
import { GameIcon } from '../../ui/icons';
import { PlanCard } from './PlanCard';
import { RefPicker } from './RefPicker';

export function PlansPanel() {
  const plans = usePlansStore((s) => s.plans);
  const loading = usePlansStore((s) => s.loading);
  const loaded = usePlansStore((s) => s.loaded);
  const error = usePlansStore((s) => s.error);
  const load = usePlansStore((s) => s.load);
  const clearError = usePlansStore((s) => s.clearError);

  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [showArchive, setShowArchive] = useState(false);
  const [busy, setBusy] = useState(false);

  /*
   * Цель списка необязательна, но именно с неё начинается сценарий, ради которого раздел и
   * появился: «мне нужен пластик». Указав её при создании, игрок сразу получает развёрнутую
   * цепочку — подсказка внутри карточки открывается с уже выбранной целью и не заставляет
   * искать тот же пластик второй раз.
   */
  const [goalKind, setGoalKind] = useState<'resource' | 'building'>('resource');
  const [goalRef, setGoalRef] = useState<string | null>(null);
  /** Какой список только что создан — его карточка монтируется уже развёрнутой. */
  const [justCreatedId, setJustCreatedId] = useState<number | null>(null);

  /*
   * Догружаем при открытии панели (повторный вызов дедуплицируется в сторе). Слот берём из
   * settingsApi, а не из стора: панель могли открыть раньше, чем App проставил слот, и тогда
   * планы прилетели бы «без слота».
   */
  useEffect(() => {
    load(getCurrentSlotId());
  }, [load]);

  const activePlans = plans.filter((plan) => !plan.archived);
  const archivedPlans = plans.filter((plan) => plan.archived);

  const resetForm = () => {
    setTitle('');
    setGoalRef(null);
    setGoalKind('resource');
    setCreating(false);
  };

  const submitNew = async () => {
    const value = title.trim();
    if (value.length === 0 || busy) return;
    setBusy(true);
    const id = await usePlansStore.getState().create({
      title: value,
      goalKind: goalRef ? goalKind : null,
      goalRef,
    });
    setBusy(false);
    if (id !== null) {
      setJustCreatedId(id);
      resetForm();
    }
  };

  /*
   * Выбрал цель — заголовок подставляется сам, но только пока игрок его не трогал: перетирать
   * уже написанное руками название нельзя. Так «новый список → пластик → создать» занимает три
   * действия вместо четырёх, а название всё равно остаётся осмысленным.
   */
  const pickGoal = (id: string | null, label: string | null) => {
    setGoalRef(id);
    if (id && label && title.trim().length === 0) setTitle(`Сделать: ${label}`);
  };

  /** Все карточки ходят в стор одинаково — обработчики собираем в одном месте. */
  const cardHandlers = (plan: ProductionPlan) => ({
    onRename: (value: string) => usePlansStore.getState().rename(plan.id, value),
    onTogglePinned: (value: boolean) => usePlansStore.getState().setPlanPinned(plan.id, value),
    onToggleArchived: (value: boolean) => usePlansStore.getState().setPlanArchived(plan.id, value),
    onRemove: () => usePlansStore.getState().remove(plan.id),
    onAddItems: (drafts: PlanItemDraft[]) => usePlansStore.getState().addItems(plan.id, drafts),
    onPatchItem: (itemId: number, patch: PlanItemPatch) =>
      usePlansStore.getState().patchItem(plan.id, itemId, patch),
    onRemoveItem: (itemId: number) => usePlansStore.getState().removeItem(plan.id, itemId),
  });

  return (
    <div className="space-y-2 p-2">
      {error && (
        <Alert tone="danger" onDismiss={clearError}>
          {error}
        </Alert>
      )}

      {creating ? (
        <div
          className="space-y-1.5 rounded-md border p-2"
          style={{ borderColor: 'var(--edge)', background: 'var(--surface-2)' }}
        >
          <p className="text-3xs text-content-faint">
            Что хотите получить? Выберите цель — список сразу подскажет, что для неё построить.
          </p>

          <div className="flex gap-1">
            {(['resource', 'building'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setGoalKind(option);
                  setGoalRef(null);
                }}
                className="flex-1 rounded border px-1.5 py-1 text-3xs font-semibold transition-colors"
                style={{
                  borderColor: goalKind === option ? 'var(--info)' : 'var(--edge)',
                  background: goalKind === option ? 'rgb(94 216 242 / 0.14)' : 'var(--surface-3)',
                  color: goalKind === option ? 'var(--info)' : 'var(--text-muted)',
                }}
              >
                {option === 'resource' ? 'Нужен ресурс' : 'Нужно здание'}
              </button>
            ))}
          </div>

          <RefPicker
            kind={goalKind}
            value={goalRef}
            onChange={pickGoal}
            placeholder={goalKind === 'resource' ? 'Например: пластик' : 'Например: плавильня'}
          />

          <input
            type="text"
            autoFocus
            value={title}
            maxLength={120}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitNew();
              if (e.key === 'Escape') resetForm();
            }}
            placeholder="Название списка"
            className="w-full rounded-md px-2 py-1.5 text-xs"
          />

          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={submitNew}
              disabled={title.trim().length === 0 || busy}
              className="btn btn-info btn-xs flex-1"
            >
              {busy ? 'Создаю…' : 'Создать список'}
            </button>
            <button type="button" onClick={resetForm} className="btn btn-ghost btn-xs">
              Отмена
            </button>
          </div>
          <p className="text-3xs text-content-faint">
            Цель можно не указывать — тогда получится просто список заметок.
          </p>
        </div>
      ) : (
        <button type="button" onClick={() => setCreating(true)} className="btn btn-info btn-xs btn-block">
          <Plus size={12} />
          Новый список
        </button>
      )}

      {loading && !loaded ? (
        <SkeletonRows rows={3} />
      ) : activePlans.length === 0 ? (
        <EmptyState
          icon={<GameIcon icon="clipboard" size={22} mono />}
          title="Списков пока нет"
          hint="Заведите список под цель — «сделать компьютер» — и добавьте в него здания, ресурсы и заметки. Кнопка «Подсказать цепочку» внутри списка развернёт, что нужно построить до этого."
        />
      ) : (
        <div className="space-y-1.5">
          {activePlans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              defaultExpanded={plan.id === justCreatedId}
              {...cardHandlers(plan)}
            />
          ))}
        </div>
      )}

      {archivedPlans.length > 0 && (
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setShowArchive((v) => !v)}
            className="btn btn-ghost btn-xs btn-block"
          >
            {showArchive ? 'Скрыть архив' : `Архив (${archivedPlans.length})`}
          </button>
          {showArchive && (
            <div className="mt-1.5 space-y-1.5">
              {archivedPlans.map((plan) => (
                <PlanCard key={plan.id} plan={plan} {...cardHandlers(plan)} />
              ))}
            </div>
          )}
        </div>
      )}

      <p className="px-1 text-3xs leading-relaxed text-content-faint">
        Списки привязаны к текущему слоту сохранения и хранятся на сервере: отметки видны с любого
        устройства и не теряются при перезагрузке.
      </p>
    </div>
  );
}
