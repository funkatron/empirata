import test from 'node:test';import assert from 'node:assert/strict';
import {makeRulesLab,endTurn,playRedOpponent,updateAllKnowledge} from '../dist/engine/index.js';
const home=g=>g.cities.find(c=>c.id==='c-red');
test('A coastal faction with one army starts naval reconnaissance before building a transport',()=>{
 const g=endTurn(makeRulesLab());g.units.find(u=>u.owner==='red').position={...home(g).position};updateAllKnowledge(g);const after=playRedOpponent(g);
 assert.equal(home(after).production,'destroyer');
 assert.equal(g.units.filter(u=>u.owner==='red'&&u.kind==='army').length,1);
 assert.equal(g.units.some(u=>u.owner==='red'&&u.kind==='transport'),false);
});
test('Committed scout production retains progress and existing scout prevents another assignment',()=>{
 let g=endTurn(makeRulesLab());g.units.find(u=>u.owner==='red').position={...home(g).position};updateAllKnowledge(g);home(g).production='destroyer';home(g).progress=7;
 const before=structuredClone(g);g=playRedOpponent(g);assert.equal(home(g).progress,7);assert.equal(home(g).production,'destroyer');assert.equal(home(before).progress,7);
 const army=g.units.find(u=>u.owner==='red');g.units.push({...structuredClone(army),id:'scout',kind:'destroyer',position:{x:81,y:36}});updateAllKnowledge(g);
 g=playRedOpponent(g);assert.equal(home(g).production,'army');
});
test('A coastal city with no known navigable sea frontier does not commission a scout',()=>{
 const g=endTurn(makeRulesLab());for(const cell of g.knowledge.red.terrain.keys())if(g.knowledge.red.terrain[cell]==='sea')g.knowledge.red.terrain[cell]=null;
 assert.equal(home(playRedOpponent(g)).production,'army');
});
