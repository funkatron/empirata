import test from 'node:test';
import assert from 'node:assert/strict';
import {makeRulesLab,makeAiInvasionLab,endTurn,playRedOpponent,updateAllKnowledge} from '../dist/engine/index.js';

function fleet(){
  const g=makeRulesLab();
  const base=g.units.find(u=>u.id==='u3');
  base.position={x:77,y:35}; // out of loading range
  g.units.push({...structuredClone(base),id:'empty-ship',kind:'transport',
    position:{x:81,y:36},aboard:null,fuel:null});
  updateAllKnowledge(g);
  return g;
}
test('Empty AI transport returns to friendly port instead of drifting away',()=>{
  const original=fleet();
  const acted=playRedOpponent(endTurn(original));
  const ship=acted.units.find(u=>u.id==='empty-ship');
  assert.deepEqual(ship.position,{x:80,y:36});
  assert.equal(ship.aboard,null);
});
test('Empty AI transport already in port waits for troops',()=>{
  const g=fleet();
  g.units.find(u=>u.id==='empty-ship').position={x:80,y:36};
  updateAllKnowledge(g);
  const acted=playRedOpponent(endTurn(g));
  assert.deepEqual(acted.units.find(u=>u.id==='empty-ship').position,{x:80,y:36});
});
test('A loaded transport is not sent home by the empty-ship rule',()=>{
  const g=fleet();
  const army=g.units.find(u=>u.id==='u3');
  army.aboard='empty-ship';army.position={x:81,y:36};
  updateAllKnowledge(g);
  const acted=playRedOpponent(endTurn(g));
  assert.equal(acted.units.find(u=>u.id==='u3').aboard,'empty-ship');
  assert.notDeepEqual(acted.units.find(u=>u.id==='empty-ship').position,{x:80,y:36});
});

test('An idle Red army moves toward its coastal loading city',()=>{
  const g=fleet();
  g.units.unshift({...structuredClone(g.units.find(u=>u.id==='u3')),id:'recon',position:{x:76,y:34}});
  // Staging is justified by an existing fleet, not hypothetical future ships.
  updateAllKnowledge(g);
  const original=g.units.find(u=>u.id==='u3').position;
  const acted=playRedOpponent(endTurn(g));
  const moved=acted.units.find(u=>u.id==='u3').position;
  const dist=p=>Math.max(Math.abs(p.x-80),Math.abs(p.y-36));
  assert.ok(dist(moved)<dist(original));
});
test('An army already near its coastal city waits for transport pickup',()=>{
  const g=fleet();
  g.units.unshift({...structuredClone(g.units.find(u=>u.id==='u3')),id:'recon',position:{x:76,y:34}});
  g.units.find(u=>u.id==='u3').position={x:79,y:36};
  updateAllKnowledge(g);
  const acted=playRedOpponent(endTurn(g));
  assert.deepEqual(acted.units.find(u=>u.id==='u3').position,{x:79,y:36});
});

test('AI never reboards an army from an enemy beachhead before its assault',()=>{
  const g=makeAiInvasionLab();
  const ship=g.units.find(u=>u.id==='red-transport');
  const army=g.units.find(u=>u.id==='u3');
  ship.position={x:76,y:28};
  army.position={x:75,y:29};army.aboard=null;
  updateAllKnowledge(g);
  const acted=playRedOpponent(endTurn(g));
  assert.ok(!acted.units.some(u=>u.aboard==='red-transport'),
    'An army already landed on enemy territory must not be loaded again');
  assert.ok(!acted.events.some(e=>e.message.includes('loaded aboard red-transport')),
    'Beachhead should not be treated as a friendly loading port');
});

test('Loaded transport explores when a known overseas city has no charted landing shore',()=>{
  const g=fleet();
  const ship=g.units.find(u=>u.id==='empty-ship');
  const cargo=g.units.find(u=>u.id==='u3');
  ship.position={x:81,y:36};
  cargo.position={...ship.position};cargo.aboard=ship.id;
  updateAllKnowledge(g);
  // Intelligence knows the rival city, but not any of its surrounding coast.
  const rival=g.cities.find(c=>c.id==='c-blue');
  const key=rival.position.y*g.width+rival.position.x;
  g.knowledge.red.terrain[key]='land';
  g.knowledge.red.cities[rival.id]={id:rival.id,owner:'blue',
    production:null,productionKnown:false};
  const before={...ship.position};
  const acted=playRedOpponent(endTurn(g));
  assert.notDeepEqual(acted.units.find(u=>u.id===ship.id).position,before,
    'A known target without a charted beach must not freeze reconnaissance');
});
