/**
 * Модуль интеграции с DeepSeek AI
 * Генерация котировок и анализ рынка
 */

const AI_CONFIG = {
  baseUrl: 'https://api.deepseek.com/v1',
  model: 'deepseek-chat',
  maxTokens: 2000,
  temperature: 0.7,
};

/**
 * Вызов DeepSeek API
 */
async function callDeepSeek(apiKey, prompt, systemPrompt = null) {
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

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`DeepSeek API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

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
 * Генерация прогноза рынка
 */
async function generateMarketPrediction(apiKey, currentPrices, marketHistory) {
  const prompt = `Текущие цены акций: ${JSON.stringify(currentPrices)}
История за последние 24 часа: ${JSON.stringify(marketHistory)}

Сгенерируй прогноз рынка в формате JSON:
{
  "overallSentiment": "bullish" | "bearish" | "neutral",
  "stockPredictions": [
    {
      "stockId": "string",
      "symbol": "string",
      "predictedDirection": "up" | "down" | "stable",
      "confidence": 0-1,
      "predictedChange": number (процент),
      "reasoning": "краткое объяснение"
    }
  ],
  "creditRatePrediction": {
    "predictedBaseRate": number (0.05-0.25),
    "rateDirection": "rising" | "falling" | "stable",
    "reasoning": "объяснение"
  },
  "marketNarrative": "краткий обзор рынка (2-3 предложения)"
}`;

  try {
    const response = await callDeepSeek(apiKey, prompt, FINANCE_SYSTEM_PROMPT);
    // Пытаемся извлечь JSON из ответа
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return JSON.parse(response);
  } catch (error) {
    console.error('Error generating market prediction:', error);
    // Возвращаем fallback prediction
    return generateFallbackPrediction(currentPrices);
  }
}

/**
 * Fallback прогноз если AI недоступен
 */
function generateFallbackPrediction(currentPrices) {
  const stocks = [
    'ores',
    'enrg',
    'slrs',
    'chip',
    'mech',
    'aero',
    'medi',
    'game',
    'arms',
    'cryo',
    'qntm',
    'xeno',
  ];
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
    marketNarrative:
      'Рынок демонстрирует умеренную активность. Рекомендуется диверсификация портфеля.',
  };
}

/**
 * Генерация рекомендаций для помощника
 */
async function generateAdvisorRecommendations(apiKey, portfolio, balance, loans, predictions) {
  const prompt = `Портфель игрока: ${JSON.stringify(portfolio)}
Баланс: ${balance}
Активные кредиты: ${JSON.stringify(loans)}
Текущие прогнозы рынка: ${JSON.stringify(predictions)}

Сгенерируй рекомендации для игрока в формате JSON:
{
  "recommendations": [
    {
      "type": "buy_stock" | "sell_stock" | "buy_fund" | "sell_fund" | "take_loan" | "pay_loan",
      "targetId": "string",
      "amount": "string (опционально)",
      "reasoning": "объяснение",
      "expectedProfit": "string (опционально)",
      "confidence": 0-1,
      "priority": 1-5
    }
  ],
  "arbitrageOpportunity": {
    "exists": boolean,
    "description": "string",
    "steps": ["шаг 1", "шаг 2", ...]
  }
}`;

  try {
    const response = await callDeepSeek(apiKey, prompt, FINANCE_SYSTEM_PROMPT);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return JSON.parse(response);
  } catch (error) {
    console.error('Error generating advisor recommendations:', error);
    return { recommendations: [], arbitrageOpportunity: { exists: false } };
  }
}

/**
 * Генерация динамических дивидендных ставок через AI
 */
async function generateDividendYields(apiKey, stocks) {
  const prompt = `Текущие акции и их базовые дивиденды:
${JSON.stringify(
  stocks.map((s) => ({
    id: s.id,
    symbol: s.symbol,
    sector: s.sector,
    currentYield: s.dividendYield,
    price: s.currentPrice,
  }))
)}

Сгенерируй обновлённые дивидендные ставки на основе "рыночных условий" в формате JSON:
{
  "dividendUpdates": [
    {
      "stockId": "string",
      "newYield": number (0-0.10, т.е. 0-10%),
      "change": "increased" | "decreased" | "unchanged",
      "reason": "краткое объяснение изменения"
    }
  ],
  "marketConditions": "описание текущих условий влияющих на дивиденды"
}

Помни:
- Акции роста (CHIP, MEDI, QNTM, XENO) обычно не платят дивиденды
- Стабильные компании (ORES, ENRG, ARMS) платят высокие дивиденды
- Изменения должны быть небольшими (±0.5-1% максимум за раз)`;

  try {
    const response = await callDeepSeek(apiKey, prompt, FINANCE_SYSTEM_PROMPT);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return JSON.parse(response);
  } catch (error) {
    console.error('Error generating dividend yields:', error);
    return null;
  }
}

/**
 * Fallback для дивидендов
 */
function generateFallbackDividends(stocks) {
  // Базовые дивиденды по секторам
  const sectorYields = {
    mining: 0.03,
    energy: 0.035,
    manufacturing: 0.025,
    aerospace: 0.005,
    technology: 0,
    biotech: 0,
    entertainment: 0.01,
    exotic: 0,
  };

  return {
    dividendUpdates: stocks.map((s) => ({
      stockId: s.id,
      newYield: sectorYields[s.sector] || 0,
      change: 'unchanged',
      reason: 'Стандартная дивидендная политика',
    })),
    marketConditions: 'Стабильные рыночные условия',
  };
}

/**
 * Создание роутов AI
 */
export function createAIRoutes(app, pool, authMiddleware) {
  // Получить прогноз рынка
  app.get('/api/ai/market-prediction', authMiddleware, async (req, res) => {
    try {
      const apiKey = process.env.DEEPSEEK_API_KEY;

      if (!apiKey) {
        // Используем fallback если нет API ключа
        const prediction = generateFallbackPrediction({});
        return res.json({ ok: true, prediction, source: 'fallback' });
      }

      // Получаем текущие данные рынка (можно передать из клиента)
      let currentPrices = {};
      let marketHistory = [];

      try {
        if (req.query.prices) {
          currentPrices = JSON.parse(req.query.prices);
        }
        if (req.query.history) {
          marketHistory = JSON.parse(req.query.history);
        }
      } catch (parseError) {
        console.error('Error parsing market data:', parseError);
      }

      const prediction = await generateMarketPrediction(apiKey, currentPrices, marketHistory);

      res.json({ ok: true, prediction, source: 'ai' });
    } catch (e) {
      console.error('Error in market prediction:', e);
      // Fallback при ошибке
      const prediction = generateFallbackPrediction({});
      res.json({ ok: true, prediction, source: 'fallback' });
    }
  });

  // Получить рекомендации помощника
  app.post('/api/ai/advisor-recommendations', authMiddleware, async (req, res) => {
    try {
      const apiKey = process.env.DEEPSEEK_API_KEY;
      const { portfolio, balance, loans, predictions } = req.body;

      if (!apiKey) {
        return res.json({
          ok: true,
          recommendations: [],
          arbitrageOpportunity: { exists: false },
          source: 'fallback',
        });
      }

      const result = await generateAdvisorRecommendations(
        apiKey,
        portfolio,
        balance,
        loans,
        predictions
      );

      res.json({ ok: true, ...result, source: 'ai' });
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

  // Получить AI-генерируемые дивиденды
  app.post('/api/ai/dividends', authMiddleware, async (req, res) => {
    try {
      const apiKey = process.env.DEEPSEEK_API_KEY;
      const { stocks } = req.body;

      if (!apiKey || !stocks || stocks.length === 0) {
        const result = generateFallbackDividends(stocks || []);
        return res.json({ ok: true, ...result, source: 'fallback' });
      }

      const result = await generateDividendYields(apiKey, stocks);

      if (result) {
        res.json({ ok: true, ...result, source: 'ai' });
      } else {
        const fallback = generateFallbackDividends(stocks);
        res.json({ ok: true, ...fallback, source: 'fallback' });
      }
    } catch (e) {
      console.error('Error generating dividends:', e);
      const fallback = generateFallbackDividends(req.body?.stocks || []);
      res.json({ ok: true, ...fallback, source: 'fallback' });
    }
  });

  // Проверить статус AI
  app.get('/api/ai/status', async (_req, res) => {
    const hasApiKey = !!process.env.DEEPSEEK_API_KEY;
    res.json({
      ok: true,
      aiEnabled: hasApiKey,
      model: AI_CONFIG.model,
    });
  });
}

export { generateMarketPrediction, generateFallbackPrediction, generateAdvisorRecommendations, generateDividendYields };
