/**
 * Визуализация производственных районов (districts)
 */

import * as PIXI from 'pixi.js';
import type { District } from '../../core/math/districts';
import { THEME_COLORS } from '../../core/constants/themeColors';

// Цвета для разных типов районов
const DISTRICT_COLORS = {
  electronics: 0x00b8ff,    // Синий
  military: 0xff0055,       // Красный
  space: 0x9d00ff,          // Фиолетовый
  research: 0x00ff9d,       // Зеленый
  energy: 0xffaa00,         // Оранжевый
  production: 0x888888,     // Серый
  mining: 0xa0522d,         // Коричневый
};

/**
 * Визуализировать границы районов на карте
 */
export function visualizeDistricts(
  container: PIXI.Container,
  districts: District[],
  cellSize: number,
  gap: number,
  alpha: number = 0.15
) {
  const graphics = new PIXI.Graphics();
  const textContainer = new PIXI.Container();
  
  for (const district of districts) {
    const color = DISTRICT_COLORS[district.type] || THEME_COLORS.cyberGray;
    const centerX = district.centerX * (cellSize + gap) + cellSize / 2;
    const centerY = district.centerY * (cellSize + gap) + cellSize / 2;
    const radiusPixels = district.radius * (cellSize + gap);
    
    // Рисуем круг района
    graphics.lineStyle(2, color, alpha * 2);
    graphics.beginFill(color, alpha);
    graphics.drawCircle(centerX, centerY, radiusPixels);
    graphics.endFill();
    
    // Рисуем пунктирную границу
    graphics.lineStyle(0);
    const segments = 32;
    for (let i = 0; i < segments; i++) {
      if (i % 2 === 0) {
        const angle1 = (i / segments) * Math.PI * 2;
        const angle2 = ((i + 1) / segments) * Math.PI * 2;
        const x1 = centerX + Math.cos(angle1) * radiusPixels;
        const y1 = centerY + Math.sin(angle1) * radiusPixels;
        const x2 = centerX + Math.cos(angle2) * radiusPixels;
        const y2 = centerY + Math.sin(angle2) * radiusPixels;
        
        graphics.lineStyle(2, color, alpha * 3);
        graphics.moveTo(x1, y1);
        graphics.lineTo(x2, y2);
      }
    }
    
    // Добавляем метку района
    const label = new PIXI.Text(
      district.description,
      new PIXI.TextStyle({
        fill: color,
        fontSize: 12,
        fontWeight: 'bold',
        fontFamily: 'Arial, sans-serif',
      })
    );
    
    label.x = centerX;
    label.y = centerY - radiusPixels - 15;
    label.anchor.set(0.5, 1);
    label.alpha = alpha * 4;
    
    textContainer.addChild(label);
  }
  
  container.addChild(graphics);
  container.addChild(textContainer);
}

/**
 * Подсветить здания, принадлежащие к району
 */
export function highlightDistrictBuildings(
  graphics: PIXI.Graphics,
  district: District,
  cellSize: number,
  gap: number
) {
  const color = DISTRICT_COLORS[district.type] || THEME_COLORS.cyberGray;
  
  for (const building of district.buildings) {
    if (!building.coord) continue;
    
    const x = building.coord.x * (cellSize + gap);
    const y = building.coord.y * (cellSize + gap);
    
    // Подсветка здания
    graphics.lineStyle(2, color, 0.6);
    graphics.beginFill(color, 0.1);
    graphics.drawRect(x, y, cellSize, cellSize);
    graphics.endFill();
  }
}

/**
 * Создать tooltip с информацией о районе
 */
export function createDistrictTooltip(
  district: District,
  cellSize: number,
  gap: number
): PIXI.Container {
  const tooltip = new PIXI.Container();
  const color = DISTRICT_COLORS[district.type] || THEME_COLORS.cyberGray;
  
  // Фон tooltip
  const bg = new PIXI.Graphics();
  bg.beginFill(0x000000, 0.9);
  bg.lineStyle(2, color, 0.8);
  bg.drawRoundedRect(0, 0, 250, 120, 8);
  bg.endFill();
  
  // Заголовок
  const title = new PIXI.Text(
    district.description,
    new PIXI.TextStyle({
      fill: color,
      fontSize: 14,
      fontWeight: 'bold',
      fontFamily: 'Arial, sans-serif',
    })
  );
  title.x = 10;
  title.y = 10;
  
  // Информация
  const info = new PIXI.Text(
    `Зданий: ${district.buildings.length}\n` +
    `Радиус: ${district.radius.toFixed(1)} клеток\n` +
    `Бонус: +${((district.bonus - 1) * 100).toFixed(0)}%`,
    new PIXI.TextStyle({
      fill: 0xffffff,
      fontSize: 11,
      fontFamily: 'Arial, sans-serif',
      lineHeight: 18,
    })
  );
  info.x = 10;
  info.y = 35;
  
  // Список зданий (первые 3)
  const buildingNames = district.buildings
    .slice(0, 3)
    .map(b => `• ${b.name}`)
    .join('\n');
  
  const buildings = new PIXI.Text(
    buildingNames + (district.buildings.length > 3 ? `\n• ...и еще ${district.buildings.length - 3}` : ''),
    new PIXI.TextStyle({
      fill: 0xcccccc,
      fontSize: 9,
      fontFamily: 'Arial, sans-serif',
      lineHeight: 14,
    })
  );
  buildings.x = 10;
  buildings.y = 75;
  
  tooltip.addChild(bg);
  tooltip.addChild(title);
  tooltip.addChild(info);
  tooltip.addChild(buildings);
  
  // Позиционируем tooltip
  const centerX = district.centerX * (cellSize + gap) + cellSize / 2;
  const centerY = district.centerY * (cellSize + gap) + cellSize / 2;
  tooltip.x = centerX + 20;
  tooltip.y = centerY - 60;
  
  return tooltip;
}

/**
 * Визуализация сетки районов (heatmap)
 */
export function visualizeDistrictHeatmap(
  graphics: PIXI.Graphics,
  districts: District[],
  gridWidth: number,
  gridHeight: number,
  cellSize: number,
  gap: number
) {
  // Создаем карту бонусов для каждой клетки
  const bonusMap: number[][] = Array(gridHeight).fill(0).map(() => Array(gridWidth).fill(1));
  
  for (let y = 0; y < gridHeight; y++) {
    for (let x = 0; x < gridWidth; x++) {
      let maxBonus = 1;
      
      // Проверяем, попадает ли клетка в какой-либо район
      for (const district of districts) {
        const dx = x - district.centerX;
        const dy = y - district.centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance <= district.radius) {
          maxBonus = Math.max(maxBonus, district.bonus);
        }
      }
      
      bonusMap[y][x] = maxBonus;
      
      // Рисуем клетку с цветом в зависимости от бонуса
      if (maxBonus > 1.01) {
        const intensity = Math.min((maxBonus - 1) * 2, 1); // 0..1
        const color = maxBonus >= 1.3 ? 0x00ff00 : maxBonus >= 1.15 ? 0xffaa00 : 0x00ffff;
        
        graphics.beginFill(color, intensity * 0.15);
        graphics.drawRect(
          x * (cellSize + gap),
          y * (cellSize + gap),
          cellSize,
          cellSize
        );
        graphics.endFill();
      }
    }
  }
}
