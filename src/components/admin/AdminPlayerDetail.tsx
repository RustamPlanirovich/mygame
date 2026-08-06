/**
 * Карточка игрока — выдвижная панель внутри модального окна админки.
 *
 * Почему панель, а не второе модальное окно: Modal слушает Escape на document,
 * и два вложенных окна закрылись бы одним нажатием. Здесь Escape перехватывается
 * на window в фазе capture и до document не доходит — сначала закрывается форма,
 * потом сама карточка.
 *
 * Права: сервер остаётся единственным авторитетом. UI лишь скрывает то, что
 * модератору всё равно запрещено (PATCH, пароль, выдача, отмена ордеров, удаление).
 *
 * Собственный аккаунт (viewerId === player.id) помечен отдельно. Бан, удаление и
 * смену своей роли сервер запрещает сам, но «выйти со всех устройств» и «сменить
 * пароль» на себе он выполняет — вместе с текущим токеном оператора. Поэтому эти
 * две формы в режиме «это вы» предупреждают об этом прямо и требуют повторного
 * подтверждения: ошибочный пароль здесь означает потерю доступа к админке.
 */

import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  Coins,
  Eye,
  Gavel,
  History,
  KeyRound,
  ListOrdered,
  LogOut,
  Radio,
  RefreshCw,
  Save,
  Shield,
  ShieldAlert,
  ShoppingCart,
  StickyNote,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { Alert, Badge, EmptyState, Field, SkeletonRows, Stat } from '../ui';
import { useAdminActions, useAdminStore } from '../../features/adminStore';
import {
  getPlayerSave,
  type AdminRole,
  type GrantRequest,
  type P2PLoanRow,
  type SaveDataResponse,
} from '../../utils/adminApi';
import {
  actionLabel,
  formatAmount,
  formatBytes,
  formatDuration,
  formatFull,
  formatInt,
  formatPercent,
  formatRate,
  roleLabel,
  shortId,
  truncate,
} from '../../utils/adminFormat';
import { BanBadge, JsonBlock, KeyValue, Num, OnlineDot, RoleBadge, Section, When } from './parts';
import { IconText } from '../ui/icons';
import { RESOURCE_LABEL } from '../../core/constants/labels';
import type { ResourceType } from '../../core/gameTypes';

type FormKind =
  | 'ban'
  | 'unban'
  | 'logout'
  | 'password'
  | 'grant'
  | 'cancel-orders'
  | 'role'
  | 'note'
  | 'delete';

const BAN_PRESETS: ReadonlyArray<{ value: string; label: string }> = [
  { value: '1', label: '1 сутки' },
  { value: '3', label: '3 суток' },
  { value: '7', label: '7 суток' },
  { value: '30', label: '30 суток' },
  { value: '365', label: '1 год' },
  { value: '', label: 'Навсегда' },
];

/**
 * Список ресурсов для выдачи.
 *
 * Раньше ключ вводили руками, и опечатка («steal» вместо «steel») уходила на сервер как
 * валидный ключ: applyGrantToSaveData клал такой ресурс в skipped, выдача считалась
 * успешной, но игроку не начислялось ничего. Выбор из списка убирает этот класс ошибок.
 *
 * Источник правды — RESOURCE_LABEL: это Record<ResourceType, string>, то есть новый ресурс
 * в игре обязан появиться и здесь, и список не разъедется с ResourceType молча.
 * Сортировка по подписи, а не по id: оператор ищет «Сталь», а не «steel».
 */
const GRANT_RESOURCE_OPTIONS: ReadonlyArray<{ id: ResourceType; label: string }> = (
  Object.keys(RESOURCE_LABEL) as ResourceType[]
)
  .map((id) => ({ id, label: RESOURCE_LABEL[id] }))
  .sort((a, b) => a.label.localeCompare(b.label, 'ru'));

/** Строка таблицы кредитов: сторона зависит от того, кредитор игрок или заёмщик. */
function LoanRows({ loans, side }: { loans: P2PLoanRow[]; side: 'lender' | 'borrower' }) {
  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">{side === 'lender' ? 'Заёмщик' : 'Кредитор'}</th>
            <th scope="col" className="text-right">
              Тело
            </th>
            <th scope="col" className="text-right">
              Остаток
            </th>
            <th scope="col" className="text-right">
              Ставка
            </th>
            <th scope="col">Статус</th>
            <th scope="col">Срок</th>
          </tr>
        </thead>
        <tbody>
          {loans.map((loan) => {
            const counterparty =
              side === 'lender'
                ? (loan.borrower_email ?? `#${loan.borrower_id ?? '—'}`)
                : (loan.lender_email ?? `#${loan.lender_id ?? '—'}`);
            const overdue = (loan.days_overdue ?? 0) > 0;
            return (
              <tr key={loan.id}>
                <td className="max-w-[12rem] truncate" title={counterparty}>
                  {counterparty}
                </td>
                <td className="text-right">
                  <Num title={loan.principal}>{formatAmount(loan.principal)}</Num>
                </td>
                <td className="text-right">
                  <Num title={loan.remaining_balance}>{formatAmount(loan.remaining_balance)}</Num>
                </td>
                <td className="text-right">
                  <Num>{formatRate(loan.interest_rate)}</Num>
                </td>
                <td>
                  <Badge
                    tone={
                      loan.status === 'defaulted'
                        ? 'danger'
                        : loan.status === 'paid'
                          ? 'accent'
                          : overdue
                            ? 'warning'
                            : 'info'
                    }
                  >
                    {loan.status}
                    {overdue ? ` · +${loan.days_overdue} дн` : ''}
                  </Badge>
                </td>
                <td>
                  <When value={loan.due_date} />
                  <span className="block text-3xs text-content-faint">
                    {formatInt(loan.term_days)} дн
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function AdminPlayerDetail({
  viewerRole,
  viewerId = null,
}: {
  viewerRole: AdminRole;
  /** id вошедшего оператора: по нему карточка узнаёт собственный аккаунт. */
  viewerId?: number | null;
}) {
  const playerId = useAdminStore((s) => s.selectedPlayerId);
  const detail = useAdminStore((s) => s.detail);
  const meta = useAdminStore((s) => s.detailMeta);
  const action = useAdminStore((s) => s.action);
  const actions = useAdminActions();

  const isAdmin = viewerRole === 'admin';

  const panelRef = useRef<HTMLElement>(null);
  const [form, setForm] = useState<FormKind | null>(null);

  // Форма бана
  const [banDays, setBanDays] = useState('7');
  const [banReason, setBanReason] = useState('');
  // Смена пароля
  const [newPassword, setNewPassword] = useState('');
  // Смена пароля себе: повтор пароля и подтверждение своего e-mail
  const [newPasswordRepeat, setNewPasswordRepeat] = useState('');
  const [selfConfirmEmail, setSelfConfirmEmail] = useState('');
  // Роль и заметка
  const [roleValue, setRoleValue] = useState<AdminRole>('player');
  const [noteValue, setNoteValue] = useState('');
  // Удаление
  const [confirmEmail, setConfirmEmail] = useState('');
  // Выдача
  const [grantSlotId, setGrantSlotId] = useState<string>('');
  const [grantCredits, setGrantCredits] = useState('');
  const [grantResearch, setGrantResearch] = useState('');
  const [grantInfluence, setGrantInfluence] = useState('');
  const [grantForce, setGrantForce] = useState(false);
  const [grantResources, setGrantResources] = useState<Array<{ key: string; value: string }>>([]);

  // Просмотр сохранения
  const [saveView, setSaveView] = useState<SaveDataResponse['save'] | null>(null);
  const [saveLoading, setSaveLoading] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const player = detail?.player ?? null;

  /** Открыта карточка самого оператора: часть действий ударит по его же сессии. */
  const isSelf = player !== null && viewerId !== null && player.id === viewerId;

  // Синхронизируем поля форм с загруженным игроком (без перетирания того, что уже набрано).
  useEffect(() => {
    if (!player) return;
    setRoleValue(player.role);
    setNoteValue(player.notes ?? '');
    setConfirmEmail('');
    setGrantSlotId(player.currentSlotId ? String(player.currentSlotId) : '');
  }, [player?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Смена игрока — закрываем форму и просмотр сохранения.
  useEffect(() => {
    setForm(null);
    setSaveView(null);
    setSaveError(null);
    setBanReason('');
    setNewPassword('');
    setNewPasswordRepeat('');
    setSelfConfirmEmail('');
    setGrantCredits('');
    setGrantResearch('');
    setGrantInfluence('');
    setGrantResources([]);
    setGrantForce(false);
  }, [playerId]);

  const close = () => actions.selectPlayer(null);

  // Escape: сначала форма, затем карточка. stopImmediatePropagation не даёт
  // обработчику Modal на document закрыть всю админку заодно.
  useEffect(() => {
    if (playerId === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopImmediatePropagation();
      event.preventDefault();
      if (form !== null) setForm(null);
      else close();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [playerId, form]); // eslint-disable-line react-hooks/exhaustive-deps

  // Открыли форму — ставим курсор в её первое поле (Modal этого уже не сделает:
  // его автофокус срабатывает один раз при открытии окна).
  useEffect(() => {
    if (form === null) return;
    panelRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
  }, [form]);

  // Закрыли форму пароля (отмена, Escape, успех) — не держим набранный пароль
  // и подтверждения в памяти и не подставляем их в следующее открытие формы.
  useEffect(() => {
    if (form === 'password') return;
    setNewPassword('');
    setNewPasswordRepeat('');
    setSelfConfirmEmail('');
  }, [form]);

  if (playerId === null) return null;

  const busy = action.pending !== null;

  const openForm = (kind: FormKind) => {
    actions.clearActionState();
    setForm((current) => (current === kind ? null : kind));
  };

  const finish = (ok: boolean) => {
    if (ok) setForm(null);
  };

  const viewSave = async (saveId: number) => {
    setSaveLoading(saveId);
    setSaveError(null);
    try {
      const response = await getPlayerSave(playerId, saveId);
      setSaveView(response.save);
    } catch (error) {
      setSaveView(null);
      setSaveError(error instanceof Error ? error.message : 'Не удалось загрузить сохранение.');
    } finally {
      setSaveLoading(null);
    }
  };

  const submitGrant = () => {
    const payload: GrantRequest = { force: grantForce };
    if (grantSlotId !== '') payload.slotId = Number(grantSlotId);
    if (grantCredits.trim() !== '') payload.credits = grantCredits.trim();
    if (grantResearch.trim() !== '') payload.researchPoints = grantResearch.trim();
    if (grantInfluence.trim() !== '') payload.influence = grantInfluence.trim();
    const resources: Record<string, string> = {};
    for (const row of grantResources) {
      if (row.key.trim() !== '' && row.value.trim() !== '') {
        resources[row.key.trim()] = row.value.trim();
      }
    }
    if (Object.keys(resources).length > 0) payload.resources = resources;
    void actions.grant(payload).then(finish);
  };

  /*
   * Уже выбранные ресурсы — чтобы не дать выбрать один и тот же дважды: payload
   * собирается в объект, и вторая строка молча затирала бы первую.
   */
  const usedResourceKeys = new Set(
    grantResources.map((row) => row.key).filter((key) => key !== ''),
  );

  const grantHasSomething =
    grantCredits.trim() !== '' ||
    grantResearch.trim() !== '' ||
    grantInfluence.trim() !== '' ||
    grantResources.some((row) => row.key.trim() !== '' && row.value.trim() !== '');

  return (
    <>
      {/* Затемнение под панелью — клик закрывает карточку. */}
      <div
        className="absolute inset-0 z-30 bg-black/55 animate-fade-in"
        onClick={close}
        aria-hidden="true"
      />

      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="false"
        aria-label={`Карточка игрока ${player?.email ?? playerId}`}
        className="absolute inset-y-0 right-0 z-40 flex w-full max-w-[780px] flex-col border-l border-edge-strong bg-surface-1 shadow-elev-4 animate-slide-in-right"
      >
        {/* ------------------------------------------------------------ шапка */}
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-edge bg-surface-2 px-4 py-3">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              {player && <OnlineDot online={player.online} lastActivityAt={player.lastActivityAt} />}
              <h3 className="truncate text-sm font-semibold text-content-primary">
                {player?.email ?? `Игрок #${playerId}`}
              </h3>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-2xs tabular-nums text-content-faint">#{playerId}</span>
              {player && <RoleBadge role={player.role} />}
              {isSelf && (
                <Badge tone="warning">
                  <ShieldAlert size={10} aria-hidden="true" />
                  это ваш аккаунт
                </Badge>
              )}
              {player && (
                <BanBadge
                  isBanned={player.isBanned}
                  banPermanent={player.banPermanent}
                  bannedUntil={player.bannedUntil}
                />
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              className="icon-btn"
              onClick={() => void actions.loadDetail(true)}
              disabled={meta.loading}
              aria-label="Обновить карточку"
              title="Обновить карточку"
            >
              <RefreshCw size={16} className={meta.loading ? 'animate-spin' : ''} />
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={close}
              aria-label="Закрыть карточку игрока"
              title="Закрыть карточку игрока (Esc)"
            >
              <X size={16} />
            </button>
          </div>
        </header>

        {/* ------------------------------------------------------------- тело */}
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          {meta.error && (
            <Alert tone="danger" title="Не удалось загрузить карточку">
              {meta.error}
            </Alert>
          )}

          {!detail && meta.loading && <SkeletonRows rows={10} />}

          {detail && player && (
            <>
              {/* ------------------------------------------------ действия */}
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {player.isBanned ? (
                    <button
                      type="button"
                      className="btn btn-xs"
                      onClick={() => openForm('unban')}
                      disabled={busy}
                    >
                      <Gavel size={12} aria-hidden="true" />
                      Разбанить
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn-danger btn-xs"
                      onClick={() => openForm('ban')}
                      disabled={busy}
                    >
                      <Ban size={12} aria-hidden="true" />
                      Забанить
                    </button>
                  )}

                  <button
                    type="button"
                    className="btn btn-xs"
                    onClick={() => openForm('logout')}
                    disabled={busy}
                  >
                    <LogOut size={12} aria-hidden="true" />
                    Выйти со всех устройств
                  </button>

                  {isAdmin && (
                    <>
                      <button
                        type="button"
                        className="btn btn-xs"
                        onClick={() => openForm('password')}
                        disabled={busy}
                      >
                        <KeyRound size={12} aria-hidden="true" />
                        Сменить пароль
                      </button>
                      <button
                        type="button"
                        className="btn btn-xs"
                        onClick={() => openForm('grant')}
                        disabled={busy}
                      >
                        <Coins size={12} aria-hidden="true" />
                        Выдать ресурсы
                      </button>
                      <button
                        type="button"
                        className="btn btn-xs"
                        onClick={() => openForm('cancel-orders')}
                        disabled={busy}
                      >
                        <ShoppingCart size={12} aria-hidden="true" />
                        Отменить все ордера
                      </button>
                      <button
                        type="button"
                        className="btn btn-xs"
                        onClick={() => openForm('role')}
                        disabled={busy}
                      >
                        <Shield size={12} aria-hidden="true" />
                        Изменить роль
                      </button>
                      <button
                        type="button"
                        className="btn btn-xs"
                        onClick={() => openForm('note')}
                        disabled={busy}
                      >
                        <StickyNote size={12} aria-hidden="true" />
                        Заметка
                      </button>
                      <button
                        type="button"
                        className="btn-danger btn-xs"
                        onClick={() => openForm('delete')}
                        disabled={busy}
                      >
                        <Trash2 size={12} aria-hidden="true" />
                        Удалить
                      </button>
                    </>
                  )}
                </div>

                {!isAdmin && (
                  <p className="text-3xs text-content-faint">
                    Роль «модератор»: доступны блокировка, разблокировка и завершение сессий.
                    Остальные действия требуют прав администратора.
                  </p>
                )}

                {isSelf && (
                  <p className="flex items-start gap-1.5 text-3xs text-warning">
                    <ShieldAlert size={12} className="mt-px shrink-0" aria-hidden="true" />
                    <span>
                      Это ваш аккаунт. «Выйти со всех устройств» и «Сменить пароль» применятся к вам и
                      завершат текущий вход; бан, удаление и смену своей роли сервер не выполнит.
                    </span>
                  </p>
                )}

                {action.error && (
                  <Alert tone="danger" title="Действие не выполнено">
                    {action.error}
                    {action.code === 'PLAYER_HAS_ACTIVE_SESSION' && (
                      <p className="mt-1">
                        Отметьте «выдать принудительно» или сначала завершите сессии игрока.
                      </p>
                    )}
                  </Alert>
                )}
                {action.result && (
                  <Alert tone="accent" title="Готово" onDismiss={() => actions.clearActionState()}>
                    {action.result}
                  </Alert>
                )}

                {/* --------------------------------------------- формы */}
                {form === 'ban' && (
                  <div className="card space-y-2 border-danger/40">
                    <p className="text-xs font-semibold text-danger">Блокировка игрока</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Field label="Срок">
                        <select
                          value={banDays}
                          onChange={(e) => setBanDays(e.target.value)}
                          className="rounded-md px-2 py-1.5 text-xs"
                        >
                          {BAN_PRESETS.map((preset) => (
                            <option key={preset.label} value={preset.value}>
                              <IconText>{preset.label}</IconText>
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Причина" hint="обязательно, до 500 символов">
                        <input
                          type="text"
                          value={banReason}
                          onChange={(e) => setBanReason(e.target.value)}
                          maxLength={500}
                          data-autofocus
                          className="rounded-md px-2 py-1.5 text-xs"
                        />
                      </Field>
                    </div>
                    <p className="text-3xs text-content-faint">
                      Все активные сессии игрока будут погашены.
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="btn-danger btn-xs"
                        disabled={busy || banReason.trim() === ''}
                        onClick={() =>
                          void actions
                            .banPlayer(banReason.trim(), banDays === '' ? null : Number(banDays))
                            .then(finish)
                        }
                      >
                        Подтвердить блокировку
                      </button>
                      <button type="button" className="btn-ghost btn-xs" onClick={() => setForm(null)}>
                        Отмена
                      </button>
                    </div>
                  </div>
                )}

                {form === 'unban' && (
                  <div className="card space-y-2">
                    <p className="text-xs font-semibold text-content-primary">Снять блокировку?</p>
                    <p className="text-3xs text-content-faint">
                      Причина «{player.banReason ?? 'не указана'}» будет удалена, старые сессии — тоже.
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="btn-primary btn-xs"
                        disabled={busy}
                        onClick={() => void actions.unbanPlayer().then(finish)}
                      >
                        Разбанить
                      </button>
                      <button type="button" className="btn-ghost btn-xs" onClick={() => setForm(null)}>
                        Отмена
                      </button>
                    </div>
                  </div>
                )}

                {form === 'logout' && (
                  <div className={`card space-y-2 ${isSelf ? 'border-warning/60 bg-warning/5' : ''}`}>
                    <p className="text-xs font-semibold text-content-primary">
                      {isSelf ? 'Завершить ВАШИ сессии?' : 'Завершить все сессии игрока?'}
                    </p>
                    {isSelf ? (
                      <Alert tone="warning" title="Это ваш собственный аккаунт">
                        Активных сессий: {formatInt(player.sessionCount)} — среди них та, в которой вы
                        сейчас работаете. Вас выкинет из игры и из админки на всех устройствах, и
                        придётся войти заново своим паролем.
                      </Alert>
                    ) : (
                      <p className="text-3xs text-content-faint">
                        Активных сессий: {formatInt(player.sessionCount)}. Игрока выкинет из игры на
                        всех устройствах.
                      </p>
                    )}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="btn-danger btn-xs"
                        disabled={busy}
                        onClick={() => void actions.logoutAll(isSelf).then(finish)}
                      >
                        {isSelf ? 'Завершить сессии и выйти' : 'Завершить сессии'}
                      </button>
                      <button type="button" className="btn-ghost btn-xs" onClick={() => setForm(null)}>
                        Отмена
                      </button>
                    </div>
                  </div>
                )}

                {form === 'password' && isAdmin && (
                  <div className={`card space-y-2 ${isSelf ? 'border-danger/60 bg-danger/5' : ''}`}>
                    <p className="text-xs font-semibold text-content-primary">
                      {isSelf ? 'Новый пароль ВАШЕГО аккаунта' : 'Новый пароль'}
                    </p>

                    {isSelf && (
                      <Alert tone="danger" title="Это ваш собственный аккаунт">
                        Пароль сменится у вас, все ваши сессии будут погашены, и войти обратно можно
                        будет только этим паролем. Опечатка или пароль, который вы не сможете
                        воспроизвести, означает потерю доступа к админке — из интерфейса его уже не
                        восстановить.
                      </Alert>
                    )}

                    <Field label="Пароль" hint="минимум 6 символов">
                      <input
                        type="text"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        autoComplete="new-password"
                        data-autofocus
                        className="rounded-md px-2 py-1.5 text-xs"
                      />
                    </Field>

                    {isSelf ? (
                      <>
                        <Field
                          label="Повторите пароль"
                          hint="защита от опечатки"
                          error={
                            newPasswordRepeat !== '' && newPasswordRepeat !== newPassword
                              ? 'Пароли не совпадают.'
                              : undefined
                          }
                        >
                          <input
                            type="text"
                            value={newPasswordRepeat}
                            onChange={(e) => setNewPasswordRepeat(e.target.value)}
                            autoComplete="new-password"
                            className="rounded-md px-2 py-1.5 text-xs"
                          />
                        </Field>
                        <Field label="Подтвердите свой e-mail" hint="точное совпадение">
                          <input
                            type="text"
                            value={selfConfirmEmail}
                            onChange={(e) => setSelfConfirmEmail(e.target.value)}
                            placeholder={player.email}
                            autoComplete="off"
                            className="rounded-md px-2 py-1.5 text-xs"
                          />
                        </Field>
                      </>
                    ) : (
                      <p className="text-3xs text-content-faint">
                        Все сессии игрока будут удалены. Пароль другого администратора сменить нельзя.
                      </p>
                    )}

                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="btn-danger btn-xs"
                        disabled={
                          busy ||
                          newPassword.length < 6 ||
                          (isSelf &&
                            (newPasswordRepeat !== newPassword || selfConfirmEmail !== player.email))
                        }
                        onClick={() => void actions.resetPassword(newPassword, isSelf).then(finish)}
                      >
                        {isSelf ? 'Сменить свой пароль и выйти' : 'Сменить пароль'}
                      </button>
                      <button type="button" className="btn-ghost btn-xs" onClick={() => setForm(null)}>
                        Отмена
                      </button>
                    </div>
                  </div>
                )}

                {form === 'grant' && isAdmin && (
                  <div className="card space-y-2">
                    <p className="text-xs font-semibold text-content-primary">
                      Выдача в сохранение
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Field label="Слот" hint="по умолчанию — текущий">
                        <select
                          value={grantSlotId}
                          onChange={(e) => setGrantSlotId(e.target.value)}
                          className="rounded-md px-2 py-1.5 text-xs"
                        >
                          <option value="">Текущий слот игрока</option>
                          {detail.slots.map((slot) => (
                            <option key={slot.id} value={slot.id}>
                              #{slot.id} · {slot.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Кредиты" hint="можно 1e12">
                        <input
                          type="text"
                          value={grantCredits}
                          onChange={(e) => setGrantCredits(e.target.value)}
                          placeholder="0"
                          data-autofocus
                          className="rounded-md px-2 py-1.5 text-xs"
                        />
                      </Field>
                      <Field label="Очки исследований">
                        <input
                          type="text"
                          value={grantResearch}
                          onChange={(e) => setGrantResearch(e.target.value)}
                          placeholder="0"
                          className="rounded-md px-2 py-1.5 text-xs"
                        />
                      </Field>
                      <Field label="Влияние">
                        <input
                          type="text"
                          value={grantInfluence}
                          onChange={(e) => setGrantInfluence(e.target.value)}
                          placeholder="0"
                          className="rounded-md px-2 py-1.5 text-xs"
                        />
                      </Field>
                    </div>

                    <div className="space-y-1">
                      <span className="text-2xs font-medium uppercase tracking-wider text-content-faint">
                        Ресурсы
                      </span>
                      {grantResources.map((row, index) => (
                        <div key={index} className="flex items-center gap-1.5">
                          <select
                            value={row.key}
                            onChange={(e) =>
                              setGrantResources((rows) =>
                                rows.map((r, i) => (i === index ? { ...r, key: e.target.value } : r)),
                              )
                            }
                            aria-label={`Ресурс ${index + 1}`}
                            className="min-w-0 flex-1 rounded-md px-2 py-1 text-xs"
                          >
                            <option value="">— выберите ресурс —</option>
                            {GRANT_RESOURCE_OPTIONS.map((option) => (
                              <option
                                key={option.id}
                                value={option.id}
                                disabled={option.id !== row.key && usedResourceKeys.has(option.id)}
                              >
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            value={row.value}
                            onChange={(e) =>
                              setGrantResources((rows) =>
                                rows.map((r, i) =>
                                  i === index ? { ...r, value: e.target.value } : r,
                                ),
                              )
                            }
                            placeholder="1000"
                            aria-label={`Количество ресурса ${index + 1}`}
                            className="w-32 rounded-md px-2 py-1 text-xs"
                          />
                          <button
                            type="button"
                            className="icon-btn h-6 w-6"
                            onClick={() =>
                              setGrantResources((rows) => rows.filter((_, i) => i !== index))
                            }
                            aria-label={`Убрать ресурс ${index + 1}`}
                            title="Убрать ресурс"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        className="btn btn-xs"
                        disabled={grantResources.length >= GRANT_RESOURCE_OPTIONS.length}
                        onClick={() =>
                          setGrantResources((rows) => [...rows, { key: '', value: '' }])
                        }
                      >
                        Добавить ресурс
                      </button>
                    </div>

                    <label className="flex items-center gap-2 text-xs text-content-secondary">
                      <input
                        type="checkbox"
                        checked={grantForce}
                        onChange={(e) => setGrantForce(e.target.checked)}
                        className="h-3.5 w-3.5"
                      />
                      Выдать принудительно (сессия есть, но игрок не в сети)
                    </label>
                    {/*
                      Пункт 9 в bigplan.md: раньше клиент онлайн-игрока перезаписывал выдачу
                      автосохранением, и force был единственным выходом. Теперь подключённому
                      игроку выдача досылается по realtime-каналу и применяется сразу —
                      force нужен только когда сессия есть, а канала нет (старая вкладка).
                    */}
                    <p className="text-3xs text-content-faint">
                      Если игрок подключён к серверу, выдача применится у него сразу и force не
                      нужен. Флажок — для случая, когда сессия висит, но связи нет: тогда клиент
                      может перезаписать выдачу автосохранением, и надёжнее сначала завершить
                      его сессии.
                    </p>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="btn-primary btn-xs"
                        disabled={busy || !grantHasSomething}
                        onClick={submitGrant}
                      >
                        Выдать
                      </button>
                      <button type="button" className="btn-ghost btn-xs" onClick={() => setForm(null)}>
                        Отмена
                      </button>
                    </div>
                  </div>
                )}

                {form === 'cancel-orders' && isAdmin && (
                  <div className="card space-y-2">
                    <p className="text-xs font-semibold text-content-primary">
                      Отменить все открытые ордера?
                    </p>
                    <p className="text-3xs text-content-faint">
                      Открытых и частично исполненных ордеров: {formatInt(player.openOrderCount)}.
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="btn-danger btn-xs"
                        disabled={busy}
                        onClick={() => void actions.cancelOrders().then(finish)}
                      >
                        Отменить ордера
                      </button>
                      <button type="button" className="btn-ghost btn-xs" onClick={() => setForm(null)}>
                        Отмена
                      </button>
                    </div>
                  </div>
                )}

                {form === 'role' && isAdmin && (
                  <div className="card space-y-2">
                    <p className="text-xs font-semibold text-content-primary">Роль игрока</p>
                    <Field label="Новая роль">
                      <select
                        value={roleValue}
                        onChange={(e) => setRoleValue(e.target.value as AdminRole)}
                        className="rounded-md px-2 py-1.5 text-xs"
                      >
                        <option value="player">игрок</option>
                        <option value="moderator">модератор</option>
                        <option value="admin">администратор</option>
                      </select>
                    </Field>
                    <p className="text-3xs text-content-faint">
                      {isSelf
                        ? 'Это ваш аккаунт: свою роль изменить нельзя — сервер отклонит запрос.'
                        : 'Свою роль изменить нельзя; последнего администратора нельзя понизить.'}
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="btn-danger btn-xs"
                        disabled={busy || isSelf || roleValue === player.role}
                        onClick={() => void actions.patchPlayer({ role: roleValue }).then(finish)}
                      >
                        Назначить «{roleLabel(roleValue)}»
                      </button>
                      <button type="button" className="btn-ghost btn-xs" onClick={() => setForm(null)}>
                        Отмена
                      </button>
                    </div>
                  </div>
                )}

                {form === 'note' && isAdmin && (
                  <div className="card space-y-2">
                    <p className="text-xs font-semibold text-content-primary">
                      Служебная заметка
                    </p>
                    <Field label="Текст" hint="видна только персоналу">
                      <textarea
                        value={noteValue}
                        onChange={(e) => setNoteValue(e.target.value)}
                        rows={3}
                        maxLength={10000}
                        data-autofocus
                        className="rounded-md px-2 py-1.5 text-xs"
                      />
                    </Field>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="btn-primary btn-xs"
                        disabled={busy}
                        onClick={() =>
                          void actions
                            .patchPlayer({ notes: noteValue.trim() === '' ? null : noteValue })
                            .then(finish)
                        }
                      >
                        <Save size={12} aria-hidden="true" />
                        Сохранить заметку
                      </button>
                      <button type="button" className="btn-ghost btn-xs" onClick={() => setForm(null)}>
                        Отмена
                      </button>
                    </div>
                  </div>
                )}

                {form === 'delete' && isAdmin && (
                  <div className="card space-y-2 border-danger/60 bg-danger/5">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-danger">
                      <AlertTriangle size={13} aria-hidden="true" />
                      Безвозвратное удаление аккаунта
                    </p>
                    <p className="text-3xs text-content-faint">
                      Будут удалены сохранения, слоты, ордера, сделки и кредиты. Гильдии, которыми
                      игрок руководит, получат нового лидера или будут расформированы.
                    </p>
                    <Field label="Подтвердите e-mail" hint="точное совпадение">
                      <input
                        type="text"
                        value={confirmEmail}
                        onChange={(e) => setConfirmEmail(e.target.value)}
                        placeholder={player.email}
                        autoComplete="off"
                        data-autofocus
                        className="rounded-md px-2 py-1.5 text-xs"
                      />
                    </Field>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="btn-danger btn-xs"
                        disabled={busy || confirmEmail !== player.email}
                        onClick={() => void actions.deletePlayer(confirmEmail).then(finish)}
                      >
                        <Trash2 size={12} aria-hidden="true" />
                        Удалить навсегда
                      </button>
                      <button type="button" className="btn-ghost btn-xs" onClick={() => setForm(null)}>
                        Отмена
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* ------------------------------------------ идентификация */}
              <Section title="Идентификация" icon={<Users size={13} />} defaultOpen>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <KeyValue label="ID">
                    <Num>#{player.id}</Num>
                  </KeyValue>
                  <KeyValue label="E-mail" title={player.email}>
                    {player.email}
                  </KeyValue>
                  <KeyValue label="Роль">{roleLabel(player.role)}</KeyValue>
                  <KeyValue label="Регистрация" title={formatFull(player.createdAt)}>
                    <When value={player.createdAt} />
                  </KeyValue>
                  <KeyValue label="Последний вход">
                    <When value={player.lastSeenAt} />
                  </KeyValue>
                  <KeyValue label="Активность">
                    <When value={player.lastActivityAt} />
                  </KeyValue>
                  <KeyValue label="Текущий слот">
                    <Num>{player.currentSlotId ?? '—'}</Num>
                  </KeyValue>
                  <KeyValue label="Текущее сохранение">
                    <Num>{player.currentSaveId ?? '—'}</Num>
                  </KeyValue>
                  <KeyValue label="Время в игре">
                    <Num title={`${player.playTimeSeconds} с`}>
                      {formatDuration(player.playTimeSeconds)}
                    </Num>
                  </KeyValue>
                </div>

                <div className="divider" />

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Stat label="Оборот" value={formatAmount(player.totalVolume)} hint={player.totalVolume} />
                  <Stat
                    label="Сделки"
                    value={`${formatInt(player.successfulTrades)}/${formatInt(player.totalTrades)}`}
                  />
                  <Stat label="Рейтинг" value={formatAmount(player.traderRating)} />
                  <Stat label="Открытых ордеров" value={formatInt(player.openOrderCount)} />
                </div>

                {player.isBanned && (
                  <div className="mt-3">
                    <Alert tone="danger" title="Аккаунт заблокирован">
                      Причина: {player.banReason ?? 'не указана'}.{' '}
                      {player.banPermanent
                        ? 'Бан бессрочный.'
                        : `До ${formatFull(player.bannedUntil)}.`}
                    </Alert>
                  </div>
                )}

                {player.notes && (
                  <div className="mt-3 rounded-md border border-warning/40 bg-warning/10 p-2">
                    <p className="stat-label">Заметка</p>
                    <p className="whitespace-pre-wrap break-words text-xs text-content-secondary">
                      {player.notes}
                    </p>
                  </div>
                )}

                <div className="mt-3 space-y-1">
                  <p className="stat-label">
                    Закреплённые ресурсы: {player.pinnedResources?.join(', ') || '—'}
                  </p>
                  <details>
                    <summary className="cursor-pointer text-2xs text-content-faint hover:text-content-primary">
                      Настройки игрока (JSON)
                    </summary>
                    <div className="mt-1">
                      <JsonBlock value={player.settings} maxChars={8000} />
                    </div>
                  </details>
                </div>
              </Section>

              {/* --------------------------------------------------- слоты */}
              <Section title="Слоты" icon={<Save size={13} />} count={detail.slots.length}>
                {detail.slots.length === 0 ? (
                  <EmptyState title="Слотов нет" />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th scope="col">ID</th>
                          <th scope="col">Название</th>
                          <th scope="col">Создан</th>
                          <th scope="col">Играли</th>
                          <th scope="col" className="text-right">
                            В игре
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.slots.map((slot) => (
                          <tr key={slot.id}>
                            <td>
                              <Num>#{slot.id}</Num>
                            </td>
                            <td className="max-w-[14rem]">
                              <span className="block truncate text-content-primary">{slot.name}</span>
                              {slot.description && (
                                <span className="block truncate text-3xs text-content-faint">
                                  <IconText>{slot.description}</IconText>
                                </span>
                              )}
                            </td>
                            <td>
                              <When value={slot.created_at} />
                            </td>
                            <td>
                              <When value={slot.last_played_at} />
                            </td>
                            <td className="text-right">
                              <Num>{formatDuration(slot.play_time_seconds)}</Num>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Section>

              {/* ---------------------------------------------- сохранения */}
              <Section title="Сохранения" icon={<Save size={13} />} count={detail.saves.length}>
                {detail.saves.length === 0 ? (
                  <EmptyState title="Сохранений нет" />
                ) : (
                  <div className="space-y-2">
                    <div className="overflow-x-auto">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th scope="col">ID</th>
                            <th scope="col">Название</th>
                            <th scope="col">Тип</th>
                            <th scope="col">Слот</th>
                            <th scope="col">Обновлено</th>
                            <th scope="col" className="text-right">
                              Размер
                            </th>
                            <th scope="col" />
                          </tr>
                        </thead>
                        <tbody>
                          {detail.saves.map((save) => (
                            <tr key={save.id}>
                              <td>
                                <Num>#{save.id}</Num>
                              </td>
                              <td className="max-w-[12rem] truncate" title={save.name}>
                                {save.name}
                              </td>
                              <td>
                                <Badge tone={save.save_type === 'auto' ? 'neutral' : 'info'}>
                                  {save.save_type}
                                </Badge>
                              </td>
                              <td>
                                <Num>{save.slot_id ?? '—'}</Num>
                              </td>
                              <td>
                                <When value={save.updated_at} />
                              </td>
                              <td className="text-right">
                                <Num title={`${save.size_bytes} Б`}>
                                  {formatBytes(save.size_bytes)}
                                </Num>
                              </td>
                              <td className="text-right">
                                <button
                                  type="button"
                                  className="btn btn-xs"
                                  onClick={() => void viewSave(save.id)}
                                  disabled={saveLoading !== null}
                                  title={`Посмотреть JSON сохранения #${save.id}`}
                                >
                                  <Eye size={11} aria-hidden="true" />
                                  {saveLoading === save.id ? 'Загрузка…' : 'Посмотреть'}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {saveError && <Alert tone="danger">{saveError}</Alert>}

                    {saveView && (
                      <details open className="rounded-md border border-edge bg-surface-3 p-2">
                        <summary className="cursor-pointer text-xs text-content-secondary">
                          Сохранение #{saveView.id} «{saveView.name}» ·{' '}
                          {formatBytes(saveView.size_bytes)}
                        </summary>
                        <div className="mt-2">
                          <JsonBlock value={saveView.data} sizeBytes={saveView.size_bytes} />
                          <button
                            type="button"
                            className="btn-ghost btn-xs mt-1"
                            onClick={() => setSaveView(null)}
                          >
                            Скрыть
                          </button>
                        </div>
                      </details>
                    )}
                  </div>
                )}
              </Section>

              {/* ------------------------------------------------- сессии */}
              <Section title="Сессии" icon={<Radio size={13} />} count={detail.sessions.length}>
                {detail.sessions.length === 0 ? (
                  <EmptyState title="Активных сессий нет" />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th scope="col">ID</th>
                          <th scope="col">Создана</th>
                          <th scope="col">Активность</th>
                          <th scope="col">Истекает</th>
                          <th scope="col">IP</th>
                          <th scope="col">Клиент</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.sessions.map((session) => (
                          <tr key={session.id}>
                            <td>
                              <Num>#{session.id}</Num>
                            </td>
                            <td>
                              <When value={session.created_at} />
                            </td>
                            <td>
                              <When value={session.last_activity_at} />
                            </td>
                            <td>
                              <When value={session.expires_at} />
                            </td>
                            <td>
                              <Num>{session.ip_address ?? '—'}</Num>
                            </td>
                            <td
                              className="max-w-[14rem] truncate"
                              title={session.user_agent ?? undefined}
                            >
                              {session.user_agent ?? '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Section>

              {/* ------------------------------------------------- ордера */}
              <Section
                title="Ордера"
                icon={<ListOrdered size={13} />}
                count={detail.marketOrders.length}
              >
                {detail.marketOrders.length === 0 ? (
                  <EmptyState title="Ордеров нет" />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th scope="col">ID</th>
                          <th scope="col">Тип</th>
                          <th scope="col">Ресурс</th>
                          <th scope="col" className="text-right">
                            Количество
                          </th>
                          <th scope="col" className="text-right">
                            Цена
                          </th>
                          <th scope="col">Статус</th>
                          <th scope="col">Создан</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.marketOrders.map((order) => (
                          <tr key={order.id}>
                            <td>
                              <Num title={order.id}>{shortId(order.id)}</Num>
                            </td>
                            <td>
                              <Badge tone={order.order_type === 'buy' ? 'info' : 'accent'}>
                                {order.order_type === 'buy' ? 'покупка' : 'продажа'}
                              </Badge>
                            </td>
                            <td>{order.resource}</td>
                            <td className="text-right">
                              <Num title={`исполнено: ${order.quantity_filled ?? '0'}`}>
                                {formatAmount(order.quantity)}
                              </Num>
                            </td>
                            <td className="text-right">
                              <Num title={order.price_per_unit}>
                                {formatAmount(order.price_per_unit)}
                              </Num>
                            </td>
                            <td>
                              <Badge
                                tone={
                                  order.status === 'open'
                                    ? 'info'
                                    : order.status === 'partial'
                                      ? 'warning'
                                      : order.status === 'filled'
                                        ? 'accent'
                                        : 'neutral'
                                }
                              >
                                {order.status}
                              </Badge>
                            </td>
                            <td>
                              <When value={order.created_at} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Section>

              {/* ------------------------------------------------- сделки */}
              <Section
                title="Сделки"
                icon={<ShoppingCart size={13} />}
                count={detail.marketTrades.length}
              >
                {detail.marketTrades.length === 0 ? (
                  <EmptyState title="Сделок нет" />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th scope="col">Сторона</th>
                          <th scope="col">Ресурс</th>
                          <th scope="col" className="text-right">
                            Количество
                          </th>
                          <th scope="col" className="text-right">
                            Сумма
                          </th>
                          <th scope="col" className="text-right">
                            Комиссия
                          </th>
                          <th scope="col">Контрагент</th>
                          <th scope="col">Когда</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.marketTrades.map((trade) => (
                          <tr key={trade.id}>
                            <td>
                              <Badge tone={trade.side === 'buy' ? 'info' : 'accent'}>
                                {trade.side === 'buy' ? 'покупка' : 'продажа'}
                              </Badge>
                            </td>
                            <td>{trade.resource}</td>
                            <td className="text-right">
                              <Num title={trade.quantity}>{formatAmount(trade.quantity)}</Num>
                            </td>
                            <td className="text-right">
                              <Num title={trade.total_amount}>{formatAmount(trade.total_amount)}</Num>
                            </td>
                            <td className="text-right">
                              <Num title={trade.fee}>{formatAmount(trade.fee)}</Num>
                            </td>
                            <td
                              className="max-w-[12rem] truncate"
                              title={trade.counterparty_email ?? undefined}
                            >
                              {trade.counterparty_email ?? '—'}
                            </td>
                            <td>
                              <When value={trade.executed_at} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Section>

              {/* -------------------------------------------- кредиты P2P */}
              <Section
                title="Кредиты P2P"
                icon={<Coins size={13} />}
                count={detail.p2pLoansAsLender.length + detail.p2pLoansAsBorrower.length}
              >
                <div className="space-y-3">
                  <div>
                    <p className="stat-label mb-1">
                      Выдал ({detail.p2pLoansAsLender.length})
                    </p>
                    {detail.p2pLoansAsLender.length === 0 ? (
                      <EmptyState title="Не выдавал кредитов" />
                    ) : (
                      <LoanRows loans={detail.p2pLoansAsLender} side="lender" />
                    )}
                  </div>
                  <div>
                    <p className="stat-label mb-1">
                      Взял ({detail.p2pLoansAsBorrower.length})
                    </p>
                    {detail.p2pLoansAsBorrower.length === 0 ? (
                      <EmptyState title="Не брал кредитов" />
                    ) : (
                      <LoanRows loans={detail.p2pLoansAsBorrower} side="borrower" />
                    )}
                  </div>
                </div>
              </Section>

              {/* ------------------------------------------------ гильдия */}
              <Section title="Гильдия" icon={<Shield size={13} />} count={player.guild ? 1 : 0}>
                {!player.guild ? (
                  <EmptyState title="Игрок не в гильдии" />
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <KeyValue label="Название">{player.guild.name ?? '—'}</KeyValue>
                    <KeyValue label="Тег">[{player.guild.tag}]</KeyValue>
                    <KeyValue label="Роль в гильдии">{player.guild.role ?? '—'}</KeyValue>
                    <KeyValue label="Вклад" title={player.guild.contribution ?? undefined}>
                      <Num>{formatAmount(player.guild.contribution)}</Num>
                    </KeyValue>
                    <KeyValue label="ID гильдии" title={player.guild.id}>
                      <Num>{shortId(player.guild.id)}</Num>
                    </KeyValue>
                  </div>
                )}
              </Section>

              {/* --------------------------------------- офлайн-трейдинг */}
              <Section
                title="Офлайн-трейдинг"
                icon={<Radio size={13} />}
                count={detail.offlineTradingState.length}
              >
                {detail.offlineTradingState.length === 0 ? (
                  <EmptyState title="Автотрейдер не настраивался" />
                ) : (
                  <div className="space-y-3">
                    {detail.offlineTradingState.map((state) => (
                      <div key={state.id} className="rounded-md border border-edge bg-surface-3 p-2">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="text-xs text-content-secondary">
                            Слот <Num>#{state.slot_id ?? '—'}</Num>
                          </span>
                          <Badge tone={state.autotrader_enabled ? 'accent' : 'neutral'}>
                            {state.autotrader_enabled ? 'автотрейдер включён' : 'выключен'}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                          <KeyValue label="Риск">{state.risk_tolerance ?? '—'}</KeyValue>
                          <KeyValue label="Макс. вложение">
                            <Num>{formatPercent(state.max_investment_percent)}</Num>
                          </KeyValue>
                          <KeyValue label="Тейк-профит">
                            <Num>{formatPercent(state.take_profit_percent)}</Num>
                          </KeyValue>
                          <KeyValue label="Стоп-лосс">
                            <Num>{formatPercent(state.stop_loss_percent)}</Num>
                          </KeyValue>
                          <KeyValue label="Баланс" title={state.balance_snapshot ?? undefined}>
                            <Num>{formatAmount(state.balance_snapshot)}</Num>
                          </KeyValue>
                          <KeyValue label="Офлайн-прибыль" title={state.total_offline_profit ?? undefined}>
                            <Num>{formatAmount(state.total_offline_profit)}</Num>
                          </KeyValue>
                          <KeyValue label="Офлайн-сделок">
                            <Num>{formatInt(state.total_offline_trades ?? 0)}</Num>
                          </KeyValue>
                          <KeyValue label="Последний расчёт">
                            <When value={state.last_offline_calc_at} />
                          </KeyValue>
                        </div>
                        <details className="mt-2">
                          <summary className="cursor-pointer text-2xs text-content-faint hover:text-content-primary">
                            Портфель (JSON)
                          </summary>
                          <div className="mt-1">
                            <JsonBlock value={state.portfolio_snapshot} maxChars={8000} />
                          </div>
                        </details>
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              {/*
                Секции «Устройства» здесь больше нет: она читала таблицу user_devices,
                которую в проекте никто не создаёт и не заполняет, из-за чего весь
                запрос карточки игрока падал с 500. Данные об устройстве и так есть
                в секции «Сессии» — sessions.user_agent / sessions.ip_address.
              */}

              {/* ------------------------------------------------- журнал */}
              <Section
                title="Журнал действий"
                icon={<History size={13} />}
                count={detail.auditLog.length}
              >
                {detail.auditLog.length === 0 ? (
                  <EmptyState title="По этому игроку записей нет" />
                ) : (
                  <ul className="space-y-1.5">
                    {detail.auditLog.map((entry) => (
                      <li key={entry.id} className="rounded-md border border-edge bg-surface-3 p-2">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <span className="text-xs font-medium text-content-primary">
                            {actionLabel(entry.action)}
                          </span>
                          <When value={entry.created_at} />
                        </div>
                        <p className="text-3xs text-content-faint">
                          {entry.admin_email ?? `admin #${entry.admin_id ?? '—'}`} ·{' '}
                          {entry.ip_address ?? 'без IP'} · {entry.action}
                        </p>
                        {entry.details && Object.keys(entry.details).length > 0 && (
                          <details className="mt-1">
                            <summary className="cursor-pointer text-2xs text-content-faint hover:text-content-primary">
                              Детали
                            </summary>
                            <div className="mt-1">
                              <JsonBlock value={entry.details} maxChars={6000} />
                            </div>
                          </details>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              <p className="pb-2 text-3xs text-content-faint">
                Списки ордеров, сделок, кредитов, устройств и журнала сервер отдаёт не более 50
                последних записей; сохранений — до 200. Заметка:{' '}
                {player.notes ? truncate(player.notes, 60) : 'нет'}.
              </p>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
