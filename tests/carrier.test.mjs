import test from 'node:test';
import assert from 'node:assert/strict';
import {makeRulesLab,boardFighter,launchFighter,moveUnit,advanceLabRound,capacity,importSave,exportSave,updateAllKnowledge} from '../dist/engine/index.js';
const get=(g,id)=>g.units.find(u=>u.id===id);
const setup=()=>{
  const g=makeRulesLab();
  g.units[1].kind='carrier';g.units[1].position={x:7,y:25};
  g.units[0].kind='fighter';g.units[0].position={x:8,y:25};g.units[0].fuel=8;
  updateAllKnowledge(g);return g;
};
test('Fighter boards carrier, loses map presence, refuels, and persists',()=>{
  const initial=setup(),g=boardFighter(initial,'u1','u2');
  assert.equal(get(g,'u1').aboard,'u2');
  assert.deepEqual(get(g,'u1').position,get(g,'u2').position);
  assert.equal(get(g,'u1').fuel,20);
  assert.equal(get(g,'u1').spent,1);
  assert.equal(get(initial,'u1').aboard,null);
  assert.deepEqual(importSave(exportSave(g)),g);
});
test('Moving a fighter into friendly carrier embarks it',()=>{
  const g=moveUnit(setup(),'u1',{x:7,y:25});
  assert.equal(get(g,'u1').aboard,'u2');
});
test('Carrier carries fighter to new square and fighter launches after turn reset',()=>{
  let g=boardFighter(setup(),'u1','u2');
  g=moveUnit(g,'u2',{x:6,y:25});
  assert.deepEqual(get(g,'u1').position,{x:6,y:25});
  g=advanceLabRound(g);
  g=launchFighter(g,'u1',{x:6,y:24});
  assert.equal(get(g,'u1').aboard,null);
  assert.deepEqual(get(g,'u1').position,{x:6,y:24});
  assert.equal(get(g,'u1').fuel,19);
  assert.equal(get(g,'u1').spent,1);
});
test('Fighter cannot launch during same turn if movement is exhausted',()=>{
  let g=boardFighter(setup(),'u1','u2');
  g.units.find(u=>u.id==='u1').spent=5;
  assert.throws(()=>launchFighter(g,'u1',{x:6,y:25}),/movement/);
});
test('Damaged carrier capacity limits boarding and movement when overloaded',()=>{
  const initial=setup();initial.units[1].damage=8;
  assert.equal(capacity(initial.units[1]),0);
  assert.throws(()=>boardFighter(initial,'u1','u2'),/full/);
  const g=boardFighter(setup(),'u1','u2');
  get(g,'u2').damage=8;
  assert.throws(()=>moveUnit(g,'u2',{x:6,y:25}),/overloaded/);
});
test('Fighter cannot board an enemy or nonexistent carrier',()=>{
  const g=setup();
  for(const id of ['u3','missing'])assert.throws(()=>boardFighter(g,'u1',id),/friendly active fighter and carrier/);
});
test('Carrier docking unloads and refuels its fighter',()=>{
  let g=boardFighter(setup(),'u1','u2');
  g=advanceLabRound(g);
  g=moveUnit(g,'u2',{x:8,y:25});
  assert.equal(get(g,'u1').aboard,null);
  assert.equal(get(g,'u1').fuel,20);
  assert.deepEqual(get(g,'u1').position,{x:8,y:25});
});
