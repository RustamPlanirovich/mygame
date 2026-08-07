/**
 * ОПОЗДАВШИЙ ОТВЕТ НЕ ДОЛЖЕН ПРЕВРАЩАТЬСЯ В ERR_HTTP_HEADERS_SENT
 *
 * Живой случай (07.08.2026, mygame-error-4.log): во время деплоя запросы упирались в
 * 30-секундный таймаут, тот отдавал 503 — а потом обработчик всё-таки досчитывал и звал свой
 * res.json(). Дальше ломалось каскадом:
 *   1) res.json бросал ERR_HTTP_HEADERS_SENT из тела обработчика;
 *   2) его catch звал res.status(500).json(...) и бросал ВТОРОЙ раз — уже из catch;
 *   3) в лог уходило «Cannot set headers» вместо настоящей причины отказа.
 * Один опоздавший ответ = три записи в логе и стёртая диагностика.
 *
 * Поэтому проверяем не «пришёл ли 503», а именно поведение ПОСЛЕ него: обработчик, который
 * ничего не знает о таймауте, должен доработать молча и без исключений.
 */

import { describe, expect, it, vi } from 'vitest';
import { requestTimeout } from './http-middleware.js';

/**
 * Поддельный res, повторяющий главное свойство настоящего: любая попытка выставить заголовок
 * после отправки бросает ERR_HTTP_HEADERS_SENT. Без этого тест проверял бы не тот путь.
 */
function fakeExchange() {
  const sent = [];
  const req = { method: 'GET', originalUrl: '/api/market/vault/pending' };
  const res = {
    headersSent: false,
    writableEnded: false,
    statusCode: 200,
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(body) {
      if (res.headersSent) {
        throw Object.assign(new Error('Cannot set headers after they are sent to the client'), {
          code: 'ERR_HTTP_HEADERS_SENT',
        });
      }
      res.headersSent = true;
      res.writableEnded = true;
      sent.push({ status: res.statusCode, body });
      return res;
    },
    setHeader() {
      if (res.headersSent) {
        throw Object.assign(new Error('Cannot set headers after they are sent to the client'), {
          code: 'ERR_HTTP_HEADERS_SENT',
        });
      }
      return res;
    },
    on() {},
  };
  return { req, res, sent };
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe('requestTimeout', () => {
  it('отдаёт 503 REQUEST_TIMEOUT, когда обработчик не уложился', async () => {
    const { req, res, sent } = fakeExchange();
    requestTimeout(10)(req, res, () => {});

    await wait(30);

    expect(sent).toEqual([{ status: 503, body: { ok: false, error: 'REQUEST_TIMEOUT' } }]);
  });

  it('поздний res.json() обработчика не бросает и не дописывает второй ответ', async () => {
    const { req, res, sent } = fakeExchange();
    requestTimeout(10)(req, res, () => {});

    await wait(30);

    // Ровно то, что делал /api/market/vault/pending на 32-й секунде.
    expect(() => res.json({ ok: true, withdrawals: [] })).not.toThrow();
    expect(sent).toHaveLength(1);
    expect(sent[0].status).toBe(503);
  });

  it('не бросает и повторная попытка ответить из catch-блока', async () => {
    const { req, res } = fakeExchange();
    requestTimeout(10)(req, res, () => {});

    await wait(30);

    // Обработчик: сначала успешный ответ, затем «обработка ошибки» — оба опоздали.
    expect(() => {
      try {
        res.json({ ok: true });
      } catch (e) {
        res.status(500).json({ ok: false, error: String(e?.message ?? e) });
      }
    }).not.toThrow();
  });

  it('о заглушенном ответе предупреждает один раз, а не молчит', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const { req, res } = fakeExchange();
      requestTimeout(10)(req, res, () => {});

      await wait(30);
      res.json({ ok: true });
      res.json({ ok: true });
      res.setHeader('X-Late', '1');

      const messages = warn.mock.calls.map((args) => String(args[0]));
      expect(messages.filter((m) => m.includes('request timeout after'))).toHaveLength(1);
      // Глушить молча нельзя: настоящий двойной ответ в обработчике стал бы невидимым.
      expect(messages.filter((m) => m.includes('ответ после таймаута отброшен'))).toHaveLength(1);
    } finally {
      warn.mockRestore();
    }
  });

  it('уложившийся в срок ответ таймаут не трогает', async () => {
    const { req, res, sent } = fakeExchange();
    requestTimeout(10)(req, res, () => {});

    res.json({ ok: true, currentSaveId: 7 });
    await wait(30);

    expect(sent).toEqual([{ status: 200, body: { ok: true, currentSaveId: 7 } }]);
  });
});
