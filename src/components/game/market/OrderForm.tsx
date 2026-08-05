/**
 * Форма создания ордера.
 *
 * Главное отличие от прежней версии: торговать можно только тем, что лежит в
 * СЕЙФЕ БИРЖИ. Поэтому форма показывает покрытие и не даёт отправить ордер,
 * который сервер всё равно отклонит — раньше игрок узнавал об этом только по
 * красной ошибке после нажатия кнопки и не понимал, при чём тут сейф.
 */

import { useEffect, useMemo } from 'react';
import { useMarketStore } from '../../../features/marketStore';
import { orderEscrowRequirement, formatAmount, formatExactAmount } from '../../../features/marketEscrow';
import { D } from '../../../core/math/format';
import { Alert, Field } from '../../ui';
import { RESOURCE_NAMES, TRADEABLE_RESOURCES } from './resourceLabels';
import type { TradeResourceType } from '../../../core/gameTypes.market';
import { MARKET_CONSTANTS } from '../../../core/gameTypes.market';
import { GameIcon, IconText } from '../../ui/icons';

const EMPTY_ROW = { available: '0', locked: '0' };

export function OrderForm() {
  // Узкие селекторы: форма перерисовывается только на своих полях, а не на
  // каждой загрузке книги ордеров, истории и лидерборда.
  const orderFormType = useMarketStore((s) => s.orderFormType);
  const orderFormResource = useMarketStore((s) => s.orderFormResource);
  const orderFormQuantity = useMarketStore((s) => s.orderFormQuantity);
  const orderFormPrice = useMarketStore((s) => s.orderFormPrice);
  const setOrderFormType = useMarketStore((s) => s.setOrderFormType);
  const setOrderFormResource = useMarketStore((s) => s.setOrderFormResource);
  const setOrderFormQuantity = useMarketStore((s) => s.setOrderFormQuantity);
  const setOrderFormPrice = useMarketStore((s) => s.setOrderFormPrice);
  const setSelectedResource = useMarketStore((s) => s.setSelectedResource);
  const setActiveTab = useMarketStore((s) => s.setActiveTab);
  const createOrder = useMarketStore((s) => s.createOrder);
  const isLoading = useMarketStore((s) => s.isLoading);

  const myFeePercent = useMarketStore((s) => s.myFeePercent);
  const vaultLoadedAt = useMarketStore((s) => s.vaultLoadedAt);
  const fetchVault = useMarketStore((s) => s.fetchVault);
  const vaultCredits = useMarketStore((s) => s.vaultCredits);
  const vaultResourceRow = useMarketStore((s) =>
    s.orderFormResource ? s.vaultBalances[s.orderFormResource] : undefined,
  );

  useEffect(() => {
    if (vaultLoadedAt === 0) fetchVault();
  }, [vaultLoadedAt, fetchVault]);

  const isSell = orderFormType === 'sell';
  const resourceRow = vaultResourceRow ?? EMPTY_ROW;

  /** Покрытие: что удерживается, сколько нужно и хватает ли. */
  const coverage = useMemo(() => {
    if (!orderFormResource) return null;
    const quantity = D(orderFormQuantity || '0');
    const price = D(orderFormPrice || '0');
    if (quantity.lte(0) || price.lte(0)) return null;

    const requirement = orderEscrowRequirement(
      orderFormType,
      orderFormResource,
      orderFormQuantity || '0',
      orderFormPrice || '0',
      myFeePercent,
    );
    const available = D(isSell ? resourceRow.available : vaultCredits.available);
    const enough = available.gte(requirement.required);
    // Оборот в кредитах одинаков для обеих сторон; отличается только, кто платит
    // комиссию из чего: покупатель добавляет к эскроу, продавец теряет из выручки.
    const turnover = quantity.mul(price);
    const sideFee = isSell ? turnover.mul(D(myFeePercent)).div(100) : requirement.fee;
    return {
      ...requirement,
      available,
      enough,
      shortfall: enough ? D(0) : requirement.required.sub(available),
      turnover,
      sideFee,
      net: turnover.sub(sideFee),
    };
  }, [
    orderFormResource,
    orderFormType,
    orderFormQuantity,
    orderFormPrice,
    myFeePercent,
    isSell,
    resourceRow.available,
    vaultCredits.available,
  ]);

  const belowMinimum =
    orderFormQuantity !== '' && D(orderFormQuantity || '0').lt(MARKET_CONSTANTS.MIN_ORDER_QUANTITY);

  const blocked =
    !orderFormResource ||
    !orderFormQuantity ||
    !orderFormPrice ||
    belowMinimum ||
    coverage?.enough === false;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (blocked) return;
    await createOrder();
  };

  const handleResourceChange = (resource: TradeResourceType | null) => {
    setOrderFormResource(resource);
    if (resource) setSelectedResource(resource);
  };

  return (
    <div className="card space-y-2.5 p-3">
      {/* Тип ордера */}
      <div className="tabs">
        <button
          type="button"
          onClick={() => setOrderFormType('buy')}
          className={`tab ${!isSell ? 'tab-active' : ''}`}
        >
          <GameIcon icon="🛒" /> Купить
        </button>
        <button
          type="button"
          onClick={() => setOrderFormType('sell')}
          className={`tab ${isSell ? 'tab-active' : ''}`}
        >
          <GameIcon icon="💰" /> Продать
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-2.5">
        <Field label="Ресурс">
          <select
            value={orderFormResource || ''}
            onChange={(e) => handleResourceChange((e.target.value as TradeResourceType) || null)}
            className="w-full px-3 py-2 text-sm"
          >
            <option value="">Выберите ресурс...</option>
            {TRADEABLE_RESOURCES.map((resource) => (
              <option key={resource} value={resource}>
                {RESOURCE_NAMES[resource]}
              </option>
            ))}
          </select>
        </Field>

        {/* Покрытие из сейфа: то, чем реально можно торговать */}
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-md border border-edge-subtle bg-surface-3 px-2.5 py-1.5 text-2xs">
          <span className="text-content-faint">
            {isSell ? 'В сейфе (ресурс)' : 'В сейфе (кредиты)'}
          </span>
          <span className="font-mono tabular-nums">
            <span
              className="text-content-primary"
              title={formatExactAmount(isSell ? resourceRow.available : vaultCredits.available)}
            >
              {formatAmount(isSell ? resourceRow.available : vaultCredits.available)}
            </span>
            <span className="text-content-faint">
              {' '}
              · в эскроу {formatAmount(isSell ? resourceRow.locked : vaultCredits.locked)}
            </span>
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Кол-во" hint={`мин. ${MARKET_CONSTANTS.MIN_ORDER_QUANTITY}`}>
            <input
              type="number"
              min={MARKET_CONSTANTS.MIN_ORDER_QUANTITY}
              step="1"
              value={orderFormQuantity}
              onChange={(e) => setOrderFormQuantity(e.target.value)}
              placeholder="100"
              className="w-full px-2 py-1.5 text-sm"
            />
          </Field>
          <Field label="Цена за ед." hint="₡">
            <input
              type="number"
              min="0.000001"
              step="0.01"
              value={orderFormPrice}
              onChange={(e) => setOrderFormPrice(e.target.value)}
              placeholder="1.50"
              className="w-full px-2 py-1.5 text-sm"
            />
          </Field>
        </div>

        {belowMinimum && (
          <p className="text-3xs text-warning">
            Минимальный объём ордера — {MARKET_CONSTANTS.MIN_ORDER_QUANTITY} ед.
          </p>
        )}

        {/* Итог: сколько уйдёт в эскроу и что получится на выходе */}
        {coverage && (
          <div className="space-y-1 rounded-md border border-edge-subtle bg-surface-3 px-2.5 py-2 text-2xs">
            <div className="flex items-center justify-between">
              <span className="text-content-faint">{isSell ? 'Выручка до комиссии' : 'Стоимость'}</span>
              <span className="font-mono tabular-nums text-content-secondary">
                {formatAmount(coverage.turnover)} ₡
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-content-faint">Комиссия {myFeePercent}%</span>
              <span className="font-mono tabular-nums text-content-secondary">
                {isSell ? '−' : '+'}
                {formatAmount(coverage.sideFee)} ₡
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-edge-subtle pt-1">
              <span className="text-content-muted">
                {isSell ? 'Уйдёт в эскроу (ресурс)' : 'Уйдёт в эскроу (кредиты)'}
              </span>
              <span
                className={`font-mono font-semibold tabular-nums ${
                  coverage.enough ? 'text-accent' : 'text-danger'
                }`}
                title={formatExactAmount(coverage.required)}
              >
                {formatAmount(coverage.required)} {isSell ? '' : '₡'}
              </span>
            </div>
            <p className="text-3xs text-content-faint">
              {isSell
                ? `При полном исполнении в сейф придёт ≈ ${formatAmount(coverage.net)} ₡ (комиссия из выручки).`
                : 'Исполнение по цене лучше вашей — разница вернётся из эскроу.'}
            </p>
          </div>
        )}

        {coverage && !coverage.enough && (
          <Alert tone="danger" title="В сейфе биржи не хватает средств">
            Не хватает {formatAmount(coverage.shortfall)}{' '}
            {isSell ? RESOURCE_NAMES[orderFormResource as TradeResourceType] : '₡'}. Биржа торгует
            только тем, что внесено в сейф.{' '}
            <button
              type="button"
              className="underline underline-offset-2 hover:text-accent"
              onClick={() => setActiveTab('vault')}
            >
              Открыть «Кошелёк биржи»
            </button>
          </Alert>
        )}

        <button
          type="submit"
          disabled={isLoading || blocked}
          className={`btn btn-block ${isSell ? 'btn-danger' : 'btn-primary'}`}
        >
          <IconText>{isLoading ? 'Отправка...' : isSell ? '💰 Выставить продажу' : '🛒 Выставить покупку'}</IconText>
        </button>
      </form>
    </div>
  );
}

// Реэкспорт для панелей, которые исторически брали словарь из формы.
export { RESOURCE_NAMES, TRADEABLE_RESOURCES };
