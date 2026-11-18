import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classicChartGlyphsForViewCell,
  classicTilePassable,
  classicTilePassableChart,
  emptyKnowledge,
  getPlayerView,
  makeRulesLab,
  updateAllKnowledge,
} from '../dist/engine/index.js';

test('unknown chart cells block classic chart passability', () => {
  const g = makeRulesLab();
  updateAllKnowledge(g);
  const view = getPlayerView(g, 'blue');
  const ship = g.units.find(u => u.kind === 'destroyer');
  const pos = { x: 50, y: 30 };
  g.knowledge.blue.terrain[pos.y * g.width + pos.x] = null;
  view.cells[pos.y * g.width + pos.x] = { terrain: null, visible: false, city: null };
  const hidden = classicChartGlyphsForViewCell(g, view, 'blue', pos);
  assert.equal(hidden.length, 0);
  assert.equal(classicTilePassableChart(g, view, 'blue', ship, pos, 1), false);
  assert.equal(classicTilePassable(g, 'blue', ship, pos, 1), true);
});

test('chart passability uses city intel owner for glyph', () => {
  const g = makeRulesLab();
  updateAllKnowledge(g);
  const view = getPlayerView(g, 'blue');
  const redCity = g.cities.find(c => c.owner === 'red');
  const army = g.units.find(u => u.kind === 'army');
  assert.equal(classicTilePassableChart(g, view, 'blue', army, redCity.position, 1), false);
  assert.equal(classicTilePassableChart(g, view, 'blue', army, g.cities.find(c => c.id === 'c-blue').position, 1), true);
});