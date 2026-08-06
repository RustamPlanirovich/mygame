/**
 * СПИСКИ ПРОИЗВОДСТВА: клиентский стор (bigplan.md, пункт 37).
 *
 * Данные живут на сервере (server/plans.js), здесь — кэш на время сессии плюс оптимистичные
 * правки. Оптимистичность здесь не украшательство: отметить «построил» игрок успевает быстрее,
 * чем идёт круг до сервера, и галочка, которая появляется через 200 мс, читается как «не нажалось».
 * Поэтому UI обновляется сразу, а при отказе сервера правка откатывается и показывается ошибка.
 *
 * Отдельный стор, а не секция gameStore: это не игровое состояние. gameStore пересобирается
 * тиком 20 раз в секунду и целиком уходит в сейв с оптимистичной блокировкой ревизии —
 * заметкам там не место (см. комментарий в server/plans.js).
 */

import { create } from 'zustand';
import {
  addPlanItems,
  createPlan,
  deletePlan,
  deletePlanItem,
  fetchPlans,
  humanizePlansError,
  updatePlan,
  updatePlanItem,
  type PlanItem,
  type PlanItemDraft,
  type PlanItemPatch,
  type ProductionPlan,
} from '../utils/plansApi';

interface PlansState {
  plans: ProductionPlan[];
  loading: boolean;
  /** Загружали ли планы хотя бы раз — пустой список и «ещё не грузили» выглядят по-разному. */
  loaded: boolean;
  error: string | null;
  /** Слот, для которого загружен кэш: после переключения слота показывать прежние планы нельзя. */
  slotId: number | null;

  load: (slotId: number | null, force?: boolean) => Promise<void>;
  create: (input: {
    title: string;
    goalKind?: 'building' | 'resource' | null;
    goalRef?: string | null;
  }) => Promise<number | null>;
  rename: (planId: number, title: string) => Promise<void>;
  setPlanPinned: (planId: number, pinned: boolean) => Promise<void>;
  setPlanArchived: (planId: number, archived: boolean) => Promise<void>;
  remove: (planId: number) => Promise<void>;

  addItems: (planId: number, drafts: PlanItemDraft[]) => Promise<boolean>;
  patchItem: (planId: number, itemId: number, patch: PlanItemPatch) => Promise<void>;
  removeItem: (planId: number, itemId: number) => Promise<void>;

  clearError: () => void;
  reset: () => void;
}

/**
 * Незакрытые пункты в порядке отображения: закреплённые сверху, затем по sort_order.
 * Сервер отдаёт уже в этом порядке, но после оптимистичной правки pinned порядок надо
 * восстановить локально — иначе пункт «прыгает» на место только после перезагрузки панели.
 */
function sortItems(items: PlanItem[]): PlanItem[] {
  return items
    .slice()
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.sortOrder - b.sortOrder || a.id - b.id);
}

function sortPlans(plans: ProductionPlan[]): ProductionPlan[] {
  return plans
    .slice()
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.sortOrder - b.sortOrder || a.id - b.id);
}

/** Заменить один план в списке, не задевая остальные. */
function replacePlan(
  plans: ProductionPlan[],
  planId: number,
  update: (plan: ProductionPlan) => ProductionPlan,
): ProductionPlan[] {
  return plans.map((plan) => (plan.id === planId ? update(plan) : plan));
}

/*
 * Запрос в полёте: панель монтируется при открытии, а App грузит планы при входе — без дедупа
 * получались два одинаковых GET на каждое открытие игры.
 */
let inflight: Promise<void> | null = null;

export const usePlansStore = create<PlansState>((set, get) => ({
  plans: [],
  loading: false,
  loaded: false,
  error: null,
  slotId: null,

  load: async (slotId, force = false) => {
    const state = get();
    if (inflight && state.slotId === slotId) return inflight;
    if (!force && state.loaded && state.slotId === slotId) return;

    set({ loading: true, error: null, slotId });
    const promise = fetchPlans(slotId).then((result) => {
      // Пока шёл запрос, слот могли переключить — тогда ответ уже неактуален.
      if (get().slotId !== slotId) return;
      if (!result.ok) {
        set({ loading: false, error: humanizePlansError(result.error) });
        return;
      }
      set({
        plans: sortPlans(result.data ?? []).map((plan) => ({ ...plan, items: sortItems(plan.items) })),
        loading: false,
        loaded: true,
      });
    });

    inflight = promise.finally(() => {
      inflight = null;
    });
    return inflight;
  },

  create: async ({ title, goalKind = null, goalRef = null }) => {
    const result = await createPlan({ title, slotId: get().slotId, goalKind, goalRef });
    if (!result.ok || !result.data) {
      set({ error: humanizePlansError(result.error) });
      return null;
    }
    // Ответ сервера, а не локальная сборка: id и sort_order знает только он.
    set((state) => ({
      plans: sortPlans([...state.plans, { ...result.data!, items: [] }]),
      error: null,
      loaded: true,
    }));
    return result.data.id;
  },

  rename: async (planId, title) => {
    const previous = get().plans;
    set({ plans: replacePlan(previous, planId, (plan) => ({ ...plan, title })), error: null });

    const result = await updatePlan(planId, { title });
    if (!result.ok) set({ plans: previous, error: humanizePlansError(result.error) });
  },

  setPlanPinned: async (planId, pinned) => {
    const previous = get().plans;
    set({
      plans: sortPlans(replacePlan(previous, planId, (plan) => ({ ...plan, pinned }))),
      error: null,
    });

    const result = await updatePlan(planId, { pinned });
    if (!result.ok) set({ plans: previous, error: humanizePlansError(result.error) });
  },

  setPlanArchived: async (planId, archived) => {
    const previous = get().plans;
    set({ plans: replacePlan(previous, planId, (plan) => ({ ...plan, archived })), error: null });

    const result = await updatePlan(planId, { archived });
    if (!result.ok) set({ plans: previous, error: humanizePlansError(result.error) });
  },

  remove: async (planId) => {
    const previous = get().plans;
    set({ plans: previous.filter((plan) => plan.id !== planId), error: null });

    const result = await deletePlan(planId);
    // 404 значит «уже удалён» — откатывать нечего, список и так верен.
    if (!result.ok && result.error !== 'PLAN_NOT_FOUND') {
      set({ plans: previous, error: humanizePlansError(result.error) });
    }
  },

  addItems: async (planId, drafts) => {
    if (drafts.length === 0) return false;

    /*
     * Пункты добавляем ПО ОТВЕТУ сервера, без оптимистичного черновика: у нового пункта есть
     * серверные id и sort_order, а без id его нельзя ни отметить, ни удалить — то есть
     * «мгновенный» пункт был бы мёртвым до ответа. Запрос один, задержка одна.
     */
    const result = await addPlanItems(planId, drafts);
    if (!result.ok || !result.data) {
      set({ error: humanizePlansError(result.error) });
      return false;
    }

    set((state) => ({
      plans: replacePlan(state.plans, planId, (plan) => ({
        ...plan,
        items: sortItems([...plan.items, ...result.data!]),
      })),
      error: null,
    }));
    return true;
  },

  patchItem: async (planId, itemId, patch) => {
    const previous = get().plans;
    set({
      plans: replacePlan(previous, planId, (plan) => ({
        ...plan,
        items: sortItems(
          plan.items.map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  ...patch,
                  // doneAt ставит сервер; локально показываем «сейчас», чтобы подпись не пустовала.
                  doneAt: patch.done === undefined ? item.doneAt : patch.done ? new Date().toISOString() : null,
                }
              : item,
          ),
        ),
      })),
      error: null,
    });

    const result = await updatePlanItem(itemId, patch);
    if (!result.ok) {
      set({ plans: previous, error: humanizePlansError(result.error) });
      return;
    }
    // Ответ сервера — источник правды по done_at и обрезке текста.
    const saved = result.data;
    if (!saved) return;
    set((state) => ({
      plans: replacePlan(state.plans, planId, (plan) => ({
        ...plan,
        items: sortItems(plan.items.map((item) => (item.id === itemId ? saved : item))),
      })),
    }));
  },

  removeItem: async (planId, itemId) => {
    const previous = get().plans;
    set({
      plans: replacePlan(previous, planId, (plan) => ({
        ...plan,
        items: plan.items.filter((item) => item.id !== itemId),
      })),
      error: null,
    });

    const result = await deletePlanItem(itemId);
    if (!result.ok && result.error !== 'ITEM_NOT_FOUND') {
      set({ plans: previous, error: humanizePlansError(result.error) });
    }
  },

  clearError: () => set((state) => (state.error === null ? state : { error: null })),

  /** Выход из аккаунта и смена слота: чужие планы показывать нельзя. */
  reset: () => set({ plans: [], loaded: false, loading: false, error: null, slotId: null }),
}));

/** Активные (не архивные) списки. */
export function selectActivePlans(state: PlansState): ProductionPlan[] {
  return state.plans.filter((plan) => !plan.archived);
}

/**
 * Счётчик для кнопки в быстрой панели: сколько ЗАКРЕПЛЁННЫХ пунктов ещё не сделано.
 * Именно закреплённых — иначе бейдж горел бы всегда и перестал что-либо значить.
 */
export function selectPinnedOpenCount(state: PlansState): number {
  let count = 0;
  for (const plan of state.plans) {
    if (plan.archived) continue;
    for (const item of plan.items) {
      if (item.pinned && !item.done) count += 1;
    }
  }
  return count;
}

/** Сделано / всего по одному списку — для прогресс-полоски в заголовке. */
export function planProgress(plan: ProductionPlan): { done: number; total: number } {
  let done = 0;
  for (const item of plan.items) {
    if (item.done) done += 1;
  }
  return { done, total: plan.items.length };
}
