import { useState, useEffect } from 'react';
import { getCurrentSession, logout, loadSettingsFromServer, saveSettingsToServer } from '../../utils/settingsApi';
import { DEFAULT_SETTINGS } from '../../core/gameTypes.settings';
import type { GameSettings } from '../../core/gameTypes.settings';
import { Save, LogOut, User, Mail, Shield, Clock } from 'lucide-react';

interface ProfilePanelProps {
  onShowSaveManager: () => void;
  onClose: () => void;
}

export const ProfilePanel = ({ onShowSaveManager, onClose }: ProfilePanelProps) => {
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  const [isSaving, setIsSaving] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<{
    email: string;
    createdAt: string;
    lastActivityAt: string;
  } | null>(null);

  // Загружаем информацию о сессии и настройки
  useEffect(() => {
    const loadData = async () => {
      try {
        const session = await getCurrentSession();
        if (session.ok && session.user) {
          setSessionInfo({
            email: session.user.email,
            createdAt: session.user.created_at || session.user.createdAt,
            lastActivityAt: session.user.last_activity_at || session.user.lastActivityAt,
          });
        }
        
        const loadedSettings = await loadSettingsFromServer();
        setSettings(loadedSettings);
      } catch (error) {
        console.error('Ошибка загрузки данных:', error);
      }
    };
    
    loadData();
  }, []);

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      await saveSettingsToServer(settings);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      onClose();
      window.location.reload();
    } catch (error) {
      console.error('Ошибка при выходе:', error);
      onClose();
      window.location.reload();
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="p-4 space-y-6">
      {/* Информация о пользователе */}
      <div className="bg-cyber-darker border border-cyber-gray rounded-lg p-4 space-y-3">
        <h3 className="text-lg font-bold text-cyber-green flex items-center gap-2">
          <User className="w-5 h-5" />
          Профиль пользователя
        </h3>
        
        {sessionInfo && (
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-cyan-400">
              <Mail className="w-4 h-4" />
              <span className="text-cyber-text-dim">Email:</span>
              <span className="font-mono">{sessionInfo.email}</span>
            </div>
            
            <div className="flex items-center gap-2 text-green-400">
              <Shield className="w-4 h-4" />
              <span className="text-cyber-text-dim">Создано:</span>
              <span className="font-mono text-xs">{formatDate(sessionInfo.createdAt)}</span>
            </div>
            
            <div className="flex items-center gap-2 text-yellow-400">
              <Clock className="w-4 h-4" />
              <span className="text-cyber-text-dim">Активность:</span>
              <span className="font-mono text-xs">{formatDate(sessionInfo.lastActivityAt)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Управление сохранениями */}
      <div className="bg-cyber-darker border border-cyber-gray rounded-lg p-4 space-y-3">
        <h3 className="text-base font-bold text-cyber-green">Сохранения</h3>
        
        <button
          onClick={onShowSaveManager}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded transition-colors flex items-center justify-center gap-2"
        >
          <Save className="w-4 h-4" />
          Управление сохранениями
        </button>
      </div>

      {/* Настройки игры */}
      <div className="bg-cyber-darker border border-cyber-gray rounded-lg p-4 space-y-4">
        <h3 className="text-base font-bold text-cyber-green">Настройки игры</h3>
        
        {/* Графика */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-cyan-400">Графика</h4>
          
          <div className="space-y-2 text-sm">
            <label className="flex items-center justify-between">
              <span className="text-cyber-text-dim">Target FPS:</span>
              <select
                value={settings?.graphics?.targetFPS ?? 60}
                onChange={(e) => {
                  setSettings({
                    ...settings,
                    graphics: {
                      ...settings.graphics,
                      targetFPS: Number(e.target.value),
                    },
                  });
                }}
                className="bg-cyber-dark border border-cyber-gray rounded px-2 py-1"
              >
                <option value={30}>30 FPS</option>
                <option value={60}>60 FPS</option>
                <option value={120}>120 FPS</option>
              </select>
            </label>

            <label className="flex items-center justify-between">
              <span className="text-cyber-text-dim">Качество эффектов:</span>
              <select
                value={settings?.graphics?.quality ?? 'high'}
                onChange={(e) => {
                  setSettings({
                    ...settings,
                    graphics: {
                      ...settings.graphics,
                      quality: e.target.value as 'low' | 'medium' | 'high',
                    },
                  });
                }}
                className="bg-cyber-dark border border-cyber-gray rounded px-2 py-1"
              >
                <option value="low">Низкое</option>
                <option value="medium">Среднее</option>
                <option value="high">Высокое</option>
              </select>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings?.graphics?.particleEffects ?? true}
                onChange={(e) => {
                  setSettings({
                    ...settings,
                    graphics: {
                      ...settings.graphics,
                      particleEffects: e.target.checked,
                    },
                  });
                }}
                className="rounded"
              />
              <span className="text-cyber-text-dim">Частицы</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings?.graphics?.showAnimations ?? true}
                onChange={(e) => {
                  setSettings({
                    ...settings,
                    graphics: {
                      ...settings.graphics,
                      showAnimations: e.target.checked,
                    },
                  });
                }}
                className="rounded"
              />
              <span className="text-cyber-text-dim">Анимации</span>
            </label>
          </div>
        </div>

        {/* Звук */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-cyan-400">Звук</h4>
          
          <div className="space-y-2 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!settings?.audio?.muteAll}
                onChange={(e) => {
                  setSettings({
                    ...settings,
                    audio: {
                      ...settings.audio,
                      muteAll: !e.target.checked,
                    },
                  });
                }}
                className="rounded"
              />
              <span className="text-cyber-text-dim">Звук включен</span>
            </label>

            <label className="flex items-center justify-between">
              <span className="text-cyber-text-dim">Громкость музыки:</span>
              <input
                type="range"
                min="0"
                max="100"
                value={(settings?.audio?.musicVolume ?? 0.5) * 100}
                onChange={(e) => {
                  setSettings({
                    ...settings,
                    audio: {
                      ...settings.audio,
                      musicVolume: Number(e.target.value) / 100,
                    },
                  });
                }}
                className="w-24"
              />
              <span className="text-cyber-text-dim w-8 text-right">
                {Math.round((settings?.audio?.musicVolume ?? 0.5) * 100)}%
              </span>
            </label>

            <label className="flex items-center justify-between">
              <span className="text-cyber-text-dim">Громкость эффектов:</span>
              <input
                type="range"
                min="0"
                max="100"
                value={(settings?.audio?.sfxVolume ?? 0.7) * 100}
                onChange={(e) => {
                  setSettings({
                    ...settings,
                    audio: {
                      ...settings.audio,
                      sfxVolume: Number(e.target.value) / 100,
                    },
                  });
                }}
                className="w-24"
              />
              <span className="text-cyber-text-dim w-8 text-right">
                {Math.round((settings?.audio?.sfxVolume ?? 0.7) * 100)}%
              </span>
            </label>
          </div>
        </div>

        {/* Игровой процесс */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-cyan-400">Игровой процесс</h4>
          
          <div className="space-y-2 text-sm">
            <label className="flex items-center justify-between">
              <span className="text-cyber-text-dim">Скорость игры:</span>
              <select
                value={settings?.gameplay?.gameSpeed ?? 1}
                onChange={(e) => {
                  setSettings({
                    ...settings,
                    gameplay: {
                      ...settings.gameplay,
                      gameSpeed: Number(e.target.value),
                    },
                  });
                }}
                className="bg-cyber-dark border border-cyber-gray rounded px-2 py-1"
              >
                <option value={0.5}>0.5x</option>
                <option value={1}>1x</option>
                <option value={2}>2x</option>
                <option value={4}>4x</option>
              </select>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings?.gameplay?.autosaveEnabled ?? true}
                onChange={(e) => {
                  setSettings({
                    ...settings,
                    gameplay: {
                      ...settings.gameplay,
                      autosaveEnabled: e.target.checked,
                    },
                  });
                }}
                className="rounded"
              />
              <span className="text-cyber-text-dim">Автосохранение</span>
            </label>

            <label className="flex items-center justify-between">
              <span className="text-cyber-text-dim">Интервал автосохранения:</span>
              <select
                value={settings?.gameplay?.autosaveInterval ?? 30}
                onChange={(e) => {
                  setSettings({
                    ...settings,
                    gameplay: {
                      ...settings.gameplay,
                      autosaveInterval: Number(e.target.value),
                    },
                  });
                }}
                className="bg-cyber-dark border border-cyber-gray rounded px-2 py-1"
              >
                <option value={30}>30 сек</option>
                <option value={60}>1 мин</option>
                <option value={120}>2 мин</option>
                <option value={300}>5 мин</option>
              </select>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings?.gameplay?.pauseOnBlur ?? false}
                onChange={(e) => {
                  setSettings({
                    ...settings,
                    gameplay: {
                      ...settings.gameplay,
                      pauseOnBlur: e.target.checked,
                    },
                  });
                }}
                className="rounded"
              />
              <span className="text-cyber-text-dim">Пауза при потере фокуса</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings?.gameplay?.confirmBuilding ?? false}
                onChange={(e) => {
                  setSettings({
                    ...settings,
                    gameplay: {
                      ...settings.gameplay,
                      confirmBuilding: e.target.checked,
                    },
                  });
                }}
                className="rounded"
              />
              <span className="text-cyber-text-dim">Подтверждение постройки</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings?.gameplay?.confirmDestruction ?? true}
                onChange={(e) => {
                  setSettings({
                    ...settings,
                    gameplay: {
                      ...settings.gameplay,
                      confirmDestruction: e.target.checked,
                    },
                  });
                }}
                className="rounded"
              />
              <span className="text-cyber-text-dim">Подтверждение сноса</span>
            </label>
          </div>
        </div>

        {/* Дополнительные графические настройки */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-cyan-400">Визуализация</h4>
          
          <div className="space-y-2 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings?.graphics?.showGrid ?? true}
                onChange={(e) => {
                  setSettings({
                    ...settings,
                    graphics: {
                      ...settings.graphics,
                      showGrid: e.target.checked,
                    },
                  });
                }}
                className="rounded"
              />
              <span className="text-cyber-text-dim">Показывать сетку</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings?.graphics?.showProximityHints ?? true}
                onChange={(e) => {
                  setSettings({
                    ...settings,
                    graphics: {
                      ...settings.graphics,
                      showProximityHints: e.target.checked,
                    },
                  });
                }}
                className="rounded"
              />
              <span className="text-cyber-text-dim">Подсказки синергии</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings?.graphics?.showEnergyGrid ?? true}
                onChange={(e) => {
                  setSettings({
                    ...settings,
                    graphics: {
                      ...settings.graphics,
                      showEnergyGrid: e.target.checked,
                    },
                  });
                }}
                className="rounded"
              />
              <span className="text-cyber-text-dim">Энергетическая сеть</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings?.graphics?.showLogisticsGrid ?? true}
                onChange={(e) => {
                  setSettings({
                    ...settings,
                    graphics: {
                      ...settings.graphics,
                      showLogisticsGrid: e.target.checked,
                    },
                  });
                }}
                className="rounded"
              />
              <span className="text-cyber-text-dim">Логистическая сеть</span>
            </label>
          </div>
        </div>

        {/* Интерфейс */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-cyan-400">Интерфейс</h4>
          
          <div className="space-y-2 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings?.ui?.showMinimap ?? true}
                onChange={(e) => {
                  setSettings({
                    ...settings,
                    ui: {
                      ...settings.ui,
                      showMinimap: e.target.checked,
                    },
                  });
                }}
                className="rounded"
              />
              <span className="text-cyber-text-dim">Мини-карта</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings?.ui?.showDashboard ?? true}
                onChange={(e) => {
                  setSettings({
                    ...settings,
                    ui: {
                      ...settings.ui,
                      showDashboard: e.target.checked,
                    },
                  });
                }}
                className="rounded"
              />
              <span className="text-cyber-text-dim">Dashboard</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings?.ui?.compactMode ?? false}
                onChange={(e) => {
                  setSettings({
                    ...settings,
                    ui: {
                      ...settings.ui,
                      compactMode: e.target.checked,
                    },
                  });
                }}
                className="rounded"
              />
              <span className="text-cyber-text-dim">Компактный режим</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings?.ui?.notificationsEnabled ?? true}
                onChange={(e) => {
                  setSettings({
                    ...settings,
                    ui: {
                      ...settings.ui,
                      notificationsEnabled: e.target.checked,
                    },
                  });
                }}
                className="rounded"
              />
              <span className="text-cyber-text-dim">Уведомления</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings?.ui?.showTooltips ?? true}
                onChange={(e) => {
                  setSettings({
                    ...settings,
                    ui: {
                      ...settings.ui,
                      showTooltips: e.target.checked,
                    },
                  });
                }}
                className="rounded"
              />
              <span className="text-cyber-text-dim">Подсказки</span>
            </label>

            <label className="flex items-center justify-between">
              <span className="text-cyber-text-dim">Задержка подсказок:</span>
              <span className="text-cyber-text-dim">{settings?.ui?.tooltipDelay ?? 300}мс</span>
            </label>
            <input
              type="range"
              min="0"
              max="1000"
              step="100"
              value={settings?.ui?.tooltipDelay ?? 300}
              onChange={(e) => {
                setSettings({
                  ...settings,
                  ui: {
                    ...settings.ui,
                    tooltipDelay: Number(e.target.value),
                  },
                });
              }}
              className="w-full"
            />
          </div>
        </div>

        {/* Кнопка сохранения настроек */}
        <button
          onClick={handleSaveSettings}
          disabled={isSaving}
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-semibold py-2 px-4 rounded transition-colors"
        >
          {isSaving ? 'Сохранение...' : 'Сохранить настройки'}
        </button>
      </div>

      {/* Выход */}
      <div className="bg-cyber-darker border border-red-500/30 rounded-lg p-4">
        <button
          onClick={handleLogout}
          className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded transition-colors flex items-center justify-center gap-2"
        >
          <LogOut className="w-4 h-4" />
          Выйти из аккаунта
        </button>
      </div>
    </div>
  );
};
