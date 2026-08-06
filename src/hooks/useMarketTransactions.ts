/**
 * Хук обмена ценностями между сервером биржи и игровым состоянием.
 *
 * ПОЧЕМУ ЗДЕСЬ БОЛЬШЕ НЕТ ПРИМЕНЕНИЯ СДЕЛОК (bigplan.md, пункт 33)
 *
 * Раньше клиент сам начислял себе исполненную сделку и запросом
 * POST /api/market/apply-transactions сообщал серверу, что она рассчитана. Пока он
 * этого не сделал, сделка висела незакрытой — то есть исполнение ордера зависело от
 * того, открыта ли вкладка у КОНТРАГЕНТА. Теперь расчёт целиком серверный:
 *
 *  - новые исполнения ложатся в сейф одной транзакцией (settlement='vault',
 *    сразу 'applied') — клиенту нечего применять;
 *  - редкие остатки старой модели (settlement='client') закрывает серверная
 *    зачистка `settleStrayClientTransactions`, зачисляя причитающееся в сейф;
 *  - маршрут apply-transactions отвечает 410 и из клиента убран.
 *
 * ЧТО ОСТАЛОСЬ. Только незавершённые ВЫВОДЫ из сейфа. Это не расчёт сделки, а
 * действие игрока над собственным товаром: сервер уже списал заявленное из сейфа, и
 * до начисления в игру товар «в пути». Если клиент упал между шагами, дочислить
 * может только он — товар живёт в его сейве. От повторного начисления защищает
 * локальная отметка в src/features/vaultBridge.ts.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useMarketStore } from '../features/marketStore';
import { isAuthenticated } from '../utils/settingsApi';

// Интервал проверки незавершённых выводов (10 секунд)
const CHECK_INTERVAL_MS = 10_000;

/**
 * Хук дочисления незавершённых выводов из сейфа биржи.
 */
export function useMarketTransactions() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isProcessingRef = useRef(false);

  const settlePendingWithdrawals = useMarketStore(state => state.settlePendingWithdrawals);

  const settleWithdrawals = useCallback(async () => {
    if (!isAuthenticated() || isProcessingRef.current) {
      return;
    }

    isProcessingRef.current = true;
    try {
      const settled = await settlePendingWithdrawals();
      if (settled > 0) {
        console.log(`[MarketTransactions] Дочислено выводов из сейфа: ${settled}`);
      }
    } catch (e) {
      console.error('[MarketTransactions] Ошибка обработки выводов из сейфа:', e);
    } finally {
      isProcessingRef.current = false;
    }
  }, [settlePendingWithdrawals]);

  useEffect(() => {
    // Небольшая задержка перед первой проверкой, чтобы игра успела загрузиться
    const initialTimeout = setTimeout(() => {
      settleWithdrawals();
    }, 3000);

    intervalRef.current = setInterval(settleWithdrawals, CHECK_INTERVAL_MS);

    return () => {
      clearTimeout(initialTimeout);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [settleWithdrawals]);

  // Возвращаем функцию для ручной проверки
  return {
    checkPendingTransactions: settleWithdrawals,
  };
}
