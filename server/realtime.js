/**
 * REALTIME-КАНАЛ: ОДИН SSE-ПОТОК НА ИГРОКА (bigplan.md, пункт 24)
 *
 * До этого у проекта не было ни WebSocket, ни SSE — вообще ни одного упоминания. Из-за этого
 * три пункта плана были нереализуемы иначе, чем опросом: общий чат (12), чат гильдии (13) и
 * всплывающее сообщение о новом заказе на бирже (17). Каждый из них своим `setInterval` — это
 * N запросов в секунду на игрока при том, что данные меняются редко.
 *
 * ПОЧЕМУ SSE, А НЕ WEBSOCKET
 * Весь трафик здесь односторонний: сервер сообщает клиенту о событиях, а клиент отвечает
 * обычными POST-запросами, которые и так есть. SSE — это простой HTTP-ответ, он не требует
 * отдельного протокола, переживает reverse proxy без настройки Upgrade и авторизуется тем же
 * `authMiddleware`, что и остальные ручки. WebSocket дал бы дуплекс, который тут не нужен,
 * и вторую систему авторизации.
 *
 * ПОЧЕМУ ТОКЕН НЕ В URL
 * Браузерный EventSource не умеет ставить заголовки, поэтому «обычный» способ — `?token=...`.
 * Мы так не делаем: токен попал бы в access-логи nginx, в Referer и в историю. Клиент читает
 * поток через fetch + ReadableStream (см. utils/serverStream.ts) и передаёт токен в
 * `Authorization`, как все остальные запросы.
 *
 * ГРАНИЦЫ ОТВЕТСТВЕННОСТИ
 * Хаб ничего не хранит и ничего не гарантирует: пропущенные во время разрыва события НЕ
 * досылаются. Это осознанно — чат и тосты о заказах имеют смысл только «сейчас», а история
 * чата подтягивается обычным GET при открытии панели. Всё, что должно выживать, живёт в БД.
 */

/** Сколько секунд между heartbeat-комментариями. */
const HEARTBEAT_SECONDS = 25;

/**
 * Максимум одновременных подключений на одного игрока.
 * Несколько вкладок — норма, но открытые пачками они держат по соединению каждая.
 */
const MAX_CONNECTIONS_PER_USER = 4;

export function createRealtimeHub() {
  /** @type {Set<{userId:number, guildId:string|null, res:import('express').Response}>} */
  const clients = new Set();

  function countFor(userId) {
    let n = 0;
    for (const c of clients) if (c.userId === userId) n++;
    return n;
  }

  /** Отправить одному клиенту. Ошибку записи трактуем как разрыв. */
  function write(client, event, payload) {
    try {
      client.res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
      return true;
    } catch {
      clients.delete(client);
      return false;
    }
  }

  return {
    /** Сколько сейчас живых подключений (для /api/health и админки). */
    get connectionCount() {
      return clients.size;
    },

    /**
     * Разослать событие всем подключённым.
     * @param {(client: {userId:number, guildId:string|null}) => boolean} [filter]
     *        Кому отправлять. По умолчанию — всем.
     */
    broadcast(event, payload, filter) {
      for (const client of [...clients]) {
        if (filter && !filter(client)) continue;
        write(client, event, payload);
      }
    },

    /** Разослать только участникам гильдии. */
    broadcastToGuild(guildId, event, payload) {
      if (!guildId) return;
      this.broadcast(event, payload, (c) => c.guildId === guildId);
    },

    /** Отправить конкретному игроку (все его вкладки). */
    sendToUser(userId, event, payload) {
      this.broadcast(event, payload, (c) => c.userId === userId);
    },

    /**
     * Запомнить/обновить гильдию игрока, чтобы фильтр по гильдии работал без запроса в БД
     * на каждое сообщение. Вызывается при входе в гильдию и выходе из неё.
     */
    setUserGuild(userId, guildId) {
      for (const client of clients) {
        if (client.userId === userId) client.guildId = guildId ?? null;
      }
    },

    /** Подключить ответ Express как SSE-поток. */
    attach(req, res, { userId, guildId }) {
      if (countFor(userId) >= MAX_CONNECTIONS_PER_USER) {
        res.status(429).json({ ok: false, error: 'TOO_MANY_STREAMS' });
        return;
      }

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        // nginx по умолчанию буферизует ответ, и события копились бы до закрытия потока.
        'X-Accel-Buffering': 'no',
      });

      const client = { userId, guildId: guildId ?? null, res };
      clients.add(client);

      // Сразу подтверждаем подключение: клиенту нужно знать, что канал живой, а не «висит».
      write(client, 'stream.ready', { at: Date.now() });

      /*
       * Heartbeat как SSE-комментарий (строка, начинающаяся с ':'). Нужен по двум причинам:
       * прокси рвут «молчащие» соединения по таймауту, и разрыв иначе обнаружился бы только
       * при следующем событии — то есть, возможно, никогда.
       */
      const heartbeat = setInterval(() => {
        try {
          res.write(': ping\n\n');
        } catch {
          clearInterval(heartbeat);
          clients.delete(client);
        }
      }, HEARTBEAT_SECONDS * 1000);

      const cleanup = () => {
        clearInterval(heartbeat);
        clients.delete(client);
      };

      req.on('close', cleanup);
      req.on('error', cleanup);
      res.on('error', cleanup);
    },

    /** Закрыть все соединения (graceful shutdown). */
    closeAll() {
      for (const client of [...clients]) {
        try {
          client.res.end();
        } catch {
          /* соединение уже мертво */
        }
      }
      clients.clear();
    },
  };
}

/**
 * Единственный экземпляр на процесс.
 *
 * ВАЖНОЕ ОГРАНИЧЕНИЕ: хаб живёт в памяти процесса, поэтому при запуске в кластере (несколько
 * инстансов PM2) игроки на разных инстансах не увидят события друг друга. Сейчас
 * ecosystem.config.cjs держит instances: 1, так что это верно; при переходе на кластер понадобится
 * общая шина (Postgres LISTEN/NOTIFY или Redis pub/sub) — точка расширения ровно одна, этот файл.
 */
export const realtimeHub = createRealtimeHub();
