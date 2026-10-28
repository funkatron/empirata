import test from 'node:test';
import assert from 'node:assert/strict';
import * as engine from '../dist/engine/index.js';
import {makeCampaign,layouts} from '../scripts/campaign-maps.mjs';

test('Generated campaign families reproduce clean starts with varied terrain and private city sight',()=>{
  const maps=layouts.map(layout=>makeCampaign(engine,layout,17));
  assert.equal(new Set(maps.map(g=>JSON.stringify(g.tiles))).size,layouts.length);
  for(let i=0;i<maps.length;i++){
    const g=maps[i];
    assert.deepEqual(makeCampaign(engine,layouts[i],17),g);
    assert.notDeepEqual(makeCampaign(engine,layouts[i],83).tiles,g.tiles);
    assert.equal(g.units.length,0);
    assert.ok(g.cities.every(c=>c.progress===0&&c.production===null));
    for(const faction of ['blue','red']){
      const view=engine.getPlayerView(g,faction);
      assert.equal(view.ownCities.length,1);
      assert.equal(view.cells.filter(c=>c.city).length,1);
      assert.equal(view.cells.filter(c=>c.terrain!==null).length,9);
    }
    assert.deepEqual(engine.importSave(engine.exportSave(g)),g);
    const swapped=makeCampaign(engine,layouts[i],17,{swap:true});
    assert.deepEqual(swapped.tiles,g.tiles);
    assert.deepEqual(swapped.cities.map(c=>c.position),g.cities.map(c=>c.position));
    assert.equal(swapped.cities.find(c=>c.owner==='blue').id,g.cities.find(c=>c.owner==='red').id);
  }
});

test('Generated terrain campaigns produce normally and replay exactly after a mid-game save',()=>{
  for(const layout of ['continents','archipelago']){
    let a=makeCampaign(engine,layout,83);
    for(let i=0;i<8;i++)a=engine.advanceLabRound(a);
    let b=engine.importSave(engine.exportSave(a));
    for(let i=0;i<5;i++){
      a=engine.advanceLabRound(a);b=engine.advanceLabRound(b);
      assert.deepEqual(b,a,`${layout}, round ${a.round}`);
    }
    assert.ok(a.events.some(e=>e.kind==='production'&&e.message.includes('completed Army')));
  }
});
