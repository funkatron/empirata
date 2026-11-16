import type { City, FactionId, Game, UnitType } from '../types.js';
import { getPlayerView } from '../knowledge.js';
import { directions, isCoastal, terrainAt } from '../world.js';
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

function chebyshev(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

function coastalNeighborCounts(game: Game, city: City): { land: number; sea: number } {
  let land = 0;
  let sea = 0;
  for (const d of directions) {
    const pos = { x: city.position.x + d.x, y: city.position.y + d.y };
    if (pos.x < 0 || pos.y < 0 || pos.x >= game.width || pos.y >= game.height) continue;
    const terrain = terrainAt(game, pos);
    if (terrain === 'land') land++;
    else if (terrain === 'sea') sea++;
  }
  return { land, sea };
}

/** `0x38F0` transport-adjacent gate (Chebyshev-1 type-3). */
export function cityAdjacentTransport(game: Game, faction: FactionId, city: City): boolean {
  for (const unit of game.units) {
    if (unit.owner !== faction || unit.kind !== 'transport' || unit.aboard) continue;
    if (chebyshev(unit.position, city.position) <= 1) return true;
  }
  return false;
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

function ownedCityCount(game: Game, faction: FactionId): number {
  return game.cities.filter(c => c.owner === faction).length;
}

/** Scout analogue `0x383D`: enemy units within 6 tiles of the city. */
export function nearbyEnemyCount(game: Game, faction: FactionId, city: City): number {
  let count = 0;
  for (const unit of game.units) {
    if (unit.owner === faction || unit.aboard) continue;
    if (chebyshev(unit.position, city.position) <= 6) count++;
  }
  return count;
}

/** `0x39A9` ship-mix pass: default battleship, downgrade while counts are inverted. */
export function classicShipMixProduction(counts: Record<UnitType, number>): UnitType {
  for (let i = COUNTABLE.length - 2; i >= 2; i--) {
    const type = COUNTABLE[i]!;
    const higher = COUNTABLE[i + 1]!;
    if (counts[type] < counts[higher]) return type;
  }
  return 'battleship';
}

/**
 * Full ALG-AI-002 `0x3490` heuristic tree (Empirata staging).
 * Preserves in-progress production; honors grade-B gates via `dosAiGradeBFlag`.
 */
export function chooseClassicCityProduction(
  game: Game,
  faction: FactionId,
  city: City,
  grade: DosComputerGrade,
): UnitType {
  if (city.production !== null && city.progress > 0) return city.production;
  const counts = classicLiveUnitCounts(game, faction);
  const coastal = isCoastal(game, city.position);
  const neighbors = coastalNeighborCounts(game, city);
  const cityCount = ownedCityCount(game, faction);
  const nearEnemies = nearbyEnemyCount(game, faction, city);
  const transportAdjacent = cityAdjacentTransport(game, faction, city);

  if (!cityHasDefender(game, faction, city)) return 'army';

  if (nearEnemies > 5) return 'army';

  if (cityCount <= 1 && counts.fighter === 0 && counts.transport === 0 && coastal) return 'transport';

  if (neighbors.sea === 0 && neighbors.land > 0 && counts.transport < 2) return 'transport';

  if (coastal && counts.transport < 2) return 'transport';

  if (counts.battleship === 0 && dosAiGradeBFlag(grade) === 1) return 'battleship';
  if (counts.carrier === 0 && coastal) return 'carrier';

  if (coastal && counts.destroyer === 0 && counts.transport > 0 && dosAiGradeBFlag(grade) === 1) {
    return 'destroyer';
  }

  if (coastal && counts.fighter * 3 < counts.army && counts.army >= 2) return 'fighter';
  if (coastal && !transportAdjacent && counts.fighter * 3 < counts.army) return 'fighter';

  if (coastal && counts.carrier === 0 && counts.destroyer > 0 && counts.transport > 0) return 'carrier';

  if (coastal && cityCount > 2 && nearEnemies > 2) return 'army';

  if (coastal) return classicShipMixProduction(counts);

  return 'army';
}