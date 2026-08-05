/**
 * Оболочка админ-панели: одно модальное окно на весь экран и пять вкладок.
 *
 * Данные каждой вкладки грузятся лениво — при первом переходе на неё. Загрузчики
 * стора сами ничего не делают, если раздел уже загружен и не помечен устаревшим,
 * поэтому повторные переходы не дёргают сервер.
 *
 * Отдельный случай — мёртвый токен: сессию может погасить и сам оператор (сменил
 * себе пароль, завершил свои сессии), и сервер (срок вышел). Тогда adminApi стирает
 * токен и сообщает об этом здесь: панель прячет все данные и предлагает войти
 * заново, вместо того чтобы жить поверх нерабочей сессии.
 */

import { useEffect, useState } from 'react';
import { History, LayoutDashboard, LogIn, Megaphone, Shield, Users, Wrench } from 'lucide-react';
import { Alert, ErrorBoundary, Modal, Tabs, type TabItem } from '../ui';
import { useAdminActions, useAdminStore } from '../../features/adminStore';
import {
  adminAuthLostText,
  getAdminAuthLost,
  subscribeAdminAuthLost,
  type AdminAuthLostReason,
  type AdminRole,
} from '../../utils/adminApi';
import { AdminOverview } from './AdminOverview';
import { AdminPlayers } from './AdminPlayers';
import { AdminPlayerDetail } from './AdminPlayerDetail';
import { AdminAudit } from './AdminAudit';
import { AdminAnnouncements } from './AdminAnnouncements';
import { AdminMaintenance } from './AdminMaintenance';
import { RoleBadge } from './parts';

type TabId = 'overview' | 'players' | 'audit' | 'announcements' | 'maintenance';

const TAB_LABELS: Record<TabId, string> = {
  overview: 'Обзор',
  players: 'Игроки',
  audit: 'Аудит',
  announcements: 'Объявления',
  maintenance: 'Обслуживание',
};

export function AdminPanel({
  open,
  onClose,
  role,
  currentUserId = null,
  onAuthLost,
}: {
  open: boolean;
  onClose: () => void;
  role: AdminRole;
  /** id вошедшего оператора — по нему разделы узнают его собственный аккаунт. */
  currentUserId?: number | null;
  /** Сессия умерла: вызывающая сторона должна показать форму входа. */
  onAuthLost?: () => void;
}) {
  const [tab, setTab] = useState<TabId>('overview');
  const [authLost, setAuthLost] = useState<AdminAuthLostReason | null>(null);
  const actions = useAdminActions();

  const playersTotal = useAdminStore((s) => s.playersTotal);
  const announcementCount = useAdminStore((s) => s.announcements.length);
  const auditTotal = useAdminStore((s) => s.auditTotal);

  // Подписка на потерю сессии. Флаг проверяется и сразу: токен мог умереть,
  // пока панель была закрыта.
  useEffect(() => {
    if (!open) return;
    setAuthLost(getAdminAuthLost());
    return subscribeAdminAuthLost(setAuthLost);
  }, [open]);

  // Ленивая загрузка: только раздел активной вкладки. С мёртвым токеном не
  // ходим на сервер — каждый запрос всё равно вернёт 401.
  useEffect(() => {
    if (!open || authLost !== null) return;
    switch (tab) {
      case 'overview':
        void actions.loadOverview();
        break;
      case 'players':
        void actions.loadPlayers();
        break;
      case 'audit':
        void actions.loadAudit();
        break;
      case 'announcements':
        void actions.loadAnnouncements();
        break;
      case 'maintenance':
        break;
    }
  }, [open, tab, actions, authLost]);

  // Мёртвый токен — данные показывать нельзя: карточка игрока и списки
  // относятся к сессии, которой больше нет.
  useEffect(() => {
    if (authLost === null) return;
    actions.reset();
  }, [authLost, actions]);

  // Закрыли панель — забываем данные, чтобы при следующем открытии не показать
  // устаревшую картину мира.
  useEffect(() => {
    if (open) return;
    actions.reset();
  }, [open, actions]);

  const items: ReadonlyArray<TabItem<TabId>> = [
    { id: 'overview', label: TAB_LABELS.overview, icon: <LayoutDashboard size={13} /> },
    {
      id: 'players',
      label: TAB_LABELS.players,
      icon: <Users size={13} />,
      badge: playersTotal > 0 ? playersTotal : undefined,
    },
    {
      id: 'audit',
      label: TAB_LABELS.audit,
      icon: <History size={13} />,
      badge: auditTotal > 0 ? auditTotal : undefined,
    },
    {
      id: 'announcements',
      label: TAB_LABELS.announcements,
      icon: <Megaphone size={13} />,
      badge: announcementCount > 0 ? announcementCount : undefined,
    },
    { id: 'maintenance', label: TAB_LABELS.maintenance, icon: <Wrench size={13} /> },
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="full"
      title="Админ-панель"
      subtitle="Игроки, экономика, журнал и обслуживание"
      icon={<Shield size={16} />}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-2xs text-content-faint">
            Ваша роль: <RoleBadge role={role} />
          </span>
          <span className="text-2xs text-content-faint">
            Права проверяются на сервере: интерфейс лишь скрывает недоступное.
          </span>
        </div>
      }
    >
      {authLost !== null ? (
        // Токен уже стёрт из localStorage: показывать нечего и запрашивать нечего.
        <div className="flex h-full min-h-0 items-center justify-center p-6">
          <div className="w-full max-w-md space-y-3">
            <Alert tone="danger" title="Сессия недействительна">
              {adminAuthLostText(authLost)} Панель отключена, чтобы не работать поверх мёртвого
              токена: несохранённые изменения на сервер уже не уйдут.
            </Alert>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-primary btn-xs"
                data-autofocus
                onClick={() => {
                  onClose();
                  onAuthLost?.();
                }}
              >
                <LogIn size={12} aria-hidden="true" />
                Войти заново
              </button>
              <button
                type="button"
                className="btn-ghost btn-xs"
                onClick={() => window.location.reload()}
              >
                Перезагрузить страницу
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative flex h-full min-h-0 flex-col">
          <div className="shrink-0 px-3 pt-3">
            <Tabs items={items} value={tab} onChange={setTab} />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {/* Сбой одного раздела не должен закрывать всю панель. */}
            <ErrorBoundary label={`Админка · ${TAB_LABELS[tab]}`} resetKeys={[tab]}>
              {tab === 'overview' && <AdminOverview />}
              {tab === 'players' && <AdminPlayers viewerId={currentUserId} />}
              {tab === 'audit' && <AdminAudit />}
              {tab === 'announcements' && <AdminAnnouncements viewerRole={role} />}
              {tab === 'maintenance' && <AdminMaintenance viewerRole={role} />}
            </ErrorBoundary>
          </div>

          {/* Карточка игрока — выдвижная панель поверх содержимого вкладки. */}
          <AdminPlayerDetail viewerRole={role} viewerId={currentUserId} />
        </div>
      )}
    </Modal>
  );
}

export { TAB_LABELS as ADMIN_TAB_LABELS };
export type { TabId as AdminTabId };
