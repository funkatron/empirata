import type { Coord, FactionId, Game, PlayerView, Unit } from '../types.js';
import type { UnitOrder } from '../types.js';
import { classicKnownHostileCityTiles } from './classic-move.js';
import { classicFighterMoveToExhausted } from './classic-order-tick.js';

function chebyshev(a: Coord, b: Coord): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/**
 * ALG-AI-001 `0x4462` staging: assign a charted move-to before random bearing when idle.
 * `view` may be a getter so callers skip building a PlayerView for units that never need it
 * (only idle armies read it).
 */
export function classicTacticalReissueOrder(
  game: Game,
  view: PlayerView | (() => PlayerView),
  faction: FactionId,
  unit: Unit,
): UnitOrder | null {
  if (unit.aboard) return null;
  if (unit.order.kind === 'move-to' || unit.order.kind === 'go-home' || unit.order.kind === 'escort') {
    return null;
  }
  if (unit.order.kind === 'patrol' || unit.order.kind === 'load-ship' || unit.order.kind === 'sentry') {
    return null;
  }
  if (unit.kind === 'fighter' && classicFighterMoveToExhausted(unit)) {
    return { kind: 'go-home' };
  }
  if (unit.kind !== 'army') return null;
  const targets = classicKnownHostileCityTiles(typeof view === 'function' ? view() : view);
  if (!targets.length) return null;
  const unitPos = unit.position;
  targets.sort(
    (a, b) => chebyshev(a, unitPos) - chebyshev(b, unitPos) || a.x - b.x || a.y - b.y,
  );
  const goal = targets[0]!;
  if (chebyshev(goal, unitPos) <= 1) return null;
  return { kind: 'move-to', destination: { ...goal } };
}