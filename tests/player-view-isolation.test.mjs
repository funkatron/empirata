import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceLabRound, clonePlain, getPlayerView } from '../dist/engine/index.js';
import * as engine from '../dist/engine/index.js';
import { makeCampaign } from '../scripts/campaign-maps.mjs';

// getPlayerView copies own units, own cities and sightings with clonePlain instead of
// structuredClone. The view must still share no objects with the game.

function midGame(policy) {
  let g = makeCampaign(engine, 'continents', 17, { aiPolicy: policy, density: 'standard' });
  for (let r = 0; r < 25; r++) g = advanceLabRound(g);
  return g;
}

function objectsOf(value, seen = new Set()) {
  if (value === null || typeof value !== 'object' || seen.has(value)) return seen;
  seen.add(value);
  for (const v of Object.values(value)) objectsOf(v, seen);
  return seen;
}

test('player view shares no objects with the game', () => {
  const g = midGame({ kind: 'modern-experimental' });
  const gameObjects = objectsOf(g);
  for (const faction of ['blue', 'red']) {
    const view = getPlayerView(g, faction);
    assert.ok(view.ownUnits.length > 0);
    for (const o of objectsOf({ u: view.ownUnits, c: view.ownCities, e: view.enemies })) {
      assert.equal(gameObjects.has(o), false);
    }
  }
});

test('clonePlain matches structuredClone on live units, cities and sightings', () => {
  for (const policy of [{ kind: 'classic-dos', grade: 1 }, { kind: 'modern-experimental' }]) {
    const g = midGame(policy);
    for (const v of [...g.units, ...g.cities, ...g.knowledge.blue.sightings, ...g.knowledge.red.sightings]) {
      const copy = clonePlain(v);
      assert.deepStrictEqual(copy, structuredClone(v));
      assert.deepEqual(Object.keys(copy), Object.keys(v));
      assert.notEqual(copy, v);
    }
  }
});

test('clonePlain keeps undefined-valued keys, arrays and nesting', () => {
  const src = { a: undefined, b: [1, { c: 2 }], d: { e: { f: null } } };
  const copy = clonePlain(src);
  assert.deepStrictEqual(copy, structuredClone(src));
  assert.ok('a' in copy);
  assert.notEqual(copy.b[1], src.b[1]);
});
