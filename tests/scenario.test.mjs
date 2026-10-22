import test from 'node:test';
import assert from 'node:assert/strict';
import {makeRulesLab,makeCloseQuartersLab,nextRandom,getPlayerView,
  importSave,exportSave,moveUnit} from '../dist/engine/index.js';
const unit=(g,id)=>g.units.find(u=>u.id===id);
const neighbor=(a,b)=>Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y))===1;

test('S-001 Close Quarters has nearby enemy army, submarine, fighter and multiple assault armies',()=>{
  const g=makeCloseQuartersLab(),v=getPlayerView(g,'blue');
  assert.equal(g.round,1);assert.equal(g.scenario,'close-quarters');
  assert.ok(neighbor(unit(g,'u1').position,unit(g,'u3').position));
  const sub=g.units.find(u=>u.owner==='red'&&u.kind==='submarine');
  assert.ok(sub);assert.ok(neighbor(unit(g,'u2').position,sub.position));
  assert.ok(v.enemies.some(u=>u.id==='u3'&&!u.stale));
  assert.ok(v.enemies.some(u=>u.id===sub.id&&!u.stale));
  assert.ok(v.enemies.some(u=>u.kind==='fighter'&&!u.stale));
  assert.equal(v.cells[24*g.width+10].city?.id,'c-frontier');
  assert.ok(g.units.filter(u=>u.owner==='blue'&&u.kind==='army'&&neighbor(u.position,{x:10,y:24})).length>=2);
});

test('S-002 ordinary movement resolves army-on-army combat with seeded odds',()=>{
  const start=makeCloseQuartersLab();
  const result=moveUnit(start,'u1',{x:10,y:25});
  assert.equal(Number(Boolean(unit(result,'u1')))+Number(Boolean(unit(result,'u3'))),1);
  assert.equal(result.rng.draws,start.rng.draws+1);
  assert.deepEqual(result,moveUnit(start,'u1',{x:10,y:25}),'same save + command yields same results');
  assert.ok(unit(start,'u1')&&unit(start,'u3'),'input state is immutable');
});

test('S-003 moving destroyer into submarine square produces an actual combat outcome',()=>{
  const g=makeCloseQuartersLab(),sub=g.units.find(u=>u.owner==='red'&&u.kind==='submarine');
  const next=moveUnit(g,'u2',sub.position);
  assert.equal(Boolean(unit(next,'u2'))&&Boolean(unit(next,sub.id)),false);
  assert.ok(next.rng.draws>=1);
  assert.ok(getPlayerView(next,'blue').events.some(e=>e.kind==='combat'));
});

test('S-004 city assaults roll 50% chance and remove attacking army either way',()=>{
  const g=makeCloseQuartersLab();
  const next=moveUnit(g,'u4',{x:10,y:24});
  assert.equal(unit(next,'u4'),undefined);
  assert.ok(['blue',null].includes(next.cities.find(c=>c.id==='c-frontier').owner));
  assert.equal(next.rng.draws,g.rng.draws+1);
  assert.ok(next.events.some(e=>e.kind==='combat'));
});

test('S-005 both conquest outcomes are reachable through seeded rolls',()=>{
  const seeds=[];
  for(let seed=1;seed<20000&&seeds.length<2;seed++){
    const {value}=nextRandom({seed,draws:0});
    if(value<.5&&!seeds.some(x=>x.win))seeds.push({seed,win:true});
    if(value>=.5&&!seeds.some(x=>!x.win))seeds.push({seed,win:false});
  }
  assert.equal(seeds.length,2);
  for(const {seed,win} of seeds){
    const g=makeCloseQuartersLab();g.rng={seed,draws:0};
    const result=moveUnit(g,'u4',{x:10,y:24});
    assert.equal(result.cities.find(c=>c.id==='c-frontier').owner,win?'blue':null);
  }
});

test('S-006 save compatibility and original lab still work',()=>{
  const g=makeCloseQuartersLab();assert.deepEqual(importSave(exportSave(g)),g);
  const classic=makeRulesLab();assert.equal(classic.scenario,'classic-lab');
  assert.deepEqual(unit(classic,'u3').position,{x:79,y:36});
  assert.equal(classic.cities.some(c=>c.id==='c-frontier'),false);
});

test('S-007 an illegal distant attack leaves state and RNG untouched',()=>{
  const g=makeCloseQuartersLab(),before=structuredClone(g);
  assert.throws(()=>moveUnit(g,'u1',{x:79,y:36}),/adjacent/);
  assert.deepEqual(g,before);
});

test('S-008 red opponent takes a real response turn under the same combat rules',async()=>{
  const {advanceLabRound}=await import('../dist/engine/index.js');
  const start=makeCloseQuartersLab();
  const next=advanceLabRound(start);
  assert.equal(start.round,1);assert.equal(next.round,2);assert.equal(next.active,'blue');
  assert.ok(next.rng.draws>start.rng.draws,'contact encounters should consume documented combat rolls');
  assert.ok(getPlayerView(next,'blue').events.some(e=>e.kind==='combat'));
  assert.deepEqual(next,advanceLabRound(start),'opponent response is deterministic for identical inputs');
});

test('S-009 classic rules lab still passes opponent turns without unsolicited AI moves',async()=>{
  const {advanceLabRound}=await import('../dist/engine/index.js');
  const start=makeRulesLab(),next=advanceLabRound(start);
  assert.equal(next.round,2);assert.equal(next.rng.draws,start.rng.draws);
  assert.deepEqual(next.units.filter(u=>u.owner==='red').map(u=>u.position),start.units.filter(u=>u.owner==='red').map(u=>u.position));
});
