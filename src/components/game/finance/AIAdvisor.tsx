/**
 * AIAdvisor - Финансовый AI-помощник
 * Рекомендации по торговле и автоматический трейдинг
 */

import { memo, useState, useEffect } from 'react';
import { useAdvisorStore } from '../../../features/advisorStore';
import { useFinanceStore } from '../../../features/financeStore';
import { formatNumber, D } from '../../../core/math/format';
import { ADVISOR_PRICES } from '../../../core/gameTypes.ai';
import type { FinancialAdvisorTier, AdvisorRecommendation } from '../../../core/gameTypes.ai';
import { Alert, Badge, EmptyState, Field, Panel, Stat } from '../../ui';
import { GameIcon, IconText } from '../../ui/icons';

// memo: родительская FinancePanel рендерится на каждый тик, пропсов у компонента нет.
export const AIAdvisor = memo(AIAdvisorImpl);

function AIAdvisorImpl() {
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

  // Точечные подписки на finance-стор: раньше `useFinanceStore()` будил советника
  // на каждое изменение банка, кредитов и портфеля.
  const bankBalance = useFinanceStore((s) => s.bank.balance);
  const stocks = useFinanceStore((s) => s.stocks);
  const withdrawFromBank = useFinanceStore((s) => s.withdrawFromBank);

  // Функция сброса stop-loss
  const resetStopLoss = () => {
    useAdvisorStore.setState({
      autoTraderStats: {
        startingBalance: bankBalance, // Новый стартовый баланс
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
        <Panel title="🤖 AI Финансовый советник">
          <p className="text-slate-400 text-sm mb-4">
            Получайте рекомендации от искусственного интеллекта по торговле акциями, фондами и управлению
            кредитами.
          </p>

          {!aiEnabled && (
            <Alert tone="warning">
              <GameIcon icon="⚠️" /> DeepSeek AI не подключён. Будут использоваться базовые алгоритмы анализа.
            </Alert>
          )}
        </Panel>

        {/* Тарифы */}
        <div className="grid grid-cols-2 gap-4">
          {/* Базовый */}
          <div className="card border-2 border-blue-500">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl"><GameIcon icon="📊" /></span>
              <h4 className="font-bold">Базовый</h4>
            </div>
            <p className="text-slate-400 text-sm mb-3"><IconText>{ADVISOR_PRICES.basic.description}</IconText></p>
            <ul className="text-sm space-y-1 mb-4">
              <li className="flex items-center gap-2">
                <span className="text-green-400"><GameIcon icon="✓" /></span> Прогнозы рынка
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-400"><GameIcon icon="✓" /></span> Рекомендации по покупке/продаже
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-400"><GameIcon icon="✓" /></span> Анализ кредитных ставок
              </li>
              <li className="flex items-center gap-2 text-slate-500">
                <span><GameIcon icon="✗" /></span> Автоматическая торговля
              </li>
            </ul>
            <div className="font-mono text-lg font-bold tabular-nums text-blue-400 mb-2">
              {formatNumber(D(ADVISOR_PRICES.basic.credits))} ₡
            </div>
            <button
              type="button"
              onClick={() => handlePurchase('basic')}
              className="btn-info btn-block"
            >
              Купить
            </button>
          </div>

          {/* Премиум */}
          <div className="card border-2 border-purple-500">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl"><GameIcon icon="🚀" /></span>
              <h4 className="font-bold">Премиум</h4>
              <Badge className="text-purple-400">РЕКОМЕНДУЕМ</Badge>
            </div>
            <p className="text-slate-400 text-sm mb-3"><IconText>{ADVISOR_PRICES.premium.description}</IconText></p>
            <ul className="text-sm space-y-1 mb-4">
              <li className="flex items-center gap-2">
                <span className="text-green-400"><GameIcon icon="✓" /></span> Всё из базового
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-400"><GameIcon icon="✓" /></span> Автоматическая торговля
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-400"><GameIcon icon="✓" /></span> Арбитражные стратегии
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-400"><GameIcon icon="✓" /></span> Управление кредитами
              </li>
            </ul>
            <div className="font-mono text-lg font-bold tabular-nums text-purple-400 mb-2">
              {formatNumber(D(ADVISOR_PRICES.premium.credits))} ₡
            </div>
            <button
              type="button"
              onClick={() => handlePurchase('premium')}
              className="btn-block bg-purple-600 hover:bg-purple-700 btn"
            >
              Купить
            </button>
          </div>
        </div>

        <div className="text-center text-slate-500 text-sm">
          Баланс банковского счёта: <span className="font-mono tabular-nums">{formatNumber(D(bankBalance))}</span> ₡
        </div>
      </div>
    );
  }

  // Активный советник
  return (
    <div className="space-y-4">
      {/* Заголовок */}
      <Panel
        title={
          <span className="flex items-center gap-2">
            <GameIcon icon="🤖" /> AI Советник
            <Badge tone={advisor.tier === 'premium' ? 'accent' : 'info'}>
              {advisor.tier === 'premium' ? 'ПРЕМИУМ' : 'БАЗОВЫЙ'}
            </Badge>
          </span>
        }
        actions={
          <>
            {advisor.tier === 'basic' && (
              <button type="button" onClick={handleUpgrade} className="btn btn-xs">
                <GameIcon icon="⬆️" /> Апгрейд до Премиум ({formatNumber(D(ADVISOR_PRICES.premium.credits).sub(D(ADVISOR_PRICES.basic.credits)))} ₡)
              </button>
            )}
            {advisor.tier === 'premium' && (
              <button
                type="button"
                onClick={() => setShowSettings(!showSettings)}
                aria-expanded={showSettings}
                className="btn btn-xs"
              >
                <GameIcon icon="⚙️" /> Настройки
              </button>
            )}
          </>
        }
      >
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
                <><GameIcon icon="🛑" /> {autoTraderStats.pauseReason}</>
              ) : advisor.autoTrading.enabled ? (
                '🤖 Автотрейдер активен'
              ) : (
                '⏸️ Автотрейдер выключен'
              )}
            </div>

            {/* Статистика автотрейдера */}
            {advisor.autoTrading.enabled && autoTraderStats && (
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <div className="card">
                    <Stat
                      label="Сделок/час"
                      value={`${autoTraderStats.tradesThisHour}/10`}
                      align="center"
                    />
                  </div>
                  <div className="card">
                    <Stat
                      label="P/L"
                      value={`${D(autoTraderStats.totalProfitLoss || '0').gte(0) ? '+' : ''}${formatNumber(D(autoTraderStats.totalProfitLoss || '0'))}`}
                      tone={D(autoTraderStats.totalProfitLoss || '0').gte(0) ? 'accent' : 'danger'}
                      align="center"
                    />
                  </div>
                  <div className="card">
                    <Stat
                      label="Торг. капитал"
                      value={formatNumber(D(autoTraderStats.tradingCapital || '0'))}
                      align="center"
                    />
                  </div>
                </div>

                {/* Система защиты капитала */}
                {autoTraderStats.capitalProtectionActive && (
                  <div className="card space-y-1">
                    <div className="stat-label flex items-center gap-1">
                      <GameIcon icon="🛡️" /> Защита капитала
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-slate-400">Заморожено: </span>
                        <span className="font-mono tabular-nums text-cyan-400 font-medium">{formatNumber(D(autoTraderStats.frozenProfit || '0'))}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">До разморозки: </span>
                        <span className="font-mono tabular-nums text-amber-400 font-medium">
                          {formatNumber(D(autoTraderStats.tradingCapital || '0').mul(3).sub(D(autoTraderStats.frozenProfit || '0')).max(0))}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400">Убытки: </span>
                        <span className="font-mono tabular-nums text-red-400 font-medium">{formatNumber(D(autoTraderStats.accumulatedLoss || '0'))}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">На сбер.: </span>
                        <span className="font-mono tabular-nums text-green-400 font-medium">{formatNumber(D(autoTraderStats.totalSavedToSavings || '0'))}</span>
                      </div>
                    </div>
                    {/* Прогресс-бар до разморозки. Дорожка .meter, но заливка —
                        двухцветный градиент, которого нет среди тонов <Meter>. */}
                    {D(autoTraderStats.tradingCapital || '0').gt(0) && (
                      <div className="mt-1">
                        <div className="meter">
                          <div
                            className="meter-fill bg-gradient-to-r from-cyan-500 to-green-500"
                            style={{
                              width: `${Math.min(100, D(autoTraderStats.frozenProfit || '0').div(D(autoTraderStats.tradingCapital || '1').mul(3)).mul(100).toNumber())}%`
                            }}
                          />
                        </div>
                        <div className="font-mono text-xs tabular-nums text-slate-500 text-right mt-0.5">
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
              <button type="button" onClick={resetStopLoss} className="btn btn-block">
                <GameIcon icon="🔄" /> Сбросить Stop-Loss и продолжить
              </button>
            )}
          </div>
        )}
      </Panel>

      {/* Настройки автотрейдинга (premium) */}
      {showSettings && advisor.tier === 'premium' && (
        <Panel title="⚙️ Настройки автоматической торговли">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span>Автоторговля</span>
              <button
                type="button"
                onClick={() => updateAdvisorSettings({ enabled: !advisor.autoTrading.enabled })}
                aria-pressed={advisor.autoTrading.enabled}
                className={advisor.autoTrading.enabled ? 'btn-primary btn-xs' : 'btn btn-xs'}
              >
                {advisor.autoTrading.enabled ? 'ВКЛ' : 'ВЫКЛ'}
              </button>
            </div>

            <Field
              label="Макс. инвестиция (% от баланса, макс 20K₡)"
              hint={<span className="font-mono tabular-nums">{advisor.autoTrading.maxInvestmentPercent}%</span>}
            >
              <input
                type="range"
                min="5"
                max="50"
                value={advisor.autoTrading.maxInvestmentPercent}
                onChange={(e) => updateAdvisorSettings({ maxInvestmentPercent: parseInt(e.target.value) })}
                className="w-full"
              />
            </Field>

            <Field
              label="Мин. уверенность AI"
              hint={<span className="font-mono tabular-nums">{Math.round(advisor.autoTrading.minConfidence * 100)}%</span>}
            >
              <input
                type="range"
                min="50"
                max="95"
                value={advisor.autoTrading.minConfidence * 100}
                onChange={(e) => updateAdvisorSettings({ minConfidence: parseInt(e.target.value) / 100 })}
                className="w-full"
              />
            </Field>

            <div>
              <span className="stat-label">Толерантность к риску</span>
              <div className="flex gap-2 mt-1">
                {(['low', 'medium', 'high'] as const).map((risk) => (
                  <button
                    key={risk}
                    type="button"
                    onClick={() => updateAdvisorSettings({ riskTolerance: risk })}
                    aria-pressed={advisor.autoTrading.riskTolerance === risk}
                    className={`flex-1 btn btn-xs ${
                      advisor.autoTrading.riskTolerance === risk
                        ? risk === 'low'
                          ? 'bg-green-600 border-green-600'
                          : risk === 'medium'
                            ? 'bg-yellow-600 border-yellow-600'
                            : 'bg-red-600 border-red-600'
                        : ''
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
            <div className="divider" />
            <div>
              <h5 className="text-sm font-medium mb-2"><GameIcon icon="📈" /> Автоматическая фиксация</h5>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Take-Profit (фиксация прибыли)">
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="5"
                      max="30"
                      value={advisor.autoTrading.takeProfitPercent || 10}
                      onChange={(e) => updateAdvisorSettings({ takeProfitPercent: parseInt(e.target.value) })}
                      className="flex-1"
                    />
                    <span className="font-mono tabular-nums text-green-400 font-bold w-12 text-right">+{advisor.autoTrading.takeProfitPercent || 10}%</span>
                  </div>
                </Field>

                <Field label="Stop-Loss (ограничение убытка)">
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="2"
                      max="15"
                      value={advisor.autoTrading.stopLossPercent || 5}
                      onChange={(e) => updateAdvisorSettings({ stopLossPercent: parseInt(e.target.value) })}
                      className="flex-1"
                    />
                    <span className="font-mono tabular-nums text-red-400 font-bold w-12 text-right">-{advisor.autoTrading.stopLossPercent || 5}%</span>
                  </div>
                </Field>
              </div>

              <p className="text-xs text-slate-500 mt-2">
                Бот автоматически продаст акции/фонды при достижении указанного % прибыли или убытка
              </p>
            </div>
          </div>
        </Panel>
      )}

      {/* Анализ рынка */}
      {marketAnalysis && (
        <Panel
          title={
            <span className="flex items-center gap-2">
              <GameIcon icon="📊" /> Анализ рынка
              {isLoadingAnalysis && <span className="animate-spin"><GameIcon icon="⏳" /></span>}
            </span>
          }
        >
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="card text-center">
              <div className="text-2xl mb-1"><GameIcon icon={getSentimentEmoji(marketAnalysis.overallSentiment)} /></div>
              <Stat
                label="Настроение"
                value={getSentimentText(marketAnalysis.overallSentiment)}
                align="center"
              />
            </div>

            <div className="card text-center">
              <div className="text-2xl mb-1">
                <IconText>{marketAnalysis.creditRatePrediction.rateDirection === 'rising'
                  ? '📈'
                  : marketAnalysis.creditRatePrediction.rateDirection === 'falling'
                    ? '📉'
                    : '➡️'}</IconText>
              </div>
              <Stat
                label="Ставки"
                value={`${(marketAnalysis.creditRatePrediction.predictedBaseRate * 100).toFixed(1)}%`}
                align="center"
              />
            </div>

            <div className="card text-center">
              <div className="text-2xl mb-1"><GameIcon icon="🕐" /></div>
              <Stat
                label="Обновлено"
                value={new Date(marketAnalysis.generatedAt).toLocaleTimeString()}
                align="center"
              />
            </div>
          </div>

          <p className="card text-sm text-slate-300">{marketAnalysis.marketNarrative}</p>

          {/* Топ рекомендации */}
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div>
              <div className="text-sm text-green-400 font-medium mb-2"><GameIcon icon="📈" /> Купить</div>
              {marketAnalysis.topBuyRecommendations.slice(0, 3).map((rec) => (
                <div key={rec.stockId} className="flex items-center justify-between text-sm py-1">
                  <span className="font-mono">{rec.symbol}</span>
                  <span className="font-mono tabular-nums text-green-400">+{rec.predictedChange.toFixed(1)}%</span>
                </div>
              ))}
            </div>
            <div>
              <div className="text-sm text-red-400 font-medium mb-2"><GameIcon icon="📉" /> Продать</div>
              {marketAnalysis.topSellRecommendations.slice(0, 3).map((rec) => (
                <div key={rec.stockId} className="flex items-center justify-between text-sm py-1">
                  <span className="font-mono">{rec.symbol}</span>
                  <span className="font-mono tabular-nums text-red-400">{rec.predictedChange.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      )}

      {/* AI Дивиденды */}
      {dividendPrediction && dividendPrediction.dividendUpdates.length > 0 && (
        <Panel
          title={
            <span className="flex items-center gap-2">
              <GameIcon icon="💰" /> AI Дивиденды
              <Badge tone={dividendPrediction.source === 'ai' ? 'accent' : 'neutral'}>
                {dividendPrediction.source === 'ai' ? 'AI' : 'Базовые'}
              </Badge>
            </span>
          }
        >
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
                    className="flex items-center justify-between card py-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-blue-400">{stock?.symbol || dividend.stockId}</span>
                      {dividend.change === 'increased' && <span className="text-green-400"><GameIcon icon="↑" /></span>}
                      {dividend.change === 'decreased' && <span className="text-red-400"><GameIcon icon="↓" /></span>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`font-mono font-bold tabular-nums ${
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
                        <IconText>{dividend.reason}</IconText>
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>

          <div className="text-xs text-slate-500 mt-2 text-right">
            Обновлено: <span className="font-mono tabular-nums">{new Date(dividendPrediction.generatedAt).toLocaleTimeString()}</span>
          </div>
        </Panel>
      )}

      {/* Рекомендации */}
      <Panel title="💡 Рекомендации">
        {recommendations.length === 0 ? (
          <EmptyState title="Анализируем рынок..." icon={<span className="animate-spin text-lg"><GameIcon icon="⏳" /></span>} />
        ) : (
          <div className="space-y-2">
            {recommendations.slice(0, 5).map((rec) => (
              <div
                key={rec.id}
                className={`card ${rec.executed ? 'opacity-50' : ''}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span><GameIcon icon={getRecommendationIcon(rec.type)} /></span>
                    <span className="font-medium">{getRecommendationText(rec.type)}</span>
                    <span className="font-mono text-blue-400">{rec.targetId.toUpperCase()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-mono text-sm tabular-nums ${
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
                        className="btn-info btn-xs"
                      >
                        Выполнить
                      </button>
                    )}
                    {rec.executed && (
                      <span className="text-green-400 text-xs"><GameIcon icon="✓" /> Выполнено</span>
                    )}
                  </div>
                </div>
                <p className="text-sm text-slate-400">{rec.reasoning}</p>
                {rec.amount && (
                  <div className="text-sm text-slate-300 mt-1">
                    Сумма: <span className="font-mono tabular-nums">{formatNumber(D(rec.amount))}</span> ₡
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
