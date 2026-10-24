import test from 'node:test';
import assert from 'node:assert/strict';
import {makeRulesLab,setOrder,runMoveToOrders,advanceLabRound,updateAllKnowledge} from '../dist/engine/index.js';

test('Go Direction continues in one bearing and retains orders across turns',()=>{
 let g=makeRulesLab();
 g=setOrder(g,'u1',{kind:'go-direction',direction:{x:1,y:0}});
 g=runMoveToOrders(g);
 assert.deepEqual(g.units.find(u=>u.id==='u1').position,{x:10,y:25});
 g=advanceLabRound(g);
 assert.deepEqual(g.units.find(u=>u.id==='u1').position,{x:11,y:25});
 assert.equal(g.units.find(u=>u.id==='u1').order.kind,'go-direction');
});
test('Go Direction refuses attacks on enemies and clears order',()=>{
 let g=makeRulesLab();g.units[2].position={x:10,y:25};updateAllKnowledge(g);
 g=setOrder(g,'u1',{kind:'go-direction',direction:{x:1,y:0}});
 g=runMoveToOrders(g);
 assert.deepEqual(g.units.find(u=>u.id==='u1').position,{x:9,y:25});
 assert.equal(g.units.find(u=>u.id==='u1').order.kind,'none');
 assert.equal(g.rng.draws,0);
});
test('Go Direction refuses invalid bearings',()=>{
 const g=makeRulesLab();
 assert.throws(()=>setOrder(g,'u1',{kind:'go-direction',direction:{x:2,y:0}}),/compass/);
 assert.throws(()=>setOrder(g,'u1',{kind:'go-direction',direction:{x:0,y:0}}),/compass/);
});
test('Patrol travels to endpoint then returns toward origin',()=>{
 let g=makeRulesLab();
 g=setOrder(g,'u1',{kind:'patrol',from:{x:9,y:25},to:{x:11,y:25},outbound:true});
 g=runMoveToOrders(g);
 assert.equal(g.units.find(u=>u.id==='u1').order.kind,'patrol');
 for(let i=0;i<3;i++)g=advanceLabRound(g);
 const u=g.units.find(u=>u.id==='u1');
 assert.ok(u.position.x<=11 && u.position.x>=9);
 assert.equal(u.order.kind,'patrol');
});
