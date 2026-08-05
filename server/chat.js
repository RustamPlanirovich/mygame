/**
 * ЧАТ: ОБЩИЙ И ГИЛЬДЕЙСКИЙ (bigplan.md, пункты 12, 13, 24)
 *
 * Гильдейский чат существовал в БД и в API (server/guilds.js) ещё до этого файла, но у него
 * не было ни UI, ни доставки: сообщение уходило в таблицу и там оставалось, пока кто-нибудь
 * не откроет панель и не сделает GET. Общего канала не было вовсе.
 *
 * Здесь — общий чат целиком плюс SSE-рассылка на оба канала: клиент получает сообщение сразу,
 * а не опросом. История по-прежнему читается обычным GET при открытии панели — SSE ничего не
 * хранит и пропущенное во время разрыва не досылает (см. realtime.js).
 */

import { realtimeHub } from './realtime.js';

/** Максимальная длина сообщения. Совпадает с ограничением гильдейского чата. */
export const MAX_MESSAGE_LENGTH = 500;

/** Сколько сообщений отдаём в истории. */
const HISTORY_LIMIT = 100;

/**
 * Антиспам: не чаще одного сообщения в секунду и не больше 10 за 30 секунд.
 * В памяти процесса, а не в БД: ограничение поведенческое, терять его при рестарте не страшно,
 * а лишний запрос на каждое сообщение — страшно.
 */
const RATE_LIMIT = { minIntervalMs: 1000, maxPerWindow: 10, windowMs: 30_000 };

/** userId -> массив таймстемпов последних сообщений. */
const recentByUser = new Map();

function checkRateLimit(userId, now) {
  const times = (recentByUser.get(userId) ?? []).filter((t) => now - t < RATE_LIMIT.windowMs);

  if (times.length > 0 && now - times[times.length - 1] < RATE_LIMIT.minIntervalMs) {
    return { ok: false, error: 'TOO_FAST' };
  }
  if (times.length >= RATE_LIMIT.maxPerWindow) {
    return { ok: false, error: 'TOO_MANY_MESSAGES' };
  }

  times.push(now);
  recentByUser.set(userId, times);
  return { ok: true };
}

/**
 * Имя игрока в чате. Email целиком показывать нельзя — это персональные данные, которые
 * игрок не выбирал раскрывать. Берём часть до '@'.
 */
export function displayNameFromEmail(email) {
  const raw = String(email ?? '').split('@')[0];
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 32) : 'Игрок';
}

/**
 * Нормализация текста сообщения.
 * Возвращает null, если сообщение непригодно (пустое или слишком длинное после обрезки).
 */
export function normalizeMessage(raw) {
  if (typeof raw !== 'string') return null;
  /*
   * Управляющие символы заменяем пробелом. Дело не только в вёрстке: перевод строки ломает
   * САМ ФОРМАТ SSE — там пустая строка означает конец события, и сообщение с \n разорвало бы
   * поток для всех подключённых. Диапазоны заданы escape-последовательностями.
   */
  const cleaned = raw.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  if (cleaned.length === 0) return null;
  if (cleaned.length > MAX_MESSAGE_LENGTH) return null;
  return cleaned;
}

export async function initChatTables(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS global_chat (
      id SERIAL PRIMARY KEY,
      player_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      player_name VARCHAR(64) NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  // История читается «последние N по времени» — индекс именно под этот запрос.
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_global_chat_time ON global_chat(created_at DESC);`
  );
}

function rowToMessage(row) {
  return {
    id: row.id.toString(),
    channel: 'global',
    playerId: row.player_id.toString(),
    playerName: row.player_name,
    message: row.message,
    createdAt: new Date(row.created_at).getTime(),
  };
}

export function createChatRoutes(app, pool, authMiddleware) {
  /**
   * GET /api/chat/global — история общего чата.
   */
  app.get('/api/chat/global', authMiddleware, async (_req, res) => {
    try {
      const result = await pool.query(
        `SELECT id, player_id, player_name, message, created_at
         FROM global_chat
         ORDER BY created_at DESC
         LIMIT $1`,
        [HISTORY_LIMIT]
      );
      // reverse: клиенту нужен хронологический порядок, а индекс работает по DESC.
      res.json({ ok: true, messages: result.rows.reverse().map(rowToMessage) });
    } catch (e) {
      console.error('[chat] history failed:', e);
      res.status(500).json({ ok: false, error: String(e?.message ?? e) });
    }
  });

  /**
   * POST /api/chat/global — отправить сообщение всем игрокам.
   */
  app.post('/api/chat/global', authMiddleware, async (req, res) => {
    try {
      const message = normalizeMessage(req.body?.message);
      if (!message) {
        res.status(400).json({ ok: false, error: 'INVALID_MESSAGE' });
        return;
      }

      const limit = checkRateLimit(req.userId, Date.now());
      if (!limit.ok) {
        res.status(429).json({ ok: false, error: limit.error });
        return;
      }

      const playerName = displayNameFromEmail(req.userEmail);

      const result = await pool.query(
        `INSERT INTO global_chat (player_id, player_name, message)
         VALUES ($1, $2, $3)
         RETURNING id, player_id, player_name, message, created_at`,
        [req.userId, playerName, message]
      );

      const saved = rowToMessage(result.rows[0]);

      /*
       * Рассылаем ПОСЛЕ успешной записи: если INSERT упал, никто не должен увидеть сообщение,
       * которого нет в истории — иначе оно исчезнет при следующем открытии панели.
       */
      realtimeHub.broadcast('chat.message', saved);

      res.json({ ok: true, message: saved });
    } catch (e) {
      console.error('[chat] send failed:', e);
      res.status(500).json({ ok: false, error: String(e?.message ?? e) });
    }
  });

  /**
   * Периодическая чистка: общий чат — не архив, и таблица не должна расти вечно.
   * Держим последние 1000 сообщений.
   */
  const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
  const cleanup = setInterval(() => {
    pool
      .query(
        `DELETE FROM global_chat
         WHERE id NOT IN (SELECT id FROM global_chat ORDER BY created_at DESC LIMIT 1000)`
      )
      .catch((e) => console.warn('[chat] cleanup failed:', e?.message ?? e));
  }, CLEANUP_INTERVAL_MS);
  // unref: таймер чистки не должен держать процесс живым при выключении.
  cleanup.unref?.();
}
