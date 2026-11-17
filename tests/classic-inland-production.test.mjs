import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chooseClassicCityProduction,
  endTurn,
  isCoastal,
  labRoundPhases,
  legalizeClassicProductionForCity,
  makeCampaignMap,
  playRedOpponent,
} from '../dist/engine/index.js';

test('Classic inland sealift heuristic maps to army under Empirata ship rules', () => {
  let g = makeCampaignMap('continents', 42, 'ai-vs-ai', false, { density: 'sparse' });
  for (let i = 0; i < 6; i++) {
    for (const phase of labRoundPhases(g)) g = phase(g);
  }
  const inland = g.cities.find(c => c.owner === 'red' && !isCoastal(g, c.position));
  assert.ok(inland, 'fixture has a red inland city');
  const raw = chooseClassicCityProduction(g, 'red', inland, 1);
  const pick = legalizeClassicProductionForCity(g, inland, raw);
  assert.equal(pick, 'army');
  g = { ...g, active: 'red' };
  assert.doesNotThrow(() => playRedOpponent(g));
});

test('Classic CvC autoplay passes first unit completion (seed 42)', () => {
  let g = makeCampaignMap('continents', 42, 'ai-vs-ai', false, { density: 'sparse' });
  for (let r = 0; r < 12; r++) {
    for (const phase of labRoundPhases(g)) g = phase(g);
  }
  assert.ok(g.units.length > 0);
});