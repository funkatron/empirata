import test from 'node:test';
import assert from 'node:assert/strict';
import { classicArmyBoardingClaim, classicWaitingTransport, makeAiVsAiLab } from '../dist/engine/index.js';

function lab(ships) {
  const g = makeAiVsAiLab();
  g.aiPolicy = { kind: 'classic-dos', grade: 1 };
  const army = {
    id: 'a', owner: 'blue', kind: 'army', position: { x: 10, y: 25 },
    order: { kind: 'none' }, spent: 0, damage: 0, fuel: null, aboard: null,
  };
  g.units = [army, ...ships.map((s, i) => ({
    id: `t${i}`, owner: 'blue', kind: 'transport', order: { kind: 'none' }, spent: 0, damage: 0, fuel: null, aboard: null, ...s,
  }))];
  g.active = 'blue';
  return g;
}
const set = (g, id, order) => { g.units.find(u => u.id === id).order = order; return g; };

test('0x1F6AA claims an empty own transport within 10 and sentries the army', () => {
  const g = lab([{ position: { x: 10, y: 15 } }]);
  const r = classicArmyBoardingClaim(g, 'blue', g.units[0], set);
  assert.equal(r.claimed, true);
  assert.deepEqual(r.game.units.find(u => u.id === 't0').classicBoardGoal, { x: 10, y: 25 });
  assert.equal(r.game.units.find(u => u.id === 'a').order.kind, 'sentry');
  assert.notEqual(r.game.rng.draws, g.rng.draws);
});

test('0x1F6AA ignores transports beyond 10 squares but still draws the RNG', () => {
  const g = lab([{ position: { x: 10, y: 14 } }]);
  const r = classicArmyBoardingClaim(g, 'blue', g.units[0], set);
  assert.equal(r.claimed, false);
  assert.equal(r.game.rng.draws, g.rng.draws + 1);
});

test('waiting transport must be own, empty and on no tactical order', () => {
  const g = lab([{ position: { x: 10, y: 20 } }, { position: { x: 10, y: 21 }, owner: 'red' }, { position: { x: 10, y: 22 }, order: { kind: 'go-home' } }]);
  assert.equal(classicWaitingTransport(g, g.units[1], 'blue'), true);
  assert.equal(classicWaitingTransport(g, g.units[2], 'blue'), false);
  assert.equal(classicWaitingTransport(g, g.units[3], 'blue'), false);
  g.units.push({ id: 'c', owner: 'blue', kind: 'army', position: { x: 10, y: 20 }, order: { kind: 'none' }, spent: 0, damage: 0, fuel: null, aboard: 't0' });
  assert.equal(classicWaitingTransport(g, g.units[1], 'blue'), false);
});
