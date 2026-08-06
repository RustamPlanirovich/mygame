/**
 * Главная панель глобальной биржи.
 *
 * Здесь же собраны две новые вкладки: «Кошелёк биржи» (сейф — единственная дверь
 * между игрой и биржей) и «Сделки с игроками» (прямые предложения). Без сейфа
 * остальные вкладки бессмысленны: продать можно только внесённое.
 */

import { useEffect } from 'react';
import { useMarketStore } from '../../../features/marketStore';
import { Alert, Tabs } from '../../ui';
import type { TabItem } from '../../ui';
import { OrderBook } from './OrderBook';
import { OrderForm } from './OrderForm';
import { MyOrders } from './MyOrders';
import { TradeHistory } from './TradeHistory';
import { PriceList } from './PriceList';
import { TraderLeaderboard } from './TraderLeaderboard';
import { GuildPanel } from './GuildPanel';
import { VaultPanel } from './VaultPanel';
import { DirectOffers } from './DirectOffers';
import { GameIcon } from '../../ui/icons';

type MarketTab = ReturnType<typeof useMarketStore.getState>['activeTab'];

const PRIMARY_TABS: TabItem<MarketTab>[] = [
  { id: 'orders', label: '📊 Биржа' },
  { id: 'vault', label: '🔐 Кошелёк' },
  { id: 'offers', label: '🤝 Сделки' },
  { id: 'myOrders', label: '📋 Ордера' },
  { id: 'history', label: '📜 История' },
];

const SECONDARY_TABS: TabItem<MarketTab>[] = [
  { id: 'prices', label: '💹 Цены' },
  { id: 'leaderboard', label: '🏆 Лидеры' },
  { id: 'guild', label: '🏰 Гильдия' },
];

export function GlobalMarketPanel() {
  /*
   * Узкие селекторы. Раньше стор разбирался целиком, одним вызовом хука без
   * селектора: любая загрузка цен, книги ордеров, чата гильдии или журнала
   * сейфа перерисовывала панель вместе со всеми вкладками.
   */
  const activeTab = useMarketStore((s) => s.activeTab);
  const setActiveTab = useMarketStore((s) => s.setActiveTab);
  const isLoading = useMarketStore((s) => s.isLoading);
  const error = useMarketStore((s) => s.error);
  const clearError = useMarketStore((s) => s.clearError);
  const fetchPrices = useMarketStore((s) => s.fetchPrices);
  const fetchMyGuild = useMarketStore((s) => s.fetchMyGuild);
  const fetchVault = useMarketStore((s) => s.fetchVault);
  const fetchMyFeePercent = useMarketStore((s) => s.fetchMyFeePercent);

  const pendingWithdrawalCount = useMarketStore((s) => s.pendingWithdrawals.length);
  const openIncomingCount = useMarketStore(
    (s) => s.offersIncoming.filter((o) => o.status === 'open').length,
  );

  useEffect(() => {
    fetchPrices();
    fetchMyGuild();
    // Сейф и ставка комиссии нужны формам сразу: без них нельзя посчитать,
    // хватает ли покрытия, и кнопка «Купить» вводила бы в заблуждение.
    fetchVault();
    fetchMyFeePercent();
  }, [fetchPrices, fetchMyGuild, fetchVault, fetchMyFeePercent]);

  const primary: TabItem<MarketTab>[] = PRIMARY_TABS.map((tab) => {
    if (tab.id === 'vault' && pendingWithdrawalCount > 0) {
      return { ...tab, badge: pendingWithdrawalCount };
    }
    if (tab.id === 'offers' && openIncomingCount > 0) {
      return { ...tab, badge: openIncomingCount };
    }
    return tab;
  });

  return (
    <div className="relative flex h-full flex-col bg-surface-base text-content-primary">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-edge px-3 py-2">
        <h2 className="flex min-w-0 items-center gap-1.5 text-sm font-semibold">
          <span className="shrink-0"><GameIcon icon="🌐" /></span>
          <span className="truncate">Глобальная биржа</span>
        </h2>
        <span className="shrink-0 text-2xs text-content-faint">Торгуйте с другими</span>
      </div>

      <div className="shrink-0 space-y-1 px-2 pt-2">
        <Tabs items={primary} value={activeTab} onChange={setActiveTab} size="sm" />
        <Tabs items={SECONDARY_TABS} value={activeTab} onChange={setActiveTab} size="sm" />
      </div>

      {error && (
        <div className="shrink-0 px-2 pt-2">
          <Alert tone="danger" onDismiss={clearError}>
            {error}
          </Alert>
        </div>
      )}

      {isLoading && <div className="absolute left-0 right-0 top-0 h-0.5 animate-pulse bg-accent" />}

      <div className="min-h-0 flex-1 overflow-auto p-2">
        {/*
          Форма и книга ордеров — строго в столбик. Раньше на десктопе включался
          `md:grid-cols-2`, но панель-то шириной ~400px независимо от окна: обе
          колонки сжимались до 190px, и подписи полей налезали друг на друга.
        */}
        {activeTab === 'orders' && (
          <div className="space-y-2">
            <OrderForm />
            <OrderBook />
            <PriceList compact />
          </div>
        )}

        {activeTab === 'vault' && <VaultPanel />}
        {activeTab === 'offers' && <DirectOffers />}
        {activeTab === 'myOrders' && <MyOrders />}
        {activeTab === 'history' && <TradeHistory />}
        {activeTab === 'prices' && <PriceList />}
        {activeTab === 'leaderboard' && <TraderLeaderboard />}
        {activeTab === 'guild' && <GuildPanel />}
      </div>
    </div>
  );
}
