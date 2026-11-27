import type { Coord, FactionId, Game, PlayerView, Unit } from '../types.js';
import type { DosComputerGrade } from './classic-grades.js';
import { classicArmyReachableOnChart, classicRouteStep } from './classic-path.js';
import { classicKnownHostileCityTiles } from './classic-move.js';
import { directions, isCoastal, playable, terrainAt } from '../world.js';
import { nextRandom15 } from '../rng.js';
import { dosAiModeFlags } from './classic-grades.js';

function chebyshev(a: Coord, b: Coord): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/** Objectives visible on the chart that no friendly army can reach over land (same intel as `0x3ADC`). */
export function classicOffshoreObjectives(game: Game, view: PlayerView, faction: FactionId): Coord[] {
  const hostile = classicKnownHostileCityTiles(view);
  const armies = game.units.filter(u => u.owner === faction && u.kind === 'army' && !u.aboard);
  if (!armies.length) return hostile;
  return hostile.filter(
    city =>
      !armies.some(army => classicArmyReachableOnChart(game, view, faction, army.position, city)),
  );
}

function classicChartedBeach(view: PlayerView, pos: Coord): boolean {
  const cell = view.cells[pos.y * view.width + pos.x];
  if (cell?.terrain !== 'land') return false;
  if (cell.city) return false;
  if (view.enemies.some(e => !e.stale && e.position.x === pos.x && e.position.y === pos.y)) return false;
  if (view.ownUnits.some(u => !u.aboard && u.position.x === pos.x && u.position.y === pos.y)) return false;
  return true;
}

/** Nearest offshore objective from a transport (charted cities only). */
export function classicTransportObjective(
  game: Game,
  view: PlayerView,
  faction: FactionId,
  ship: Unit,
): Coord | null {
  const goals = classicOffshoreObjectives(game, view, faction);
  if (!goals.length) return null;
  goals.sort(
    (a, b) =>
      chebyshev(a, ship.position) - chebyshev(b, ship.position) || a.x - b.x || a.y - b.y,
  );
  return goals[0] ?? null;
}

function seaApproachesForLand(view: PlayerView, land: Coord): Coord[] {
  const out: Coord[] = [];
  for (const d of directions) {
    const sea = { x: land.x + d.x, y: land.y + d.y };
    const cell = view.cells[sea.y * view.width + sea.x];
    if (cell?.terrain === 'sea') out.push(sea);
  }
  return out;
}

/** Sea tile to approach an offshore objective, preferring charted water near charted beaches. */
export function classicSealiftApproachTile(
  view: PlayerView,
  ship: Unit,
  objective: Coord,
): Coord {
  const beaches: Coord[] = [];
  for (const d of directions) {
    const land = { x: objective.x + d.x, y: objective.y + d.y };
    if (!classicChartedBeach(view, land)) continue;
    for (const sea of seaApproachesForLand(view, land)) beaches.push(sea);
  }
  const candidates = beaches.length ? beaches : seaApproachesForLand(view, objective);
  if (!candidates.length) return objective;
  candidates.sort(
    (a, b) =>
      chebyshev(a, ship.position) - chebyshev(b, ship.position) || a.x - b.x || a.y - b.y,
  );
  return candidates[0]!;
}

export function classicTransportSeaStep(
  game: Game,
  view: PlayerView,
  faction: FactionId,
  ship: Unit,
  grade: DosComputerGrade,
  objective: Coord,
): Coord | null {
  const target = classicSealiftApproachTile(view, ship, objective);
  if (terrainAt(game, ship.position) === 'sea' && chebyshev(ship.position, target) <= 1) return null;
  return classicRouteStep(game, ship, target, grade);
}

export type ClassicLandingChoice =
  | { kind: 'disembark'; armyId: string; to: Coord }
  | { kind: 'step'; to: Coord };

/** Land one army on a charted beach beside the transport, or keep approaching. */
export function classicTransportLandingChoice(
  game: Game,
  view: PlayerView,
  ship: Unit,
): ClassicLandingChoice | null {
  if (ship.kind !== 'transport' || ship.aboard) return null;
  const cargo = game.units.filter(u => u.aboard === ship.id && u.kind === 'army');
  if (!cargo.length) return null;
  if (terrainAt(game, ship.position) !== 'sea') return null;
  for (const d of directions) {
    const beach = { x: ship.position.x + d.x, y: ship.position.y + d.y };
    if (!playable(game, beach) || !classicChartedBeach(view, beach)) continue;
    const army = cargo.sort((a, b) => a.id.localeCompare(b.id))[0]!;
    if (army.spent > 0) continue;
    return { kind: 'disembark', armyId: army.id, to: beach };
  }
  return null;
}

/** Empty transport heads to the nearest friendly coastal city (reload staging). */
export function classicEmptyTransportPortStep(
  game: Game,
  faction: FactionId,
  ship: Unit,
  grade: DosComputerGrade,
): Coord | null {
  const ports = game.cities
    .filter(c => c.owner === faction && isCoastal(game, c.position))
    .sort(
      (a, b) =>
        chebyshev(a.position, ship.position) - chebyshev(b.position, ship.position) ||
        a.id.localeCompare(b.id),
    );
  for (const port of ports) {
    const step = classicRouteStep(game, ship, port.position, grade);
    if (step) return step;
  }
  return null;
}

export function classicArmyPortEmbarkStep(
  game: Game,
  view: PlayerView,
  army: Unit,
): Coord | null {
  if (army.kind !== 'army' || army.aboard) return null;
  const transports = game.units.filter(
    u =>
      u.owner === army.owner &&
      u.kind === 'transport' &&
      !u.aboard &&
      chebyshev(u.position, army.position) === 1,
  );
  if (!transports.length) return null;
  const cell = view.cells[army.position.y * game.width + army.position.x];
  const port = cell?.city?.owner === army.owner;
  if (!port) return null;
  for (const d of directions) {
    const to = { x: army.position.x + d.x, y: army.position.y + d.y };
    if (transports.some(t => t.position.x === to.x && t.position.y === to.y)) return to;
  }
  return null;
}
/**
 * `0xDA38` objective pick for a loaded transport [D structure, ? tie-breaks]: the nearest known
 * enemy city and the nearest known neutral city that the ship can route to; the neutral one wins
 * when its distance `>> flag[62FC]` is smaller (flag is 0 on grade 1). Distance is Chebyshev here;
 * DOS uses the path length of `1A9E:006C`. Returns the sea tile to sail to.
 */
export function classicTransportObjectivePick(
  game: Game,
  view: PlayerView,
  ship: Unit,
  grade: DosComputerGrade,
): Coord | null {
  let enemy = null as { d: number; city: Coord } | null;
  let neutral = null as { d: number; city: Coord } | null;
  for (const city of classicKnownHostileCityTiles(view)) {
    const info = view.cells[city.y * view.width + city.x]?.city;
    const slot = info?.owner === null ? 'neutral' : 'enemy';
    const d = chebyshev(city, ship.position);
    const best: { d: number; city: Coord } | null = slot === 'neutral' ? neutral : enemy;
    if (best && (d > best.d || (d === best.d && (city.y > best.city.y || (city.y === best.city.y && city.x > best.city.x))))) continue;
    // `1E46:0CBA`: the city needs at least one charted sea square beside it.
    if (!seaApproachesForLand(view, city).length) continue;
    const tile = classicSealiftApproachTile(view, ship, city);
    if (chebyshev(tile, ship.position) > 0 && !classicRouteStep(game, ship, tile, grade)) continue;
    if (slot === 'neutral') neutral = { d, city };
    else enemy = { d, city };
  }
  if (!neutral && !enemy) return null;
  const shift = dosAiModeFlags(grade)[10] ?? 0;
  const pick = neutral && (!enemy || neutral.d >> shift < enemy.d) ? neutral : enemy!;
  const tile = classicSealiftApproachTile(view, ship, pick.city);
  return playable(game, tile) ? tile : null;
}

/** `03BF:0D34` [D]: up to 10 random cells; the first the player has not charted. One rand per try. */
export function classicTransportExploreTarget(
  game: Game,
  view: PlayerView,
): { game: Game; target: Coord | null } {
  let g = game;
  const cells = game.width * game.height;
  for (let tries = 0; tries < 10; tries++) {
    const draw = nextRandom15(g.rng);
    g = { ...g, rng: draw.next };
    const idx = draw.value % cells;
    const cell = { x: idx % game.width, y: Math.floor(idx / game.width) };
    if (view.cells[idx]?.terrain === null && playable(game, cell)) return { game: g, target: { x: idx % game.width, y: Math.floor(idx / game.width) } };
  }
  return { game: g, target: null };
}

/**
 * `0x1D114` [D]: a loaded transport with no sailing order flips a coin (`rand % 2`): odd tries the
 * objective (`0xDA38`, order 0xB) then the explore cell (order 0xD); even tries them in the
 * other order. If neither yields a target DOS sets order 3 with a wander target (not modelled).
 */
export function classicLoadedTransportReissue(
  game: Game,
  view: PlayerView,
  ship: Unit,
  grade: DosComputerGrade,
): { game: Game; destination: Coord | null } {
  const coin = nextRandom15(game.rng);
  let g: Game = { ...game, rng: coin.next };
  const objective = () => classicTransportObjectivePick(g, view, ship, grade);
  const explore = () => {
    const r = classicTransportExploreTarget(g, view);
    g = r.game;
    return r.target;
  };
  const destination =
    coin.value % 2 !== 0 ? (objective() ?? explore()) : (explore() ?? objective());
  return { game: g, destination };
}
