import React, { useState, useEffect } from 'react';
import { Save, Download, Upload, RefreshCw, Trash2, Settings as SettingsIcon } from 'lucide-react';
import { DEFAULT_SETTINGS } from '../../core/gameTypes.settings';
import type { GameSettings } from '../../core/gameTypes.settings';
import { useGameStore } from '../../features/gameStore';
import { SignalStats } from './SignalOverlay';
import { loadSettingsFromServer, saveSettingsToServer } from '../../utils/settingsApi';
import { useConfirmDialog, useAlertDialog } from './ConfirmDialog';
import { IconText } from '../ui/icons';
import { applyAudioSettings } from '../../hooks/useAudio';

/** Ползунок громкости 0..1 с подписью в процентах. */
function VolumeSlider({
  label,
  hint,
  value,
  disabled,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div className={disabled ? 'opacity-50' : undefined}>
      <div className="flex items-center justify-between">
        <label className="text-sm text-cyber-text">{label}</label>
        <span className="text-xs font-mono tabular-nums text-cyber-text-dim">
          {Math.round(value * 100)}%
        </span>
      </div>
      {hint && <div className="text-xs text-cyber-text-dim">{hint}</div>}
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(value * 100)}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className="w-full mt-1"
      />
    </div>
  );
}

export const SettingsPanel: React.FC = () => {
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  const [activeTab, setActiveTab] = useState<'graphics' | 'gameplay' | 'ui' | 'audio' | 'hotkeys' | 'saves'>('gameplay');
  const [isLoading, setIsLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string>('');
  const saveGame = useGameStore(state => state.saveGame);
  const scenarioDismissed = useGameStore(state => state.scenario.dismissed);
  const restoreScenario = useGameStore(state => state.restoreScenario);
  const loadGame = useGameStore(state => state.loadGame);
  
  const { confirm: showConfirm, DialogComponent: ConfirmDialogComponent } = useConfirmDialog();
  const { showAlert, showSuccess, AlertComponent } = useAlertDialog();

  // Загружаем настройки при монтировании компонента
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const loadedSettings = await loadSettingsFromServer();
      setSettings(loadedSettings);
    } catch (err) {
      console.error('Ошибка загрузки настроек:', err);
      setSaveStatus('Ошибка загрузки настроек');
      setTimeout(() => setSaveStatus(''), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSettingChange = <T extends keyof GameSettings>(
    category: T,
    key: keyof GameSettings[T],
    value: any
  ) => {
    setSettings(prev => {
      const next = {
        ...prev,
        [category]: {
          ...prev[category],
          [key]: value,
        },
      };

      /*
       * Звук применяем СРАЗУ, не дожидаясь кнопки «Сохранить» (bigplan.md, пункты 15, 16):
       * громкость настраивают на слух, и регулятор, который начинает работать только после
       * сохранения и перезагрузки, настроить невозможно.
       */
      if (category === 'audio') {
        applyAudioSettings(next.audio);
      }

      return next;
    });
  };

  const handleSave = async () => {
    setIsLoading(true);
    setSaveStatus('Сохранение...');
    
    try {
      const result = await saveSettingsToServer(settings);
      
      if (result.ok) {
        // App подписан на это событие: без него сохранённый targetFPS/качество применялись
        // только после перезагрузки страницы.
        window.dispatchEvent(new CustomEvent('settingsChanged', { detail: settings }));
        setSaveStatus('✓ Настройки сохранены!');
      } else {
        setSaveStatus('Ошибка: ' + (result.error || 'Неизвестная ошибка'));
      }
    } catch (err) {
      console.error('Ошибка сохранения настроек:', err);
      setSaveStatus('Ошибка подключения к серверу');
    } finally {
      setIsLoading(false);
      setTimeout(() => setSaveStatus(''), 3000);
    }
  };

  const handleReset = async () => {
    const confirmed = await showConfirm({
      title: 'Сброс настроек',
      message: 'Сбросить все настройки к значениям по умолчанию?',
      type: 'warning',
      confirmText: 'Сбросить',
      cancelText: 'Отмена',
    });
    if (!confirmed) return;
    
    setSettings(DEFAULT_SETTINGS);
    
    setIsLoading(true);
    setSaveStatus('Сброс...');
    
    try {
      const result = await saveSettingsToServer(DEFAULT_SETTINGS);
      
      if (result.ok) {
        window.dispatchEvent(new CustomEvent('settingsChanged', { detail: DEFAULT_SETTINGS }));
        setSaveStatus('✓ Настройки сброшены!');
      } else {
        setSaveStatus('Ошибка: ' + (result.error || 'Неизвестная ошибка'));
      }
    } catch (err) {
      console.error('Ошибка сброса настроек:', err);
      setSaveStatus('Ошибка подключения к серверу');
    } finally {
      setIsLoading(false);
      setTimeout(() => setSaveStatus(''), 3000);
    }
  };

  const handleExportSave = () => {
    const save = localStorage.getItem('gameState');
    if (!save) {
      showAlert('Нет сохранения для экспорта', 'Экспорт');
      return;
    }
    
    const blob = new Blob([save], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `save_${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportSave = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = event.target?.result as string;
          localStorage.setItem('gameState', data);
          loadGame();
          showSuccess('Сохранение загружено успешно!', 'Импорт');
        } catch (err) {
          showAlert('Ошибка загрузки сохранения', 'Ошибка');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleDeleteSave = async () => {
    const confirmed = await showConfirm({
      title: 'Удаление сохранений',
      message: 'Удалить все сохранения? Это действие нельзя отменить!',
      type: 'alert',
      confirmText: 'Удалить',
      cancelText: 'Отмена',
    });
    if (confirmed) {
      localStorage.removeItem('gameState');
      showAlert('Сохранения удалены. Перезагрузите страницу для начала новой игры.', 'Удаление');
    }
  };

  const tabs = [
    { id: 'gameplay' as const, label: 'Игра' },
    { id: 'graphics' as const, label: 'Графика' },
    { id: 'ui' as const, label: 'Интерфейс' },
    { id: 'audio' as const, label: 'Звук' },
    { id: 'hotkeys' as const, label: 'Клавиши' },
    { id: 'saves' as const, label: 'Сохранения' },
  ];

  return (
    <>
      <ConfirmDialogComponent />
      <AlertComponent />
      <div className="h-full flex flex-col bg-cyber-darker">
      <div className="shrink-0 p-4 border-b border-cyber-gray bg-cyber-dark">
        <h2 className="text-lg font-bold text-cyber-green flex items-center gap-2">
          <SettingsIcon size={20} />
          <span>Настройки</span>
        </h2>
      </div>

      {/* Tabs */}
      <div className="shrink-0 flex border-b border-cyber-gray bg-cyber-dark/50">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-cyber-darker text-cyber-green border-b-2 border-cyber-green'
                : 'text-cyber-text-dim hover:text-cyber-text'
            }`}
          >
            <IconText>{tab.label}</IconText>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Gameplay Settings */}
        {activeTab === 'gameplay' && (
          <div className="space-y-4">
            <div className="bg-cyber-dark p-4 rounded-lg border border-cyber-gray">
              <h3 className="text-sm font-bold text-cyber-blue mb-3">Игровой процесс</h3>
              
              <div className="space-y-3">
                {/* Game Speed */}
                <div>
                  <label className="block text-xs text-cyber-text-dim mb-1">
                    Скорость игры: {settings.gameplay.gameSpeed}x
                  </label>
                  <input
                    type="range"
                    min="0.5"
                    max="4"
                    step="0.5"
                    value={settings.gameplay.gameSpeed}
                    onChange={(e) => handleSettingChange('gameplay', 'gameSpeed', parseFloat(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-[10px] text-cyber-text-dim mt-1">
                    <span>0.5x</span>
                    <span>1x</span>
                    <span>2x</span>
                    <span>4x</span>
                  </div>
                </div>

                {/* Autosave */}
                <div className="flex items-center justify-between">
                  <label className="text-sm text-cyber-text">Автосохранение</label>
                  <input
                    type="checkbox"
                    checked={settings.gameplay.autosaveEnabled}
                    onChange={(e) => handleSettingChange('gameplay', 'autosaveEnabled', e.target.checked)}
                    className="w-4 h-4"
                  />
                </div>

                {settings.gameplay.autosaveEnabled && (
                  <div>
                    <label className="block text-xs text-cyber-text-dim mb-1">
                      Интервал автосохранения: {settings.gameplay.autosaveInterval}с
                    </label>
                    <select
                      value={settings.gameplay.autosaveInterval}
                      onChange={(e) => handleSettingChange('gameplay', 'autosaveInterval', parseInt(e.target.value))}
                      className="w-full bg-cyber-black border border-cyber-gray rounded px-2 py-1 text-sm text-cyber-text"
                    >
                      <option value={30}>30 секунд</option>
                      <option value={60}>1 минута</option>
                      <option value={120}>2 минуты</option>
                      <option value={300}>5 минут</option>
                    </select>
                  </div>
                )}

                {/* Pause on blur */}
                <div className="flex items-center justify-between">
                  <label className="text-sm text-cyber-text">Пауза при потере фокуса</label>
                  <input
                    type="checkbox"
                    checked={settings.gameplay.pauseOnBlur}
                    onChange={(e) => handleSettingChange('gameplay', 'pauseOnBlur', e.target.checked)}
                    className="w-4 h-4"
                  />
                </div>

                {/* Confirmations */}
                <div className="flex items-center justify-between">
                  <label className="text-sm text-cyber-text">Подтверждение постройки</label>
                  <input
                    type="checkbox"
                    checked={settings.gameplay.confirmBuilding}
                    onChange={(e) => handleSettingChange('gameplay', 'confirmBuilding', e.target.checked)}
                    className="w-4 h-4"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-sm text-cyber-text">Подтверждение сноса</label>
                  <input
                    type="checkbox"
                    checked={settings.gameplay.confirmDestruction}
                    onChange={(e) => handleSettingChange('gameplay', 'confirmDestruction', e.target.checked)}
                    className="w-4 h-4"
                  />
                </div>
              </div>
            </div>

            {/* Signal Interception Stats */}
            <SignalStats />
          </div>
        )}

        {/* Graphics Settings */}
        {activeTab === 'graphics' && (
          <div className="space-y-4">
            <div className="bg-cyber-dark p-4 rounded-lg border border-cyber-gray">
              <h3 className="text-sm font-bold text-cyber-blue mb-3">Производительность</h3>
              
              <div className="space-y-3">
                {/* Target FPS */}
                <div>
                  <label className="block text-xs text-cyber-text-dim mb-1">
                    Целевой FPS: {settings.graphics.targetFPS}
                  </label>
                  <select
                    value={settings.graphics.targetFPS}
                    onChange={(e) => handleSettingChange('graphics', 'targetFPS', parseInt(e.target.value))}
                    className="w-full bg-cyber-darker border border-cyber-gray rounded px-2 py-1 text-sm"
                  >
                    <option value={30}>30 FPS (экономия батареи)</option>
                    <option value={60}>60 FPS (рекомендуется)</option>
                    <option value={120}>120 FPS (высокая производительность)</option>
                  </select>
                </div>

                {/* Quality */}
                <div>
                  <label className="block text-xs text-cyber-text-dim mb-1">
                    Качество графики
                  </label>
                  <select
                    value={settings.graphics.quality}
                    onChange={(e) => handleSettingChange('graphics', 'quality', e.target.value)}
                    className="w-full bg-cyber-darker border border-cyber-gray rounded px-2 py-1 text-sm"
                  >
                    <option value="low">Низкое (лучшая производительность)</option>
                    <option value="medium">Среднее</option>
                    <option value="high">Высокое (лучшая графика)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="bg-cyber-dark p-4 rounded-lg border border-cyber-gray">
              <h3 className="text-sm font-bold text-cyber-blue mb-3">Визуализация</h3>
              
              <div className="space-y-3">
                {['showGrid', 'showProximityHints', 'showEnergyGrid', 'showLogisticsGrid', 'showAnimations', 'particleEffects'].map((key) => (
                  <div key={key} className="flex items-center justify-between">
                    <label className="text-sm text-cyber-text">
                      {key === 'showGrid' && 'Показывать сетку'}
                      {key === 'showProximityHints' && 'Подсказки синергии'}
                      {key === 'showEnergyGrid' && 'Энергетическая сеть'}
                      {key === 'showLogisticsGrid' && 'Логистическая сеть'}
                      {key === 'showAnimations' && 'Анимации'}
                      {key === 'particleEffects' && 'Эффекты частиц'}
                    </label>
                    <input
                      type="checkbox"
                      checked={settings.graphics[key as keyof typeof settings.graphics] as boolean}
                      onChange={(e) => handleSettingChange('graphics', key as keyof GameSettings['graphics'], e.target.checked)}
                      className="w-4 h-4"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Audio Settings (bigplan.md, пункты 15, 16, 35) */}
        {activeTab === 'audio' && (
          <div className="space-y-4">
            <div className="bg-cyber-dark p-4 rounded-lg border border-cyber-gray">
              <h3 className="text-sm font-bold text-cyber-blue mb-3">Звук</h3>

              <div className="space-y-4">
                <label className="flex items-center justify-between">
                  <span className="text-sm text-cyber-text">Выключить весь звук</span>
                  <input
                    type="checkbox"
                    checked={settings.audio.muteAll}
                    onChange={(e) => handleSettingChange('audio', 'muteAll', e.target.checked)}
                    className="w-4 h-4"
                  />
                </label>

                {/*
                  Три отдельных регулятора, а не один: музыка и звуки интерфейса нужны игрокам
                  в разных пропорциях, и «выключить музыку, оставить клики» — самый частый
                  сценарий. Общий уровень поверх них.
                */}
                <VolumeSlider
                  label="Фоновая музыка"
                  hint="Спокойный генеративный фон без слов"
                  value={settings.audio.musicVolume}
                  disabled={settings.audio.muteAll}
                  onChange={(v) => handleSettingChange('audio', 'musicVolume', v)}
                />

                <VolumeSlider
                  label="Звуки интерфейса"
                  hint="Клик по клетке, постройка, снос, завершение работ"
                  value={settings.audio.sfxVolume}
                  disabled={settings.audio.muteAll}
                  onChange={(v) => handleSettingChange('audio', 'sfxVolume', v)}
                />

                <VolumeSlider
                  label="Общая громкость"
                  value={settings.audio.masterVolume}
                  disabled={settings.audio.muteAll}
                  onChange={(v) => handleSettingChange('audio', 'masterVolume', v)}
                />

                <p className="text-xs text-cyber-text-dim">
                  Звук включается после первого клика в игре — так требуют браузеры: до
                  взаимодействия страница не имеет права ничего проигрывать.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* UI Settings */}
        {activeTab === 'ui' && (
          <div className="space-y-4">
            <div className="bg-cyber-dark p-4 rounded-lg border border-cyber-gray">
              <h3 className="text-sm font-bold text-cyber-blue mb-3">Интерфейс</h3>
              
              <div className="space-y-3">
                {/*
                  Возврат подсказок сценария (bigplan.md, пункт 20). Кнопка «Не нужно» на самой
                  подсказке скрывает её насовсем, и без этого места вернуть её было бы нельзя —
                  а в бесконечной игре ориентир может понадобиться снова через месяц.
                */}
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm text-cyber-text">Подсказки сценария</label>
                    <div className="text-xs text-cyber-text-dim">
                      {scenarioDismissed ? 'Скрыты' : 'Показываются на карте'}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-xs"
                    disabled={!scenarioDismissed}
                    onClick={restoreScenario}
                  >
                    Вернуть
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-sm text-cyber-text">Показывать подсказки</label>
                  <input
                    type="checkbox"
                    checked={settings.ui.showTooltips}
                    onChange={(e) => handleSettingChange('ui', 'showTooltips', e.target.checked)}
                    className="w-4 h-4"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-sm text-cyber-text">Мини-карта</label>
                  <input
                    type="checkbox"
                    checked={settings.ui.showMinimap}
                    onChange={(e) => handleSettingChange('ui', 'showMinimap', e.target.checked)}
                    className="w-4 h-4"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-sm text-cyber-text">Dashboard</label>
                  <input
                    type="checkbox"
                    checked={settings.ui.showDashboard}
                    onChange={(e) => handleSettingChange('ui', 'showDashboard', e.target.checked)}
                    className="w-4 h-4"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-sm text-cyber-text">Компактный режим</label>
                  <input
                    type="checkbox"
                    checked={settings.ui.compactMode}
                    onChange={(e) => handleSettingChange('ui', 'compactMode', e.target.checked)}
                    className="w-4 h-4"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-sm text-cyber-text">Уведомления</label>
                  <input
                    type="checkbox"
                    checked={settings.ui.notificationsEnabled}
                    onChange={(e) => handleSettingChange('ui', 'notificationsEnabled', e.target.checked)}
                    className="w-4 h-4"
                  />
                </div>

                <div>
                  <label className="block text-xs text-cyber-text-dim mb-1">
                    Задержка подсказок: {settings.ui.tooltipDelay}мс
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1000"
                    step="100"
                    value={settings.ui.tooltipDelay}
                    onChange={(e) => handleSettingChange('ui', 'tooltipDelay', parseInt(e.target.value))}
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Hotkeys Settings */}
        {activeTab === 'hotkeys' && (
          <div className="space-y-4">
            <div className="bg-cyber-dark p-4 rounded-lg border border-cyber-gray">
              <h3 className="text-sm font-bold text-cyber-blue mb-3">Горячие клавиши</h3>
              <p className="text-xs text-cyber-text-dim mb-3">
                Нажмите на поле и нажмите клавишу для изменения
              </p>
              
              <div className="space-y-2">
                {Object.entries(settings.hotkeys).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between">
                    <label className="text-sm text-cyber-text">
                      {key === 'togglePause' && 'Пауза'}
                      {key === 'quickSave' && 'Быстрое сохранение'}
                      {key === 'quickLoad' && 'Быстрая загрузка'}
                      {key === 'openBuildings' && 'Строительство'}
                      {key === 'openResearch' && 'Исследования'}
                      {key === 'openMarket' && 'Рынок'}
                      {key === 'toggleGrid' && 'Переключить сетку'}
                      {key === 'speedUp' && 'Ускорить'}
                      {key === 'speedDown' && 'Замедлить'}
                      {key === 'deleteBuilding' && 'Снести здание'}
                    </label>
                    <input
                      type="text"
                      value={value as string}
                      readOnly
                      className="w-20 bg-cyber-black border border-cyber-gray rounded px-2 py-1 text-sm text-cyber-green text-center"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Saves Management */}
        {activeTab === 'saves' && (
          <div className="space-y-4">
            <div className="bg-cyber-dark p-4 rounded-lg border border-cyber-gray">
              <h3 className="text-sm font-bold text-cyber-blue mb-3">Управление сохранениями</h3>
              
              <div className="space-y-3">
                <button
                  onClick={saveGame}
                  className="cyber-button w-full py-2 text-sm flex items-center justify-center gap-2"
                >
                  <Save size={16} />
                  Сохранить игру
                </button>

                <button
                  onClick={handleExportSave}
                  className="cyber-button w-full py-2 text-sm flex items-center justify-center gap-2 bg-transparent border-cyber-blue text-cyber-blue"
                >
                  <Download size={16} />
                  Экспортировать сохранение
                </button>

                <button
                  onClick={handleImportSave}
                  className="cyber-button w-full py-2 text-sm flex items-center justify-center gap-2 bg-transparent border-cyber-purple text-cyber-purple"
                >
                  <Upload size={16} />
                  Импортировать сохранение
                </button>

                <button
                  onClick={handleDeleteSave}
                  className="cyber-button w-full py-2 text-sm flex items-center justify-center gap-2 bg-transparent border-cyber-red text-cyber-red hover:bg-cyber-red"
                >
                  <Trash2 size={16} />
                  Удалить все сохранения
                </button>
              </div>

              <div className="mt-4 pt-4 border-t border-cyber-gray">
                <p className="text-xs text-cyber-text-dim">
                  Сохранения хранятся в localStorage браузера. Регулярно экспортируйте важные сохранения.
                  Для управления игровыми слотами используйте раздел "Мои игры" в профиле.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 p-4 border-t border-cyber-gray bg-cyber-dark">
        {saveStatus && (
          <div className={`mb-2 text-xs text-center py-1 rounded ${
            saveStatus.includes('✓') 
              ? 'text-cyber-green bg-cyber-green/10' 
              : saveStatus.includes('Ошибка') 
                ? 'text-cyber-red bg-cyber-red/10'
                : 'text-cyber-text'
          }`}>
            <IconText>{saveStatus}</IconText>
          </div>
        )}
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={isLoading}
            className="cyber-button flex-1 py-2 text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={16} />
            {isLoading ? 'Сохранение...' : 'Сохранить настройки'}
          </button>
          <button
            onClick={handleReset}
            disabled={isLoading}
            className="cyber-button py-2 px-4 text-sm flex items-center justify-center gap-2 bg-transparent border-cyber-red text-cyber-red hover:bg-cyber-red disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw size={16} />
            Сбросить
          </button>
        </div>
      </div>
    </div>
    </>
  );
};
