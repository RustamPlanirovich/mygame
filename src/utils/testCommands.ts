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
    updateDeposits: () => void;
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
  
  // Команда для обновления месторождений на существующей карте
  window.updateDeposits = () => {
    const store = useGameStore.getState();
    const { grid } = store;
    const { deposits, tiles, width, height } = grid;
    
    console.log('🗺️ Обновление месторождений на карте...');
    console.log(`📊 Текущий размер карты: ${width}×${height}`);
    
    const newDeposits = { ...deposits };
    let addedCount = 0;
    
    // Вероятности для новых месторождений
    const gasChance = 0.05;
    const oilChance = 0.04;
    const sandChance = 0.06;
    const uraniumChance = 0.02;
    const chromeChance = 0.03;
    const titaniumChance = 0.025;
    const copperChance = 0.04;
    
    // Проходим по всем клеткам и добавляем новые месторождения на пустых клетках
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const key = `${x},${y}`;
        
        // Пропускаем клетки со зданиями или существующими месторождениями
        if (tiles[key] || deposits[key]) continue;
        
        const roll = Math.random();
        const totalChance = gasChance + oilChance + sandChance + uraniumChance + chromeChance + titaniumChance + copperChance;
        
        if (roll < totalChance) {
          // Определяем тип месторождения
          if (roll < gasChance) {
            newDeposits[key] = 'natural_gas';
            addedCount++;
          } else if (roll < gasChance + oilChance) {
            newDeposits[key] = 'oil';
            addedCount++;
          } else if (roll < gasChance + oilChance + sandChance) {
            newDeposits[key] = 'sand';
            addedCount++;
          } else if (roll < gasChance + oilChance + sandChance + uraniumChance) {
            newDeposits[key] = 'uranium';
            addedCount++;
          } else if (roll < gasChance + oilChance + sandChance + uraniumChance + chromeChance) {
            newDeposits[key] = 'chrome';
            addedCount++;
          } else if (roll < gasChance + oilChance + sandChance + uraniumChance + chromeChance + titaniumChance) {
            newDeposits[key] = 'titanium';
            addedCount++;
          } else {
            newDeposits[key] = 'copper';
            addedCount++;
          }
        }
      }
    }
    
    // Применяем изменения
    useGameStore.setState({
      grid: {
        ...grid,
        deposits: newDeposits,
      },
    });
    
    console.log(`✅ Добавлено ${addedCount} новых месторождений!`);
    console.log('💎 Новые месторождения:');
    console.log('  💨 Природный газ - для Газовой скважины');
    console.log('  🛢️ Нефть - для Нефтяной скважины');
    console.log('  🏖️ Песок - для Карьера песка');
    console.log('  ☢️ Уран - для Урановой шахты');
    console.log('  ⚪ Хром - для Хромовой шахты');
    console.log('  🔹 Титан - для Титановой шахты');
    console.log('  🟠 Медь - для Медного рудника');
    console.log('💡 Посмотрите на карту - новые месторождения должны появиться!');
  };
  
  // Команда для проверки состояния песка
  window.checkSand = function() {
    const state = useGameStore.getState();
    console.log('=== ПРОВЕРКА СОСТОЯНИЯ ПЕСКА ===');
    console.log('📊 state.resources.sand:', {
      amount: state.resources.sand?.amount?.toString() || 'undefined',
      max: state.resources.sand?.max?.toString() || 'undefined',
      production: state.resources.sand?.production?.toString() || 'undefined',
    });
    console.log('📦 grid.buffers.base.sand:', state.grid.buffers.base?.sand || 'undefined');
    console.log('🏗️ Карьеры песка на карте:', 
      Object.entries(state.grid.tiles).filter(([_, id]) => id === 'sand_quarry_mk1').length
    );
    console.log('🔍 Локальные буферы песка:');
    Object.entries(state.grid.buffers).forEach(([key, buf]) => {
      if (buf.sand && parseFloat(buf.sand) > 0) {
        console.log(`  ${key}: ${buf.sand}`);
      }
    });
    
    console.log('\n🔬 ДЕТАЛЬНЫЙ АНАЛИЗ КАРЬЕРОВ:');
    Object.entries(state.grid.tiles).forEach(([tileKey, buildingId]) => {
      if (buildingId === 'sand_quarry_mk1') {
        const deposit = state.grid.deposits?.[tileKey];
        const level = state.grid.tileLevels?.[tileKey] || 1;
        const localSand = state.grid.buffers[tileKey]?.sand || '0';
        const building = state.buildings.find(b => b.id === 'sand_quarry_mk1');
        
        console.log(`\n📍 Карьер на ${tileKey}:`);
        console.log(`  Депозит под зданием: ${deposit || 'НЕТ!'}`);
        console.log(`  Требуется депозит: sand`);
        console.log(`  Уровень здания: ${level}`);
        console.log(`  Локальный буфер песка: ${localSand}`);
        console.log(`  Производство (по данным здания): ${building?.production?.sand || 'undefined'}/с`);
        console.log(`  Потребление энергии: ${building?.energyConsumption || 0}/с`);
        console.log(`  ⚠️ РАБОТАЕТ: ${deposit === 'sand' ? '✅ ДА' : '❌ НЕТ - нет депозита!'}`);
      }
    });
    
    console.log('\n⚡ Энергия:');
    console.log(`  Всего: ${state.resources.energy.amount.toString()} / ${state.resources.energy.max.toString()}`);
    console.log(`  В буфере базы: ${state.grid.buffers.base?.energy || '0'}`);
    
    console.log('================================');
  };
  
  // Команда для выдачи энергии
  window.giveEnergy = function(amount = 10000) {
    const store = useGameStore.getState();
    store.addResource('energy', amount);
    console.log(`⚡ Добавлено ${amount} энергии`);
  };
  
  console.log('🎮 Тестовые команды загружены:');
  console.log('  - window.testRepeatableResearch() - разблокировать повторяемые исследования');
  console.log('  - window.testAscension() - установить вознесение на 5 уровень');
  console.log('  - window.giveResources(amount?) - выдать ресурсы');
  console.log('  - window.giveEnergy(amount?) - выдать энергию');
  console.log('  - window.testProceduralGalaxies() - разблокировать процедурные галактики');
  console.log('  - window.generateMultipleGalaxies(count?) - сгенерировать несколько галактик');
  console.log('  - window.updateDeposits() - добавить новые месторождения на карту');
  console.log('  - window.checkSand() - проверить состояние песка (отладка)');
}

// Автоматически загрузить тестовые команды в dev режиме
if (import.meta.env.DEV) {
  setupRepeatableResearchTest();
}
