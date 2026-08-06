/**
 * СЖАТИЕ НЕ ДОЛЖНО СЪЕДАТЬ ПОТОКОВЫЕ ОТВЕТЫ (bigplan.md, пункты 17, 24)
 *
 * Мидлвара сжатия копит тело в массиве и отдаёт его на res.end(). У SSE (`/api/stream`) end()
 * не наступает НИКОГДА, поэтому в браузер не уходило ничего — даже заголовки, так как Node
 * отправляет их вместе с первой записью в тело. Весь realtime-канал (чат, чат гильдии,
 * админские начисления, плашки о заказах) был мёртв.
 *
 * Почему это пережило и ручные проверки, и тесты: curl без --compressed НЕ шлёт
 * Accept-Encoding, и на нём поток работает идеально. Заголовок шлёт браузер — единственный
 * клиент, которого в проверках не было. Поэтому тест ОБЯЗАН слать Accept-Encoding: без него
 * он снова проверял бы не тот путь.
 */

import { describe, expect, it } from 'vitest';
import { compression } from './http-middleware.js';

/** Поддельные req/res: пишем в socket[] всё, что реально ушло бы клиенту. */
function fakeExchange({ acceptEncoding = 'gzip, deflate, br' } = {}) {
  const socket = [];
  const headers = {};
  const req = { method: 'GET', headers: { 'accept-encoding': acceptEncoding } };
  const res = {
    headersSent: false,
    write(chunk) {
      socket.push(String(chunk));
      return true;
    },
    end(chunk) {
      if (chunk) socket.push(String(chunk));
      return res;
    },
    setHeader(name, value) {
      headers[String(name).toLowerCase()] = value;
      return res;
    },
    getHeader(name) {
      return headers[String(name).toLowerCase()];
    },
    writeHead(status, hdrs) {
      res.headersSent = true;
      socket.push(`<HEAD ${status}>`);
      if (hdrs) for (const [k, v] of Object.entries(hdrs)) headers[k.toLowerCase()] = v;
      return res;
    },
  };
  return { req, res, socket, headers };
}

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
};

describe('compression + SSE', () => {
  it('отдаёт события сразу, не дожидаясь res.end(), которого не будет', () => {
    const { req, res, socket } = fakeExchange();
    compression()(req, res, () => {});

    res.writeHead(200, SSE_HEADERS);
    res.write('event: stream.ready\ndata: {"at":1}\n\n');
    res.write('event: market.order.created\ndata: {"id":"x"}\n\n');

    // Именно это и было сломано: до res.end() в сокет не уходило ни байта.
    expect(socket.join('')).toContain('event: stream.ready');
    expect(socket.join('')).toContain('event: market.order.created');
  });

  it('heartbeat-комментарии тоже доходят: по ним прокси понимает, что поток живой', () => {
    const { req, res, socket } = fakeExchange();
    compression()(req, res, () => {});

    res.writeHead(200, SSE_HEADERS);
    res.write(': ping\n\n');

    expect(socket.join('')).toContain(': ping');
  });

  it('заголовки уходят раньше тела, иначе Node подставит свои', () => {
    const { req, res, socket } = fakeExchange();
    compression()(req, res, () => {});

    res.writeHead(200, SSE_HEADERS);
    res.write('event: a\ndata: 1\n\n');

    expect(socket[0]).toBe('<HEAD 200>');
  });

  it('поток не буферизуется и когда тип выставлен через setHeader', () => {
    const { req, res, socket } = fakeExchange();
    compression()(req, res, () => {});

    res.setHeader('Content-Type', 'text/event-stream');
    res.write('event: a\ndata: 1\n\n');

    expect(socket.join('')).toContain('event: a');
  });

  it('обычный JSON-ответ по-прежнему копится и сжимается одним куском', () => {
    const { req, res, socket, headers } = fakeExchange();
    compression()(req, res, () => {});

    res.setHeader('Content-Type', 'application/json');
    const body = JSON.stringify({ pad: 'x'.repeat(4000) });
    res.write(body);
    // До end() тело не уходит — это и есть смысл буферизации для одноразовых ответов.
    expect(socket).toHaveLength(0);

    res.end();
    return new Promise((resolve) => {
      setTimeout(() => {
        expect(headers['content-encoding']).toBe('br');
        // Ушло сжатое: заметно короче исходных 4 КБ.
        expect(socket.join('').length).toBeLessThan(body.length);
        resolve();
      }, 50);
    });
  });

  it('без Accept-Encoding мидлвара вообще не вмешивается — этим и маскировался отказ', () => {
    const { req, res, socket } = fakeExchange({ acceptEncoding: '' });
    compression()(req, res, () => {});

    res.writeHead(200, SSE_HEADERS);
    res.write('event: a\ndata: 1\n\n');

    expect(socket.join('')).toContain('event: a');
  });
});
