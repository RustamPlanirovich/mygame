import type { GameState } from '../core/gameTypes';
import { ACHIEVEMENTS, getAchievementById } from '../core/constants/achievements';

/**
 * Проверяет все достижения и разблокирует те, что соответствуют условиям
 * Вызывается из игрового цикла
 */
export function checkAchievements(state: GameState): void {
  const { 
    achievements, 
    buildings, 
    resources, 
    research,
    galaxies, 
    fleet,
    currency,
    energyProduction,
    pollution,
  } = state;

  const technologies = research.technologies;

  // Track statistics
  const stats = {
    buildingCount: buildings.length,
    totalTechnologies: Object.keys(technologies).filter(
      key => technologies[key as keyof typeof technologies]
    ).length,
    galaxyCount: galaxies.unlockedGalaxies.length,
    shipCount: fleet.ships.length,
    platformCount: galaxies.platforms.length,
    energyProduction: energyProduction.toNumber(),
    creditsTotal: currency.credits.toNumber(),
    
    // Building-specific counts
    buildingCountByType: {} as Record<string, number>,
    
    // Resource totals
    resourceAmounts: {} as Record<string, number>,
  };

  // Count buildings by type
  buildings.forEach(building => {
    stats.buildingCountByType[building.id] = (stats.buildingCountByType[building.id] || 0) + 1;
  });

  // Get resource amounts
  Object.keys(resources).forEach(resType => {
    const resource = resources[resType as keyof typeof resources];
    if (resource) {
      stats.resourceAmounts[resType] = resource.amount.toNumber();
    }
  });

  // Check each achievement
  ACHIEVEMENTS.forEach(achievement => {
    // Skip if already unlocked
    if (achievements.unlocked[achievement.id]) {
      return;
    }

    const { type, target, specificBuilding, specificResource, customCheck } = achievement.requirement;
    let isUnlocked = false;

    switch (type) {
      case 'building_count':
        if (specificBuilding) {
          isUnlocked = (stats.buildingCountByType[specificBuilding] || 0) >= target;
        } else {
          isUnlocked = stats.buildingCount >= target;
        }
        break;

      case 'resource_amount':
        if (specificResource) {
          isUnlocked = (stats.resourceAmounts[specificResource] || 0) >= target;
        }
        break;

      case 'technology_count':
        isUnlocked = stats.totalTechnologies >= target;
        break;

      case 'galaxy_count':
        isUnlocked = stats.galaxyCount >= target;
        break;

      case 'ship_count':
        isUnlocked = stats.shipCount >= target;
        break;

      case 'energy_production':
        isUnlocked = stats.energyProduction >= target;
        break;

      case 'credits_earned':
        isUnlocked = stats.creditsTotal >= target;
        break;

      case 'synergy_buildings':
        // TODO: Implement synergy checking logic
        // For now, just check if we have enough buildings with proximity bonuses
        isUnlocked = false;
        break;

      case 'zero_waste':
        // Check if we have 50+ production buildings and 0 waste
        const productionBuildings = buildings.filter(b => 
          ['coal_mine', 'iron_mine', 'steel_factory', 'smelting_furnace', 
           'gas_well', 'oil_well', 'refinery'].includes(b.id)
        ).length;
        isUnlocked = productionBuildings >= target && pollution.wasteAmount.eq(0);
        break;

      case 'combat_wins':
        // TODO: Track combat wins in game state
        // For now, check fleet size as proxy
        isUnlocked = stats.shipCount >= target / 2;
        break;

      case 'special':
        // Handle special custom checks
        isUnlocked = checkSpecialRequirement(state, customCheck || '', target);
        break;
    }

    if (isUnlocked) {
      // Use the store action to unlock achievement
      state.unlockAchievement(achievement.id);
    }
  });
}

/**
 * Handle special custom achievement checks
 */
function checkSpecialRequirement(state: GameState, customCheck: string, target: number): boolean {
  const { buildings, galaxies, politics, grid } = state;
  const technologies = state.research.technologies;

  switch (customCheck) {
    case 'max_building_level':
      // Check max level of any building
      const maxLevel = Math.max(...Object.values(grid.tileLevels || {}));
      return maxLevel >= target;

    case 'platform_count':
      return galaxies.platforms.length >= target;

    case 'boss_kills':
      // TODO: Track boss kills in game state
      return false;

    case 'defense_turret_count':
      const turretCount = buildings.filter(b => 
        b.id === 'defense_turret_v1' || b.id === 'defense_turret_v2'
      ).length;
      return turretCount >= target;

    case 'attacks_defended':
      // TODO: Track successful defenses in game state
      return false;

    case 'contracts_completed':
      // TODO: Track completed contracts in game state
      return false;

    case 'policies_activated':
      return politics.activePolicies.length >= target;

    case 'unique_policies_activated':
      // TODO: Track total unique policies ever activated
      return politics.activePolicies.length >= target;

    case 'has_quantum_tech':
      // Check if any quantum-related tech is researched
      return (technologies['quantum_technologies' as keyof typeof technologies] || 
              technologies['quantum_computing' as keyof typeof technologies]) || false;

    case 'rare_event_reward':
      // TODO: Track rare event rewards
      return false;

    case 'survived_chain_reaction':
      // TODO: Track chain reaction survivals
      return false;

    case 'time_accelerator_used':
      return politics.activePolicies.includes('time_accelerator');

    case 'perfect_districts':
      // TODO: Implement district efficiency checking
      return false;

    case 'successful_caravans':
      // TODO: Track successful caravan deliveries
      return false;

    default:
      return false;
  }
}

/**
 * Get recently unlocked achievements (last 10 seconds)
 */
export function getRecentAchievements(state: GameState): Array<{ id: string; name: string; icon: string }> {
  const now = Date.now();
  const recentWindow = 10000; // 10 seconds

  return state.achievements.recentlyUnlocked
    .filter(item => now - item.unlockedAt < recentWindow)
    .map(item => {
      const achievement = getAchievementById(item.achievementId);
      return {
        id: item.achievementId,
        name: achievement?.name || 'Unknown',
        icon: achievement?.icon || '🏆',
      };
    });
}

/**
 * Clear old recently unlocked achievements (older than 1 minute)
 */
export function cleanupRecentAchievements(state: GameState): void {
  const now = Date.now();
  const cutoff = now - 60000; // 1 minute

  const filtered = state.achievements.recentlyUnlocked.filter(
    item => item.unlockedAt > cutoff
  );

  if (filtered.length !== state.achievements.recentlyUnlocked.length) {
    // Update state without triggering full re-render
    state.achievements.recentlyUnlocked = filtered;
  }
}
