import test from 'node:test';import assert from 'node:assert/strict';
import {chooseAiTransportObjective,makeAiInvasionLab,endTurn,playRedOpponent,getPlayerView,exportSave,importSave} from '../dist/engine/index.js';
function fixture(){const g=endTurn(makeAiInvasionLab()),ship=g.units.find(u=>u.id==='red-transport');return {g,ship,view:getPlayerView(g,'red')};}
test('A loaded transport retains its known objective when a nearer city is discovered',()=>{
 const {ship,view}=fixture();const id=chooseAiTransportObjective(view,ship);assert.equal(id,'invasion-outpost');ship.aiObjective=id;
 view.cells[30*view.width+82]={terrain:'land',visible:true,city:{id:'nearer',owner:null,production:null,productionKnown:false}};
 assert.equal(chooseAiTransportObjective(view,ship),id);
 const fresh={...ship};delete fresh.aiObjective;assert.equal(chooseAiTransportObjective(view,fresh),'nearer');
});
test('A captured objective and empty cargo invalidate a transport mission',()=>{
 const {ship,view}=fixture();ship.aiObjective='invasion-outpost';
 view.cells.find(c=>c.city?.id===ship.aiObjective).city.owner='red';
 assert.equal(chooseAiTransportObjective(view,ship),undefined);
 view.cells.find(c=>c.city?.id===ship.aiObjective).city.owner='blue';
 view.ownUnits=view.ownUnits.filter(u=>!u.aboard);assert.equal(chooseAiTransportObjective(view,ship),undefined);
});
test('AI assigns missions immutably and retains them through save/reload',()=>{
 const {g}=fixture(),before=structuredClone(g),result=playRedOpponent(g);
 assert.deepEqual(g,before);assert.equal(result.units.find(u=>u.id==='red-transport').aiObjective,'invasion-outpost');
 assert.deepEqual(importSave(exportSave(result)),result);
 const malformed=structuredClone(result);malformed.units.find(u=>u.id==='red-transport').aiObjective='missing';
 assert.throws(()=>importSave(exportSave(malformed)),/objective/);
});
