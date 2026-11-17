import type { Coord, FactionId, Game, PlayerView, Unit } from '../types.js';
import type { DosComputerGrade } from './classic-grades.js';
import { classicKnowledgeArmyPassable, classicRouteStep } from './classic-path.js';
import { getPlayerView } from '../knowledge.js';
import { directions, index } from '../world.js';

function distance(a: Coord, b: Coord): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/** Nearest friendly city step for half-HP go-home (one activation, pass limit 1). */
export function classicHomeRepairStep(
  game: Game,
  unit: Unit,
  routeStep: (game: Game, unit: Unit, destination: Coord) => Coord | null,
  grade?: DosComputerGrade,
): Coord | null {
  const homes = game.cities
    .filter(c => c.owner === unit.owner)
    .sort(
      (a, b) =>
        distance(a.position, unit.position) - distance(b.position, unit.position) || a.id.localeCompare(b.id),
    );
  for (const home of homes) {
    const step =
      grade !== undefined ? classicRouteStep(game, unit, home.position, grade) : routeStep(game, unit, home.position);
    if (step) return step;
  }
  return null;
}

export function embarkedCargoCount(game: Game, shipId: string): number {
  return game.units.filter(u => u.aboard === shipId).length;
}

export function classicUnitView(game: Game, faction: FactionId): ReturnType<typeof getPlayerView> {
  return getPlayerView(game, faction);
}

/** One activation step toward a Move To destination (PlayerView-blind routing uses live `routeStep`). */
export function classicMoveToStep(
  game: Game,
  unit: Unit,
  routeStep: (game: Game, unit: Unit, destination: Coord) => Coord | null,
  grade?: DosComputerGrade,
): Coord | null {
  if (unit.order.kind !== 'move-to') return null;
  if (unit.position.x === unit.order.destination.x && unit.position.y === unit.order.destination.y) return null;
  if (grade !== undefined) return classicRouteStep(game, unit, unit.order.destination, grade);
  return routeStep(game, unit, unit.order.destination);
}

export function classicPatrolStep(
  game: Game,
  unit: Unit,
  grade: DosComputerGrade,
): Coord | null {
  if (unit.order.kind !== 'patrol') return null;
  const dest = unit.order.outbound ? unit.order.to : unit.order.from;
  if (unit.position.x === dest.x && unit.position.y === dest.y) return null;
  return classicRouteStep(game, unit, dest, grade);
}

function chebyshev(a: Coord, b: Coord): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/** Charted cities that are not owned by `view.active`: neutral (`null`) and enemy factions. */
export function classicKnownHostileCityTiles(view: PlayerView): Coord[] {
  const out: Coord[] = [];
  for (let i = 0; i < view.cells.length; i++) {
    const cell = view.cells[i];
    if (cell?.city && cell.city.owner !== view.active) {
      out.push({ x: i % view.width, y: Math.floor(i / view.width) });
    }
  }
  return out;
}

/**
 * One army step toward a charted non-friendly city: assault when adjacent, else
 * chart-limited BFS (same intel as production `0x3ADC`, not live omniscience).
 */
export function classicArmyConquestStep(
  game: Game,
  view: PlayerView,
  faction: FactionId,
  unit: Unit,
  grade: DosComputerGrade,
): Coord | null {
  if (unit.kind !== 'army' || unit.aboard) return null;
  const targets = classicKnownHostileCityTiles(view);
  if (!targets.length) return null;
  const adjacent = targets
    .filter(t => chebyshev(t, unit.position) === 1)
    .sort((a, b) => a.x - b.x || a.y - b.y);
  if (adjacent.length) return adjacent[0]!;

  const occupied = new Set<number>();
  for (const u of view.ownUnits) {
    if (!u.aboard && u.id !== unit.id) occupied.add(index(game, u.position));
  }
  for (const e of view.enemies) {
    if (!e.stale) occupied.add(index(game, e.position));
  }
  const startIdx = index(game, unit.position);
  const budget = Math.min(
    125,
    ...targets.map(t => 2 * chebyshev(unit.position, t) + 25),
  );
  const visited = new Set<number>([startIdx]);
  const parent = new Map<number, number>();
  const queue: Array<{ idx: number; depth: number }> = [{ idx: startIdx, depth: 0 }];
  let found: number | undefined;
  for (let head = 0; head < queue.length && found === undefined; head++) {
    const { idx: here, depth } = queue[head]!;
    const x = here % game.width;
    const y = Math.floor(here / game.width);
    const pos = { x, y };
    if (targets.some(t => chebyshev(t, pos) === 1)) {
      found = here;
      break;
    }
    if (depth >= budget) continue;
    for (const d of directions) {
      const next = { x: x + d.x, y: y + d.y };
      if (!classicKnowledgeArmyPassable(game, view, faction, next)) continue;
      const k = index(game, next);
      if (visited.has(k) || occupied.has(k)) continue;
      visited.add(k);
      parent.set(k, here);
      queue.push({ idx: k, depth: depth + 1 });
    }
  }
  if (found === undefined) return null;
  let cursor = found;
  while (parent.get(cursor) !== startIdx) {
    const previous = parent.get(cursor);
    if (previous === undefined) return null;
    cursor = previous;
  }
  return { x: cursor % game.width, y: Math.floor(cursor / game.width) };
}