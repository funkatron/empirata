/**
 * ALG-AI-001 classic army activation [D unless marked]
 * (`agents/alg-ai-001-army-reissue-trace-2026-11-26.md`).
 *
 * Pipeline for one land army (not aboard):
 * 1. Order dispatch. Order 0xF (Empirata `move-to`) ends (`0x4418`) when the goal's chart
 *    owner is the player, or the land pathfinder `1A9E:000C` can no longer reach it.
 *    Orders 0 / 0x10 (Empirata `none`, with or without `classicWander`) always end.
 * 2. Type reissue `0x1F238` (land branch), when the order ended:
 *    a. if `(turns[p] ^ unitIndex) & 1`: city task `0x1F454`;
 *    b. twenty-slot list `0x1F5F4` — not modelled (writers untraced) [?];
 *    c. board a transport `0x1F6AA` — staged as `classicArmyPortEmbarkStep`;
 *    d. wander order 0x10 (heading `0x4836` unless already wandering).
 * 3. Picker: 0xF → one step along the land path [? tie-break of `0x4714`]; 0x10 → `0x4542`.
 * 4. Type step `0x1F376`: adjacent non-own city (`12C2:115F`), explore probe
 *    (`03BF:0C6E`), attack mask 0xF0 (`0x4A2A`), else legalize the picker direction (`0x4C52`).
 */
import type { Coord, FactionId, Game, PlayerView, Unit, UnitOrder, UnitType } from '../types.js';
import { directions, index, playable } from '../world.js';
import { nextRandom15 } from '../rng.js';
import { getPlayerViewShared } from '../knowledge.js';
import { dosAiModeFlags, type DosComputerGrade } from './classic-grades.js';
import { classicPathBudget, classicTilePassableChart } from './classic-passability.js';
import { classicArmyWanderStep, classicResolveLegalDirection } from './classic-path.js';
import {
  CLASSIC_DOS_DIRECTION_ORDER,
  classicRandomRotationBias,
  classicWanderHeadingRoll,
} from './classic-order-tick.js';

/** DOS directions are scanned 7 … 0 (SE, S, SW, W, NW, N, NE, E) by `115F` and `0x4A2A`. */
const DOS_SCAN_7_TO_0: ReadonlyArray<number> = Object.freeze([7, 6, 5, 4, 3, 2, 1, 0]);
/** `0x485E` probe order (DOS indices). */
const EXPLORE_DOS_ORDER: ReadonlyArray<number> = Object.freeze([1, 3, 5, 7, 2, 4, 6, 0]);
/** `6464[class] = 0x80 >> class` (ALG-006 type order). */
const CLASS_BIT: Readonly<Record<UnitType, number>> = Object.freeze({
  army: 0x80, fighter: 0x40, destroyer: 0x20, transport: 0x10,
  submarine: 0x08, cruiser: 0x04, carrier: 0x02, battleship: 0x01,
});
/** `0x1F376`: mask for an army on land (0xC0 when it stands on a transport glyph). */
const ARMY_LAND_ATTACK_MASK = 0xf0;

export type ClassicArmyActivation = { game: Game; step: Coord | null; wandered: boolean };

function chebyshev(a: Coord, b: Coord): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

function neighbour(pos: Coord, dos: number): Coord {
  const d = directions[CLASSIC_DOS_DIRECTION_ORDER[dos]!]!;
  return { x: pos.x + d.x, y: pos.y + d.y };
}

/** Unit-index parity bit, the same bit `classicRandomRotationBias` uses (`8ADC`). */
export function classicUnitParityBit(unit: Unit): 0 | 1 {
  return classicRandomRotationBias(unit) === 1 ? 0 : 1;
}

/**
 * `0x1F238` parity gate: `(6D8E[p] ^ u) & 1`. `6D8E[p]` counts the player's completed turns
 * (incremented after `0xDF58`), taken here as `round − 1` [? offset].
 */
export function classicArmyCityTaskTurn(game: Game, unit: Unit): boolean {
  return (((game.round - 1) ^ classicUnitParityBit(unit)) & 1) === 1;
}

/**
 * Pathfinder table `DS:2AD8` (`1A9E:000C`): unexplored, land and **neutral** city glyphs pass;
 * every player city (own included) and sea are blocked. Unit glyphs on land pass.
 */
export function classicLandTable2AD8Passable(game: Game, view: PlayerView, pos: Coord): boolean {
  if (!playable(game, pos)) return false;
  const cell = view.cells[index(game, pos)];
  if (!cell) return false;
  if (cell.terrain === null) return true;
  if (cell.terrain !== 'land') return false;
  return !cell.city || cell.city.owner === null;
}

/**
 * `1A9E:000C` as a BFS on the player's chart with the DOS radius `min(2·dist + 25, 125)`.
 * Returns the first step of a shortest path (engine neighbour order), or null.
 */
export function classicLandPath2AD8(game: Game, view: PlayerView, from: Coord, to: Coord): Coord | null | 'here' {
  const start = index(game, from);
  const goal = index(game, to);
  if (start === goal) return 'here';
  if (!classicLandTable2AD8Passable(game, view, to)) return null;
  const budget = classicPathBudget(from, to);
  const parent = new Map<number, number>();
  const visited = new Set<number>([start]);
  const queue: Array<{ idx: number; depth: number }> = [{ idx: start, depth: 0 }];
  for (let head = 0; head < queue.length; head++) {
    const { idx: here, depth } = queue[head]!;
    if (here === goal) {
      let cursor = goal;
      while (parent.get(cursor) !== start) cursor = parent.get(cursor)!;
      return { x: cursor % game.width, y: Math.floor(cursor / game.width) };
    }
    if (depth >= budget) continue;
    const x = here % game.width;
    const y = Math.floor(here / game.width);
    for (const d of directions) {
      const pos = { x: x + d.x, y: y + d.y };
      if (!classicLandTable2AD8Passable(game, view, pos)) continue;
      const k = index(game, pos);
      if (visited.has(k)) continue;
      visited.add(k);
      parent.set(k, here);
      queue.push({ idx: k, depth: depth + 1 });
    }
  }
  return null;
}

/**
 * City task `0x1F454`. One `rand()` per call picks the start index; every city is visited
 * once (wrapping). Accept the first **known** city within Chebyshev 12 (grade 1) or 20
 * (grade 2, flag `62F6`) that `1A9E:000C` reaches. Grade 2's per-city cap
 * `(120 − combat_eff)/10` and the `91B2` fallback are not modelled yet [staged].
 */
export function classicArmyCityTask(
  game: Game,
  view: PlayerView,
  unit: Unit,
  grade: DosComputerGrade,
): { game: Game; destination: Coord | null } {
  const cities = game.cities;
  if (!cities.length) return { game, destination: null };
  const draw = nextRandom15(game.rng);
  const g = { ...game, rng: draw.next };
  const radius = dosAiModeFlags(grade)[7] ? 20 : 12;
  const first = draw.value % cities.length;
  for (let n = 0; n < cities.length; n++) {
    const city = cities[(first + n) % cities.length]!;
    const known = view.cells[index(game, city.position)]?.city;
    if (!known) continue;
    if (chebyshev(city.position, unit.position) > radius) continue;
    if (classicLandPath2AD8(game, view, unit.position, city.position) === null) continue;
    return { game: g, destination: { ...city.position } };
  }
  return { game: g, destination: null };
}

/** Order 0xF dispatch `0x4418`: true while the army should keep its city task. */
export function classicArmyCityTaskActive(game: Game, view: PlayerView, unit: Unit, goal: Coord): boolean {
  const cell = view.cells[index(game, goal)];
  if (cell?.city?.owner === unit.owner) return false;
  return classicLandPath2AD8(game, view, unit.position, goal) !== null;
}

/** `12C2:115F`: first adjacent city glyph not owned by the player, scanning DOS 7 … 0. */
export function classicAdjacentForeignCityStep(game: Game, view: PlayerView, unit: Unit): Coord | null {
  for (const dos of DOS_SCAN_7_TO_0) {
    const pos = neighbour(unit.position, dos);
    if (!playable(game, pos)) continue;
    const city = view.cells[index(game, pos)]?.city;
    if (city && city.owner !== unit.owner) return pos;
  }
  return null;
}

/** `03BF:0C6E` (`0x485E`): first legal step whose tile two steps out is uncharted. */
export function classicArmyExploreStep(game: Game, view: PlayerView, unit: Unit, grade: DosComputerGrade): Coord | null {
  for (const dos of EXPLORE_DOS_ORDER) {
    const first = neighbour(unit.position, dos);
    if (!playable(game, first) || !classicTilePassableChart(game, view, unit.owner, unit, first, grade)) continue;
    const second = neighbour(first, dos);
    if (!playable(game, second)) continue;
    if (view.cells[index(game, second)]?.terrain === null) return first;
  }
  return null;
}

/**
 * `0x4A2A` with mask 0xF0: first adjacent enemy glyph (DOS 7 … 0) whose class bit is in the
 * mask. An army skips a fighter over sea.
 */
export function classicArmyAttackStep(game: Game, view: PlayerView, unit: Unit): Coord | null {
  for (const dos of DOS_SCAN_7_TO_0) {
    const pos = neighbour(unit.position, dos);
    if (!playable(game, pos)) continue;
    const enemy = view.enemies.find(e => e.position.x === pos.x && e.position.y === pos.y);
    if (!enemy || enemy.owner === unit.owner) continue;
    if (!(CLASS_BIT[enemy.kind] & ARMY_LAND_ATTACK_MASK)) continue;
    if (enemy.kind === 'fighter' && view.cells[index(game, pos)]?.terrain === 'sea') continue;
    return pos;
  }
  return null;
}

function directionIndexToward(from: Coord, to: Coord): number {
  return directions.findIndex(d => d.x === to.x - from.x && d.y === to.y - from.y);
}

/**
 * One classic army activation. `setOrder` writes the Empirata order for the DOS order the
 * activation ends with (0xF → `move-to`, 0x10 → `none` + `classicWander`).
 * `embarkStep` is the staged `0x1F6AA` analogue.
 */
export function classicArmyActivation(
  game: Game,
  faction: FactionId,
  unitId: string,
  grade: DosComputerGrade,
  setOrder: (g: Game, order: UnitOrder) => Game,
  embarkStep: (g: Game, view: PlayerView, unit: Unit) => Coord | null,
): ClassicArmyActivation {
  let g = game;
  let unit = g.units.find(u => u.id === unitId);
  if (!unit || unit.kind !== 'army' || unit.aboard) return { game: g, step: null, wandered: false };
  let view = getPlayerViewShared(g, faction);

  // 1. Dispatch.
  let goal: Coord | null = null;
  if (unit.order.kind === 'move-to') {
    if (classicArmyCityTaskActive(g, view, unit, unit.order.destination)) goal = unit.order.destination;
    else {
      g = setOrder(g, { kind: 'none' });
      unit = g.units.find(u => u.id === unitId)!;
    }
  } else if (unit.order.kind !== 'none') {
    // Sentry (after boarding) and other standing orders keep their own handlers.
    return { game: g, step: null, wandered: false };
  }

  // 2. Type reissue `0x1F238`.
  let wanderHeading: number | null = null;
  if (!goal) {
    if (classicArmyCityTaskTurn(g, unit)) {
      const task = classicArmyCityTask(g, view, unit, grade);
      g = task.game;
      if (task.destination) {
        goal = task.destination;
        g = setOrder(g, { kind: 'move-to', destination: goal });
        unit = g.units.find(u => u.id === unitId)!;
        view = getPlayerViewShared(g, faction);
      }
    }
    if (!goal) {
      const board = embarkStep(g, view, unit);
      if (board) return { game: g, step: board, wandered: false };
      let heading = unit.classicWander?.direction;
      if (heading === undefined) {
        const roll = classicWanderHeadingRoll(g);
        g = roll.game;
        heading = roll.directionIndex;
      }
      wanderHeading = heading;
      unit = g.units.find(u => u.id === unitId)!;
    }
  }

  // 4. Type step `0x1F376` (overrides the picker).
  const override =
    classicAdjacentForeignCityStep(g, view, unit) ??
    classicArmyExploreStep(g, view, unit, grade) ??
    classicArmyAttackStep(g, view, unit);

  // 3. Picker (then `0x4C52`).
  let step: Coord | null = override;
  let heading = wanderHeading;
  if (!step && goal) {
    const path = classicLandPath2AD8(g, view, unit.position, goal);
    if (path && path !== 'here') {
      step = classicResolveLegalDirection(g, unit, directionIndexToward(unit.position, path), grade).step;
    }
  } else if (!step && wanderHeading !== null) {
    const resolved = classicArmyWanderStep(g, unit, wanderHeading, grade);
    step = resolved.step;
    heading = resolved.directionIndex ?? wanderHeading;
  }
  if (wanderHeading !== null) {
    const live = g.units.find(u => u.id === unitId);
    if (live) live.classicWander = { direction: heading ?? wanderHeading };
  }
  return { game: g, step, wandered: wanderHeading !== null };
}
