/**
 * Backup Manager - Фаза 8
 * UI компонент для управления резервными копиями
 */

import React, { useState, useEffect } from 'react';
import { useSyncStore } from '../../../features/syncStore';
import { useGameStore } from '../../../features/gameStore';
import { formatSize } from '../../../utils/saveCompressor';
import { formatTimestamp } from '../../../utils/conflictResolver';
import { getCurrentSlotId } from '../../../utils/syncHelpers';
import type { BackupInfo, BackupReason } from '../../../core/gameTypes.sync';

export const BackupManager: React.FC = () => {
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [backupName, setBackupName] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const {
    backups,
    settings,
    createBackup: createBackupAction,
    restoreBackup: restoreBackupAction,
    deleteBackup: deleteBackupAction,
    refreshBackups,
  } = useSyncStore();

  const loadGame = useGameStore((state) => state.loadGame);
  const currentSlotId = getCurrentSlotId();

  useEffect(() => {
    refreshBackups();
  }, []);

  const handleCreateBackup = async () => {
    if (!currentSlotId) return;
    
    setCreating(true);
    try {
      await createBackupAction(currentSlotId, 'manual', backupName || undefined);
      setShowCreateDialog(false);
      setBackupName('');
    } finally {
      setCreating(false);
    }
  };

  const handleRestore = async (backupId: string) => {
    if (!confirm('Восстановить эту резервную копию? Текущий прогресс будет потерян!')) {
      return;
    }

    setRestoring(backupId);
    try {
      const data = await restoreBackupAction(backupId, currentSlotId ?? undefined);
      if (data) {
        // После восстановления бэкапа перезагружаем игру
        await loadGame();
        alert('Резервная копия успешно восстановлена!');
      }
    } finally {
      setRestoring(null);
    }
  };

  const handleDelete = async (backupId: string) => {
    if (!confirm('Удалить эту резервную копию?')) {
      return;
    }

    setDeleting(backupId);
    try {
      await deleteBackupAction(backupId);
    } finally {
      setDeleting(null);
    }
  };

  const getReasonLabel = (reason: BackupReason): { label: string; color: string } => {
    switch (reason) {
      case 'auto':
        return { label: 'Автоматический', color: 'text-blue-400' };
      case 'manual':
        return { label: 'Ручной', color: 'text-green-400' };
      case 'before_update':
        return { label: 'Перед обновлением', color: 'text-yellow-400' };
      case 'before_merge':
        return { label: 'Перед слиянием', color: 'text-purple-400' };
      case 'before_restore':
        return { label: 'Перед восстановлением', color: 'text-orange-400' };
      default:
        return { label: reason, color: 'text-gray-400' };
    }
  };

  return (
    <div className="space-y-4">
      {/* Заголовок и кнопка создания */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-white font-medium">Резервные копии</h3>
          <p className="text-xs text-gray-500">
            Максимум {settings.maxBackups} копий, хранятся {settings.backupRetentionDays} дней
          </p>
        </div>
        <button
          onClick={() => setShowCreateDialog(true)}
          disabled={creating || !currentSlotId}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          ➕ Создать
        </button>
      </div>

      {/* Диалог создания бэкапа */}
      {showCreateDialog && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <h4 className="text-white font-medium mb-3">Создать резервную копию</h4>
          <input
            type="text"
            value={backupName}
            onChange={(e) => setBackupName(e.target.value)}
            placeholder="Название (необязательно)"
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white placeholder-gray-500 mb-3"
          />
          <div className="flex gap-2">
            <button
              onClick={handleCreateBackup}
              disabled={creating}
              className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-500 text-white rounded transition-colors disabled:opacity-50"
            >
              {creating ? 'Создание...' : '✓ Создать'}
            </button>
            <button
              onClick={() => {
                setShowCreateDialog(false);
                setBackupName('');
              }}
              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {/* Список бэкапов */}
      {backups.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <div className="text-3xl mb-2">💾</div>
          <div>Нет резервных копий</div>
          <div className="text-xs mt-1">Создайте первую резервную копию</div>
        </div>
      ) : (
        <div className="space-y-2">
          {backups.map((backup) => (
            <BackupItem
              key={backup.id}
              backup={backup}
              isRestoring={restoring === backup.id}
              isDeleting={deleting === backup.id}
              onRestore={() => handleRestore(backup.id)}
              onDelete={() => handleDelete(backup.id)}
              getReasonLabel={getReasonLabel}
            />
          ))}
        </div>
      )}

      {/* Информация об автобэкапах */}
      <div className="bg-gray-800/50 rounded-lg p-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-blue-400">ℹ️</span>
          <span className="text-gray-400">
            {settings.autoBackupEnabled
              ? `Автоматические бэкапы создаются каждые ${settings.autoBackupIntervalHours} часов`
              : 'Автоматические бэкапы отключены'
            }
          </span>
        </div>
      </div>
    </div>
  );
};

interface BackupItemProps {
  backup: BackupInfo;
  isRestoring: boolean;
  isDeleting: boolean;
  onRestore: () => void;
  onDelete: () => void;
  getReasonLabel: (reason: BackupReason) => { label: string; color: string };
}

const BackupItem: React.FC<BackupItemProps> = ({
  backup,
  isRestoring,
  isDeleting,
  onRestore,
  onDelete,
  getReasonLabel,
}) => {
  const [expanded, setExpanded] = useState(false);
  const reasonInfo = getReasonLabel(backup.reason);
  
  // Рассчитываем оставшееся время
  const daysLeft = Math.ceil((backup.expiresAt - Date.now()) / (1000 * 60 * 60 * 24));

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
      {/* Основная информация */}
      <div
        className="p-3 cursor-pointer hover:bg-gray-700/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl">💾</span>
            <div>
              <div className="text-white font-medium">
                {backup.name || `Бэкап от ${formatTimestamp(backup.createdAt)}`}
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className={reasonInfo.color}>{reasonInfo.label}</span>
                <span className="text-gray-500">•</span>
                <span className="text-gray-500">{formatSize(backup.size)}</span>
                <span className="text-gray-500">•</span>
                <span className={daysLeft < 7 ? 'text-orange-400' : 'text-gray-500'}>
                  {daysLeft} дн. до удаления
                </span>
              </div>
            </div>
          </div>
          <span className={`text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}>
            ▼
          </span>
        </div>
      </div>

      {/* Развёрнутая информация */}
      {expanded && (
        <div className="px-3 pb-3 border-t border-gray-700 pt-3">
          <div className="grid grid-cols-2 gap-2 text-sm mb-3">
            <div className="flex justify-between">
              <span className="text-gray-400">Создано:</span>
              <span className="text-white">{formatTimestamp(backup.createdAt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Истекает:</span>
              <span className="text-white">{formatTimestamp(backup.expiresAt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Размер:</span>
              <span className="text-white">{formatSize(backup.size)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Слот:</span>
              <span className="text-white">#{backup.slotId}</span>
            </div>
          </div>

          {/* Кнопки действий */}
          <div className="flex gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRestore();
              }}
              disabled={isRestoring || isDeleting}
              className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-500 text-white rounded text-sm transition-colors disabled:opacity-50"
            >
              {isRestoring ? 'Восстановление...' : '🔄 Восстановить'}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              disabled={isRestoring || isDeleting}
              className="px-3 py-2 bg-red-600 hover:bg-red-500 text-white rounded text-sm transition-colors disabled:opacity-50"
            >
              {isDeleting ? '...' : '🗑️'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BackupManager;
