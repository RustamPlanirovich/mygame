/**
 * Серверный расчёт остатков клиентской модели (bigplan.md, пункт 33).
 *
 * Проверяется не SQL, а РЕШЕНИЕ: какой стороне что причитается и в каком порядке
 * это делается. Два инварианта, нарушение которых стоит игроку товара:
 *
 *  1. начисляется ровно ОДНА сторона (встречная списана эскроу при создании
 *     ордера) — иначе покупатель получил бы ресурс и не заплатил;
 *  2. строка сначала ЗАХВАТЫВАЕТСЯ (`UPDATE ... status='pending' RETURNING`), и
 *     только потом идёт зачисление. Обратный порядок при гонке двух прогонов
 *     начислил бы дважды.
 */

import { describe, expect, it } from 'vitest';
import { settleStrayClientTransactions } from './market.js';

const VAULT_CREDITS = '__credits__';

/**
 * Поддельный клиент pg: отвечает на три вида запросов, которые делает функция, и
 * записывает всё в журнал, чтобы тест мог проверить порядок.
 */
function fakeClient(rows, { claimFails = new Set() } = {}) {
  const log = [];
  return {
    log,
    async query(sql, params) {
      const text = String(sql);
      if (text.includes('FROM market_pending_transactions pt')) {
        log.push({ kind: 'select' });
        return { rowCount: rows.length, rows };
      }
      if (text.includes('FOR UPDATE') && text.includes('market_vault')) {
        log.push({ kind: 'lock' });
        return { rowCount: 0, rows: [] };
      }
      if (text.includes('UPDATE market_pending_transactions')) {
        const id = params[0];
        const won = !claimFails.has(id);
        log.push({ kind: 'claim', id, won });
        return won ? { rowCount: 1, rows: [{ id }] } : { rowCount: 0, rows: [] };
      }
      if (text.includes('UPDATE market_vault')) {
        log.push({ kind: 'credit', playerId: params[0], resource: params[1], delta: params[2], reason: params[4], refId: params[5] });
        return { rowCount: 1, rows: [{ available: '0', locked: '0', ledger_id: 'led' }] };
      }
      log.push({ kind: 'other', text });
      return { rowCount: 0, rows: [] };
    },
  };
}

const BUY_ROW = {
  id: 'tx-buy',
  player_id: 101,
  transaction_type: 'buy',
  resource: 'ore',
  resource_amount: '10',
  credits_amount: '250',
};

const SELL_ROW = {
  id: 'tx-sell',
  player_id: 202,
  transaction_type: 'sell',
  resource: 'ore',
  resource_amount: '10',
  credits_amount: '240',
};

describe('settleStrayClientTransactions', () => {
  it('покупателю зачисляет РЕСУРС и не трогает кредиты', async () => {
    const client = fakeClient([BUY_ROW]);
    const settled = await settleStrayClientTransactions(client);

    expect(settled).toBe(1);
    const credits = client.log.filter(e => e.kind === 'credit');
    expect(credits).toHaveLength(1);
    expect(credits[0]).toMatchObject({ playerId: 101, resource: 'ore', delta: '10' });
  });

  it('продавцу зачисляет ВЫРУЧКУ (уже за вычетом комиссии) и не трогает ресурс', async () => {
    const client = fakeClient([SELL_ROW]);
    const settled = await settleStrayClientTransactions(client);

    expect(settled).toBe(1);
    const credits = client.log.filter(e => e.kind === 'credit');
    expect(credits).toHaveLength(1);
    // Именно credits_amount (240), а не gross: комиссию продавца уже удержали.
    expect(credits[0]).toMatchObject({ playerId: 202, resource: VAULT_CREDITS, delta: '240' });
  });

  it('сначала захватывает строку, и только потом зачисляет', async () => {
    const client = fakeClient([BUY_ROW]);
    await settleStrayClientTransactions(client);

    const kinds = client.log.map(e => e.kind);
    expect(kinds.indexOf('claim')).toBeLessThan(kinds.indexOf('credit'));
  });

  it('проигранный захват (строку успел взять другой прогон) не зачисляет ничего', async () => {
    const client = fakeClient([BUY_ROW], { claimFails: new Set(['tx-buy']) });
    const settled = await settleStrayClientTransactions(client);

    expect(settled).toBe(0);
    expect(client.log.some(e => e.kind === 'credit')).toBe(false);
  });

  it('на пустой выборке не блокирует сейф и не делает лишних запросов', async () => {
    const client = fakeClient([]);
    const settled = await settleStrayClientTransactions(client);

    expect(settled).toBe(0);
    expect(client.log).toEqual([{ kind: 'select' }]);
  });

  it('нулевую сумму не зачисляет, но строку закрывает', async () => {
    const client = fakeClient([{ ...BUY_ROW, resource_amount: '0' }]);
    const settled = await settleStrayClientTransactions(client);

    expect(settled).toBe(1);
    expect(client.log.some(e => e.kind === 'credit')).toBe(false);
  });
});
