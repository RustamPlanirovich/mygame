/**
 * СПИСКИ ПРОИЗВОДСТВА («планы») — bigplan.md, пункт 37.
 *
 * Зачем: цепочки в игре длинные (процессоры ← полупроводники ← кремний ← …), а держать в
 * голове, какое здание нужно построить следующим, невозможно. Игрок хочет завести свой список
 * («чтобы сделать компьютер, нужны такие-то здания»), отмечать сделанное и оставлять заметки.
 *
 * Почему на сервере, а не в сейве: заметки — это НЕ игровое состояние. Сейв версионируется,
 * миграцируется и целиком перезаписывается автосейвом с оптимистичной блокировкой
 * (features/saveRevision.ts). Отметка «построил» из другой вкладки или с телефона в такой
 * схеме потерялась бы вместе с конфликтом ревизий. Плюс список хочется видеть, даже когда
 * сейв ещё не загрузился.
 *
 * Привязка к слоту: план описывает конкретную партию, поэтому slot_id есть, но допускает NULL —
 * планы, созданные без активного слота, видны всегда (запрос сравнивает через IS NOT DISTINCT
 * FROM, а не через =, иначе NULL никогда бы не совпал).
 */

/** Заголовок списка. Длиннее в панель 400px всё равно не влезет. */
export const MAX_TITLE_LENGTH = 120;

/** Текст пункта/заметки. */
export const MAX_TEXT_LENGTH = 500;

/** id здания или ресурса — это идентификатор из данных игры, а не пользовательский ввод. */
export const MAX_REF_LENGTH = 64;

/**
 * Потолки, чтобы ошибка на клиенте (цикл в «добавить цепочку», залипшая кнопка) не превратилась
 * в бесконечный рост таблицы. Числа с большим запасом от любого разумного использования.
 */
export const MAX_PLANS_PER_USER = 60;
export const MAX_ITEMS_PER_PLAN = 300;
/** Сколько пунктов принимаем за один POST — ровно под «добавить всю цепочку». */
export const MAX_BULK_ITEMS = 60;

export const ITEM_KINDS = ['building', 'resource', 'note'];

/**
 * Целевое количество: сколько зданий построить / сколько ресурса накопить.
 * Хранится как INTEGER, поэтому потолок — заведомо безопасное для int4 значение.
 */
const MAX_TARGET_COUNT = 1_000_000_000;

/**
 * Управляющие символы заменяем пробелом — как в чате (server/chat.js): текст приходит с клиента,
 * печатается в UI и попадает в логи, а NUL и \r ломают и то, и другое. Диапазоны заданы
 * escape-последовательностями: записанные буквально, они превращают исходник в нечитаемый.
 *
 * Разница с чатом: в заметке перевод строки РАЗРЕШЁН — это блокнот игрока, а не SSE-кадр,
 * где пустая строка означает конец события.
 */
function stripControlChars(raw, { allowNewlines }) {
  const pattern = allowNewlines
    ? /[\u0000-\u0009\u000b-\u001f\u007f]/g
    : /[\u0000-\u001f\u007f]/g;
  return String(raw).replace(pattern, ' ');
}

/** Заголовок списка: обрезаем пробелы, вырезаем управляющие символы. null — заголовок непригоден. */
export function normalizeTitle(raw) {
  if (typeof raw !== 'string') return null;
  const cleaned = stripControlChars(raw, { allowNewlines: false }).trim();
  if (cleaned.length === 0) return null;
  return cleaned.slice(0, MAX_TITLE_LENGTH);
}

/** id ресурса/здания. Мусор отбрасываем целиком, а не «чистим»: подделанный id всё равно не найдётся. */
export function normalizeRef(raw) {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.trim();
  if (cleaned.length === 0 || cleaned.length > MAX_REF_LENGTH) return null;
  return /^[a-zA-Z0-9_\-.]+$/.test(cleaned) ? cleaned : null;
}

/**
 * slot_id из запроса. Отдельная функция, потому что здесь легко обжечься: `Number(null)` даёт
 * НОЛЬ, а не NaN, и «план без слота» уходил в БД со slot_id = 0 — внешний ключ на game_slots
 * падал, а игрок вместо созданного списка видел «Ошибка: INTERNAL». Слоты — SERIAL, то есть
 * всегда положительные, поэтому 0 и отрицательные значения тоже означают «без слота».
 */
export function normalizeSlotId(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : null;
}

function normalizeTargetCount(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  const value = Number(raw);
  if (!Number.isFinite(value)) return null;
  const rounded = Math.floor(value);
  if (rounded < 1) return null;
  return Math.min(rounded, MAX_TARGET_COUNT);
}

/**
 * Один пункт списка. Возвращает null, если пункт бессмысленен:
 *   - здание/ресурс без ref_id — это пустая строка в списке, её нечем показать;
 *   - заметка без текста — то же самое.
 * Именно поэтому проверка здесь, а не в CHECK-констрейнте: пункт молча пропускаем, а не
 * роняем весь bulk-запрос «добавить цепочку» из-за одного мусорного элемента.
 */
export function normalizeItemInput(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const kind = ITEM_KINDS.includes(raw.kind) ? raw.kind : null;
  if (!kind) return null;

  const refId = kind === 'note' ? null : normalizeRef(raw.refId ?? raw.ref_id);
  if (kind !== 'note' && !refId) return null;

  const rawText = raw.text ?? raw.comment ?? '';
  const text =
    typeof rawText === 'string'
      ? stripControlChars(rawText, { allowNewlines: true }).trim().slice(0, MAX_TEXT_LENGTH)
      : '';
  if (kind === 'note' && text.length === 0) return null;

  return {
    kind,
    refId,
    text: text.length > 0 ? text : null,
    targetCount: normalizeTargetCount(raw.targetCount ?? raw.target_count),
    pinned: Boolean(raw.pinned),
  };
}

/** Массив пунктов из тела запроса: одиночный пункт и bulk обрабатываются одним кодом. */
export function normalizeItemsPayload(body) {
  const list = Array.isArray(body?.items) ? body.items : [body];
  const normalized = [];
  for (const raw of list.slice(0, MAX_BULK_ITEMS)) {
    const item = normalizeItemInput(raw);
    if (item) normalized.push(item);
  }
  return normalized;
}

/** Строка БД → форма для клиента. Одно место маппинга snake_case → camelCase. */
function rowToItem(row) {
  return {
    id: row.id,
    kind: row.kind,
    refId: row.ref_id,
    text: row.text,
    targetCount: row.target_count,
    done: row.done,
    doneAt: row.done_at,
    pinned: row.pinned,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

function rowToPlan(row) {
  return {
    id: row.id,
    slotId: row.slot_id,
    title: row.title,
    goalKind: row.goal_kind,
    goalRef: row.goal_ref,
    pinned: row.pinned,
    archived: row.archived,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items: [],
  };
}

export async function initPlansTables(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS production_plans (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      slot_id INTEGER REFERENCES game_slots(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      goal_kind TEXT,
      goal_ref TEXT,
      pinned BOOLEAN NOT NULL DEFAULT false,
      archived BOOLEAN NOT NULL DEFAULT false,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS production_plan_items (
      id SERIAL PRIMARY KEY,
      plan_id INTEGER NOT NULL REFERENCES production_plans(id) ON DELETE CASCADE,
      kind TEXT NOT NULL CHECK (kind IN ('building', 'resource', 'note')),
      ref_id TEXT,
      text TEXT,
      target_count INTEGER,
      done BOOLEAN NOT NULL DEFAULT false,
      done_at TIMESTAMPTZ,
      pinned BOOLEAN NOT NULL DEFAULT false,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Основной запрос — «все планы игрока в текущем слоте», поэтому индекс составной.
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_production_plans_user_slot ON production_plans(user_id, slot_id);
  `);
  // Пункты всегда читаются пачкой по плану и сразу в порядке отображения.
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_production_plan_items_plan ON production_plan_items(plan_id, sort_order, id);
  `);

  console.log('[Plans] Tables initialized');
}

export function createPlansRoutes(app, pool, authMiddleware) {
  /**
   * Планы игрока. slotId необязателен: без него отдаём планы, не привязанные ни к одному слоту.
   * Всегда отдаём и архивные — их прячет клиент, а второй запрос ради архива не нужен.
   */
  app.get('/api/plans', authMiddleware, async (req, res) => {
    try {
      const safeSlotId = normalizeSlotId(req.query.slotId);

      const plans = await pool.query(
        `SELECT id, slot_id, title, goal_kind, goal_ref, pinned, archived, sort_order,
                created_at, updated_at
           FROM production_plans
          WHERE user_id = $1 AND slot_id IS NOT DISTINCT FROM $2
          ORDER BY pinned DESC, sort_order ASC, id ASC
          LIMIT $3`,
        [req.userId, safeSlotId, MAX_PLANS_PER_USER]
      );

      if (plans.rowCount === 0) {
        res.json({ ok: true, plans: [] });
        return;
      }

      const byId = new Map();
      const result = plans.rows.map((row) => {
        const plan = rowToPlan(row);
        byId.set(plan.id, plan);
        return plan;
      });

      // Пункты одним запросом на все планы: запрос на план давал бы N+1 на каждое открытие панели.
      const items = await pool.query(
        `SELECT id, plan_id, kind, ref_id, text, target_count, done, done_at, pinned, sort_order, created_at
           FROM production_plan_items
          WHERE plan_id = ANY($1::int[])
          ORDER BY pinned DESC, sort_order ASC, id ASC`,
        [[...byId.keys()]]
      );
      for (const row of items.rows) {
        byId.get(row.plan_id)?.items.push(rowToItem(row));
      }

      res.json({ ok: true, plans: result });
    } catch (e) {
      console.error('[plans] GET /api/plans:', e?.message ?? e);
      res.status(500).json({ ok: false, error: 'INTERNAL' });
    }
  });

  /** Новый список. Цель (goalKind/goalRef) необязательна — она нужна только для подсказки цепочки. */
  app.post('/api/plans', authMiddleware, async (req, res) => {
    try {
      const title = normalizeTitle(req.body?.title);
      if (!title) {
        res.status(400).json({ ok: false, error: 'INVALID_TITLE' });
        return;
      }

      const safeSlotId = normalizeSlotId(req.body?.slotId);
      const goalKind =
        req.body?.goalKind === 'building' || req.body?.goalKind === 'resource'
          ? req.body.goalKind
          : null;
      const goalRef = goalKind ? normalizeRef(req.body?.goalRef) : null;

      /*
       * Слот проверяем на принадлежность игроку. Иначе есть два плохих исхода: чужой id прошёл бы
       * внешний ключ и привязал список к чужому слоту (найти его потом нельзя — GET фильтрует и по
       * user_id), а НЕсуществующий id (например, слот удалили в другой вкладке) уронил бы INSERT
       * по FK и вернул INTERNAL вместо внятного ответа.
       */
      if (safeSlotId !== null) {
        const slot = await pool.query('SELECT 1 FROM game_slots WHERE id = $1 AND user_id = $2', [
          safeSlotId,
          req.userId,
        ]);
        if (slot.rowCount === 0) {
          res.status(404).json({ ok: false, error: 'SLOT_NOT_FOUND' });
          return;
        }
      }

      const count = await pool.query(
        'SELECT COUNT(*)::int AS total FROM production_plans WHERE user_id = $1',
        [req.userId]
      );
      if (count.rows[0].total >= MAX_PLANS_PER_USER) {
        res.status(409).json({ ok: false, error: 'TOO_MANY_PLANS', limit: MAX_PLANS_PER_USER });
        return;
      }

      /*
       * sort_order = максимум+1 в пределах слота: новый список встаёт в конец. Считаем в том же
       * запросе, иначе два быстрых создания подряд получили бы одинаковый порядок.
       */
      const inserted = await pool.query(
        `INSERT INTO production_plans (user_id, slot_id, title, goal_kind, goal_ref, sort_order)
         VALUES ($1, $2, $3, $4, $5,
                 COALESCE((SELECT MAX(sort_order) + 1 FROM production_plans
                            WHERE user_id = $1 AND slot_id IS NOT DISTINCT FROM $2), 0))
         RETURNING id, slot_id, title, goal_kind, goal_ref, pinned, archived, sort_order,
                   created_at, updated_at`,
        [req.userId, safeSlotId, title, goalKind, goalRef]
      );

      res.json({ ok: true, plan: rowToPlan(inserted.rows[0]) });
    } catch (e) {
      console.error('[plans] POST /api/plans:', e?.message ?? e);
      res.status(500).json({ ok: false, error: 'INTERNAL' });
    }
  });

  /** Переименование, закрепление и архив. Присланные поля меняются, остальные остаются как были. */
  app.patch('/api/plans/:id', authMiddleware, async (req, res) => {
    try {
      const planId = Number(req.params.id);
      if (!Number.isInteger(planId)) {
        res.status(400).json({ ok: false, error: 'INVALID_ID' });
        return;
      }

      const title = req.body?.title === undefined ? undefined : normalizeTitle(req.body.title);
      if (title === null) {
        res.status(400).json({ ok: false, error: 'INVALID_TITLE' });
        return;
      }

      const updated = await pool.query(
        `UPDATE production_plans
            SET title = COALESCE($3, title),
                pinned = COALESCE($4, pinned),
                archived = COALESCE($5, archived),
                updated_at = NOW()
          WHERE id = $1 AND user_id = $2
          RETURNING id, slot_id, title, goal_kind, goal_ref, pinned, archived, sort_order,
                    created_at, updated_at`,
        [
          planId,
          req.userId,
          title ?? null,
          req.body?.pinned === undefined ? null : Boolean(req.body.pinned),
          req.body?.archived === undefined ? null : Boolean(req.body.archived),
        ]
      );

      if (updated.rowCount === 0) {
        res.status(404).json({ ok: false, error: 'PLAN_NOT_FOUND' });
        return;
      }
      res.json({ ok: true, plan: rowToPlan(updated.rows[0]) });
    } catch (e) {
      console.error('[plans] PATCH /api/plans/:id:', e?.message ?? e);
      res.status(500).json({ ok: false, error: 'INTERNAL' });
    }
  });

  /** Удаление списка вместе с пунктами (ON DELETE CASCADE в схеме). */
  app.delete('/api/plans/:id', authMiddleware, async (req, res) => {
    try {
      const planId = Number(req.params.id);
      if (!Number.isInteger(planId)) {
        res.status(400).json({ ok: false, error: 'INVALID_ID' });
        return;
      }

      const removed = await pool.query(
        'DELETE FROM production_plans WHERE id = $1 AND user_id = $2 RETURNING id',
        [planId, req.userId]
      );
      if (removed.rowCount === 0) {
        res.status(404).json({ ok: false, error: 'PLAN_NOT_FOUND' });
        return;
      }
      res.json({ ok: true });
    } catch (e) {
      console.error('[plans] DELETE /api/plans/:id:', e?.message ?? e);
      res.status(500).json({ ok: false, error: 'INTERNAL' });
    }
  });

  /**
   * Добавление пунктов. Принимает и один пункт, и массив `items` — «добавить всю цепочку»
   * должно быть ОДНИМ запросом: иначе десяток последовательных POST-ов на медленной сети
   * добавлял бы пункты по одному, и половина списка появлялась бы с задержкой.
   */
  app.post('/api/plans/:id/items', authMiddleware, async (req, res) => {
    try {
      const planId = Number(req.params.id);
      if (!Number.isInteger(planId)) {
        res.status(400).json({ ok: false, error: 'INVALID_ID' });
        return;
      }

      const items = normalizeItemsPayload(req.body);
      if (items.length === 0) {
        res.status(400).json({ ok: false, error: 'INVALID_ITEM' });
        return;
      }

      // Владение проверяем отдельным запросом: без него игрок мог бы дописывать в чужой список.
      const owned = await pool.query(
        `SELECT p.id,
                (SELECT COUNT(*)::int FROM production_plan_items i WHERE i.plan_id = p.id) AS item_count,
                COALESCE((SELECT MAX(i.sort_order) FROM production_plan_items i WHERE i.plan_id = p.id), -1) AS max_order
           FROM production_plans p
          WHERE p.id = $1 AND p.user_id = $2`,
        [planId, req.userId]
      );
      if (owned.rowCount === 0) {
        res.status(404).json({ ok: false, error: 'PLAN_NOT_FOUND' });
        return;
      }

      const { item_count: itemCount, max_order: maxOrder } = owned.rows[0];
      if (itemCount + items.length > MAX_ITEMS_PER_PLAN) {
        res.status(409).json({ ok: false, error: 'TOO_MANY_ITEMS', limit: MAX_ITEMS_PER_PLAN });
        return;
      }

      /*
       * Одна INSERT ... SELECT из массивов вместо N запросов: пункты цепочки должны появиться
       * атомарно, а порядок — совпасть с порядком в присланном массиве (unnest сохраняет его).
       */
      const inserted = await pool.query(
        `INSERT INTO production_plan_items (plan_id, kind, ref_id, text, target_count, pinned, sort_order)
         SELECT $1, kind, ref_id, text, target_count, pinned, $2::int + ordinality
           FROM unnest($3::text[], $4::text[], $5::text[], $6::int[], $7::bool[])
                WITH ORDINALITY AS t(kind, ref_id, text, target_count, pinned, ordinality)
         RETURNING id, kind, ref_id, text, target_count, done, done_at, pinned, sort_order, created_at`,
        [
          planId,
          maxOrder,
          items.map((i) => i.kind),
          items.map((i) => i.refId),
          items.map((i) => i.text),
          items.map((i) => i.targetCount),
          items.map((i) => i.pinned),
        ]
      );

      await pool.query('UPDATE production_plans SET updated_at = NOW() WHERE id = $1', [planId]);

      res.json({ ok: true, items: inserted.rows.map(rowToItem) });
    } catch (e) {
      console.error('[plans] POST /api/plans/:id/items:', e?.message ?? e);
      res.status(500).json({ ok: false, error: 'INTERNAL' });
    }
  });

  /**
   * Отметка «сделано», закрепление, правка текста и цели.
   * done_at ставится сервером: часы клиента для «когда я это сделал» доверия не заслуживают.
   */
  app.patch('/api/plans/items/:itemId', authMiddleware, async (req, res) => {
    try {
      const itemId = Number(req.params.itemId);
      if (!Number.isInteger(itemId)) {
        res.status(400).json({ ok: false, error: 'INVALID_ID' });
        return;
      }

      const done = req.body?.done === undefined ? null : Boolean(req.body.done);
      const pinned = req.body?.pinned === undefined ? null : Boolean(req.body.pinned);

      let text = null;
      if (req.body?.text !== undefined) {
        text =
          typeof req.body.text === 'string'
            ? stripControlChars(req.body.text, { allowNewlines: true }).trim().slice(0, MAX_TEXT_LENGTH)
            : '';
      }

      const targetCount =
        req.body?.targetCount === undefined ? null : normalizeTargetCount(req.body.targetCount);
      const clearTarget = req.body?.targetCount === null || req.body?.targetCount === '';

      const updated = await pool.query(
        `UPDATE production_plan_items i
            SET done = COALESCE($3, i.done),
                done_at = CASE
                            WHEN $3 IS NULL THEN i.done_at
                            WHEN $3 = true THEN NOW()
                            ELSE NULL
                          END,
                pinned = COALESCE($4, i.pinned),
                text = CASE WHEN $5::text IS NULL THEN i.text
                            WHEN $5 = '' THEN NULL
                            ELSE $5 END,
                target_count = CASE WHEN $7 THEN NULL ELSE COALESCE($6, i.target_count) END,
                updated_at = NOW()
          WHERE i.id = $1
            AND i.plan_id IN (SELECT id FROM production_plans WHERE user_id = $2)
          RETURNING i.id, i.plan_id, i.kind, i.ref_id, i.text, i.target_count, i.done, i.done_at,
                    i.pinned, i.sort_order, i.created_at`,
        [itemId, req.userId, done, pinned, text, targetCount, clearTarget]
      );

      if (updated.rowCount === 0) {
        res.status(404).json({ ok: false, error: 'ITEM_NOT_FOUND' });
        return;
      }

      await pool.query('UPDATE production_plans SET updated_at = NOW() WHERE id = $1', [
        updated.rows[0].plan_id,
      ]);

      res.json({ ok: true, item: rowToItem(updated.rows[0]) });
    } catch (e) {
      console.error('[plans] PATCH /api/plans/items/:itemId:', e?.message ?? e);
      res.status(500).json({ ok: false, error: 'INTERNAL' });
    }
  });

  app.delete('/api/plans/items/:itemId', authMiddleware, async (req, res) => {
    try {
      const itemId = Number(req.params.itemId);
      if (!Number.isInteger(itemId)) {
        res.status(400).json({ ok: false, error: 'INVALID_ID' });
        return;
      }

      const removed = await pool.query(
        `DELETE FROM production_plan_items
          WHERE id = $1 AND plan_id IN (SELECT id FROM production_plans WHERE user_id = $2)
          RETURNING id`,
        [itemId, req.userId]
      );
      if (removed.rowCount === 0) {
        res.status(404).json({ ok: false, error: 'ITEM_NOT_FOUND' });
        return;
      }
      res.json({ ok: true });
    } catch (e) {
      console.error('[plans] DELETE /api/plans/items/:itemId:', e?.message ?? e);
      res.status(500).json({ ok: false, error: 'INTERNAL' });
    }
  });
}
