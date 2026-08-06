/**
 * ПЛАШКА «КТО-ТО ПОКУПАЕТ ВАШ МАТЕРИАЛ» (bigplan.md, пункты 17, 24)
 *
 * Другой игрок выставил на бирже заявку на покупку материала, который у нас есть на складе.
 * Плашка предлагает проверить, не продать ли ему, и по клику ведёт прямо в раздел биржи —
 * на нужный ресурс и с уже заполненной формой продажи.
 *
 * ПОЧЕМУ ОТДЕЛЬНЫЙ ОВЕРЛЕЙ, А НЕ NotificationToast
 * Обычные тосты — это строка с крестиком в правом верхнем углу, и там уже тесно: их делят
 * NotificationToast и EventNotificationToast. Здесь нужна кликабельная карточка с цифрами
 * (сколько покупают, почём, сколько есть у нас) и явным призывом к действию, поэтому она
 * живёт в правом нижнем углу и не конкурирует с ними за место.
 */

import { ShoppingCart, ArrowRight, X } from 'lucide-react';
import { useMarketAlertStore } from '../../features/marketAlertStore';
import { openGlobalMarket } from '../../features/marketNavigation';
import { tradeResourceLabel } from '../../core/i18n/label';
import { formatNumber } from '../../core/math/format';
import { formatAmount } from '../../features/marketEscrow';
import { GameIcon } from '../ui/icons';

export function MarketOfferToast() {
  const alerts = useMarketAlertStore((s) => s.alerts);
  const dismiss = useMarketAlertStore((s) => s.dismiss);

  if (alerts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[190] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className="pointer-events-auto animate-slide-in-right rounded-lg border border-cyber-green/60 bg-cyber-dark/95 shadow-elev-3"
        >
          {/*
           * Кликабельна вся карточка, а не только кнопка: задача — «если игрок кликает,
           * переходит в раздел Биржа», и промахиваться мимо маленькой ссылки он не должен.
           * Крестик закрытия лежит рядом (не внутри), иначе клик по нему тоже открывал бы
           * биржу — вложенные интерактивные элементы так и ведут себя.
           */}
          <div className="flex items-start gap-2 p-3">
            <button
              type="button"
              onClick={() => {
                openGlobalMarket({
                  resource: alert.resource,
                  price: alert.pricePerUnit,
                  side: 'sell',
                });
                dismiss(alert.id);
              }}
              className="flex flex-1 flex-col items-start gap-1.5 text-left"
            >
              <div className="flex items-center gap-2 text-cyber-green">
                <ShoppingCart className="h-4 w-4 shrink-0" />
                <span className="text-xs font-semibold uppercase tracking-wider">
                  Заявка на бирже
                </span>
              </div>

              <p className="text-sm text-cyber-text">
                <span className="font-semibold text-cyber-blue">{alert.playerName}</span>
                {' покупает '}
                <span className="font-semibold text-white">
                  <GameIcon icon="📦" /> {tradeResourceLabel(alert.resource)}
                </span>
                {' — '}
                <span className="font-mono tabular-nums text-white">
                  {formatAmount(alert.quantity)}
                </span>
                {' по '}
                <span className="font-mono tabular-nums text-cyber-green">
                  {formatAmount(alert.pricePerUnit)} ₡
                </span>
                {' за шт.'}
              </p>

              <p className="text-xs text-cyber-text-dim">
                У вас на складе:{' '}
                <span className="font-mono tabular-nums text-cyber-text">
                  {formatNumber(alert.stock)}
                </span>
                {' — можно продать.'}
              </p>

              <span className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-cyber-green">
                Открыть биржу
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </button>

            <button
              type="button"
              onClick={() => dismiss(alert.id)}
              aria-label="Закрыть"
              className="shrink-0 text-cyber-gray-light transition-colors hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
