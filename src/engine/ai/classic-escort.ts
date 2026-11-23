import type { Coord, Game, Unit } from '../types.js';
import type { DosComputerGrade } from './classic-grades.js';
import { classicTilePassableChart } from './classic-passability.js';
import { classicRouteStep, classicUnitReachableGoal } from './classic-path.js';
import { getPlayerView } from '../knowledge.js';
import { nextRandom15 } from '../rng.js';
import { playable } from '../world.js';

/** ALG-AI-001: radius `n=3` pushed for the escort close-range call at `0x46C2`. */
export const CLASSIC_ESCORT_STATION_RADIUS = 3;
/** Loop bound at `0x1D47E`. */
export const CLASSIC_ESCORT_STATION_PROBE_COUNT = 20;
/** First `idiv` axis (`imul 100` leg) — DOS `0x3A` clamp; Empirata **Y**. */
const DOS_STATION_IMUL_MAX = 58;
/** Second `idiv` axis (adder) — DOS `0x62` clamp; Empirata **X**. */
const DOS_STATION_ADD_MAX = 98;

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

function clampStationAxis(value: number, min: number, max: number): number {
  if (value > max) return max;
  if (value < min) return min;
  return value;
}

/**
 * ALG-AI-001 `1D09:03C2` (`0x1D452`): up to 20 probes in an `(2n+1)²` window around the escort
 * target; two `25E6:0F64` draws per probe; first chart-passable reachable tile wins.
 */
export function classicEscortStationCandidates(
  game: Game,
  unit: Unit,
  target: Unit,
  grade: DosComputerGrade,
  radius: number = CLASSIC_ESCORT_STATION_RADIUS,
): { game: Game; candidates: Coord[] } {
  const view = getPlayerView(game, unit.owner);
  const span = 2 * radius + 1;
  const baseY = target.position.y - radius;
  const baseX = target.position.x - radius;
  let rng = game.rng;

  for (let probe = 0; probe < CLASSIC_ESCORT_STATION_PROBE_COUNT; probe++) {
    const drawY = nextRandom15(rng);
    rng = drawY.next;
    const y = clampStationAxis((drawY.value % span) + baseY, 1, DOS_STATION_IMUL_MAX);

    const drawX = nextRandom15(rng);
    rng = drawX.next;
    const x = clampStationAxis((drawX.value % span) + baseX, 1, DOS_STATION_ADD_MAX);

    const p = { x, y };
    if (!playable(game, p)) continue;
    if (!classicTilePassableChart(game, view, unit.owner, unit, p, grade)) continue;
    if (!classicUnitReachableGoal(game, unit, p, grade)) continue;
    return { game: { ...game, rng }, candidates: [p] };
  }
  return { game: { ...game, rng }, candidates: [] };
}

export function classicEscortStationGoal(
  game: Game,
  unit: Unit,
  target: Unit,
  grade: DosComputerGrade,
): { game: Game; goal: Coord | null } {
  const probed = classicEscortStationCandidates(game, unit, target, grade);
  return { game: probed.game, goal: probed.candidates[0] ?? null };
}

/**
 * ALG-AI-001 `0x4600`: within Chebyshev 3 of the escort target, path goal follows the target’s standing order
 * (or the `1D09:03C2` station tile when the target is holding).
 */
export function classicEscortCloseRangeGoal(
  game: Game,
  unit: Unit,
  target: Unit,
  grade: DosComputerGrade,
): { game: Game; goal: Coord | null } {
  if (chebyshev(unit.position, target.position) >= 4) return { game, goal: null };
  const order = target.order;
  if (order.kind === 'move-to') return { game, goal: { ...order.destination } };
  if (order.kind === 'go-home') {
    const home = nearestFriendlyCityPosition(game, unit.owner, target.position);
    return { game, goal: home ? { ...home } : null };
  }
  if (order.kind === 'go-direction') {
    return { game, goal: { x: target.position.x + order.direction.x, y: target.position.y + order.direction.y } };
  }
  if (order.kind === 'patrol') return { game, goal: order.outbound ? { ...order.to } : { ...order.from } };
  return classicEscortStationGoal(game, unit, target, grade);
}

/**
 * Tile this escort should path toward.
 *
 * Inside Chebyshev 3 this is `0x4600`: the target's standing order, or one `03C2`
 * station probe when that order does not name a destination. A failed route does not
 * roll the window again. Farther out, DOS does not call `03C2`; Empirata still aims at
 * one station tile from the same formula so the escort can close.
 */
export function classicEscortNavigationGoal(
  game: Game,
  unit: Unit,
  target: Unit,
  grade: DosComputerGrade,
): { game: Game; goal: Coord | null } {
  if (chebyshev(unit.position, target.position) >= 4) {
    return classicEscortStationGoal(game, unit, target, grade);
  }
  const close = classicEscortCloseRangeGoal(game, unit, target, grade);
  if (close.goal) return close;
  if (target.order.kind === 'go-home') return classicEscortStationGoal(close.game, unit, target, grade);
  return close;
}

/** ALG-AI-001 escort: one step toward `classicEscortNavigationGoal`. */
export function classicEscortStep(
  game: Game,
  unit: Unit,
  grade: DosComputerGrade,
): { game: Game; step: Coord | null } {
  const order = unit.order;
  if (order.kind !== 'escort') return { game, step: null };
  const target = game.units.find(t => t.id === order.targetId && t.owner === unit.owner && !t.aboard);
  if (!target) return { game, step: null };
  if (chebyshev(unit.position, target.position) <= 1) return { game, step: null };

  const nav = classicEscortNavigationGoal(game, unit, target, grade);
  if (!nav.goal) return { game: nav.game, step: null };
  return { game: nav.game, step: classicRouteStep(nav.game, unit, nav.goal, grade) };
}