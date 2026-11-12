import test from 'node:test';
import assert from 'node:assert/strict';
import {
  makeRulesLab,moveUnit,embarkArmy,disembarkArmy,
  boardFighter,launchFighter,RuleNotImplemented,updateAllKnowledge
} from '../dist/engine/index.js';

function embarkedArmy(){
  const g=makeRulesLab();
  const ship=g.units.find(u=>u.id==='u2');
  const army=g.units.find(u=>u.id==='u1');
  ship.kind='transport';
  army.position={x:8,y:25};
  updateAllKnowledge(g);
  return embarkArmy(g,army.id,ship.id);
}
function embarkedFighter(){
  const g=makeRulesLab();
  const ship=g.units.find(u=>u.id==='u2');
  const fighter=g.units.find(u=>u.id==='u1');
  ship.kind='carrier';
  fighter.kind='fighter';fighter.fuel=20;
  fighter.position={x:8,y:25};
  updateAllKnowledge(g);
  return boardFighter(g,fighter.id,ship.id);
}

test('Embarked army directs callers to the existing legal disembark action',()=>{
  const aboard=embarkedArmy(),before=structuredClone(aboard);
  assert.throws(()=>moveUnit(aboard,'u1',{x:8,y:24}),error=>
    error instanceof Error&&!(error instanceof RuleNotImplemented)&&
    /disembarkArmy/.test(error.message));
  assert.deepEqual(aboard,before,'Rejected move preserves source state');
  aboard.units.find(u=>u.id==='u1').spent=0;
  const landed=disembarkArmy(aboard,'u1',{x:8,y:24});
  assert.equal(landed.units.find(u=>u.id==='u1').aboard,null);
  assert.deepEqual(landed.units.find(u=>u.id==='u1').position,{x:8,y:24});
});

test('Embarked fighter directs callers to the existing legal launch action',()=>{
  const aboard=embarkedFighter(),before=structuredClone(aboard);
  assert.throws(()=>moveUnit(aboard,'u1',{x:6,y:24}),error=>
    error instanceof Error&&!(error instanceof RuleNotImplemented)&&
    /launchFighter/.test(error.message));
  assert.deepEqual(aboard,before,'Rejected move preserves source state');
  aboard.units.find(u=>u.id==='u1').spent=0;
  const launched=launchFighter(aboard,'u1',{x:6,y:24});
  assert.equal(launched.units.find(u=>u.id==='u1').aboard,null);
  assert.deepEqual(launched.units.find(u=>u.id==='u1').position,{x:6,y:24});
});
