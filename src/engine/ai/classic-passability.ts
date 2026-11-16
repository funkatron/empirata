import type { Coord, FactionId, Game, Unit } from '../types.js';
import { STATS } from '../units.js';
import { cityAt, index, playable, terrainAt } from '../world.js';
import type { DosComputerGrade } from './classic-grades.js';
import { dosAiGradeBFlag } from './classic-grades.js';

function chebyshev(a: Coord, b: Coord): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/** ALG-AI-001 passability probe for computer routing (boolean mask analogue). */
export function classicTilePassable(game: Game, faction: FactionId, unit: Unit, pos: Coord, grade: DosComputerGrade): boolean {
  if (!playable(game, pos)) return false;
  const city = cityAt(game, pos);
  const terrain = terrainAt(game, pos);
  const domain = STATS[unit.kind].domain;
  const friendlyStack =
    game.units.some(
      u => !u.aboard && u.owner === faction && u.id !== unit.id && u.position.x === pos.x && u.position.y === pos.y,
    ) && !city;
  if (friendlyStack) return false;
  if (city) {
    if (city.owner === faction) return true;
    return false;
  }
  if (domain === 'land') {
    if (terrain !== 'land') return false;
    return true;
  }
  if (domain === 'air') {
    return terrain === 'land' || terrain === 'sea';
  }
  const strictSea = unit.kind !== 'transport' && dosAiGradeBFlag(grade) === 1;
  if (terrain !== 'sea') {
    if (strictSea) return false;
    return false;
  }
  return true;
}

export function classicPathBudget(from: Coord, to: Coord): number {
  return Math.min(125, 2 * chebyshev(from, to) + 25);
}