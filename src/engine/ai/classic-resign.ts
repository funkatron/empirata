import type { FactionId, Game } from '../types.js';
import { updateAllKnowledge } from '../knowledge.js';
import { resolveAiPolicy } from './policy.js';

function clone(game: Game): Game {
  return structuredClone(game);
}

function logSystem(g: Game, recipient: FactionId | null, message: string): void {
  g.events.push({ id: g.nextEventId++, round: g.round, recipient, kind: 'system', message });
  if (g.events.length > 300) g.events.shift();
}

export function livingFactions(game: Game): FactionId[] {
  const alive = new Set<FactionId>();
  for (const city of game.cities) if (city.owner) alive.add(city.owner);
  for (const unit of game.units) if (!unit.aboard) alive.add(unit.owner);
  return [...alive].sort();
}

export function humanFactionCount(game: Game): number {
  if (game.scenario === 'ai-vs-ai') return 0;
  if (resolveAiPolicy(game).kind !== 'classic-dos') return game.players.length;
  return Math.max(0, game.players.length - 1);
}

export function classicResignCityShare(game: Game, faction: FactionId): number {
  const owned = game.cities.filter(c => c.owner === faction).length;
  return game.cities.length ? owned / game.cities.length : 0;
}

/**
 * ALG-AI-004 city tally (`0xDF58`, compare at `0xE12D–0xE142`) [D]: the computer's cities plus
 * neutral (owner 0) cities must be below `cityCount >> 2`. Owner 0's tally is zeroed before the
 * count (`0xDF5F–0xDF78`), so neutral cities always count.
 */
export function classicResignCityTally(game: Game, faction: FactionId): { tally: number; threshold: number } {
  let tally = 0;
  for (const c of game.cities) if (c.owner === faction || c.owner === null) tally++;
  return { tally, threshold: game.cities.length >> 2 };
}

/** ALG-AI-004 predicate table. */
export function shouldOfferClassicResign(game: Game, computer: FactionId): boolean {
  if (game.scenario === 'ai-vs-ai') return false;
  if (resolveAiPolicy(game).kind !== 'classic-dos') return false;
  if (humanFactionCount(game) !== 1) return false;
  if (livingFactions(game).length !== 2) return false;
  if (game.round <= 100) return false;
  if (game.classicResignOffered?.[computer]) return false;
  const { tally, threshold } = classicResignCityTally(game, computer);
  return tally < threshold;
}

export function humanRecipients(game: Game, computer: FactionId): FactionId[] {
  return game.players.map(p => p.id).filter(id => id !== computer);
}

export function classicResignPendingFor(game: Game, faction: FactionId): FactionId | null {
  const pending = game.classicResignPending;
  if (!pending || pending.human !== faction) return null;
  return pending.computer;
}

export function hasBlockingClassicResign(game: Game): boolean {
  return game.classicResignPending !== null && game.classicResignPending !== undefined;
}

/** Accept: transfer computer cities to the human and remove computer units (DOS elimination bookkeeping). */
export function respondClassicResign(game: Game, accept: boolean): Game {
  const pending = game.classicResignPending;
  if (!pending) throw new Error('No classic resign offer is pending.');
  if (resolveAiPolicy(game).kind !== 'classic-dos') throw new Error('Classic resign only applies to classic DOS policy.');
  const g = clone(game);
  const { computer, human } = pending;
  delete g.classicResignPending;
  if (accept) {
    let cities = 0;
    for (const city of g.cities) {
      if (city.owner === computer) {
        city.owner = human;
        cities++;
      }
    }
    const removed = g.units.filter(u => u.owner === computer).length;
    g.units = g.units.filter(u => u.owner !== computer);
    logSystem(
      g,
      human,
      `You accepted the resignation. ${cities} cities and the remaining computer forces (${removed} units) are removed from play.`,
    );
    logSystem(g, null, `${computer.toUpperCase()} resigned; ${human.toUpperCase()} assumes their cities.`);
  } else {
    logSystem(g, human, 'You declined the resignation. The computer will fight on.');
  }
  updateAllKnowledge(g);
  return g;
}