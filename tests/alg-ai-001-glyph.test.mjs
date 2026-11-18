import test from 'node:test';
import assert from 'node:assert/strict';
import { classicChartCityGlyph, classicDosPlayerIndex, makeRulesLab } from '../dist/engine/index.js';

test('classicChartCityGlyph encodes owned cities as 10*playerIndex-6', () => {
  const g = makeRulesLab();
  const redIdx = classicDosPlayerIndex(g, 'red');
  const city = g.cities.find(c => c.owner === 'red');
  assert.equal(classicChartCityGlyph(g, 'red', city), 10 * redIdx - 6);
  assert.equal(classicChartCityGlyph(g, 'red', { owner: null }), 0);
});