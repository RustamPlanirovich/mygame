/**
 * Визуальные эффекты для системы близости зданий
 * Добавляет к FactoryGrid подсветку оптимальных мест и радиусы влияния
 */

import * as PIXI from 'pixi.js';
import type { Building, ProximityRule } from '../../core/gameTypes';
import { THEME_COLORS } from '../../core/constants/themeColors';
import { evaluatePlacementQuality } from '../../utils/proximityHelpers';

// Цвета для разных качеств размещения
const QUALITY_COLORS = {
  optimal: THEME_COLORS.cyberGreen,
  good: 0x9bf4c0,
  neutral: 0xa6aabd,
  warning: THEME_COLORS.cyberYellow,
  critical: THEME_COLORS.cyberRed,
};

const QUALITY_ALPHA = {
  optimal: 0.5,
  good: 0.4,
  neutral: 0.2,
  warning: 0.4,
  critical: 0.5,
};

/**
 * Нарисовать круг радиуса влияния здания
 */
export function drawProximityRadius(
  graphics: PIXI.Graphics,
  x: number,
  y: number,
  radius: number,
  cellSize: number,
  color: number = THEME_COLORS.cyberBlue,
  alpha: number = 0.2
) {
  graphics.lineStyle(2, color, alpha * 1.5);
  graphics.beginFill(color, alpha * 0.3);
  graphics.drawCircle(x, y, radius * cellSize);
  graphics.endFill();
}

/**
 * Подсветить клетку в зависимости от качества размещения
 */
export function highlightCell(
  graphics: PIXI.Graphics,
  x: number,
  y: number,
  cellSize: number,
  gap: number,
  quality: string
) {
  const color = QUALITY_COLORS[quality as keyof typeof QUALITY_COLORS] || QUALITY_COLORS.neutral;
  const alpha = QUALITY_ALPHA[quality as keyof typeof QUALITY_ALPHA] || QUALITY_ALPHA.neutral;
  
  graphics.beginFill(color, alpha);
  graphics.drawRect(
    x * (cellSize + gap),
    y * (cellSize + gap),
    cellSize,
    cellSize
  );
  graphics.endFill();
}

/**
 * Показать множитель производства над клеткой
 */
export function showMultiplierText(
  container: PIXI.Container,
  x: number,
  y: number,
  cellSize: number,
  gap: number,
  multiplier: number
) {
  if (Math.abs(multiplier - 1) < 0.01) return; // Не показываем если множитель ~1
  
  const text = new PIXI.Text(
    `${multiplier > 1 ? '+' : ''}${((multiplier - 1) * 100).toFixed(0)}%`,
    new PIXI.TextStyle({
      fill: multiplier > 1 ? THEME_COLORS.cyberGreen : THEME_COLORS.cyberRed,
      fontSize: 10,
      fontWeight: '700',
      fontFamily: 'Arial, sans-serif',
    })
  );
  
  text.x = x * (cellSize + gap) + cellSize / 2;
  text.y = y * (cellSize + gap) + cellSize / 2;
  text.anchor.set(0.5, 0.5);
  
  container.addChild(text);
}

/**
 * Визуализация правил близости для выбранного здания
 */
export function visualizeProximityForBuilding(
  container: PIXI.Container,
  building: Building,
  buildings: Building[],
  tiles: Record<string, string>,
  gridWidth: number,
  gridHeight: number,
  cellSize: number,
  gap: number
) {
  if (!building.proximityRules || building.proximityRules.length === 0) {
    return;
  }
  
  const graphics = new PIXI.Graphics();
  const textContainer = new PIXI.Container();
  
  // Показываем подсветку для всех клеток сетки
  for (let y = 0; y < gridHeight; y++) {
    for (let x = 0; x < gridWidth; x++) {
      // Пропускаем занятые клетки
      const key = `${x},${y}`;
      if (tiles[key]) continue;
      
      // Оцениваем качество размещения
      const evaluation = evaluatePlacementQuality(
        x,
        y,
        building.name,
        buildings,
        building.proximityRules
      );
      
      // Подсвечиваем клетку
      highlightCell(graphics, x, y, cellSize, gap, evaluation.quality);
      
      // Показываем множитель
      showMultiplierText(textContainer, x, y, cellSize, gap, evaluation.multiplier);
    }
  }
  
  container.addChild(graphics);
  container.addChild(textContainer);
}

/**
 * Показать радиусы влияния для всех размещенных зданий с правилами близости
 */
export function visualizeAllProximityRadii(
  container: PIXI.Container,
  buildings: Building[],
  tiles: Record<string, string>,
  cellSize: number,
  gap: number
) {
  const graphics = new PIXI.Graphics();
  
  // Создаем map для быстрого поиска зданий
  const buildingMap = new Map(buildings.map(b => [b.id, b]));
  
  // Проходим по всем размещенным зданиям
  for (const [tileKey, buildingId] of Object.entries(tiles)) {
    const building = buildingMap.get(buildingId);
    if (!building || !building.proximityRules || building.proximityRules.length === 0) {
      continue;
    }
    
    // Парсим координаты
    const match = tileKey.match(/^(-?\d+),(-?\d+)$/);
    if (!match) continue;
    
    const x = parseInt(match[1]);
    const y = parseInt(match[2]);
    
    // Находим максимальный радиус
    const maxRadius = Math.max(...building.proximityRules.map(r => r.radius));
    
    // Рисуем круг радиуса
    const centerX = x * (cellSize + gap) + cellSize / 2;
    const centerY = y * (cellSize + gap) + cellSize / 2;
    
    // Разные цвета для разных типов правил
    let color: number = THEME_COLORS.cyberBlue;
    const hasBonuses = building.proximityRules.some(r => r.type === 'bonus');
    const hasPenalties = building.proximityRules.some(r => r.type === 'penalty');
    
    if (hasBonuses && !hasPenalties) {
      color = THEME_COLORS.cyberGreen;
    } else if (hasPenalties && !hasBonuses) {
      color = THEME_COLORS.cyberRed;
    } else if (hasBonuses && hasPenalties) {
      color = THEME_COLORS.cyberYellow;
    }
    
    drawProximityRadius(graphics, centerX, centerY, maxRadius, cellSize, color, 0.15);
  }
  
  container.addChild(graphics);
}

/**
 * Создать tooltip с информацией о бонусах близости для клетки
 */
export function createProximityTooltip(
  x: number,
  y: number,
  buildingName: string,
  buildings: Building[],
  rules: ProximityRule[],
  cellSize: number,
  gap: number
): PIXI.Container {
  const tooltip = new PIXI.Container();
  
  const evaluation = evaluatePlacementQuality(x, y, buildingName, buildings, rules);
  
  // Фон tooltip
  const bg = new PIXI.Graphics();
  bg.beginFill(THEME_COLORS.surface, 0.95);
  bg.drawRoundedRect(0, 0, 200, 100, 5);
  bg.endFill();
  
  // Текст с информацией
  const infoText = new PIXI.Text(
    `Качество: ${evaluation.quality}\n` +
    `Множитель: ${(evaluation.multiplier * 100).toFixed(0)}%\n` +
    evaluation.warnings.join('\n'),
    new PIXI.TextStyle({
      fill: THEME_COLORS.cyberText,
      fontSize: 10,
      fontFamily: 'Arial, sans-serif',
      wordWrap: true,
      wordWrapWidth: 190,
    })
  );
  
  infoText.x = 5;
  infoText.y = 5;
  
  tooltip.addChild(bg);
  tooltip.addChild(infoText);
  
  // Позиционируем tooltip
  tooltip.x = x * (cellSize + gap) + cellSize + 10;
  tooltip.y = y * (cellSize + gap);
  
  return tooltip;
}
