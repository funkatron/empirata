import test from 'node:test';
import assert from 'node:assert/strict';
import {makeRulesLab,emptyKnowledge,updateAllKnowledge,getPlayerView,exportSave,importSave} from '../dist/engine/index.js';
const kinds=['army','fighter','transport','submarine','destroyer','cruiser','carrier','battleship'];
function fixture(observer,target){
 const g=makeRulesLab(),base=structuredClone(g.units[0]);
 g.tiles.fill('sea');g.cities=[];
 g.units=[{...structuredClone(base),id:'observer',owner:'blue',kind:observer,position:{x:20,y:20}},
 {...structuredClone(base),id:'target',owner:'red',kind:target,position:{x:21,y:20}}];
 for(const u of g.units){u.aboard=null;u.fuel=u.kind==='fighter'?20:null;g.tiles[u.position.y*g.width+u.position.x]=u.kind==='army'?'land':'sea';}
 for(const f of ['blue','red','green'])g.knowledge[f]=emptyKnowledge(g);
 return g;
}
test('Manual adjacent detection matrix separates observer capabilities from terrain sight',()=>{
 for(const observer of kinds)for(const target of kinds){
  const g=fixture(observer,target);updateAllKnowledge(g);
  const expected=target==='submarine'?['destroyer','cruiser'].includes(observer):
   observer==='submarine'?!['army','fighter'].includes(target):true;
  const v=getPlayerView(g,'blue');
  assert.equal(v.enemies.some(e=>e.id==='target'),expected,`${observer} observing ${target}`);
  assert.ok(v.cells[20*g.width+21].visible,'Detection restriction must not hide terrain');
 }
});
test('Bare owned cities detect submarines only within adjacent range',()=>{
 const g=fixture('army','submarine');g.units=g.units.filter(u=>u.id==='target');
 g.cities=[{id:'port',owner:'blue',position:{x:20,y:20},production:null,progress:0,firstCycle:true}];
 g.tiles[20*g.width+20]='land';updateAllKnowledge(g);
 assert.equal(getPlayerView(g,'blue').enemies[0]?.stale,false);
 g.units[0].position={x:23,y:20};g.round++;updateAllKnowledge(g);
 assert.equal(getPlayerView(g,'blue').enemies.length,0,'Empty formerly detected square disproves old contact');
 assert.deepEqual(getPlayerView(importSave(exportSave(g)),'blue'),getPlayerView(g,'blue'));
});
test('Submarine cannot refresh or disprove army reports without a capable observer',()=>{
 const g=fixture('destroyer','army');updateAllKnowledge(g);
 g.units[0].kind='submarine';g.units[1].position={x:40,y:40};g.round++;
 updateAllKnowledge(g);
 const sight=getPlayerView(g,'blue').enemies.find(e=>e.id==='target');
 assert.ok(sight?.stale);assert.deepEqual(sight.position,{x:21,y:20});
 g.units.push({...structuredClone(g.units[0]),id:'capable',kind:'destroyer'});
 updateAllKnowledge(g);assert.equal(getPlayerView(g,'blue').enemies.length,0);
});
test('Hidden submarine movement cannot change an incapable observer view',()=>{
 const a=fixture('transport','submarine');
 const b=structuredClone(a);b.units.find(u=>u.id==='target').position={x:45,y:45};
 updateAllKnowledge(a);updateAllKnowledge(b);
 assert.deepEqual(getPlayerView(a,'blue'),getPlayerView(b,'blue'));
});
