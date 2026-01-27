/**
 * Conflict Resolver - Фаза 8
 * Логика разрешения конфликтов между локальными и облачными сохранениями
 */

import Decimal from 'decimal.js';
import type { 
  SaveConflict, 
  SaveConflictResolveOption, 
  SaveInfo,
  ConflictResolution 
} from '../core/gameTypes.sync';

// Типы данных сохранения (упрощённые для сравнения)
interface SaveData {
  currencies?: {
    credits?: string;
    researchPoints?: string;
    culture?: string;
    science?: string;
  };
  resources?: Record<string, { amount?: string }>;
  buildings?: Array<{ id: string; x: number; y: number }>;
  technologies?: string[];
  achievements?: string[];
  playTime?: number;
  currentEra?: number;
  lastSaveTime?: number;
}

// Результат сравнения сохранений
export interface SaveComparison {
  localData: SaveData;
  cloudData: SaveData;
  
  // Какое сохранение "лучше" по разным критериям
  newerSave: 'local' | 'cloud' | 'same';
  moreProgress: 'local' | 'cloud' | 'same';
  moreBuildings: 'local' | 'cloud' | 'same';
  moreCredits: 'local' | 'cloud' | 'same';
  longerPlayTime: 'local' | 'cloud' | 'same';
  
  // Детали различий
  differences: SaveDifference[];
  
  // Рекомендация
  recommendation: SaveConflictResolveOption;
  recommendationReason: string;
}

// Различие между сохранениями
export interface SaveDifference {
  category: 'currencies' | 'resources' | 'buildings' | 'technologies' | 'achievements' | 'progress';
  field: string;
  localValue: string | number;
  cloudValue: string | number;
  winner: 'local' | 'cloud' | 'same';
}

/**
 * Сравнить два сохранения и выявить различия
 */
export function compareSaves(
  localSave: SaveInfo,
  cloudSave: SaveInfo,
  localData: string,
  cloudData: string
): SaveComparison {
  const local: SaveData = JSON.parse(localData);
  const cloud: SaveData = JSON.parse(cloudData);
  
  const differences: SaveDifference[] = [];
  
  // Сравниваем timestamp
  const newerSave = localSave.timestamp > cloudSave.timestamp ? 'local' : 
                    cloudSave.timestamp > localSave.timestamp ? 'cloud' : 'same';
  
  // Сравниваем эру
  const localEra = local.currentEra || 1;
  const cloudEra = cloud.currentEra || 1;
  const moreProgress = localEra > cloudEra ? 'local' : 
                       cloudEra > localEra ? 'cloud' : 'same';
  
  if (localEra !== cloudEra) {
    differences.push({
      category: 'progress',
      field: 'currentEra',
      localValue: localEra,
      cloudValue: cloudEra,
      winner: moreProgress,
    });
  }
  
  // Сравниваем здания
  const localBuildings = local.buildings?.length || 0;
  const cloudBuildings = cloud.buildings?.length || 0;
  const moreBuildings = localBuildings > cloudBuildings ? 'local' :
                        cloudBuildings > localBuildings ? 'cloud' : 'same';
  
  if (localBuildings !== cloudBuildings) {
    differences.push({
      category: 'buildings',
      field: 'count',
      localValue: localBuildings,
      cloudValue: cloudBuildings,
      winner: moreBuildings,
    });
  }
  
  // Сравниваем кредиты
  const localCredits = new Decimal(local.currencies?.credits || '0');
  const cloudCredits = new Decimal(cloud.currencies?.credits || '0');
  const moreCredits = localCredits.gt(cloudCredits) ? 'local' :
                      cloudCredits.gt(localCredits) ? 'cloud' : 'same';
  
  if (!localCredits.eq(cloudCredits)) {
    differences.push({
      category: 'currencies',
      field: 'credits',
      localValue: localCredits.toString(),
      cloudValue: cloudCredits.toString(),
      winner: moreCredits,
    });
  }
  
  // Сравниваем время игры
  const localPlayTime = local.playTime || 0;
  const cloudPlayTime = cloud.playTime || 0;
  const longerPlayTime = localPlayTime > cloudPlayTime ? 'local' :
                         cloudPlayTime > localPlayTime ? 'cloud' : 'same';
  
  if (localPlayTime !== cloudPlayTime) {
    differences.push({
      category: 'progress',
      field: 'playTime',
      localValue: localPlayTime,
      cloudValue: cloudPlayTime,
      winner: longerPlayTime,
    });
  }
  
  // Сравниваем технологии
  const localTech = new Set(local.technologies || []);
  const cloudTech = new Set(cloud.technologies || []);
  
  // Технологии только в локальном
  for (const tech of localTech) {
    if (!cloudTech.has(tech)) {
      differences.push({
        category: 'technologies',
        field: tech,
        localValue: 'unlocked',
        cloudValue: 'locked',
        winner: 'local',
      });
    }
  }
  
  // Технологии только в облачном
  for (const tech of cloudTech) {
    if (!localTech.has(tech)) {
      differences.push({
        category: 'technologies',
        field: tech,
        localValue: 'locked',
        cloudValue: 'unlocked',
        winner: 'cloud',
      });
    }
  }
  
  // Сравниваем достижения
  const localAch = new Set(local.achievements || []);
  const cloudAch = new Set(cloud.achievements || []);
  
  for (const ach of localAch) {
    if (!cloudAch.has(ach)) {
      differences.push({
        category: 'achievements',
        field: ach,
        localValue: 'unlocked',
        cloudValue: 'locked',
        winner: 'local',
      });
    }
  }
  
  for (const ach of cloudAch) {
    if (!localAch.has(ach)) {
      differences.push({
        category: 'achievements',
        field: ach,
        localValue: 'locked',
        cloudValue: 'unlocked',
        winner: 'cloud',
      });
    }
  }
  
  // Определяем рекомендацию
  const { recommendation, recommendationReason } = determineRecommendation(
    newerSave,
    moreProgress,
    moreBuildings,
    moreCredits,
    longerPlayTime,
    differences
  );
  
  return {
    localData: local,
    cloudData: cloud,
    newerSave,
    moreProgress,
    moreBuildings,
    moreCredits,
    longerPlayTime,
    differences,
    recommendation,
    recommendationReason,
  };
}

/**
 * Определить рекомендацию на основе сравнения
 */
function determineRecommendation(
  newerSave: 'local' | 'cloud' | 'same',
  moreProgress: 'local' | 'cloud' | 'same',
  moreBuildings: 'local' | 'cloud' | 'same',
  moreCredits: 'local' | 'cloud' | 'same',
  longerPlayTime: 'local' | 'cloud' | 'same',
  differences: SaveDifference[]
): { recommendation: SaveConflictResolveOption; recommendationReason: string } {
  // Подсчёт "голосов" за каждый вариант
  let localScore = 0;
  let cloudScore = 0;
  
  // Более новое сохранение - 2 балла
  if (newerSave === 'local') localScore += 2;
  if (newerSave === 'cloud') cloudScore += 2;
  
  // Больше прогресса (эра) - 3 балла
  if (moreProgress === 'local') localScore += 3;
  if (moreProgress === 'cloud') cloudScore += 3;
  
  // Больше зданий - 2 балла
  if (moreBuildings === 'local') localScore += 2;
  if (moreBuildings === 'cloud') cloudScore += 2;
  
  // Больше кредитов - 1 балл
  if (moreCredits === 'local') localScore += 1;
  if (moreCredits === 'cloud') cloudScore += 1;
  
  // Больше времени игры - 1 балл
  if (longerPlayTime === 'local') localScore += 1;
  if (longerPlayTime === 'cloud') cloudScore += 1;
  
  // Учитываем технологии и достижения
  const localUniqueTech = differences.filter(d => d.category === 'technologies' && d.winner === 'local').length;
  const cloudUniqueTech = differences.filter(d => d.category === 'technologies' && d.winner === 'cloud').length;
  
  localScore += localUniqueTech;
  cloudScore += cloudUniqueTech;
  
  // Если есть уникальные вещи с обеих сторон - рекомендуем merge
  if (localUniqueTech > 0 && cloudUniqueTech > 0) {
    return {
      recommendation: 'merge',
      recommendationReason: 'Оба сохранения содержат уникальные технологии или достижения. Слияние позволит сохранить всё.',
    };
  }
  
  // Если разница минимальная - рекомендуем более новое
  if (Math.abs(localScore - cloudScore) <= 1) {
    if (newerSave === 'local') {
      return {
        recommendation: 'use_local',
        recommendationReason: 'Сохранения очень похожи, рекомендуется использовать более новое (локальное).',
      };
    } else if (newerSave === 'cloud') {
      return {
        recommendation: 'use_cloud',
        recommendationReason: 'Сохранения очень похожи, рекомендуется использовать более новое (облачное).',
      };
    }
  }
  
  // Иначе рекомендуем то, у которого больше баллов
  if (localScore > cloudScore) {
    return {
      recommendation: 'use_local',
      recommendationReason: 'Локальное сохранение содержит больше прогресса.',
    };
  } else if (cloudScore > localScore) {
    return {
      recommendation: 'use_cloud',
      recommendationReason: 'Облачное сохранение содержит больше прогресса.',
    };
  }
  
  // Если полностью равны
  return {
    recommendation: 'use_local',
    recommendationReason: 'Сохранения идентичны. Используется локальная версия.',
  };
}

/**
 * Объединить два сохранения (merge)
 * Берём максимумы ресурсов, все здания, все технологии, все достижения
 */
export function mergeSaves(localData: string, cloudData: string): string {
  const local: SaveData = JSON.parse(localData);
  const cloud: SaveData = JSON.parse(cloudData);
  
  // Объединяем валюты (берём максимум)
  const mergedCurrencies = {
    credits: Decimal.max(
      new Decimal(local.currencies?.credits || '0'),
      new Decimal(cloud.currencies?.credits || '0')
    ).toString(),
    researchPoints: Decimal.max(
      new Decimal(local.currencies?.researchPoints || '0'),
      new Decimal(cloud.currencies?.researchPoints || '0')
    ).toString(),
    culture: Decimal.max(
      new Decimal(local.currencies?.culture || '0'),
      new Decimal(cloud.currencies?.culture || '0')
    ).toString(),
    science: Decimal.max(
      new Decimal(local.currencies?.science || '0'),
      new Decimal(cloud.currencies?.science || '0')
    ).toString(),
  };
  
  // Объединяем ресурсы (берём максимум каждого)
  const mergedResources: Record<string, { amount: string }> = {};
  const allResourceKeys = new Set([
    ...Object.keys(local.resources || {}),
    ...Object.keys(cloud.resources || {}),
  ]);
  
  for (const key of allResourceKeys) {
    const localAmount = new Decimal(local.resources?.[key]?.amount || '0');
    const cloudAmount = new Decimal(cloud.resources?.[key]?.amount || '0');
    mergedResources[key] = {
      ...local.resources?.[key],
      ...cloud.resources?.[key],
      amount: Decimal.max(localAmount, cloudAmount).toString(),
    };
  }
  
  // Объединяем здания
  // Используем координаты как ключ, берём здание из более нового сохранения при конфликте
  const localBuildingMap = new Map<string, typeof local.buildings extends Array<infer T> ? T : never>();
  const cloudBuildingMap = new Map<string, typeof cloud.buildings extends Array<infer T> ? T : never>();
  
  for (const building of (local.buildings || [])) {
    const key = `${building.x},${building.y}`;
    localBuildingMap.set(key, building);
  }
  
  for (const building of (cloud.buildings || [])) {
    const key = `${building.x},${building.y}`;
    cloudBuildingMap.set(key, building);
  }
  
  // При конфликте берём из локального (т.к. он обычно новее)
  const mergedBuildingsMap = new Map([...cloudBuildingMap, ...localBuildingMap]);
  const mergedBuildings = Array.from(mergedBuildingsMap.values());
  
  // Объединяем технологии (все уникальные)
  const mergedTechnologies = Array.from(new Set([
    ...(local.technologies || []),
    ...(cloud.technologies || []),
  ]));
  
  // Объединяем достижения (все уникальные)
  const mergedAchievements = Array.from(new Set([
    ...(local.achievements || []),
    ...(cloud.achievements || []),
  ]));
  
  // Берём максимум эры и времени игры
  const mergedEra = Math.max(local.currentEra || 1, cloud.currentEra || 1);
  const mergedPlayTime = Math.max(local.playTime || 0, cloud.playTime || 0);
  
  // Собираем результат, сохраняя остальные поля из более нового
  const baseData = (local.lastSaveTime || 0) >= (cloud.lastSaveTime || 0) ? local : cloud;
  
  const merged = {
    ...baseData,
    currencies: mergedCurrencies,
    resources: mergedResources,
    buildings: mergedBuildings,
    technologies: mergedTechnologies,
    achievements: mergedAchievements,
    currentEra: mergedEra,
    playTime: mergedPlayTime,
    lastSaveTime: Date.now(),
    mergedFrom: {
      localTimestamp: local.lastSaveTime,
      cloudTimestamp: cloud.lastSaveTime,
      mergedAt: Date.now(),
    },
  };
  
  return JSON.stringify(merged);
}

/**
 * Создать запись о разрешении конфликта
 */
export function createConflictResolution(
  conflict: SaveConflict,
  option: SaveConflictResolveOption,
  byUser: boolean = true
): ConflictResolution {
  return {
    conflictId: conflict.id,
    option,
    timestamp: Date.now(),
    appliedBy: byUser ? 'user' : 'auto',
  };
}

/**
 * Авто-разрешить конфликт на основе предпочтений
 */
export function autoResolveConflict(
  conflict: SaveConflict,
  preference: 'local' | 'cloud' | 'newer'
): SaveConflictResolveOption {
  switch (preference) {
    case 'local':
      return 'use_local';
    case 'cloud':
      return 'use_cloud';
    case 'newer':
      return conflict.localSave.timestamp >= conflict.cloudSave.timestamp
        ? 'use_local'
        : 'use_cloud';
    default:
      return 'use_local';
  }
}

/**
 * Форматировать время для отображения
 */
export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Форматировать время игры
 */
export function formatPlayTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}ч ${minutes}м`;
  }
  return `${minutes}м`;
}
