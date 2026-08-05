import { useGameStore } from '../../features/gameStore';
import { useMemo, useState } from 'react';
import { Maximize2, Minimize2, Home } from 'lucide-react';
import { gameEvents, GAME_EVENTS } from '../../utils/gameEvents';

const MINIMAP_SIZE = 80; // фиксированный размер мини-карты в пикселях

export const Minimap = () => {
  // ВАЖНО: НЕ подписываемся на весь `state.grid`. tick() возвращает новый объект grid
  // 20 раз в секунду (новые buffers/activeTransports/lastDtSeconds), поэтому подписка на
  // слайс целиком перерисовывала мини-карту 20 раз в секунду.
  // Мини-карте нужны только tiles/width/height, а их ссылки spread'ом не меняются.
  const tiles = useGameStore(state => state.grid.tiles);
  const gridWidth = useGameStore(state => state.grid.width);
  const gridHeight = useGameStore(state => state.grid.height);
  const [isExpanded, setIsExpanded] = useState(false);

  // Создаем карту цветов для зданий по их ID
  const getBuildingColor = (buildingId: string) => {
    // Energy buildings
    if (buildingId.includes('power') || buildingId.includes('solar') || buildingId.includes('energy')) {
      return '#ffb86c'; // yellow
    }
    // Mining
    if (buildingId.includes('mine') || buildingId.includes('well') || buildingId.includes('quarry')) {
      return '#7f849f'; // stone
    }
    // Processing
    if (buildingId.includes('refinery') || buildingId.includes('mill') || buildingId.includes('plant')) {
      return '#f39c12'; // orange
    }
    // Manufacturing
    if (buildingId.includes('factory') || buildingId.includes('assembly')) {
      return '#8be9fd'; // blue
    }
    // Research
    if (buildingId.includes('lab') || buildingId.includes('research') || buildingId.includes('computer')) {
      return '#bd93f9'; // purple
    }
    // Defense
    if (buildingId.includes('turret') || buildingId.includes('radar') || buildingId.includes('shield')) {
      return '#ff5555'; // red
    }
    // Storage
    if (buildingId.includes('warehouse') || buildingId.includes('storage')) {
      return '#2ecc71'; // green
    }
    // Special
    return '#3dc5de'; // cyan
  };

  // Генерируем клетки мини-карты
  const cells = useMemo(() => {
    const result = [];
    const maxDimension = Math.max(gridWidth, gridHeight);
    const cellSize = MINIMAP_SIZE / maxDimension;
    
    for (let y = 0; y < gridHeight; y++) {
      for (let x = 0; x < gridWidth; x++) {
        const key = `${x},${y}`;
        const buildingId = tiles[key];
        
        if (buildingId) {
          const color = getBuildingColor(buildingId);
          result.push({ 
            x: x * cellSize, 
            y: y * cellSize, 
            size: cellSize,
            color, 
            key,
            gridX: x,
            gridY: y
          });
        }
      }
    }
    return result;
  }, [tiles, gridWidth, gridHeight]);

  const mapSize = isExpanded ? MINIMAP_SIZE * 2 : MINIMAP_SIZE;

  return (
    <div className="absolute bottom-4 right-4 z-10 animate-scale-in">
      <div className="glass rounded-md border border-edge p-3 shadow-elev-3">
        <div className="flex items-center justify-between mb-2">
          <span className="stat-label">Мини-карта</span>
          <div className="flex gap-1">
            <button
              onClick={() => gameEvents.emit(GAME_EVENTS.GO_TO_BASE)}
              className="cyber-button p-1 text-[10px]"
              title="На базу"
            >
              <Home size={12} />
            </button>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="cyber-button p-1 text-[10px]"
              title={isExpanded ? 'Свернуть' : 'Развернуть'}
            >
              {isExpanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
            </button>
          </div>
        </div>
        
        <div 
          className="relative bg-cyber-black border border-cyber-gray/50"
          style={{ 
            width: `${mapSize}px`, 
            height: `${mapSize}px` 
          }}
        >
          {/* Сетка */}
          <svg 
            width={mapSize} 
            height={mapSize} 
            className="absolute inset-0"
          >
            {/* Вертикальные линии */}
            {Array.from({ length: gridWidth + 1 }).map((_, i) => {
              const maxDim = Math.max(gridWidth, gridHeight);
              const cellSize = mapSize / maxDim;
              return (
                <line
                  key={`v-${i}`}
                  x1={i * cellSize}
                  y1={0}
                  x2={i * cellSize}
                  y2={mapSize}
                  stroke="rgba(100, 100, 100, 0.2)"
                  strokeWidth={0.5}
                />
              );
            })}
            {/* Горизонтальные линии */}
            {Array.from({ length: gridHeight + 1 }).map((_, i) => {
              const maxDim = Math.max(gridWidth, gridHeight);
              const cellSize = mapSize / maxDim;
              return (
                <line
                  key={`h-${i}`}
                  x1={0}
                  y1={i * cellSize}
                  x2={mapSize}
                  y2={i * cellSize}
                  stroke="rgba(100, 100, 100, 0.2)"
                  strokeWidth={0.5}
                />
              );
            })}
          </svg>

          {/* Здания */}
          {cells.map(cell => {
            const scaledSize = isExpanded ? cell.size * 2 : cell.size;
            const scaledX = isExpanded ? cell.x * 2 : cell.x;
            const scaledY = isExpanded ? cell.y * 2 : cell.y;
            return (
              <div
                key={cell.key}
                className="absolute transition-all duration-200 hover:scale-110"
                style={{
                  left: `${scaledX}px`,
                  top: `${scaledY}px`,
                  width: `${scaledSize}px`,
                  height: `${scaledSize}px`,
                  backgroundColor: cell.color,
                  opacity: 0.8,
                }}
                title={`Здание на (${cell.gridX}, ${cell.gridY})`}
              />
            );
          })}
        </div>

        {/* Легенда */}
        {isExpanded && (
          <div className="mt-2 pt-2 border-t border-cyber-gray/50">
            <div className="grid grid-cols-2 gap-1 text-[9px]">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2" style={{ backgroundColor: '#ffb86c' }} />
                <span>Энергия</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2" style={{ backgroundColor: '#7f849f' }} />
                <span>Добыча</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2" style={{ backgroundColor: '#f39c12' }} />
                <span>Переработка</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2" style={{ backgroundColor: '#8be9fd' }} />
                <span>Производство</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2" style={{ backgroundColor: '#bd93f9' }} />
                <span>Наука</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2" style={{ backgroundColor: '#ff5555' }} />
                <span>Оборона</span>
              </div>
            </div>
          </div>
        )}

        <div className="mt-2 pt-2 border-t border-cyber-gray/50 text-[10px] text-cyber-text-dim text-center">
          Всего зданий: {cells.length}/{gridWidth * gridHeight}
        </div>
      </div>
    </div>
  );
};
