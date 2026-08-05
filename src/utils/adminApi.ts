/**
 * Клиент админ-панели: типизированные обёртки над /api/admin/* и /api/announcements.
 *
 * Формы ответов сверены с server/admin.js (единственный источник истины) и с живым
 * сервером. Всё, что БД отдаёт как numeric/bigint, приходит строкой — такие поля
 * типизированы как string, чтобы точность не терялась на клиенте.
 *
 * Ошибки нормализуются в AdminApiError: сервер всегда отвечает
 * { ok: false, error, message, ...extra }, поэтому код ошибки и человеческий текст
 * доступны единообразно, а вызывающая сторона пишется в три строки.
 *
 * Отдельно обрабатывается мёртвый токен (401 / INVALID_TOKEN): токен стирается из
 * localStorage, а подписчики subscribeAdminAuthLost узнают об этом и могут закрыть
 * панель и предложить вход заново — см. блок «Мёртвый токен».
 */

import { getAuthHeaders, isAuthenticated, removeAuthToken } from './settingsApi';

const API_URL = import.meta.env.VITE_API_URL || '';

// ============================================================================
// Общие типы
// ============================================================================

export type AdminRole = 'player' | 'moderator' | 'admin';
export type PlayerStatusFilter = 'all' | 'online' | 'banned' | 'staff';
export type PlayerSortField = 'created_at' | 'last_seen_at' | 'email' | 'play_time' | 'total_volume';
export type SortOrder = 'asc' | 'desc';
export type AnnouncementSeverity = 'info' | 'warning' | 'critical';

/** ISO-8601 строка либо null. */
export type IsoDate = string;

export interface OkResponse {
  ok: true;
}

// ============================================================================
// Обзор
// ============================================================================

export interface OverviewPlayers {
  total: number;
  onlineNow: number;
  registeredToday: number;
  registered7d: number;
  banned: number;
  admins: number;
  moderators: number;
  activeSessions: number;
  totalPlayTimeSeconds: number;
}

export interface OverviewContent {
  slots: number;
  saves: number;
  guilds: number;
  guildMembers: number;
  activeAnnouncements: number;
  auditEntries24h: number;
}

export interface TopTrader {
  playerId: number;
  playerName: string | null;
  email: string | null;
  totalVolume: string;
  totalTrades: number;
  successfulTrades: number;
  rating: string | null;
}

export interface OverviewMarket {
  openOrders: number;
  totalOrders: number;
  trades24h: number;
  volume24h: string;
  fees24h: string;
  distinctTraders24h: number;
  registeredTraders: number;
  topTraders: TopTrader[];
}

export interface OverviewP2P {
  activeLoans: number;
  outstandingPrincipal: string;
  overdueLoans: number;
  defaultedLoans: number;
  totalLoans: number;
  openOffers: number;
}

export interface OracleEntry {
  dataType: string;
  generatedAt: IsoDate | null;
  expiresAt: IsoDate | null;
  requestCount: number;
  fresh: boolean;
  ageSeconds: number;
}

export interface DatabaseTable {
  table: string;
  totalBytes: number;
  totalPretty: string;
  approxRows: number;
}

export interface OverviewDatabase {
  sizeBytes: number;
  sizePretty: string;
  largestTables: DatabaseTable[];
}

export interface AdminOverview extends OkResponse {
  generatedAt: IsoDate;
  players: OverviewPlayers;
  content: OverviewContent;
  market: OverviewMarket;
  p2p: OverviewP2P;
  aiOracle: OracleEntry[];
  database: OverviewDatabase;
}

// ============================================================================
// Игроки
// ============================================================================

export interface PlayerGuild {
  /** guilds.id — uuid. */
  id: string;
  name: string | null;
  tag: string | null;
  role: string | null;
  contribution: string | null;
}

export interface PlayerListItem {
  id: number;
  email: string;
  role: AdminRole;
  createdAt: IsoDate;
  lastSeenAt: IsoDate | null;
  notes: string | null;
  /** null при постоянном бане — смотрите banPermanent. */
  bannedUntil: IsoDate | null;
  banPermanent: boolean;
  isBanned: boolean;
  banReason: string | null;
  online: boolean;
  lastActivityAt: IsoDate | null;
  sessionCount: number;
  slotCount: number;
  saveCount: number;
  playTimeSeconds: number;
  totalVolume: string;
  totalTrades: number;
  successfulTrades: number;
  traderRating: string | null;
  guild: PlayerGuild | null;
  openOrderCount: number;
}

export interface PlayersResponse extends OkResponse {
  total: number;
  limit: number;
  offset: number;
  sort: PlayerSortField;
  order: SortOrder;
  status: PlayerStatusFilter;
  search: string | null;
  players: PlayerListItem[];
}

export interface PlayersQuery {
  search?: string;
  status?: PlayerStatusFilter;
  sort?: PlayerSortField;
  order?: SortOrder;
  limit?: number;
  offset?: number;
}

export interface PlayerFull extends PlayerListItem {
  currentSlotId: number | null;
  currentSaveId: number | null;
  settings: Record<string, unknown>;
  pinnedResources: string[] | null;
}

export interface SlotRow {
  id: number;
  name: string;
  description: string | null;
  created_at: IsoDate;
  updated_at: IsoDate;
  last_played_at: IsoDate | null;
  play_time_seconds: number;
}

export interface SaveMetaRow {
  id: number;
  slot_id: number | null;
  name: string;
  save_type: string;
  created_at: IsoDate;
  updated_at: IsoDate;
  size_bytes: number;
}

export interface SessionRow {
  id: number;
  created_at: IsoDate;
  last_activity_at: IsoDate | null;
  expires_at: IsoDate;
  user_agent: string | null;
  ip_address: string | null;
}

export interface MarketOrderRow {
  /** market_orders.id — uuid. */
  id: string;
  order_type: string;
  resource: string;
  quantity: string;
  quantity_filled: string | null;
  price_per_unit: string;
  status: string;
  created_at: IsoDate;
  expires_at: IsoDate | null;
  guild_id: string | null;
}

export interface MarketTradeRow {
  id: string;
  resource: string;
  quantity: string;
  price_per_unit: string;
  total_amount: string;
  fee: string;
  executed_at: IsoDate;
  side: 'buy' | 'sell';
  buyer_id: number;
  seller_id: number;
  counterparty_email: string | null;
}

/** Одна строка p2p_loans. borrower_* заполнено, когда игрок — кредитор, и наоборот. */
export interface P2PLoanRow {
  id: string;
  principal: string;
  interest_rate: string;
  term_days: number;
  remaining_balance: string;
  status: string;
  start_date: IsoDate;
  due_date: IsoDate;
  interest_paid: string | null;
  days_overdue: number | null;
  borrower_id?: number;
  borrower_email?: string | null;
  lender_id?: number;
  lender_email?: string | null;
}

export interface OfflineTradingRow {
  id: number;
  slot_id: number | null;
  autotrader_enabled: boolean;
  risk_tolerance: string | null;
  max_investment_percent: string | null;
  take_profit_percent: string | null;
  stop_loss_percent: string | null;
  portfolio_snapshot: unknown;
  balance_snapshot: string | null;
  last_activity_at: IsoDate | null;
  last_offline_calc_at: IsoDate | null;
  total_offline_profit: string | null;
  total_offline_trades: number | null;
  updated_at: IsoDate;
}

/*
 * DeviceRow убран вместе с секцией «Устройства»: он описывал таблицу user_devices,
 * которой в проекте не существует. Устройство и адрес входа отдаёт SessionRow.
 */

export interface AuditEntry {
  /** admin_audit_log.id — bigint, приходит строкой. */
  id: string;
  admin_id: number | null;
  admin_email: string | null;
  action: string;
  target_user_id: number | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: IsoDate;
  /** Есть только в /api/admin/audit, в карточке игрока отсутствует. */
  target_email?: string | null;
}

export interface PlayerDetailResponse extends OkResponse {
  player: PlayerFull;
  slots: SlotRow[];
  saves: SaveMetaRow[];
  sessions: SessionRow[];
  marketOrders: MarketOrderRow[];
  marketTrades: MarketTradeRow[];
  p2pLoansAsLender: P2PLoanRow[];
  p2pLoansAsBorrower: P2PLoanRow[];
  offlineTradingState: OfflineTradingRow[];
  auditLog: AuditEntry[];
}

export interface SaveDataResponse extends OkResponse {
  save: {
    id: number;
    user_id: number;
    slot_id: number | null;
    name: string;
    save_type: string;
    created_at: IsoDate;
    updated_at: IsoDate;
    size_bytes: number;
    /** Произвольный JSON сохранения. */
    data: unknown;
  };
}

// ---- мутации над игроком ---------------------------------------------------

export interface PlayerPatch {
  email?: string;
  role?: AdminRole;
  notes?: string | null;
}

export interface UpdatePlayerResponse extends OkResponse {
  player: { id: number; email: string; role: AdminRole; notes: string | null };
  changes: Partial<Record<'email' | 'role' | 'notes', { from: string | null; to: string | null }>>;
}

export interface BanResponse extends OkResponse {
  player: {
    id: number;
    email: string;
    role: AdminRole;
    banned_until: IsoDate | null;
    ban_reason: string | null;
    ban_permanent: boolean;
    is_banned: boolean;
  };
  permanent: boolean;
  sessionsRevoked: number;
}

export interface UnbanResponse extends OkResponse {
  player: {
    id: number;
    email: string;
    role: AdminRole;
    banned_until: IsoDate | null;
    ban_reason: string | null;
  };
  sessionsPurged: number;
}

export interface LogoutAllResponse extends OkResponse {
  sessionsRevoked: number;
}

export interface PasswordResponse extends OkResponse {
  sessionsRevoked: number;
  hashed: boolean;
}

export interface GrantRequest {
  slotId?: number | null;
  credits?: string;
  researchPoints?: string;
  influence?: string;
  resources?: Record<string, string>;
  /** Выдать, даже если у игрока есть активная сессия (иначе сервер вернёт 409). */
  force?: boolean;
}

export interface GrantAppliedEntry {
  before: string;
  after: string;
  delta: string;
  cappedAt?: string | null;
}

export interface GrantResponse extends OkResponse {
  saveId: number;
  slotId: number | null;
  applied: Record<string, GrantAppliedEntry>;
  skipped: Array<{ field: string; reason: string }>;
  clamped: string[];
  /**
   * Дослана ли выдача подключённому игроку по realtime-каналу (bigplan.md, пункт 9).
   * false означает, что она лежит только в БД и применится при следующей загрузке.
   */
  pushedToClient?: boolean;
  warning: string | null;
}

export interface CancelOrdersResponse extends OkResponse {
  cancelled: number;
  orders: Array<{
    id: string;
    order_type: string;
    resource: string;
    quantity: string;
    price_per_unit: string;
  }>;
}

export interface DeletePlayerResponse extends OkResponse {
  deleted: { id: number; email: string };
  cascade: {
    guilds?: Array<{ guildId: string; name: string; action: string; to?: number }>;
    p2pPayments?: number;
    p2pLoans?: number;
    marketTrades?: number;
    marketOrders?: number;
  };
}

// ============================================================================
// Журнал, объявления, обслуживание
// ============================================================================

export interface AuditQuery {
  limit?: number;
  offset?: number;
  adminId?: number | null;
  action?: string;
  targetUserId?: number | null;
}

export interface AuditResponse extends OkResponse {
  total: number;
  limit: number;
  offset: number;
  entries: AuditEntry[];
}

export interface AdminAnnouncement {
  id: number;
  title: string;
  body: string;
  severity: AnnouncementSeverity;
  active: boolean;
  created_by: number | null;
  created_by_email: string | null;
  created_at: IsoDate;
  expires_at: IsoDate | null;
  visible: boolean;
}

export interface AnnouncementsResponse extends OkResponse {
  announcements: AdminAnnouncement[];
}

export interface CreateAnnouncementRequest {
  title: string;
  body: string;
  severity?: AnnouncementSeverity;
  expiresAt?: string | null;
  active?: boolean;
}

export interface CreateAnnouncementResponse extends OkResponse {
  announcement: Omit<AdminAnnouncement, 'created_by_email' | 'visible'>;
}

export interface DeleteAnnouncementResponse extends OkResponse {
  deleted: { id: number; title: string; severity: AnnouncementSeverity };
}

/** Публичное объявление: то, что видит любой авторизованный игрок. */
export interface PublicAnnouncement {
  id: number;
  title: string;
  body: string;
  severity: AnnouncementSeverity;
  created_at: IsoDate;
  expires_at: IsoDate | null;
}

export interface PublicAnnouncementsResponse extends OkResponse {
  announcements: PublicAnnouncement[];
}

export interface ExpireOrdersResponse extends OkResponse {
  expiredCount: number;
}

export interface CleanupSessionsResponse extends OkResponse {
  removedCount: number;
}

export interface OracleRefreshResponse extends OkResponse {
  durationMs: number;
  oracle: Array<{
    data_type: string;
    generated_at: IsoDate;
    expires_at: IsoDate;
    request_count: number;
  }>;
}

// ============================================================================
// Транспорт
// ============================================================================

/** Ошибка запроса к админ-API: код сервера, HTTP-статус и человеческий текст. */
export class AdminApiError extends Error {
  readonly code: string;
  readonly status: number;
  /** Тело ответа целиком: у части ошибок есть полезные поля (activeSessions, retryAfter…). */
  readonly details: Record<string, unknown>;

  constructor(code: string, status: number, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'AdminApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

/** Тексты для ошибок, у которых сервер не присылает message. */
const FALLBACK_MESSAGES: Record<string, string> = {
  NOT_AUTHENTICATED: 'Вы не авторизованы — войдите заново.',
  INVALID_TOKEN: 'Сессия недействительна — войдите заново.',
  SESSION_NOT_FOUND: 'Сессия не найдена.',
  ACCOUNT_BANNED: 'Аккаунт заблокирован.',
  ADMIN_REQUIRED: 'Требуются права администратора.',
  MODERATOR_REQUIRED: 'Требуются права модератора.',
  NETWORK_ERROR: 'Не удалось связаться с сервером.',
  BAD_RESPONSE: 'Сервер вернул неожидаемый ответ.',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// ============================================================================
// Мёртвый токен
// ============================================================================

/**
 * Почему сессия перестала действовать. SELF_SESSION_ENDED — единственная
 * причина, о которой сообщает не сервер, а сам интерфейс: администратор
 * завершил свои сессии (или сменил себе пароль) и знает, что произошло.
 */
export type AdminAuthLostReason =
  | 'INVALID_TOKEN'
  | 'NOT_AUTHENTICATED'
  | 'SESSION_NOT_FOUND'
  | 'SELF_SESSION_ENDED';

/** Коды сервера, после которых токен в localStorage бесполезен. */
const AUTH_LOST_CODES: ReadonlySet<string> = new Set([
  'INVALID_TOKEN',
  'NOT_AUTHENTICATED',
  'SESSION_NOT_FOUND',
]);

const AUTH_LOST_TEXT: Record<AdminAuthLostReason, string> = {
  INVALID_TOKEN: 'Сессия недействительна: токен просрочен или удалён.',
  NOT_AUTHENTICATED: 'Запрос ушёл без токена — вы больше не авторизованы.',
  SESSION_NOT_FOUND: 'Сессия не найдена на сервере.',
  SELF_SESSION_ENDED:
    'Вы применили к собственному аккаунту действие, которое гасит сессии (выход со всех ' +
    'устройств или смена своего пароля), поэтому текущий вход больше не действует.',
};

let authLostReason: AdminAuthLostReason | null = null;
const authLostListeners = new Set<(reason: AdminAuthLostReason) => void>();

/**
 * Текущее состояние «токен мёртв» либо null.
 *
 * Флаг самоочищается: noteAdminAuthLost стирает токен, поэтому появившийся в
 * localStorage токен означает новый вход — старый флаг больше не про него.
 */
export function getAdminAuthLost(): AdminAuthLostReason | null {
  if (authLostReason !== null && isAuthenticated()) authLostReason = null;
  return authLostReason;
}

/**
 * Помечает сессию мёртвой: убирает токен из localStorage (иначе интерфейс
 * продолжит работать с ним до перезагрузки страницы) и оповещает подписчиков.
 * Повторные вызовы для того же мёртвого токена игнорируются.
 */
export function noteAdminAuthLost(reason: AdminAuthLostReason): void {
  if (getAdminAuthLost() !== null) return;
  authLostReason = reason;
  removeAuthToken();
  for (const listener of [...authLostListeners]) {
    try {
      listener(reason);
    } catch (error) {
      console.error('[adminApi] обработчик потери сессии упал:', error);
    }
  }
}

/** Подписка на потерю сессии. Возвращает функцию отписки. */
export function subscribeAdminAuthLost(
  listener: (reason: AdminAuthLostReason) => void,
): () => void {
  authLostListeners.add(listener);
  return () => {
    authLostListeners.delete(listener);
  };
}

/** Человеческое объяснение причины для интерфейса. */
export function adminAuthLostText(reason: AdminAuthLostReason): string {
  return AUTH_LOST_TEXT[reason] ?? AUTH_LOST_TEXT.INVALID_TOKEN;
}

function flagAuthLost(status: number, code: string): void {
  if (AUTH_LOST_CODES.has(code)) {
    noteAdminAuthLost(code as AdminAuthLostReason);
    return;
  }
  // 401 без внятного кода (пустое тело, ответ прокси) — тот же мёртвый токен.
  if (status === 401) noteAdminAuthLost('INVALID_TOKEN');
}

function messageFor(code: string, status: number): string {
  if (FALLBACK_MESSAGES[code]) return FALLBACK_MESSAGES[code];
  if (status === 429) return 'Слишком много изменений подряд. Подождите немного.';
  if (status >= 500) return 'Ошибка на сервере. Попробуйте позже.';
  return `Запрос не выполнен (${code}).`;
}

/**
 * Единственная точка, где происходит fetch: авторизация, разбор тела и
 * нормализация ошибок. Бросает AdminApiError на любой не-ok ответ.
 */
async function request<T extends OkResponse>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { ...getAuthHeaders(), ...(init?.headers ?? {}) },
    });
  } catch {
    throw new AdminApiError('NETWORK_ERROR', 0, FALLBACK_MESSAGES.NETWORK_ERROR);
  }

  // Читаем как текст: 500 от прокси или пустое тело не должны падать на JSON.parse.
  const raw = await response.text();
  let body: unknown = null;
  if (raw) {
    try {
      body = JSON.parse(raw);
    } catch {
      body = null;
    }
  }

  if (!isRecord(body)) {
    const code = response.ok ? 'BAD_RESPONSE' : `HTTP_${response.status}`;
    flagAuthLost(response.status, code);
    throw new AdminApiError(code, response.status, messageFor(code, response.status));
  }

  if (!response.ok || body.ok !== true) {
    const code = typeof body.error === 'string' ? body.error : `HTTP_${response.status}`;
    const message =
      typeof body.message === 'string' && body.message.trim() !== ''
        ? body.message
        : messageFor(code, response.status);
    // Токен мёртв — стираем его сразу, иначе интерфейс останется живым поверх
    // нерабочей сессии до перезагрузки страницы.
    flagAuthLost(response.status, code);
    throw new AdminApiError(code, response.status, message, body);
  }

  return body as T;
}

/** Собирает query-строку, отбрасывая пустые значения. */
function query(params: Record<string, string | number | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

const jsonBody = (payload: unknown): RequestInit => ({ body: JSON.stringify(payload) });

// ============================================================================
// Обзор
// ============================================================================

export function getOverview(): Promise<AdminOverview> {
  return request<AdminOverview>('/api/admin/overview');
}

// ============================================================================
// Игроки
// ============================================================================

export function getPlayers(params: PlayersQuery = {}): Promise<PlayersResponse> {
  return request<PlayersResponse>(`/api/admin/players${query({ ...params })}`);
}

export function getPlayer(id: number): Promise<PlayerDetailResponse> {
  return request<PlayerDetailResponse>(`/api/admin/players/${id}`);
}

export function getPlayerSave(id: number, saveId: number): Promise<SaveDataResponse> {
  return request<SaveDataResponse>(`/api/admin/players/${id}/saves/${saveId}`);
}

export function updatePlayer(id: number, patch: PlayerPatch): Promise<UpdatePlayerResponse> {
  return request<UpdatePlayerResponse>(`/api/admin/players/${id}`, {
    method: 'PATCH',
    ...jsonBody(patch),
  });
}

/** days = null (или не передан) — постоянный бан. */
export function banPlayer(id: number, reason: string, days?: number | null): Promise<BanResponse> {
  return request<BanResponse>(`/api/admin/players/${id}/ban`, {
    method: 'POST',
    ...jsonBody({ reason, days: days ?? null }),
  });
}

export function unbanPlayer(id: number): Promise<UnbanResponse> {
  return request<UnbanResponse>(`/api/admin/players/${id}/unban`, { method: 'POST' });
}

export function logoutAllSessions(id: number): Promise<LogoutAllResponse> {
  return request<LogoutAllResponse>(`/api/admin/players/${id}/logout-all`, { method: 'POST' });
}

export function setPlayerPassword(id: number, newPassword: string): Promise<PasswordResponse> {
  return request<PasswordResponse>(`/api/admin/players/${id}/password`, {
    method: 'POST',
    ...jsonBody({ newPassword }),
  });
}

export function grantToPlayer(id: number, payload: GrantRequest): Promise<GrantResponse> {
  return request<GrantResponse>(`/api/admin/players/${id}/grant`, {
    method: 'POST',
    ...jsonBody(payload),
  });
}

export function cancelAllOrders(id: number): Promise<CancelOrdersResponse> {
  return request<CancelOrdersResponse>(`/api/admin/players/${id}/orders/cancel-all`, {
    method: 'POST',
  });
}

/** confirmEmail должен точно совпадать с e-mail игрока — это проверяет сервер. */
export function deletePlayer(id: number, confirmEmail: string): Promise<DeletePlayerResponse> {
  return request<DeletePlayerResponse>(`/api/admin/players/${id}`, {
    method: 'DELETE',
    ...jsonBody({ confirmEmail }),
  });
}

// ============================================================================
// Журнал действий
// ============================================================================

export function getAudit(params: AuditQuery = {}): Promise<AuditResponse> {
  return request<AuditResponse>(`/api/admin/audit${query({ ...params })}`);
}

// ============================================================================
// Объявления
// ============================================================================

export function getAdminAnnouncements(): Promise<AnnouncementsResponse> {
  return request<AnnouncementsResponse>('/api/admin/announcements');
}

export function createAnnouncement(
  payload: CreateAnnouncementRequest,
): Promise<CreateAnnouncementResponse> {
  return request<CreateAnnouncementResponse>('/api/admin/announcements', {
    method: 'POST',
    ...jsonBody(payload),
  });
}

export function deleteAnnouncement(id: number): Promise<DeleteAnnouncementResponse> {
  return request<DeleteAnnouncementResponse>(`/api/admin/announcements/${id}`, {
    method: 'DELETE',
  });
}

/** Активные объявления для любого авторизованного игрока. */
export function getPublicAnnouncements(): Promise<PublicAnnouncementsResponse> {
  return request<PublicAnnouncementsResponse>('/api/announcements');
}

// ============================================================================
// Обслуживание
// ============================================================================

export function maintenanceExpireOrders(): Promise<ExpireOrdersResponse> {
  return request<ExpireOrdersResponse>('/api/admin/maintenance/expire-orders', { method: 'POST' });
}

export function maintenanceCleanupSessions(): Promise<CleanupSessionsResponse> {
  return request<CleanupSessionsResponse>('/api/admin/maintenance/cleanup-sessions', {
    method: 'POST',
  });
}

export function maintenanceOracleRefresh(): Promise<OracleRefreshResponse> {
  return request<OracleRefreshResponse>('/api/admin/maintenance/oracle-refresh', {
    method: 'POST',
  });
}
