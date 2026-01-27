/**
 * Компонент гексагональной сетки (Фаза 4)
 * Рендеринг карты с гексагональными клетками
 */

import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import type { DepositType } from '../../core/gameTypes';
import { coordKey } from '../../utils/mapGenerator';
import { BUILDING_EMOJI } from '../../core/constants/buildingEmoji';

// Размеры гексагона
const HEX_SIZE = 30; // Радиус
const HEX_WIDTH = HEX_SIZE * Math.sqrt(3);
const HEX_HEIGHT = HEX_SIZE * 2;
const HEX_VERT_SPACING = HEX_HEIGHT * 0.75;

// Цвета депозитов
const DEPOSIT_COLORS: Partial<Record<DepositType, string>> = {
  ore: '#8B4513',
  ice: '#87CEEB',
  carbon: '#2F4F4F',
  natural_gas: '#FFD700',
  oil: '#1a1a1a',
  sand: '#F4A460',
  uranium: '#32CD32',
  chrome: '#C0C0C0',
  titanium: '#708090',
  copper: '#B87333',
};

// Эмодзи депозитов
const DEPOSIT_EMOJI: Partial<Record<DepositType, string>> = {
  ore: '🪨',
  ice: '🧊',
  carbon: '⚫',
  natural_gas: '💨',
  oil: '🛢️',
  sand: '🏜️',
  uranium: '☢️',
  chrome: '🔩',
  titanium: '⚙️',
  copper: '🔶',
};

interface HexTile {
  x: number;
  y: number;
  type: 'empty' | 'deposit' | 'blocked' | 'base' | 'building';
  deposit?: DepositType;
  buildingId?: string;
  isSelected?: boolean;
  isHovered?: boolean;
}

interface HexGridProps {
  width: number;
  height: number;
  tiles: Record<string, string>; // buildingId по ключу
  deposits: Record<string, DepositType>;
  basePosition: { x: number; y: number };
  selectedTile: { x: number; y: number } | null;
  onSelectTile: (x: number, y: number) => void;
  theme?: {
    backgroundColor: string;
    tileColors: {
      empty: string;
      deposit: string;
      building: string;
      base: string;
      blocked?: string;
    };
  };
  blockedTiles?: Set<string>;
  showGrid?: boolean;
}

// Генерация точек гексагона
function hexPoints(cx: number, cy: number, size: number): string {
  const points: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    const px = cx + size * Math.cos(angle);
    const py = cy + size * Math.sin(angle);
    points.push(`${px},${py}`);
  }
  return points.join(' ');
}

// Конвертация координат сетки в пиксели (offset coordinates)
function hexToPixel(col: number, row: number): { x: number; y: number } {
  const x = HEX_WIDTH * (col + 0.5 * (row % 2)) + HEX_WIDTH / 2;
  const y = HEX_VERT_SPACING * row + HEX_HEIGHT / 2;
  return { x, y };
}

// Конвертация пикселей в координаты сетки
function pixelToHex(px: number, py: number): { col: number; row: number } {
  // Приблизительный расчёт
  const row = Math.round(py / HEX_VERT_SPACING);
  const col = Math.round((px - 0.5 * (row % 2) * HEX_WIDTH) / HEX_WIDTH);
  return { col, row };
}

export function HexGrid({
  width,
  height,
  tiles,
  deposits,
  basePosition,
  selectedTile,
  onSelectTile,
  theme,
  blockedTiles,
  showGrid = true,
}: HexGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredTile, setHoveredTile] = useState<{ x: number; y: number } | null>(null);
  const [viewOffset, setViewOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);

  // Вычисляем размеры канваса
  const canvasWidth = HEX_WIDTH * width + HEX_WIDTH / 2 + 20;
  const canvasHeight = HEX_VERT_SPACING * height + HEX_HEIGHT / 4 + 20;

  // Центрируем вид при монтировании
  useEffect(() => {
    if (containerRef.current) {
      const container = containerRef.current;
      const centerX = (canvasWidth * zoom - container.clientWidth) / 2;
      const centerY = (canvasHeight * zoom - container.clientHeight) / 2;
      setViewOffset({ x: -centerX, y: -centerY });
    }
  }, [canvasWidth, canvasHeight, zoom]);

  // Генерация данных клеток
  const hexTiles = useMemo(() => {
    const result: HexTile[] = [];
    
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const key = coordKey(col, row);
        const isBase = col === basePosition.x && row === basePosition.y;
        const buildingId = tiles[key];
        const deposit = deposits[key];
        const isBlocked = blockedTiles?.has(key);

        let type: HexTile['type'] = 'empty';
        if (isBlocked) type = 'blocked';
        else if (isBase) type = 'base';
        else if (buildingId) type = 'building';
        else if (deposit) type = 'deposit';

        result.push({
          x: col,
          y: row,
          type,
          deposit,
          buildingId,
          isSelected: selectedTile?.x === col && selectedTile?.y === row,
          isHovered: hoveredTile?.x === col && hoveredTile?.y === row,
        });
      }
    }

    return result;
  }, [width, height, tiles, deposits, basePosition, selectedTile, hoveredTile, blockedTiles]);

  // Обработчики мыши
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || e.button === 2) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - viewOffset.x, y: e.clientY - viewOffset.y });
    }
  }, [viewOffset]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      setViewOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    } else {
      // Определяем клетку под курсором
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const mx = (e.clientX - rect.left - viewOffset.x) / zoom;
      const my = (e.clientY - rect.top - viewOffset.y) / zoom;
      const { col, row } = pixelToHex(mx, my);

      if (col >= 0 && col < width && row >= 0 && row < height) {
        setHoveredTile({ x: col, y: row });
      } else {
        setHoveredTile(null);
      }
    }
  }, [isDragging, dragStart, viewOffset, zoom, width, height]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleClick = useCallback((e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mx = (e.clientX - rect.left - viewOffset.x) / zoom;
    const my = (e.clientY - rect.top - viewOffset.y) / zoom;
    const { col, row } = pixelToHex(mx, my);

    if (col >= 0 && col < width && row >= 0 && row < height) {
      onSelectTile(col, row);
    }
  }, [viewOffset, zoom, width, height, onSelectTile]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(z => Math.min(2, Math.max(0.3, z * delta)));
  }, []);

  // Получение цвета клетки
  const getTileColor = (tile: HexTile): string => {
    if (tile.type === 'blocked') return theme?.tileColors.blocked ?? '#0a0a0a';
    if (tile.type === 'base') return theme?.tileColors.base ?? '#5a8a5a';
    if (tile.type === 'building') return theme?.tileColors.building ?? '#3a5a4a';
    if (tile.type === 'deposit') {
      return DEPOSIT_COLORS[tile.deposit!] ?? theme?.tileColors.deposit ?? '#4a6a3a';
    }
    return theme?.tileColors.empty ?? '#2a3a2a';
  };

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden bg-cyber-darker cursor-grab"
      style={{ 
        width: '100%', 
        height: '100%',
        backgroundColor: theme?.backgroundColor ?? '#1a1a1a',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={handleClick}
      onWheel={handleWheel}
      onContextMenu={e => e.preventDefault()}
    >
      <svg
        width={canvasWidth * zoom}
        height={canvasHeight * zoom}
        style={{
          transform: `translate(${viewOffset.x}px, ${viewOffset.y}px)`,
        }}
      >
        <g transform={`scale(${zoom})`}>
          {/* Рендер клеток */}
          {hexTiles.map(tile => {
            const { x: px, y: py } = hexToPixel(tile.x, tile.y);
            const color = getTileColor(tile);
            const strokeColor = tile.isSelected
              ? '#00ffff'
              : tile.isHovered
              ? '#ffffff'
              : 'rgba(255,255,255,0.1)';
            const strokeWidth = tile.isSelected ? 3 : tile.isHovered ? 2 : 1;

            return (
              <g key={coordKey(tile.x, tile.y)}>
                {/* Гексагон */}
                <polygon
                  points={hexPoints(px, py, HEX_SIZE - 2)}
                  fill={color}
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                  style={{ transition: 'fill 0.2s, stroke 0.2s' }}
                />

                {/* Контент клетки */}
                {tile.type === 'base' && (
                  <text
                    x={px}
                    y={py}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={HEX_SIZE * 0.8}
                  >
                    🏠
                  </text>
                )}

                {tile.type === 'deposit' && tile.deposit && (
                  <text
                    x={px}
                    y={py}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={HEX_SIZE * 0.6}
                  >
                    {DEPOSIT_EMOJI[tile.deposit] ?? '📦'}
                  </text>
                )}

                {tile.type === 'building' && tile.buildingId && (
                  <text
                    x={px}
                    y={py}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={HEX_SIZE * 0.6}
                  >
                    {BUILDING_EMOJI[tile.buildingId] ?? '🏭'}
                  </text>
                )}

                {/* Координаты (для отладки) */}
                {showGrid && tile.type !== 'blocked' && (
                  <text
                    x={px}
                    y={py + HEX_SIZE * 0.6}
                    textAnchor="middle"
                    fontSize={8}
                    fill="rgba(255,255,255,0.3)"
                  >
                    {tile.x},{tile.y}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Мини-карта */}
      <div className="absolute bottom-2 right-2 w-32 h-24 bg-cyber-darker/80 border border-cyber-gray/30 rounded overflow-hidden">
        <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}>
          {hexTiles.map(tile => (
            <rect
              key={coordKey(tile.x, tile.y)}
              x={tile.x}
              y={tile.y}
              width={0.9}
              height={0.9}
              fill={
                tile.type === 'blocked' ? '#000' :
                tile.type === 'base' ? '#5a8' :
                tile.type === 'building' ? '#48a' :
                tile.type === 'deposit' ? '#a84' :
                '#333'
              }
            />
          ))}
          {/* Viewport indicator */}
          <rect
            x={((-viewOffset.x / zoom) / HEX_WIDTH)}
            y={((-viewOffset.y / zoom) / HEX_VERT_SPACING)}
            width={(containerRef.current?.clientWidth ?? 200) / zoom / HEX_WIDTH}
            height={(containerRef.current?.clientHeight ?? 150) / zoom / HEX_VERT_SPACING}
            fill="none"
            stroke="#0ff"
            strokeWidth={0.2}
          />
        </svg>
      </div>

      {/* Контролы зума */}
      <div className="absolute bottom-2 left-2 flex flex-col gap-1">
        <button
          onClick={() => setZoom(z => Math.min(2, z * 1.2))}
          className="w-8 h-8 bg-cyber-gray/50 rounded text-cyber-text hover:bg-cyber-gray/70 transition-colors"
        >
          +
        </button>
        <button
          onClick={() => setZoom(z => Math.max(0.3, z / 1.2))}
          className="w-8 h-8 bg-cyber-gray/50 rounded text-cyber-text hover:bg-cyber-gray/70 transition-colors"
        >
          −
        </button>
        <button
          onClick={() => setZoom(1)}
          className="w-8 h-8 bg-cyber-gray/50 rounded text-cyber-text text-xs hover:bg-cyber-gray/70 transition-colors"
        >
          1:1
        </button>
      </div>

      {/* Информация о hover */}
      {hoveredTile && (
        <div className="absolute top-2 left-2 px-2 py-1 bg-cyber-darker/90 rounded text-sm text-cyber-text">
          Клетка: {hoveredTile.x}, {hoveredTile.y}
          {deposits[coordKey(hoveredTile.x, hoveredTile.y)] && (
            <span className="ml-2 text-cyber-yellow">
              {DEPOSIT_EMOJI[deposits[coordKey(hoveredTile.x, hoveredTile.y)]]}
              {deposits[coordKey(hoveredTile.x, hoveredTile.y)]}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default HexGrid;
