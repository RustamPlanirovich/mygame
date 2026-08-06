-- Списки производства («планы») — bigplan.md, пункт 37.
--
-- Те же таблицы создаёт initPlansTables() при старте сервера; файл нужен для ручного
-- применения на боевой БД до деплоя (psql $DATABASE_URL -f server/migration_plans.sql),
-- как и остальные server/migration_*.sql.

CREATE TABLE IF NOT EXISTS production_plans (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- NULL допустим: план, созданный без активного слота, виден всегда.
  slot_id INTEGER REFERENCES game_slots(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  -- Цель списка ('resource' | 'building' + id) — из неё строится подсказка цепочки.
  goal_kind TEXT,
  goal_ref TEXT,
  pinned BOOLEAN NOT NULL DEFAULT false,
  archived BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS production_plan_items (
  id SERIAL PRIMARY KEY,
  plan_id INTEGER NOT NULL REFERENCES production_plans(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('building', 'resource', 'note')),
  -- id здания или ресурса; у заметки NULL — она живёт текстом.
  ref_id TEXT,
  text TEXT,
  target_count INTEGER,
  done BOOLEAN NOT NULL DEFAULT false,
  -- Ставится сервером: часам клиента «когда я это сделал» доверять нельзя.
  done_at TIMESTAMPTZ,
  pinned BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Основной запрос — «все планы игрока в текущем слоте».
CREATE INDEX IF NOT EXISTS idx_production_plans_user_slot ON production_plans(user_id, slot_id);
-- Пункты читаются пачкой по плану и сразу в порядке отображения.
CREATE INDEX IF NOT EXISTS idx_production_plan_items_plan ON production_plan_items(plan_id, sort_order, id);
