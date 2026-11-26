import type { City, FactionId, Game, UnitType } from '../types.js';
import { STATS } from '../units.js';
import { getPlayerViewShared } from '../knowledge.js';
import { directions, isCoastal, terrainAt } from '../world.js';
import type { DosComputerGrade } from './classic-grades.js';
import { dosAiGradeBFlag } from './classic-grades.js';
import { classicArmyReachableOnChart } from './classic-path.js';

const MAX_TRACKED_THREATS = 20;

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

/**
 * ALG-AI-002 inventory block `ES:1810` via helper `0x30EB`.
 * Living owned units per type (cargo aboard ships still counts).
 */
export function classicInventoryBlock0x30EB(game: Game, faction: FactionId): Record<UnitType, number> {
  const view = getPlayerViewShared(game, faction);
  const counts = Object.fromEntries(COUNTABLE.map(k => [k, 0])) as Record<UnitType, number>;
  for (const unit of view.ownUnits) counts[unit.kind] += 1;
  return counts;
}

/** @deprecated Use `classicInventoryBlock0x30EB`. */
export const classicLiveUnitCounts = classicInventoryBlock0x30EB;

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
  const view = getPlayerViewShared(game, faction);
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

/** Empirata rejects sea units at inland cities; map DOS inland sealift to army here. */
export function legalizeClassicProductionForCity(game: Game, city: City, kind: UnitType): UnitType {
  if (STATS[kind].domain === 'sea' && !isCoastal(game, city.position)) return 'army';
  return kind;
}

/** Rank chart contacts for the ~20 tracked threat slots (fresh beats stale when capped). */
function trackedThreatRank(
  stale: boolean,
  position: { x: number; y: number },
  city: City,
): [number, number] {
  return [stale ? 1 : 0, chebyshev(position, city.position)];
}

/**
 * Tracked cells for `0x3ADC` (~20 slots).
 * Includes stale last-known coordinates until knowledge clears them (ALG-AI-002; manual [M]).
 */
export function classicTrackedThreatLocations(game: Game, faction: FactionId, city: City) {
  const view = getPlayerViewShared(game, faction);
  const dedupe = new Map<string, { x: number; y: number; stale: boolean }>();
  for (const enemy of view.enemies) {
    const key = `${enemy.position.x},${enemy.position.y}`;
    const prev = dedupe.get(key);
    if (!prev || (prev.stale && !enemy.stale)) {
      dedupe.set(key, { ...enemy.position, stale: enemy.stale });
    }
  }
  return [...dedupe.values()]
    .sort((a, b) => {
      const ra = trackedThreatRank(a.stale, a, city);
      const rb = trackedThreatRank(b.stale, b, city);
      return ra[0] - rb[0] || ra[1] - rb[1];
    })
  .slice(0, MAX_TRACKED_THREATS)
    .map(({ x, y }) => ({ x, y }));
}

/** `0x3ADC`: any tracked enemy location army-reachable to this city on the faction chart. */
export function classicCityPathInvasionThreat(
  game: Game,
  faction: FactionId,
  city: City,
  _grade: DosComputerGrade,
): boolean {
  const view = getPlayerViewShared(game, faction);
  for (const loc of classicTrackedThreatLocations(game, faction, city)) {
    if (classicArmyReachableOnChart(game, view, faction, loc, city.position)) return true;
  }
  return false;
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

/**
 * `0x393A` — only invoked when coastal land-neighbor count `8AC4 == 0` (`0x35B9`).
 * For `cityCount > 1`: transport if no fighters (`15E0`), else army (`0x397C` / `0x39A1`).
 * For `cityCount <= 1`: falls through to `0x39A9` ship-mix (`0x3966`), not direct transport.
 */
export type ClassicEarly393AResult = UnitType | 'ship-mix' | null;

export function classicEarlyProduction0x393A(
  counts: Record<UnitType, number>,
  cityCount: number,
): ClassicEarly393AResult {
  if (cityCount <= 1) return 'ship-mix';
  if (counts.fighter === 0) return 'transport';
  return 'army';
}

/**
 * `0x3B45` fighter pressure: `3*fighters < armies` or transport-adjacent (`8AC8==0`).
 * Coastal branch prefers fighter while `fighters < cityCount/2`.
 */
export function classicFighterPressure0x3B45(
  counts: Record<UnitType, number>,
  coastal: boolean,
  cityCount: number,
  transportAdjacent: boolean,
  nearEnemies: number,
): UnitType | null {
  if (!coastal) {
    if (counts.fighter * 3 < counts.army) return 'fighter';
    if (!transportAdjacent) return 'army';
    return 'fighter';
  }
  if (nearEnemies > 2) return 'army';
  if (nearEnemies <= 2 && transportAdjacent) return 'army';
  if (counts.fighter * 3 < counts.army || transportAdjacent) {
    if (counts.fighter * 2 < cityCount) return 'fighter';
    return null;
  }
  return 'army';
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
  inventory?: Record<UnitType, number>,
): UnitType {
  if (city.production !== null && city.progress > 0) return city.production;
  const counts = inventory ?? classicInventoryBlock0x30EB(game, faction);
  const coastal = isCoastal(game, city.position);
  const neighbors = coastalNeighborCounts(game, city);
  const cityCount = ownedCityCount(game, faction);
  const nearEnemies = nearbyEnemyCount(game, faction, city);
  const transportAdjacent = cityAdjacentTransport(game, faction, city);

  if (!cityHasDefender(game, faction, city)) return 'army';

  if (nearEnemies > 5) return 'army';

  if (neighbors.land === 0) {
    const early = classicEarlyProduction0x393A(counts, cityCount);
    if (early === 'ship-mix' && coastal) {
      return legalizeClassicProductionForCity(game, city, classicShipMixProduction(counts));
    }
    if (early && early !== 'ship-mix') {
      return legalizeClassicProductionForCity(game, city, early);
    }
  }

  if (neighbors.sea === 0 && neighbors.land > 0 && counts.transport < 2) {
    return legalizeClassicProductionForCity(game, city, 'transport');
  }

  if (coastal && counts.transport < 2) return 'transport';

  if (counts.battleship === 0 && dosAiGradeBFlag(grade) === 1) return 'battleship';
  if (counts.carrier === 0 && coastal) return 'carrier';

  if (coastal && counts.destroyer === 0 && counts.transport > 0 && dosAiGradeBFlag(grade) === 1) {
    return 'destroyer';
  }

  if (classicCityPathInvasionThreat(game, faction, city, grade)) return 'army';

  const fighterPick = classicFighterPressure0x3B45(
    counts,
    coastal,
    cityCount,
    transportAdjacent,
    nearEnemies,
  );
  if (fighterPick) return legalizeClassicProductionForCity(game, city, fighterPick);

  if (coastal && counts.carrier === 0 && counts.destroyer > 0 && counts.transport > 0) return 'carrier';

  if (coastal && cityCount > 2 && nearEnemies > 2) return 'army';

  if (coastal) return legalizeClassicProductionForCity(game, city, classicShipMixProduction(counts));

  return 'army';
}