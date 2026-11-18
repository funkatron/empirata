import type { Coord, FactionId, Game, Unit, UnitType } from '../types.js';
import type { AiPolicy } from './classic-grades.js';
import {
  chooseClassicCityProduction,
  classicInventoryBlock0x30EB,
  legalizeClassicProductionForCity,
} from './classic-production.js';
import { classicEscortStep } from './classic-escort.js';
import {
  classicArmyConquestStep,
  classicHomeRepairStep,
  classicMoveToStep,
  classicPatrolStep,
  embarkedCargoCount,
} from './classic-move.js';
import {
  classicArmyPortEmbarkStep,
  classicEmptyTransportPortStep,
  classicOffshoreObjectives,
  classicTransportLandingChoice,
  classicTransportObjective,
  classicTransportSeaStep,
} from './classic-amphibious.js';
import { classicTacticalReissueOrder } from './classic-reissue.js';
import { classicLegalDirectionStep } from './classic-path.js';
import {
  classicDamagedShipSeeksPort,
  classicFighterMoveToExhausted,
  classicRandomOrderTick,
  classicSanitizeTransportOrder,
  classicSentryEngageTarget,
  classicStandingOrderTick,
} from './classic-order-tick.js';
import { directions } from '../world.js';
import { getPlayerView } from '../knowledge.js';
import { humanRecipients, shouldOfferClassicResign } from './classic-resign.js';
import { resolveAiPolicy } from './policy.js';

export type ClassicAiGameOps = {
  moveUnit: (game: Game, id: string, to: Coord, protectedCargo: ReadonlySet<string>, mutable: boolean) => Game;
  disembarkArmy: (game: Game, armyId: string, to: Coord, mutable?: boolean) => Game;
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
    const owned = g.cities.filter(c => c.owner === faction).sort((a, b) => b.id.localeCompare(a.id));
    for (const city of owned) {
      const inventory = classicInventoryBlock0x30EB(g, faction);
      const pick = legalizeClassicProductionForCity(
        g,
        city,
        chooseClassicCityProduction(g, faction, city, policy.grade, inventory),
      );
      if (city.production !== pick) g = ops.selectProduction(g, city.id, pick, true);
    }
    return g;
  }

  function runAlgAi001Tranche(game: Game, faction: FactionId, policy: Extract<AiPolicy, { kind: 'classic-dos' }>): Game {
    let g = clone(game);
    const protectedCargo = new Set<string>();
    const actives = () => g.units.filter(u => u.owner === faction && !u.aboard).sort((a, b) => a.id.localeCompare(b.id));
    for (const unit of actives()) {
      const fresh = g.units.find(u => u.id === unit.id);
      if (!fresh) continue;
      const hadRandom = fresh.order.kind === 'random';
      const hadGoHome = fresh.order.kind === 'go-home';
      const moveToDestination = fresh.order.kind === 'move-to' ? fresh.order.destination : null;
      const hadMoveTo = moveToDestination !== null;
      const cargo = embarkedCargoCount(g, unit.id);
      const grade = policy.grade;
      const sanitized = classicSanitizeTransportOrder(fresh, cargo);
      if (sanitized) g = ops.setOrder(g, unit.id, sanitized, true);
      let current = g.units.find(u => u.id === unit.id);
      if (!current) continue;
      const reissue = classicTacticalReissueOrder(g, getPlayerView(g, faction), faction, current);
      if (reissue) {
        g = ops.setOrder(g, unit.id, reissue, true);
        current = g.units.find(u => u.id === unit.id);
      }
      if (!current || current.order.kind === 'load-ship') continue;
      const view = getPlayerView(g, faction);
      const landing = current.kind === 'transport' ? classicTransportLandingChoice(g, view, current) : null;
      if (landing?.kind === 'disembark') {
        try {
          g = ops.disembarkArmy(g, landing.armyId, landing.to, true);
          continue;
        } catch {
          /* Try sea movement this activation. */
        }
      }
      let step: Coord | null = null;
      if (classicFighterMoveToExhausted(current)) {
        g = ops.setOrder(g, unit.id, { kind: 'go-home' }, true);
      }
      if (classicDamagedShipSeeksPort(current, cargo)) {
        g = ops.setOrder(g, unit.id, { kind: 'go-home' }, true);
        const ship = g.units.find(u => u.id === unit.id);
        if (ship) step = classicHomeRepairStep(g, ship, ops.routeStep, grade);
      } else {
        step = classicSentryEngageTarget(view, current);
        if (step) g = ops.setOrder(g, unit.id, { kind: 'none' }, true);
        if (!step) {
          const ship = g.units.find(u => u.id === unit.id);
          if (ship?.order.kind === 'go-home') step = classicHomeRepairStep(g, ship, ops.routeStep, grade);
          else if (ship?.order.kind === 'escort') step = classicEscortStep(g, ship, grade);
          else if (ship?.order.kind === 'patrol') step = classicPatrolStep(g, ship, grade);
          else if (current.kind === 'army') {
            step = classicArmyPortEmbarkStep(g, view, current);
            if (!step) step = classicArmyConquestStep(g, view, faction, current, grade);
          } else if (current.kind === 'transport') {
            const cargo = embarkedCargoCount(g, current.id);
            const objective =
              cargo > 0 ? classicTransportObjective(g, view, faction, current) : null;
            if (cargo > 0 && objective) {
              step = classicTransportSeaStep(g, view, faction, current, grade, objective);
            } else if (cargo === 0 && classicOffshoreObjectives(g, view, faction).length) {
              step = classicEmptyTransportPortStep(g, faction, current, grade);
            }
          } else if (ship) step = classicMoveToStep(g, ship, ops.routeStep, grade);
        }
        if (!step) {
          if (current.order.kind === 'random') {
            const rotated = classicRandomOrderTick(g, current);
            g = rotated.game;
            g = ops.setOrder(g, unit.id, { kind: 'go-direction', direction: { ...directions[rotated.directionIndex]! } }, true);
            const positioned = g.units.find(u => u.id === unit.id);
            if (positioned) step = classicLegalDirectionStep(g, positioned, rotated.directionIndex, grade);
          } else {
            const tick = classicStandingOrderTick(current.order);
            if (tick?.kind === 'bear') {
              g = ops.setOrder(g, unit.id, { kind: 'go-direction', direction: { ...tick.direction } }, true);
              const positioned = g.units.find(u => u.id === unit.id);
              if (positioned) {
                const idx = directions.findIndex(
                  d => d.x === tick.direction.x && d.y === tick.direction.y,
                );
                step = classicLegalDirectionStep(g, positioned, idx >= 0 ? idx : 1, grade);
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
    if (game.classicResignPending) return game;
    const g = clone(game);
    g.classicResignOffered = { ...g.classicResignOffered, [computer]: true };
    const humans = humanRecipients(g, computer);
    const human = humans[0];
    if (!human) return g;
    g.classicResignPending = { computer, human, round: g.round };
    const message = 'The computer wishes to resign! Accept or decline when prompted.';
    for (const recipient of humans) {
      ops.log(g, recipient, 'system', message);
    }
    return g;
  }

  return { playAiOpponent };
}