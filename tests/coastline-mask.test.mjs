import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// Small deterministic renderer-contract check. Browser screenshots remain a
// separate visual review; no long campaigns or browser installation in CI.
const art=readFileSync(new URL('../src/ui/map-art.ts',import.meta.url),'utf8');
const main=readFileSync(new URL('../src/ui/main.ts',import.meta.url),'utf8');

test('coastline renderer receives eight neighbor directions',()=>{
  assert.match(main,/seaAt\(0,-1\),seaAt\(1,0\),seaAt\(0,1\),seaAt\(-1,0\)/);
  assert.match(main,/seaAt\(1,-1\),seaAt\(1,1\),seaAt\(-1,1\),seaAt\(-1,-1\)/);
});
test('diagonal-only sea neighbors never paint shoreline spurs',()=>{
  assert.match(art,/const mask=\(north\?1:0\)\|\(east\?2:0\)\|\(south\?4:0\)\|\(west\?8:0\)/);
  assert.doesNotMatch(art,/if\(!\(mask&bit\)\)continue/);
  assert.match(art,/imageSmoothingEnabled=false/);
});
