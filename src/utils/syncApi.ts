/**
 * Sync API - Фаза 8
 * API клиент для синхронизации с сервером
 */

import type {
  SyncRequest,
  SyncResponse,
  SaveInfo,
  BackupInfo,
  BackupReason,
  DeviceInfo,
  SyncError,
  SyncErrorCode,
  BackupCreateRequest,
  BackupRestoreRequest,
} from '../core/gameTypes.sync';
import { compressSave, decompressSave, computeChecksum } from './saveCompressor';
import type { CompressionLevel } from './saveCompressor';

// Базовый URL API
const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5174';

// Версия игры для совместимости
const GAME_VERSION = import.meta.env.VITE_GAME_VERSION || '1.0.0';

// ID устройства (генерируется один раз и сохраняется)
let deviceId: string | null = null;
let deviceName: string | null = null;

/**
 * Получить или создать ID устройства
 */
export function getDeviceId(): string {
  if (deviceId) return deviceId;
  
  // Пробуем получить из localStorage
  deviceId = localStorage.getItem('deviceId');
  
  if (!deviceId) {
    // Генерируем новый ID
    deviceId = `device_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    localStorage.setItem('deviceId', deviceId);
  }
  
  return deviceId;
}

/**
 * Получить имя устройства
 */
export function getDeviceName(): string {
  if (deviceName) return deviceName;
  
  deviceName = localStorage.getItem('deviceName');
  
  if (!deviceName) {
    // Определяем имя устройства автоматически
    const ua = navigator.userAgent;
    let name = 'Unknown Device';
    
    if (/iPhone/.test(ua)) name = 'iPhone';
    else if (/iPad/.test(ua)) name = 'iPad';
    else if (/Android/.test(ua)) name = 'Android Device';
    else if (/Macintosh/.test(ua)) name = 'Mac';
    else if (/Windows/.test(ua)) name = 'Windows PC';
    else if (/Linux/.test(ua)) name = 'Linux PC';
    
    // Добавляем браузер
    if (/Chrome/.test(ua) && !/Edge/.test(ua)) name += ' (Chrome)';
    else if (/Firefox/.test(ua)) name += ' (Firefox)';
    else if (/Safari/.test(ua) && !/Chrome/.test(ua)) name += ' (Safari)';
    else if (/Edge/.test(ua)) name += ' (Edge)';
    
    deviceName = name;
    localStorage.setItem('deviceName', deviceName);
  }
  
  return deviceName;
}

/**
 * Установить имя устройства вручную
 */
export function setDeviceName(name: string): void {
  deviceName = name;
  localStorage.setItem('deviceName', name);
}

/**
 * Получить информацию о текущем устройстве
 */
export function getCurrentDevice(): DeviceInfo {
  const ua = navigator.userAgent;
  
  let platform: DeviceInfo['platform'] = 'web';
  if (/iPhone|iPad/.test(ua)) platform = 'ios';
  else if (/Android/.test(ua)) platform = 'android';
  
  let browser: string | undefined;
  if (/Chrome/.test(ua) && !/Edge/.test(ua)) browser = 'Chrome';
  else if (/Firefox/.test(ua)) browser = 'Firefox';
  else if (/Safari/.test(ua) && !/Chrome/.test(ua)) browser = 'Safari';
  else if (/Edge/.test(ua)) browser = 'Edge';
  
  let os: string | undefined;
  if (/Windows/.test(ua)) os = 'Windows';
  else if (/Macintosh/.test(ua)) os = 'macOS';
  else if (/Linux/.test(ua)) os = 'Linux';
  else if (/iPhone|iPad/.test(ua)) os = 'iOS';
  else if (/Android/.test(ua)) os = 'Android';
  
  return {
    id: getDeviceId(),
    name: getDeviceName(),
    platform,
    browser,
    os,
    lastSeen: Date.now(),
  };
}

/**
 * Получить токен авторизации
 */
function getAuthToken(): string | null {
  return localStorage.getItem('authToken');
}

/**
 * Создать заголовки запроса
 */
function createHeaders(): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
}

/**
 * Преобразовать ошибку в SyncError
 */
function createSyncError(
  code: SyncErrorCode,
  message: string,
  details?: Record<string, unknown>
): SyncError {
  return {
    code,
    message,
    timestamp: Date.now(),
    retryable: ['NETWORK_ERROR', 'SERVER_ERROR', 'RATE_LIMITED'].includes(code),
    details,
  };
}

/**
 * Обработать HTTP ошибку
 */
function handleHttpError(status: number, message: string): SyncError {
  switch (status) {
    case 401:
      return createSyncError('AUTH_REQUIRED', 'Требуется авторизация');
    case 403:
      return createSyncError('AUTH_EXPIRED', 'Сессия истекла, войдите заново');
    case 409:
      return createSyncError('CONFLICT_UNRESOLVED', message);
    case 413:
      return createSyncError('SAVE_TOO_LARGE', 'Сохранение слишком большое');
    case 429:
      return createSyncError('RATE_LIMITED', 'Слишком много запросов, подождите');
    case 500:
    case 502:
    case 503:
      return createSyncError('SERVER_ERROR', 'Ошибка сервера, попробуйте позже');
    default:
      return createSyncError('UNKNOWN', message);
  }
}

// ========== SYNC API ==========

/**
 * Синхронизировать сохранение с сервером
 */
export async function syncSave(
  slotId: number,
  saveData: string,
  compress: boolean = true,
  compressionLevel: CompressionLevel = 2,
  forcePush: boolean = false
): Promise<SyncResponse> {
  try {
    const token = getAuthToken();
    if (!token) {
      return {
        ok: false,
        status: 'no_change',
        error: 'NOT_AUTHENTICATED',
      };
    }
    
    let data = saveData;
    let checksum = await computeChecksum(saveData);
    
    // Сжимаем если нужно
    if (compress) {
      const compressed = await compressSave(saveData, compressionLevel);
      data = compressed.data;
    }
    
    const request: SyncRequest = {
      slotId,
      deviceId: getDeviceId(),
      deviceName: getDeviceName(),
      localTimestamp: Date.now(),
      checksum,
      data,
      compressed: compress,
      version: GAME_VERSION,
      forcePush,
    };
    
    const response = await fetch(`${API_BASE}/api/sync/save`, {
      method: 'POST',
      headers: createHeaders(),
      body: JSON.stringify(request),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw handleHttpError(response.status, errorData.error || 'Sync failed');
    }
    
    return await response.json();
  } catch (error) {
    if (error instanceof TypeError) {
      // Network error
      return {
        ok: false,
        status: 'no_change',
        error: 'NETWORK_ERROR',
      };
    }
    throw error;
  }
}

/**
 * Получить сохранение с сервера
 */
export async function pullSave(slotId: number): Promise<{
  ok: boolean;
  save?: SaveInfo;
  data?: string;
  error?: string;
}> {
  try {
    const response = await fetch(`${API_BASE}/api/sync/save/${slotId}`, {
      method: 'GET',
      headers: createHeaders(),
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        return { ok: true }; // Нет сохранения на сервере
      }
      const errorData = await response.json().catch(() => ({}));
      throw handleHttpError(response.status, errorData.error || 'Pull failed');
    }
    
    const result = await response.json();
    
    // Распаковываем если сжато
    if (result.compressed && result.data) {
      const decompressed = await decompressSave(
        result.data,
        'lz-string-base64',
        result.checksum
      );
      result.data = decompressed.data;
    }
    
    return result;
  } catch (error) {
    if (error instanceof TypeError) {
      return { ok: false, error: 'NETWORK_ERROR' };
    }
    throw error;
  }
}

/**
 * Получить список сохранений на сервере
 */
export async function listCloudSaves(): Promise<{
  ok: boolean;
  saves?: SaveInfo[];
  error?: string;
}> {
  try {
    const response = await fetch(`${API_BASE}/api/sync/saves`, {
      method: 'GET',
      headers: createHeaders(),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw handleHttpError(response.status, errorData.error || 'List failed');
    }
    
    return await response.json();
  } catch (error) {
    if (error instanceof TypeError) {
      return { ok: false, error: 'NETWORK_ERROR' };
    }
    throw error;
  }
}

/**
 * Удалить сохранение с сервера
 */
export async function deleteCloudSave(saveId: string): Promise<{
  ok: boolean;
  error?: string;
}> {
  try {
    const response = await fetch(`${API_BASE}/api/sync/save/${saveId}`, {
      method: 'DELETE',
      headers: createHeaders(),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw handleHttpError(response.status, errorData.error || 'Delete failed');
    }
    
    return await response.json();
  } catch (error) {
    if (error instanceof TypeError) {
      return { ok: false, error: 'NETWORK_ERROR' };
    }
    throw error;
  }
}

// ========== BACKUP API ==========

/**
 * Создать резервную копию
 */
export async function createBackup(
  slotId: number,
  reason: BackupReason,
  name?: string
): Promise<{
  ok: boolean;
  backup?: BackupInfo;
  error?: string;
}> {
  try {
    const request: BackupCreateRequest = {
      slotId,
      reason,
      name,
    };
    
    const response = await fetch(`${API_BASE}/api/sync/backups`, {
      method: 'POST',
      headers: createHeaders(),
      body: JSON.stringify(request),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw handleHttpError(response.status, errorData.error || 'Backup failed');
    }
    
    return await response.json();
  } catch (error) {
    if (error instanceof TypeError) {
      return { ok: false, error: 'NETWORK_ERROR' };
    }
    throw error;
  }
}

/**
 * Получить список резервных копий
 */
export async function listBackups(slotId?: number): Promise<{
  ok: boolean;
  backups?: BackupInfo[];
  error?: string;
}> {
  try {
    const url = slotId
      ? `${API_BASE}/api/sync/backups?slotId=${slotId}`
      : `${API_BASE}/api/sync/backups`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: createHeaders(),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw handleHttpError(response.status, errorData.error || 'List backups failed');
    }
    
    return await response.json();
  } catch (error) {
    if (error instanceof TypeError) {
      return { ok: false, error: 'NETWORK_ERROR' };
    }
    throw error;
  }
}

/**
 * Восстановить из резервной копии
 */
export async function restoreBackup(
  backupId: string,
  targetSlotId?: number
): Promise<{
  ok: boolean;
  data?: string;
  error?: string;
}> {
  try {
    const request: BackupRestoreRequest = {
      backupId,
      targetSlotId,
    };
    
    const response = await fetch(`${API_BASE}/api/sync/backups/restore`, {
      method: 'POST',
      headers: createHeaders(),
      body: JSON.stringify(request),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw handleHttpError(response.status, errorData.error || 'Restore failed');
    }
    
    const result = await response.json();
    
    // Распаковываем если сжато
    if (result.compressed && result.data) {
      const decompressed = await decompressSave(
        result.data,
        'lz-string-base64',
        result.checksum
      );
      result.data = decompressed.data;
    }
    
    return result;
  } catch (error) {
    if (error instanceof TypeError) {
      return { ok: false, error: 'NETWORK_ERROR' };
    }
    throw error;
  }
}

/**
 * Удалить резервную копию
 */
export async function deleteBackup(backupId: string): Promise<{
  ok: boolean;
  error?: string;
}> {
  try {
    const response = await fetch(`${API_BASE}/api/sync/backups/${backupId}`, {
      method: 'DELETE',
      headers: createHeaders(),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw handleHttpError(response.status, errorData.error || 'Delete backup failed');
    }
    
    return await response.json();
  } catch (error) {
    if (error instanceof TypeError) {
      return { ok: false, error: 'NETWORK_ERROR' };
    }
    throw error;
  }
}

// ========== DEVICE API ==========

/**
 * Зарегистрировать устройство
 */
export async function registerDevice(): Promise<{
  ok: boolean;
  device?: DeviceInfo;
  error?: string;
}> {
  try {
    const device = getCurrentDevice();
    
    const response = await fetch(`${API_BASE}/api/sync/devices`, {
      method: 'POST',
      headers: createHeaders(),
      body: JSON.stringify(device),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw handleHttpError(response.status, errorData.error || 'Register device failed');
    }
    
    return await response.json();
  } catch (error) {
    if (error instanceof TypeError) {
      return { ok: false, error: 'NETWORK_ERROR' };
    }
    throw error;
  }
}

/**
 * Получить список известных устройств
 */
export async function listDevices(): Promise<{
  ok: boolean;
  devices?: DeviceInfo[];
  error?: string;
}> {
  try {
    const response = await fetch(`${API_BASE}/api/sync/devices`, {
      method: 'GET',
      headers: createHeaders(),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw handleHttpError(response.status, errorData.error || 'List devices failed');
    }
    
    return await response.json();
  } catch (error) {
    if (error instanceof TypeError) {
      return { ok: false, error: 'NETWORK_ERROR' };
    }
    throw error;
  }
}

// ========== CONFLICT API ==========

/**
 * Разрешить конфликт сохранений
 */
export async function resolveConflict(
  conflictId: string,
  option: 'use_local' | 'use_cloud' | 'merge' | 'keep_both',
  localData?: string,
  mergedData?: string
): Promise<{
  ok: boolean;
  error?: string;
}> {
  try {
    const body: Record<string, unknown> = {
      conflictId,
      option,
    };
    
    if (option === 'use_local' && localData) {
      body.data = localData;
    } else if (option === 'merge' && mergedData) {
      body.data = mergedData;
    }
    
    const response = await fetch(`${API_BASE}/api/sync/conflicts/resolve`, {
      method: 'POST',
      headers: createHeaders(),
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw handleHttpError(response.status, errorData.error || 'Resolve conflict failed');
    }
    
    return await response.json();
  } catch (error) {
    if (error instanceof TypeError) {
      return { ok: false, error: 'NETWORK_ERROR' };
    }
    throw error;
  }
}

// ========== STATUS API ==========

/**
 * Проверить статус подключения к серверу
 */
export async function checkConnection(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/api/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Получить статус синхронизации
 */
export async function getSyncStatus(): Promise<{
  ok: boolean;
  lastSync?: number;
  pendingChanges?: number;
  hasConflicts?: boolean;
  error?: string;
}> {
  try {
    const response = await fetch(`${API_BASE}/api/sync/status`, {
      method: 'GET',
      headers: createHeaders(),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw handleHttpError(response.status, errorData.error || 'Get status failed');
    }
    
    return await response.json();
  } catch (error) {
    if (error instanceof TypeError) {
      return { ok: false, error: 'NETWORK_ERROR' };
    }
    throw error;
  }
}
