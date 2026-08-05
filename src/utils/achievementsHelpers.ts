import type { GameState } from '../core/gameTypes';
import { ACHIEVEMENTS, getAchievementById } from '../core/constants/achievements';
import { DISABLEABLE_BUILDINGS } from '../core/constants/buildingCategories';
import { detectDistricts, isDistrictMaxed } from '../core/math/districts';
import { getBuildingsWithCoordinates } from './proximityHelpers';

/**
 * Проверяет все достижения и разблокирует те, что соответствуют условиям
 * Вызывается из игрового цикла
 */
export function checkAchievements(state: GameState): void {
  const { 
    achievements, 
    resources, 
    research,
    galaxies, 
    fleet,
    currency,
    energyProduction,
    pollution,
  } = state;

  const technologies = research.technologies;

  /*
   * `state.buildings` is the SHOP CATALOGUE — 101 building definitions, always present. Using
   * its length as "how many buildings has the player built" meant buildingCount was a constant
   * 101, so "постройте 50 зданий" unlocked on a brand-new save. And counting one per definition
   * made buildingCountByType always exactly 1, so every "постройте N зданий типа X" for N > 1
   * could never unlock.
   *
   * Placed buildings live in grid.tiles (tileKey -> buildingId), which is what the tick uses.
   */
  const placedByType: Record<string, number> = {};
  let placedTotal = 0;
  for (const buildingId of Object.values(state.grid.tiles)) {
    if (!buildingId) continue;
    placedByType[buildingId] = (placedByType[buildingId] ?? 0) + 1;
    placedTotal++;
  }

  // Track statistics
  const stats = {
    buildingCount: placedTotal,
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

  // Counted from placed tiles above, not from the catalogue.
  stats.buildingCountByType = placedByType;

  // Get resource amounts
  Object.keys(resources).forEach(resType => {
    const resource = resources[resType as keyof typeof resources];
    if (resource) {
      stats.resourceAmounts[resType] = resource.amount.toNumber();
    }
  });

  // Собираем всё выполненное за проход и выдаём одним вызовом — см. комментарий ниже.
  const unlockedNow: string[] = [];

  // Check each achievement
  ACHIEVEMENTS.forEach(achievement => {
    // Skip if already unlocked
    if (achievements.unlocked[achievement.id]) {
      return;
    }

    const { type, specificBuilding, specificResource, customCheck, check } = achievement.requirement;
    // `target` is optional on the type because `custom` requirements carry their own predicate;
    // every other branch compares against a number, so default it rather than compare to
    // undefined (which is always false and would silently disable the achievement).
    const target = achievement.requirement.target ?? 0;
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

      case 'synergy_buildings': {
        /*
         * Раньше здесь стоял `isUnlocked = false` — достижение было недостижимо.
         * Синергия у здания уже посчитана: proximityMultiplier > 1 означает, что соседи дают
         * ему бонус (см. core/math/proximity.ts). Считаем размещённые клетки, у определения
         * которых есть положительный множитель, а не элементы каталога: в каталоге у здания
         * один общий множитель, и по нему нельзя понять, сколько таких зданий стоит.
         */
        const synergyIds = new Set(
          state.buildings.filter((b) => (b.proximityMultiplier ?? 1) > 1).map((b) => b.id),
        );
        let synergyBuildings = 0;
        for (const buildingId of Object.values(state.grid.tiles)) {
          if (buildingId && synergyIds.has(buildingId)) synergyBuildings++;
        }
        isUnlocked = synergyBuildings >= target;
        break;
      }

      case 'zero_waste': {
        /*
         * Здесь был захардкоженный список из семи id (coal_mine, iron_mine, steel_factory,
         * smelting_furnace, gas_well, oil_well, refinery) — ни одного из них в каталоге нет,
         * реальные id идут с суффиксом ревизии (miner_mk1, steel_smelter_mk1, ...). Вдобавок
         * фильтровался каталог `buildings`, а не размещённые клетки, так что максимум давал 7
         * при пороге 50 — достижение было недостижимо дважды.
         *
         * DISABLEABLE_BUILDINGS — это ровно набор добывающих + производственных зданий
         * (энергетика, склады, оборона и лаборатории туда сознательно не входят), он уже
         * поддерживается в buildingCategories.ts, поэтому список не разъедется снова.
         */
        let productionBuildings = 0;
        for (const buildingId of Object.values(state.grid.tiles)) {
          if (buildingId && DISABLEABLE_BUILDINGS.has(buildingId)) productionBuildings++;
        }
        isUnlocked = productionBuildings >= target && pollution.wasteAmount.eq(0);
        break;
      }

      case 'combat_wins':
        /*
         * Здесь стояла заглушка «считаем размер флота как прокси»: достижение выдавалось за
         * покупку кораблей, а не за бои, и наоборот — активный боец без флота не получал его
         * никогда. Теперь есть настоящий счётчик убитых врагов (stats.enemiesKilled),
         * который инкрементируется в тике и попадает в сейв.
         */
        isUnlocked = state.stats.enemiesKilled >= target;
        break;

      case 'special':
        // Handle special custom checks
        isUnlocked = checkSpecialRequirement(state, customCheck || '', target);
        break;

      case 'custom':
        /*
         * The 21 achievements that declare an inline predicate. Previously this case did not
         * exist and the switch had no default, so isUnlocked stayed false forever.
         *
         * The predicates read optional slices (state.repeatableResearch, state.artifacts, ...)
         * and are authored data, so a throw here must not take down the whole tick — the
         * achievement check runs inside the game loop.
         */
        if (typeof check === 'function') {
          try {
            isUnlocked = check(state) === true;
          } catch (e) {
            console.warn(`[achievements] predicate for "${achievement.id}" threw:`, e);
            isUnlocked = false;
          }
        }
        break;

      default: {
        // Exhaustiveness guard: a new requirement type added to the union without a case here
        // would otherwise silently make its achievements unobtainable, which is exactly how
        // 'custom' went unnoticed.
        const unhandled: never = type;
        console.warn('[achievements] unhandled requirement type:', unhandled);
        break;
      }
    }

    if (isUnlocked) {
      unlockedNow.push(achievement.id);
    }
  });

  /*
   * Один вызов вместо одного на достижение (bigplan.md, пункт 27).
   *
   * Раньше здесь был `state.unlockAchievement(id)` внутри forEach: каждое достижение —
   * отдельный set() стора, а `state` при этом устаревший снимок, полученный до первого set.
   * При одновременной выдаче нескольких достижений (например, после долгого оффлайна)
   * каждое следующее считало от старого состояния и перетирало предыдущие начисления.
   */
  if (unlockedNow.length > 0) {
    state.unlockAchievements(unlockedNow);
  }
}

/**
 * Handle special custom achievement checks
 */
function checkSpecialRequirement(state: GameState, customCheck: string, target: number): boolean {
  const { galaxies, politics, grid } = state;
  const technologies = state.research.technologies;

  switch (customCheck) {
    case 'max_building_level':
      // Check max level of any building
      const maxLevel = Math.max(...Object.values(grid.tileLevels || {}));
      return maxLevel >= target;

    case 'platform_count':
      return galaxies.platforms.length >= target;

    case 'boss_kills':
      // Считается в тике при смерти врага с isBoss на платформе (см. gameStore).
      return state.stats.bossKills >= target;

    case 'defense_turret_count': {
      // Турели в каталоге называются defense_turret_mk1/mk2, а не ..._v1/..._v2 (v1/v2 — только
      // в отображаемых названиях «Защитная Турель v1/v2»). И считать надо размещённые клетки:
      // фильтр по каталогу давал максимум 2 при пороге 20.
      let turretCount = 0;
      for (const buildingId of Object.values(grid.tiles)) {
        if (buildingId === 'defense_turret_mk1' || buildingId === 'defense_turret_mk2') turretCount++;
      }
      return turretCount >= target;
    }

    case 'attacks_defended':
      // Волна считается отбитой в тике на переходе «волна была активна -> закончилась,
      // база жива» (см. gameStore).
      return state.stats.attacksDefended >= target;

    case 'contracts_completed':
      /*
       * Счётчик был всё это время: state.stats.contractsCompleted инкрементируется при
       * выполнении контракта и уже используется условиями концовок. Здесь стоял `return false`,
       * из-за чего «Торговец» (50) и «Мастер рынка» (200) не выдавались никогда.
       */
      return state.stats.contractsCompleted >= target;

    case 'policies_activated':
      return politics.activePolicies.length >= target;

    case 'unique_policies_activated':
      /*
       * Раньше здесь считалось activePolicies.length — число ОДНОВРЕМЕННО активных, которое
       * ограничено politics.maxActivePolicies. Достижение «Правитель» просит 10 разных политик
       * за всё время, и при лимите меньше 10 было недостижимо в принципе.
       */
      return state.stats.uniquePoliciesActivated.length >= target;

    case 'has_quantum_tech':
      // В дереве нет ни 'quantum_technologies', ни 'quantum_computing' (последнее — id политики,
      // а не технологии). Настоящие квантовые узлы — quantum_tech и quantum_teleport.
      return (technologies['quantum_tech'] || technologies['quantum_teleport']) || false;

    case 'rare_event_reward':
      // Редкость определяется весом события (isRareEvent), награда — наличием
      // положительного эффекта. Считается в resolveEvent.
      return state.stats.rareEventRewards >= target;

    case 'survived_chain_reaction':
      return state.stats.chainReactionsSurvived >= target;

    case 'time_accelerator_used':
      return politics.activePolicies.includes('time_accelerator');

    case 'perfect_districts': {
      /*
       * «Идеальный район» — тот, чей бонус упёрся в потолок для своего типа
       * (см. isDistrictMaxed в core/math/districts.ts). Раньше здесь стоял `return false`.
       */
      const districts = detectDistricts(getBuildingsWithCoordinates(state.buildings, grid.tiles));
      return districts.filter(isDistrictMaxed).length >= target;
    }

    case 'successful_caravans':
      // Считается в тике при доставке каравана (status -> 'delivered').
      return state.stats.caravansDelivered >= target;

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
