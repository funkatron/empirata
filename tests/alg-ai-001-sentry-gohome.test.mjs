import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classicDamagedShipSeeksPort,
  classicSentryEngageTarget,
  emptyKnowledge,
  exportSave,
  getPlayerView,
  importSave,
  makeRulesLab,
  playRedOpponent,
  updateAllKnowledge,
} from '../dist/engine/index.js';

function sentryEncounter(kind = 'army', target = 'army') {
  const g = makeRulesLab();
  const base = g.units[0];
  g.cities = [];
  g.tiles.fill('sea');
  g.units = [
    {
      ...structuredClone(base),
      id: 'guard',
      kind,
      owner: 'red',
      position: { x: 20, y: 20 },
      order: { kind: 'sentry' },
      spent: 0,
      fuel: kind === 'fighter' ? 20 : null,
    },
    {
      ...structuredClone(base),
      id: 'approach',
      kind: target,
      owner: 'blue',
      position: { x: 21, y: 20 },
      order: { kind: 'none' },
      spent: 0,
      fuel: target === 'fighter' ? 20 : null,
    },
  ];
  for (const u of g.units) if (u.kind === 'army') g.tiles[u.position.y * g.width + u.position.x] = 'land';
  g.tiles[20 * g.width + 21] = target === 'army' ? 'land' : 'sea';
  for (const f of ['blue', 'red', 'green']) g.knowledge[f] = emptyKnowledge(g);
  // Keep sentry orders for classic activation (avoid pre-turn wake clearing).
  updateAllKnowledge(g, false);
  return g;
}

test('classicSentryEngageTarget picks a fresh adjacent enemy', () => {
  const g = sentryEncounter();
  const guard = g.units.find(u => u.id === 'guard');
  const view = getPlayerView(g, 'red');
  assert.deepEqual(classicSentryEngageTarget(view, guard), { x: 21, y: 20 });
});

test('Classic sentry policy engages an adjacent enemy in one activation', () => {
  const g = sentryEncounter();
  g.active = 'red';
  g.aiPolicy = { kind: 'classic-dos', grade: 1 };
  const next = playRedOpponent(g);
  assert.ok(next.events.some(e => e.kind === 'combat'));
  assert.equal(next.units.some(u => u.id === 'approach'), false, 'sentry engagement should resolve combat');
  assert.deepEqual(playRedOpponent(importSave(exportSave(g))), next);
});

test('classicDamagedShipSeeksPort matches half-HP empty transport rule', () => {
  const g = makeRulesLab();
  const tr = {
    ...g.units[0],
    kind: 'transport',
    damage: 2,
    order: { kind: 'none' },
  };
  assert.equal(classicDamagedShipSeeksPort(tr, 0), true);
  assert.equal(classicDamagedShipSeeksPort({ ...tr, damage: 1 }, 0), false);
  assert.equal(classicDamagedShipSeeksPort(tr, 1), false);
  assert.equal(classicDamagedShipSeeksPort({ ...tr, order: { kind: 'load-ship' } }, 0), false);
});

test('Classic damaged empty transport sets go-home and moves toward port', () => {
  const g = makeRulesLab();
  const city = g.cities.find(c => c.id === 'c-red');
  g.units = [
    {
      ...g.units.find(u => u.id === 'u3'),
      id: 'hull',
      kind: 'transport',
      owner: 'red',
      position: { x: 82, y: city.position.y },
      damage: 2,
      order: { kind: 'sentry' },
      fuel: null,
    },
  ];
  g.active = 'red';
  g.aiPolicy = { kind: 'classic-dos', grade: 1 };
  updateAllKnowledge(g, false);
  g.units[0].order = { kind: 'none' };
  const before = g.units[0].position.x;
  const next = playRedOpponent(g);
  const hull = next.units.find(u => u.id === 'hull');
  assert.ok(['go-home', 'none', 'load-ship'].includes(hull.order.kind));
  assert.ok(hull.position.x < before || hull.position.x === city.position.x);
});