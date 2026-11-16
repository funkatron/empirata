import test from 'node:test';
import assert from 'node:assert/strict';
import {
  makeRulesLab,
  moveUnit,
  RuleNotImplemented,
  updateAllKnowledge,
} from '../dist/engine/index.js';

test('Friendly land stacking without a city rejects moveUnit with a legal-action message', () => {
  const g = makeRulesLab();
  const leader = g.units.find((u) => u.id === 'u1');
  const garrison = {
    ...structuredClone(leader),
    id: 'garrison',
    position: { x: leader.position.x + 1, y: leader.position.y },
  };
  g.units.push(garrison);
  updateAllKnowledge(g);
  const before = structuredClone(g);
  assert.throws(
    () => moveUnit(g, leader.id, garrison.position),
  (error) =>
      error instanceof Error &&
      !(error instanceof RuleNotImplemented) &&
      /city port|embarkArmy|boardFighter/.test(error.message),
    'Same-square friendly stacking should not surface RuleNotImplemented(CARGO)',
  );
  assert.deepEqual(g, before, 'Rejected move preserves game state');
});

test('Embarked units still reject moveUnit before the stacking check', () => {
  const g = makeRulesLab();
  const ship = g.units.find((u) => u.kind === 'destroyer');
  const army = g.units.find((u) => u.kind === 'army');
  ship.kind = 'transport';
  army.position = ship.position;
  updateAllKnowledge(g);
  const aboard = g;
  army.aboard = ship.id;
  assert.throws(
    () => moveUnit(aboard, army.id, { x: army.position.x, y: army.position.y + 1 }),
    (error) => error instanceof Error && !(error instanceof RuleNotImplemented) && /disembarkArmy/.test(error.message),
  );
});