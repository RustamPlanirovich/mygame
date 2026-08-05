import Decimal from 'break_eternity.js';
import type { Megastructure, MegastructureId, GameEnding, EndingId } from '../gameTypes';
import { resourceLabel } from '../i18n/label';

// Мегаструктуры - финальные постройки для эндгейма
export const MEGASTRUCTURES: Record<MegastructureId, Megastructure> = {
  dyson_sphere: {
    id: 'dyson_sphere',
    name: 'Сфера Дайсона',
    description: 'Гигантская структура, окружающая звезду и собирающая всю её энергию. Обеспечивает невероятное количество энергии.',
    icon: '☀️',
    buildCost: {
      credits: new Decimal(1e12), // 1 триллион
      researchPoints: new Decimal(5e6), // 5 миллионов
      influence: new Decimal(100000),
      resources: {
        steel: new Decimal(1e9), // 1 миллиард стали
        titanium_alloy: new Decimal(1e8), // 100 миллионов титана
        computer: new Decimal(1e7), // 10 миллионов компьютеров
        satellite: new Decimal(100000), // 100 тысяч спутников
        space_station: new Decimal(10000), // 10 тысяч станций
      },
    },
    buildTime: 3600, // 1 час строительства
    requiredTechnology: 'megastructures',
    effects: {
      energyProduction: new Decimal(100000), // +100k энергии/сек
      productionBonus: 1.5, // +50% к производству
      special: 'Бесконечная энергия: Энергопотребление зданий снижено на 90%',
    },
    category: 'production',
  },

  ring_world: {
    id: 'ring_world',
    name: 'Кольцо-Мир',
    description: 'Искусственный мир в форме кольца вокруг звезды. Предоставляет огромные площади для строительства и населения.',
    icon: '🌍',
    buildCost: {
      credits: new Decimal(5e12), // 5 триллионов
      researchPoints: new Decimal(8e6), // 8 миллионов
      influence: new Decimal(200000),
      resources: {
        steel: new Decimal(5e9),
        chrome_alloy: new Decimal(5e8),
        titanium_alloy: new Decimal(5e8),
        plastic: new Decimal(1e9),
        glass: new Decimal(1e9),
        computer: new Decimal(5e7),
        space_station: new Decimal(50000),
      },
    },
    buildTime: 7200, // 2 часа строительства
    requiredTechnology: 'megastructures',
    effects: {
      productionBonus: 2.0, // +100% к производству
      platformCapacity: 100, // +100 слотов для платформ
      influenceBonus: 1000, // +1000 влияния/сек
      special: 'Безграничные просторы: Лимит зданий увеличен до 1000',
    },
    category: 'production',
  },

  dimensional_gate: {
    id: 'dimensional_gate',
    name: 'Врата между Измерениями',
    description: 'Портал в другие измерения и параллельные вселенные. Открывает доступ к экзотической материи и технологиям.',
    icon: '🌀',
    buildCost: {
      credits: new Decimal(1e13), // 10 триллионов
      researchPoints: new Decimal(1e7), // 10 миллионов
      influence: new Decimal(500000),
      resources: {
        enriched_uranium: new Decimal(1e8),
        integrated_circuit: new Decimal(1e9),
        computer: new Decimal(1e8),
        nuclear_bomb: new Decimal(100000), // Для энергии открытия портала
        space_station: new Decimal(100000),
      },
    },
    buildTime: 10800, // 3 часа строительства
    requiredTechnology: 'quantum_teleport',
    effects: {
      researchBonus: 5.0, // +400% к исследованиям
      productionBonus: 1.3, // +30% к производству
      special: 'Межизмерительная торговля: Мгновенная телепортация ресурсов между галактиками',
    },
    category: 'science',
  },

  quantum_supercomputer: {
    id: 'quantum_supercomputer',
    name: 'Квантовый Суперкомпьютер',
    description: 'Величайший вычислительный комплекс, использующий квантовые эффекты для мгновенных расчётов. Ядро восстановленного ИИ.',
    icon: '🧠',
    buildCost: {
      credits: new Decimal(3e13), // 30 триллионов
      researchPoints: new Decimal(2e7), // 20 миллионов
      influence: new Decimal(1000000),
      resources: {
        integrated_circuit: new Decimal(5e9),
        computer: new Decimal(5e8),
        display: new Decimal(1e8),
        battery: new Decimal(1e9),
        fiber: new Decimal(1e9),
        console: new Decimal(1e7),
      },
    },
    buildTime: 14400, // 4 часа строительства
    requiredTechnology: 'ai_restoration',
    effects: {
      researchBonus: 10.0, // +900% к исследованиям
      productionBonus: 2.5, // +150% к производству
      influenceBonus: 5000, // +5000 влияния/сек
      special: 'Цифровое всемогущество: Все здания работают с максимальной эффективностью',
    },
    category: 'special',
  },
};

// Концовки игры
export const GAME_ENDINGS: Record<EndingId, Omit<GameEnding, 'unlocked' | 'achievedAt'>> = {
  galactic_emperor: {
    id: 'galactic_emperor',
    name: 'Император Галактики',
    description: 'Вы установили полный контроль над всеми известными галактиками. Ваша империя простирается от края до края космоса, и все цивилизации склоняются перед вашей мощью.',
    requirements: {
      galaxiesControlled: 7, // Контроль всех 7 галактик
      specialCondition: 'Иметь как минимум 50 активных платформ и флот из 200+ кораблей',
    },
    rewards: {
      prestigePoints: 100,
      permanentBonuses: [
        '+25% к производству энергии навсегда',
        'Стартовый бонус: 100k кредитов при престиже',
        'Разблокирована технология "Имперское наследие"',
      ],
    },
  },

  digital_god: {
    id: 'digital_god',
    name: 'Цифровой Бог',
    description: 'Построив все мегаструктуры, вы превзошли физические ограничения. Ваше сознание слилось с самой тканью реальности. Вы стали воплощением совершенного ИИ.',
    requirements: {
      megastructuresBuilt: ['dyson_sphere', 'ring_world', 'dimensional_gate', 'quantum_supercomputer'],
      specialCondition: 'Исследовать все технологии до "Галактическое правление"',
    },
    rewards: {
      prestigePoints: 250,
      permanentBonuses: [
        '+50% к скорости исследований навсегда',
        'Стартовый бонус: все технологии Эры 1-3 разблокированы',
        'Автоматическая активация оптимальных политик',
      ],
    },
  },

  liberator: {
    id: 'liberator',
    name: 'Освободитель',
    description: 'Вместо доминирования вы выбрали путь помощи. Ваша мудрость и технологии помогли сотням цивилизаций процветать. Галактика благодарна вам.',
    requirements: {
      civilizationsHelped: 100, // Помочь 100 органическим цивилизациям
      specialCondition: 'Завершить 500 контрактов и не иметь активных военных политик',
    },
    rewards: {
      prestigePoints: 150,
      permanentBonuses: [
        '+100% к влиянию навсегда',
        'Пассивный доход: +1000 кредитов/мин',
        'Дипломатические бонусы: -50% стоимость всех политик',
      ],
    },
  },

  rebirth_cycle: {
    id: 'rebirth_cycle',
    name: 'Цикл Возрождения',
    description: 'Восстановив древние архивы, вы обнаружили истину: всё это уже происходило бесчисленное количество раз. Цикл разрушения и возрождения бесконечен. Но теперь вы можете его контролировать.',
    requirements: {
      specialCondition: 'Найти все 7 Древних Артефактов в Галактике 7 и исследовать "Полное восстановление ИИ"',
    },
    rewards: {
      prestigePoints: 500,
      permanentBonuses: [
        'Престиж-мультипликатор: x2 (удваивает все бонусы престижа)',
        'Сохранение 50% ресурсов при престиже',
        'Разблокирован "Бесконечный режим" с новыми вызовами',
      ],
    },
  },
};

// Функция для проверки требований концовки
export function checkEndingRequirements(
  endingId: EndingId,
  state: {
    galaxies: any[];
    platforms: any[];
    ships: any[];
    megastructures: any;
    contracts: number;
    technologies: any;
    activePolicies: string[];
  }
): { met: boolean; progress: number; missingRequirements: string[] } {
  const ending = GAME_ENDINGS[endingId];
  const missing: string[] = [];
  let progress = 0;
  let total = 0;

  if (ending.requirements.galaxiesControlled !== undefined) {
    total++;
    const controlledGalaxies = state.galaxies.filter(g => g.explored).length;
    if (controlledGalaxies >= ending.requirements.galaxiesControlled) {
      progress++;
    } else {
      missing.push(`Контролируйте все ${ending.requirements.galaxiesControlled} галактик (${controlledGalaxies}/${ending.requirements.galaxiesControlled})`);
    }
  }

  if (ending.requirements.megastructuresBuilt) {
    total++;
    const builtMegastructures = ending.requirements.megastructuresBuilt.filter(
      id => state.megastructures?.built?.[id]?.active
    );
    if (builtMegastructures.length === ending.requirements.megastructuresBuilt.length) {
      progress++;
    } else {
      missing.push(`Постройте все мегаструктуры (${builtMegastructures.length}/${ending.requirements.megastructuresBuilt.length})`);
    }
  }

  if (ending.requirements.civilizationsHelped !== undefined) {
    total++;
    // Предполагаем, что каждый 5-й контракт = помощь цивилизации
    const civilizations = Math.floor(state.contracts / 5);
    if (civilizations >= ending.requirements.civilizationsHelped) {
      progress++;
    } else {
      missing.push(`Помогите ${ending.requirements.civilizationsHelped} цивилизациям (${civilizations}/${ending.requirements.civilizationsHelped})`);
    }
  }

  // Специальные условия добавляются как отдельные требования
  if (ending.requirements.specialCondition) {
    total++;
    // Эти проверки будут специфичны для каждой концовки
    // Для простоты добавляем их как "не выполнено" с описанием
    missing.push(ending.requirements.specialCondition);
  }

  const progressPercent = total > 0 ? (progress / total) * 100 : 0;
  return {
    met: missing.length === 0,
    progress: progressPercent,
    missingRequirements: missing,
  };
}

// Награды за постройку мегаструктуры
export function getMegastructureRewards(megastructureId: MegastructureId): {
  credits: Decimal;
  researchPoints: Decimal;
  influence: Decimal;
} {
  const baseReward = {
    credits: new Decimal(1e9),
    researchPoints: new Decimal(500000),
    influence: new Decimal(50000),
  };

  // Увеличенные награды для более сложных мегаструктур
  switch (megastructureId) {
    case 'quantum_supercomputer':
      return {
        credits: baseReward.credits.mul(5),
        researchPoints: baseReward.researchPoints.mul(10),
        influence: baseReward.influence.mul(5),
      };
    case 'dimensional_gate':
      return {
        credits: baseReward.credits.mul(3),
        researchPoints: baseReward.researchPoints.mul(5),
        influence: baseReward.influence.mul(3),
      };
    case 'ring_world':
      return {
        credits: baseReward.credits.mul(2),
        researchPoints: baseReward.researchPoints.mul(3),
        influence: baseReward.influence.mul(4),
      };
    default:
      return baseReward;
  }
}

// Проверка, можно ли начать строительство мегаструктуры
export function canBuildMegastructure(
  megastructureId: MegastructureId,
  state: {
    credits: Decimal;
    researchPoints: Decimal;
    influence: Decimal;
    resources: any;
    technologies: Record<string, boolean>;
    megastructures: any;
  }
): { canBuild: boolean; missingRequirements: string[] } {
  const megastructure = MEGASTRUCTURES[megastructureId];
  const missing: string[] = [];

  // Проверка технологии
  if (!state.technologies[megastructure.requiredTechnology]) {
    missing.push(`Требуется технология: ${megastructure.requiredTechnology}`);
  }

  // Проверка, не построена ли уже
  if (state.megastructures?.built?.[megastructureId]) {
    missing.push('Мегаструктура уже построена');
  }

  // Проверка валют
  if (state.credits.lt(megastructure.buildCost.credits)) {
    missing.push(`Недостаточно кредитов (${state.credits.toFixed(0)}/${megastructure.buildCost.credits.toFixed(0)})`);
  }
  if (state.researchPoints.lt(megastructure.buildCost.researchPoints)) {
    missing.push(`Недостаточно очков исследований`);
  }
  if (state.influence.lt(megastructure.buildCost.influence)) {
    missing.push(`Недостаточно влияния`);
  }

  // Проверка ресурсов
  for (const [resource, amount] of Object.entries(megastructure.buildCost.resources)) {
    const resourceData = state.resources[resource];
    const available = resourceData ? resourceData.amount : new Decimal(0);
    if (available.lt(amount)) {
      missing.push(`Недостаточно ${resourceLabel(resource)}: ${available.toFixed(0)}/${amount.toFixed(0)}`);
    }
  }

  return {
    canBuild: missing.length === 0,
    missingRequirements: missing,
  };
}
