import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classicArmyConquestStep,
  classicHomeRepairStep,
  classicMoveToStep,
  classicPatrolStep,
  classicRoutePath,
  classicUnitView,
  embarkedCargoCount,
  getPlayerView,
  makeRulesLab,
} from '../dist/engine/index.js';

// Focused coverage for ALG-AI-001 helpers in classic-move.ts and classic-path.ts.
// Rim-bearing behavior lives in alg-ai-001-rim.test.mjs (DOS ring, #192).
// Fixtures chart terrain and city intel directly so results depend only on the
// faction's PlayerView, never on live omniscient state.

const chebyshev = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

function army(id, position, extra = {}) {
  return {
    id,
    owner: 'blue',
    kind: 'army',
    position,
    damage: 0,
    spent: 0,
    fuel: null,
    order: { kind: 'none' },
    aboard: null,
    ...extra,
  };
}

function city(id, position, owner) {
  return { id, position, owner, production: null, progress: 0, firstCycle: true };
}

/** Blank rules lab: one terrain type, no cities or units, Blue active. */
function blankLab(terrain = 'land') {
  const g = makeRulesLab();
  g.tiles.fill(terrain);
  g.cities = [];
  g.units = [];
  g.active = 'blue';
  return g;
}

/** Give `faction` a full chart of terrain and city ownership (no live unit sight). */
function chartAll(g, faction = 'blue') {
  const k = g.knowledge[faction];
  k.terrain = [...g.tiles];
  k.cities = {};
  for (const c of g.cities) {
    k.cities[c.id] = { id: c.id, owner: c.owner, production: null, productionKnown: false };
  }
  k.sightings = [];
  k.freshEnemies = [];
}

/** Sea everywhere except a one-tile land corridor on row y from x0 to x1. */
function corridorLab(y, x0, x1) {
  const g = blankLab('sea');
  for (let x = x0; x <= x1; x++) g.tiles[y * g.width + x] = 'land';
  return g;
}

// ---- classicArmyConquestStep: chart-limited BFS -------------------------------

test('conquest step walks a land corridor toward a distant charted neutral city', () => {
  const g = corridorLab(10, 10, 15);
  g.cities = [city('n1', { x: 15, y: 10 }, null)];
  const a = army('a1', { x: 10, y: 10 });
  g.units = [a];
  chartAll(g);
  const step = classicArmyConquestStep(g, getPlayerView(g, 'blue'), 'blue', a, 1);
  assert.deepEqual(step, { x: 11, y: 10 });
});

test('conquest step in open land moves one tile closer to the target', () => {
  const g = blankLab('land');
  g.cities = [city('n1', { x: 20, y: 10 }, null)];
  const a = army('a1', { x: 10, y: 10 });
  g.units = [a];
  chartAll(g);
  const step = classicArmyConquestStep(g, getPlayerView(g, 'blue'), 'blue', a, 1);
  assert.ok(step);
  assert.equal(chebyshev(step, a.position), 1);
  assert.equal(chebyshev(step, { x: 20, y: 10 }), 9);
});

test('conquest step is blocked by a friendly unit in a one-tile corridor', () => {
  const g = corridorLab(10, 10, 15);
  g.cities = [city('n1', { x: 15, y: 10 }, null)];
  const a = army('a1', { x: 10, y: 10 });
  g.units = [a, army('a2', { x: 12, y: 10 })];
  chartAll(g);
  assert.equal(classicArmyConquestStep(g, getPlayerView(g, 'blue'), 'blue', a, 1), null);
});

test('embarked friendly units do not block the conquest corridor', () => {
  const g = corridorLab(10, 10, 15);
  g.cities = [city('n1', { x: 15, y: 10 }, null)];
  const a = army('a1', { x: 10, y: 10 });
  g.units = [a, army('a2', { x: 12, y: 10 }, { aboard: 't1' })];
  chartAll(g);
  assert.deepEqual(classicArmyConquestStep(g, getPlayerView(g, 'blue'), 'blue', a, 1), { x: 11, y: 10 });
});

test('fresh enemy sightings block the corridor; stale sightings do not', () => {
  const g = corridorLab(10, 10, 15);
  g.cities = [city('n1', { x: 15, y: 10 }, null)];
  const a = army('a1', { x: 10, y: 10 });
  g.units = [a];
  chartAll(g);
  g.knowledge.blue.sightings = [
    { id: 'r1', kind: 'army', owner: 'red', position: { x: 12, y: 10 }, observedRound: g.round },
  ];
  g.knowledge.blue.freshEnemies = ['r1'];
  assert.equal(classicArmyConquestStep(g, getPlayerView(g, 'blue'), 'blue', a, 1), null);
  g.knowledge.blue.freshEnemies = [];
  assert.deepEqual(classicArmyConquestStep(g, getPlayerView(g, 'blue'), 'blue', a, 1), { x: 11, y: 10 });
});

test('uncharted terrain is not routed through', () => {
  const g = corridorLab(10, 10, 15);
  g.cities = [city('n1', { x: 15, y: 10 }, null)];
  const a = army('a1', { x: 10, y: 10 });
  g.units = [a];
  chartAll(g);
  g.knowledge.blue.terrain[10 * g.width + 12] = null;
  assert.equal(classicArmyConquestStep(g, getPlayerView(g, 'blue'), 'blue', a, 1), null);
});

test('conquest step ignores friendly cities and returns null with no hostile targets', () => {
  const g = corridorLab(10, 10, 15);
  g.cities = [city('b1', { x: 15, y: 10 }, 'blue')];
  const a = army('a1', { x: 10, y: 10 });
  g.units = [a];
  chartAll(g);
  assert.equal(classicArmyConquestStep(g, getPlayerView(g, 'blue'), 'blue', a, 1), null);
});

test('conquest step declines non-army and embarked units', () => {
  const g = corridorLab(10, 10, 15);
  g.cities = [city('n1', { x: 15, y: 10 }, null)];
  const embarked = army('a1', { x: 10, y: 10 }, { aboard: 't1' });
  const fighter = army('f1', { x: 10, y: 10 }, { kind: 'fighter', fuel: 20 });
  g.units = [embarked, fighter];
  chartAll(g);
  const view = getPlayerView(g, 'blue');
  assert.equal(classicArmyConquestStep(g, view, 'blue', embarked, 1), null);
  assert.equal(classicArmyConquestStep(g, view, 'blue', fighter, 1), null);
});

// ---- Patrol, Move To and home-repair steps ------------------------------------

test('classicPatrolStep heads to `to` outbound, `from` inbound, and stops at the endpoint', () => {
  const g = corridorLab(10, 5, 15);
  const from = { x: 5, y: 10 };
  const to = { x: 15, y: 10 };
  const a = army('a1', { x: 10, y: 10 }, { order: { kind: 'patrol', from, to, outbound: true } });
  g.units = [a];
  chartAll(g);
  assert.deepEqual(classicPatrolStep(g, a, 1), { x: 11, y: 10 });
  a.order = { ...a.order, outbound: false };
  assert.deepEqual(classicPatrolStep(g, a, 1), { x: 9, y: 10 });
  a.position = { ...from };
  assert.equal(classicPatrolStep(g, a, 1), null);
  a.order = { kind: 'none' };
  assert.equal(classicPatrolStep(g, a, 1), null);
});

test('classicMoveToStep uses the injected routeStep when no grade is given', () => {
  const g = blankLab('land');
  const dest = { x: 20, y: 10 };
  const a = army('a1', { x: 10, y: 10 }, { order: { kind: 'move-to', destination: dest } });
  g.units = [a];
  const calls = [];
  const routeStep = (_game, unit, destination) => {
    calls.push([unit.id, destination]);
    return { x: 99, y: 99 };
  };
  assert.deepEqual(classicMoveToStep(g, a, routeStep), { x: 99, y: 99 });
  assert.deepEqual(calls, [['a1', dest]]);
  a.position = { ...dest };
  assert.equal(classicMoveToStep(g, a, routeStep), null);
  assert.equal(calls.length, 1);
});

test('classicHomeRepairStep tries the nearest friendly city first, then falls back', () => {
  const g = blankLab('land');
  const near = city('b-near', { x: 12, y: 10 }, 'blue');
  const far = city('b-far', { x: 30, y: 10 }, 'blue');
  g.cities = [far, near, city('r1', { x: 11, y: 10 }, 'red')];
  const a = army('a1', { x: 10, y: 10 });
  g.units = [a];
  const tried = [];
  const routeStep = (_game, _unit, destination) => {
    tried.push(destination);
    return destination.x === far.position.x ? { x: 11, y: 11 } : null;
  };
  assert.deepEqual(classicHomeRepairStep(g, a, routeStep), { x: 11, y: 11 });
  assert.deepEqual(tried, [near.position, far.position]);
});

test('classicHomeRepairStep returns null with no reachable friendly city', () => {
  const g = blankLab('land');
  const a = army('a1', { x: 10, y: 10 });
  g.units = [a];
  assert.equal(classicHomeRepairStep(g, a, () => ({ x: 0, y: 0 })), null);
  g.cities = [city('b1', { x: 12, y: 10 }, 'blue')];
  assert.equal(classicHomeRepairStep(g, a, () => null), null);
});

test('classicHomeRepairStep with a grade routes on the chart toward the nearest city', () => {
  const g = corridorLab(10, 5, 15);
  g.cities = [city('b1', { x: 14, y: 10 }, 'blue'), city('b2', { x: 5, y: 10 }, 'blue')];
  const a = army('a1', { x: 11, y: 10 });
  g.units = [a];
  chartAll(g);
  assert.deepEqual(classicHomeRepairStep(g, a, () => null, 1), { x: 12, y: 10 });
});

test('embarkedCargoCount and classicUnitView reflect the faction state', () => {
  const g = blankLab('land');
  g.units = [
    army('a1', { x: 10, y: 10 }, { aboard: 't1' }),
    army('a2', { x: 10, y: 10 }, { aboard: 't1' }),
    army('a3', { x: 11, y: 10 }, { aboard: 't2' }),
    army('a4', { x: 12, y: 10 }),
  ];
  assert.equal(embarkedCargoCount(g, 't1'), 2);
  assert.equal(embarkedCargoCount(g, 'none'), 0);
  const view = classicUnitView(g, 'blue');
  assert.deepEqual(view.ownUnits.map(u => u.id).sort(), ['a1', 'a2', 'a3', 'a4']);
});

// ---- classicRoutePath: UI goal overlay ----------------------------------------

test('classicRoutePath returns only the start when already at the destination', () => {
  const g = blankLab('land');
  const a = army('a1', { x: 10, y: 10 });
  g.units = [a];
  chartAll(g);
  assert.deepEqual(classicRoutePath(g, a, { x: 10, y: 10 }, 1), [{ x: 10, y: 10 }]);
});

test('classicRoutePath returns a contiguous shortest path over charted land', () => {
  const g = blankLab('land');
  const a = army('a1', { x: 10, y: 10 });
  const dest = { x: 16, y: 13 };
  g.units = [a];
  chartAll(g);
  const path = classicRoutePath(g, a, dest, 1);
  assert.ok(path);
  assert.deepEqual(path[0], a.position);
  assert.deepEqual(path.at(-1), dest);
  assert.equal(path.length, chebyshev(a.position, dest) + 1);
  for (let i = 1; i < path.length; i++) assert.equal(chebyshev(path[i - 1], path[i]), 1);
});

test('classicRoutePath follows a corridor and fails when the corridor is cut', () => {
  const g = corridorLab(10, 10, 15);
  const a = army('a1', { x: 10, y: 10 });
  g.units = [a];
  chartAll(g);
  const path = classicRoutePath(g, a, { x: 15, y: 10 }, 1);
  assert.deepEqual(path, [10, 11, 12, 13, 14, 15].map(x => ({ x, y: 10 })));
  g.knowledge.blue.terrain[10 * g.width + 12] = null;
  assert.equal(classicRoutePath(g, a, { x: 15, y: 10 }, 1), null);
});
