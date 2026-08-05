/**
 * Модуль интеграции с DeepSeek AI
 * Теперь читает данные из AI Oracle (кэш в БД)
 * Прямые запросы к DeepSeek больше не выполняются из этого модуля
 */

import {
  getOracleData,
  adaptRecommendationsForPlayer,
  getFallbackMarketPrediction,
  getFallbackDividends,
  getFallbackRecommendations,
  getOracleSourceStatus,
  UPDATE_INTERVAL_MS,
} from './ai-oracle.js';

const AI_CONFIG = {
  model: 'deepseek-chat',
};

/**
 * Создание роутов AI - читает из Oracle (кэш БД)
 */
export function createAIRoutes(app, pool, authMiddleware) {
  // Получить прогноз рынка (из кэша Oracle)
  app.get('/api/ai/market-prediction', authMiddleware, async (req, res) => {
    try {
      const oracleData = await getOracleData(pool, 'market_prediction');
      
      if (oracleData.data) {
        return res.json({
          ok: true,
          prediction: oracleData.data,
          source: oracleData.data.source || 'ai',
          generatedAt: oracleData.generatedAt,
          expiresAt: oracleData.expiresAt,
          isExpired: oracleData.isExpired,
        });
      }
      
      // Нет данных в БД - отдаём результат локального генератора (source: 'local')
      const prediction = getFallbackMarketPrediction();
      res.json({ ok: true, prediction, source: prediction.source || 'fallback' });
    } catch (e) {
      console.error('Error in market prediction:', e);
      const prediction = getFallbackMarketPrediction();
      res.json({ ok: true, prediction, source: prediction.source || 'fallback' });
    }
  });

  // Получить рекомендации помощника (из кэша Oracle + адаптация под игрока)
  app.post('/api/ai/advisor-recommendations', authMiddleware, async (req, res) => {
    try {
      const { portfolio, balance, riskTolerance } = req.body;
      
      // Получаем шаблоны рекомендаций из Oracle
      const oracleData = await getOracleData(pool, 'recommendations');
      
      if (oracleData.data) {
        // Адаптируем под конкретного игрока (локально, без AI)
        const recommendations = adaptRecommendationsForPlayer(
          oracleData.data,
          portfolio,
          balance,
          riskTolerance || 'balanced'
        );
        
        return res.json({
          ok: true,
          recommendations,
          arbitrageOpportunity: { exists: false },
          source: oracleData.data.source || 'ai',
          generatedAt: oracleData.generatedAt,
          isExpired: oracleData.isExpired,
        });
      }
      
      // Нет данных в БД - локальный генератор
      const fallback = getFallbackRecommendations();
      const recommendations = adaptRecommendationsForPlayer(
        fallback,
        portfolio,
        balance,
        riskTolerance || 'balanced'
      );
      
      res.json({
        ok: true,
        recommendations,
        arbitrageOpportunity: { exists: false },
        source: fallback.source || 'fallback',
      });
    } catch (e) {
      console.error('Error in advisor recommendations:', e);
      res.json({
        ok: true,
        recommendations: [],
        arbitrageOpportunity: { exists: false },
        source: 'fallback',
      });
    }
  });

  // Получить AI-генерируемые дивиденды (из кэша Oracle)
  app.post('/api/ai/dividends', authMiddleware, async (req, res) => {
    try {
      const oracleData = await getOracleData(pool, 'dividends');
      
      if (oracleData.data) {
        return res.json({
          ok: true,
          dividendUpdates: oracleData.data.dividendUpdates || [],
          marketConditions: oracleData.data.marketConditions || 'Стабильные условия',
          source: oracleData.data.source || 'ai',
          generatedAt: oracleData.generatedAt,
          isExpired: oracleData.isExpired,
        });
      }
      
      // Нет данных в БД - локальный генератор
      const fallback = getFallbackDividends();
      res.json({ ok: true, ...fallback, source: fallback.source || 'fallback' });
    } catch (e) {
      console.error('Error getting dividends:', e);
      const fallback = getFallbackDividends();
      res.json({ ok: true, ...fallback, source: fallback.source || 'fallback' });
    }
  });

  // Проверить статус AI и Oracle
  app.get('/api/ai/status', async (_req, res) => {
    try {
      const hasApiKey = !!process.env.DEEPSEEK_API_KEY;
      
      // Проверяем статус Oracle
      const oracleResult = await pool.query(
        `SELECT data_type, generated_at, expires_at,
                CASE WHEN expires_at > NOW() THEN true ELSE false END as is_valid,
                data->>'source' AS source
         FROM ai_oracle_data`
      );
      
      const oracleStatus = oracleResult.rows.reduce((acc, row) => {
        acc[row.data_type] = {
          generatedAt: row.generated_at,
          expiresAt: row.expires_at,
          isValid: row.is_valid,
          // Провенанс каждого документа: 'ai' | 'local' | 'fallback'
          source: row.source || 'unknown',
        };
        return acc;
      }, {});

      // Получаем статистику запросов за последний час
      const statsResult = await pool.query(
        `SELECT 
           COUNT(*) as total_requests,
           COUNT(*) FILTER (WHERE success = true) as successful,
           SUM(tokens_used) as total_tokens
         FROM ai_oracle_logs 
         WHERE created_at > NOW() - INTERVAL '1 hour'`
      );
      
      const sourceStatus = getOracleSourceStatus();

      res.json({
        ok: true,
        aiEnabled: hasApiKey,
        model: AI_CONFIG.model,
        updateIntervalMinutes: UPDATE_INTERVAL_MS / 1000 / 60,
        // Какой источник реально активен: 'ai' (DeepSeek) | 'local' (квант-симуляция) | 'fallback'
        activeSource: sourceStatus.activeSource,
        sources: sourceStatus.perType,
        deepseekConfigured: sourceStatus.deepseekConfigured,
        localGenerator: sourceStatus.localGenerator,
        lastCycleAt: sourceStatus.lastCycleAt,
        cycleRunning: sourceStatus.isRunning,
        oracle: oracleStatus,
        lastHourStats: statsResult.rows[0] || {},
      });
    } catch (e) {
      console.error('Error getting AI status:', e);
      const sourceStatus = getOracleSourceStatus();
      res.json({
        ok: true,
        aiEnabled: !!process.env.DEEPSEEK_API_KEY,
        model: AI_CONFIG.model,
        updateIntervalMinutes: UPDATE_INTERVAL_MS / 1000 / 60,
        activeSource: sourceStatus.activeSource,
        sources: sourceStatus.perType,
        deepseekConfigured: sourceStatus.deepseekConfigured,
        localGenerator: sourceStatus.localGenerator,
      });
    }
  });
}
