import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const art=readFileSync(new URL('../src/ui/map-art.ts',import.meta.url),'utf8');
const ui=readFileSync(new URL('../src/ui/main.ts',import.meta.url),'utf8');

test('terrain renderer passes all eight known sea neighbors to coastlines',()=>{
  assert.match(ui,/seaAt\(0,-1\),seaAt\(1,0\),seaAt\(0,1\),seaAt\(-1,0\)/);
  assert.match(ui,/seaAt\(1,-1\),seaAt\(1,1\),seaAt\(-1,1\),seaAt\(-1,-1\)/);
  assert.match(ui,/observerTerrain\(game,view,/);
});
test('diagonal corners contribute to sprite cache key and actual corner mask',()=>{
  assert.match(art,/northEast\?16:0/);
  assert.match(art,/northWest\?128:0/);
  assert.match(art,/ne&&!n&&!e/);
  assert.match(art,/nw&&!n&&!w/);
});
test('coast water samples the same atlas sea row instead of a separate blue',()=>{
  assert.match(art,/wc\.drawImage\(atlas,0,32,32,32,0,0,32,32\)/);
  assert.match(art,/globalCompositeOperation='source-in'/);
  assert.match(art,/shoreCache\.clear\(\)/);
});
