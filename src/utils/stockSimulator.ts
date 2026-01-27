/**
 * Симулятор цен акций
 * Фаза 6: Реалистичная симуляция движения цен на фондовом рынке
 */

import Decimal from 'break_eternity.js';
import type { Stock, InvestmentFund } from '../core/gameTypes.finance';
import type { DataPoint } from '../core/gameTypes.analytics';
import { VOLATILITY_MULTIPLIERS, type StockDefinition } from '../core/constants/stocks';
import { FINANCE_CONFIG } from '../core/gameTypes.finance';
import { D } from '../core/math/format';

/**
 * Генерирует случайное число в диапазоне
 */
function randomInRange(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

/**
 * Генерирует случайное нормальное распределение (Box-Muller)
 */
function randomNormal(mean: number = 0, stdDev: number = 1): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return z * stdDev + mean;
}

/**
 * Обновляет цену одной акции
 */
export function updateStockPrice(stock: Stock): Stock {
  const volatilityConfig = VOLATILITY_MULTIPLIERS[stock.volatility];
  const currentPrice = D(stock.currentPrice);
  const basePrice = D(stock.basePrice);
  
  // Генерируем случайное изменение на основе волатильности
  const randomChange = randomNormal(0, volatilityConfig.trend);
  
  // Добавляем тренд (mean reversion к базовой цене)
  const priceRatio = currentPrice.div(basePrice).toNumber();
  const meanReversionForce = (1 - priceRatio) * 0.01; // Тянет к базовой цене
  
  // Обновляем тренд с небольшим случайным изменением
  let newTrend = stock.trend + randomNormal(0, 0.1);
  newTrend = Math.max(-1, Math.min(1, newTrend)); // Ограничиваем -1 до 1
  
  // Итоговое изменение цены
  const trendEffect = newTrend * volatilityConfig.trend;
  const totalChange = randomChange + meanReversionForce + trendEffect;
  
  // Применяем ограничения волатильности
  const changeMultiplier = Math.max(
    volatilityConfig.min,
    Math.min(volatilityConfig.max, 1 + totalChange)
  );
  
  // Рассчитываем новую цену
  let newPrice = currentPrice.mul(changeMultiplier);
  
  // Минимальная цена = 10% от базовой
  const minPrice = basePrice.mul(0.1);
  if (newPrice.lt(minPrice)) {
    newPrice = minPrice;
  }
  
  // Максимальная цена = 1000% от базовой
  const maxPrice = basePrice.mul(10);
  if (newPrice.gt(maxPrice)) {
    newPrice = maxPrice;
  }
  
  // Рассчитываем изменение за день
  const previousClose = D(stock.previousClose);
  const dayChange = newPrice.sub(previousClose).div(previousClose).mul(100).toNumber();
  
  // Обновляем объём (случайный, зависит от волатильности)
  const baseVolume = D(stock.marketCap).div(D(stock.basePrice)).mul(0.01);
  const volumeMultiplier = randomInRange(0.5, 2.0);
  const newVolume = baseVolume.mul(volumeMultiplier);
  
  // Добавляем точку в историю цен
  const now = Date.now();
  const newPriceHistory = [...stock.priceHistory];
  newPriceHistory.push({ timestamp: now, value: newPrice.toString() });
  
  // Ограничиваем историю
  if (newPriceHistory.length > FINANCE_CONFIG.MAX_PRICE_HISTORY_POINTS) {
    newPriceHistory.shift();
  }
  
  return {
    ...stock,
    currentPrice: newPrice.toString(),
    dayChange,
    volume: newVolume.toString(),
    trend: newTrend,
    priceHistory: newPriceHistory,
  };
}

/**
 * Обновляет цены всех акций
 */
export function updateAllStockPrices(stocks: Stock[]): Stock[] {
  return stocks.map(updateStockPrice);
}

/**
 * Сбрасывает previousClose в конце торгового дня
 */
export function resetDailyPrices(stocks: Stock[]): Stock[] {
  return stocks.map(stock => ({
    ...stock,
    previousClose: stock.currentPrice,
    dayChange: 0,
    volume: '0',
  }));
}

/**
 * Применяет рыночное событие к акциям
 */
export interface MarketEvent {
  type: 'sector_boom' | 'sector_crash' | 'market_rally' | 'market_crash' | 'company_news';
  sector?: string;
  stockId?: string;
  magnitude: number; // -1 to 1
  description: string;
}

export function applyMarketEvent(stocks: Stock[], event: MarketEvent): Stock[] {
  return stocks.map(stock => {
    let affected = false;
    
    if (event.type === 'market_rally' || event.type === 'market_crash') {
      affected = true;
    } else if ((event.type === 'sector_boom' || event.type === 'sector_crash') && stock.sector === event.sector) {
      affected = true;
    } else if (event.type === 'company_news' && stock.id === event.stockId) {
      affected = true;
    }
    
    if (!affected) return stock;
    
    const currentPrice = D(stock.currentPrice);
    const change = 1 + (event.magnitude * 0.15); // До ±15% изменения
    const newPrice = currentPrice.mul(change);
    
    const previousClose = D(stock.previousClose);
    const dayChange = newPrice.sub(previousClose).div(previousClose).mul(100).toNumber();
    
    return {
      ...stock,
      currentPrice: newPrice.toString(),
      dayChange,
    };
  });
}

/**
 * Генерирует случайное рыночное событие
 */
export function generateRandomMarketEvent(stocks: Stock[]): MarketEvent | null {
  const chance = Math.random();
  
  // 5% шанс события каждое обновление
  if (chance > 0.05) return null;
  
  const eventType = Math.random();
  
  if (eventType < 0.15) {
    // Рыночное ралли
    return {
      type: 'market_rally',
      magnitude: randomInRange(0.02, 0.08),
      description: 'Общий рост рынка на фоне позитивных экономических данных',
    };
  } else if (eventType < 0.30) {
    // Рыночное падение
    return {
      type: 'market_crash',
      magnitude: randomInRange(-0.10, -0.03),
      description: 'Падение рынка из-за неопределённости',
    };
  } else if (eventType < 0.50) {
    // Секторный бум
    const sectors = ['energy', 'mining', 'technology', 'manufacturing', 'aerospace', 'biotech'];
    const sector = sectors[Math.floor(Math.random() * sectors.length)];
    return {
      type: 'sector_boom',
      sector,
      magnitude: randomInRange(0.05, 0.12),
      description: `Рост сектора ${sector} на фоне позитивных новостей`,
    };
  } else if (eventType < 0.70) {
    // Секторное падение
    const sectors = ['energy', 'mining', 'technology', 'manufacturing', 'aerospace', 'biotech'];
    const sector = sectors[Math.floor(Math.random() * sectors.length)];
    return {
      type: 'sector_crash',
      sector,
      magnitude: randomInRange(-0.15, -0.05),
      description: `Падение сектора ${sector} из-за регуляторных проблем`,
    };
  } else {
    // Новости компании
    const randomStock = stocks[Math.floor(Math.random() * stocks.length)];
    const isPositive = Math.random() > 0.5;
    return {
      type: 'company_news',
      stockId: randomStock.id,
      magnitude: isPositive ? randomInRange(0.05, 0.20) : randomInRange(-0.25, -0.08),
      description: isPositive 
        ? `${randomStock.name}: позитивный квартальный отчёт`
        : `${randomStock.name}: неожиданные убытки`,
    };
  }
}

/**
 * Обновляет NAV инвестиционного фонда на основе цен акций
 */
export function updateFundNav(fund: InvestmentFund, stocks: Stock[]): InvestmentFund {
  // Рассчитываем взвешенное изменение на основе состава
  let totalChange = D(0);
  
  for (const component of fund.composition) {
    const stock = stocks.find(s => s.id === component.stockId);
    if (!stock) continue;
    
    const stockPrice = D(stock.currentPrice);
    const basePrice = D(stock.basePrice);
    const change = stockPrice.div(basePrice).sub(1);
    
    totalChange = totalChange.add(change.mul(component.weight));
  }
  
  // Применяем ожидаемую годовую доходность (очень маленькая часть за обновление)
  const updateInterval = FINANCE_CONFIG.STOCK_UPDATE_INTERVAL_MS;
  const yearMs = 365 * 24 * 60 * 60 * 1000;
  const periodsPerYear = yearMs / updateInterval;
  const expectedReturnPerPeriod = fund.annualReturn / periodsPerYear;
  
  // Новый NAV = начальный NAV * (1 + изменение акций + ожидаемая доходность)
  const currentNav = D(fund.navPerShare);
  const changeMultiplier = D(1).add(totalChange.mul(0.1)).add(expectedReturnPerPeriod);
  
  // Вычитаем комиссию за управление
  const feePerPeriod = fund.managementFee / periodsPerYear;
  const newNav = currentNav.mul(changeMultiplier).mul(1 - feePerPeriod);
  
  // Минимальный NAV
  const minNav = D(10);
  const finalNav = newNav.lt(minNav) ? minNav : newNav;
  
  // Обновляем историю NAV
  const now = Date.now();
  const newNavHistory = [...fund.navHistory];
  newNavHistory.push({ timestamp: now, value: finalNav.toString() });
  
  if (newNavHistory.length > FINANCE_CONFIG.MAX_PRICE_HISTORY_POINTS) {
    newNavHistory.shift();
  }
  
  return {
    ...fund,
    navPerShare: finalNav.toString(),
    navHistory: newNavHistory,
  };
}

/**
 * Обновляет NAV всех фондов
 */
export function updateAllFundNavs(funds: InvestmentFund[], stocks: Stock[]): InvestmentFund[] {
  return funds.map(fund => updateFundNav(fund, stocks));
}

/**
 * Рассчитывает дивиденды для позиции
 */
export function calculateDividends(
  position: { stockId: string; shares: string },
  stock: Stock
): Decimal {
  if (stock.dividendYield <= 0) return D(0);
  
  const shares = D(position.shares);
  const price = D(stock.currentPrice);
  const positionValue = shares.mul(price);
  
  // Дивиденды выплачиваются раз в неделю, годовая доходность делится на 52
  const weeklyYield = stock.dividendYield / 52;
  
  return positionValue.mul(weeklyYield);
}

/**
 * Получает статистику за период
 */
export function getStockStats(stock: Stock, periodMs: number): {
  high: string;
  low: string;
  change: number;
  avgVolume: string;
} {
  const now = Date.now();
  const cutoff = now - periodMs;
  
  const relevantHistory = stock.priceHistory.filter(p => p.timestamp >= cutoff);
  
  if (relevantHistory.length === 0) {
    return {
      high: stock.currentPrice,
      low: stock.currentPrice,
      change: 0,
      avgVolume: stock.volume,
    };
  }
  
  let high = D(relevantHistory[0].value);
  let low = D(relevantHistory[0].value);
  
  for (const point of relevantHistory) {
    const price = D(point.value);
    if (price.gt(high)) high = price;
    if (price.lt(low)) low = price;
  }
  
  const startPrice = D(relevantHistory[0].value);
  const endPrice = D(stock.currentPrice);
  const change = endPrice.sub(startPrice).div(startPrice).mul(100).toNumber();
  
  return {
    high: high.toString(),
    low: low.toString(),
    change,
    avgVolume: stock.volume,
  };
}

/**
 * Рассчитывает технические индикаторы
 */
export function calculateTechnicalIndicators(stock: Stock): {
  sma20: string | null;
  sma50: string | null;
  rsi: number | null;
  trend: 'bullish' | 'bearish' | 'neutral';
} {
  const history = stock.priceHistory;
  
  // SMA 20
  let sma20: string | null = null;
  if (history.length >= 20) {
    const last20 = history.slice(-20);
    const sum = last20.reduce((acc, p) => acc.add(D(p.value)), D(0));
    sma20 = sum.div(20).toString();
  }
  
  // SMA 50
  let sma50: string | null = null;
  if (history.length >= 50) {
    const last50 = history.slice(-50);
    const sum = last50.reduce((acc, p) => acc.add(D(p.value)), D(0));
    sma50 = sum.div(50).toString();
  }
  
  // RSI (упрощённый)
  let rsi: number | null = null;
  if (history.length >= 14) {
    const last14 = history.slice(-14);
    let gains = 0;
    let losses = 0;
    
    for (let i = 1; i < last14.length; i++) {
      const change = D(last14[i].value).sub(D(last14[i-1].value)).toNumber();
      if (change > 0) gains += change;
      else losses -= change;
    }
    
    const avgGain = gains / 14;
    const avgLoss = losses / 14;
    
    if (avgLoss === 0) rsi = 100;
    else {
      const rs = avgGain / avgLoss;
      rsi = 100 - (100 / (1 + rs));
    }
  }
  
  // Определяем тренд
  let trend: 'bullish' | 'bearish' | 'neutral' = 'neutral';
  if (sma20 && sma50) {
    const currentPrice = D(stock.currentPrice);
    const sma20Dec = D(sma20);
    const sma50Dec = D(sma50);
    
    if (currentPrice.gt(sma20Dec) && sma20Dec.gt(sma50Dec)) {
      trend = 'bullish';
    } else if (currentPrice.lt(sma20Dec) && sma20Dec.lt(sma50Dec)) {
      trend = 'bearish';
    }
  }
  
  return { sma20, sma50, rsi, trend };
}
