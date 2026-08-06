/**
 * ЭНЕРГОБАЛАНС — подсистема тика как чистая функция (bigplan.md, пункт 22).
 *
 * Считает три числа: сколько энергии база вырабатывает, сколько потребляет и с какой
 * эффективностью в итоге работает всё производство. Четвёртое, `energyEfficiency`, —
 * самое важное: это множитель, на который дальше умножается ВЫПУСК каждого здания.
 *
 * ЗАЧЕМ ВЫНОСИЛОСЬ. Внутри тика это было ~150 строк между сканом сетки и главным циклом
 * производства, и трогать их было страшно именно потому, что ошибка здесь не падает и не
 * логируется — она просто делает всю базу медленнее на несколько процентов. Теперь у
 * блока есть имя, границы и тесты на каждый случай развилки.
 *
 * ПОЧЕМУ ДЕФИЦИТ НЕ ПРОСТО «ПРОИЗВОДСТВО / ПОТРЕБЛЕНИЕ»
 * Энергия копится в буфере базы, поэтому кратковременный дефицит покрывается запасом и
 * не должен резать производство вовсе. Отсюда три исхода вместо одного:
 *   1. запаса хватает на весь тик         -> эффективность 1;
 *   2. запас есть, но не покрывает        -> (производство·dt + запас) / (потребление·dt);
 *   3. запаса нет                         -> производство / потребление.
 * Разница между 2 и 3 не косметическая: без учёта запаса база с полным аккумулятором
 * проседала бы ровно так же, как база с пустым.
 *
 * МНОЖИТЕЛИ ПРИМЕНЯЮТСЯ К ИТОГАМ, А НЕ В ЦИКЛЕ. Бонусы исследований и политик умножаются
 * один раз на готовые суммы. Это не только дешевле — это единственная точка, где обе
 * величины уже окончательны, но ещё никем не потрачены. Раскидать их по четырём местам
 * накопления значило бы гарантировать, что однажды одно из них забудут.
 */

import type Decimal from 'break_eternity.js';
import { D } from '../math/format';
import type { Building } from '../gameTypes';
import { getEvolutionMultiplier } from '../constants/buildingEvolutions';

export interface EnergyBalanceInput {
  /** Здания с посчитанным множителем близости — те же, что идут в производство. */
  buildings: readonly Building[];
  /** id здания → ключи клеток, где оно стоит (результат скана сетки). */
  tilesByBuildingId: Map<string, string[]>;
  /**
   * Остановленные клетки: выключенные игроком или правилом и строящиеся.
   * ЕДИНСТВЕННЫЙ источник правды об остановке (bigplan 42).
   */
  tileDisabled: Record<string, boolean>;
  tileLevels: Record<string, number>;
  tileEvolutionLevels: Record<string, number>;
  /** Здания, заглушенные политикой: не потребляют и не вырабатывают. */
  autoStoppedBuildingIds: Set<string> | null;
  /** Множители выпуска по id здания от политик. */
  buildingTypeMultipliers: Record<string, number>;
  /** Идёт ли волна: боевые здания потребляют энергию только в бою. */
  waveActive: boolean;
  /** Множитель расхода от повторяемых исследований. */
  repeatableEnergyEfficiency: number;
  /** Множители расхода и выработки от политик. */
  policyEnergyConsumption: number;
  policyEnergyProduction: number;
  /** Отдельный множитель расхода из спецэффектов политик. */
  specialConsumption: number;
  /** Доля прощаемой недостачи при дефиците: 0.5 — половина провала. */
  energyDeficitRelief: number;
  /** Сколько энергии уже лежит в буфере базы. */
  storedEnergy: Decimal;
  /** Длительность тика с учётом ускорений — тем же значением списывается энергия. */
  dtFacilities: number;
}

export interface EnergyBalance {
  production: Decimal;
  consumption: Decimal;
  /** 0..1 — множитель, на который умножается выпуск всех зданий. */
  efficiency: number;
}

const ZERO = D(0);

/**
 * Работает ли клетка: не остановлена и не занята стройкой.
 *
 * Флаг остановки ОДИН — `tileDisabled` (bigplan 42). Рядом проверялось ещё и
 * `tileSettings.enabled`, но это был второй источник правды: кнопка «ОТКЛЮЧИТЬ» в инспекторе
 * писала только в `tileDisabled`, и здесь баланс расходился с тем, что видел игрок.
 */
function tileActive(key: string, tileDisabled: Record<string, boolean>): boolean {
  return !tileDisabled[key];
}

export function computeEnergyBalance(input: EnergyBalanceInput): EnergyBalance {
  const {
    buildings,
    tilesByBuildingId,
    tileDisabled,
    tileLevels,
    tileEvolutionLevels,
    autoStoppedBuildingIds,
    buildingTypeMultipliers,
    waveActive,
  } = input;

  let production = ZERO;
  let consumption = ZERO;

  for (const b of buildings) {
    if (b.count <= 0) continue;
    // Заглушенное политикой здание ничего не потребляет — не должно и висеть в итогах.
    if (autoStoppedBuildingIds?.has(b.id)) continue;

    const placedKeys = tilesByBuildingId.get(b.id);
    if (!placedKeys || placedKeys.length === 0) continue;

    /*
     * Тот же множитель по id здания, что применяется к выпуску ниже по тику: иначе
     * энергобаланс считался бы по «непрокачанной» станции и резал бы производство
     * мнимым дефицитом.
     */
    const policyBuildingMult = buildingTypeMultipliers[b.id] ?? 1;

    for (const key of placedKeys) {
      if (!tileActive(key, tileDisabled)) continue;

      const buildingLevel = tileLevels[key] || 1;
      const evolutionLevel = tileEvolutionLevels[key] || 0;
      const evolutionMult = evolutionLevel > 0 ? getEvolutionMultiplier(b.id, evolutionLevel) : 1;

      if (b.production?.energy) {
        production = production.add(
          D(b.production.energy).mul(buildingLevel).mul(evolutionMult).mul(policyBuildingMult),
        );
      }

      // Пассивный расход — по уровню здания.
      if (b.energyConsumption) {
        consumption = consumption.add(D(b.energyConsumption).mul(buildingLevel));
      }

      // Активный расход объявляется отдельным полем и суммируется поверх пассивного.
      if (b.consumption?.energy) {
        consumption = consumption.add(D(b.consumption.energy).mul(buildingLevel));
      }
    }
  }

  // Боевые здания едят энергию только пока идёт волна.
  if (waveActive) {
    for (const b of buildings) {
      if (b.count <= 0) continue;
      const placedKeys = tilesByBuildingId.get(b.id);
      if (!placedKeys || placedKeys.length === 0) continue;

      let activePlaced = 0;
      for (const key of placedKeys) {
        if (tileActive(key, tileDisabled)) activePlaced++;
      }
      if (activePlaced === 0) continue;

      if (b.combat?.energyPerSecond) {
        consumption = consumption.add(D(b.combat.energyPerSecond).mul(activePlaced));
      }
      if (b.defense?.energyPerSecond) {
        consumption = consumption.add(D(b.defense.energyPerSecond).mul(activePlaced));
      }
    }
  }

  // Множители — на готовые итоги, см. шапку модуля.
  consumption = consumption.mul(input.repeatableEnergyEfficiency);
  consumption = consumption.mul(input.policyEnergyConsumption);
  production = production.mul(input.policyEnergyProduction);
  if (input.specialConsumption !== 1) {
    consumption = consumption.mul(input.specialConsumption);
  }

  return {
    production,
    consumption,
    efficiency: computeEfficiency(production, consumption, input),
  };
}

/**
 * Эффективность работы базы при текущем балансе.
 *
 * Вынесена отдельно, потому что это самая содержательная часть: три исхода дефицита и
 * поправка на «снижение потерь». Энергия здесь НЕ списывается — списание идёт дальше, в
 * цикле по зданиям, тем же `dtFacilities`.
 */
function computeEfficiency(
  production: Decimal,
  consumption: Decimal,
  input: Pick<EnergyBalanceInput, 'storedEnergy' | 'dtFacilities' | 'energyDeficitRelief'>,
): number {
  const { storedEnergy, dtFacilities, energyDeficitRelief } = input;

  let efficiency = 1.0;

  if (consumption.gt(production)) {
    const deficitForTick = consumption.sub(production).mul(dtFacilities);

    if (storedEnergy.gte(deficitForTick)) {
      // Запаса хватает на весь тик — работаем на полную, энергия спишется ниже.
      efficiency = 1.0;
    } else if (storedEnergy.gt(0)) {
      // Запас есть, но неполный: считаем долю покрытой потребности.
      const available = production.mul(dtFacilities).add(storedEnergy);
      const needed = consumption.mul(dtFacilities);
      efficiency = clamp01(Number(available.div(needed).toString()));
    } else if (production.gt(0)) {
      // Запаса нет — живём ровно на том, что вырабатываем.
      efficiency = clamp01(Number(production.div(consumption).toString()));
    } else {
      efficiency = 0;
    }
  }

  /*
   * «Снижение потерь энергии» (specials.energyDeficitRelief). Единственная настоящая
   * потеря энергии в игре — просадка всего производства при дефиците: сеть бинарная,
   * здание либо запитано, либо нет. Прощаем указанную долю недостачи.
   */
  if (energyDeficitRelief > 0 && efficiency < 1) {
    efficiency = efficiency + (1 - efficiency) * energyDeficitRelief;
  }

  return efficiency;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
