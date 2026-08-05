/**
 * Объявления: список всех (включая скрытые и истёкшие) и форма создания.
 * Создание и удаление — только администратор, чтение — и модератор.
 */

import { useState } from 'react';
import { Megaphone, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { Alert, Badge, EmptyState, Field, Panel, SkeletonRows } from '../ui';
import { useAdminActions, useAdminStore } from '../../features/adminStore';
import type { AdminRole, AnnouncementSeverity } from '../../utils/adminApi';
import { formatFull, formatWhen } from '../../utils/adminFormat';
import { When } from './parts';
import { IconText } from '../ui/icons';

const SEVERITIES: ReadonlyArray<{ value: AnnouncementSeverity; label: string }> = [
  { value: 'info', label: 'Информация' },
  { value: 'warning', label: 'Предупреждение' },
  { value: 'critical', label: 'Критично' },
];

function severityTone(severity: AnnouncementSeverity): 'info' | 'warning' | 'danger' {
  if (severity === 'critical') return 'danger';
  if (severity === 'warning') return 'warning';
  return 'info';
}

function severityLabel(severity: AnnouncementSeverity): string {
  return SEVERITIES.find((item) => item.value === severity)?.label ?? severity;
}

export function AdminAnnouncements({ viewerRole }: { viewerRole: AdminRole }) {
  const announcements = useAdminStore((s) => s.announcements);
  const meta = useAdminStore((s) => s.announcementsMeta);
  const action = useAdminStore((s) => s.action);
  const actions = useAdminActions();

  const isAdmin = viewerRole === 'admin';

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [severity, setSeverity] = useState<AnnouncementSeverity>('info');
  const [expiresAt, setExpiresAt] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const busy = action.pending !== null;
  const canSubmit = title.trim() !== '' && body.trim() !== '' && !busy;

  const submit = () => {
    // Локальное «YYYY-MM-DDTHH:mm» переводим в ISO, чтобы часовой пояс не терялся.
    let iso: string | null = null;
    if (expiresAt !== '') {
      const parsed = new Date(expiresAt);
      iso = Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
    }
    void actions
      .createAnnouncement({
        title: title.trim(),
        body: body.trim(),
        severity,
        expiresAt: iso,
      })
      .then((ok) => {
        if (!ok) return;
        setTitle('');
        setBody('');
        setSeverity('info');
        setExpiresAt('');
      });
  };

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
      {/* -------------------------------------------------------------- список */}
      <Panel
        title="Объявления"
        icon={<Megaphone size={14} />}
        subtitle={`всего ${announcements.length}`}
        actions={
          <button
            type="button"
            className="icon-btn"
            onClick={() => void actions.loadAnnouncements(true)}
            disabled={meta.loading}
            aria-label="Обновить объявления"
            title="Обновить объявления"
          >
            <RefreshCw size={16} className={meta.loading ? 'animate-spin' : ''} />
          </button>
        }
      >
        {meta.error && (
          <Alert tone="danger" title="Не удалось загрузить объявления">
            {meta.error}
          </Alert>
        )}

        {meta.loading && announcements.length === 0 && <SkeletonRows rows={4} />}

        {!meta.loading && !meta.error && announcements.length === 0 && (
          <EmptyState
            title="Объявлений нет"
            hint="Созданное объявление увидят все игроки при входе."
            icon={<Megaphone size={22} />}
          />
        )}

        <ul className="space-y-2">
          {announcements.map((item) => (
            <li key={item.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={severityTone(item.severity)}>{severityLabel(item.severity)}</Badge>
                    {!item.visible && <Badge tone="neutral">не показывается</Badge>}
                    {!item.active && <Badge tone="neutral">выключено</Badge>}
                  </div>
                  <p className="mt-1 break-words text-sm font-semibold text-content-primary">
                    <IconText>{item.title}</IconText>
                  </p>
                  <p className="mt-0.5 whitespace-pre-wrap break-words text-xs text-content-secondary">
                    <IconText>{item.body}</IconText>
                  </p>
                  <p className="mt-1 text-3xs text-content-faint">
                    {item.created_by_email ?? 'система'} · создано{' '}
                    <span title={formatFull(item.created_at)}>{formatWhen(item.created_at)}</span>
                    {item.expires_at && (
                      <>
                        {' '}
                        · истекает <When value={item.expires_at} />
                      </>
                    )}
                  </p>
                </div>

                {isAdmin && (
                  <div className="shrink-0">
                    {confirmDelete === item.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className="btn-danger btn-xs"
                          disabled={busy}
                          onClick={() =>
                            void actions.removeAnnouncement(item.id).then((ok) => {
                              if (ok) setConfirmDelete(null);
                            })
                          }
                        >
                          Удалить
                        </button>
                        <button
                          type="button"
                          className="btn-ghost btn-xs"
                          onClick={() => setConfirmDelete(null)}
                        >
                          Отмена
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => setConfirmDelete(item.id)}
                        aria-label={`Удалить объявление «${item.title}»`}
                        title="Удалить объявление"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Panel>

      {/* ---------------------------------------------------------- создание */}
      <Panel title="Новое объявление" icon={<Plus size={14} />}>
        {!isAdmin ? (
          <Alert tone="info" title="Только чтение">
            Создавать и удалять объявления может администратор.
          </Alert>
        ) : (
          <div className="space-y-2">
            {action.error && (
              <Alert tone="danger" title="Не сохранено">
                {action.error}
              </Alert>
            )}
            {action.result && (
              <Alert tone="accent" title="Готово" onDismiss={() => actions.clearActionState()}>
                {action.result}
              </Alert>
            )}

            <Field label="Заголовок" hint={`${title.trim().length}/200`}>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                className="rounded-md px-2 py-1.5 text-xs"
              />
            </Field>

            <Field label="Текст" hint={`${body.trim().length}/5000`}>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
                maxLength={5000}
                className="rounded-md px-2 py-1.5 text-xs"
              />
            </Field>

            <Field label="Важность">
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as AnnouncementSeverity)}
                className="rounded-md px-2 py-1.5 text-xs"
              >
                {SEVERITIES.map((option) => (
                  <option key={option.value} value={option.value}>
                    <IconText>{option.label}</IconText>
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Истекает" hint="необязательно">
              <input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="rounded-md px-2 py-1.5 text-xs"
              />
            </Field>

            <button
              type="button"
              className="btn-primary btn-block"
              disabled={!canSubmit}
              onClick={submit}
            >
              <Megaphone size={14} aria-hidden="true" />
              {busy ? 'Публикуем…' : 'Опубликовать'}
            </button>
          </div>
        )}
      </Panel>
    </div>
  );
}
