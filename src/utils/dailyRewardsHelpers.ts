import Decimal from 'break_eternity.js';
import type { DailyReward, DailyLoginState, TimeBasedReward, TimeBasedRewardsState } from '../core/gameTypes';
import { resourceLabel } from '../core/i18n/label';

/**
 * Генерирует календарь наград на 7 дней
 */
export function generateDailyRewardsCalendar(): DailyReward[] {
  const D = (n: number) => new Decimal(n);
  
  return [
    {
      day: 1,
      rewards: {
        credits: D(5000),
        researchPoints: D(100),
      },
      claimed: false,
    },
    {
      day: 2,
      rewards: {
        credits: D(10000),
        researchPoints: D(200),
        influence: D(10),
      },
      claimed: false,
    },
    {
      day: 3,
      rewards: {
        credits: D(20000),
        researchPoints: D(400),
        resources: {
          ore: D(5000),
          ice: D(3000),
        },
      },
      claimed: false,
    },
    {
      day: 4,
      rewards: {
        credits: D(35000),
        researchPoints: D(700),
        influence: D(25),
      },
      claimed: false,
    },
    {
      day: 5,
      rewards: {
        credits: D(50000),
        researchPoints: D(1000),
        resources: {
          steel: D(2000),
          carbon: D(500),
        },
      },
      claimed: false,
    },
    {
      day: 6,
      rewards: {
        credits: D(75000),
        researchPoints: D(1500),
        influence: D(50),
        resources: {
          ore: D(10000),
          ice: D(5000),
          carbon: D(3000),
        },
      },
      claimed: false,
    },
    {
      day: 7,
      rewards: {
        credits: D(100000),
        researchPoints: D(2000),
        influence: D(100),
        // Особая награда - можно будет добавить артефакт
      },
      claimed: false,
    },
  ];
}

/**
 * Получить текущую дату в формате YYYY-MM-DD
 */
export function getCurrentDateString(): string {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

/**
 * Проверить, прошло ли время с последнего входа (новый день?)
 */
export function isNewDay(lastLoginDate: string): boolean {
  const today = getCurrentDateString();
  return today !== lastLoginDate;
}

/**
 * Проверить, сохранился ли стрик (вчера был вход?)
 */
export function checkStreakContinuity(lastLoginDate: string): boolean {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  const todayStr = getCurrentDateString();
  
  // Стрик сохраняется если:
  // 1. Сегодня первый вход
  // 2. Или вчера был вход
  return lastLoginDate === yesterdayStr || lastLoginDate === todayStr;
}

/**
 * Обновить состояние daily login при входе
 */
export function updateDailyLogin(state: DailyLoginState): DailyLoginState {
  const today = getCurrentDateString();
  
  // Если это новый день
  if (isNewDay(state.lastLoginDate)) {
    const streakContinues = checkStreakContinuity(state.lastLoginDate);
    
    let newStreak = streakContinues ? state.currentStreak + 1 : 1;
    let newDay = state.currentDay;
    
    if (streakContinues) {
      // Продолжаем стрик
      newDay = (state.currentDay % 7) + 1; // 1-7, цикличный
    } else {
      // Стрик сломан, начинаем с 1-го дня
      newDay = 1;
      // Обнуляем claimed флаги
      state.rewards.forEach(r => r.claimed = false);
    }
    
    // Обновляем рекорд если нужно
    const newLongest = Math.max(state.longestStreak, newStreak);
    
    return {
      ...state,
      currentStreak: newStreak,
      longestStreak: newLongest,
      lastLoginDate: today,
      totalLogins: state.totalLogins + 1,
      currentDay: newDay,
    };
  }
  
  return state;
}

/**
 * Генерировать новый time-based reward контейнер
 */
export function generateTimeBasedReward(id: string, availableAt: number): TimeBasedReward {
  const D = (n: number) => new Decimal(n);
  
  // Случайные награды
  const randomMultiplier = 0.8 + Math.random() * 0.4; // 0.8 - 1.2
  
  return {
    id,
    name: 'Контейнер снабжения',
    availableAt,
    rewards: {
      credits: D(Math.floor(5000 * randomMultiplier)),
      researchPoints: D(Math.floor(100 * randomMultiplier)),
      resources: {
        ore: D(Math.floor(1000 * randomMultiplier)),
        ice: D(Math.floor(500 * randomMultiplier)),
      },
    },
    collected: false,
  };
}

/**
 * Обновить time-based rewards (проверить, нужно ли добавить новый контейнер)
 */
export function updateTimeBasedRewards(state: TimeBasedRewardsState, now: number): TimeBasedRewardsState {
  // Удаляем собранные контейнеры
  let containers = state.containers.filter(c => !c.collected);
  
  // Проверяем, прошёл ли интервал с последнего сбора
  const timeSinceLastCollection = now - state.lastCollectionTime;
  
  if (timeSinceLastCollection >= state.collectionInterval && containers.length < state.maxStoredContainers) {
    // Добавляем новый контейнер
    const newContainer = generateTimeBasedReward(
      `container_${now}`,
      now
    );
    containers.push(newContainer);
    
    return {
      ...state,
      containers,
      lastCollectionTime: now,
    };
  }
  
  return {
    ...state,
    containers,
  };
}

/**
 * Получить описание награды в читаемом виде
 */
export function formatRewardDescription(reward: DailyReward['rewards']): string {
  const parts: string[] = [];
  
  if (reward.credits) {
    parts.push(`💰 ${reward.credits.toFixed(0)} кредитов`);
  }
  if (reward.researchPoints) {
    parts.push(`🔬 ${reward.researchPoints.toFixed(0)} ОИ`);
  }
  if (reward.influence) {
    parts.push(`👑 ${reward.influence.toFixed(0)} влияния`);
  }
  if (reward.resources) {
    for (const [resource, amount] of Object.entries(reward.resources)) {
      parts.push(`${getResourceEmoji(resource)} ${amount.toFixed(0)} ${resourceLabel(resource)}`);
    }
  }
  
  return parts.join(', ');
}

/**
 * Получить эмодзи для ресурса
 */
function getResourceEmoji(resource: string): string {
  const emojis: Record<string, string> = {
    ore: '⛏️',
    ice: '🧊',
    carbon: '⚫',
    steel: '🔩',
    circuits: '🔧',
    fuel: '⛽',
    antimatter: '⚛️',
  };
  return emojis[resource] || '📦';
}

/**
 * Проверить, можно ли собрать награду за день
 */
export function canClaimDailyReward(state: DailyLoginState, day: number): boolean {
  const reward = state.rewards.find(r => r.day === day);
  if (!reward) return false;
  
  // Можно собрать если:
  // 1. Не собрана ещё
  // 2. Это текущий день в календаре
  return !reward.claimed && day === state.currentDay;
}

/**
 * Собрать награду за день
 */
export function claimDailyReward(state: DailyLoginState, day: number): DailyLoginState {
  if (!canClaimDailyReward(state, day)) return state;
  
  const rewards = state.rewards.map(r => 
    r.day === day ? { ...r, claimed: true } : r
  );
  
  return {
    ...state,
    rewards,
  };
}

/**
 * Получить время до следующего контейнера
 */
export function getTimeUntilNextContainer(state: TimeBasedRewardsState, now: number): number {
  const timeSinceLastCollection = now - state.lastCollectionTime;
  const remaining = state.collectionInterval - timeSinceLastCollection;
  return Math.max(0, remaining);
}

/**
 * Форматировать время до следующего контейнера
 */
export function formatTimeUntilNext(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return `${hours}ч ${remainingMinutes}м`;
  }
  if (minutes > 0) {
    const remainingSeconds = seconds % 60;
    return `${minutes}м ${remainingSeconds}с`;
  }
  return `${seconds}с`;
}
