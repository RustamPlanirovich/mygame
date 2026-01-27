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
    
    const result = investInFund(fundId, amount);
    if (result.success) {
      setInvestAmount(prev => ({ ...prev, [fundId]: '' }));
    } else {
      alert(result.error);
    }
  };
  
  const handleWithdraw = (fundId: string) => {
    const shares = D(withdrawShares[fundId] || '0');
    if (shares.lte(0)) return;
    
    const result = withdrawFromFund(fundId, shares);
    if (result.success) {
      setWithdrawShares(prev => ({ ...prev, [fundId]: '' }));
    } else {
      alert(result.error);
    }
  };
  
  return (
    <div className="space-y-4">
      {/* Общая статистика */}
      <div className="bg-slate-800 rounded-lg p-4">
        <h3 className="font-bold mb-4">📊 Общий портфель</h3>
        
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-slate-700 rounded p-3 text-center">
            <div className="text-slate-400 text-sm">Всего инвестировано</div>
            <div className="font-bold text-lg">
              {formatNumber(stocksStats.totalInvested.add(fundsStats.totalInvested))} ₡
            </div>
          </div>
          <div className="bg-slate-700 rounded p-3 text-center">
            <div className="text-slate-400 text-sm">Текущая стоимость</div>
            <div className="font-bold text-lg text-blue-400">
              {formatNumber(totalValue)} ₡
            </div>
          </div>
          <div className="bg-slate-700 rounded p-3 text-center">
            <div className="text-slate-400 text-sm">Общая P&L</div>
            <div className={`font-bold text-lg ${
              stocksStats.unrealizedPnL.add(fundsStats.unrealizedPnL).gt(0) ? 'text-green-400' :
              stocksStats.unrealizedPnL.add(fundsStats.unrealizedPnL).lt(0) ? 'text-red-400' : ''
            }`}>
              {stocksStats.unrealizedPnL.add(fundsStats.unrealizedPnL).gt(0) ? '+' : ''}
              {formatNumber(stocksStats.unrealizedPnL.add(fundsStats.unrealizedPnL))} ₡
            </div>
          </div>
          <div className="bg-slate-700 rounded p-3 text-center">
            <div className="text-slate-400 text-sm">Дивиденды</div>
            <div className="font-bold text-lg text-emerald-400">
              +{formatNumber(stocksStats.dividends)} ₡
            </div>
          </div>
        </div>
        
        {/* Распределение */}
        <div className="mt-4">
          <div className="text-sm text-slate-400 mb-2">Распределение портфеля</div>
          <div className="flex h-4 rounded-full overflow-hidden bg-slate-700">
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
          <div className="flex justify-between text-xs mt-1">
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
          className={`flex-1 py-2 text-sm font-medium ${
            activeTab === 'stocks' ? 'border-b-2 border-blue-500 text-white' : 'text-slate-400'
          }`}
        >
          📈 Акции ({positions.length})
        </button>
        <button
          onClick={() => setActiveTab('funds')}
          className={`flex-1 py-2 text-sm font-medium ${
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
            <div className="text-center py-8 text-slate-400">
              У вас пока нет акций
            </div>
          ) : (
            positions.map(position => {
              const stock = stocks.find(s => s.id === position.stockId);
              if (!stock) return null;
              
              return (
                <div key={position.stockId} className="bg-slate-800 rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{stock.emoji}</span>
                      <div>
                        <div className="font-bold">{stock.symbol}</div>
                        <div className="text-sm text-slate-400">{stock.name}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">{formatNumber(D(position.currentValue))} ₡</div>
                      <div className={`text-sm ${
                        D(position.unrealizedPnL).gt(0) ? 'text-green-400' :
                        D(position.unrealizedPnL).lt(0) ? 'text-red-400' : ''
                      }`}>
                        {D(position.unrealizedPnL).gt(0) ? '+' : ''}
                        {formatNumber(D(position.unrealizedPnL))} ₡
                        ({position.unrealizedPnLPercent.toFixed(1)}%)
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-4 gap-2 mt-3 text-sm">
                    <div>
                      <div className="text-slate-400">Акций</div>
                      <div>{formatNumber(D(position.shares))}</div>
                    </div>
                    <div>
                      <div className="text-slate-400">Ср. цена</div>
                      <div>{formatNumber(D(position.avgBuyPrice))} ₡</div>
                    </div>
                    <div>
                      <div className="text-slate-400">Текущая цена</div>
                      <div>{formatNumber(D(stock.currentPrice))} ₡</div>
                    </div>
                    <div>
                      <div className="text-slate-400">Дивиденды</div>
                      <div className="text-emerald-400">+{formatNumber(D(position.dividendsReceived))} ₡</div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
      
      {activeTab === 'funds' && (
        <div className="space-y-4">
          {/* Доступные фонды */}
          <div className="bg-slate-800 rounded-lg p-4">
            <h4 className="font-bold mb-4">🏦 Доступные фонды</h4>
            
            <div className="space-y-3">
              {FUND_DEFINITIONS.map(fundDef => {
                const investment = fundInvestments.find(i => i.fundId === fundDef.id);
                
                return (
                  <div key={fundDef.id} className="bg-slate-700 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="font-bold flex items-center gap-2">
                          {fundDef.emoji} {fundDef.name}
                        </div>
                        <div className="text-sm text-slate-400">
                          {getFundTypeName(fundDef.type)} • Риск: 
                          <span style={{ color: getRiskLevelColor(fundDef.riskLevel) }}>
                            {' '}{getRiskLevelDescription(fundDef.riskLevel)}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-emerald-400 font-bold">
                          {(fundDef.annualReturn * 100).toFixed(0)}% годовых
                        </div>
                        <div className="text-xs text-slate-400">
                          Комиссия: {(fundDef.managementFee * 100).toFixed(1)}%
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-sm text-slate-300 mb-3">
                      {fundDef.description}
                    </div>
                    
                    {/* Ваша инвестиция */}
                    {investment && (
                      <div className="bg-slate-600/50 rounded p-2 mb-3">
                        <div className="flex justify-between text-sm">
                          <span>Ваша инвестиция:</span>
                          <span className="font-medium">{formatNumber(D(investment.currentValue))} ₡</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>P&L:</span>
                          <span className={D(investment.unrealizedPnL).gt(0) ? 'text-green-400' : D(investment.unrealizedPnL).lt(0) ? 'text-red-400' : ''}>
                            {D(investment.unrealizedPnL).gt(0) ? '+' : ''}
                            {formatNumber(D(investment.unrealizedPnL))} ₡
                          </span>
                        </div>
                      </div>
                    )}
                    
                    {/* Действия */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={investAmount[fundDef.id] || ''}
                          onChange={(e) => setInvestAmount(prev => ({ ...prev, [fundDef.id]: e.target.value }))}
                          placeholder={`Мин: ${fundDef.minInvestment}`}
                          className="flex-1 bg-slate-600 rounded px-2 py-1.5 text-sm"
                        />
                        <button
                          onClick={() => handleInvest(fundDef.id)}
                          disabled={!investAmount[fundDef.id] || D(investAmount[fundDef.id]).lt(fundDef.minInvestment)}
                          className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 rounded text-sm"
                        >
                          Инвестировать
                        </button>
                      </div>
                      
                      {investment && (
                        <div className="flex gap-2">
                          <input
                            type="number"
                            value={withdrawShares[fundDef.id] || ''}
                            onChange={(e) => setWithdrawShares(prev => ({ ...prev, [fundDef.id]: e.target.value }))}
                            placeholder="Паёв"
                            className="flex-1 bg-slate-600 rounded px-2 py-1.5 text-sm"
                          />
                          <button
                            onClick={() => handleWithdraw(fundDef.id)}
                            disabled={!withdrawShares[fundDef.id] || D(withdrawShares[fundDef.id]).lte(0)}
                            className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-600 rounded text-sm"
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
          </div>
        </div>
      )}
    </div>
  );
}
