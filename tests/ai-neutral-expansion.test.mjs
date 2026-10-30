import test from 'node:test';
import assert from 'node:assert/strict';
import {makeRulesLab,endTurn,playRedOpponent,updateAllKnowledge,emptyKnowledge,getPlayerView,exportSave,importSave} from '../dist/engine/index.js';
function opening(withTransport){
 const g=endTurn(makeRulesLab());
 g.tiles.fill('sea');
 for(let y=33;y<=39;y++)for(let x=71;x<=80;x++)g.tiles[y*g.width+x]='land';
 g.cities=g.cities.filter(c=>c.owner==='red'||c.owner==='blue');
 const home=g.cities.find(c=>c.owner==='red');home.position={x:80,y:36};
 g.cities.push({...structuredClone(home),id:'neutral',owner:null,position:{x:73,y:36},production:null,progress:0});
 const base=g.units.find(u=>u.id==='u3');
 g.units=[{...structuredClone(base),position:{...home.position}},
 {...structuredClone(base),id:'mobile',position:{x:79,y:36}}];
 if(withTransport)g.units.push({...structuredClone(base),id:'transport',kind:'transport',position:{x:82,y:36}});
 for(const f of ['blue','red','green'])g.knowledge[f]=emptyKnowledge(g);
 updateAllKnowledge(g);return g;
}
for(const fleet of [false,true])test(`Mobile army scouts beyond its city guard with fleet=${fleet}`,()=>{
 const g=opening(fleet),before=getPlayerView(g,'red');
 assert.ok(!before.cells.some(c=>c.city?.id==='neutral'));
 const next=playRedOpponent(g);
 assert.deepEqual(next.units.find(u=>u.id==='u3').position,{x:80,y:36});
 assert.notDeepEqual(next.units.find(u=>u.id==='mobile').position,{x:79,y:36});
 assert.ok(getPlayerView(next,'red').cells.filter(c=>c.terrain!==null).length>before.cells.filter(c=>c.terrain!==null).length);
 assert.deepEqual(playRedOpponent(importSave(exportSave(g))),next);
});
test('Exploration leads to discovery and capture of an initially unknown neutral city',()=>{
 let g=opening(true);
 for(let i=0;i<50&&g.cities.find(c=>c.id==='neutral').owner!== 'red';i++){
  g=playRedOpponent(g);g=endTurn(endTurn(g));
 }
 assert.equal(g.cities.find(c=>c.id==='neutral').owner,'red');
});
