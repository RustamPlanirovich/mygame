import { useEffect } from 'react';
import { useGameStore } from '../features/gameStore';

interface HotkeyConfig {
  key: string;
  handler: () => void;
  description?: string;
}

export const useHotkeys = (hotkeys: HotkeyConfig[]) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Игнорируем если фокус на input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      const key = e.key;
      const matchedHotkey = hotkeys.find(h => h.key.toLowerCase() === key.toLowerCase());
      
      if (matchedHotkey) {
        e.preventDefault();
        matchedHotkey.handler();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hotkeys]);
};

// Предустановленные горячие клавиши для игры
export const useGameHotkeys = () => {
  const saveGame = useGameStore(state => state.saveGame);
  const loadGame = useGameStore(state => state.loadGame);

  const hotkeys: HotkeyConfig[] = [
    {
      key: 'F5',
      handler: () => {
        saveGame();
        console.log('Quick save!');
      },
      description: 'Быстрое сохранение',
    },
    {
      key: 'F9',
      handler: () => {
        loadGame();
        console.log('Quick load!');
      },
      description: 'Быстрая загрузка',
    },
    {
      key: 'Escape',
      handler: () => {
        // Закрыть модальные окна или вернуться назад
        console.log('ESC pressed');
      },
      description: 'Отмена / Назад',
    },
  ];

  useHotkeys(hotkeys);
};
