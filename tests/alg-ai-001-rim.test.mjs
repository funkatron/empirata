import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classicRimAwarePreferredIndex,
  classicResolveLegalDirection,
  classicAdvanceBearingWhenBlocked,
  directions,
  makeRulesLab,
  playRedOpponent,
  updateAllKnowledge,
} from '../dist/engine/index.js';

test('classicRimAwarePreferredIndex biases north default away from top rim', () => {
  const g = makeRulesLab();
  g.tiles.fill('sea');
  const unit = {
    ...g.units[0],
    id: 'rim-ship',
    owner: 'red',
    kind: 'destroyer',
    position: { x: 50, y: 1 },
    order: { kind: 'none' },
  };
  assert.equal(classicRimAwarePreferredIndex(g, unit, 1), 5);
});

test('classicResolveLegalDirection on top rim sea steps south for default none bearing', () => {
  const g = makeRulesLab();
  g.tiles.fill('sea');
  const unit = {
    ...g.units[0],
    id: 'rim-ship',
    owner: 'red',
    kind: 'destroyer',
    position: { x: 50, y: 1 },
    order: { kind: 'none' },
    fuel: null,
  };
  updateAllKnowledge(g);
  for (let x = 48; x <= 52; x++) {
    g.knowledge.red.terrain[2 * g.width + x] = 'sea';
  }
  const resolved = classicResolveLegalDirection(g, unit, 1, 1);
  assert.ok(resolved.step);
  assert.ok(resolved.step.y > unit.position.y, 'rim step moves away from north border');
  assert.equal(resolved.directionIndex, 5);
});

test('Classic none order moves off the top rim instead of holding north', () => {
  const g = makeRulesLab();
  g.tiles.fill('sea');
  g.units = [
    {
      ...g.units[0],
      id: 'rim-ship',
      owner: 'red',
      kind: 'destroyer',
      position: { x: 50, y: 1 },
      order: { kind: 'none' },
      fuel: null,
    },
  ];
  g.active = 'red';
  g.aiPolicy = { kind: 'classic-dos', grade: 1 };
  updateAllKnowledge(g);
  const next = playRedOpponent(structuredClone(g));
  assert.equal(next.units[0].position.y, 2);
  assert.equal(next.units[0].order.kind, 'none');
});

test('classicAdvanceBearingWhenBlocked rotates by unit parity bias', () => {
  const unit = { id: 'aa', kind: 'destroyer' };
  const next = classicAdvanceBearingWhenBlocked(unit, 1);
  assert.equal(next, 2);
  const unit2 = { id: 'ab', kind: 'destroyer' };
  assert.equal(classicAdvanceBearingWhenBlocked(unit2, 1), 0);
  assert.ok(directions[next]);
});