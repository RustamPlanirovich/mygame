/**
 * AI Oracle - Централизованный модуль генерации рыночных данных
 *
 * Каскад источников (строго в этом порядке):
 *   1. DeepSeek         — только если задан DEEPSEEK_API_KEY (source: 'ai')
 *   2. Локальный квант-генератор server/market-sim (source: 'local')
 *   3. Статический фолбэк — только если и генератор упал (source: 'fallback')
 *
 * Отсутствие ключа — НОРМАЛЬНЫЙ режим работы, а не ошибка: в ai_oracle_logs
 * такие циклы больше не пишутся как FAILURE.
 *
 * Результаты кэшируются в ai_oracle_data (одна строка на data_type).
 */

import {
  stepMarketSim,
  getSnapshot,
  localMarketPrediction,
  localDividends,
  localRecommendations,
} from './market-sim/index.js';
import { STOCKS, FUNDS, SECTOR_RU } from './market-sim/universe.js';
import { withAdvisoryLock } from './market-sim/persistence.js';
import { describeError } from './error-detail.js';

const AI_CONFIG = {
  baseUrl: 'https://api.deepseek.com/v1',
  model: 'deepseek-chat',
  maxTokens: 2000,
  temperature: 0.7,
};

// Интервал обновления: 1 час
const UPDATE_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Ключ advisory-lock: один цикл оракула на всю БД, а не на процесс.
 *
 * Флага `oracleRunning` для этого недостаточно: это обычная переменная в памяти процесса,
 * поэтому два процесса против одной БД (PM2 cluster, второй инстанс во время reload, запущенный
 * рядом `npm run dev:api`) о ней ничего не знают. Цена промаха тут не «лишняя работа»: цикл
 * платно ходит в DeepSeek (до MAX_REQUESTS_PER_CYCLE запросов) и перезаписывает одни и те же
 * строки ai_oracle_data, так что параллельные циклы дают двойной счёт от провайдера и гонку
 * записи, в которой побеждает тот, кто закончил позже.
 *
 * Именно pg_try_advisory_lock, а не гейт по NODE_APP_INSTANCE === 0: лок отпускается сам при
 * обрыве соединения, поэтому смерть конкретного воркера не оставляет оракул без обновлений,
 * а во время reload перекрывающиеся старый и новый воркеры не тикают вдвоём.
 *
 * Значение не должно совпадать с MARKET_LOCK_KEY и MARKET_SIM_LOCK_KEY — это одно
 * пространство ключей на всю базу.
 */
const AI_ORACLE_LOCK_KEY = 0x41494f52; // 'AIOR'

// Максимум запросов к DeepSeek за один цикл
const MAX_REQUESTS_PER_CYCLE = 5;

/** Последний использованный источник по каждому типу данных (для /api/ai/status). */
const lastSources = {
  market_prediction: null,
  dividends: null,
  recommendations: null,
};
let lastCycleAt = null;

// ==========================================
// ПРОМПТЫ (генерируются из server/market-sim/universe.js —
// один источник правды, поэтому «xeno -> dark» правится в одном месте)
// ==========================================

const VOLATILITY_RU = {
  low: 'низкая волатильность',
  medium: 'средняя волатильность',
  high: 'высокая волатильность',
  very_high: 'очень высокая волатильность',
  extreme: 'экстремальная волатильность',
};

const RISK_RU = {
  1: 'минимальный риск',
  2: 'низкий риск',
  3: 'средний риск',
  4: 'высокий риск',
  5: 'очень высокий риск',
};

const STOCK_IDS_LIST = STOCKS.map((s) => s.id).join(', ');
const FUND_IDS_LIST = FUNDS.map((f) => f.id).join(', ');

function buildSystemPrompt() {
  const stockLines = STOCKS.map(
    (s) => `- ${s.symbol} (${s.name}) - ${SECTOR_RU[s.sector]}, ${VOLATILITY_RU[s.volatility]}`
  ).join('\n');
  const fundLines = FUNDS.map(
    (f) => `- ${f.id} - ${f.name}, ${RISK_RU[f.riskLevel] || 'средний риск'}`
  ).join('\n');

  return `Ты - финансовый аналитик в космической игре. Твоя задача - анализировать рынок акций и фондов,
предсказывать движения цен и давать рекомендации. Отвечай ТОЛЬКО в формате JSON без markdown.

Акции в игре (${STOCKS.length}):
${stockLines}

Фонды:
${fundLines}

Генерируй реалистичные, но интересные прогнозы для игры.`;
}

const FINANCE_SYSTEM_PROMPT = buildSystemPrompt();

/**
 * Краткая сводка состояния симуляции — даём её DeepSeek как контекст,
 * чтобы AI-прогноз опирался на те же реальные цены, что видят игроки.
 */
function simContext() {
  const snap = getSnapshot();
  if (!snap) return '';
  const prices = snap.stocks
    .map((s) => `${s.symbol}=${s.price.toFixed(2)} (${s.dayChange >= 0 ? '+' : ''}${s.dayChange.toFixed(1)}%)`)
    .join(', ');
  const events = snap.events
    .filter((e) => e.phase !== 'done')
    .map((e) => `${e.headline} [${e.phase}]`)
    .join('; ');
  return `\n\nТекущее состояние рынка (данные сервера): режим=${snap.regime}, ` +
    `базовая ставка=${(snap.baseRate * 100).toFixed(2)}%, растут ${snap.upCount} из ${snap.total}.\n` +
    `Цены: ${prices}.` +
    (events ? `\nАктивные события: ${events}.` : '');
}

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
 * Логирование запроса в БД.
 * Пишем ТОЛЬКО реальные обращения к DeepSeek: успех или настоящую ошибку.
 * Работа без ключа в логи не попадает — это не сбой.
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
  const prompt = `Сгенерируй прогноз рынка на следующий час для всех ${STOCKS.length} акций.

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

Включи прогнозы для всех акций: ${STOCK_IDS_LIST}.
Делай разнообразные прогнозы - не все акции должны расти или падать одинаково.${simContext()}`;

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
  const payers = STOCKS.filter((s) => s.dividendYield >= 0.025).map((s) => s.symbol).join(', ');
  const growth = STOCKS.filter((s) => s.dividendYield === 0).map((s) => s.symbol).join(', ');
  const middle = STOCKS.filter((s) => s.dividendYield > 0 && s.dividendYield < 0.025)
    .map((s) => s.symbol)
    .join(', ');

  const prompt = `Сгенерируй дивидендные ставки для всех акций на следующий час.

Правила дивидендов:
- Акции роста (${growth}) обычно не платят дивиденды (0-0.5%)
- Стабильные компании (${payers}) платят высокие дивиденды (2-4%)
- Средние компании (${middle}) платят умеренные дивиденды (0.5-2%)
- ЖЁСТКОЕ ограничение: newYield не может превышать 0.06

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

Включи все ${STOCKS.length} акций: ${STOCK_IDS_LIST}.`;

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
  const lowRisk = STOCKS.filter((s) => s.volatility === 'low' || s.volatility === 'medium')
    .map((s) => s.id)
    .join(', ');
  const highRisk = STOCKS.filter((s) => s.volatility === 'very_high' || s.volatility === 'extreme')
    .map((s) => s.id)
    .join(', ');

  const prompt = `На основе прогноза рынка: ${JSON.stringify({
    overallSentiment: marketPrediction.overallSentiment,
    stockPredictions: marketPrediction.stockPredictions,
    creditRatePrediction: marketPrediction.creditRatePrediction,
  })}

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
  "balanced": [],
  "aggressive": []
}

Правила:
- conservative: только низкорисковые акции (${lowRisk}) и стабильные фонды
- balanced: смесь стабильных и растущих акций
- aggressive: акции роста (${highRisk}) и технологические фонды

Для каждого профиля дай 3-5 рекомендаций.
Доступные фонды: ${FUND_IDS_LIST}`;

  const result = await callDeepSeek(apiKey, prompt, FINANCE_SYSTEM_PROMPT);
  return {
    data: parseAIResponse(result.content),
    tokensUsed: result.tokensUsed,
    duration: result.duration,
  };
}

// ==========================================
// УРОВЕНЬ 2: ЛОКАЛЬНЫЙ ГЕНЕРАТОР
// ==========================================

/**
 * Обёртки над локальным квант-генератором. Синхронные: читают снимок из памяти
 * (или детерминированный холодный снимок), поэтому пригодны и как fallback в роутах.
 */
export function getLocalMarketPrediction() {
  return localMarketPrediction();
}
export function getLocalDividends() {
  return localDividends();
}
export function getLocalRecommendations() {
  return localRecommendations();
}

// ==========================================
// УРОВЕНЬ 3: СТАТИЧЕСКИЙ ФОЛБЭК
// Никакого Math.random: он использовался бы как «данные», а на деле давал шум
// без памяти между часами. Это последний рубеж, если упал даже генератор.
// ==========================================

function getStaticMarketPrediction() {
  return {
    overallSentiment: 'neutral',
    stockPredictions: STOCKS.map((s) => ({
      stockId: s.id,
      symbol: s.symbol,
      predictedDirection: 'stable',
      confidence: 0.4,
      predictedChange: 0,
      reasoning: 'Данные рынка временно недоступны',
    })),
    creditRatePrediction: {
      predictedBaseRate: 0.09,
      rateDirection: 'stable',
      reasoning: 'Ставка удерживается на базовом уровне',
    },
    marketNarrative:
      'Рыночная аналитика временно недоступна. Показаны базовые значения без прогноза.',
    source: 'fallback',
  };
}

function getStaticDividends() {
  return {
    dividendUpdates: STOCKS.map((s) => ({
      stockId: s.id,
      newYield: Math.min(s.dividendYield, 0.06),
      change: 'unchanged',
      reason: 'Стандартная дивидендная политика',
    })),
    marketConditions: 'Стабильные рыночные условия',
    source: 'fallback',
  };
}

function getStaticRecommendations() {
  return {
    conservative: [
      { type: 'buy_stock', targetId: 'ores', reasoning: 'Стабильный актив', confidence: 0.55, priority: 1 },
      { type: 'buy_stock', targetId: 'arms', reasoning: 'Низкая волатильность', confidence: 0.55, priority: 2 },
      { type: 'buy_fund', targetId: 'stable_index', reasoning: 'Консервативный фонд', confidence: 0.6, priority: 3 },
    ],
    balanced: [
      { type: 'buy_stock', targetId: 'mech', reasoning: 'Баланс риска и доходности', confidence: 0.5, priority: 1 },
      { type: 'buy_stock', targetId: 'enrg', reasoning: 'Стабильный рост', confidence: 0.5, priority: 2 },
      { type: 'buy_fund', targetId: 'balanced_portfolio', reasoning: 'Сбалансированный фонд', confidence: 0.55, priority: 3 },
    ],
    aggressive: [
      { type: 'buy_stock', targetId: 'qntm', reasoning: 'Высокий потенциал', confidence: 0.45, priority: 1 },
      { type: 'buy_stock', targetId: 'dark', reasoning: 'Экзотические технологии', confidence: 0.45, priority: 2 },
      { type: 'buy_fund', targetId: 'tech_innovation', reasoning: 'Технологический фонд', confidence: 0.5, priority: 3 },
    ],
    source: 'fallback',
  };
}

/**
 * Публичные fallback-функции (их импортируют server/ai.js и server/offline-trading.js).
 * Синхронные — сигнатуры не менялись. Внутри: сначала локальный генератор, затем статика.
 */
export function getFallbackMarketPrediction() {
  try {
    return getLocalMarketPrediction();
  } catch (e) {
    console.error('[AI Oracle] local market prediction failed:', e.message);
    return getStaticMarketPrediction();
  }
}

export function getFallbackDividends() {
  try {
    return getLocalDividends();
  } catch (e) {
    console.error('[AI Oracle] local dividends failed:', e.message);
    return getStaticDividends();
  }
}

export function getFallbackRecommendations() {
  try {
    return getLocalRecommendations();
  } catch (e) {
    console.error('[AI Oracle] local recommendations failed:', e.message);
    return getStaticRecommendations();
  }
}

// ==========================================
// ЦИКЛ ОБНОВЛЕНИЯ
// ==========================================

async function upsertOracleData(pool, dataType, payload, expiresAt, requestCount) {
  await pool.query(
    `INSERT INTO ai_oracle_data (data_type, data, generated_at, expires_at, request_count)
     VALUES ($1, $2, NOW(), $3, $4)
     ON CONFLICT (data_type) DO UPDATE SET
       data = EXCLUDED.data,
       generated_at = NOW(),
       expires_at = EXCLUDED.expires_at,
       request_count = ai_oracle_data.request_count + 1`,
    [dataType, JSON.stringify(payload), expiresAt, requestCount]
  );
}

/** true, если ключ DeepSeek задан и не пустой. */
function hasApiKey() {
  const k = process.env.DEEPSEEK_API_KEY;
  return typeof k === 'string' && k.trim().length > 0;
}

/** Защита от наложения циклов (сеть DeepSeek может тормозить дольше часа). */
let oracleRunning = false;
let oracleTimer = null;

/**
 * Основная функция обновления AI Oracle.
 * Сначала ВСЕГДА продвигает рыночную симуляцию (она — источник правды по ценам),
 * затем строит три документа по каскаду источников.
 */
async function runOracleUpdate(pool) {
  const apiKey = hasApiKey() ? process.env.DEEPSEEK_API_KEY : null;
  const expiresAt = new Date(Date.now() + UPDATE_INTERVAL_MS);

  console.log(`[AI Oracle] Starting hourly update cycle (DeepSeek: ${apiKey ? 'on' : 'off'})...`);

  let requestCount = 0;
  let totalTokens = 0;

  // === 0. Рыночная симуляция — единственный источник правды по ценам ===
  let snapshotOk = true;
  try {
    await stepMarketSim(pool);
  } catch (e) {
    snapshotOk = false;
    console.error('[AI Oracle] шаг рыночной симуляции не удался:', describeError(e));
  }

  // === 1. Прогноз рынка ===
  let marketPrediction = null;
  if (apiKey && requestCount < MAX_REQUESTS_PER_CYCLE) {
    try {
      console.log('[AI Oracle] Generating market prediction via DeepSeek...');
      const result = await generateMarketPrediction(apiKey);
      marketPrediction = { ...result.data, source: 'ai', generatedAt: Date.now() };
      requestCount++;
      totalTokens += result.tokensUsed;
      await logRequest(pool, 'market_prediction', true, null, result.tokensUsed, result.duration);
      console.log(`[AI Oracle] Market prediction generated (${result.tokensUsed} tokens, ${result.duration}ms)`);
    } catch (error) {
      console.error('[AI Oracle] DeepSeek market prediction failed:', error.message);
      await logRequest(pool, 'market_prediction', false, error.message);
      marketPrediction = null;
    }
  }
  if (!marketPrediction) {
    marketPrediction = getFallbackMarketPrediction();
  }
  lastSources.market_prediction = marketPrediction.source;
  await upsertOracleData(pool, 'market_prediction', marketPrediction, expiresAt, requestCount);

  // === 2. Дивиденды ===
  let dividends = null;
  if (apiKey && requestCount < MAX_REQUESTS_PER_CYCLE) {
    try {
      console.log('[AI Oracle] Generating dividend yields via DeepSeek...');
      const result = await generateDividendYields(apiKey);
      dividends = { ...result.data, source: 'ai', generatedAt: Date.now() };
      // Потолок 0.06 обязателен и для AI: processDividends платит newYield от
      // стоимости позиции раз в 7 дней без деления на 52.
      if (Array.isArray(dividends.dividendUpdates)) {
        dividends.dividendUpdates = dividends.dividendUpdates.map((u) => ({
          ...u,
          newYield: Math.min(Math.max(Number(u.newYield) || 0, 0), 0.06),
        }));
      }
      requestCount++;
      totalTokens += result.tokensUsed;
      await logRequest(pool, 'dividends', true, null, result.tokensUsed, result.duration);
      console.log(`[AI Oracle] Dividends generated (${result.tokensUsed} tokens, ${result.duration}ms)`);
    } catch (error) {
      console.error('[AI Oracle] DeepSeek dividends failed:', error.message);
      await logRequest(pool, 'dividends', false, error.message);
      dividends = null;
    }
  }
  if (!dividends) {
    dividends = getFallbackDividends();
  }
  lastSources.dividends = dividends.source;
  await upsertOracleData(pool, 'dividends', dividends, expiresAt, requestCount);

  // === 3. Рекомендации ===
  let recommendations = null;
  if (apiKey && requestCount < MAX_REQUESTS_PER_CYCLE) {
    try {
      console.log('[AI Oracle] Generating recommendation templates via DeepSeek...');
      const result = await generateRecommendationTemplates(apiKey, marketPrediction);
      recommendations = { ...result.data, source: 'ai', generatedAt: Date.now() };
      requestCount++;
      totalTokens += result.tokensUsed;
      await logRequest(pool, 'recommendations', true, null, result.tokensUsed, result.duration);
      console.log(`[AI Oracle] Recommendations generated (${result.tokensUsed} tokens, ${result.duration}ms)`);
    } catch (error) {
      console.error('[AI Oracle] DeepSeek recommendations failed:', error.message);
      await logRequest(pool, 'recommendations', false, error.message);
      recommendations = null;
    }
  }
  if (!recommendations) {
    recommendations = getFallbackRecommendations();
  }
  lastSources.recommendations = recommendations.source;
  await upsertOracleData(pool, 'recommendations', recommendations, expiresAt, requestCount);

  lastCycleAt = Date.now();

  console.log(
    `[AI Oracle] Update cycle completed: ${requestCount} DeepSeek requests, ${totalTokens} tokens, ` +
      `sources: prediction=${lastSources.market_prediction}, dividends=${lastSources.dividends}, ` +
      `recommendations=${lastSources.recommendations}${snapshotOk ? '' : ' (sim degraded)'}`
  );

  return { requestCount, totalTokens, sources: { ...lastSources } };
}

/**
 * Обёртка с защитой от наложения запусков — в два слоя.
 *
 * Сначала локальный флаг: он ловит самый частый случай (предыдущий цикл этого же процесса ещё
 * идёт) без похода в пул за соединением. Затем advisory-лок, который делает то же самое поперёк
 * процессов — см. AI_ORACLE_LOCK_KEY.
 *
 * Не получить лок — НОРМАЛЬНЫЙ исход, а не ошибка: значит цикл уже крутит кто-то другой, и
 * данные в ai_oracle_data всё равно обновятся. Поэтому здесь warn, а не error, и `skipped`
 * с причиной, чтобы в логах было видно, почему тик прошёл без запросов к DeepSeek.
 */
async function runOracleUpdateGuarded(pool) {
  if (oracleRunning) {
    console.warn('[AI Oracle] previous cycle still running, skipping this tick');
    return { skipped: true, reason: 'local' };
  }
  oracleRunning = true;
  try {
    const { locked, result } = await withAdvisoryLock(
      pool,
      () => runOracleUpdate(pool),
      AI_ORACLE_LOCK_KEY
    );
    if (!locked) {
      console.warn('[AI Oracle] цикл уже выполняет другой процесс, тик пропущен');
      return { skipped: true, reason: 'locked-elsewhere' };
    }
    return result;
  } finally {
    oracleRunning = false;
  }
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
  await initAIOracleTables(pool);

  console.log('[AI Oracle] Running initial update...');
  await runOracleUpdateGuarded(pool);

  stopAIOracle();
  oracleTimer = setInterval(() => {
    runOracleUpdateGuarded(pool).catch((error) => {
      console.error('[AI Oracle] Scheduled update failed:', error);
    });
  }, UPDATE_INTERVAL_MS);
  // unref, чтобы таймер не держал процесс при завершении
  if (typeof oracleTimer.unref === 'function') oracleTimer.unref();

  console.log(`[AI Oracle] Started with ${UPDATE_INTERVAL_MS / 1000 / 60} minute update interval`);
}

/** Останов оракула (используется при shutdown и при повторном старте). */
function stopAIOracle() {
  if (oracleTimer) {
    clearInterval(oracleTimer);
    oracleTimer = null;
  }
}

/** Какой источник реально активен сейчас (для /api/ai/status). */
function getOracleSourceStatus() {
  const snap = getSnapshot();
  return {
    deepseekConfigured: hasApiKey(),
    activeSource: lastSources.market_prediction || (hasApiKey() ? 'ai' : 'local'),
    perType: { ...lastSources },
    lastCycleAt,
    isRunning: oracleRunning,
    localGenerator: {
      available: true,
      ready: snap !== null,
      tick: snap ? snap.tick : null,
      regime: snap ? snap.regime : null,
    },
  };
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
  stopAIOracle,
  runOracleUpdate,
  runOracleUpdateGuarded,
  getOracleData,
  getOracleSourceStatus,
  initAIOracleTables,
  adaptRecommendationsForPlayer,
  UPDATE_INTERVAL_MS,
};
