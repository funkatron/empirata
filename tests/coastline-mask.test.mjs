import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// Small deterministic renderer-contract check. Browser screenshots remain a
// separate visual review; no long campaigns or browser installation in CI.
const art=readFileSync(new URL('../src/ui/map-art.ts',import.meta.url),'utf8');
const render=readFileSync(new URL('../src/ui/render.ts',import.meta.url),'utf8');

test('coastline renderer receives eight neighbor directions',()=>{
  assert.match(render,/seaAt\(0,-1\),seaAt\(1,0\),seaAt\(0,1\),seaAt\(-1,0\)/);
  assert.match(render,/seaAt\(1,-1\),seaAt\(1,1\),seaAt\(-1,1\),seaAt\(-1,-1\)/);
});
test('diagonal-only sea neighbors never paint shoreline spurs',()=>{
  assert.match(art,/const mask=\(north\?1:0\)\|\(east\?2:0\)\|\(south\?4:0\)\|\(west\?8:0\)/);
  assert.doesNotMatch(art,/if\(!\(mask&bit\)\)continue/);
  assert.match(art,/imageSmoothingEnabled=false/);
});

test('shoreline water shape is composited from terrain atlas',()=>{
  assert.match(art,/for\(let y=0;y<32;y\+\+\)for\(let x=0;x<32;x\+\+\)/);
  assert.match(art,/globalCompositeOperation='source-in'/);
  assert.match(art,/drawImage\(atlas,0,32,32,32,0,0,32,32\)/);
  assert.match(art,/const edge=\(horizontal:boolean,reverse:boolean\)/);
});

test('diagonal coves are carved for isolated diagonal sea contacts',()=>{
  assert.match(art,/ne&&!n&&!e/);
  assert.match(art,/se&&!s&&!e/);
  assert.match(art,/sw&&!s&&!w/);
  assert.match(art,/nw&&!n&&!w/);
  assert.match(art,/if\(xx\+yy>4\)continue/);
  assert.match(art,/if\(xx\+yy!==5\)continue/);
});
