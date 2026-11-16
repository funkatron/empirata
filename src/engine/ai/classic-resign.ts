import type { FactionId, Game } from '../types.js';
import { resolveAiPolicy } from './policy.js';

export function livingFactions(game: Game): FactionId[] {
  const alive = new Set<FactionId>();
  for (const city of game.cities) if (city.owner) alive.add(city.owner);
  for (const unit of game.units) if (!unit.aboard) alive.add(unit.owner);
  return [...alive].sort();
}

export function humanFactionCount(game: Game): number {
  if (resolveAiPolicy(game).kind !== 'classic-dos') return game.players.length;
  return Math.max(0, game.players.length - 1);
}

export function classicResignCityShare(game: Game, faction: FactionId): number {
  const owned = game.cities.filter(c => c.owner === faction).length;
  return game.cities.length ? owned / game.cities.length : 0;
}

/** ALG-AI-004 predicate table (no UI accept/decline yet). */
export function shouldOfferClassicResign(game: Game, computer: FactionId): boolean {
  if (resolveAiPolicy(game).kind !== 'classic-dos') return false;
  if (humanFactionCount(game) !== 1) return false;
  if (livingFactions(game).length !== 2) return false;
  if (game.round <= 100) return false;
  if (game.classicResignOffered?.[computer]) return false;
  return classicResignCityShare(game, computer) < 0.25;
}

export function humanRecipients(game: Game, computer: FactionId): FactionId[] {
  return game.players.map(p => p.id).filter(id => id !== computer);
}