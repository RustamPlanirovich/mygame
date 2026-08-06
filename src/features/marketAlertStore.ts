/**
 * ОЧЕРЕДЬ ПЛАШЕК «КТО-ТО ПОКУПАЕТ — ПРОВЕРЬТЕ, НЕ ПРОДАТЬ ЛИ» (bigplan.md, пункты 17, 24)
 *
 * Отдельный стор, а не общий `utils/notifications`: обычный тост — это строка с крестиком,
 * а здесь нужна кликабельная карточка с ресурсом, ценой, остатком на складе и переходом
 * на биржу. Смешивать это с текстовыми уведомлениями значило бы тащить в них произвольный
 * JSX и обработчики кликов ради одного случая.
 *
 * Событие приходит из SSE-потока (см. hooks/useServerStream.ts), решение «показывать ли» —
 * тоже там: инвентарь игрока лежит в его сейве, и сервер его не знает.
 */

import { create } from 'zustand';
import type { TradeResourceType } from '../core/gameTypes.market';

/** Предложение продать: чья заявка, что и почём покупают, сколько у нас есть. */
export interface MarketOfferAlert {
  /** id ордера — он же ключ дедупликации: одна заявка = максимум одна плашка. */
  id: string;
  playerName: string;
  resource: TradeResourceType;
  /** Сколько ещё нужно покупателю (остаток заявки). */
  quantity: string;
  pricePerUnit: string;
  /** Запас на складе на момент показа — то, что игрок может предложить. */
  stock: number;
  /** Когда плашка появилась: по ней же считается автозакрытие. */
  shownAt: number;
}

/**
 * Сколько плашек держим на экране одновременно.
 * Больше трёх — это уже стена, перекрывающая карту; старые вытесняются новыми.
 */
export const MAX_VISIBLE_ALERTS = 3;

/** Через сколько плашка уходит сама. Дольше обычного тоста: это предложение к действию. */
export const ALERT_TTL_MS = 25_000;

/**
 * Чистое добавление в очередь: дедупликация по id заявки + ограничение длины.
 *
 * Вынесено из стора, чтобы правило проверялось тестом, а не глазами: повтор одной и той же
 * заявки (переподключение потока, две вкладки) не должен плодить плашки.
 */
export function enqueueAlert(
  list: MarketOfferAlert[],
  alert: MarketOfferAlert,
  max = MAX_VISIBLE_ALERTS,
): MarketOfferAlert[] {
  // Повтор той же заявки — обновляем на месте, порядок не трогаем: иначе плашка «прыгала» бы.
  const existing = list.findIndex((a) => a.id === alert.id);
  if (existing !== -1) {
    const next = [...list];
    next[existing] = { ...alert, shownAt: list[existing].shownAt };
    return next;
  }
  // Новые снизу; при переполнении уходит самая старая (сверху).
  return [...list, alert].slice(-max);
}

interface MarketAlertState {
  alerts: MarketOfferAlert[];
  /** Показать предложение. Время показа проставляется здесь, а не вызывающим кодом. */
  push: (alert: Omit<MarketOfferAlert, 'shownAt'>) => void;
  dismiss: (id: string) => void;
  clear: () => void;
}

export const useMarketAlertStore = create<MarketAlertState>((set, get) => ({
  alerts: [],

  push: (alert) => {
    const shownAt = Date.now();
    set((state) => ({ alerts: enqueueAlert(state.alerts, { ...alert, shownAt }) }));

    /*
     * Автозакрытие таймером в сторе, как в utils/notifications: компонент может быть
     * размонтирован (мобильная раскладка прячет оверлеи), и плашка тогда осталась бы
     * в состоянии навсегда, всплыв при следующем монтировании.
     */
    setTimeout(() => {
      const current = get().alerts.find((a) => a.id === alert.id);
      // Если плашку успели заменить более свежей копией — её таймер закроет её сам.
      if (current && current.shownAt === shownAt) get().dismiss(alert.id);
    }, ALERT_TTL_MS);
  },

  dismiss: (id) =>
    set((state) => {
      const alerts = state.alerts.filter((a) => a.id !== id);
      // Не будим подписчиков, если ничего не изменилось (таймер по уже закрытой плашке).
      return alerts.length === state.alerts.length ? state : { alerts };
    }),

  clear: () => set((state) => (state.alerts.length === 0 ? state : { alerts: [] })),
}));
