/**
 * Офлайн-трейдинг модуль
 * Симулирует работу автотрейдера пока пользователь не в игре
 */

import { getOracleData, getFallbackMarketPrediction, getFallbackRecommendations } from './ai-oracle.js';

// Конфигурация офлайн-трейдинга
const OFFLINE_CONFIG = {
  // Максимальное время офлайн для симуляции (24 часа)
  maxOfflineHours: 24,
  
  // Минимальное время офлайн для начисления (5 минут)
  minOfflineMinutes: 5,
  
  // Количество симулируемых "торговых сессий" в час
  tradesPerHour: 2,
  
  // Коэффициент эффективности офлайн-торговли (80% от онлайн)
  // Это мотивирует играть онлайн
  efficiencyMultiplier: 0.8,
  
  // Максимальный % от баланса за одну сделку
  maxTradePercent: 5,
  
  // Шанс успешной сделки базовый
  baseSuccessChance: 0.6,
};

/**
 * Инициализация таблиц офлайн-трейдинга
 */
async function initOfflineTradingTables(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS offline_trading_state (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      slot_id INTEGER REFERENCES game_slots(id) ON DELETE CASCADE,
      autotrader_enabled BOOLEAN DEFAULT false,
      risk_tolerance TEXT DEFAULT 'balanced',
      max_investment_percent DECIMAL DEFAULT 10,
      take_profit_percent DECIMAL DEFAULT 10,
      stop_loss_percent DECIMAL DEFAULT 5,
      portfolio_snapshot JSONB DEFAULT '[]',
      balance_snapshot TEXT DEFAULT '0',
      last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_offline_calc_at TIMESTAMPTZ,
      total_offline_profit TEXT DEFAULT '0',
      total_offline_trades INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, slot_id)
    );
  `);
  
  await pool.query(`
    CREATE TABLE IF NOT EXISTS offline_trading_logs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      slot_id INTEGER REFERENCES game_slots(id) ON DELETE CASCADE,
      offline_start TIMESTAMPTZ NOT NULL,
      offline_end TIMESTAMPTZ NOT NULL,
      offline_duration_minutes INTEGER NOT NULL,
      trades_executed INTEGER DEFAULT 0,
      total_profit TEXT DEFAULT '0',
      details JSONB DEFAULT '[]',
      ai_predictions_used JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_offline_trading_user ON offline_trading_state(user_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_offline_trading_slot ON offline_trading_state(slot_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_offline_logs_user ON offline_trading_logs(user_id);`);
  
  console.log('[Offline Trading] Tables initialized');
}

/**
 * Сохранение состояния при выходе пользователя
 */
async function saveOfflineState(pool, userId, slotId, state) {
  const {
    autotraderEnabled,
    riskTolerance,
    maxInvestmentPercent,
    takeProfitPercent,
    stopLossPercent,
    portfolio,
    balance,
  } = state;
  
  await pool.query(`
    INSERT INTO offline_trading_state 
      (user_id, slot_id, autotrader_enabled, risk_tolerance, max_investment_percent,
       take_profit_percent, stop_loss_percent, portfolio_snapshot, balance_snapshot, last_activity_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
    ON CONFLICT (user_id, slot_id) DO UPDATE SET
      autotrader_enabled = EXCLUDED.autotrader_enabled,
      risk_tolerance = EXCLUDED.risk_tolerance,
      max_investment_percent = EXCLUDED.max_investment_percent,
      take_profit_percent = EXCLUDED.take_profit_percent,
      stop_loss_percent = EXCLUDED.stop_loss_percent,
      portfolio_snapshot = EXCLUDED.portfolio_snapshot,
      balance_snapshot = EXCLUDED.balance_snapshot,
      last_activity_at = NOW(),
      updated_at = NOW()
  `, [
    userId,
    slotId,
    autotraderEnabled || false,
    riskTolerance || 'balanced',
    maxInvestmentPercent || 10,
    takeProfitPercent || 10,
    stopLossPercent || 5,
    JSON.stringify(portfolio || []),
    String(balance || '0'),
  ]);
}

/**
 * Обновление времени активности (heartbeat)
 */
async function updateActivityTime(pool, userId, slotId) {
  await pool.query(`
    UPDATE offline_trading_state 
    SET last_activity_at = NOW(), updated_at = NOW()
    WHERE user_id = $1 AND slot_id = $2
  `, [userId, slotId]);
}

/**
 * Симуляция офлайн-торговли
 */
function simulateOfflineTrades(config, predictions, offlineMinutes) {
  const {
    riskTolerance,
    maxInvestmentPercent,
    takeProfitPercent,
    stopLossPercent,
    balance,
  } = config;
  
  // Ограничиваем время офлайн
  const cappedMinutes = Math.min(offlineMinutes, OFFLINE_CONFIG.maxOfflineHours * 60);
  const hours = cappedMinutes / 60;
  
  // Количество торговых сессий
  const tradeSessions = Math.floor(hours * OFFLINE_CONFIG.tradesPerHour);
  
  if (tradeSessions === 0) {
    return { trades: [], totalProfit: 0, tradesExecuted: 0 };
  }
  
  const balanceNum = parseFloat(balance) || 0;
  if (balanceNum < 100) {
    return { trades: [], totalProfit: 0, tradesExecuted: 0 };
  }
  
  // Получаем рекомендации для профиля риска
  const recommendations = predictions?.recommendations?.[riskTolerance] || 
                          predictions?.recommendations?.balanced || 
                          getFallbackRecommendations()[riskTolerance] || [];
  
  // Рассчитываем параметры на основе риска
  const riskParams = {
    conservative: { successChance: 0.75, avgReturn: 0.02, maxLoss: 0.01 },
    balanced: { successChance: 0.65, avgReturn: 0.04, maxLoss: 0.02 },
    aggressive: { successChance: 0.55, avgReturn: 0.08, maxLoss: 0.04 },
  };
  
  const params = riskParams[riskTolerance] || riskParams.balanced;
  
  const trades = [];
  let totalProfit = 0;
  let currentBalance = balanceNum;
  
  for (let i = 0; i < tradeSessions && i < 48; i++) { // Максимум 48 сделок (24 часа)
    // Размер сделки
    const tradePercent = Math.min(maxInvestmentPercent, OFFLINE_CONFIG.maxTradePercent);
    const tradeAmount = currentBalance * (tradePercent / 100);
    
    if (tradeAmount < 10) continue; // Минимальная сделка
    
    // Симуляция результата
    const isSuccess = Math.random() < params.successChance;
    const returnPercent = isSuccess 
      ? params.avgReturn * (0.5 + Math.random()) // 50-150% от среднего
      : -params.maxLoss * (0.5 + Math.random() * 0.5); // 50-100% от макс. убытка
    
    // Применяем коэффициент офлайн-эффективности
    const adjustedReturn = returnPercent * OFFLINE_CONFIG.efficiencyMultiplier;
    const profit = tradeAmount * adjustedReturn;
    
    // Take-profit / Stop-loss
    const cappedProfit = Math.max(
      -tradeAmount * (stopLossPercent / 100),
      Math.min(profit, tradeAmount * (takeProfitPercent / 100))
    );
    
    totalProfit += cappedProfit;
    currentBalance += cappedProfit;
    
    // Выбираем случайную рекомендацию для описания
    const rec = recommendations[i % recommendations.length] || { targetId: 'mixed', type: 'buy_stock' };
    
    trades.push({
      session: i + 1,
      type: isSuccess ? 'profit' : 'loss',
      asset: rec.targetId || 'mixed',
      action: rec.type || 'trade',
      amount: tradeAmount.toFixed(2),
      profit: cappedProfit.toFixed(2),
      returnPercent: (adjustedReturn * 100).toFixed(2),
    });
  }
  
  return {
    trades,
    totalProfit: totalProfit * OFFLINE_CONFIG.efficiencyMultiplier, // Ещё раз применяем коэффициент
    tradesExecuted: trades.length,
  };
}

/**
 * Расчёт офлайн-прибыли при входе пользователя
 */
async function calculateOfflineProfit(pool, userId, slotId) {
  // Получаем состояние офлайн-торговли
  const stateResult = await pool.query(`
    SELECT * FROM offline_trading_state 
    WHERE user_id = $1 AND slot_id = $2
  `, [userId, slotId]);
  
  if (stateResult.rowCount === 0) {
    return { hasOfflineProfit: false, reason: 'no_state' };
  }
  
  const state = stateResult.rows[0];
  
  // Проверяем, включён ли автотрейдер
  if (!state.autotrader_enabled) {
    return { hasOfflineProfit: false, reason: 'autotrader_disabled' };
  }
  
  // Рассчитываем время офлайн
  const lastActivity = new Date(state.last_activity_at);
  const now = new Date();
  const offlineMs = now.getTime() - lastActivity.getTime();
  const offlineMinutes = Math.floor(offlineMs / (1000 * 60));
  
  // Проверяем минимальное время
  if (offlineMinutes < OFFLINE_CONFIG.minOfflineMinutes) {
    return { 
      hasOfflineProfit: false, 
      reason: 'too_short',
      offlineMinutes,
      minRequired: OFFLINE_CONFIG.minOfflineMinutes,
    };
  }
  
  // Получаем AI-прогнозы
  let predictions;
  try {
    const oracleData = await getOracleData(pool, 'recommendations');
    predictions = { recommendations: oracleData.data };
  } catch (e) {
    predictions = { recommendations: getFallbackRecommendations() };
  }
  
  // Симулируем торговлю
  const config = {
    riskTolerance: state.risk_tolerance,
    maxInvestmentPercent: parseFloat(state.max_investment_percent),
    takeProfitPercent: parseFloat(state.take_profit_percent),
    stopLossPercent: parseFloat(state.stop_loss_percent),
    balance: state.balance_snapshot,
  };
  
  const result = simulateOfflineTrades(config, predictions, offlineMinutes);
  
  // Сохраняем лог
  if (result.tradesExecuted > 0) {
    await pool.query(`
      INSERT INTO offline_trading_logs 
        (user_id, slot_id, offline_start, offline_end, offline_duration_minutes,
         trades_executed, total_profit, details, ai_predictions_used)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      userId,
      slotId,
      lastActivity,
      now,
      offlineMinutes,
      result.tradesExecuted,
      result.totalProfit.toFixed(2),
      JSON.stringify(result.trades),
      JSON.stringify(predictions),
    ]);
    
    // Обновляем статистику
    await pool.query(`
      UPDATE offline_trading_state 
      SET 
        total_offline_profit = (CAST(total_offline_profit AS DECIMAL) + $3)::TEXT,
        total_offline_trades = total_offline_trades + $4,
        last_offline_calc_at = NOW(),
        last_activity_at = NOW()
      WHERE user_id = $1 AND slot_id = $2
    `, [userId, slotId, result.totalProfit, result.tradesExecuted]);
  }
  
  // Форматируем время офлайн
  const hours = Math.floor(offlineMinutes / 60);
  const minutes = offlineMinutes % 60;
  const timeFormatted = hours > 0 
    ? `${hours}ч ${minutes}м`
    : `${minutes}м`;
  
  return {
    hasOfflineProfit: true,
    offlineMinutes,
    offlineTimeFormatted: timeFormatted,
    tradesExecuted: result.tradesExecuted,
    totalProfit: result.totalProfit.toFixed(2),
    trades: result.trades.slice(0, 10), // Показываем только первые 10
    riskTolerance: state.risk_tolerance,
    efficiencyPercent: OFFLINE_CONFIG.efficiencyMultiplier * 100,
  };
}

/**
 * Получение истории офлайн-торговли
 */
async function getOfflineHistory(pool, userId, slotId, limit = 10) {
  const result = await pool.query(`
    SELECT * FROM offline_trading_logs 
    WHERE user_id = $1 AND slot_id = $2
    ORDER BY created_at DESC
    LIMIT $3
  `, [userId, slotId, limit]);
  
  return result.rows;
}

/**
 * Получение статистики офлайн-торговли
 */
async function getOfflineStats(pool, userId, slotId) {
  const stateResult = await pool.query(`
    SELECT total_offline_profit, total_offline_trades, last_offline_calc_at
    FROM offline_trading_state 
    WHERE user_id = $1 AND slot_id = $2
  `, [userId, slotId]);
  
  if (stateResult.rowCount === 0) {
    return { totalProfit: '0', totalTrades: 0, lastCalc: null };
  }
  
  const state = stateResult.rows[0];
  return {
    totalProfit: state.total_offline_profit || '0',
    totalTrades: state.total_offline_trades || 0,
    lastCalc: state.last_offline_calc_at,
  };
}

/**
 * Создание роутов для офлайн-трейдинга
 */
function createOfflineTradingRoutes(app, pool, authMiddleware) {
  // Сохранить состояние при выходе (или периодически) - с авторизацией
  app.post('/api/offline-trading/save-state', authMiddleware, async (req, res) => {
    try {
      const userId = req.userId;
      const { slotId, ...state } = req.body;
      
      if (!slotId) {
        return res.status(400).json({ ok: false, error: 'SLOT_ID_REQUIRED' });
      }
      
      await saveOfflineState(pool, userId, slotId, state);
      
      res.json({ ok: true });
    } catch (e) {
      console.error('Error saving offline state:', e);
      res.status(500).json({ ok: false, error: String(e.message) });
    }
  });
  
  // Специальный эндпоинт для sendBeacon (token в body вместо header)
  app.post('/api/offline-trading/beacon-save', async (req, res) => {
    console.log('[Beacon Save] Received request, body:', JSON.stringify(req.body).slice(0, 200));
    
    try {
      const { token, slotId, ...state } = req.body;
      
      if (!token || !slotId) {
        console.log('[Beacon Save] Missing token or slotId:', { hasToken: !!token, slotId });
        return res.status(400).json({ ok: false, error: 'TOKEN_AND_SLOT_REQUIRED' });
      }
      
      // Проверяем токен вручную
      const sessionResult = await pool.query(
        'SELECT user_id FROM sessions WHERE token = $1 AND expires_at > NOW()',
        [token]
      );
      
      if (sessionResult.rowCount === 0) {
        console.log('[Beacon Save] Invalid token');
        return res.status(401).json({ ok: false, error: 'INVALID_TOKEN' });
      }
      
      const userId = sessionResult.rows[0].user_id;
      console.log('[Beacon Save] Saving state for user:', userId, 'slot:', slotId);
      
      await saveOfflineState(pool, userId, slotId, state);
      
      console.log('[Beacon Save] State saved successfully');
      res.json({ ok: true });
    } catch (e) {
      console.error('[Beacon Save] Error:', e);
      res.status(500).json({ ok: false, error: String(e.message) });
    }
  });
  
  // Heartbeat - обновить время активности
  app.post('/api/offline-trading/heartbeat', authMiddleware, async (req, res) => {
    try {
      const userId = req.userId;
      const { slotId } = req.body;
      
      if (slotId) {
        await updateActivityTime(pool, userId, slotId);
      }
      
      res.json({ ok: true, timestamp: new Date().toISOString() });
    } catch (e) {
      console.error('Error updating activity:', e);
      res.status(500).json({ ok: false, error: String(e.message) });
    }
  });
  
  // Рассчитать офлайн-прибыль при входе
  app.post('/api/offline-trading/calculate', authMiddleware, async (req, res) => {
    try {
      const userId = req.userId;
      const { slotId } = req.body;
      
      if (!slotId) {
        return res.status(400).json({ ok: false, error: 'SLOT_ID_REQUIRED' });
      }
      
      const result = await calculateOfflineProfit(pool, userId, slotId);
      
      res.json({ ok: true, ...result });
    } catch (e) {
      console.error('Error calculating offline profit:', e);
      res.status(500).json({ ok: false, error: String(e.message) });
    }
  });
  
  // Получить историю офлайн-торговли
  app.get('/api/offline-trading/history', authMiddleware, async (req, res) => {
    try {
      const userId = req.userId;
      const slotId = req.query.slotId;
      const limit = parseInt(req.query.limit) || 10;
      
      if (!slotId) {
        return res.status(400).json({ ok: false, error: 'SLOT_ID_REQUIRED' });
      }
      
      const history = await getOfflineHistory(pool, userId, parseInt(slotId), limit);
      
      res.json({ ok: true, history });
    } catch (e) {
      console.error('Error getting offline history:', e);
      res.status(500).json({ ok: false, error: String(e.message) });
    }
  });
  
  // Получить статистику офлайн-торговли
  app.get('/api/offline-trading/stats', authMiddleware, async (req, res) => {
    try {
      const userId = req.userId;
      const slotId = req.query.slotId;
      
      if (!slotId) {
        return res.status(400).json({ ok: false, error: 'SLOT_ID_REQUIRED' });
      }
      
      const stats = await getOfflineStats(pool, userId, parseInt(slotId));
      
      res.json({ ok: true, ...stats });
    } catch (e) {
      console.error('Error getting offline stats:', e);
      res.status(500).json({ ok: false, error: String(e.message) });
    }
  });
}

export {
  initOfflineTradingTables,
  createOfflineTradingRoutes,
  saveOfflineState,
  updateActivityTime,
  calculateOfflineProfit,
  getOfflineHistory,
  getOfflineStats,
  OFFLINE_CONFIG,
};
