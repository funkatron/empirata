import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classicEscortStationCandidates,
  classicEscortStationGoal,
  classicEscortStep,
  classicUnitReachableGoal,
  directions,
  makeRulesLab,
  updateAllKnowledge,
} from '../dist/engine/index.js';

test('classicEscortStationCandidates use eight-direction probe order (0DF56)', () => {
  const g = makeRulesLab();
  g.tiles.fill('sea');
  const target = {
    ...g.units.find(u => u.kind === 'destroyer'),
    id: 'lead',
    owner: 'red',
    kind: 'destroyer',
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
  const stations = classicEscortStationCandidates(g, escort, target, 1);
  const expected = directions
    .map(d => ({ x: target.position.x + d.x, y: target.position.y + d.y }))
    .filter(p => stations.some(s => s.x === p.x && s.y === p.y));
  assert.deepEqual(stations, expected);
  assert.ok(stations.length > 0);
});

test('classicEscortStationGoal is first reachable neighbor in probe order', () => {
  const g = makeRulesLab();
  g.tiles.fill('sea');
  const target = {
    ...g.units.find(u => u.kind === 'destroyer'),
    id: 'lead',
    owner: 'red',
    kind: 'destroyer',
    position: { x: 50, y: 30 },
    order: { kind: 'none' },
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
  const stations = classicEscortStationCandidates(g, escort, target, 1);
  assert.equal(goal.x, stations[0].x);
  assert.equal(goal.y, stations[0].y);
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

test('classicEscortStationCandidates skip unreachable neighbors before later hits', () => {
  const g = makeRulesLab();
  g.tiles.fill('land');
  const tx = 40;
  const ty = 30;
  const target = {
    ...g.units.find(u => u.kind === 'army'),
    id: 'lead',
    owner: 'red',
    kind: 'army',
    position: { x: tx, y: ty },
    order: { kind: 'none' },
    fuel: null,
  };
  const escort = {
    ...target,
    id: 'escort',
    position: { x: tx - 8, y: ty },
    order: { kind: 'escort', targetId: 'lead' },
  };
  g.units = [escort, target];
  for (const d of directions) {
    const p = { x: tx + d.x, y: ty + d.y };
    g.tiles[p.y * g.width + p.x] = 'sea';
  }
  const west = { x: tx - 1, y: ty };
  g.tiles[west.y * g.width + west.x] = 'land';
  updateAllKnowledge(g);
  assert.equal(classicUnitReachableGoal(g, escort, directions[0] && { x: tx + directions[0].x, y: ty + directions[0].y }, 1), false);
  const stations = classicEscortStationCandidates(g, escort, target, 1);
  assert.ok(stations.some(s => s.x === west.x && s.y === west.y));
  const goal = classicEscortStationGoal(g, escort, target, 1);
  assert.deepEqual(goal, west);
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