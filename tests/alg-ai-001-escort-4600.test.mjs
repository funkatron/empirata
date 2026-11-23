import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classicEscortCloseRangeGoal,
  classicEscortStep,
  makeRulesLab,
  updateAllKnowledge,
} from '../dist/engine/index.js';

test('classicEscortCloseRangeGoal follows a move-to destination when within Chebyshev 3', () => {
  const g = makeRulesLab();
  g.tiles.fill('sea');
  const escort = {
    ...g.units.find(u => u.kind === 'destroyer'),
    id: 'escort-ship',
    owner: 'red',
    position: { x: 40, y: 30 },
    order: { kind: 'escort', targetId: 'convoy' },
    fuel: null,
  };
  const convoy = {
    ...escort,
    id: 'convoy',
    position: { x: 42, y: 30 },
    order: { kind: 'move-to', destination: { x: 80, y: 30 } },
  };
  const { goal } = classicEscortCloseRangeGoal(g, escort, convoy, 1);
  assert.deepEqual(goal, { x: 80, y: 30 });
});

test('classicEscortStep within 0x4600 range routes toward target move-to goal', () => {
  const g = makeRulesLab();
  g.tiles.fill('sea');
  g.rng = { seed: 1, draws: 7 };
  const escort = {
    ...g.units.find(u => u.kind === 'destroyer'),
    id: 'escort-ship',
    owner: 'red',
    position: { x: 49, y: 30 },
    order: { kind: 'escort', targetId: 'convoy' },
    fuel: null,
  };
  const convoy = {
    ...escort,
    id: 'convoy',
    position: { x: 51, y: 30 },
    order: { kind: 'move-to', destination: { x: 50, y: 30 } },
  };
  g.units = [escort, convoy];
  updateAllKnowledge(g, false);
  const before = { ...escort.position };
  const moved = classicEscortStep(g, escort, 1);
  assert.equal(moved.game.rng.draws, g.rng.draws);
  assert.ok(moved.step);
  assert.equal(Math.max(Math.abs(moved.step.x - before.x), Math.abs(moved.step.y - before.y)), 1);
  assert.ok(moved.step.x > before.x, 'step trends toward move-to axis');
});