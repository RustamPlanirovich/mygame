/**
 * Cloud Sync Types - Фаза 8
 * Типы для синхронизации сохранений между устройствами
 */

// Информация об устройстве
export interface DeviceInfo {
  id: string;              // Уникальный ID устройства
  name: string;            // Имя устройства (например, "iPhone 15 Pro", "MacBook Pro")
  platform: 'web' | 'ios' | 'android' | 'desktop';
  browser?: string;        // Браузер для web
  os?: string;             // ОС
  lastSeen: number;        // timestamp последней активности
}

// Информация о сохранении
export interface SaveInfo {
  id: string;
  slotId: number;          // ID игрового слота
  name: string;
  timestamp: number;       // Время создания/обновления
  deviceId: string;        // ID устройства, с которого создано
  deviceName: string;      // Имя устройства
  version: string;         // Версия игры
  playTime: number;        // Общее время игры в секундах
  checksum: string;        // SHA-256 для проверки целостности
  compressed: boolean;     // Сжато ли сохранение
  size: number;            // Размер в байтах
  era?: number;            // Текущая эра в игре
  credits?: string;        // Количество кредитов (для превью)
  buildingsCount?: number; // Количество зданий (для превью)
}

// Конфликт сохранений
export interface SaveConflict {
  id: string;
  localSave: SaveInfo;
  cloudSave: SaveInfo;
  detectedAt: number;      // Когда обнаружен конфликт
  resolved: boolean;
  resolveOptions: SaveConflictResolveOption[];
}

export type SaveConflictResolveOption = 
  | 'use_local'   // Использовать локальное сохранение
  | 'use_cloud'   // Использовать облачное сохранение
  | 'merge'       // Объединить (взять лучшее из обоих)
  | 'keep_both';  // Сохранить оба как отдельные слоты

// Способ разрешения конфликта
export interface ConflictResolution {
  conflictId: string;
  option: SaveConflictResolveOption;
  timestamp: number;
  appliedBy: 'user' | 'auto';  // Кто применил: пользователь или авто-резолвер
}

// Резервная копия
export interface BackupInfo {
  id: string;
  saveId: string;
  slotId: number;
  name: string;
  createdAt: number;
  reason: BackupReason;
  expiresAt: number;
  size: number;
  checksum: string;
}

export type BackupReason = 
  | 'auto'            // Автоматическая (ежедневная)
  | 'manual'          // Созданная вручную
  | 'before_update'   // Перед обновлением игры
  | 'before_merge'    // Перед слиянием
  | 'before_restore'; // Перед восстановлением

// Состояние синхронизации
export interface SyncState {
  // Статус подключения
  isConnected: boolean;
  isOnline: boolean;           // Есть ли интернет
  isAuthenticated: boolean;    // Авторизован ли пользователь
  
  // Синхронизация
  lastSyncAt: number | null;   // Когда последний раз синхронизировались
  nextSyncAt: number | null;   // Когда следующая синхронизация
  syncInProgress: boolean;     // Идёт ли синхронизация
  syncProgress: number;        // 0-100%
  
  // Изменения
  pendingChanges: number;      // Количество несинхронизированных изменений
  lastChangeAt: number | null; // Когда было последнее изменение
  
  // Конфликты
  conflicts: SaveConflict[];
  hasUnresolvedConflicts: boolean;
  
  // Резервные копии
  backups: BackupInfo[];
  
  // Устройства
  currentDevice: DeviceInfo | null;
  knownDevices: DeviceInfo[];
  
  // Ошибки
  error: SyncError | null;
  lastError: SyncError | null;
  consecutiveErrors: number;
  
  // Статистика
  stats: SyncStats;
}

// Статистика синхронизации
export interface SyncStats {
  totalSyncs: number;
  successfulSyncs: number;
  failedSyncs: number;
  totalDataTransferred: number; // Байт
  averageSyncTime: number;      // Миллисекунд
  lastSyncDuration: number;     // Миллисекунд
}

// Ошибка синхронизации
export interface SyncError {
  code: SyncErrorCode;
  message: string;
  timestamp: number;
  retryable: boolean;
  details?: Record<string, unknown>;
}

export type SyncErrorCode = 
  | 'NETWORK_ERROR'       // Ошибка сети
  | 'AUTH_REQUIRED'       // Требуется авторизация
  | 'AUTH_EXPIRED'        // Сессия истекла
  | 'SERVER_ERROR'        // Ошибка сервера
  | 'QUOTA_EXCEEDED'      // Превышен лимит хранилища
  | 'CHECKSUM_MISMATCH'   // Не совпала контрольная сумма
  | 'VERSION_MISMATCH'    // Несовместимая версия
  | 'CONFLICT_UNRESOLVED' // Есть неразрешённый конфликт
  | 'SAVE_TOO_LARGE'      // Сохранение слишком большое
  | 'RATE_LIMITED'        // Слишком много запросов
  | 'UNKNOWN';            // Неизвестная ошибка

// Настройки синхронизации
export interface SyncSettings {
  enabled: boolean;             // Включена ли синхронизация
  autoSync: boolean;            // Автоматическая синхронизация
  syncIntervalMinutes: number;  // Интервал автосинхронизации (5-60)
  syncOnFocus: boolean;         // Синхронизировать при возврате в игру
  syncOnBlur: boolean;          // Синхронизировать при уходе из игры
  
  // Бэкапы
  autoBackupEnabled: boolean;   // Автоматические бэкапы
  autoBackupIntervalHours: number; // Интервал (24ч по умолчанию)
  maxBackups: number;           // Максимум бэкапов (по умолчанию 10)
  backupRetentionDays: number;  // Сколько дней хранить (30)
  
  // Конфликты
  autoResolveConflicts: boolean;     // Авто-разрешение конфликтов
  autoResolvePreference: 'local' | 'cloud' | 'newer' | 'ask';
  
  // Сжатие
  compressionEnabled: boolean;  // Сжимать сохранения
  compressionLevel: 1 | 2 | 3;  // Уровень сжатия (1 = быстрое, 3 = максимальное)
  
  // Уведомления
  notifyOnSync: boolean;        // Уведомлять об успешной синхронизации
  notifyOnConflict: boolean;    // Уведомлять о конфликтах
  notifyOnError: boolean;       // Уведомлять об ошибках
}

// Дефолтные настройки
export const DEFAULT_SYNC_SETTINGS: SyncSettings = {
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
};

// Начальное состояние
export const INITIAL_SYNC_STATE: SyncState = {
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
};

// API типы
export interface SyncRequest {
  slotId: number;
  deviceId: string;
  deviceName: string;
  localTimestamp: number;
  checksum: string;
  data: string;            // Base64 encoded (compressed or not)
  compressed: boolean;
  version: string;
  forcePush?: boolean;     // Принудительно перезаписать сервер
}

export interface SyncResponse {
  ok: boolean;
  status: 'synced' | 'conflict' | 'updated' | 'no_change';
  serverTimestamp?: number;
  serverChecksum?: string;
  conflict?: SaveConflict;
  cloudSave?: {
    data: string;
    timestamp: number;
    checksum: string;
    compressed: boolean;
  };
  error?: string;
}

export interface BackupCreateRequest {
  slotId: number;
  reason: BackupReason;
  name?: string;
}

export interface BackupRestoreRequest {
  backupId: string;
  targetSlotId?: number;   // Если не указан, восстановит в оригинальный слот
}

// Операции синхронизации
export type SyncOperation = 
  | { type: 'PUSH'; slotId: number }
  | { type: 'PULL'; slotId: number }
  | { type: 'RESOLVE_CONFLICT'; conflictId: string; option: SaveConflictResolveOption }
  | { type: 'CREATE_BACKUP'; slotId: number; reason: BackupReason }
  | { type: 'RESTORE_BACKUP'; backupId: string }
  | { type: 'DELETE_BACKUP'; backupId: string }
  | { type: 'REFRESH_STATUS' };

// События синхронизации
export type SyncEvent = 
  | { type: 'SYNC_STARTED' }
  | { type: 'SYNC_PROGRESS'; progress: number }
  | { type: 'SYNC_COMPLETED'; duration: number }
  | { type: 'SYNC_FAILED'; error: SyncError }
  | { type: 'CONFLICT_DETECTED'; conflict: SaveConflict }
  | { type: 'CONFLICT_RESOLVED'; conflictId: string; option: SaveConflictResolveOption }
  | { type: 'BACKUP_CREATED'; backup: BackupInfo }
  | { type: 'BACKUP_RESTORED'; backupId: string }
  | { type: 'CONNECTION_CHANGED'; isConnected: boolean }
  | { type: 'DEVICE_REGISTERED'; device: DeviceInfo };
