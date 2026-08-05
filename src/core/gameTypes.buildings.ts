/**
 * Типы для продвинутых настроек зданий (Фаза 5)
 */

import type { ResourceType } from './gameTypes';

// ═══════════════════════════════════════════════════════════════
// РЕЖИМЫ РАБОТЫ ЗДАНИЙ
// ═══════════════════════════════════════════════════════════════

/**
 * Режим работы здания
 * - normal: 100% производство, 100% потребление
 * - overclock: 150% производство, 200% потребление, износ
 * - economy: 70% производство, 50% потребление
 * - idle: 0% производство, 10% потребление (поддержание)
 * - maintenance: 0% производство, 0% потребление, -1% HP/мин
 */
export type BuildingMode = 
  | 'normal'
  | 'overclock'
  | 'economy'
  | 'idle'
  | 'maintenance';

/**
 * Конфигурация режима работы
 */
export interface BuildingModeConfig {
  id: BuildingMode;
  name: string;
  emoji: string;
  description: string;
  productionMultiplier: number;     // 1.0 = 100%
  consumptionMultiplier: number;    // 1.0 = 100%
  energyMultiplier: number;         // 1.0 = 100%
  healthChangePerHour: number;      // Изменение HP в % за час
  color: string;                    // Цвет индикатора
}

/**
 * Предопределённые режимы работы
 */
export const BUILDING_MODES: Record<BuildingMode, BuildingModeConfig> = {
  normal: {
    id: 'normal',
    name: 'Обычный',
    emoji: '⚙️',
    description: '100% производство, 100% потребление',
    productionMultiplier: 1.0,
    consumptionMultiplier: 1.0,
    energyMultiplier: 1.0,
    healthChangePerHour: 0,
    color: '#8be9fd', // blue
  },
  overclock: {
    id: 'overclock',
    name: 'Разгон',
    emoji: '⚡',
    description: '150% производство, 200% потребление, износ -10%/ч',
    productionMultiplier: 1.5,
    consumptionMultiplier: 2.0,
    energyMultiplier: 1.3,
    healthChangePerHour: -10,
    color: '#ff5555', // red
  },
  economy: {
    id: 'economy',
    name: 'Экономия',
    emoji: '💰',
    description: '70% производство, 50% потребление, восстановление +5%/ч',
    productionMultiplier: 0.7,
    consumptionMultiplier: 0.5,
    energyMultiplier: 0.6,
    healthChangePerHour: 5,
    color: '#3ee07f', // green
  },
  idle: {
    id: 'idle',
    name: 'Ожидание',
    emoji: '💤',
    description: '0% производство, 10% потребление (поддержание)',
    productionMultiplier: 0,
    consumptionMultiplier: 0.1,
    energyMultiplier: 0.1,
    healthChangePerHour: 0,
    color: '#7f849f', // gray
  },
  maintenance: {
    id: 'maintenance',
    name: 'Обслуживание',
    emoji: '🔧',
    description: '0% производство, 0% потребление, требует ремонта',
    productionMultiplier: 0,
    consumptionMultiplier: 0,
    energyMultiplier: 0,
    healthChangePerHour: -1,
    color: '#ffb86c', // amber
  },
};

// ═══════════════════════════════════════════════════════════════
// ПРИОРИТЕТЫ
// ═══════════════════════════════════════════════════════════════

/**
 * Приоритет ресурса (1 - низкий, 5 - высокий)
 */
export type ResourcePriority = 1 | 2 | 3 | 4 | 5;

/**
 * Описание приоритетов
 */
export const PRIORITY_LABELS: Record<ResourcePriority, { name: string; color: string }> = {
  1: { name: 'Очень низкий', color: '#7f849f' },
  2: { name: 'Низкий', color: '#8be9fd' },
  3: { name: 'Средний', color: '#3ee07f' },
  4: { name: 'Высокий', color: '#ffb86c' },
  5: { name: 'Критический', color: '#ff5555' },
};

// ═══════════════════════════════════════════════════════════════
// АВТО-ПРОДАЖА
// ═══════════════════════════════════════════════════════════════

/**
 * Настройки авто-продажи для ресурса
 */
export interface AutoSellConfig {
  enabled: boolean;
  resource: ResourceType;
  threshold: number;              // Продавать когда > X% заполнения (0-100)
  keepAmount: string;             // Decimal string - оставлять минимум N единиц
  minPrice?: string;              // Decimal string - продавать только если цена >= X
}

// ═══════════════════════════════════════════════════════════════
// ЛИМИТЫ ХРАНЕНИЯ
// ═══════════════════════════════════════════════════════════════

/**
 * Действие при переполнении
 */
export type OverflowAction = 'stop' | 'sell' | 'discard';

/**
 * Лимит хранения для конкретного ресурса в здании
 */
export interface StorageLimit {
  resource: ResourceType;
  maxAmount: string;              // Decimal string - максимум в этом здании
  overflowAction: OverflowAction;
}

// ═══════════════════════════════════════════════════════════════
// УСЛОВИЯ РАБОТЫ
// ═══════════════════════════════════════════════════════════════

/**
 * Тип условия
 */
export type ConditionType = 
  | 'resource_above'     // Ресурс выше порога
  | 'resource_below'     // Ресурс ниже порога
  | 'time_of_day'        // Время суток (игровое)
  | 'energy_available';  // Доступно энергии

/**
 * Действие при срабатывании условия
 */
export type ConditionAction = 'enable' | 'disable' | 'switch_mode';

/**
 * Условие работы здания
 */
export interface BuildingCondition {
  id: string;
  type: ConditionType;
  resource?: ResourceType;        // Для resource_above/below
  value: number;                  // Порог (% или абсолютное значение)
  action: ConditionAction;
  targetMode?: BuildingMode;      // Для switch_mode
  enabled: boolean;
}

// ═══════════════════════════════════════════════════════════════
// СТАТИСТИКА ЗДАНИЯ
// ═══════════════════════════════════════════════════════════════

/**
 * Статистика работы здания
 */
export interface BuildingStats {
  totalProduced: string;          // Decimal string - всего произведено
  totalConsumed: string;          // Decimal string - всего потреблено
  uptime: number;                 // % времени работы (0-100)
  efficiency: number;             // Текущая эффективность (0-100)
  lastActiveAt: number;           // timestamp последней активности
  createdAt: number;              // timestamp создания
}

// ═══════════════════════════════════════════════════════════════
// НАСТРОЙКИ ЗДАНИЯ
// ═══════════════════════════════════════════════════════════════

/**
 * Полные настройки конкретного здания на тайле
 */
export interface TileBuildingSettings {
  tileKey: string;                // "x,y" координаты
  buildingId: string;             // ID типа здания
  
  // Основные настройки
  mode: BuildingMode;
  enabled: boolean;
  health: number;                 // 0-100, влияет на производительность
  
  // Приоритеты входящих ресурсов
  inputPriorities: Partial<Record<ResourceType, ResourcePriority>>;
  
  // Приоритет выходящих ресурсов
  outputPriority: ResourcePriority;
  
  // Лимиты хранения
  storageLimits: StorageLimit[];
  
  // Авто-продажа
  autoSell: AutoSellConfig[];
  
  // Условия работы
  conditions: BuildingCondition[];
  
  // Статистика
  stats: BuildingStats;
}

/**
 * Настройки здания по умолчанию
 */
export const DEFAULT_BUILDING_SETTINGS: Omit<TileBuildingSettings, 'tileKey' | 'buildingId'> = {
  mode: 'normal',
  enabled: true,
  health: 100,
  inputPriorities: {},
  outputPriority: 3,
  storageLimits: [],
  autoSell: [],
  conditions: [],
  stats: {
    totalProduced: '0',
    totalConsumed: '0',
    uptime: 100,
    efficiency: 100,
    lastActiveAt: 0,
    createdAt: 0,
  },
};

// ═══════════════════════════════════════════════════════════════
// ПРЕСЕТЫ НАСТРОЕК
// ═══════════════════════════════════════════════════════════════

/**
 * ID пресета настроек
 */
export type SettingsPresetId = 
  | 'max_production'
  | 'profit_focused'
  | 'energy_saver'
  | 'balanced'
  | 'maintenance_only';

/**
 * Пресет настроек
 */
export interface SettingsPreset {
  id: SettingsPresetId;
  name: string;
  emoji: string;
  description: string;
  mode: BuildingMode;
  outputPriority: ResourcePriority;
  autoSellThreshold?: number;     // % заполнения для авто-продажи
}

/**
 * Предопределённые пресеты
 */
export const SETTINGS_PRESETS: Record<SettingsPresetId, SettingsPreset> = {
  max_production: {
    id: 'max_production',
    name: 'Максимум производства',
    emoji: '🏭',
    description: 'Overclock, высокий приоритет',
    mode: 'overclock',
    outputPriority: 5,
  },
  profit_focused: {
    id: 'profit_focused',
    name: 'Максимум прибыли',
    emoji: '💰',
    description: 'Авто-продажа при 80%, экономный режим',
    mode: 'economy',
    outputPriority: 3,
    autoSellThreshold: 80,
  },
  energy_saver: {
    id: 'energy_saver',
    name: 'Экономия энергии',
    emoji: '⚡',
    description: 'Экономный режим, низкий приоритет',
    mode: 'economy',
    outputPriority: 2,
  },
  balanced: {
    id: 'balanced',
    name: 'Сбалансированный',
    emoji: '🔄',
    description: 'Обычный режим, средний приоритет',
    mode: 'normal',
    outputPriority: 3,
  },
  maintenance_only: {
    id: 'maintenance_only',
    name: 'Только обслуживание',
    emoji: '🛑',
    description: 'Режим обслуживания, отключено',
    mode: 'maintenance',
    outputPriority: 1,
  },
};

// ═══════════════════════════════════════════════════════════════
// СОСТОЯНИЕ STORE
// ═══════════════════════════════════════════════════════════════

/**
 * Состояние хранилища настроек зданий
 */
export interface BuildingSettingsState {
  // Настройки по тайлам: { "x,y": TileBuildingSettings }
  settings: Record<string, TileBuildingSettings>;
  
  // Глобальные настройки по типам зданий (применяются к новым)
  globalDefaults: Record<string, Partial<TileBuildingSettings>>;
  
  // Пользовательские пресеты
  customPresets: SettingsPreset[];
  
  // Последний использованный пресет
  lastPresetId: SettingsPresetId | null;
}

/**
 * Начальное состояние
 */
export const INITIAL_BUILDING_SETTINGS_STATE: BuildingSettingsState = {
  settings: {},
  globalDefaults: {},
  customPresets: [],
  lastPresetId: null,
};

// ═══════════════════════════════════════════════════════════════
// ХЕЛПЕРЫ
// ═══════════════════════════════════════════════════════════════

/**
 * Получить эффективный множитель производства с учётом режима и здоровья
 */
export function getEffectiveProductionMultiplier(
  mode: BuildingMode,
  health: number
): number {
  const modeConfig = BUILDING_MODES[mode];
  // Здоровье влияет на производительность: 100% HP = 100%, 50% HP = 75%, 0% HP = 50%
  const healthMultiplier = 0.5 + (health / 100) * 0.5;
  return modeConfig.productionMultiplier * healthMultiplier;
}

/**
 * Получить эффективный множитель потребления с учётом режима
 */
export function getEffectiveConsumptionMultiplier(mode: BuildingMode): number {
  return BUILDING_MODES[mode].consumptionMultiplier;
}

/**
 * Получить эффективный множитель энергии с учётом режима
 */
export function getEffectiveEnergyMultiplier(mode: BuildingMode): number {
  return BUILDING_MODES[mode].energyMultiplier;
}

/**
 * Рассчитать изменение здоровья за время dt (в секундах)
 */
export function calculateHealthChange(mode: BuildingMode, dt: number): number {
  const config = BUILDING_MODES[mode];
  // healthChangePerHour → per second
  return (config.healthChangePerHour / 3600) * dt;
}

/**
 * Создать настройки здания по умолчанию для тайла
 */
export function createDefaultTileSettings(
  tileKey: string,
  buildingId: string
): TileBuildingSettings {
  return {
    ...DEFAULT_BUILDING_SETTINGS,
    tileKey,
    buildingId,
    stats: {
      ...DEFAULT_BUILDING_SETTINGS.stats,
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    },
  };
}

/**
 * Применить пресет к настройкам
 * @param settings - текущие настройки
 * @param presetId - ID пресета
 * @param producedResources - список ресурсов, которые производит здание (для авто-продажи)
 */
export function applyPreset(
  settings: TileBuildingSettings,
  presetId: SettingsPresetId,
  producedResources?: ResourceType[]
): TileBuildingSettings {
  const preset = SETTINGS_PRESETS[presetId];
  if (!preset) return settings;
  
  const newSettings = { ...settings };
  newSettings.mode = preset.mode;
  newSettings.outputPriority = preset.outputPriority;
  
  // Если пресет предполагает авто-продажу и есть ресурсы для продажи
  if (preset.autoSellThreshold !== undefined && producedResources && producedResources.length > 0) {
    // Создаём autoSell конфиги для всех производимых ресурсов
    const newAutoSell: AutoSellConfig[] = producedResources.map(resource => ({
      enabled: true,
      resource,
      threshold: preset.autoSellThreshold!,
      keepAmount: '0',
    }));
    newSettings.autoSell = newAutoSell;
  }
  
  return newSettings;
}
