/**
 * Sync Status Indicator - Фаза 8
 * Индикатор статуса синхронизации (маленький значок в UI)
 */

import React from 'react';
import { useSyncStore } from '../../../features/syncStore';

interface SyncStatusIndicatorProps {
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export const SyncStatusIndicator: React.FC<SyncStatusIndicatorProps> = ({
  onClick,
  size = 'md',
  showLabel = false,
}) => {
  const {
    isConnected,
    isOnline,
    isAuthenticated,
    syncInProgress,
    syncProgress,
    pendingChanges,
    hasUnresolvedConflicts,
    error,
    lastSyncAt,
    settings,
  } = useSyncStore();

  // Определяем статус и цвет
  const getStatus = () => {
    if (!settings.enabled) {
      return { icon: '⏸️', color: 'text-gray-500', label: 'Отключено', bg: 'bg-gray-800' };
    }
    if (!isOnline) {
      return { icon: '📵', color: 'text-red-500', label: 'Нет сети', bg: 'bg-red-900/30' };
    }
    if (!isAuthenticated) {
      return { icon: '🔒', color: 'text-yellow-500', label: 'Не авторизован', bg: 'bg-yellow-900/30' };
    }
    if (error) {
      return { icon: '⚠️', color: 'text-red-500', label: 'Ошибка', bg: 'bg-red-900/30' };
    }
    if (hasUnresolvedConflicts) {
      return { icon: '⚔️', color: 'text-orange-500', label: 'Конфликт', bg: 'bg-orange-900/30' };
    }
    if (syncInProgress) {
      return { icon: '🔄', color: 'text-blue-400', label: `Синхр. ${syncProgress}%`, bg: 'bg-blue-900/30', animate: true };
    }
    if (pendingChanges > 0) {
      return { icon: '📝', color: 'text-yellow-400', label: `${pendingChanges} изм.`, bg: 'bg-yellow-900/30' };
    }
    if (!isConnected) {
      return { icon: '🔌', color: 'text-gray-500', label: 'Нет соединения', bg: 'bg-gray-800' };
    }
    return { icon: '☁️', color: 'text-green-400', label: 'Синхронизировано', bg: 'bg-green-900/30' };
  };

  const status = getStatus();

  // Размеры
  const sizeClasses = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-10 h-10 text-base',
  };

  // Форматируем время последней синхронизации
  const formatLastSync = () => {
    if (!lastSyncAt) return 'Никогда';
    
    const diff = Date.now() - lastSyncAt;
    if (diff < 60000) return 'Только что';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} мин. назад`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} ч. назад`;
    return new Date(lastSyncAt).toLocaleDateString('ru-RU');
  };

  return (
    <div 
      className="relative group"
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {/* Основной индикатор */}
      <div
        className={`
          ${sizeClasses[size]} 
          ${status.bg}
          ${onClick ? 'cursor-pointer hover:opacity-80' : ''}
          ${status.animate ? 'animate-spin' : ''}
          rounded-full flex items-center justify-center
          border border-gray-700
          transition-all duration-200
        `}
      >
        <span className={status.color}>{status.icon}</span>
      </div>

      {/* Бейдж с количеством изменений */}
      {pendingChanges > 0 && !syncInProgress && (
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center">
          <span className="text-[10px] text-black font-bold">
            {pendingChanges > 9 ? '9+' : pendingChanges}
          </span>
        </div>
      )}

      {/* Бейдж конфликта */}
      {hasUnresolvedConflicts && (
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 rounded-full flex items-center justify-center animate-pulse">
          <span className="text-[10px] text-black font-bold">!</span>
        </div>
      )}

      {/* Лейбл (опционально) */}
      {showLabel && (
        <span className={`ml-2 ${status.color} text-sm`}>{status.label}</span>
      )}

      {/* Тултип */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50">
        <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 shadow-lg min-w-[160px]">
          <div className="text-xs text-gray-400 mb-1">Синхронизация</div>
          <div className={`text-sm font-medium ${status.color}`}>{status.label}</div>
          
          {lastSyncAt && (
            <div className="text-xs text-gray-500 mt-1">
              Последняя: {formatLastSync()}
            </div>
          )}
          
          {error && (
            <div className="text-xs text-red-400 mt-1 truncate max-w-[200px]">
              {error.message}
            </div>
          )}

          {/* Стрелка тултипа */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-700" />
        </div>
      </div>
    </div>
  );
};

export default SyncStatusIndicator;
