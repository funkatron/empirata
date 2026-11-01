import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../dist/engine/index.js';
import {scenario} from '../scripts/campaign-study.mjs';
import {layouts} from '../scripts/campaign-maps.mjs';
test('Sparse/dense campaigns and swapped factions keep matching terrain and start locations',()=>{
 for(const layout of layouts)for(const seed of [17,83,211]){
  const sparse=scenario(E,{layout,seed,cities:12,swap:false});
  const dense=scenario(E,{layout,seed,cities:64,swap:false});
  const swapped=scenario(E,{layout,seed,cities:64,swap:true});
  assert.equal(sparse.cities.length,12);assert.equal(dense.cities.length,64);
  assert.deepEqual(sparse.tiles,dense.tiles);assert.deepEqual(dense.tiles,swapped.tiles);
  assert.deepEqual(sparse.cities.filter(c=>c.owner).map(c=>c.position),dense.cities.filter(c=>c.owner).map(c=>c.position));
  for(const c of dense.cities.filter(c=>c.owner))assert.equal(swapped.cities.find(d=>d.id===c.id).owner,c.owner==='blue'?'red':'blue');
  assert.equal(sparse.units.length,0);assert.equal(dense.units.length,0);
  E.importSave(E.exportSave(dense));
 }
});

test('Nearby rival starts are paired, coastal and separated by the declared distance',()=>{
 for(const layout of layouts){
  const g=scenario(E,{layout,seed:83,cities:64,swap:false,profile:'near'});
  const swap=scenario(E,{layout,seed:83,cities:64,swap:true,profile:'near'});
  const [a,b]=g.cities.filter(c=>c.owner),d=Math.max(Math.abs(a.position.x-b.position.x),Math.abs(a.position.y-b.position.y));
  assert.ok(d>=12&&d<=25);assert.ok(E.isCoastal(g,a.position)&&E.isCoastal(g,b.position));
  for(const c of g.cities.filter(c=>c.owner))assert.notEqual(swap.cities.find(s=>s.id===c.id).owner,c.owner);
 }
});
