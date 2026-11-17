import test from 'node:test';
import assert from 'node:assert/strict';
import * as engine from '../dist/engine/index.js';
import { makeReconnaissanceFixture } from '../scripts/reconnaissance-fixture.mjs';

const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const homePort = (state, faction) =>
  state.cities
    .filter(c => c.owner === faction && engine.isCoastal(state, c.position))
    .sort(
      (a, b) =>
        dist(a.position, { x: 0, y: 0 }) - dist(b.position, { x: 0, y: 0 }) || a.id.localeCompare(b.id),
    )[0];

test('Idle empty transport at sea moves toward a friendly port on the rules lab', () => {
  const g = engine.endTurn(engine.makeRulesLab());
  g.active = 'red';
  const port = g.cities.find(c => c.id === 'c-red').position;
  const army = g.units.find(u => u.id === 'u3');
  const idle = {
    ...structuredClone(army),
    id: 'idle-tr',
    kind: 'transport',
    fuel: null,
    aboard: null,
    position: { x: 86, y: 36 },
    order: { kind: 'none' },
  };
  g.units = [army, idle];
  engine.updateAllKnowledge(g);
  const before = dist(idle.position, port);
  const next = engine.playRedOpponent(g);
  const after = next.units.find(u => u.id === 'idle-tr');
  assert.ok(dist(after.position, port) < before, 'empty hull should close distance to home port');
});

test('Reconnaissance fixture idle transport closes on a coastal home within eight AI turns', () => {
  let { state, faction } = makeReconnaissanceFixture(engine, { layout: 'continents', seed: 83 });
  state.aiPolicy = { kind: 'modern-experimental' };
  const idle = state.units.find(u => u.id === 'fixture-idle-transport');
  const port = homePort(state, faction);
  assert.ok(idle && port, 'fixture ships coastal home and idle transport');
  let best = dist(idle.position, port.position);
  for (let i = 0; i < 8 && best > 1; i++) {
    state.active = faction;
    state = engine.playAiOpponent(state, faction);
    state = engine.endTurn(state);
    const ship = state.units.find(u => u.id === 'fixture-idle-transport');
    best = Math.min(best, dist(ship.position, port.position));
  }
  assert.ok(best < dist(idle.position, port.position),
    'idle hull should improve on its starting offset within bounded turns');
});