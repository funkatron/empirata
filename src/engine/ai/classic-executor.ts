import type { Coord, FactionId, Game } from '../types.js';
import type { AiPolicy } from './classic-grades.js';
import { classicStandingOrderTick } from './classic-order-tick.js';
import { resolveAiPolicy } from './policy.js';

export type ClassicAiGameOps = {
  moveUnit: (game: Game, id: string, to: Coord, protectedCargo: ReadonlySet<string>, mutable: boolean) => Game;
  setOrder: (game: Game, unitId: string, order: import('../types.js').UnitOrder, mutable?: boolean) => Game;
  log: (g: Game, recipient: FactionId | null, kind: Game['events'][number]['kind'], message: string) => void;
};

function clone(g: Game): Game {
  return structuredClone(g);
}

export function createClassicAiExecutor(ops: ClassicAiGameOps) {
  function playAiOpponent(game: Game, faction: FactionId): Game {
    if (game.active !== faction) throw new Error('AI must act during its faction turn.');
    const policy = resolveAiPolicy(game);
    if (policy.kind !== 'classic-dos') throw new Error('Classic executor invoked for a non-classic policy.');
    return runAlgAi001Tranche(game, faction, policy);
  }

  function runAlgAi001Tranche(game: Game, faction: FactionId, policy: Extract<AiPolicy, { kind: 'classic-dos' }>): Game {
    let g = clone(game);
    const protectedCargo = new Set<string>();
  for (const unit of g.units.filter(u => u.owner === faction && !u.aboard)) {
      const tick = classicStandingOrderTick(unit.order);
      if (!tick || tick.kind === 'hold') continue;
      g = ops.setOrder(g, unit.id, { kind: 'go-direction', direction: { ...tick.direction } }, true);
      const fresh = g.units.find(u => u.id === unit.id);
      if (!fresh) continue;
      const step: Coord = {
        x: fresh.position.x + tick.direction.x,
        y: fresh.position.y + tick.direction.y,
      };
      try {
        g = ops.moveUnit(g, unit.id, step, protectedCargo, true);
      } catch {
        /* Illegal classic step — leave bearing for standing-order phase. */
      }
    }
    ops.log(g, faction, 'system', `Classic DOS AI (grade ${policy.grade}): ALG-AI-001 order-none bearing applied.`);
    return g;
  }

  return { playAiOpponent };
}