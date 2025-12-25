// Settings system types

export interface GameSettings {
  // Графика
  graphics: {
    showGrid: boolean;
    showProximityHints: boolean;
    showEnergyGrid: boolean;
    showLogisticsGrid: boolean;
    showAnimations: boolean;
    particleEffects: boolean;
    targetFPS: number; // Целевой FPS: 30, 60, 120
    quality: 'low' | 'medium' | 'high'; // Качество графики
  };
  
  // Игровой процесс
  gameplay: {
    gameSpeed: number; // 0.5, 1, 2, 4
    autosaveInterval: number; // в секундах, 30/60/120/300
    autosaveEnabled: boolean;
    pauseOnBlur: boolean; // Пауза при потере фокуса
    confirmBuilding: boolean; // Подтверждение перед постройкой
    confirmDestruction: boolean; // Подтверждение перед сносом
  };
  
  // Интерфейс
  ui: {
    showTooltips: boolean;
    showMinimap: boolean;
    showDashboard: boolean;
    compactMode: boolean; // Компактный режим UI
    tooltipDelay: number; // Задержка появления подсказок в мс
    notificationsEnabled: boolean;
  };
  
  // Горячие клавиши
  hotkeys: {
    togglePause: string;
    quickSave: string;
    quickLoad: string;
    openBuildings: string;
    openResearch: string;
    openMarket: string;
    toggleGrid: string;
    speedUp: string;
    speedDown: string;
    deleteBuilding: string;
  };
  
  // Аудио (для будущего)
  audio: {
    masterVolume: number;
    musicVolume: number;
    sfxVolume: number;
    muteAll: boolean;
  };
}

export const DEFAULT_SETTINGS: GameSettings = {
  graphics: {
    showGrid: true,
    showProximityHints: true,
    showEnergyGrid: true,
    showLogisticsGrid: true,
    showAnimations: true,
    particleEffects: true,
    targetFPS: 60,
    quality: 'high',
  },
  gameplay: {
    gameSpeed: 1,
    autosaveInterval: 30,
    autosaveEnabled: true,
    pauseOnBlur: false,
    confirmBuilding: false,
    confirmDestruction: true,
  },
  ui: {
    showTooltips: true,
    showMinimap: true,
    showDashboard: true,
    compactMode: false,
    tooltipDelay: 300,
    notificationsEnabled: true,
  },
  hotkeys: {
    togglePause: 'Space',
    quickSave: 'F5',
    quickLoad: 'F9',
    openBuildings: 'B',
    openResearch: 'R',
    openMarket: 'M',
    toggleGrid: 'G',
    speedUp: '+',
    speedDown: '-',
    deleteBuilding: 'Delete',
  },
  audio: {
    masterVolume: 0.7,
    musicVolume: 0.5,
    sfxVolume: 0.7,
    muteAll: false,
  },
};
