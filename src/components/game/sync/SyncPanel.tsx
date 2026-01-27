/**
 * Sync Panel - Фаза 8
 * Главная панель управления синхронизацией
 */

import React, { useState, useEffect } from 'react';
import { useSyncStore } from '../../../features/syncStore';
import { formatSize } from '../../../utils/saveCompressor';
import { formatTimestamp } from '../../../utils/conflictResolver';
import { useSyncData } from '../../../utils/syncHelpers';
import { ConflictResolver } from './ConflictResolver';
import { BackupManager } from './BackupManager';

interface SyncPanelProps {
  onClose?: () => void;
}

type TabType = 'status' | 'backups' | 'devices' | 'settings';

export const SyncPanel: React.FC<SyncPanelProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<TabType>('status');
  
  const {
    isConnected,
    isOnline,
    isAuthenticated,
    syncInProgress,
    syncProgress,
    pendingChanges,
    hasUnresolvedConflicts,
    conflicts,
    knownDevices,
    currentDevice,
    error,
    lastSyncAt,
    stats,
    settings,
    setSettings,
    sync,
    checkConnection,
    refreshBackups,
    refreshDevices,
    clearError,
  } = useSyncStore();

  const { currentSlotId, getSaveData } = useSyncData();

  // Проверяем соединение при открытии
  useEffect(() => {
    checkConnection();
    if (isAuthenticated) {
      refreshBackups();
      refreshDevices();
    }
  }, []);

  // Обработчик синхронизации
  const handleSync = async () => {
    if (!currentSlotId) return;
    
    const saveData = getSaveData();
    await sync(currentSlotId, saveData);
  };

  // Рендер вкладок
  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: 'status', label: 'Статус', icon: '📊' },
    { id: 'backups', label: 'Бэкапы', icon: '💾' },
    { id: 'devices', label: 'Устройства', icon: '📱' },
    { id: 'settings', label: 'Настройки', icon: '⚙️' },
  ];

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden max-w-2xl w-full max-h-[80vh] flex flex-col">
      {/* Заголовок */}
      <div className="bg-gray-800 px-4 py-3 flex items-center justify-between border-b border-gray-700">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          ☁️ Облачная синхронизация
        </h2>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        )}
      </div>

      {/* Вкладки */}
      <div className="flex border-b border-gray-700">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              flex-1 px-4 py-2 text-sm font-medium transition-colors
              ${activeTab === tab.id
                ? 'bg-gray-800 text-white border-b-2 border-blue-500'
                : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
              }
            `}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Контент */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Показываем конфликты если есть */}
        {hasUnresolvedConflicts && conflicts.length > 0 && (
          <div className="mb-4">
            <ConflictResolver conflict={conflicts[0]} />
          </div>
        )}

        {/* Ошибка */}
        {error && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-red-400 font-medium">⚠️ Ошибка синхронизации</div>
                <div className="text-sm text-red-300">{error.message}</div>
              </div>
              <button
                onClick={clearError}
                className="text-red-400 hover:text-red-300"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {activeTab === 'status' && (
          <StatusTab
            isConnected={isConnected}
            isOnline={isOnline}
            isAuthenticated={isAuthenticated}
            syncInProgress={syncInProgress}
            syncProgress={syncProgress}
            pendingChanges={pendingChanges}
            lastSyncAt={lastSyncAt}
            stats={stats}
            onSync={handleSync}
          />
        )}

        {activeTab === 'backups' && (
          <BackupManager />
        )}

        {activeTab === 'devices' && (
          <DevicesTab
            currentDevice={currentDevice}
            devices={knownDevices}
            onRefresh={refreshDevices}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsTab
            settings={settings}
            onUpdate={setSettings}
          />
        )}
      </div>
    </div>
  );
};

// ========== SUB COMPONENTS ==========

interface StatusTabProps {
  isConnected: boolean;
  isOnline: boolean;
  isAuthenticated: boolean;
  syncInProgress: boolean;
  syncProgress: number;
  pendingChanges: number;
  lastSyncAt: number | null;
  stats: {
    totalSyncs: number;
    successfulSyncs: number;
    failedSyncs: number;
    totalDataTransferred: number;
    averageSyncTime: number;
    lastSyncDuration: number;
  };
  onSync: () => void;
}

const StatusTab: React.FC<StatusTabProps> = ({
  isConnected,
  isOnline,
  isAuthenticated,
  syncInProgress,
  syncProgress,
  pendingChanges,
  lastSyncAt,
  stats,
  onSync,
}) => {
  return (
    <div className="space-y-4">
      {/* Статус подключения */}
      <div className="grid grid-cols-3 gap-3">
        <StatusCard
          icon={isOnline ? '🌐' : '📵'}
          label="Интернет"
          value={isOnline ? 'Онлайн' : 'Офлайн'}
          color={isOnline ? 'green' : 'red'}
        />
        <StatusCard
          icon={isAuthenticated ? '🔓' : '🔒'}
          label="Авторизация"
          value={isAuthenticated ? 'Да' : 'Нет'}
          color={isAuthenticated ? 'green' : 'yellow'}
        />
        <StatusCard
          icon={isConnected ? '✅' : '❌'}
          label="Сервер"
          value={isConnected ? 'Подключён' : 'Недоступен'}
          color={isConnected ? 'green' : 'red'}
        />
      </div>

      {/* Кнопка синхронизации */}
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-white font-medium">Синхронизация</div>
            <div className="text-sm text-gray-400">
              {pendingChanges > 0
                ? `${pendingChanges} несохранённых изменений`
                : 'Все изменения синхронизированы'
              }
            </div>
          </div>
          <button
            onClick={onSync}
            disabled={syncInProgress || !isOnline || !isAuthenticated}
            className={`
              px-4 py-2 rounded-lg font-medium transition-all
              ${syncInProgress
                ? 'bg-blue-900 text-blue-300 cursor-wait'
                : !isOnline || !isAuthenticated
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-500'
              }
            `}
          >
            {syncInProgress ? `${syncProgress}%` : '🔄 Синхр.'}
          </button>
        </div>

        {/* Прогресс бар */}
        {syncInProgress && (
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${syncProgress}%` }}
            />
          </div>
        )}

        {/* Последняя синхронизация */}
        {lastSyncAt && (
          <div className="text-xs text-gray-500 mt-2">
            Последняя синхронизация: {formatTimestamp(lastSyncAt)}
          </div>
        )}
      </div>

      {/* Статистика */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-white font-medium mb-3">📊 Статистика</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Всего синхронизаций:</span>
            <span className="text-white">{stats.totalSyncs}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Успешных:</span>
            <span className="text-green-400">{stats.successfulSyncs}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Ошибок:</span>
            <span className="text-red-400">{stats.failedSyncs}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Передано данных:</span>
            <span className="text-white">{formatSize(stats.totalDataTransferred)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Среднее время:</span>
            <span className="text-white">{stats.averageSyncTime.toFixed(0)} мс</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Последняя:</span>
            <span className="text-white">{stats.lastSyncDuration} мс</span>
          </div>
        </div>
      </div>
    </div>
  );
};

interface StatusCardProps {
  icon: string;
  label: string;
  value: string;
  color: 'green' | 'yellow' | 'red' | 'blue' | 'gray';
}

const StatusCard: React.FC<StatusCardProps> = ({ icon, label, value, color }) => {
  const colorClasses = {
    green: 'text-green-400 bg-green-900/30 border-green-700',
    yellow: 'text-yellow-400 bg-yellow-900/30 border-yellow-700',
    red: 'text-red-400 bg-red-900/30 border-red-700',
    blue: 'text-blue-400 bg-blue-900/30 border-blue-700',
    gray: 'text-gray-400 bg-gray-800 border-gray-700',
  };

  return (
    <div className={`p-3 rounded-lg border ${colorClasses[color]}`}>
      <div className="text-lg">{icon}</div>
      <div className="text-xs text-gray-400 mt-1">{label}</div>
      <div className={`text-sm font-medium ${colorClasses[color].split(' ')[0]}`}>{value}</div>
    </div>
  );
};

interface DevicesTabProps {
  currentDevice: { id: string; name: string; platform: string } | null;
  devices: Array<{
    id: string;
    name: string;
    platform: string;
    lastSeen: number;
  }>;
  onRefresh: () => void;
}

const DevicesTab: React.FC<DevicesTabProps> = ({ currentDevice, devices, onRefresh }) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-medium">Ваши устройства</h3>
        <button
          onClick={onRefresh}
          className="text-sm text-blue-400 hover:text-blue-300"
        >
          🔄 Обновить
        </button>
      </div>

      {/* Текущее устройство */}
      {currentDevice && (
        <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">
              {currentDevice.platform === 'ios' ? '📱' :
               currentDevice.platform === 'android' ? '🤖' :
               currentDevice.platform === 'desktop' ? '🖥️' : '🌐'}
            </span>
            <div>
              <div className="text-white font-medium">{currentDevice.name}</div>
              <div className="text-xs text-blue-400">Текущее устройство</div>
            </div>
          </div>
        </div>
      )}

      {/* Другие устройства */}
      <div className="space-y-2">
        {devices
          .filter(d => d.id !== currentDevice?.id)
          .map((device) => (
            <div
              key={device.id}
              className="bg-gray-800 border border-gray-700 rounded-lg p-3"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">
                  {device.platform === 'ios' ? '📱' :
                   device.platform === 'android' ? '🤖' :
                   device.platform === 'desktop' ? '🖥️' : '🌐'}
                </span>
                <div className="flex-1">
                  <div className="text-white">{device.name}</div>
                  <div className="text-xs text-gray-500">
                    Последняя активность: {formatTimestamp(device.lastSeen)}
                  </div>
                </div>
              </div>
            </div>
          ))}

        {devices.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            Нет других устройств
          </div>
        )}
      </div>
    </div>
  );
};

interface SyncSettings {
  enabled: boolean;
  autoSync: boolean;
  syncIntervalMinutes: number;
  syncOnFocus: boolean;
  syncOnBlur: boolean;
  autoBackupEnabled: boolean;
  autoBackupIntervalHours: number;
  compressionEnabled: boolean;
  compressionLevel: 1 | 2 | 3;
  notifyOnSync: boolean;
  notifyOnConflict: boolean;
  notifyOnError: boolean;
}

interface SettingsTabProps {
  settings: SyncSettings;
  onUpdate: (settings: Partial<SyncSettings>) => void;
}

const SettingsTab: React.FC<SettingsTabProps> = ({ settings, onUpdate }) => {
  return (
    <div className="space-y-4">
      {/* Синхронизация */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-white font-medium mb-3">🔄 Синхронизация</h3>
        
        <SettingsToggle
          label="Включить синхронизацию"
          description="Синхронизировать сохранения между устройствами"
          checked={settings.enabled}
          onChange={(enabled) => onUpdate({ enabled })}
        />

        <SettingsToggle
          label="Автоматическая синхронизация"
          description="Синхронизировать автоматически каждые N минут"
          checked={settings.autoSync}
          onChange={(autoSync) => onUpdate({ autoSync })}
          disabled={!settings.enabled}
        />

        {settings.autoSync && (
          <div className="mt-3">
            <label className="text-sm text-gray-400">Интервал (минуты)</label>
            <select
              value={settings.syncIntervalMinutes}
              onChange={(e) => onUpdate({ syncIntervalMinutes: parseInt(e.target.value) })}
              className="mt-1 w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
              disabled={!settings.enabled}
            >
              <option value={1}>1 минута</option>
              <option value={5}>5 минут</option>
              <option value={10}>10 минут</option>
              <option value={15}>15 минут</option>
              <option value={30}>30 минут</option>
            </select>
          </div>
        )}

        <SettingsToggle
          label="Синхр. при возврате в игру"
          checked={settings.syncOnFocus}
          onChange={(syncOnFocus) => onUpdate({ syncOnFocus })}
          disabled={!settings.enabled}
        />

        <SettingsToggle
          label="Синхр. при выходе из игры"
          checked={settings.syncOnBlur}
          onChange={(syncOnBlur) => onUpdate({ syncOnBlur })}
          disabled={!settings.enabled}
        />
      </div>

      {/* Бэкапы */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-white font-medium mb-3">💾 Резервные копии</h3>
        
        <SettingsToggle
          label="Автоматические бэкапы"
          description="Создавать бэкап раз в день"
          checked={settings.autoBackupEnabled}
          onChange={(autoBackupEnabled) => onUpdate({ autoBackupEnabled })}
          disabled={!settings.enabled}
        />
      </div>

      {/* Сжатие */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-white font-medium mb-3">📦 Сжатие</h3>
        
        <SettingsToggle
          label="Сжимать сохранения"
          description="Уменьшает размер данных при передаче"
          checked={settings.compressionEnabled}
          onChange={(compressionEnabled) => onUpdate({ compressionEnabled })}
          disabled={!settings.enabled}
        />

        {settings.compressionEnabled && (
          <div className="mt-3">
            <label className="text-sm text-gray-400">Уровень сжатия</label>
            <select
              value={settings.compressionLevel}
              onChange={(e) => onUpdate({ compressionLevel: parseInt(e.target.value) as 1 | 2 | 3 })}
              className="mt-1 w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
              disabled={!settings.enabled}
            >
              <option value={1}>Быстрое (меньше сжатие)</option>
              <option value={2}>Среднее (рекомендуется)</option>
              <option value={3}>Максимальное (медленнее)</option>
            </select>
          </div>
        )}
      </div>

      {/* Уведомления */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-white font-medium mb-3">🔔 Уведомления</h3>
        
        <SettingsToggle
          label="При успешной синхронизации"
          checked={settings.notifyOnSync}
          onChange={(notifyOnSync) => onUpdate({ notifyOnSync })}
          disabled={!settings.enabled}
        />

        <SettingsToggle
          label="При конфликте"
          checked={settings.notifyOnConflict}
          onChange={(notifyOnConflict) => onUpdate({ notifyOnConflict })}
          disabled={!settings.enabled}
        />

        <SettingsToggle
          label="При ошибке"
          checked={settings.notifyOnError}
          onChange={(notifyOnError) => onUpdate({ notifyOnError })}
          disabled={!settings.enabled}
        />
      </div>
    </div>
  );
};

interface SettingsToggleProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

const SettingsToggle: React.FC<SettingsToggleProps> = ({
  label,
  description,
  checked,
  onChange,
  disabled,
}) => {
  return (
    <div className={`flex items-center justify-between py-2 ${disabled ? 'opacity-50' : ''}`}>
      <div>
        <div className="text-white text-sm">{label}</div>
        {description && <div className="text-xs text-gray-500">{description}</div>}
      </div>
      <button
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
        className={`
          w-12 h-6 rounded-full transition-colors relative
          ${checked ? 'bg-blue-600' : 'bg-gray-600'}
          ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        <div
          className={`
            absolute top-1 w-4 h-4 bg-white rounded-full transition-transform
            ${checked ? 'translate-x-7' : 'translate-x-1'}
          `}
        />
      </button>
    </div>
  );
};

export default SyncPanel;
