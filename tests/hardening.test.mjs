import test from 'node:test';
import assert from 'node:assert/strict';
import {makeRulesLab,moveUnit,resolveCityAssault,runMoveToOrders,setOrder,updateAllKnowledge,importSave,exportSave,getPlayerView,nextRandom15} from '../dist/engine/index.js';
const unit=(g,id='u1')=>g.units.find(u=>u.id===id);
const tamper=(g,edit)=>{const state=structuredClone(g);edit(state);return JSON.stringify(state);};

test('Recovered DOS RNG seed-1 first ten results are exact',()=>{
 const expected=[41,18467,6334,26500,19169,15724,11478,29358,26962,24464];
 let state={seed:1,draws:0};for(const value of expected){const result=nextRandom15(state);assert.equal(result.value,value);state=result.next;}
 assert.equal(state.draws,10);
});
test('Seeded combat locks exact winner, damage, position and RNG state',()=>{
 const g=makeRulesLab();g.rng={seed:1,draws:0};g.units[2].position={x:10,y:25};const original=structuredClone(g);
 const result=moveUnit(g,'u1',{x:10,y:25});assert.deepEqual(g,original);
 assert.deepEqual(unit(result).position,{x:10,y:25});assert.equal(unit(result).damage,0);assert.equal(unit(result).spent,1);
 assert.equal(unit(result,'u3'),undefined);assert.deepEqual(result.rng,{seed:2745024,draws:1});
});
test('Seeded combat repeats exactly following save restoration',()=>{
 const g=makeRulesLab();g.rng={seed:1,draws:0};g.units[2].position={x:10,y:25};updateAllKnowledge(g);
 assert.deepEqual(moveUnit(importSave(exportSave(g)),'u1',{x:10,y:25}),moveUnit(g,'u1',{x:10,y:25}));
});
test('Seeded city assault has exact captured result and single draw',()=>{
 const g=makeRulesLab();g.rng={seed:1,draws:0};
 g.cities.push({id:'neutral-test',position:{x:10,y:25},owner:null,production:null,progress:0,firstCycle:true});
 const result=resolveCityAssault(g,'u1','neutral-test');
 assert.equal(result.cities.at(-1).owner,'blue');assert.equal(unit(result),undefined);
 assert.deepEqual(result.rng,{seed:2745024,draws:1});
});
test('Unseen enemy repositioning does not affect player-facing knowledge',()=>{
 const a=makeRulesLab(),b=structuredClone(a);
 b.units[2].position={x:50,y:40};updateAllKnowledge(a);updateAllKnowledge(b);
 assert.deepEqual(getPlayerView(a,'blue'),getPlayerView(b,'blue'));
});
test('Undiscovered city cannot change pathfinding or silently reveal a route',()=>{
 const base=makeRulesLab();base.units[0].position={x:15,y:25};base.units=base.units.filter(u=>u.id!=='u2');
 updateAllKnowledge(base);const hidden=structuredClone(base);
 hidden.cities.push({id:'secret',position:{x:16,y:25},owner:'red',production:null,progress:0,firstCycle:true});
 assert.deepEqual(getPlayerView(base,'blue'),getPlayerView(hidden,'blue'));
 const destination={x:16,y:25};
 const normal=runMoveToOrders(setOrder(base,'u1',{kind:'move-to',destination}));
 const contact=runMoveToOrders(setOrder(hidden,'u1',{kind:'move-to',destination}));
 assert.deepEqual(unit(normal).position,destination);
 assert.ok(!contact.events.some(e=>e.message.includes('no safe route')));
});
test('Corrupt saved unit kinds, orders, coordinates, IDs, cargo and RNG are rejected',()=>{
 const g=makeRulesLab();
 for(const edit of [
 x=>{x.units[0].kind='dragon'},x=>{x.units[0].position.x=105},
 x=>{x.units[0].order={kind:'move-to',destination:{x:999,y:25}}},
 x=>{x.units[0].order={kind:'go-direction',direction:{x:500,y:0}}},
 x=>{x.units[0].damage=-1},x=>{x.units[0].spent=Infinity},
 x=>{x.units[0].aboard='missing-ship'},x=>{x.units[1].id=x.units[0].id},
 x=>{x.rng.seed='not-a-number'}
 ])assert.throws(()=>importSave(tamper(g,edit)));
});
test('Corrupt city ownership, production, location or duplicate IDs are rejected',()=>{
 const g=makeRulesLab();
 for(const edit of [
 x=>{x.cities[0].position.y=-1},x=>{x.cities[0].owner='purple'},
 x=>{x.cities[0].production='spaceship'},x=>{x.cities[1].id=x.cities[0].id}
 ])assert.throws(()=>importSave(tamper(g,edit)));
});
test('Standing orders stop before city assault without rolling RNG',()=>{
 const g=makeRulesLab();
 g.cities.push({id:'block',position:{x:10,y:25},owner:null,production:null,progress:0,firstCycle:true});
 updateAllKnowledge(g);
 const result=runMoveToOrders(setOrder(g,'u1',{kind:'go-direction',direction:{x:1,y:0}}));
 assert.equal(result.rng.draws,0);assert.deepEqual(unit(result).position,{x:9,y:25});
});
