# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Язык проекта — русский: комментарии, подписи в UI, планы и коммиты пишутся по-русски.

## Что это

Idle/factory-игра «PROTOCOL: YGGDRASIL». Клиент — React 18 + TypeScript + Vite + Tailwind + Zustand,
рендер сетки — pixi.js, большие числа — break_eternity.js. Сервер — Express 5 + PostgreSQL:
аутентификация, серверные сейвы и слоты, общая биржа, гильдии, чат, админка, P2P-кредиты,
AI-оракул (DeepSeek). В production один процесс Node раздаёт `dist/` и `/api/*` с одного порта.

## Команды

```bash
npm run dev            # vite (5173) + node server/index.js (5174) через concurrently
npm run dev:web        # только фронт; /api проксируется на VITE_DEV_API_TARGET (по умолчанию 127.0.0.1:5174)
npm run dev:api        # только API
npm run typecheck      # tsc -b (strict, noUnusedLocals/Parameters)
npm test               # vitest run — 37 файлов, ~408 тестов, проходят
npm run test:watch
npm run lint           # lint:labels + eslint .
npm run build          # vite build + tools/stash-sourcemaps.mjs (выносит .map из dist в sourcemaps/)
npm start              # NODE_ENV=production node server/index.js
npm run deploy:pm2     # build + pm2 startOrReload ecosystem.config.cjs --env production
node tools/gen-glyphs.mjs   # регенерация src/components/ui/icons/glyphs.ts
```

Один тест / фильтр по имени:

```bash
npx vitest run src/features/gameStore.tick.test.ts
npx vitest run -t "за 5 секунд редкие подсистемы"
```

`.env` обязателен даже локально: `server/db.js` бросает исключение без `DATABASE_URL`, а игра
за формой входа (`AuthForm`) — без API поиграть нельзя. Шаблон — `.env.example`, деплой —
[DEPLOY_DEBIAN.md](DEPLOY_DEBIAN.md).

## Архитектура клиента

**`src/features/gameStore.ts` (~14 500 строк) — один Zustand-стор со всем игровым состоянием**
(`GameState` из `src/core/gameTypes*.ts`). Ориентироваться в нём по grep, а не чтением целиком:
`tick: (dt) => {` на строке ~4675 — весь игровой шаг, внутри крупные фазы помечены капсом
(`ЭНЕРГОБАЛАНС`, `ГЕНЕРАЦИЯ ВАЛЮТ`, `ЗАГРЯЗНЕНИЕ`, `КУЛЬТУРА И СЧАСТЬЕ`, …).

Подсистемы тика вынесены в чистые модули `src/core/systems/` (`gridScan`, `energyBalance`,
`productionOutput`, `currencyGeneration`, `pollution`, `construction`, `jobs`, `demolition`,
`tickBuffers`, `tickSchedule`, `randomEventSchedule`, `adminGrant`) — там же лежат их тесты.
Новую логику тика добавлять туда, а не наращивать `gameStore`.

**Два правила, нарушение которых уже приводило к молчаливой потере прогресса:**

1. Никакого вложенного `set()` внутри апдейтера `set((state) => …)`: внешний `return state`
   вернёт снимок до вложенного вызова и откатит начисление.
2. Действия-побочки (`completeMap`, достижения, сигналы) вызываются из игрового цикла, а не
   из `tick` — см. `src/hooks/useOptimizedGameLoop.ts`.

**Игровой цикл** — `useOptimizedGameLoop`: rAF на полной частоте для UI, `tick()` с фиксированным
шагом не чаще 20 раз/с, максимум 2 догоняющих шага за кадр. Редкие проверки (достижения,
финансы, завершение карты, автосейв) идут по своим интервалам.

**Сохранения — `src/features/gameSave.ts` (единственный владелец сериализации).**
Все Decimal пишутся через `encD` / читаются через `decD` (у `Decimal.toJSON` есть `toString`,
поэтому «сырой» спред даёт валидный JSON и ломается позже как `x.sub is not a function`).
`deserializeGame` тотальна: у каждой секции есть fallback на `INITIAL_*`, она не бросает и не
пишет `undefined`. Схема версионируется (`SAVE_VERSION`, таблица `MIGRATIONS`). Между `gameSave`
и `gameStore` — сознательный цикл модулей: обращения к биндингам другого модуля допустимы только
внутри тел функций, никаких `const X = INITIAL_FOO` на верхнем уровне.

Снимок финансов подмешивается к payload в `gameStore` (`serializeFinance`/`hydrateFinance`),
потому что `serializeGame` работает только с `GameState`.

`src/features/saveRevision.ts` — оптимистичная блокировка записи: клиент отправляет пару
(saveId, revision), расхождение → 409 и явная перезагрузка вместо тихой перезаписи.

**Персистентность живёт на сервере, а не в localStorage.** Настройки, закреплённые ресурсы,
текущий слот — через `src/utils/settingsApi.ts`; UI-префы и фильтры — секция `uiPrefs` в сейве
слота. Список ключей, вычищаемых из localStorage, и причины — в `src/utils/cleanupLocalStorage.ts`.

**Остальные сторы** (`src/features/`): `financeStore`, `marketStore`, `uiStore` (какая панель
открыта + массовое выделение клеток), `cultureStore`, `advisorStore`, `adminStore`,
`analyticsStore`, `chatStore`, `plansStore`.

**Списки производства** (`plansStore` + `src/components/game/plans/`, bigplan 37) — свои чек-листы
игрока «что построить» с заметками. Живут в отдельных таблицах на сервере (`server/plans.js`),
а НЕ в сейве: сейв целиком перезаписывается автосейвом с оптимистичной блокировкой ревизии, и
отметка «сделано» из второй вкладки терялась бы вместе с конфликтом. Развёртку «что нужно, чтобы
это сделать» считает чистый `src/core/plans/planChain.ts`.

## Обязательные соглашения

**Подписи.** В JSX никогда не попадает сырой игровой id. Только `resourceLabel()`,
`depositLabel()`, `technologyLabel()` и т.п. из `src/core/i18n/label.ts`; словари — в
`src/core/constants/labels.ts`. Самодельная «локализация» через `id.replace(/_/g, ' ')` запрещена.
Проверяет `npm run lint:labels` (`tools/check-raw-labels.mjs`) с явным allowlist.

**Числа.** Всё крупное — `Decimal` (break_eternity). Создание — `D()`, вывод — `formatNumber`,
`formatExact`, `formatPercent`, `formatMultiplier`, `formatRate`, `formatTime` из
`src/core/math/format.ts`.

**Сетка гексагональная, плоский верх, раскладка odd-q.** Логика соседства — `core/math/hexGeometry.ts`,
пиксели — `core/math/hexLayout.ts`; координата клетки всегда означает ЦЕНТР. Рендер —
`components/game/FactoryGrid.tsx` на pixi.js.

**UI.** Тёмная палитра в духе Industry Idle (Dracula), плоские панели. Готовые примитивы —
`src/components/ui` (`Panel`, `Stat`, `Meter`, `Tabs`, `Modal`, `PanelBoundary`, `GameIcon`).
Иконки — Material Icons из сгенерированного `icons/glyphs.ts`: файл руками не правят, новые
иконки добавляют в `MAP`/`EXTRA` в `tools/gen-glyphs.mjs` и перегенерируют.
Тяжёлые и редко открываемые модалки грузятся через `lazy()` и монтируются только когда открыты.

**Комментарии объясняют ПОЧЕМУ**, часто с ссылкой на пункт `bigplan.md` и на то, что было
сломано раньше. Этот стиль стоит сохранять: он и есть основная документация решений.

## Сервер

`server/index.js` — точка входа: middleware (`http-middleware.js`: security headers, таймаут
запроса, compression, rate limit), auth (сессионные токены, `auth-password.js`), settings/
preferences, слоты (`/api/slots`) и сейвы (`/api/saves`), SSE-поток `/api/stream`
(`realtime.js`), health-check `/api/health`. Фичи подключаются фабриками маршрутов:
`market.js` + `market-sim/`, `market-vault.js`, `guilds.js`, `chat.js`, `admin.js`,
`p2p-lending.js`, `offline-trading.js`, `plans.js`, `ai.js` + `ai-oracle.js`.

Лимит JSON-тела — 24 МБ: сейв развитой базы легко превышает 1 МБ, и старый дефолт express
давал 413, а автосейв на клиенте ответ не проверял.

Схема БД создаётся идемпотентно в `initDb()` (`CREATE TABLE IF NOT EXISTS` + `ALTER TABLE …
ADD COLUMN IF NOT EXISTS`) при старте сервера. Файлы `server/migration_*.sql` — разовые
миграции, применяются вручную через `psql $DATABASE_URL -f …`. Пул Postgres настроен под ~100
игроков (`PG_POOL_MAX`, `statement_timeout`) — параметры и обоснование в `server/db.js`.

В production express раздаёт `dist/`, отдаёт SPA-fallback на все не-`/api` пути и отвечает 404
на любой `*.map`; сами карты кода после сборки лежат в `sourcemaps/` вне раздаваемой папки
(`sourcemap: 'hidden'` в `vite.config.ts`).

`vite.config.ts` вручную режет вендорные чанки (pixi, charts, motion, icons, math, react).
Правила там неочевидны и защищают от циклов между чанками (react/use-sync-external-store/
commonjsHelpers) — менять только прочитав комментарии.

## Тесты и линт

`vitest.config.ts` — окружение `node`, без jsdom: тестируется ЧИСТЫЙ слой (форматирование,
резолвер подписей, сериализация и миграции сейвов, кредиты, очередь стройки, подсистемы тика,
плюс серверные `server/**/*.test.js`). Компоненты и сторы намеренно не тянутся.

ESLint: часть правил — `warn` осознанно (накопленные `any`, `react-refresh/only-export-components`),
чтобы команда линта оставалась проходимой; ошибками остаются неиспользуемые переменные, правила
хуков и т.п. `argsIgnorePattern: '^_'` — принятый способ сказать «параметр нужен по сигнатуре».

## Планы и история

`bigplan.md` — рабочий список задач и разбор корневых причин (пункты нумерованные, `[x]` —
сделано); комментарии в коде и сообщения коммитов ссылаются на его пункты («bigplan 22»).
Остальные корневые `.md` (`PLANGLOBAL.md`, `NEW_GAME_PLAN.md`, `infinitely.md`, `balance.md`,
`ui-design.md`, …) — историческая проектная документация; актуальное состояние систем описано
в `docs/`.
