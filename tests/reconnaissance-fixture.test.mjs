import test from 'node:test';
import assert from 'node:assert/strict';
import * as engine from '../dist/engine/index.js';
import {makeReconnaissanceFixture} from '../scripts/reconnaissance-fixture.mjs';

for(const layout of ['continents','islands','archipelago'])
 for(const seed of [29,83,137])for(const swap of [false,true])
  test(`seeded reconnaissance coast ${layout}/${seed} swapped=${swap}`,()=>{
   const {state,faction,scoutIds,digest}=makeReconnaissanceFixture(engine,{layout,seed,swap});
   const [destroyer,army]=scoutIds.map(id=>state.units.find(u=>u.id===id));
   const transport=state.units.find(u=>u.id==='fixture-transport');
   const cargo=state.units.find(u=>u.id==='fixture-cargo');
   const terrain=u=>state.tiles[u.position.y*state.width+u.position.x];
   assert.equal(terrain(destroyer),'sea');
   assert.equal(terrain(transport),'sea');
   assert.equal(terrain(army),'land');
   assert.notDeepEqual(destroyer.position,transport.position);
   assert.equal(cargo.aboard,transport.id);
   assert.equal(cargo.owner,faction);
   assert.ok(engine.getPlayerView(state,faction).enemies.some(e=>e.id==='fixture-stale-contact'&&e.stale));
   assert.equal(digest,makeReconnaissanceFixture(engine,{layout,seed,swap}).digest);
  });
