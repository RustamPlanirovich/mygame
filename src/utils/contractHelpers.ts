import Decimal from 'break_eternity.js';
import type {
  Contract,
  ContractAnalysis,
  ContractResourceAnalysis,
  ResourceType,
  GameState,
} from '../core/gameTypes';

/**
 * Вычисляет детальный анализ контракта
 * Показывает игроку, успеет ли он выполнить контракт в срок
 */
export function analyzeContract(
  contract: Contract,
  state: GameState
): ContractAnalysis {
  const now = Date.now();
  const timeLeft = (contract.expiresAt - now) / 1000; // секунд до истечения
  const totalTime = (contract.expiresAt - contract.acceptedAt) / 1000;

  const perResource: ContractResourceAnalysis[] = [];
  let longestEta = 0;
  let criticalResource: ResourceType | null = null;

  // Анализ каждого ресурса
  for (const [resType, required] of Object.entries(contract.requirements)) {
    const resource = resType as ResourceType;
    const currentRaw = state.grid.buffers.base?.[resource];
    const productionRaw = state.grid.buffers.production?.[resource];
    
    // Конвертируем в Decimal если не Decimal уже
    const current = typeof currentRaw === 'string' || typeof currentRaw === 'number' 
      ? new Decimal(currentRaw || 0) 
      : currentRaw || new Decimal(0);
    const production = typeof productionRaw === 'string' || typeof productionRaw === 'number'
      ? new Decimal(productionRaw || 0)
      : productionRaw || new Decimal(0);

    const needed = required instanceof Decimal ? required : new Decimal(required);
    const remaining = Decimal.max(0, needed.minus(current));
    
    // Рассчитываем ETA (время до готовности)
    let etaSeconds = 0;
    if (remaining.gt(0)) {
      if (production.lte(0)) {
        etaSeconds = Infinity; // Производство нулевое - никогда не выполним
      } else {
        etaSeconds = remaining.div(production).toNumber();
      }
    }

    const willComplete = etaSeconds < timeLeft;
    const isBottleneck = etaSeconds > longestEta && !willComplete;

    if (isBottleneck) {
      longestEta = etaSeconds;
      criticalResource = resource;
    }

    perResource.push({
      resource,
      needed,
      current,
      remaining,
      production,
      etaSeconds,
      willComplete,
      isBottleneck,
    });
  }

  // Время до полного выполнения всех требований
  const timeToComplete = Math.max(...perResource.map(r => r.etaSeconds));

  // Определяем общий статус
  let overallStatus: ContractAnalysis['overallStatus'];
  if (timeToComplete === 0) {
    overallStatus = 'ready'; // Можно сдавать прямо сейчас
  } else if (timeToComplete < timeLeft * 0.5) {
    overallStatus = 'on_track'; // Уверенно успеваем
  } else if (timeToComplete < timeLeft) {
    overallStatus = 'at_risk'; // Впритык, но успеем
  } else {
    overallStatus = 'will_fail'; // Не успеем
  }

  // Проверяем бонус за скорость
  const speedBonus = timeToComplete < totalTime * 0.5;

  // Генерируем подсказку
  const suggestion = generateSuggestion(perResource, overallStatus, criticalResource, timeLeft);

  return {
    perResource,
    overallStatus,
    criticalResource,
    suggestion,
    timeToComplete,
    speedBonus,
  };
}

/**
 * Генерирует подсказку для игрока на основе анализа
 */
function generateSuggestion(
  perResource: ContractResourceAnalysis[],
  status: ContractAnalysis['overallStatus'],
  criticalResource: ResourceType | null,
  timeLeft: number
): string {
  if (status === 'ready') {
    return '✅ Все ресурсы готовы! Можете сдать контракт прямо сейчас.';
  }

  if (status === 'on_track') {
    return '🟢 Всё идёт по плану. Контракт будет выполнен вовремя.';
  }

  if (status === 'at_risk') {
    const critical = perResource.find(r => r.resource === criticalResource);
    if (!critical) return '⚠️ Время поджимает! Следите за производством.';
    
    const productionNeeded = critical.remaining.div(timeLeft);
    const currentProduction = critical.production;
    const deficit = productionNeeded.minus(currentProduction);

    if (deficit.lte(0)) {
      return '⚠️ Впритык, но успеете. Не останавливайте производство!';
    }

    return `⚠️ Узкое место: ${getResourceName(critical.resource)}. Нужно увеличить производство на ${deficit.toFixed(1)}/сек.`;
  }

  // will_fail
  const critical = perResource.find(r => r.resource === criticalResource);
  if (!critical) return '❌ Контракт не будет выполнен вовремя.';

  const productionNeeded = critical.remaining.div(timeLeft);
  const currentProduction = critical.production;
  const deficitPercent = productionNeeded.div(currentProduction.gt(0) ? currentProduction : new Decimal(1)).minus(1).times(100);

  if (currentProduction.lte(0)) {
    return `❌ ${getResourceName(critical.resource)} не производится! Постройте производящие здания.`;
  }

  return `❌ Не успеете! ${getResourceName(critical.resource)}: нужно увеличить производство на ${deficitPercent.toFixed(0)}%.`;
}

/**
 * Получить читаемое имя ресурса
 */
function getResourceName(resource: ResourceType): string {
  const names: Record<string, string> = {
    iron: 'Железо',
    copper: 'Медь',
    silicon: 'Кремний',
    titanium: 'Титан',
    platinum: 'Платина',
    uranium: 'Уран',
    antimatter: 'Антиматерия',
    dark_matter: 'Тёмная материя',
    exotic_matter: 'Экзоматерия',
    energy: 'Энергия',
    water: 'Вода',
    food: 'Еда',
    oxygen: 'Кислород',
    circuits: 'Микросхемы',
    alloys: 'Сплавы',
    fuel: 'Топливо',
    nanobots: 'Наноботы',
    quantum_cores: 'Квантовые ядра',
    neural_networks: 'Нейросети',
    gravitons: 'Гравитоны',
  };

  return names[resource] || resource;
}

/**
 * Форматирует время в читаемый вид
 */
export function formatTimeRemaining(seconds: number): string {
  if (seconds === Infinity) return '∞';
  if (seconds <= 0) return '0с';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}ч ${minutes}м`;
  }
  if (minutes > 0) {
    return `${minutes}м ${secs}с`;
  }
  return `${secs}с`;
}

/**
 * Получить иконку статуса
 */
export function getStatusIcon(status: ContractAnalysis['overallStatus']): string {
  switch (status) {
    case 'ready': return '✅';
    case 'on_track': return '🟢';
    case 'at_risk': return '⚠️';
    case 'will_fail': return '❌';
    default: return '❓';
  }
}

/**
 * Получить цвет статуса для UI
 */
export function getStatusColor(status: ContractAnalysis['overallStatus']): string {
  switch (status) {
    case 'ready': return 'text-green-400';
    case 'on_track': return 'text-green-400';
    case 'at_risk': return 'text-yellow-400';
    case 'will_fail': return 'text-red-400';
    default: return 'text-gray-400';
  }
}
