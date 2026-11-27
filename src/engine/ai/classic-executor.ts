import type { Coord, FactionId, Game, PlayerView, Unit, UnitType } from '../types.js';
import type { AiPolicy } from './classic-grades.js';
import {
  chooseClassicCityProduction,
  classicInventoryBlock0x30EB,
  legalizeClassicProductionForCity,
} from './classic-production.js';
import { classicEscortStep } from './classic-escort.js';
import {
  classicHomeRepairStep,
  classicIdleNoneStep,
  classicMoveToStep,
  classicPatrolStep,
  embarkedCargoCount,
} from './classic-move.js';
import {
  classicEmptyTransportPortStep,
  classicOffshoreObjectives,
  classicTransportLandingChoice,
  classicTransportObjective,
  classicTransportSeaStep,
} from './classic-amphibious.js';
import { classicTacticalReissueOrder } from './classic-reissue.js';
import { classicArmyActivation, classicArmyBoardingClaim } from './classic-army.js';
import { classicResolveLegalDirection, classicRouteStep } from './classic-path.js';
import {
  classicAdvanceBearingWhenBlocked,
  classicDamagedShipSeeksPort,
  classicFighterMoveToExhausted,
  classicRandomOrderTick,
  classicSanitizeTransportOrder,
  classicSentryEngageTarget,
} from './classic-order-tick.js';
import { directions } from '../world.js';
import { getPlayerViewShared } from '../knowledge.js';
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
    // One private copy per AI turn; both passes below mutate it in place.
    let g = clone(game);
    g = runAlgAi002Production(g, faction, policy);
    g = runAlgAi001Tranche(g, faction, policy);
    g = maybeOfferClassicResign(g, faction);
    return g;
  }

  /** Mutates `turnGame` (the turn's private copy from `playAiOpponent`). */
  function runAlgAi002Production(
    turnGame: Game,
    faction: FactionId,
    policy: Extract<AiPolicy, { kind: 'classic-dos' }>,
  ): Game {
    let g = turnGame;
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

  /** Mutates `turnGame` (the turn's private copy from `playAiOpponent`). */
  function runAlgAi001Tranche(turnGame: Game, faction: FactionId, policy: Extract<AiPolicy, { kind: 'classic-dos' }>): Game {
    let g = turnGame;
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
      // Build the view only if reissue needs it (idle armies). Ops mutate `g` in place,
      // so the view is reused below only when reissue changed nothing.
      let cachedView: PlayerView | null = null;
      const reissue = classicTacticalReissueOrder(
        g,
        () => (cachedView ??= getPlayerViewShared(g, faction)),
        faction,
        current,
      );
      if (reissue) {
        g = ops.setOrder(g, unit.id, reissue, true);
        current = g.units.find(u => u.id === unit.id);
      }
      if (!current || current.order.kind === 'load-ship') continue;
      const view = !reissue && cachedView ? cachedView : getPlayerViewShared(g, faction);
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
      let wandered = false;
      let armyHandled = false;
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
          else if (ship?.order.kind === 'escort') {
            const escort = classicEscortStep(g, ship, grade);
            g = escort.game;
            step = escort.step;
          }
          else if (ship?.order.kind === 'patrol') step = classicPatrolStep(g, ship, grade);
          else if (current.kind === 'army') {
            // ALG-AI-001 army activation: dispatch, reissue `0x1F238`, picker, type step `0x1F376`.
            const army = classicArmyActivation(
              g,
              faction,
              unit.id,
              grade,
              (game, order) => ops.setOrder(game, unit.id, order, true),
              (game, army) =>
                classicArmyBoardingClaim(game, faction, army, (gg, id, order) => ops.setOrder(gg, id, order, true)),
            );
            g = army.game;
            step = army.step;
            wandered = army.wandered;
            armyHandled = true;
          } else if (current.kind === 'transport') {
            const cargo = embarkedCargoCount(g, current.id);
            const claimDest = cargo === 0 ? current.classicBoardGoal ?? null : null;
            const objective =
              cargo > 0 ? classicTransportObjective(g, view, faction, current) : null;
            if (cargo > 0 && current.classicBoardGoal) delete current.classicBoardGoal;
            if (claimDest) {
              // `0x1F6AA` claim: sail to the army; once beside it, load (Load Ship).
              const near = Math.max(Math.abs(current.position.x - claimDest.x), Math.abs(current.position.y - claimDest.y)) <= 1;
              if (near) {
                const ship = g.units.find(u => u.id === current.id);
                if (ship) delete ship.classicBoardGoal;
                g = ops.setOrder(g, current.id, { kind: 'load-ship' }, true);
                // The transport sails with what it loaded; it does not wait to fill.
                g = ops.setOrder(g, current.id, { kind: 'none' }, true);
              } else step = classicRouteStep(g, current, claimDest, grade);
            } else if (cargo > 0 && objective) {
              step = classicTransportSeaStep(g, view, faction, current, grade, objective);
            } else if (cargo === 0 && classicOffshoreObjectives(g, view, faction).length) {
              step = classicEmptyTransportPortStep(g, faction, current, grade);
            }
          } else if (ship) step = classicMoveToStep(g, ship, ops.routeStep, grade);
        }
        if (!step && !armyHandled) {
          if (current.order.kind === 'random') {
            const rotated = classicRandomOrderTick(g, current);
            g = rotated.game;
            g = ops.setOrder(g, unit.id, { kind: 'go-direction', direction: { ...directions[rotated.directionIndex]! } }, true);
            let positioned = g.units.find(u => u.id === unit.id);
            if (positioned) {
              const resolved = classicResolveLegalDirection(g, positioned, rotated.directionIndex, grade);
              if (resolved.directionIndex !== null) {
                g = ops.setOrder(
                  g,
                  unit.id,
                  { kind: 'go-direction', direction: { ...directions[resolved.directionIndex]! } },
                  true,
                );
              }
              positioned = g.units.find(u => u.id === unit.id);
              if (positioned) step = resolved.step;
              if (!step && positioned) {
                const nextIdx = classicAdvanceBearingWhenBlocked(positioned, rotated.directionIndex);
                g = ops.setOrder(
                  g,
                  unit.id,
                  { kind: 'go-direction', direction: { ...directions[nextIdx]! } },
                  true,
                );
              }
            }
          } else if (current.order.kind === 'none') {
            // DOS order 0 (None) returns status 1 → type reissue `0x4462`; there is no
            // default bearing. See agents/alg-ai-001-none-order-trace-2026-11-24.md.
            const idle = classicIdleNoneStep(g, current, grade);
            g = idle.game;
            step = idle.step;
            wandered = idle.wandered;
          }
        }
      }
      if (!wandered) {
        const live = g.units.find(u => u.id === unit.id);
        if (live?.classicWander) delete live.classicWander;
      }
      if (!step) continue;
      try {
        g = ops.moveUnit(g, unit.id, step, protectedCargo, true);
        if (hadRandom) g = ops.setOrder(g, unit.id, { kind: 'random' }, true);
        else if (hadGoHome) g = ops.setOrder(g, unit.id, { kind: 'go-home' }, true);
        else if (hadMoveTo && moveToDestination && !armyHandled)
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