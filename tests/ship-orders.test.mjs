import test from 'node:test';
import assert from 'node:assert/strict';
import {
  makeRulesLab,loadShip,unloadShip,setOrder,moveUnit,disembarkArmy,
  advanceLabRound,importSave,exportSave,updateAllKnowledge
} from '../dist/engine/index.js';

const get=(g,id)=>g.units.find(u=>u.id===id);
const transport=()=>{
  const g=makeRulesLab();
  get(g,'u2').kind='transport';
  get(g,'u1').position={x:8,y:25};
  updateAllKnowledge(g);
  return g;
};

test('Load Ship boards adjacent army on sentry and waits for more cargo',()=>{
  let g=transport();
  get(g,'u1').order={kind:'sentry'};
  const previous=structuredClone(g);
  g=loadShip(g,'u2');
  assert.equal(get(g,'u1').aboard,'u2');
  assert.equal(get(g,'u1').spent,1);
  assert.equal(get(g,'u1').order.kind,'none');
  assert.equal(get(g,'u2').order.kind,'load-ship');
  assert.equal(get(previous,'u1').aboard,null);
  assert.equal(g.rng.draws,0);
});

test('Load Ship wakes a transport at its damage-adjusted capacity',()=>{
  let g=transport();
  get(g,'u2').damage=2; // 2 army places remain
  g.units.push({...structuredClone(get(g,'u1')),id:'more',position:{x:8,y:24}});
  g=loadShip(g,'u2');
  assert.equal(g.units.filter(u=>u.aboard==='u2').length,2);
  assert.equal(get(g,'u2').order.kind,'none');
});

test('Waiting ship loads a newly arrived army at the next turn boundary',()=>{
  let g=transport();
  get(g,'u1').position={x:12,y:25};
  g=loadShip(g,'u2');
  assert.equal(get(g,'u2').order.kind,'load-ship');
  assert.throws(()=>moveUnit(g,'u2',{x:6,y:25}),/loading orders/);
  get(g,'u1').position={x:8,y:25};updateAllKnowledge(g);
  g=advanceLabRound(g);
  assert.equal(get(g,'u1').aboard,'u2');
  assert.equal(get(g,'u2').order.kind,'load-ship');
});

test('Unload Ship wakes cargo but never teleports or restores spent movement',()=>{
  let g=loadShip(transport(),'u2');
  const previous=get(g,'u1').spent;
  get(g,'u1').order={kind:'sentry'};
  g=unloadShip(g,'u2');
  assert.equal(get(g,'u1').aboard,'u2');
  assert.equal(get(g,'u1').order.kind,'none');
  assert.equal(get(g,'u1').spent,previous);
  assert.throws(()=>disembarkArmy(g,'u1',{x:8,y:24}),/movement/);
});

test('Load and Unload Ship reject army and opponent ships',()=>{
  const g=transport();
  assert.throws(()=>loadShip(g,'u1'),/transport or carrier/);
  assert.throws(()=>unloadShip(g,'u3'),/transport or carrier/);
});

test('Load Ship waiting status roundtrips through JSON save files',()=>{
  const g=transport();
  get(g,'u1').position={x:12,y:25};
  const waiting=loadShip(g,'u2');
  assert.equal(get(waiting,'u2').order.kind,'load-ship');
  assert.deepEqual(importSave(exportSave(waiting)),waiting);
});

test('Carrier Load Ship accepts adjacent fighter and wakes at full capacity',()=>{
  let g=transport();
  get(g,'u2').kind='carrier';
  get(g,'u2').damage=7; // capacity 1
  get(g,'u1').kind='fighter';get(g,'u1').fuel=6;
  g=setOrder(g,'u2',{kind:'load-ship'});
  assert.equal(get(g,'u1').aboard,'u2');
  assert.equal(get(g,'u1').fuel,20);
  assert.equal(get(g,'u2').order.kind,'none');
});

test('Amphibious invasion: load, sail, land, then capture a neutral city',()=>{
  let g=transport();
  // Short deterministic lab fixture, not an original .MAP scenario.
  g.rng={seed:1,draws:0};
  g.cities.push({id:'objective',position:{x:9,y:24},owner:null,production:null,progress:0,firstCycle:true});
  updateAllKnowledge(g);
  g=loadShip(g,'u2');
  assert.equal(get(g,'u1').aboard,'u2');
  g=setOrder(g,'u2',{kind:'none'});
  g=moveUnit(g,'u2',{x:6,y:25});
  g=moveUnit(g,'u2',{x:7,y:25});
  assert.deepEqual(get(g,'u1').position,{x:7,y:25});
  g=advanceLabRound(g);
  g=unloadShip(g,'u2');
  g=disembarkArmy(g,'u1',{x:8,y:24});
  assert.equal(get(g,'u1').aboard,null);
  assert.deepEqual(get(g,'u1').position,{x:8,y:24});
  g=advanceLabRound(g);
  g=moveUnit(g,'u1',{x:9,y:24});
  assert.equal(g.cities.find(c=>c.id==='objective').owner,'blue');
  assert.equal(get(g,'u1'),undefined);
  assert.equal(g.rng.draws,1);
});

test('Leaving a friendly city picks up co-located armies without a Load Ship order',()=>{
  let g=transport();
  get(g,'u2').position={x:8,y:25};
  updateAllKnowledge(g);
  g=moveUnit(g,'u2',{x:7,y:25});
  assert.equal(get(g,'u1').aboard,'u2');
  assert.deepEqual(get(g,'u1').position,{x:7,y:25});
  assert.equal(get(g,'u1').spent,1);
  assert.equal(get(g,'u2').spent,1);
});

test('Loading to full wakes a ship whose remaining slot is boarded manually',()=>{
  let g=transport();
  get(g,'u1').position={x:12,y:25};
  get(g,'u2').damage=2; // capacity 2
  g.units.push({...structuredClone(get(g,'u1')),id:'first',position:{x:8,y:24}});
  g=loadShip(g,'u2');
  assert.equal(get(g,'u2').order.kind,'load-ship');
  get(g,'u1').position={x:8,y:25};
  g=moveUnit(g,'u1',{x:7,y:25});
  assert.equal(get(g,'u2').order.kind,'none');
  assert.equal(g.units.filter(u=>u.aboard==='u2').length,2);
});
