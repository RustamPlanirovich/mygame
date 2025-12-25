import { useGameStore } from '../../features/gameStore';
import { useMemo, useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';

const GRID_SIZE = 20;
const CELL_SIZE = 4; // размер клетки на мини-карте

export const Minimap = () => {
  const grid = useGameStore(state => state.grid);
  const [isExpanded, setIsExpanded] = useState(false);

  // Создаем карту цветов для зданий по их ID
  const getBuildingColor = (buildingId: string) => {
    // Energy buildings
    if (buildingId.includes('power') || buildingId.includes('solar') || buildingId.includes('energy')) {
      return '#fbbf24'; // yellow
    }
    // Mining
    if (buildingId.includes('mine') || buildingId.includes('well') || buildingId.includes('quarry')) {
      return '#78716c'; // stone
    }
    // Processing
    if (buildingId.includes('refinery') || buildingId.includes('mill') || buildingId.includes('plant')) {
      return '#f97316'; // orange
    }
    // Manufacturing
    if (buildingId.includes('factory') || buildingId.includes('assembly')) {
      return '#3b82f6'; // blue
    }
    // Research
    if (buildingId.includes('lab') || buildingId.includes('research') || buildingId.includes('computer')) {
      return '#8b5cf6'; // purple
    }
    // Defense
    if (buildingId.includes('turret') || buildingId.includes('radar') || buildingId.includes('shield')) {
      return '#ef4444'; // red
    }
    // Storage
    if (buildingId.includes('warehouse') || buildingId.includes('storage')) {
      return '#10b981'; // green
    }
    // Special
    return '#06b6d4'; // cyan
  };

  // Генерируем клетки мини-карты
  const cells = useMemo(() => {
    const result = [];
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const key = `${x},${y}`;
        const buildingId = grid.tiles[key];
        
        if (buildingId) {
          const color = getBuildingColor(buildingId);
          result.push({ x, y, color, key });
        }
      }
    }
    return result;
  }, [grid.tiles]);

  const size = isExpanded ? CELL_SIZE * 2 : CELL_SIZE;
  const mapSize = GRID_SIZE * size;

  return (
    <div className="absolute bottom-4 right-4 z-10 animate-scale-in">
      <div className="bg-cyber-dark/90 backdrop-blur-sm border-2 border-cyber-green rounded-lg p-3 shadow-2xl">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-cyber-green font-bold">МИНИ-КАРТА</span>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="cyber-button p-1 text-[10px]"
            title={isExpanded ? 'Свернуть' : 'Развернуть'}
          >
            {isExpanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
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
            {Array.from({ length: GRID_SIZE + 1 }).map((_, i) => (
              <line
                key={`v-${i}`}
                x1={i * size}
                y1={0}
                x2={i * size}
                y2={mapSize}
                stroke="rgba(100, 100, 100, 0.2)"
                strokeWidth={0.5}
              />
            ))}
            {/* Горизонтальные линии */}
            {Array.from({ length: GRID_SIZE + 1 }).map((_, i) => (
              <line
                key={`h-${i}`}
                x1={0}
                y1={i * size}
                x2={mapSize}
                y2={i * size}
                stroke="rgba(100, 100, 100, 0.2)"
                strokeWidth={0.5}
              />
            ))}
          </svg>

          {/* Здания */}
          {cells.map(cell => (
            <div
              key={cell.key}
              className="absolute transition-all duration-200 hover:scale-110"
              style={{
                left: `${cell.x * size}px`,
                top: `${cell.y * size}px`,
                width: `${size}px`,
                height: `${size}px`,
                backgroundColor: cell.color,
                opacity: 0.8,
              }}
              title={`Здание на (${cell.x}, ${cell.y})`}
            />
          ))}
        </div>

        {/* Легенда */}
        {isExpanded && (
          <div className="mt-2 pt-2 border-t border-cyber-gray/50">
            <div className="grid grid-cols-2 gap-1 text-[9px]">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2" style={{ backgroundColor: '#fbbf24' }} />
                <span>Энергия</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2" style={{ backgroundColor: '#78716c' }} />
                <span>Добыча</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2" style={{ backgroundColor: '#f97316' }} />
                <span>Переработка</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2" style={{ backgroundColor: '#3b82f6' }} />
                <span>Производство</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2" style={{ backgroundColor: '#8b5cf6' }} />
                <span>Наука</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2" style={{ backgroundColor: '#ef4444' }} />
                <span>Оборона</span>
              </div>
            </div>
          </div>
        )}

        <div className="mt-2 pt-2 border-t border-cyber-gray/50 text-[10px] text-cyber-text-dim text-center">
          Всего зданий: {cells.length}/{GRID_SIZE * GRID_SIZE}
        </div>
      </div>
    </div>
  );
};
