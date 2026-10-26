import test from 'node:test';
import assert from 'node:assert/strict';
import {makeRulesLab,endTurn,playRedOpponent,updateAllKnowledge,getPlayerView,STATS} from '../dist/engine/index.js';

const redTurn=()=>endTurn(makeRulesLab());
const own=(g,id)=>g.units.find(u=>u.id===id);
const metric=(a,b)=>Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y));

test('Red AI cannot run during Blue turn and does not mutate input',()=>{
  const g=makeRulesLab();
  assert.throws(()=>playRedOpponent(g),/red faction turn/);
  const red=redTurn(),original=structuredClone(red);
  const acted=playRedOpponent(red);
  assert.deepEqual(red,original);
  assert.equal(acted.active,'red');
});
test('Red AI assigns army production at an unassigned city',()=>{
  const red=redTurn();
  assert.equal(red.cities.find(c=>c.id==='c-red').production,null);
  const acted=playRedOpponent(red);
  assert.equal(acted.cities.find(c=>c.id==='c-red').production,'army');
});
test('Red AI switches an unassigned coastal city to transport production when army-heavy',()=>{
  const g=makeRulesLab();
  const base=g.units.find(u=>u.id==='u3');
  g.units.push({...structuredClone(base),id:'red-a',position:{x:79,y:35}});
  g.units.push({...structuredClone(base),id:'red-b',position:{x:80,y:35}});
  updateAllKnowledge(g);
  const acted=playRedOpponent(endTurn(g));
  assert.equal(acted.cities.find(c=>c.id==='c-red').production,'transport');
});
test('Red AI boards a nearby friendly transport without extra moves or RNG draws',()=>{
  const g=makeRulesLab();
  const red=g.units.find(u=>u.id==='u3');
  red.position={x:80,y:36};
  const ship={...structuredClone(red),id:'red-ship',kind:'transport',position:{x:81,y:36},fuel:null};
  g.units.push(ship);updateAllKnowledge(g);
  const before=g.rng;
  const acted=playRedOpponent(endTurn(g));
  const army=own(acted,'u3'),carrier=own(acted,'red-ship');
  assert.ok(army&&carrier);
  assert.equal(army.aboard,'red-ship');
  assert.deepEqual(army.position,carrier.position);
  assert.equal(army.spent,STATS.army.movement);
  assert.deepEqual(acted.rng,before);
});
test('Red AI disembarks an already embarked army by legal land, without using unseen targets',()=>{
  const g=makeRulesLab();
  const red=g.units.find(u=>u.id==='u3');
  const ship={...structuredClone(red),id:'red-ship',kind:'transport',position:{x:81,y:36},fuel:null};
  red.position={...ship.position};red.aboard=ship.id;
  g.units.push(ship);
  // A neutral city in sight just behind the shore makes a landing useful.
  g.cities.push({id:'near-neutral',position:{x:80,y:35},owner:null,production:null,progress:0,firstCycle:true});
  updateAllKnowledge(g);
  const acted=playRedOpponent(endTurn(g));
  const army=own(acted,'u3');
  assert.ok(army);
  assert.equal(army.aboard,null);
  assert.ok(metric(army.position,{x:81,y:36})<=2);
  assert.equal(acted.rng.draws,0);
});
test('AI city production selection ignores undiscovered opponent city production',()=>{
  const a=makeRulesLab(),b=structuredClone(a);
  b.cities[0].production='battleship';
  updateAllKnowledge(a);updateAllKnowledge(b);
  const viewA=getPlayerView(a,'red'),viewB=getPlayerView(b,'red');
  assert.deepEqual(viewA,viewB);
  const resultA=playRedOpponent(endTurn(a)),resultB=playRedOpponent(endTurn(b));
  assert.equal(resultA.cities.find(c=>c.id==='c-red').production,resultB.cities.find(c=>c.id==='c-red').production);
});
