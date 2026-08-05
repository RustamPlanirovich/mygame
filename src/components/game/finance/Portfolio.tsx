/**
 * Portfolio - Портфель инвестиций
 * Обзор акций и фондов игрока
 */

import { memo, useState } from 'react';
import { useFinanceStore } from '../../../features/financeStore';
import { formatNumber, D } from '../../../core/math/format';
import { getFundTypeName, getRiskLevelDescription, getRiskLevelColor } from '../../../core/gameTypes.finance';
import { FUND_DEFINITIONS } from '../../../core/constants/funds';
import { EmptyState, Panel, Stat, Tabs, type TabItem } from '../../ui';

type PortfolioTab = 'stocks' | 'funds';

// memo: родительская FinancePanel рендерится на каждый тик, пропсов у компонента нет.
export const Portfolio = memo(PortfolioImpl);

function PortfolioImpl() {
  const [activeTab, setActiveTab] = useState<PortfolioTab>('stocks');
  const [investAmount, setInvestAmount] = useState<Record<string, string>>({});
  const [withdrawShares, setWithdrawShares] = useState<Record<string, string>>({});

  // Точечные подписки вместо `useFinanceStore()`: раньше портфель перерисовывался
  // на любой set() стора, включая начисление процентов по вкладу и платежи по кредитам.
  const positions = useFinanceStore((s) => s.positions);
  const fundInvestments = useFinanceStore((s) => s.fundInvestments);
  const stocks = useFinanceStore((s) => s.stocks);
  const investInFund = useFinanceStore((s) => s.investInFund);
  const withdrawFromFund = useFinanceStore((s) => s.withdrawFromFund);
  const getTotalPortfolioValue = useFinanceStore((s) => s.getTotalPortfolioValue);

  const totalValue = getTotalPortfolioValue();

  // Расчёт общих показателей акций
  const stocksStats = positions.reduce((acc, pos) => {
    return {
      totalInvested: acc.totalInvested.add(D(pos.totalInvested)),
      currentValue: acc.currentValue.add(D(pos.currentValue)),
      unrealizedPnL: acc.unrealizedPnL.add(D(pos.unrealizedPnL)),
      dividends: acc.dividends.add(D(pos.dividendsReceived)),
    };
  }, {
    totalInvested: D(0),
    currentValue: D(0),
    unrealizedPnL: D(0),
    dividends: D(0),
  });

  // Расчёт общих показателей фондов
  const fundsStats = fundInvestments.reduce((acc, inv) => {
    return {
      totalInvested: acc.totalInvested.add(D(inv.investedAmount)),
      currentValue: acc.currentValue.add(D(inv.currentValue)),
      unrealizedPnL: acc.unrealizedPnL.add(D(inv.unrealizedPnL)),
    };
  }, {
    totalInvested: D(0),
    currentValue: D(0),
    unrealizedPnL: D(0),
  });

  const handleInvest = (fundId: string) => {
    const amount = D(investAmount[fundId] || '0');
    if (amount.lte(0)) return;

    const fund = FUND_DEFINITIONS.find(f => f.id === fundId);
    const result = investInFund(fundId, amount);
    if (result.success) {
      setInvestAmount(prev => ({ ...prev, [fundId]: '' }));
      alert(`✅ Инвестировано ${formatNumber(amount)} ₡ в фонд "${fund?.name}".\n\n💳 Средства списаны с вашего БАНКОВСКОГО СЧЁТА.`);
    } else {
      alert(result.error);
    }
  };

  const handleWithdraw = (fundId: string) => {
    const shares = D(withdrawShares[fundId] || '0');
    if (shares.lte(0)) return;

    const fund = FUND_DEFINITIONS.find(f => f.id === fundId);
    const investment = fundInvestments.find(i => i.fundId === fundId);

    const result = withdrawFromFund(fundId, shares);
    if (result.success) {
      setWithdrawShares(prev => ({ ...prev, [fundId]: '' }));
      // Показываем уведомление о зачислении на расчётный счёт
      const withdrawAmount = shares.mul(D(investment?.currentValue ?? 0).div(D(investment?.shares ?? 1)));
      const profitText = result.profit.gt(0)
        ? ` (прибыль: +${formatNumber(result.profit)} ₡)`
        : result.profit.lt(0)
          ? ` (убыток: ${formatNumber(result.profit)} ₡)`
          : '';
      alert(`✅ Продано ${formatNumber(shares)} паёв фонда "${fund?.name}"${profitText}.\n\n💰 Средства (${formatNumber(withdrawAmount)} ₡) зачислены на РАСЧЁТНЫЙ СЧЁТ в банке.\n\n👉 Перейдите во вкладку "Банк" и нажмите "Вывести всё", чтобы перевести деньги в кредиты игры.`);
    } else {
      alert(result.error);
    }
  };

  const combinedPnL = stocksStats.unrealizedPnL.add(fundsStats.unrealizedPnL);

  const tabs: TabItem<PortfolioTab>[] = [
    { id: 'stocks', label: '📈 Акции', badge: positions.length },
    { id: 'funds', label: '💼 Фонды', badge: fundInvestments.length },
  ];

  return (
    <div className="space-y-3">
      {/* Общая статистика */}
      <Panel title="📊 Общий портфель">
        <div className="grid grid-cols-4 gap-2">
          <div className="card">
            <Stat
              label="Инвестиции"
              value={formatNumber(stocksStats.totalInvested.add(fundsStats.totalInvested))}
              hint="₡"
              align="center"
            />
          </div>
          <div className="card">
            <Stat label="Стоимость" value={formatNumber(totalValue)} hint="₡" tone="info" align="center" />
          </div>
          <div className="card">
            <Stat
              label="P&L"
              value={`${combinedPnL.gt(0) ? '+' : ''}${formatNumber(combinedPnL)}`}
              hint="₡"
              tone={combinedPnL.gt(0) ? 'accent' : combinedPnL.lt(0) ? 'danger' : 'neutral'}
              align="center"
            />
          </div>
          <div className="card">
            <Stat
              label="Дивиденды"
              value={`+${formatNumber(stocksStats.dividends)}`}
              hint="₡"
              tone="accent"
              align="center"
            />
          </div>
        </div>

        {/* Распределение */}
        <div className="mt-3">
          <div className="stat-label mb-1">Распределение портфеля</div>
          {/* Дорожка .meter, но заполнение из ДВУХ сегментов — <Meter> рисует один. */}
          <div className="meter flex h-3">
            {stocksStats.currentValue.gt(0) && (
              <div
                className="bg-blue-500"
                style={{
                  width: `${stocksStats.currentValue.div(totalValue.eq(0) ? D(1) : totalValue).mul(100).toNumber()}%`,
                }}
              />
            )}
            {fundsStats.currentValue.gt(0) && (
              <div
                className="bg-purple-500"
                style={{
                  width: `${fundsStats.currentValue.div(totalValue.eq(0) ? D(1) : totalValue).mul(100).toNumber()}%`,
                }}
              />
            )}
          </div>
          <div className="flex justify-between text-2xs mt-1 font-mono tabular-nums">
            <span className="text-blue-400">
              Акции: {totalValue.eq(0) ? 0 : stocksStats.currentValue.div(totalValue).mul(100).toNumber().toFixed(1)}%
            </span>
            <span className="text-purple-400">
              Фонды: {totalValue.eq(0) ? 0 : fundsStats.currentValue.div(totalValue).mul(100).toNumber().toFixed(1)}%
            </span>
          </div>
        </div>
      </Panel>

      {/* Табы */}
      <Tabs items={tabs} value={activeTab} onChange={setActiveTab} size="sm" />

      {/* Контент */}
      {activeTab === 'stocks' && (
        <div className="space-y-2">
          {positions.length === 0 ? (
            <EmptyState title="У вас пока нет акций" />
          ) : (
            positions.map(position => {
              const stock = stocks.find(s => s.id === position.stockId);
              if (!stock) return null;

              return (
                <div key={position.stockId} className="card">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{stock.emoji}</span>
                      <div>
                        <div className="font-mono font-bold text-sm">{stock.symbol}</div>
                        <div className="text-xs text-slate-400">{stock.name}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-sm tabular-nums">{formatNumber(D(position.currentValue))} ₡</div>
                      <div className={`font-mono text-xs tabular-nums ${
                        D(position.unrealizedPnL).gt(0) ? 'text-green-400' :
                        D(position.unrealizedPnL).lt(0) ? 'text-red-400' : ''
                      }`}>
                        {D(position.unrealizedPnL).gt(0) ? '+' : ''}
                        {formatNumber(D(position.unrealizedPnL))} ₡
                        ({position.unrealizedPnLPercent.toFixed(1)}%)
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-1 mt-2">
                    <Stat label="Акций" value={formatNumber(D(position.shares))} />
                    <Stat label="Ср. цена" value={formatNumber(D(position.avgBuyPrice))} />
                    <Stat label="Сейчас" value={formatNumber(D(stock.currentPrice))} />
                    <Stat
                      label="Див."
                      value={`+${formatNumber(D(position.dividendsReceived))}`}
                      tone="accent"
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {activeTab === 'funds' && (
        <div className="space-y-2">
          {/* Доступные фонды */}
          {FUND_DEFINITIONS.map(fundDef => {
            const investment = fundInvestments.find(i => i.fundId === fundDef.id);

            return (
              <div key={fundDef.id} className="card">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-bold text-sm flex items-center gap-1">
                      {fundDef.emoji} {fundDef.name}
                    </div>
                    <div className="text-2xs text-slate-400">
                      {getFundTypeName(fundDef.type)} •
                      <span style={{ color: getRiskLevelColor(fundDef.riskLevel) }}>
                        {' '}{getRiskLevelDescription(fundDef.riskLevel)}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-emerald-400 font-bold text-sm tabular-nums">
                      {(fundDef.annualReturn * 100).toFixed(0)}%/год
                    </div>
                    <div className="text-2xs text-slate-400">
                      Комиссия: <span className="font-mono tabular-nums">{(fundDef.managementFee * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                </div>

                <div className="text-xs text-slate-300 mb-2 line-clamp-2">
                  {fundDef.description}
                </div>

                {/* Ваша инвестиция */}
                {investment && (
                  <div className="card mb-2 grid grid-cols-3 gap-2">
                    <Stat label="Паёв:" value={formatNumber(D(investment.shares))} />
                    <Stat label="Стоимость:" value={`${formatNumber(D(investment.currentValue))} ₡`} />
                    <Stat
                      label="P&L:"
                      value={`${D(investment.unrealizedPnL).gt(0) ? '+' : ''}${formatNumber(D(investment.unrealizedPnL))} ₡`}
                      tone={
                        D(investment.unrealizedPnL).gt(0)
                          ? 'accent'
                          : D(investment.unrealizedPnL).lt(0)
                            ? 'danger'
                            : 'neutral'
                      }
                    />
                  </div>
                )}

                {/* Действия - вертикально */}
                <div className="space-y-2">
                  <div className="flex gap-1">
                    <input
                      type="number"
                      value={investAmount[fundDef.id] || ''}
                      onChange={(e) => setInvestAmount(prev => ({ ...prev, [fundDef.id]: e.target.value }))}
                      placeholder={`Мин: ${fundDef.minInvestment} ₡`}
                      className="flex-1 px-2 py-1 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => handleInvest(fundDef.id)}
                      disabled={!investAmount[fundDef.id] || D(investAmount[fundDef.id]).lt(fundDef.minInvestment)}
                      className="btn-primary btn-xs whitespace-nowrap"
                    >
                      Вложить
                    </button>
                  </div>

                  {investment && (
                    <div className="flex gap-1">
                      <input
                        type="number"
                        value={withdrawShares[fundDef.id] || ''}
                        onChange={(e) => setWithdrawShares(prev => ({ ...prev, [fundDef.id]: e.target.value }))}
                        placeholder="Паёв"
                        className="flex-1 px-2 py-1 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => handleWithdraw(fundDef.id)}
                        disabled={!withdrawShares[fundDef.id] || D(withdrawShares[fundDef.id]).lte(0)}
                        className="btn btn-xs whitespace-nowrap"
                      >
                        Вывести
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
