/**
 * ПОДКЛЮЧЕНИЕ АУДИО К НАСТРОЙКАМ (bigplan.md, пункты 15, 16, 35)
 *
 * Один хук на приложение: он забирает настройки с сервера, прокидывает громкости в шину,
 * включает/выключает фоновую музыку и глушит звук в неактивной вкладке.
 *
 * До этого `settings.audio` в типах был, а читать его было некому: ползунок «Музыка» в профиле
 * менял число, которое никуда не шло.
 */

import { useEffect, useState } from 'react';
import { audioBus } from '../core/audio/AudioBus';
import { isAmbientPlaying, startAmbientMusic, stopAmbientMusic } from '../core/audio/ambientMusic';
import { loadSettingsFromServer } from '../utils/settingsApi';
import type { GameSettings } from '../core/gameTypes.settings';
import { DEFAULT_SETTINGS } from '../core/gameTypes.settings';

/**
 * Считать, что музыка должна играть.
 * Отдельная функция, потому что условий три и они неочевидны: общий mute, нулевая громкость
 * музыки и нулевой общий уровень — каждый сам по себе означает «не играть».
 */
export function shouldPlayMusic(audio: GameSettings['audio']): boolean {
  if (audio.muteAll) return false;
  if (audio.masterVolume <= 0) return false;
  return audio.musicVolume > 0;
}

/**
 * Применить громкости и состояние музыки немедленно.
 *
 * Вынесено из хука, потому что вызывается и из панели настроек: игрок тянет ползунок и должен
 * слышать результат сразу, а не после сохранения и перезагрузки.
 */
export function applyAudioSettings(audio: GameSettings['audio']): void {
  audioBus.setLevels(audio);

  if (shouldPlayMusic(audio)) {
    void startAmbientMusic();
  } else if (isAmbientPlaying()) {
    stopAmbientMusic();
  }
}

export function useAudio(): { audio: GameSettings['audio']; setAudio: (next: GameSettings['audio']) => void } {
  const [audio, setAudioState] = useState<GameSettings['audio']>(DEFAULT_SETTINGS.audio);

  // Разблокировка по первому жесту: браузер не даст создать работающий AudioContext раньше.
  useEffect(() => {
    audioBus.bindUnlock();
  }, []);

  // Настройки с сервера — источник правды для громкостей.
  useEffect(() => {
    let cancelled = false;
    loadSettingsFromServer()
      .then((settings) => {
        if (cancelled) return;
        setAudioState(settings.audio ?? DEFAULT_SETTINGS.audio);
      })
      .catch(() => {
        // Нет связи — играем на значениях по умолчанию, а не молчим.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Громкости в шину + запуск/остановка музыки при изменении настроек.
  useEffect(() => {
    applyAudioSettings(audio);
  }, [audio]);

  /*
   * Неактивная вкладка: браузер и сам душит таймеры, но AudioContext продолжает играть —
   * фоновая музыка из свёрнутого окна воспринимается как «игра шумит непонятно откуда».
   */
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        audioBus.suspend();
      } else if (shouldPlayMusic(audio)) {
        void audioBus.resume();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [audio]);

  // Остановка музыки при размонтировании: иначе она продолжит играть после выхода из игры.
  useEffect(() => () => stopAmbientMusic(), []);

  return { audio, setAudio: setAudioState };
}
