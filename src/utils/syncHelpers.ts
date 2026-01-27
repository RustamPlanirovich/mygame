/**
 * Sync Helpers - Фаза 8
 * Вспомогательные функции для синхронизации
 */

import { useGameStore } from '../features/gameStore';

/**
 * Получить текущий ID слота из localStorage
 */
export const getCurrentSlotId = (): number | null => {
  const stored = localStorage.getItem('currentSlotId');
  if (stored) {
    const parsed = parseInt(stored, 10);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
};

/**
 * Установить текущий ID слота в localStorage
 */
export const setCurrentSlotId = (slotId: number | null): void => {
  if (slotId === null) {
    localStorage.removeItem('currentSlotId');
  } else {
    localStorage.setItem('currentSlotId', slotId.toString());
  }
};

/**
 * Получить данные сохранения в формате JSON
 * Возвращает строку JSON с текущим состоянием игры для синхронизации
 */
export const getGameSaveData = (): string => {
  const state = useGameStore.getState();
  
  // Используем ту же логику сериализации, что и saveGame в gameStore
  const save = {
    resources: Object.fromEntries(
      Object.entries(state.resources).map(([k, v]) => [
        k,
        { amount: v.amount.toString(), max: v.max.toString() },
      ])
    ),
    buildings: state.buildings.map((b) => ({ id: b.id, count: b.count })),
    currency: {
      credits: state.currency.credits.toString(),
      researchPoints: state.currency.researchPoints.toString(),
      influence: state.currency.influence.toString(),
    },
    market: {
      prices: Object.fromEntries(
        Object.entries(state.market.prices).map(([k, v]) => [k, v.toString()])
      ),
      event: state.market.event,
      nextUpdateAt: state.market.nextUpdateAt,
      history: state.market.history,
    },
    combat: {
      baseHp: state.combat.baseHp.toString(),
      baseMaxHp: state.combat.baseMaxHp.toString(),
      shieldHp: state.combat.shieldHp.toString(),
      shieldMaxHp: state.combat.shieldMaxHp.toString(),
      nextWaveAt: state.combat.nextWaveAt,
      waveEndsAt: state.combat.waveEndsAt,
      nextSpawnAt: state.combat.nextSpawnAt,
      lastDamageAt: state.combat.lastDamageAt,
      baseRegenPerSecond: state.combat.baseRegenPerSecond.toString(),
      enemies: state.combat.enemies.map((e) => ({
        id: e.id,
        type: e.type,
        hp: e.hp.toString(),
        maxHp: e.maxHp.toString(),
        distance: e.distance,
        speed: e.speed,
      })),
    },
    research: state.research,
    demons: {
      active: state.demons.active,
      brokerExcludeFromAutoSell: state.demons.brokerExcludeFromAutoSell,
    },
    meta: {
      qubits: state.meta.qubits.toString(),
      lifetimeEnergyProduced: state.meta.lifetimeEnergyProduced.toString(),
      blueprints: state.meta.blueprints.toString(),
    },
    expedition: state.expedition,
    nanoSwarm: state.nanoSwarm,
    ship: state.ship,
    starChart: state.starChart,
    aegis: state.aegis,
    productionMatrix: state.productionMatrix,
    quantumNet: state.quantumNet,
    politics: state.politics,
    galaxies: {
      currentGalaxyId: state.galaxies.currentGalaxyId,
      unlockedGalaxies: state.galaxies.unlockedGalaxies,
      platforms: state.galaxies.platforms,
      autoTransportEnabled: state.galaxies.autoTransportEnabled,
      fuelReserve: state.galaxies.fuelReserve.toString(),
    },
    pollution: {
      wasteAmount: state.pollution.wasteAmount.toString(),
      radioactiveWasteAmount: state.pollution.radioactiveWasteAmount.toString(),
      efficiencyMultiplier: state.pollution.efficiencyMultiplier,
      pollutionZones: state.pollution.pollutionZones,
    },
    randomEvents: {
      activeEvents: state.randomEvents.activeEvents.map((e) => ({
        ...e,
        effects: e.effects
          ? {
              ...e.effects,
              resourceGain: e.effects.resourceGain
                ? Object.fromEntries(
                    Object.entries(e.effects.resourceGain).map(([k, v]) => [
                      k,
                      v ? v.toString() : '0',
                    ])
                  )
                : undefined,
              resourceLoss: e.effects.resourceLoss
                ? Object.fromEntries(
                    Object.entries(e.effects.resourceLoss).map(([k, v]) => [
                      k,
                      v ? v.toString() : '0',
                    ])
                  )
                : undefined,
              researchPointsGain: e.effects.researchPointsGain
                ? e.effects.researchPointsGain.toString()
                : undefined,
              energyLoss: e.effects.energyLoss
                ? e.effects.energyLoss.toString()
                : undefined,
            }
          : undefined,
      })),
      eventHistory: state.randomEvents.eventHistory,
      nextEventAt: state.randomEvents.nextEventAt,
      eventsEnabled: state.randomEvents.eventsEnabled,
      eventFrequencyMultiplier: state.randomEvents.eventFrequencyMultiplier,
    },
    achievements: {
      unlocked: state.achievements.unlocked,
      recentlyUnlocked: state.achievements.recentlyUnlocked,
    },
    culture: {
      science: state.culture.science.toString(),
      culture: state.culture.culture.toString(),
      currentLevel: state.culture.currentLevel,
      cultureProgress: state.culture.cultureProgress.toString(),
      totalScienceProduced: state.culture.totalScienceProduced.toString(),
      totalCultureProduced: state.culture.totalCultureProduced.toString(),
      happiness: state.culture.happiness,
      unlockedCultureBuildings: state.culture.unlockedCultureBuildings,
      aggregatedEffects: state.culture.aggregatedEffects,
    },
    grid: state.grid,
    lastTick: state.lastTick,
  };
  
  return JSON.stringify(save);
};

/**
 * React Hook для использования в компонентах
 * Возвращает текущий слот и функцию получения данных сохранения
 */
export const useSyncData = () => {
  const currentSlotId = getCurrentSlotId();
  
  return {
    currentSlotId,
    getSaveData: getGameSaveData,
  };
};
