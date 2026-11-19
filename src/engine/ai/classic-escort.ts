import type { Coord, Game, Unit } from '../types.js';
import type { DosComputerGrade } from './classic-grades.js';
import { classicTilePassableChart } from './classic-passability.js';
import { classicRouteStep } from './classic-path.js';
import { getPlayerView } from '../knowledge.js';
import { cityAt, directions, playable, terrainAt } from '../world.js';

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

function escortAxisSign(delta: number): number {
  if (delta === 0) return 0;
  if (delta > 0) return 1;
  return -1;
}

function escortTargetBearing(target: Unit): Coord {
  const order = target.order;
  if (order.kind === 'go-direction') return { ...order.direction };
  if (order.kind === 'move-to') {
    const dx = order.destination.x - target.position.x;
    const dy = order.destination.y - target.position.y;
    return { x: escortAxisSign(dx), y: escortAxisSign(dy) };
  }
  if (order.kind === 'patrol') {
    const anchor = order.outbound ? order.to : order.from;
    const dx = anchor.x - target.position.x;
    const dy = anchor.y - target.position.y;
    return { x: escortAxisSign(dx), y: escortAxisSign(dy) };
  }
  return { x: 0, y: 0 };
}

function seaNeighborCount(game: Game, pos: Coord): number {
  return directions.filter(d => {
    const p = { x: pos.x + d.x, y: pos.y + d.y };
    return playable(game, p) && terrainAt(game, p) === 'sea';
  }).length;
}

/** Behind the target along its current bearing (negative dot with station offset). */
function stationBehindRank(target: Unit, station: Coord, bearing: Coord): number {
  if (bearing.x === 0 && bearing.y === 0) return 0;
  const dx = station.x - target.position.x;
  const dy = station.y - target.position.y;
  return -(dx * bearing.x + dy * bearing.y);
}

/**
 * ALG-AI-001 `1D09:03C2` stationing probe: chart-passable tiles adjacent to the escort target.
 * Candidate **ordering** below is **[T] Empirata heuristic** (2026-11-19 static `0x1D452` review); DOS uses
 * a 20-angle probe / eight-mask walk and **first reachable** hit, not this lexicographic sort ([D] intent only).
 */
export function classicEscortStationCandidates(
  game: Game,
  unit: Unit,
  target: Unit,
  grade: DosComputerGrade,
): Coord[] {
  const view = getPlayerView(game, unit.owner);
  const bearing = escortTargetBearing(target);
  const candidates = directions
    .map(d => ({ x: target.position.x + d.x, y: target.position.y + d.y }))
    .filter(p => playable(game, p))
    .filter(p => classicTilePassableChart(game, view, unit.owner, unit, p, grade));
  return candidates.sort((a, b) => {
    const distA = chebyshev(a, unit.position);
    const distB = chebyshev(b, unit.position);
    if (distA !== distB) return distA - distB;
    const behindA = stationBehindRank(target, a, bearing);
    const behindB = stationBehindRank(target, b, bearing);
    if (behindA !== behindB) return behindA - behindB;
    if (unit.kind !== 'army' && unit.kind !== 'fighter') {
      const seaA = seaNeighborCount(game, a);
      const seaB = seaNeighborCount(game, b);
      if (seaB !== seaA) return seaB - seaA;
    }
    const cityA = cityAt(game, a) ? 1 : 0;
    const cityB = cityAt(game, b) ? 1 : 0;
    if (cityA !== cityB) return cityA - cityB;
    return a.x - b.x || a.y - b.y;
  });
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