/**
 * СНОС ЗДАНИЙ, В ТОМ ЧИСЛЕ МАССОВЫЙ (bigplan.md, пункты 10 и 28).
 *
 * Раньше сноса пачкой не было вовсе: только `removeBuildingAt` на одну клетку. Наивное
 * решение — вызвать его N раз — означало бы N вызовов `set()` и N полных пересчётов
 * вместимости складов (`recomputeCaps`) на одно действие игрока. Поэтому расчёт вынесен в
 * чистую функцию: стор один раз считает план и один раз применяет его.
 *
 * Заодно это единственное место, где живут правила возврата, — их видно и можно проверить
 * тестом, а не выводить из тела экшена.
 */

import Decimal from 'break_eternity.js';
import type { Building, ResourceType } from '../gameTypes';
import type { TileJobs } from './construction';

/** Доля стоимости, возвращаемая при сносе. */
export const DEMOLITION_REFUND_RATE = 0.75;

export interface DemolitionPlan {
  /** Клетки, которые действительно будут снесены. */
  keys: string[];
  /** Сколько зданий каждого типа убрать из счётчика каталога. */
  countByBuilding: Record<string, number>;
  /** Сколько ресурсов вернуть (уже с учётом ставки возврата). */
  refund: Partial<Record<ResourceType, Decimal>>;
  /** Кредиты к возврату (за незавершённые улучшения на этих клетках). */
  refundCredits: Decimal;
  /** Клетки, которые пропущены, и почему — чтобы UI не врал «снесено N». */
  skipped: Array<{ key: string; reason: 'empty' | 'unknown-building' | 'base' }>;
}

/**
 * Что именно произойдёт при сносе набора клеток.
 *
 * Функция ничего не мутирует и не знает про стор — только считает.
 *
 * @param calculateCost стоимость постройки здания на его ТЕКУЩЕМ счётчике. Передаётся
 *        снаружи, потому что живёт в gameStore вместе с прогрессией цены.
 * @param baseKey ключ клетки базы: её снести нельзя, и молчать об этом нельзя.
 */
export function planDemolition(
  keys: string[],
  tiles: Record<string, string>,
  buildings: Building[],
  calculateCost: (building: Building) => Partial<Record<ResourceType, Decimal>>,
  options: { baseKey?: string; tileJobs?: TileJobs } = {},
): DemolitionPlan {
  const plan: DemolitionPlan = {
    keys: [],
    countByBuilding: {},
    refund: {},
    refundCredits: new Decimal(0),
    skipped: [],
  };

  const byId = new Map(buildings.map((b) => [b.id, b]));
  const seen = new Set<string>();

  for (const key of keys) {
    // Один и тот же ключ мог прийти дважды (рамка + Shift-клик) — считать его двумя
    // зданиями значит вернуть двойную стоимость.
    if (seen.has(key)) continue;
    seen.add(key);

    if (options.baseKey && key === options.baseKey) {
      plan.skipped.push({ key, reason: 'base' });
      continue;
    }

    const buildingId = tiles[key];
    if (!buildingId) {
      plan.skipped.push({ key, reason: 'empty' });
      continue;
    }

    const building = byId.get(buildingId);
    if (!building) {
      plan.skipped.push({ key, reason: 'unknown-building' });
      continue;
    }

    plan.keys.push(key);
    plan.countByBuilding[buildingId] = (plan.countByBuilding[buildingId] ?? 0) + 1;

    /*
     * Возврат считается от стоимости на ТЕКУЩЕМ счётчике здания, а не пересчитывается по
     * убывающему счётчику внутри пачки. Так снос десяти майнеров возвращает одинаково за
     * каждый — иначе порядок обхода клеток влиял бы на итог, что игрок воспринял бы как баг.
     */
    const cost = calculateCost(building);
    for (const [resType, amount] of Object.entries(cost)) {
      if (!amount) continue;
      const rType = resType as ResourceType;
      const add = amount.mul(DEMOLITION_REFUND_RATE);
      plan.refund[rType] = (plan.refund[rType] ?? new Decimal(0)).add(add);
    }

    /*
     * Незавершённая работа на клетке: возвращаем ПОЛНУЮ стоимость, как при отмене
     * (cancelTileJob), а не 75% — игрок ничего не успел получить.
     */
    const job = options.tileJobs?.[key];
    if (job) {
      for (const [resType, amount] of Object.entries(job.paidCost ?? {})) {
        const rType = resType as ResourceType;
        plan.refund[rType] = (plan.refund[rType] ?? new Decimal(0)).add(new Decimal(amount));
      }
      if (job.paidCredits) {
        plan.refundCredits = plan.refundCredits.add(new Decimal(job.paidCredits));
      }
    }
  }

  return plan;
}

/** Пустой ли план — стору незачем создавать новое состояние. */
export function isEmptyPlan(plan: DemolitionPlan): boolean {
  return plan.keys.length === 0;
}
