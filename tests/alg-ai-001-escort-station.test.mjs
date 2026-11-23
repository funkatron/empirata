import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CLASSIC_ESCORT_STATION_PROBE_COUNT,
  CLASSIC_ESCORT_STATION_RADIUS,
  classicEscortStationCandidates,
  classicEscortStationGoal,
  classicEscortStep,
  makeRulesLab,
  updateAllKnowledge,
} from '../dist/engine/index.js';

function chebyshev(a, b) {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

function holdingEscortFixture() {
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
    position: { x: 48, y: 30 },
    order: { kind: 'escort', targetId: 'lead' },
  };
  g.units = [escort, target];
  updateAllKnowledge(g, false);
  return { g, escort, target };
}

test('classicEscortStationCandidates uses at most one station in (2n+1)^2 window', () => {
  const { g, escort, target } = holdingEscortFixture();
  const { candidates } = classicEscortStationCandidates(g, escort, target, 1);
  assert.ok(candidates.length <= 1);
  for (const p of candidates) {
    assert.ok(chebyshev(p, target.position) <= CLASSIC_ESCORT_STATION_RADIUS);
    assert.ok(p.x >= 1 && p.x <= 98 && p.y >= 1 && p.y <= 58);
  }
});

test('classicEscortStationCandidates is deterministic for a fixed rng seed', () => {
  const { g, escort, target } = holdingEscortFixture();
  g.rng = { seed: 0x6d597932, draws: 0 };
  const first = classicEscortStationCandidates(g, escort, target, 1);
  g.rng = { seed: 0x6d597932, draws: 0 };
  const second = classicEscortStationCandidates(g, escort, target, 1);
  assert.deepEqual(first.candidates, second.candidates);
});

test('classicEscortStationGoal matches first candidate from probe', () => {
  const { g, escort, target } = holdingEscortFixture();
  const probed = classicEscortStationCandidates(g, escort, target, 1);
  const goal = classicEscortStationGoal(g, escort, target, 1);
  assert.deepEqual(goal.goal, probed.candidates[0] ?? null);
});

test('classicEscortStationCandidates skips non-passable random tiles', () => {
  const { g, escort, target } = holdingEscortFixture();
  const city = g.cities.find(c => c.owner === 'red');
  g.tiles[city.position.y * g.width + city.position.x] = 'land';
  g.rng = { seed: 1, draws: 0 };
  let found = false;
  for (let i = 0; i < 200; i++) {
    g.rng = { seed: 0x1000 + i, draws: 0 };
    const { candidates } = classicEscortStationCandidates(g, escort, target, 1);
    for (const p of candidates) {
      assert.ok(p.x !== city.position.x || p.y !== city.position.y);
      found = true;
    }
  }
  assert.ok(found, 'expected at least one reachable probe in sampled seeds');
});

test('classicEscortStationCandidates may return empty after bounded probes', () => {
  const g = makeRulesLab();
  g.tiles.fill('land');
  const target = {
    ...g.units.find(u => u.kind === 'army'),
    id: 'lead',
    owner: 'red',
    kind: 'army',
    position: { x: 40, y: 30 },
    order: { kind: 'none' },
    fuel: null,
  };
  const escort = {
    ...target,
    id: 'escort',
    position: { x: 20, y: 30 },
    order: { kind: 'escort', targetId: 'lead' },
  };
  g.units = [escort, target];
  updateAllKnowledge(g, false);
  const { candidates } = classicEscortStationCandidates(g, escort, target, 1);
  assert.deepEqual(candidates, []);
});

test('classicEscortStep advances rng and moves toward a station tile', () => {
  const { g, escort, target } = holdingEscortFixture();
  g.rng = { seed: 0xface1234, draws: 0 };
  const beforeDraws = g.rng.draws;
  const moved = classicEscortStep(g, escort, 1);
  assert.ok(moved.step);
  assert.ok(
    Math.max(Math.abs(moved.step.x - escort.position.x), Math.abs(moved.step.y - escort.position.y)) === 1,
  );
  assert.ok(moved.game.rng.draws > beforeDraws);
  const distToTarget = chebyshev(moved.step, target.position);
  assert.ok(distToTarget <= CLASSIC_ESCORT_STATION_RADIUS);
});

test('classicEscortStationCandidates consumes at most two draws per probe', () => {
  const { g, escort, target } = holdingEscortFixture();
  g.rng = { seed: 99, draws: 0 };
  const before = g.rng.draws;
  const { game } = classicEscortStationCandidates(g, escort, target, 1);
  const used = game.rng.draws - before;
  assert.ok(used <= CLASSIC_ESCORT_STATION_PROBE_COUNT * 2);
  assert.equal(used % 2, 0);
});