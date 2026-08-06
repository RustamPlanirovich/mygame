/**
 * ПЕРЕХОД «ОТКУДА УГОДНО» В РАЗДЕЛ БИРЖИ (bigplan.md, пункт 17)
 *
 * Биржа спрятана на два уровня вглубь: раздел «Рынок» -> вкладка «Глобальная» -> вкладка
 * «Биржа» внутри неё. Клик по плашке «кто-то покупает ваш материал» должен приводить игрока
 * сразу туда, иначе предложение бесполезно: пока он ищет нужную вкладку, заявку разберут.
 *
 * Функция лежит отдельным модулем, потому что связывает ДВА стора (uiStore — оболочка
 * интерфейса, marketStore — данные биржи). Класть её в любой из них значило бы завести
 * между ними импорт ради одной кнопки.
 */

import { useUiStore } from './uiStore';
import { useMarketStore } from './marketStore';
import type { TradeResourceType } from '../core/gameTypes.market';

export interface MarketFocus {
  /** Ресурс, на который навести книгу ордеров и форму. */
  resource?: TradeResourceType;
  /** Цена покупателя: подставляем в форму, чтобы продажа сматчилась сразу. */
  price?: string;
  /** Что игрок собирается сделать. По умолчанию — продать (плашка про это и есть). */
  side?: 'buy' | 'sell';
}

/**
 * Открыть глобальную биржу, при необходимости — сразу на нужном ресурсе.
 *
 * Форму заполняем осознанно, а не «на всякий случай»: игрок пришёл сюда по конкретному
 * предложению, и заново выбирать тот же ресурс и переписывать ту же цену — лишняя работа.
 */
export function openGlobalMarket(focus: MarketFocus = {}): void {
  const ui = useUiStore.getState();
  ui.open('market');
  ui.setMarketTab('global');

  const market = useMarketStore.getState();
  market.setActiveTab('orders');

  if (!focus.resource) return;

  market.setOrderFormType(focus.side ?? 'sell');
  market.setOrderFormResource(focus.resource);
  if (focus.price) market.setOrderFormPrice(focus.price);
  // Ставим последним: сеттер сам дёргает загрузку книги ордеров по этому ресурсу.
  market.setSelectedResource(focus.resource);
}
