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
test('diagonal corner masks do not expose fogged or cardinal shoreline tiles',()=>{
  for(const [diagonal,first,second,bit] of [
    ['southEast','south','east',16],['southWest','south','west',32],
    ['northWest','north','west',64],['northEast','north','east',128],
  ]){
    assert.ok(art.includes(`(${diagonal}&&!${first}&&!${second}?${bit}:0)`));
  }
  assert.match(art,/if\(!\(mask&bit\)\)continue/);
  assert.match(art,/imageSmoothingEnabled=false/);
});
