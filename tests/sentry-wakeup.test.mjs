import test from 'node:test';
import assert from 'node:assert/strict';
import {makeRulesLab,moveUnit,setOrder,updateAllKnowledge,emptyKnowledge,exportSave,importSave} from '../dist/engine/index.js';
function encounter(kind='army',target='army'){
 const g=makeRulesLab(),base=g.units[0];g.cities=[];g.tiles.fill('sea');
 g.units=[{...structuredClone(base),id:'guard',kind,owner:'red',position:{x:20,y:20},order:{kind:'sentry'},spent:1,fuel:kind==='fighter'?20:null},
 {...structuredClone(base),id:'approach',kind:target,owner:'blue',position:{x:22,y:20},order:{kind:'none'},spent:0,fuel:target==='fighter'?20:null}];
 for(const u of g.units)if(u.kind==='army')g.tiles[u.position.y*g.width+u.position.x]='land';
 g.tiles[20*g.width+21]=target==='army'?'land':'sea';
 for(const f of ['blue','red','green'])g.knowledge[f]=emptyKnowledge(g);
 updateAllKnowledge(g);return g;
}
test('Enemy movement wakes opposing sentry without granting moves or combat',()=>{
 const g=encounter(),before=structuredClone(g),next=moveUnit(g,'approach',{x:21,y:20});
 const guard=next.units.find(u=>u.id==='guard');
 assert.equal(guard.order.kind,'none');assert.equal(guard.spent,1);
 assert.deepEqual(guard.position,{x:20,y:20});assert.deepEqual(next.rng,g.rng);assert.deepEqual(g,before);
 assert.deepEqual(moveUnit(importSave(exportSave(g)),'approach',{x:21,y:20}),next);
 const count=next.events.length;updateAllKnowledge(next);assert.equal(next.events.length,count);
});
test('Undetectable submarine and distant known enemy do not wake sentry',()=>{
 const g=encounter('transport','submarine');
 const next=moveUnit(g,'approach',{x:21,y:20});
 assert.equal(next.units.find(u=>u.id==='guard').order.kind,'sentry');
 const distant=encounter();distant.units.push({...structuredClone(distant.units[0]),id:'spotter',owner:'red',position:{x:23,y:20},order:{kind:'none'}});
 updateAllKnowledge(distant);assert.equal(distant.units[0].order.kind,'sentry');
});
test('Destroyer sentry wakes for submarine contact, cargo and loading orders remain distinct',()=>{
 const g=encounter('destroyer','submarine');
 const next=moveUnit(g,'approach',{x:21,y:20});
 assert.equal(next.units[0].order.kind,'none');
 const cargoGame=encounter('transport');
 cargoGame.units.push({...structuredClone(cargoGame.units[0]),id:'cargo',kind:'army',aboard:'guard'});
 assert.equal(moveUnit(cargoGame,'approach',{x:21,y:20}).units.find(u=>u.id==='cargo').order.kind,'sentry');
 const loading=encounter('transport');loading.units[0].order={kind:'load-ship'};
 assert.equal(moveUnit(loading,'approach',{x:21,y:20}).units[0].order.kind,'load-ship');
});
test('Airborne fighter cannot receive sentry but a city-based fighter can',()=>{
 const g=encounter('army','fighter');
 assert.throws(()=>setOrder(g,'approach',{kind:'sentry'}),/Sentry/);
 const invalid=structuredClone(g);invalid.units[1].order={kind:'sentry'};
 assert.throws(()=>importSave(exportSave(invalid)),/Sentry/);
 g.cities.push({id:'base',owner:'blue',position:{x:22,y:20},production:null,progress:0,firstCycle:true});
 updateAllKnowledge(g);
 const based=setOrder(g,'approach',{kind:'sentry'});
 assert.equal(based.units.find(u=>u.id==='approach').order.kind,'sentry');
 assert.deepEqual(importSave(exportSave(based)),based);
 g.cities=[];g.units.push({...structuredClone(g.units[1]),id:'carrier',kind:'carrier',fuel:null});
 g.units[1].aboard='carrier';
 assert.equal(setOrder(g,'approach',{kind:'sentry'}).units[1].order.kind,'sentry');
});

test('Restoring a newly assigned sentry order does not execute a wake transition',()=>{
 const g=encounter('destroyer','transport');g.units[1].position={x:21,y:20};
 updateAllKnowledge(g);g.units[0].order={kind:'sentry'};
 assert.deepEqual(importSave(exportSave(g)),g);
 updateAllKnowledge(g);assert.equal(g.units[0].order.kind,'none');
});
