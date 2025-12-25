import { useEffect, useRef } from 'react';
import { useGameStore } from '../features/gameStore';
import { checkAchievements } from '../utils/achievementsHelpers';

/**
 * Оптимизированный игровой цикл с контролем FPS и пропуском кадров
 */
export const useOptimizedGameLoop = (targetFPS: number = 60) => {
  const tick = useGameStore(state => state.tick);
  const saveGame = useGameStore(state => state.saveGame);
  
  const requestRef = useRef<number>();
  const previousTimeRef = useRef<number>();
  const accumulatedTimeRef = useRef<number>(0);
  const saveTimeRef = useRef<number>(0);
  const achievementCheckRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const fpsRef = useRef<number>(0);
  const lastFpsUpdateRef = useRef<number>(0);

  const frameTime = 1000 / targetFPS; // Время на кадр в мс
  const maxFrameTime = frameTime * 3; // Максимальное время накопления

  const animate = (time: number) => {
    if (previousTimeRef.current === undefined) {
      previousTimeRef.current = time;
    }

    const deltaTime = time - previousTimeRef.current;
    previousTimeRef.current = time;

    // Накапливаем время
    accumulatedTimeRef.current += deltaTime;

    // Ограничиваем накопление чтобы избежать "спирали смерти"
    if (accumulatedTimeRef.current > maxFrameTime) {
      accumulatedTimeRef.current = maxFrameTime;
    }

    // Обновляем игру фиксированными шагами
    let updates = 0;
    const maxUpdates = 5; // Максимум обновлений за кадр

    while (accumulatedTimeRef.current >= frameTime && updates < maxUpdates) {
      const dt = frameTime / 1000; // Конвертируем в секунды
      tick(dt);

      // Auto-save tracking
      saveTimeRef.current += dt;
      if (saveTimeRef.current >= 30) {
        void saveGame();
        saveTimeRef.current = 0;
      }

      // Achievement checking
      achievementCheckRef.current += dt;
      if (achievementCheckRef.current >= 2) {
        const state = useGameStore.getState();
        checkAchievements(state);
        achievementCheckRef.current = 0;
      }

      accumulatedTimeRef.current -= frameTime;
      updates++;
    }

    // Подсчет FPS
    frameCountRef.current++;
    if (time - lastFpsUpdateRef.current >= 1000) {
      fpsRef.current = frameCountRef.current;
      frameCountRef.current = 0;
      lastFpsUpdateRef.current = time;

      // Логируем только если FPS низкий
      if (fpsRef.current < targetFPS * 0.8) {
        console.warn(`[GameLoop] Low FPS: ${fpsRef.current}`);
      }
    }

    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, []);

  return {
    getFPS: () => fpsRef.current,
  };
};

/**
 * Вариант с переменным временем шага (более простой, но менее точный)
 */
export const useVariableGameLoop = () => {
  const tick = useGameStore(state => state.tick);
  const saveGame = useGameStore(state => state.saveGame);
  
  const requestRef = useRef<number>();
  const previousTimeRef = useRef<number>();
  const saveTimeRef = useRef<number>(0);
  const achievementCheckRef = useRef<number>(0);

  const animate = (time: number) => {
    if (previousTimeRef.current !== undefined) {
      const deltaTime = (time - previousTimeRef.current) / 1000;
      
      // Ограничиваем deltaTime для предотвращения огромных скачков
      const cappedDelta = Math.min(deltaTime, 0.1);
      
      // Пропускаем кадр если он слишком маленький (> 120 FPS)
      if (deltaTime < 0.008) {
        requestRef.current = requestAnimationFrame(animate);
        return;
      }
      
      tick(cappedDelta);

      saveTimeRef.current += cappedDelta;
      if (saveTimeRef.current >= 30) {
        void saveGame();
        saveTimeRef.current = 0;
      }

      achievementCheckRef.current += cappedDelta;
      if (achievementCheckRef.current >= 2) {
        const state = useGameStore.getState();
        checkAchievements(state);
        achievementCheckRef.current = 0;
      }
    }
    
    previousTimeRef.current = time;
    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, []);
};
