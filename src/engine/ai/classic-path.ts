import type { Coord, FactionId, Game, PlayerView, Unit } from '../types.js';
import { directions } from '../world.js';
import type { DosComputerGrade } from './classic-grades.js';
import { classicPathBudget, classicTilePassableChart } from './classic-passability.js';
import { classicRandomRotationBias } from './classic-order-tick.js';
import { getPlayerView } from '../knowledge.js';
import { index, playable } from '../world.js';

/** ALG-AI-002 `0x3ADC` army passability on charted PlayerView cells (ES:234 analogue). */
export function classicKnowledgeArmyPassable(
  game: Game,
  view: PlayerView,
  faction: FactionId,
  pos: Coord,
): boolean {
  if (!playable(game, pos)) return false;
  const cell = view.cells[pos.y * game.width + pos.x];
  if (!cell || cell.terrain !== 'land') return false;
  if (cell.city && cell.city.owner !== faction) return false;
  return true;
}

/** Path invasion probe: can an army reach `to` from `from` on the faction chart within DOS budget? */
export function classicArmyReachableOnChart(
  game: Game,
  view: PlayerView,
  faction: FactionId,
  from: Coord,
  to: Coord,
): boolean {
  const goalIdx = index(game, to);
  const startIdx = index(game, from);
  if (startIdx === goalIdx) return true;
  const budget = classicPathBudget(from, to);
  const visited = new Set<number>([startIdx]);
  const queue: Array<{ idx: number; depth: number }> = [{ idx: startIdx, depth: 0 }];
  for (let head = 0; head < queue.length; head++) {
    const { idx: here, depth } = queue[head]!;
    if (here === goalIdx) return true;
    if (depth >= budget) continue;
    const x = here % game.width;
    const y = Math.floor(here / game.width);
    for (const direction of directions) {
      const pos = { x: x + direction.x, y: y + direction.y };
      if (!classicKnowledgeArmyPassable(game, view, faction, pos)) continue;
      const k = index(game, pos);
      if (visited.has(k)) continue;
      visited.add(k);
      queue.push({ idx: k, depth: depth + 1 });
    }
  }
  return false;
}

/** ALG-AI-001 `1A9E:006C` / `0x400E`: goal reachable within DOS path budget on chart masks. */
export function classicUnitReachableGoal(
  game: Game,
  unit: Unit,
  destination: Coord,
  grade: DosComputerGrade,
): boolean {
  const start = unit.position;
  const goalIdx = index(game, destination);
  const startIdx = index(game, start);
  if (startIdx === goalIdx) return true;
  const view = getPlayerView(game, unit.owner);
  const budget = classicPathBudget(start, destination);
  const visited = new Set<number>([startIdx]);
  const queue: Array<{ idx: number; depth: number }> = [{ idx: startIdx, depth: 0 }];
  for (let head = 0; head < queue.length; head++) {
    const { idx: here, depth } = queue[head]!;
    if (here === goalIdx) return true;
    if (depth >= budget) continue;
    const x = here % game.width;
    const y = Math.floor(here / game.width);
    for (const direction of directions) {
      const pos = { x: x + direction.x, y: y + direction.y };
      if (!playable(game, pos)) continue;
      const k = index(game, pos);
      if (visited.has(k)) continue;
      if (!classicTilePassableChart(game, view, unit.owner, unit, pos, grade)) continue;
      visited.add(k);
      queue.push({ idx: k, depth: depth + 1 });
    }
  }
  return false;
}

/** ALG-AI-001 goal step: BFS toward goal with DOS depth budget. */
export function classicRouteStep(
  game: Game,
  unit: Unit,
  destination: Coord,
  grade: DosComputerGrade,
): Coord | null {
  const start = unit.position;
  const goalIdx = index(game, destination);
  const startIdx = index(game, start);
  if (startIdx === goalIdx) return null;
  if (!classicUnitReachableGoal(game, unit, destination, grade)) return null;
  const view = getPlayerView(game, unit.owner);
  const budget = classicPathBudget(start, destination);
  const visited = new Set<number>([startIdx]);
  const parent = new Map<number, number>();
  const queue: Array<{ idx: number; depth: number }> = [{ idx: startIdx, depth: 0 }];
  for (let head = 0; head < queue.length; head++) {
    const { idx: here, depth } = queue[head]!;
    if (here === goalIdx) break;
    if (depth >= budget) continue;
    const x = here % game.width;
    const y = Math.floor(here / game.width);
    for (const direction of directions) {
      const pos = { x: x + direction.x, y: y + direction.y };
      if (!playable(game, pos)) continue;
      const k = index(game, pos);
      if (visited.has(k)) continue;
      if (!classicTilePassableChart(game, view, unit.owner, unit, pos, grade)) continue;
      visited.add(k);
      parent.set(k, here);
      queue.push({ idx: k, depth: depth + 1 });
    }
  }
  if (!visited.has(goalIdx)) return null;
  let cursor = goalIdx;
  while (parent.get(cursor) !== startIdx) {
    const previous = parent.get(cursor);
    if (previous === undefined) return null;
    cursor = previous;
  }
  return { x: cursor % game.width, y: Math.floor(cursor / game.width) };
}

/** Full chart path for UI overlays (same constraints as `classicRouteStep`). */
export function classicRoutePath(
  game: Game,
  unit: Unit,
  destination: Coord,
  grade: DosComputerGrade,
): Coord[] | null {
  const start = unit.position;
  const goalIdx = index(game, destination);
  const startIdx = index(game, start);
  if (startIdx === goalIdx) return [{ ...start }];
  if (!classicUnitReachableGoal(game, unit, destination, grade)) return null;
  const view = getPlayerView(game, unit.owner);
  const budget = classicPathBudget(start, destination);
  const visited = new Set<number>([startIdx]);
  const parent = new Map<number, number>();
  const queue: Array<{ idx: number; depth: number }> = [{ idx: startIdx, depth: 0 }];
  for (let head = 0; head < queue.length; head++) {
    const { idx: here, depth } = queue[head]!;
    if (here === goalIdx) break;
    if (depth >= budget) continue;
    const x = here % game.width;
    const y = Math.floor(here / game.width);
    for (const direction of directions) {
      const pos = { x: x + direction.x, y: y + direction.y };
      if (!playable(game, pos)) continue;
      const k = index(game, pos);
      if (visited.has(k)) continue;
      if (!classicTilePassableChart(game, view, unit.owner, unit, pos, grade)) continue;
      visited.add(k);
      parent.set(k, here);
      queue.push({ idx: k, depth: depth + 1 });
    }
  }
  if (!visited.has(goalIdx)) return null;
  const path: Coord[] = [];
  let cursor = goalIdx;
  while (true) {
    path.push({ x: cursor % game.width, y: Math.floor(cursor / game.width) });
    if (cursor === startIdx) break;
    const previous = parent.get(cursor);
    if (previous === undefined) return null;
    cursor = previous;
  }
  path.reverse();
  return path;
}

export type ClassicLegalDirectionResult = {
  step: Coord | null;
  /** Compass index used when `step` is set (`0x4C52` rotation winner). */
  directionIndex: number | null;
};

/** When north is blocked on the top playable row, start rotation away from the map rim. */
export function classicRimAwarePreferredIndex(game: Game, unit: Unit, preferredIndex: number): number {
  const { x, y } = unit.position;
  const north = directions[1]!;
  const northPos = { x: x + north.x, y: y + north.y };
  if (y === 1 && preferredIndex === 1 && !playable(game, northPos)) {
    return 5; // south — common DOS rim escape when default none bearing is north
  }
  const southIdx = 5;
  const south = directions[southIdx]!;
  const southPos = { x: x + south.x, y: y + south.y };
  if (y === game.height - 2 && preferredIndex === southIdx && !playable(game, southPos)) {
    return 1;
  }
  const westIdx = 7;
  const west = directions[westIdx]!;
  if (x === 1 && preferredIndex === westIdx && !playable(game, { x: x + west.x, y: y + west.y })) {
    return 3;
  }
  const eastIdx = 3;
  const east = directions[eastIdx]!;
  if (x === game.width - 2 && preferredIndex === eastIdx && !playable(game, { x: x + east.x, y: y + east.y })) {
    return 7;
  }
  return preferredIndex;
}

/** ALG-AI-001 `0x4C52`: try up to eight rotations from a preferred compass index. */
export function classicResolveLegalDirection(
  game: Game,
  unit: Unit,
  preferredIndex: number,
  grade: DosComputerGrade,
): ClassicLegalDirectionResult {
  const view = getPlayerView(game, unit.owner);
  const bias = classicRandomRotationBias(unit);
  const start = classicRimAwarePreferredIndex(game, unit, preferredIndex);
  for (let attempt = 0; attempt < directions.length; attempt++) {
    const idx = (start + attempt * bias + directions.length * 8) % directions.length;
    const dir = directions[idx]!;
    const step = { x: unit.position.x + dir.x, y: unit.position.y + dir.y };
    if (classicTilePassableChart(game, view, unit.owner, unit, step, grade)) {
      return { step, directionIndex: idx };
    }
  }
  return { step: null, directionIndex: null };
}

export function classicLegalDirectionStep(
  game: Game,
  unit: Unit,
  preferredIndex: number,
  grade: DosComputerGrade,
): Coord | null {
  return classicResolveLegalDirection(game, unit, preferredIndex, grade).step;
}