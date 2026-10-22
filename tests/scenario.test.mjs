import test from 'node:test';
import assert from 'node:assert/strict';
import {makeRulesLab,makeCloseQuartersLab,scriptedLabCombat,scriptedLabCapture,
  getPlayerView,importSave,exportSave,moveUnit} from '../dist/engine/index.js';
const unit=(g,id)=>g.units.find(u=>u.id===id);
const neighbor=(a,b)=>Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y))===1;

test('S-001 Close Quarters introduces visible hostile contact from first turn',()=>{
  const g=makeCloseQuartersLab(), v=getPlayerView(g,'blue');
  assert.equal(g.round,1);assert.equal(g.scenario,'close-quarters');
  assert.deepEqual(unit(g,'u1').position,{x:9,y:25});
  assert.deepEqual(unit(g,'u3').position,{x:10,y:25});
  assert.equal(neighbor(unit(g,'u1').position,unit(g,'u3').position),true);
  const sub=g.units.find(u=>u.owner==='red'&&u.kind==='submarine');
  assert.ok(sub);assert.equal(neighbor(unit(g,'u2').position,sub.position),true);
  assert.ok(v.enemies.some(u=>u.id==='u3'&&!u.stale));
  assert.ok(v.enemies.some(u=>u.id===sub.id&&!u.stale),'adjacent destroyer must detect submarine');
  assert.ok(v.enemies.some(u=>u.kind==='fighter'&&!u.stale));
  assert.equal(v.cells[24*g.width+10].city?.id,'c-frontier');
});

test('S-002 one selection/tap can initiate scripted blue victory or defeat',()=>{
  const start=makeCloseQuartersLab();
  const blue=scriptedLabCombat(start,'u1','u3','attacker');
  assert.equal(unit(blue,'u3'),undefined);
  assert.deepEqual(unit(blue,'u1').position,{x:10,y:25});
  assert.equal(unit(blue,'u1').spent,1);
  const red=scriptedLabCombat(start,'u1','u3','defender');
  assert.equal(unit(red,'u1'),undefined);
  assert.ok(unit(red,'u3'));
  assert.deepEqual(unit(start,'u1').position,{x:9,y:25},'source state must be unchanged');
});

test('S-003 nearby submarine battle is detectable and adjudicable in either direction',()=>{
  const start=makeCloseQuartersLab();
  const sub=start.units.find(u=>u.owner==='red'&&u.kind==='submarine');
  assert.ok(sub);
  const win=scriptedLabCombat(start,'u2',sub.id,'attacker');
  assert.equal(unit(win,sub.id),undefined);
  assert.ok(unit(win,'u2'));
  const lose=scriptedLabCombat(start,'u2',sub.id,'defender');
  assert.equal(unit(lose,'u2'),undefined);
  assert.ok(unit(lose,sub.id));
});

test('S-004 immediate neutral city assault is a scripted garrison or army loss',()=>{
  const start=makeCloseQuartersLab();
  const win=scriptedLabCapture(start,'u1','c-frontier','captured');
  assert.equal(win.cities.find(c=>c.id==='c-frontier').owner,'blue');
  assert.equal(unit(win,'u1'),undefined);
  const lose=scriptedLabCapture(start,'u1','c-frontier','repelled');
  assert.equal(lose.cities.find(c=>c.id==='c-frontier').owner,null);
  assert.equal(unit(lose,'u1'),undefined);
});

test('S-005 historical probabilities stay gated during ordinary movement',()=>{
  const g=makeCloseQuartersLab();
  assert.throws(()=>moveUnit(g,'u1',{x:10,y:25}),/not yet verified/);
  assert.throws(()=>moveUnit(g,'u1',{x:10,y:24}),/assault probabilities/);
});

test('S-006 scenario is save-compatible, original rules lab remains unchanged',()=>{
  const g=makeCloseQuartersLab();
  assert.deepEqual(importSave(exportSave(g)),g);
  const classic=makeRulesLab();assert.equal(classic.scenario,'classic-lab');
  assert.deepEqual(unit(classic,'u3').position,{x:79,y:36});
  assert.equal(classic.cities.some(c=>c.id==='c-frontier'),false);
});

test('S-007 scripted result helpers reject wrong scenario and unseen enemies',()=>{
  assert.throws(()=>scriptedLabCombat(makeRulesLab(),'u1','u3','attacker'),/Close Quarters/);
  assert.throws(()=>scriptedLabCapture(makeRulesLab(),'u1','c-blue','captured'),/Close Quarters/);
  const g=makeCloseQuartersLab();
  const extra=structuredClone(g.units.find(u=>u.id==='u3'));
  extra.id='u-secret';extra.position={x:65,y:30};g.units.push(extra);
  assert.throws(()=>scriptedLabCombat(g,'u1','u-secret','attacker'),/visible/);
});
