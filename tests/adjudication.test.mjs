import test from 'node:test';
import assert from 'node:assert/strict';
import {makeRulesLab,adjudicateCityCapture,adjudicateCombat,updateAllKnowledge,
  getPlayerView,moveUnit,movementAllowance,exportSave,importSave} from '../dist/engine/index.js';
const copy=(u,patch)=>({...structuredClone(u),...patch});
const base=()=>makeRulesLab();
const addCity=(game,patch={})=>{game.cities.push({id:'test-city',position:{x:10,y:25},owner:null,production:null,progress:0,firstCycle:true,...patch});updateAllKnowledge(game);return game;};

test('A-001 city capture removes the army and creates a garrison/production opportunity',()=>{
  const initial=addCity(base()),before=structuredClone(initial);
  const g=adjudicateCityCapture(initial,{armyId:'u1',cityId:'test-city',outcome:'captured'});
  assert.equal(g.cities.at(-1).owner,'blue');assert.equal(g.cities.at(-1).production,null);
  assert.equal(g.cities.at(-1).firstCycle,true);assert.equal(g.units.some(u=>u.id==='u1'),false);
  assert.equal(getPlayerView(g,'blue').ownCities.length,2);
  assert.deepEqual(initial,before,'adjudication cannot mutate an input state');
});
test('A-002 failed city attack destroys only attacking army',()=>{
  const initial=addCity(base()),g=adjudicateCityCapture(initial,{armyId:'u1',cityId:'test-city',outcome:'repelled'});
  assert.equal(g.cities.at(-1).owner,null);assert.equal(g.units.some(u=>u.id==='u1'),false);
});
test('A-003 conquest destroys all city occupants including embarked cargo',()=>{
  const initial=addCity(base(),{owner:'red',production:'fighter',progress:9,firstCycle:false});
  const template=initial.units[1];
  initial.units.push(copy(template,{id:'red-carrier',kind:'carrier',owner:'red',position:{x:10,y:25}}));
  initial.units.push(copy(template,{id:'red-fighter',kind:'fighter',owner:'red',aboard:'red-carrier',position:{x:10,y:25},fuel:20}));
  initial.units.push(copy(template,{id:'red-army',kind:'army',owner:'red',position:{x:10,y:25}}));
  const g=adjudicateCityCapture(initial,{armyId:'u1',cityId:'test-city',outcome:'captured'});
  assert.equal(g.units.some(u=>['red-carrier','red-fighter','red-army','u1'].includes(u.id)),false);
  assert.equal(g.cities.at(-1).owner,'blue');assert.equal(g.cities.at(-1).production,null);
  assert.equal(getPlayerView(g,'red').events.some(e=>e.message.includes('captured')),true);
});
test('A-004 cannot capture own city, distant city, with non-army, or with spent army',()=>{
  let g=addCity(base());
  assert.throws(()=>adjudicateCityCapture(g,{armyId:'u1',cityId:'c-blue',outcome:'captured'}),/friendly/);
  assert.throws(()=>adjudicateCityCapture(g,{armyId:'u1',cityId:'c1',outcome:'captured'}),/adjacent/);
  assert.throws(()=>adjudicateCityCapture(g,{armyId:'u2',cityId:'test-city',outcome:'captured'}),/army/);
  g.units.find(u=>u.id==='u1').spent=1;
  assert.throws(()=>adjudicateCityCapture(g,{armyId:'u1',cityId:'test-city',outcome:'captured'}),/No movement/);
});
test('A-005 battle requires ending on the killing blow (no hidden rolls)',()=>{
  const g=base();g.units.push(copy(g.units[2],{id:'enemy',position:{x:10,y:25}}));
  assert.throws(()=>adjudicateCombat(g,{attackerId:'u1',defenderId:'enemy',hits:[]}),/nonempty/);
  assert.throws(()=>adjudicateCombat(g,{attackerId:'u1',defenderId:'enemy',hits:['attacker','attacker']}),/cannot continue/);
  assert.throws(()=>adjudicateCombat(g,{attackerId:'u1',defenderId:'enemy',hits:['invalid']}),/Invalid hit/);
});
test('A-006 attacker wins and advances, with one movement consumed',()=>{
  const g=base();g.units.push(copy(g.units[2],{id:'enemy',position:{x:10,y:25}}));
  const next=adjudicateCombat(g,{attackerId:'u1',defenderId:'enemy',hits:['attacker']});
  assert.equal(next.units.some(u=>u.id==='enemy'),false);
  assert.deepEqual(next.units.find(u=>u.id==='u1').position,{x:10,y:25});
  assert.equal(next.units.find(u=>u.id==='u1').spent,1);
});
test('A-007 defender wins and its damage persists',()=>{
  const g=base();g.units.push(copy(g.units[1],{id:'enemy',owner:'red',kind:'cruiser',damage:0,position:{x:10,y:25}}));
  const next=adjudicateCombat(g,{attackerId:'u1',defenderId:'enemy',hits:['attacker','defender']});
  assert.equal(next.units.some(u=>u.id==='u1'),false);
  assert.equal(next.units.find(u=>u.id==='enemy').damage,1);
});
test('A-008 submarine hits deal three damage; lost transports lose all cargo',()=>{
  const g=base();g.units.push(copy(g.units[1],{id:'enemy-sub',owner:'red',kind:'submarine',position:{x:6,y:25},damage:0}));
  const ship=g.units.find(u=>u.id==='u2');ship.damage=0;
  const next=adjudicateCombat(g,{attackerId:'u2',defenderId:'enemy-sub',hits:['defender']});
  assert.equal(next.units.some(u=>u.id==='u2'),false);
  assert.equal(next.units.find(u=>u.id==='enemy-sub').damage,0);
  // Cargo on sinking ship is removed, including recursively nested cargo.
  g.units.push(copy(g.units[0],{id:'cargo',aboard:'u2',position:{x:7,y:25}}));
  const again=adjudicateCombat(g,{attackerId:'u2',defenderId:'enemy-sub',hits:['defender']});
  assert.equal(again.units.some(u=>u.id==='cargo'),false);
});
test('A-009 damaged destroyer retains damage; movement allowance reacts at threshold',()=>{
  const g=base();g.units.push(copy(g.units[2],{id:'enemy',kind:'fighter',position:{x:6,y:25},fuel:20}));
  const next=adjudicateCombat(g,{attackerId:'u2',defenderId:'enemy',hits:['defender','defender','attacker']});
  assert.equal(next.units.find(u=>u.id==='u2').damage,2);
  assert.equal(movementAllowance(next.units.find(u=>u.id==='u2')),1);
});
test('A-010 destroyer and transport cannot attack armies, army cannot attack submarine',()=>{
  const g=base();g.units.push(copy(g.units[2],{id:'enemy-sub',kind:'submarine',position:{x:10,y:25}}));
  assert.throws(()=>adjudicateCombat(g,{attackerId:'u1',defenderId:'enemy-sub',hits:['attacker']}),/Armies cannot attack submarines/);
  const ship=base();ship.units.push(copy(ship.units[2],{id:'enemy-army',position:{x:6,y:25}}));
  assert.throws(()=>adjudicateCombat(ship,{attackerId:'u2',defenderId:'enemy-army',hits:['attacker']}),/cannot attack armies/);
});
test('A-011 cruiser bombardment strikes adjacent coastal army without advancing',()=>{
  const g=base();g.units.find(u=>u.id==='u2').kind='cruiser';
  // Coastal land square {8,24} is adjacent to sea near {7,25}
  g.units.push(copy(g.units[2],{id:'coastal-army',position:{x:8,y:24}}));
  const next=adjudicateCombat(g,{attackerId:'u2',defenderId:'coastal-army',hits:['attacker']});
  assert.deepEqual(next.units.find(u=>u.id==='u2').position,{x:7,y:25});
  assert.equal(next.units.find(u=>u.id==='u2').spent,1);
});
test('A-012 moving onto an adjacent enemy initiates combat (no result buttons)',()=>{
  const g=base();g.units.push(copy(g.units[2],{id:'enemy',position:{x:10,y:25}}));
  const next=moveUnit(g,'u1',{x:10,y:25});
  assert.equal(next.units.some(u=>u.id==='u1') && next.units.some(u=>u.id==='enemy'),false);
  assert.equal(next.rng.draws,1);
  assert.equal(next.events.some(e=>e.kind==='combat'),true);
});
test('A-013 an adjudicated state exports and imports losslessly',()=>{
  const g=adjudicateCityCapture(addCity(base()),{armyId:'u1',cityId:'test-city',outcome:'captured'});
  assert.deepEqual(importSave(exportSave(g)),g);
});
test('A-014 reports are delivered to participants without omniscient information',()=>{
  const g=adjudicateCityCapture(addCity(base()),{armyId:'u1',cityId:'test-city',outcome:'captured'});
  const blue=getPlayerView(g,'blue');const red=getPlayerView(g,'red');
  assert.equal(blue.events.some(e=>e.kind==='combat'),true);
  assert.equal(red.events.some(e=>e.kind==='combat'),false);
});
