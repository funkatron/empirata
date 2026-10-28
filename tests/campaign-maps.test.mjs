import test from 'node:test';
import assert from 'node:assert/strict';
import {getPlayerView,exportSave,importSave,isCoastal} from '../dist/engine/index.js';
import {makeCampaignMap,mapFamilies} from '../tools/campaign-maps.mjs';

test('Evaluation maps vary terrain and retain honest clean starts and valid saves',()=>{
  const terrains=new Set();
  for(const family of mapFamilies)for(const seed of [1,7]){
    const g=makeCampaignMap(family,seed);
    assert.deepEqual(g,makeCampaignMap(family,seed));
    assert.deepEqual(importSave(exportSave(g)),g);
    assert.equal(g.units.length,0);
    assert.equal(g.cities.length,10);
    assert.equal(new Set(g.cities.map(c=>`${c.position.x},${c.position.y}`)).size,10);
    assert.ok(g.cities.every(c=>g.tiles[c.position.y*g.width+c.position.x]==='land'));
    for(const side of ['blue','red']){
      const view=getPlayerView(g,side);
      assert.equal(view.ownCities.length,1);
      assert.ok(isCoastal(g,view.ownCities[0].position));
      assert.equal(view.cells.filter(c=>c.city).length,1,'No pre-discovered targets');
      assert.equal(view.cells.filter(c=>c.terrain!==null).length,9);
      assert.equal(view.ownCities[0].production,null);
    }
    terrains.add(g.tiles.join(''));
  }
  assert.equal(terrains.size,6);
});
