/**
 * Глобальная система уведомлений (toast) для замены alert
 */

import { create } from 'zustand';

type NotificationType = 'info' | 'success' | 'warning' | 'error';

interface Notification {
  id: string;
  message: string;
  type: NotificationType;
  duration: number;
}

interface NotificationStore {
  notifications: Notification[];
  addNotification: (message: string, type?: NotificationType, duration?: number) => void;
  removeNotification: (id: string) => void;
}

export const useNotificationStore = create<NotificationStore>((set) => ({
  notifications: [],
  
  addNotification: (message, type = 'info', duration = 3000) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    
    set((state) => ({
      notifications: [...state.notifications, { id, message, type, duration }],
    }));
    
    // Автоматическое удаление после duration
    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        }));
      }, duration);
    }
  },
  
  removeNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }));
  },
}));

// Утилиты для удобного вызова
export const notify = {
  info: (message: string, duration?: number) => 
    useNotificationStore.getState().addNotification(message, 'info', duration),
  success: (message: string, duration?: number) => 
    useNotificationStore.getState().addNotification(message, 'success', duration),
  warning: (message: string, duration?: number) => 
    useNotificationStore.getState().addNotification(message, 'warning', duration),
  error: (message: string, duration?: number) => 
    useNotificationStore.getState().addNotification(message, 'error', duration),
};
