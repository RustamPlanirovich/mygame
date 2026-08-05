/**
 * Список игроков: поиск с задержкой, фильтр состояния, сортируемые заголовки,
 * пагинация. Клик по строке открывает карточку игрока.
 */

import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, RefreshCw, Search, StickyNote, Users } from 'lucide-react';
import { Alert, Badge, EmptyState, Skeleton } from '../ui';
import { useAdminActions, useAdminStore } from '../../features/adminStore';
import type { PlayerSortField, PlayerStatusFilter } from '../../utils/adminApi';
import { formatAmount, formatDuration, formatInt } from '../../utils/adminFormat';
import { BanBadge, Num, OnlineDot, Pagination, RoleBadge, When } from './parts';

const STATUS_OPTIONS: ReadonlyArray<{ value: PlayerStatusFilter; label: string }> = [
  { value: 'all', label: 'Все' },
  { value: 'online', label: 'В сети' },
  { value: 'banned', label: 'Заблокированные' },
  { value: 'staff', label: 'Персонал' },
];

const PAGE_SIZES = [25, 50, 100, 200] as const;

const COLUMNS: ReadonlyArray<{
  key: string;
  label: string;
  sort?: PlayerSortField;
  align?: 'right';
}> = [
  { key: 'online', label: 'Сеть' },
  { key: 'email', label: 'E-mail', sort: 'email' },
  { key: 'role', label: 'Роль' },
  { key: 'state', label: 'Состояние' },
  { key: 'created', label: 'Регистрация', sort: 'created_at' },
  { key: 'seen', label: 'Последний вход', sort: 'last_seen_at' },
  { key: 'play', label: 'В игре', sort: 'play_time', align: 'right' },
  { key: 'volume', label: 'Оборот', sort: 'total_volume', align: 'right' },
  { key: 'sessions', label: 'Сессии', align: 'right' },
  { key: 'orders', label: 'Ордера', align: 'right' },
  { key: 'guild', label: 'Гильдия' },
];

export function AdminPlayers({ viewerId = null }: { viewerId?: number | null }) {
  const players = useAdminStore((s) => s.players);
  const total = useAdminStore((s) => s.playersTotal);
  const query = useAdminStore((s) => s.playersQuery);
  const meta = useAdminStore((s) => s.playersMeta);
  const selectedId = useAdminStore((s) => s.selectedPlayerId);
  const actions = useAdminActions();

  // Поле поиска — локальное состояние: ввод не должен ждать сервер, а сам input
  // остаётся смонтированным, поэтому фокус и каретка не теряются между рендерами.
  const [searchInput, setSearchInput] = useState(query.search);

  useEffect(() => {
    if (searchInput === query.search) return;
    const timer = window.setTimeout(() => {
      actions.setPlayersQuery({ search: searchInput });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput, query.search, actions]);

  const showSkeleton = meta.loading && players.length === 0;
  const showEmpty = !meta.loading && !meta.error && players.length === 0;

  return (
    <div className="flex min-h-0 flex-col gap-3">
      {/* ------------------------------------------------------------ фильтры */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search
            size={14}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-content-faint"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Поиск по e-mail"
            aria-label="Поиск игрока по e-mail"
            data-autofocus
            className="w-full rounded-md py-1.5 pl-8 pr-2 text-xs"
          />
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-2xs font-medium uppercase tracking-wider text-content-faint">
            Состояние
          </span>
          <select
            value={query.status}
            onChange={(e) =>
              actions.setPlayersQuery({ status: e.target.value as PlayerStatusFilter })
            }
            className="rounded-md px-2 py-1.5 text-xs"
            aria-label="Фильтр по состоянию"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-2xs font-medium uppercase tracking-wider text-content-faint">
            На странице
          </span>
          <select
            value={query.limit}
            onChange={(e) => actions.setPlayersQuery({ limit: Number(e.target.value) })}
            className="rounded-md px-2 py-1.5 text-xs"
            aria-label="Размер страницы"
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className="icon-btn"
          onClick={() => void actions.loadPlayers(true)}
          disabled={meta.loading}
          aria-label="Обновить список игроков"
          title="Обновить список игроков"
        >
          <RefreshCw size={16} className={meta.loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {meta.error && (
        <Alert tone="danger" title="Не удалось загрузить список">
          {meta.error}
        </Alert>
      )}

      {/* -------------------------------------------------------------- таблица */}
      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-edge bg-surface-2">
        <table className="data-table">
          <thead>
            <tr>
              {COLUMNS.map((column) => {
                const active = column.sort !== undefined && query.sort === column.sort;
                const ariaSort = active
                  ? query.order === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : undefined;
                return (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={ariaSort}
                    className={column.align === 'right' ? 'text-right' : undefined}
                  >
                    {column.sort ? (
                      <button
                        type="button"
                        onClick={() => actions.toggleSort(column.sort as PlayerSortField)}
                        className={`inline-flex items-center gap-1 uppercase tracking-wider transition-colors hover:text-content-primary ${
                          active ? 'text-accent' : ''
                        }`}
                        title={`Сортировать по «${column.label}»`}
                      >
                        {column.label}
                        {active &&
                          (query.order === 'asc' ? (
                            <ArrowUp size={10} aria-hidden="true" />
                          ) : (
                            <ArrowDown size={10} aria-hidden="true" />
                          ))}
                      </button>
                    ) : (
                      column.label
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {showSkeleton &&
              Array.from({ length: 8 }, (_, index) => (
                <tr key={`skeleton-${index}`}>
                  {COLUMNS.map((column) => (
                    <td key={column.key}>
                      <Skeleton className="h-4 w-full" />
                    </td>
                  ))}
                </tr>
              ))}

            {players.map((player) => {
              const selected = player.id === selectedId;
              return (
                <tr
                  key={player.id}
                  tabIndex={0}
                  aria-selected={selected}
                  onClick={() => actions.selectPlayer(player.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      actions.selectPlayer(player.id);
                    }
                  }}
                  title={`Открыть карточку ${player.email}`}
                  className={`cursor-pointer ${selected ? 'bg-accent/10' : ''}`}
                >
                  <td>
                    <OnlineDot online={player.online} lastActivityAt={player.lastActivityAt} />
                  </td>
                  <td className="max-w-[16rem]">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-content-primary" title={player.email}>
                        {player.email}
                      </span>
                      {/* Свой аккаунт: часть действий над ним ударит по самому оператору. */}
                      {viewerId !== null && player.id === viewerId && (
                        <Badge tone="warning" className="shrink-0">
                          это вы
                        </Badge>
                      )}
                      {player.notes && (
                        <span
                          className="shrink-0 text-warning"
                          role="img"
                          aria-label="Есть заметка"
                          title={player.notes}
                        >
                          <StickyNote size={11} />
                        </span>
                      )}
                    </span>
                    <span className="block font-mono text-3xs tabular-nums text-content-faint">
                      #{player.id}
                    </span>
                  </td>
                  <td>
                    <RoleBadge role={player.role} />
                  </td>
                  <td>
                    <BanBadge
                      isBanned={player.isBanned}
                      banPermanent={player.banPermanent}
                      bannedUntil={player.bannedUntil}
                    />
                  </td>
                  <td>
                    <When value={player.createdAt} />
                  </td>
                  <td>
                    <When value={player.lastSeenAt} />
                  </td>
                  <td className="text-right">
                    <Num title={`${player.playTimeSeconds} с`}>
                      {formatDuration(player.playTimeSeconds)}
                    </Num>
                  </td>
                  <td className="text-right">
                    <Num title={player.totalVolume}>{formatAmount(player.totalVolume)}</Num>
                  </td>
                  <td className="text-right">
                    <Num title={`слотов: ${player.slotCount}, сохранений: ${player.saveCount}`}>
                      {formatInt(player.sessionCount)}
                    </Num>
                  </td>
                  <td className="text-right">
                    <Num>{formatInt(player.openOrderCount)}</Num>
                  </td>
                  <td className="max-w-[10rem]">
                    {player.guild ? (
                      <span className="truncate text-content-muted" title={player.guild.name ?? ''}>
                        [{player.guild.tag}] {player.guild.name}
                      </span>
                    ) : (
                      <span className="text-content-faint">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {showEmpty && (
          <div className="p-4">
            <EmptyState
              title="Игроки не найдены"
              hint={
                query.search || query.status !== 'all'
                  ? 'Попробуйте изменить поиск или фильтр состояния.'
                  : 'В базе нет ни одного аккаунта.'
              }
              icon={<Users size={22} />}
            />
          </div>
        )}
      </div>

      <Pagination
        offset={query.offset}
        limit={query.limit}
        total={total}
        onChange={(offset) => actions.setPlayersPage(offset)}
        busy={meta.loading}
        label="игроков"
      />
    </div>
  );
}
