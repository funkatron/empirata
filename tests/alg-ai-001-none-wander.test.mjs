import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CLASSIC_DOS_DIRECTION_ORDER,
  classicArmyWanderStep,
  classicCityArmyExploreProbe,
  classicIdleNoneStep,
  classicRandomRotationBias,
  classicRotateDirectionIndex,
  classicWanderHeadingRoll,
  directions,
  exportSave,
  getPlayerView,
  importSave,
  makeRulesLab,
  nextRandom15,
  playRedOpponent,
  updateAllKnowledge,
} from '../dist/engine/index.js';

// DOS None (order 0) has no default bearing: 0x3E00 returns status 1, 0x4462 runs the
// type AI, 0x44EA yields -1 for order 0. Idle armies garrison (0x11) or wander (0x10,
// heading 0x4836, step 0x4542). See agents/alg-ai-001-none-order-trace-2026-11-24.md.

const N = 1;
const chebyshev = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

function redArmy(id, position, extra = {}) {
  return { id, owner: 'red', kind: 'army', position, damage: 0, spent: 0, fuel: null, order: { kind: 'none' }, aboard: null, ...extra };
}

function lab(terrain = 'land') {
  const g = makeRulesLab();
  g.tiles.fill(terrain);
  g.cities = [];
  g.units = [];
  g.active = 'red';
  g.aiPolicy = { kind: 'classic-dos', grade: 1 };
  return g;
}

function chart(g) {
  updateAllKnowledge(g, false);
  g.knowledge.red.terrain = [...g.tiles];
}

test('classicWanderHeadingRoll follows 0x4836: rand%24, values >= 8 become (r&7)|1', () => {
  let g = lab();
  const counts = new Array(8).fill(0);
  for (let i = 0; i < 400; i++) {
    const draw = nextRandom15(g.rng);
    let dos = draw.value % 24;
    if (dos >= 8) dos = (dos & 7) | 1;
    const roll = classicWanderHeadingRoll(g);
    assert.equal(roll.directionIndex, CLASSIC_DOS_DIRECTION_ORDER[dos]);
    assert.deepEqual(roll.game.rng, draw.next);
    counts[dos]++;
    g = roll.game;
  }
  const diagonals = counts[1] + counts[3] + counts[5] + counts[7];
  assert.ok(diagonals > 0.7 * 400, `diagonal share ${diagonals}/400`);
});

test('army wander keeps its heading when the side three ring steps back is open', () => {
  const g = lab();
  const a = redArmy('ra', { x: 50, y: 30 });
  g.units = [a];
  chart(g);
  const r = classicArmyWanderStep(g, a, N, 1);
  assert.equal(r.directionIndex, N);
  assert.deepEqual(r.step, { x: 50, y: 29 });
});

test('army wander starts the sweep from the blocked side (wall following)', () => {
  const g = lab('sea');
  const a = redArmy('ra', { x: 50, y: 30 });
  const bias = classicRandomRotationBias(a);
  const back = classicRotateDirectionIndex(N, -3 * bias);
  // Land only at the unit, straight ahead (N) and one step past the blocked side.
  const land = [a.position, { x: 50, y: 29 }];
  const after = classicRotateDirectionIndex(back, bias);
  const d = directions[after];
  land.push({ x: 50 + d.x, y: 30 + d.y });
  for (const p of land) g.tiles[p.y * g.width + p.x] = 'land';
  g.units = [a];
  chart(g);
  const r = classicArmyWanderStep(g, a, N, 1);
  // Side is sea, so the sweep starts at `back` and accepts the next legal ring step.
  assert.equal(r.directionIndex, after);
});

test('army on its own city tile with None garrisons (DOS order 0x11) and does not wander', () => {
  const g = lab();
  g.cities = [{ id: 'rc', position: { x: 50, y: 30 }, owner: 'red', production: null, progress: 0, firstCycle: true }];
  const a = redArmy('ra', { x: 50, y: 30 }, { classicWander: { direction: 4 } });
  g.units = [a];
  chart(g);
  const idle = classicIdleNoneStep(g, a, 1);
  assert.equal(idle.step, null);
  assert.equal(idle.wandered, false);
  const next = playRedOpponent(structuredClone(g));
  assert.deepEqual(next.units[0].position, { x: 50, y: 30 });
  assert.equal(next.units[0].classicWander, undefined);
});

test('city explore probe (0x485E) needs uncharted land two steps out past a legal first step', () => {
  const g = lab();
  g.cities = [{ id: 'rc', position: { x: 50, y: 30 }, owner: 'red', production: null, progress: 0, firstCycle: true }];
  const a = redArmy('ra', { x: 50, y: 30 });
  g.units = [a];
  chart(g);
  assert.equal(classicCityArmyExploreProbe(g, a, 1), false);
  g.knowledge.red.terrain[28 * g.width + 52] = null; // NE, two steps out
  assert.equal(classicCityArmyExploreProbe(g, a, 1), true);
  g.knowledge.red.terrain[29 * g.width + 51] = null; // first NE step uncharted: not a legal chart step
  assert.equal(classicCityArmyExploreProbe(g, a, 1), false);
});

test('army in its city leaves to wander with a fresh heading while land nearby is uncharted', () => {
  const g = lab();
  g.cities = [{ id: 'rc', position: { x: 50, y: 30 }, owner: 'red', production: null, progress: 0, firstCycle: true }];
  const a = redArmy('ra', { x: 50, y: 30 }, { classicWander: { direction: 6 } });
  g.units = [a];
  chart(g);
  g.knowledge.red.terrain[32 * g.width + 50] = null; // S, two steps out
  const expected = classicWanderHeadingRoll(g).directionIndex;
  const idle = classicIdleNoneStep(g, a, 1);
  assert.equal(idle.wandered, true);
  assert.ok(idle.step);
  assert.equal(chebyshev(idle.step, a.position), 1);
  assert.notEqual(idle.game.rng, g.rng, 'heading was re-rolled, not reused');
  assert.ok(Number.isInteger(expected));
});

test('wander heading persists across activations in open land', () => {
  let g = lab();
  g.units = [redArmy('ra', { x: 50, y: 30 })];
  chart(g);
  g = playRedOpponent(structuredClone(g));
  const first = g.units[0].classicWander.direction;
  const start = { ...g.units[0].position };
  g.units[0].spent = 0;
  g = playRedOpponent(g);
  assert.equal(g.units[0].classicWander.direction, first);
  const d = directions[first];
  assert.deepEqual(g.units[0].position, { x: start.x + d.x, y: start.y + d.y });
});

test('ships with None roll a heading instead of defaulting north', () => {
  const g = lab('sea');
  const ship = redArmy('rd', { x: 50, y: 30 }, { kind: 'destroyer' });
  g.units = [ship];
  chart(g);
  const expected = classicWanderHeadingRoll(g).directionIndex;
  const idle = classicIdleNoneStep(g, ship, 1);
  assert.equal(idle.wandered, true);
  const d = directions[expected];
  assert.deepEqual(idle.step, { x: 50 + d.x, y: 30 + d.y });
  assert.equal(idle.game.units[0].classicWander.direction, expected);
});

test('a non-wander activation clears the stored heading', () => {
  const g = lab();
  g.cities = [{ id: 'n1', position: { x: 52, y: 30 }, owner: null, production: null, progress: 0, firstCycle: true }];
  g.units = [redArmy('ra', { x: 50, y: 30 }, { classicWander: { direction: 0 } })];
  chart(g);
  g.knowledge.red.cities = { n1: { id: 'n1', owner: null, production: null, productionKnown: false } };
  const view = getPlayerView(g, 'red');
  assert.ok(view.cells[30 * g.width + 52].city);
  const next = playRedOpponent(structuredClone(g));
  assert.equal(next.units[0]?.classicWander, undefined);
  assert.equal(chebyshev(next.units[0].position, { x: 50, y: 30 }), 1);
});

test('save validation accepts a classic wander heading and rejects an invalid one', () => {
  const g = makeRulesLab();
  g.units[0].classicWander = { direction: 7 };
  const back = importSave(exportSave(g));
  assert.deepEqual(back.units[0].classicWander, { direction: 7 });
  g.units[0].classicWander = { direction: 8 };
  assert.throws(() => importSave(exportSave(g)), /classic wander/);
});
