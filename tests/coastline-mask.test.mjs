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

test('shoreline pixels are composed once from cardinal edge distances',()=>{
  assert.match(art,/for\(let y=0;y<32;y\+\+\)for\(let x=0;x<32;x\+\+\)/);
  assert.match(art,/const d=Math\.min\(\.\.\.distances\)/);
  assert.match(art,/if\(d>=3\)continue/);
  assert.doesNotMatch(art,/function edge\(/);
  assert.doesNotMatch(art,/for\(const \[corner,active\]/);
});

test('adjacent sea edges use symmetric rounded corner joins',()=>{
  for(const pair of ['n&&w','n&&e','s&&w','s&&e'])assert.ok(art.includes('if('+pair+')d=Math.min(d,roundedJoin('));
  assert.match(art,/Math\.abs\(a-b\)/);
  assert.match(art,/const band=Math\.floor\(d\)/);
  assert.doesNotMatch(art,/c\.fillRect\(x,y,1,1\)[\s\S]*c\.fillRect\(x,y,1,1\)/);
});
