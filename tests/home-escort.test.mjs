import test from 'node:test';
import assert from 'node:assert/strict';
import {makeRulesLab,setOrder,runMoveToOrders,advanceLabRound,updateAllKnowledge,importSave,exportSave} from '../dist/engine/index.js';
const get=(g,id)=>g.units.find(u=>u.id===id);

test('Go Home reaches a friendly city and clears order without combat',()=>{
 let g=makeRulesLab();
 g=setOrder(g,'u1',{kind:'go-home'});
 g=runMoveToOrders(g);
 assert.deepEqual(get(g,'u1').position,{x:8,y:25});
 assert.equal(get(g,'u1').order.kind,'none');
 assert.equal(g.rng.draws,0);
});
test('Go Home continues across turns and selects a reachable friendly city',()=>{
 let g=makeRulesLab();
 g.units[0].position={x:14,y:25};updateAllKnowledge(g);
 g=setOrder(g,'u1',{kind:'go-home'});
 for(let round=0;round<12&&get(g,'u1').order.kind!=='none';round++)
   g=round===0?runMoveToOrders(g):advanceLabRound(g);
 assert.deepEqual(get(g,'u1').position,{x:8,y:25});
 assert.equal(get(g,'u1').order.kind,'none');
});
test('Escort follows another friendly unit without stacking or combat',()=>{
 let g=makeRulesLab();
 g.units.push({...structuredClone(get(g,'u1')),id:'escort',position:{x:14,y:25}});
 updateAllKnowledge(g);
 g=setOrder(g,'escort',{kind:'escort',targetId:'u1'});
 for(let i=0;i<8;i++)g=i===0?runMoveToOrders(g):advanceLabRound(g);
 const follower=get(g,'escort'),target=get(g,'u1');
 assert.ok(Math.max(Math.abs(follower.position.x-target.position.x),Math.abs(follower.position.y-target.position.y))<=1);
 assert.notDeepEqual(follower.position,target.position);
 assert.equal(follower.order.kind,'escort');
 assert.equal(g.rng.draws,0);
});
test('Escort refuses enemy, self, and nonexistent target',()=>{
 const g=makeRulesLab();
 for(const targetId of ['u1','u3','absent'])
   assert.throws(()=>setOrder(g,'u1',{kind:'escort',targetId}),/Escort/);
});
test('Escort clears order if its target disappears',()=>{
 let g=makeRulesLab();
 g.units.push({...structuredClone(get(g,'u1')),id:'escort',position:{x:14,y:25}});
 g=setOrder(g,'escort',{kind:'escort',targetId:'u1'});
 g.units=g.units.filter(u=>u.id!=='u1');updateAllKnowledge(g);
 g=runMoveToOrders(g);
 assert.equal(get(g,'escort').order.kind,'none');
});
test('Go Home and Escort roundtrip through save files',()=>{
 let g=makeRulesLab();
 g.units.push({...structuredClone(get(g,'u1')),id:'escort',position:{x:14,y:25}});
 g=setOrder(g,'escort',{kind:'escort',targetId:'u1'});
 g=setOrder(g,'u1',{kind:'go-home'});
 assert.deepEqual(importSave(exportSave(g)).units,g.units);
});
test('Malformed escort references are rejected by save validation',()=>{
 const g=makeRulesLab();
 for(const targetId of ['u3','u1','missing']){
   const edited=structuredClone(g);
   edited.units[0].order={kind:'escort',targetId};
   assert.throws(()=>importSave(JSON.stringify(edited)),/escort/i);
 }
});

test('Go Home may enter an owned city containing another friendly unit',()=>{
 let g=makeRulesLab();
 const guard={...structuredClone(get(g,'u1')),id:'guard',position:{x:8,y:25}};
 g.units.push(guard);updateAllKnowledge(g);
 g=setOrder(g,'u1',{kind:'go-home'});
 g=runMoveToOrders(g);
 assert.deepEqual(get(g,'u1').position,{x:8,y:25});
 assert.equal(get(g,'u1').order.kind,'none');
});
