/**
 * Signal Interception Helpers
 * 
 * Логика для системы "Перехват Сигналов" (Active Play Bonuses)
 * Аналог Golden Cookie из Cookie Clicker
 */

import Decimal from 'break_eternity.js';
import type { 
  SignalType, 
  ActiveSignal, 
  SignalReward, 
  SignalInterceptionState,
  ActiveBoost,
  ResourceType 
} from '../core/gameTypes';

// ============================================================================
// Constants
// ============================================================================

export const SIGNAL_CONFIG = {
  BASE_FREQUENCY_MIN: 2 * 60 * 1000,        // 2 минуты минимум
  BASE_FREQUENCY_MAX: 5 * 60 * 1000,        // 5 минут максимум
  SIGNAL_DURATION: 15 * 1000,               // 15 секунд на клик
  PRODUCTION_BOOST_MULTIPLIER: 7,           // x7 производство
  PRODUCTION_BOOST_DURATION: 30 * 1000,     // 30 секунд
  TIME_WARP_MULTIPLIER: 2,                  // x2 скорость
  TIME_WARP_DURATION: 60 * 1000,            // 60 секунд
  GOLDEN_COMET_CHANCE: 0.05,                // 5% шанс золотой кометы
};

// Вероятности типов сигналов
export const SIGNAL_WEIGHTS: Record<SignalType, number> = {
  resource_cache: 30,        // 30% - куча ресурсов
  production_boost: 25,      // 25% - буст производства
  research_burst: 20,        // 20% - мгновенные RP
  energy_surge: 15,          // 15% - бесплатная энергия
  lucky_find: 8,             // 8% - редкий предмет
  time_warp: 2,              // 2% - ускорение времени
  golden_comet: 0,           // Расчитывается отдельно
};

// ============================================================================
// Signal Generation
// ============================================================================

/**
 * Генерирует случайный тип сигнала на основе весов
 */
export function generateRandomSignalType(): SignalType {
  // Сначала проверяем шанс золотой кометы
  if (Math.random() < SIGNAL_CONFIG.GOLDEN_COMET_CHANCE) {
    return 'golden_comet';
  }

  // Иначе выбираем из обычных типов
  const totalWeight = Object.values(SIGNAL_WEIGHTS).reduce((sum, w) => sum + w, 0);
  let random = Math.random() * totalWeight;

  for (const [type, weight] of Object.entries(SIGNAL_WEIGHTS)) {
    random -= weight;
    if (random <= 0) {
      return type as SignalType;
    }
  }

  return 'resource_cache'; // Fallback
}

/**
 * Генерирует награду для сигнала
 */
export function generateSignalReward(
  type: SignalType,
  currentProduction: Partial<Record<ResourceType, Decimal>>
): SignalReward {
  switch (type) {
    case 'resource_cache': {
      // Награда = 5 минут текущего производства
      const resources: Partial<Record<ResourceType, Decimal>> = {};
      const productionMultiplier = 5 * 60; // 5 минут

      for (const [resource, rate] of Object.entries(currentProduction)) {
        if (rate && rate.gt(0)) {
          resources[resource as ResourceType] = rate.mul(productionMultiplier);
        }
      }

      return {
        type: 'resources',
        resources,
      };
    }

    case 'production_boost': {
      return {
        type: 'boost',
        productionMultiplier: SIGNAL_CONFIG.PRODUCTION_BOOST_MULTIPLIER,
        boostDuration: SIGNAL_CONFIG.PRODUCTION_BOOST_DURATION,
      };
    }

    case 'research_burst': {
      // 30 минут исследований
      const researchPoints = new Decimal(30);
      return {
        type: 'instant',
        researchPoints,
      };
    }

    case 'energy_surge': {
      // Буст энергии на 1 минуту
      return {
        type: 'boost',
        productionMultiplier: 1, // Энергия становится бесплатной
        boostDuration: 60 * 1000,
      };
    }

    case 'lucky_find': {
      // Случайные ресурсы + немного credits
      const resources: Partial<Record<ResourceType, Decimal>> = {
        ore: new Decimal(5000),
        ice: new Decimal(3000),
        carbon: new Decimal(2000),
        steel: new Decimal(1000),
      };
      
      return {
        type: 'resources',
        resources,
        credits: new Decimal(10000),
      };
    }

    case 'time_warp': {
      return {
        type: 'boost',
        productionMultiplier: SIGNAL_CONFIG.TIME_WARP_MULTIPLIER,
        boostDuration: SIGNAL_CONFIG.TIME_WARP_DURATION,
      };
    }

    case 'golden_comet': {
      // Мега-награда: всё понемногу
      const resources: Partial<Record<ResourceType, Decimal>> = {};
      const megaMultiplier = 30 * 60; // 30 минут производства

      for (const [resource, rate] of Object.entries(currentProduction)) {
        if (rate && rate.gt(0)) {
          resources[resource as ResourceType] = rate.mul(megaMultiplier);
        }
      }

      return {
        type: 'resources',
        resources,
        credits: new Decimal(100000),
        researchPoints: new Decimal(100),
        darkMatter: new Decimal(10),
      };
    }

    default:
      return { type: 'resources', resources: {} };
  }
}

/**
 * Создаёт новый сигнал
 */
export function spawnSignal(
  currentProduction: Partial<Record<ResourceType, Decimal>>
): ActiveSignal {
  const type = generateRandomSignalType();
  const now = Date.now();
  const duration = SIGNAL_CONFIG.SIGNAL_DURATION;

  // Случайная позиция на карте (избегаем краёв)
  const position = {
    x: 0.2 + Math.random() * 0.6,  // 20%-80% ширины
    y: 0.2 + Math.random() * 0.6,  // 20%-80% высоты
  };

  return {
    id: `signal_${now}_${Math.random()}`,
    type,
    position,
    spawnedAt: now,
    expiresAt: now + duration,
    duration,
    reward: generateSignalReward(type, currentProduction),
    claimed: false,
  };
}

/**
 * Рассчитывает время до следующего сигнала
 */
export function calculateNextSignalTime(
  frequencyMultiplier: number = 1
): number {
  const { BASE_FREQUENCY_MIN, BASE_FREQUENCY_MAX } = SIGNAL_CONFIG;
  
  // Случайное время между мин и макс
  const baseInterval = 
    BASE_FREQUENCY_MIN + 
    Math.random() * (BASE_FREQUENCY_MAX - BASE_FREQUENCY_MIN);
  
  // Применяем множитель частоты
  const interval = baseInterval / frequencyMultiplier;
  
  return Date.now() + interval;
}

/**
 * Проверяет, нужно ли создать новый сигнал
 */
export function shouldSpawnSignal(state: SignalInterceptionState): boolean {
  if (!state.signalsEnabled) return false;
  if (state.activeSignal !== null) return false; // Уже есть активный сигнал
  
  const now = Date.now();
  return now >= state.nextSignalAt;
}

/**
 * Проверяет, истёк ли сигнал
 */
export function isSignalExpired(signal: ActiveSignal): boolean {
  return Date.now() >= signal.expiresAt;
}

/**
 * Удаляет истёкшие бусты
 */
export function removeExpiredBoosts(boosts: ActiveBoost[]): ActiveBoost[] {
  const now = Date.now();
  return boosts.filter(boost => now < boost.expiresAt);
}

/**
 * Создаёт буст из награды сигнала
 */
export function createBoostFromReward(
  signal: ActiveSignal
): ActiveBoost | null {
  const { reward } = signal;
  
  if (reward.type !== 'boost') return null;
  if (!reward.productionMultiplier || !reward.boostDuration) return null;

  const now = Date.now();
  
  return {
    id: `boost_${signal.id}`,
    type: getBoostTypeName(signal.type),
    startedAt: now,
    expiresAt: now + reward.boostDuration,
    multiplier: reward.productionMultiplier,
    affectedResources: undefined, // Все ресурсы
  };
}

/**
 * Получает название типа буста для отображения
 */
export function getBoostTypeName(signalType: SignalType): string {
  const names: Record<SignalType, string> = {
    resource_cache: 'Тайник с ресурсами',
    production_boost: 'Буст производства',
    research_burst: 'Всплеск исследований',
    energy_surge: 'Энергетический скачок',
    lucky_find: 'Удачная находка',
    time_warp: 'Искажение времени',
    golden_comet: 'Золотая комета',
  };
  
  return names[signalType] || 'Неизвестный буст';
}

/**
 * Форматирует оставшееся время буста
 */
export function formatBoostTimeRemaining(boost: ActiveBoost): string {
  const now = Date.now();
  const remaining = Math.max(0, boost.expiresAt - now);
  
  const seconds = Math.ceil(remaining / 1000);
  
  if (seconds >= 60) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}м ${secs}с`;
  }
  
  return `${seconds}с`;
}

/**
 * Получает иконку для типа сигнала
 */
export function getSignalIcon(type: SignalType): string {
  const icons: Record<SignalType, string> = {
    resource_cache: '📦',
    production_boost: '⚡',
    research_burst: '🔬',
    energy_surge: '⚡',
    lucky_find: '💎',
    time_warp: '⏰',
    golden_comet: '🌟',
  };
  
  return icons[type] || '❓';
}

/**
 * Получает цвет для типа сигнала
 */
export function getSignalColor(type: SignalType): string {
  const colors: Record<SignalType, string> = {
    resource_cache: '#4ade80',      // green
    production_boost: '#fbbf24',    // amber
    research_burst: '#60a5fa',      // blue
    energy_surge: '#a78bfa',        // purple
    lucky_find: '#f472b6',          // pink
    time_warp: '#38bdf8',           // cyan
    golden_comet: '#fbbf24',        // gold
  };
  
  return colors[type] || '#6b7280';
}

/**
 * Применяет множитель бустов к производству
 */
export function applyBoostMultipliers(
  baseProduction: Decimal,
  boosts: ActiveBoost[],
  resource?: ResourceType
): Decimal {
  let multiplier = 1;
  
  for (const boost of boosts) {
    // Если буст влияет на конкретные ресурсы, проверяем
    if (boost.affectedResources && resource) {
      if (!boost.affectedResources.includes(resource)) {
        continue; // Этот буст не влияет на данный ресурс
      }
    }
    
    multiplier *= boost.multiplier;
  }
  
  return baseProduction.mul(multiplier);
}

/**
 * Получает описание награды сигнала
 */
export function getSignalRewardDescription(reward: SignalReward): string {
  switch (reward.type) {
    case 'resources': {
      const parts: string[] = [];
      
      if (reward.resources) {
        const count = Object.keys(reward.resources).length;
        if (count > 0) parts.push(`${count} типов ресурсов`);
      }
      
      if (reward.credits?.gt(0)) {
        parts.push(`${reward.credits.toNumber().toLocaleString()} кредитов`);
      }
      
      if (reward.researchPoints?.gt(0)) {
        parts.push(`${reward.researchPoints.toNumber()} RP`);
      }
      
      if (reward.darkMatter?.gt(0)) {
        parts.push(`${reward.darkMatter.toNumber()} темной материи`);
      }
      
      return parts.join(', ') || 'Ресурсы';
    }
    
    case 'boost': {
      if (reward.productionMultiplier && reward.boostDuration) {
        const seconds = Math.floor(reward.boostDuration / 1000);
        return `x${reward.productionMultiplier} производство на ${seconds}с`;
      }
      return 'Буст производства';
    }
    
    case 'instant': {
      if (reward.researchPoints?.gt(0)) {
        return `${reward.researchPoints.toNumber()} очков исследований`;
      }
      return 'Мгновенная награда';
    }
    
    default:
      return 'Неизвестная награда';
  }
}
