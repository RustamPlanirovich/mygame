/**
 * СДЕЛКИ С ИГРОКАМИ (прямые предложения).
 *
 * Книга ордеров анонимна и сводит только «ресурс за кредиты». Здесь — адресные
 * сделки: продажа за кредиты И барт «ресурс на ресурс», с сообщением и сроком.
 * Обе ноги проходят через сейф: товар продавца уходит в эскроу при создании
 * предложения, а обмен выполняется одной серверной транзакцией — поэтому
 * «принял и не заплатил» здесь невозможно.
 */

import { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, EmptyState, Modal, Panel, SkeletonRows, Tabs } from '../../ui';
import type { TabItem } from '../../ui';
import { useMarketStore } from '../../../features/marketStore';
import { formatAmount, formatExactAmount, formatTimeLeft } from '../../../features/marketEscrow';
import { parseAmountInput } from '../../../features/vaultBridge';
import { displayPlayerName } from '../../../utils/marketApi';
import { getUserId } from '../../../utils/settingsApi';
import { D } from '../../../core/math/format';
import { VAULT_CREDITS, MARKET_CONSTANTS } from '../../../core/gameTypes.market';
import type {
  DirectOfferDTO,
  DirectOfferStatus,
  TradeResourceType,
  VaultResource,
} from '../../../core/gameTypes.market';
import { RESOURCE_NAMES, TRADEABLE_RESOURCES, vaultResourceName } from './resourceLabels';
import { GameIcon, IconText } from '../../ui/icons';

type OffersTab = 'incoming' | 'public' | 'mine' | 'create';

/** Как часто перечитывать предложения, пока вкладка открыта. */
const OFFERS_POLL_MS = 30_000;

const DURATIONS = [
  { hours: 1, label: '1 час' },
  { hours: 6, label: '6 часов' },
  { hours: 24, label: '24 часа' },
  { hours: 72, label: '3 дня' },
  { hours: 168, label: '7 дней' },
];

const STATUS_LABELS: Record<DirectOfferStatus, { text: string; tone: 'accent' | 'info' | 'warning' | 'danger' | 'neutral' }> = {
  open: { text: 'Активно', tone: 'info' },
  accepted: { text: 'Принято', tone: 'accent' },
  cancelled: { text: 'Отменено', tone: 'neutral' },
  expired: { text: 'Истекло', tone: 'warning' },
  declined: { text: 'Отклонено', tone: 'danger' },
};

/** Что получит и что отдаст ПОКУПАТЕЛЬ (принимающая сторона). */
function payLeg(offer: DirectOfferDTO): { resource: VaultResource; amount: string } {
  return offer.kind === 'sale'
    ? { resource: VAULT_CREDITS, amount: offer.wantCredits ?? '0' }
    : { resource: (offer.wantResource ?? 'ore') as TradeResourceType, amount: offer.wantAmount ?? '0' };
}

export function DirectOffers() {
  const offersPublic = useMarketStore((s) => s.offersPublic);
  const offersIncoming = useMarketStore((s) => s.offersIncoming);
  const offersOutgoing = useMarketStore((s) => s.offersOutgoing);
  const offersLoading = useMarketStore((s) => s.offersLoading);
  const offersError = useMarketStore((s) => s.offersError);
  const offerBusyId = useMarketStore((s) => s.offerBusyId);
  const fetchOffers = useMarketStore((s) => s.fetchOffers);
  const acceptDirectOffer = useMarketStore((s) => s.acceptDirectOffer);
  const declineDirectOffer = useMarketStore((s) => s.declineDirectOffer);
  const cancelDirectOffer = useMarketStore((s) => s.cancelDirectOffer);

  const vaultCredits = useMarketStore((s) => s.vaultCredits);
  const vaultBalances = useMarketStore((s) => s.vaultBalances);
  const vaultLoadedAt = useMarketStore((s) => s.vaultLoadedAt);
  const fetchVault = useMarketStore((s) => s.fetchVault);

  const [tab, setTab] = useState<OffersTab>('incoming');
  const [now, setNow] = useState(() => Date.now());
  const [confirming, setConfirming] = useState<
    { action: 'accept' | 'decline' | 'cancel'; offer: DirectOfferDTO } | null
  >(null);
  const [note, setNote] = useState<{ tone: 'accent' | 'warning' | 'danger'; text: string } | null>(null);

  useEffect(() => {
    fetchOffers();
    if (vaultLoadedAt === 0) fetchVault();
    // Предложения создают и принимают другие игроки, поэтому пока вкладка
    // открыта — периодическое обновление списков.
    const timer = setInterval(fetchOffers, OFFERS_POLL_MS);
    return () => clearInterval(timer);
  }, [fetchOffers, fetchVault, vaultLoadedAt]);

  // Обратный отсчёт до истечения: раз в 30 с достаточно, а перерисовок мало.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const openIncoming = useMemo(() => offersIncoming.filter((o) => o.status === 'open'), [offersIncoming]);
  const openOutgoing = useMemo(() => offersOutgoing.filter((o) => o.status === 'open'), [offersOutgoing]);

  const availableOf = (resource: VaultResource): string =>
    resource === VAULT_CREDITS ? vaultCredits.available : vaultBalances[resource]?.available ?? '0';

  const tabs: TabItem<OffersTab>[] = [
    { id: 'incoming', label: 'Мне', badge: openIncoming.length || undefined },
    { id: 'public', label: 'Доступные', badge: offersPublic.length || undefined },
    { id: 'mine', label: 'Мои', badge: openOutgoing.length || undefined },
    { id: 'create', label: 'Создать' },
  ];

  const runAction = async () => {
    if (!confirming) return;
    const { action, offer } = confirming;
    setConfirming(null);
    const result =
      action === 'accept'
        ? await acceptDirectOffer(offer.id)
        : action === 'decline'
          ? await declineDirectOffer(offer.id)
          : await cancelDirectOffer(offer.id);

    if (result.ok) {
      setNote({
        tone: result.warning ? 'warning' : 'accent',
        text:
          result.warning ??
          (action === 'accept'
            ? 'Сделка совершена.'
            : action === 'decline'
              ? 'Предложение отклонено, товар вернулся продавцу.'
              : 'Предложение отменено, товар вернулся в ваш сейф.'),
      });
    } else {
      setNote({ tone: 'danger', text: result.message ?? 'Не удалось выполнить действие.' });
    }
  };

  const confirmingPay = confirming?.action === 'accept' ? payLeg(confirming.offer) : null;
  const confirmingShort =
    confirmingPay !== null && D(availableOf(confirmingPay.resource)).lt(D(confirmingPay.amount));

  return (
    <div className="space-y-2">
      <Panel
        title="Сделки с игроками"
        subtitle="Адресные продажи и обмен ресурс на ресурс"
        icon={<span><GameIcon icon="🤝" /></span>}
        actions={
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={() => {
              fetchOffers();
              fetchVault();
            }}
            disabled={offersLoading}
          >
            {offersLoading ? '...' : 'Обновить'}
          </button>
        }
        bodyClassName="space-y-2"
      >
        <Tabs items={tabs} value={tab} onChange={setTab} size="sm" />

        {offersError && <Alert tone="danger" title="Ошибка">{offersError}</Alert>}
        {note && (
          <Alert tone={note.tone} onDismiss={() => setNote(null)}>
            <IconText>{note.text}</IconText>
          </Alert>
        )}

        {offersLoading && offersPublic.length === 0 && offersIncoming.length === 0 ? (
          <SkeletonRows rows={3} />
        ) : tab === 'create' ? (
          <CreateOfferForm onCreated={() => setTab('mine')} />
        ) : tab === 'incoming' ? (
          <OfferList
            offers={offersIncoming}
            now={now}
            emptyTitle="Вам пока ничего не предлагали"
            emptyHint="Здесь появятся предложения, адресованные лично вам."
            renderActions={(offer) =>
              offer.status !== 'open' ? null : (
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    className="btn btn-primary btn-xs"
                    disabled={offerBusyId === offer.id}
                    onClick={() => setConfirming({ action: 'accept', offer })}
                  >
                    Принять
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    disabled={offerBusyId === offer.id}
                    onClick={() => setConfirming({ action: 'decline', offer })}
                  >
                    Отклонить
                  </button>
                </div>
              )
            }
            payHint={(offer) => {
              const pay = payLeg(offer);
              const short = D(availableOf(pay.resource)).lt(D(pay.amount));
              return short ? 'В сейфе не хватает средств, чтобы принять' : null;
            }}
          />
        ) : tab === 'public' ? (
          <OfferList
            offers={offersPublic}
            now={now}
            emptyTitle="Публичных предложений нет"
            emptyHint="Любой игрок может выставить предложение — оно появится здесь."
            renderActions={(offer) => (
              <button
                type="button"
                className="btn btn-primary btn-xs"
                disabled={offerBusyId === offer.id}
                onClick={() => setConfirming({ action: 'accept', offer })}
              >
                Принять
              </button>
            )}
            payHint={(offer) => {
              const pay = payLeg(offer);
              const short = D(availableOf(pay.resource)).lt(D(pay.amount));
              return short ? 'В сейфе не хватает средств, чтобы принять' : null;
            }}
          />
        ) : (
          <OfferList
            offers={offersOutgoing}
            now={now}
            emptyTitle="Вы ещё не создавали предложений"
            emptyHint="Вкладка «Создать» — продать конкретному игроку или обменять ресурс на ресурс."
            renderActions={(offer) =>
              offer.status !== 'open' ? null : (
                <button
                  type="button"
                  className="btn btn-danger btn-xs"
                  disabled={offerBusyId === offer.id}
                  onClick={() => setConfirming({ action: 'cancel', offer })}
                >
                  Отменить
                </button>
              )
            }
          />
        )}
      </Panel>

      {/* Подтверждение действия */}
      <Modal
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        title={
          confirming?.action === 'accept'
            ? 'Принять предложение?'
            : confirming?.action === 'decline'
              ? 'Отклонить предложение?'
              : 'Отменить предложение?'
        }
        size="sm"
        dismissOnBackdrop={false}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-ghost btn-xs" onClick={() => setConfirming(null)}>
              Не сейчас
            </button>
            <button
              type="button"
              className={`btn btn-xs ${confirming?.action === 'accept' ? 'btn-primary' : 'btn-danger'}`}
              onClick={runAction}
              disabled={confirming?.action === 'accept' && confirmingShort}
            >
              {confirming?.action === 'accept' ? 'Принять' : 'Подтвердить'}
            </button>
          </div>
        }
      >
        {confirming && (
          <div className="space-y-2 p-4 text-xs">
            <p className="text-content-secondary">
              {vaultResourceName(confirming.offer.offerResource)}:{' '}
              <span className="font-mono tabular-nums">{formatAmount(confirming.offer.offerAmount)}</span>
            </p>
            {confirming.action === 'accept' && confirmingPay && (
              <>
                <p className="text-content-secondary">
                  Вы заплатите:{' '}
                  <span className="font-mono tabular-nums">
                    {formatAmount(confirmingPay.amount)} {vaultResourceName(confirmingPay.resource)}
                  </span>
                </p>
                <p className="text-3xs text-content-faint">
                  Списание и зачисление происходят внутри сейфа биржи. Чтобы пользоваться товаром в
                  игре, выведите его во вкладке «Кошелёк биржи».
                </p>
                {confirmingShort && (
                  <Alert tone="danger" title="В сейфе не хватает средств">
                    Нужно {formatAmount(confirmingPay.amount)}{' '}
                    {vaultResourceName(confirmingPay.resource)}, свободно{' '}
                    {formatAmount(availableOf(confirmingPay.resource))}.
                  </Alert>
                )}
              </>
            )}
            {confirming.action === 'decline' && (
              <p className="text-3xs text-content-faint">Товар вернётся в сейф продавца.</p>
            )}
            {confirming.action === 'cancel' && (
              <p className="text-3xs text-content-faint">
                Товар из эскроу вернётся в свободный остаток вашего сейфа.
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ==========================================================================
   Список предложений
   ========================================================================== */

function OfferList({
  offers,
  now,
  emptyTitle,
  emptyHint,
  renderActions,
  payHint,
}: {
  offers: DirectOfferDTO[];
  now: number;
  emptyTitle: string;
  emptyHint: string;
  renderActions: (offer: DirectOfferDTO) => React.ReactNode;
  payHint?: (offer: DirectOfferDTO) => string | null;
}) {
  if (offers.length === 0) {
    return <EmptyState title={emptyTitle} hint={emptyHint} />;
  }

  return (
    <div className="space-y-1.5">
      {offers.map((offer) => {
        const status = STATUS_LABELS[offer.status];
        const hint = payHint?.(offer) ?? null;
        return (
          <div key={offer.id} className="card space-y-1.5 p-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone={offer.kind === 'sale' ? 'accent' : 'info'}>
                {offer.kind === 'sale' ? 'Продажа' : 'Обмен'}
              </Badge>
              <Badge tone={status.tone === 'neutral' ? 'neutral' : status.tone}><IconText>{status.text}</IconText></Badge>
              {offer.isPublic && <Badge>Публичное</Badge>}
              <span className="ml-auto text-3xs text-content-faint">
                {offer.status === 'open'
                  ? `истекает через ${formatTimeLeft(offer.expiresAt, now)}`
                  : new Date(offer.createdAt).toLocaleString('ru-RU', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
              </span>
            </div>

            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs">
              <span className="text-content-faint">Отдаёт</span>
              <span className="font-mono tabular-nums text-accent" title={formatExactAmount(offer.offerAmount)}>
                {formatAmount(offer.offerAmount)} {vaultResourceName(offer.offerResource)}
              </span>
              <span className="text-content-faint">за</span>
              <span className="font-mono tabular-nums text-warning">
                {offer.kind === 'sale'
                  ? `${formatAmount(offer.wantCredits ?? '0')} ₡`
                  : `${formatAmount(offer.wantAmount ?? '0')} ${vaultResourceName(offer.wantResource ?? '')}`}
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <span className="text-3xs text-content-faint">
                {offer.isMine
                  ? offer.isPublic
                    ? 'Ваше предложение · любому игроку'
                    : `Ваше предложение · ${displayPlayerName(offer.buyerName, offer.buyerId)}`
                  : `От ${displayPlayerName(offer.sellerName, offer.sellerId)}`}
              </span>
              {renderActions(offer)}
            </div>

            {offer.message && (
              <p className="rounded-md bg-surface-3 px-2 py-1 text-3xs italic text-content-muted">
                «{offer.message}»
              </p>
            )}
            {hint && <p className="text-3xs text-danger">{hint}</p>}
          </div>
        );
      })}
    </div>
  );
}

/* ==========================================================================
   Форма создания
   ========================================================================== */

function CreateOfferForm({ onCreated }: { onCreated: () => void }) {
  const vaultCredits = useMarketStore((s) => s.vaultCredits);
  const vaultBalances = useMarketStore((s) => s.vaultBalances);
  const createDirectOffer = useMarketStore((s) => s.createDirectOffer);
  const offersLoading = useMarketStore((s) => s.offersLoading);
  const leaderboard = useMarketStore((s) => s.leaderboard);
  const fetchLeaderboard = useMarketStore((s) => s.fetchLeaderboard);
  const setActiveTab = useMarketStore((s) => s.setActiveTab);

  const myId = getUserId();

  const [kind, setKind] = useState<'sale' | 'barter'>('sale');
  const [offerResource, setOfferResource] = useState<TradeResourceType | ''>('');
  const [offerAmount, setOfferAmount] = useState('');
  const [wantCredits, setWantCredits] = useState('');
  const [wantResource, setWantResource] = useState<TradeResourceType | ''>('');
  const [wantAmount, setWantAmount] = useState('');
  const [buyerId, setBuyerId] = useState('');
  const [message, setMessage] = useState('');
  const [durationHours, setDurationHours] = useState<number>(MARKET_CONSTANTS.DEFAULT_OFFER_HOURS);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Список получателей: те, кто вообще торгует. Без него пришлось бы
    // вводить числовой id игрока руками.
    if (leaderboard.length === 0) fetchLeaderboard();
  }, [leaderboard.length, fetchLeaderboard]);

  /** Отдавать можно только то, что свободно лежит в сейфе. */
  const sellable = useMemo(
    () =>
      TRADEABLE_RESOURCES.filter((resource) => {
        const row = vaultBalances[resource];
        return row && D(row.available).gt(0);
      }),
    [vaultBalances],
  );

  const available = offerResource ? vaultBalances[offerResource]?.available ?? '0' : '0';
  const parsedOffer = offerAmount ? parseAmountInput(offerAmount) : null;
  const tooMuch = parsedOffer && 'amount' in parsedOffer && D(parsedOffer.amount).gt(D(available));

  const recipients = useMemo(
    () => leaderboard.filter((t) => t.playerId !== myId),
    [leaderboard, myId],
  );

  const submit = async () => {
    setError(null);
    if (!offerResource) {
      setError('Выберите ресурс, который отдаёте.');
      return;
    }
    const offer = parseAmountInput(offerAmount);
    if ('error' in offer) {
      setError(`Количество: ${offer.error}`);
      return;
    }
    if (D(offer.amount).gt(D(available))) {
      setError(`В сейфе свободно только ${formatAmount(available)}.`);
      return;
    }

    let want: { wantCredits?: string; wantResource?: TradeResourceType; wantAmount?: string };
    if (kind === 'sale') {
      const price = parseAmountInput(wantCredits);
      if ('error' in price) {
        setError(`Цена: ${price.error}`);
        return;
      }
      want = { wantCredits: price.amount };
    } else {
      if (!wantResource) {
        setError('Выберите ресурс, который хотите получить.');
        return;
      }
      if (wantResource === offerResource) {
        setError('Обмен ресурса на самого себя не имеет смысла.');
        return;
      }
      const amount = parseAmountInput(wantAmount);
      if ('error' in amount) {
        setError(`Количество обмена: ${amount.error}`);
        return;
      }
      want = { wantResource, wantAmount: amount.amount };
    }

    const result = await createDirectOffer({
      offerResource,
      offerAmount: offer.amount,
      ...want,
      buyerId: buyerId || null,
      message: message.trim() || undefined,
      durationHours,
    });

    if (result.ok) {
      setOfferAmount('');
      setWantCredits('');
      setWantAmount('');
      setMessage('');
      onCreated();
    } else {
      setError(result.message ?? 'Не удалось создать предложение.');
    }
  };

  if (sellable.length === 0) {
    return (
      <EmptyState
        title="В сейфе нет свободных ресурсов"
        hint="Предложение сразу отправляет товар в эскроу, поэтому сначала внесите ресурс в сейф биржи."
        action={
          <button type="button" className="btn btn-primary btn-xs" onClick={() => setActiveTab('vault')}>
            Открыть «Кошелёк биржи»
          </button>
        }
      />
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="tabs">
        <button type="button" className={`tab ${kind === 'sale' ? 'tab-active' : ''}`} onClick={() => setKind('sale')}>
          <GameIcon icon="💰" /> Продать за кредиты
        </button>
        <button
          type="button"
          className={`tab ${kind === 'barter' ? 'tab-active' : ''}`}
          onClick={() => setKind('barter')}
        >
          <GameIcon icon="🔄" /> Обмен ресурс на ресурс
        </button>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {/* Отдаю */}
        <div className="card space-y-2 p-2.5">
          <h4 className="text-2xs font-semibold uppercase tracking-wider text-content-faint">Отдаю</h4>
          <select
            value={offerResource}
            onChange={(e) => setOfferResource(e.target.value as TradeResourceType)}
            className="w-full px-2 py-1.5 text-sm"
          >
            <option value="">Ресурс из сейфа...</option>
            {sellable.map((resource) => (
              <option key={resource} value={resource}>
                {RESOURCE_NAMES[resource]} ({formatAmount(vaultBalances[resource]?.available ?? '0')})
              </option>
            ))}
          </select>
          <div className="flex gap-1.5">
            <input
              type="text"
              inputMode="decimal"
              value={offerAmount}
              onChange={(e) => setOfferAmount(e.target.value)}
              placeholder="Количество"
              className="w-full min-w-0 px-2 py-1.5 text-sm"
            />
            <button
              type="button"
              className="btn btn-ghost btn-xs shrink-0"
              disabled={!offerResource}
              onClick={() => setOfferAmount(available)}
            >
              Всё
            </button>
          </div>
          {offerResource && (
            <p className="text-3xs text-content-faint">
              Свободно в сейфе: {formatAmount(available)}
            </p>
          )}
          {parsedOffer && 'error' in parsedOffer && (
            <p className="text-3xs text-danger">{parsedOffer.error}</p>
          )}
          {tooMuch && <p className="text-3xs text-danger">Больше, чем свободно в сейфе.</p>}
        </div>

        {/* Хочу */}
        <div className="card space-y-2 p-2.5">
          <h4 className="text-2xs font-semibold uppercase tracking-wider text-content-faint">Хочу получить</h4>
          {kind === 'sale' ? (
            <>
              <input
                type="text"
                inputMode="decimal"
                value={wantCredits}
                onChange={(e) => setWantCredits(e.target.value)}
                placeholder="Цена в кредитах"
                className="w-full px-2 py-1.5 text-sm"
              />
              <p className="text-3xs text-content-faint">
                Покупатель заплатит ровно эту сумму; комиссию биржи платите вы, из полученных
                кредитов.
              </p>
            </>
          ) : (
            <>
              <select
                value={wantResource}
                onChange={(e) => setWantResource(e.target.value as TradeResourceType)}
                className="w-full px-2 py-1.5 text-sm"
              >
                <option value="">Ресурс...</option>
                {TRADEABLE_RESOURCES.filter((r) => r !== offerResource).map((resource) => (
                  <option key={resource} value={resource}>
                    {RESOURCE_NAMES[resource]}
                  </option>
                ))}
              </select>
              <input
                type="text"
                inputMode="decimal"
                value={wantAmount}
                onChange={(e) => setWantAmount(e.target.value)}
                placeholder="Количество"
                className="w-full px-2 py-1.5 text-sm"
              />
              <p className="text-3xs text-content-faint">Барт комиссией не облагается.</p>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-2xs font-medium uppercase tracking-wider text-content-faint">Кому</span>
          <select
            value={buyerId}
            onChange={(e) => setBuyerId(e.target.value)}
            className="w-full px-2 py-1.5 text-sm"
          >
            <option value="">Публично — любому игроку</option>
            {recipients.map((trader) => (
              <option key={trader.playerId} value={trader.playerId}>
                {displayPlayerName(trader.playerName, trader.playerId)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-2xs font-medium uppercase tracking-wider text-content-faint">Срок</span>
          <select
            value={durationHours}
            onChange={(e) => setDurationHours(Number(e.target.value))}
            className="w-full px-2 py-1.5 text-sm"
          >
            {DURATIONS.map((d) => (
              <option key={d.hours} value={d.hours}>
                <IconText>{d.label}</IconText>
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-2xs font-medium uppercase tracking-wider text-content-faint">
          Сообщение (необязательно)
        </span>
        <textarea
          value={message}
          maxLength={500}
          rows={2}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Например: обменяю на титан по курсу 1:3"
          className="w-full resize-none px-2 py-1.5 text-sm"
        />
      </label>

      {error && <Alert tone="danger">{error}</Alert>}

      <div className="flex items-center justify-between gap-2">
        <p className="text-3xs text-content-faint">
          Товар уйдёт в эскроу сейфа сразу и вернётся при отмене или истечении срока. Свободных
          кредитов в сейфе: {formatAmount(vaultCredits.available)}.
        </p>
        <button
          type="button"
          className="btn btn-primary btn-xs shrink-0"
          onClick={submit}
          disabled={offersLoading || !offerResource || !offerAmount || !!tooMuch}
        >
          {offersLoading ? '...' : 'Создать предложение'}
        </button>
      </div>
    </div>
  );
}
