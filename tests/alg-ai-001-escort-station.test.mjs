import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classicEscortStationCandidates,
  classicEscortStationGoal,
  classicEscortStep,
  makeRulesLab,
  updateAllKnowledge,
} from '../dist/engine/index.js';

test('classicEscortStationGoal prefers a station behind a go-direction target', () => {
  const g = makeRulesLab();
  g.tiles.fill('sea');
  const target = {
    ...g.units.find(u => u.kind === 'destroyer'),
    id: 'lead',
    owner: 'red',
    position: { x: 50, y: 30 },
    order: { kind: 'go-direction', direction: { x: 1, y: 0 } },
    fuel: null,
  };
  const escort = {
    ...target,
    id: 'escort',
    position: { x: 44, y: 30 },
    order: { kind: 'escort', targetId: 'lead' },
  };
  g.units = [escort, target];
  updateAllKnowledge(g);
  const goal = classicEscortStationGoal(g, escort, target, 1);
  assert.ok(goal);
  assert.ok(goal.x < target.position.x, 'station west of target moving east');
  assert.ok(
    Math.abs(goal.y - target.position.y) <= 1,
    'station beside the target, not ahead on the east face',
  );
});

test('classicEscortStationCandidates drops non-passable neighbors', () => {
  const g = makeRulesLab();
  g.tiles.fill('sea');
  const city = g.cities.find(c => c.owner === 'red');
  const target = {
    ...g.units.find(u => u.kind === 'destroyer'),
    id: 'lead',
    owner: 'red',
    position: { x: city.position.x, y: city.position.y },
    order: { kind: 'none' },
    fuel: null,
  };
  const escort = {
    ...target,
    id: 'escort',
    position: { x: city.position.x + 5, y: city.position.y },
    order: { kind: 'escort', targetId: 'lead' },
  };
  g.units = [escort, target];
  updateAllKnowledge(g);
  const stations = classicEscortStationCandidates(g, escort, target, 1);
  assert.ok(stations.length > 0);
  assert.ok(stations.every(p => p.x !== city.position.x || p.y !== city.position.y));
});

test('classicEscortStep uses stationing goal for a holding target within range', () => {
  const g = makeRulesLab();
  g.tiles.fill('sea');
  const target = {
    ...g.units.find(u => u.kind === 'destroyer'),
    id: 'lead',
    owner: 'red',
    position: { x: 50, y: 30 },
    order: { kind: 'none' },
    fuel: null,
  };
  const escort = {
    ...target,
    id: 'escort',
    position: { x: 48, y: 30 },
    order: { kind: 'escort', targetId: 'lead' },
  };
  g.units = [escort, target];
  updateAllKnowledge(g);
  const step = classicEscortStep(g, escort, 1);
  assert.ok(step);
  assert.ok(Math.max(Math.abs(step.x - escort.position.x), Math.abs(step.y - escort.position.y)) === 1);
  const distToTarget = Math.max(Math.abs(step.x - target.position.x), Math.abs(step.y - target.position.y));
  assert.ok(distToTarget <= 1, 'moves toward a station tile beside the target');
});