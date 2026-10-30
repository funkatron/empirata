import test from 'node:test';
import assert from 'node:assert/strict';
import {makeRulesLab,endTurn,playRedOpponent,updateAllKnowledge} from '../dist/engine/index.js';
function charted(){
 const g=endTurn(makeRulesLab());g.tiles.fill('sea');
 const base=g.units.find(u=>u.id==='u3');
 g.units=[{...structuredClone(base),kind:'destroyer',id:'dd',position:{x:10,y:10}}];
 g.knowledge.red.terrain.fill('sea');updateAllKnowledge(g);return g;
}
test('Destroyer with exhausted reconnaissance holds rather than drifting',()=>{
 const g=charted(),next=playRedOpponent(g);
 assert.deepEqual(next.units.find(u=>u.id==='dd').position,{x:10,y:10});
 assert.equal(next.units.find(u=>u.id==='dd').order.kind,'none');
});
test('Idle destroyer approaches a loaded transport and holds beside it',()=>{
 const g=charted(),base=g.units[0];
 g.units.push({...structuredClone(base),kind:'transport',id:'tr',position:{x:15,y:10}});
 g.units.push({...structuredClone(base),kind:'army',id:'cargo',position:{x:15,y:10},aboard:'tr'});
 const next=playRedOpponent(g),dd=next.units.find(u=>u.id==='dd');
 assert.ok(dd.position.x>10);
 assert.notDeepEqual(dd.position,{x:15,y:10});
});
test('Holding destroyer reacts to a newly visible enemy transport',()=>{
 let g=playRedOpponent(charted());
 g.units.push({...structuredClone(g.units[0]),id:'enemy',owner:'blue',kind:'transport',position:{x:11,y:10}});
 updateAllKnowledge(g);
 assert.ok(playRedOpponent(g).events.some(e=>e.kind==='combat'&&e.message.includes('enemy')));
});
test('Escort already beside a loaded transport holds its station',()=>{
 const g=charted(),base=g.units[0];
 g.units.push({...structuredClone(base),kind:'transport',id:'tr',position:{x:11,y:10}});
 g.units.push({...structuredClone(base),kind:'army',id:'cargo',position:{x:11,y:10},aboard:'tr'});
 assert.deepEqual(playRedOpponent(g).units.find(u=>u.id==='dd').position,{x:10,y:10});
});
