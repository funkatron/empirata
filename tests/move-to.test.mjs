import test from 'node:test';
import assert from 'node:assert/strict';
import {makeRulesLab,setOrder,runMoveToOrders,advanceLabRound,updateAllKnowledge} from '../dist/engine/index.js';

test('Move To follows a destination over multiple rounds without manual steps',()=>{
  let g=makeRulesLab();
  g=setOrder(g,'u1',{kind:'move-to',destination:{x:14,y:28}});
  g=runMoveToOrders(g);
  assert.equal(g.units.find(u=>u.id==='u1').spent,1);
  assert.equal(g.units.find(u=>u.id==='u1').order.kind,'move-to');
  for(let i=0;i<8&&g.units.find(u=>u.id==='u1').order.kind==='move-to';i++)g=advanceLabRound(g);
  const u=g.units.find(u=>u.id==='u1');
  assert.deepEqual(u.position,{x:14,y:28});assert.equal(u.order.kind,'none');
});
test('Move To never attacks adjacent enemy or captures neutral city automatically',()=>{
  let g=makeRulesLab();
  g.units[2].position={x:10,y:25};updateAllKnowledge(g);
  g=setOrder(g,'u1',{kind:'move-to',destination:{x:10,y:25}});
  g=runMoveToOrders(g);
  assert.deepEqual(g.units.find(u=>u.id==='u1').position,{x:9,y:25});
  assert.equal(g.units.find(u=>u.id==='u1').order.kind,'none');
  assert.equal(g.rng.draws,0);
});
test('A blocked path ends order without secretly revealing terrain',()=>{
  let g=makeRulesLab();
  assert.throws(()=>setOrder(g,'u1',{kind:'move-to',destination:{x:99,y:4}}),/Destination/);
});
