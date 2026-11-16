import type { Coord, FactionId, Game, Unit } from '../types.js';
import { getPlayerView } from '../knowledge.js';

function distance(a: Coord, b: Coord): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/** Nearest friendly city step for half-HP go-home (one activation, pass limit 1). */
export function classicHomeRepairStep(
  game: Game,
  unit: Unit,
  routeStep: (game: Game, unit: Unit, destination: Coord) => Coord | null,
): Coord | null {
  const homes = game.cities
    .filter(c => c.owner === unit.owner)
    .sort(
      (a, b) =>
        distance(a.position, unit.position) - distance(b.position, unit.position) || a.id.localeCompare(b.id),
    );
  for (const home of homes) {
    const step = routeStep(game, unit, home.position);
    if (step) return step;
  }
  return null;
}

export function embarkedCargoCount(game: Game, shipId: string): number {
  return game.units.filter(u => u.aboard === shipId).length;
}

export function classicUnitView(game: Game, faction: FactionId): ReturnType<typeof getPlayerView> {
  return getPlayerView(game, faction);
}

/** One activation step toward a Move To destination (PlayerView-blind routing uses live `routeStep`). */
export function classicMoveToStep(
  game: Game,
  unit: Unit,
  routeStep: (game: Game, unit: Unit, destination: Coord) => Coord | null,
): Coord | null {
  if (unit.order.kind !== 'move-to') return null;
  if (unit.position.x === unit.order.destination.x && unit.position.y === unit.order.destination.y) return null;
  return routeStep(game, unit, unit.order.destination);
}