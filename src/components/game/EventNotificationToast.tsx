import { useEffect, useState } from 'react';
import { useGameStore } from '../../features/gameStore';
import { X, AlertTriangle } from 'lucide-react';

interface EventNotification {
  id: string;
  title: string;
  description: string;
  icon: string;
  timestamp: number;
}

export function EventNotificationToast() {
  const activeEvents = useGameStore(s => s.randomEvents.activeEvents);
  const [notifications, setNotifications] = useState<EventNotification[]>([]);
  const [shownEvents, setShownEvents] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Проверяем новые события
    const newEvents = activeEvents.filter(
      event => event.status === 'pending' && !shownEvents.has(event.id)
    );

    if (newEvents.length > 0) {
      // Добавляем уведомления
      const newNotifications = newEvents.map(event => ({
        id: event.id,
        title: event.title,
        description: event.description,
        icon: event.icon,
        timestamp: event.timestamp,
      }));

      setNotifications(prev => [...prev, ...newNotifications]);
      setShownEvents(prev => new Set([...prev, ...newEvents.map(e => e.id)]));

      // Автоматически удаляем уведомление через 10 секунд
      newNotifications.forEach(notif => {
        setTimeout(() => {
          setNotifications(prev => prev.filter(n => n.id !== notif.id));
        }, 10000);
      });
    }
  }, [activeEvents, shownEvents]);

  const dismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md">
      {notifications.map(notif => (
        <div
          key={notif.id}
          className="bg-gradient-to-r from-yellow-900/90 to-orange-900/90 backdrop-blur-sm border-2 border-yellow-500 rounded-lg shadow-2xl p-4 animate-slide-in-right"
        >
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-300 animate-pulse" />
              <span className="text-2xl">{notif.icon}</span>
            </div>
            <button
              onClick={() => dismissNotification(notif.id)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          
          <h3 className="font-bold text-lg text-yellow-200 mb-1">
            {notif.title}
          </h3>
          
          <p className="text-sm text-gray-200 line-clamp-3">
            {notif.description}
          </p>

          <div className="mt-2 text-xs text-gray-400">
            {new Date(notif.timestamp).toLocaleTimeString()}
          </div>

          {/* Прогресс-бар автозакрытия */}
          <div className="mt-2 h-1 bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full bg-yellow-500 animate-countdown" />
          </div>
        </div>
      ))}
    </div>
  );
}
