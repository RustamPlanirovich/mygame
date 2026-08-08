/**
 * ПРОИЗВОДСТВО НА ОРБИТАЛЬНОЙ ПЛАТФОРМЕ (bigplan.md, пункт 45).
 *
 * ЧТО БЫЛО СЛОМАНО. Цикл платформ в `tick` прибавлял `building.production` и НИЧЕГО больше:
 * ни `consumption`, ни `energyConsumption`, ни уровня клетки. То есть на платформе
 * «Компьютерная Фабрика» выдавала компьютеры без микросхем, дисплеев, батарей и без единого
 * ватта, а справка при этом обещала, что у платформы «своя энергосеть» и «апгрейд уровня
 * клетки работает так же, как на базе». Игрок платил за апгрейд ресурсами — и не получал
 * ничего, зато любой перерабатывающий завод превращался в бесконечный источник материи.
 *
 * КАК СТАЛО. Платформа — это маленькая база со своим складом:
 *
 *   • энергия считается тем же `computeEnergyBalance`, что и на базе, только по сетке
 *     платформы и с её собственным запасом энергии на складе;
 *   • входы берутся со склада ПЛАТФОРМЫ (у неё нет ни логистики по клеткам, ни поставок
 *     с базы — за это отвечают караваны);
 *   • выпуск умножается на уровень клетки, апгрейд «Добыча» и бонус галактики.
 *
 * ПОЧЕМУ ВХОДЫ СГОРАЮТ ЦЕЛИКОМ ПРИ ДЕФИЦИТЕ ЭНЕРГИИ. Здесь сознательно повторено поведение
 * главной базы: `ratio` режет и вход, и выход, а энергоэффективность — только выход. Логики
 * в этом мало, но расхождение между базой и платформой обошлось бы игроку дороже, чем
 * знакомая несправедливость: одно правило на две сетки.
 *
 * ПОЧЕМУ ВОЗВРАЩАЮТСЯ СТАТУСЫ. Молча стоящее здание неотличимо от сломанной игры — именно
 * с этого начался разбор. Модуль считает, по какой причине встала каждая клетка, а панель
 * платформ показывает это словами и подсказывает, что построить.
 */

import type Decimal from 'break_eternity.js';
import { D } from '../math/format';
import type {
  Building,
  ResourceState,
  ResourceType,
  DepositType,
  PlatformStatus,
  PlatformTileState,
} from '../gameTypes';
import { computeEnergyBalance } from './energyBalance';
import { requiredDepositForBuilding } from './deposits';

// `PlatformStatus` и `PlatformTileState` объявлены в gameTypes рядом с SpacePlatform: их
// носит платформа, а не этот модуль, и импорт оттуда сюда не создаёт цикла.
export type { PlatformStatus, PlatformTileState };

export interface PlatformTickInput {
  /** Клетки платформы: `"x,y"` → id здания. */
  tiles: Record<string, string>;
  /** Идущие работы: такие клетки не производят и не потребляют. */
  tileJobs?: Record<string, unknown>;
  tileLevels?: Record<string, number>;
  deposits?: Record<string, DepositType>;
  /** Каталог зданий по id (общий для базы и платформ). */
  buildingsById: Map<string, Building>;
  /** Склад платформы. Не мутируется. */
  resources: Record<ResourceType, ResourceState>;
  /** Длительность шага в секундах. */
  dt: number;
  /** Множитель апгрейда «Добыча»: 1 + 0.5 за уровень. */
  miningBonus: number;
  /** Бонусы галактики по ресурсам. */
  galaxyBonuses?: Partial<Record<ResourceType, number>>;
  /** Идёт ли бой у платформы: турели и щиты едят энергию только тогда. */
  underAttack: boolean;
}

export interface PlatformTickResult {
  /** Новый склад платформы (новый объект, исходный не тронут). */
  resources: Record<ResourceType, ResourceState>;
  status: PlatformStatus;
}

const ZERO = D(0);

/**
 * Пустой статус — для платформы без единого здания. Отдельная функция, потому что нужна и
 * в UI: панель показывает «сетка пуста», а не мигающие нули из предыдущего тика.
 */
export function emptyPlatformStatus(): PlatformStatus {
  return {
    energyProduction: 0,
    energyConsumption: 0,
    energyEfficiency: 1,
    working: 0,
    building: 0,
    noPower: 0,
    noInput: 0,
    noDeposit: 0,
    storageFull: 0,
    support: 0,
    missingInputs: [],
    tileStates: {},
  };
}

export function computePlatformTick(input: PlatformTickInput): PlatformTickResult {
  const {
    tiles,
    tileJobs,
    tileLevels,
    deposits,
    buildingsById,
    resources,
    dt,
    miningBonus,
    galaxyBonuses,
    underAttack,
  } = input;

  const status = emptyPlatformStatus();
  const tileStates = status.tileStates;
  const tileKeys = Object.keys(tiles);
  if (tileKeys.length === 0 || dt <= 0) {
    return { resources, status };
  }

  /*
   * Индекс «здание → клетки» строится по клеткам БЕЗ работ: строящееся здание не должно
   * ни есть энергию, ни считаться в балансе. Ровно так же поступает скан сетки базы,
   * который кладёт строящиеся клетки в `tileDisabled`.
   */
  const tilesByBuildingId = new Map<string, string[]>();
  const placedBuildings: Building[] = [];
  const placedCounts = new Map<string, number>();

  for (const key of tileKeys) {
    const id = tiles[key];
    if (tileJobs?.[key]) {
      tileStates[key] = 'building';
      status.building++;
      continue;
    }
    const list = tilesByBuildingId.get(id);
    if (list) list.push(key);
    else tilesByBuildingId.set(id, [key]);
    placedCounts.set(id, (placedCounts.get(id) ?? 0) + 1);
  }

  for (const [id, count] of placedCounts) {
    const def = buildingsById.get(id);
    // Здание из чужой версии сейва: не считаем его ни в балансе, ни в выпуске.
    if (def) placedBuildings.push({ ...def, count });
  }

  const energyStock = resources.energy?.amount ?? ZERO;

  /*
   * Энергобаланс — тот же модуль, что у базы. Множители политик и исследований сюда не
   * заходят: платформа стоит в другой галактике, и распространять на неё земные политики
   * значило бы придумать правило, которого нет ни в одном другом месте кода.
   */
  const balance = computeEnergyBalance({
    buildings: placedBuildings,
    tilesByBuildingId,
    tileDisabled: {},
    tileLevels: tileLevels ?? {},
    tileEvolutionLevels: {},
    autoStoppedBuildingIds: null,
    buildingTypeMultipliers: {},
    waveActive: underAttack,
    repeatableEnergyEfficiency: 1,
    policyEnergyConsumption: 1,
    policyEnergyProduction: 1,
    specialConsumption: 1,
    energyDeficitRelief: 0,
    storedEnergy: energyStock,
    dtFacilities: dt,
  });

  status.energyProduction = Number(balance.production.toString());
  status.energyConsumption = Number(balance.consumption.toString());
  status.energyEfficiency = balance.efficiency;

  // Работаем на копии склада: тик не имеет права трогать состояние до возврата.
  const next: Record<ResourceType, ResourceState> = { ...resources };
  const produced: Partial<Record<ResourceType, Decimal>> = {};
  const missing = new Set<ResourceType>();

  const amountOf = (r: ResourceType): Decimal => next[r]?.amount ?? ZERO;
  const maxOf = (r: ResourceType): Decimal => next[r]?.max ?? ZERO;
  const setAmount = (r: ResourceType, value: Decimal) => {
    const cur = next[r];
    if (!cur) return;
    next[r] = { ...cur, amount: value };
  };

  for (const [buildingId, keys] of tilesByBuildingId) {
    const def = buildingsById.get(buildingId);
    if (!def) continue;

    const hasOutput = def.production && Object.keys(def.production).length > 0;

    for (const key of keys) {
      if (!hasOutput) {
        tileStates[key] = 'support';
        status.support++;
        continue;
      }

      const requiredDeposit = requiredDepositForBuilding(buildingId);
      if (requiredDeposit && deposits?.[key] !== requiredDeposit) {
        tileStates[key] = 'no_deposit';
        status.noDeposit++;
        continue;
      }

      const level = tileLevels?.[key] || 1;

      /*
       * Доля мощности по входам. Энергия здесь пропускается: она уже учтена в балансе
       * и списывается один раз ниже, а не по разу на каждую клетку.
       */
      let ratio = D(1);
      if (def.consumption) {
        for (const [resType, perSecond] of Object.entries(def.consumption)) {
          const rType = resType as ResourceType;
          if (rType === 'energy') continue;
          const need = D(perSecond).mul(dt).mul(level);
          if (need.lte(0)) continue;
          const available = amountOf(rType);
          if (available.lte(0)) {
            ratio = ZERO;
            missing.add(rType);
            break;
          }
          if (available.lt(need)) missing.add(rType);
          ratio = ratio.min(available.div(need));
        }
        ratio = ratio.max(ZERO).min(D(1));
      }

      if (ratio.lte(0)) {
        tileStates[key] = 'no_input';
        status.noInput++;
        continue;
      }

      // Энергии нет вовсе — выпуск нулевой у всего, кроме самих электростанций.
      const producesEnergy = Boolean(def.production?.energy);
      if (balance.efficiency <= 0 && !producesEnergy) {
        tileStates[key] = 'no_power';
        status.noPower++;
        continue;
      }

      // Списание входов — по ratio, как на базе (см. шапку модуля).
      if (def.consumption) {
        for (const [resType, perSecond] of Object.entries(def.consumption)) {
          const rType = resType as ResourceType;
          if (rType === 'energy') continue;
          const consume = D(perSecond).mul(dt).mul(level).mul(ratio);
          if (consume.lte(0)) continue;
          setAmount(rType, amountOf(rType).sub(consume).max(ZERO));
        }
      }

      let anyRoom = false;
      for (const [resType, perSecond] of Object.entries(def.production)) {
        const rType = resType as ResourceType;
        const isEnergy = rType === 'energy';
        let amount = D(perSecond).mul(dt).mul(level).mul(ratio).mul(miningBonus);
        // Энергию энергоэффективность не режет — иначе дефицит гасил бы сам себя (см. energyBalance).
        if (!isEnergy && balance.efficiency < 1) amount = amount.mul(balance.efficiency);
        const galaxyBonus = galaxyBonuses?.[rType];
        if (galaxyBonus && galaxyBonus !== 1) amount = amount.mul(galaxyBonus);
        if (amount.lte(0)) continue;

        /*
         * Энергия не кладётся в склад здесь: её приход и расход сводятся ОДИН раз после
         * цикла, из посчитанного баланса. Иначе она попала бы в запас дважды.
         */
        if (isEnergy) {
          anyRoom = true;
          continue;
        }

        const room = maxOf(rType).sub(amountOf(rType)).max(ZERO);
        if (room.lte(0)) continue;
        anyRoom = true;
        const actual = amount.min(room);
        setAmount(rType, amountOf(rType).add(actual));
        produced[rType] = (produced[rType] ?? ZERO).add(actual);
      }

      if (!anyRoom) {
        tileStates[key] = 'storage_full';
        status.storageFull++;
      } else {
        tileStates[key] = 'working';
        status.working++;
      }
    }
  }

  /*
   * Сведение энергии. Выработка идёт в запас целиком, расход — по фактической
   * эффективности: при дефиците здания работают вполсилы и столько же и потребляют.
   */
  if (next.energy) {
    const producedEnergy = balance.production.mul(dt);
    const consumedEnergy = balance.consumption.mul(dt).mul(balance.efficiency);
    const nextEnergy = next.energy.amount
      .add(producedEnergy)
      .sub(consumedEnergy)
      .max(ZERO)
      .min(next.energy.max);
    next.energy = {
      ...next.energy,
      amount: nextEnergy,
      production: balance.production.sub(balance.consumption),
    };
  }

  // Ставки выпуска для UI: то, что реально легло на склад, а не паспортное значение.
  for (const rType of Object.keys(produced) as ResourceType[]) {
    const cur = next[rType];
    if (!cur) continue;
    next[rType] = { ...cur, production: produced[rType]!.div(dt) };
  }

  status.missingInputs = [...missing];

  return { resources: next, status };
}
