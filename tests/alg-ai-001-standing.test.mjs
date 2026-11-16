import test from 'node:test';
import assert from 'node:assert/strict';
import { endTurn, makeRulesLab, playRedOpponent, updateAllKnowledge } from '../dist/engine/index.js';

test('Classic go-home standing order moves one step toward a friendly city', () => {
  const g = endTurn(makeRulesLab());
  g.tiles.fill('sea');
  const city = g.cities.find(c => c.id === 'c-red');
  g.units = [
    {
      ...g.units.find(u => u.id === 'u3'),
      id: 'runner',
      kind: 'destroyer',
      owner: 'red',
      position: { x: 70, y: 36 },
      order: { kind: 'go-home' },
      fuel: null,
    },
  ];
  g.active = 'red';
  g.aiPolicy = { kind: 'classic-dos', grade: 1 };
  updateAllKnowledge(g, false);
  const before = Math.abs(g.units[0].position.x - city.position.x);
  const next = playRedOpponent(g);
  const after = Math.abs(next.units[0].position.x - city.position.x);
  assert.ok(after < before);
  assert.equal(next.units[0].order.kind, 'go-home');
});

test('Classic move-to standing order advances one step along a charted route', () => {
  const g = endTurn(makeRulesLab());
  g.tiles.fill('sea');
  g.units = [
    {
      ...g.units.find(u => u.id === 'u3'),
      id: 'runner',
      kind: 'destroyer',
      owner: 'red',
      position: { x: 50, y: 30 },
      order: { kind: 'move-to', destination: { x: 80, y: 36 } },
      fuel: null,
    },
  ];
  g.active = 'red';
  g.aiPolicy = { kind: 'classic-dos', grade: 1 };
  updateAllKnowledge(g, false);
  const before = g.units[0].position.x;
  const next = playRedOpponent(g);
  assert.ok(next.units[0].position.x > before);
  assert.deepEqual(next.units[0].order.destination, { x: 80, y: 36 });
});