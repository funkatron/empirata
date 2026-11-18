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
  const goal = classicEscortCloseRangeGoal(g, escort, convoy);
  assert.deepEqual(goal, { x: 80, y: 30 });
});

test('classicEscortStep within 0x4600 range routes toward target move-to goal', () => {
  const g = makeRulesLab();
  g.tiles.fill('sea');
  const city = g.cities.find(c => c.owner === 'red');
  const escort = {
    ...g.units.find(u => u.kind === 'destroyer'),
    id: 'escort-ship',
    owner: 'red',
    position: { x: city.position.x + 10, y: city.position.y },
    order: { kind: 'escort', targetId: 'convoy' },
    fuel: null,
  };
  const convoy = {
    ...escort,
    id: 'convoy',
    position: { x: city.position.x + 12, y: city.position.y },
    order: { kind: 'move-to', destination: { x: city.position.x + 30, y: city.position.y } },
  };
  g.units = [escort, convoy];
  updateAllKnowledge(g);
  const before = { ...escort.position };
  const step = classicEscortStep(g, escort, 1);
  assert.ok(step);
  assert.ok(
    Math.max(Math.abs(step.x - before.x), Math.abs(step.y - before.y)) === 1,
    'one classic activation step',
  );
  assert.ok(step.x > before.x, 'step trends toward move-to axis');
});