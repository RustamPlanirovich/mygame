import { useEffect, useRef } from 'react';
import { useGameStore } from '../features/gameStore';

export const useAutosave = (intervalSeconds: number = 30, enabled: boolean = true) => {
  const saveGame = useGameStore(state => state.saveGame);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSaveRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Автосохранение каждые intervalSeconds секунд
    intervalRef.current = setInterval(() => {
      const now = Date.now();
      const elapsed = (now - lastSaveRef.current) / 1000;
      
      if (elapsed >= intervalSeconds) {
        console.log('[Autosave] Saving game...');
        saveGame();
        lastSaveRef.current = now;
      }
    }, 1000); // Проверяем каждую секунду

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [intervalSeconds, enabled, saveGame]);

  return {
    lastSave: lastSaveRef.current,
    forceSave: () => {
      saveGame();
      lastSaveRef.current = Date.now();
    },
  };
};
