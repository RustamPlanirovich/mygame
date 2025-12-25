/**
 * Простой LRU (Least Recently Used) кеш для мемоизации результатов вычислений
 */
export class LRUCache<K, V> {
  private cache: Map<K, V>;
  private maxSize: number;

  constructor(maxSize: number = 100) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    if (!this.cache.has(key)) {
      return undefined;
    }

    // Переместить в конец (самый свежий)
    const value = this.cache.get(key)!;
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key: K, value: V): void {
    // Если уже есть, удалить старую запись
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Добавить новую запись
    this.cache.set(key, value);

    // Удалить самую старую запись если превышен лимит
    if (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

/**
 * Мемоизация функций с кешированием результатов
 */
export function memoize<T extends (...args: any[]) => any>(
  fn: T,
  getCacheKey?: (...args: Parameters<T>) => string
): T {
  const cache = new Map<string, ReturnType<T>>();

  return ((...args: Parameters<T>) => {
    const key = getCacheKey ? getCacheKey(...args) : JSON.stringify(args);

    if (cache.has(key)) {
      return cache.get(key);
    }

    const result = fn(...args);
    cache.set(key, result);
    return result;
  }) as T;
}

/**
 * Мемоизация с TTL (Time To Live)
 */
export function memoizeWithTTL<T extends (...args: any[]) => any>(
  fn: T,
  ttlMs: number = 5000,
  getCacheKey?: (...args: Parameters<T>) => string
): T {
  const cache = new Map<string, { value: ReturnType<T>; expiry: number }>();

  return ((...args: Parameters<T>) => {
    const key = getCacheKey ? getCacheKey(...args) : JSON.stringify(args);
    const now = Date.now();

    const cached = cache.get(key);
    if (cached && cached.expiry > now) {
      return cached.value;
    }

    const result = fn(...args);
    cache.set(key, { value: result, expiry: now + ttlMs });
    return result;
  }) as T;
}

/**
 * Батчинг операций для уменьшения количества вызовов
 */
export class BatchProcessor<T, R> {
  private queue: T[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private processor: (items: T[]) => Promise<R[]>;
  private delay: number;

  constructor(processor: (items: T[]) => Promise<R[]>, delay: number = 100) {
    this.processor = processor;
    this.delay = delay;
  }

  add(item: T): Promise<R> {
    return new Promise((resolve, reject) => {
      this.queue.push(item);

      if (this.timer) {
        clearTimeout(this.timer);
      }

      this.timer = setTimeout(async () => {
        const items = [...this.queue];
        this.queue = [];
        
        try {
          const results = await this.processor(items);
          resolve(results[results.length - 1]); // Возвращаем последний результат
        } catch (error) {
          reject(error);
        }
      }, this.delay);
    });
  }

  flush(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

/**
 * Кеш для вычислений с зависимостями (invalidation)
 */
export class DependencyCache<K, V> {
  private cache: Map<K, { value: V; dependencies: Set<string> }>;
  private dependencyIndex: Map<string, Set<K>>;

  constructor() {
    this.cache = new Map();
    this.dependencyIndex = new Map();
  }

  get(key: K): V | undefined {
    return this.cache.get(key)?.value;
  }

  set(key: K, value: V, dependencies: string[]): void {
    // Очистить старые зависимости
    const old = this.cache.get(key);
    if (old) {
      old.dependencies.forEach(dep => {
        this.dependencyIndex.get(dep)?.delete(key);
      });
    }

    // Установить новое значение
    const deps = new Set(dependencies);
    this.cache.set(key, { value, dependencies: deps });

    // Обновить индекс зависимостей
    dependencies.forEach(dep => {
      if (!this.dependencyIndex.has(dep)) {
        this.dependencyIndex.set(dep, new Set());
      }
      this.dependencyIndex.get(dep)!.add(key);
    });
  }

  invalidate(dependency: string): void {
    const keys = this.dependencyIndex.get(dependency);
    if (keys) {
      keys.forEach(key => this.cache.delete(key));
      keys.clear();
    }
  }

  clear(): void {
    this.cache.clear();
    this.dependencyIndex.clear();
  }
}

/**
 * Глобальный кеш для приложения
 */
export const globalCache = {
  buildings: new LRUCache<string, any>(50),
  resources: new LRUCache<string, any>(50),
  calculations: new DependencyCache<string, any>(),
};
