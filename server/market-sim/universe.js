/**
 * server/market-sim/universe.js
 *
 * Серверное зеркало финансовых констант клиента + единый список торгуемых ресурсов.
 *
 * ЕДИНЫЙ ИСТОЧНИК ПРАВДЫ на сервере:
 *   - STOCKS            <- src/core/constants/stocks.ts (STOCK_DEFINITIONS, 12 акций, включая dark/DARK)
 *   - SECTORS           <- src/core/gameTypes.finance.ts (StockSector, 8 секторов)
 *   - FUNDS             <- src/core/constants/funds.ts (FUND_DEFINITIONS, 5 фондов)
 *   - VOL_PARAMS.trend  <- src/core/constants/stocks.ts (VOLATILITY_MULTIPLIERS[*].trend)
 *   - RESOURCE_UNIVERSE <- src/components/game/market/OrderForm.tsx (52 id, все проверены
 *                          по ResourceType/TradeResourceType в src/core/gameTypes.ts)
 *   - RESOURCE_BASE_PRICES <- src/features/gameStore.ts (BASE_MARKET_PRICES, balance.md)
 *
 * assertParity() внизу файла проверяет внутреннюю согласованность и вызывается при старте:
 * если кто-то добавит акцию/ресурс только в одном месте, сервер скажет об этом сразу.
 */

/** 8 секторов — ровно как StockSector в src/core/gameTypes.finance.ts */
export const SECTORS = [
  'energy',
  'mining',
  'technology',
  'manufacturing',
  'aerospace',
  'entertainment',
  'biotech',
  'exotic',
];

/** 12 акций — зеркало STOCK_DEFINITIONS. ВНИМАНИЕ: 12-я акция — dark/DARK, не xeno. */
export const STOCKS = [
  { id: 'ores', symbol: 'ORES', name: 'Ore Mining Corporation', sector: 'mining', basePrice: 45.5, volatility: 'low', dividendYield: 0.03, marketCap: 5e9 },
  { id: 'enrg', symbol: 'ENRG', name: 'Energy Solutions Inc', sector: 'energy', basePrice: 78.25, volatility: 'medium', dividendYield: 0.04, marketCap: 8.5e9 },
  { id: 'slrs', symbol: 'SLRS', name: 'Solar Systems Incorporated', sector: 'energy', basePrice: 125.0, volatility: 'high', dividendYield: 0.01, marketCap: 12e9 },
  { id: 'chip', symbol: 'CHIP', name: 'ChipTech Industries', sector: 'technology', basePrice: 250.0, volatility: 'high', dividendYield: 0, marketCap: 25e9 },
  { id: 'mech', symbol: 'MECH', name: 'MechFactory Ltd', sector: 'manufacturing', basePrice: 62.75, volatility: 'medium', dividendYield: 0.025, marketCap: 4.2e9 },
  { id: 'aero', symbol: 'AERO', name: 'AeroSpace Dynamics', sector: 'aerospace', basePrice: 420.0, volatility: 'high', dividendYield: 0.005, marketCap: 35e9 },
  { id: 'medi', symbol: 'MEDI', name: 'MediBiotech Corporation', sector: 'biotech', basePrice: 180.0, volatility: 'very_high', dividendYield: 0, marketCap: 15e9 },
  { id: 'game', symbol: 'GAME', name: 'GameStream Corporation', sector: 'entertainment', basePrice: 95.5, volatility: 'high', dividendYield: 0.01, marketCap: 8e9 },
  { id: 'arms', symbol: 'ARMS', name: 'DefenseTech Industries', sector: 'manufacturing', basePrice: 88.0, volatility: 'low', dividendYield: 0.05, marketCap: 6.5e9 },
  { id: 'cryo', symbol: 'CRYO', name: 'CryoGenetics Research', sector: 'biotech', basePrice: 145.0, volatility: 'very_high', dividendYield: 0, marketCap: 9.5e9 },
  { id: 'qntm', symbol: 'QNTM', name: 'Quantum Computing Corp', sector: 'technology', basePrice: 550.0, volatility: 'extreme', dividendYield: 0, marketCap: 45e9 },
  { id: 'dark', symbol: 'DARK', name: 'Dark Matter Ventures', sector: 'exotic', basePrice: 1200.0, volatility: 'extreme', dividendYield: 0, marketCap: 100e9 },
];

export const STOCK_BY_ID = Object.fromEntries(STOCKS.map((s) => [s.id, s]));
export const STOCK_IDS = STOCKS.map((s) => s.id);

/** Русские названия секторов для нарративов. */
export const SECTOR_RU = {
  energy: 'энергетика',
  mining: 'горнодобыча',
  technology: 'технологии',
  manufacturing: 'производство',
  aerospace: 'аэрокосмос',
  entertainment: 'развлечения',
  biotech: 'биотех',
  exotic: 'экзотические технологии',
};

/**
 * Квант-параметры по классу волатильности.
 *
 * trend    — ровно VOLATILITY_MULTIPLIERS[class].trend из stocks.ts: это калибровка самой игры,
 *            поэтому мгновенная волатильность за тик остаётся такой же, как у клиентского симулятора.
 * targetSd — целевое стационарное СКО логарифма отклонения цены от «якоря» (0.12 = ±12%).
 *            Из trend и targetSd выводится сила возврата к среднему k, поэтому цена
 *            гуляет в заранее заданном коридоре и не может уйти в бесконечность.
 * b, c, e  — загрузки на рыночный / секторный / идиосинкратический фактор.
 *            Факторы имеют единичную дисперсию и b^2+c^2+e^2=1, поэтому b и c — это буквально
 *            корреляции: корреляция двух акций одного сектора = b_i*b_j + c_i*c_j.
 * jumpMult — множитель интенсивности скачков (новостной риск).
 */
export const VOL_PARAMS = {
  low:       { trend: 0.005, targetSd: 0.12, b: 0.55, c: 0.35, jumpMult: 0.6 },
  medium:    { trend: 0.010, targetSd: 0.20, b: 0.60, c: 0.38, jumpMult: 0.8 },
  high:      { trend: 0.020, targetSd: 0.30, b: 0.62, c: 0.42, jumpMult: 1.0 },
  very_high: { trend: 0.030, targetSd: 0.40, b: 0.55, c: 0.50, jumpMult: 1.3 },
  extreme:   { trend: 0.050, targetSd: 0.55, b: 0.45, c: 0.45, jumpMult: 1.6 },
};

/**
 * Индивидуальные переопределения.
 * arms — оборонка: слабая связь с рынком и отрицательная бета к кризису (хедж, «в кризис растёт»).
 * dark — тёмная материя: максимальная бета к кризису (падает сильнее всех).
 */
export const STOCK_OVERRIDES = {
  arms: { b: 0.35, c: 0.25, crisisBeta: -0.15 },
  dark: { crisisBeta: 0.9 },
};

/** Секулярный (очень медленный) тренд якоря по секторам: технологии дорожают, сырьё дешевеет. */
export const SECTOR_SECULAR = {
  technology: 1.0,
  exotic: 1.2,
  biotech: 0.8,
  aerospace: 0.5,
  entertainment: 0.3,
  manufacturing: 0.0,
  energy: -0.2,
  mining: -0.3,
};

/** Загрузки конкретной акции с учётом переопределений. e считается из нормировки. */
export function stockParams(stockId) {
  const def = STOCK_BY_ID[stockId];
  if (!def) throw new Error(`[market-sim] unknown stock: ${stockId}`);
  const base = VOL_PARAMS[def.volatility];
  const ov = STOCK_OVERRIDES[def.id] || {};
  const b = ov.b !== undefined ? ov.b : base.b;
  const c = ov.c !== undefined ? ov.c : base.c;
  const rest = 1 - b * b - c * c;
  const e = Math.sqrt(rest > 0 ? rest : 0.0001);
  return {
    id: def.id,
    symbol: def.symbol,
    sector: def.sector,
    volatility: def.volatility,
    basePrice: def.basePrice,
    marketCap: def.marketCap,
    dividendYield: def.dividendYield,
    trend: base.trend,
    targetSd: base.targetSd,
    jumpMult: ov.jumpMult !== undefined ? ov.jumpMult : base.jumpMult,
    crisisBeta: ov.crisisBeta !== undefined ? ov.crisisBeta : 1,
    b,
    c,
    e,
  };
}

export const STOCK_PARAMS = Object.fromEntries(STOCK_IDS.map((id) => [id, stockParams(id)]));

/** 5 фондов — зеркало FUND_DEFINITIONS (состав и риск нужны для прогноза и рекомендаций). */
export const FUNDS = [
  {
    id: 'stable_index',
    name: 'Stable Index Fund',
    riskLevel: 1,
    annualReturn: 0.05,
    composition: [
      { stockId: 'ores', weight: 0.25 },
      { stockId: 'enrg', weight: 0.25 },
      { stockId: 'mech', weight: 0.25 },
      { stockId: 'arms', weight: 0.25 },
    ],
  },
  {
    id: 'growth_leaders',
    name: 'Growth Leaders Fund',
    riskLevel: 3,
    annualReturn: 0.12,
    composition: [
      { stockId: 'chip', weight: 0.3 },
      { stockId: 'slrs', weight: 0.25 },
      { stockId: 'aero', weight: 0.25 },
      { stockId: 'game', weight: 0.2 },
    ],
  },
  {
    id: 'tech_innovation',
    name: 'Tech Innovation Fund',
    riskLevel: 4,
    annualReturn: 0.18,
    composition: [
      { stockId: 'chip', weight: 0.25 },
      { stockId: 'qntm', weight: 0.3 },
      { stockId: 'medi', weight: 0.25 },
      { stockId: 'cryo', weight: 0.2 },
    ],
  },
  {
    id: 'high_dividend',
    name: 'High Dividend Income Fund',
    riskLevel: 2,
    annualReturn: 0.08,
    composition: [
      { stockId: 'arms', weight: 0.3 },
      { stockId: 'enrg', weight: 0.3 },
      { stockId: 'ores', weight: 0.25 },
      { stockId: 'mech', weight: 0.15 },
    ],
  },
  {
    id: 'balanced_portfolio',
    name: 'Balanced Portfolio Fund',
    riskLevel: 2,
    annualReturn: 0.07,
    composition: [
      { stockId: 'ores', weight: 0.15 },
      { stockId: 'enrg', weight: 0.15 },
      { stockId: 'chip', weight: 0.15 },
      { stockId: 'aero', weight: 0.15 },
      { stockId: 'mech', weight: 0.15 },
      { stockId: 'arms', weight: 0.15 },
      { stockId: 'game', weight: 0.1 },
    ],
  },
];

export const FUND_BY_ID = Object.fromEntries(FUNDS.map((f) => [f.id, f]));

/**
 * Каталог поводов для скачков цены — по сектору. Только фразы-причины (для reasoning);
 * полноценные новостные события с фазами живут в events.js.
 * up — позитивный повод, down — негативный.
 */
export const EVENT_CATALOGUE = {
  mining: {
    up: ['открыто богатое месторождение', 'рост спроса на руду со стороны сталелитейщиков', 'сорван график конкурента'],
    down: ['обвал спроса на сырьё', 'авария на обогатительной фабрике', 'снижение содержания металла в породе'],
  },
  energy: {
    up: ['контракт на поставку энергии колонии', 'запуск нового реактора', 'холодная зима подняла потребление'],
    down: ['отключение блока на профилактику', 'тариф урезали регуляторы', 'перепроизводство топлива'],
  },
  technology: {
    up: ['выход нового техпроцесса', 'крупный заказ на чипы', 'патентная победа в суде'],
    down: ['срыв поставок кремния', 'утечка данных у клиента', 'конкурент обошёл по производительности'],
  },
  manufacturing: {
    up: ['госзаказ на технику', 'ввод новой автоматической линии', 'подорожание продукции при том же сырье'],
    down: ['забастовка на сборочном производстве', 'отзыв партии из-за дефекта', 'подорожало входное сырьё'],
  },
  aerospace: {
    up: ['успешный запуск тяжёлой ракеты', 'подписан контракт на орбитальную станцию', 'сертификация нового двигателя'],
    down: ['авария на испытаниях', 'перенос программы запусков', 'урезан бюджет космического агентства'],
  },
  entertainment: {
    up: ['релиз стал хитом', 'рекорд по подписчикам', 'удачная лицензионная сделка'],
    down: ['провал крупного релиза', 'отток подписчиков', 'скандал вокруг студии'],
  },
  biotech: {
    up: ['успешная третья фаза испытаний', 'одобрение препарата регулятором', 'прорыв в генной терапии'],
    down: ['испытания провалены', 'отказ регулятора', 'иск от пострадавших пациентов'],
  },
  exotic: {
    up: ['стабилизирована ловушка тёмной материи', 'подтверждён теоретический прорыв', 'первый промышленный образец'],
    down: ['эксперимент не воспроизвели', 'потеря установки при аварии', 'инвесторы усомнились в технологии'],
  },
};

// ==========================================
// РЕСУРСЫ (товарный рынок)
// ==========================================

/**
 * ЕДИНЫЙ список торгуемых ресурсов сервера — 52 id.
 * Источник: TRADEABLE_RESOURCES в src/components/game/market/OrderForm.tsx.
 * Каждый id сверен с union ResourceType и TradeResourceType в src/core/gameTypes.ts —
 * все 52 присутствуют в обоих, отброшенных нет.
 *
 * server/market.js импортирует именно этот массив, поэтому клиент, биржа и симулятор
 * физически не могут разойтись.
 */
export const RESOURCE_UNIVERSE = [
  // T1-T2: базовое сырьё
  'ore', 'ice', 'carbon', 'steel',
  'natural_gas', 'oil', 'gasoline', 'plastic', 'glass', 'sand',
  // Металлы
  'uranium', 'chrome', 'titanium',
  // Продвинутые
  'copper', 'semiconductors', 'dynamite', 'fiber',
  // Сложное производство
  'integrated_circuit', 'battery', 'engine', 'display', 'computer',
  'liquid_fuel', 'chrome_alloy', 'titanium_alloy', 'enriched_uranium',
  // Военные
  'weapon', 'artillery', 'radar', 'nuclear_bomb',
  // Космические
  'jet_engine', 'satellite', 'rocket', 'spaceship', 'console', 'space_station',
  // Специальные
  'robot',
  // T6-T7: развлечения, культура, медицина, крипта
  'music_album', 'movie', 'video_game', 'vr_headset', 'ar_glasses',
  'gaming_console', 'smart_tv', 'artwork', 'sculpture', 'literature',
  'fashion', 'jewelry', 'medicine', 'vaccine', 'cryptocurrency',
];

/**
 * Референсные (базовые) цены ресурсов в кредитах.
 *
 * Источник: BASE_MARKET_PRICES в src/features/gameStore.ts — там определены ВСЕ 52 id
 * (это тот же набор чисел, что и BASE_RESOURCE_PRICES в src/core/constants/market.ts,
 * но market.ts покрывает только 39 id и не содержит T6-T7, поэтому берём gameStore).
 * Числа взяты из balance.md, поэтому референс сервера совпадает с ценой у брокера
 * и не создаёт арбитража.
 */
export const RESOURCE_BASE_PRICES = {
  ore: 2, ice: 3, carbon: 4, steel: 15,
  natural_gas: 5, oil: 6, gasoline: 12, plastic: 10, glass: 8, sand: 1,
  uranium: 50, chrome: 25, titanium: 30,
  copper: 8, semiconductors: 35, dynamite: 22, fiber: 16,
  integrated_circuit: 60, battery: 45, engine: 80, display: 55, computer: 120,
  liquid_fuel: 18, chrome_alloy: 40, titanium_alloy: 50, enriched_uranium: 150,
  weapon: 70, artillery: 100, radar: 90, nuclear_bomb: 500,
  jet_engine: 200, satellite: 300, rocket: 250, spaceship: 500, console: 150, space_station: 1000,
  robot: 180,
  music_album: 250, movie: 450, video_game: 350, vr_headset: 280, ar_glasses: 220,
  gaming_console: 200, smart_tv: 180, artwork: 400, sculpture: 350, literature: 120,
  fashion: 180, jewelry: 500, medicine: 150, vaccine: 280, cryptocurrency: 600,
};

/**
 * Привязка ресурсов к тем же 8 секторам, что и акции: секторный фактор акций
 * двигает и товарные цены (связь «рынок акций <-> рынок сырья»).
 */
export const RESOURCE_SECTORS = {
  ore: 'mining', ice: 'mining', carbon: 'mining', sand: 'mining',
  uranium: 'mining', chrome: 'mining', titanium: 'mining', copper: 'mining',

  natural_gas: 'energy', oil: 'energy', gasoline: 'energy', liquid_fuel: 'energy',
  battery: 'energy', enriched_uranium: 'energy',

  steel: 'manufacturing', plastic: 'manufacturing', glass: 'manufacturing',
  dynamite: 'manufacturing', fiber: 'manufacturing', engine: 'manufacturing',
  chrome_alloy: 'manufacturing', titanium_alloy: 'manufacturing',
  weapon: 'manufacturing', artillery: 'manufacturing', radar: 'manufacturing',
  nuclear_bomb: 'manufacturing', robot: 'manufacturing',
  fashion: 'manufacturing', jewelry: 'manufacturing',

  semiconductors: 'technology', integrated_circuit: 'technology', display: 'technology',
  computer: 'technology', console: 'technology', vr_headset: 'technology',
  ar_glasses: 'technology', gaming_console: 'technology', smart_tv: 'technology',

  jet_engine: 'aerospace', satellite: 'aerospace', rocket: 'aerospace',
  spaceship: 'aerospace', space_station: 'aerospace',

  music_album: 'entertainment', movie: 'entertainment', video_game: 'entertainment',
  artwork: 'entertainment', sculpture: 'entertainment', literature: 'entertainment',

  medicine: 'biotech', vaccine: 'biotech',

  cryptocurrency: 'exotic',
};

/**
 * Передача цены по производственной цепочке (input -> output) с задержкой в 1 тик:
 * подорожала руда — на следующем тике подтягивается сталь.
 * Только для звеньев, которые реально есть в RESOURCE_UNIVERSE.
 */
export const PASSTHROUGH = {
  steel: 'ore',
  gasoline: 'oil',
  liquid_fuel: 'oil',
  plastic: 'oil',
  glass: 'sand',
  semiconductors: 'sand',
  enriched_uranium: 'uranium',
  chrome_alloy: 'chrome',
  titanium_alloy: 'titanium',
  integrated_circuit: 'semiconductors',
  computer: 'integrated_circuit',
  display: 'glass',
  battery: 'copper',
  engine: 'steel',
  weapon: 'steel',
  artillery: 'weapon',
  radar: 'integrated_circuit',
  nuclear_bomb: 'enriched_uranium',
  jet_engine: 'engine',
  rocket: 'jet_engine',
  satellite: 'radar',
  spaceship: 'rocket',
  space_station: 'spaceship',
  robot: 'computer',
  console: 'computer',
  gaming_console: 'integrated_circuit',
  smart_tv: 'display',
  vr_headset: 'display',
  ar_glasses: 'display',
  video_game: 'computer',
  vaccine: 'medicine',
  jewelry: 'chrome',
  fashion: 'fiber',
};

/** Доля лог-изменения входного ресурса, которая перетекает в выходной. */
export const PASSTHROUGH_WEIGHT = 0.25;

/**
 * Глубина производственной цепочки для ресурса (по PASSTHROUGH).
 * Используется только как страховка: если у ресурса нет базовой цены в
 * RESOURCE_BASE_PRICES (сейчас таких нет), цена выводится из глубины цепочки
 * как 2 * 2.2^depth — то есть из его положения в переработке, а не «магическим числом».
 */
export function chainDepth(resource, seen = new Set()) {
  if (seen.has(resource)) return 0;
  seen.add(resource);
  const parent = PASSTHROUGH[resource];
  if (!parent) return 0;
  return 1 + chainDepth(parent, seen);
}

export function referencePrice(resource) {
  const direct = RESOURCE_BASE_PRICES[resource];
  if (typeof direct === 'number' && direct > 0) return direct;
  // Нет авторской цены — выводим из глубины передела (см. комментарий к chainDepth).
  return 2 * Math.pow(2.2, chainDepth(resource));
}

export const RESOURCE_REFERENCE_PRICES = Object.fromEntries(
  RESOURCE_UNIVERSE.map((r) => [r, referencePrice(r)])
);

/** Параметры товарного процесса: единые для всех, коридор шире акций. */
export const RESOURCE_PARAMS = {
  tickSd: 0.010,   // мгновенное СКО лог-доходности за 5 мин
  targetSd: 0.22,  // стационарный коридор ±22% от референса
  b: 0.30,         // связь с общим рынком
  c: 0.45,         // связь с секторным фактором
};

/**
 * Проверка внутренней согласованности вселенной.
 * Бросает исключение при старте сервера, если данные разъехались.
 */
export function assertParity() {
  const problems = [];

  if (STOCKS.length !== 12) problems.push(`ожидалось 12 акций, найдено ${STOCKS.length}`);
  if (FUNDS.length !== 5) problems.push(`ожидалось 5 фондов, найдено ${FUNDS.length}`);
  if (RESOURCE_UNIVERSE.length !== 52) {
    problems.push(`ожидалось 52 ресурса, найдено ${RESOURCE_UNIVERSE.length}`);
  }

  const seenStocks = new Set();
  for (const s of STOCKS) {
    if (seenStocks.has(s.id)) problems.push(`дубликат акции ${s.id}`);
    seenStocks.add(s.id);
    if (!SECTORS.includes(s.sector)) problems.push(`акция ${s.id}: неизвестный сектор ${s.sector}`);
    if (!VOL_PARAMS[s.volatility]) problems.push(`акция ${s.id}: неизвестный класс волатильности ${s.volatility}`);
    if (!(s.basePrice > 0)) problems.push(`акция ${s.id}: некорректная базовая цена`);
  }

  for (const s of STOCKS) {
    const p = STOCK_PARAMS[s.id];
    const norm = p.b * p.b + p.c * p.c + p.e * p.e;
    if (Math.abs(norm - 1) > 1e-6) problems.push(`акция ${s.id}: загрузки не нормированы (${norm})`);
  }

  for (const f of FUNDS) {
    let w = 0;
    for (const c of f.composition) {
      w += c.weight;
      if (!STOCK_BY_ID[c.stockId]) problems.push(`фонд ${f.id}: неизвестная акция ${c.stockId}`);
    }
    if (Math.abs(w - 1) > 1e-6) problems.push(`фонд ${f.id}: сумма весов ${w} != 1`);
  }

  const seenRes = new Set();
  for (const r of RESOURCE_UNIVERSE) {
    if (seenRes.has(r)) problems.push(`дубликат ресурса ${r}`);
    seenRes.add(r);
    if (!RESOURCE_SECTORS[r]) problems.push(`ресурс ${r}: не привязан к сектору`);
    else if (!SECTORS.includes(RESOURCE_SECTORS[r])) problems.push(`ресурс ${r}: неизвестный сектор`);
    if (!(RESOURCE_REFERENCE_PRICES[r] > 0)) problems.push(`ресурс ${r}: нет референсной цены`);
  }

  for (const [out, inp] of Object.entries(PASSTHROUGH)) {
    if (!seenRes.has(out)) problems.push(`PASSTHROUGH: выход ${out} вне вселенной`);
    if (!seenRes.has(inp)) problems.push(`PASSTHROUGH: вход ${inp} вне вселенной`);
  }

  for (const sec of SECTORS) {
    if (!EVENT_CATALOGUE[sec]) problems.push(`нет каталога поводов для сектора ${sec}`);
    if (SECTOR_SECULAR[sec] === undefined) problems.push(`нет секулярного тренда для сектора ${sec}`);
    if (!SECTOR_RU[sec]) problems.push(`нет русского названия сектора ${sec}`);
  }

  if (problems.length > 0) {
    throw new Error(`[market-sim] universe parity failed:\n - ${problems.join('\n - ')}`);
  }
  return true;
}
