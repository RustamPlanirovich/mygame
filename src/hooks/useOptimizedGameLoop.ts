import { useEffect, useRef, useCallback } from 'react';
import { useGameStore } from '../features/gameStore';
import { useFinanceStore } from '../features/financeStore';
import { checkAchievements } from '../utils/achievementsHelpers';
import { playSfx } from '../core/audio/sfx';
import type { GameState } from '../core/gameTypes';

/** Сколько незавершённых работ на базе. Дёшево: в очереди обычно 0-3 записи. */
function countTileJobs(state: GameState): number {
  const jobs = state.grid.tileJobs;
  if (!jobs) return 0;
  return Object.keys(jobs).length;
}

/**
 * СУПЕР-ОПТИМИЗИРОВАННЫЙ игровой цикл
 * 
 * Ключевые оптимизации для достижения 120 FPS:
 * 1. РАЗДЕЛЕНИЕ логики и рендеринга: tick() вызывается реже (15-30 раз/сек)
 * 2. requestAnimationFrame работает на полной скорости для плавного UI
 * 3. Тяжёлые операции (achievements, signals) вынесены в отдельные интервалы
 * 4. Батчинг обновлений состояния
 */
export const useOptimizedGameLoop = (targetFPS: number = 60) => {
  // ОПТИМИЗАЦИЯ: Получаем функции один раз, не подписываясь на изменения
  const tickRef = useRef(useGameStore.getState().tick);
  const saveGameRef = useRef(useGameStore.getState().saveGame);
  
  const requestRef = useRef<number>();
  const previousTimeRef = useRef<number>();
  const accumulatedTimeRef = useRef<number>(0);
  const saveTimeRef = useRef<number>(0);
  const achievementCheckRef = useRef<number>(0);
  const signalCheckRef = useRef<number>(0);
  const financeCheckRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const fpsRef = useRef<number>(0);
  const lastFpsUpdateRef = useRef<number>(0);
  const lastLogTimeRef = useRef<number>(0);

  // КЛЮЧЕВАЯ ОПТИМИЗАЦИЯ: Логика обновляется с фиксированной частотой
  // Для idle-игры 20 тиков/сек достаточно - визуально разницы нет
  // Это снижает нагрузку tick() в 3-6 раз при целевых 60-120 FPS
  const LOGIC_FPS = Math.min(targetFPS, 20); // Логика max 20 раз в секунду
  const logicFrameTime = 1000 / LOGIC_FPS;
  const maxFrameTime = logicFrameTime * 3;

  // Обновляем ссылки при изменении store
  useEffect(() => {
    const unsubscribe = useGameStore.subscribe((state) => {
      tickRef.current = state.tick;
      saveGameRef.current = state.saveGame;
    });
    return unsubscribe;
  }, []);

  const animate = useCallback((time: number) => {
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

    // ОПТИМИЗАЦИЯ: Максимум 2 обновления за кадр (вместо 5)
    // Это предотвращает ситуацию когда один тяжёлый кадр вызывает каскад
    let updates = 0;
    const maxUpdates = 2;

    while (accumulatedTimeRef.current >= logicFrameTime && updates < maxUpdates) {
      const dt = logicFrameTime / 1000; // Конвертируем в секунды
      
      // ОПТИМИЗАЦИЯ: Вызываем tick напрямую через ref
      /*
       * Звук завершения стройки/улучшения (bigplan.md, пункты 16, 18, 19). Ловим по уменьшению
       * числа работ в очереди: сам tick — чистый апдейтер, и звать из него звук значило бы
       * тащить сайд-эффект в reducer (тот самый антипаттерн из пункта 36).
       */
      const jobsBefore = countTileJobs(useGameStore.getState());

      tickRef.current(dt);

      if (jobsBefore > 0 && countTileJobs(useGameStore.getState()) < jobsBefore) {
        playSfx('complete');
      }

      // Auto-save tracking - раз в 30 секунд
      saveTimeRef.current += dt;
      if (saveTimeRef.current >= 30) {
        void saveGameRef.current();
        saveTimeRef.current = 0;
      }

      // Achievement checking - раз в 10 секунд (было 5)
      achievementCheckRef.current += dt;
      if (achievementCheckRef.current >= 10) {
        const state = useGameStore.getState();
        // Запускаем в следующем микротаске чтобы не блокировать текущий кадр
        queueMicrotask(() => checkAchievements(state));
        achievementCheckRef.current = 0;
      }

      // Signal Interception: раз в 1 секунду (было 0.5)
      signalCheckRef.current += dt;
      if (signalCheckRef.current >= 1) {
        const signalState = useGameStore.getState();
        signalState.spawnNewSignal();
        signalState.updateSignals();
        signalCheckRef.current = 0;
      }

      // Finance update: раз в 5 секунд (обновление акций, процентов, кредитов)
      financeCheckRef.current += dt;
      if (financeCheckRef.current >= 5) {
        const financeStore = useFinanceStore.getState();
        queueMicrotask(() => financeStore.updateFinance());
        financeCheckRef.current = 0;
      }

      accumulatedTimeRef.current -= logicFrameTime;
      updates++;
    }

    // Подсчет FPS
    frameCountRef.current++;
    if (time - lastFpsUpdateRef.current >= 1000) {
      fpsRef.current = frameCountRef.current;
      frameCountRef.current = 0;
      lastFpsUpdateRef.current = time;

      // Логируем только если FPS < 30 и не чаще раза в 5 секунд
      if (fpsRef.current < 30 && time - lastLogTimeRef.current >= 5000) {
        console.warn(`[GameLoop] Low FPS: ${fpsRef.current}`);
        lastLogTimeRef.current = time;
      }
    }

    requestRef.current = requestAnimationFrame(animate);
  }, [logicFrameTime, maxFrameTime]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [animate]);

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
