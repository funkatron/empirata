import type { Coord, FactionId, Game, PlayerView, Unit } from '../types.js';
import type { DosComputerGrade } from './classic-grades.js';
import { classicArmyReachableOnChart, classicRouteStep } from './classic-path.js';
import { classicKnownHostileCityTiles } from './classic-move.js';
import { directions, isCoastal, playable, terrainAt } from '../world.js';

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