/**
 * Хук обмена ценностями между сервером биржи и игровым состоянием.
 *
 * ЧТО ЗДЕСЬ ПОСЛЕ ПЕРЕХОДА НА СЕЙФ (и почему нет двойного начисления)
 *
 * 1. Расчёт сделок теперь СЕРВЕРНЫЙ: обе стороны получают своё внутри
 *    market_vault одной транзакцией. Такие строки market_pending_transactions
 *    создаются сразу со status='applied' и settlement='vault', поэтому в
 *    GET /api/market/pending-transactions они физически не попадают: запрос
 *    отдаёт только status='pending' AND settlement='client'.
 *    => Клиент НЕ начисляет себе сделки, рассчитанные в сейфе. Начислял бы —
 *       это и было бы двойное начисление.
 *
 * 2. Старые строки (до сейфа) остались с settlement='client' и по-прежнему
 *    ждут клиента. Их логика применения НЕ ТРОНУТА: игрок не должен потерять
 *    то, что ему уже причитается. Дополнительно стоит клиентская проверка
 *    settlement — если сервер когда-нибудь начнёт отдавать 'vault', такая
 *    строка будет пропущена, а не применена.
 *
 * 3. Товар из сейфа попадает в игру ТОЛЬКО через вывод: /vault/withdraw ->
 *    начисление -> /vault/withdraw/:id/confirm. Незавершённые выводы (клиент
 *    упал между шагами) дочисляются здесь же, тем же интервалом; от повторного
 *    начисления защищает локальная отметка в src/features/vaultBridge.ts.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useMarketStore } from '../features/marketStore';
import { useGameStore } from '../features/gameStore';
import { isAuthenticated } from '../utils/settingsApi';
import { D } from '../core/math/format';
import type { ResourceType } from '../core/gameTypes';

// Интервал проверки pending транзакций и незавершённых выводов (10 секунд)
const CHECK_INTERVAL_MS = 10_000;

/**
 * Хук автоматической обработки хвостов биржи:
 *  - дочисление незавершённых выводов из сейфа;
 *  - применение старых client-транзакций.
 */
export function useMarketTransactions() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isProcessingRef = useRef(false);

  const fetchPendingTransactions = useMarketStore(state => state.fetchPendingTransactions);
  const markTransactionsApplied = useMarketStore(state => state.markTransactionsApplied);
  const settlePendingWithdrawals = useMarketStore(state => state.settlePendingWithdrawals);

  // Применение транзакций к игровому состоянию
  const applyTransactionsToGame = useCallback(async () => {
    // Не обрабатываем если не авторизованы или уже обрабатываем
    if (!isAuthenticated() || isProcessingRef.current) {
      return;
    }

    isProcessingRef.current = true;

    try {
      /*
       * НЕЗАВЕРШЁННЫЕ ВЫВОДЫ — ПЕРВЫМИ.
       * Сервер уже списал их из сейфа, и до начисления игрок «в минусе».
       * settlePendingWithdrawals начисляет РОВНО ОДИН РАЗ (локальная отметка в
       * vaultBridge) и подтверждает заявку; повторный вызов по уже начисленной
       * заявке только досылает confirm.
       */
      try {
        const settled = await settlePendingWithdrawals();
        if (settled > 0) {
          console.log(`[MarketTransactions] Дочислено выводов из сейфа: ${settled}`);
        }
      } catch (e) {
        console.error('[MarketTransactions] Ошибка обработки выводов из сейфа:', e);
      }

      // Получаем pending транзакции (сервер отдаёт только settlement='client')
      const allTransactions = await fetchPendingTransactions();

      /*
       * Второй рубеж против двойного начисления: строку, рассчитанную в сейфе,
       * клиент применять не должен НИКОГДА. Сервер её и не отдаёт, но одна
       * неверная правка SQL не должна превращаться в удвоение товара.
       */
      const transactions = allTransactions.filter(tx => tx.settlement !== 'vault');
      if (transactions.length !== allTransactions.length) {
        console.warn(
          `[MarketTransactions] Пропущено ${allTransactions.length - transactions.length} транзакций: ` +
            'они уже рассчитаны в сейфе биржи',
        );
      }

      if (transactions.length === 0) {
        return;
      }

      console.log(`[MarketTransactions] Found ${transactions.length} pending transactions`);

      const appliedIds: string[] = [];

      // Применяем все транзакции одним setState для атомарности
      useGameStore.setState(state => {
        let newCredits = state.currency.credits;
        // Работаем с буферами - это источник истины для ресурсов
        let newBuffers = { ...state.grid.buffers };
        if (!newBuffers.base) newBuffers.base = {};
        newBuffers.base = { ...newBuffers.base };

        for (const tx of transactions) {
          try {
            const resourceAmount = parseFloat(tx.resourceAmount);
            const creditsAmount = parseFloat(tx.creditsAmount);
            const resource = tx.resource as ResourceType;

            // Проверяем что ресурс существует
            if (!state.resources[resource]) {
              console.error(`[MarketTransactions] Resource ${resource} not found in state`);
              continue;
            }

            // Получаем текущее значение ресурса из буфера
            const currentAmount = D(newBuffers.base[resource] ?? '0');

            if (tx.transactionType === 'buy') {
              // Покупатель: получает ресурс, отдаёт кредиты
              newCredits = newCredits.sub(D(creditsAmount));
              const newAmount = currentAmount.add(D(resourceAmount));
              newBuffers.base[resource] = newAmount.toString();
              console.log(`[MarketTransactions] Applied BUY: -${creditsAmount}₡, +${resourceAmount} ${resource} (was: ${currentAmount}, now: ${newAmount})`);
            } else {
              // Продавец: отдаёт ресурс, получает кредиты
              newCredits = newCredits.add(D(creditsAmount));
              const newAmount = currentAmount.sub(D(resourceAmount)).max(D(0));
              newBuffers.base[resource] = newAmount.toString();
              console.log(`[MarketTransactions] Applied SELL: +${creditsAmount}₡, -${resourceAmount} ${resource} (was: ${currentAmount}, now: ${newAmount})`);
            }

            appliedIds.push(tx.id);
          } catch (e) {
            console.error(`[MarketTransactions] Error applying transaction ${tx.id}:`, e);
          }
        }

        // Синхронизируем resources с обновлёнными буферами
        const newResources = { ...state.resources };
        for (const r of Object.keys(newResources) as ResourceType[]) {
          const amt = newBuffers.base[r] != null ? D(newBuffers.base[r]!) : D(0);
          newResources[r] = { ...newResources[r], amount: amt.min(newResources[r].max).max(D(0)) };
        }

        return {
          currency: {
            ...state.currency,
            credits: newCredits
          },
          resources: newResources,
          grid: {
            ...state.grid,
            buffers: newBuffers
          }
        };
      });

      // Отмечаем транзакции как примененные на сервере
      if (appliedIds.length > 0) {
        await markTransactionsApplied(appliedIds);
        console.log(`[MarketTransactions] Marked ${appliedIds.length} transactions as applied`);

        // Логируем текущее состояние после применения
        const currentState = useGameStore.getState();
        console.log(`[MarketTransactions] Credits after apply: ${currentState.currency.credits.toString()}`);

        // Сохраняем игру на сервер чтобы изменения не потерялись
        try {
          const saveGame = useGameStore.getState().saveGame;
          if (saveGame) {
            console.log(`[MarketTransactions] Saving game...`);
            await saveGame();
            console.log(`[MarketTransactions] Game saved successfully`);
          } else {
            console.error(`[MarketTransactions] saveGame function not found`);
          }
        } catch (saveError) {
          console.error('[MarketTransactions] Error saving game:', saveError);
        }
      }
    } catch (e) {
      console.error('[MarketTransactions] Error processing transactions:', e);
    } finally {
      isProcessingRef.current = false;
    }
  }, [fetchPendingTransactions, markTransactionsApplied, settlePendingWithdrawals]);

  // Запускаем периодическую проверку
  useEffect(() => {
    // Небольшая задержка перед первой проверкой, чтобы игра успела загрузиться
    const initialTimeout = setTimeout(() => {
      applyTransactionsToGame();
    }, 3000);

    // Устанавливаем интервал
    intervalRef.current = setInterval(applyTransactionsToGame, CHECK_INTERVAL_MS);

    return () => {
      clearTimeout(initialTimeout);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [applyTransactionsToGame]);

  // Возвращаем функцию для ручной проверки
  return {
    checkPendingTransactions: applyTransactionsToGame,
  };
}
