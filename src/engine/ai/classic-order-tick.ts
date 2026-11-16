import type { Coord, UnitOrder } from '../types.js';
import { directions } from '../world.js';

/** Recovered ALG-AI-001 dispatch row for DOS order 0 (None). */
export const CLASSIC_ORDER_NONE_DIRECTION_INDEX = 1;

export function classicNoneOrderBearing(): Readonly<Coord> {
  return directions[CLASSIC_ORDER_NONE_DIRECTION_INDEX]!;
}

export type ClassicStandingOrderTick =
  | { kind: 'bear'; direction: Readonly<Coord> }
  | { kind: 'hold' };

/** Maps Empirata standing orders to the first ALG-AI-001 tranche (none + sentry only). */
export function classicStandingOrderTick(order: UnitOrder): ClassicStandingOrderTick | null {
  if (order.kind === 'none') return { kind: 'bear', direction: classicNoneOrderBearing() };
  if (order.kind === 'sentry') return { kind: 'hold' };
  return null;
}