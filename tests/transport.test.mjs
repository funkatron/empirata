import test from 'node:test';
import assert from 'node:assert/strict';
import {makeRulesLab,embarkArmy,disembarkArmy,moveUnit,advanceLabRound,capacity,exportSave,importSave,updateAllKnowledge} from '../dist/engine/index.js';
const unit=(g,id)=>g.units.find(u=>u.id===id);
const setup=()=>{const g=makeRulesLab();g.units[1].kind='transport';g.units[0].position={x:8,y:25};updateAllKnowledge(g);return g;};

test('Army boards an adjacent friendly transport and is removed from visible map',()=>{
 const initial=setup(),next=embarkArmy(initial,'u1','u2');
 assert.equal(unit(next,'u1').aboard,'u2');assert.deepEqual(unit(next,'u1').position,{x:7,y:25});
 assert.equal(unit(next,'u1').spent,1);assert.equal(unit(initial,'u1').aboard,null);
 assert.deepEqual(next.rng,initial.rng);
});
test('Manual movement onto a friendly transport automatically boards',()=>{
 const g=moveUnit(setup(),'u1',{x:7,y:25});
 assert.equal(unit(g,'u1').aboard,'u2');
});
test('Embarked army travels with its transport and lands by a legal adjacent shore',()=>{
 let g=embarkArmy(setup(),'u1','u2');
 g=moveUnit(g,'u2',{x:6,y:25});
 assert.deepEqual(unit(g,'u1').position,{x:6,y:25});
 assert.throws(()=>disembarkArmy(g,'u1',{x:6,y:24}),/movement/);
 g=advanceLabRound(g);
 g=moveUnit(g,'u2',{x:7,y:25});
 g=disembarkArmy(g,'u1',{x:8,y:24});
 assert.equal(unit(g,'u1').aboard,null);assert.deepEqual(unit(g,'u1').position,{x:8,y:24});
 assert.deepEqual(g.rng,setup().rng);
});
test('Reject unrelated, remote, unfriendly and full transport boarding',()=>{
 const g=setup();
 assert.throws(()=>embarkArmy(g,'u1','u3'),/friendly army and transport/);
 g.units[1].position={x:4,y:25};
 assert.throws(()=>embarkArmy(g,'u1','u2'),/adjacent/);
 const a=setup();a.units[1].damage=3;
 assert.equal(capacity(a.units[1]),0);
 assert.throws(()=>embarkArmy(a,'u1','u2'),/full/);
});
test('Disembark rejects non-land squares and hostile landing cells',()=>{
 let g=embarkArmy(setup(),'u1','u2');g=advanceLabRound(g);
 assert.throws(()=>disembarkArmy(g,'u1',{x:6,y:25}),/land/);
 const enemy={...structuredClone(unit(g,'u3')),id:'block',position:{x:8,y:24}};
 g.units.push(enemy);
 assert.throws(()=>disembarkArmy(g,'u1',{x:8,y:24}),/occupied/);
});
test('Damaged overloaded transport cannot move until cargo is unloaded',()=>{
 let g=setup();
 g.units.push({...structuredClone(unit(g,'u1')),id:'u4',position:{x:8,y:24}});
 g=embarkArmy(g,'u1','u2');
 g=embarkArmy(g,'u4','u2');
 g.units.find(u=>u.id==='u2').damage=3;
 assert.throws(()=>moveUnit(g,'u2',{x:6,y:25}),/overloaded/);
});
test('Cargo position and type are checked on save import',()=>{
 const g=embarkArmy(setup(),'u1','u2');
 assert.deepEqual(importSave(exportSave(g)),g);
 const bad=structuredClone(g);unit(bad,'u1').position={x:8,y:25};
 assert.throws(()=>importSave(exportSave(bad)),/embarked/i);
});
test('Transport docking at a friendly port unloads cargo',()=>{
 let g=embarkArmy(setup(),'u1','u2');
 g=advanceLabRound(g);
 g=moveUnit(g,'u2',{x:8,y:25});
 assert.equal(unit(g,'u1').aboard,null);assert.deepEqual(unit(g,'u1').position,{x:8,y:25});
});
