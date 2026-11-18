import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classicChartCityGlyph,
  classicDosPlayerIndex,
  classicMaskAllowsGlyph,
  makeRulesLab,
} from '../dist/engine/index.js';

test('classicChartCityGlyph encodes owned cities as 10*playerIndex-6', () => {
  const g = makeRulesLab();
  const redIdx = classicDosPlayerIndex(g, 'red');
  const city = g.cities.find(c => c.owner === 'red');
  assert.equal(classicChartCityGlyph(g, 'red', city), 10 * (redIdx + 1) - 6);
  assert.equal(classicChartCityGlyph(g, 'red', { owner: null }), 0);
});

test('classic glyph masks block army on neutral sea glyph [D]', () => {
  const g = makeRulesLab();
  const blueIdx = classicDosPlayerIndex(g, 'blue');
  assert.equal(classicMaskAllowsGlyph('army', blueIdx, 2), false);
  assert.equal(classicMaskAllowsGlyph('army', blueIdx, 0), true);
  assert.equal(classicMaskAllowsGlyph('ship-a', blueIdx, 7), true);
});