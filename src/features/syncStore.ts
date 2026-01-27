/**
 * Sync Store - Фаза 8
 * Zustand store для управления синхронизацией сохранений
 */

import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';
import type {
  SyncState,
  SyncSettings,
  SyncError,
  BackupInfo,
  SaveConflictResolveOption,
} from '../core/gameTypes.sync';
import {
  syncSave,
  pullSave,
  createBackup,
  listBackups,
  restoreBackup,
  deleteBackup,
  registerDevice,
  listDevices,
  resolveConflict,
  checkConnection,
} from '../utils/syncApi';
import { mergeSaves } from '../utils/conflictResolver';
import { notify } from '../utils/notifications';

// Типы для store
interface SyncStore extends SyncState {
  settings: SyncSettings;
  
  // Actions
  setSettings: (settings: Partial<SyncSettings>) => void;
  resetSettings: () => void;
  
  // Sync operations
  sync: (slotId: number, saveData: string, force?: boolean) => Promise<boolean>;
  pull: (slotId: number) => Promise<string | null>;
  
  // Conflict resolution
  resolveConflict: (conflictId: string, option: SaveConflictResolveOption, localData?: string) => Promise<boolean>;
  dismissConflict: (conflictId: string) => void;
  
  // Backups
  createBackup: (slotId: number, reason: 'manual' | 'auto', name?: string) => Promise<BackupInfo | null>;
  restoreBackup: (backupId: string, targetSlotId?: number) => Promise<string | null>;
  deleteBackup: (backupId: string) => Promise<boolean>;
  refreshBackups: () => Promise<void>;
  
  // Device management
  registerDevice: () => Promise<void>;
  refreshDevices: () => Promise<void>;
  
  // Connection
  checkConnection: () => Promise<void>;
  setOnline: (online: boolean) => void;
  setAuthenticated: (authenticated: boolean) => void;
  
  // Errors
  clearError: () => void;
  
  // Internal
  markChange: () => void;
  clearPendingChanges: () => void;
  
  // Stats
  recordSync: (success: boolean, duration: number, bytes: number) => void;
}

// Интервал автосинхронизации
let syncInterval: ReturnType<typeof setInterval> | null = null;

export const useSyncStore = create<SyncStore>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        // Initial state
        isConnected: false,
        isOnline: true,
        isAuthenticated: false,
        
        lastSyncAt: null,
        nextSyncAt: null,
        syncInProgress: false,
        syncProgress: 0,
        
        pendingChanges: 0,
        lastChangeAt: null,
        
        conflicts: [],
        hasUnresolvedConflicts: false,
        
        backups: [],
        
        currentDevice: null,
        knownDevices: [],
        
        error: null,
        lastError: null,
        consecutiveErrors: 0,
        
        stats: {
          totalSyncs: 0,
          successfulSyncs: 0,
          failedSyncs: 0,
          totalDataTransferred: 0,
          averageSyncTime: 0,
          lastSyncDuration: 0,
        },
        
        settings: {
          enabled: true,
          autoSync: true,
          syncIntervalMinutes: 5,
          syncOnFocus: true,
          syncOnBlur: true,
          
          autoBackupEnabled: true,
          autoBackupIntervalHours: 24,
          maxBackups: 10,
          backupRetentionDays: 30,
          
          autoResolveConflicts: false,
          autoResolvePreference: 'ask',
          
          compressionEnabled: true,
          compressionLevel: 2,
          
          notifyOnSync: false,
          notifyOnConflict: true,
          notifyOnError: true,
        },
        
        // Settings
        setSettings: (newSettings) => {
          set((state) => ({
            settings: { ...state.settings, ...newSettings },
          }));
        },
        
        resetSettings: () => {
          set({
            settings: {
              enabled: true,
              autoSync: true,
              syncIntervalMinutes: 5,
              syncOnFocus: true,
              syncOnBlur: true,
              autoBackupEnabled: true,
              autoBackupIntervalHours: 24,
              maxBackups: 10,
              backupRetentionDays: 30,
              autoResolveConflicts: false,
              autoResolvePreference: 'ask',
              compressionEnabled: true,
              compressionLevel: 2,
              notifyOnSync: false,
              notifyOnConflict: true,
              notifyOnError: true,
            },
          });
        },
        
        // Sync operations
        sync: async (slotId, saveData, force = false) => {
          const state = get();
          
          if (!state.settings.enabled || !state.isAuthenticated) {
            return false;
          }
          
          if (state.syncInProgress) {
            return false;
          }
          
          // Проверяем неразрешённые конфликты
          if (state.hasUnresolvedConflicts && !force) {
            return false;
          }
          
          set({ syncInProgress: true, syncProgress: 0, error: null });
          
          const startTime = Date.now();
          
          try {
            set({ syncProgress: 10 });
            
            // Сжимаем данные
            const compress = state.settings.compressionEnabled;
            const level = state.settings.compressionLevel;
            
            set({ syncProgress: 30 });
            
            // Отправляем на сервер
            const result = await syncSave(slotId, saveData, compress, level, force);
            
            set({ syncProgress: 80 });
            
            if (!result.ok) {
              throw new Error(result.error || 'Sync failed');
            }
            
            // Обрабатываем результат
            if (result.status === 'conflict' && result.conflict) {
              // Обнаружен конфликт
              set((state) => ({
                conflicts: [...state.conflicts, result.conflict!],
                hasUnresolvedConflicts: true,
              }));
              
              if (state.settings.notifyOnConflict) {
                notify.warning('Конфликт синхронизации: расхождения между локальным и облачным сохранением');
              }
              
              set({ syncProgress: 100, syncInProgress: false });
              return false;
            }
            
            const duration = Date.now() - startTime;
            const bytes = new TextEncoder().encode(saveData).length;
            
            set({
              syncProgress: 100,
              lastSyncAt: Date.now(),
              nextSyncAt: Date.now() + state.settings.syncIntervalMinutes * 60 * 1000,
              pendingChanges: 0,
              consecutiveErrors: 0,
            });
            
            get().recordSync(true, duration, bytes);
            
            if (state.settings.notifyOnSync) {
              notify.success('Сохранение успешно синхронизировано');
            }
            
            set({ syncInProgress: false });
            return true;
          } catch (error) {
            const syncError: SyncError = {
              code: 'UNKNOWN',
              message: error instanceof Error ? error.message : 'Unknown error',
              timestamp: Date.now(),
              retryable: true,
            };
            
            set((state) => ({
              error: syncError,
              lastError: syncError,
              consecutiveErrors: state.consecutiveErrors + 1,
              syncInProgress: false,
              syncProgress: 0,
            }));
            
            get().recordSync(false, Date.now() - startTime, 0);
            
            if (state.settings.notifyOnError) {
              notify.error(`Ошибка синхронизации: ${syncError.message}`);
            }
            
            return false;
          }
        },
        
        pull: async (slotId) => {
          const state = get();
          
          if (!state.settings.enabled || !state.isAuthenticated) {
            return null;
          }
          
          try {
            const result = await pullSave(slotId);
            
            if (!result.ok) {
              throw new Error(result.error || 'Pull failed');
            }
            
            return result.data || null;
          } catch (error) {
            const syncError: SyncError = {
              code: 'UNKNOWN',
              message: error instanceof Error ? error.message : 'Unknown error',
              timestamp: Date.now(),
              retryable: true,
            };
            
            set({
              error: syncError,
              lastError: syncError,
            });
            
            return null;
          }
        },
        
        // Conflict resolution
        resolveConflict: async (conflictId, option, localData) => {
          const state = get();
          const conflict = state.conflicts.find((c) => c.id === conflictId);
          
          if (!conflict) {
            return false;
          }
          
          try {
            let dataToSend: string | undefined;
            
            if (option === 'merge' && localData) {
              // Получаем облачные данные
              const cloudResult = await pullSave(conflict.cloudSave.slotId);
              if (cloudResult.data) {
                dataToSend = mergeSaves(localData, cloudResult.data);
              }
            } else if (option === 'use_local' && localData) {
              dataToSend = localData;
            }
            
            const result = await resolveConflict(conflictId, option, dataToSend);
            
            if (!result.ok) {
              throw new Error(result.error || 'Resolve failed');
            }
            
            // Удаляем конфликт из списка
            set((state) => ({
              conflicts: state.conflicts.filter((c) => c.id !== conflictId),
              hasUnresolvedConflicts: state.conflicts.length > 1,
            }));
            
            return true;
          } catch (error) {
            console.error('Failed to resolve conflict:', error);
            return false;
          }
        },
        
        dismissConflict: (conflictId) => {
          set((state) => ({
            conflicts: state.conflicts.filter((c) => c.id !== conflictId),
            hasUnresolvedConflicts: state.conflicts.length > 1,
          }));
        },
        
        // Backups
        createBackup: async (slotId, reason, name) => {
          try {
            const result = await createBackup(slotId, reason, name);
            
            if (!result.ok || !result.backup) {
              throw new Error(result.error || 'Backup failed');
            }
            
            set((state) => ({
              backups: [result.backup!, ...state.backups].slice(0, state.settings.maxBackups),
            }));
            
            return result.backup;
          } catch (error) {
            console.error('Failed to create backup:', error);
            return null;
          }
        },
        
        restoreBackup: async (backupId, targetSlotId) => {
          try {
            const result = await restoreBackup(backupId, targetSlotId);
            
            if (!result.ok) {
              throw new Error(result.error || 'Restore failed');
            }
            
            return result.data || null;
          } catch (error) {
            console.error('Failed to restore backup:', error);
            return null;
          }
        },
        
        deleteBackup: async (backupId) => {
          try {
            const result = await deleteBackup(backupId);
            
            if (!result.ok) {
              throw new Error(result.error || 'Delete failed');
            }
            
            set((state) => ({
              backups: state.backups.filter((b) => b.id !== backupId),
            }));
            
            return true;
          } catch (error) {
            console.error('Failed to delete backup:', error);
            return false;
          }
        },
        
        refreshBackups: async () => {
          try {
            const result = await listBackups();
            
            if (result.ok && result.backups) {
              set({ backups: result.backups });
            }
          } catch (error) {
            console.error('Failed to refresh backups:', error);
          }
        },
        
        // Device management
        registerDevice: async () => {
          try {
            const result = await registerDevice();
            
            if (result.ok && result.device) {
              set({ currentDevice: result.device });
            }
          } catch (error) {
            console.error('Failed to register device:', error);
          }
        },
        
        refreshDevices: async () => {
          try {
            const result = await listDevices();
            
            if (result.ok && result.devices) {
              set({ knownDevices: result.devices });
            }
          } catch (error) {
            console.error('Failed to refresh devices:', error);
          }
        },
        
        // Connection
        checkConnection: async () => {
          const connected = await checkConnection();
          set({ isConnected: connected });
        },
        
        setOnline: (online) => {
          set({ isOnline: online });
        },
        
        setAuthenticated: (authenticated) => {
          set({ isAuthenticated: authenticated });
          
          if (authenticated) {
            // Регистрируем устройство при авторизации
            get().registerDevice();
            get().refreshBackups();
            get().refreshDevices();
          }
        },
        
        // Errors
        clearError: () => {
          set({ error: null });
        },
        
        // Internal
        markChange: () => {
          set((state) => ({
            pendingChanges: state.pendingChanges + 1,
            lastChangeAt: Date.now(),
          }));
        },
        
        clearPendingChanges: () => {
          set({ pendingChanges: 0 });
        },
        
        // Stats
        recordSync: (success, duration, bytes) => {
          set((state) => {
            const stats = { ...state.stats };
            stats.totalSyncs++;
            
            if (success) {
              stats.successfulSyncs++;
              stats.totalDataTransferred += bytes;
              stats.lastSyncDuration = duration;
              
              // Пересчитываем среднее время
              stats.averageSyncTime = 
                (stats.averageSyncTime * (stats.successfulSyncs - 1) + duration) / 
                stats.successfulSyncs;
            } else {
              stats.failedSyncs++;
            }
            
            return { stats };
          });
        },
      }),
      {
        name: 'sync-store',
        partialize: (state) => ({
          settings: state.settings,
          currentDevice: state.currentDevice,
          stats: state.stats,
        }),
      }
    )
  )
);

// Слушаем изменения настроек для управления автосинхронизацией
useSyncStore.subscribe(
  (state) => state.settings.autoSync,
  (autoSync) => {
    if (autoSync) {
      startAutoSync();
    } else {
      stopAutoSync();
    }
  }
);

// Слушаем изменения интервала
useSyncStore.subscribe(
  (state) => state.settings.syncIntervalMinutes,
  () => {
    const state = useSyncStore.getState();
    if (state.settings.autoSync) {
      stopAutoSync();
      startAutoSync();
    }
  }
);

/**
 * Запустить автосинхронизацию
 */
function startAutoSync() {
  if (syncInterval) return;
  
  const state = useSyncStore.getState();
  const intervalMs = state.settings.syncIntervalMinutes * 60 * 1000;
  
  syncInterval = setInterval(() => {
    const currentState = useSyncStore.getState();
    
    if (
      currentState.settings.enabled &&
      currentState.settings.autoSync &&
      currentState.isOnline &&
      currentState.isAuthenticated &&
      currentState.pendingChanges > 0
    ) {
      // Нужно получить данные сохранения из gameStore
      // Это будет интегрировано в компоненте
      console.log('[AutoSync] Would sync now, pending changes:', currentState.pendingChanges);
    }
  }, intervalMs);
}

/**
 * Остановить автосинхронизацию
 */
function stopAutoSync() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}

/**
 * Слушать события онлайн/оффлайн
 */
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    useSyncStore.getState().setOnline(true);
  });
  
  window.addEventListener('offline', () => {
    useSyncStore.getState().setOnline(false);
  });
  
  // Синхронизация при возврате на вкладку
  document.addEventListener('visibilitychange', () => {
    const state = useSyncStore.getState();
    
    if (document.visibilityState === 'visible') {
      if (state.settings.syncOnFocus && state.pendingChanges > 0) {
        console.log('[Sync] Tab focused, would sync...');
      }
    } else {
      if (state.settings.syncOnBlur && state.pendingChanges > 0) {
        console.log('[Sync] Tab blurred, would sync...');
      }
    }
  });
}
