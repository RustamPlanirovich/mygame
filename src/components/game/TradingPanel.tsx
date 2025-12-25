import { useState } from 'react';
import { useGameStore } from '../../features/gameStore';
import { D, formatNumber } from '../../core/math/format';
import type { TradeResourceType } from '../../core/gameTypes';
import { TRADE_LABEL } from '../../core/constants/labels';
import { TrendingUp, TrendingDown, X, Clock } from 'lucide-react';

export function TradingPanel() {
  const market = useGameStore((s) => s.market);
  const currency = useGameStore((s) => s.currency);
  const resources = useGameStore((s) => s.resources);
  const placeTradingOrder = useGameStore((s) => s.placeTradingOrder);
  const cancelTradingOrder = useGameStore((s) => s.cancelTradingOrder);

  const [selected, setSelected] = useState<TradeResourceType>('ore');
  const [orderType, setOrderType] = useState<'buy' | 'sell'>('buy');
  const [targetPrice, setTargetPrice] = useState<string>('');
  const [amount, setAmount] = useState<string>('10');

  const orders = market.orders ?? [];
  const currentPrice = market.prices[selected];
  const eventMult = market.event?.multiplier ?? 1.0;
  const effectivePrice = currentPrice.mul(D(eventMult));

  const targetPriceDec = targetPrice ? D(targetPrice) : D(0);
  const amountDec = amount ? D(amount) : D(0);

  const collateral = orderType === 'buy' 
    ? targetPriceDec.mul(amountDec).mul(D(1.3)) // +30% markup
    : amountDec;

  const canPlace = orderType === 'buy'
    ? currency.credits.gte(collateral) && targetPriceDec.gt(0) && amountDec.gt(0)
    : resources[selected].amount.gte(collateral) && targetPriceDec.gt(0) && amountDec.gt(0);

  const getTimeLeft = (expiresAt: number) => {
    const ms = Math.max(0, expiresAt - Date.now());
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    return minutes > 0 ? `${minutes}м` : `${seconds}с`;
  };

  const handlePlace = () => {
    if (!canPlace) return;
    placeTradingOrder(selected, orderType, targetPriceDec, amountDec);
    setTargetPrice('');
    setAmount('10');
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="w-5 h-5 text-cyber-blue" />
        <h3 className="text-lg font-semibold text-cyber-blue">Биржа</h3>
      </div>

      {/* Resource Selection */}
      <div className="cyber-panel">
        <div className="text-xs text-cyber-text-dim mb-2">📦 Ресурс</div>
        <div className="grid grid-cols-4 gap-2">
          {(['ore', 'ice', 'carbon', 'steel'] as TradeResourceType[]).map((r) => (
            <button
              key={r}
              className={`px-2 py-2 rounded-lg border text-xs transition-all ${
                r === selected
                  ? 'bg-cyber-blue/10 border-cyber-blue text-cyber-blue'
                  : 'border-cyber-gray/40 hover:border-cyber-blue/60 text-cyber-text'
              }`}
              onClick={() => setSelected(r)}
            >
              {TRADE_LABEL[r]}
            </button>
          ))}
        </div>
        <div className="mt-2 text-xs text-cyber-text-dim">
          Текущая цена: <span className="text-cyber-text font-mono">{formatNumber(effectivePrice)} ₡</span>
        </div>
      </div>

      {/* Order Type */}
      <div className="cyber-panel">
        <div className="text-xs text-cyber-text-dim mb-2">Тип ордера</div>
        <div className="grid grid-cols-2 gap-2">
          <button
            className={`py-2 rounded-lg border text-sm font-semibold transition-all ${
              orderType === 'buy'
                ? 'bg-green-500/20 border-green-500 text-green-400'
                : 'border-cyber-gray/40 hover:border-green-500/60 text-cyber-text'
            }`}
            onClick={() => setOrderType('buy')}
          >
            <TrendingUp className="w-4 h-4 inline mr-1" />
            КУПИТЬ
          </button>
          <button
            className={`py-2 rounded-lg border text-sm font-semibold transition-all ${
              orderType === 'sell'
                ? 'bg-red-500/20 border-red-500 text-red-400'
                : 'border-cyber-gray/40 hover:border-red-500/60 text-cyber-text'
            }`}
            onClick={() => setOrderType('sell')}
          >
            <TrendingDown className="w-4 h-4 inline mr-1" />
            ПРОДАТЬ
          </button>
        </div>
      </div>

      {/* Target Price & Amount */}
      <div className="cyber-panel space-y-3">
        <div>
          <div className="text-xs text-cyber-text-dim mb-1">Целевая цена (₡)</div>
          <input
            type="number"
            value={targetPrice}
            onChange={(e) => setTargetPrice(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-cyber-dark/60 border border-cyber-gray/60 text-gray-200 text-center font-mono focus:border-cyber-blue focus:outline-none"
            placeholder={effectivePrice.toString()}
          />
        </div>
        <div>
          <div className="text-xs text-cyber-text-dim mb-1">Количество</div>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-cyber-dark/60 border border-cyber-gray/60 text-gray-200 text-center font-mono focus:border-cyber-blue focus:outline-none"
            placeholder="10"
          />
        </div>
        
        {targetPriceDec.gt(0) && amountDec.gt(0) && (
          <div className="text-xs text-cyber-text-dim">
            Залог: <span className={`font-mono ${canPlace ? 'text-green-400' : 'text-red-400'}`}>
              {formatNumber(collateral)} {orderType === 'buy' ? '₡' : TRADE_LABEL[selected]}
            </span>
          </div>
        )}
      </div>

      {/* Place Order Button */}
      <button
        onClick={handlePlace}
        disabled={!canPlace}
        className={`w-full py-3 rounded-lg font-semibold transition-all ${
          canPlace
            ? orderType === 'buy'
              ? 'bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/20'
              : 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20'
            : 'bg-cyber-gray/20 text-cyber-gray-light cursor-not-allowed'
        }`}
      >
        РАЗМЕСТИТЬ ОРДЕР
      </button>

      {/* Active Orders */}
      <div className="cyber-panel">
        <div className="text-xs text-cyber-text-dim mb-2">
          Активные ордера ({orders.length})
        </div>
        {orders.length === 0 ? (
          <div className="text-xs text-center text-cyber-text-dim py-4">
            Нет активных ордеров
          </div>
        ) : (
          <div className="space-y-2">
            {orders.map((order) => (
              <div
                key={order.id}
                className={`cyber-panel border-l-2 ${
                  order.type === 'buy' ? 'border-green-500' : 'border-red-500'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {order.type === 'buy' ? (
                        <TrendingUp className="w-3 h-3 text-green-400" />
                      ) : (
                        <TrendingDown className="w-3 h-3 text-red-400" />
                      )}
                      <span className="text-xs font-semibold text-white">
                        {TRADE_LABEL[order.resource]}
                      </span>
                      <span className="text-xs text-cyber-text-dim flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {getTimeLeft(order.expiresAt)}
                      </span>
                    </div>
                    <div className="text-xs text-cyber-text-dim space-y-0.5">
                      <div>Цель: {formatNumber(order.targetPrice)} ₡</div>
                      <div>Кол-во: {formatNumber(order.amount)}</div>
                      <div>
                        Залог: {formatNumber(order.collateral)}{' '}
                        {order.type === 'buy' ? '₡' : TRADE_LABEL[order.resource]}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => cancelTradingOrder(order.id)}
                    className="p-1 rounded hover:bg-red-500/20 text-red-400 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="text-xs text-cyber-text-dim bg-cyber-dark/30 rounded-lg p-3">
        <div className="font-semibold text-cyber-text mb-1">💡 Как работает биржа:</div>
        <ul className="space-y-1 list-disc list-inside">
          <li>Разместите ордер на покупку/продажу по целевой цене</li>
          <li>Ордер исполнится когда цена достигнет целевой</li>
          <li>Ресурсы/кредиты блокируются как залог</li>
          <li>Ордер истекает через 5 минут если не исполнен</li>
        </ul>
      </div>
    </div>
  );
}
