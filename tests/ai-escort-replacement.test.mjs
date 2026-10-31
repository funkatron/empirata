import test from 'node:test';
import assert from 'node:assert/strict';
import {makeRulesLab,endTurn,playRedOpponent,updateAllKnowledge,exportSave,importSave} from '../dist/engine/index.js';
function fleet(){
 const g=endTurn(makeRulesLab()),base=structuredClone(g.units.find(u=>u.owner==='red'));
 g.units=g.units.filter(u=>u.owner!=='red');
 g.units.push({...base,id:'guard',position:{x:80,y:36}},
  {...base,id:'transport',kind:'transport',position:{x:90,y:36}},
  {...base,id:'cargo',aboard:'transport',position:{x:90,y:36}});
 for(let i=0;i<2;i++)g.units.push({...base,id:`escort-${i}`,kind:'destroyer',position:{x:90+i,y:40}});
 g.knowledge.red.terrain=[...g.tiles];
 for(const c of g.cities)g.knowledge.red.cities[c.id]={id:c.id,owner:c.owner,production:null,productionKnown:false};
 updateAllKnowledge(g);return g;
}
for(const lost of [1,2])test(`Replace ${lost===2?'all escorts':'a lost escort'} after reconnaissance is complete and troops are embarked`,()=>{
 const g=fleet();
 assert.equal(playRedOpponent(g).cities.find(c=>c.id==='c-red').production,'army','Existing protection satisfies current demand');
 g.units=g.units.filter(u=>!Array.from({length:lost},(_,i)=>`escort-${i}`).includes(u.id));
 const before=structuredClone(g),next=playRedOpponent(g);
 assert.equal(next.cities.find(c=>c.id==='c-red').production,'destroyer');
 assert.deepEqual(g,before);assert.deepEqual(playRedOpponent(importSave(exportSave(g))),next);
 assert.equal(next.units.find(u=>u.id==='guard').aboard,null);
});
test('Replacement construction retains progress and produces a new escort through normal turns',()=>{
 let g=fleet();g.units=g.units.filter(u=>u.id!=='escort-0');g=playRedOpponent(g);
 let replay=importSave(exportSave(g));
 for(let i=0;i<24;i++){
  g=playRedOpponent(endTurn(endTurn(g)));replay=playRedOpponent(endTurn(endTurn(replay)));
  assert.deepEqual(g,replay);
  if(i===7){const c=g.cities.find(c=>c.id==='c-red');assert.equal(c.production,'destroyer');assert.equal(c.progress,8);}
 }
 assert.ok(g.units.some(u=>u.owner==='red'&&u.kind==='destroyer'&&u.id!=='escort-1'));
 assert.ok(g.events.some(e=>e.kind==='production'&&e.message.includes('completed Destroyer')));
 assert.deepEqual(importSave(exportSave(g)),g);
});
test('Other factories already replacing escorts prevent duplicate replacement orders',()=>{
 const g=fleet();g.units=g.units.filter(u=>u.id!=='escort-0');
 g.cities.push({id:'replacement-port',owner:'red',position:{x:79,y:35},production:'destroyer',progress:7,firstCycle:true});
 g.tiles[35*g.width+79]='land';g.units.push({...structuredClone(g.units.find(u=>u.id==='guard')),id:'second-guard',position:{x:79,y:35}});
 updateAllKnowledge(g);const next=playRedOpponent(g);
 assert.equal(next.cities.filter(c=>c.owner==='red'&&c.production==='destroyer').length,1);
 assert.equal(next.cities.find(c=>c.id==='replacement-port').progress,7);
});
