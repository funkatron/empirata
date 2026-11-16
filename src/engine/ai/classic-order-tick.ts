import type { Coord, PlayerView, Unit, UnitOrder } from '../types.js';
import { STATS } from '../units.js';
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

/** ALG-AI-001 `0x3D10`: ships at or below half HP seek a friendly port (empty transports only). */
export function classicDamagedShipSeeksPort(unit: Unit, embarkedCargo: number): boolean {
  if (unit.kind === 'army' || unit.kind === 'fighter') return false;
  if (unit.order.kind === 'load-ship') return false;
  const maxHp = STATS[unit.kind].hitPoints;
  if (unit.damage * 2 < maxHp) return false;
  if (unit.kind === 'transport' && embarkedCargo > 0) return false;
  return true;
}

/** ALG-AI-001 order 1 (Sentry): engage an adjacent fresh contact when possible. */
export function classicSentryEngageTarget(view: PlayerView, unit: Unit): Coord | null {
  if (unit.order.kind !== 'sentry') return null;
  const adjacent = view.enemies
    .filter(
      e =>
        !e.stale &&
        Math.max(Math.abs(e.position.x - unit.position.x), Math.abs(e.position.y - unit.position.y)) === 1,
    )
    .sort((a, b) => a.id.localeCompare(b.id));
  return adjacent[0]?.position ?? null;
}