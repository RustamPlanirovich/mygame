/**
 * Хук для проверки и отображения предупреждений о близости при постройке
 */

import { useState, useCallback } from 'react';
import type { Building } from '../core/gameTypes';
import { evaluatePlacementQuality, getBuildingsWithCoordinates } from '../utils/proximityHelpers';
import { isLocationPowered, getNearestPowerSource } from '../utils/powerGridHelpers';
import type { ProximityWarning } from '../components/game/ProximityWarningModal';

export interface PlacementCheck {
  canPlace: boolean;
  warnings: ProximityWarning[];
  quality: string;
  multiplier: number;
}

/**
 * Проверить размещение здания и создать предупреждения
 */
export function checkBuildingPlacement(
  x: number,
  y: number,
  building: Building,
  buildings: Building[],
  tiles: Record<string, string>
): PlacementCheck {
  const warnings: ProximityWarning[] = [];
  
  // Если у здания нет правил близости, размещение всегда OK
  if (!building.proximityRules || building.proximityRules.length === 0) {
    return {
      canPlace: true,
      warnings: [],
      quality: 'neutral',
      multiplier: 1,
    };
  }

  // Получаем здания с координатами
  const buildingsWithCoords = getBuildingsWithCoordinates(buildings, tiles);
  
  // ФАЗА 8.2: Проверка энергопокрытия
  // Источники энергии не нуждаются в покрытии
  const isPowerSource = building.powerGridRadius && building.powerGridRadius > 0;
  if (!isPowerSource) {
    const isPowered = isLocationPowered({ x, y }, buildingsWithCoords);
    
    if (!isPowered) {
      const nearest = getNearestPowerSource({ x, y }, buildingsWithCoords);
      const distance = nearest && nearest.coord 
        ? Math.abs(nearest.coord.x - x) + Math.abs(nearest.coord.y - y)
        : -1;
      
      warnings.push({
        level: 'critical',
        icon: '⚡',
        message: nearest 
          ? `Здание вне зоны энергопокрытия! Ближайший источник энергии на расстоянии ${distance} клеток.`
          : 'Здание вне зоны энергопокрытия! Постройте электростанцию или подстанцию.',
      });
    }
  }
  
  // Оцениваем качество размещения
  const evaluation = evaluatePlacementQuality(
    x,
    y,
    building.name,
    buildingsWithCoords,
    building.proximityRules
  );

  // Обрабатываем правила
  for (const rule of building.proximityRules) {
    if (rule.type === 'required') {
      // Проверяем обязательные требования
      const maxRadius = rule.radius;
      const neighbors = buildingsWithCoords.filter(b => {
        if (!b.coord) return false;
        const dx = Math.abs(b.coord.x - x);
        const dy = Math.abs(b.coord.y - y);
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance <= maxRadius && distance > 0;
      });

      let matches = 0;
      if (rule.targetBuildingType) {
        const types = Array.isArray(rule.targetBuildingType) 
          ? rule.targetBuildingType 
          : [rule.targetBuildingType];
        matches = neighbors.filter(n => types.includes(n.name)).length;
      }

      if (matches === 0) {
        warnings.push({
          level: 'critical',
          icon: '🚫',
          message: rule.description,
        });
      }
    }

    if (rule.type === 'incompatible') {
      // Проверяем несовместимые здания
      const maxRadius = rule.radius;
      const neighbors = buildingsWithCoords.filter(b => {
        if (!b.coord) return false;
        const dx = Math.abs(b.coord.x - x);
        const dy = Math.abs(b.coord.y - y);
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance <= maxRadius && distance > 0;
      });

      let matches = 0;
      if (rule.targetBuildingType) {
        const types = Array.isArray(rule.targetBuildingType) 
          ? rule.targetBuildingType 
          : [rule.targetBuildingType];
        matches = neighbors.filter(n => types.includes(n.name)).length;
      }

      if (matches > 0) {
        warnings.push({
          level: 'critical',
          icon: '⚠️',
          message: rule.description,
        });
      }
    }

    // Добавляем информационные сообщения о бонусах
    if (rule.type === 'bonus' && evaluation.multiplier > 1.05) {
      warnings.push({
        level: 'info',
        icon: '✨',
        message: rule.description.replace('{count}', '1+'),
      });
    }

    // Предупреждения о штрафах
    if (rule.type === 'penalty' && evaluation.multiplier < 0.95) {
      warnings.push({
        level: 'warning',
        icon: '⚠️',
        message: rule.description.replace('{count}', '1+'),
      });
    }
  }

  // Определяем, можно ли строить
  const hasBlockers = warnings.some(w => w.level === 'critical');

  return {
    canPlace: !hasBlockers,
    warnings,
    quality: evaluation.quality,
    multiplier: evaluation.multiplier,
  };
}

/**
 * Хук для управления модальным окном предупреждений
 */
export function useProximityWarnings() {
  const [pendingPlacement, setPendingPlacement] = useState<{
    x: number;
    y: number;
    building: Building;
    check: PlacementCheck;
  } | null>(null);

  const requestPlacement = useCallback((
    x: number,
    y: number,
    building: Building,
    buildings: Building[],
    tiles: Record<string, string>
  ): boolean => {
    const check = checkBuildingPlacement(x, y, building, buildings, tiles);

    // Если есть критические ошибки, сразу блокируем
    if (!check.canPlace) {
      setPendingPlacement({ x, y, building, check });
      return false;
    }

    // Если качество хорошее и нет предупреждений, размещаем сразу
    if (check.warnings.length === 0 || 
        (check.quality === 'optimal' || check.quality === 'good')) {
      return true;
    }

    // В остальных случаях показываем модалку
    setPendingPlacement({ x, y, building, check });
    return false;
  }, []);

  const confirmPlacement = useCallback(() => {
    setPendingPlacement(null);
    return true;
  }, []);

  const cancelPlacement = useCallback(() => {
    setPendingPlacement(null);
  }, []);

  return {
    pendingPlacement,
    requestPlacement,
    confirmPlacement,
    cancelPlacement,
  };
}
