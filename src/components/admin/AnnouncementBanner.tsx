/**
 * Баннер объявлений — для всех игроков, не только для персонала.
 *
 * Скрытые объявления запоминаются в ОДНОМ ключе localStorage со списком id:
 * отдельный ключ на каждое объявление засорял бы хранилище без границ. Список
 * ещё и подчищается — id, которых больше нет среди активных, выбрасываются.
 */

import { useCallback, useEffect, useState } from 'react';
import { Megaphone } from 'lucide-react';
import { Alert } from '../ui';
import { getPublicAnnouncements, type PublicAnnouncement } from '../../utils/adminApi';
import { isAuthenticated } from '../../utils/settingsApi';
import { formatFull, formatWhen } from '../../utils/adminFormat';
import { IconText } from '../ui/icons';

const STORAGE_KEY = 'mygame.announcements.dismissed';

function readDismissed(): number[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is number => typeof value === 'number');
  } catch {
    return [];
  }
}

function writeDismissed(ids: number[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    /* приватный режим / переполненное хранилище — молча продолжаем */
  }
}

function toneFor(severity: PublicAnnouncement['severity']): 'info' | 'warning' | 'danger' {
  if (severity === 'critical') return 'danger';
  if (severity === 'warning') return 'warning';
  return 'info';
}

export function AnnouncementBanner() {
  const [announcements, setAnnouncements] = useState<PublicAnnouncement[]>([]);
  const [dismissed, setDismissed] = useState<number[]>(() => readDismissed());

  useEffect(() => {
    if (!isAuthenticated()) return;
    let cancelled = false;

    getPublicAnnouncements()
      .then((response) => {
        if (cancelled) return;
        setAnnouncements(response.announcements);
        // Подчищаем список скрытых: держим только те id, что ещё существуют.
        const liveIds = new Set(response.announcements.map((item) => item.id));
        setDismissed((current) => {
          const pruned = current.filter((id) => liveIds.has(id));
          if (pruned.length !== current.length) writeDismissed(pruned);
          return pruned.length === current.length ? current : pruned;
        });
      })
      .catch((error: unknown) => {
        // Баннер необязателен: игроку незачем видеть ошибку служебного запроса.
        console.warn('[AnnouncementBanner] не удалось загрузить объявления:', error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const dismiss = useCallback((id: number) => {
    setDismissed((current) => {
      if (current.includes(id)) return current;
      const next = [...current, id];
      writeDismissed(next);
      return next;
    });
  }, []);

  const visible = announcements.filter((item) => !dismissed.includes(item.id));
  if (visible.length === 0) return null;

  // На узком экране справа оставлено место под кнопку мобильного меню (она z-50),
  // иначе баннер накрыл бы её собой.
  return (
    <div className="pointer-events-none fixed left-2 right-14 top-2 z-40 space-y-2 sm:left-1/2 sm:right-auto sm:w-[min(92vw,560px)] sm:-translate-x-1/2">
      {visible.map((item) => (
        <div key={item.id} className="pointer-events-auto animate-slide-up glass rounded-lg shadow-elev-3">
          <Alert
            tone={toneFor(item.severity)}
            title={
              <span className="flex items-center gap-1.5">
                <Megaphone size={13} aria-hidden="true" />
                <IconText>{item.title}</IconText>
              </span>
            }
            onDismiss={() => dismiss(item.id)}
          >
            <p className="whitespace-pre-wrap break-words"><IconText>{item.body}</IconText></p>
            <p className="mt-1 text-3xs text-content-faint" title={formatFull(item.created_at)}>
              {formatWhen(item.created_at)}
              {item.expires_at ? ` · до ${formatWhen(item.expires_at)}` : ''}
            </p>
          </Alert>
        </div>
      ))}
    </div>
  );
}
