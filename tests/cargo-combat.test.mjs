import test from 'node:test';
import assert from 'node:assert/strict';
import {makeRulesLab,adjudicateCombat,updateAllKnowledge} from '../dist/engine/index.js';
const get=(g,id)=>g.units.find(u=>u.id===id);

test('Sinking a troop transport destroys its embarked armies',()=>{
 const g=makeRulesLab();
 const enemy={...structuredClone(g.units[2]),id:'transport',kind:'transport',position:{x:6,y:25},damage:2};
 const aboard={...structuredClone(g.units[2]),id:'cargo-army',position:{x:6,y:25},aboard:'transport'};
 g.units.push(enemy,aboard);updateAllKnowledge(g);
 const result=adjudicateCombat(g,{attackerId:'u2',defenderId:'transport',hits:['attacker']});
 assert.equal(get(result,'transport'),undefined);
 assert.equal(get(result,'cargo-army'),undefined);
 assert.ok(get(result,'u2'));
});
test('Surviving damaged carrier immediately loses fighters over reduced capacity',()=>{
 const g=makeRulesLab();
 get(g,'u2').damage=2;
 g.units.push({...structuredClone(g.units[2]),id:'enemy-carrier',kind:'carrier',damage:6,position:{x:6,y:25}});
 for(const id of ['fighter-1','fighter-2'])
   g.units.push({...structuredClone(g.units[2]),id,kind:'fighter',fuel:20,position:{x:6,y:25},aboard:'enemy-carrier'});
 updateAllKnowledge(g);
 const result=adjudicateCombat(g,{attackerId:'u2',defenderId:'enemy-carrier',hits:['attacker','defender']});
 assert.equal(get(result,'u2'),undefined);
 assert.equal(get(result,'enemy-carrier').damage,7);
 assert.equal(result.units.filter(u=>u.aboard==='enemy-carrier').length,1);
 assert.ok(get(result,'fighter-1'));
 assert.equal(get(result,'fighter-2'),undefined);
});
