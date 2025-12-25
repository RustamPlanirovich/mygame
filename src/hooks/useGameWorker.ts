import { useEffect, useRef, useCallback } from 'react';
import type { WorkerRequest, WorkerResponse } from '../workers/gameWorker';

/**
 * Хук для работы с Web Worker
 * Поддерживает пул воркеров для параллельных вычислений
 */
export const useGameWorker = (poolSize: number = 2) => {
  const workersRef = useRef<Worker[]>([]);
  const pendingRequestsRef = useRef<Map<string, {
    resolve: (result: any) => void;
    reject: (error: Error) => void;
  }>>(new Map());
  const requestIdRef = useRef(0);
  const currentWorkerRef = useRef(0);

  // Инициализация пула воркеров
  useEffect(() => {
    // Создаем пул воркеров
    for (let i = 0; i < poolSize; i++) {
      try {
        const worker = new Worker(
          new URL('../workers/gameWorker.ts', import.meta.url),
          { type: 'module' }
        );
        
        worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
          const response = event.data;
          const pending = pendingRequestsRef.current.get(response.id);
          
          if (pending) {
            if (response.error) {
              pending.reject(new Error(response.error));
            } else {
              pending.resolve(response.result);
            }
            pendingRequestsRef.current.delete(response.id);
          }
        };
        
        worker.onerror = (error) => {
          console.error('[GameWorker] Error:', error);
        };
        
        workersRef.current.push(worker);
      } catch (error) {
        console.error('[GameWorker] Failed to create worker:', error);
      }
    }

    // Cleanup
    return () => {
      workersRef.current.forEach(worker => worker.terminate());
      workersRef.current = [];
      pendingRequestsRef.current.clear();
    };
  }, [poolSize]);

  // Отправка запроса в воркер
  const sendRequest = useCallback(<T = any>(
    type: WorkerRequest['type'],
    data: any
  ): Promise<T> => {
    return new Promise((resolve, reject) => {
      if (workersRef.current.length === 0) {
        reject(new Error('Workers not initialized'));
        return;
      }

      const id = `req_${requestIdRef.current++}`;
      pendingRequestsRef.current.set(id, { resolve, reject });

      // Round-robin между воркерами
      const worker = workersRef.current[currentWorkerRef.current];
      currentWorkerRef.current = (currentWorkerRef.current + 1) % workersRef.current.length;

      const request: WorkerRequest = { id, type, data };
      worker.postMessage(request);
    });
  }, []);

  return {
    sendRequest,
    isReady: workersRef.current.length > 0,
  };
};

/**
 * Специализированные хуки для конкретных типов вычислений
 */

export const useProximityWorker = () => {
  const { sendRequest, isReady } = useGameWorker(1);

  const calculateProximity = useCallback(async (buildings: any[], tiles: any[][]) => {
    if (!isReady) return {};
    return sendRequest<Record<string, number>>('proximity', { buildings, tiles });
  }, [sendRequest, isReady]);

  return { calculateProximity, isReady };
};

export const useAchievementWorker = () => {
  const { sendRequest, isReady } = useGameWorker(1);

  const checkAchievements = useCallback(async (data: {
    buildings: any[];
    totalCredits: string;
    totalResearchPoints: string;
    technologiesUnlocked: number;
  }) => {
    if (!isReady) return [];
    return sendRequest<string[]>('achievements', data);
  }, [sendRequest, isReady]);

  return { checkAchievements, isReady };
};

export const useProductionWorker = () => {
  const { sendRequest, isReady } = useGameWorker(1);

  const calculateProduction = useCallback(async (data: {
    buildings: any[];
    resources: Record<string, string>;
  }) => {
    if (!isReady) return { totalProduction: {}, bottlenecks: [] };
    return sendRequest<{
      totalProduction: Record<string, string>;
      bottlenecks: string[];
    }>('production', data);
  }, [sendRequest, isReady]);

  return { calculateProduction, isReady };
};

export const usePathfindingWorker = () => {
  const { sendRequest, isReady } = useGameWorker(2); // 2 воркера для параллельного pathfinding

  const findPath = useCallback(async (data: {
    start: { x: number; y: number };
    end: { x: number; y: number };
    obstacles: { x: number; y: number }[];
    gridWidth: number;
    gridHeight: number;
  }) => {
    if (!isReady) return [];
    return sendRequest<{ x: number; y: number }[]>('pathfinding', data);
  }, [sendRequest, isReady]);

  return { findPath, isReady };
};
