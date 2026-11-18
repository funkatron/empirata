import type { Coord, Game, Unit } from '../types.js';
import type { DosComputerGrade } from './classic-grades.js';
import { classicRouteStep } from './classic-path.js';
import { directions } from '../world.js';

function chebyshev(a: Coord, b: Coord): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

function nearestFriendlyCityPosition(game: Game, owner: Unit['owner'], near: Coord): Coord | null {
  const homes = game.cities
    .filter(c => c.owner === owner)
    .sort(
      (a, b) =>
        chebyshev(a.position, near) - chebyshev(b.position, near) || a.id.localeCompare(b.id),
    );
  return homes[0]?.position ?? null;
}

/**
 * ALG-AI-001 `0x4600`: within Chebyshev 3 of the escort target, path goal follows the target’s standing order
 * (or the closest station tile beside the target when the target is holding).
 */
export function classicEscortCloseRangeGoal(game: Game, unit: Unit, target: Unit): Coord | null {
  if (chebyshev(unit.position, target.position) >= 4) return null;
  const order = target.order;
  if (order.kind === 'move-to') return { ...order.destination };
  if (order.kind === 'go-home') {
    const home = nearestFriendlyCityPosition(game, unit.owner, target.position);
    return home ? { ...home } : null;
  }
  if (order.kind === 'go-direction') {
    return { x: target.position.x + order.direction.x, y: target.position.y + order.direction.y };
  }
  if (order.kind === 'patrol') return order.outbound ? { ...order.to } : { ...order.from };
  const stations = directions
    .map(d => ({ x: target.position.x + d.x, y: target.position.y + d.y }))
    .sort(
      (a, b) =>
        chebyshev(a, unit.position) - chebyshev(b, unit.position) || a.x - b.x || a.y - b.y,
    );
  return stations[0] ?? null;
}

/** ALG-AI-001 escort: seek a legal tile within one step of the escort target. */
export function classicEscortStep(game: Game, unit: Unit, grade: DosComputerGrade): Coord | null {
  const order = unit.order;
  if (order.kind !== 'escort') return null;
  const target = game.units.find(t => t.id === order.targetId && t.owner === unit.owner && !t.aboard);
  if (!target) return null;
  if (chebyshev(unit.position, target.position) <= 1) return null;
  const closeGoal = classicEscortCloseRangeGoal(game, unit, target);
  if (closeGoal) {
    const closeStep = classicRouteStep(game, unit, closeGoal, grade);
    if (closeStep) return closeStep;
  }
  const stations = directions
    .map(d => ({ x: target.position.x + d.x, y: target.position.y + d.y }))
    .sort(
      (a, b) =>
        chebyshev(a, unit.position) - chebyshev(b, unit.position) ||
        a.x - b.x ||
        a.y - b.y,
    );
  for (const station of stations) {
    const step = classicRouteStep(game, unit, station, grade);
    if (step) return step;
  }
  return null;
}