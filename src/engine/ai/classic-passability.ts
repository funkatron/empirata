import type { Coord, FactionId, Game, PlayerView, Unit } from '../types.js';
import { STATS } from '../units.js';
import { cityAt, playable, terrainAt } from '../world.js';
import type { DosComputerGrade } from './classic-grades.js';
import { classicChartGlyphsForTile, classicChartGlyphsForViewCell, classicDosPlayerIndex } from './classic-glyph.js';
import { classicMaskAllowsGlyph } from './classic-glyph-masks.js';
import { classicMaskProfile, isCoastalSeaTile } from './classic-mask.js';

function chebyshev(a: Coord, b: Coord): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/** ALG-AI-001 passability probe using mask profile + terrain/city glyph rules. */
export function classicTilePassable(
  game: Game,
  faction: FactionId,
  unit: Unit,
  pos: Coord,
  grade: DosComputerGrade,
): boolean {
  if (!playable(game, pos)) return false;
  const city = cityAt(game, pos);
  const terrain = terrainAt(game, pos);
  const profile = classicMaskProfile(unit, grade);
  const friendlyStack =
    game.units.some(
      u => !u.aboard && u.owner === faction && u.id !== unit.id && u.position.x === pos.x && u.position.y === pos.y,
    ) && !city;
  if (friendlyStack) return false;
  if (city) return city.owner === faction;
  const playerIndex = classicDosPlayerIndex(game, faction);
  const glyphCandidates = classicChartGlyphsForTile(game, faction, terrain, city);
  const maskOk = glyphCandidates.some(g => classicMaskAllowsGlyph(profile, playerIndex, g));
  if (!maskOk) return false;
  if (profile === 'ship-b' && terrain === 'sea' && isCoastalSeaTile(game, pos)) return false;
  if (profile === 'army') return terrain === 'land';
  if (profile === 'fighter') return terrain === 'land' || terrain === 'sea';
  return terrain === 'sea';
}

/**
 * ALG-AI-001 passability on the faction chart (`ES:234` + mask), not omniscient terrain.
 * Used by classic movement pathfinding only.
 */
export function classicTilePassableChart(
  game: Game,
  view: PlayerView,
  faction: FactionId,
  unit: Unit,
  pos: Coord,
  grade: DosComputerGrade,
): boolean {
  if (!playable(game, pos)) return false;
  const cellIdx = pos.y * game.width + pos.x;
  const cell = view.cells[cellIdx];
  if (!cell || cell.terrain === null) return false;
  const profile = classicMaskProfile(unit, grade);
  const friendlyStack =
    view.ownUnits.some(
      u => !u.aboard && u.id !== unit.id && u.position.x === pos.x && u.position.y === pos.y,
    ) && !cell.city;
  if (friendlyStack) return false;
  if (cell.city) return cell.city.owner === faction;
  const playerIndex = classicDosPlayerIndex(game, faction);
  const glyphCandidates = classicChartGlyphsForViewCell(game, view, faction, pos);
  if (!glyphCandidates.length) return false;
  const maskOk = glyphCandidates.some(g => classicMaskAllowsGlyph(profile, playerIndex, g));
  if (!maskOk) return false;
  if (profile === 'ship-b' && cell.terrain === 'sea' && isCoastalSeaTile(game, pos)) return false;
  if (profile === 'army') return cell.terrain === 'land';
  if (profile === 'fighter') return cell.terrain === 'land' || cell.terrain === 'sea';
  return cell.terrain === 'sea';
}

export function classicPathBudget(from: Coord, to: Coord): number {
  return Math.min(125, 2 * chebyshev(from, to) + 25);
}