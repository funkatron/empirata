import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRulesLab, updateAllKnowledge } from '../dist/engine/index.js';

function wakeFixture(order) {
  const g = makeRulesLab();
  g.units = [
    {
      id: 'observer',
      owner: 'blue',
      kind: 'army',
      position: { x: 20, y: 20 },
      damage: 0,
      spent: 0,
      fuel: null,
      order,
      aboard: null,
    },
    {
      id: 'enemy',
      owner: 'red',
      kind: 'army',
      position: { x: 21, y: 20 },
      damage: 0,
      spent: 0,
      fuel: null,
      order: { kind: 'none' },
      aboard: null,
    },
  ];
  return g;
}

for (const kind of ['sentry', 'patrol', 'skip']) {
  test(`ALG-012 adjacent enemy contact clears ${kind} standing order to none`, () => {
    const order =
      kind === 'patrol'
        ? { kind: 'patrol', from: { x: 20, y: 20 }, to: { x: 25, y: 20 }, outbound: true }
        : { kind };
    const g = wakeFixture(order);
    updateAllKnowledge(g);
    const observer = g.units.find(u => u.id === 'observer');
    assert.equal(observer?.order.kind, 'none');
    assert.ok(g.events.some(e => e.message.includes('observer')));
  });
}