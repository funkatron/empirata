import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatMapSeedLine,
  mapRecipeFromCampaign,
  parseCampaignSeed,
  parseMapRecipe,
  randomCampaignSeed,
  serializeMapRecipe,
} from '../dist/engine/index.js';

test('map recipe round-trips and rejects full saves', () => {
  const recipe = mapRecipeFromCampaign({
    layout: 'islands', seed: 384291, algorithm: 'organic-v1', density: 'standard',
  });
  const json = serializeMapRecipe(recipe);
  assert.deepEqual(parseMapRecipe(json), recipe);
  assert.match(formatMapSeedLine(recipe), /islands · organic-v1 · standard · seed 384291/);
  assert.throws(() => parseMapRecipe(JSON.stringify({schema: 1, ruleset: 'interstel-2.05'})), /Not an Empirata map recipe/);
  assert.throws(() => parseMapRecipe('{'), /not valid JSON/);
});

test('campaign seed parsing and random seed stay in range', () => {
  assert.equal(parseCampaignSeed(17), 17);
  assert.equal(parseCampaignSeed('211'), 211);
  assert.equal(parseCampaignSeed(0), null);
  assert.equal(parseCampaignSeed(1.5), null);
  assert.equal(parseCampaignSeed(''), null);
  for (let i = 0; i < 20; i++) {
    const seed = randomCampaignSeed();
    assert.ok(Number.isInteger(seed) && seed >= 1 && seed <= 0xffffffff);
  }
});
