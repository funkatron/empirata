import test from 'node:test';
import assert from 'node:assert/strict';
import { getPlayerView, makeRulesLab, updateAllKnowledge } from '../dist/engine/index.js';

// getPlayerView indexes cities by cell once per call. It must keep cityAt's
// first-match rule and ignore cities outside the map.

function labWithCities(cities) {
  const g = makeRulesLab();
  g.cities = cities;
  updateAllKnowledge(g, false);
  g.knowledge.red.terrain = [...g.tiles];
  g.knowledge.red.cities = Object.fromEntries(
    cities.map(c => [c.id, { id: c.id, owner: c.owner, production: null, productionKnown: false }]),
  );
  return g;
}

const city = (id, x, y, owner = null) => ({ id, position: { x, y }, owner, production: null, progress: 0, firstCycle: true });

test('player view: the first city listed at a cell wins', () => {
  const g = labWithCities([city('first', 10, 10, 'blue'), city('second', 10, 10, null)]);
  const cell = getPlayerView(g, 'red').cells[10 * g.width + 10];
  assert.equal(cell.city?.id, 'first');
});

test('player view: an off-map city does not alias another cell', () => {
  const g = labWithCities([city('off', g0Width() + 5, 0)]);
  const view = getPlayerView(g, 'red');
  assert.ok(view.cells.every(c => c.city === null));
});

function g0Width() {
  return makeRulesLab().width;
}
