import test from 'node:test';
import assert from 'node:assert/strict';
import {unitName,unitLabel,UNIT_TYPES,makeCloseQuartersLab,makeRulesLab,
  getPlayerView,exportSave,importSave,moveUnit,selectProduction,advanceLabRound} from '../dist/engine/index.js';

test('Conventional formations and ship designations cover every unit and faction',()=>{
  const expected={army:/Infantry Division$/,fighter:/Fighter Squadron “.+”$/,
    destroyer:/\(DD-1\)$/,transport:/\(AP-1\)$/,submarine:/\(SS-1\)$/,
    cruiser:/\(CA-1\)$/,carrier:/\(CV-1\)$/,battleship:/\(BB-1\)$/};
  for(const owner of ['blue','red','green'])for(const kind of UNIT_TYPES){
    const identity={id:'u1',owner,kind};
    assert.match(unitName(identity),expected[kind]);
    assert.equal(unitLabel(identity),`u1 (${unitName(identity)})`);
  }
  assert.equal(unitName({id:'u1',owner:'blue',kind:'army'}),'Blue 1st Infantry Division');
  assert.equal(unitName({id:'u1',owner:'red',kind:'destroyer'}),'RNS Fletcher (DD-1)');
});

test('Formation ordinals handle teens and names remain distinct beyond ship-name pools',()=>{
  for(const [n,suffix] of [[2,'2nd'],[3,'3rd'],[4,'4th'],[11,'11th'],[12,'12th'],[13,'13th'],[21,'21st'],[22,'22nd'],[23,'23rd'],[111,'111th']]){
    assert.ok(unitName({id:`u${n}`,kind:'army',owner:'blue'}).includes(`${suffix} Infantry`));
  }
  for(const kind of UNIT_TYPES){
    const names=Array.from({length:2000},(_,i)=>unitName({id:`u${i+1}`,kind,owner:'blue'}));
    assert.equal(new Set(names).size,names.length);
  }
});

test('Names survive movement and save round trips without consuming random draws or changing state',()=>{
  const g=makeCloseQuartersLab(),before=structuredClone(g);
  const names=g.units.map(unitName);
  assert.deepEqual(g,before);
  const restored=importSave(exportSave(g));
  assert.deepEqual(restored.units.map(unitName),names);
  const moving=g.units.find(u=>u.id==='u2');
  const next=moveUnit(g,moving.id,{x:7,y:24});
  assert.equal(unitName(next.units.find(u=>u.id===moving.id)),unitName(moving));
  assert.equal(next.rng.draws,g.rng.draws);
  // Scenario IDs do not need a new numeric identity or save migration.
  for(const id of ['red-transport','red-scout','u0','u999999999999999999999']){
    const identity={id,owner:'red',kind:'transport'};
    assert.equal(unitName(identity),unitName(structuredClone(identity)));
    assert.match(unitName(identity),/^RNS .+ \(AP-\d+\)$/);
  }
});

test('Known enemy names come from sightings and do not expose hidden units',()=>{
  const g=makeCloseQuartersLab();
  g.units.push({...structuredClone(g.units.find(u=>u.owner==='red')),id:'hidden',position:{x:90,y:50}});
  const view=getPlayerView(g,'blue');
  for(const sight of view.enemies){
    assert.equal(unitName(sight),unitName(g.units.find(u=>u.id===sight.id)));
  }
  assert.ok(!view.enemies.some(s=>s.id==='hidden'));
  const target=g.units.find(u=>u.owner==='red'&&u.kind==='fighter');
  const remembered=structuredClone(view.enemies.find(s=>s.id===target.id));
  assert.ok(remembered);
  target.position={x:90,y:50};
  assert.equal(unitName(remembered),unitName(target));
  assert.notDeepEqual(remembered.position,target.position);
});

test('Produced formations and combat reports use the same names as inspection',()=>{
  let g=selectProduction(makeRulesLab(),'c-blue','army');
  for(let n=0;n<6;n++)g=advanceLabRound(g);
  const built=g.units.find(u=>u.id==='u4');
  assert.ok(built);
  assert.ok(g.events.some(e=>e.kind==='production'&&e.message.includes(unitName(built))));
  const encounter=makeCloseQuartersLab();
  const attacker=encounter.units.find(u=>u.id==='u1'),defender=encounter.units.find(u=>u.id==='u3');
  const fought=moveUnit(encounter,attacker.id,defender.position);
  assert.ok(fought.events.some(e=>e.kind==='combat'&&e.message.includes(unitName(attacker))&&e.message.includes(unitName(defender))));
});
