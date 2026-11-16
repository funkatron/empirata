import type { FactionId, Game } from '../types.js';
import type { AiPolicy } from './classic-grades.js';
import { resolveAiPolicy } from './policy.js';

export type ClassicAiGameOps = {
  log: (g: Game, recipient: FactionId | null, kind: Game['events'][number]['kind'], message: string) => void;
};

export function createClassicAiExecutor(ops: ClassicAiGameOps) {
  function stagedClassicTurn(game: Game, faction: FactionId, policy: Extract<AiPolicy, { kind: 'classic-dos' }>): Game {
    const g = structuredClone(game);
    ops.log(
      g,
      faction,
      'system',
      `Classic DOS AI (grade ${policy.grade}) is staged; no computer orders executed yet.`,
    );
    return g;
  }

  function playAiOpponent(game: Game, faction: FactionId): Game {
    if (game.active !== faction) throw new Error('AI must act during its faction turn.');
    const policy = resolveAiPolicy(game);
    if (policy.kind !== 'classic-dos') {
      throw new Error('Classic executor invoked for a non-classic policy.');
    }
    return stagedClassicTurn(game, faction, policy);
  }

  return { playAiOpponent };
}