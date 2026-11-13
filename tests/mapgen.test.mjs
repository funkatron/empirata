import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzePlayability,
  generateEllipseCampaign,
  generateOrganicTerrain,
  mainOceanLabel,
  makeCampaignMap,
  placeCampaignCities,
  tilesToAscii,
} from '../dist/engine/index.js';

test('mapgen ellipse-v1 stays deterministic and matches sequential legacy shape', () => {
  const a = generateEllipseCampaign('continents', 17, 12, 7);
  const b = generateEllipseCampaign('continents', 17, 12, 7);
  assert.deepEqual(a.tiles, b.tiles);
  assert.deepEqual(a.positions, b.positions);
  assert.deepEqual(a.pair, b.pair);
  const other = generateEllipseCampaign('continents', 83, 12, 7);
  assert.notDeepEqual(a.tiles, other.tiles);
});

test('mapgen makeCampaignMap ellipse-v1 tags metadata and places twelve sparse cities', () => {
  const g = makeCampaignMap('islands', 17, 'ai-vs-ai', false, {algorithm: 'ellipse-v1', density: 'sparse'});
  assert.equal(g.campaignMap.algorithm, 'ellipse-v1');
  assert.equal(g.campaignMap.density, 'sparse');
  assert.equal(g.cities.length, 12);
  assert.equal(g.cities.filter(c => c.owner === 'blue').length, 1);
  assert.equal(g.cities.filter(c => c.owner === 'red').length, 1);
  assert.deepEqual(
    makeCampaignMap('islands', 17, 'ai-vs-ai', false, {algorithm: 'ellipse-v1'}),
    g,
  );
});

test('mapgen organic-v1 is deterministic and playable for study seeds', () => {
  for (const layout of ['continents', 'islands', 'archipelago']) {
    for (const seed of [17, 83, 211]) {
      const first = generateOrganicTerrain(layout, seed, 12);
      const second = generateOrganicTerrain(layout, seed, 12);
      assert.deepEqual(first.tiles, second.tiles);
      assert.equal(first.report.ok, true, `${layout}/${seed} ${first.report.reasons.join('; ')}`);
      const g = makeCampaignMap(layout, seed, 'ai-vs-ai', false, {algorithm: 'organic-v1', density: 'sparse'});
      assert.equal(g.campaignMap.algorithm, 'organic-v1');
      assert.equal(g.cities.length, 12);
      assert.deepEqual(
        makeCampaignMap(layout, seed, 'ai-vs-ai', false, {algorithm: 'organic-v1', density: 'sparse'}),
        g,
      );
    }
  }
});

test('mapgen organic standard density places about sixty cities', () => {
  const g = makeCampaignMap('continents', 83, 'user-vs-computer', false, {
    algorithm: 'organic-v1', density: 'standard',
  });
  assert.equal(g.campaignMap.density, 'standard');
  assert.ok(g.cities.length >= 40, `expected dense city count, got ${g.cities.length}`);
  assert.ok(g.cities.length <= 70, `expected classic-like density, got ${g.cities.length}`);
});

test('mapgen lake-port candidates are rejected for organic placement', () => {
  const width = 100;
  const height = 60;
  const tiles = Array.from({length: width * height}, () => 'sea');
  for (let y = 20; y <= 30; y++) for (let x = 20; x <= 40; x++) tiles[y * width + x] = 'land';
  // Enclosed lake in the middle of the landmass.
  for (let y = 24; y <= 26; y++) for (let x = 28; x <= 32; x++) tiles[y * width + x] = 'sea';
  // Open ocean on the west border side.
  for (let y = 0; y < height; y++) for (let x = 0; x < 5; x++) tiles[y * width + x] = 'sea';
  for (let y = 22; y <= 28; y++) tiles[y * width + 20] = 'land';
  tiles[25 * width + 19] = 'sea';
  const ocean = mainOceanLabel(tiles);
  assert.ok(ocean.oceanId >= 0);
  const {positions} = placeCampaignCities(tiles, 'continents', 99, {
    cityCount: 8, minSpacing: 3, requireOceanPorts: true,
  });
  for (const p of positions) {
    const world = {width, height, tiles};
    // Inland cells are allowed on continents; coastal ones must touch ocean.
    const coastal = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]
      .some(([dx, dy]) => tiles[(p.y + dy) * width + (p.x + dx)] === 'sea');
    if (!coastal) continue;
    const touchesOcean = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]
      .some(([dx, dy]) => {
        const x = p.x + dx;
        const y = p.y + dy;
        return tiles[y * width + x] === 'sea' && ocean.label[y * width + x] === ocean.oceanId;
      });
    assert.equal(touchesOcean, true, `coastal city at ${p.x},${p.y} must touch main ocean`);
  }
});

test('mapgen analyzePlayability reports failures for empty maps', () => {
  const tiles = Array.from({length: 6000}, () => 'sea');
  const report = analyzePlayability(tiles, 'continents', 12);
  assert.equal(report.ok, false);
  assert.ok(report.reasons.length > 0);
});

test('mapgen ascii preview contains land markers', () => {
  const {tiles} = generateOrganicTerrain('continents', 211, 12);
  const ascii = tilesToAscii(tiles);
  assert.ok(ascii.includes('#'));
  assert.ok(ascii.includes('.'));
  assert.equal(ascii.split('\n').length, 60);
});
