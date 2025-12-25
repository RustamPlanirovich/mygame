import { useRef, useEffect, useState } from 'react';

/**
 * Хук для мемоизации дорогих вычислений с кастомным сравнением зависимостей
 */
export function useMemoCompare<T>(
  factory: () => T,
  deps: React.DependencyList,
  compare: (prev: React.DependencyList | undefined, next: React.DependencyList) => boolean
): T {
  const ref = useRef<{ deps: React.DependencyList | undefined; value: T }>();

  if (!ref.current || !compare(ref.current.deps, deps)) {
    ref.current = { deps, value: factory() };
  }

  return ref.current.value;
}

/**
 * Хук для throttle функций (ограничение частоты вызовов)
 */
export function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const lastRun = useRef(Date.now());

  return useRef((...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastRun.current >= delay) {
      lastRun.current = now;
      return callback(...args);
    }
  }).current as T;
}

/**
 * Хук для debounce функций (задержка выполнения)
 */
export function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useRef((...args: Parameters<T>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      callback(...args);
    }, delay);
  }).current as T;
}

/**
 * Хук для отслеживания видимости элемента (для lazy loading)
 */
export function useIntersectionObserver(
  ref: React.RefObject<Element>,
  options?: IntersectionObserverInit
): boolean {
  const [isIntersecting, setIsIntersecting] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting);
    }, options);

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [ref, options]);

  return isIntersecting;
}

/**
 * Хук для измерения производительности компонента
 */
export function usePerformanceMonitor(componentName: string, enabled = false) {
  const renderCount = useRef(0);
  const renderTimes = useRef<number[]>([]);
  const startTime = useRef<number>();

  useEffect(() => {
    if (!enabled) return;
    
    renderCount.current += 1;
    startTime.current = performance.now();
  });

  useEffect(() => {
    if (!enabled || !startTime.current) return;

    const renderTime = performance.now() - startTime.current;
    renderTimes.current.push(renderTime);

    // Логируем каждые 10 рендеров
    if (renderCount.current % 10 === 0) {
      const avg = renderTimes.current.reduce((a, b) => a + b, 0) / renderTimes.current.length;
      console.log(
        `[Performance] ${componentName}: ${renderCount.current} renders, avg time: ${avg.toFixed(2)}ms`
      );
      renderTimes.current = [];
    }
  });

  return {
    renderCount: renderCount.current,
    getAverageRenderTime: () => {
      if (renderTimes.current.length === 0) return 0;
      return renderTimes.current.reduce((a, b) => a + b, 0) / renderTimes.current.length;
    },
  };
}
