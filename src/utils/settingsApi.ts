// API для работы с настройками пользователя и авторизацией

import type { GameSettings } from '../core/gameTypes.settings';
import type { ResourceType } from '../core/gameTypes';
import { DEFAULT_SETTINGS } from '../core/gameTypes.settings';

const API_URL = 'http://127.0.0.1:5174';

// ========== AUTH TOKENS ==========

/**
 * Получить токен авторизации из localStorage
 */
export const getAuthToken = (): string | null => {
  return localStorage.getItem('authToken');
};

/**
 * Сохранить токен авторизации
 */
export const setAuthToken = (token: string): void => {
  localStorage.setItem('authToken', token);
};

/**
 * Удалить токен авторизации
 */
export const removeAuthToken = (): void => {
  localStorage.removeItem('authToken');
};

/**
 * Получить заголовки для авторизованных запросов
 */
export const getAuthHeaders = (): Record<string, string> => {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
};

/**
 * Проверить, авторизован ли пользователь
 */
export const isAuthenticated = (): boolean => {
  return !!getAuthToken();
};

/**
 * Получить информацию о текущей сессии
 */
export const getCurrentSession = async (): Promise<{ ok: boolean; user?: any; error?: string }> => {
  if (!isAuthenticated()) {
    return { ok: false, error: 'NOT_AUTHENTICATED' };
  }

  try {
    const response = await fetch(`${API_URL}/api/auth/session`, {
      headers: getAuthHeaders(),
    });

    const data = await response.json();
    
    if (response.status === 401) {
      // Токен недействителен, удаляем его
      removeAuthToken();
      return { ok: false, error: 'INVALID_TOKEN' };
    }
    
    return data;
  } catch (err) {
    console.error('Ошибка получения сессии:', err);
    return { ok: false, error: 'CONNECTION_ERROR' };
  }
};

/**
 * Выход (удаление текущей сессии)
 */
export const logout = async (): Promise<{ ok: boolean; error?: string }> => {
  if (!isAuthenticated()) {
    return { ok: true };
  }

  try {
    const response = await fetch(`${API_URL}/api/auth/logout`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });

    const data = await response.json();
    
    // Всегда удаляем токен локально, даже если запрос не удался
    removeAuthToken();
    
    return data;
  } catch (err) {
    console.error('Ошибка выхода:', err);
    removeAuthToken();
    return { ok: true };
  }
};

/**
 * Получить ID текущего пользователя из localStorage
 * @deprecated Используйте getCurrentSession() вместо этого
 */
export const getUserId = (): string | null => {
  const userStr = localStorage.getItem('user');
  if (!userStr) return null;
  try {
    const user = JSON.parse(userStr);
    return user.id?.toString() || null;
  } catch {
    return null;
  }
};

/**
 * Загрузить настройки пользователя с сервера
 */
export const loadSettingsFromServer = async (): Promise<GameSettings> => {
  if (!isAuthenticated()) {
    return DEFAULT_SETTINGS;
  }

  try {
    const response = await fetch(`${API_URL}/api/settings`, {
      headers: getAuthHeaders(),
    });

    if (response.status === 401) {
      removeAuthToken();
      return DEFAULT_SETTINGS;
    }

    const data = await response.json();
    
    if (data.ok && data.settings && Object.keys(data.settings).length > 0) {
      // Мерджим с дефолтными настройками на случай, если в БД сохранены не все поля
      return { ...DEFAULT_SETTINGS, ...data.settings };
    }
    
    return DEFAULT_SETTINGS;
  } catch (err) {
    console.error('Ошибка загрузки настроек:', err);
    return DEFAULT_SETTINGS;
  }
};

/**
 * Сохранить настройки пользователя на сервер
 */
export const saveSettingsToServer = async (settings: GameSettings): Promise<{ ok: boolean; error?: string }> => {
  if (!isAuthenticated()) {
    return { ok: false, error: 'NOT_AUTHENTICATED' };
  }

  try {
    const response = await fetch(`${API_URL}/api/settings`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ settings }),
    });

    if (response.status === 401) {
      removeAuthToken();
      return { ok: false, error: 'NOT_AUTHENTICATED' };
    }

    const data = await response.json();
    return data;
  } catch (err) {
    console.error('Ошибка сохранения настроек:', err);
    return { ok: false, error: 'Ошибка подключения к серверу' };
  }
};

/**
 * Применить настройки (можно добавить логику применения настроек к игре)
 */
export const applySettings = (settings: GameSettings) => {
  // Здесь можно добавить логику применения настроек
  // Например, изменение FPS, включение/выключение анимаций и т.д.
  console.log('Применение настроек:', settings);
};

// ========== USER PREFERENCES API ==========

/**
 * Загрузить pinned resources с сервера
 */
export const loadPinnedResourcesFromServer = async (): Promise<ResourceType[]> => {
  const DEFAULT_PINNED: ResourceType[] = ['energy', 'ore', 'ice', 'carbon', 'steel', 'dark_matter'];
  
  if (!isAuthenticated()) {
    return DEFAULT_PINNED;
  }

  try {
    const response = await fetch(`${API_URL}/api/preferences/pinned-resources`, {
      headers: getAuthHeaders(),
    });

    if (response.status === 401) {
      removeAuthToken();
      return DEFAULT_PINNED;
    }

    const data = await response.json();
    
    if (data.ok && Array.isArray(data.pinnedResources)) {
      return data.pinnedResources;
    }
    
    return DEFAULT_PINNED;
  } catch (err) {
    console.error('Ошибка загрузки pinned resources:', err);
    return DEFAULT_PINNED;
  }
};

/**
 * Сохранить pinned resources на сервер
 */
export const savePinnedResourcesToServer = async (pinnedResources: ResourceType[]): Promise<{ ok: boolean; error?: string }> => {
  if (!isAuthenticated()) {
    return { ok: false, error: 'NOT_AUTHENTICATED' };
  }

  try {
    const response = await fetch(`${API_URL}/api/preferences/pinned-resources`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ pinnedResources }),
    });

    if (response.status === 401) {
      removeAuthToken();
      return { ok: false, error: 'NOT_AUTHENTICATED' };
    }

    const data = await response.json();
    return data;
  } catch (err) {
    console.error('Ошибка сохранения pinned resources:', err);
    return { ok: false, error: 'Ошибка подключения к серверу' };
  }
};

/**
 * Загрузить current save ID с сервера
 */
export const loadCurrentSaveIdFromServer = async (): Promise<number | null> => {
  if (!isAuthenticated()) {
    // Если пользователь не авторизован, загружаем из localStorage
    const savedId = localStorage.getItem('currentSaveId');
    return savedId ? parseInt(savedId, 10) : null;
  }

  try {
    const response = await fetch(`${API_URL}/api/preferences/current-save`, {
      headers: getAuthHeaders(),
    });

    if (response.status === 401) {
      removeAuthToken();
      return null;
    }

    const data = await response.json();
    
    if (data.ok) {
      return data.currentSaveId;
    }
    
    return null;
  } catch (err) {
    console.error('Ошибка загрузки current save ID:', err);
    return null;
  }
};

/**
 * Сохранить current save ID на сервер
 */
export const saveCurrentSaveIdToServer = async (currentSaveId: number | null): Promise<{ ok: boolean; error?: string }> => {
  if (!isAuthenticated()) {
    // Если пользователь не авторизован, сохраняем в localStorage
    if (currentSaveId !== null) {
      localStorage.setItem('currentSaveId', currentSaveId.toString());
    } else {
      localStorage.removeItem('currentSaveId');
    }
    return { ok: true };
  }

  try {
    const response = await fetch(`${API_URL}/api/preferences/current-save`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ currentSaveId }),
    });

    if (response.status === 401) {
      removeAuthToken();
      return { ok: false, error: 'NOT_AUTHENTICATED' };
    }

    const data = await response.json();
    
    // Также сохраняем в localStorage для быстрого доступа
    if (data.ok) {
      if (currentSaveId !== null) {
        localStorage.setItem('currentSaveId', currentSaveId.toString());
      } else {
        localStorage.removeItem('currentSaveId');
      }
    }
    
    return data;
  } catch (err) {
    console.error('Ошибка сохранения current save ID:', err);
    return { ok: false, error: 'Ошибка подключения к серверу' };
  }
};
