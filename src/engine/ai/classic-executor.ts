import type { Coord, FactionId, Game, Unit, UnitType } from '../types.js';
import type { AiPolicy } from './classic-grades.js';
import { chooseClassicCityProduction } from './classic-production.js';
import { classicHomeRepairStep, classicMoveToStep, embarkedCargoCount } from './classic-move.js';
import {
  classicDamagedShipSeeksPort,
  classicRandomOrderTick,
  classicSentryEngageTarget,
  classicStandingOrderTick,
} from './classic-order-tick.js';
import { directions } from '../world.js';
import { getPlayerView } from '../knowledge.js';
import { humanRecipients, shouldOfferClassicResign } from './classic-resign.js';
import { resolveAiPolicy } from './policy.js';

export type ClassicAiGameOps = {
  moveUnit: (game: Game, id: string, to: Coord, protectedCargo: ReadonlySet<string>, mutable: boolean) => Game;
  setOrder: (game: Game, unitId: string, order: import('../types.js').UnitOrder, mutable?: boolean) => Game;
  selectProduction: (game: Game, cityId: string, kind: UnitType, mutable?: boolean) => Game;
  routeStep: (game: Game, unit: Unit, destination: Coord) => Coord | null;
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
    let g = runAlgAi002Production(game, faction, policy);
    g = runAlgAi001Tranche(g, faction, policy);
    g = maybeOfferClassicResign(g, faction);
    return g;
  }

  function runAlgAi002Production(
    game: Game,
    faction: FactionId,
    policy: Extract<AiPolicy, { kind: 'classic-dos' }>,
  ): Game {
    let g = clone(game);
    for (const city of g.cities.filter(c => c.owner === faction)) {
      const pick = chooseClassicCityProduction(g, faction, city, policy.grade);
      if (city.production !== pick) g = ops.selectProduction(g, city.id, pick, true);
    }
    return g;
  }

  function runAlgAi001Tranche(game: Game, faction: FactionId, policy: Extract<AiPolicy, { kind: 'classic-dos' }>): Game {
    let g = clone(game);
    const protectedCargo = new Set<string>();
    const actives = () => g.units.filter(u => u.owner === faction && !u.aboard).sort((a, b) => a.id.localeCompare(b.id));
    for (const unit of actives()) {
      const view = getPlayerView(g, faction);
      const fresh = g.units.find(u => u.id === unit.id);
      if (!fresh) continue;
      const hadRandom = fresh.order.kind === 'random';
      const hadGoHome = fresh.order.kind === 'go-home';
      const moveToDestination = fresh.order.kind === 'move-to' ? fresh.order.destination : null;
      const hadMoveTo = moveToDestination !== null;
      const cargo = embarkedCargoCount(g, unit.id);
      let step: Coord | null = null;
      if (classicDamagedShipSeeksPort(fresh, cargo)) {
        g = ops.setOrder(g, unit.id, { kind: 'go-home' }, true);
        const ship = g.units.find(u => u.id === unit.id);
        if (ship) step = classicHomeRepairStep(g, ship, ops.routeStep);
      } else {
        step = classicSentryEngageTarget(view, fresh);
        if (step) g = ops.setOrder(g, unit.id, { kind: 'none' }, true);
        if (!step) {
          const ship = g.units.find(u => u.id === unit.id);
          if (ship?.order.kind === 'go-home') step = classicHomeRepairStep(g, ship, ops.routeStep);
          else if (ship) step = classicMoveToStep(g, ship, ops.routeStep);
        }
        if (!step) {
          if (fresh.order.kind === 'random') {
            const rotated = classicRandomOrderTick(g, fresh);
            g = rotated.game;
            g = ops.setOrder(g, unit.id, { kind: 'go-direction', direction: { ...directions[rotated.directionIndex]! } }, true);
            const positioned = g.units.find(u => u.id === unit.id);
            if (positioned) {
              const bearing = directions[rotated.directionIndex]!;
              step = { x: positioned.position.x + bearing.x, y: positioned.position.y + bearing.y };
            }
          } else {
            const tick = classicStandingOrderTick(fresh.order);
            if (tick?.kind === 'bear') {
              g = ops.setOrder(g, unit.id, { kind: 'go-direction', direction: { ...tick.direction } }, true);
              const positioned = g.units.find(u => u.id === unit.id);
              if (positioned) {
                step = {
                  x: positioned.position.x + tick.direction.x,
                  y: positioned.position.y + tick.direction.y,
                };
              }
            }
          }
        }
      }
      if (!step) continue;
      try {
        g = ops.moveUnit(g, unit.id, step, protectedCargo, true);
        if (hadRandom) g = ops.setOrder(g, unit.id, { kind: 'random' }, true);
        else if (hadGoHome) g = ops.setOrder(g, unit.id, { kind: 'go-home' }, true);
        else if (hadMoveTo && moveToDestination)
          g = ops.setOrder(g, unit.id, { kind: 'move-to', destination: moveToDestination }, true);
      } catch {
        /* Illegal classic step — leave bearing for standing-order phase. */
      }
    }
    ops.log(
      g,
      faction,
      'system',
      `Classic DOS AI (grade ${policy.grade}): ALG-AI-002 production + ALG-AI-001 activation pass.`,
    );
    return g;
  }

  function maybeOfferClassicResign(game: Game, computer: FactionId): Game {
    if (!shouldOfferClassicResign(game, computer)) return game;
    const g = clone(game);
    g.classicResignOffered = { ...g.classicResignOffered, [computer]: true };
    const message = 'The computer wishes to resign. (Accept/decline UI not yet wired.)';
    for (const recipient of humanRecipients(g, computer)) {
      ops.log(g, recipient, 'system', message);
    }
  return g;
  }

  return { playAiOpponent };
}