import type { Coord, Game, PlayerView, Unit, UnitOrder } from '../types.js';
import { nextRandom15 } from '../rng.js';
import { STATS } from '../units.js';
import { directions } from '../world.js';

/**
 * DOS direction index → engine `directions` index [D].
 * DOS table `2E32:6300` (linear `0x34620`) holds location deltas in the order
 * E, NE, N, NW, W, SW, S, SE — a counter-clockwise ring. Engine `directions` is
 * row-major (NW, N, NE, W, E, SW, S, SE), so every DOS `±1` rotation must go
 * through this map. See `agents/alg-ai-001-compass-order-trace-2026-11-24.md`.
 */
export const CLASSIC_DOS_DIRECTION_ORDER: ReadonlyArray<number> = Object.freeze([4, 2, 1, 0, 3, 5, 6, 7]);

const ENGINE_TO_DOS_DIRECTION: ReadonlyArray<number> = Object.freeze(
  directions.map((_, engineIndex) => CLASSIC_DOS_DIRECTION_ORDER.indexOf(engineIndex)),
);

/** Engine `directions` index → DOS ring index. */
export function classicDosDirectionIndex(engineIndex: number): number {
  const dos = ENGINE_TO_DOS_DIRECTION[engineIndex];
  if (dos === undefined || dos < 0) throw new Error(`Invalid direction index ${engineIndex}`);
  return dos;
}

/** Rotate an engine direction index by `steps` around the DOS ring (`+1` = counter-clockwise). */
export function classicRotateDirectionIndex(engineIndex: number, steps: number): number {
  const ring = CLASSIC_DOS_DIRECTION_ORDER.length;
  const dos = (((classicDosDirectionIndex(engineIndex) + steps) % ring) + ring) % ring;
  return CLASSIC_DOS_DIRECTION_ORDER[dos]!;
}

/**
 * Legacy fallback bearing for `classicDirectionIndex`. DOS order 0 has **no** bearing
 * (`0x3E00` returns status 1; `0x44EA` returns −1). The classic executor handles None via
 * `classicIdleNoneStep`; see `agents/alg-ai-001-none-order-trace-2026-11-24.md`.
 */
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

/** Rotate preferred compass when every neighbor is blocked (`0x4C52` exhaust). */
export function classicAdvanceBearingWhenBlocked(unit: Unit, preferredIndex: number): number {
  return classicRotateDirectionIndex(preferredIndex, classicRandomRotationBias(unit));
}

/**
 * ALG-AI-001 `03BF:0C46` (linear `0x4836`) [D]: wander heading for idle units.
 * `r = rand() % 24`; when `r >= 8`, `r = (r & 7) | 1`. `r` is a DOS ring index, so
 * diagonals (odd DOS indices) are about five times as likely as each orthogonal.
 */
export function classicWanderHeadingRoll(game: Game): { game: Game; directionIndex: number } {
  const draw = nextRandom15(game.rng);
  let dos = draw.value % 24;
  if (dos >= 8) dos = (dos & 7) | 1;
  return { game: { ...game, rng: draw.next }, directionIndex: CLASSIC_DOS_DIRECTION_ORDER[dos]! };
}

/** ALG-AI-001 order 2 (Random): `rand%16==0` rotates compass index, else keep bearing. */
export function classicRandomOrderTick(game: Game, unit: Unit): { game: Game; directionIndex: number } {
  const draw = nextRandom15(game.rng);
  let index = classicDirectionIndex(unit);
  if (draw.value % 16 === 0) {
    index = classicRotateDirectionIndex(index, classicRandomRotationBias(unit));
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
/** ALG-AI-001 Move-To fighter fuel gate (`0x3F64`). */
export function classicFighterMoveToExhausted(unit: Unit): boolean {
  if (unit.kind !== 'fighter' || unit.aboard) return false;
  if (unit.order.kind !== 'move-to') return false;
  const threshold = unit.aboard ? 14 : 10;
  return (unit.fuel ?? 0) <= threshold;
}

/** ALG-AI-001 `0x3D76`: empty transport clears non-load tactical orders. */
export function classicSanitizeTransportOrder(unit: Unit, cargo: number): import('../types.js').UnitOrder | null {
  if (unit.kind !== 'transport' && unit.kind !== 'carrier') return null;
  if (cargo > 0) return null;
  const order = unit.order;
  if (order.kind === 'load-ship' || order.kind === 'none' || order.kind === 'skip') return null;
  return { kind: 'none' };
}

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