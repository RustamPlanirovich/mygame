/**
 * AIAdvisor - Финансовый AI-помощник
 * Рекомендации по торговле и автоматический трейдинг
 */

import { useState, useEffect } from 'react';
import { useAdvisorStore } from '../../../features/advisorStore';
import { useFinanceStore } from '../../../features/financeStore';
import { formatNumber, D } from '../../../core/math/format';
import { ADVISOR_PRICES } from '../../../core/gameTypes.ai';
import type { FinancialAdvisorTier, AdvisorRecommendation } from '../../../core/gameTypes.ai';

export function AIAdvisor() {
  const [showSettings, setShowSettings] = useState(false);

  const {
    advisor,
    marketAnalysis,
    recommendations,
    isLoadingAnalysis,
    aiEnabled,
    dividendPrediction,
    autoTraderStats,
    purchaseAdvisor,
    upgradeToPremiun,
    updateAdvisorSettings,
    fetchMarketAnalysis,
    fetchRecommendations,
    executeRecommendation,
    checkAIStatus,
    fetchAIDividends,
    startAutoTrader,
  } = useAdvisorStore();

  const { bank, stocks, withdrawFromBank } = useFinanceStore();

  // Функция сброса stop-loss
  const resetStopLoss = () => {
    useAdvisorStore.setState({
      autoTraderStats: {
        startingBalance: bank.balance, // Новый стартовый баланс
        tradesThisHour: 0,
        lastHourReset: Date.now(),
        totalProfitLoss: '0',
        isPaused: false,
        pauseReason: '',
        // Система защиты капитала - сброс
        tradingCapital: '0', // Будет переинициализирован
        frozenProfit: '0',
        accumulatedLoss: '0',
        capitalProtectionActive: true,
        lastTradeBalance: '0',
        totalSavedToSavings: '0',
      },
    });
    alert('✅ Stop-loss сброшен. Автотрейдер возобновит работу.');
  };

  // Проверяем статус AI при загрузке
  useEffect(() => {
    checkAIStatus();
  }, [checkAIStatus]);

  // Автотрейдер теперь запускается глобально в advisorStore при rehydrate
  // Здесь только проверяем что он работает и перезапускаем если нужно
  useEffect(() => {
    if (advisor.tier === 'premium' && advisor.autoTrading.enabled) {
      // Проверяем, работает ли уже автотрейдер
      const state = useAdvisorStore.getState();
      if (!state.autoTraderInterval) {
        console.log('[AIAdvisor] Autotrader not running, starting...');
        startAutoTrader();
      }
    }
  }, [advisor.tier, advisor.autoTrading.enabled, startAutoTrader]);

  // Загружаем анализ рынка и AI-дивиденды
  useEffect(() => {
    if (advisor.tier !== 'none' && stocks.length > 0) {
      const prices: Record<string, string> = {};
      stocks.forEach((s) => {
        prices[s.id] = s.currentPrice;
      });
      fetchMarketAnalysis(prices);
      
      // Обновляем AI-дивиденды
      const stocksData = stocks.map(s => ({
        id: s.id,
        symbol: s.symbol,
        sector: s.sector,
        dividendYield: s.dividendYield,
        currentPrice: s.currentPrice,
      }));
      fetchAIDividends(stocksData);
    }
  }, [advisor.tier, stocks, fetchMarketAnalysis, fetchAIDividends]);

  // Загружаем рекомендации
  useEffect(() => {
    if (advisor.tier !== 'none' && marketAnalysis) {
      fetchRecommendations();
    }
  }, [advisor.tier, marketAnalysis, fetchRecommendations]);

  const handlePurchase = (tier: FinancialAdvisorTier) => {
    const success = purchaseAdvisor(tier, (amount) => {
      return withdrawFromBank(amount);
    });

    if (success) {
      alert(`✅ ${tier === 'basic' ? 'Базовый' : 'Премиум'} советник активирован!`);
    } else {
      alert('❌ Недостаточно средств на банковском счёте');
    }
  };

  const handleUpgrade = () => {
    const upgradeCost = D(ADVISOR_PRICES.premium.credits).sub(D(ADVISOR_PRICES.basic.credits));
    const success = upgradeToPremiun((amount) => {
      return withdrawFromBank(amount);
    });

    if (success) {
      alert(`✅ Апгрейд до Премиум советника выполнен!`);
    } else {
      alert(`❌ Недостаточно средств. Нужно ${formatNumber(upgradeCost)} ₡`);
    }
  };

  const handleExecute = async (rec: AdvisorRecommendation) => {
    const success = await executeRecommendation(rec.id);
    if (success) {
      alert(`✅ Рекомендация выполнена: ${rec.reasoning}`);
    } else {
      alert('❌ Не удалось выполнить рекомендацию');
    }
  };

  const getSentimentEmoji = (sentiment: string) => {
    switch (sentiment) {
      case 'bullish':
        return '🐂';
      case 'bearish':
        return '🐻';
      default:
        return '➡️';
    }
  };

  const getSentimentText = (sentiment: string) => {
    switch (sentiment) {
      case 'bullish':
        return 'Бычий';
      case 'bearish':
        return 'Медвежий';
      default:
        return 'Нейтральный';
    }
  };

  const getRecommendationIcon = (type: string) => {
    switch (type) {
      case 'buy_stock':
      case 'buy_fund':
        return '📈';
      case 'sell_stock':
      case 'sell_fund':
        return '📉';
      case 'take_loan':
        return '💳';
      case 'pay_loan':
        return '✅';
      case 'lend_credits':
        return '🏦';
      default:
        return '💡';
    }
  };

  const getRecommendationText = (type: string) => {
    switch (type) {
      case 'buy_stock':
        return 'Купить акции';
      case 'sell_stock':
        return 'Продать акции';
      case 'buy_fund':
        return 'Купить фонд';
      case 'sell_fund':
        return 'Продать фонд';
      case 'take_loan':
        return 'Взять кредит';
      case 'pay_loan':
        return 'Погасить кредит';
      case 'lend_credits':
        return 'Выдать кредит';
      default:
        return type;
    }
  };

  // Если советник не куплен - показываем магазин
  if (advisor.tier === 'none') {
    return (
      <div className="space-y-4">
        <div className="bg-slate-800 rounded-lg p-4">
          <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
            🤖 AI Финансовый советник
          </h3>
          <p className="text-slate-400 text-sm mb-4">
            Получайте рекомендации от искусственного интеллекта по торговле акциями, фондами и управлению
            кредитами.
          </p>

          {!aiEnabled && (
            <div className="bg-yellow-900/30 border border-yellow-600 rounded p-3 mb-4 text-sm">
              ⚠️ DeepSeek AI не подключён. Будут использоваться базовые алгоритмы анализа.
            </div>
          )}
        </div>

        {/* Тарифы */}
        <div className="grid grid-cols-2 gap-4">
          {/* Базовый */}
          <div className="bg-slate-800 rounded-lg p-4 border-2 border-blue-500">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">📊</span>
              <h4 className="font-bold">Базовый</h4>
            </div>
            <p className="text-slate-400 text-sm mb-3">{ADVISOR_PRICES.basic.description}</p>
            <ul className="text-sm space-y-1 mb-4">
              <li className="flex items-center gap-2">
                <span className="text-green-400">✓</span> Прогнозы рынка
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-400">✓</span> Рекомендации по покупке/продаже
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-400">✓</span> Анализ кредитных ставок
              </li>
              <li className="flex items-center gap-2 text-slate-500">
                <span>✗</span> Автоматическая торговля
              </li>
            </ul>
            <div className="text-lg font-bold text-blue-400 mb-2">
              {formatNumber(D(ADVISOR_PRICES.basic.credits))} ₡
            </div>
            <button
              type="button"
              onClick={() => handlePurchase('basic')}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 rounded font-medium transition-colors cursor-pointer"
            >
              Купить
            </button>
          </div>

          {/* Премиум */}
          <div className="bg-slate-800 rounded-lg p-4 border-2 border-purple-500">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">🚀</span>
              <h4 className="font-bold">Премиум</h4>
              <span className="px-2 py-0.5 bg-purple-600 rounded text-xs">РЕКОМЕНДУЕМ</span>
            </div>
            <p className="text-slate-400 text-sm mb-3">{ADVISOR_PRICES.premium.description}</p>
            <ul className="text-sm space-y-1 mb-4">
              <li className="flex items-center gap-2">
                <span className="text-green-400">✓</span> Всё из базового
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-400">✓</span> Автоматическая торговля
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-400">✓</span> Арбитражные стратегии
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-400">✓</span> Управление кредитами
              </li>
            </ul>
            <div className="text-lg font-bold text-purple-400 mb-2">
              {formatNumber(D(ADVISOR_PRICES.premium.credits))} ₡
            </div>
            <button
              type="button"
              onClick={() => handlePurchase('premium')}
              className="w-full py-2 bg-purple-600 hover:bg-purple-700 rounded font-medium transition-colors cursor-pointer"
            >
              Купить
            </button>
          </div>
        </div>

        <div className="text-center text-slate-500 text-sm">
          Баланс банковского счёта: {formatNumber(D(bank.balance))} ₡
        </div>
      </div>
    );
  }

  // Активный советник
  return (
    <div className="space-y-4">
      {/* Заголовок */}
      <div className="bg-slate-800 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bold text-lg flex items-center gap-2">
            🤖 AI Советник
            <span
              className={`px-2 py-0.5 rounded text-xs ${
                advisor.tier === 'premium' ? 'bg-purple-600' : 'bg-blue-600'
              }`}
            >
              {advisor.tier === 'premium' ? 'ПРЕМИУМ' : 'БАЗОВЫЙ'}
            </span>
          </h3>
          <div className="flex items-center gap-2">
            {advisor.tier === 'basic' && (
              <button
                type="button"
                onClick={handleUpgrade}
                className="px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-sm cursor-pointer transition-colors"
              >
                ⬆️ Апгрейд до Премиум ({formatNumber(D(ADVISOR_PRICES.premium.credits).sub(D(ADVISOR_PRICES.basic.credits)))} ₡)
              </button>
            )}
            {advisor.tier === 'premium' && (
              <button
                type="button"
                onClick={() => setShowSettings(!showSettings)}
                className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-sm cursor-pointer transition-colors"
              >
                ⚙️ Настройки
              </button>
            )}
          </div>
        </div>

        {aiEnabled ? (
          <div className="text-sm text-green-400 flex items-center gap-1">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            DeepSeek AI подключён
          </div>
        ) : (
          <div className="text-sm text-yellow-400 flex items-center gap-1">
            <span className="w-2 h-2 bg-yellow-400 rounded-full" />
            Базовый анализ
          </div>
        )}

        {/* Статус автотрейдера для премиум */}
        {advisor.tier === 'premium' && (
          <div className="mt-2 space-y-2">
            <div className={`text-sm flex items-center gap-2 ${autoTraderStats?.isPaused ? 'text-red-400' : advisor.autoTrading.enabled ? 'text-green-400' : 'text-slate-400'}`}>
              <span className={`w-2 h-2 rounded-full ${autoTraderStats?.isPaused ? 'bg-red-400' : advisor.autoTrading.enabled ? 'bg-green-400 animate-pulse' : 'bg-slate-500'}`} />
              {autoTraderStats?.isPaused ? (
                <>🛑 {autoTraderStats.pauseReason}</>
              ) : advisor.autoTrading.enabled ? (
                '🤖 Автотрейдер активен'
              ) : (
                '⏸️ Автотрейдер выключен'
              )}
            </div>

            {/* Статистика автотрейдера */}
            {advisor.autoTrading.enabled && autoTraderStats && (
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-slate-700 rounded p-2 text-center">
                    <div className="text-slate-400">Сделок/час</div>
                    <div className="font-bold">{autoTraderStats.tradesThisHour}/10</div>
                  </div>
                  <div className="bg-slate-700 rounded p-2 text-center">
                    <div className="text-slate-400">P/L</div>
                    <div className={`font-bold ${D(autoTraderStats.totalProfitLoss || '0').gte(0) ? 'text-green-400' : 'text-red-400'}`}>
                      {D(autoTraderStats.totalProfitLoss || '0').gte(0) ? '+' : ''}{formatNumber(D(autoTraderStats.totalProfitLoss || '0'))}
                    </div>
                  </div>
                  <div className="bg-slate-700 rounded p-2 text-center">
                    <div className="text-slate-400">Торг. капитал</div>
                    <div className="font-bold">{formatNumber(D(autoTraderStats.tradingCapital || '0'))}</div>
                  </div>
                </div>
                
                {/* Система защиты капитала */}
                {autoTraderStats.capitalProtectionActive && (
                  <div className="bg-slate-700/50 rounded p-2 space-y-1">
                    <div className="text-xs text-slate-400 flex items-center gap-1">
                      🛡️ Защита капитала
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-slate-400">Заморожено: </span>
                        <span className="text-cyan-400 font-medium">{formatNumber(D(autoTraderStats.frozenProfit || '0'))}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">До разморозки: </span>
                        <span className="text-amber-400 font-medium">
                          {formatNumber(D(autoTraderStats.tradingCapital || '0').mul(3).sub(D(autoTraderStats.frozenProfit || '0')).max(0))}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400">Убытки: </span>
                        <span className="text-red-400 font-medium">{formatNumber(D(autoTraderStats.accumulatedLoss || '0'))}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">На сбер.: </span>
                        <span className="text-green-400 font-medium">{formatNumber(D(autoTraderStats.totalSavedToSavings || '0'))}</span>
                      </div>
                    </div>
                    {/* Прогресс-бар до разморозки */}
                    {D(autoTraderStats.tradingCapital || '0').gt(0) && (
                      <div className="mt-1">
                        <div className="h-1.5 bg-slate-600 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-cyan-500 to-green-500 transition-all duration-300"
                            style={{ 
                              width: `${Math.min(100, D(autoTraderStats.frozenProfit || '0').div(D(autoTraderStats.tradingCapital || '1').mul(3)).mul(100).toNumber())}%` 
                            }}
                          />
                        </div>
                        <div className="text-xs text-slate-500 text-right mt-0.5">
                          {D(autoTraderStats.frozenProfit || '0').div(D(autoTraderStats.tradingCapital || '1').mul(3)).mul(100).toFixed(1)}% до 3x
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Кнопка сброса stop-loss */}
            {autoTraderStats?.isPaused && (
              <button
                type="button"
                onClick={resetStopLoss}
                className="w-full py-2 bg-orange-600 hover:bg-orange-700 rounded text-sm cursor-pointer transition-colors"
              >
                🔄 Сбросить Stop-Loss и продолжить
              </button>
            )}
          </div>
        )}
      </div>

      {/* Настройки автотрейдинга (premium) */}
      {showSettings && advisor.tier === 'premium' && (
        <div className="bg-slate-800 rounded-lg p-4">
          <h4 className="font-bold mb-3">⚙️ Настройки автоматической торговли</h4>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span>Автоторговля</span>
              <button
                type="button"
                onClick={() => updateAdvisorSettings({ enabled: !advisor.autoTrading.enabled })}
                className={`px-4 py-1 rounded transition-colors cursor-pointer ${
                  advisor.autoTrading.enabled ? 'bg-green-600' : 'bg-slate-600'
                }`}
              >
                {advisor.autoTrading.enabled ? 'ВКЛ' : 'ВЫКЛ'}
              </button>
            </div>

            <div>
              <label className="text-sm text-slate-400">Макс. инвестиция (% от баланса, макс 20K₡)</label>
              <input
                type="range"
                min="5"
                max="50"
                value={advisor.autoTrading.maxInvestmentPercent}
                onChange={(e) => updateAdvisorSettings({ maxInvestmentPercent: parseInt(e.target.value) })}
                className="w-full"
              />
              <div className="text-right text-sm">{advisor.autoTrading.maxInvestmentPercent}%</div>
            </div>

            <div>
              <label className="text-sm text-slate-400">Мин. уверенность AI</label>
              <input
                type="range"
                min="50"
                max="95"
                value={advisor.autoTrading.minConfidence * 100}
                onChange={(e) => updateAdvisorSettings({ minConfidence: parseInt(e.target.value) / 100 })}
                className="w-full"
              />
              <div className="text-right text-sm">{Math.round(advisor.autoTrading.minConfidence * 100)}%</div>
            </div>

            <div>
              <label className="text-sm text-slate-400">Толерантность к риску</label>
              <div className="flex gap-2 mt-1">
                {(['low', 'medium', 'high'] as const).map((risk) => (
                  <button
                    key={risk}
                    type="button"
                    onClick={() => updateAdvisorSettings({ riskTolerance: risk })}
                    className={`flex-1 py-1 rounded text-sm cursor-pointer transition-colors ${
                      advisor.autoTrading.riskTolerance === risk
                        ? risk === 'low'
                          ? 'bg-green-600'
                          : risk === 'medium'
                            ? 'bg-yellow-600'
                            : 'bg-red-600'
                        : 'bg-slate-700'
                    }`}
                  >
                    {risk === 'low' ? 'Низкий' : risk === 'medium' ? 'Средний' : 'Высокий'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={advisor.autoTrading.allowLoans}
                  onChange={(e) => updateAdvisorSettings({ allowLoans: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm">Разрешить кредиты</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={advisor.autoTrading.allowLending}
                  onChange={(e) => updateAdvisorSettings({ allowLending: e.target.checked })}
                  className="rounded"
                />
                <span className="text-sm">Разрешить выдачу кредитов</span>
              </label>
            </div>

            {/* Take-Profit и Stop-Loss */}
            <div className="border-t border-slate-600 pt-3 mt-2">
              <h5 className="text-sm font-medium mb-2">📈 Автоматическая фиксация</h5>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400">Take-Profit (фиксация прибыли)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="5"
                      max="30"
                      value={advisor.autoTrading.takeProfitPercent || 10}
                      onChange={(e) => updateAdvisorSettings({ takeProfitPercent: parseInt(e.target.value) })}
                      className="flex-1"
                    />
                    <span className="text-green-400 font-bold w-12 text-right">+{advisor.autoTrading.takeProfitPercent || 10}%</span>
                  </div>
                </div>
                
                <div>
                  <label className="text-xs text-slate-400">Stop-Loss (ограничение убытка)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="2"
                      max="15"
                      value={advisor.autoTrading.stopLossPercent || 5}
                      onChange={(e) => updateAdvisorSettings({ stopLossPercent: parseInt(e.target.value) })}
                      className="flex-1"
                    />
                    <span className="text-red-400 font-bold w-12 text-right">-{advisor.autoTrading.stopLossPercent || 5}%</span>
                  </div>
                </div>
              </div>
              
              <p className="text-xs text-slate-500 mt-2">
                Бот автоматически продаст акции/фонды при достижении указанного % прибыли или убытка
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Анализ рынка */}
      {marketAnalysis && (
        <div className="bg-slate-800 rounded-lg p-4">
          <h4 className="font-bold mb-3 flex items-center gap-2">
            📊 Анализ рынка
            {isLoadingAnalysis && <span className="animate-spin">⏳</span>}
          </h4>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-slate-700 rounded p-3 text-center">
              <div className="text-2xl mb-1">{getSentimentEmoji(marketAnalysis.overallSentiment)}</div>
              <div className="text-sm text-slate-400">Настроение</div>
              <div className="font-medium">{getSentimentText(marketAnalysis.overallSentiment)}</div>
            </div>

            <div className="bg-slate-700 rounded p-3 text-center">
              <div className="text-2xl mb-1">
                {marketAnalysis.creditRatePrediction.rateDirection === 'rising'
                  ? '📈'
                  : marketAnalysis.creditRatePrediction.rateDirection === 'falling'
                    ? '📉'
                    : '➡️'}
              </div>
              <div className="text-sm text-slate-400">Ставки</div>
              <div className="font-medium">
                {(marketAnalysis.creditRatePrediction.predictedBaseRate * 100).toFixed(1)}%
              </div>
            </div>

            <div className="bg-slate-700 rounded p-3 text-center">
              <div className="text-2xl mb-1">🕐</div>
              <div className="text-sm text-slate-400">Обновлено</div>
              <div className="font-medium text-sm">
                {new Date(marketAnalysis.generatedAt).toLocaleTimeString()}
              </div>
            </div>
          </div>

          <p className="text-sm text-slate-300 bg-slate-700 rounded p-3">{marketAnalysis.marketNarrative}</p>

          {/* Топ рекомендации */}
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div>
              <div className="text-sm text-green-400 font-medium mb-2">📈 Купить</div>
              {marketAnalysis.topBuyRecommendations.slice(0, 3).map((rec) => (
                <div key={rec.stockId} className="flex items-center justify-between text-sm py-1">
                  <span className="font-mono">{rec.symbol}</span>
                  <span className="text-green-400">+{rec.predictedChange.toFixed(1)}%</span>
                </div>
              ))}
            </div>
            <div>
              <div className="text-sm text-red-400 font-medium mb-2">📉 Продать</div>
              {marketAnalysis.topSellRecommendations.slice(0, 3).map((rec) => (
                <div key={rec.stockId} className="flex items-center justify-between text-sm py-1">
                  <span className="font-mono">{rec.symbol}</span>
                  <span className="text-red-400">{rec.predictedChange.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* AI Дивиденды */}
      {dividendPrediction && dividendPrediction.dividendUpdates.length > 0 && (
        <div className="bg-slate-800 rounded-lg p-4">
          <h4 className="font-bold mb-3 flex items-center gap-2">
            💰 AI Дивиденды
            <span
              className={`px-2 py-0.5 rounded text-xs ${
                dividendPrediction.source === 'ai' ? 'bg-green-600' : 'bg-slate-600'
              }`}
            >
              {dividendPrediction.source === 'ai' ? 'AI' : 'Базовые'}
            </span>
          </h4>

          <p className="text-sm text-slate-400 mb-3">{dividendPrediction.marketConditions}</p>

          <div className="space-y-2 max-h-48 overflow-y-auto">
            {dividendPrediction.dividendUpdates
              .filter((d) => d.newYield > 0)
              .sort((a, b) => b.newYield - a.newYield)
              .map((dividend) => {
                const stock = stocks.find((s) => s.id === dividend.stockId);
                return (
                  <div
                    key={dividend.stockId}
                    className="flex items-center justify-between bg-slate-700 rounded px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-blue-400">{stock?.symbol || dividend.stockId}</span>
                      {dividend.change === 'increased' && <span className="text-green-400">↑</span>}
                      {dividend.change === 'decreased' && <span className="text-red-400">↓</span>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`font-bold ${
                          dividend.newYield >= 0.03
                            ? 'text-green-400'
                            : dividend.newYield >= 0.01
                              ? 'text-yellow-400'
                              : 'text-slate-400'
                        }`}
                      >
                        {(dividend.newYield * 100).toFixed(1)}%
                      </span>
                      <span className="text-xs text-slate-500 max-w-32 truncate" title={dividend.reason}>
                        {dividend.reason}
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>

          <div className="text-xs text-slate-500 mt-2 text-right">
            Обновлено: {new Date(dividendPrediction.generatedAt).toLocaleTimeString()}
          </div>
        </div>
      )}

      {/* Рекомендации */}
      <div className="bg-slate-800 rounded-lg p-4">
        <h4 className="font-bold mb-3">💡 Рекомендации</h4>

        {recommendations.length === 0 ? (
          <div className="text-center text-slate-400 py-4">Анализируем рынок...</div>
        ) : (
          <div className="space-y-2">
            {recommendations.slice(0, 5).map((rec) => (
              <div
                key={rec.id}
                className={`bg-slate-700 rounded p-3 ${rec.executed ? 'opacity-50' : ''}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span>{getRecommendationIcon(rec.type)}</span>
                    <span className="font-medium">{getRecommendationText(rec.type)}</span>
                    <span className="font-mono text-blue-400">{rec.targetId.toUpperCase()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm ${
                        rec.confidence >= 0.8
                          ? 'text-green-400'
                          : rec.confidence >= 0.6
                            ? 'text-yellow-400'
                            : 'text-orange-400'
                      }`}
                    >
                      {Math.round(rec.confidence * 100)}%
                    </span>
                    {!rec.executed && (
                      <button
                        type="button"
                        onClick={() => handleExecute(rec)}
                        className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs cursor-pointer transition-colors"
                      >
                        Выполнить
                      </button>
                    )}
                    {rec.executed && (
                      <span className="text-green-400 text-xs">✓ Выполнено</span>
                    )}
                  </div>
                </div>
                <p className="text-sm text-slate-400">{rec.reasoning}</p>
                {rec.amount && (
                  <div className="text-sm text-slate-300 mt-1">
                    Сумма: {formatNumber(D(rec.amount))} ₡
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
