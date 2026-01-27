# 🚀 ДЕТАЛЬНЫЙ ПЛАН РЕАЛИЗАЦИИ: РАСШИРЕНИЕ ИГРЫ

> **Версия:** 2.0  
> **Дата создания:** 26 января 2026 г.  
> **Статус:** 

---

## 📋 ОГЛАВЛЕНИЕ

[x] 1. [Фаза 1: Мультиплеерная торговля](#фаза-1-мультиплеерная-торговля)
[x] 2. [Фаза 2: Подробные графики и аналитика](#фаза-2-подробные-графики-и-аналитика)
[x] 3. [Фаза 3: Новые ресурсы и цепочки](#фаза-3-новые-ресурсы-и-цепочки)
[x] 4. [Фаза 4: Разные типы карт](#фаза-4-разные-типы-карт)
[x] 5. [Фаза 5: Продвинутые настройки фабрик](#фаза-5-продвинутые-настройки-фабрик)
[x] 6. [Фаза 6: Финансовая система](#фаза-6-финансовая-система)
[x] 7. [Фаза 7: Культура и наука](#фаза-7-культура-и-наука)
8. [Фаза 8: Cloud Sync](#фаза-8-cloud-sync)

---

## 🟢 ФАЗА 1: МУЛЬТИПЛЕЕРНАЯ ТОРГОВЛЯ

### 1.1 Описание
Создание глобальной торговой биржи для обмена ресурсами между игроками в реальном времени.

### 1.2 Новые типы данных

```typescript
// Типы ордеров
type OrderType = 'buy' | 'sell';
type OrderStatus = 'open' | 'filled' | 'partial' | 'cancelled' | 'expired';

// Ордер на бирже
interface MarketOrder {
  id: string;
  playerId: string;
  playerName: string;
  type: OrderType;
  resource: TradeResourceType;
  quantity: Decimal;           // Количество ресурса
  quantityFilled: Decimal;     // Сколько уже исполнено
  pricePerUnit: Decimal;       // Цена за единицу в кредитах
  status: OrderStatus;
  createdAt: number;           // timestamp
  expiresAt: number;           // timestamp (24ч по умолчанию)
  guildId?: string;            // Для гильдейских ордеров
}

// Трейдер (профиль игрока на бирже)
interface TraderProfile {
  playerId: string;
  playerName: string;
  rating: number;              // 1-5 звёзд
  totalTrades: number;
  successfulTrades: number;
  totalVolume: Decimal;        // Общий объём торгов
  memberSince: number;         // timestamp
  guildId?: string;
  badges: TraderBadge[];
}

type TraderBadge = 
  | 'newcomer'           // < 10 сделок
  | 'active_trader'      // > 100 сделок
  | 'whale'              // > 1M объём
  | 'reliable'           // > 95% успешных сделок
  | 'guild_master'       // Глава гильдии
  | 'market_maker';      // Поддерживает ликвидность

// Торговая гильдия
interface TradeGuild {
  id: string;
  name: string;
  tag: string;                 // 3-4 буквы, например [TRD]
  leaderId: string;
  memberIds: string[];
  maxMembers: number;          // 5-50 в зависимости от уровня
  level: number;               // 1-10
  experience: Decimal;
  treasury: Decimal;           // Общая казна кредитов
  bonuses: GuildBonus[];
  createdAt: number;
}

type GuildBonus = 
  | 'trade_fee_reduction'     // -5% комиссии
  | 'priority_orders'         // Приоритет исполнения
  | 'bulk_discount'           // Скидка на большие объёмы
  | 'extended_order_time';    // Ордера живут 48ч вместо 24ч
```

### 1.3 Серверные эндпоинты (Node.js)

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/market/orders` | Получить активные ордера (с фильтрами) |
| POST | `/api/market/orders` | Создать новый ордер |
| DELETE | `/api/market/orders/:id` | Отменить свой ордер |
| GET | `/api/market/history` | История своих сделок |
| GET | `/api/market/prices` | Текущие рыночные цены |
| GET | `/api/traders/:id` | Профиль трейдера |
| GET | `/api/traders/leaderboard` | Топ трейдеров |
| POST | `/api/guilds` | Создать гильдию |
| GET | `/api/guilds/:id` | Информация о гильдии |
| POST | `/api/guilds/:id/join` | Вступить в гильдию |
| POST | `/api/guilds/:id/leave` | Покинуть гильдию |

### 1.4 Новые компоненты UI

```
src/components/game/market/
├── GlobalMarketPanel.tsx        # Главная панель биржи
├── OrderBook.tsx                # Книга ордеров (bid/ask)
├── OrderForm.tsx                # Форма создания ордера
├── MyOrders.tsx                 # Мои активные ордера
├── TradeHistory.tsx             # История сделок
├── PriceChart.tsx               # График цен (candlestick)
├── TraderProfile.tsx            # Профиль трейдера
├── TraderLeaderboard.tsx        # Таблица лидеров
├── GuildPanel.tsx               # Панель гильдии
├── GuildSearch.tsx              # Поиск гильдий
└── GuildChat.tsx                # Чат гильдии
```

### 1.5 Механики

**Комиссия биржи:**
- Базовая: 2% от сделки
- С гильдией: 1.5%
- VIP (> 1M объёма): 1%

**Matching Engine (сопоставление ордеров):**
- Price-time priority (лучшая цена → раньше создан)
- Partial fill поддерживается
- Market orders исполняются мгновенно по лучшей цене

**Защита от манипуляций:**
- Лимит 100 активных ордеров на игрока
- Минимальный объём ордера: 10 единиц
- Cooldown 1 минута между созданием ордеров на один ресурс

### 1.6 База данных (PostgreSQL)

```sql
-- Таблица ордеров
CREATE TABLE market_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES users(id),
  order_type VARCHAR(4) NOT NULL, -- 'buy' или 'sell'
  resource VARCHAR(50) NOT NULL,
  quantity DECIMAL NOT NULL,
  quantity_filled DECIMAL DEFAULT 0,
  price_per_unit DECIMAL NOT NULL,
  status VARCHAR(20) DEFAULT 'open',
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  guild_id UUID REFERENCES guilds(id)
);

-- Таблица сделок
CREATE TABLE market_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buy_order_id UUID REFERENCES market_orders(id),
  sell_order_id UUID REFERENCES market_orders(id),
  resource VARCHAR(50) NOT NULL,
  quantity DECIMAL NOT NULL,
  price_per_unit DECIMAL NOT NULL,
  total_amount DECIMAL NOT NULL,
  fee DECIMAL NOT NULL,
  executed_at TIMESTAMP DEFAULT NOW()
);

-- Таблица трейдеров
CREATE TABLE traders (
  player_id UUID PRIMARY KEY REFERENCES users(id),
  player_name VARCHAR(100) NOT NULL,
  rating DECIMAL DEFAULT 5.0,
  total_trades INTEGER DEFAULT 0,
  successful_trades INTEGER DEFAULT 0,
  total_volume DECIMAL DEFAULT 0,
  member_since TIMESTAMP DEFAULT NOW(),
  guild_id UUID REFERENCES guilds(id)
);

-- Таблица гильдий
CREATE TABLE guilds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  tag VARCHAR(4) UNIQUE NOT NULL,
  leader_id UUID NOT NULL REFERENCES users(id),
  level INTEGER DEFAULT 1,
  experience DECIMAL DEFAULT 0,
  treasury DECIMAL DEFAULT 0,
  max_members INTEGER DEFAULT 10,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Индексы
CREATE INDEX idx_orders_status ON market_orders(status);
CREATE INDEX idx_orders_resource ON market_orders(resource);
CREATE INDEX idx_orders_player ON market_orders(player_id);
CREATE INDEX idx_trades_time ON market_trades(executed_at);
```

### 1.7 Файлы для создания/изменения

| Файл | Действие | Описание |
|------|----------|----------|
| `server/market.js` | Создать | Логика биржи |
| `server/guilds.js` | Создать | Логика гильдий |
| `server/migration_market.sql` | Создать | Миграция БД |
| `src/core/gameTypes.market.ts` | Создать | Типы для рынка |
| `src/utils/marketApi.ts` | Создать | API клиент |
| `src/features/marketStore.ts` | Создать | Zustand store |
| `src/components/game/market/*.tsx` | Создать | UI компоненты |
| `src/components/game/MarketPanel.tsx` | Изменить | Добавить вкладку биржи |

### 1.8 Оценка трудозатрат
- **Backend:** 15-20 часов
- **Frontend:** 20-25 часов
- **Тестирование:** 10 часов
- **Итого:** ~45-55 часов

---

## 🟡 ФАЗА 2: ПОДРОБНЫЕ ГРАФИКИ И АНАЛИТИКА

### 2.1 Описание
Добавление детальной аналитики производства с графиками, анализом узких мест и ROI калькулятором.

### 2.2 Новые типы данных

```typescript
// Точка данных для графика
interface DataPoint {
  timestamp: number;
  value: Decimal;
}

// История производства ресурса
interface ProductionHistory {
  resource: ResourceType;
  data: DataPoint[];          // Последние 24 часа, точка каждые 5 минут
  avgProduction: Decimal;     // Среднее производство/сек
  peakProduction: Decimal;    // Пиковое производство
  totalProduced: Decimal;     // Всего произведено за период
}

// Узкое место в производстве
interface Bottleneck {
  resource: ResourceType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  consumingBuildings: string[];   // ID зданий, которые потребляют
  producingBuildings: string[];   // ID зданий, которые производят
  deficit: Decimal;               // Дефицит в секунду
  recommendation: string;         // Подсказка для игрока
}

// Потери ресурсов
interface ResourceLoss {
  resource: ResourceType;
  reason: 'overflow' | 'decay' | 'combat' | 'event';
  amount: Decimal;
  timestamp: number;
}

// ROI расчёт для здания
interface BuildingROI {
  buildingId: string;
  buildingName: string;
  totalCost: Decimal;            // Стоимость постройки
  netProfitPerSecond: Decimal;   // Чистая прибыль/сек
  paybackTimeSeconds: number;    // Время окупаемости
  currentROI: number;            // Текущий ROI в %
  profitability: 'excellent' | 'good' | 'average' | 'poor' | 'negative';
}

// Общая аналитика
interface AnalyticsState {
  productionHistory: Record<ResourceType, ProductionHistory>;
  bottlenecks: Bottleneck[];
  losses: ResourceLoss[];
  buildingROIs: BuildingROI[];
  totalCreditsEarned: Decimal;
  totalCreditsSpent: Decimal;
  profitLossHistory: DataPoint[];
  efficiencyScore: number;       // 0-100%
  lastUpdated: number;
}

// Типы графиков
type ChartType = 
  | 'line'           // Линейный график
  | 'area'           // График с заливкой
  | 'bar'            // Столбчатый
  | 'pie'            // Круговая диаграмма
  | 'heatmap'        // Тепловая карта
  | 'candlestick';   // Свечной (для цен)
```

### 2.3 Новые компоненты UI

```
src/components/game/analytics/
├── AnalyticsPanel.tsx           # Главная панель аналитики
├── ProductionChart.tsx          # График производства (line/area)
├── ResourceDistribution.tsx     # Распределение ресурсов (pie)
├── BottleneckAnalyzer.tsx       # Анализ узких мест
├── LossTracker.tsx              # Трекер потерь
├── ROICalculator.tsx            # Калькулятор окупаемости
├── ProfitLossChart.tsx          # График прибыли/убытков
├── BuildingHeatmap.tsx          # Тепловая карта эффективности
├── EfficiencyScore.tsx          # Общая оценка эффективности
├── ExportReport.tsx             # Экспорт отчёта (PDF/JSON)
└── charts/
    ├── LineChart.tsx            # Компонент линейного графика
    ├── PieChart.tsx             # Компонент круговой диаграммы
    ├── HeatMap.tsx              # Компонент тепловой карты
    └── CandlestickChart.tsx     # Компонент свечного графика
```

### 2.4 Библиотека для графиков

**Рекомендуется:** `recharts` (легковесная, React-ориентированная)

```bash
npm install recharts
```

### 2.5 Механики сбора данных

**Интервал сбора:** каждые 5 минут (300 сек)
**Хранение:** последние 24 часа (288 точек на ресурс)
**Сжатие:** после 24ч агрегировать в часовые средние (хранить 30 дней)

**Детектор узких мест:**
1. Если потребление > производства × 1.1 → severity: 'low'
2. Если потребление > производства × 1.5 → severity: 'medium'
3. Если потребление > производства × 2.0 → severity: 'high'
4. Если ресурс = 0 и есть потребление → severity: 'critical'

**Расчёт ROI:**
```
netProfitPerSecond = (производство × цена) - (потребление × цена) - (энергия × энергоцена)
paybackTimeSeconds = totalCost / netProfitPerSecond
ROI% = (netProfitPerSecond × 3600) / totalCost × 100  // Часовой ROI
```

### 2.6 Файлы для создания/изменения

| Файл | Действие | Описание |
|------|----------|----------|
| `src/core/gameTypes.analytics.ts` | Создать | Типы аналитики |
| `src/features/analyticsStore.ts` | Создать | Store аналитики |
| `src/utils/analyticsHelpers.ts` | Создать | Функции расчётов |
| `src/utils/bottleneckDetector.ts` | Создать | Детектор узких мест |
| `src/utils/roiCalculator.ts` | Создать | Калькулятор ROI |
| `src/components/game/analytics/*.tsx` | Создать | UI компоненты |
| `src/core/loop/gameLoop.ts` | Изменить | Добавить сбор данных |

### 2.7 Оценка трудозатрат
- **Типы и логика:** 8-10 часов
- **Компоненты графиков:** 15-20 часов
- **Интеграция:** 5-8 часов
- **Итого:** ~28-38 часов

---

## 🔵 ФАЗА 3: НОВЫЕ РЕСУРСЫ И ЦЕПОЧКИ

### 3.1 Описание
Добавление 35 новых ресурсов (T6-T9 уровни) с категориями Entertainment и Culture.

### 3.2 Новые ресурсы (35 штук)

#### T6: Развлечения (Entertainment) - 8 ресурсов

| ID | Название | Эмодзи | Рецепт |
|----|----------|--------|--------|
| `music_album` | Музыкальный Альбом | 🎵 | 1 computer + 2 display + 100 credits |
| `movie` | Кинофильм | 🎬 | 2 computer + 3 display + 1 fiber + 500 credits |
| `video_game` | Видеоигра | 🎮 | 3 computer + 2 integrated_circuit + 1 display |
| `streaming_service` | Стриминговый Сервис | 📺 | 5 computer + 3 satellite + 2 fiber |
| `vr_headset` | VR-Гарнитура | 🥽 | 2 display + 2 integrated_circuit + 1 battery |
| `ar_glasses` | AR-Очки | 👓 | 1 display + 1 integrated_circuit + 1 glass |
| `gaming_console` | Игровая Консоль | 🕹️ | 2 computer + 1 display + 1 plastic |
| `smart_tv` | Умный Телевизор | 📺 | 2 display + 1 computer + 1 plastic + 1 glass |

#### T6: Культура (Culture) - 6 ресурсов

| ID | Название | Эмодзи | Рецепт |
|----|----------|--------|--------|
| `artwork` | Произведение Искусства | 🎨 | 1 plastic + 1 glass + 500 credits |
| `sculpture` | Скульптура | 🗿 | 5 steel + 2 chrome_alloy |
| `literature` | Литература | 📚 | 1 fiber + 1 plastic + 100 credits |
| `architecture` | Архитектурный Проект | 🏛️ | 2 computer + 1 steel + 1 glass |
| `fashion` | Мода | 👗 | 2 fiber + 1 plastic + 1 chemicals |
| `jewelry` | Ювелирные Изделия | 💎 | 1 chrome + 1 titanium + 1 glass |

#### T7: Социальные сети и коммуникации - 6 ресурсов

| ID | Название | Эмодзи | Рецепт |
|----|----------|--------|--------|
| `social_network` | Социальная Сеть | 📱 | 10 computer + 5 satellite + 3 fiber + 10000 credits |
| `messaging_app` | Мессенджер | 💬 | 5 computer + 2 satellite + 2 fiber |
| `search_engine` | Поисковая Система | 🔍 | 20 computer + 10 satellite + 5 fiber |
| `cloud_service` | Облачный Сервис | ☁️ | 15 computer + 5 satellite + 3 fiber |
| `ai_assistant` | ИИ-Ассистент | 🤖 | 10 computer + 5 robot + 3 integrated_circuit |
| `cryptocurrency` | Криптовалюта | ₿ | 5 computer + 2 integrated_circuit + 1000 energy |

#### T7: Медицина и биотех - 5 ресурсов

| ID | Название | Эмодзи | Рецепт |
|----|----------|--------|--------|
| `medicine` | Медикаменты | 💊 | 2 chemicals + 1 plastic + 1 fiber |
| `vaccine` | Вакцина | 💉 | 3 chemicals + 2 medicine + 1 robot |
| `bioimplant` | Биоимплант | 🦾 | 2 titanium_alloy + 1 integrated_circuit + 1 medicine |
| `gene_therapy` | Генная Терапия | 🧬 | 5 medicine + 3 computer + 2 robot |
| `cryonics` | Криоконсервация | ❄️ | 3 medicine + 5 chemicals + 10 ice |

#### T8: Мегаструктуры и инфраструктура - 5 ресурсов

| ID | Название | Эмодзи | Рецепт |
|----|----------|--------|--------|
| `orbital_habitat` | Орбитальный Хабитат | 🛸 | 5 space_station + 10 titanium_alloy + 5 glass |
| `dyson_component` | Компонент Сферы Дайсона | ☀️ | 10 satellite + 20 titanium_alloy + 10 solar_panel |
| `warp_core` | Варп-Ядро | 🌀 | 5 enriched_uranium + 10 dark_matter + 5 computer |
| `quantum_computer` | Квантовый Компьютер | ⚛️ | 10 computer + 5 dark_matter + 3 integrated_circuit |
| `antimatter` | Антиматерия | ⚡ | 20 enriched_uranium + 10 dark_matter + 100000 energy |

#### T9: Трансцендентные ресурсы - 5 ресурсов

| ID | Название | Эмодзи | Рецепт |
|----|----------|--------|--------|
| `singularity_core` | Ядро Сингулярности | 🕳️ | 10 antimatter + 20 dark_matter + 5 quantum_computer |
| `time_crystal` | Кристалл Времени | ⏳ | 5 antimatter + 10 quantum_computer + 1000000 energy |
| `dimensional_rift` | Измерительный Разрыв | 🌌 | 10 singularity_core + 5 warp_core + 3 time_crystal |
| `omega_matter` | Омега-Материя | Ω | 5 dimensional_rift + 10 antimatter + 50 dark_matter |
| `ascension_essence` | Эссенция Вознесения | ✨ | 1 omega_matter + 10 time_crystal + 100 dark_matter |

### 3.3 Новые здания (35 штук)

#### Развлечения

| ID | Название | Производит | Потребляет |
|----|----------|------------|------------|
| `recording_studio_mk1` | Студия Звукозаписи | music_album | computer, display, energy |
| `film_studio_mk1` | Киностудия | movie | computer, display, fiber, energy |
| `game_studio_mk1` | Игровая Студия | video_game | computer, integrated_circuit, display |
| `streaming_center_mk1` | Стриминговый Центр | streaming_service | computer, satellite, fiber |
| `vr_factory_mk1` | Завод VR | vr_headset | display, integrated_circuit, battery |
| `ar_factory_mk1` | Завод AR | ar_glasses | display, integrated_circuit, glass |
| `console_factory_mk1` | Завод Консолей | gaming_console | computer, display, plastic |
| `tv_factory_mk1` | Завод Телевизоров | smart_tv | display, computer, plastic, glass |

#### Культура

| ID | Название | Производит | Эффект |
|----|----------|------------|--------|
| `art_gallery_mk1` | Художественная Галерея | artwork | +5% productivity глобально |
| `sculptor_workshop_mk1` | Мастерская Скульптора | sculpture | +10% building durability |
| `publishing_house_mk1` | Издательство | literature | +3% research speed |
| `architecture_bureau_mk1` | Архитектурное Бюро | architecture | -5% building cost |
| `fashion_house_mk1` | Дом Моды | fashion | +2% trade prices |
| `jewelry_workshop_mk1` | Ювелирная Мастерская | jewelry | +1% credits per sale |

#### Социальные сети

| ID | Название | Производит |
|----|----------|------------|
| `data_center_mk1` | Дата-Центр | social_network |
| `comm_hub_mk1` | Коммуникационный Хаб | messaging_app |
| `search_cluster_mk1` | Поисковый Кластер | search_engine |
| `cloud_farm_mk1` | Облачная Ферма | cloud_service |
| `ai_lab_mk1` | Лаборатория ИИ | ai_assistant |
| `mining_rig_mk1` | Майнинг-Ферма | cryptocurrency |

#### Медицина

| ID | Название | Производит |
|----|----------|------------|
| `pharma_factory_mk1` | Фармацевтический Завод | medicine |
| `biolab_mk1` | Биолаборатория | vaccine |
| `implant_factory_mk1` | Завод Имплантов | bioimplant |
| `gene_lab_mk1` | Генетическая Лаборатория | gene_therapy |
| `cryo_facility_mk1` | Криогенный Комплекс | cryonics |

#### Мегаструктуры

| ID | Название | Производит |
|----|----------|------------|
| `habitat_constructor_mk1` | Конструктор Хабитатов | orbital_habitat |
| `dyson_forge_mk1` | Кузница Дайсона | dyson_component |
| `warp_assembly_mk1` | Сборка Варп-Ядер | warp_core |
| `quantum_lab_mk1` | Квантовая Лаборатория | quantum_computer |
| `antimatter_reactor_mk1` | Реактор Антиматерии | antimatter |

#### Трансцендентные

| ID | Название | Производит |
|----|----------|------------|
| `singularity_chamber_mk1` | Камера Сингулярности | singularity_core |
| `temporal_forge_mk1` | Темпоральная Кузница | time_crystal |
| `rift_generator_mk1` | Генератор Разрывов | dimensional_rift |
| `omega_synthesizer_mk1` | Синтезатор Омеги | omega_matter |
| `ascension_altar_mk1` | Алтарь Вознесения | ascension_essence |

### 3.4 Новые технологии (12 штук)

| ID | Название | Эра | Стоимость RP | Разблокирует |
|----|----------|-----|--------------|--------------|
| `entertainment_industry` | Индустрия Развлечений | 6 | 300,000 | recording_studio, film_studio, game_studio |
| `digital_media` | Цифровые Медиа | 6 | 400,000 | streaming_center, vr_factory, ar_factory |
| `cultural_renaissance` | Культурный Ренессанс | 6 | 350,000 | art_gallery, sculptor_workshop, publishing_house |
| `social_engineering` | Социальная Инженерия | 7 | 600,000 | data_center, comm_hub, search_cluster |
| `cloud_computing` | Облачные Вычисления | 7 | 700,000 | cloud_farm, ai_lab, mining_rig |
| `biotechnology` | Биотехнологии | 7 | 800,000 | pharma_factory, biolab, implant_factory |
| `genetic_engineering` | Генная Инженерия | 7 | 1,000,000 | gene_lab, cryo_facility |
| `megastructure_engineering` | Инженерия Мегаструктур | 8 | 2,000,000 | habitat_constructor, dyson_forge |
| `warp_physics` | Варп-Физика | 8 | 3,000,000 | warp_assembly, quantum_lab |
| `antimatter_synthesis` | Синтез Антиматерии | 8 | 5,000,000 | antimatter_reactor |
| `singularity_science` | Наука Сингулярности | 9 | 10,000,000 | singularity_chamber, temporal_forge |
| `transcendence` | Трансцендентность | 9 | 50,000,000 | rift_generator, omega_synthesizer, ascension_altar |

### 3.5 Файлы для создания/изменения

| Файл | Действие | Описание |
|------|----------|----------|
| `src/core/gameTypes.ts` | Изменить | Добавить новые ResourceType |
| `src/core/constants/technologies.ts` | Изменить | Добавить новые технологии |
| `src/core/constants/buildingDefinitions.ts` | Создать | Определения зданий |
| `src/core/constants/productionChains.ts` | Создать | Цепочки производства |
| `src/features/gameStore.ts` | Изменить | Добавить начальные состояния |
| `resources.md` | Изменить | Документация ресурсов |

### 3.6 Оценка трудозатрат
- **Типы и данные:** 10-12 часов
- **Здания:** 15-18 часов
- **Балансировка:** 8-10 часов
- **Итого:** ~33-40 часов

---

## 🟣 ФАЗА 4: РАЗНЫЕ ТИПЫ КАРТ

### 4.1 Описание
Добавление 8 новых уникальных карт с разными размерами, стартовыми условиями и особенностями.

### 4.2 Новые типы карт

```typescript
type MapSize = 'tiny' | 'small' | 'medium' | 'large' | 'huge';
type GridType = 'square' | 'hex';
type MapDifficulty = 'easy' | 'normal' | 'hard' | 'extreme' | 'nightmare';
type MapModifier = 
  | 'rich_deposits'       // +50% ресурсов в депозитах
  | 'poor_deposits'       // -30% ресурсов
  | 'hostile'             // Враги сильнее
  | 'peaceful'            // Без врагов
  | 'toxic'               // Урон зданиям со временем
  | 'radioactive'         // Уран везде, но радиация
  | 'frozen'              // Лёд повсюду, энергия нужна для обогрева
  | 'volcanic'            // Много энергии, но случайные извержения
  | 'asteroid_field'      // Много мелких островков
  | 'trade_hub'           // Бонус к торговле
  | 'isolated'            // Нет торговли
  | 'ancient_ruins';      // Можно найти артефакты

interface MapDefinition {
  id: string;
  name: string;
  description: string;
  size: MapSize;
  gridType: GridType;
  difficulty: MapDifficulty;
  modifiers: MapModifier[];
  gridDimensions: { width: number; height: number };
  startingResources: Partial<Record<ResourceType, Decimal>>;
  availableDeposits: ResourceType[];
  depositDensity: number; // 0.1 - 0.9
  unlockRequirement?: TechnologyId | number; // Tech или Ascension level
  theme: {
    name: string;
    backgroundColor: string;
    tileColors: string[];
    ambientParticles?: string;
  };
}
```

### 4.3 Новые карты (8 штук)

| ID | Название | Размер | Сетка | Сложность | Модификаторы | Разблокировка |
|----|----------|--------|-------|-----------|--------------|---------------|
| `map_training_ground` | 🏕️ Тренировочная Площадка | tiny (8x8) | square | easy | peaceful, rich_deposits | Начальная |
| `map_barren_moon` | 🌑 Бесплодная Луна | small (12x12) | square | normal | poor_deposits | После 1 часа игры |
| `map_crystal_caves` | 💎 Кристальные Пещеры | medium (16x16) | hex | normal | rich_deposits (только кристаллы) | semiconductors tech |
| `map_volcanic_world` | 🌋 Вулканический Мир | medium (16x16) | square | hard | volcanic, hostile | nuclear_physics tech |
| `map_ice_giant` | 🧊 Ледяной Гигант | large (20x20) | hex | hard | frozen, rich_deposits (лёд) | first_colony tech |
| `map_toxic_swamp` | ☠️ Токсичные Болота | medium (16x16) | square | extreme | toxic, hostile | Ascension 1 |
| `map_asteroid_belt` | 🪨 Астероидный Пояс | huge (24x24) | hex | hard | asteroid_field, isolated | spaceships tech |
| `map_ancient_ruins` | 🏛️ Древние Руины | large (20x20) | hex | nightmare | ancient_ruins, hostile | Ascension 3 |

### 4.4 Детали каждой карты

#### 🏕️ Тренировочная Площадка
- **Размер:** 8×8 (64 клетки)
- **Стартовые ресурсы:** 500 energy, 200 ore, 100 ice, 50 carbon
- **Депозиты:** ore, ice, carbon, copper (высокая плотность)
- **Особенность:** Нет врагов, туториал активен, подсказки

#### 🌑 Бесплодная Луна
- **Размер:** 12×12 (144 клетки)
- **Стартовые ресурсы:** 200 energy, 100 ore
- **Депозиты:** ore, sand, titanium (низкая плотность)
- **Особенность:** Мало ресурсов, нужна эффективность

#### 💎 Кристальные Пещеры
- **Размер:** 16×16 hex (256 клеток)
- **Стартовые ресурсы:** 300 energy, 150 ore, 200 sand
- **Депозиты:** sand, copper, chrome (много кристаллов)
- **Особенность:** Бонус +100% к производству полупроводников

#### 🌋 Вулканический Мир
- **Размер:** 16×16 (256 клеток)
- **Стартовые ресурсы:** 1000 energy, 100 ore
- **Депозиты:** ore, uranium, chrome, titanium
- **Особенность:** Геотермальные источники (бесплатная энергия), случайные извержения (урон зданиям)

#### 🧊 Ледяной Гигант
- **Размер:** 20×20 hex (400 клеток)
- **Стартовые ресурсы:** 100 energy, 50 ore, 500 ice
- **Депозиты:** ice, natural_gas, carbon
- **Особенность:** Здания потребляют +50% энергии на обогрев, но лёд бесконечен

#### ☠️ Токсичные Болота
- **Размер:** 16×16 (256 клеток)
- **Стартовые ресурсы:** 200 energy, 100 ore, 100 chemicals
- **Депозиты:** chemicals, oil, natural_gas
- **Особенность:** Здания получают 1% урон/мин, нужны recycler для очистки

#### 🪨 Астероидный Пояс
- **Размер:** 24×24 hex (576 клеток, но 40% пустые)
- **Стартовые ресурсы:** 500 energy, 300 ore, 200 titanium
- **Депозиты:** ore, chrome, titanium, uranium (на разных астероидах)
- **Особенность:** Карта разделена на 12 островов, нужны мосты/порталы

#### 🏛️ Древние Руины
- **Размер:** 20×20 hex (400 клеток)
- **Стартовые ресурсы:** 100 energy, 50 ore
- **Депозиты:** все типы (редко), но есть ruins (артефакты)
- **Особенность:** Можно найти артефакты, сильные враги, mystery events

### 4.5 Файлы для создания/изменения

| Файл | Действие | Описание |
|------|----------|----------|
| `src/core/gameTypes.maps.ts` | Создать | Типы карт |
| `src/core/constants/maps.ts` | Создать | Определения карт |
| `src/features/mapStore.ts` | Создать | Store для карт |
| `src/utils/mapGenerator.ts` | Создать | Генератор карт |
| `src/components/game/MapSelector.tsx` | Создать | Выбор карты |
| `src/components/game/HexGrid.tsx` | Создать | Гексагональная сетка |
| `src/components/game/GameGrid.tsx` | Изменить | Поддержка hex |

### 4.6 Оценка трудозатрат
- **Типы и генератор:** 12-15 часов
- **UI селектора:** 8-10 часов
- **Hex сетка:** 15-18 часов
- **Итого:** ~35-43 часа

---

## 🟠 ФАЗА 5: ПРОДВИНУТЫЕ НАСТРОЙКИ ФАБРИК

### 5.1 Описание
Добавление детальных настроек для каждого здания: приоритеты, лимиты, авто-продажа, режимы работы.

### 5.2 Новые типы данных

```typescript
// Режим работы здания
type BuildingMode = 
  | 'normal'       // 100% производство, 100% потребление
  | 'overclock'    // 150% производство, 200% потребление
  | 'economy'      // 70% производство, 50% потребление
  | 'idle'         // 0% производство, 10% потребление (поддержание)
  | 'maintenance'; // 0% производство, 0% потребление, -1% HP/мин

// Приоритет ресурса
type ResourcePriority = 1 | 2 | 3 | 4 | 5; // 5 = максимальный приоритет

// Настройки авто-продажи
interface AutoSellConfig {
  enabled: boolean;
  resource: ResourceType;
  threshold: number;           // Продавать когда > X% заполнения
  keepAmount: Decimal;         // Оставлять минимум N единиц
  minPrice?: Decimal;          // Продавать только если цена >= X
}

// Лимит хранения для здания
interface StorageLimit {
  resource: ResourceType;
  maxAmount: Decimal;          // Максимум в этом здании
  overflowAction: 'stop' | 'sell' | 'discard';
}

// Расширенные настройки здания
interface BuildingSettings {
  buildingId: string;
  mode: BuildingMode;
  enabled: boolean;
  
  // Приоритеты входящих ресурсов
  inputPriorities: Partial<Record<ResourceType, ResourcePriority>>;
  
  // Приоритет выходящих ресурсов
  outputPriority: ResourcePriority;
  
  // Лимиты хранения
  storageLimits: StorageLimit[];
  
  // Авто-продажа
  autoSell: AutoSellConfig[];
  
  // Условия работы
  conditions: BuildingCondition[];
  
  // Статистика
  stats: {
    totalProduced: Decimal;
    totalConsumed: Decimal;
    uptime: number;            // % времени работы
    efficiency: number;        // Текущая эффективность 0-100%
  };
}

// Условие работы
interface BuildingCondition {
  type: 'resource_above' | 'resource_below' | 'time_of_day' | 'energy_available';
  resource?: ResourceType;
  value: number;
  action: 'enable' | 'disable' | 'switch_mode';
  targetMode?: BuildingMode;
}
```

### 5.3 Новые компоненты UI

```
src/components/game/building/
├── BuildingSettingsPanel.tsx      # Главная панель настроек
├── ModeSelector.tsx               # Выбор режима работы
├── PrioritySlider.tsx             # Слайдер приоритета
├── StorageLimitEditor.tsx         # Редактор лимитов
├── AutoSellConfig.tsx             # Настройка авто-продажи
├── ConditionBuilder.tsx           # Конструктор условий
├── BuildingStats.tsx              # Статистика здания
├── BatchSettings.tsx              # Массовые настройки
└── SettingsPresets.tsx            # Пресеты настроек
```

### 5.4 Пресеты настроек

| Пресет | Описание | Настройки |
|--------|----------|-----------|
| 🏭 Maximum Production | Максимум производства | overclock, high priority |
| 💰 Profit Focused | Максимум прибыли | auto-sell at 80%, economy mode |
| ⚡ Energy Saver | Экономия энергии | economy mode, low priority |
| 🔄 Balanced | Сбалансированный | normal mode, medium priority |
| 🛑 Maintenance Only | Только обслуживание | maintenance mode, disabled |

### 5.5 Механики

**Overclock Mode:**
- +50% скорость производства
- +100% потребление ресурсов
- +30% потребление энергии
- -10% к "здоровью" здания в час (нужен repair)

**Economy Mode:**
- -30% скорость производства
- -50% потребление ресурсов
- -40% потребление энергии
- +5% к "здоровью" здания в час

**Система приоритетов:**
- При нехватке ресурсов, здания с высоким приоритетом получают первыми
- Priority 5 → получает 100% доступного
- Priority 1 → получает остатки

### 5.6 Файлы для создания/изменения

| Файл | Действие | Описание |
|------|----------|----------|
| `src/core/gameTypes.buildings.ts` | Создать | Типы настроек зданий |
| `src/features/buildingSettingsStore.ts` | Создать | Store настроек |
| `src/utils/priorityAllocator.ts` | Создать | Распределение по приоритетам |
| `src/components/game/building/*.tsx` | Создать | UI компоненты |
| `src/core/loop/gameLoop.ts` | Изменить | Учёт режимов и приоритетов |
| `src/components/game/BuildingPanel.tsx` | Изменить | Добавить кнопку настроек |

### 5.7 Оценка трудозатрат
- **Типы и логика:** 10-12 часов
- **UI компоненты:** 15-18 часов
- **Интеграция в loop:** 8-10 часов
- **Итого:** ~33-40 часов

---

## 🔴 ФАЗА 6: ФИНАНСОВАЯ СИСТЕМА

### 6.1 Описание
Добавление банковской системы с инвестициями, кредитами, акциями и процентными ставками.

### 6.2 Новые типы данных

```typescript
// Банковский счёт
interface BankAccount {
  balance: Decimal;
  savingsBalance: Decimal;      // Сберегательный счёт
  interestRate: number;         // Годовая ставка (0.05 = 5%)
  lastInterestPaid: number;     // timestamp
}

// Кредит
interface Loan {
  id: string;
  principal: Decimal;           // Сумма кредита
  interestRate: number;         // Годовая ставка
  termDays: number;             // Срок в днях
  remainingBalance: Decimal;    // Остаток к выплате
  monthlyPayment: Decimal;      // Ежемесячный платёж
  startDate: number;
  dueDate: number;
  status: 'active' | 'paid' | 'defaulted';
  collateral?: {                // Залог
    type: 'buildings' | 'resources';
    value: Decimal;
  };
}

// Акция
interface Stock {
  id: string;
  symbol: string;               // Тикер (3-4 буквы)
  name: string;
  sector: StockSector;
  currentPrice: Decimal;
  previousClose: Decimal;
  dayChange: number;            // % изменения
  volume: Decimal;
  marketCap: Decimal;
  dividendYield: number;        // Годовая дивидендная доходность
  priceHistory: DataPoint[];    // История цен (30 дней)
  volatility: 'low' | 'medium' | 'high';
}

type StockSector = 
  | 'energy'
  | 'mining'
  | 'technology'
  | 'manufacturing'
  | 'aerospace'
  | 'entertainment'
  | 'biotech';

// Позиция в акциях
interface StockPosition {
  stockId: string;
  shares: Decimal;
  avgBuyPrice: Decimal;
  totalInvested: Decimal;
  currentValue: Decimal;
  unrealizedPnL: Decimal;       // Нереализованная прибыль/убыток
  dividendsReceived: Decimal;
}

// Инвестиционный фонд
interface InvestmentFund {
  id: string;
  name: string;
  type: 'index' | 'sector' | 'growth' | 'income' | 'balanced';
  riskLevel: 1 | 2 | 3 | 4 | 5;
  annualReturn: number;         // Ожидаемая годовая доходность
  managementFee: number;        // Комиссия за управление
  composition: { stockId: string; weight: number }[];
}

// Финансовое состояние игрока
interface FinanceState {
  bank: BankAccount;
  loans: Loan[];
  maxLoanCapacity: Decimal;     // Максимальная сумма кредита
  creditScore: number;          // 300-850
  stocks: Stock[];              // Доступные акции
  positions: StockPosition[];   // Позиции игрока
  funds: InvestmentFund[];      // Доступные фонды
  fundInvestments: { fundId: string; amount: Decimal }[];
  netWorth: Decimal;            // Чистая стоимость
  liquidAssets: Decimal;        // Ликвидные активы
}
```

### 6.3 Доступные акции (12 штук)

| Символ | Название | Сектор | Волатильность | Дивиденды |
|--------|----------|--------|---------------|-----------|
| ORES | Ore Mining Corp | mining | low | 3% |
| ENRG | Energy Solutions | energy | medium | 4% |
| SLRS | Solar Systems Inc | energy | high | 1% |
| CHIP | ChipTech Industries | technology | high | 0% |
| MECH | MechFactory Ltd | manufacturing | medium | 2.5% |
| AERO | AeroSpace Dynamics | aerospace | high | 0.5% |
| MEDI | MediBiotech | biotech | very high | 0% |
| GAME | GameStream Corp | entertainment | high | 1% |
| ARMS | DefenseTech | manufacturing | low | 5% |
| CRYO | CryoGenetics | biotech | very high | 0% |
| QNTM | Quantum Computing | technology | extreme | 0% |
| DARK | Dark Matter Ventures | exotic | extreme | 0% |

### 6.4 Инвестиционные фонды (5 штук)

| Название | Тип | Риск | Ожидаемая доходность |
|----------|-----|------|---------------------|
| Stable Index | index | 1 | 5% годовых |
| Growth Leaders | growth | 3 | 12% годовых |
| Tech Innovation | sector | 4 | 18% годовых |
| High Dividend | income | 2 | 8% годовых |
| Balanced Portfolio | balanced | 2 | 7% годовых |

### 6.5 Новые компоненты UI

```
src/components/game/finance/
├── FinancePanel.tsx             # Главная панель финансов
├── BankAccount.tsx              # Банковский счёт
├── LoanManager.tsx              # Управление кредитами
├── StockMarket.tsx              # Рынок акций
├── StockChart.tsx               # График акции
├── StockTrade.tsx               # Покупка/продажа акций
├── Portfolio.tsx                # Портфель игрока
├── FundInvestments.tsx          # Инвестиционные фонды
├── CreditScore.tsx              # Кредитный рейтинг
└── NetWorthTracker.tsx          # Трекер чистой стоимости
```

### 6.6 Механики

**Кредитный рейтинг:**
- Начальный: 600
- +10 за каждый вовремя выплаченный кредит
- -50 за просрочку платежа
- -100 за дефолт
- Влияет на: максимальную сумму кредита, процентную ставку

**Процентные ставки:**
- Сберегательный счёт: 2% годовых (капитализация ежедневно)
- Кредит (хороший рейтинг): 8% годовых
- Кредит (плохой рейтинг): 15% годовых

**Рынок акций:**
- Цены обновляются каждые 5 минут
- Волатильность влияет на размах колебаний
- События в игре влияют на цены (война → ARMS растёт)
- Дивиденды выплачиваются еженедельно

### 6.7 Файлы для создания/изменения

| Файл | Действие | Описание |
|------|----------|----------|
| `src/core/gameTypes.finance.ts` | Создать | Финансовые типы |
| `src/core/constants/stocks.ts` | Создать | Определения акций |
| `src/core/constants/funds.ts` | Создать | Определения фондов |
| `src/features/financeStore.ts` | Создать | Store финансов |
| `src/utils/stockSimulator.ts` | Создать | Симуляция цен |
| `src/utils/loanCalculator.ts` | Создать | Расчёт кредитов |
| `src/components/game/finance/*.tsx` | Создать | UI компоненты |
| `src/core/loop/gameLoop.ts` | Изменить | Обновление цен и процентов |

### 6.8 Оценка трудозатрат
- **Типы и данные:** 8-10 часов
- **Симулятор акций:** 10-12 часов
- **UI компоненты:** 18-22 часа
- **Итого:** ~36-44 часа

---

## ✅ ФАЗА 7: КУЛЬТУРА И НАУКА

### 7.1 Описание
Разделение Research Points на Science и Culture, добавление культурных эффектов на gameplay.

**РЕАЛИЗОВАНО:**
- ✅ Типы данных для культуры и счастья (`gameTypes.culture.ts`)
- ✅ 10 культурных уровней с прогрессией (`cultureLevels.ts`)
- ✅ 21 культурное здание трёх уровней (`cultureBuildings.ts`)
- ✅ Система счастья с факторами влияния (`happinessCalculator.ts`)
- ✅ Zustand store для культуры (`cultureStore.ts`)
- ✅ UI компоненты: CulturePanel, CultureBuildingsList, HappinessDetailsPanel
- ✅ Интеграция в gameStore tick() и save/load
- ✅ Вкладка культуры в боковой панели

### 7.2 Новые типы данных

```typescript
// Новые валюты
interface CurrencyStateExtended extends CurrencyState {
  science: Decimal;             // Научные очки
  culture: Decimal;             // Культурные очки
  happiness: number;            // 0-100%, влияет на productivity
}

// Культурный уровень
interface CultureLevel {
  level: number;                // 1-10
  name: string;
  happinessBonus: number;       // +X% к productivity
  unlocks: string[];            // Разблокирует здания/политики
}

// Культурные уровни
const CULTURE_LEVELS: CultureLevel[] = [
  { level: 1, name: 'Примитивная', happinessBonus: 0, unlocks: [] },
  { level: 2, name: 'Развивающаяся', happinessBonus: 2, unlocks: ['art_gallery_mk1'] },
  { level: 3, name: 'Традиционная', happinessBonus: 5, unlocks: ['sculptor_workshop_mk1', 'publishing_house_mk1'] },
  { level: 4, name: 'Индустриальная', happinessBonus: 8, unlocks: ['architecture_bureau_mk1'] },
  { level: 5, name: 'Современная', happinessBonus: 12, unlocks: ['fashion_house_mk1', 'jewelry_workshop_mk1'] },
  { level: 6, name: 'Цифровая', happinessBonus: 16, unlocks: ['recording_studio_mk1', 'film_studio_mk1'] },
  { level: 7, name: 'Пост-Информационная', happinessBonus: 20, unlocks: ['streaming_center_mk1', 'vr_factory_mk1'] },
  { level: 8, name: 'Межзвёздная', happinessBonus: 25, unlocks: [] },
  { level: 9, name: 'Галактическая', happinessBonus: 30, unlocks: [] },
  { level: 10, name: 'Трансцендентная', happinessBonus: 50, unlocks: [] },
];

// Счастье населения
interface HappinessState {
  current: number;              // Текущий уровень 0-100
  factors: HappinessFactor[];
  productivity: number;         // Множитель производства
}

interface HappinessFactor {
  source: string;
  value: number;                // Может быть отрицательным
  description: string;
}
```

### 7.3 Культурные здания (12 штук)

| ID | Название | Производит | Эффект на happiness |
|----|----------|------------|---------------------|
| `museum_mk1` | 🏛️ Музей | culture +5/s | +3 happiness |
| `theater_mk1` | 🎭 Театр | culture +3/s | +5 happiness |
| `opera_house_mk1` | 🎼 Опера | culture +8/s | +8 happiness |
| `stadium_mk1` | 🏟️ Стадион | — | +10 happiness |
| `park_mk1` | 🌳 Парк | — | +2 happiness, -pollution |
| `university_mk1` | 🎓 Университет | science +10/s | +3 happiness |
| `library_mk1` | 📚 Библиотека | science +5/s, culture +2/s | +2 happiness |
| `observatory_mk1` | 🔭 Обсерватория | science +8/s | +1 happiness |
| `colosseum_mk1` | ⚔️ Колизей | culture +10/s | +15 happiness |
| `broadcast_tower_mk1` | 📡 Телебашня | culture +6/s | +4 happiness |
| `amusement_park_mk1` | 🎡 Парк Развлечений | — | +20 happiness |
| `monument_mk1` | 🗽 Монумент | culture +15/s | +7 happiness |

### 7.4 Факторы счастья

| Фактор | Влияние | Описание |
|--------|---------|----------|
| Культурный уровень | +0 до +50 | Зависит от уровня культуры |
| Развлекательные здания | +2 до +20 каждое | Парки, стадионы, парки развлечений |
| Рабочие условия | -20 до +10 | Зависит от overclock vs economy mode |
| Война/конфликт | -10 до -30 | Активная война снижает счастье |
| Экология | -20 до +5 | Загрязнение vs чистая энергия |
| Кредиты | -10 до +10 | Богатство vs бедность |
| События | -15 до +15 | Случайные события |

### 7.5 Влияние счастья

| Уровень счастья | Название | Эффект на производство |
|-----------------|----------|------------------------|
| 0-20% | Несчастны | -30% производство |
| 21-40% | Недовольны | -15% производство |
| 41-60% | Нейтрально | ±0% производство |
| 61-80% | Довольны | +15% производство |
| 81-100% | Счастливы | +30% производство |

### 7.6 Файлы для создания/изменения

| Файл | Действие | Описание |
|------|----------|----------|
| `src/core/gameTypes.culture.ts` | Создать | Типы культуры и счастья |
| `src/core/constants/cultureLevels.ts` | Создать | Уровни культуры |
| `src/core/constants/cultureBuildings.ts` | Создать | Культурные здания |
| `src/features/cultureStore.ts` | Создать | Store культуры |
| `src/utils/happinessCalculator.ts` | Создать | Расчёт счастья |
| `src/components/game/culture/*.tsx` | Создать | UI компоненты |
| `src/core/loop/gameLoop.ts` | Изменить | Учёт счастья |

### 7.7 Оценка трудозатрат
- **Типы и логика:** 8-10 часов
- **Здания:** 6-8 часов
- **UI компоненты:** 10-12 часов
- **Итого:** ~24-30 часов

---

## ✅ ФАЗА 8: CLOUD SYNC (ЗАВЕРШЕНО)

### 8.0 Статус реализации

**Дата завершения:** Июнь 2025

**Созданные файлы:**
- ✅ `src/core/gameTypes.sync.ts` — Типы для синхронизации
- ✅ `src/features/syncStore.ts` — Zustand store для управления синхронизацией
- ✅ `src/utils/syncApi.ts` — API клиент для серверных эндпоинтов
- ✅ `src/utils/saveCompressor.ts` — Сжатие сохранений (lz-string)
- ✅ `src/utils/conflictResolver.ts` — Логика разрешения конфликтов
- ✅ `src/utils/syncHelpers.ts` — Хелперы для получения данных сохранений
- ✅ `server/sync.js` — Серверные роуты синхронизации
- ✅ `server/migration_sync.sql` — Миграция БД

**UI компоненты:**
- ✅ `src/components/game/sync/SyncStatusIndicator.tsx`
- ✅ `src/components/game/sync/SyncPanel.tsx`
- ✅ `src/components/game/sync/ConflictResolver.tsx`
- ✅ `src/components/game/sync/BackupManager.tsx`
- ✅ `src/components/game/sync/index.ts`

**Изменённые файлы:**
- ✅ `server/index.js` — Интеграция sync роутов

### 8.1 Описание
Улучшение синхронизации сохранений между устройствами с поддержкой конфликтов и резервных копий.

### 8.2 Новые типы данных

```typescript
// Информация о сохранении
interface SaveInfo {
  id: string;
  name: string;
  timestamp: number;
  deviceId: string;
  deviceName: string;
  version: string;              // Версия игры
  playTime: number;             // Общее время игры
  checksum: string;             // SHA-256 для проверки целостности
  compressed: boolean;
  size: number;                 // Размер в байтах
}

// Конфликт сохранений
interface SaveConflict {
  localSave: SaveInfo;
  cloudSave: SaveInfo;
  resolveOptions: ('use_local' | 'use_cloud' | 'merge' | 'keep_both')[];
}

// Резервная копия
interface BackupInfo {
  id: string;
  saveId: string;
  createdAt: number;
  reason: 'auto' | 'manual' | 'before_update';
  expiresAt: number;
}

// Состояние синхронизации
interface SyncState {
  isConnected: boolean;
  lastSyncAt: number;
  pendingChanges: number;
  conflicts: SaveConflict[];
  backups: BackupInfo[];
  syncProgress: number;         // 0-100%
  error?: string;
}
```

### 8.3 Серверные эндпоинты

| Метод | Endpoint | Описание |
|-------|----------|----------|
| POST | `/api/saves/sync` | Синхронизация сохранения |
| GET | `/api/saves/list` | Список сохранений на сервере |
| GET | `/api/saves/:id` | Получить конкретное сохранение |
| DELETE | `/api/saves/:id` | Удалить сохранение |
| POST | `/api/saves/:id/backup` | Создать резервную копию |
| GET | `/api/saves/backups` | Список резервных копий |
| POST | `/api/saves/restore/:backupId` | Восстановить из бэкапа |
| POST | `/api/saves/resolve-conflict` | Разрешить конфликт |

### 8.4 Механики

**Автосинхронизация:**
- Каждые 5 минут при изменениях
- При выходе из игры
- При возвращении из фоновой вкладки

**Разрешение конфликтов:**
1. Use Local: локальное сохранение перезаписывает облачное
2. Use Cloud: облачное сохранение перезаписывает локальное
3. Merge: объединить (возьмёт максимумы ресурсов, все здания)
4. Keep Both: создать 2 слота сохранения

**Резервное копирование:**
- Автоматически перед каждым обновлением игры
- Автоматически раз в день
- Вручную до 5 копий
- Хранение: 30 дней

**Сжатие:**
- Использовать LZ4 для сжатия сохранений
- Типичное сжатие: 70-80% (100KB → 25KB)

### 8.5 Новые компоненты UI

```
src/components/game/sync/
├── SyncStatusIndicator.tsx      # Индикатор статуса синхронизации
├── SyncPanel.tsx                # Панель синхронизации
├── ConflictResolver.tsx         # Диалог разрешения конфликта
├── BackupManager.tsx            # Управление резервными копиями
├── SaveComparison.tsx           # Сравнение двух сохранений
└── SyncHistory.tsx              # История синхронизаций
```

### 8.6 Файлы для создания/изменения

| Файл | Действие | Описание |
|------|----------|----------|
| `src/core/gameTypes.sync.ts` | Создать | Типы синхронизации |
| `src/features/syncStore.ts` | Создать | Store синхронизации |
| `src/utils/syncApi.ts` | Создать | API синхронизации |
| `src/utils/saveCompressor.ts` | Создать | Сжатие сохранений |
| `src/utils/conflictResolver.ts` | Создать | Логика разрешения конфликтов |
| `server/sync.js` | Создать | Серверная логика |
| `server/migration_sync.sql` | Создать | Миграция БД |
| `src/components/game/sync/*.tsx` | Создать | UI компоненты |

### 8.7 Оценка трудозатрат
- **Backend:** 10-12 часов
- **Frontend:** 12-15 часов
- **Тестирование:** 6-8 часов
- **Итого:** ~28-35 часов

---

## 📊 СВОДНАЯ ТАБЛИЦА

| Фаза | Название | Сложность | Время (часы) | Приоритет |
|------|----------|-----------|--------------|-----------|
| 1 | Мультиплеерная торговля | Высокая | 45-55 | 🔴 Критичный |
| 2 | Графики и аналитика | Средняя | 28-38 | 🟡 Высокий |
| 3 | Новые ресурсы (35) | Высокая | 33-40 | 🟡 Высокий |
| 4 | Разные типы карт (8) | Высокая | 35-43 | 🟢 Средний |
| 5 | Настройки фабрик | Средняя | 33-40 | 🟢 Средний |
| 6 | Финансовая система | Высокая | 36-44 | 🟢 Средний |
| 7 | Культура и наука | Средняя | 24-30 | 🟡 Высокий |
| 8 | Cloud Sync | Средняя | 28-35 | 🟢 Средний |
| **ИТОГО** | | | **262-325** | |

---

## 🚀 РЕКОМЕНДУЕМЫЙ ПОРЯДОК РЕАЛИЗАЦИИ

1. **Фаза 7: Культура и наука** (24-30ч) — Быстрая победа, добавляет глубину
2. **Фаза 2: Графики и аналитика** (28-38ч) — UX улучшение
3. **Фаза 3: Новые ресурсы** (33-40ч) — Контент
4. **Фаза 5: Настройки фабрик** (33-40ч) — Глубина геймплея
5. **Фаза 4: Разные типы карт** (35-43ч) — Разнообразие
6. **Фаза 6: Финансовая система** (36-44ч) — Новая механика
7. **Фаза 1: Мультиплеерная торговля** (45-55ч) — Социальная функция
8. **Фаза 8: Cloud Sync** (28-35ч) — Инфраструктура

---

## ✅ ЧЕКЛИСТ ДЛЯ УТВЕРЖДЕНИЯ

- [x] Согласованы все новые ресурсы (35 штук)
- [x] Согласованы все новые здания (35+ штук)
- [x] Согласованы новые карты (8 штук)
- [x] Согласована финансовая система (акции, кредиты)
- [x] Согласована система культуры и счастья
- [x] Согласован приоритет фаз
- [x] Согласован общий бюджет времени (262-325 часов)

---

> **Примечание:** После утверждения начнём с первой выбранной фазы. Каждая фаза будет разбита на более мелкие задачи с оценками 2-4 часа.
