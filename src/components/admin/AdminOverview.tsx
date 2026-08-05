/**
 * Обзор: сводка по игрокам, экономике, кредитам, AI-оракулу и базе данных.
 * Данные приходят одним запросом GET /api/admin/overview.
 */

import {
  Activity,
  Coins,
  Database,
  Handshake,
  RefreshCw,
  Sparkles,
  Users,
} from 'lucide-react';
import { Alert, Badge, EmptyState, Meter, Panel, Skeleton, SkeletonRows, Stat } from '../ui';
import { useAdminActions, useAdminStore } from '../../features/adminStore';
import {
  formatAmount,
  formatBytes,
  formatDuration,
  formatFull,
  formatInt,
  formatWhen,
} from '../../utils/adminFormat';
import { Num } from './parts';

function OracleRow({
  dataType,
  fresh,
  ageSeconds,
  expiresAt,
  requestCount,
}: {
  dataType: string;
  fresh: boolean;
  ageSeconds: number;
  expiresAt: string | null;
  requestCount: number;
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-edge-subtle py-1.5 last:border-0">
      <div className="min-w-0">
        <p className="truncate text-xs text-content-secondary">{dataType}</p>
        <p className="text-3xs text-content-faint">
          возраст <Num>{formatDuration(ageSeconds)}</Num> · запросов{' '}
          <Num>{formatInt(requestCount)}</Num>
        </p>
      </div>
      <span title={expiresAt ? `истекает: ${formatFull(expiresAt)}` : 'срок не задан'}>
        <Badge tone={fresh ? 'accent' : 'warning'}>{fresh ? 'свежий' : 'устарел'}</Badge>
      </span>
    </div>
  );
}

export function AdminOverview() {
  const overview = useAdminStore((s) => s.overview);
  const meta = useAdminStore((s) => s.overviewMeta);
  const actions = useAdminActions();

  if (meta.error) {
    return (
      <div className="space-y-3">
        <Alert tone="danger" title="Не удалось загрузить сводку">
          {meta.error}
        </Alert>
        <button type="button" className="btn" onClick={() => void actions.loadOverview(true)}>
          <RefreshCw size={14} aria-hidden="true" />
          Повторить
        </button>
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {['Игроки', 'Экономика', 'Кредиты P2P', 'AI-оракул', 'База данных'].map((title) => (
          <Panel key={title} title={title}>
            <SkeletonRows rows={5} />
          </Panel>
        ))}
      </div>
    );
  }

  const { players, content, market, p2p, aiOracle, database } = overview;
  const largestTableBytes = database.largestTables[0]?.totalBytes ?? 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-2xs text-content-faint">
          Сводка на{' '}
          <span title={formatFull(overview.generatedAt)} className="font-mono tabular-nums">
            {formatWhen(overview.generatedAt)}
          </span>
        </p>
        <button
          type="button"
          className="btn btn-xs"
          onClick={() => void actions.loadOverview(true)}
          disabled={meta.loading}
        >
          <RefreshCw size={12} className={meta.loading ? 'animate-spin' : ''} aria-hidden="true" />
          Обновить
        </button>
      </div>

      {meta.loading && <Skeleton className="h-0.5 w-full" />}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {/* ----------------------------------------------------------- Игроки */}
        <Panel title="Игроки" icon={<Users size={14} />} subtitle="аккаунты и активность">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Всего" value={formatInt(players.total)} />
            <Stat
              label="В сети"
              value={formatInt(players.onlineNow)}
              tone={players.onlineNow > 0 ? 'accent' : 'neutral'}
              hint="активность за 5 минут"
            />
            <Stat label="Сегодня" value={formatInt(players.registeredToday)} hint="регистраций" />
            <Stat label="За 7 дней" value={formatInt(players.registered7d)} hint="регистраций" />
            <Stat
              label="Заблокировано"
              value={formatInt(players.banned)}
              tone={players.banned > 0 ? 'danger' : 'neutral'}
            />
            <Stat label="Сессий активно" value={formatInt(players.activeSessions)} />
            <Stat label="Администраторы" value={formatInt(players.admins)} tone="danger" />
            <Stat label="Модераторы" value={formatInt(players.moderators)} tone="info" />
            <Stat
              label="Всего в игре"
              value={formatDuration(players.totalPlayTimeSeconds)}
              hint={`${formatInt(players.totalPlayTimeSeconds)} с`}
            />
          </div>

          <div className="divider" />

          <div className="grid grid-cols-2 gap-3">
            <Stat label="Слоты" value={formatInt(content.slots)} />
            <Stat label="Сохранения" value={formatInt(content.saves)} />
            <Stat label="Гильдии" value={formatInt(content.guilds)} />
            <Stat label="Участники гильдий" value={formatInt(content.guildMembers)} />
            <Stat
              label="Объявления"
              value={formatInt(content.activeAnnouncements)}
              hint="активных"
            />
            <Stat label="Журнал 24 ч" value={formatInt(content.auditEntries24h)} hint="записей" />
          </div>
        </Panel>

        {/* -------------------------------------------------------- Экономика */}
        <Panel title="Экономика" icon={<Coins size={14} />} subtitle="биржа за 24 часа">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Открытых ордеров" value={formatInt(market.openOrders)} tone="info" />
            <Stat label="Всего ордеров" value={formatInt(market.totalOrders)} />
            <Stat label="Сделок 24 ч" value={formatInt(market.trades24h)} />
            <Stat label="Трейдеров 24 ч" value={formatInt(market.distinctTraders24h)} />
            <Stat
              label="Оборот 24 ч"
              value={formatAmount(market.volume24h)}
              hint={market.volume24h}
              tone="accent"
            />
            <Stat label="Комиссии 24 ч" value={formatAmount(market.fees24h)} hint={market.fees24h} />
            <Stat label="Трейдеров всего" value={formatInt(market.registeredTraders)} />
          </div>

          <div className="divider" />

          <p className="stat-label mb-1">Топ по обороту</p>
          {market.topTraders.length === 0 ? (
            <EmptyState title="Сделок пока не было" hint="Топ появится после первых торгов." />
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Игрок</th>
                    <th scope="col" className="text-right">
                      Оборот
                    </th>
                    <th scope="col" className="text-right">
                      Сделки
                    </th>
                    <th scope="col" className="text-right">
                      Рейтинг
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {market.topTraders.map((trader) => (
                    <tr key={trader.playerId}>
                      <td className="max-w-[10rem] truncate" title={trader.email ?? undefined}>
                        {trader.playerName ?? trader.email ?? `#${trader.playerId}`}
                      </td>
                      <td className="text-right">
                        <Num title={trader.totalVolume}>{formatAmount(trader.totalVolume)}</Num>
                      </td>
                      <td className="text-right">
                        <Num>
                          {formatInt(trader.successfulTrades)}/{formatInt(trader.totalTrades)}
                        </Num>
                      </td>
                      <td className="text-right">
                        <Num>{formatAmount(trader.rating)}</Num>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        {/* ------------------------------------------------------ Кредиты P2P */}
        <Panel title="Кредиты P2P" icon={<Handshake size={14} />} subtitle="займы между игроками">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Активных" value={formatInt(p2p.activeLoans)} tone="info" />
            <Stat label="Всего выдано" value={formatInt(p2p.totalLoans)} />
            <Stat
              label="Тело долга"
              value={formatAmount(p2p.outstandingPrincipal)}
              hint={p2p.outstandingPrincipal}
              tone="accent"
            />
            <Stat label="Открытых предложений" value={formatInt(p2p.openOffers)} />
            <Stat
              label="Просрочено"
              value={formatInt(p2p.overdueLoans)}
              tone={p2p.overdueLoans > 0 ? 'warning' : 'neutral'}
            />
            <Stat
              label="Дефолтов"
              value={formatInt(p2p.defaultedLoans)}
              tone={p2p.defaultedLoans > 0 ? 'danger' : 'neutral'}
            />
          </div>
        </Panel>

        {/* -------------------------------------------------------- AI-оракул */}
        <Panel
          title="AI-оракул"
          icon={<Sparkles size={14} />}
          subtitle="наборы прогнозов и их свежесть"
        >
          {aiOracle.length === 0 ? (
            <EmptyState
              title="Данных оракула нет"
              hint="Запустите обновление на вкладке «Обслуживание»."
              icon={<Sparkles size={22} />}
            />
          ) : (
            <div>
              {aiOracle.map((entry) => (
                <OracleRow key={entry.dataType} {...entry} />
              ))}
            </div>
          )}
        </Panel>

        {/* ------------------------------------------------------ База данных */}
        <Panel
          title="База данных"
          icon={<Database size={14} />}
          subtitle={`общий размер ${database.sizePretty}`}
          className="xl:col-span-2"
        >
          <div className="mb-3 grid grid-cols-2 gap-3">
            <Stat
              label="Размер БД"
              value={formatBytes(database.sizeBytes)}
              hint={`${formatInt(database.sizeBytes)} Б`}
            />
            <Stat label="Таблиц в списке" value={formatInt(database.largestTables.length)} />
          </div>

          {database.largestTables.length === 0 ? (
            <EmptyState title="Нет данных о таблицах" icon={<Activity size={22} />} />
          ) : (
            <ul className="space-y-2">
              {database.largestTables.map((table) => (
                <li key={table.table} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-xs text-content-secondary">{table.table}</span>
                    <span className="shrink-0 font-mono text-2xs tabular-nums text-content-faint">
                      {formatBytes(table.totalBytes)} · ≈{formatInt(table.approxRows)} строк
                    </span>
                  </div>
                  <Meter
                    value={table.totalBytes}
                    max={largestTableBytes || 1}
                    tone={table.totalBytes === largestTableBytes ? 'accent' : 'info'}
                  />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
