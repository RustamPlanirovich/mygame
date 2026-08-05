/**
 * КОШЕЛЁК БИРЖИ (сейф).
 *
 * Единственная дверь между игровым состоянием и биржей. Всё, что внутри сейфа,
 * сервер считает сам и умеет доказать журналом; всё, что снаружи, живёт у
 * клиента. Поэтому здесь ровно две операции — «внести» и «вывести», — и обе
 * обязаны менять И сейф, И игровое состояние. Вся логика порядка и защиты от
 * двойного начисления — в src/features/vaultBridge.ts и marketStore.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, EmptyState, Panel, SkeletonRows, Stat } from '../../ui';
import { useMarketStore } from '../../../features/marketStore';
import { useGameStore } from '../../../features/gameStore';
import { formatAmount, formatExactAmount } from '../../../features/marketEscrow';
import { floorToDepositable, parseAmountInput } from '../../../features/vaultBridge';
import { D } from '../../../core/math/format';
import { VAULT_CREDITS, MARKET_CONSTANTS } from '../../../core/gameTypes.market';
import type { VaultResource, TradeResourceType } from '../../../core/gameTypes.market';
import { RESOURCE_NAMES, TRADEABLE_RESOURCES, vaultResourceName } from './resourceLabels';
import { GameIcon, IconText } from '../../ui/icons';

/** Как часто пересчитывать «сколько у игрока в игре». */
const HELD_REFRESH_MS = 2000;

/** Как часто перечитывать сейф, пока вкладка открыта. */
const VAULT_POLL_MS = 20_000;

/** Русские подписи причин из market_vault_ledger. */
const LEDGER_REASONS: Record<string, string> = {
  deposit: 'Пополнение сейфа',
  withdraw: 'Вывод из сейфа',
  escrow_lock: 'Эскроу под ордер',
  escrow_release: 'Возврат эскроу',
  escrow_price_improvement: 'Возврат за лучшую цену',
  trade_buy_resource: 'Покупка: получен ресурс',
  trade_buy_credits: 'Покупка: списаны кредиты',
  trade_sell_resource: 'Продажа: отдан ресурс',
  trade_sell_credits: 'Продажа: получены кредиты',
  trade_fee: 'Комиссия биржи',
  offer_escrow_lock: 'Эскроу под предложение',
  offer_escrow_release: 'Возврат эскроу предложения',
  offer_give_resource: 'Сделка: отдан ресурс',
  offer_take_resource: 'Сделка: получен ресурс',
  offer_pay_credits: 'Сделка: оплачено кредитами',
  offer_recv_credits: 'Сделка: получены кредиты',
  offer_pay_resource: 'Обмен: отдан ресурс',
  offer_recv_resource: 'Обмен: получен ресурс',
  offer_fee: 'Комиссия по сделке',
};

/**
 * Сколько игрок держит В ИГРЕ. Читается императивно и по таймеру: подписка на
 * grid.buffers.base перерисовывала бы панель на каждом тике игрового цикла.
 */
function useHeldAmounts(): Record<string, string> {
  const [snapshot, setSnapshot] = useState<Record<string, string>>({});

  const read = useCallback(() => {
    const state = useGameStore.getState();
    const base = state.grid?.buffers?.base ?? {};
    const next: Record<string, string> = {
      [VAULT_CREDITS]: D(state.currency.credits).toString(),
    };
    for (const resource of TRADEABLE_RESOURCES) {
      const raw = base[resource];
      if (raw != null && D(raw).gt(0)) next[resource] = String(raw);
    }
    // Новый объект отдаём только при реальном изменении: иначе панель
    // перерисовывалась бы каждые 2 секунды просто по таймеру.
    setSnapshot((prev) => {
      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(next);
      if (prevKeys.length === nextKeys.length && nextKeys.every((k) => prev[k] === next[k])) {
        return prev;
      }
      return next;
    });
  }, []);

  useEffect(() => {
    read();
    const timer = setInterval(read, HELD_REFRESH_MS);
    return () => clearInterval(timer);
  }, [read]);

  return snapshot;
}

export function VaultPanel() {
  const vaultCredits = useMarketStore((s) => s.vaultCredits);
  const vaultBalances = useMarketStore((s) => s.vaultBalances);
  const vaultLoading = useMarketStore((s) => s.vaultLoading);
  const vaultError = useMarketStore((s) => s.vaultError);
  const vaultBusy = useMarketStore((s) => s.vaultBusy);
  const vaultLedger = useMarketStore((s) => s.vaultLedger);
  const vaultLoadedAt = useMarketStore((s) => s.vaultLoadedAt);
  const pendingWithdrawals = useMarketStore((s) => s.pendingWithdrawals);
  const withdrawalsLoading = useMarketStore((s) => s.withdrawalsLoading);

  const fetchVault = useMarketStore((s) => s.fetchVault);
  const fetchVaultLedger = useMarketStore((s) => s.fetchVaultLedger);
  const fetchPendingWithdrawals = useMarketStore((s) => s.fetchPendingWithdrawals);
  const settlePendingWithdrawals = useMarketStore((s) => s.settlePendingWithdrawals);
  const depositToVault = useMarketStore((s) => s.depositToVault);
  const withdrawFromVault = useMarketStore((s) => s.withdrawFromVault);

  const held = useHeldAmounts();

  const [depositResource, setDepositResource] = useState<VaultResource>(VAULT_CREDITS);
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawResource, setWithdrawResource] = useState<VaultResource>(VAULT_CREDITS);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [depositNote, setDepositNote] = useState<{ tone: 'accent' | 'danger' | 'warning'; text: string } | null>(null);
  const [withdrawNote, setWithdrawNote] = useState<{ tone: 'accent' | 'danger' | 'warning'; text: string } | null>(null);
  const [showLedger, setShowLedger] = useState(false);

  useEffect(() => {
    fetchVault();
    fetchPendingWithdrawals();
    /*
     * Пока вкладка открыта — периодическое обновление. Сейф меняют не только
     * действия игрока: исполнение его ордера чужим ордером зачисляет выручку
     * прямо в сейф, и без опроса игрок увидел бы это только по кнопке.
     * Незавершённые выводы опрашивает useMarketTransactions (каждые 10 с).
     */
    const timer = setInterval(fetchVault, VAULT_POLL_MS);
    return () => clearInterval(timer);
  }, [fetchVault, fetchPendingWithdrawals]);

  useEffect(() => {
    if (showLedger) fetchVaultLedger();
  }, [showLedger, fetchVaultLedger]);

  /** Что можно внести: кредиты + только реально имеющиеся ресурсы. */
  const depositOptions = useMemo(() => {
    const options: VaultResource[] = [VAULT_CREDITS];
    for (const resource of TRADEABLE_RESOURCES) {
      if (held[resource]) options.push(resource);
    }
    return options;
  }, [held]);

  /** Что можно вывести: всё, где в сейфе есть свободный остаток. */
  const withdrawOptions = useMemo(() => {
    const options: VaultResource[] = [];
    if (D(vaultCredits.available).gt(0)) options.push(VAULT_CREDITS);
    for (const resource of TRADEABLE_RESOURCES) {
      const row = vaultBalances[resource];
      if (row && D(row.available).gt(0)) options.push(resource);
    }
    return options;
  }, [vaultCredits.available, vaultBalances]);

  const rows = useMemo(() => {
    const list = Object.values(vaultBalances).filter((b) => b.resource !== VAULT_CREDITS);
    return list.sort((a, b) => vaultResourceName(a.resource).localeCompare(vaultResourceName(b.resource), 'ru'));
  }, [vaultBalances]);

  /*
   * Выбранный ресурс мог пропасть из списка (внесли всё до нуля / вывели весь
   * остаток). Без сброса в select остаётся значение, которого в нём больше нет:
   * визуально выбран первый пункт, а отправится прежний — и игрок получает
   * необъяснимую ошибку.
   */
  useEffect(() => {
    if (!depositOptions.includes(depositResource)) setDepositResource(VAULT_CREDITS);
  }, [depositOptions, depositResource]);

  useEffect(() => {
    if (withdrawOptions.length > 0 && !withdrawOptions.includes(withdrawResource)) {
      setWithdrawResource(withdrawOptions[0]);
    }
  }, [withdrawOptions, withdrawResource]);

  const heldForDeposit = held[depositResource] ?? '0';
  const availableForWithdraw =
    withdrawResource === VAULT_CREDITS
      ? vaultCredits.available
      : vaultBalances[withdrawResource]?.available ?? '0';

  const depositPreview = depositAmount ? parseAmountInput(depositAmount) : null;
  const withdrawPreview = withdrawAmount ? parseAmountInput(withdrawAmount) : null;

  const depositTooMuch =
    depositPreview && 'amount' in depositPreview && D(depositPreview.amount).gt(D(heldForDeposit));
  const withdrawTooMuch =
    withdrawPreview && 'amount' in withdrawPreview && D(withdrawPreview.amount).gt(D(availableForWithdraw));

  const handleDeposit = async () => {
    setDepositNote(null);
    const result = await depositToVault(depositResource, depositAmount);
    if (result.ok) {
      setDepositAmount('');
      setDepositNote({
        tone: result.warning ? 'warning' : 'accent',
        text: result.warning ?? `Внесено в сейф: ${vaultResourceName(depositResource)}.`,
      });
    } else {
      setDepositNote({ tone: 'danger', text: result.message ?? 'Не удалось пополнить сейф.' });
    }
  };

  const handleWithdraw = async () => {
    setWithdrawNote(null);
    const result = await withdrawFromVault(withdrawResource, withdrawAmount);
    if (result.ok) {
      setWithdrawAmount('');
      setWithdrawNote({
        tone: result.warning ? 'warning' : 'accent',
        text: result.warning ?? `Начислено в игру: ${vaultResourceName(withdrawResource)}.`,
      });
    } else {
      setWithdrawNote({ tone: 'danger', text: result.message ?? 'Не удалось вывести из сейфа.' });
    }
  };

  const handleSettlePending = async () => {
    const settled = await settlePendingWithdrawals();
    setWithdrawNote(
      settled > 0
        ? { tone: 'accent', text: `Дочислено выводов: ${settled}.` }
        : { tone: 'warning', text: 'Ничего дочислить не удалось — попробуйте ещё раз.' },
    );
  };

  return (
    <div className="space-y-2">
      <Panel
        title="Кошелёк биржи"
        subtitle="Биржа торгует только тем, что лежит в сейфе"
        icon={<span><GameIcon icon="🔐" /></span>}
        actions={
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={() => {
              fetchVault();
              fetchPendingWithdrawals();
              if (showLedger) fetchVaultLedger();
            }}
            disabled={vaultLoading}
          >
            {vaultLoading ? '...' : 'Обновить'}
          </button>
        }
        bodyClassName="space-y-3"
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat
            label="Кредиты свободно"
            value={`${formatAmount(vaultCredits.available)} ₡`}
            hint={formatExactAmount(vaultCredits.available)}
            tone="accent"
          />
          <Stat
            label="Кредиты в эскроу"
            value={`${formatAmount(vaultCredits.locked)} ₡`}
            hint="Держат ваши ордера"
            tone="warning"
          />
          <Stat label="Ресурсов в сейфе" value={String(rows.length)} hint="видов" />
          <Stat
            label="Незавершённых выводов"
            value={String(pendingWithdrawals.length)}
            tone={pendingWithdrawals.length > 0 ? 'danger' : 'neutral'}
          />
        </div>

        {vaultError && <Alert tone="danger" title="Сейф недоступен">{vaultError}</Alert>}

        {pendingWithdrawals.length > 0 && (
          <Alert tone="warning" title="Есть незавершённые выводы">
            <p>
              Сервер уже списал это из сейфа, но в игру начисление ещё не закрыто. Ничего не
              потеряно — нажмите «Забрать», и всё дочислится.
            </p>
            <ul className="mt-1 space-y-0.5 font-mono text-3xs tabular-nums">
              {pendingWithdrawals.map((w) => (
                <li key={w.id}>
                  {vaultResourceName(w.resource)}: {formatAmount(w.amount)}
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="btn btn-primary btn-xs mt-2"
              onClick={handleSettlePending}
              disabled={withdrawalsLoading || vaultBusy}
            >
              Забрать
            </button>
          </Alert>
        )}

        {/* ---------- Формы ---------- */}
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {/* ВНЕСТИ */}
          <div className="card space-y-2 p-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-content-secondary">
                Внести в сейф
              </h4>
              <span className="text-3xs text-content-faint">списывается из игры</span>
            </div>

            <select
              value={depositResource}
              onChange={(e) => {
                setDepositResource(e.target.value as VaultResource);
                setDepositAmount('');
                setDepositNote(null);
              }}
              className="w-full px-2 py-1.5 text-sm"
            >
              {depositOptions.map((resource) => (
                <option key={resource} value={resource}>
                  {vaultResourceName(resource)}
                </option>
              ))}
            </select>

            <div className="flex items-center justify-between text-2xs">
              <span className="text-content-faint">В игре</span>
              <span className="font-mono tabular-nums text-content-secondary" title={formatExactAmount(heldForDeposit)}>
                {formatAmount(heldForDeposit)}
              </span>
            </div>

            <div className="flex gap-1.5">
              <input
                type="text"
                inputMode="decimal"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="Сколько внести"
                className="w-full min-w-0 px-2 py-1.5 text-sm"
              />
              <button
                type="button"
                className="btn btn-ghost btn-xs shrink-0"
                onClick={() => setDepositAmount(floorToDepositable(D(heldForDeposit)))}
              >
                Всё
              </button>
            </div>

            {depositPreview && 'error' in depositPreview && (
              <p className="text-3xs text-danger">{depositPreview.error}</p>
            )}
            {depositTooMuch && (
              <p className="text-3xs text-danger">
                В игре только {formatAmount(heldForDeposit)} — больше внести нельзя.
              </p>
            )}

            <button
              type="button"
              className="btn btn-primary btn-block btn-xs"
              onClick={handleDeposit}
              disabled={
                vaultBusy ||
                !depositAmount ||
                !depositPreview ||
                'error' in depositPreview ||
                !!depositTooMuch
              }
            >
              {vaultBusy ? '...' : 'Внести'}
            </button>

            {depositNote && (
              <Alert tone={depositNote.tone} onDismiss={() => setDepositNote(null)}>
                <IconText>{depositNote.text}</IconText>
              </Alert>
            )}
          </div>

          {/* ВЫВЕСТИ */}
          <div className="card space-y-2 p-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-content-secondary">
                Вывести из сейфа
              </h4>
              <span className="text-3xs text-content-faint">начисляется в игру</span>
            </div>

            {withdrawOptions.length === 0 ? (
              <p className="py-2 text-2xs text-content-faint">
                Свободных средств в сейфе нет. Всё либо в эскроу под ордерами, либо ещё не внесено.
              </p>
            ) : (
              <>
                <select
                  value={withdrawResource}
                  onChange={(e) => {
                    setWithdrawResource(e.target.value as VaultResource);
                    setWithdrawAmount('');
                    setWithdrawNote(null);
                  }}
                  className="w-full px-2 py-1.5 text-sm"
                >
                  {withdrawOptions.map((resource) => (
                    <option key={resource} value={resource}>
                      {vaultResourceName(resource)}
                    </option>
                  ))}
                </select>

                <div className="flex items-center justify-between text-2xs">
                  <span className="text-content-faint">Свободно в сейфе</span>
                  <span
                    className="font-mono tabular-nums text-content-secondary"
                    title={formatExactAmount(availableForWithdraw)}
                  >
                    {formatAmount(availableForWithdraw)}
                  </span>
                </div>

                <div className="flex gap-1.5">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder="Сколько вывести"
                    className="w-full min-w-0 px-2 py-1.5 text-sm"
                  />
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs shrink-0"
                    onClick={() => setWithdrawAmount(floorToDepositable(D(availableForWithdraw)))}
                  >
                    Всё
                  </button>
                </div>

                {withdrawPreview && 'error' in withdrawPreview && (
                  <p className="text-3xs text-danger">{withdrawPreview.error}</p>
                )}
                {withdrawTooMuch && (
                  <p className="text-3xs text-danger">
                    Свободно только {formatAmount(availableForWithdraw)}.
                  </p>
                )}

                <button
                  type="button"
                  className="btn btn-info btn-block btn-xs"
                  onClick={handleWithdraw}
                  disabled={
                    vaultBusy ||
                    !withdrawAmount ||
                    !withdrawPreview ||
                    'error' in withdrawPreview ||
                    !!withdrawTooMuch
                  }
                >
                  {vaultBusy ? '...' : 'Вывести'}
                </button>
              </>
            )}

            {withdrawNote && (
              <Alert tone={withdrawNote.tone} onDismiss={() => setWithdrawNote(null)}>
                <IconText>{withdrawNote.text}</IconText>
              </Alert>
            )}
          </div>
        </div>

        <p className="text-3xs leading-relaxed text-content-faint">
          Пополнение сервер принимает на слово: ресурс сначала списывается у вас и только потом
          зачисляется в сейф. За одну операцию — не больше {MARKET_CONSTANTS.VAULT_MAX_OPERATION.toExponential(0)} и
          не больше {MARKET_CONSTANTS.VAULT_MAX_DECIMALS} знаков после запятой.
        </p>
      </Panel>

      {/* ---------- Балансы ---------- */}
      <Panel title="Балансы сейфа" icon={<span><GameIcon icon="📦" /></span>} bodyClassName="p-0">
        {vaultLoading && vaultLoadedAt === 0 ? (
          <div className="p-3">
            <SkeletonRows rows={4} />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-3">
            <EmptyState
              title="В сейфе пока нет ресурсов"
              hint="Внесите ресурс выше — и он появится в книге ордеров как доступный к продаже."
            />
          </div>
        ) : (
          <div className="max-h-72 overflow-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ресурс</th>
                  <th className="text-right">Свободно</th>
                  <th className="text-right">В эскроу</th>
                  <th className="text-right">Всего</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.resource}>
                    <td className="text-content-secondary">
                      {RESOURCE_NAMES[row.resource as TradeResourceType] ?? row.resource}
                    </td>
                    <td className="text-right font-mono tabular-nums text-accent" title={formatExactAmount(row.available)}>
                      {formatAmount(row.available)}
                    </td>
                    <td className="text-right font-mono tabular-nums text-warning">
                      {formatAmount(row.locked)}
                    </td>
                    <td className="text-right font-mono tabular-nums text-content-secondary">
                      {formatAmount(row.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* ---------- Журнал ---------- */}
      <Panel
        title="Журнал сейфа"
        subtitle="Каждое движение с причиной — по нему сходится баланс"
        icon={<span><GameIcon icon="🧾" /></span>}
        actions={
          <button type="button" className="btn btn-ghost btn-xs" onClick={() => setShowLedger((v) => !v)}>
            {showLedger ? 'Скрыть' : 'Показать'}
          </button>
        }
        bodyClassName={showLedger ? 'p-0' : 'p-3'}
      >
        {!showLedger ? (
          <p className="text-2xs text-content-faint">
            Последние операции с сейфом: пополнения, эскроу, исполнения, комиссии.
          </p>
        ) : vaultLedger.length === 0 ? (
          <div className="p-3">
            <EmptyState title="Журнал пуст" hint="Здесь появятся все движения по вашему сейфу." />
          </div>
        ) : (
          <div className="max-h-72 overflow-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Когда</th>
                  <th>Операция</th>
                  <th>Ресурс</th>
                  <th className="text-right">Изменение</th>
                  <th className="text-right">Итог</th>
                </tr>
              </thead>
              <tbody>
                {vaultLedger.map((entry) => {
                  const delta = D(entry.delta);
                  const zero = delta.eq(0);
                  return (
                    <tr key={entry.id}>
                      <td className="whitespace-nowrap text-content-faint">
                        {new Date(entry.createdAt).toLocaleString('ru-RU', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="text-content-secondary">
                        {LEDGER_REASONS[entry.reason] ?? entry.reason}
                      </td>
                      <td className="text-content-muted">{vaultResourceName(entry.resource)}</td>
                      <td
                        className={`text-right font-mono tabular-nums ${
                          zero ? 'text-content-faint' : delta.gt(0) ? 'text-accent' : 'text-danger'
                        }`}
                      >
                        {zero ? '—' : `${delta.gt(0) ? '+' : '−'}${formatAmount(delta.abs())}`}
                      </td>
                      <td className="text-right font-mono tabular-nums text-content-muted">
                        {formatAmount(entry.balanceAfter)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
