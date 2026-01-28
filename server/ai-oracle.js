/**
 * AI Oracle - Централизованный модуль для AI-генерации данных
 * Делает запросы к DeepSeek раз в час и кэширует результаты в БД
 * Максимум 5 запросов за цикл обновления
 */

const AI_CONFIG = {
  baseUrl: 'https://api.deepseek.com/v1',
  model: 'deepseek-chat',
  maxTokens: 2000,
  temperature: 0.7,
};

// Интервал обновления: 1 час
const UPDATE_INTERVAL_MS = 60 * 60 * 1000;

// Максимум запросов к DeepSeek за один цикл
const MAX_REQUESTS_PER_CYCLE = 5;

/**
 * Системный промпт для финансового анализа
 */
const FINANCE_SYSTEM_PROMPT = `Ты - финансовый аналитик в космической игре. Твоя задача - анализировать рынок акций и фондов, 
предсказывать движения цен и давать рекомендации. Отвечай ТОЛЬКО в формате JSON без markdown.

Акции в игре:
- ORES (Ore Mining Corporation) - горнодобыча, низкая волатильность
- ENRG (Energy Solutions) - энергетика, средняя волатильность  
- SLRS (Solar Systems) - солнечная энергия, высокая волатильность
- CHIP (ChipTech Industries) - полупроводники, высокая волатильность
- MECH (MechFactory) - производство, средняя волатильность
- AERO (AeroSpace Dynamics) - аэрокосмос, высокая волатильность
- MEDI (MediBiotech) - биотехнологии, очень высокая волатильность
- GAME (GameStream) - развлечения, высокая волатильность
- ARMS (DefenseTech) - оборона, низкая волатильность
- CRYO (CryoGenetics) - криогеника, очень высокая волатильность
- QNTM (Quantum Computing) - квантовые вычисления, экстремальная волатильность
- XENO (Xenotech Research) - экзотические технологии, экстремальная волатильность

Фонды:
- stable_index - консервативный, низкий риск
- growth_leaders - фонд роста, средний риск
- tech_innovation - технологический, высокий риск
- high_dividend - дивидендный, низкий риск
- balanced_portfolio - сбалансированный, средний риск

Генерируй реалистичные, но интересные прогнозы для игры.`;

/**
 * Вызов DeepSeek API
 */
async function callDeepSeek(apiKey, prompt, systemPrompt = null) {
  const startTime = Date.now();
  const messages = [];

  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }

  messages.push({ role: 'user', content: prompt });

  const response = await fetch(`${AI_CONFIG.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: AI_CONFIG.model,
      messages,
      max_tokens: AI_CONFIG.maxTokens,
      temperature: AI_CONFIG.temperature,
    }),
  });

  const duration = Date.now() - startTime;

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`DeepSeek API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const tokensUsed = data.usage?.total_tokens || 0;

  return {
    content: data.choices[0].message.content,
    tokensUsed,
    duration,
  };
}

/**
 * Парсинг JSON из ответа AI (может содержать markdown)
 */
function parseAIResponse(response) {
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }
  return JSON.parse(response);
}

/**
 * Логирование запроса в БД
 */
async function logRequest(pool, requestType, success, errorMessage = null, tokensUsed = null, durationMs = null) {
  try {
    await pool.query(
      `INSERT INTO ai_oracle_logs (request_type, success, error_message, tokens_used, duration_ms)
       VALUES ($1, $2, $3, $4, $5)`,
      [requestType, success, errorMessage, tokensUsed, durationMs]
    );
  } catch (e) {
    console.error('[AI Oracle] Failed to log request:', e);
  }
}

/**
 * Генерация прогноза рынка
 */
async function generateMarketPrediction(apiKey) {
  const prompt = `Сгенерируй прогноз рынка на следующий час для всех 12 акций.

Формат ответа JSON:
{
  "overallSentiment": "bullish" | "bearish" | "neutral",
  "stockPredictions": [
    {
      "stockId": "ores",
      "symbol": "ORES",
      "predictedDirection": "up" | "down" | "stable",
      "confidence": 0.75,
      "predictedChange": 2.5,
      "reasoning": "Рост спроса на руду"
    }
  ],
  "creditRatePrediction": {
    "predictedBaseRate": 0.08,
    "rateDirection": "rising" | "falling" | "stable",
    "reasoning": "объяснение"
  },
  "marketNarrative": "краткий обзор рынка (2-3 предложения)"
}

Включи прогнозы для всех акций: ores, enrg, slrs, chip, mech, aero, medi, game, arms, cryo, qntm, xeno.
Делай разнообразные прогнозы - не все акции должны расти или падать одинаково.`;

  const result = await callDeepSeek(apiKey, prompt, FINANCE_SYSTEM_PROMPT);
  return {
    data: parseAIResponse(result.content),
    tokensUsed: result.tokensUsed,
    duration: result.duration,
  };
}

/**
 * Генерация дивидендных ставок
 */
async function generateDividendYields(apiKey) {
  const prompt = `Сгенерируй дивидендные ставки для всех акций на следующий час.

Правила дивидендов:
- Акции роста (CHIP, MEDI, QNTM, XENO, AERO) обычно не платят дивиденды (0-0.5%)
- Стабильные компании (ORES, ENRG, ARMS) платят высокие дивиденды (2-4%)
- Средние компании (MECH, SLRS, GAME, CRYO) платят умеренные дивиденды (0.5-2%)

Формат JSON:
{
  "dividendUpdates": [
    {
      "stockId": "ores",
      "newYield": 0.035,
      "change": "increased" | "decreased" | "unchanged",
      "reason": "Увеличение добычи"
    }
  ],
  "marketConditions": "Описание текущих условий влияющих на дивиденды"
}

Включи все 12 акций: ores, enrg, slrs, chip, mech, aero, medi, game, arms, cryo, qntm, xeno.`;

  const result = await callDeepSeek(apiKey, prompt, FINANCE_SYSTEM_PROMPT);
  return {
    data: parseAIResponse(result.content),
    tokensUsed: result.tokensUsed,
    duration: result.duration,
  };
}

/**
 * Генерация шаблонов рекомендаций для разных профилей риска
 */
async function generateRecommendationTemplates(apiKey, marketPrediction) {
  const prompt = `На основе прогноза рынка: ${JSON.stringify(marketPrediction)}

Сгенерируй рекомендации для 3 типов инвесторов.

Формат JSON:
{
  "conservative": [
    {
      "type": "buy_stock" | "sell_stock" | "buy_fund" | "sell_fund",
      "targetId": "ores",
      "reasoning": "Стабильный рост с низким риском",
      "confidence": 0.85,
      "priority": 1
    }
  ],
  "balanced": [
    {
      "type": "buy_stock",
      "targetId": "mech",
      "reasoning": "Хороший баланс риска и доходности",
      "confidence": 0.7,
      "priority": 1
    }
  ],
  "aggressive": [
    {
      "type": "buy_stock",
      "targetId": "qntm",
      "reasoning": "Высокий потенциал роста",
      "confidence": 0.6,
      "priority": 1
    }
  ]
}

Правила:
- conservative: только низкорисковые акции (ores, enrg, arms) и стабильные фонды
- balanced: смесь стабильных и растущих акций
- aggressive: акции роста (chip, medi, qntm, xeno, cryo) и технологические фонды

Для каждого профиля дай 3-5 рекомендаций.
Доступные фонды: stable_index, growth_leaders, tech_innovation, high_dividend, balanced_portfolio`;

  const result = await callDeepSeek(apiKey, prompt, FINANCE_SYSTEM_PROMPT);
  return {
    data: parseAIResponse(result.content),
    tokensUsed: result.tokensUsed,
    duration: result.duration,
  };
}

/**
 * Fallback данные если AI недоступен
 */
function getFallbackMarketPrediction() {
  const stocks = ['ores', 'enrg', 'slrs', 'chip', 'mech', 'aero', 'medi', 'game', 'arms', 'cryo', 'qntm', 'xeno'];
  const directions = ['up', 'down', 'stable'];
  const sentiments = ['bullish', 'bearish', 'neutral'];

  return {
    overallSentiment: sentiments[Math.floor(Math.random() * 3)],
    stockPredictions: stocks.map((stockId) => ({
      stockId,
      symbol: stockId.toUpperCase(),
      predictedDirection: directions[Math.floor(Math.random() * 3)],
      confidence: 0.3 + Math.random() * 0.4,
      predictedChange: (Math.random() - 0.5) * 10,
      reasoning: 'Анализ на основе исторических данных',
    })),
    creditRatePrediction: {
      predictedBaseRate: 0.08 + Math.random() * 0.05,
      rateDirection: directions[Math.floor(Math.random() * 3)],
      reasoning: 'Стабильные экономические условия',
    },
    marketNarrative: 'Рынок демонстрирует умеренную активность. Рекомендуется диверсификация портфеля.',
    source: 'fallback',
  };
}

function getFallbackDividends() {
  const sectorYields = {
    ores: 0.03,
    enrg: 0.035,
    slrs: 0.015,
    chip: 0,
    mech: 0.025,
    aero: 0.005,
    medi: 0,
    game: 0.01,
    arms: 0.03,
    cryo: 0,
    qntm: 0,
    xeno: 0,
  };

  return {
    dividendUpdates: Object.entries(sectorYields).map(([stockId, newYield]) => ({
      stockId,
      newYield,
      change: 'unchanged',
      reason: 'Стандартная дивидендная политика',
    })),
    marketConditions: 'Стабильные рыночные условия',
    source: 'fallback',
  };
}

function getFallbackRecommendations() {
  return {
    conservative: [
      { type: 'buy_stock', targetId: 'ores', reasoning: 'Стабильный актив', confidence: 0.8, priority: 1 },
      { type: 'buy_stock', targetId: 'arms', reasoning: 'Низкая волатильность', confidence: 0.75, priority: 2 },
      { type: 'buy_fund', targetId: 'stable_index', reasoning: 'Консервативный фонд', confidence: 0.85, priority: 1 },
    ],
    balanced: [
      { type: 'buy_stock', targetId: 'mech', reasoning: 'Баланс риска и доходности', confidence: 0.7, priority: 1 },
      { type: 'buy_stock', targetId: 'enrg', reasoning: 'Стабильный рост', confidence: 0.7, priority: 2 },
      { type: 'buy_fund', targetId: 'balanced_portfolio', reasoning: 'Сбалансированный фонд', confidence: 0.75, priority: 1 },
    ],
    aggressive: [
      { type: 'buy_stock', targetId: 'qntm', reasoning: 'Высокий потенциал', confidence: 0.55, priority: 1 },
      { type: 'buy_stock', targetId: 'xeno', reasoning: 'Экзотические технологии', confidence: 0.5, priority: 2 },
      { type: 'buy_fund', targetId: 'tech_innovation', reasoning: 'Технологический фонд', confidence: 0.6, priority: 1 },
    ],
    source: 'fallback',
  };
}

/**
 * Основная функция обновления AI Oracle
 * Делает до 5 запросов к DeepSeek и сохраняет результаты в БД
 */
async function runOracleUpdate(pool) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const expiresAt = new Date(Date.now() + UPDATE_INTERVAL_MS);
  
  console.log('[AI Oracle] Starting hourly update cycle...');
  
  let requestCount = 0;
  let totalTokens = 0;
  
  // === 1. Прогноз рынка ===
  let marketPrediction;
  try {
    if (apiKey && requestCount < MAX_REQUESTS_PER_CYCLE) {
      console.log('[AI Oracle] Generating market prediction...');
      const result = await generateMarketPrediction(apiKey);
      marketPrediction = { ...result.data, source: 'ai', generatedAt: Date.now() };
      requestCount++;
      totalTokens += result.tokensUsed;
      
      await logRequest(pool, 'market_prediction', true, null, result.tokensUsed, result.duration);
      console.log(`[AI Oracle] Market prediction generated (${result.tokensUsed} tokens, ${result.duration}ms)`);
    } else {
      throw new Error('No API key or request limit reached');
    }
  } catch (error) {
    console.error('[AI Oracle] Market prediction failed, using fallback:', error.message);
    marketPrediction = getFallbackMarketPrediction();
    await logRequest(pool, 'market_prediction', false, error.message);
  }
  
  // Сохраняем в БД
  await pool.query(
    `INSERT INTO ai_oracle_data (data_type, data, generated_at, expires_at, request_count)
     VALUES ('market_prediction', $1, NOW(), $2, $3)
     ON CONFLICT (data_type) DO UPDATE SET 
       data = EXCLUDED.data, 
       generated_at = NOW(), 
       expires_at = EXCLUDED.expires_at,
       request_count = ai_oracle_data.request_count + 1`,
    [JSON.stringify(marketPrediction), expiresAt, requestCount]
  );
  
  // === 2. Дивиденды ===
  let dividends;
  try {
    if (apiKey && requestCount < MAX_REQUESTS_PER_CYCLE) {
      console.log('[AI Oracle] Generating dividend yields...');
      const result = await generateDividendYields(apiKey);
      dividends = { ...result.data, source: 'ai', generatedAt: Date.now() };
      requestCount++;
      totalTokens += result.tokensUsed;
      
      await logRequest(pool, 'dividends', true, null, result.tokensUsed, result.duration);
      console.log(`[AI Oracle] Dividends generated (${result.tokensUsed} tokens, ${result.duration}ms)`);
    } else {
      throw new Error('No API key or request limit reached');
    }
  } catch (error) {
    console.error('[AI Oracle] Dividends failed, using fallback:', error.message);
    dividends = getFallbackDividends();
    await logRequest(pool, 'dividends', false, error.message);
  }
  
  await pool.query(
    `INSERT INTO ai_oracle_data (data_type, data, generated_at, expires_at, request_count)
     VALUES ('dividends', $1, NOW(), $2, $3)
     ON CONFLICT (data_type) DO UPDATE SET 
       data = EXCLUDED.data, 
       generated_at = NOW(), 
       expires_at = EXCLUDED.expires_at,
       request_count = ai_oracle_data.request_count + 1`,
    [JSON.stringify(dividends), expiresAt, requestCount]
  );
  
  // === 3. Рекомендации (используют прогноз рынка) ===
  let recommendations;
  try {
    if (apiKey && requestCount < MAX_REQUESTS_PER_CYCLE) {
      console.log('[AI Oracle] Generating recommendation templates...');
      const result = await generateRecommendationTemplates(apiKey, marketPrediction);
      recommendations = { ...result.data, source: 'ai', generatedAt: Date.now() };
      requestCount++;
      totalTokens += result.tokensUsed;
      
      await logRequest(pool, 'recommendations', true, null, result.tokensUsed, result.duration);
      console.log(`[AI Oracle] Recommendations generated (${result.tokensUsed} tokens, ${result.duration}ms)`);
    } else {
      throw new Error('No API key or request limit reached');
    }
  } catch (error) {
    console.error('[AI Oracle] Recommendations failed, using fallback:', error.message);
    recommendations = getFallbackRecommendations();
    await logRequest(pool, 'recommendations', false, error.message);
  }
  
  await pool.query(
    `INSERT INTO ai_oracle_data (data_type, data, generated_at, expires_at, request_count)
     VALUES ('recommendations', $1, NOW(), $2, $3)
     ON CONFLICT (data_type) DO UPDATE SET 
       data = EXCLUDED.data, 
       generated_at = NOW(), 
       expires_at = EXCLUDED.expires_at,
       request_count = ai_oracle_data.request_count + 1`,
    [JSON.stringify(recommendations), expiresAt, requestCount]
  );
  
  console.log(`[AI Oracle] Update cycle completed: ${requestCount} requests, ${totalTokens} total tokens`);
  
  return { requestCount, totalTokens };
}

/**
 * Получение данных из Oracle (с fallback на просроченные данные)
 */
async function getOracleData(pool, dataType) {
  try {
    // Сначала пробуем получить актуальные данные
    const result = await pool.query(
      `SELECT data, generated_at, expires_at FROM ai_oracle_data 
       WHERE data_type = $1 AND expires_at > NOW()`,
      [dataType]
    );
    
    if (result.rowCount > 0) {
      return {
        data: result.rows[0].data,
        generatedAt: result.rows[0].generated_at,
        expiresAt: result.rows[0].expires_at,
        isExpired: false,
      };
    }
    
    // Если нет актуальных - берём последние (даже просроченные)
    const fallbackResult = await pool.query(
      `SELECT data, generated_at, expires_at FROM ai_oracle_data 
       WHERE data_type = $1
       ORDER BY generated_at DESC LIMIT 1`,
      [dataType]
    );
    
    if (fallbackResult.rowCount > 0) {
      console.log(`[AI Oracle] Using expired data for ${dataType}`);
      return {
        data: fallbackResult.rows[0].data,
        generatedAt: fallbackResult.rows[0].generated_at,
        expiresAt: fallbackResult.rows[0].expires_at,
        isExpired: true,
      };
    }
    
    // Если совсем ничего нет - возвращаем fallback
    return { data: null, isExpired: true };
  } catch (error) {
    console.error(`[AI Oracle] Error getting ${dataType}:`, error);
    return { data: null, isExpired: true };
  }
}

/**
 * Инициализация таблиц AI Oracle
 */
async function initAIOracleTables(pool) {
  // Таблица данных
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ai_oracle_data (
      id SERIAL PRIMARY KEY,
      data_type TEXT NOT NULL UNIQUE,
      data JSONB NOT NULL,
      generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      request_count INTEGER DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  
  // Таблица логов
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ai_oracle_logs (
      id SERIAL PRIMARY KEY,
      request_type TEXT NOT NULL,
      success BOOLEAN NOT NULL,
      error_message TEXT,
      tokens_used INTEGER,
      duration_ms INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  
  // Индексы
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_ai_oracle_type ON ai_oracle_data(data_type);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_ai_oracle_expires ON ai_oracle_data(expires_at);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_ai_oracle_logs_created ON ai_oracle_logs(created_at DESC);`);
  
  console.log('[AI Oracle] Tables initialized');
}

/**
 * Запуск AI Oracle с периодическим обновлением
 */
async function startAIOracle(pool) {
  // Инициализация таблиц
  await initAIOracleTables(pool);
  
  // Первый запуск сразу при старте сервера
  console.log('[AI Oracle] Running initial update...');
  await runOracleUpdate(pool);
  
  // Периодическое обновление каждый час
  setInterval(() => {
    runOracleUpdate(pool).catch((error) => {
      console.error('[AI Oracle] Scheduled update failed:', error);
    });
  }, UPDATE_INTERVAL_MS);
  
  console.log(`[AI Oracle] Started with ${UPDATE_INTERVAL_MS / 1000 / 60} minute update interval`);
}

/**
 * Адаптация рекомендаций под конкретного игрока
 * Выполняется локально БЕЗ запроса к AI
 */
function adaptRecommendationsForPlayer(templates, portfolio, balance, riskTolerance) {
  if (!templates || !templates[riskTolerance]) {
    return [];
  }
  
  const baseRecommendations = templates[riskTolerance] || templates.balanced || [];
  const balanceNum = parseFloat(balance) || 0;
  
  // Фильтруем и адаптируем рекомендации
  const adapted = baseRecommendations
    .filter((rec) => {
      // Не рекомендуем продавать то, чего нет в портфеле
      if (rec.type === 'sell_stock' || rec.type === 'sell_fund') {
        const hasPosition = portfolio?.some(
          (p) => p.stockId === rec.targetId || p.fundId === rec.targetId
        );
        return hasPosition;
      }
      return true;
    })
    .map((rec, index) => ({
      id: `rec_${Date.now()}_${index}`,
      ...rec,
      // Рассчитываем рекомендуемую сумму на основе баланса
      amount: rec.type.startsWith('buy') 
        ? String(Math.floor(balanceNum * 0.1)) // 10% от баланса
        : undefined,
      timestamp: Date.now(),
      executed: false,
    }));
  
  return adapted;
}

export {
  startAIOracle,
  runOracleUpdate,
  getOracleData,
  initAIOracleTables,
  adaptRecommendationsForPlayer,
  getFallbackMarketPrediction,
  getFallbackDividends,
  getFallbackRecommendations,
  UPDATE_INTERVAL_MS,
};
