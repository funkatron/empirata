import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classicNoneOrderBearing,
  classicStandingOrderTick,
  CLASSIC_ORDER_NONE_DIRECTION_INDEX,
  makeRulesLab,
  endTurn,
  playRedOpponent,
} from '../dist/engine/index.js';

test('ALG-AI-001 order none maps to recovered direction index 1', () => {
  assert.equal(CLASSIC_ORDER_NONE_DIRECTION_INDEX, 1);
  assert.deepEqual(classicNoneOrderBearing(), { x: 0, y: -1 });
  assert.deepEqual(classicStandingOrderTick({ kind: 'none' }), {
    kind: 'bear',
    direction: { x: 0, y: -1 },
  });
  assert.deepEqual(classicStandingOrderTick({ kind: 'sentry' }), { kind: 'hold' });
  assert.equal(classicStandingOrderTick({ kind: 'move-to', destination: { x: 1, y: 1 } }), null);
});

test('Classic order-none army off a city wanders one legal step and keeps its heading', () => {
  const g = endTurn(makeRulesLab());
  g.aiPolicy = { kind: 'classic-dos', grade: 2 };
  const army = g.units.find(u => u.id === 'u3');
  const before = { ...army.position };
  const next = playRedOpponent(g);
  const after = next.units.find(u => u.id === 'u3');
  assert.equal(Math.max(Math.abs(after.position.x - before.x), Math.abs(after.position.y - before.y)), 1);
  assert.equal(after.order.kind, 'none');
  assert.ok(Number.isInteger(after.classicWander?.direction));
  assert.ok(next.events.some(e => e.message.includes('ALG-AI-001')));
});