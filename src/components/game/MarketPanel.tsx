import { useEffect, useMemo, useState } from 'react';
import { useGameStore } from '../../features/gameStore';
import { D, formatNumber } from '../../core/math/format.ts';
import type { TradeResourceType } from '../../core/gameTypes';
import { TRADE_LABEL } from '../../core/constants/labels';
import { computeTradeMultiplier } from '../../core/constants/progression';
import { ArrowLeftRight } from 'lucide-react';

const TRADEABLE: TradeResourceType[] = ['ore', 'ice', 'carbon', 'steel'];

function PriceChart({ points }: { points: Array<{ t: number; price: string }> }) {
  const samples = useMemo(() => {
    const s = points
      .map((p) => ({ t: p.t, v: Number(p.price) }))
      .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.v));
    return s;
  }, [points]);

  if (samples.length < 2) {
    return <div className="text-xs text-cyber-gray-light">Недостаточно данных для графика.</div>;
  }

  const min = Math.min(...samples.map((p) => p.v));
  const max = Math.max(...samples.map((p) => p.v));
  const span = max - min || 1;

  const pts = samples
    .map((p, idx) => {
      const x = (idx / (samples.length - 1)) * 100;
      const y = 100 - ((p.v - min) / span) * 100;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  const last = samples[samples.length - 1];
  const lastX = 100;
  const lastY = 100 - ((last.v - min) / span) * 100;

  return (
    <svg viewBox="0 0 100 100" className="w-full h-20">
      <rect x={0} y={0} width={100} height={100} fill="transparent" className="text-cyber-gray" stroke="currentColor" opacity={0.25} />
      {[25, 50, 75].map((y) => (
        <line key={y} x1={0} y1={y} x2={100} y2={y} stroke="currentColor" opacity={0.12} className="text-cyber-gray" />
      ))}
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth={2} className="text-cyber-green" />
      <circle cx={lastX} cy={lastY} r={2.2} fill="currentColor" className="text-cyber-green" opacity={0.95} />
    </svg>
  );
}

export function MarketPanel() {
  const market = useGameStore((s) => s.market);
  const resources = useGameStore((s) => s.resources);
  const sellResource = useGameStore((s) => s.sellResource);
  const buyResource = useGameStore((s) => s.buyResource);
  const levels = useGameStore((s) => s.research.levels);

  const [selected, setSelected] = useState<TradeResourceType>('ore');
  const [qty, setQty] = useState<string>('10');
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const tradeMult = useMemo(() => computeTradeMultiplier(levels), [levels]);

  const secondsLeft = useMemo(() => {
    const ms = Math.max(0, market.nextUpdateAt - now);
    return Math.ceil(ms / 1000);
  }, [market.nextUpdateAt, now]);

  const price = market.prices[selected];
  const sellUnit = price.mul(D(tradeMult));
  const buyUnit = price.div(D(tradeMult)).max(D(0));

  const points = market.history?.[selected] ?? [];
  const chartStats = useMemo(() => {
    const nums = points.map((p) => Number(p.price)).filter((n) => Number.isFinite(n));
    if (nums.length < 2) return null;
    return { min: D(Math.min(...nums)), max: D(Math.max(...nums)) };
  }, [points]);

  const qtyNum = Number(String(qty).replace(',', '.'));
  const qtyDec = Number.isFinite(qtyNum) && qtyNum > 0 ? D(qtyNum) : D(0);

  const have = resources[selected].amount;
  const energy = resources.energy.amount;
  const room = resources[selected].max.sub(have).max(D(0));
  const affordable = buyUnit.gt(0) ? energy.div(buyUnit).max(D(0)) : D(0);
  const maxBuy = room.min(affordable);

  const canBuy = qtyDec.gt(0) && maxBuy.gt(0);
  const canSell = qtyDec.gt(0) && have.gt(0);

  const estBuyCost = buyUnit.mul(qtyDec);
  const estSellGain = sellUnit.mul(qtyDec);

  return (
    <div className="p-4 border-b border-cyber-gray">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-xl text-cyber-green uppercase tracking-wider flex items-center gap-2">
          <ArrowLeftRight size={18} className="text-cyber-green" />
          <span>Терминал</span>
        </h2>
        <div className="text-xs text-cyber-text-dim">
          Обновление через: {secondsLeft}с · Событие: <span className="text-cyber-text">{market.event.name}</span>
          <span className="text-cyber-text-dim"> · Маржа: x{tradeMult.toFixed(2)}</span>
        </div>
      </div>

      <div className="space-y-3">
        {/* Выбор ресурса */}
        <div className="cyber-panel">
          <div className="text-xs text-cyber-text-dim mb-2">📦 Ресурсы</div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {TRADEABLE.map((r) => {
              const isActive = r === selected;
              return (
                <button
                  key={r}
                  className={`flex-shrink-0 px-3 py-2 rounded-lg border transition-all ${
                    isActive 
                      ? 'bg-cyber-blue/10 border-cyber-blue' 
                      : 'border-cyber-gray/40 hover:border-cyber-blue/60'
                  }`}
                  onClick={() => setSelected(r)}
                >
                  <div className={`text-sm font-medium ${isActive ? 'text-cyber-blue' : 'text-cyber-text'}`}>
                    {TRADE_LABEL[r]}
                  </div>
                  <div className="text-xs text-cyber-text-dim font-mono">
                    {formatNumber(resources[r].amount)}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Заголовок и энергия */}
        <div className="flex items-baseline justify-between">
          <div className="text-lg text-cyber-blue font-bold">{TRADE_LABEL[selected]}</div>
          <div className="text-xs text-cyber-text-dim">
            ⚡ {formatNumber(resources.energy.amount)} / {formatNumber(resources.energy.max)}
          </div>
        </div>

        {/* Поле ввода количества */}
        <div className="cyber-panel">
          <input
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            inputMode="decimal"
            className="w-full px-3 py-3 rounded-lg bg-cyber-dark/60 border border-cyber-gray/60 text-gray-200 text-center text-2xl font-mono focus:border-cyber-blue focus:outline-none"
            placeholder="10"
          />
          
          <div className="mt-2 flex flex-wrap gap-2">
            {[1, 10, 100].map((n) => (
              <button 
                key={n} 
                className="cyber-button text-xs py-1.5 px-3 flex-1" 
                onClick={() => setQty(String(n))}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <button
              className="cyber-button text-xs py-1.5 px-3 flex-1"
              onClick={() => setQty(maxBuy.toString())}
              disabled={maxBuy.lte(0)}
            >
              МАКС
            </button>
            <button 
              className="cyber-button text-xs py-1.5 px-3 flex-1" 
              onClick={() => setQty(have.toString())}
              disabled={have.lte(0)}
            >
              ВСЁ
            </button>
          </div>
        </div>

        {/* Секция Покупки */}
        <div className="cyber-panel bg-cyber-dark/20">
          <div className="text-sm text-cyber-blue font-semibold mb-2">💰 Купить</div>
          <div className="grid grid-cols-2 gap-2 text-xs mb-3">
            <div className="text-cyber-text-dim">
              Цена: <span className="text-cyber-text">{formatNumber(buyUnit)} ⚡</span>
            </div>
            <div className="text-cyber-text-dim text-right">
              Макс: <span className="text-cyber-text">{formatNumber(maxBuy)}</span>
            </div>
          </div>
          
          {qtyDec.gt(0) && (
            <div className="text-sm text-cyber-text-dim mb-3">
              Стоимость: <span className="text-cyber-blue font-semibold text-lg">{formatNumber(estBuyCost)} ⚡</span>
            </div>
          )}
          
          <button
            className={`w-full py-3 rounded-lg font-semibold transition-all ${
              canBuy 
                ? 'bg-cyber-blue hover:bg-cyber-blue/90 text-white shadow-lg shadow-cyber-blue/20' 
                : 'bg-cyber-gray/20 text-cyber-gray-light cursor-not-allowed'
            }`}
            disabled={!canBuy}
            onClick={() => buyResource(selected, qtyNum)}
          >
            КУПИТЬ
          </button>
        </div>

        {/* Секция Продажи */}
        <div className="cyber-panel bg-cyber-dark/20">
          <div className="text-sm text-cyber-green font-semibold mb-2">💵 Продать</div>
          <div className="grid grid-cols-2 gap-2 text-xs mb-3">
            <div className="text-cyber-text-dim">
              Цена: <span className="text-cyber-text">{formatNumber(sellUnit)} ⚡</span>
            </div>
            <div className="text-cyber-text-dim text-right">
              В наличии: <span className="text-cyber-text">{formatNumber(have)}</span>
            </div>
          </div>
          
          {qtyDec.gt(0) && (
            <div className="text-sm text-cyber-text-dim mb-3">
              Получите: <span className="text-cyber-green font-semibold text-lg">{formatNumber(estSellGain)} ⚡</span>
            </div>
          )}
          
          <button
            className={`w-full py-3 rounded-lg font-semibold transition-all ${
              canSell 
                ? 'bg-cyber-green hover:bg-cyber-green/90 text-white shadow-lg shadow-cyber-green/20' 
                : 'bg-cyber-gray/20 text-cyber-gray-light cursor-not-allowed'
            }`}
            disabled={!canSell}
            onClick={() => sellResource(selected, qtyNum)}
          >
            ПРОДАТЬ
          </button>
        </div>

        {/* График цен */}
        <div className="cyber-panel">
          <div className="text-xs text-cyber-text-dim mb-2">📊 История цен</div>
          <PriceChart points={points} />
          {chartStats ? (
            <div className="text-xs text-cyber-gray-light mt-1">
              min {formatNumber(chartStats.min)} · max {formatNumber(chartStats.max)}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
