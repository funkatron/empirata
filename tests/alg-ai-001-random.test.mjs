import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classicRandomOrderTick,
  classicRandomRotationBias,
  directions,
  exportSave,
  importSave,
  makeRulesLab,
  playRedOpponent,
} from '../dist/engine/index.js';

test('classicRandomRotationBias is ±1 from unit id parity', () => {
  const g = makeRulesLab();
  const u = g.units[0];
  const bias = classicRandomRotationBias(u);
  assert.ok(bias === 1 || bias === -1);
  assert.equal(classicRandomRotationBias({ ...u, id: u.id }), bias);
});

test('classicRandomOrderTick can change compass index on rotation draws', () => {
  const g = makeRulesLab();
  const unit = { ...g.units[0], order: { kind: 'random' }, id: 'unit-a' };
  const start = classicRandomOrderTick(g, unit).directionIndex;
  let sawChange = false;
  for (let seed = 1; seed < 500; seed++) {
    const out = classicRandomOrderTick({ ...g, rng: { seed, draws: 0 } }, unit);
    if (out.directionIndex !== start) {
      sawChange = true;
      break;
    }
  }
  assert.ok(sawChange, 'some seeds should rotate the random-bearing index');
});

test('Classic random order survives save and moves with restored random standing order', () => {
  const g = makeRulesLab();
  g.tiles.fill('sea');
  g.units = [
    {
      ...g.units[0],
      id: 'wanderer',
      owner: 'red',
      kind: 'destroyer',
      position: { x: 50, y: 30 },
      order: { kind: 'random' },
      fuel: null,
    },
  ];
  g.active = 'red';
  g.aiPolicy = { kind: 'classic-dos', grade: 1 };
  g.rng = { seed: 0x6c74, draws: 0 };
  const before = g.units[0].position;
  const next = playRedOpponent(structuredClone(g));
  assert.notDeepEqual(next.units[0].position, before);
  assert.equal(next.units[0].order.kind, 'random');
  assert.deepEqual(importSave(exportSave(next)).units[0].order, { kind: 'random' });
  assert.ok(directions.some(d => d.x !== 0 || d.y !== 0));
});