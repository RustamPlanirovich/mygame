/**
 * ПОДКЛЮЧЕНИЕ К SSE-КАНАЛУ И РАЗВОДКА СОБЫТИЙ ПО СТОРАМ (bigplan.md, пункт 24)
 *
 * Один хук на всё приложение: он держит единственное соединение и раскладывает события по
 * назначению. Именно поэтому канал сделан общим — иначе чат, чат гильдии и уведомления о
 * заказах открыли бы по соединению каждый (или, что было бы хуже, по своему setInterval).
 */

import { useEffect, useRef, useState } from 'react';
import { connectServerStream, type MarketOrderPayload } from '../utils/serverStream';
import { useChatStore } from '../features/chatStore';
import { useUiStore } from '../features/uiStore';
import { useGameStore } from '../features/gameStore';
import { useMarketAlertStore } from '../features/marketAlertStore';
import { rememberSaveRevision } from '../features/saveRevision';
import { resourceLabel } from '../core/i18n/label';
import { TRADE_LABEL } from '../core/constants/labels';
import { describeGrant, parseGrantDeltas } from '../core/systems/adminGrant';
import { notify } from '../utils/notifications';
import type { ResourceType, TradeResourceType } from '../core/gameTypes';

export type StreamStatus = 'connecting' | 'open' | 'closed';

/**
 * Минимальный запас ресурса, при котором предложение продать имеет смысл.
 * Ниже этого порога тост был бы шумом: продавать нечего.
 */
const MIN_STOCK_TO_OFFER = 1;

/**
 * Не чаще одной плашки о заказах в этот интервал.
 *
 * Было 20 секунд, и это оказалось слишком грубо: при проверке вдвоём игрок ставит заявки
 * подряд, а видит реакцию только на первую — то есть фича выглядит сломанной. От «стены
 * уведомлений» защищают более точные вещи: плашек на экране максимум три, дубли одной
 * заявки схлопываются (см. features/marketAlertStore.ts). Здесь остаётся только защита
 * от откровенного спама заявками.
 */
const ORDER_TOAST_COOLDOWN_MS = 5_000;

/**
 * Стоит ли показывать тост об этом заказе.
 *
 * Решает КЛИЕНТ, а не сервер: инвентарь игрока лежит в его сейве, сервер его не знает.
 * Правило простое — предложение интересно, если игрок может на него откликнуться:
 *  - кто-то ПОКУПАЕТ ресурс, который у игрока есть на складе -> можно продать;
 *  - кто-то ПРОДАЁТ ресурс -> просто информируем, но только если игрок этим ресурсом
 *    вообще занимается (он есть у него на складе), иначе это шум.
 */
export function shouldNotifyAboutOrder(
  order: MarketOrderPayload,
  stock: (resource: ResourceType) => number,
): boolean {
  const have = stock(order.resource as ResourceType);
  if (!Number.isFinite(have) || have < MIN_STOCK_TO_OFFER) return false;
  // Покупателю интереснее: у него можно сразу продать излишек.
  return order.type === 'buy';
}

export function useServerStream(): StreamStatus {
  const [status, setStatus] = useState<StreamStatus>('connecting');
  const lastOrderToastAtRef = useRef(0);

  useEffect(() => {
    const connection = connectServerStream(
      (event) => {
        switch (event.type) {
          case 'stream.ready':
            // Ничего делать не нужно: сервер лишь подтвердил, что канал живой.
            break;

          case 'chat.message': {
            // Панель чата открыта? Тогда не растим счётчик непрочитанных.
            const isChatOpen = useUiStore.getState().section === 'chat';
            useChatStore.getState().receive(event.payload, isChatOpen);
            break;
          }

          case 'admin.grant.pending': {
            /*
             * Администратор начислил ресурсы игроку, который сейчас в игре (bigplan.md, пункт 9).
             * Само начисление лежит в очереди на сервере — здесь только повод её забрать.
             * Уведомление и применение делает drainPendingGrants: если это событие не дойдёт,
             * всё то же самое произойдёт при следующей загрузке.
             */
            void useGameStore.getState().drainPendingGrants();
            break;
          }

          case 'admin.grant.applied': {
            /*
             * Администратор выдал ресурсы (bigplan.md, пункт 9). Сервер уже записал патч
             * в сохранение; прибавляем ту же дельту к состоянию в памяти, иначе автосохранение
             * перезапишет патч — ровно это и означало «при выдаче ресурсы не сохраняются».
             */
            const parsed = parseGrantDeltas(event.payload.deltas);
            const applied = useGameStore
              .getState()
              .applyAdminGrant(event.payload.grantId, event.payload.deltas);
            if (!applied) break;

            /*
             * Дельта учтена — значит наше состояние снова соответствует записи в БД.
             * Двигаем известную версию (bigplan.md, пункт 30.3), иначе ближайшее
             * автосохранение упёрлось бы в 409 из-за изменения, которое мы уже применили.
             */
            rememberSaveRevision(event.payload.saveId, event.payload.revision);

            const summary = describeGrant(parsed, resourceLabel);
            notify.success(
              summary ? `Администратор начислил: ${summary}` : 'Администратор изменил ваши ресурсы',
              8000,
            );
            if (event.payload.clamped?.length > 0) {
              notify.warning(
                `Часть не поместилась на склад: ${event.payload.clamped
                  .map((r) => resourceLabel(r))
                  .join(', ')}`,
                8000,
              );
            }
            break;
          }

          case 'market.order.created': {
            /*
             * Кто-то выставил заявку на материал (bigplan.md, пункт 17). Показываем плашку
             * «проверьте, не продать ли ему» — кликабельную, она ведёт прямо в раздел биржи
             * (см. components/game/MarketOfferToast.tsx).
             */
            const now = Date.now();
            if (now - lastOrderToastAtRef.current < ORDER_TOAST_COOLDOWN_MS) break;

            const resources = useGameStore.getState().resources;
            const stock = (resource: ResourceType) => resources[resource]?.amount.toNumber() ?? 0;
            if (!shouldNotifyAboutOrder(event.payload, stock)) break;

            /*
             * Ресурс приходит строкой. Сервер его валидирует, но плашка ведёт в форму биржи,
             * где тип обязан быть торгуемым: неизвестный id выбрал бы в селекте пустоту.
             */
            const resource = event.payload.resource;
            if (!Object.prototype.hasOwnProperty.call(TRADE_LABEL, resource)) break;

            lastOrderToastAtRef.current = now;
            useMarketAlertStore.getState().push({
              id: event.payload.id,
              playerName: event.payload.playerName,
              resource: resource as TradeResourceType,
              // Остатка нет только если сервер старее клиента — тогда берём исходный объём.
              quantity: event.payload.quantityRemaining ?? event.payload.quantity,
              pricePerUnit: event.payload.pricePerUnit,
              stock: stock(resource as ResourceType),
            });
            break;
          }
        }
      },
      setStatus,
    );

    return () => connection.close();
  }, []);

  return status;
}
