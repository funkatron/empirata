import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classicLegalDirectionStep,
  classicPathBudget,
  classicRouteStep,
  classicTilePassable,
  classicFighterMoveToExhausted,
  makeRulesLab,
} from '../dist/engine/index.js';

test('classicPathBudget matches min(125, 2*chebyshev+25)', () => {
  assert.equal(classicPathBudget({ x: 0, y: 0 }, { x: 10, y: 0 }), 45);
  assert.equal(classicPathBudget({ x: 0, y: 0 }, { x: 100, y: 100 }), 125);
});

test('classicTilePassable blocks enemy cities and foreign land for armies', () => {
  const g = makeRulesLab();
  const army = g.units.find(u => u.kind === 'army');
  const redCity = g.cities.find(c => c.owner === 'red');
  assert.equal(classicTilePassable(g, 'blue', army, redCity.position, 1), false);
  assert.equal(classicTilePassable(g, 'blue', army, army.position, 1), true);
});

test('classicRouteStep returns one step toward a reachable friendly city', () => {
  const g = makeRulesLab();
  const army = g.units.find(u => u.kind === 'army' && u.owner === 'blue');
  const step = classicRouteStep(g, army, g.cities.find(c => c.id === 'c-blue').position, 1);
  assert.ok(step);
  assert.ok(Math.max(Math.abs(step.x - army.position.x), Math.abs(step.y - army.position.y)) === 1);
});

test('classicLegalDirectionStep prefers a legal neighbor', () => {
  const g = makeRulesLab();
  g.tiles.fill('land');
  const army = { ...g.units.find(u => u.kind === 'army'), position: { x: 50, y: 30 } };
  const step = classicLegalDirectionStep(g, army, 1, 1);
  assert.ok(step);
});

test('classicFighterMoveToExhausted honors fuel thresholds', () => {
  const fighter = {
    kind: 'fighter',
    aboard: null,
    order: { kind: 'move-to', destination: { x: 1, y: 1 } },
    fuel: 10,
  };
  assert.equal(classicFighterMoveToExhausted(fighter), true);
  assert.equal(classicFighterMoveToExhausted({ ...fighter, fuel: 11 }), false);
  assert.equal(classicFighterMoveToExhausted({ ...fighter, fuel: 14, aboard: 'c1' }), false);
  assert.equal(classicFighterMoveToExhausted({ ...fighter, fuel: 14, aboard: null }), false);
});