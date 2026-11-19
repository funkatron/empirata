import type { Coord, Game, Unit } from '../types.js';
import type { DosComputerGrade } from './classic-grades.js';
import { classicTilePassableChart } from './classic-passability.js';
import { classicRouteStep, classicUnitReachableGoal } from './classic-path.js';
import { getPlayerView } from '../knowledge.js';
import { directions, playable } from '../world.js';

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
 * ALG-AI-001 `1D09:03C2` / `1D09:0DF56`: neighbors of the escort target in fixed eight-chart-direction
 * order (same as `directions` / compass 0…7). Each must be chart-passable and reachable (`1A9E:006C`).
 * **First hit** is `[0]` — not a lexicographic heuristic. Twenty-angle outer ring: pending DOS trace (J1: distance 1 only).
 */
export function classicEscortStationCandidates(
  game: Game,
  unit: Unit,
  target: Unit,
  grade: DosComputerGrade,
): Coord[] {
  const view = getPlayerView(game, unit.owner);
  const stations: Coord[] = [];
  for (const d of directions) {
    const p = { x: target.position.x + d.x, y: target.position.y + d.y };
    if (!playable(game, p)) continue;
    if (!classicTilePassableChart(game, view, unit.owner, unit, p, grade)) continue;
    if (!classicUnitReachableGoal(game, unit, p, grade)) continue;
    stations.push(p);
  }
  return stations;
}

export function classicEscortStationGoal(
  game: Game,
  unit: Unit,
  target: Unit,
  grade: DosComputerGrade,
): Coord | null {
  return classicEscortStationCandidates(game, unit, target, grade)[0] ?? null;
}

/**
 * ALG-AI-001 `0x4600`: within Chebyshev 3 of the escort target, path goal follows the target’s standing order
 * (or the `1D09:03C2` station tile when the target is holding).
 */
export function classicEscortCloseRangeGoal(game: Game, unit: Unit, target: Unit, grade: DosComputerGrade): Coord | null {
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
  return classicEscortStationGoal(game, unit, target, grade);
}

/** ALG-AI-001 escort: seek a legal tile within one step of the escort target. */
export function classicEscortStep(game: Game, unit: Unit, grade: DosComputerGrade): Coord | null {
  const order = unit.order;
  if (order.kind !== 'escort') return null;
  const target = game.units.find(t => t.id === order.targetId && t.owner === unit.owner && !t.aboard);
  if (!target) return null;
  if (chebyshev(unit.position, target.position) <= 1) return null;
  const closeGoal = classicEscortCloseRangeGoal(game, unit, target, grade);
  if (closeGoal) {
    const closeStep = classicRouteStep(game, unit, closeGoal, grade);
    if (closeStep) return closeStep;
  }
  for (const station of classicEscortStationCandidates(game, unit, target, grade)) {
    const step = classicRouteStep(game, unit, station, grade);
    if (step) return step;
  }
  return null;
}