import { create } from 'zustand';
import type Decimal from 'break_eternity.js';
import { D } from '../core/math/format';
import type { 
  CultureState, 
  HappinessFactor,
} from '../core/gameTypes.culture';
import type { Building } from '../core/gameTypes';
import { 
  getCultureLevel, 
  getCultureProgress, 
  getHappinessTier,
  getCultureLevelByNumber,
  getNextCultureLevel,
} from '../core/constants/cultureLevels';
import { 
  CULTURE_BUILDINGS, 
  aggregateCultureEffects,
  calculateCultureProduction,
  calculateScienceProduction,
  isCultureBuilding,
} from '../core/constants/cultureBuildings';
import { 
  calculateHappiness, 
  calculateHappinessTrend,
  smoothHappinessTransition,
  type HappinessInputs,
} from '../utils/happinessCalculator';

// ==========================================
// CULTURE STORE
// ==========================================

interface CultureStore extends CultureState {
  // Actions
  tick: (dt: number, inputs: Partial<HappinessInputs>) => void;
  addCulture: (amount: Decimal | number) => void;
  addScience: (amount: Decimal | number) => void;
  addTemporaryHappinessFactor: (factor: HappinessFactor) => void;
  removeTemporaryHappinessFactor: (factorId: string) => void;
  recalculateEffects: (buildings: Building[]) => void;
  recalculateHappiness: (inputs: HappinessInputs) => void;
  reset: () => void;
  
  // Getters
  getProductivityMultiplier: () => number;
  getCultureLevel: () => number;
  getCultureProgress: () => number;
  getNextLevelRequirement: () => Decimal | null;
}

const INITIAL_STATE: Omit<CultureState, never> = {
  science: D(0),
  culture: D(0),
  currentLevel: 1,
  cultureProgress: D(0),
  sciencePerSecond: D(0),
  culturePerSecond: D(0),
  totalScienceProduced: D(0),
  totalCultureProduced: D(0),
  happiness: {
    current: 50,
    factors: [],
    productivityMultiplier: 1.0,
    trend: 'stable',
    lastUpdated: Date.now(),
  },
  unlockedCultureBuildings: [],
  aggregatedEffects: {
    globalProductivity: 1.0,
    buildingDurability: 1.0,
    researchSpeed: 1.0,
    buildingCost: 1.0,
    tradePrices: 1.0,
    creditsPerSale: 1.0,
    pollutionReduction: 1.0,
  },
};

export const useCultureStore = create<CultureStore>((set, get) => ({
  ...INITIAL_STATE,
  
  tick: (dt: number, inputs: Partial<HappinessInputs>) => {
    set((state) => {
      // Calculate production per tick
      const cultureProduced = state.culturePerSecond.mul(dt);
      const scienceProduced = state.sciencePerSecond.mul(dt);
      
      // Update totals
      const newCulture = state.culture.add(cultureProduced);
      const newScience = state.science.add(scienceProduced);
      
      // Check for culture level up
      let newLevel = state.currentLevel;
      const levelData = getCultureLevel(newCulture);
      if (levelData.level > newLevel) {
        newLevel = levelData.level;
        // TODO: Notify user of level up
      }
      
      // Calculate progress to next level
      const progress = getCultureProgress(newCulture, newLevel);
      
      // Update happiness (smooth transition)
      let newHappiness = state.happiness;
      if (inputs.buildings) {
        const fullInputs: HappinessInputs = {
          buildings: inputs.buildings || [],
          cultureLevel: newLevel,
          pollutionLevel: inputs.pollutionLevel || 0,
          cleanEnergyRatio: inputs.cleanEnergyRatio || 0,
          credits: inputs.credits || D(0),
          creditsPerSecond: inputs.creditsPerSecond || D(0),
          isInDebt: inputs.isInDebt || false,
          isUnderAttack: inputs.isUnderAttack || false,
          recentDamage: inputs.recentDamage || false,
          enemyCount: inputs.enemyCount || 0,
          overclockActive: inputs.overclockActive || false,
          economyModeActive: inputs.economyModeActive || false,
          overclockBuildings: inputs.overclockBuildings || 0,
          totalBuildings: inputs.totalBuildings || 0,
          temporaryFactors: state.happiness.factors.filter(f => f.temporary),
        };
        
        const calculatedHappiness = calculateHappiness(fullInputs);
        const previousHappiness = state.happiness.current;
        const targetHappiness = calculatedHappiness.current;
        
        // Smooth transition
        const smoothedHappiness = smoothHappinessTransition(previousHappiness, targetHappiness, dt);
        const trend = calculateHappinessTrend(previousHappiness, smoothedHappiness);
        
        newHappiness = {
          ...calculatedHappiness,
          current: smoothedHappiness,
          trend,
          lastUpdated: Date.now(),
        };
      }
      
      // Clean up expired temporary factors
      const cleanedFactors = newHappiness.factors.filter(f => {
        if (!f.temporary || !f.expiresAt) return true;
        return f.expiresAt > Date.now();
      });
      
      if (cleanedFactors.length !== newHappiness.factors.length) {
        newHappiness = { ...newHappiness, factors: cleanedFactors };
      }
      
      return {
        culture: newCulture,
        science: newScience,
        currentLevel: newLevel,
        cultureProgress: D(progress),
        totalCultureProduced: state.totalCultureProduced.add(cultureProduced),
        totalScienceProduced: state.totalScienceProduced.add(scienceProduced),
        happiness: newHappiness,
      };
    });
  },
  
  addCulture: (amount: Decimal | number) => {
    const decAmount = typeof amount === 'number' ? D(amount) : amount;
    set((state) => ({
      culture: state.culture.add(decAmount),
      totalCultureProduced: state.totalCultureProduced.add(decAmount),
    }));
  },
  
  addScience: (amount: Decimal | number) => {
    const decAmount = typeof amount === 'number' ? D(amount) : amount;
    set((state) => ({
      science: state.science.add(decAmount),
      totalScienceProduced: state.totalScienceProduced.add(decAmount),
    }));
  },
  
  addTemporaryHappinessFactor: (factor: HappinessFactor) => {
    set((state) => ({
      happiness: {
        ...state.happiness,
        factors: [...state.happiness.factors.filter(f => f.id !== factor.id), factor],
      },
    }));
  },
  
  removeTemporaryHappinessFactor: (factorId: string) => {
    set((state) => ({
      happiness: {
        ...state.happiness,
        factors: state.happiness.factors.filter(f => f.id !== factorId),
      },
    }));
  },
  
  recalculateEffects: (buildings: Building[]) => {
    // Count culture buildings
    const buildingCounts: Record<string, number> = {};
    for (const building of buildings) {
      if (isCultureBuilding(building.id)) {
        buildingCounts[building.id] = (buildingCounts[building.id] || 0) + building.count;
      }
    }
    
    // Calculate aggregated effects
    const effects = aggregateCultureEffects(buildingCounts);
    
    // Calculate production rates
    const culturePerSecond = calculateCultureProduction(buildingCounts);
    const sciencePerSecond = calculateScienceProduction(buildingCounts);
    
    // Update unlocked buildings based on current level
    const state = get();
    const unlockedBuildings: string[] = [];
    for (const [id, building] of Object.entries(CULTURE_BUILDINGS)) {
      const requiredLevel = building.requiredCultureLevel || 1;
      if (state.currentLevel >= requiredLevel) {
        unlockedBuildings.push(id);
      }
    }
    
    set({
      aggregatedEffects: effects,
      culturePerSecond,
      sciencePerSecond,
      unlockedCultureBuildings: unlockedBuildings,
    });
  },
  
  recalculateHappiness: (inputs: HappinessInputs) => {
    const state = get();
    const calculatedHappiness = calculateHappiness({
      ...inputs,
      cultureLevel: state.currentLevel,
      temporaryFactors: state.happiness.factors.filter(f => f.temporary),
    });
    
    set({
      happiness: calculatedHappiness,
    });
  },
  
  reset: () => {
    set(INITIAL_STATE);
  },
  
  getProductivityMultiplier: () => {
    const state = get();
    return state.happiness.productivityMultiplier * state.aggregatedEffects.globalProductivity;
  },
  
  getCultureLevel: () => {
    return get().currentLevel;
  },
  
  getCultureProgress: () => {
    const state = get();
    return getCultureProgress(state.culture, state.currentLevel);
  },
  
  getNextLevelRequirement: () => {
    const state = get();
    const nextLevel = getNextCultureLevel(state.currentLevel);
    return nextLevel ? nextLevel.requiredCulture : null;
  },
}));

// ==========================================
// SELECTORS
// ==========================================

/**
 * Get happiness tier info
 */
export function useHappinessTier() {
  const happiness = useCultureStore((state) => state.happiness.current);
  return getHappinessTier(happiness);
}

/**
 * Get culture level info
 */
export function useCultureLevelInfo() {
  const currentLevel = useCultureStore((state) => state.currentLevel);
  const culture = useCultureStore((state) => state.culture);
  
  const levelData = getCultureLevelByNumber(currentLevel);
  const progress = getCultureProgress(culture, currentLevel);
  const nextLevel = getNextCultureLevel(currentLevel);
  
  return {
    level: currentLevel,
    name: levelData.name,
    description: levelData.description,
    happinessBonus: levelData.happinessBonus,
    progress,
    nextLevelRequirement: nextLevel?.requiredCulture || null,
    isMaxLevel: !nextLevel,
  };
}

/**
 * Get production summary
 */
export function useCultureProduction() {
  const culturePerSecond = useCultureStore((state) => state.culturePerSecond);
  const sciencePerSecond = useCultureStore((state) => state.sciencePerSecond);
  const totalCulture = useCultureStore((state) => state.totalCultureProduced);
  const totalScience = useCultureStore((state) => state.totalScienceProduced);
  
  return {
    culturePerSecond,
    sciencePerSecond,
    totalCultureProduced: totalCulture,
    totalScienceProduced: totalScience,
  };
}

/**
 * Get happiness factors
 */
export function useHappinessFactors() {
  return useCultureStore((state) => state.happiness.factors);
}

/**
 * Get aggregated culture effects
 */
export function useCultureEffects() {
  return useCultureStore((state) => state.aggregatedEffects);
}
