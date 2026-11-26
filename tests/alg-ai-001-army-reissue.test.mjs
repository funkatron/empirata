import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classicAdjacentForeignCityStep,
  classicArmyActivation,
  classicArmyAttackStep,
  classicArmyCityTask,
  classicArmyCityTaskActive,
  classicArmyCityTaskTurn,
  classicLandPath2AD8,
  classicLandTable2AD8Passable,
  getPlayerView,
  makeAiVsAiLab,
  setOrder,
  updateAllKnowledge,
} from '../dist/engine/index.js';

// Lab row y = 25 is land from x = 8 to at least x = 25 (used by the conquest fixtures).
function lab(cities = [], extraUnits = []) {
  const g = makeAiVsAiLab();
  g.aiPolicy = { kind: 'classic-dos', grade: 1 };
  for (const c of cities) {
    g.cities.push({ production: null, progress: 0, firstCycle: true, ...c });
  }
  const army = {
    id: 'u-blue-army', owner: 'blue', kind: 'army', position: { x: 10, y: 25 },
    order: { kind: 'none' }, spent: 0, damage: 0, fuel: null, aboard: null,
  };
  g.units = [army, ...extraUnits];
  g.active = 'blue';
  return g;
}

/** Chart a set of tiles for blue by briefly placing scouts there. */
function chart(g, tiles) {
  const keep = g.units;
  g.units = [...keep, ...tiles.map((position, i) => ({ ...keep[0], id: `scout-${i}`, position }))];
  updateAllKnowledge(g);
  g.units = keep;
  updateAllKnowledge(g);
}

test('0x1F238 parity: the city task runs on alternate turns per unit', () => {
  const g = lab();
  const a = classicArmyCityTaskTurn(g, g.units[0]);
  g.round += 1;
  assert.equal(classicArmyCityTaskTurn(g, g.units[0]), !a);
});

test('2AD8 table: neutral city and unexplored pass; player cities and sea block', () => {
  const g = lab([
    { id: 'n', position: { x: 15, y: 25 }, owner: null },
    { id: 'r', position: { x: 17, y: 25 }, owner: 'red' },
  ]);
  chart(g, [{ x: 15, y: 25 }, { x: 17, y: 25 }]);
  const view = getPlayerView(g, 'blue');
  assert.equal(classicLandTable2AD8Passable(g, view, { x: 15, y: 25 }), true);
  assert.equal(classicLandTable2AD8Passable(g, view, { x: 17, y: 25 }), false);
  const own = g.cities.find(c => c.owner === 'blue');
  assert.equal(classicLandTable2AD8Passable(g, view, own.position), false);
  const unexplored = view.cells.findIndex((c, i) => c.terrain === null && i % g.width > 0 && i % g.width < g.width - 1 && i > g.width && i < g.width * (g.height - 1));
  assert.equal(classicLandTable2AD8Passable(g, view, { x: unexplored % g.width, y: Math.floor(unexplored / g.width) }), true);
});

test('0x1F454 grade 1: radius 12, neutral and known only, one rand per call', () => {
  const near = lab([{ id: 'n', position: { x: 20, y: 25 }, owner: null }]);
  chart(near, [{ x: 20, y: 25 }]);
  const draws = near.rng.draws;
  const hit = classicArmyCityTask(near, getPlayerView(near, 'blue'), near.units[0], 1);
  assert.deepEqual(hit.destination, { x: 20, y: 25 });
  assert.equal(hit.game.rng.draws, draws + 1);

  const far = lab([{ id: 'n', position: { x: 25, y: 25 }, owner: null }]);
  chart(far, [{ x: 25, y: 25 }]);
  assert.equal(classicArmyCityTask(far, getPlayerView(far, 'blue'), far.units[0], 1).destination, null);
  // Grade 2 (flag 62F6) widens the radius to 20.
  assert.deepEqual(classicArmyCityTask(far, getPlayerView(far, 'blue'), far.units[0], 2).destination, { x: 25, y: 25 });

  const enemy = lab([{ id: 'r', position: { x: 20, y: 25 }, owner: 'red' }]);
  chart(enemy, [{ x: 20, y: 25 }]);
  assert.equal(classicArmyCityTask(enemy, getPlayerView(enemy, 'blue'), enemy.units[0], 1).destination, null);

  const unknown = lab([{ id: 'n', position: { x: 20, y: 25 }, owner: null }]);
  updateAllKnowledge(unknown);
  assert.equal(classicArmyCityTask(unknown, getPlayerView(unknown, 'blue'), unknown.units[0], 1).destination, null);
});

test('0x4418: the city task ends when the city is ours or no longer reachable', () => {
  const g = lab([{ id: 'n', position: { x: 20, y: 25 }, owner: null }]);
  chart(g, [{ x: 20, y: 25 }]);
  const goal = { x: 20, y: 25 };
  assert.equal(classicArmyCityTaskActive(g, getPlayerView(g, 'blue'), g.units[0], goal), true);
  g.cities.find(c => c.id === 'n').owner = 'red';
  chart(g, [goal]);
  assert.equal(classicArmyCityTaskActive(g, getPlayerView(g, 'blue'), g.units[0], goal), false);
  g.cities.find(c => c.id === 'n').owner = 'blue';
  chart(g, [goal]);
  assert.equal(classicArmyCityTaskActive(g, getPlayerView(g, 'blue'), g.units[0], goal), false);
});

test('0x1F376 type step: adjacent non-own city first, then attack mask 0xF0', () => {
  const enemyArmy = {
    id: 'r-army', owner: 'red', kind: 'army', position: { x: 11, y: 24 },
    order: { kind: 'none' }, spent: 0, damage: 0, fuel: null, aboard: null,
  };
  const g = lab([{ id: 'n', position: { x: 9, y: 25 }, owner: null }], [enemyArmy]);
  updateAllKnowledge(g);
  const view = getPlayerView(g, 'blue');
  assert.deepEqual(classicAdjacentForeignCityStep(g, view, g.units[0]), { x: 9, y: 25 });
  assert.deepEqual(classicArmyAttackStep(g, view, g.units[0]), { x: 11, y: 24 });
});

test('activation prefers the adjacent city over the wander heading', () => {
  const g = lab([{ id: 'n', position: { x: 11, y: 25 }, owner: null }]);
  updateAllKnowledge(g);
  const act = classicArmyActivation(g, 'blue', 'u-blue-army', 1, (gg, o) => setOrder(gg, 'u-blue-army', o, true), () => null);
  assert.deepEqual(act.step, { x: 11, y: 25 });
});

test('2AD8 path returns a first step toward a charted neutral city', () => {
  const g = lab([{ id: 'n', position: { x: 14, y: 25 }, owner: null }]);
  chart(g, [{ x: 14, y: 25 }]);
  const step = classicLandPath2AD8(g, getPlayerView(g, 'blue'), { x: 10, y: 25 }, { x: 14, y: 25 });
  assert.equal(Math.max(Math.abs(step.x - 14), Math.abs(step.y - 25)), 3);
});
