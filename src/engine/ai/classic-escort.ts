import type { Coord, Game, Unit } from '../types.js';
import type { DosComputerGrade } from './classic-grades.js';
import { classicRouteStep } from './classic-path.js';
import { directions } from '../world.js';

function chebyshev(a: Coord, b: Coord): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/** ALG-AI-001 escort: seek a legal tile within one step of the escort target. */
export function classicEscortStep(game: Game, unit: Unit, grade: DosComputerGrade): Coord | null {
  const order = unit.order;
  if (order.kind !== 'escort') return null;
  const target = game.units.find(t => t.id === order.targetId && t.owner === unit.owner && !t.aboard);
  if (!target) return null;
  if (chebyshev(unit.position, target.position) <= 1) return null;
  const stations = directions
    .map(d => ({ x: target.position.x + d.x, y: target.position.y + d.y }))
    .sort(
      (a, b) =>
        chebyshev(a, unit.position) - chebyshev(b, unit.position) ||
        a.x - b.x ||
        a.y - b.y,
    );
  for (const station of stations) {
    const step = classicRouteStep(game, unit, station, grade);
    if (step) return step;
  }
  return null;
}