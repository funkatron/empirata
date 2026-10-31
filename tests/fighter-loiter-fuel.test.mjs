import test from 'node:test';import assert from 'node:assert/strict';
import {makeRulesLab,endTurn,moveUnit,setOrder,updateAllKnowledge,exportSave,importSave} from '../dist/engine/index.js';
function airborne(){const g=makeRulesLab(),base=g.units[0];g.units=[{...structuredClone(base),id:'f',owner:'blue',kind:'fighter',position:{x:40,y:50},fuel:20}];g.tiles[50*g.width+40]='sea';g.tiles[50*g.width+41]='sea';updateAllKnowledge(g);return g;}
test('Stationary airborne fighters burn fuel each owner turn and crash',()=>{
 let g=airborne();for(let i=0;i<3;i++){g=endTurn(g);assert.equal(g.units[0].fuel,15-i*5);g=endTurn(g);}
 g=endTurn(g);assert.equal(g.units.length,0);assert.ok(g.events.some(e=>e.kind==='fuel'&&e.message.includes('crashed')));
});
test('Movement and loitering charge a single turn budget, and skip cannot evade it',()=>{
 const g=airborne(),moved=moveUnit(g,'f',{x:41,y:50});assert.equal(moved.units[0].fuel,19);assert.equal(endTurn(moved).units[0].fuel,15);
 const skipped=setOrder(g,'f',{kind:'skip'});assert.equal(skipped.units[0].fuel,15);assert.equal(endTurn(skipped).units[0].fuel,15);
 assert.equal(g.units[0].fuel,20);assert.deepEqual(endTurn(importSave(exportSave(moved))),endTurn(moved));
});
test('Friendly city and carrier-based fighters do not consume loiter fuel',()=>{
 const g=airborne();g.units[0].position={...g.cities.find(c=>c.owner==='blue').position};assert.equal(endTurn(g).units[0].fuel,20);
 const h=airborne();h.units.push({...structuredClone(h.units[0]),id:'carrier',kind:'carrier',fuel:null});h.units[0].aboard='carrier';assert.equal(endTurn(h).units.find(u=>u.id==='f').fuel,20);
});
