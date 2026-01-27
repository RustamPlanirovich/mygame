import { useEffect, useRef } from 'react';
import { useGameStore } from '../features/gameStore';
import { useAnalyticsStore } from '../features/analyticsStore';
import { checkAchievements } from '../utils/achievementsHelpers';

export const useGameLoop = () => {
  const tick = useGameStore(state => state.tick);
  const saveGame = useGameStore(state => state.saveGame);
  const requestRef = useRef<number>();
  const previousTimeRef = useRef<number>();
  const saveTimeRef = useRef<number>(0);
  const achievementCheckRef = useRef<number>(0);
  const analyticsCheckRef = useRef<number>(0);

  const animate = (time: number) => {
    if (previousTimeRef.current !== undefined) {
      const deltaTime = (time - previousTimeRef.current) / 1000;
      
      // Cap delta time to prevent huge jumps if tab was inactive
      const cappedDelta = Math.min(deltaTime, 0.1); 
      
      tick(cappedDelta);

      // Auto-save every 30 seconds
      saveTimeRef.current += cappedDelta;
      if (saveTimeRef.current >= 30) {
        void saveGame();
        saveTimeRef.current = 0;
      }

      // Check achievements every 2 seconds
      achievementCheckRef.current += cappedDelta;
      if (achievementCheckRef.current >= 2) {
        const state = useGameStore.getState();
        checkAchievements(state);
        achievementCheckRef.current = 0;
      }

      // Collect analytics data every 60 seconds (store handles 5-min intervals internally)
      analyticsCheckRef.current += cappedDelta;
      if (analyticsCheckRef.current >= 60) {
        const gameState = useGameStore.getState();
        const analyticsStore = useAnalyticsStore.getState();
        analyticsStore.collectData(gameState.buildings, gameState.resources);
        analyticsStore.updateBottlenecks(gameState.buildings, gameState.resources);
        analyticsCheckRef.current = 0;
      }
    }
    previousTimeRef.current = time;
    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);
};
