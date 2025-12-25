/**
 * Визуализатор энергосети
 * Отображает зоны покрытия энергосети на игровой сетке
 */

import type { Building } from '../../core/gameTypes';
import { getPowerSources, isInRadius, getPoweredCells } from '../../utils/powerGridHelpers';

export interface PowerGridVisualizationOptions {
  showPowerGrid: boolean;
  highlightUnpowered: boolean;
  gridWidth: number;
  gridHeight: number;
}

/**
 * Рендерит визуализацию энергосети на canvas
 */
export function renderPowerGridVisualization(
  ctx: CanvasRenderingContext2D,
  buildings: Building[],
  tileSize: number,
  options: PowerGridVisualizationOptions
): void {
  if (!options.showPowerGrid) return;

  const { gridWidth, gridHeight } = options;
  const powerSources = getPowerSources(buildings);

  // Сначала рисуем зоны покрытия
  for (const { building, radius } of powerSources) {
    if (!building.coord) continue;

    const { x: cx, y: cy } = building.coord;

    // Рисуем все покрытые клетки
    for (let x = Math.max(0, cx - radius); x <= Math.min(gridWidth - 1, cx + radius); x++) {
      for (let y = Math.max(0, cy - radius); y <= Math.min(gridHeight - 1, cy + radius); y++) {
        if (isInRadius(cx, cy, x, y, radius)) {
          // Полупрозрачная зеленая подсветка для покрытых клеток
          ctx.fillStyle = 'rgba(34, 197, 94, 0.1)';
          ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
        }
      }
    }

    // Рисуем круг радиуса вокруг источника энергии
    ctx.strokeStyle = 'rgba(34, 197, 94, 0.3)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    
    const centerX = (cx + 0.5) * tileSize;
    const centerY = (cy + 0.5) * tileSize;
    
    // Рисуем ромб (манхэттенское расстояние)
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - radius * tileSize);
    ctx.lineTo(centerX + radius * tileSize, centerY);
    ctx.lineTo(centerX, centerY + radius * tileSize);
    ctx.lineTo(centerX - radius * tileSize, centerY);
    ctx.closePath();
    ctx.stroke();
    
    ctx.setLineDash([]);
  }
}

/**
 * Отрисовывает индикатор энергопокрытия для конкретной клетки
 */
export function renderCellPowerStatus(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  tileSize: number,
  isPowered: boolean,
  isHovered: boolean = false
): void {
  if (!isPowered) {
    // Красная рамка для непокрытых клеток
    ctx.strokeStyle = isHovered ? 'rgba(239, 68, 68, 0.8)' : 'rgba(239, 68, 68, 0.5)';
    ctx.lineWidth = isHovered ? 3 : 2;
    ctx.strokeRect(
      x * tileSize + 2,
      y * tileSize + 2,
      tileSize - 4,
      tileSize - 4
    );

    // Иконка "нет питания" в углу
    if (isHovered) {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
      ctx.font = `${Math.floor(tileSize * 0.3)}px monospace`;
      ctx.fillText('⚡', x * tileSize + 4, y * tileSize + tileSize * 0.3);
    }
  } else if (isHovered) {
    // Зеленая рамка для покрытых клеток при наведении
    ctx.strokeStyle = 'rgba(34, 197, 94, 0.6)';
    ctx.lineWidth = 2;
    ctx.strokeRect(
      x * tileSize + 2,
      y * tileSize + 2,
      tileSize - 4,
      tileSize - 4
    );
  }
}

/**
 * Рисует радиус покрытия при размещении нового источника энергии
 */
export function renderPowerSourcePlacementPreview(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  tileSize: number,
  gridWidth: number,
  gridHeight: number
): void {
  // Подсвечиваем зону покрытия
  for (let px = Math.max(0, x - radius); px <= Math.min(gridWidth - 1, x + radius); px++) {
    for (let py = Math.max(0, y - radius); py <= Math.min(gridHeight - 1, y + radius); py++) {
      if (isInRadius(x, y, px, py, radius)) {
        ctx.fillStyle = 'rgba(34, 197, 94, 0.15)';
        ctx.fillRect(px * tileSize, py * tileSize, tileSize, tileSize);
      }
    }
  }

  // Рисуем контур зоны покрытия
  ctx.strokeStyle = 'rgba(34, 197, 94, 0.5)';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);
  
  const centerX = (x + 0.5) * tileSize;
  const centerY = (y + 0.5) * tileSize;
  
  ctx.beginPath();
  ctx.moveTo(centerX, centerY - radius * tileSize);
  ctx.lineTo(centerX + radius * tileSize, centerY);
  ctx.lineTo(centerX, centerY + radius * tileSize);
  ctx.lineTo(centerX - radius * tileSize, centerY);
  ctx.closePath();
  ctx.stroke();
  
  ctx.setLineDash([]);

  // Текст с радиусом
  ctx.fillStyle = 'rgba(34, 197, 94, 0.9)';
  ctx.font = `${Math.floor(tileSize * 0.4)}px monospace`;
  ctx.textAlign = 'center';
  ctx.fillText(`⚡ R=${radius}`, centerX, centerY + tileSize * 0.15);
  ctx.textAlign = 'left';
}

/**
 * Получает цвет индикатора энергопокрытия в зависимости от статуса
 */
export function getPowerStatusColor(isPowered: boolean, alpha: number = 1): string {
  if (isPowered) {
    return `rgba(34, 197, 94, ${alpha})`; // Зеленый
  }
  return `rgba(239, 68, 68, ${alpha})`; // Красный
}

/**
 * Проверяет, нужно ли показывать предупреждение об энергопокрытии
 */
export function shouldShowPowerWarning(
  x: number,
  y: number,
  buildings: Building[],
  buildingType: Building
): boolean {
  // Источники энергии не нуждаются в питании
  if (buildingType.powerGridRadius && buildingType.powerGridRadius > 0) {
    return false;
  }

  // Проверяем, есть ли покрытие в этой точке
  const poweredCells = getPoweredCells(buildings, 100, 100); // Максимальный размер сетки
  return !poweredCells.has(`${x},${y}`);
}
