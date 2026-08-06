import { useEffect } from 'react';
import { useGameStore } from '../features/gameStore';
import { useUiStore } from '../features/uiStore';

interface HotkeyConfig {
  key: string;
  handler: () => void;
  description?: string;
}

export const useHotkeys = (hotkeys: HotkeyConfig[], enabled = true) => {
  useEffect(() => {
    if (!enabled) return;

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
  }, [hotkeys, enabled]);
};

/**
 * Горячие клавиши игры.
 *
 * `enabled` — параметр, а не условие вызова: в App этот хук вызывался внутри
 * `if (device.isDesktop)`. При смене устройства (поворот планшета, изменение размера окна)
 * порядок хуков менялся между рендерами — это ровно то, что React запрещает, и в проде
 * ломается не предупреждением, а несвязанным состоянием чужих хуков.
 */
export const useGameHotkeys = (enabled = true) => {
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
        /*
         * Снять массовое выделение (bigplan.md, пункты 10 и 28). Раньше здесь был только
         * console.log — Escape ничего не делал. Модальные окна закрывают себя сами по своему
         * обработчику, поэтому здесь трогаем только выделение.
         */
        useUiStore.getState().clearSelectedTiles();
      },
      description: 'Снять выделение',
    },
  ];

  useHotkeys(hotkeys, enabled);
};
