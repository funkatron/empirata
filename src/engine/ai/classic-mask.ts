import type { Game, Unit } from '../types.js';
import type { DosComputerGrade } from './classic-grades.js';
import { dosAiGradeBFlag } from './classic-grades.js';
import { directions, terrainAt } from '../world.js';

/** ALG-AI-001 mask family (DOS `0x618` / `0x6E4` / `0x74A` analogue). */
export type ClassicMaskProfile = 'army' | 'fighter' | 'ship-a' | 'ship-b';

export function classicMaskProfile(unit: Unit, grade: DosComputerGrade): ClassicMaskProfile {
  if (unit.kind === 'army') return 'army';
  if (unit.kind === 'fighter') return 'fighter';
  if (unit.kind === 'transport') return 'ship-a';
  if (dosAiGradeBFlag(grade) === 1) return 'ship-b';
  return 'ship-a';
}

/** Sea tile with at least one orthogonal land neighbor (coastal water). */
export function isCoastalSeaTile(game: Game, pos: { x: number; y: number }): boolean {
  if (terrainAt(game, pos) !== 'sea') return false;
  return directions.some(d => terrainAt(game, { x: pos.x + d.x, y: pos.y + d.y }) === 'land');
}