import type { Coord, Game, PlayerView, Unit, UnitOrder } from '../types.js';
import { nextRandom15 } from '../rng.js';
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
export function classicDirectionIndex(unit: Unit): number {
  if (unit.order.kind === 'go-direction') {
    const { direction } = unit.order;
    const idx = directions.findIndex(d => d.x === direction.x && d.y === direction.y);
    if (idx >= 0) return idx;
  }
  return CLASSIC_ORDER_NONE_DIRECTION_INDEX;
}

/** Parity-based rotation bias from ALG-AI-001 scratch `8ADC` / `8ADE`. */
export function classicRandomRotationBias(unit: Unit): number {
  let parity = 0;
  for (const ch of unit.id) parity ^= ch.charCodeAt(0);
  return parity % 2 === 0 ? 1 : -1;
}

/** ALG-AI-001 order 2 (Random): `rand%16==0` rotates compass index, else keep bearing. */
export function classicRandomOrderTick(game: Game, unit: Unit): { game: Game; directionIndex: number } {
  const draw = nextRandom15(game.rng);
  let index = classicDirectionIndex(unit);
  if (draw.value % 16 === 0) {
    index = (index + classicRandomRotationBias(unit) + directions.length) % directions.length;
  }
  return { game: { ...game, rng: draw.next }, directionIndex: index };
}

export function classicStandingOrderTick(order: UnitOrder): ClassicStandingOrderTick | null {
  if (order.kind === 'none') return { kind: 'bear', direction: classicNoneOrderBearing() };
  if (order.kind === 'random') return null;
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