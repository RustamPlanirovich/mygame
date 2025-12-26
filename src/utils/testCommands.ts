/**
 * Тестовые команды для отладки повторяемых исследований
 * Использование: открыть консоль браузера и вызвать window.testRepeatableResearch()
 */

import { useGameStore } from '../features/gameStore';
import Decimal from 'break_eternity.js';

declare global {
  interface Window {
    testRepeatableResearch: () => void;
    testAscension: () => void;
    giveResources: (amount?: number) => void;
    testProceduralGalaxies: () => void;
    generateMultipleGalaxies: (count?: number) => void;
  }
}

// Тестовая команда для активации повторяемых исследований
export function setupRepeatableResearchTest() {
  if (typeof window === 'undefined') return;
  
  window.testRepeatableResearch = () => {
    const store = useGameStore.getState();
    
    console.log('🧪 Тестовый режим: Повторяемые исследования');
    
    // Разблокировать повторяемые исследования
    useGameStore.setState({
      ascension: {
        ...store.ascension,
        ascensionCount: 1,
        unlocks: {
          ...store.ascension.unlocks,
          infiniteResearch: true,
        },
      },
    });
    
    // Дать много ресурсов
    window.giveResources(1e15);
    
    console.log('✅ Повторяемые исследования разблокированы!');
    console.log('✅ Ресурсы выданы!');
    console.log('💡 Перейдите на вкладку "Исследования" → "Повторяемые"');
  };
  
  window.testAscension = () => {
    const store = useGameStore.getState();
    
    console.log('🧪 Тестовый режим: Быстрое Вознесение');
    
    useGameStore.setState({
      ascension: {
        ...store.ascension,
        ascensionCount: 5,
        ascensionPoints: 1000,
        lifetimeAscensionPoints: 1000,
        multipliers: {
          qpGain: 1 + (5 * 0.5),
          globalProduction: 1 + (5 * 0.1),
          researchSpeed: 1 + (5 * 0.2),
          startingCredits: 5 * 10000,
        },
        unlocks: {
          infiniteResearch: true,
          buildingEvolution: true,
          proceduralGalaxies: true,
        },
        stats: {
          totalAscensionTime: 0,
          fastestAscension: 0,
          totalQuantumPointsEarned: 0,
        },
      },
    });
    
    console.log('✅ Вознесение установлено на уровень 5!');
    console.log('✅ Все разблокировки активны!');
  };
  
  window.giveResources = (amount = 1e15) => {
    const store = useGameStore.getState();
    const resources = { ...store.resources };
    
    // Дать много всех ресурсов
    const resourceIds = [
      'energy', 'ore', 'ice', 'carbon', 'steel', 'dark_matter',
      'natural_gas', 'oil', 'gasoline', 'plastic', 'glass', 'chemicals', 'sand',
      'uranium', 'chrome', 'titanium', 'copper', 'semiconductors',
      'dynamite', 'fiber', 'integrated_circuit', 'battery', 'engine',
      'display', 'computer', 'liquid_fuel', 'chrome_alloy', 'titanium_alloy',
      'enriched_uranium', 'weapon', 'artillery', 'radar', 'nuclear_bomb',
      'jet_engine', 'satellite', 'rocket', 'spaceship', 'console',
      'space_station', 'robot', 'waste', 'radioactive_waste'
    ];
    
    resourceIds.forEach(id => {
      if (resources[id as keyof typeof resources]) {
        const resource = resources[id as keyof typeof resources];
        resource.amount = new Decimal(amount);
      }
    });
    
    // Дать кредиты
    useGameStore.setState({
      resources,
      currency: {
        ...store.currency,
        credits: new Decimal(amount),
      },
      meta: {
        ...store.meta,
        blueprints: new Decimal(amount / 1000),
      },
    });
    
    console.log(`✅ Выдано ${amount.toExponential()} всех ресурсов!`);
  };
  
  window.testProceduralGalaxies = () => {
    const store = useGameStore.getState();
    
    console.log('🧪 Тестовый режим: Процедурные Галактики');
    
    // Разблокировать процедурные галактики
    useGameStore.setState({
      ascension: {
        ...store.ascension,
        ascensionCount: 3,
        unlocks: {
          ...store.ascension.unlocks,
          proceduralGalaxies: true,
        },
      },
    });
    
    // Дать много кредитов
    window.giveResources(1e15);
    
    console.log('✅ Процедурные галактики разблокированы!');
    console.log('✅ Кредиты выданы!');
    console.log('💡 Перейдите на "Карта Галактик" и прокрутите вниз');
  };
  
  window.generateMultipleGalaxies = (count = 5) => {
    console.log(`🧪 Генерация ${count} процедурных галактик...`);
    
    const store = useGameStore.getState();
    
    // Убедимся что разблокировано
    if (!store.ascension.unlocks.proceduralGalaxies) {
      console.warn('⚠️ Процедурные галактики не разблокированы! Вызовите testProceduralGalaxies() сначала');
      return;
    }
    
    // Генерируем галактики
    for (let i = 0; i < count; i++) {
      store.generateProceduralGalaxy();
    }
    
    console.log(`✅ Сгенерировано ${count} галактик!`);
    console.log('💡 Нажмите "Исследовать галактику" на каждой для открытия');
    
    // Показать информацию о галактиках
    const galaxies = useGameStore.getState().proceduralGalaxies.galaxies;
    console.table(galaxies.map(g => ({
      '#': g.galaxyNumber,
      'Название': g.generated.name,
      'Сложность': `×${g.generated.difficulty.toFixed(1)}`,
      'Особенность': g.generated.specialFeature || 'нет',
      'Открыта': g.discovered ? 'Да' : 'Нет',
    })));
  };
  
  console.log('🎮 Тестовые команды загружены:');
  console.log('  - window.testRepeatableResearch() - разблокировать повторяемые исследования');
  console.log('  - window.testAscension() - установить вознесение на 5 уровень');
  console.log('  - window.giveResources(amount?) - выдать ресурсы');
  console.log('  - window.testProceduralGalaxies() - разблокировать процедурные галактики');
  console.log('  - window.generateMultipleGalaxies(count?) - сгенерировать несколько галактик');
}

// Автоматически загрузить тестовые команды в dev режиме
if (import.meta.env.DEV) {
  setupRepeatableResearchTest();
}
