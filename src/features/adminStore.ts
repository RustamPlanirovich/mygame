/**
 * Состояние админ-панели.
 *
 * Разделы (обзор / игроки / карточка игрока / журнал / объявления / обслуживание)
 * держат собственные { loading, error, loadedAt }, поэтому вкладка грузится лениво —
 * при первом открытии — и не перезагружается лишний раз.
 *
 * Каждая мутация освежает РОВНО то, что испортила: заново читает затронутые списки
 * и помечает устаревшими те разделы, которые пользователь сейчас не смотрит
 * (loadedAt = null → следующий вход на вкладку перечитает данные).
 *
 * ВАЖНО для компонентов: подписывайтесь узкими селекторами —
 *   const players = useAdminStore((s) => s.players);
 *   const actions = useAdminActions();
 * Деструктуризация всего стора (`const { a, b } = useAdminStore()`) перерисовывает
 * компонент на любое изменение любого поля.
 */

import { create } from 'zustand';
import * as adminApi from '../utils/adminApi';
import {
  AdminApiError,
  type AdminAnnouncement,
  type AdminOverview,
  type AuditEntry,
  type CreateAnnouncementRequest,
  type GrantRequest,
  type PlayerDetailResponse,
  type PlayerListItem,
  type PlayerPatch,
  type PlayerSortField,
  type PlayerStatusFilter,
  type SortOrder,
} from '../utils/adminApi';

// ============================================================================
// Типы состояния
// ============================================================================

export interface SectionState {
  loading: boolean;
  error: string | null;
  /** Метка успешной загрузки. null — данных нет или они устарели. */
  loadedAt: number | null;
}

export interface PlayersQueryState {
  search: string;
  status: PlayerStatusFilter;
  sort: PlayerSortField;
  order: SortOrder;
  limit: number;
  offset: number;
}

export interface AuditFiltersState {
  action: string;
  /** Пустая строка — фильтр не задан. Хранится строкой, потому что это поле ввода. */
  adminId: string;
  targetUserId: string;
  limit: number;
  offset: number;
}

/** Состояние последней мутации: одна за раз, поэтому одного слота достаточно. */
export interface ActionState {
  /** Имя выполняемого действия либо null. */
  pending: string | null;
  error: string | null;
  /** Код ошибки сервера — по нему UI предлагает, например, force для выдачи. */
  code: string | null;
  /** Человеческий результат успешного действия. */
  result: string | null;
}

export type MaintenanceKind = 'expire-orders' | 'cleanup-sessions' | 'oracle-refresh';

interface AdminActions {
  // --- обзор ---
  loadOverview: (force?: boolean) => Promise<void>;

  // --- список игроков ---
  loadPlayers: (force?: boolean) => Promise<void>;
  setPlayersQuery: (patch: Partial<PlayersQueryState>) => void;
  setPlayersPage: (offset: number) => void;
  toggleSort: (field: PlayerSortField) => void;

  // --- карточка игрока ---
  selectPlayer: (id: number | null) => void;
  loadDetail: (force?: boolean) => Promise<void>;
  clearActionState: () => void;

  // --- мутации над игроком ---
  banPlayer: (reason: string, days: number | null) => Promise<boolean>;
  unbanPlayer: () => Promise<boolean>;
  /**
   * isSelf — карточка принадлежит самому оператору. Сервер это разрешает и гасит
   * в том числе текущий токен, поэтому обновлять списки после успеха бессмысленно:
   * вместо этого сессия помечается мёртвой (см. noteAdminAuthLost).
   */
  logoutAll: (isSelf?: boolean) => Promise<boolean>;
  resetPassword: (newPassword: string, isSelf?: boolean) => Promise<boolean>;
  grant: (payload: GrantRequest) => Promise<boolean>;
  cancelOrders: () => Promise<boolean>;
  patchPlayer: (patch: PlayerPatch) => Promise<boolean>;
  deletePlayer: (confirmEmail: string) => Promise<boolean>;

  // --- журнал ---
  loadAudit: (force?: boolean) => Promise<void>;
  setAuditFilters: (patch: Partial<AuditFiltersState>) => void;
  setAuditPage: (offset: number) => void;

  // --- объявления ---
  loadAnnouncements: (force?: boolean) => Promise<void>;
  createAnnouncement: (payload: CreateAnnouncementRequest) => Promise<boolean>;
  removeAnnouncement: (id: number) => Promise<boolean>;

  // --- обслуживание ---
  runMaintenance: (kind: MaintenanceKind) => Promise<boolean>;

  /** Полный сброс — вызывается при закрытии панели, чтобы не показывать старые данные. */
  reset: () => void;
}

export interface AdminStoreState {
  overview: AdminOverview | null;
  overviewMeta: SectionState;

  players: PlayerListItem[];
  playersTotal: number;
  playersQuery: PlayersQueryState;
  playersMeta: SectionState;

  selectedPlayerId: number | null;
  detail: PlayerDetailResponse | null;
  detailMeta: SectionState;
  action: ActionState;

  audit: AuditEntry[];
  auditTotal: number;
  auditFilters: AuditFiltersState;
  auditMeta: SectionState;

  announcements: AdminAnnouncement[];
  announcementsMeta: SectionState;

  maintenanceMeta: SectionState;
  maintenanceResults: Record<MaintenanceKind, string | null>;

  /** Действия. Объект стабилен: подписка на него не вызывает перерисовок. */
  actions: AdminActions;
}

// ============================================================================
// Вспомогательное
// ============================================================================

const idleSection = (): SectionState => ({ loading: false, error: null, loadedAt: null });
const busySection = (prev: SectionState): SectionState => ({ ...prev, loading: true, error: null });
const doneSection = (): SectionState => ({ loading: false, error: null, loadedAt: Date.now() });
const failedSection = (message: string): SectionState => ({
  loading: false,
  error: message,
  loadedAt: null,
});

const idleAction = (): ActionState => ({ pending: null, error: null, code: null, result: null });

function errText(error: unknown): string {
  if (error instanceof AdminApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Неизвестная ошибка.';
}

function errCode(error: unknown): string | null {
  return error instanceof AdminApiError ? error.code : null;
}

/**
 * Счётчики запросов на раздел: ответ, пришедший после более нового запроса,
 * отбрасывается. Без этого «дребезг» поиска мог показать результат старой строки.
 */
let playersSeq = 0;
let detailSeq = 0;
let auditSeq = 0;

const DEFAULT_PLAYERS_QUERY: PlayersQueryState = {
  search: '',
  status: 'all',
  sort: 'created_at',
  order: 'desc',
  limit: 25,
  offset: 0,
};

const DEFAULT_AUDIT_FILTERS: AuditFiltersState = {
  action: '',
  adminId: '',
  targetUserId: '',
  limit: 25,
  offset: 0,
};

/** Разбор поля-идентификатора из фильтра журнала. */
function parseFilterId(raw: string): { ok: true; value: number | undefined } | { ok: false } {
  const trimmed = raw.trim();
  if (trimmed === '') return { ok: true, value: undefined };
  const num = Number(trimmed);
  if (!Number.isInteger(num) || num <= 0) return { ok: false };
  return { ok: true, value: num };
}

const initialState = () => ({
  overview: null,
  overviewMeta: idleSection(),

  players: [] as PlayerListItem[],
  playersTotal: 0,
  playersQuery: { ...DEFAULT_PLAYERS_QUERY },
  playersMeta: idleSection(),

  selectedPlayerId: null,
  detail: null,
  detailMeta: idleSection(),
  action: idleAction(),

  audit: [] as AuditEntry[],
  auditTotal: 0,
  auditFilters: { ...DEFAULT_AUDIT_FILTERS },
  auditMeta: idleSection(),

  announcements: [] as AdminAnnouncement[],
  announcementsMeta: idleSection(),

  maintenanceMeta: idleSection(),
  maintenanceResults: {
    'expire-orders': null,
    'cleanup-sessions': null,
    'oracle-refresh': null,
  } as Record<MaintenanceKind, string | null>,
});

// ============================================================================
// Стор
// ============================================================================

export const useAdminStore = create<AdminStoreState>((set, get) => {
  /** Помечает раздел устаревшим — вкладка перечитает его при следующем открытии. */
  const invalidate = (...sections: Array<'overview' | 'audit' | 'announcements'>) => {
    set((state) => {
      const patch: Partial<AdminStoreState> = {};
      if (sections.includes('overview')) {
        patch.overviewMeta = { ...state.overviewMeta, loadedAt: null };
      }
      if (sections.includes('audit')) {
        patch.auditMeta = { ...state.auditMeta, loadedAt: null };
      }
      if (sections.includes('announcements')) {
        patch.announcementsMeta = { ...state.announcementsMeta, loadedAt: null };
      }
      return patch;
    });
  };

  /**
   * Обвязка мутации: занятость, нормализация ошибки, текст результата.
   * Само обновление данных делает каждый вызов сам — ровно то, что испортил.
   */
  async function runAction<T>(
    name: string,
    call: () => Promise<T>,
    describe: (result: T) => string,
    afterSuccess?: (result: T) => Promise<void> | void,
  ): Promise<boolean> {
    set({ action: { pending: name, error: null, code: null, result: null } });
    try {
      const result = await call();
      set({ action: { pending: null, error: null, code: null, result: describe(result) } });
      await afterSuccess?.(result);
      return true;
    } catch (error) {
      set({
        action: { pending: null, error: errText(error), code: errCode(error), result: null },
      });
      return false;
    }
  }

  const actions: AdminActions = {
    // ------------------------------------------------------------------ обзор
    async loadOverview(force = false) {
      const meta = get().overviewMeta;
      if (meta.loading) return;
      if (!force && meta.loadedAt !== null) return;
      set({ overviewMeta: busySection(meta) });
      try {
        const overview = await adminApi.getOverview();
        set({ overview, overviewMeta: doneSection() });
      } catch (error) {
        set({ overviewMeta: failedSection(errText(error)) });
      }
    },

    // --------------------------------------------------------------- игроки
    async loadPlayers(force = false) {
      const state = get();
      if (state.playersMeta.loading && !force) return;
      if (!force && state.playersMeta.loadedAt !== null) return;

      const seq = ++playersSeq;
      set({ playersMeta: busySection(state.playersMeta) });
      const { search, status, sort, order, limit, offset } = state.playersQuery;
      try {
        const response = await adminApi.getPlayers({
          search: search.trim() === '' ? undefined : search.trim(),
          status,
          sort,
          order,
          limit,
          offset,
        });
        if (seq !== playersSeq) return; // пришёл ответ на устаревший запрос
        set({
          players: response.players,
          playersTotal: response.total,
          playersMeta: doneSection(),
        });
      } catch (error) {
        if (seq !== playersSeq) return;
        set({ players: [], playersTotal: 0, playersMeta: failedSection(errText(error)) });
      }
    },

    setPlayersQuery(patch) {
      // Смена фильтра/сортировки делает текущую страницу бессмысленной.
      const resetsPage =
        patch.search !== undefined ||
        patch.status !== undefined ||
        patch.sort !== undefined ||
        patch.order !== undefined ||
        patch.limit !== undefined;
      set((state) => ({
        playersQuery: {
          ...state.playersQuery,
          ...patch,
          offset: patch.offset ?? (resetsPage ? 0 : state.playersQuery.offset),
        },
        playersMeta: { ...state.playersMeta, loadedAt: null },
      }));
      void get().actions.loadPlayers(true);
    },

    setPlayersPage(offset) {
      get().actions.setPlayersQuery({ offset: Math.max(0, offset) });
    },

    toggleSort(field) {
      const { sort, order } = get().playersQuery;
      const nextOrder: SortOrder = sort === field ? (order === 'asc' ? 'desc' : 'asc') : 'desc';
      get().actions.setPlayersQuery({ sort: field, order: nextOrder });
    },

    // ------------------------------------------------------- карточка игрока
    selectPlayer(id) {
      if (id === null) {
        detailSeq += 1; // отменяем ответ на запрос закрытой карточки
        set({ selectedPlayerId: null, detail: null, detailMeta: idleSection(), action: idleAction() });
        return;
      }
      set({
        selectedPlayerId: id,
        detail: null,
        detailMeta: idleSection(),
        action: idleAction(),
      });
      void get().actions.loadDetail(true);
    },

    async loadDetail(force = false) {
      const state = get();
      const id = state.selectedPlayerId;
      if (id === null) return;
      if (state.detailMeta.loading && !force) return;
      if (!force && state.detailMeta.loadedAt !== null) return;

      const seq = ++detailSeq;
      set({ detailMeta: busySection(state.detailMeta) });
      try {
        const detail = await adminApi.getPlayer(id);
        if (seq !== detailSeq || get().selectedPlayerId !== id) return;
        set({ detail, detailMeta: doneSection() });
      } catch (error) {
        if (seq !== detailSeq || get().selectedPlayerId !== id) return;
        set({ detailMeta: failedSection(errText(error)) });
      }
    },

    clearActionState() {
      set({ action: idleAction() });
    },

    // --------------------------------------------------------------- мутации
    async banPlayer(reason, days) {
      const id = get().selectedPlayerId;
      if (id === null) return false;
      return runAction(
        'ban',
        () => adminApi.banPlayer(id, reason, days),
        (r) =>
          `Блокировка применена (${r.permanent ? 'бессрочно' : 'на срок'}), погашено сессий: ${
            r.sessionsRevoked
          }`,
        async () => {
          // Изменились: карточка, строка в списке (бан + сессии), сводка по банам.
          await Promise.all([get().actions.loadDetail(true), get().actions.loadPlayers(true)]);
          invalidate('overview', 'audit');
        },
      );
    },

    async unbanPlayer() {
      const id = get().selectedPlayerId;
      if (id === null) return false;
      return runAction(
        'unban',
        () => adminApi.unbanPlayer(id),
        (r) => `Блокировка снята, удалено сессий: ${r.sessionsPurged}`,
        async () => {
          await Promise.all([get().actions.loadDetail(true), get().actions.loadPlayers(true)]);
          invalidate('overview', 'audit');
        },
      );
    },

    async logoutAll(isSelf = false) {
      const id = get().selectedPlayerId;
      if (id === null) return false;
      return runAction(
        'logout-all',
        () => adminApi.logoutAllSessions(id),
        (r) =>
          isSelf
            ? `Сессий завершено: ${r.sessionsRevoked}. Ваш вход больше не действует — войдите заново.`
            : `Сессий завершено: ${r.sessionsRevoked}`,
        async () => {
          // Своя сессия убита вместе с остальными: перечитывать нечем, любой
          // запрос вернёт 401. Сообщаем о мёртвом токене и на этом всё.
          if (isSelf) {
            adminApi.noteAdminAuthLost('SELF_SESSION_ENDED');
            return;
          }
          // Сессии видны и в карточке, и в списке (онлайн / число сессий).
          await Promise.all([get().actions.loadDetail(true), get().actions.loadPlayers(true)]);
          invalidate('overview', 'audit');
        },
      );
    },

    async resetPassword(newPassword, isSelf = false) {
      const id = get().selectedPlayerId;
      if (id === null) return false;
      return runAction(
        'password',
        () => adminApi.setPlayerPassword(id, newPassword),
        (r) =>
          isSelf
            ? `Пароль изменён, погашено сессий: ${r.sessionsRevoked}. Войдите заново с новым паролем.`
            : `Пароль изменён, погашено сессий: ${r.sessionsRevoked}`,
        async () => {
          // Смена своего пароля тоже гасит текущий токен — см. logoutAll.
          if (isSelf) {
            adminApi.noteAdminAuthLost('SELF_SESSION_ENDED');
            return;
          }
          await Promise.all([get().actions.loadDetail(true), get().actions.loadPlayers(true)]);
          invalidate('overview', 'audit');
        },
      );
    },

    async grant(payload) {
      const id = get().selectedPlayerId;
      if (id === null) return false;
      return runAction(
        'grant',
        () => adminApi.grantToPlayer(id, payload),
        (r) => {
          const applied = Object.keys(r.applied).length;
          const parts = [`изменено полей: ${applied}`];
          if (r.skipped.length > 0) parts.push(`пропущено: ${r.skipped.length}`);
          if (r.clamped.length > 0) parts.push(`обрезано складом: ${r.clamped.join(', ')}`);
          if (r.warning) parts.push(r.warning);
          return `Выдача применена к сохранению #${r.saveId} — ${parts.join('; ')}`;
        },
        // Меняется только сохранение — список игроков и сводка не затронуты.
        async () => {
          await get().actions.loadDetail(true);
          invalidate('audit');
        },
      );
    },

    async cancelOrders() {
      const id = get().selectedPlayerId;
      if (id === null) return false;
      return runAction(
        'cancel-orders',
        () => adminApi.cancelAllOrders(id),
        (r) => `Отменено ордеров: ${r.cancelled}`,
        async () => {
          // Открытые ордера показаны и в карточке, и в списке.
          await Promise.all([get().actions.loadDetail(true), get().actions.loadPlayers(true)]);
          invalidate('overview', 'audit');
        },
      );
    },

    async patchPlayer(patch) {
      const id = get().selectedPlayerId;
      if (id === null) return false;
      return runAction(
        'patch',
        () => adminApi.updatePlayer(id, patch),
        (r) => `Сохранено: ${Object.keys(r.changes).join(', ') || 'без изменений'}`,
        async () => {
          await Promise.all([get().actions.loadDetail(true), get().actions.loadPlayers(true)]);
          // Роли попадают в сводку (админы/модераторы), e-mail и заметки — нет.
          if (patch.role !== undefined) invalidate('overview');
          invalidate('audit');
        },
      );
    },

    async deletePlayer(confirmEmail) {
      const id = get().selectedPlayerId;
      if (id === null) return false;
      return runAction(
        'delete',
        () => adminApi.deletePlayer(id, confirmEmail),
        (r) => `Игрок ${r.deleted.email} удалён`,
        async () => {
          // Карточки больше нет — закрываем её и перечитываем список.
          detailSeq += 1;
          set({ selectedPlayerId: null, detail: null, detailMeta: idleSection() });
          await get().actions.loadPlayers(true);
          invalidate('overview', 'audit');
        },
      );
    },

    // ---------------------------------------------------------------- журнал
    async loadAudit(force = false) {
      const state = get();
      if (state.auditMeta.loading && !force) return;
      if (!force && state.auditMeta.loadedAt !== null) return;

      const adminId = parseFilterId(state.auditFilters.adminId);
      const targetUserId = parseFilterId(state.auditFilters.targetUserId);
      if (!adminId.ok || !targetUserId.ok) {
        set({
          auditMeta: failedSection('ID администратора и игрока должны быть целыми числами больше нуля.'),
        });
        return;
      }

      const seq = ++auditSeq;
      set({ auditMeta: busySection(state.auditMeta) });
      try {
        const response = await adminApi.getAudit({
          action: state.auditFilters.action || undefined,
          adminId: adminId.value,
          targetUserId: targetUserId.value,
          limit: state.auditFilters.limit,
          offset: state.auditFilters.offset,
        });
        if (seq !== auditSeq) return;
        set({ audit: response.entries, auditTotal: response.total, auditMeta: doneSection() });
      } catch (error) {
        if (seq !== auditSeq) return;
        set({ audit: [], auditTotal: 0, auditMeta: failedSection(errText(error)) });
      }
    },

    setAuditFilters(patch) {
      const resetsPage = patch.offset === undefined;
      set((state) => ({
        auditFilters: {
          ...state.auditFilters,
          ...patch,
          offset: patch.offset ?? (resetsPage ? 0 : state.auditFilters.offset),
        },
        auditMeta: { ...state.auditMeta, loadedAt: null },
      }));
      void get().actions.loadAudit(true);
    },

    setAuditPage(offset) {
      get().actions.setAuditFilters({ offset: Math.max(0, offset) });
    },

    // ------------------------------------------------------------ объявления
    async loadAnnouncements(force = false) {
      const meta = get().announcementsMeta;
      if (meta.loading) return;
      if (!force && meta.loadedAt !== null) return;
      set({ announcementsMeta: busySection(meta) });
      try {
        const response = await adminApi.getAdminAnnouncements();
        set({ announcements: response.announcements, announcementsMeta: doneSection() });
      } catch (error) {
        set({ announcementsMeta: failedSection(errText(error)) });
      }
    },

    async createAnnouncement(payload) {
      return runAction(
        'announcement-create',
        () => adminApi.createAnnouncement(payload),
        (r) => `Объявление «${r.announcement.title}» опубликовано`,
        async () => {
          await get().actions.loadAnnouncements(true);
          invalidate('overview', 'audit');
        },
      );
    },

    async removeAnnouncement(id) {
      return runAction(
        `announcement-delete-${id}`,
        () => adminApi.deleteAnnouncement(id),
        (r) => `Объявление «${r.deleted.title}» удалено`,
        async () => {
          await get().actions.loadAnnouncements(true);
          invalidate('overview', 'audit');
        },
      );
    },

    // ----------------------------------------------------------- обслуживание
    async runMaintenance(kind) {
      const state = get();
      if (state.maintenanceMeta.loading) return false;
      set({ maintenanceMeta: busySection(state.maintenanceMeta) });
      try {
        let text: string;
        if (kind === 'expire-orders') {
          const r = await adminApi.maintenanceExpireOrders();
          text = `истекло ордеров: ${r.expiredCount}`;
        } else if (kind === 'cleanup-sessions') {
          const r = await adminApi.maintenanceCleanupSessions();
          text = `удалено сессий: ${r.removedCount}`;
        } else {
          const r = await adminApi.maintenanceOracleRefresh();
          text = `оракул обновлён за ${r.durationMs} мс, наборов: ${r.oracle.length}`;
        }
        set((s) => ({
          maintenanceMeta: doneSection(),
          maintenanceResults: { ...s.maintenanceResults, [kind]: text },
        }));
        // Обслуживание меняет ордера, сессии и оракул — всё это в сводке.
        invalidate('overview', 'audit');
        return true;
      } catch (error) {
        set({ maintenanceMeta: failedSection(errText(error)) });
        return false;
      }
    },

    reset() {
      playersSeq += 1;
      detailSeq += 1;
      auditSeq += 1;
      set(initialState());
    },
  };

  return { ...initialState(), actions };
});

/** Действия стора. Объект стабилен, поэтому эта подписка не вызывает перерисовок. */
export const useAdminActions = (): AdminActions => useAdminStore((state) => state.actions);
