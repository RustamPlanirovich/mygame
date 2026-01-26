// Простой эмиттер событий для коммуникации между компонентами

type EventCallback = () => void;

class GameEventEmitter {
  private listeners: Map<string, Set<EventCallback>> = new Map();

  on(event: string, callback: EventCallback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    
    // Возвращаем функцию отписки
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  emit(event: string) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(cb => cb());
    }
  }

  off(event: string, callback: EventCallback) {
    this.listeners.get(event)?.delete(callback);
  }
}

// Глобальный экземпляр
export const gameEvents = new GameEventEmitter();

// События
export const GAME_EVENTS = {
  GO_TO_BASE: 'goToBase',
  FIT_CAMERA: 'fitCamera',
} as const;
