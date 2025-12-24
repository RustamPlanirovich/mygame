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
    return <div className="text-xs text-gray-700">Недостаточно данных для графика.</div>;
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
        <div className="text-xs text-gray-500">
          Обновление через: {secondsLeft}с · Событие: <span className="text-gray-300">{market.event.name}</span>
          <span className="text-gray-600"> · Маржа: x{tradeMult.toFixed(2)}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="cyber-panel">
          <div className="text-xs text-gray-500 mb-2">Ресурсы</div>
          <div className="space-y-1">
            {TRADEABLE.map((r) => {
              const isActive = r === selected;
              return (
                <button
                  key={r}
                  className={`w-full text-left px-3 py-2 rounded border border-cyber-gray/60 hover:border-cyber-blue transition-colors ${isActive ? 'bg-cyber-dark/40' : ''}`}
                  onClick={() => setSelected(r)}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-gray-300">{TRADE_LABEL[r]}</div>
                    <div className="text-xs text-gray-600">{formatNumber(resources[r].amount)}</div>
                  </div>
                  <div className="text-xs text-gray-600">Цена: {formatNumber(market.prices[r])}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="cyber-panel md:col-span-2">
          <div className="flex items-baseline justify-between gap-3">
            <div className="text-cyber-blue font-bold">{TRADE_LABEL[selected]}</div>
            <div className="text-xs text-gray-600">Энергия: {formatNumber(resources.energy.amount)} / {formatNumber(resources.energy.max)}</div>
          </div>

          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-600">
            <div>Купить: <span className="text-gray-300">{formatNumber(buyUnit)} ⚡</span> за 1</div>
            <div>Продать: <span className="text-gray-300">{formatNumber(sellUnit)} ⚡</span> за 1</div>
          </div>

          <div className="mt-2">
            <PriceChart points={points} />
            {chartStats ? (
              <div className="text-xs text-gray-700">min {formatNumber(chartStats.min)} · max {formatNumber(chartStats.max)}</div>
            ) : null}
          </div>

          <div className="mt-3 pt-3 border-t border-cyber-gray/50">
            <div className="text-xs text-gray-500 mb-2">Заявка</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
              <div className="sm:col-span-1">
                <div className="text-xs text-gray-600 mb-1">Количество</div>
                <input
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  inputMode="decimal"
                  className="w-full px-2 py-2 rounded bg-cyber-dark/40 border border-cyber-gray/60 text-gray-200"
                  placeholder="10"
                />
                <div className="mt-2 flex gap-2">
                  {[1, 10, 100].map((n) => (
                    <button key={n} className="cyber-button text-xs py-1 px-2" onClick={() => setQty(String(n))}>
                      {n}
                    </button>
                  ))}
                  <button
                    className="cyber-button text-xs py-1 px-2"
                    onClick={() => setQty(maxBuy.toString())}
                    title="Максимум, который можно купить сейчас (место в базе + доступная энергия)"
                    disabled={maxBuy.lte(0)}
                  >
                    MAX
                  </button>
                  <button className="cyber-button text-xs py-1 px-2" onClick={() => setQty(have.toString())}>
                    всё
                  </button>
                </div>
                {qtyDec.lte(0) ? <div className="text-xs text-gray-700 mt-1">Введите количество больше 0.</div> : null}
              </div>

              <div className="sm:col-span-2">
                <div className="text-xs text-gray-600 mb-1">Оценка</div>
                <div className="text-xs text-gray-600">
                  Купить: <span className="text-gray-300">{formatNumber(estBuyCost)}</span> ⚡
                  <span className="text-gray-700"> · Макс: {formatNumber(maxBuy)}</span>
                </div>
                <div className="text-xs text-gray-600">
                  Продать: <span className="text-gray-300">{formatNumber(estSellGain)}</span> ⚡
                  <span className="text-gray-700"> · Доступно: {formatNumber(have)}</span>
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    className="cyber-button text-xs py-2 px-3"
                    disabled={!canBuy}
                    onClick={() => buyResource(selected, qtyNum)}
                    title={maxBuy.lte(0) ? 'Нет энергии/места в базе' : ''}
                  >
                    КУПИТЬ
                  </button>
                  <button
                    className="cyber-button text-xs py-2 px-3"
                    disabled={!canSell}
                    onClick={() => sellResource(selected, qtyNum)}
                  >
                    ПРОДАТЬ
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="text-xs text-gray-700 mt-3">
            Продажа превращает ресурсы в Энергию (⚡). Покупка тратит Энергию. Энергия и ресурсы базы ограничены хранилищем.
          </div>
        </div>
      </div>
    </div>
  );
}
