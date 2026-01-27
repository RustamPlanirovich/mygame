/**
 * Portfolio - Портфель инвестиций
 * Обзор акций и фондов игрока
 */

import { useState } from 'react';
import { useFinanceStore } from '../../../features/financeStore';
import { formatNumber, D } from '../../../core/math/format';
import { getFundTypeName, getRiskLevelDescription, getRiskLevelColor } from '../../../core/gameTypes.finance';
import { FUND_DEFINITIONS } from '../../../core/constants/funds';

type PortfolioTab = 'stocks' | 'funds';

export function Portfolio() {
  const [activeTab, setActiveTab] = useState<PortfolioTab>('stocks');
  const [investAmount, setInvestAmount] = useState<Record<string, string>>({});
  const [withdrawShares, setWithdrawShares] = useState<Record<string, string>>({});
  
  const {
    positions,
    fundInvestments,
    stocks,
    investInFund,
    withdrawFromFund,
    getTotalPortfolioValue,
  } = useFinanceStore();
  
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
  
  return (
    <div className="space-y-3">
      {/* Общая статистика */}
      <div className="bg-slate-800 rounded-lg p-3">
        <h3 className="font-bold mb-3 text-sm">📊 Общий портфель</h3>
        
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-slate-700 rounded p-2 text-center">
            <div className="text-slate-400 text-[10px] leading-tight">Инвестиции</div>
            <div className="font-bold text-sm">
              {formatNumber(stocksStats.totalInvested.add(fundsStats.totalInvested))}
            </div>
            <div className="text-[10px] text-slate-500">₡</div>
          </div>
          <div className="bg-slate-700 rounded p-2 text-center">
            <div className="text-slate-400 text-[10px] leading-tight">Стоимость</div>
            <div className="font-bold text-sm text-blue-400">
              {formatNumber(totalValue)}
            </div>
            <div className="text-[10px] text-slate-500">₡</div>
          </div>
          <div className="bg-slate-700 rounded p-2 text-center">
            <div className="text-slate-400 text-[10px] leading-tight">P&L</div>
            <div className={`font-bold text-sm ${
              stocksStats.unrealizedPnL.add(fundsStats.unrealizedPnL).gt(0) ? 'text-green-400' :
              stocksStats.unrealizedPnL.add(fundsStats.unrealizedPnL).lt(0) ? 'text-red-400' : ''
            }`}>
              {stocksStats.unrealizedPnL.add(fundsStats.unrealizedPnL).gt(0) ? '+' : ''}
              {formatNumber(stocksStats.unrealizedPnL.add(fundsStats.unrealizedPnL))}
            </div>
            <div className="text-[10px] text-slate-500">₡</div>
          </div>
          <div className="bg-slate-700 rounded p-2 text-center">
            <div className="text-slate-400 text-[10px] leading-tight">Дивиденды</div>
            <div className="font-bold text-sm text-emerald-400">
              +{formatNumber(stocksStats.dividends)}
            </div>
            <div className="text-[10px] text-slate-500">₡</div>
          </div>
        </div>
        
        {/* Распределение */}
        <div className="mt-3">
          <div className="text-xs text-slate-400 mb-1">Распределение портфеля</div>
          <div className="flex h-3 rounded-full overflow-hidden bg-slate-700">
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
          <div className="flex justify-between text-[10px] mt-1">
            <span className="text-blue-400">
              Акции: {totalValue.eq(0) ? 0 : stocksStats.currentValue.div(totalValue).mul(100).toNumber().toFixed(1)}%
            </span>
            <span className="text-purple-400">
              Фонды: {totalValue.eq(0) ? 0 : fundsStats.currentValue.div(totalValue).mul(100).toNumber().toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
      
      {/* Табы */}
      <div className="flex border-b border-slate-700">
        <button
          onClick={() => setActiveTab('stocks')}
          className={`flex-1 py-1.5 text-xs font-medium ${
            activeTab === 'stocks' ? 'border-b-2 border-blue-500 text-white' : 'text-slate-400'
          }`}
        >
          📈 Акции ({positions.length})
        </button>
        <button
          onClick={() => setActiveTab('funds')}
          className={`flex-1 py-1.5 text-xs font-medium ${
            activeTab === 'funds' ? 'border-b-2 border-purple-500 text-white' : 'text-slate-400'
          }`}
        >
          💼 Фонды ({fundInvestments.length})
        </button>
      </div>
      
      {/* Контент */}
      {activeTab === 'stocks' && (
        <div className="space-y-2">
          {positions.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-sm">
              У вас пока нет акций
            </div>
          ) : (
            positions.map(position => {
              const stock = stocks.find(s => s.id === position.stockId);
              if (!stock) return null;
              
              return (
                <div key={position.stockId} className="bg-slate-800 rounded-lg p-3">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{stock.emoji}</span>
                      <div>
                        <div className="font-bold text-sm">{stock.symbol}</div>
                        <div className="text-xs text-slate-400">{stock.name}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-sm">{formatNumber(D(position.currentValue))} ₡</div>
                      <div className={`text-xs ${
                        D(position.unrealizedPnL).gt(0) ? 'text-green-400' :
                        D(position.unrealizedPnL).lt(0) ? 'text-red-400' : ''
                      }`}>
                        {D(position.unrealizedPnL).gt(0) ? '+' : ''}
                        {formatNumber(D(position.unrealizedPnL))} ₡
                        ({position.unrealizedPnLPercent.toFixed(1)}%)
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-4 gap-1 mt-2 text-xs">
                    <div>
                      <div className="text-slate-400">Акций</div>
                      <div>{formatNumber(D(position.shares))}</div>
                    </div>
                    <div>
                      <div className="text-slate-400">Ср. цена</div>
                      <div>{formatNumber(D(position.avgBuyPrice))}</div>
                    </div>
                    <div>
                      <div className="text-slate-400">Сейчас</div>
                      <div>{formatNumber(D(stock.currentPrice))}</div>
                    </div>
                    <div>
                      <div className="text-slate-400">Див.</div>
                      <div className="text-emerald-400">+{formatNumber(D(position.dividendsReceived))}</div>
                    </div>
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
              <div key={fundDef.id} className="bg-slate-800 rounded-lg p-3">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-bold text-sm flex items-center gap-1">
                      {fundDef.emoji} {fundDef.name}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {getFundTypeName(fundDef.type)} • 
                      <span style={{ color: getRiskLevelColor(fundDef.riskLevel) }}>
                        {' '}{getRiskLevelDescription(fundDef.riskLevel)}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-emerald-400 font-bold text-sm">
                      {(fundDef.annualReturn * 100).toFixed(0)}%/год
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Комиссия: {(fundDef.managementFee * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
                
                <div className="text-xs text-slate-300 mb-2 line-clamp-2">
                  {fundDef.description}
                </div>
                
                {/* Ваша инвестиция */}
                {investment && (
                  <div className="bg-slate-700/50 rounded p-2 mb-2 text-xs">
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <span className="text-slate-400">Паёв:</span>
                        <span className="font-medium ml-1">{formatNumber(D(investment.shares))}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Стоимость:</span>
                        <span className="font-medium ml-1">{formatNumber(D(investment.currentValue))} ₡</span>
                      </div>
                      <div>
                        <span className="text-slate-400">P&L:</span>
                        <span className={`font-medium ml-1 ${D(investment.unrealizedPnL).gt(0) ? 'text-green-400' : D(investment.unrealizedPnL).lt(0) ? 'text-red-400' : ''}`}>
                          {D(investment.unrealizedPnL).gt(0) ? '+' : ''}
                          {formatNumber(D(investment.unrealizedPnL))} ₡
                        </span>
                      </div>
                    </div>
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
                      className="flex-1 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs"
                    />
                    <button
                      onClick={() => handleInvest(fundDef.id)}
                      disabled={!investAmount[fundDef.id] || D(investAmount[fundDef.id]).lt(fundDef.minInvestment)}
                      className="px-2 py-1 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 rounded text-xs whitespace-nowrap"
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
                        className="flex-1 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs"
                      />
                      <button
                        onClick={() => handleWithdraw(fundDef.id)}
                        disabled={!withdrawShares[fundDef.id] || D(withdrawShares[fundDef.id]).lte(0)}
                        className="px-2 py-1 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-600 rounded text-xs whitespace-nowrap"
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
