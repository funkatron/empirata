import type { Coord, Game, Unit } from './types.js';
import { classicEscortNavigationGoal } from './ai/classic-escort.js';
import { classicRoutePath } from './ai/classic-path.js';
import { isClassicDosPolicy, resolveAiPolicy } from './ai/policy.js';
import { knowledgeRoutePath } from './game.js';
import { equal } from './world.js';

function chebyshev(a: Coord, b: Coord): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

function nearestFriendlyCityPosition(game: Game, owner: Unit['owner'], near: Coord): Coord | null {
  const homes = game.cities
    .filter(c => c.owner === owner)
    .sort(
      (a, b) =>
        chebyshev(a.position, near) - chebyshev(b.position, near) || a.id.localeCompare(b.id),
    );
  return homes[0]?.position ?? null;
}

/** Map markers for standing orders (spectator overlay). */
export function unitOrderGoals(game: Game, unit: Unit): Coord[] {
  const order = unit.order;
  switch (order.kind) {
    case 'move-to':
      return [{ ...order.destination }];
    case 'patrol':
      return [{ ...order.from }, { ...order.to }];
    case 'go-direction':
      return [
        {
          x: unit.position.x + order.direction.x,
          y: unit.position.y + order.direction.y,
        },
      ];
    case 'go-home': {
      const home = nearestFriendlyCityPosition(game, unit.owner, unit.position);
      return home ? [{ ...home }] : [];
    }
    case 'escort': {
      const target = game.units.find(t => t.id === order.targetId && t.owner === unit.owner && !t.aboard);
      if (!target) return [];
      const goals: Coord[] = [{ ...target.position }];
      const policy = resolveAiPolicy(game);
      if (isClassicDosPolicy(policy)) {
        const nav = classicEscortNavigationGoal(game, unit, target, policy.grade);
        if (nav.goal && !equal(nav.goal, target.position)) goals.push({ ...nav.goal });
      }
      return goals;
    }
    default:
      return [];
  }
}

function unitPathDestination(game: Game, unit: Unit): Coord | null {
  const order = unit.order;
  switch (order.kind) {
    case 'move-to':
      return { ...order.destination };
    case 'go-home': {
      const home = nearestFriendlyCityPosition(game, unit.owner, unit.position);
      return home ? { ...home } : null;
    }
    case 'patrol':
      return order.outbound ? { ...order.to } : { ...order.from };
    case 'escort': {
      const target = game.units.find(t => t.id === order.targetId && t.owner === unit.owner && !t.aboard);
      if (!target) return null;
      const policy = resolveAiPolicy(game);
      if (isClassicDosPolicy(policy)) {
        return classicEscortNavigationGoal(game, unit, target, policy.grade).goal;
      }
      return { ...target.position };
    }
    default:
      return null;
  }
}

/** Intended route on the unit owner's chart/knowledge (diagnostic overlay). */
export function unitOrderPath(game: Game, unit: Unit): Coord[] | null {
  const dest = unitPathDestination(game, unit);
  if (!dest) return null;
  const policy = resolveAiPolicy(game);
  if (isClassicDosPolicy(policy)) return classicRoutePath(game, unit, dest, policy.grade);
  return knowledgeRoutePath(game, unit, dest);
}