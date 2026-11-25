import type { Coord, FactionId, Game, PlayerView, Unit } from '../types.js';
import type { DosComputerGrade } from './classic-grades.js';
import {
  classicArmyWanderStep,
  classicKnowledgeArmyPassable,
  classicResolveLegalDirection,
  classicRouteStep,
} from './classic-path.js';
import {
  CLASSIC_DOS_DIRECTION_ORDER,
  classicRandomRotationBias,
  classicRotateDirectionIndex,
  classicWanderHeadingRoll,
} from './classic-order-tick.js';
import { nextRandom15 } from '../rng.js';
import { classicTilePassableChart } from './classic-passability.js';
import { getPlayerView } from '../knowledge.js';
import { directions, index, playable } from '../world.js';

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
  _grade: DosComputerGrade,
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
/** DOS probe order for `0x485E`: diagonals NE, NW, SW, SE, then N, W, S, E (DOS indices). */
const CITY_EXPLORE_DOS_ORDER: ReadonlyArray<number> = Object.freeze([1, 3, 5, 7, 2, 4, 6, 0]);

/**
 * ALG-AI-001 `03BF:0C6E` (linear `0x485E`) [D]: from an army in a city, is there a legal
 * first step whose tile two steps out is on the map and still uncharted (chart glyph 0)?
 * DOS uses this only as a gate; the direction it finds is discarded.
 */
export function classicCityArmyExploreProbe(game: Game, unit: Unit, grade: DosComputerGrade): boolean {
  const view = getPlayerView(game, unit.owner);
  for (const dos of CITY_EXPLORE_DOS_ORDER) {
    const d = directions[CLASSIC_DOS_DIRECTION_ORDER[dos]!]!;
    const first = { x: unit.position.x + d.x, y: unit.position.y + d.y };
    if (!playable(game, first) || !classicTilePassableChart(game, view, unit.owner, unit, first, grade)) continue;
    const second = { x: unit.position.x + 2 * d.x, y: unit.position.y + 2 * d.y };
    if (!playable(game, second)) continue;
    if (view.cells[second.y * game.width + second.x]?.terrain === null) return true;
  }
  return false;
}

/**
 * ALG-AI-001 idle unit with order 0 (None) [D except where noted].
 * DOS `0x3E00` returns status 1, so `0x4462` runs the type AI and `0x44EA` picks no
 * direction for order 0. When the type AI finds nothing:
 * - army on a city tile (`0x1F271`): order `0x11` garrison, unless the explore probe
 *   `0x485E` finds uncharted land two steps out; then it wanders with a fresh heading;
 * - other army: order `0x10` wander, heading from `0x4836` unless already wandering,
 *   step via `0x4542` (`classicArmyWanderStep`);
 * - ships / fighters: order 3 with a `0x4836` heading. The order-3 picker `0x45A2` is
 *   not traced yet, so they use the plain `0x4C52` sweep from that heading [?].
 * The heading is kept on `unit.classicWander` (DOS `ES:24A`).
 */
/**
 * ALG-AI-001 order 3 dispatch `0x3F64` → `0x3F0C` [D] for an idle ship or fighter that
 * already holds a heading (`agents/alg-ai-001-order3-45a2-trace-2026-11-24.md`):
 * if the neighbor in that heading is off-map (`1E46:0C7F`), status 1 sends the unit back
 * to its type reissue, which writes a fresh `0x4836` heading — returned here as
 * `undefined` with no draw. Otherwise draw `rand()`; on `% 16 == 0` step the heading
 * one ring place by the unit parity (`8ADC`). Picker `0x45A2` then legalizes it.
 * Fighters: `0x3F64` skips `0x3F0C` (no draw) when fuel is at or below the threshold
 * (14 when `180C >= 0`, else 10). Empirata uses the same threshold as
 * `classicFighterMoveToExhausted` (10 when not aboard) and keeps the heading; what the
 * DOS fighter reissue then writes is untraced [?].
 */
export function classicOrder3RandomTick(
  game: Game,
  unit: Unit,
  heading: number,
): { game: Game; directionIndex: number | undefined } {
  if (unit.kind === 'fighter' && !unit.aboard && (unit.fuel ?? 0) <= 10) {
    return { game, directionIndex: heading };
  }
  const d = directions[heading]!;
  if (!playable(game, { x: unit.position.x + d.x, y: unit.position.y + d.y })) {
    return { game, directionIndex: undefined };
  }
  const draw = nextRandom15(game.rng);
  const next =
    draw.value % 16 === 0 ? classicRotateDirectionIndex(heading, classicRandomRotationBias(unit)) : heading;
  return { game: { ...game, rng: draw.next }, directionIndex: next };
}

export function classicIdleNoneStep(
  game: Game,
  unit: Unit,
  grade: DosComputerGrade,
): { game: Game; step: Coord | null; wandered: boolean } {
  const inOwnCity =
    unit.kind === 'army' &&
    game.cities.some(
      c => c.owner === unit.owner && c.position.x === unit.position.x && c.position.y === unit.position.y,
    );
  if (inOwnCity && !classicCityArmyExploreProbe(game, unit, grade)) {
    return { game, step: null, wandered: false };
  }
  let g = game;
  // Leaving a city always rolls a fresh heading (`0x1F34C`: order was `0x11`, not `0x10`).
  let heading = inOwnCity ? undefined : unit.classicWander?.direction;
  if (heading !== undefined && unit.kind !== 'army') {
    const tick = classicOrder3RandomTick(g, unit, heading);
    g = tick.game;
    heading = tick.directionIndex;
  }
  if (heading === undefined) {
    const roll = classicWanderHeadingRoll(g);
    g = roll.game;
    heading = roll.directionIndex;
  }
  const resolved =
    unit.kind === 'army'
      ? classicArmyWanderStep(g, unit, heading, grade)
      : classicResolveLegalDirection(g, unit, heading, grade);
  const live = g.units.find(u => u.id === unit.id);
  if (live) live.classicWander = { direction: resolved.directionIndex ?? heading };
  return { game: g, step: resolved.step, wandered: true };
}
