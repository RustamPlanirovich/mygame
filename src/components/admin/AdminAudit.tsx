/**
 * Журнал действий администраторов: фильтры по действию, администратору и цели.
 * Сервер сортирует по времени убыванию и уже вычищает секреты из details.
 */

import { History, RefreshCw } from 'lucide-react';
import { Alert, EmptyState, Skeleton } from '../ui';
import { useAdminActions, useAdminStore } from '../../features/adminStore';
import { AUDIT_ACTIONS, actionLabel } from '../../utils/adminFormat';
import { JsonBlock, Num, Pagination, When } from './parts';
import { IconText } from '../ui/icons';

const PAGE_SIZES = [25, 50, 100, 200] as const;

export function AdminAudit() {
  const entries = useAdminStore((s) => s.audit);
  const total = useAdminStore((s) => s.auditTotal);
  const filters = useAdminStore((s) => s.auditFilters);
  const meta = useAdminStore((s) => s.auditMeta);
  const actions = useAdminActions();

  const showSkeleton = meta.loading && entries.length === 0;
  const showEmpty = !meta.loading && !meta.error && entries.length === 0;

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-2xs font-medium uppercase tracking-wider text-content-faint">
            Действие
          </span>
          <select
            value={filters.action}
            onChange={(e) => actions.setAuditFilters({ action: e.target.value })}
            className="rounded-md px-2 py-1.5 text-xs"
            aria-label="Фильтр по действию"
          >
            <option value="">Все действия</option>
            {AUDIT_ACTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                <IconText>{option.label}</IconText>
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-2xs font-medium uppercase tracking-wider text-content-faint">
            ID администратора
          </span>
          <input
            type="number"
            min={1}
            value={filters.adminId}
            onChange={(e) => actions.setAuditFilters({ adminId: e.target.value })}
            placeholder="любой"
            className="w-32 rounded-md px-2 py-1.5 text-xs"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-2xs font-medium uppercase tracking-wider text-content-faint">
            ID игрока
          </span>
          <input
            type="number"
            min={1}
            value={filters.targetUserId}
            onChange={(e) => actions.setAuditFilters({ targetUserId: e.target.value })}
            placeholder="любой"
            className="w-32 rounded-md px-2 py-1.5 text-xs"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-2xs font-medium uppercase tracking-wider text-content-faint">
            На странице
          </span>
          <select
            value={filters.limit}
            onChange={(e) => actions.setAuditFilters({ limit: Number(e.target.value) })}
            className="rounded-md px-2 py-1.5 text-xs"
            aria-label="Размер страницы журнала"
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
          onClick={() => void actions.loadAudit(true)}
          disabled={meta.loading}
          aria-label="Обновить журнал"
          title="Обновить журнал"
        >
          <RefreshCw size={16} className={meta.loading ? 'animate-spin' : ''} />
        </button>

        {(filters.action !== '' || filters.adminId !== '' || filters.targetUserId !== '') && (
          <button
            type="button"
            className="btn btn-xs"
            onClick={() =>
              actions.setAuditFilters({ action: '', adminId: '', targetUserId: '' })
            }
          >
            Сбросить фильтры
          </button>
        )}
      </div>

      {meta.error && (
        <Alert tone="danger" title="Не удалось загрузить журнал">
          {meta.error}
        </Alert>
      )}

      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-edge bg-surface-2">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Когда</th>
              <th scope="col">Действие</th>
              <th scope="col">Администратор</th>
              <th scope="col">Цель</th>
              <th scope="col">IP</th>
              <th scope="col">Детали</th>
            </tr>
          </thead>
          <tbody>
            {showSkeleton &&
              Array.from({ length: 8 }, (_, index) => (
                <tr key={`skeleton-${index}`}>
                  {Array.from({ length: 6 }, (_, cell) => (
                    <td key={cell}>
                      <Skeleton className="h-4 w-full" />
                    </td>
                  ))}
                </tr>
              ))}

            {entries.map((entry) => (
              <tr key={entry.id}>
                <td className="whitespace-nowrap">
                  <When value={entry.created_at} />
                </td>
                <td>
                  <span className="block text-content-primary">{actionLabel(entry.action)}</span>
                  <span className="block font-mono text-3xs text-content-faint">{entry.action}</span>
                </td>
                <td className="max-w-[12rem]">
                  <span className="block truncate" title={entry.admin_email ?? undefined}>
                    {entry.admin_email ?? '—'}
                  </span>
                  <Num className="block text-3xs text-content-faint">
                    #{entry.admin_id ?? '—'}
                  </Num>
                </td>
                <td className="max-w-[12rem]">
                  {entry.target_user_id === null ? (
                    <span className="text-content-faint">—</span>
                  ) : (
                    <>
                      <span className="block truncate" title={entry.target_email ?? undefined}>
                        {entry.target_email ?? 'удалён'}
                      </span>
                      <Num className="block text-3xs text-content-faint">
                        #{entry.target_user_id}
                      </Num>
                    </>
                  )}
                </td>
                <td>
                  <Num>{entry.ip_address ?? '—'}</Num>
                </td>
                <td className="max-w-[18rem]">
                  {entry.details && Object.keys(entry.details).length > 0 ? (
                    <details>
                      <summary className="cursor-pointer text-2xs text-content-faint hover:text-content-primary">
                        показать
                      </summary>
                      <div className="mt-1">
                        <JsonBlock value={entry.details} maxChars={6000} />
                      </div>
                    </details>
                  ) : (
                    <span className="text-content-faint">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {showEmpty && (
          <div className="p-4">
            <EmptyState
              title="Записей нет"
              hint="Журнал заполняется автоматически при каждом изменении."
              icon={<History size={22} />}
            />
          </div>
        )}
      </div>

      <Pagination
        offset={filters.offset}
        limit={filters.limit}
        total={total}
        onChange={(offset) => actions.setAuditPage(offset)}
        busy={meta.loading}
      />
    </div>
  );
}
