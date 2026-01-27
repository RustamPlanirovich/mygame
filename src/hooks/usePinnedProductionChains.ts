import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import type { ResourceType, Building } from '../core/gameTypes';
import { getResourceProductionChain, flattenProductionChain, type ProductionChainStep } from '../utils/productionChainHelpers';

/**
 * Данные закреплённой цепочки производства
 */
export interface PinnedProductionChain {
  id: string;
  resource: ResourceType;
  addedAt: number;
  minimized: boolean;
}

/**
 * Элемент плоской цепочки с дополнительной информацией
 */
export interface FlatChainItem {
  resource: ResourceType;
  buildings: string[];
  isProducing: boolean;
  level: number;
}

const STORAGE_KEY = 'pinnedProductionChains';
const MAX_PINNED_CHAINS = 5;

/**
 * Загружает закреплённые цепочки из localStorage
 */
function loadPinnedChains(): PinnedProductionChain[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed.filter((item: unknown): item is PinnedProductionChain => 
          typeof item === 'object' && 
          item !== null && 
          'id' in item && 
          'resource' in item &&
          'addedAt' in item &&
          'minimized' in item
        );
      }
    }
  } catch (e) {
    console.error('Ошибка загрузки закреплённых цепочек:', e);
  }
  return [];
}

/**
 * Сохраняет закреплённые цепочки в localStorage
 */
function savePinnedChains(chains: PinnedProductionChain[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chains));
  } catch (e) {
    console.error('Ошибка сохранения закреплённых цепочек:', e);
  }
}

/**
 * Кэш для цепочек производства - предотвращает пересчёт при каждом рендере
 */
class ProductionChainCache {
  private cache = new Map<string, {
    chain: ProductionChainStep | null;
    flatChain: FlatChainItem[];
    buildingsHash: string;
    timestamp: number;
  }>();
  
  private readonly TTL = 2000; // 2 секунды кэширования
  
  private getBuildingsHash(buildings: Building[]): string {
    // Создаём быстрый хэш на основе количества зданий
    return buildings.map(b => `${b.id}:${b.count}`).join(',');
  }
  
  getChain(resource: ResourceType, buildings: Building[]): {
    chain: ProductionChainStep | null;
    flatChain: FlatChainItem[];
  } {
    const buildingsHash = this.getBuildingsHash(buildings);
    const cached = this.cache.get(resource);
    const now = Date.now();
    
    // Если кэш валиден
    if (cached && cached.buildingsHash === buildingsHash && now - cached.timestamp < this.TTL) {
      return { chain: cached.chain, flatChain: cached.flatChain };
    }
    
    // Пересчитываем цепочку
    const chain = getResourceProductionChain(resource, buildings);
    const flatChain = flattenProductionChain(chain);
    
    // Сохраняем в кэш
    this.cache.set(resource, {
      chain,
      flatChain,
      buildingsHash,
      timestamp: now,
    });
    
    return { chain, flatChain };
  }
  
  invalidate(resource?: ResourceType): void {
    if (resource) {
      this.cache.delete(resource);
    } else {
      this.cache.clear();
    }
  }
}

// Глобальный кэш
const chainCache = new ProductionChainCache();

/**
 * Хук для управления закреплёнными цепочками производства
 */
export function usePinnedProductionChains(buildings: Building[]) {
  const [pinnedChains, setPinnedChains] = useState<PinnedProductionChain[]>(() => loadPinnedChains());
  const buildingsRef = useRef(buildings);
  buildingsRef.current = buildings;

  // Синхронизация с localStorage
  useEffect(() => {
    savePinnedChains(pinnedChains);
  }, [pinnedChains]);

  /**
   * Закрепить цепочку производства
   */
  const pinChain = useCallback((resource: ResourceType) => {
    setPinnedChains(prev => {
      // Проверяем, не закреплена ли уже
      if (prev.some(p => p.resource === resource)) {
        return prev;
      }
      
      // Ограничение на количество
      if (prev.length >= MAX_PINNED_CHAINS) {
        // Удаляем самую старую
        const sorted = [...prev].sort((a, b) => a.addedAt - b.addedAt);
        sorted.shift();
        return [...sorted, {
          id: `chain-${resource}-${Date.now()}`,
          resource,
          addedAt: Date.now(),
          minimized: false,
        }];
      }
      
      return [...prev, {
        id: `chain-${resource}-${Date.now()}`,
        resource,
        addedAt: Date.now(),
        minimized: false,
      }];
    });
  }, []);

  /**
   * Открепить цепочку производства
   */
  const unpinChain = useCallback((resource: ResourceType) => {
    setPinnedChains(prev => prev.filter(p => p.resource !== resource));
  }, []);

  /**
   * Проверить, закреплена ли цепочка
   */
  const isPinned = useCallback((resource: ResourceType) => {
    return pinnedChains.some(p => p.resource === resource);
  }, [pinnedChains]);

  /**
   * Переключить закрепление
   */
  const togglePin = useCallback((resource: ResourceType) => {
    if (isPinned(resource)) {
      unpinChain(resource);
    } else {
      pinChain(resource);
    }
  }, [isPinned, pinChain, unpinChain]);

  /**
   * Свернуть/развернуть цепочку
   */
  const toggleMinimized = useCallback((resource: ResourceType) => {
    setPinnedChains(prev => prev.map(p => 
      p.resource === resource ? { ...p, minimized: !p.minimized } : p
    ));
  }, []);

  /**
   * Получить данные цепочки с кэшированием
   */
  const getChainData = useCallback((resource: ResourceType) => {
    return chainCache.getChain(resource, buildingsRef.current);
  }, []);

  /**
   * Инвалидировать кэш (например, при изменении зданий)
   */
  const invalidateCache = useCallback((resource?: ResourceType) => {
    chainCache.invalidate(resource);
  }, []);

  return useMemo(() => ({
    pinnedChains,
    pinChain,
    unpinChain,
    isPinned,
    togglePin,
    toggleMinimized,
    getChainData,
    invalidateCache,
    maxPinned: MAX_PINNED_CHAINS,
  }), [pinnedChains, pinChain, unpinChain, isPinned, togglePin, toggleMinimized, getChainData, invalidateCache]);
}

/**
 * Хук для оптимизированного получения цепочки с debounce
 */
export function useDebouncedChain(
  resource: ResourceType | null,
  buildings: Building[],
  delay: number = 300
) {
  const [chain, setChain] = useState<ProductionChainStep | null>(null);
  const [flatChain, setFlatChain] = useState<FlatChainItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resourceRef = useRef(resource);
  resourceRef.current = resource;

  useEffect(() => {
    // Очищаем предыдущий таймер
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (!resource) {
      setChain(null);
      setFlatChain([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    // Debounce - откладываем вычисление
    timeoutRef.current = setTimeout(() => {
      // Проверяем, что ресурс не изменился
      if (resourceRef.current === resource) {
        const result = chainCache.getChain(resource, buildings);
        setChain(result.chain);
        setFlatChain(result.flatChain);
      }
      setIsLoading(false);
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [resource, buildings, delay]);

  return { chain, flatChain, isLoading };
}
