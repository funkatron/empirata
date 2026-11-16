import type { City, FactionId, Game, UnitType } from '../types.js';
import { getPlayerView } from '../knowledge.js';
import { isCoastal } from '../world.js';
import type { DosComputerGrade } from './classic-grades.js';
import { dosAiGradeBFlag } from './classic-grades.js';

const COUNTABLE: readonly UnitType[] = [
  'army',
  'fighter',
  'destroyer',
  'transport',
  'submarine',
  'cruiser',
  'carrier',
  'battleship',
];

/** ALG-AI-002 inventory block (living units, including embarked cargo). */
export function classicLiveUnitCounts(game: Game, faction: FactionId): Record<UnitType, number> {
  const counts = Object.fromEntries(COUNTABLE.map(k => [k, 0])) as Record<UnitType, number>;
  for (const unit of game.units) {
    if (unit.owner !== faction) continue;
    counts[unit.kind] += 1;
  }
  return counts;
}

function cityHasDefender(game: Game, faction: FactionId, city: City): boolean {
  const view = getPlayerView(game, faction);
  return view.ownUnits.some(
    u =>
      u.kind === 'army' &&
      !u.aboard &&
      u.position.x === city.position.x &&
      u.position.y === city.position.y,
  );
}

/**
 * Partial ALG-AI-002 chooser: army when undefended, coastal transport when `<2` hulls,
 * grade-B destroyer when transports exist but no destroyers, else army.
 */
export function chooseClassicCityProduction(
  game: Game,
  faction: FactionId,
  city: City,
  grade: DosComputerGrade,
): UnitType {
  if (city.production !== null && city.progress > 0) return city.production;
  if (!cityHasDefender(game, faction, city)) return 'army';
  const counts = classicLiveUnitCounts(game, faction);
  const coastal = isCoastal(game, city.position);
  if (coastal && counts.transport < 2) return 'transport';
  if (coastal && dosAiGradeBFlag(grade) === 1 && counts.destroyer === 0 && counts.transport > 0) {
    return 'destroyer';
  }
  return 'army';
}