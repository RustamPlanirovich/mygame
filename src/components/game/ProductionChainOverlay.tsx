/**
 * ProductionChainOverlay Component
 * 
 * Оверлей для отображения закреплённых цепочек производства на экране.
 * Подобно моду HelMod в Factorio - позволяет выводить цепочки как чек-лист.
 * Панель можно перетаскивать по экрану.
 */

import { useState, memo, useMemo, useRef, useEffect, useCallback } from 'react';
import { 
  X, 
  ChevronDown, 
  ChevronUp, 
  CheckCircle2, 
  XCircle, 
  GripVertical,
  Pin,
  Factory,
  Minimize2,
  Maximize2,
  TrendingUp,
  Move
} from 'lucide-react';
import type { Building, ResourceType } from '../../core/gameTypes';
import { RESOURCE_LABEL } from '../../core/constants/labels';
import { getBuildingIcon } from '../../core/constants/buildingIcons';
import { formatNumber } from '../../core/math/format';
import { usePinnedProductionChains, type FlatChainItem } from '../../hooks/usePinnedProductionChains';
import Decimal from 'break_eternity.js';
import { IconText } from '../ui/icons';

// Ключ для сохранения позиции в localStorage
const POSITION_STORAGE_KEY = 'productionChainOverlayPosition';
const SIZE_STORAGE_KEY = 'productionChainOverlaySize';

// Минимальные и максимальные размеры
const MIN_WIDTH = 200;
const MAX_WIDTH = 500;
const MIN_HEIGHT = 100;
const MAX_HEIGHT = 600;
const DEFAULT_WIDTH = 280;
const DEFAULT_HEIGHT = 300;

interface Position {
  x: number;
  y: number;
}

interface Size {
  width: number;
  height: number;
}

/**
 * Загружает сохранённую позицию панели
 */
function loadSavedPosition(): Position | null {
  try {
    const stored = localStorage.getItem(POSITION_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
        return parsed;
      }
    }
  } catch {
    // Игнорируем ошибки
  }
  return null;
}

/**
 * Сохраняет позицию панели
 */
function savePosition(position: Position): void {
  try {
    localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(position));
  } catch {
    // Игнорируем ошибки
  }
}

/**
 * Загружает сохранённый размер панели
 */
function loadSavedSize(): Size | null {
  try {
    const stored = localStorage.getItem(SIZE_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (typeof parsed.width === 'number' && typeof parsed.height === 'number') {
        return parsed;
      }
    }
  } catch {
    // Игнорируем ошибки
  }
  return null;
}

/**
 * Сохраняет размер панели
 */
function saveSize(size: Size): void {
  try {
    localStorage.setItem(SIZE_STORAGE_KEY, JSON.stringify(size));
  } catch {
    // Игнорируем ошибки
  }
}

interface ProductionChainOverlayProps {
  buildings: Building[];
}

/**
 * Отдельный элемент цепочки в оверлее
 */
const ChainItemRow = memo(({ 
  item, 
  buildings 
}: { 
  item: FlatChainItem; 
  buildings: Building[] 
}) => {
  // Подсчёт производства
  const itemProduction = useMemo(() => {
    let prod = new Decimal(0);
    for (const buildingId of item.buildings) {
      const building = buildings.find(b => b.id === buildingId);
      if (building?.production?.[item.resource]) {
        prod = prod.add(building.production[item.resource]!.mul(building.count));
      }
    }
    return prod;
  }, [item, buildings]);

  return (
    <div 
      className="flex items-center gap-1.5 py-0.5 hover:bg-cyber-gray/10 rounded px-1 transition-colors"
      style={{ paddingLeft: `${4 + item.level * 10}px` }}
    >
      {/* Статус */}
      {item.isProducing ? (
        <CheckCircle2 size={12} className="text-green-500 flex-shrink-0" />
      ) : (
        <XCircle size={12} className="text-red-500 flex-shrink-0" />
      )}

      {/* Название ресурса */}
      <span 
        className={`text-[10px] font-medium flex-1 ${
          item.isProducing ? 'text-green-400' : 'text-red-400'
        }`}
      >
        {RESOURCE_LABEL[item.resource] || item.resource}
      </span>

      {/* Производство/с */}
      {itemProduction.gt(0) && (
        <span className="text-[9px] text-cyber-blue">
          +{formatNumber(itemProduction)}/с
        </span>
      )}

      {/* Здания */}
      <div className="flex items-center gap-0.5">
        {item.buildings.slice(0, 3).map((buildingId, idx) => {
          const b = buildings.find(b => b.id === buildingId);
          if (!b) return null;
          const Icon = getBuildingIcon(buildingId);
          const isBuilt = b.count > 0;
          
          return (
            <div 
              key={`${buildingId}-${idx}`}
              className={`flex items-center gap-0.5 px-1 py-0.5 rounded text-[8px] ${
                isBuilt 
                  ? 'bg-green-500/20 text-green-400' 
                  : 'bg-red-500/20 text-red-400'
              }`}
              title={`${b.name} (${b.count} шт)`}
            >
              <Icon size={8} />
              {isBuilt && <span>×{b.count}</span>}
            </div>
          );
        })}
        {item.buildings.length > 3 && (
          <span className="text-[8px] text-cyber-text-dim">
            +{item.buildings.length - 3}
          </span>
        )}
      </div>
    </div>
  );
});
ChainItemRow.displayName = 'ChainItemRow';

/**
 * Карточка закреплённой цепочки
 */
const PinnedChainCard = memo(({ 
  resource, 
  buildings, 
  minimized,
  onUnpin,
  onToggleMinimized,
  flatChain,
}: { 
  resource: ResourceType; 
  buildings: Building[];
  minimized: boolean;
  onUnpin: () => void;
  onToggleMinimized: () => void;
  flatChain: FlatChainItem[];
}) => {
  // Статистика
  const stats = useMemo(() => {
    const producing = flatChain.filter(i => i.isProducing).length;
    const total = flatChain.length;
    
    let totalProduction = new Decimal(0);
    for (const item of flatChain) {
      if (item.isProducing) {
        for (const buildingId of item.buildings) {
          const building = buildings.find(b => b.id === buildingId);
          if (building?.production?.[item.resource]) {
            totalProduction = totalProduction.add(
              building.production[item.resource]!.mul(building.count)
            );
          }
        }
      }
    }
    
    return { producing, total, totalProduction, allComplete: producing === total };
  }, [flatChain, buildings]);

  return (
    <div 
      className={`
        bg-cyber-dark/95 border rounded-lg shadow-elev-3 flex flex-col flex-1 min-h-0
        ${stats.allComplete ? 'border-green-500/50' : 'border-cyber-blue/50'}
        transition-all duration-200
      `}
    >
      {/* Заголовок */}
      <div 
        className={`
          flex items-center justify-between px-2 py-1.5 cursor-move
          ${stats.allComplete ? 'bg-green-500/10' : 'bg-cyber-blue/10'}
          rounded-t-lg border-b border-cyber-gray/30
        `}
      >
        <div className="flex items-center gap-2">
          <GripVertical size={12} className="text-cyber-text-dim cursor-grab" />
          <Factory size={12} className={stats.allComplete ? 'text-green-400' : 'text-cyber-blue'} />
          <span className="text-xs font-medium text-cyber-text">
            {RESOURCE_LABEL[resource] || resource}
          </span>
        </div>
        
        <div className="flex items-center gap-1">
          {/* Статус */}
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-cyber-black/50">
            {stats.allComplete ? (
              <CheckCircle2 size={10} className="text-green-500" />
            ) : (
              <XCircle size={10} className="text-orange-400" />
            )}
            <span className={`text-[9px] ${stats.allComplete ? 'text-green-400' : 'text-orange-400'}`}>
              {stats.producing}/{stats.total}
            </span>
          </div>
          
          {/* Кнопка минимизации */}
          <button
            type="button"
            onClick={onToggleMinimized}
            className="p-1 hover:bg-cyber-gray/30 rounded transition-colors"
            title={minimized ? 'Развернуть' : 'Свернуть'}
          >
            {minimized ? (
              <Maximize2 size={10} className="text-cyber-text-dim" />
            ) : (
              <Minimize2 size={10} className="text-cyber-text-dim" />
            )}
          </button>
          
          {/* Кнопка закрытия */}
          <button
            type="button"
            onClick={onUnpin}
            className="p-1 hover:bg-red-500/20 rounded transition-colors"
            title="Открепить"
          >
            <X size={10} className="text-red-400" />
          </button>
        </div>
      </div>

      {/* Содержимое */}
      {!minimized && (
        <div className="p-1.5 overflow-y-auto scrollbar-thin flex-1">
          {flatChain.length > 0 ? (
            <div className="space-y-0.5">
              {flatChain.map((item, idx) => (
                <ChainItemRow 
                  key={`${item.resource}-${idx}`} 
                  item={item} 
                  buildings={buildings} 
                />
              ))}
            </div>
          ) : (
            <div className="text-center text-[10px] text-cyber-text-dim py-2">
              Нет данных цепочки
            </div>
          )}
          
          {/* Футер с общим производством */}
          {stats.totalProduction.gt(0) && (
            <div className="mt-1.5 pt-1.5 border-t border-cyber-gray/20 flex items-center justify-end gap-1">
              <TrendingUp size={10} className="text-cyber-blue" />
              <span className="text-[9px] text-cyber-blue">
                Итого: {formatNumber(stats.totalProduction)}/с
              </span>
            </div>
          )}
        </div>
      )}
      
      {/* Свёрнутое состояние - показываем только прогресс */}
      {minimized && (
        <div className="px-2 py-1 flex items-center justify-between text-[9px]">
          <span className="text-cyber-text-dim">
            <IconText>{stats.allComplete ? '✅ Готово' : `⏳ ${stats.producing}/${stats.total}`}</IconText>
          </span>
          {stats.totalProduction.gt(0) && (
            <span className="text-cyber-blue">
              {formatNumber(stats.totalProduction)}/с
            </span>
          )}
        </div>
      )}
    </div>
  );
});
PinnedChainCard.displayName = 'PinnedChainCard';

/**
 * Основной компонент оверлея с поддержкой перетаскивания
 */
export function ProductionChainOverlay({ buildings }: ProductionChainOverlayProps) {
  const { 
    pinnedChains, 
    unpinChain, 
    toggleMinimized, 
    getChainData 
  } = usePinnedProductionChains(buildings);
  
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  // Состояние для перетаскивания
  const [position, setPosition] = useState<Position | null>(() => loadSavedPosition());
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; posX: number; posY: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Обработчик начала перетаскивания
  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    // Если позиция ещё не установлена, вычисляем начальную позицию
    let startPosX = position?.x ?? 0;
    let startPosY = position?.y ?? 0;
    
    if (!position && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      startPosX = rect.left;
      startPosY = rect.top;
    }
    
    dragStartRef.current = {
      x: clientX,
      y: clientY,
      posX: startPosX,
      posY: startPosY,
    };
    
    setIsDragging(true);
  }, [position]);

  // Обработчик перемещения
  const handleDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDragging || !dragStartRef.current) return;
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const deltaX = clientX - dragStartRef.current.x;
    const deltaY = clientY - dragStartRef.current.y;
    
    let newX = dragStartRef.current.posX + deltaX;
    let newY = dragStartRef.current.posY + deltaY;
    
    // Ограничиваем перемещение в пределах экрана
    const maxX = window.innerWidth - 100;
    const maxY = window.innerHeight - 50;
    
    newX = Math.max(0, Math.min(newX, maxX));
    newY = Math.max(0, Math.min(newY, maxY));
    
    setPosition({ x: newX, y: newY });
  }, [isDragging]);

  // Обработчик окончания перетаскивания
  const handleDragEnd = useCallback(() => {
    if (isDragging && position) {
      savePosition(position);
    }
    setIsDragging(false);
    dragStartRef.current = null;
  }, [isDragging, position]);

  // Подписка на глобальные события мыши/тача
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
      window.addEventListener('touchmove', handleDragMove);
      window.addEventListener('touchend', handleDragEnd);
      
      return () => {
        window.removeEventListener('mousemove', handleDragMove);
        window.removeEventListener('mouseup', handleDragEnd);
        window.removeEventListener('touchmove', handleDragMove);
        window.removeEventListener('touchend', handleDragEnd);
      };
    }
  }, [isDragging, handleDragMove, handleDragEnd]);

  // Сброс позиции к дефолтной
  const resetPosition = useCallback(() => {
    setPosition(null);
    localStorage.removeItem(POSITION_STORAGE_KEY);
  }, []);

  // Состояние для изменения размера
  const [size, setSize] = useState<Size>(() => loadSavedSize() || { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState<string | null>(null);
  const resizeStartRef = useRef<{ x: number; y: number; width: number; height: number; posX: number; posY: number } | null>(null);

  // Обработчик начала изменения размера
  const handleResizeStart = useCallback((e: React.MouseEvent | React.TouchEvent, direction: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    resizeStartRef.current = {
      x: clientX,
      y: clientY,
      width: size.width,
      height: size.height,
      posX: position?.x ?? 0,
      posY: position?.y ?? 0,
    };
    
    setResizeDirection(direction);
    setIsResizing(true);
  }, [size, position]);

  // Обработчик изменения размера
  const handleResizeMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isResizing || !resizeStartRef.current || !resizeDirection) return;
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const deltaX = clientX - resizeStartRef.current.x;
    const deltaY = clientY - resizeStartRef.current.y;
    
    let newWidth = resizeStartRef.current.width;
    let newHeight = resizeStartRef.current.height;
    let newPosX = resizeStartRef.current.posX;
    let newPosY = resizeStartRef.current.posY;
    
    // Изменение размера в зависимости от направления
    if (resizeDirection.includes('e')) {
      newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, resizeStartRef.current.width + deltaX));
    }
    if (resizeDirection.includes('w')) {
      const widthDelta = -deltaX;
      newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, resizeStartRef.current.width + widthDelta));
      if (newWidth !== resizeStartRef.current.width) {
        newPosX = resizeStartRef.current.posX - (newWidth - resizeStartRef.current.width);
      }
    }
    if (resizeDirection.includes('s')) {
      newHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, resizeStartRef.current.height + deltaY));
    }
    if (resizeDirection.includes('n')) {
      const heightDelta = -deltaY;
      newHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, resizeStartRef.current.height + heightDelta));
      if (newHeight !== resizeStartRef.current.height) {
        newPosY = resizeStartRef.current.posY - (newHeight - resizeStartRef.current.height);
      }
    }
    
    setSize({ width: newWidth, height: newHeight });
    
    // Обновляем позицию если тянем за левый или верхний край
    if (resizeDirection.includes('w') || resizeDirection.includes('n')) {
      if (position || newPosX !== resizeStartRef.current.posX || newPosY !== resizeStartRef.current.posY) {
        setPosition({ x: newPosX, y: newPosY });
      }
    }
  }, [isResizing, resizeDirection, position]);

  // Обработчик окончания изменения размера
  const handleResizeEnd = useCallback(() => {
    if (isResizing) {
      saveSize(size);
      if (position) {
        savePosition(position);
      }
    }
    setIsResizing(false);
    setResizeDirection(null);
    resizeStartRef.current = null;
  }, [isResizing, size, position]);

  // Подписка на глобальные события для ресайза
  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleResizeMove);
      window.addEventListener('mouseup', handleResizeEnd);
      window.addEventListener('touchmove', handleResizeMove);
      window.addEventListener('touchend', handleResizeEnd);
      
      return () => {
        window.removeEventListener('mousemove', handleResizeMove);
        window.removeEventListener('mouseup', handleResizeEnd);
        window.removeEventListener('touchmove', handleResizeMove);
        window.removeEventListener('touchend', handleResizeEnd);
      };
    }
  }, [isResizing, handleResizeMove, handleResizeEnd]);

  // Сброс размера к дефолтному
  const resetSize = useCallback(() => {
    setSize({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
    localStorage.removeItem(SIZE_STORAGE_KEY);
  }, []);

  // Если нет закреплённых цепочек, не показываем оверлей
  if (pinnedChains.length === 0) {
    return null;
  }

  // Стили позиционирования
  const positionStyle = position 
    ? { left: position.x, top: position.y, right: 'auto' }
    : { top: 80, right: 16 };

  return (
    <div 
      ref={containerRef}
      className={`fixed z-40 flex flex-col ${isDragging ? 'cursor-grabbing' : ''} ${isResizing ? 'select-none' : ''}`}
      style={{
        ...positionStyle,
        width: size.width,
      }}
    >
      {/* Заголовок оверлея с хендлером для перетаскивания */}
      <div className="flex items-center justify-between bg-cyber-dark/90 border border-cyber-gray/50 rounded-t-lg px-2 py-1">
        {/* Хендлер перетаскивания */}
        <div 
          className="flex items-center gap-1.5 cursor-grab active:cursor-grabbing select-none"
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
        >
          <Move size={12} className="text-cyber-text-dim" />
          <Pin size={12} className="text-cyber-green" />
          <span className="text-xs font-medium text-cyber-text">
            Цепочки ({pinnedChains.length})
          </span>
        </div>
        
        <div className="flex items-center gap-0.5">
          {/* Кнопка сброса позиции и размера */}
          {(position || size.width !== DEFAULT_WIDTH || size.height !== DEFAULT_HEIGHT) && (
            <button
              type="button"
              onClick={() => { resetPosition(); resetSize(); }}
              className="p-1 hover:bg-cyber-gray/30 rounded transition-colors"
              title="Сбросить позицию и размер"
            >
              <X size={10} className="text-cyber-text-dim" />
            </button>
          )}
          
          {/* Кнопка сворачивания */}
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 hover:bg-cyber-gray/30 rounded transition-colors"
          >
            {isCollapsed ? (
              <ChevronDown size={12} className="text-cyber-text-dim" />
            ) : (
              <ChevronUp size={12} className="text-cyber-text-dim" />
            )}
          </button>
        </div>
      </div>

      {/* Список закреплённых цепочек */}
      {!isCollapsed && (
        <div 
          className="flex flex-col gap-2 bg-cyber-dark/80 border-x border-b border-cyber-gray/50 rounded-b-lg p-2 overflow-hidden"
          style={{ height: size.height, minHeight: MIN_HEIGHT }}
        >
          {pinnedChains.map((pinned) => {
            const { flatChain } = getChainData(pinned.resource);
            
            return (
              <PinnedChainCard
                key={pinned.id}
                resource={pinned.resource}
                buildings={buildings}
                minimized={pinned.minimized}
                onUnpin={() => unpinChain(pinned.resource)}
                onToggleMinimized={() => toggleMinimized(pinned.resource)}
                flatChain={flatChain}
              />
            );
          })}
        </div>
      )}

      {/* Хендлеры для изменения размера */}
      {!isCollapsed && (
        <>
          {/* Правый край */}
          <div 
            className="absolute top-0 right-0 w-2 h-full cursor-ew-resize hover:bg-cyber-blue/20"
            onMouseDown={(e) => handleResizeStart(e, 'e')}
            onTouchStart={(e) => handleResizeStart(e, 'e')}
          />
          {/* Нижний край */}
          <div 
            className="absolute bottom-0 left-0 w-full h-2 cursor-ns-resize hover:bg-cyber-blue/20"
            onMouseDown={(e) => handleResizeStart(e, 's')}
            onTouchStart={(e) => handleResizeStart(e, 's')}
          />
          {/* Левый край */}
          <div 
            className="absolute top-0 left-0 w-2 h-full cursor-ew-resize hover:bg-cyber-blue/20"
            onMouseDown={(e) => handleResizeStart(e, 'w')}
            onTouchStart={(e) => handleResizeStart(e, 'w')}
          />
          {/* Верхний край (только для контента, не заголовка) */}
          {/* Нижний правый угол */}
          <div 
            className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize hover:bg-cyber-blue/30"
            onMouseDown={(e) => handleResizeStart(e, 'se')}
            onTouchStart={(e) => handleResizeStart(e, 'se')}
          >
            <div className="absolute bottom-1 right-1 w-2 h-2 border-r-2 border-b-2 border-cyber-gray/50" />
          </div>
          {/* Нижний левый угол */}
          <div 
            className="absolute bottom-0 left-0 w-4 h-4 cursor-nesw-resize hover:bg-cyber-blue/30"
            onMouseDown={(e) => handleResizeStart(e, 'sw')}
            onTouchStart={(e) => handleResizeStart(e, 'sw')}
          />
        </>
      )}
    </div>
  );
}

export default ProductionChainOverlay;
