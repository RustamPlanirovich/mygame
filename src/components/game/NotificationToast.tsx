/**
 * Компонент отображения уведомлений (toast)
 */

import { X, Info, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { useNotificationStore } from '../../utils/notifications';
import { IconText } from '../ui/icons';

export const NotificationToast = () => {
  const { notifications, removeNotification } = useNotificationStore();

  if (notifications.length === 0) return null;

  const getTypeStyles = (type: 'info' | 'success' | 'warning' | 'error') => {
    switch (type) {
      case 'success':
        return {
          bg: 'bg-green-900/95',
          border: 'border-green-500',
          icon: <CheckCircle className="w-5 h-5 text-green-400" />,
        };
      case 'warning':
        return {
          bg: 'bg-yellow-900/95',
          border: 'border-yellow-500',
          icon: <AlertTriangle className="w-5 h-5 text-yellow-400" />,
        };
      case 'error':
        return {
          bg: 'bg-red-900/95',
          border: 'border-red-500',
          icon: <XCircle className="w-5 h-5 text-red-400" />,
        };
      default:
        return {
          bg: 'bg-cyan-900/95',
          border: 'border-cyan-500',
          icon: <Info className="w-5 h-5 text-cyan-400" />,
        };
    }
  };

  return (
    <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2 max-w-sm">
      {notifications.map((notification) => {
        const styles = getTypeStyles(notification.type);
        return (
          <div
            key={notification.id}
            className={`${styles.bg} ${styles.border} border rounded-lg p-3 shadow-lg backdrop-blur-sm animate-slide-in-right flex items-start gap-3`}
          >
            {styles.icon}
            <p className="flex-1 text-sm text-white">
              <IconText>{notification.message}</IconText>
            </p>
            <button
              onClick={() => removeNotification(notification.id)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
