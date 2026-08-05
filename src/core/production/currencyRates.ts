/**
 * Research-point and influence production rates.
 *
 * These rates were hardcoded inline inside gameStore's tick() while CurrencyPanel computed its
 * own, completely different, number from `building.production.researchPoints` — a field that does
 * not exist on the Building type. The filter therefore always matched nothing and the panel's
 * tooltip permanently read "+0/с" no matter how many research centres the player had built.
 *
 * The tick counts PLACED TILES (`grid.tiles`), not the building catalogue (`state.buildings`,
 * whose `.count` is a shop counter). Anything reading the catalogue to infer output is wrong.
 *
 * One module, one set of numbers, both call sites.
 */

import type Decimal from 'break_eternity.js';
import { D } from '../math/format';

/** Research points per second, per PLACED building of this id. */
export const RP_PER_SECOND: Readonly<Record<string, number>> = {
  research_center_mk1: 0.5,
  supercomputer_lab_mk1: 2.0,
  quantum_lab_mk1: 10.0,
};

/** Influence per second, per PLACED building of this id. */
export const INFLUENCE_PER_SECOND: Readonly<Record<string, number>> = {
  political_center_mk1: 0.2,
};

/** Credits per second, per PLACED building of this id. */
export const CREDITS_PER_SECOND: Readonly<Record<string, number>> = {
  bitcoin_farm_mk1: 5.0,
};

function sumPlaced(
  tiles: Readonly<Record<string, string | undefined>>,
  rates: Readonly<Record<string, number>>,
): Decimal {
  // Counting per rate-bearing id is O(tiles) once, rather than O(tiles) per id as the tick used
  // to do with a separate Object.values(...).filter(...) pass for each building.
  const counts: Record<string, number> = {};
  for (const id of Object.values(tiles)) {
    if (id && rates[id] !== undefined) counts[id] = (counts[id] ?? 0) + 1;
  }

  let total = D(0);
  for (const [id, count] of Object.entries(counts)) {
    total = total.add(D(rates[id]).mul(count));
  }
  return total;
}

/** Base research points/second from placed buildings, before efficiency and multipliers. */
export const baseResearchPointsPerSecond = (
  tiles: Readonly<Record<string, string | undefined>>,
): Decimal => sumPlaced(tiles, RP_PER_SECOND);

/** Base influence/second from placed buildings, before efficiency. */
export const baseInfluencePerSecond = (
  tiles: Readonly<Record<string, string | undefined>>,
): Decimal => sumPlaced(tiles, INFLUENCE_PER_SECOND);

/** Base credits/second from placed buildings, before efficiency. */
export const baseCreditsPerSecond = (
  tiles: Readonly<Record<string, string | undefined>>,
): Decimal => sumPlaced(tiles, CREDITS_PER_SECOND);
