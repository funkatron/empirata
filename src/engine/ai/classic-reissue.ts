import type { FactionId, Game, PlayerView, Unit } from '../types.js';
import type { UnitOrder } from '../types.js';
import { classicFighterMoveToExhausted } from './classic-order-tick.js';

/**
 * ALG-AI-001 `0x4462` staging: assign a charted move-to before random bearing when idle.
 * `view` may be a getter so callers skip building a PlayerView for units that never need it
 * (only idle armies read it).
 */
export function classicTacticalReissueOrder(
  game: Game,
  view: PlayerView | (() => PlayerView),
  faction: FactionId,
  unit: Unit,
): UnitOrder | null {
  if (unit.aboard) return null;
  if (unit.order.kind === 'move-to' || unit.order.kind === 'go-home' || unit.order.kind === 'escort') {
    return null;
  }
  if (unit.order.kind === 'patrol' || unit.order.kind === 'load-ship' || unit.order.kind === 'sentry') {
    return null;
  }
  if (unit.kind === 'fighter' && classicFighterMoveToExhausted(unit)) {
    return { kind: 'go-home' };
  }
  // Armies: the DOS type reissue `0x1F238` lives in `classicArmyActivation` (classic-army.ts).
  void view;
  return null;
}