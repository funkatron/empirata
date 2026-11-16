import type { Coord, FactionId, Game, Unit } from '../types.js';
import { directions } from '../world.js';
import type { DosComputerGrade } from './classic-grades.js';
import { classicPathBudget, classicTilePassable } from './classic-passability.js';
import { classicRandomRotationBias } from './classic-order-tick.js';
import { index, playable } from '../world.js';

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
      if (!classicTilePassable(game, unit.owner, unit, pos, grade)) continue;
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

/** ALG-AI-001 `0x4C52`: try up to eight rotations from a preferred compass index. */
export function classicLegalDirectionStep(
  game: Game,
  unit: Unit,
  preferredIndex: number,
  grade: DosComputerGrade,
): Coord | null {
  const bias = classicRandomRotationBias(unit);
  for (let attempt = 0; attempt < directions.length; attempt++) {
    const idx = (preferredIndex + attempt * bias + directions.length * 8) % directions.length;
    const dir = directions[idx]!;
    const step = { x: unit.position.x + dir.x, y: unit.position.y + dir.y };
    if (classicTilePassable(game, unit.owner, unit, step, grade)) return step;
  }
  return null;
}