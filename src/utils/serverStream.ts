/**
 * ЧТЕНИЕ SSE-ПОТОКА С СЕРВЕРА (bigplan.md, пункт 24)
 *
 * ПОЧЕМУ НЕ EventSource
 * Браузерный EventSource не умеет ставить заголовки, поэтому токен пришлось бы передавать в
 * query-строке — а оттуда он попадает в access-логи nginx, в Referer и в историю браузера.
 * fetch + ReadableStream позволяет отправить обычный `Authorization: Bearer`, как во всех
 * остальных запросах. Ценой этого становится ручной разбор формата и ручной реконнект — но
 * реконнект с внятным backoff всё равно пришлось бы писать самому.
 *
 * ФОРМАТ SSE, КОТОРЫЙ МЫ РАЗБИРАЕМ
 *   event: <имя>\n
 *   data: <json>\n
 *   \n                  <- пустая строка = конец события
 *   : ping\n\n          <- комментарий (heartbeat), игнорируем
 * Многострочные data и поля id/retry сервер не использует, поэтому парсер их не поддерживает
 * намеренно: лишний код без применения — лишние места для ошибок.
 */

import { getAuthToken } from './settingsApi';

const API_URL = import.meta.env.VITE_API_URL || '';

/** Типы событий, которые присылает сервер. */
export type ServerStreamEvent =
  | { type: 'stream.ready'; payload: { at: number } }
  | { type: 'chat.message'; payload: ChatMessagePayload }
  | { type: 'market.order.created'; payload: MarketOrderPayload }
  | { type: 'admin.grant.applied'; payload: AdminGrantPayload };

export interface ChatMessagePayload {
  id: string;
  channel: 'global' | 'guild';
  guildId?: string;
  playerId: string;
  playerName: string;
  message: string;
  createdAt: number;
}

/**
 * Админская выдача, применённая на сервере (bigplan.md, пункт 9).
 * Дельты приходят плоским словарём: `{'currency.credits': '500', 'resources.ore': '100'}`.
 */
export interface AdminGrantPayload {
  grantId: string;
  saveId: number;
  slotId: number | null;
  deltas: Record<string, string>;
  clamped: string[];
}

export interface MarketOrderPayload {
  id: string;
  playerName: string;
  type: 'buy' | 'sell';
  resource: string;
  quantity: string;
  pricePerUnit: string;
  createdAt: number;
}

type Handler = (event: ServerStreamEvent) => void;

/*
 * Backoff при разрывах. Первое переподключение — почти сразу (обрыв мог быть случайным),
 * дальше растём до минуты, чтобы упавший сервер не получил шторм реконнектов от всех клиентов.
 */
const RECONNECT_DELAYS_MS = [1_000, 2_000, 5_000, 10_000, 30_000, 60_000];

export interface StreamConnection {
  /** Закрыть поток и прекратить попытки переподключения. */
  close: () => void;
}

/**
 * Подключиться к серверному потоку событий.
 *
 * @param onEvent вызывается на каждое событие; исключение внутри обработчика не роняет поток.
 * @param onStatus необязательный колбэк для индикации связи в интерфейсе.
 */
export function connectServerStream(
  onEvent: Handler,
  onStatus?: (status: 'connecting' | 'open' | 'closed') => void,
): StreamConnection {
  let closed = false;
  let attempt = 0;
  let controller: AbortController | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  const dispatch = (eventName: string, dataRaw: string) => {
    if (!eventName || !dataRaw) return;
    let payload: unknown;
    try {
      payload = JSON.parse(dataRaw);
    } catch {
      console.warn('[stream] не удалось разобрать data:', dataRaw.slice(0, 120));
      return;
    }
    try {
      onEvent({ type: eventName, payload } as ServerStreamEvent);
    } catch (e) {
      // Ошибка в обработчике одного события не должна убивать весь канал.
      console.error('[stream] обработчик события упал:', e);
    }
  };

  const run = async () => {
    if (closed) return;

    const token = getAuthToken();
    if (!token) {
      // Не авторизованы — нет смысла долбить сервер, ждём и проверяем снова.
      scheduleRetry();
      return;
    }

    onStatus?.('connecting');
    controller = new AbortController();

    try {
      const response = await fetch(`${API_URL}/api/stream`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        // 401 — истёкшая сессия, 429 — слишком много вкладок. И то и то лечится ожиданием.
        throw new Error(`stream HTTP ${response.status}`);
      }

      // Успешное подключение обнуляет backoff: следующий разрыв снова начнётся с секунды.
      attempt = 0;
      onStatus?.('open');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;

        // stream: true — чанк может оборваться посередине UTF-8 символа.
        buffer += decoder.decode(value, { stream: true });

        // События разделены пустой строкой. \r\n на случай прокси, переписывающего переводы.
        let sep = buffer.search(/\r?\n\r?\n/);
        while (sep !== -1) {
          const chunk = buffer.slice(0, sep);
          buffer = buffer.slice(sep + (buffer[sep] === '\r' ? 4 : 2));

          let eventName = '';
          let data = '';
          for (const line of chunk.split(/\r?\n/)) {
            if (line.startsWith(':')) continue; // heartbeat-комментарий
            if (line.startsWith('event:')) eventName = line.slice(6).trim();
            else if (line.startsWith('data:')) data = line.slice(5).trim();
          }
          dispatch(eventName, data);

          sep = buffer.search(/\r?\n\r?\n/);
        }
      }

      // Поток закрыт сервером (рестарт, деплой) — переподключаемся.
      throw new Error('stream closed by server');
    } catch (e) {
      if (closed) return;
      // AbortError — это наш собственный close(), логировать нечего.
      if (!(e instanceof DOMException && e.name === 'AbortError')) {
        console.warn('[stream] разрыв, переподключение:', (e as Error)?.message ?? e);
      }
      onStatus?.('closed');
      scheduleRetry();
    }
  };

  const scheduleRetry = () => {
    if (closed) return;
    const delay = RECONNECT_DELAYS_MS[Math.min(attempt, RECONNECT_DELAYS_MS.length - 1)];
    attempt += 1;
    retryTimer = setTimeout(run, delay);
  };

  void run();

  return {
    close: () => {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      controller?.abort();
      onStatus?.('closed');
    },
  };
}
