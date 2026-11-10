import type { Game, Unit } from './types.js';
import { capacity } from './units.js';

/**
 * ALG-011: keep the highest occupied unit-slot indices when a damaged ship
 * cannot carry all of its cargo. Empirata's unit-array order is its current
 * slot-order approximation; explicit DOS slot reuse is not yet modeled.
 * Mutates the supplied cloned game; does not consume RNG.
 */
export function resolveCargoOverload(game: Game, ship: Unit): string[] {
  if (ship.kind !== 'transport' && ship.kind !== 'carrier') return [];
  const limit = capacity(ship) ?? 0;
  const cargoKind = ship.kind === 'transport' ? 'army' : 'fighter';
  const indexed = game.units.map((unit, index) => ({unit, index}))
    .filter(({unit}) => unit.aboard === ship.id && unit.kind === cargoKind)
    .sort((a,b) => b.index - a.index);
  const doomed = new Set(indexed.slice(limit).map(({unit}) => unit.id));
  if (!doomed.size) return [];
  game.units = game.units.filter(unit => !doomed.has(unit.id));
  return [...doomed];
}
